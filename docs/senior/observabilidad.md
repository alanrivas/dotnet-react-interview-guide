---
id: observabilidad
title: Observabilidad y Monitoring
sidebar_position: 11
---

# Observabilidad y Monitoring

## Los Tres Pilares de la Observabilidad

La **observabilidad** es la capacidad de inferir el estado interno de un sistema a partir de sus salidas externas. No se trata solo de saber *que* algo falló, sino de entender *por qué* falló sin necesidad de redesplegar o modificar el código.

Los tres pilares son complementarios, no sustitutos:

| Pilar | ¿Qué responde? | Herramientas |
|-------|----------------|--------------|
| **Logs** | ¿Qué ocurrió exactamente? | Serilog, NLog, Seq, Kibana |
| **Métricas** | ¿Cuánto, con qué frecuencia, qué tan rápido? | Prometheus, Grafana, Datadog |
| **Trazas distribuidas** | ¿Dónde se tardó / falló el request? | Jaeger, Zipkin, Tempo |

```
Request del usuario
       │
       ▼
  [API Gateway] ──── traza: span A ─────────────────────────────┐
       │                                                          │
       ▼                                                          │
  [Servicio Orders] ── span B ───────────────────────────────┐   │
       │                                                      │   │
       ├──► [Base de Datos]      ── span C ──────────────┐   │   │
       │                                                  │   │   │
       └──► [Servicio Inventory] ── span D ───────────┐  │   │   │
                                                       ▼  ▼   ▼   ▼
                                              Todos los spans forman
                                              UNA TRAZA con un TraceId
```

---

## Logging Estructurado con Serilog en .NET

### ¿Por qué structured logging?

El logging de texto plano es difícil de consultar:
```
// ❌ Log plano — imposible filtrar por userId o amount en producción
logger.LogInformation($"Procesando pedido {orderId} para usuario {userId} por {amount}€");

// Produce: "Procesando pedido abc-123 para usuario 42 por 99.99€"
// Para encontrarlo: grep "usuario 42" — frágil y lento
```

El **structured logging** preserva los valores como propiedades:
```csharp
// ✅ Structured log — cada valor es una propiedad indexable
logger.LogInformation(
    "Procesando pedido {OrderId} para usuario {UserId} por {Amount:C}",
    orderId, userId, amount);

// Produce JSON: { "OrderId": "abc-123", "UserId": 42, "Amount": 99.99, ... }
// Para encontrarlo en Kibana/Seq: UserId = 42 AND Amount > 50
```

### Instalación

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.Seq
dotnet add package Serilog.Enrichers.Environment
dotnet add package Serilog.Enrichers.Thread
dotnet add package Serilog.Enrichers.CorrelationId
```

### Configuración en Program.cs

```csharp
// Program.cs
using Serilog;
using Serilog.Events;

// Bootstrap logger para capturar errores durante el startup
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.Host.UseSerilog((context, services, configuration) =>
    {
        configuration
            .ReadFrom.Configuration(context.Configuration)    // lee appsettings.json
            .ReadFrom.Services(services)                       // permite DI en enrichers
            .Enrich.FromLogContext()                           // permite LogContext.PushProperty
            .Enrich.WithMachineName()                         // nombre del servidor
            .Enrich.WithThreadId()                            // útil para debug de concurrencia
            .Enrich.WithEnvironmentName()                     // Development / Production
            .Enrich.WithCorrelationId()                       // Correlation ID por request
            .WriteTo.Console(new RenderedCompactJsonFormatter())  // JSON en consola
            .WriteTo.Seq(context.Configuration["Seq:Url"]!);     // UI para explorar logs
    });

    var app = builder.Build();

    // Middleware que loguea cada request HTTP automáticamente
    app.UseSerilogRequestLogging(options =>
    {
        options.MessageTemplate =
            "HTTP {RequestMethod} {RequestPath} respondió {StatusCode} en {Elapsed:0.000}ms";

        // Agregar propiedades extra al log de cada request
        options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
        {
            diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
            diagnosticContext.Set("UserId", httpContext.User?.Identity?.Name ?? "anónimo");
        };
    });

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "La aplicación terminó inesperadamente durante el startup");
    return 1;
}
finally
{
    await Log.CloseAndFlushAsync(); // ¡Importante! Vaciar el buffer antes de salir
}

