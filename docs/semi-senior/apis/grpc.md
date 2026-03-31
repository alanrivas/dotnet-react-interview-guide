---
id: grpc
title: gRPC con .NET
sidebar_position: 30
---

# gRPC con .NET 🟡

gRPC es un framework de comunicación RPC (Remote Procedure Call) de alto rendimiento creado por Google. Usa **Protocol Buffers** como formato de serialización y **HTTP/2** como transporte. En entornos .NET con microservicios, es la alternativa principal a REST cuando necesitás rendimiento, tipado fuerte y comunicación bidireccional.

---

## gRPC vs REST — cuándo usar cada uno

```
gRPC                              REST
─────────────────────────────     ─────────────────────────────
Protocolo: HTTP/2                 Protocolo: HTTP/1.1 o 2
Serialización: Protobuf (binario) Serialización: JSON (texto)
Tipado: contrato .proto estricto  Tipado: implícito (OpenAPI)
Performance: muy alta             Performance: buena
Streaming: bidireccional nativo   Streaming: workarounds (SSE)
Browser support: limitado*        Browser support: nativo
Legibilidad: baja (binario)       Legibilidad: alta (JSON)
Ideal para: microservicios        Ideal para: APIs públicas,
            backends internos              clientes web/móvil

*gRPC-Web permite browsers pero con limitaciones
```

**Regla práctica:** gRPC para comunicación backend-to-backend. REST para APIs expuestas a clientes externos.

---

## Protocol Buffers — el contrato

El archivo `.proto` define los mensajes y servicios. Es el **contrato** entre cliente y servidor, independiente del lenguaje.

```protobuf
// protos/productos.proto
syntax = "proto3";

option csharp_namespace = "MiApp.Grpc";

package productos;

// Servicio con sus métodos (RPCs)
service ProductoService {
  // Unary — request/response simple
  rpc GetProducto (GetProductoRequest) returns (ProductoResponse);

  // Server streaming — el servidor manda múltiples respuestas
  rpc ListarProductos (ListarRequest) returns (stream ProductoResponse);

  // Client streaming — el cliente manda múltiples mensajes
  rpc CrearProductosEnLote (stream CrearProductoRequest) returns (LoteResponse);

  // Bidirectional streaming
  rpc Chat (stream ChatMessage) returns (stream ChatMessage);
}

message GetProductoRequest {
  int32 id = 1;
}

message ListarRequest {
  int32 categoria_id = 1;
  int32 page_size    = 2;
}

message CrearProductoRequest {
  string nombre   = 1;
  double precio   = 2;
  int32  stock    = 3;
}

message ProductoResponse {
  int32  id       = 1;
  string nombre   = 2;
  double precio   = 3;
  int32  stock    = 4;
  string categoria = 5;
}

message LoteResponse {
  int32 creados = 1;
  repeated string errores = 2; // Lista de errores
}

message ChatMessage {
  string usuario  = 1;
  string mensaje  = 2;
  int64  timestamp = 3;
}
```

:::info Los números en los campos
`= 1`, `= 2`, etc. son los **field numbers** — identificadores únicos en el binario. **Nunca reutilices ni cambies** estos números en un schema ya desplegado — rompés la compatibilidad.
:::

---

## Setup en ASP.NET Core

### Proyecto servidor

```xml
<!-- ProductoService.Api.csproj -->
<ItemGroup>
  <PackageReference Include="Grpc.AspNetCore" Version="2.62.0" />
</ItemGroup>

<!-- Incluir los archivos .proto -->
<ItemGroup>
  <Protobuf Include="Protos\productos.proto" GrpcServices="Server" />
</ItemGroup>
```

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddGrpc(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaxReceiveMessageSize = 16 * 1024 * 1024; // 16 MB
});

// Opcional: reflexión para herramientas como grpcui/grpcurl
if (builder.Environment.IsDevelopment())
    builder.Services.AddGrpcReflection();

var app = builder.Build();

app.MapGrpcService<ProductoGrpcService>();

if (app.Environment.IsDevelopment())
    app.MapGrpcReflectionService();

app.Run();
```

### Implementar el servicio

```csharp
using Grpc.Core;
using MiApp.Grpc; // namespace generado del .proto

public class ProductoGrpcService : ProductoService.ProductoServiceBase
{
    private readonly IProductoRepository _repo;
    private readonly ILogger<ProductoGrpcService> _logger;

    public ProductoGrpcService(IProductoRepository repo, ILogger<ProductoGrpcService> logger)
    {
        _repo = repo;
        _logger = logger;
    }

