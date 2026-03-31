---
id: serilog-logging
title: Serilog & Structured Logging
sidebar_position: 28
---

# Serilog & Structured Logging 🟡

Serilog es el estándar de facto para logging en .NET. La diferencia clave frente al `ILogger` básico es el **structured logging**: en lugar de texto plano, los logs son objetos con propiedades consultables. En producción, esto es lo que permite buscar, filtrar y correlacionar logs de forma efectiva.

---

## Logging de texto vs structured logging

```csharp
// ❌ Log de texto plano — solo es un string
_logger.LogInformation($"Pedido {pedidoId} creado por usuario {userId} por ${monto}");
// Salida: "Pedido 1234 creado por usuario 99 por $150"
// Para buscar todos los pedidos del usuario 99 → necesitas regex sobre texto

// ✅ Structured log — propiedades indexables
_logger.LogInformation(
    "Pedido {PedidoId} creado por usuario {UserId} por {Monto:C}",
    pedidoId, userId, monto);
// Salida JSON: { "PedidoId": 1234, "UserId": 99, "Monto": 150.0, "Message": "..." }
// Para buscar todos los pedidos del usuario 99 → query: UserId = 99
```

La diferencia en producción:
- **Texto plano**: cuando hay un incidente, buscas con grep/regex en megas de logs
- **Structured**: buscas `PedidoId = 1234 AND Level = Error` en Seq, Elastic o Application Insights

---

## Setup de Serilog en .NET 8

```bash
dotnet add package Serilog.AspNetCore
dotnet add package Serilog.Sinks.Console
dotnet add package Serilog.Sinks.File
dotnet add package Serilog.Sinks.Seq          # Dashboard local de logs
dotnet add package Serilog.Enrichers.Environment
dotnet add package Serilog.Enrichers.Thread
dotnet add package Serilog.Enrichers.Process
```

```csharp
// Program.cs — configuración completa
using Serilog;
using Serilog.Events;

// Configurar Serilog ANTES de construir el host
// Así captura errores del propio startup
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .MinimumLevel.Override("System", LogEventLevel.Warning)
    .Enrich.FromLogContext()                    // Permite agregar propiedades dinámicas
    .Enrich.WithEnvironmentName()              // Agrega "EnvironmentName" al log
    .Enrich.WithMachineName()                  // Agrega "MachineName"
    .Enrich.WithThreadId()                     // Agrega "ThreadId"
    .WriteTo.Console(outputTemplate:
        "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File(
        path: "logs/app-.log",
        rollingInterval: RollingInterval.Day,   // Un archivo por día
        retainedFileCountLimit: 7,              // Guardar 7 días
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.Seq("http://localhost:5341")       // Dashboard de logs (desarrollo)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Reemplazar el logger de .NET con Serilog
builder.Host.UseSerilog();

var app = builder.Build();

// Log de cada request HTTP (reemplaza el middleware de logging de .NET)
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate =
        "HTTP {RequestMethod} {RequestPath} respondió {StatusCode} en {Elapsed:0.0000}ms";

    // Agregar propiedades adicionales al log del request
    options.EnricherForRequest = (diagnosticContext, httpContext) =>
    {
        diagnosticContext.Set("RequestHost", httpContext.Request.Host.Value);
        diagnosticContext.Set("UserAgent", httpContext.Request.Headers["User-Agent"]);
        diagnosticContext.Set("UserId", httpContext.User.FindFirst("sub")?.Value);
    };
});

try
{
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "La aplicación terminó de forma inesperada");
}
finally
{
    Log.CloseAndFlush();  // Importante: vaciar el buffer antes de cerrar
}
```

---