return 0;
```

### Configuración en appsettings.json

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.EntityFrameworkCore.Database.Command": "Information",
        "System": "Warning"
      }
    }
  },
  "Seq": {
    "Url": "http://localhost:5341"
  }
}
```

### Correlation ID: propagar contexto entre servicios

El Correlation ID es un identificador único por request que permite correlacionar todos los logs de una operación, incluso si atraviesa múltiples servicios.

```csharp
// Middleware para gestionar el Correlation ID
public class CorrelationIdMiddleware
{
    private const string HeaderName = "X-Correlation-ID";
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // Leer del header (si viene de otro servicio) o generar uno nuevo
        var correlationId = context.Request.Headers[HeaderName].FirstOrDefault()
                            ?? Guid.NewGuid().ToString();

        // Agregar al response para que el cliente pueda correlacionar
        context.Response.Headers[HeaderName] = correlationId;

        // Inyectar en el contexto de Serilog — aparece en TODOS los logs de este request
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}

// Registro en Program.cs
app.UseMiddleware<CorrelationIdMiddleware>();
```

```csharp
// En un servicio — propagar el Correlation ID al llamar a otro microservicio
public class OrdersHttpClient
{
    private readonly HttpClient _httpClient;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public async Task<InventoryDto> CheckInventoryAsync(string productId)
    {
        var correlationId = _httpContextAccessor.HttpContext?
            .Response.Headers["X-Correlation-ID"].ToString();

        if (correlationId != null)
            _httpClient.DefaultRequestHeaders.Add("X-Correlation-ID", correlationId);

        return await _httpClient.GetFromJsonAsync<InventoryDto>($"/inventory/{productId}");
    }
}
```

### LogContext.PushProperty — contexto temporal

```csharp
public class OrderService
{
    private readonly ILogger<OrderService> _logger;

    public async Task ProcessOrderAsync(Order order)
    {
        // Todas las líneas de log dentro de este using tendrán OrderId y CustomerId
        using (LogContext.PushProperty("OrderId", order.Id))
        using (LogContext.PushProperty("CustomerId", order.CustomerId))
        {
            _logger.LogInformation("Iniciando procesamiento de pedido");

            await ValidateStockAsync(order);    // este log también tendrá OrderId
            await ChargeCreditCardAsync(order); // este también
            await SendConfirmationEmailAsync(order);

            _logger.LogInformation("Pedido procesado correctamente");
        }
        // Fuera del using, OrderId y CustomerId ya no aparecen
    }
}
```

### Niveles de log — cuándo usar cada uno

| Nivel | Cuándo usarlo | Ejemplo |
|-------|---------------|---------|
| **Verbose** | Diagnóstico muy detallado, solo dev | Cada iteración de un bucle |
| **Debug** | Info útil durante desarrollo | Valores de variables internas |
| **Information** | Eventos normales del negocio | "Pedido creado", "Usuario autenticado" |
| **Warning** | Algo inesperado pero recuperable | Reintentar una operación, deprecated API |
| **Error** | Error que interrumpe la operación actual | Excepción en un endpoint |
| **Fatal** | Error irrecuperable, la app debe parar | BD inaccesible al arrancar |

```csharp
// ✅ Correcto — cada nivel con su propósito
_logger.LogDebug("Evaluando {RuleCount} reglas de descuento para pedido {OrderId}", 
    rules.Count, order.Id);

_logger.LogInformation("Pedido {OrderId} creado por cliente {CustomerId}", 
    order.Id, order.CustomerId);

_logger.LogWarning("Intento de pago fallido {AttemptNumber}/3 para pedido {OrderId}. " +
    "Reintentando en {DelayMs}ms", attempt, order.Id, delay);

_logger.LogError(exception, "Error al procesar pago del pedido {OrderId}", order.Id);

_logger.LogCritical("Conexión a base de datos perdida. La aplicación no puede continuar.");
```