    // 1. UNARY — método simple
    public override async Task<ProductoResponse> GetProducto(
        GetProductoRequest request,
        ServerCallContext context)
    {
        var producto = await _repo.GetByIdAsync(request.Id, context.CancellationToken);

        if (producto is null)
        {
            // Lanzar errores gRPC con StatusCode apropiado
            throw new RpcException(new Status(StatusCode.NotFound,
                $"Producto {request.Id} no encontrado"));
        }

        return MapToResponse(producto);
    }

    // 2. SERVER STREAMING — el servidor envía múltiples mensajes
    public override async Task ListarProductos(
        ListarRequest request,
        IServerStreamWriter<ProductoResponse> responseStream,
        ServerCallContext context)
    {
        var productos = _repo.GetByCategoriaAsync(request.CategoriaId);

        await foreach (var producto in productos)
        {
            // Verificar si el cliente canceló
            if (context.CancellationToken.IsCancellationRequested)
                break;

            await responseStream.WriteAsync(MapToResponse(producto));
        }
    }

    // 3. CLIENT STREAMING — el cliente envía múltiples mensajes
    public override async Task<LoteResponse> CrearProductosEnLote(
        IAsyncStreamReader<CrearProductoRequest> requestStream,
        ServerCallContext context)
    {
        var creados = 0;
        var errores = new List<string>();

        await foreach (var request in requestStream.ReadAllAsync(context.CancellationToken))
        {
            try
            {
                await _repo.CreateAsync(new Producto
                {
                    Nombre = request.Nombre,
                    Precio = (decimal)request.Precio,
                    Stock  = request.Stock
                });
                creados++;
            }
            catch (Exception ex)
            {
                errores.Add($"{request.Nombre}: {ex.Message}");
            }
        }

        return new LoteResponse { Creados = creados, Errores = { errores } };
    }

    private static ProductoResponse MapToResponse(Producto p) => new()
    {
        Id       = p.Id,
        Nombre   = p.Nombre,
        Precio   = (double)p.Precio,
        Stock    = p.Stock,
        Categoria = p.Categoria ?? string.Empty
    };
}
```

---

## Cliente gRPC en .NET

```xml
<!-- Cliente.csproj -->
<ItemGroup>
  <PackageReference Include="Grpc.Net.Client"            Version="2.62.0" />
  <PackageReference Include="Google.Protobuf"            Version="3.27.0" />
  <PackageReference Include="Grpc.Tools"                 Version="2.62.0" PrivateAssets="all" />
</ItemGroup>

<ItemGroup>
  <!-- GrpcServices="Client" — solo genera el cliente, no el servidor -->
  <Protobuf Include="Protos\productos.proto" GrpcServices="Client" />
</ItemGroup>
```

```csharp
// Registrar el cliente con HttpClientFactory (recomendado)
builder.Services.AddGrpcClient<ProductoService.ProductoServiceClient>(options =>
{
    options.Address = new Uri("https://producto-service:5001");
})
.ConfigureChannel(channel =>
{
    // Configurar retry automático (gRPC retry policy)
    channel.ServiceConfig = new ServiceConfig
    {
        MethodConfigs =
        {
            new MethodConfig
            {
                Names = { MethodName.Default },
                RetryPolicy = new RetryPolicy
                {
                    MaxAttempts          = 3,
                    InitialBackoff       = TimeSpan.FromSeconds(0.5),
                    MaxBackoff           = TimeSpan.FromSeconds(5),
                    BackoffMultiplier    = 2,
                    RetryableStatusCodes = { StatusCode.Unavailable }
                }
            }
        }
    };
});

// ---

// Usar el cliente
public class ProductoCatalogService
{
    private readonly ProductoService.ProductoServiceClient _client;

    public ProductoCatalogService(ProductoService.ProductoServiceClient client)
        => _client = client;

    // Llamada unary
    public async Task<ProductoDto?> GetAsync(int id)
    {
        try
        {
            var response = await _client.GetProductoAsync(new GetProductoRequest { Id = id });
            return new ProductoDto(response.Id, response.Nombre, (decimal)response.Precio);
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
        {
            return null;
        }
    }

    // Consumir server stream
    public async IAsyncEnumerable<ProductoDto> ListarAsync(int categoriaId)
    {
        using var call = _client.ListarProductos(new ListarRequest { CategoriaId = categoriaId });

        await foreach (var item in call.ResponseStream.ReadAllAsync())
        {
            yield return new ProductoDto(item.Id, item.Nombre, (decimal)item.Precio);
        }
    }
}
```

---

## Interceptores — cross-cutting concerns

Los interceptores son el equivalente a middleware de ASP.NET Core, pero para gRPC.

```csharp
// Interceptor del servidor — logging + correlación
public class LoggingInterceptor : Interceptor
{
    private readonly ILogger<LoggingInterceptor> _logger;

