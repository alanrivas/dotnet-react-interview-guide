---
title: "☁️ Feature Flags, App Insights, KEDA y Multi-región"
sidebar_position: 1
---

# ☁️ Feature Flags, App Insights, KEDA y Multi-región

## Feature Flags con Azure App Configuration

Feature flags permiten activar/desactivar funcionalidad sin redeploy. Esencial para trunk-based development y despliegues controlados.

```csharp
// dotnet add package Microsoft.FeatureManagement.AspNetCore
// dotnet add package Microsoft.Extensions.Configuration.AzureAppConfiguration

// Program.cs
builder.Configuration.AddAzureAppConfiguration(options =>
{
    options.Connect(builder.Configuration["AppConfig:ConnectionString"])
           .UseFeatureFlags(ff => ff.CacheExpirationInterval = TimeSpan.FromMinutes(5));
});

builder.Services.AddAzureAppConfiguration();
builder.Services.AddFeatureManagement()
    .AddFeatureFilter<PercentageFilter>()     // Rollout gradual por %
    .AddFeatureFilter<TargetingFilter>()      // Por usuario/grupo específico
    .AddFeatureFilter<TimeWindowFilter>();    // Activo solo en ventana de tiempo

app.UseAzureAppConfiguration(); // Actualiza flags periódicamente sin restart

// Uso en código:
public class PedidoService
{
    private readonly IFeatureManager _features;

    public async Task<PedidoResult> CrearPedidoAsync(CrearPedidoDto dto)
    {
        // Activar nuevo flujo de pago solo para ciertos usuarios
        if (await _features.IsEnabledAsync("NuevoFlujoPago"))
            return await _nuevoProcesador.ProcesarAsync(dto);

        return await _procesadorLegacy.ProcesarAsync(dto);
    }
}

// Uso en controller — deshabilitar endpoint completo con feature flag
[HttpGet("nueva-funcionalidad")]
[FeatureGate("NuevaFuncionalidad")]  // Devuelve 404 si el flag está OFF
public IActionResult NuevaFuncionalidad() => Ok("Nuevo feature activo");
```

### Definición de flags en Azure App Configuration

```json
// En el portal Azure App Configuration → Feature Manager
{
  "id": "NuevoFlujoPago",
  "description": "Nuevo procesador de pagos v2",
  "enabled": true,
  "conditions": {
    "client_filters": [
      {
        "name": "Microsoft.Targeting",
        "parameters": {
          "Audience": {
            "Users": ["ana@empresa.com"],         // usuarios específicos
            "Groups": [{ "Name": "BetaTesters", "RolloutPercentage": 100 }],
            "DefaultRolloutPercentage": 10        // 10% del resto de usuarios
          }
        }
      }
    ]
  }
}
```

---

## Application Insights — Telemetría avanzada

```csharp
// Program.cs
builder.Services.AddApplicationInsightsTelemetry(options =>
{
    options.ConnectionString = builder.Configuration["ApplicationInsights:ConnectionString"];
    options.EnableAdaptiveSampling = true;          // No registrar el 100% en prod
    options.EnableDependencyTrackingTelemetryModule = true;
    options.EnableRequestTrackingTelemetryModule = true;
});

// Telemetría personalizada
public class PedidoService
{
    private readonly TelemetryClient _telemetry;

    public async Task<Pedido> CrearAsync(CrearPedidoDto dto)
    {
        var startTime = DateTime.UtcNow;
        var stopwatch = Stopwatch.StartNew();

        try
        {
            var pedido = await _repo.CrearAsync(dto);

            // Evento personalizado
            _telemetry.TrackEvent("PedidoCreado", new Dictionary<string, string>
            {
                ["PedidoId"]  = pedido.Id.ToString(),
                ["Canal"]     = dto.Canal,
                ["MetodoPago"]= dto.MetodoPago
            }, new Dictionary<string, double>
            {
                ["Total"]       = (double)pedido.Total,
                ["NumeroItems"] = pedido.Items.Count
            });

            // Métrica de negocio
            _telemetry.TrackMetric("pedido.total_usd", (double)pedido.Total);

            return pedido;
        }
        catch (Exception ex)
        {
            _telemetry.TrackException(ex, new Dictionary<string, string>
            {
                ["Operacion"] = "CrearPedido",
                ["UsuarioId"] = dto.UsuarioId.ToString()
            });
            throw;
        }
        finally
        {
            stopwatch.Stop();
            // Dependencia personalizada (ej: llamada a sistema externo)
            _telemetry.TrackDependency(
                dependencyTypeName: "InternalService",
                dependencyName:     "RepoCrear",
                data:               "INSERT Pedidos",
                startTime:          startTime,
                duration:           stopwatch.Elapsed,
                success:            true);
        }
    }
}
```

### KQL queries útiles en Application Insights