---

## Métricas con OpenTelemetry en .NET

### ¿Qué es OpenTelemetry?

OpenTelemetry (OTEL) es un estándar **vendor-neutral** y open-source para instrumentar aplicaciones. En lugar de estar atado a Datadog, New Relic o Application Insights, instrumentas una vez y exportas a cualquier backend.

```
Tu aplicación (.NET)
        │
        │ OpenTelemetry SDK
        │
        ▼
  OTEL Collector  ──────────────────────────────────────────────
        │                │               │                │
        ▼                ▼               ▼                ▼
   Prometheus        Jaeger          Zipkin          Datadog
   (métricas)       (trazas)        (trazas)         (todo)
```

### Configuración

```bash
dotnet add package OpenTelemetry.Extensions.Hosting
dotnet add package OpenTelemetry.Instrumentation.AspNetCore
dotnet add package OpenTelemetry.Instrumentation.Http
dotnet add package OpenTelemetry.Instrumentation.EntityFrameworkCore
dotnet add package OpenTelemetry.Exporter.Prometheus.AspNetCore
dotnet add package OpenTelemetry.Exporter.OpenTelemetryProtocol
```

```csharp
// Program.cs — configuración completa de OpenTelemetry
builder.Services.AddOpenTelemetry()
    .WithMetrics(metrics =>
    {
        metrics
            .AddAspNetCoreInstrumentation()   // métricas HTTP automáticas
            .AddHttpClientInstrumentation()   // métricas de llamadas salientes
            .AddRuntimeInstrumentation()      // GC, threads, memory del runtime
            .AddMeter("MiApp.Orders")         // métricas de negocio custom
            .AddPrometheusExporter();         // expone /metrics para que Prometheus scrape
    })
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddEntityFrameworkCoreInstrumentation()
            .AddSource("MiApp.Orders")        // spans custom
            .AddOtlpExporter(opts =>
            {
                opts.Endpoint = new Uri("http://jaeger:4317"); // gRPC
            });
    });

// Exponer el endpoint de métricas para Prometheus
app.MapPrometheusScrapingEndpoint(); // GET /metrics
```

### Tipos de métricas

```csharp
// Definir un Meter (un "módulo" de métricas) — idealmente en un servicio singleton
public class OrderMetrics
{
    private readonly Counter<long> _ordersCreated;
    private readonly Counter<long> _ordersFailed;
    private readonly Histogram<double> _orderProcessingDuration;
    private readonly ObservableGauge<int> _pendingOrdersGauge;

    private int _pendingOrders = 0;

    public OrderMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("MiApp.Orders");

        // Counter: solo sube, nunca baja. Para contar eventos.
        _ordersCreated = meter.CreateCounter<long>(
            name: "orders.created",
            unit: "{pedido}",
            description: "Número total de pedidos creados");

        _ordersFailed = meter.CreateCounter<long>(
            name: "orders.failed",
            unit: "{pedido}",
            description: "Número total de pedidos que fallaron");

        // Histogram: distribución de valores. Para medir latencias, tamaños.
        _orderProcessingDuration = meter.CreateHistogram<double>(
            name: "orders.processing_duration",
            unit: "ms",
            description: "Duración del procesamiento de pedidos");

        // ObservableGauge: valor puntual que se lee cuando se necesita.
        _pendingOrdersGauge = meter.CreateObservableGauge<int>(
            name: "orders.pending",
            observeValue: () => _pendingOrders,
            description: "Pedidos pendientes de procesar en este momento");
    }

    public void RecordOrderCreated(string region, string paymentMethod)
    {
        // Tags/dimensiones: permiten filtrar y agrupar en Grafana
        var tags = new TagList
        {
            { "region", region },
            { "payment_method", paymentMethod }
        };
        _ordersCreated.Add(1, tags);
        Interlocked.Increment(ref _pendingOrders);
    }

    public void RecordOrderProcessed(double durationMs, bool success, string region)
    {
        var tags = new TagList { { "region", region }, { "success", success } };
        _orderProcessingDuration.Record(durationMs, tags);
        
        if (!success)
            _ordersFailed.Add(1, new TagList { { "region", region } });
        
        Interlocked.Decrement(ref _pendingOrders);
    }
}
```

