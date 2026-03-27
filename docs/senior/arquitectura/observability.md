---
id: observability
title: Observabilidad - Logging, Tracing, Metrics
sidebar_position: 11
---

# Observabilidad: Logging, Tracing, Metrics 📊

"You can't optimize what you can't see." Sin observabilidad, estás debug ciegos. Este documento enseña cómo implementar observabilidad según arquitectura.

---

## El Triángulo de Observabilidad

```
         OBSERVABILIDAD
        /      |      \
       /       |       \
   LOGS    TRACING    METRICS

LOGS: ¿Qué pasó? (WhatsApp de tu app)
TRACING: ¿Cómo fluyó? (El viaje del request)
METRICS: ¿Cómo está? (Pulso del sistema)
```

### Diferencias Clave

| Aspecto | Logs | Tracing | Metrics |
|---------|------|---------|---------|
| **Granulidad** | Individual events | Request journey | Agregados |
| **Volume** | Alto (GB/día) | Medio (100K/día típico) | Bajo (1000s/min) |
| **Latency** | Batch (ok 1s delay) | Real-time (< 100ms) | Real-time |
| **Espacio Almacenamiento** | Enorme | Grande | Pequeño |
| **Caso de Uso** | "¿Qué error ocurrió?" | "¿Por qué tomó 5s?" | "¿Está todo OK?" |

---

## 1️⃣ LOGGING

### Anatomía de un Log

```csharp
// ❌ MALO: Log sin estructura
public void ProcessOrder(Order order)
{
    logger.Log("Processing order");  // ¿Cuál order?
    try
    {
        var result = paymentService.Charge(order.Total);
        logger.Log("Order processed successfully");
    }
    catch (Exception ex)
    {
        logger.Log("Error: " + ex.Message);  // ¿En qué servicio?
    }
}

// ✅ BUENO: Log estructurado
public void ProcessOrder(Order order)
{
    logger.LogInformation("OrderProcessing started",
        orderId: order.Id,
        customerId: order.CustomerId,
        amount: order.Total,
        timestamp: DateTime.UtcNow
    );
    
    try
    {
        var result = paymentService.Charge(order.Total);
        logger.LogInformation("OrderProcessing completed",
            orderId: order.Id,
            status: "SUCCESS",
            transactionId: result.TransactionId,
            duration: stopwatch.ElapsedMilliseconds
        );
    }
    catch (PaymentGatewayException ex)
    {
        logger.LogError(ex, "OrderProcessing failed - payment error",
            orderId: order.Id,
            errorCode: ex.ErrorCode,
            severity: "HIGH",
            retryable: ex.IsRetryable
        );
    }
}
```

### Niveles de Log Correctos

```
TRACE:   Hyper-detailed (desarrollador debugging)
         "Entering method ProcessOrder"

DEBUG:   Development info
         "Loaded 100 products from cache"

INFO:    Business events
         "Order 12345 created"
         "Payment processed"

WARN:    Something unexpected, pero recoverable
         "Retry attempt 3 of 5 for payment"
         "Cache miss for product 999"

ERROR:   Something broke, pero app sigue viva
         "Could not reach payment service"
         "Database connection timeout"

CRITICAL: App is dying / losing data
          "Out of memory"
          "Database corrupted"
```

### Structured Logging con Serilog

```csharp
// Setup
var logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/app.txt", rollingInterval: RollingInterval.Day)
    .WriteTo.Seq("http://localhost:5341")  // Centralized logging
    .Enrich.WithProperty("Service", "OrderService")
    .Enrich.WithProperty("Environment", "Production")
    .CreateLogger();

// Uso
logger.Information("Order created: {@Order}", order);
// Output: 
// {
//   "Timestamp": "2026-03-27T10:30:00Z",
//   "Level": "Information",
//   "Service": "OrderService",
//   "Message": "Order created",
//   "Order": { "Id": "123", "Total": 99.99 }
// }

// Context
using (LogContext.PushProperty("OrderId", order.Id))
using (LogContext.PushProperty("CustomerId", order.CustomerId))
{
    logger.Information("Processing order");
    // Este log incluye OrderId y CustomerId automáticamente
}
```