## Configuración por appsettings.json

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.EntityFrameworkCore": "Warning",
        "System": "Warning"
      }
    },
    "WriteTo": [
      {
        "Name": "Console",
        "Args": {
          "outputTemplate": "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}"
        }
      },
      {
        "Name": "File",
        "Args": {
          "path": "logs/app-.log",
          "rollingInterval": "Day"
        }
      }
    ],
    "Enrich": ["FromLogContext", "WithMachineName", "WithThreadId"]
  }
}
```

```csharp
// Leer config de appsettings.json
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .CreateLogger();
```

---

## LogContext — agregar propiedades dinámicas

```csharp
// ✅ Agregar propiedades a todos los logs dentro de un bloque
using (LogContext.PushProperty("PedidoId", pedidoId))
using (LogContext.PushProperty("UserId", userId))
{
    _logger.LogInformation("Iniciando procesamiento");
    await ValidarPedidoAsync();
    await ProcesarPagoAsync();
    _logger.LogInformation("Procesamiento completado");
    // Todos estos logs tienen PedidoId y UserId como propiedades
}

// ✅ En un middleware — agregar CorrelationId a TODOS los logs del request
public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context)
    {
        // Obtener o generar CorrelationId
        var correlationId = context.Request.Headers["X-Correlation-Id"].FirstOrDefault()
                            ?? Guid.NewGuid().ToString("N")[..8];

        // Agregar al response header
        context.Response.Headers["X-Correlation-Id"] = correlationId;

        // Agregar a TODOS los logs del request mediante LogContext
        using (LogContext.PushProperty("CorrelationId", correlationId))
        {
            await _next(context);
        }
    }
}

// Registrar en Program.cs (ANTES de UseSerilogRequestLogging)
app.UseMiddleware<CorrelationIdMiddleware>();
```

---

## Niveles de log — cuándo usar cada uno

```csharp
// Verbose — máximo detalle, solo en debugging profundo
_logger.LogTrace("Entrando a ValidarPedido con dto: {@Dto}", dto);

// Debug — información útil en desarrollo, off en producción
_logger.LogDebug("Cache miss para key {CacheKey}", cacheKey);

// Information — flujo normal de la app, lo que quieres ver en prod
_logger.LogInformation("Pedido {PedidoId} creado exitosamente", pedidoId);

// Warning — algo inesperado pero la app sigue funcionando
_logger.LogWarning("Reintento {Attempt}/3 para servicio externo {Servicio}", attempt, servicio);

// Error — falló una operación, requiere atención
_logger.LogError(ex, "Error procesando pedido {PedidoId}", pedidoId);

// Fatal / Critical — la app está a punto de caer o ya cayó
_logger.LogCritical(ex, "No se pudo conectar a la base de datos al iniciar");
```

```
Configuración típica por ambiente:
  Desarrollo:  Verbose o Debug — ver todo
  Staging:     Information — solo flujo normal + warnings
  Producción:  Warning — solo lo que requiere atención
               (Exception: tracing selectivo con Sampling)
```

---

## Destructuring — loguear objetos

```csharp
// @ — destructura el objeto en propiedades individuales
_logger.LogInformation("Pedido creado: {@Pedido}", pedido);
// Salida: { "Pedido": { "Id": 1, "Monto": 150, "Estado": "Pendiente" } }

// $ — serializa como string (toString)
_logger.LogInformation("Pedido creado: {$Pedido}", pedido);
// Salida: { "Pedido": "MiApp.Models.Pedido" } — menos útil

// Sin prefijo — tipo primitivo o string
_logger.LogInformation("Usuario {UserId} logueado", userId);

// ⚠️ Cuidado con datos sensibles
_logger.LogInformation("Pago procesado: {@Tarjeta}", tarjeta);
// ❌ Puede loguear número de tarjeta y CVV

// ✅ Usar destructuring con control o anonimizar
_logger.LogInformation("Pago procesado para tarjeta terminada en {UltimosDigitos}",
    tarjeta.Numero[^4..]);
```

---

## Sinks — dónde van los logs

```csharp
// ✅ Seq — dashboard web local, ideal para desarrollo
// dotnet add package Serilog.Sinks.Seq
.WriteTo.Seq("http://localhost:5341")
// docker run -e ACCEPT_EULA=Y -p 5341:80 datalust/seq

// ✅ Application Insights — Azure
// dotnet add package Serilog.Sinks.ApplicationInsights
.WriteTo.ApplicationInsights(
    TelemetryConfiguration.Active,
    TelemetryConverter.Traces)