```csharp
// Usar las métricas en el servicio
public class OrderService
{
    private readonly OrderMetrics _metrics;

    public async Task<Order> CreateOrderAsync(CreateOrderCommand cmd)
    {
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var order = await ProcessOrderInternalAsync(cmd);
            
            _metrics.RecordOrderCreated(cmd.Region, cmd.PaymentMethod);
            _metrics.RecordOrderProcessed(stopwatch.ElapsedMilliseconds, success: true, cmd.Region);
            
            return order;
        }
        catch (Exception)
        {
            _metrics.RecordOrderProcessed(stopwatch.ElapsedMilliseconds, success: false, cmd.Region);
            throw;
        }
    }
}
```

### SLI, SLO y SLA

```
SLI (Service Level Indicator)
  └─ Métrica que mide el comportamiento del servicio desde el punto de vista del usuario
  └─ Ejemplos: % requests exitosos, latencia p99, % datos frescos

SLO (Service Level Objective)
  └─ Objetivo interno que el equipo se compromete a cumplir
  └─ Ejemplos: "99.9% de requests < 200ms", "disponibilidad > 99.5%"
  └─ Define el "error budget": 0.1% = ~8.7 horas de caída al año

SLA (Service Level Agreement)
  └─ Contrato externo con clientes, con consecuencias si se incumple
  └─ El SLO debe ser más estricto que el SLA para tener margen
```

```yaml
# Ejemplo de SLO definido en Prometheus/Sloth
apiVersion: sloth.slok.dev/v1
kind: PrometheusServiceLevel
metadata:
  name: orders-api-slo
spec:
  service: "orders-api"
  slos:
    - name: "requests-availability"
      objective: 99.9   # 99.9% de requests deben ser exitosos
      description: "Disponibilidad de la API de pedidos"
      sli:
        events:
          errorQuery: |
            sum(rate(http_requests_total{service="orders-api",status=~"5.."}[{{.window}}]))
          totalQuery: |
            sum(rate(http_requests_total{service="orders-api"}[{{.window}}]))
      alerting:
        pageAlert:
          labels:
            severity: critical
        ticketAlert:
          labels:
            severity: warning
```

### Prometheus + Grafana — configuración básica

```yaml
# prometheus.yml — configuración de scraping
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'orders-api'
    static_configs:
      - targets: ['orders-api:8080']
    metrics_path: '/metrics'

  - job_name: 'inventory-api'
    static_configs:
      - targets: ['inventory-api:8080']
```

```yaml
# docker-compose.yml para stack de observabilidad local
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    depends_on:
      - prometheus

  seq:
    image: datalust/seq:latest
    ports:
      - "5341:80"
    environment:
      - ACCEPT_EULA=Y

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4317:4317"    # OTLP gRPC
```

---

## Distributed Tracing con OpenTelemetry

### W3C Trace Context

El estándar W3C define headers HTTP para propagar el contexto de una traza entre servicios:

```http
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
             ^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^^^^ ^^
             ver        trace-id (128 bits)       span-id (64 bits) flags
```

OpenTelemetry propaga estos headers automáticamente en `HttpClient`.

### Spans — unidad de trabajo

```csharp
// Definir un ActivitySource (equivalente a un "tracer")
public static class Telemetry
{
    public static readonly ActivitySource Source = new("MiApp.Orders", "1.0.0");
}

// Registrar en Program.cs
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t.AddSource("MiApp.Orders"));
```

