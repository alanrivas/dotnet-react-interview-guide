---
id: polly-resiliencia
title: Polly & Resiliencia
sidebar_position: 22
---

# Polly & Resiliencia 🟡

Polly es la librería estándar de resiliencia en .NET. Permite definir políticas de reintentos, circuit breakers, timeouts y más, de forma declarativa y componible.

---

## ¿Por qué resiliencia?

Las aplicaciones modernas dependen de servicios externos (APIs, bases de datos, colas, servicios de terceros). Todos fallan eventualmente. Sin resiliencia:

```
Tu app → API externa (falla) → Tu app lanza excepción → Usuario ve error
                                        ↑
                          Podría haberse recuperado con un reintento
```

Con resiliencia:

```
Tu app → API externa (falla) → Polly reintenta (1s)
                              → API externa (falla) → Polly reintenta (2s)
                              → API externa (OK)   → Tu app responde
```

---

## Instalación

```bash
dotnet add package Polly
dotnet add package Polly.Extensions.Http   # Para HttpClient
dotnet add package Microsoft.Extensions.Http.Polly
```

---

## 1. Retry Policy

El patrón más básico: si falla, intenta de nuevo.

```csharp
using Polly;
using Polly.Retry;

// ✅ Retry simple — 3 intentos
var retryPolicy = Policy
    .Handle<HttpRequestException>()
    .RetryAsync(3);

await retryPolicy.ExecuteAsync(async () =>
{
    var response = await httpClient.GetAsync("/api/datos");
    response.EnsureSuccessStatusCode();
});

// ✅ Retry con espera exponencial (Exponential Backoff)
// Espera: 1s, 2s, 4s entre intentos
var retryWithBackoff = Policy
    .Handle<HttpRequestException>()
    .Or<TimeoutException>()
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
        onRetry: (exception, timeSpan, attempt, context) =>
        {
            logger.LogWarning(
                "Intento {Attempt} fallido. Esperando {Delay}s. Error: {Error}",
                attempt, timeSpan.TotalSeconds, exception.Message);
        });

// ✅ Retry con jitter (evitar thundering herd)
// Varios clientes reintentando al mismo tiempo → colapso del servidor
var jitter = new Random();
var retryWithJitter = Policy
    .Handle<HttpRequestException>()
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt =>
            TimeSpan.FromSeconds(Math.Pow(2, attempt))
            + TimeSpan.FromMilliseconds(jitter.Next(0, 500)));
```

---

## 2. Circuit Breaker

Evita llamar a un servicio que ya sabemos que está caído. Como el disyuntor eléctrico: corta el circuito para proteger el sistema.

```
Estado: CERRADO → Normal. Permite todas las llamadas.
        ABIERTO → Servicio falló N veces. Rechaza llamadas sin intentarlas.
        SEMI-ABIERTO → Después del timeout, prueba una llamada. Si OK → cierra.
```

```csharp
// ✅ Circuit Breaker clásico
var circuitBreaker = Policy
    .Handle<HttpRequestException>()
    .CircuitBreakerAsync(
        exceptionsAllowedBeforeBreaking: 5,  // Abre tras 5 fallos
        durationOfBreak: TimeSpan.FromSeconds(30),  // Permanece abierto 30s
        onBreak: (exception, duration) =>
        {
            logger.LogWarning(
                "Circuit breaker ABIERTO por {Duration}s. Error: {Error}",
                duration.TotalSeconds, exception.Message);
        },
        onReset: () =>
        {
            logger.LogInformation("Circuit breaker CERRADO — servicio recuperado");
        },
        onHalfOpen: () =>
        {
            logger.LogInformation("Circuit breaker SEMI-ABIERTO — probando llamada");
        });

// ✅ Advanced: Circuit breaker basado en porcentaje de fallos
var advancedCB = Policy
    .Handle<HttpRequestException>()
    .AdvancedCircuitBreakerAsync(
        failureThreshold: 0.5,          // Abre si >50% de llamadas fallan
        samplingDuration: TimeSpan.FromSeconds(10),
        minimumThroughput: 10,           // Al menos 10 llamadas antes de evaluar
        durationOfBreak: TimeSpan.FromSeconds(30));
```