// ✅ Elasticsearch
// dotnet add package Serilog.Sinks.Elasticsearch
.WriteTo.Elasticsearch(new ElasticsearchSinkOptions(new Uri("http://localhost:9200"))
{
    IndexFormat = "mi-app-{0:yyyy.MM.dd}",
    AutoRegisterTemplate = true
})

// ✅ Async sink — no bloquear el thread principal al escribir logs
// dotnet add package Serilog.Sinks.Async
.WriteTo.Async(a => a.File("logs/app-.log", rollingInterval: RollingInterval.Day))
```

---

## Correlation ID en microservicios

En sistemas distribuidos, el Correlation ID permite rastrear un request a través de múltiples servicios:

```csharp
// ✅ Propagar CorrelationId entre servicios via HttpClient
public class CorrelationIdHandler : DelegatingHandler
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CorrelationIdHandler(IHttpContextAccessor accessor)
    {
        _httpContextAccessor = accessor;
    }

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        // Leer CorrelationId del request actual y pasarlo al servicio externo
        var correlationId = _httpContextAccessor.HttpContext?
            .Response.Headers["X-Correlation-Id"].FirstOrDefault()
            ?? Guid.NewGuid().ToString("N")[..8];

        request.Headers.Add("X-Correlation-Id", correlationId);

        return await base.SendAsync(request, cancellationToken);
    }
}

// Registrar como handler de HttpClient
builder.Services.AddTransient<CorrelationIdHandler>();
builder.Services.AddHttpClient<IInventarioClient, InventarioClient>()
    .AddHttpMessageHandler<CorrelationIdHandler>();
```

```
Con CorrelationId propagado:
  Request usuario → API Gateway (CorrelationId: abc123)
    → Orders Service  (log: CorrelationId=abc123)
    → Inventory Service (log: CorrelationId=abc123)
    → Payment Service (log: CorrelationId=abc123)

Cuando falla el pago:
  Buscar CorrelationId=abc123 → ves el journey completo del request
  en todos los servicios, en orden cronológico
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre logging de texto y structured logging?**
> En texto plano, el log es un string: "Pedido 123 creado por usuario 99". En structured logging, el log es un objeto con propiedades: `{ PedidoId: 123, UserId: 99 }`. La diferencia en producción es enorme: con structured logging puedes hacer queries como `PedidoId = 123 AND Level = Error` en Seq o Elastic en milisegundos. Con texto plano necesitas grep sobre gigabytes de archivos.

**2. ¿Por qué usas `{PedidoId}` en lugar de interpolación `$"{pedidoId}"`?**
> Con interpolación (`$"Pedido {pedidoId}"`) el mensaje ya es un string — Serilog no puede extraer la propiedad `PedidoId` por separado. Con el template (`"Pedido {PedidoId}"`) Serilog captura el valor como propiedad tipada en el LogEvent, además del mensaje formateado. La propiedad queda consultable en el sink (Seq, Elastic, etc.).

**3. ¿Qué es LogContext y para qué lo usas?**
> `LogContext.PushProperty` agrega una propiedad a *todos* los logs que se emitan dentro de ese scope usando un ambient context (AsyncLocal). Es el mecanismo para que propiedades como `CorrelationId`, `UserId` o `PedidoId` aparezcan en todos los logs de un request sin pasarlas manualmente en cada llamada.

**4. ¿Cómo evitas loguear datos sensibles?**
> Evitando `{@Objeto}` en entidades que contengan datos sensibles (tarjetas, contraseñas, tokens). En su lugar, loguear solo los campos necesarios: `tarjeta.Numero[^4..]` en vez de `{@Tarjeta}`. Serilog tiene un mecanismo de destructuring policies que puede sanitizar automáticamente propiedades por nombre o tipo.

**5. ¿Qué es un Correlation ID y por qué es crítico en microservicios?**
> Es un identificador único (GUID o short hash) que se genera en el primer servicio que recibe el request y se propaga en los headers HTTP a todos los servicios downstream. Permite reconstruir el journey completo de un request a través de múltiples servicios cuando hay un error. Sin él, en un incidente tendrías logs de 5 servicios sin saber cuáles pertenecen al mismo request.