### Estrategia de Logging por Arquitectura

#### MONOLITO
```
├─ Log TODO (verbose)
├─ Diferencia clara entre módulos
│  └─ [Orders] - log prefijo "ORD"
│  └─ [Inventory] - log prefijo "INV"
├─ Centralizado pero simple (Serilog + file)
└─ Archivos rotados diarios
```

#### MICROSERVICIOS
```
├─ Cada servicio loga con su nombre
│  └─ orders-service logs: [ORDERS]
│  └─ payments-service logs: [PAYMENTS]
├─ CORRELACIÓN: Use CorrelationId
│  └─ Request entra → genera ID único
│  └─ Ese ID pasa entre servicios
│  └─ Buscar CorrelationId = ver todo el flujo
├─ Centralizado obligatorio
│  └─ ELK (Elasticsearch + Logstash + Kibana)
│  └─ O Datadog, Splunk, etc.
└─ Structured logging (JSON)
```

#### EVENT-DRIVEN
```
├─ Log eventos publicados/consumidos
│  └─ OrderCreatedEvent published by OrderService
│  └─ OrderCreatedEvent consumed by InventoryService
├─ Dead letters: Eventos que fallaron
│  └─ InventoryService no puede consumir OrderCreated
│  └─ Log importante para debugging
├─ Latency: Qué tan rápido se procesa
│  └─ Event published 10:00:00
│  └─ Event consumed 10:00:05
│  └─ Lag: 5 segundos (aceptable?)
└─ Correlación crítica
```

### Buscar en Logs: Kibana/Splunk

```
// Buscar todas las órdenes fallidas en la última hora
level: "ERROR" AND service: "OrderService" AND time: [now-1h]

// Buscar todas las transacciones de un cliente
correlationId: "abc123" AND customerId: "cust_999"

// Buscar errores en un rango de tiempo
level: "ERROR" AND time: [2026-03-27T10:00 TO 2026-03-27T11:00]

// Buscar con patrón
message: "timeout" OR message: "connection refused"
```

---

## 2️⃣ TRACING (Distributed Tracing)

Cuando un request fluye por 5 microservicios, ¿cómo sabes dónde se lentifica?

### Anatomía de un Trace

```
REQUEST: User clicks "Create Order"
├─ 2026-03-27 10:00:00.000
├─ TraceId: "abc123xyz" (único para todo el request)
│
├─ SPAN 1: API Gateway
│  ├─ Operation: "POST /orders"
│  ├─ Duration: 50ms
│  └─ Status: Success
│
├─ SPAN 2: OrderService.CreateOrder
│  ├─ Operation: "CreateOrder"
│  ├─ Duration: 100ms
│  ├─ Tags: {"customerId": "cust_5", "amount": 99.99}
│  └─ Child spans:
│     │
│     ├─ SPAN 2.1: OrderRepository.Save
│     │  ├─ Operation: "SaveAsync"
│     │  ├─ Duration: 25ms
│     │  └─ Status: Success
│     │
│     └─ SPAN 2.2: EventPublisher.Publish (async)
│        ├─ Operation: "PublishOrderCreatedEvent"
│        ├─ Duration: 20ms
│        └─ Status: Success
│
├─ SPAN 3: PaymentService.ProcessPayment
│  ├─ Operation: "ProcessAsync"
│  ├─ Duration: 800ms ← BOTTLENECK!
│  ├─ Tags: {"gateway": "Stripe", "amount": 99.99}
│  └─ Child spans:
│     │
│     └─ SPAN 3.1: Stripe API call
│        ├─ Operation: "POST https://api.stripe.com/charges"
│        ├─ Duration: 750ms
│        ├─ StatusCode: 200
│        └─ Tags: {"retries": 0, "endpoint": "production"}
│
├─ SPAN 4: InventoryService.ReserveStock
│  ├─ Operation: "ReserveAsync"
│  ├─ Duration: 45ms
│  └─ Status: Success
│
└─ TOTAL LATENCY: 995ms

CONCLUSIÓN: PaymentService es el cuello de botella (800ms de 995ms)
```