```kusto
// Latencia P95 por endpoint en las últimas 24h
requests
| where timestamp > ago(24h)
| summarize
    p50 = percentile(duration, 50),
    p95 = percentile(duration, 95),
    p99 = percentile(duration, 99),
    count = count()
  by name
| order by p95 desc
| take 20

// Tasa de errores por hora
requests
| where timestamp > ago(7d)
| summarize
    total = count(),
    errores = countif(resultCode >= "400")
  by bin(timestamp, 1h)
| extend error_rate = errores * 100.0 / total
| render timechart

// Excepciones más frecuentes
exceptions
| where timestamp > ago(24h)
| summarize count() by type, outerMessage
| order by count_ desc
| take 10

// Dependencias lentas (DB, HTTP calls)
dependencies
| where timestamp > ago(1h)
    and duration > 1000  // más de 1 segundo
| summarize avg_duration = avg(duration), count = count()
  by name, type
| order by avg_duration desc
```

---

## Estrategias de escalado — Auto-scale en Container Apps

```bicep
// Container Apps con scale rules en Bicep/ARM
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'mi-api'
  properties: {
    template: {
      scale: {
        minReplicas: 1      // Nunca baja de 1 (evita cold start)
        maxReplicas: 20
        rules: [
          {
            // Escalar por CPU
            name: 'cpu-rule'
            custom: {
              type: 'cpu'
              metadata: { utilizationPercentage: '70' }
            }
          }
          {
            // Escalar por longitud de cola de Service Bus
            name: 'servicebus-rule'
            custom: {
              type: 'azure-servicebus'
              metadata: {
                queueName:       'pedidos'
                messageCount:    '100'    // 1 réplica por cada 100 mensajes en cola
                connectionFromEnv: 'SERVICEBUS_CONN'
              }
            }
          }
          {
            // Escalar por HTTP requests/seg (KEDA HTTP Scaler)
            name: 'http-rule'
            http: {
              metadata: { concurrentRequests: '50' }
            }
          }
        ]
      }
    }
  }
}
```

---

## Multi-región y Alta Disponibilidad

```
ARQUITECTURA MULTI-REGIÓN ACTIVO-ACTIVO:

                    ┌──────────────────────────┐
Users ──────────→   │   Azure Front Door        │
(global)            │   - Global Load Balancer  │
                    │   - CDN integrado         │
                    │   - WAF (Web App Firewall)│
                    └─────────┬────────────────┘
                              │ Enruta al más cercano
                    ┌─────────┴──────────┐
                    ↓                    ↓
           ┌──────────────┐    ┌──────────────┐
           │ East US      │    │ West Europe  │
           │ App Service  │    │ App Service  │
           │ Azure SQL    │    │ Azure SQL    │
           │ (primary)    │    │ (geo-replica)│
           └──────────────┘    └──────────────┘
                    │ Geo-replication sync
                    └──────────────────────
```

### Azure Front Door — entrada global

```csharp
// Front Door gestiona:
// 1. Enrutamiento al backend más cercano (latencia mínima)
// 2. Failover automático si un región cae
// 3. CDN para assets estáticos
// 4. WAF para protección contra OWASP Top 10
// 5. TLS termination

// En el backend: verificar que el request viene de Front Door
// (para no exponer el origen directamente)
app.Use(async (context, next) =>
{
    // Solo aceptar tráfico de Front Door
    var fdHeader = context.Request.Headers["X-Azure-FDID"].ToString();
    if (!string.IsNullOrEmpty(fdHeader) && fdHeader != _config["FrontDoorId"])
    {
        context.Response.StatusCode = 403;
        return;
    }
    await next();
});
```

### Geo-replicación de Azure SQL

```csharp
// Connection string que usa la réplica de lectura automáticamente
// Agrega ApplicationIntent=ReadOnly para reads → va a la réplica
var connectionString = builder.Configuration["ConnectionStrings:Default"];
var readOnlyConnectionString = connectionString + ";ApplicationIntent=ReadOnly";

// Separar contextos para lectura y escritura
builder.Services.AddDbContext<WriteDbContext>(o =>
    o.UseSqlServer(connectionString));

builder.Services.AddDbContext<ReadDbContext>(o =>
    o.UseSqlServer(readOnlyConnectionString)
     .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking));

// Failover manual en caso de desastre (promueve réplica a primaria)
// az sql db replica set-primary --name MiDB --resource-group mi-rg
//   --server mi-servidor-westeurope
```

---

## Disaster Recovery: RTO y RPO