---

## 3. Timeout

Ninguna llamada debería bloquearse indefinidamente.

```csharp
// ✅ Timeout optimista — cancela via CancellationToken
var timeoutPolicy = Policy
    .TimeoutAsync(TimeSpan.FromSeconds(5));

// ✅ Timeout pesimista — usa Task.Run para forzar cancelación aunque no soporte CT
var timeoutPesimista = Policy
    .TimeoutAsync(TimeSpan.FromSeconds(5), TimeoutStrategy.Pessimistic);

await timeoutPolicy.ExecuteAsync(async cancellationToken =>
{
    await httpClient.GetAsync("/api/lento", cancellationToken);
}, CancellationToken.None);
```

---

## 4. Bulkhead (Aislamiento de recursos)

Limita cuántas llamadas concurrentes se permiten a un servicio. Evita que un servicio lento consuma todos los recursos.

```csharp
// ✅ Máximo 10 llamadas concurrentes, cola de 5
var bulkhead = Policy
    .BulkheadAsync(
        maxParallelization: 10,
        maxQueuingActions: 5,
        onBulkheadRejectedAsync: context =>
        {
            logger.LogWarning("Bulkhead lleno — llamada rechazada");
            return Task.CompletedTask;
        });
```

---

## 5. Fallback

Define qué retornar si todo lo demás falla.

```csharp
// ✅ Retornar valor por defecto si el servicio falla
var fallbackPolicy = Policy<ProductoDto?>
    .Handle<HttpRequestException>()
    .Or<BrokenCircuitException>()
    .FallbackAsync(
        fallbackValue: null,
        onFallbackAsync: async (exception, context) =>
        {
            logger.LogWarning("Fallback activado: {Error}", exception.Message);
            await Task.CompletedTask;
        });

// ✅ Retornar datos cacheados como fallback
var fallbackConCache = Policy<IEnumerable<ProductoDto>>
    .Handle<Exception>()
    .FallbackAsync(
        fallbackAction: async ct => await cache.ObtenerProductosAsync(),
        onFallbackAsync: async (ex, ctx) =>
        {
            logger.LogWarning("Usando caché como fallback: {Error}", ex.Message);
            await Task.CompletedTask;
        });
```

---

## 6. Policy Wrap (Combinando políticas)

En la práctica se combinan múltiples políticas. El orden importa: se ejecutan de afuera hacia adentro.

```csharp
// ✅ Patrón recomendado: Fallback → CircuitBreaker → Retry → Timeout
// (de afuera hacia adentro)

var timeoutPolicy = Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(5));

var retryPolicy = Policy<HttpResponseMessage>
    .Handle<HttpRequestException>()
    .Or<TimeoutRejectedException>()
    .WaitAndRetryAsync(3, attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)));

var circuitBreaker = Policy<HttpResponseMessage>
    .Handle<HttpRequestException>()
    .CircuitBreakerAsync(5, TimeSpan.FromSeconds(30));

var fallback = Policy<HttpResponseMessage>
    .Handle<Exception>()
    .FallbackAsync(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));

// Envolver en orden: fallback > circuitBreaker > retry > timeout
var policyWrap = Policy.WrapAsync(fallback, circuitBreaker, retryPolicy, timeoutPolicy);

var response = await policyWrap.ExecuteAsync(() =>
    httpClient.GetAsync("/api/datos"));
```

---

## 7. Integración con HttpClient (la forma correcta)

