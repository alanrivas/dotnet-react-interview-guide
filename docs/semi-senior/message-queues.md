---
id: message-queues
title: Message Queues y Async Messaging
sidebar_position: 14
---

# Message Queues y Async Messaging 🟡

## Por qué Message Queues

```
Sin Queue:                  Con Queue:
Request → API → BD → Response    Request → Queue → (Procesamiento async)
(Si tarda mucho, timeout)        (Response inmediato, workers procesan después)

✅ Desacoplamiento: Cliente no espera procesamiento
✅ Escalabilidad: Múltiples workers procesan en paralelo
✅ Resiliencia: Si un worker falla, el mensaje reintentar
✅ Throttling: Controlar rate de procesamiento
```

---

## Conceptos clave

```
Producer      → Quien enviá el mensaje (API)
Consumer      → Quien procesa el mensaje (background job)
Queue         → Buffer donde viven los mensajes (RabbitMQ, Azure Service Bus)
Message       → Dato serializado (JSON, protobuf)
Exchange      → Enrutador de mensajes (en RabbitMQ)
Binding       → Conexión entre queue y exchange
Routing Key   → Identificador para filtrar mensajes

Patrón Publish-Subscribe:
Publisher → Exchange → Multiple Queues → Múltiples Subscribers
```

---

## RabbitMQ Setup en C#

```csharp
// Instalar: dotnet add package RabbitMQ.Client MassTransit

// ✅ Configurar en Program.cs
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(new Uri("rabbitmq://localhost"), h =>
        {
            h.Username("guest");
            h.Password("guest");
        });

        // Configurar consumers
        cfg.ReceiveEndpoint("pedidos-queue", e =>
        {
            e.Consumer<PedidoCreadoConsumer>(context);
        });

        cfg.ReceiveEndpoint("emails-queue", e =>
        {
            e.Consumer<EnviarEmailConsumer>(context);
        });
    });
});

// Producer: Enviar mensaje
public class PedidosService
{
    private readonly IPublishEndpoint _publishEndpoint;

    public async Task<int> CrearPedidoAsync(CreatePedidoDto dto)
    {
        var pedido = new Pedido { Total = dto.Total, UsuarioId = dto.UsuarioId };
        _db.Pedidos.Add(pedido);
        await _db.SaveChangesAsync();

        // Publicar evento — procesará asyncrónicamente
        await _publishEndpoint.Publish(new PedidoCreado
        {
            PedidoId = pedido.Id,
            UsuarioEmail = dto.UsuarioEmail,
            Total = dto.Total,
            Timestamp = DateTime.UtcNow
        });

        return pedido.Id;  // Retornar inmediatamente, no esperar procesamiento
    }
}

// Consumer: Procesar mensaje
public class PedidoCreadoConsumer : IConsumer<PedidoCreado>
{
    private readonly IEmailService _emailService;
    private readonly ILogger<PedidoCreadoConsumer> _logger;

    public async Task Consume(ConsumeContext<PedidoCreado> context)
    {
        var eventoP = context.Message;
        _logger.LogInformation($"Procesando pedido {eventoP.PedidoId}");

        // Lógica de negocio
        try
        {
            // 1. Enviar email
            await _emailService.EnviarConfirmacionAsync(eventoP.UsuarioEmail, eventoP);

            // 2. Actualizar inventario
            await ActualizarInventarioAsync(eventoP.PedidoId);

            // 3. Notificar warehouse
            await _publishEndpoint.Publish(new PedidoListo { PedidoId = eventoP.PedidoId });

            _logger.LogInformation($"Pedido {eventoP.PedidoId} procesado exitosamente");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error procesando pedido {eventoP.PedidoId}");
            // MassTransit automáticamente reintenta con exponential backoff
            throw;  // Re-lanzar para que reintentar
        }
    }
}

// Event/Message DTO
public record PedidoCreado
{
    public int PedidoId { get; set; }
    public string UsuarioEmail { get; set; } = null!;
    public decimal Total { get; set; }
    public DateTime Timestamp { get; set; }
}
```

