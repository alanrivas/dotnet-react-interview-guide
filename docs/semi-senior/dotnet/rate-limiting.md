---
id: rate-limiting
title: Rate Limiting en .NET 8
sidebar_position: 18
---

# Rate Limiting en .NET 8 🟡

Desde .NET 7, ASP.NET Core incluye **Rate Limiting nativo** en el namespace `Microsoft.AspNetCore.RateLimiting` — sin librerías de terceros. Es uno de los temas más preguntados en entrevistas porque combina conceptos de seguridad, performance y algoritmos.

:::info Contexto
El archivo [Seguridad en APIs](../apis/seguridad-api) menciona `AspNetCoreRateLimit` (librería de terceros). Este documento cubre la implementación **nativa de .NET 7/8** que la reemplaza en la mayoría de los casos.
:::

---

## Los 4 algoritmos de Rate Limiting

Antes de ver código, entender qué hace cada algoritmo es crítico para entrevistas.

### 1. Fixed Window (Ventana Fija)

```
Timeline: |--- 60s window ---|--- 60s window ---|
Requests:  ✓ ✓ ✓ ✓ ✓ ✗ ✗       ✓ ✓ ✓ ✓ ✓ ✗ ✗
           (máx 5 por ventana)
```

- Divide el tiempo en ventanas fijas (ej: cada 60 segundos)
- Cuenta requests dentro de la ventana actual
- **Problema**: burst al borde de la ventana — 5 requests al final del minuto 1 + 5 al inicio del minuto 2 = 10 en 1 segundo

### 2. Sliding Window (Ventana Deslizante)

```
Ahora: 12:00:45
Ventana: [11:59:45 ← → 12:00:45] (últimos 60s)
Solo cuenta requests en esa ventana, sin importar el inicio del minuto
```

- Ventana se mueve con el tiempo actual — más suave que Fixed Window
- Elimina el problema del burst en bordes
- **Más costoso en memoria** (guarda timestamps individuales)

### 3. Token Bucket (Balde de Tokens)

```
Balde (capacidad: 10):  ████████░░  (8 tokens disponibles)
Llenado: +2 tokens por segundo
Request llega: consume 1 token
Sin tokens: request bloqueada
```

- Permite **bursts** controlados (agotar el balde)
- Recupera capacidad gradualmente
- Ideal para APIs que toleran picos ocasionales

### 4. Concurrency (Concurrencia)

```
Límite: 5 requests simultáneas
Activas: [req1] [req2] [req3] [req4] [req5] | req6 espera/rechaza
Cuando req1 termina: [req6] puede entrar
```

- Limita requests **en paralelo**, no por tiempo
- No importa cuántas por segundo — importa cuántas a la vez
- Ideal para proteger recursos lentos (DB queries, llamadas externas)

---

## Setup básico en .NET 8

```csharp
// Program.cs
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRateLimiter(options =>
{
    // Respuesta cuando se supera el límite
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Qué hacer cuando se rechaza una request
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = 429;

        // Informar cuándo puede reintentar
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            await context.HttpContext.Response.WriteAsync(
                $"Límite alcanzado. Reintentá en {retryAfter.TotalSeconds}s",
                cancellationToken);
        }
        else
        {
            await context.HttpContext.Response.WriteAsync(
                "Demasiadas solicitudes. Intentá más tarde.",
                cancellationToken);
        }
    };

    // Política global (aplica a todas las rutas)
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "anonimo",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0, // Sin cola — rechaza inmediatamente
            }));
});

var app = builder.Build();

// ⚠️ UseRateLimiter DEBE ir antes de MapControllers
app.UseRateLimiter();
app.MapControllers();
app.Run();
```

---

## Fixed Window — implementación