### Implementar Distributed Tracing

```csharp
// Configuración con OpenTelemetry
public class Program
{
    public static void Main()
    {
        var builder = WebApplication.CreateBuilder();
        
        // Add OpenTelemetry
        var tracingOtlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"];
        
        builder.Services
            .AddOpenTelemetry()
            .WithTracing(tracingBuilder =>
            {
                tracingBuilder
                    .AddAspNetCoreInstrumentation()      // HTTP requests
                    .AddEntityFrameworkCoreInstrumentation() // DB queries
                    .AddHttpClientInstrumentation()      // Outgoing HTTP
                    .AddOtlpExporter(opts =>
                    {
                        opts.Endpoint = new Uri(tracingOtlpEndpoint);
                    });
            });
        
        var app = builder.Build();
        app.MapControllers();
        app.Run();
    }
}

// USO: Automático gracias a instrumentación
[HttpPost("/orders")]
public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
{
    // OpenTelemetry automáticamente:
    // 1. Crea span "POST /orders"
    // 2. Captura timing
    // 3. Logs status code
    // 4. Pasa TraceId a servicios downstream
    
    var order = await _orderService.CreateOrderAsync(dto);
    return Ok(order);
}

// En OrderService (otro servicio)
public async Task<Order> CreateOrderAsync(CreateOrderDto dto)
{
    using var activity = Activity.StartActivity("CreateOrder");
    activity?.SetTag("customerId", dto.CustomerId);
    activity?.SetTag("amount", dto.Total);
    
    var order = await _repository.SaveAsync(new Order { ... });
    
    // OpenTelemetry automáticamente vincula este span con el parent
    // porque TraceId llegó en el header HTTP
    
    return order;
}

// En el llamado a servicio externo
public async Task<PaymentResult> ProcessPaymentAsync(Order order)
{
    using var activity = Activity.StartActivity("ProcessPayment");
    
    try
    {
        var response = await _httpClient.PostAsJsonAsync(
            "http://payments-service/api/payments",
            new { orderId = order.Id, amount = order.Total }
        );
        
        activity?.SetStatus(ActivityStatusCode.Ok);
        return await response.Content.ReadAsAsync<PaymentResult>();
    }
    catch (HttpRequestException ex)
    {
        activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
        throw;
    }
}
```

### Herramientas de Tracing

| Herramienta | Dónde | Ventajas |
|------------|-------|----------|
| **Jaeger** | Self-hosted | Open source, escalable |
| **Zipkin** | Self-hosted | Visualización clara |
| **Datadog** | Cloud | Poderoso, integración completa |
| **New Relic** | Cloud | UI intuitiva |
| **Honeycomb** | Cloud | Queries muy poderosas |

### Visualización en Jaeger

```
┌─ POST /orders → 995ms
│  ├─ OrderService.CreateOrder → 100ms
│  │  ├─ OrderRepository.Save → 25ms ✅
│  │  └─ EventPublisher.Publish → 20ms ✅
│  │
│  ├─ PaymentService.ProcessPayment → 800ms ⚠️ SLOW
│  │  └─ Stripe API call → 750ms
│  │     └─ Network latency + processing
│  │
│  └─ InventoryService.ReserveStock → 45ms ✅

Acción: Que PaymentService cachee respuestas, use async, etc.
```

---

## 3️⃣ METRICS (Monitoreo)

¿Cómo está tu app AHORA? Metrics responden.

