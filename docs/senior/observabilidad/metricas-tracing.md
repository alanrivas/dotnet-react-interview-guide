---
title: "📊 Métricas y Distributed Tracing"
sidebar_position: 1
---

# 📊 Métricas y Distributed Tracing

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