    public LoggingInterceptor(ILogger<LoggingInterceptor> logger) => _logger = logger;

    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        var method = context.Method;
        var correlationId = Guid.NewGuid().ToString("N")[..8];

        // Agregar correlationId a los headers de respuesta
        context.ResponseTrailers.Add("x-correlation-id", correlationId);

        _logger.LogInformation("gRPC {Method} [{CorrelationId}] START", method, correlationId);

        try
        {
            var response = await continuation(request, context);
            _logger.LogInformation("gRPC {Method} [{CorrelationId}] OK", method, correlationId);
            return response;
        }
        catch (RpcException ex)
        {
            _logger.LogWarning("gRPC {Method} [{CorrelationId}] {Status}: {Detail}",
                method, correlationId, ex.StatusCode, ex.Status.Detail);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "gRPC {Method} [{CorrelationId}] unhandled error", method, correlationId);
            throw new RpcException(new Status(StatusCode.Internal, "Error interno"));
        }
    }
}

// Registrar el interceptor
builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<LoggingInterceptor>();
});
```

---

## Autenticación JWT en gRPC

```csharp
// Program.cs servidor
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* config JWT */ });

builder.Services.AddAuthorization();

builder.Services.AddGrpc();

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.MapGrpcService<ProductoGrpcService>();

// ---

// Servicio con autorización
[Authorize]  // Requiere JWT válido
public class ProductoGrpcService : ProductoService.ProductoServiceBase
{
    public override async Task<ProductoResponse> GetProducto(
        GetProductoRequest request,
        ServerCallContext context)
    {
        // Acceder al usuario autenticado
        var httpContext = context.GetHttpContext();
        var userId = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        // ...
    }
}

// ---

// Cliente — agregar JWT al header
var token = await _tokenService.GetTokenAsync();

var headers = new Metadata
{
    { "Authorization", $"Bearer {token}" }
};

var response = await _client.GetProductoAsync(request, headers);
```

---

## Status codes de gRPC

```
OK (0)             → Operación exitosa
CANCELLED (1)      → Operación cancelada por el cliente
UNKNOWN (2)        → Error desconocido
INVALID_ARGUMENT(3)→ Argumento inválido (similar a 400)
NOT_FOUND (5)      → Recurso no encontrado (similar a 404)
ALREADY_EXISTS (6) → Recurso ya existe (similar a 409)
PERMISSION_DENIED(7)→ Sin permisos (similar a 403)
UNAUTHENTICATED(16)→ No autenticado (similar a 401)
RESOURCE_EXHAUSTED(8)→ Rate limit / quota (similar a 429)
INTERNAL (13)      → Error interno del servidor (similar a 500)
UNAVAILABLE (14)   → Servicio no disponible (reintentable)
DEADLINE_EXCEEDED(4)→ Timeout superado
```

```csharp
// Mapeo de excepciones de dominio a StatusCode
public static class GrpcExceptionExtensions
{
    public static RpcException ToRpcException(this Exception ex) => ex switch
    {
        NotFoundException   e => new RpcException(new Status(StatusCode.NotFound,    e.Message)),
        ValidationException e => new RpcException(new Status(StatusCode.InvalidArgument, e.Message)),
        UnauthorizedException e => new RpcException(new Status(StatusCode.PermissionDenied, e.Message)),
        _ => new RpcException(new Status(StatusCode.Internal, "Error interno"))
    };
}
```

---

## Testing de servicios gRPC

```csharp
// dotnet add package Grpc.AspNetCore.Server.ClientFactory
// dotnet add package Microsoft.AspNetCore.TestHost

