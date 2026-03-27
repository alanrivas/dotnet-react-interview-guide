---
title: "🚨 Health Checks, Alerting y APM"
sidebar_position: 2
---

# 🚨 Health Checks, Alerting y APM

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