---

## Patrones de Messaging

### Request-Reply (RPC asincrónico)

```csharp
// ✅ Cuando necesitas respuesta del consumer
public class PedidoService
{
    private readonly IRequestClient<ObtenerInventario> _requestClient;

    public async Task ValidarInventarioAsync(int productoId, int cantidad)
    {
        var response = await _requestClient.GetResponse<InventarioDisponible>(
            // Enviar request
            new ObtenerInventario { ProductoId = productoId, Cantidad = cantidad }
        );

        if (response.Message.Disponible)
        {
            return true;
        }
        else
        {
            throw new InsufficientInventoryException();
        }
    }
}

public class InventarioConsumer : IConsumer<ObtenerInventario>
{
    private readonly InventarioRepository _repo;

    public async Task Consume(ConsumeContext<ObtenerInventario> context)
    {
        var inventario = await _repo.ObtenerAsync(context.Message.ProductoId);
        
        var disponible = inventario.Cantidad >= context.Message.Cantidad;
        
        // Responder al producer
        await context.RespondAsync(new InventarioDisponible
        {
            Disponible = disponible,
            CantidadActual = inventario.Cantidad
        });
    }
}

public record ObtenerInventario { public int ProductoId { get; set; }; public int Cantidad { get; set; }; }
public record InventarioDisponible { public bool Disponible { get; set; } }
```

### Saga Pattern

```csharp
// ✅ Orquestar múltiples servicios — si uno falla, compensar los anteriores
public class TransferenciaSagaStateMachine : MassTransitStateMachine<TransferenciaState>
{
    public State Iniciada { get; private set; }
    public State DebidoEfectuado { get; private set; }
    public State CreditoEfectuado { get; private set; }
    public State Completada { get; private set; }
    public State Fallida { get; private set; }

    public Event<IniciarTransferencia> Iniciar { get; private set; }
    public Event<DebidoEfectuado> Debito { get; private set; }
    public Event<DebidoFallo> DebitoFallo { get; private set; }
    public Event<CreditoEfectuado> Credito { get; private set; }
    public Event<CreditoFallo> CreditoFallo { get; private set; }

    public TransferenciaSagaStateMachine()
    {
        InstanceState(x => x.CurrentState);

        // Flujo normal
        Initially(
            When(Iniciar)
                .Then(x => x.Saga.Monto = x.Message.Monto)
                .Publish(x => new DebitarCuenta { UsuarioId = x.Message.UsuarioOrigen, Monto = x.Message.Monto })
                .TransitionTo(Iniciada)
        );

        During(Iniciada,
            When(Debito)
                .Publish(x => new CreditarCuenta { UsuarioId = x.Message.UsuarioDestino, Monto = x.Saga.Monto })
                .TransitionTo(DebidoEfectuado),

            When(DebitoFallo)
                .TransitionTo(Fallida)
        );

        During(DebidoEfectuado,
            When(Credito)
                .Then(x => x.Saga.Completada = true)
                .TransitionTo(Completada),

            When(CreditoFallo)
                .Publish(x => new DeshacerDebito { UsuarioId = x.Message.UsuarioOrigen, Monto = x.Saga.Monto })
                .TransitionTo(Fallida)
        );

        During(Completada,
            When(Finalize)
                .Then(x => Console.WriteLine($"Transferencia {x.Saga.Id} completada"))
        );
    }
}

public class TransferenciaState : SagaStateMachineInstance
{
    public Guid CorrelationId { get; set; }
    public string CurrentState { get; set; }
    public decimal Monto { get; set; }
    public bool Completada { get; set; }
}
```

---

## Retry y Deadletter Handling