```csharp
builder.Services.AddRateLimiter(options =>
{
    // Política nombrada — se referencia en controllers o endpoints
    options.AddFixedWindowLimiter("api-general", limiterOptions =>
    {
        limiterOptions.PermitLimit = 60;                        // 60 requests
        limiterOptions.Window = TimeSpan.FromMinutes(1);        // por minuto
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 5;                          // cola de 5 antes de rechazar
    });

    // Política estricta para login
    options.AddFixedWindowLimiter("auth-login", limiterOptions =>
    {
        limiterOptions.PermitLimit = 5;
        limiterOptions.Window = TimeSpan.FromMinutes(15);
        limiterOptions.QueueLimit = 0;
    });
});

// Aplicar en un Controller completo
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("api-general")]
public class ProductosController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAll() => Ok();

    // Sobrescribir política en un endpoint específico
    [HttpPost]
    [EnableRateLimiting("auth-login")]
    public IActionResult Create() => Ok();

    // Deshabilitar rate limiting para un endpoint
    [HttpGet("health")]
    [DisableRateLimiting]
    public IActionResult Health() => Ok("alive");
}
```

---

## Sliding Window — implementación

```csharp
options.AddSlidingWindowLimiter("sliding", limiterOptions =>
{
    limiterOptions.PermitLimit = 100;
    limiterOptions.Window = TimeSpan.FromMinutes(1);
    limiterOptions.SegmentsPerWindow = 4; // Divide en 4 segmentos de 15s
    // Más segmentos = más preciso pero más memoria
    limiterOptions.QueueLimit = 10;
});
```

---

## Token Bucket — implementación

```csharp
options.AddTokenBucketLimiter("token-bucket", limiterOptions =>
{
    limiterOptions.TokenLimit = 20;                          // Capacidad máxima del balde
    limiterOptions.ReplenishmentPeriod = TimeSpan.FromSeconds(10); // Período de recarga
    limiterOptions.TokensPerPeriod = 5;                      // Tokens que se agregan cada período
    limiterOptions.AutoReplenishment = true;                 // Recarga automática
    limiterOptions.QueueLimit = 0;
});

// Con estos valores:
// - Máximo burst de 20 requests
// - Se recupera a razón de 5 cada 10 segundos
// - Steady state: ~30 requests por minuto
```

---

## Concurrency — implementación

```csharp
options.AddConcurrencyLimiter("concurrency", limiterOptions =>
{
    limiterOptions.PermitLimit = 10;   // Máximo 10 requests simultáneas
    limiterOptions.QueueLimit = 5;     // Cola hasta 5 más esperando
    limiterOptions.QueueProcessingOrder = QueueProcessingOrder.NewestFirst;
});

// Útil para:
// - Endpoints de export/generación de reportes (lentos)
// - Operaciones de procesamiento intensivo
// - Llamadas a APIs externas con límite de concurrencia
```

---

## Rate Limiting por usuario autenticado

El caso más común en producción: límites distintos para usuarios anónimos, autenticados y premium.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    // Política que distingue por usuario
    options.AddPolicy("por-usuario", context =>
    {
        var usuario = context.User;

        // Usuario no autenticado — límite bajo por IP
        if (!usuario.Identity?.IsAuthenticated ?? true)
        {
            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "anonimo";
            return RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: $"anonimo:{ip}",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                });
        }

        // Usuario premium — límite alto
        if (usuario.IsInRole("Premium"))
        {
            var userId = usuario.FindFirst("sub")?.Value ?? "unknown";
            return RateLimitPartition.GetTokenBucketLimiter(
                partitionKey: $"premium:{userId}",
                factory: _ => new TokenBucketRateLimiterOptions
                {
                    TokenLimit = 500,
                    ReplenishmentPeriod = TimeSpan.FromMinutes(1),
                    TokensPerPeriod = 500,
                    AutoReplenishment = true,
                });
        }

        // Usuario estándar autenticado
        {
            var userId = usuario.FindFirst("sub")?.Value ?? "unknown";
            return RateLimitPartition.GetSlidingWindowLimiter(
                partitionKey: $"usuario:{userId}",
                factory: _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 100,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 4,
                    QueueLimit = 0,
                });
        }
    });
});
```

---

## Headers de respuesta

Buena práctica: informar al cliente cuánto le queda y cuándo puede reintentar.

```csharp
builder.Services.AddRateLimiter(options =>
{
    options.OnRejected = async (context, ct) =>
    {
        var response = context.HttpContext.Response;
        response.StatusCode = 429;

        // Headers estándar de rate limiting
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            response.Headers["Retry-After"] = ((int)retryAfter.TotalSeconds).ToString();
        }

        // Headers informativos (no estándar pero útiles)
        response.Headers["X-RateLimit-Policy"] = "api-general";
        response.Headers["Content-Type"] = "application/json";

        await response.WriteAsJsonAsync(new
        {
            tipo = "https://tools.ietf.org/html/rfc6585#section-4",
            titulo = "Too Many Requests",
            status = 429,
            detalle = "Superaste el límite de solicitudes. Revisá el header Retry-After.",
        }, ct);
    };
});
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
Content-Type: application/json