public class ProductoGrpcServiceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ProductoGrpcServiceTests(WebApplicationFactory<Program> factory)
        => _factory = factory;

    private ProductoService.ProductoServiceClient CreateClient()
    {
        // Crear un cliente gRPC que apunta al servidor de tests en memoria
        var httpClient = _factory.CreateClient();
        var channel = GrpcChannel.ForAddress(
            httpClient.BaseAddress!,
            new GrpcChannelOptions { HttpClient = httpClient });

        return new ProductoService.ProductoServiceClient(channel);
    }

    [Fact]
    public async Task GetProducto_ProductoExistente_RetornaProducto()
    {
        // Arrange
        var client = CreateClient();

        // Act
        var response = await client.GetProductoAsync(new GetProductoRequest { Id = 1 });

        // Assert
        Assert.Equal(1, response.Id);
        Assert.NotEmpty(response.Nombre);
    }

    [Fact]
    public async Task GetProducto_NoExiste_LanzaNotFound()
    {
        var client = CreateClient();

        var ex = await Assert.ThrowsAsync<RpcException>(
            () => client.GetProductoAsync(new GetProductoRequest { Id = 9999 }).ResponseAsync);

        Assert.Equal(StatusCode.NotFound, ex.StatusCode);
    }

    [Fact]
    public async Task ListarProductos_RetornaTodosDeCategoria()
    {
        var client = CreateClient();
        var productos = new List<ProductoResponse>();

        using var call = client.ListarProductos(new ListarRequest { CategoriaId = 1 });
        await foreach (var p in call.ResponseStream.ReadAllAsync())
            productos.Add(p);

        Assert.NotEmpty(productos);
        Assert.All(productos, p => Assert.NotEmpty(p.Nombre));
    }
}
```

---

## gRPC-Web — usar desde React

gRPC usa HTTP/2 con framing propio, lo que impide llamadas directas desde browsers. **gRPC-Web** es el puente.

```csharp
// En el servidor ASP.NET Core
builder.Services.AddGrpcWeb(options => options.DefaultEnabled = true);

var app = builder.Build();
app.UseGrpcWeb();
app.MapGrpcService<ProductoGrpcService>().EnableGrpcWeb();
```

```typescript
// En React — @improbable-eng/grpc-web o @connectrpc/connect
// npm install @connectrpc/connect @connectrpc/connect-web

import { createConnectTransport } from "@connectrpc/connect-web";
import { createClient }           from "@connectrpc/connect";
import { ProductoService }        from "./gen/productos_connect";

const transport = createConnectTransport({
  baseUrl: "https://api.ejemplo.com",
});

const client = createClient(ProductoService, transport);

// Llamada unary
const producto = await client.getProducto({ id: 1 });

// Server streaming
for await (const p of client.listarProductos({ categoriaId: 1 })) {
  console.log(p.nombre);
}
```

:::tip Alternativa más simple
**Connect** (de Buf) es un protocolo compatible con gRPC que también funciona sobre HTTP/1.1 JSON. Es más fácil de adoptar en proyectos que ya tienen clientes web y no quieren gRPC-Web.
:::

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuándo usarías gRPC en lugar de REST?**
> gRPC para comunicación interna entre microservicios donde necesito alto rendimiento, tipado estricto y contrato compartido. REST cuando expongo APIs a clientes externos (browsers, apps móviles, terceros) porque la usabilidad y documentación importan más que el rendimiento crudo. En la práctica, muchos sistemas usan ambos: REST hacia afuera, gRPC hacia adentro.

**2. ¿Qué ventaja da Protobuf sobre JSON?**
> Protobuf serializa en binario con field numbers en lugar de nombres — los mensajes son ~5-10x más pequeños y se deserializan ~5x más rápido que JSON. También es fuertemente tipado: si cambiás un tipo sin respetar compatibilidad, el compilador falla. El costo es la legibilidad nula — no podés leer un mensaje Protobuf directamente sin el schema.

**3. ¿Qué son los 4 tipos de comunicación en gRPC?**
> Unary (request/response, igual que REST), Server Streaming (el servidor manda N respuestas para 1 request — útil para feeds), Client Streaming (el cliente manda N mensajes y el servidor responde al final — útil para uploads), y Bidirectional Streaming (ambos lados envían mensajes independientemente — útil para chat o colaboración en tiempo real).

**4. ¿Cómo manejás la compatibilidad hacia atrás en Protobuf?**
> Reglas: nunca reutilizar field numbers, nunca eliminar campos (marcarlos `reserved`), solo agregar campos opcionales. Protobuf es forward y backward compatible si seguís estas reglas: un cliente viejo ignora campos nuevos, un cliente nuevo maneja gracefully campos faltantes (usa el valor default del tipo).

**5. ¿Cuál es la diferencia entre un interceptor gRPC y un middleware de ASP.NET Core?**
> El middleware de ASP.NET Core opera a nivel HTTP, antes de que llegue al stack de gRPC — útil para autenticación y logging de requests HTTP crudos. Los interceptores gRPC operan ya dentro del pipeline gRPC, tienen acceso al `ServerCallContext`, a los tipos de los mensajes, y funcionan tanto en cliente como servidor. Para lógica de dominio (logging de operaciones, validaciones de negocio) los interceptores son más apropiados.