```
RTO (Recovery Time Objective): ¿Cuánto tiempo puede estar caído el sistema?
RPO (Recovery Point Objective): ¿Cuántos datos podemos perder?

Ejemplo:
  RTO = 1 hora   → el sistema debe estar operativo en menos de 1 hora tras un desastre
  RPO = 15 min   → no podemos perder más de 15 minutos de datos

Estrategias por costo/complejidad:

BACKUP & RESTORE (RTO: horas, RPO: horas)
  → Backups periódicos a Blob Storage. Simple y barato.
  → Inaceptable para apps de negocio crítico.

PILOT LIGHT (RTO: 15-30 min, RPO: minutos)
  → Infraestructura mínima en región secundaria (solo DB replicada).
  → Al fallar: provisionar los servidores y redirigir el tráfico.

WARM STANDBY (RTO: minutos, RPO: segundos)
  → Sistema completo en segunda región pero con menos capacidad.
  → Al fallar: escalar la segunda región y redirigir Front Door.

ACTIVE-ACTIVE (RTO: segundos, RPO: 0)
  → Ambas regiones sirven tráfico en todo momento.
  → Front Door redirige automáticamente si una región cae.
  → El más caro pero el más robusto.
```

### Runbook de failover (documentación operacional)

```markdown
## Failover Manual — East US → West Europe

### Trigger: East US API no responde > 5 minutos

1. Verificar en Azure Portal > Front Door > Health Probes que East US está DOWN
2. Verificar en Azure SQL > Mi-DB > Geo-Replication que West Europe está sync
3. Promover réplica a primaria:
   az sql db replica set-primary \
     --name MiDB --resource-group mi-rg-westeurope \
     --server mi-server-westeurope
4. Verificar en Front Door que el tráfico se redirige a West Europe
5. Crear incidente en sistema de alertas con hora de inicio del failover
6. Post-mortem obligatorio en las 48h posteriores
```

---

## Optimización de costos en Azure

```
Las tres palancas principales:

1. RIGHT-SIZING — usar el tamaño correcto
   → App Service: monitorear CPU/memoria, reducir si < 30% uso promedio
   → Azure SQL: revisar DTU/vCore usage en Query Performance Insight
   → VMs: usar Azure Advisor (detecta recursos sobredimensionados)

2. RESERVED INSTANCES — compromiso por 1-3 años
   → App Service Plan: hasta 55% de ahorro vs pay-as-you-go
   → Azure SQL: hasta 33% de ahorro
   → Solo para workloads estables (no para spikes)

3. SCALE-TO-ZERO — pagar solo cuando se usa
   → Azure Container Apps: 0 réplicas en inactividad
   → Azure Functions: consumption plan, pago por ejecución
   → Ideal para workloads intermitentes (batch jobs, dev environments)
```

```csharp
// Detectar costos anómalos con Azure Cost Management API
// O configurar alertas presupuestarias:

// Azure CLI: alerta cuando el gasto supera el 80% del presupuesto mensual
// az consumption budget create \
//   --amount 500 \
//   --budget-name "MiPresupuesto" \
//   --category Cost \
//   --time-grain Monthly \
//   --notifications '[{
//     "enabled": true,
//     "operator": "GreaterThan",
//     "threshold": 80,
//     "contactEmails": ["team@empresa.com"]
//   }]'
```

---

## Preguntas adicionales de entrevista 🎯

**5. ¿Qué son los feature flags y para qué sirven?**
> Son interruptores en runtime que activan/desactivan funcionalidad sin redeploy. Sirven para: trunk-based development (mergear código incompleto sin activarlo), canary releases (activar para el 10% de usuarios), A/B testing, y kill switches para apagar funciones con problemas en producción. En Azure: Azure App Configuration + Microsoft.FeatureManagement.

**6. ¿Cómo diseñarías una aplicación para resistir la caída de una región de Azure?**
> Arquitectura multi-región activo-activo: App Service o Container Apps desplegados en dos regiones, Azure SQL con geo-replication (activo-pasivo o activo-activo con Cosmos DB), Azure Front Door como balanceador global con health probes y failover automático. Definir RTO y RPO según el negocio: para sistemas críticos, activo-activo con RTO de segundos; para sistemas menos críticos, warm standby con RTO de minutos.

**7. ¿Cuál es la diferencia entre Azure Front Door y Application Gateway?**
> **Front Door**: balanceador global (Layer 7), CDN, WAF, opera a nivel de edge locations mundiales — ideal para apps con usuarios en múltiples regiones. **Application Gateway**: balanceador regional (Layer 7), WAF, opera dentro de una VNet — ideal para proteger apps dentro de una región, con routing basado en paths y SSL offloading. No son excluyentes: Front Door enfrente para distribución global + Application Gateway por región para seguridad interna.

**8. ¿Cómo implementarías un rollout gradual de un nuevo feature?**
> Con feature flags y targeting: 1) Deploy del código con el feature flag OFF. 2) Activar para el equipo interno (testing en producción real). 3) Activar para el 5% de usuarios aleatoriamente, monitorear métricas y errores. 4) Si estable, escalar a 25%, 50%, 100%. 5) Si hay problemas, apagar el flag sin redeploy. Esto es "progressive delivery" y elimina el big-bang release risk.
