---
id: distributed-tracing-observability
title: Distributed Tracing y Observability
sidebar_position: 15
---

# Distributed Tracing y Observability 🔴

## Pillars of Observability

```
Las 3 señales de una aplicación distribuida:

1. LOGS: Eventos discretos ("Usuario creado", "Error en BD")
   ✅ Rich context, fácil debuggear
   ❌ Genera mucho volumen, necesita parsing

2. METRICS: Números agregados (CPU 45%, latency p99 150ms, requests/sec)
   ✅ Alertas automáticas, entender tendencias
   ❌ Baja granularidad, pierdes contexto individual

3. TRACES: Flujo individual de request (Service A → B → C)
   ✅ Ver exactamente qué pasó con request particular
   ❌ Alto overhead si no samplea

Para observabilidad completa: necesitas los 3 en conjunto
```

---

## OpenTelemetry (OTEL)

```csharp
// ✅ Estándar open-source para instrumentación
// Instalar: dotnet add package OpenTelemetry

// Program.cs
var tracingBuilder = builder.Services
    .AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddConsoleExporter()
            .AddOtlpExporter(options =>
            {
                options.Endpoint = new Uri("http://localhost:4317");  // Jaeger collector
            })
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddEntityFrameworkCoreInstrumentation()
            .AddSqlClientInstrumentation();
    })
    .WithMetrics(metrics =>
    {
        metrics
            .AddConsoleExporter()
            .AddOtlpExporter()
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation();
    });

// Crear spans personalizados
public class PedidoService
{
    private readonly ActivitySource _activitySource;

    public async Task<int> CrearPedidoAsync(CreatePedidoRequest request)
    {
        using var activity = _activitySource.StartActivity("CrearPedido");
        activity?.SetTag("usuario_id", request.UsuarioId);
        activity?.SetTag("items_count", request.Items.Count);

        try
        {
            // Validación
            using (var validationActivity = _activitySource.StartActivity("ValidarPedido"))
            {
                ValidarRequest(request);
            }

            // Crear en BD
            using (var dbActivity = _activitySource.StartActivity("GuardarPedido"))
            {
                var pedido = new Pedido { ...request };
                await _db.Pedidos.AddAsync(pedido);
                await _db.SaveChangesAsync();

                dbActivity?.SetTag("pedido_id", pedido.Id);
                return pedido.Id;
            }
        }
        catch (Exception ex)
        {
            activity?.RecordException(ex);
            activity?.SetStatus(ActivityStatusCode.Error);
            throw;
        }
    }
}

// En Jaeger UI:
// Ves el trace completo:
// CrearPedido [0-100ms]
// ├─ ValidarPedido [0-5ms]
// └─ GuardarPedido [5-100ms]
//    └─ EF SaveChanges [10-95ms]
//       └─ SQL INSERT [80-90ms]
```

---

## Correlation ID (W3C Trace Context)

```csharp
// ✅ Estándar W3C para propagar trace IDs
// Header: traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01

public class TraceContextMiddleware
{
    private readonly RequestDelegate _next;

    public async Task InvokeAsync(HttpContext context)
    {
        // Extraer o generar trace ID
        var traceId = context.Request.Headers.TryGetValue("traceparent", out var val)
            ? ExtractTraceId(val.ToString())
            : Guid.NewGuid().ToString();

        using (LogContext.PushProperty("TraceId", traceId))
        using (LogContext.PushProperty("SpanId", Guid.NewGuid().ToString()))
        {
            context.Response.Headers.Add("traceparent", $"00-{traceId}-{Guid.NewGuid():N}-01");

            // Activity.Current.Id ahora tiene el trace context
            await _next(context);
        }
    }
}

// Propagar a servicios downstream
public class HttpClientPropagationHandler : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        // Agregar el W3C trace header a la request
        request.Headers.Add("traceparent", Activity.Current?.Id ?? "");

        return await base.SendAsync(request, cancellationToken);
    }
}

// Uso en múltiples servicios
// Client → Service A (traceparent: abc-123)
//          └→ Service B (traceparent: abc-123) ← mismo trace
//             └→ Service C (traceparent: abc-123) ← mismo trace
//
// Ahora puedes correlacionar logs en los 3 servicios
```

---

## Sampling Strategies