```csharp
// ✅ Configurar reintentos automáticos
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(new Uri("rabbitmq://localhost"));

        cfg.ReceiveEndpoint("pedidos-queue", e =>
        {
            // Reintentar 3 veces con exponential backoff
            e.UseMessageRetry(r =>
            {
                r.Incremental(3, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(2));
                // 1er reintento: 1s, 2o reintento: 3s, 3er reintento: 5s
            });

            // Si fallan los reintentos → deadletter queue
            e.ReceiveObservers.Add(new DeadLetterObserver());

            e.Consumer<PedidoCreadoConsumer>(context);
        });
    });
});

// ✅ Procesar deadletter queue (mensajes que fallaron permanentemente)
public class DeadLetterProcessor
{
    private readonly ILogger<DeadLetterProcessor> _logger;

    [Queue("pedidos-queue.deadletter")]
    public async Task Procesar(ConsumeContext<PedidoCreado> context)
    {
        var pedido = context.Message;
        _logger.LogError($"Pedido {pedido.PedidoId} en deadletter. Investigando...");

        // 1. Loguear para análisis
        // 2. Alertar al equipo
        // 3. Opcionalmente, marcar manualmente para reprocessar

        if (await RequiereIntervencionManual(pedido))
        {
            await NotificarAdministrador();
        }
    }
}

// ✅ Configurar circuit breaker para evitar bombardear servicio caído
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.ReceiveEndpoint("pedidos-queue", e =>
        {
            e.UseCircuitBreaker(r =>
            {
                r.ResetTimeout = TimeSpan.FromMinutes(1);
                r.TripThreshold = 5;  // Abrir circuit después de 5 errores
                r.ActiveThreshold = 2;
            });

            e.Consumer<PedidoCreadoConsumer>(context);
        });
    });
});
```

---

## Background Jobs vs Message Queues

```csharp
// ✅ BACKGROUND JOBS (Hangfire): Ejecutar tareas programadas/delayed
public class NotificacionesController
{
    private readonly IBackgroundJobClient _backgroundJobs;

    [HttpPost("enviar-email-delay")]
    public IActionResult PrograrEmail()
    {
        // Ejecutar dentro de 5 minutos
        BackgroundJob.Schedule(() => 
            _emailService.EnviarBoletin("user@test.com"), 
            TimeSpan.FromMinutes(5));

        return Accepted();
    }

    [HttpPost("limpiar-archivos")]
    public IActionResult LimpiarArchivos()
    {
        // Ejecutar diariamente a la 1 AM
        RecurringJob.AddOrUpdate("limpiar", 
            () => _storageService.LimpiarArchivosAntiguos(),
            Cron.Daily(1));

        return Ok();
    }
}

// ✅ MESSAGE QUEUES (RabbitMQ): Para procesamiento distribuido, high-throughput
public class PrediosService
{
    private readonly IPublishEndpoint _bus;

    public async Task CrearPedido()
    {
        // Miles de mensajes por segundo
        for (int i = 0; i < 10000; i++)
        {
            await _bus.Publish(new PedidoCreado { ... });
        }
    }
}

// ✅ Cuándo usar cada uno:
// Background Jobs:
// - Tareas programadas (reportes nocturnos)
// - Tareas delayed (enviar email en 5 minutos)
// - Relativamente pocas tareas

// Message Queues:
// - Alto volumen (miles/minuto)
// - Procesamiento distribuido
// - Desacoplamiento entre servicios
// - Resiliencia crítica (reintentos, failover)
```

---

## Anti-patrones en Message Queues