{
  "tipo": "https://tools.ietf.org/html/rfc6585#section-4",
  "titulo": "Too Many Requests",
  "status": 429,
  "detalle": "Superaste el límite de solicitudes. Revisá el header Retry-After."
}
```

---

## Rate Limiting en Minimal APIs

```csharp
var app = builder.Build();

app.UseRateLimiter();

// Aplicar política en un grupo de rutas
var apiGroup = app.MapGroup("/api")
    .RequireRateLimiting("api-general");

apiGroup.MapGet("/productos", () => Results.Ok());
apiGroup.MapPost("/productos", () => Results.Created());

// Endpoint específico con política propia
app.MapPost("/auth/login", () => Results.Ok())
    .RequireRateLimiting("auth-login");

// Endpoint sin rate limiting
app.MapGet("/health", () => Results.Ok("alive"))
    .DisableRateLimiting();
```

---

## Rate Limiting con Redis (distribuido)

El rate limiting nativo de .NET usa memoria local — no funciona en múltiples instancias. Para escenarios con múltiples réplicas, necesitás una implementación distribuida.

```csharp
// Opción 1: RedisRateLimiting (paquete de la comunidad)
// dotnet add package RedisRateLimiting

using RedisRateLimiting;

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
});

builder.Services.AddRateLimiter(options =>
{
    options.AddRedisSlidingWindowLimiter("distribuido", (limiterOptions, redisOptions) =>
    {
        limiterOptions.PermitLimit = 100;
        limiterOptions.Window = TimeSpan.FromMinutes(1);

        // Conexión a Redis
        redisOptions.ConnectionMultiplexerFactory = () =>
            ConnectionMultiplexer.Connect(
                builder.Configuration.GetConnectionString("Redis")!);
    });
});
```

```csharp
// Opción 2: Implementación manual con IDistributedCache
public class RedisRateLimiterMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IDistributedCache _cache;
    private const int LimitePorMinuto = 100;

    public RedisRateLimiterMiddleware(RequestDelegate next, IDistributedCache cache)
    {
        _next = next;
        _cache = cache;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var ventana = DateTime.UtcNow.ToString("yyyyMMddHHmm"); // clave por minuto
        var key = $"ratelimit:{ip}:{ventana}";

        var valorActual = await _cache.GetStringAsync(key);
        var contador = valorActual != null ? int.Parse(valorActual) : 0;

        if (contador >= LimitePorMinuto)
        {
            context.Response.StatusCode = 429;
            context.Response.Headers["Retry-After"] = "60";
            await context.Response.WriteAsync("Rate limit excedido");
            return;
        }

        await _cache.SetStringAsync(key, (contador + 1).ToString(),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2),
            });

        await _next(context);
    }
}
```

:::warning Rate Limiting local en múltiples instancias
Si tenés 3 réplicas de tu API y cada una permite 100 req/min por IP, efectivamente estás permitiendo 300 req/min. Para escalar horizontalmente, usá Redis o un API Gateway (Azure APIM, YARP) que centralice el rate limiting.
:::

---

## Testing de Rate Limiting

```csharp
// ProductosControllerRateLimitTests.cs
public class RateLimitTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public RateLimitTests(WebApplicationFactory<Program> factory)
    {
        _client = factory
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Reemplazar con política muy estricta para tests
                    services.AddRateLimiter(opt =>
                    {
                        opt.RejectionStatusCode = 429;
                        opt.AddFixedWindowLimiter("auth-login", o =>
                        {
                            o.PermitLimit = 3; // Muy bajo para que sea fácil probarlo
                            o.Window = TimeSpan.FromSeconds(10);
                            o.QueueLimit = 0;
                        });
                    });
                });
            })
            .CreateClient();
    }

    [Fact]
    public async Task Login_DespuesDeXIntentos_Retorna429()
    {
        var loginRequest = new { email = "test@test.com", password = "wrong" };

        // Primeros 3 intentos: pasan (aunque fallen por credenciales)
        for (int i = 0; i < 3; i++)
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);
            response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests);
        }

        // 4to intento: debe ser bloqueado por rate limit
        var resultado = await _client.PostAsJsonAsync("/api/auth/login", loginRequest);
        resultado.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        resultado.Headers.Should().ContainKey("Retry-After");
    }
}
```

---

## Cuándo usar cada algoritmo — resumen

| Caso de uso | Algoritmo recomendado | Por qué |
|---|---|---|
| API pública general | Fixed Window | Simple, predecible, fácil de comunicar |
| Endpoints sensibles (login, registro) | Fixed Window (ventana larga) | Prevenir brute force |
| API con tráfico variable | Sliding Window | Sin spikes en bordes de ventana |
| API que tolera bursts | Token Bucket | Permite picos ocasionales |
| Endpoints lentos/pesados | Concurrency | Protege recursos, no el tiempo |
| Múltiples instancias | Cualquiera + Redis | Centralizar el conteo |

---

## Comparativa: nativo vs AspNetCoreRateLimit

| | .NET 8 nativo | AspNetCoreRateLimit |
|---|---|---|
| Dependencia | Ninguna | NuGet (terceros) |
| Algoritmos | 4 integrados | Fixed Window + IP |
| Configuración | Código C# | JSON en appsettings |
| Extensibilidad | Alta (partitions) | Media |
| Distribuido | No nativo (Redis manual) | Sí (con Redis) |
| Versión mínima | .NET 7 | .NET cualquiera |
| **Recomendación** | **Proyectos nuevos** | Proyectos legacy |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué diferencia hay entre Fixed Window y Sliding Window?**
> Fixed Window divide el tiempo en bloques fijos — permite un burst al cruzar el límite de ventana (5 req al final de la ventana + 5 al inicio de la siguiente = 10 en 1 segundo). Sliding Window mueve la ventana con el tiempo actual, eliminando ese problema. Sliding Window es más justo pero requiere más memoria.

**2. ¿Por qué Token Bucket es mejor para bursts que Fixed Window?**
> Token Bucket acumula "créditos" cuando el tráfico es bajo y permite gastarlos en picos. Un usuario que no hizo requests en 5 minutos puede hacer 20 de golpe. Fixed Window resetea el contador fijo en cada ventana sin acumular.

**3. ¿Cómo funciona el rate limiting en una API con múltiples réplicas?**
> Si el rate limiting es en memoria, cada instancia tiene su propio contador — efectivamente multiplicás el límite por el número de réplicas. La solución es Redis como almacenamiento centralizado, o delegar al API Gateway (Azure APIM, NGINX, AWS API Gateway) que opera antes de llegar a las instancias.

**4. ¿Qué status code devuelve rate limiting y qué header debe incluir?**
> `429 Too Many Requests` (RFC 6585). Debe incluir el header `Retry-After` con los segundos que debe esperar el cliente antes de reintentar. Sin ese header el cliente no sabe cuándo puede reintentar y puede seguir bombardeando.

**5. ¿Cuándo usarías Concurrency limiter en vez de un limiter basado en tiempo?**
> Para proteger recursos lentos o escasos: un endpoint que hace una query pesada a la DB, llama a una API externa lenta, o genera un reporte. No importa cuántas por segundo — importa que no haya más de N procesándose al mismo tiempo. Si permitís 10 requests/seg pero cada una tarda 5 segundos, acumulás 50 en proceso sin concurrency limiter.

**6. ¿Cómo diferenciarías los límites entre usuarios free y premium?**
> Con `PartitionedRateLimiter` — la función `partitionKey` puede inspeccionar el `HttpContext`, incluyendo `context.User`. Si el claim de rol es "Premium", retornás una partición con límites altos; si es anónimo, límites bajos por IP. Cada partición tiene su propio contador independiente.
