---
id: microservicios
title: Microservicios
sidebar_position: 3
---

# Microservicios 🔴

## Comunicación entre servicios

### Síncrona (HTTP/gRPC)

```csharp
// HttpClient con Typed Client
public class ProductoClient
{
    private readonly HttpClient _httpClient;

    public ProductoClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ProductoDto?> ObtenerAsync(int id)
    {
        return await _httpClient.GetFromJsonAsync<ProductoDto>($"productos/{id}");
    }
}

// Registro en DI con Polly (resilience)
builder.Services.AddHttpClient<ProductoClient>(client =>
{
    client.BaseAddress = new Uri("https://productos-service/api/");
})
.AddTransientHttpErrorPolicy(p =>
    p.WaitAndRetryAsync(3, retryAttempt =>
        TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)))) // exponential backoff
.AddTransientHttpErrorPolicy(p =>
    p.CircuitBreakerAsync(5, TimeSpan.FromSeconds(30))); // circuit breaker
```

### Asíncrona (Mensajería)

```csharp
// Con MassTransit + RabbitMQ / Azure Service Bus
// Publicar mensaje
public class PedidoService
{
    private readonly IPublishEndpoint _publishEndpoint;

    public async Task ConfirmarPedidoAsync(int pedidoId)
    {
        // No llama al servicio de inventario directamente
        // Publica un mensaje al bus
        await _publishEndpoint.Publish(new PedidoConfirmadoMessage
        {
            PedidoId = pedidoId,
            FechaConfirmacion = DateTime.UtcNow
        });
    }
}

// Consumidor en el servicio de Inventario
public class ReservarStockAlConfirmarPedido : IConsumer<PedidoConfirmadoMessage>
{
    public async Task Consume(ConsumeContext<PedidoConfirmadoMessage> context)
    {
        await _inventarioService.ReservarAsync(context.Message.PedidoId);
    }
}

// Registro
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<ReservarStockAlConfirmarPedido>();
    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host("rabbitmq://localhost");
        cfg.ConfigureEndpoints(ctx);
    });
});
```

---

## Patrones de resiliencia

### Circuit Breaker

```
CERRADO → operaciones normales
   ↓ (X fallos)
ABIERTO → retorna error inmediato sin llamar al servicio
   ↓ (timeout)
SEMI-ABIERTO → permite algunas llamadas de prueba
   ↓ (éxito) → CERRADO
   ↓ (fallo) → ABIERTO
```

### Saga Pattern — transacciones distribuidas

```csharp
// Choreography Saga (eventos)
// Cada servicio escucha eventos y publica el siguiente

// Pedido creado → Inventario reserva stock
// Stock reservado → Pagos procesa el pago
// Pago procesado → Envío genera guía
// Si falla el pago → Inventario libera el stock (compensación)

// Orchestration Saga (coordinador central)
public class ProcesarPedidoSaga : MassTransitStateMachine<PedidoSagaState>
{
    public ProcesarPedidoSaga()
    {
        Initially(
            When(PedidoCreado)
                .Then(ctx => ctx.Saga.PedidoId = ctx.Message.PedidoId)
                .PublishAsync(ctx => ctx.Init<ReservarStockCommand>(new
                {
                    ctx.Message.PedidoId
                }))
                .TransitionTo(EsperandoStock)
        );

        During(EsperandoStock,
            When(StockReservado)
                .PublishAsync(ctx => ctx.Init<ProcesarPagoCommand>(new
                {
                    ctx.Saga.PedidoId
                }))
                .TransitionTo(EsperandoPago),
            When(StockInsuficiente)
                .PublishAsync(ctx => ctx.Init<CancelarPedidoCommand>(new
                {
                    ctx.Saga.PedidoId, Razon = "Stock insuficiente"
                }))
                .Finalize()
        );
    }
}
```

---

## Service Discovery y Health Checks

```csharp
// Health Checks
builder.Services.AddHealthChecks()
    .AddSqlServer(connectionString, name: "sqlserver")
    .AddRabbitMQ(rabbitUri, name: "rabbitmq")
    .AddUrlGroup(new Uri("https://external-api.com/health"), name: "external-api");

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

// Liveness vs Readiness
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false // Solo chequea que el proceso está vivo
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

---

## Contenerización con Docker

```dockerfile
# Multi-stage build para imagen más pequeña
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MiApp.API/MiApp.API.csproj", "MiApp.API/"]
RUN dotnet restore "MiApp.API/MiApp.API.csproj"
COPY . .
RUN dotnet publish "MiApp.API/MiApp.API.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "MiApp.API.dll"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "5000:8080"
    environment:
      - ConnectionStrings__Default=Server=db;Database=MiApp;User=sa;Password=Pass@word1
    depends_on:
      - db
      - rabbitmq

  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=Pass@word1

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "15672:15672"
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo manejas la consistencia de datos entre microservicios?**
> Con **eventual consistency** mediante eventos/mensajes. Cada servicio es dueño de sus datos. Para operaciones que requieren consistencia fuerte, uso el patrón **Saga** con compensaciones en caso de fallo.