### Tipos de Metrics

```
COUNTER: "Cuántos total?" (no baja, siempre sube)
├─ Requests totales: 1,234,567
├─ Errores totales: 345
├─ Órdenes procesadas: 789

GAUGE: "Cuál es el valor?" (puede subir o bajar)
├─ Requests activos AHORA: 42
├─ Memory usage: 512 MB
├─ DB connections in pool: 10

HISTOGRAM: "Distribución de valores?"
├─ Latencia requests: [10ms, 50ms, 100ms, 500ms, 1000ms, ...]
├─ Tamaño de órdenes: [<50, 50-100, 100-500, >500]

SUMMARY: Como histogram pero agrupado
├─ p50 latencia: 45ms
├─ p95 latencia: 200ms
├─ p99 latencia: 800ms
```

### Implementar Metrics con Prometheus

```csharp
// Setup
public class Program
{
    public static void Main()
    {
        var builder = WebApplication.CreateBuilder();
        
        // Prometheus
        builder.Services.AddOpenTelemetry()
            .WithMetrics(meterProvider =>
            {
                meterProvider
                    .AddAspNetCoreInstrumentation()
                    .AddRuntimeInstrumentation()
                    .AddHttpClientInstrumentation()
                    .AddOtlpExporter();
            });
        
        var app = builder.Build();
        
        // Endpoint para Prometheus scrape
        app.MapPrometheusScrapingEndpoint();
        
        app.Run();
    }
}

// Métricas personalizadas
public class OrderService
{
    private static readonly Counter OrdersCreated = 
        Counter.Create("orders_created_total", "Total orders created");
    
    private static readonly Histogram OrderProcessingTime =
        Histogram.Create("order_processing_duration_seconds", 
            "Order processing time in seconds");
    
    private static readonly Gauge ActiveOrders =
        Gauge.Create("orders_active", "Active orders being processed");
    
    public async Task<Order> CreateOrderAsync(CreateOrderDto dto)
    {
        ActiveOrders.Inc();
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var order = await _repository.SaveAsync(new Order { ... });
            
            OrdersCreated.Inc();  // Counter++
            OrderProcessingTime.Observe(stopwatch.Elapsed.TotalSeconds);
            
            return order;
        }
        finally
        {
            ActiveOrders.Dec();
        }
    }
}
```

### Formato Prometheus

```
# HELP orders_created_total Total orders created
# TYPE orders_created_total counter
orders_created_total 1234

# HELP order_processing_duration_seconds Order processing time in seconds
# TYPE order_processing_duration_seconds histogram
order_processing_duration_seconds_bucket{le="0.01"} 0
order_processing_duration_seconds_bucket{le="0.1"} 50
order_processing_duration_seconds_bucket{le="1"} 200
order_processing_duration_seconds_bucket{le="10"} 1200
order_processing_duration_seconds_count 1234
order_processing_duration_seconds_sum 5678.9

# HELP orders_active Active orders being processed
# TYPE orders_active gauge
orders_active 42
```

### Dashboards Comunes

```
┌─────────────────────────────────────────┐
│ SYSTEM HEALTH DASHBOARD                 │
├─────────────────────────────────────────┤
│                                         │
│  Requests/sec: 1234 ▄▄▃▂               │
│  Errors/sec: 3 ▁▂▁▂▁▂                  │
│  p95 Latency: 200ms ▃▄▆▇▅              │
│  CPU: 45% ████░                        │
│  Memory: 2.1GB / 4GB ███░              │
│  DB Connections: 42 / 100              │
│                                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ APPLICATION METRICS                     │
├─────────────────────────────────────────┤
│                                         │
│  Orders Created: 12,345                │
│  Active Orders: 42                     │
│  Processing Time (avg): 150ms          │
│  Cache Hit Rate: 92%                   │
│  DB Query Time (p95): 50ms             │
│                                         │
└─────────────────────────────────────────┘
```