```csharp
// ❌ ANTI-PATRÓN: Consultar consumer status dentro del publisher
var mensaje = new PedidoCreado { PedidoId = 1 };
await _publishEndpoint.Publish(mensaje);

// Esperar a que el consumer procese (INCORRECTO — timingissue)
await Task.Delay(1000);
var resultado = await _repo.ObtenerPedidoAsync(1);

// ✅ CORRECTO: Esperar respuesta con Request-Reply
var response = await _requestClient.GetResponse<PedidoProcesado>(mensaje);

// ❌ ANTI-PATRÓN: Procesar mensajes sin idempotencia
public async Task Consume(ConsumeContext<Pago> context)
{
    var pago = context.Message;
    await _repo.CrearPagoAsync(pago);  // Si reintenta, crea duplicado!
}

// ✅ CORRECTO: Idempotente — detectar duplicados
public async Task Consume(ConsumeContext<Pago> context)
{
    var pago = context.Message;
    var yaExiste = await _repo.ExistePagoAsync(pago.PaymentId);
    
    if (yaExiste)
    {
        _logger.LogWarning($"Pago {pago.PaymentId} ya procesado — ignorando");
        return;
    }
    
    await _repo.CrearPagoAsync(pago);
}

// ❌ ANTI-PATRÓN: No manejar exceptions específicas
try
{
    var response = await _externalApi.CallAsync();
}
catch (Exception ex)
{
    _logger.LogError(ex, "Error");
    throw;  // Siempre reintentar — ¡pero si es 401 Unauthorized, nunca funcionará!
}

// ✅ CORRECTO: No reintentar errores permanentes
try
{
    var response = await _externalApi.CallAsync();
}
catch (HttpRequestException ex) when (ex.StatusCode == 401)
{
    _logger.LogError(ex, "API key inválida — no reintentar");
    await _repo.CrearAlertAsync($"API key inválida para {ex.Message}");
    return;  // No relanzar — ir directo a deadletter o manual handling
}
catch (HttpRequestException ex)
{
    _logger.LogError(ex, "Error de API — reintentar");
    throw;  // Reintentará automáticamente
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿RabbitMQ vs Azure Service Bus vs SQS?**
> **RabbitMQ**: Self-hosted, mucho control, open-source. **Azure Service Bus**: Managed, integración con Azure. **SQS**: AWS, simple, serverless. Elige según: RabbitMQ para control total, Service Bus si usas Azure, SQS si usas AWS.

**2. ¿Puedo garantizar exactly-once delivery?**
> No en distribución. Mejor es "at-least-once" + idempotencia. Procesa mensajes de forma que reintentarlos no causa daño (insertar si no existe, usar transacciones, ID único de mensaje).

**3. ¿Orden garantizado de mensajes?**
> En la misma queue sí (aunque publishers pueden perder orden). Si necesitas orden global, usa Saga con state machine o procesa secuencialmente con una transaction log.

**4. ¿Deadletter queue cuándo activar?**
> Configurar automáticamente con reintentos (3-5 ). Si todos fallan → deadletter. Monitorear deadletter para detectar problemas. Alguien debe revisar manualmente cada cierto tiempo.

**5. ¿Request-Reply vs Pub-Sub?**
> **Request-Reply**: Necesitas respuesta sincrónica (validación, info). **Pub-Sub**: Fire-and-forget (log evento, enviar notificación). Usa Pub-Sub por defecto (menos acoplamiento), Request-Reply solo si realmente necesitas respuesta.

**6. ¿Cuándo usar Background Jobs vs Message Queues?**
> **Background Jobs** (Hangfire): Pocas tareas, programadas, delayed. **Message Queues**: Alto volumen, distribuido, entre servicios. No mutuamente excluyentes — Hangfire puede publicar a una queue.

**7. ¿Cómo monitorizas Message Queues?**
> Métricas: Queue depth (mensajes pendientes), consumer throughput (msgs/seg), deadletter count, processing duration. Alertas: Si queue > threshold, si deadletter crece, si consumer desconectado.

**8. ¿Escalability: agregar más consumers?**
> Sí, agregar más instancias de consumer que leen de la misma queue. RabbitMQ distribuye trabajo entre ellos automáticamente. Cuidado: si cada consumer tiene estado local, necesitas coordinación (usar partitioning por usuario ID, etc).