**2. ¿Cómo evitas que un fallo en cascada colapse todos los servicios?**
> Con el patrón **Circuit Breaker** (Polly): si un servicio falla X veces seguidas, el circuito se abre y retorna error inmediato sin intentar la llamada, dando tiempo al servicio caído para recuperarse.

**3. ¿Qué es Idempotency y por qué es crucial en microservicios?**
> La capacidad de ejecutar la misma operación múltiples veces con el mismo resultado. Crucial porque los mensajes pueden entregarse más de una vez (at-least-once delivery). Se implementa con Idempotency Keys o verificando si la operación ya fue procesada.

**4. ¿Cómo manejas el versionado de contratos entre servicios?**
> Con **backward compatibility**: agregar campos opcionales, nunca quitar campos existentes. Usar versionado semántico. Para cambios breaking, correr dos versiones en paralelo durante un período de migración.

---

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

## Migración de Monolito a Microservicios (Strangler Fig)

```
El error más común: intentar reescribir todo el monolito de una vez.
La estrategia correcta: Strangler Fig Pattern (Martin Fowler).

PRINCIPIO: el nuevo sistema "estrangula" gradualmente al viejo,
           como una higuera estranguladora envuelve a un árbol.

FASE 1: Monolito + API Gateway enfrente
   ─────────────────────────────────────
   Todos los requests ──→ API Gateway ──→ Monolito
   (El gateway no hace nada especial aún, solo proxy)

FASE 2: Extraer el primer servicio (el más independiente)
   ─────────────────────────────────────────────────────
   GET /api/productos/* ──→ API Gateway ──→ Nuevo Servicio Catálogo
   Todo lo demás ──→ API Gateway ──→ Monolito

   El monolito sigue sirviendo el 95% del tráfico.
   El nuevo servicio sirve solo /productos.

FASE 3: Extraer más servicios iterativamente
   ─────────────────────────────────────────
   Priorizar servicios que:
   - Tienen equipos claros dueños
   - Escalan de forma diferente al resto
   - Cambian con mucha frecuencia (alta deuda técnica)
   - Son claramente independientes (pocas dependencias)

FASE 4: El monolito eventualmente desaparece
```

### Cómo mantener consistencia durante la migración

```csharp
// Strangler Fig en la práctica: el gateway decide el destino
// Esto puede ser nginx, YARP (Yet Another Reverse Proxy), o Ocelot

// YARP — reverse proxy en C#
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// appsettings.json
{
  "ReverseProxy": {
    "Routes": {
      "catalogo-route": {
        "ClusterId": "catalogo-cluster",
        "Match": { "Path": "/api/productos/{**catch-all}" }
      },
      "monolito-route": {
        "ClusterId": "monolito-cluster",
        "Match": { "Path": "/{**catch-all}" }  // Todo lo demás al monolito
      }
    },
    "Clusters": {
      "catalogo-cluster": {
        "Destinations": {
          "catalogo/d1": { "Address": "https://catalogo-service/" }
        }
      },
      "monolito-cluster": {
        "Destinations": {
          "monolito/d1": { "Address": "https://monolito/" }
        }
      }
    }
  }
}
```

---

## Dapr — Distributed Application Runtime

Dapr abstrae los problemas comunes de microservicios (pub/sub, service invocation, state, secrets) detrás de una API HTTP local estándar. Tu servicio habla con un sidecar local y Dapr se encarga del transporte real.

```
Sin Dapr:
  Servicio A ──(Confluent.Kafka SDK)──→ Kafka
  Servicio A ──(StackExchange.Redis)──→ Redis

Con Dapr:
  Servicio A ──(HTTP POST localhost:3500)──→ Dapr Sidecar ──→ Kafka/Redis/ServiceBus
  (El servicio no sabe qué broker usa en producción)
```

