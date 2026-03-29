---
id: background-services
title: Background Services & Worker Services
sidebar_position: 26
---

# Background Services & Worker Services 🟡

Los Background Services permiten ejecutar tareas en segundo plano dentro de una aplicación .NET: procesar colas, ejecutar jobs periódicos, consumir mensajes. Es un patrón fundamental que aparece en entrevistas semi-senior y senior.

---

## IHostedService vs BackgroundService

```
IHostedService — interfaz base:
  StartAsync(CancellationToken) → se llama al iniciar la app
  StopAsync(CancellationToken)  → se llama al detener la app

BackgroundService — clase abstracta que implementa IHostedService:
  Implementa StartAsync/StopAsync automáticamente
  Solo debes implementar ExecuteAsync(CancellationToken)
  → Úsala siempre en lugar de IHostedService directamente
```

---

## BackgroundService básico

```csharp
// ✅ Servicio en segundo plano que ejecuta algo periódicamente
public class ReporteDiarioService : BackgroundService
{
    private readonly ILogger<ReporteDiarioService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;

    public ReporteDiarioService(
        ILogger<ReporteDiarioService> logger,
        IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;  // Para crear scopes (ver más abajo)
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("ReporteDiarioService iniciado");

        // Loop principal — corre mientras la app esté corriendo
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await GenerarReporteAsync();
                _logger.LogInformation("Reporte generado correctamente");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Capturar excepciones para que el servicio no muera
                _logger.LogError(ex, "Error generando reporte diario");
            }

            // Esperar 24 horas antes del próximo ciclo
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }

        _logger.LogInformation("ReporteDiarioService detenido");
    }

    private async Task GenerarReporteAsync()
    {
        // Lógica del reporte
        await Task.Delay(100);  // Simulación
    }
}

// Registrar en Program.cs
builder.Services.AddHostedService<ReporteDiarioService>();
```

---

## Scoped services en BackgroundService

`BackgroundService` es un **singleton** (vive toda la app). Los servicios como `DbContext` son **scoped** (viven por request). Intentar inyectarlos directamente causa error.

```csharp
// ❌ ERROR — no puedes inyectar scoped services en un singleton
public class MiBackgroundService : BackgroundService
{
    private readonly AppDbContext _db;  // ← DbContext es scoped → InvalidOperationException

    public MiBackgroundService(AppDbContext db) { _db = db; }
}

// ✅ SOLUCIÓN — usar IServiceScopeFactory para crear un scope por ciclo
public class MiBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;

    public MiBackgroundService(IServiceScopeFactory scopeFactory)
    {
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            // Crear un nuevo scope por iteración → DbContext fresco cada vez
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var service = scope.ServiceProvider.GetRequiredService<IReporteService>();

            await service.GenerarAsync();

            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}
```

---

## Procesador de cola (Queue Consumer)

El patrón más común: un background service consume mensajes de una cola interna o externa.

```csharp
// ✅ Canal como cola en memoria (Channel<T>)
// Ideal para comunicación entre request y background service sin dependencia externa

// 1. Definir el canal
builder.Services.AddSingleton<Channel<EmailMessage>>(
    Channel.CreateBounded<EmailMessage>(new BoundedChannelOptions(1000)
    {
        FullMode = BoundedChannelFullMode.Wait  // Bloquea si la cola está llena
    }));

// Exponer como ChannelWriter (para productores) y ChannelReader (para consumidor)
builder.Services.AddSingleton(sp =>
    sp.GetRequiredService<Channel<EmailMessage>>().Writer);
builder.Services.AddSingleton(sp =>
    sp.GetRequiredService<Channel<EmailMessage>>().Reader);

// 2. Productor — desde un controller o servicio
[ApiController]
[Route("api/emails")]
public class EmailController : ControllerBase
{
    private readonly ChannelWriter<EmailMessage> _queue;

    public EmailController(ChannelWriter<EmailMessage> queue)
    {
        _queue = queue;
    }

    [HttpPost]
    public async Task<IActionResult> EnviarEmail([FromBody] EmailRequest request)
    {
        // Encolar el trabajo y responder inmediatamente al cliente
        await _queue.WriteAsync(new EmailMessage(request.Destinatario, request.Asunto));
        return Accepted();  // 202 — el email se procesará en segundo plano
    }
}

// 3. Consumidor — BackgroundService que lee la cola
public class EmailSenderService : BackgroundService
{
    private readonly ChannelReader<EmailMessage> _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailSenderService> _logger;

    public EmailSenderService(
        ChannelReader<EmailMessage> queue,
        IServiceScopeFactory scopeFactory,
        ILogger<EmailSenderService> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // ReadAllAsync espera mensajes eficientemente (no polling)
        await foreach (var mensaje in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();

                await emailService.EnviarAsync(mensaje);
                _logger.LogInformation("Email enviado a {Destinatario}", mensaje.Destinatario);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error enviando email a {Destinatario}", mensaje.Destinatario);
                // Decidir: reintentar, dead letter, descartar
            }
        }
    }
}

builder.Services.AddHostedService<EmailSenderService>();
```

---

## Worker Service — proyecto standalone

Para procesos que no son APIs (consumers de mensajería, ETL, scheduled jobs):

```bash
dotnet new worker -n MiWorkerService
```