### Alertas Basadas en Metrics

```yaml
# Prometheus Alert Rules
groups:
  - name: application_alerts
    rules:
      # Alert 1: High Error Rate
      - alert: HighErrorRate
        expr: |
          (rate(http_requests_total{status=~"5.."}[5m]) / 
           rate(http_requests_total[5m])) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected (>5%)"
          
      # Alert 2: Slow Request Latency
      - alert: SlowLatency
        expr: histogram_quantile(0.95, http_request_duration[5m]) > 1
        for: 5m
        annotations:
          summary: "p95 latency > 1s"
          
      # Alert 3: Out of Memory
      - alert: OutOfMemory
        expr: |
          (container_memory_usage_bytes{container="app"} / 
           container_spec_memory_limit_bytes) > 0.9
        for: 2m
        annotations:
          summary: "Memory usage > 90%"

# Notify to Slack when alert fires
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# slack_configs:
#   - api_url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
#     channel: '#alerts'
```

---

## 4️⃣ Observabilidad por Arquitectura

### MONOLITO

```
LOGGING:
├─ Centralizado pero simple
├─ Log level: DEBUG en dev, INFO en prod
├─ Contexto claro (módulo, usuario, request)
└─ Serilog + arquivo rotado

TRACING:
├─ Simple, corto
├─ Un servicio = un trace short
├─ No complejo, but identificar latency

METRICS:
├─ Básicas: Requests, Errors, Latency
├─ Response time por endpoint
├─ DB query time
└─ Dashboard simple

HERRAMIENTAS:
├─ Logging: Serilog + Seq (self-hosted)
├─ Tracing: Jaeger (self-hosted)
└─ Metrics: Prometheus + Grafana
```

### MICROSERVICIOS

```
LOGGING:
├─ Distributed logging OBLIGATORIO
├─ Cada servicio loga con ID correlación
├─ Centralizado: ELK, Splunk, o Datadog
├─ Búsqueda por correlationId = full flow
└─ Structured JSON

TRACING:
├─ Obligatorio distribuido
├─ Cada servicio passa headers (TraceId, SpanId)
├─ Tool: Jaeger, Zipkin, o Datadog
├─ Identificar cual servicio es bottleneck
└─ per-service tracing

METRICS:
├─ Por servicio (scrape individual)
├─ Agregadas globalmente
├─ Service-to-service latency
├─ Error rates por servicio
├─ Resource usage (CPU, memory, DB)
└─ Circuit breaker state

HERRAMIENTAS:
├─ Logging: ELK o Datadog
├─ Tracing: Jaeger o Datadog
└─ Metrics: Prometheus + Grafana + AlertManager
```

### EVENT-DRIVEN

```
LOGGING:
├─ Log event published/consumed
├─ Log event failures (dead letters)
├─ Log processing lag
├─ Structured: incluir event type, handler, timestamp
└─ Centralizado obligatorio

TRACING:
├─ TraceId en evento
├─ Cada handler tiene su span
├─ Identificar slow handlers
├─ Lag visible en traces

METRICS:
├─ Event lag (cuánto retraso en consumo)
├─ Messages processed per handler
├─ Failed message rate
├─ Queue depth
├─ Dead letter count
└─ Processing time distribution (histogram)

EJEMPLO:
metric_name: "kafka_consumer_lag"
labels: {topic: "orders", partition: 0, consumer_group: "inventory-service"}
value: 150  ← 150 mensajes sin procesar
```

---

## 5️⃣ Red Flags: Indicadores de Problemas

### ❌ Logging Red Flags

```
🚩 Logs sin timestamp
   "Order created" (¿cuándo?)

🚩 Logs sin contexto
   "Error occurred" (¿dónde?, ¿qué orden?)

🚩 Logs sin estructura (JSON)
   "Order: 123, Total: $99.99" (no queryable)

🚩 Logs inconsistentes
   Algunos logs tienen "orderId", otros "order_id"

🚩 Demasiados logs
   Log EVERYTHING = búsqueda es lentísima

🚩 Muy pocos logs
   ¿Qué pasó anoche? "No idea"
```