```csharp
// Con Dapr SDK para .NET

// Publicar un evento (sin conocer el broker)
var daprClient = new DaprClientBuilder().Build();

await daprClient.PublishEventAsync(
    pubsubName: "messagebus",   // Nombre del componente en Dapr
    topicName:  "pedido-creado",
    data:       new PedidoCreadoEvent { PedidoId = pedido.Id }
);

// Consumir — solo un endpoint HTTP POST que Dapr invoca
[ApiController]
[Route("api")]
public class EventosController : ControllerBase
{
    [Topic("messagebus", "pedido-creado")]  // Atributo de Dapr
    [HttpPost("pedido-creado")]
    public async Task<IActionResult> PedidoCreado([FromBody] PedidoCreadoEvent evento)
    {
        await _inventario.ReservarAsync(evento.PedidoId);
        return Ok();
    }
}

// Invocación de servicios (con service discovery automático)
var producto = await daprClient.InvokeMethodAsync<ProductoDto>(
    httpMethod: HttpMethod.Get,
    appId:      "catalogo-service",  // Nombre del servicio en Dapr
    methodName: $"productos/{id}"
);
// Dapr resuelve "catalogo-service" → IP real, aplica retry/circuit-breaker
```

### Cuándo usar Dapr vs configuración directa

```
Usar Dapr cuando:
  ✅ El equipo cambia entre proveedores de infra (dev: Redis, prod: Azure Service Bus)
  ✅ Quieres observabilidad y resiliencia sin código adicional
  ✅ El team no tiene expertise profundo en Kafka/RabbitMQ

Usar SDKs directos cuando:
  ✅ Necesitas características avanzadas del broker (Kafka Streams, partitioning)
  ✅ Ya tienes expertise y no quieres otra capa de abstracción
  ✅ La latencia de la capa Dapr es inaceptable para tu caso de uso
```

---

## Distributed Tracing en microservicios

Cuando un request atraviesa múltiples servicios, necesitas poder seguir la traza completa. Ver sección de Observabilidad para la implementación, pero el concepto en microservicios:

```
Request del usuario
    │  TraceId: abc123
    ├──→ API Gateway  (SpanId: 0001)
    │       │
    │       ├──→ Servicio Pedidos  (SpanId: 0002, ParentSpanId: 0001)
    │       │       │
    │       │       ├──→ Servicio Inventario  (SpanId: 0003, ParentSpanId: 0002)
    │       │       │         └── 45ms
    │       │       │
    │       │       └──→ Servicio Pagos  (SpanId: 0004, ParentSpanId: 0002)
    │       │                 └── 120ms
    │       │
    │       └── 200ms total
    │
    └── Respuesta al usuario

En Jaeger o Zipkin puedes ver el "waterfall" completo del TraceId abc123
y pinpointear exactamente dónde se gastó el tiempo.
```

```csharp
// La propagación es automática con OpenTelemetry + HttpClient
// Solo necesitas que cada servicio tenga OTel configurado

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddSource("MiApp.Pedidos")
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation() // Propaga el TraceId en los headers automáticamente
            .AddSqlClientInstrumentation()
            .AddOtlpExporter(o =>
            {
                o.Endpoint = new Uri("http://jaeger:4317");
            });
    });
```

---

## Preguntas adicionales de entrevista 🎯

**5. ¿Cuándo NO usarías microservicios?**
> Cuando el equipo es pequeño (< 5 personas), cuando el dominio no está bien entendido aún (necesitas iterar rápido), cuando el sistema no tiene requisitos de escala diferenciada por componente, o cuando no tienes infraestructura para manejar la complejidad operacional. Un monolito bien estructurado es mejor que microservicios prematuros.

**6. ¿Cómo harías la migración de un monolito a microservicios?**
> Con el **Strangler Fig Pattern**: primero poner un API Gateway frente al monolito, luego ir extrayendo servicios uno por uno empezando por los más independientes. El monolito sigue funcionando mientras se extrae. Nunca reescribir todo de una vez — demasiado riesgo.

**7. ¿Cuál es la diferencia entre Choreography y Orchestration en el patrón Saga?**
> En **Choreography** cada servicio publica eventos y otros reaccionan — no hay coordinador central, más desacoplado pero difícil de trazar el flujo completo. En **Orchestration** hay un coordinador (la Saga) que envía comandos explícitos a cada servicio — más fácil de entender y depurar, pero el coordinador es un componente adicional. Para flujos complejos con muchas compensaciones, prefiero orchestration porque puedo ver el estado de la saga en cualquier momento.

**8. ¿Cómo garantizas que un mensaje de RabbitMQ/Kafka no se procese dos veces?**
> Con el **Inbox Pattern**: antes de procesar el mensaje, verificar si su `MessageId` ya está en la tabla `processed_messages`. Si está, retornar OK sin procesar (idempotente). Si no está, insertar el `MessageId` y procesar en la misma transacción DB. Esto garantiza exactly-once processing a nivel de base de datos aunque el broker entregue at-least-once.
