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

