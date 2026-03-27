---
title: "📞 gRPC, Versionado de APIs y Database per Service"
sidebar_position: 1
---

# 📞 gRPC, Versionado de APIs y Database per Service

## gRPC — Comunicación de alto rendimiento

gRPC es ideal para comunicación interna entre microservicios donde importa la latencia y el tipado estricto del contrato.

```
REST vs gRPC:
  REST:  JSON sobre HTTP/1.1 → texto, verbose, sin contrato forzado
  gRPC:  Protobuf sobre HTTP/2 → binario, compacto, contrato en .proto

Ventajas de gRPC en microservicios:
  ✅ 5-10x más eficiente que JSON en tamaño de payload
  ✅ HTTP/2: multiplexing, headers comprimidos
  ✅ Streaming bidireccional (ideal para eventos en tiempo real)
  ✅ Contrato explícito en .proto → genera código cliente/servidor
  ✅ Tipado estricto (no hay sorpresas de campos faltantes)

Desventajas:
  ❌ No legible por humanos (necesitas herramientas para inspeccionar)
  ❌ No soportado nativamente por navegadores (necesita grpc-web)
  ❌ Más setup inicial
```

### Definición del contrato (.proto)

```protobuf
// protos/inventario.proto
syntax = "proto3";

option csharp_namespace = "MiApp.Inventario";

package inventario;

service InventarioService {
  rpc ObtenerStock (StockRequest) returns (StockResponse);
  rpc ReservarStock (ReservaRequest) returns (ReservaResponse);
  // Streaming: emitir actualizaciones de stock en tiempo real
  rpc MonitorearStock (StockRequest) returns (stream StockResponse);
}

message StockRequest {
  string producto_id = 1;
}

message StockResponse {
  string producto_id = 1;
  int32 cantidad = 2;
  bool disponible = 3;
}

message ReservaRequest {
  string producto_id = 1;
  int32 cantidad = 2;
  string pedido_id = 3;
}

message ReservaResponse {
  bool exitoso = 1;
  string mensaje = 2;
}
```

### Servidor gRPC en ASP.NET Core

```csharp
// InventarioGrpcService.cs
public class InventarioGrpcService : InventarioService.InventarioServiceBase
{
    private readonly IInventarioRepository _repo;

    public override async Task<StockResponse> ObtenerStock(
        StockRequest request, ServerCallContext context)
    {
        var stock = await _repo.GetByProductoIdAsync(request.ProductoId);

        if (stock is null)
            throw new RpcException(new Status(StatusCode.NotFound,
                $"Producto {request.ProductoId} no encontrado"));

        return new StockResponse
        {
            ProductoId = stock.ProductoId,
            Cantidad   = stock.Cantidad,
            Disponible = stock.Cantidad > 0
        };
    }

    // Streaming: emite actualizaciones cada vez que el stock cambia
    public override async Task MonitorearStock(
        StockRequest request,
        IServerStreamWriter<StockResponse> responseStream,
        ServerCallContext context)
    {
        while (!context.CancellationToken.IsCancellationRequested)
        {
            var stock = await _repo.GetByProductoIdAsync(request.ProductoId);
            await responseStream.WriteAsync(new StockResponse
            {
                ProductoId = stock.ProductoId,
                Cantidad   = stock.Cantidad,
                Disponible = stock.Cantidad > 0
            });

            await Task.Delay(TimeSpan.FromSeconds(5), context.CancellationToken);
        }
    }
}

// Program.cs
builder.Services.AddGrpc(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

app.MapGrpcService<InventarioGrpcService>();
```

### Cliente gRPC (en el servicio Pedidos)

```csharp
// Registro del cliente con interceptors y resiliencia
builder.Services.AddGrpcClient<InventarioService.InventarioServiceClient>(options =>
{
    options.Address = new Uri("https://inventario-service:443");
})
.AddCallCredentials(async (context, metadata) =>
{
    // Autenticación service-to-service
    var token = await _tokenService.GetServiceTokenAsync();
    metadata.Add("Authorization", $"Bearer {token}");
})
.ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
{
    // En Kubernetes con mTLS, deshabilitar validación del cert del servicio interno
    ServerCertificateCustomValidationCallback =
        HttpClientHandler.DangerousAcceptAnyServerCertificateValidator
});

// Uso en el servicio de Pedidos
public class PedidoService
{
    private readonly InventarioService.InventarioServiceClient _inventario;

    public async Task<bool> ProcesarPedidoAsync(Pedido pedido)
    {
        try
        {
            var reserva = await _inventario.ReservarStockAsync(new ReservaRequest
            {
                ProductoId = pedido.ProductoId,
                Cantidad   = pedido.Cantidad,
                PedidoId   = pedido.Id.ToString()
            });

            return reserva.Exitoso;
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.Unavailable)
        {
            // El servicio de inventario no está disponible
            throw new ServicioNoDisponibleException("Inventario", ex);
        }
    }
}
```

---

## Versionado de APIs entre microservicios

### Estrategias de versionado