```csharp
// Crear spans personalizados
public class OrderService
{
    public async Task<Order> ProcessOrderAsync(CreateOrderCommand cmd)
    {
        // Crear un span hijo del span actual (el de ASP.NET Core crea el raíz)
        using var activity = Telemetry.Source.StartActivity("ProcessOrder");
        
        // Agregar atributos al span — aparecen en Jaeger como tags
        activity?.SetTag("order.customer_id", cmd.CustomerId);
        activity?.SetTag("order.region", cmd.Region);
        activity?.SetTag("order.item_count", cmd.Items.Count);

        try
        {
            // Span hijo para validación
            using var validationSpan = Telemetry.Source.StartActivity("ValidateOrder");
            await ValidateOrderAsync(cmd);
            validationSpan?.SetStatus(ActivityStatusCode.Ok);

            // Span hijo para persistencia
            using var persistSpan = Telemetry.Source.StartActivity("PersistOrder");
            var order = await _repository.SaveAsync(cmd);
            persistSpan?.SetTag("order.id", order.Id.ToString());

            // Span hijo para evento de dominio
            using var eventSpan = Telemetry.Source.StartActivity("PublishOrderCreatedEvent");
            await _eventBus.PublishAsync(new OrderCreatedEvent(order.Id));

            activity?.SetStatus(ActivityStatusCode.Ok);
            return order;
        }
        catch (Exception ex)
        {
            // Marcar el span como error con el mensaje de la excepción
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.RecordException(ex); // agrega el stack trace al span
            throw;
        }
    }
}
```

### Traza completa: API → Servicio → BD → Caché

```
Traza: 4bf92f3577b34da6a3ce929d0e0e4736
│
├── [0ms]   POST /orders (span raíz, creado por ASP.NET Core middleware)
│   │       HTTP 201 — duración total: 145ms
│   │
│   ├── [2ms]  ProcessOrder (span custom)
│   │   │
│   │   ├── [3ms]  ValidateOrder — 5ms
│   │   │   └── EF Core: SELECT * FROM products WHERE id IN (...) — 4ms
│   │   │
│   │   ├── [9ms]  CheckInventoryCache — 1ms  ← caché HIT
│   │   │
│   │   ├── [11ms] PersistOrder — 35ms
│   │   │   └── EF Core: INSERT INTO orders (...) — 33ms
│   │   │
│   │   └── [47ms] PublishOrderCreatedEvent — 8ms
│   │       └── HTTP POST inventory-service/reserve — 7ms  ← llamada a otro servicio
│   │           └── (la traza continúa en inventory-service con mismo TraceId)
│   │
│   └── [140ms] Response serialization — 5ms
```

---

## Health Checks en ASP.NET Core

```csharp
// Program.cs
builder.Services.AddHealthChecks()
    // BD — intenta conectar y ejecutar una query simple
    .AddSqlServer(
        connectionString: builder.Configuration.GetConnectionString("Default")!,
        healthQuery: "SELECT 1",
        name: "sqlserver",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["db", "sqlserver"])
    
    // Redis
    .AddRedis(
        redisConnectionString: builder.Configuration["Redis:ConnectionString"]!,
        name: "redis",
        failureStatus: HealthStatus.Degraded,  // sin caché funciona, pero degradado
        tags: ["cache", "redis"])
    
    // Servicio externo
    .AddUrlGroup(
        uri: new Uri("https://api.pagos.com/health"),
        name: "payment-gateway",
        failureStatus: HealthStatus.Degraded,
        tags: ["external"])
    
    // Health check custom
    .AddCheck<PendingOrdersHealthCheck>("pending-orders", tags: ["business"]);

// Exponer endpoints diferenciados
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    // Liveness: ¿la app está viva? Solo checks críticos.
    // Si falla → Kubernetes reinicia el pod
    Predicate = check => !check.Tags.Contains("external"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    // Readiness: ¿la app puede atender tráfico?
    // Si falla → Kubernetes deja de enviar tráfico al pod (pero no lo reinicia)
    Predicate = _ => true,
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
```

```csharp
// Health check custom — lógica de negocio
public class PendingOrdersHealthCheck : IHealthCheck
{
    private readonly IOrderRepository _repository;

    public PendingOrdersHealthCheck(IOrderRepository repository)
        => _repository = repository;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var pendingCount = await _repository.CountPendingAsync(cancellationToken);

        return pendingCount switch
        {
            < 100  => HealthCheckResult.Healthy($"{pendingCount} pedidos pendientes"),
            < 1000 => HealthCheckResult.Degraded($"⚠️ {pendingCount} pedidos pendientes — posible retraso"),
            _      => HealthCheckResult.Unhealthy($"🔴 {pendingCount} pedidos pendientes — sistema saturado")
        };
    }
}
```