### 🚨 Metric Red Flags

```
🚩 Métrica rising steadily
   Memory: 100MB → 500MB → 2GB (memory leak?)

🚩 Métrica inconsistent con realidad
   Dashboard says 0 errors, pero users reportan isues

🚩 No tienes métrica para algo importan
   "Qué tan muchos users activos?"
   "Cómo está el cache hit rate?"

🚩 Alerts constant false positives
   Todo alarma, nadie lo mira
```

### 🔍 Trace Red Flags

```
🚩 Trace con missing spans
   Request empieza en API Gateway, pero no hay trace hasta DB

🚩 Latency spike sin causa visible
   p95 latency de 50ms → 500ms (qué cambió?)

🚩 No hay correlation entre servicios
   No puedes seguir un request end-to-end

🚩 Traces no muestran errores
   ¿Cómo sé que falló si todo es green?
```

---

## 📊 Checklist: Observabilidad Producción-Ready

### Logging

- [ ] Structured logging (JSON fields, not strings)
- [ ] Centralized log aggregation (ELK, Datadog, etc)
- [ ] Searchable: by timestamp, level, service, customerId, etc
- [ ] Log retention policy (30 days? 90 days?)
- [ ] Alert on ERROR/CRITICAL logs
- [ ] CorrelationId en todos los logs (para seguir request)

### Tracing

- [ ] Distributed tracing setup (Jaeger, Zipkin, etc)
- [ ] Every service passes TraceId header
- [ ] Every HTTP call tracked automatically
- [ ] Database queries tracked (duration, query)
- [ ] Can identify bottlenecks (p95, p99 latency)
- [ ] Alerts on latency SLA violation

### Metrics

- [ ] Prometheus + Grafana (o similar)
- [ ] Metrics: Requests, Errors, Latency
- [ ] Per-service metrics
- [ ] Resource metrics: CPU, Memory, Disk, Network
- [ ] Alert on: Error rate > 5%, Latency > SLA, CPU > 80%
- [ ] Dashboard visible to team (no "hidden" metrics)

### Operational Readiness

- [ ] On-call guide para interpretar metrics/logs
- [ ] Runbook para common issues
- [ ] Team trained en herramientas (Kibana, Grafana, etc)
- [ ] Regular review: "¿Qué metrics necesitamos que no tenemos?"
- [ ] Alert fatigue mitigation (no 1000 alerts)

---

## 🎓 Preguntas en Entrevistas

1. **"How would you debug a slow payment request in microservices?"**
   - R: Distributed tracing, correlation ID, service latency breakdown

2. **"What metrics would you monitor for an ecommerce platform?"**
   - R: Checkout success rate, payment failure rate, cart abandonment, inventory updates

3. **"How do you track a request through 5 microservices?"**
   - R: TraceId in headers, distributed tracing tool (Jaeger), span per service

4. **"You're getting alerts about high memory, but app seems fine. Why?"**
   - R: Memory leak? Memory spike? Need to look at trend over time, not just current value

5. **"Design observability for a real-time system like Uber."**
   - R: Low-latency metrics, event lag monitoring, driver location tracking metrics

---

## 🏁 Resumen

```
OBSERVABILIDAD = Visibilidad + Acción

LOGS    → "¿Qué pasó?" (debugging)
TRACES  → "¿Cómo fluyó?" (latency analysis)
METRICS → "¿Cómo está?" (health monitoring)

SIN OBSERVABILIDAD: Debugging en la oscuridad
CON OBSERVABILIDAD: "Ahhh, ahora veo el problema"
```

---

**Última actualización:** 2026-03-27  
**Dificultad:** 🔴 Senior