```
1. URL VERSIONING — el más explícito y común
   GET /api/v1/productos
   GET /api/v2/productos

   Pros: visible, cacheable, fácil de enrutar en el API Gateway
   Cons: "contamina" la URL (REST puristas lo critican)

2. HEADER VERSIONING — más "limpio" según REST
   GET /api/productos
   Header: Api-Version: 2.0

   Pros: URL limpia
   Cons: no cacheable por CDN, no visible en la URL

3. CONTENT NEGOTIATION (Accept header)
   GET /api/productos
   Accept: application/vnd.miapp.v2+json

   Pros: es el más "RESTful"
   Cons: verboso, difícil de testear desde el navegador

4. QUERY STRING — evitar en APIs públicas
   GET /api/productos?version=2
```

### Implementación en ASP.NET Core

```csharp
// Instalar: dotnet add package Asp.Versioning.Mvc

builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true; // Agrega headers api-supported-versions
    options.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),          // /api/v1/...
        new HeaderApiVersionReader("Api-Version"), // Header: Api-Version: 1.0
        new QueryStringApiVersionReader("v")       // ?v=1.0 (fallback)
    );
});

// V1 — contrato original
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/productos")]
public class ProductosV1Controller : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new[] { new ProductoDtoV1 { Id = 1, Nombre = "Laptop" } });
}

// V2 — contrato extendido (nuevo campo, nunca quitar campos de V1)
[ApiController]
[ApiVersion("2.0")]
[Route("api/v{version:apiVersion}/productos")]
public class ProductosV2Controller : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new[] { new ProductoDtoV2
    {
        Id = 1, Nombre = "Laptop",
        Categoria = "Electrónica", // Campo nuevo en V2
        Precio = 999.99m           // Campo nuevo en V2
    }});
}

// Deprecar una versión (avisa a los clientes con headers)
[ApiVersion("1.0", Deprecated = true)]
```

### Versionado de mensajes/eventos en el bus

```csharp
// Estrategia: envelope con versión explícita
public class EventEnvelope<T>
{
    public string EventType    { get; set; } = typeof(T).Name;
    public string Version      { get; set; } = "1.0";
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    public T Payload           { get; set; } = default!;
}

// Consumidor tolerante (Tolerant Reader pattern):
// Acepta V1 y V2, los campos nuevos son opcionales
public class PedidoConfirmadoConsumer
    : IConsumer<EventEnvelope<PedidoConfirmadoV1>>,
      IConsumer<EventEnvelope<PedidoConfirmadoV2>>
{
    public async Task Consume(ConsumeContext<EventEnvelope<PedidoConfirmadoV1>> ctx)
        => await ProcesarAsync(ctx.Message.Payload.PedidoId, null);

    public async Task Consume(ConsumeContext<EventEnvelope<PedidoConfirmadoV2>> ctx)
        => await ProcesarAsync(ctx.Message.Payload.PedidoId, ctx.Message.Payload.MetodoEnvio);

    private Task ProcesarAsync(int pedidoId, string? metodoEnvio) { /*...*/ }
}
```

---

## Database per Service

El principio más importante (y más violado) de los microservicios.

```
❌ ANTI-PATRÓN: Base de datos compartida
   ─────────────────────────────────────
   Servicio Pedidos ──→ ┐
   Servicio Inventario ─┤──→ DB compartida
   Servicio Usuarios ───┘

   Problemas:
   - Coupling fuerte: cambiar el schema afecta a todos
   - No puedes escalar las bases de datos independientemente
   - Si la DB cae, caen todos los servicios
   - Los servicios se pueden "llamar" entre sí vía la DB (caos)

✅ CORRECTO: Database per Service
   ──────────────────────────────
   Servicio Pedidos ──→ DB Pedidos (SQL Server)
   Servicio Inventario ──→ DB Inventario (PostgreSQL)
   Servicio Catálogo ──→ DB Catálogo (MongoDB)
   Servicio Búsqueda ──→ Elasticsearch

   Ventajas:
   + Cada servicio elige el motor más adecuado para sus datos
   + Escalan independientemente
   + Fallo de una DB no afecta a otras
   + Los contratos son explícitos (API/eventos, no SQL)
```

### Cómo manejar queries cross-service sin DB compartida

```
Problema: necesito mostrar "historial de pedidos con datos del usuario"
          pero pedidos y usuarios son servicios diferentes.

Opción 1: API Composition (el API Gateway junta la respuesta)
  Gateway ──→ GET /pedidos?userId=123 → [pedidoId: 1, userId: 123, ...]
  Gateway ──→ GET /usuarios/123 → { nombre: "Ana", email: ... }
  Gateway combina y devuelve al cliente

Opción 2: CQRS + Read Model (el más escalable)
  Cada vez que se crea un pedido (evento), el servicio de Read Models
  consume el evento y guarda una vista desnormalizada:
  { pedidoId, userId, nombreUsuario, emailUsuario, productos, total }

  Las queries leen de esta vista desnormalizada, sin JOINs cross-service.
```

---