```csharp
// ❌ PROBLEMA: Tracing TODOS los requests = mucho volumen
// 1M requests/dia * 10 spans por request * 1KB = 10GB/dia almacenamiento + overhead

// ✅ SOLUCIONES:

// 1. Head sampling: Decidir en primer servicio si samplear
var tracerProvider = new TracerProviderBuilder()
    .SetSampler(new ProbabilitySampler(0.1))  // Sample 10%
    .Build();

// Problema: Nunca ves traces de requests raros/errores

// 2. Tail sampling: Decidir después si es interesante
public class TailSampler : Sampler
{
    public override SamplingResult ShouldSample(SamplingParameters parameters)
    {
        // Decidir en el UI de Jaeger/Datadog: ¿incluir este trace?
        // Estrategias:
        // - Si tiene errores: incluir
        // - Si latencia > P99: incluir
        // - Si usuario es VIP: incluir
        // - Else: random 10%

        // En este momento tienes todo el trace disponible
        return SamplingResult.RecordAndSampled;
    }
}

// 3. Adaptive sampling (mejor)
public class AdaptiveSampler : Sampler
{
    public override SamplingResult ShouldSample(SamplingParameters parameters)
    {
        var attributes = parameters.Attributes;
        
        // Errores siempre
        if (attributes.TryGetValue("error", out object isError) && (bool)isError)
            return SamplingResult.RecordAndSampled;

        // Usuarios VIP siempre
        if (attributes.TryGetValue("user_tier", out object tier) && tier.ToString() == "enterprise")
            return SamplingResult.RecordAndSampled;

        // High latency siempre (si ya sabemos)
        if (attributes.TryGetValue("duration_ms", out object duration) && (int)duration > 1000)
            return SamplingResult.RecordAndSampled;

        // Else: 5%
        return SamplingResult.RecordAndSampled.Probability < 0.05
            ? SamplingResult.RecordAndSampled
            : SamplingResult.Drop;
    }
}
```

---

## Metrics Collection

```csharp
// ✅ Métricas importantes para monitoreo
public class MetricasService
{
    private readonly Meter _meter;

    public MetricasService()
    {
        _meter = new Meter("MiApp.Metricas");
    }

    public void RegistrarMetricas()
    {
        // Counter: número que solo sube
        var requestsCount = _meter.CreateCounter<long>(
            "http.requests.total",
            description: "Total HTTP requests");

        // Gauge: número que puede subir/bajar
        var activeConexiones = _meter.CreateObservableGauge(
            "db.connections.active",
            () => _db.Database.GetOpenConnection().State == ConnectionState.Open ? 1 : 0);

        // Histogram: distribución (latencias)
        var requestDuration = _meter.CreateHistogram<double>(
            "http.request.duration.ms",
            description: "Request duration");
    }
}

// En POST endpoint
[HttpPost]
public async Task<IActionResult> CrearPedido([FromBody] CreatePedidoRequest request)
{
    var inicio = DateTime.UtcNow;

    try
    {
        var resultado = await _pedidoService.CrearAsync(request);
        
        _metricas.RegisterRequestSuccess();
        return CreatedAtAction(nameof(GetPedido), resultado);
    }
    catch (Exception ex)
    {
        _metricas.RegisterRequestError(ex.GetType().Name);
        throw;
    }
    finally
    {
        var duracion = DateTime.UtcNow - inicio;
        _metricas.RegisterRequestDuration(duracion.TotalMilliseconds);
    }
}

// En Prometheus/Grafana ves:
// - Rate de requests exitosos vs errores
// - P50, P95, P99 latency
// - Errores por tipo
// - Alertas: si P99 > 1000ms
```

---

## Logs Estructurados