### Kubernetes Probes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders-api
spec:
  template:
    spec:
      containers:
        - name: orders-api
          image: myregistry/orders-api:latest
          ports:
            - containerPort: 8080
          
          # Liveness: si falla, Kubernetes reinicia el contenedor
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 10   # esperar N segundos antes del primer check
            periodSeconds: 30         # cada 30s
            failureThreshold: 3       # 3 fallos consecutivos → reiniciar
          
          # Readiness: si falla, no enviar tráfico (pero no reiniciar)
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 2       # 2 fallos → quitar del load balancer
          
          # Startup: para apps lentas en arrancar (evita que liveness las mate)
          startupProbe:
            httpGet:
              path: /health/live
              port: 8080
            failureThreshold: 30      # hasta 30 * 10s = 5 minutos para arrancar
            periodSeconds: 10
```

**Diferencia clave Liveness vs Readiness:**
- **Liveness**: ¿está el proceso vivo? Un deadlock o estado corrupto → reiniciar.
- **Readiness**: ¿puede atender tráfico? Migraciones en curso, warmup de caché, dependencias no disponibles → no enviar tráfico, pero no reiniciar.

---

## Alerting y On-Call

### Principios de buenas alertas

> **Alerta sobre síntomas (el usuario está afectado), no sobre causas internas.**

```yaml
# ❌ Alerta sobre causa interna — puede que no afecte a usuarios
- alert: CPUAlta
  expr: cpu_usage > 80
  # ¿Y? Quizás la app funciona perfectamente con CPU alta

# ✅ Alerta sobre síntoma — el usuario definitivamente está siendo afectado
- alert: ErrorRateAlta
  expr: |
    sum(rate(http_requests_total{status=~"5.."}[5m]))
    /
    sum(rate(http_requests_total[5m])) > 0.01
  annotations:
    summary: "Tasa de errores > 1%"
    runbook: "https://wiki.empresa.com/runbooks/error-rate-alta"
```

### SLO Burn Rate Alerts — más inteligentes que umbrales simples

```yaml
# Prometheus — alertas basadas en burn rate del error budget
groups:
  - name: orders-api-slo-alerts
    rules:
      # Alerta CRÍTICA: consumiendo budget a 14x — quedaremos sin budget en ~2 horas
      - alert: ErrorBudgetBurnRateCritico
        expr: |
          (
            sum(rate(http_requests_total{service="orders",status=~"5.."}[1h]))
            / sum(rate(http_requests_total{service="orders"}[1h]))
          ) > (14 * 0.001)  # 14x el error rate permitido (0.1%)
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "🔴 Burn rate crítico: error budget agotado en ~2h"
          runbook: "https://wiki/runbooks/orders-api-burn-rate"

      # Alerta WARNING: consumiendo budget a 6x — quedaremos sin budget en ~1 día
      - alert: ErrorBudgetBurnRateWarning
        expr: |
          (
            sum(rate(http_requests_total{service="orders",status=~"5.."}[6h]))
            / sum(rate(http_requests_total{service="orders"}[6h]))
          ) > (6 * 0.001)
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "⚠️ Burn rate elevado: error budget agotado en ~1 día"
```

**¿Por qué burn rate > umbral simple?**
- Un umbral simple `error_rate > 1%` genera alertas aunque sea por 1 minuto (ruido).
- El burn rate mide si estás *consumiendo el presupuesto de errores más rápido de lo sostenible*.
- Reduce falsos positivos y asegura que cada alerta sea accionable.

### Cada alerta necesita un Runbook

```markdown
# Runbook: ErrorRateAlta en orders-api

## ¿Qué significa esta alerta?
La tasa de errores HTTP 5xx supera el 1% en los últimos 5 minutos.

## Impacto en el usuario
Los usuarios pueden estar viendo errores al crear o consultar pedidos.