```csharp
// Program.cs de un Worker Service
var builder = Host.CreateApplicationBuilder(args);

// Agregar dependencias igual que en WebApp
builder.Services.AddDbContext<AppDbContext>(...);
builder.Services.AddScoped<IOrderProcessor, OrderProcessor>();

// Registrar workers
builder.Services.AddHostedService<OrderProcessorWorker>();
builder.Services.AddHostedService<CleanupWorker>();

var host = builder.Build();
await host.RunAsync();

// OrderProcessorWorker.cs
public class OrderProcessorWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OrderProcessorWorker> _logger;

    public OrderProcessorWorker(IServiceScopeFactory scopeFactory,
        ILogger<OrderProcessorWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<IOrderProcessor>();

            var procesados = await processor.ProcesarPendientesAsync(stoppingToken);
            _logger.LogInformation("Procesados {Count} pedidos", procesados);

            // Si no había nada, esperar antes de reintentar (evitar polling agresivo)
            if (procesados == 0)
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}
```

---

## Manejo correcto del CancellationToken

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        try
        {
            await HacerTrabajoAsync(stoppingToken);  // ← Pasar el token al trabajo
        }
        catch (OperationCanceledException)
        {
            // ✅ Esto es normal — la app está cerrando, salir limpiamente
            _logger.LogInformation("Servicio cancelado, cerrando...");
            break;
        }
        catch (Exception ex)
        {
            // ✅ Otros errores: loguear y continuar (no dejar morir el servicio)
            _logger.LogError(ex, "Error en el worker, reintentando...");
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}

// ✅ Timeout graceful en StopAsync
public override async Task StopAsync(CancellationToken cancellationToken)
{
    _logger.LogInformation("Deteniendo servicio...");
    await base.StopAsync(cancellationToken);  // Espera hasta 5s por defecto
    _logger.LogInformation("Servicio detenido");
}
```

---

## Jobs periódicos con precisión (Cron-style)

```csharp
// ✅ Para schedules simples — usar TimeSpan.FromHours/Minutes
await Task.Delay(TimeSpan.FromHours(1), stoppingToken);

// ✅ Para schedules tipo cron — calcular próxima ejecución
public class ScheduledService : BackgroundService
{
    private readonly TimeOnly _horaEjecucion = new(02, 00);  // 2:00 AM

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var ahora = DateTime.Now;
            var proxima = ahora.Date.Add(_horaEjecucion.ToTimeSpan());

            // Si ya pasó la hora de hoy, programar para mañana
            if (proxima <= ahora)
                proxima = proxima.AddDays(1);

            var espera = proxima - ahora;
            _logger.LogInformation("Próxima ejecución en {Espera}", espera);

            await Task.Delay(espera, stoppingToken);

            if (!stoppingToken.IsCancellationRequested)
                await EjecutarTareaAsync();
        }
    }
}

// ✅ Para schedules complejos — usar Quartz.NET o Hangfire
// dotnet add package Quartz.Extensions.Hosting
builder.Services.AddQuartz(q =>
{
    q.AddJob<MiJob>(j => j.WithIdentity("mi-job"));
    q.AddTrigger(t => t
        .ForJob("mi-job")
        .WithCronSchedule("0 0 2 * * ?")); // 2:00 AM todos los días
});
builder.Services.AddQuartzHostedService();
```

---

## Cuándo usar qué

| Necesidad | Solución |
|-----------|----------|
| Tarea periódica simple (cada N horas) | `BackgroundService` con `Task.Delay` |
| Procesar cola interna (dentro de la app) | `BackgroundService` + `Channel<T>` |
| Consumir RabbitMQ / Service Bus | `BackgroundService` + cliente del broker |
| Schedule complejo tipo cron | `Quartz.NET` o `Hangfire` |
| Job standalone sin API | Worker Service (`dotnet new worker`) |
| Job con UI de administración | `Hangfire` con dashboard |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es un `BackgroundService` en .NET?**
> Es una clase base abstracta que implementa `IHostedService` y permite ejecutar tareas en segundo plano mientras la app corre. Solo necesitas implementar `ExecuteAsync`, que recibe un `CancellationToken` para saber cuándo parar.

**2. ¿Por qué no puedes inyectar un `DbContext` directamente en un `BackgroundService`?**
> Porque `BackgroundService` es singleton (vive toda la app) y `DbContext` es scoped (vive por request/operación). Inyectar scoped en singleton causa `InvalidOperationException`. La solución es inyectar `IServiceScopeFactory` y crear un scope por ciclo de trabajo.

**3. ¿Para qué usarías `Channel<T>`?**
> Para comunicar un controller (productor) con un background service (consumidor) sin dependencias externas. El controller encola el trabajo y responde `202 Accepted` inmediatamente. El background service procesa la cola en segundo plano. Ideal para operaciones que no necesitan resultado inmediato (enviar emails, notificaciones, procesar imágenes).

**4. ¿Cómo manejas errores en un `BackgroundService` para que no muera?**
> Con un `try/catch` dentro del loop que capture excepciones generales, las loguee, y continúe la ejecución (con un pequeño delay para no hacer spinning). El `OperationCanceledException` debe dejarse pasar (o capturarse para cerrar limpiamente) ya que indica que la app se está cerrando.

**5. ¿Cuándo usarías Hangfire o Quartz en lugar de `BackgroundService`?**
> Cuando necesitas: schedules tipo cron complejos, persistencia de jobs (que sobrevivan un restart), reintentos automáticos con historial, una UI para ver y administrar jobs, o ejecución distribuida del mismo job en múltiples instancias.