```csharp
// ✅ Usar Serilog con structured logging
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .WriteTo.Console(new JsonFormatter())  // ← JSON logs
    .WriteTo.Seq("http://localhost:5341")  // ← Seq server (o ELK)
    .Destructure.ToMaximumDepth(4)
    .Enrich.FromLogContext()
    .CreateLogger();

// Uso
public async Task CrearPedidoAsync(Guid pedidoId, int usuarioId, List<Item> items)
{
    // Logging con context estructurado
    using (LogContext.PushProperty("PedidoId", pedidoId))
    using (LogContext.PushProperty("UsuarioId", usuarioId))
    {
        _logger.Information("Iniciando creación de pedido con {ItemCount} items", items.Count);

        try
        {
            await ValidarInventarioAsync(items);
            _logger.Information("Inventario validado exitosamente");

            var pedido = await _db.CrearPedidoAsync(new Pedido { ... });
            _logger.Information("Pedido creado con ID {PedidoId}", pedidoId);
        }
        catch (InventarioNoDisponibleException ex)
        {
            _logger.Warning(ex, "Inventario no disponible para ítems: {@Items}", items);
        }
        catch (Exception ex)
        {
            _logger.Error(ex, "Error fatal creando pedido");
            throw;
        }
    }
}

// Logs generados:
// {"timestamp":"2024-01-15T10:30:00","level":"Information","message":"Iniciando creación",
//  "PedidoId":"abc-123","UsuarioId":456,"ItemCount":2,"CorrelationId":"xyz-789"}
//
// {"timestamp":"2024-01-15T10:30:01","level":"Information","message":"Pedido creado",
//  "PedidoId":"abc-123","UsuarioId":456,"CorrelationId":"xyz-789"}

// En Seq UI o ELK:
// Query: CorrelationId == "xyz-789"
// Ves el flujo completo con contexto
```

---

## Alert Strategy

```yaml
# Prometheus alert rules
groups:
  - name: api_alerts
    rules:
      # Alerta crítica
      - alert: APIDown
        expr: up{job="api"} == 0
        for: 1m
        annotations:
          severity: critical
          summary: "API service is down"

      # Latencia P99 alta
      - alert: HighLatency
        expr: histogram_quantile(0.99, http_request_duration_ms) > 1000
        for: 5m
        annotations:
          severity: warning
          summary: "P99 latency > 1s"

      # Error rate alto
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          severity: warning
          summary: "Error rate > 5%"

      # BD connection pool casi lleno
      - alert: DBConnectionPoolExhausted
        expr: db_connections_active / db_connections_max > 0.9
        for: 2m
        annotations:
          severity: warning
          summary: "DB connection pool 90% full"

# En PagerDuty/Slack:
# - Crítico: página al on-call
# - Warning: slack notification
# - Info: loguear sin alertar
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Logs vs Traces vs Metrics — cuándo usar cada uno?**
> **Logs**: Debugging específico ("Usuario 123 creado exitosamente"). **Traces**: "¿Por qué request de usuario 123 tardó 5s?" (ver Service A → B → C). **Metrics**: "¿Servicio está healthy?" (latency P99, error rate).

**2. ¿OpenTelemetry vs Datadog vs CloudTrace?**
> **OTEL**: Open-source, vendor-neutral, exporta a cualquier backend. **Datadog/CloudTrace**: Vendor-specific, better UI, más caro. Recomendación: OTEL + exportar a Jaeger/Prometheus on-prem, o a Datadog si necesitas SaaS.

**3. ¿Qué samplear en tracing?**
> Errores siempre, luego random 1-10% de éxitos. O mejor: tail sampling (decidir después). Si tienes 1M requests/día, samplear 10% = 100k traces, mucho más manejable que todos.

**4. ¿W3C Trace Context vs X-Request-ID?**
> **W3C Traceparent**: Estándar, propaga trace/span/flags. **X-Request-ID**: Simple, solo correlación. Usa W3C — es cross-industry standard, OpenTelemetry lo entiende automáticamente.

**5. ¿Cuándo alertar y cuándo loguear?**
> **Alertar**: Si afecta usuario ahora (API down, error rate 50%). **Loguear**: Si es info útil pero no emergencia (usuario creado, pago procesado, background job completó). Rule: si la alerta dispara las 2am, debe ser crítica.

**6. ¿Logs en BD vs filesystem vs Elasticsearch?**
> **BD**: Transaccional pero lento, overhead en queries. **Filesystem**: Rápido pero sin búsqueda. **Elasticsearch / Splunk**: Óptimo — indexa, búsqueda rápida, retención configurable. Para escala: usa ELK stack o SaaS como Datadog.

**7. ¿PII en logs — GDPR compliance?**
> Nunca loguea passwords, tokens, números de tarjeta. Loguea `user_id`, no `email`. Si debes loguear datos personales, encriptarlos o tenerlos en almacenamiento separado con acceso restringido. Políticas de retención: borrar logs > 90 días.

**8. ¿Cómo debuggueo latencia en trace distribuido?**
> 1. Ver span durations. 2. Cuál servicio agrega latencia. 3. Si es red, ver timing entre servicios. Si es lógica, instrumenta sub-spans (DB, cache, API call). Busca: ¿Hay esperas? ¿Cuello de botella en sequence vs parallel?