## Pasos de diagnóstico
1. Ver logs en Kibana: `service:orders-api AND level:ERROR`
2. Ver trazas recientes en Jaeger: buscar spans con error=true
3. Revisar deploys recientes: `kubectl rollout history deployment/orders-api`
4. Revisar métricas de BD: ¿hay lentitud en queries? ¿connection pool exhausto?

## Acciones
- Si fue un deploy reciente: `kubectl rollout undo deployment/orders-api`
- Si es la BD: escalar réplicas de lectura o revisar slow query log
- Si es un servicio externo (ej: payment gateway): activar circuit breaker

## Escalado
Si no se resuelve en 15 minutos: escalar a @backend-team-lead
```

---

## Application Performance Monitoring (APM)

### Application Insights en Azure

```csharp
// Instalación
// dotnet add package Microsoft.ApplicationInsights.AspNetCore

// Program.cs
builder.Services.AddApplicationInsightsTelemetry(options =>
{
    options.ConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
    
    // Sampling adaptativo: captura el 100% cuando hay poco tráfico,
    // reduce automáticamente cuando el tráfico es alto
    options.EnableAdaptiveSampling = true;
});
```

```csharp
// Telemetría personalizada con TelemetryClient
public class OrderService
{
    private readonly TelemetryClient _telemetry;

    public async Task<Order> CreateOrderAsync(CreateOrderCommand cmd)
    {
        var stopwatch = Stopwatch.StartNew();

        // Evento de negocio — aparece en "Custom Events" en App Insights
        _telemetry.TrackEvent("OrderCreated", new Dictionary<string, string>
        {
            ["CustomerId"] = cmd.CustomerId.ToString(),
            ["Region"]     = cmd.Region,
            ["PaymentMethod"] = cmd.PaymentMethod
        },
        new Dictionary<string, double>
        {
            ["OrderValue"]  = (double)cmd.TotalAmount,
            ["ItemCount"]   = cmd.Items.Count
        });

        // Métrica — aparece en "Custom Metrics"
        _telemetry.TrackMetric("Order.ProcessingTime", stopwatch.ElapsedMilliseconds);

        // Dependencia externa — aparece en "Dependencies" y en el mapa de aplicación
        var dep = new DependencyTelemetry
        {
            Name = "InventoryService.Reserve",
            Type = "HTTP",
            Target = "inventory-service",
            Success = true,
            Duration = TimeSpan.FromMilliseconds(45)
        };
        _telemetry.TrackDependency(dep);
    }
}
```

### Sampling — por qué no capturar el 100%

| Escenario | Tráfico | % Capturar | Razonamiento |
|-----------|---------|------------|--------------|
| Desarrollo | Bajo | 100% | Queremos ver todo |
| Producción (bajo tráfico) | < 1 RPS | 100% | El coste es asumible |
| Producción (alto tráfico) | > 100 RPS | 5-20% | Coste de almacenamiento y procesamiento |
| Producción (muy alto) | > 1000 RPS | 1-5% | Aún representativo estadísticamente |

```csharp
// Sampling fijo: capturar exactamente el X%
builder.Services.Configure<TelemetryConfiguration>(config =>
{
    config.DefaultTelemetrySink.TelemetryProcessorChainBuilder
        .UseAdaptiveSampling(maxTelemetryItemsPerSecond: 5)  // max 5 items/seg
        .Build();
});
```

> **Trade-off clave**: el sampling reduce el coste pero puede perder eventos raros e importantes (como un error que ocurre 1 vez cada 10.000 requests). Solución: **never sample errors** — siempre capturar el 100% de errores, hacer sampling solo del tráfico exitoso.

---

## Resumen de Herramientas por Pilar

| Pilar | Self-hosted | Cloud |
|-------|-------------|-------|
| Logs | Seq + Serilog | Azure Monitor, Datadog Logs |
| Métricas | Prometheus + Grafana | Azure Monitor Metrics, Datadog |
| Trazas | Jaeger, Zipkin, Tempo | Azure App Insights, Datadog APM |
| Todo en uno | Grafana Stack (Loki+Tempo+Mimir) | Datadog, New Relic, Dynatrace |