```csharp
// ✅ Program.cs — registrar HttpClient con Polly
builder.Services.AddHttpClient<IProductoApiClient, ProductoApiClient>(client =>
{
    client.BaseAddress = new Uri("https://api.productos.com");
    client.Timeout = TimeSpan.FromSeconds(30);
})
.AddPolicyHandler(GetRetryPolicy())
.AddPolicyHandler(GetCircuitBreakerPolicy());

static IAsyncPolicy<HttpResponseMessage> GetRetryPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()  // 408, 5xx y HttpRequestException
        .WaitAndRetryAsync(
            3,
            retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)));
}

static IAsyncPolicy<HttpResponseMessage> GetCircuitBreakerPolicy()
{
    return HttpPolicyExtensions
        .HandleTransientHttpError()
        .CircuitBreakerAsync(5, TimeSpan.FromSeconds(30));
}
```

---

## 8. Polly v8 — ResiliencePipeline (API moderna)

Polly v8 introduce una API fluida y más componible:

```csharp
// ✅ Polly v8+ — ResiliencePipeline
using Polly;

var pipeline = new ResiliencePipelineBuilder<HttpResponseMessage>()
    .AddRetry(new RetryStrategyOptions<HttpResponseMessage>
    {
        ShouldHandle = new PredicateBuilder<HttpResponseMessage>()
            .Handle<HttpRequestException>()
            .HandleResult(r => r.StatusCode >= HttpStatusCode.InternalServerError),
        MaxRetryAttempts = 3,
        Delay = TimeSpan.FromSeconds(1),
        BackoffType = DelayBackoffType.Exponential,
        OnRetry = args =>
        {
            logger.LogWarning("Retry {AttemptNumber}", args.AttemptNumber);
            return ValueTask.CompletedTask;
        }
    })
    .AddCircuitBreaker(new CircuitBreakerStrategyOptions<HttpResponseMessage>
    {
        FailureRatio = 0.5,
        SamplingDuration = TimeSpan.FromSeconds(10),
        MinimumThroughput = 10,
        BreakDuration = TimeSpan.FromSeconds(30)
    })
    .AddTimeout(TimeSpan.FromSeconds(5))
    .Build();

var response = await pipeline.ExecuteAsync(
    async ct => await httpClient.GetAsync("/api/datos", ct));
```

---

## Cuándo usar cada política

| Situación | Política |
|-----------|----------|
| API externa falla ocasionalmente | Retry con backoff exponencial |
| API externa lleva caída 10 minutos | Circuit Breaker |
| Llamadas lentas bloquean tu app | Timeout |
| Un servicio lento consume todos tus threads | Bulkhead |
| Prefiero mostrar datos viejos a un error | Fallback + caché |
| Todo lo anterior en producción | Policy Wrap de las 4 anteriores |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es un Circuit Breaker y cuándo lo usarías?**
> Patrón que corta llamadas a un servicio fallido para evitar cascada de errores. Lo usaría cuando llamo a APIs externas o microservicios que pueden fallar. Abre el circuito después de N fallos, espera un tiempo, y prueba de nuevo. Polly lo implementa en 2 líneas.

**2. ¿Cuál es la diferencia entre Retry y Circuit Breaker?**
> Retry intenta de nuevo inmediatamente (con backoff). Circuit Breaker asume que el servicio está caído y deja de intentar durante un tiempo. Se complementan: Retry para fallos transitorios, Circuit Breaker para fallos persistentes.

**3. ¿Qué es Jitter en un retry policy?**
> Añadir aleatoriedad al tiempo de espera entre reintentos. Si 1000 clientes reintentan exactamente al segundo 2, el servidor recibe un spike de 1000 requests simultáneos (thundering herd). Jitter esparce los reintentos.

**4. ¿Cómo registrarías Polly con `HttpClient` en .NET?**
> Via `IHttpClientFactory` en `Program.cs` con `.AddPolicyHandler()`. Esto aplica la política a todas las llamadas del cliente tipado y permite reusar políticas entre clientes.

**5. ¿Qué hace `HandleTransientHttpError()`?**
> Es un helper de `Polly.Extensions.Http` que captura automáticamente: `HttpRequestException`, respuestas 408 (Request Timeout) y respuestas 5xx (errores del servidor). Evita capturar 4xx como 401/403 que no son errores transitorios.
