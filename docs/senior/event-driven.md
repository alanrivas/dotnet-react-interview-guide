---
id: event-driven
title: Arquitectura Event-Driven
sidebar_position: 12
---

# Arquitectura Event-Driven

## ¿Qué es Event-Driven Architecture?

En una arquitectura event-driven (EDA), los componentes **no se llaman directamente entre sí**. En su lugar, emiten eventos que describen algo que ocurrió, y otros componentes reaccionan a esos eventos de forma independiente.

```
// ❌ Arquitectura acoplada (sincrónica directa)
class OrderService
{
    void CreateOrder(Order order)
    {
        _inventoryService.Reserve(order);      // llama directamente
        _notificationService.SendEmail(order); // llama directamente
        _loyaltyService.AddPoints(order);      // llama directamente
        // Si cualquiera falla → toda la operación falla
    }
}

// ✅ Arquitectura event-driven (desacoplada)
class OrderService
{
    void CreateOrder(Order order)
    {
        _repository.Save(order);
        _eventBus.Publish(new OrderCreatedEvent(order.Id, order.CustomerId, order.Total));
        // OrderService no sabe ni le importa quién reacciona al evento
    }
}

// En otro proceso/servicio:
class InventoryConsumer  : IConsumer<OrderCreatedEvent> { ... }
class NotificationConsumer : IConsumer<OrderCreatedEvent> { ... }
class LoyaltyConsumer    : IConsumer<OrderCreatedEvent> { ... }
```

### Ventajas

- **Desacoplamiento**: los productores no conocen a los consumidores. Puedes agregar nuevos consumidores sin tocar el productor.
- **Resiliencia**: si el servicio de notificaciones cae, los pedidos siguen creándose. Los eventos se procesan cuando el servicio se recupera.
- **Escalabilidad independiente**: cada consumidor escala por separado según su carga.
- **Audit log natural**: el stream de eventos es un registro inmutable de todo lo que ocurrió.

### Desventajas

- **Complejidad**: rastrear el flujo de un proceso requiere observabilidad (trazas distribuidas).
- **Eventual consistency**: los datos no son consistentes instantáneamente en todos los servicios.
- **Debugging más difícil**: un flujo que antes era una sola llamada ahora son 5 consumidores asincrónicos.
- **Garantías de entrega**: hay que decidir y gestionar at-least-once, at-most-once, exactly-once.

### ¿Cuándo usar EDA?

| Usar EDA | No usar EDA |
|----------|-------------|
| Múltiples consumidores del mismo evento | Un solo consumidor directo |
| Los consumidores pueden ser eventuales | Se necesita respuesta síncrona inmediata |
| Alto throughput y desacoplamiento son prioridad | Sistema simple con pocos componentes |
| Audit log y replay son necesarios | La consistencia inmediata es crítica |

---

## Conceptos Fundamentales

### Evento vs Comando vs Query

```
Comando (Command): "HazEstoCorrecto"         → puede rechazarse
  CreateOrderCommand, ReserveInventoryCommand

Evento (Event): "EstoYaOcurrió"             → inmutable, hecho del pasado
  OrderCreatedEvent, PaymentProcessedEvent

Query (Query): "DimeCuántoTienes"            → solo lectura, sin efectos
  GetOrderByIdQuery, ListOrdersQuery
```

```csharp
// Los eventos son inmutables — usa record para esto en C#
public record OrderCreatedEvent(
    Guid OrderId,
    Guid CustomerId,
    decimal Total,
    string Region,
    DateTimeOffset OccurredAt);

// Nunca modifiques un evento ya publicado — es un hecho histórico
// Si necesitas corregir un estado, publica un nuevo evento: OrderCancelledEvent
```

### Garantías de Entrega

| Garantía | Descripción | Consecuencia |
|----------|-------------|--------------|
| **At-most-once** | El mensaje llega 0 o 1 vez | Puede perderse. Rápido. |
| **At-least-once** | El mensaje llega 1 o más veces | Puede duplicarse. El más común. |
| **Exactly-once** | El mensaje llega exactamente 1 vez | Complejo, costoso, requiere coordinación. |

La mayoría de los sistemas usan **at-least-once + idempotencia en el consumidor** (Inbox Pattern) como solución práctica. "Exactly-once" real es muy difícil de garantizar a través de sistemas distribuidos.

---

## Apache Kafka

### Arquitectura

```
                    ┌──────────────────────────────────────────────┐
                    │               KAFKA CLUSTER                   │
                    │                                               │
  Producer          │  Topic: "orders"                             │
  (orders-api) ───► │  ┌─────────────┐ ┌─────────────┐            │
                    │  │ Partition 0 │ │ Partition 1 │            │
                    │  │ [msg0][msg1]│ │ [msg0][msg1]│            │
                    │  │ [msg2][msg3]│ │ [msg2]      │            │
                    │  └─────────────┘ └─────────────┘            │
                    │       offset: 4       offset: 3              │
                    └──────────────────────────────────────────────┘
                              │               │
                    ┌─────────▼───────────────▼─────────┐
                    │         Consumer Group: "inventory"│
                    │  ┌──────────────┐ ┌──────────────┐│
                    │  │  Consumer 1  │ │  Consumer 2  ││
                    │  │ (Partition 0)│ │ (Partition 1)││
                    │  └──────────────┘ └──────────────┘│
                    └───────────────────────────────────┘
```

**Conceptos clave:**

- **Topic**: canal lógico donde se publican mensajes. Se divide en particiones.
- **Partition**: unidad de paralelismo. Los mensajes dentro de una partición están **ordenados**.
- **Offset**: posición de un mensaje en una partición. Los consumidores gestionan su propio offset.
- **Consumer Group**: grupo de consumidores que cooperan. Cada partición es leída por exactamente un consumidor del grupo.
- **Retention**: los mensajes no se borran al consumirse. Persisten N días/horas. Permiten **replay**.

### ¿Por qué Kafka ≠ Queue tradicional?

| | Queue tradicional (RabbitMQ) | Kafka |
|--|------------------------------|-------|
| Mensajes consumidos | Se borran | Persisten (retention configurable) |
| Replay de eventos | ❌ No | ✅ Sí — vuelve al offset que quieras |
| Orden | Por queue | Garantizado por partición |
| Throughput | Miles/seg | Millones/seg |
| Complejidad | Menor | Mayor |

### Kafka con Confluent.Kafka en .NET

```bash
dotnet add package Confluent.Kafka
```

```csharp
// Producer — publicar eventos
public class KafkaOrderEventPublisher
{
    private readonly IProducer<string, string> _producer;

    public KafkaOrderEventPublisher(IConfiguration config)
    {
        var producerConfig = new ProducerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"],
            // Acks.All = esperar confirmación de todas las réplicas (máxima durabilidad)
            Acks = Acks.All,
            // Reintentos automáticos con backoff
            MessageSendMaxRetries = 3,
            RetryBackoffMs = 1000
        };

        _producer = new ProducerBuilder<string, string>(producerConfig).Build();
    }

    public async Task PublishAsync(OrderCreatedEvent evt)
    {
        var message = new Message<string, string>
        {
            // La KEY determina en qué partición va el mensaje.
            // Usar el CustomerId garantiza que los pedidos del mismo cliente
            // siempre van a la misma partición → orden garantizado por cliente.
            Key   = evt.CustomerId.ToString(),
            Value = JsonSerializer.Serialize(evt),
            Headers = new Headers
            {
                { "event-type", Encoding.UTF8.GetBytes("OrderCreated") },
                { "schema-version", Encoding.UTF8.GetBytes("1") }
            }
        };

        var result = await _producer.ProduceAsync("orders", message);
        Console.WriteLine($"Mensaje entregado a partition {result.Partition} offset {result.Offset}");
    }
}
```

```csharp
// Consumer — consumir eventos en un background service
public class KafkaOrderConsumerService : BackgroundService
{
    private readonly IConsumer<string, string> _consumer;
    private readonly ILogger<KafkaOrderConsumerService> _logger;

    public KafkaOrderConsumerService(IConfiguration config, ILogger<KafkaOrderConsumerService> logger)
    {
        _logger = logger;

        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers   = config["Kafka:BootstrapServers"],
            GroupId            = "inventory-service",       // nombre del consumer group
            AutoOffsetReset    = AutoOffsetReset.Earliest,  // si no hay offset, empezar desde el principio
            EnableAutoCommit   = false  // commit manual para at-least-once con control
        };

        _consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _consumer.Subscribe("orders");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Poll con timeout — no bloquea indefinidamente
                var consumeResult = _consumer.Consume(TimeSpan.FromSeconds(1));
                if (consumeResult is null) continue;

                var evt = JsonSerializer.Deserialize<OrderCreatedEvent>(consumeResult.Message.Value)!;
                _logger.LogInformation("Procesando OrderCreated {OrderId}", evt.OrderId);

                await ProcessOrderCreatedAsync(evt, stoppingToken);

                // Commit manual: solo confirmamos que procesamos ESTE mensaje
                _consumer.Commit(consumeResult);
            }
            catch (ConsumeException ex)
            {
                _logger.LogError(ex, "Error al consumir mensaje de Kafka");
            }
        }
    }

    private async Task ProcessOrderCreatedAsync(OrderCreatedEvent evt, CancellationToken ct)
    {
        // lógica de reserva de inventario...
        await Task.Delay(10, ct);
    }

    public override void Dispose()
    {
        _consumer.Close(); // Commit offsets y notificar al grupo que este consumer se va
        _consumer.Dispose();
        base.Dispose();
    }
}
```

---

## RabbitMQ

### Exchanges — el corazón del routing

```
Producer                Exchange              Queue               Consumer
  │                        │                    │                    │
  │──── publica msg ───────►│                    │                    │
  │   (routing key)         │──── binding ──────►│──── consume ──────►│
  │                         │
  │  Direct Exchange: routing key == binding key (exacto)
  │  Fanout Exchange: a TODOS los queues enlazados (broadcast)
  │  Topic Exchange: routing key con wildcards (* = una palabra, # = cero o más)
  │  Headers Exchange: basado en headers del mensaje (raro, más flexible)
```

```csharp
// Ejemplo con MassTransit — abstracción sobre RabbitMQ

// Instalación
// dotnet add package MassTransit.RabbitMQ

// Program.cs
builder.Services.AddMassTransit(x =>
{
    // Registrar consumidores
    x.AddConsumer<OrderCreatedConsumer>();
    x.AddConsumer<PaymentProcessedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host("rabbitmq://localhost", h =>
        {
            h.Username("guest");
            h.Password("guest");
        });

        // Dead Letter Queue: mensajes que fallan N veces van aquí
        cfg.ReceiveEndpoint("orders-created-queue", e =>
        {
            e.PrefetchCount = 10;  // max 10 mensajes en vuelo por consumidor
            e.UseMessageRetry(r =>
            {
                r.Interval(3, TimeSpan.FromSeconds(5)); // 3 reintentos, 5s entre cada uno
            });
            e.ConfigureConsumer<OrderCreatedConsumer>(context);
        });

        cfg.ConfigureEndpoints(context);
    });
});
```

```csharp
// Publisher
public class OrderService
{
    private readonly IPublishEndpoint _publishEndpoint;

    public async Task CreateOrderAsync(CreateOrderCommand cmd)
    {
        var order = new Order(cmd);
        await _repository.SaveAsync(order);

        // MassTransit se encarga del Exchange, routing key, serialización, etc.
        await _publishEndpoint.Publish(new OrderCreatedEvent(
            OrderId: order.Id,
            CustomerId: order.CustomerId,
            Total: order.Total,
            OccurredAt: DateTimeOffset.UtcNow));
    }
}

// Consumer
public class OrderCreatedConsumer : IConsumer<OrderCreatedEvent>
{
    private readonly IInventoryService _inventory;

    public async Task Consume(ConsumeContext<OrderCreatedEvent> context)
    {
        var evt = context.Message;

        await _inventory.ReserveItemsAsync(evt.OrderId);

        // Si lanzamos una excepción, MassTransit reintenta según la política configurada.
        // Si agotan los reintentos, el mensaje va al Dead Letter Queue.
    }
}
```

### Dead Letter Queue (DLQ) — mensajes que fallaron

```csharp
// Configurar DLQ con MassTransit
cfg.ReceiveEndpoint("inventory-queue", e =>
{
    e.UseMessageRetry(r =>
    {
        r.Intervals(
            TimeSpan.FromSeconds(5),
            TimeSpan.FromSeconds(15),
            TimeSpan.FromMinutes(1));  // backoff exponencial
    });
    
    // Después de todos los reintentos, va al DLQ para inspección manual
    // MassTransit crea automáticamente: inventory-queue_error
    e.ConfigureConsumer<InventoryConsumer>(context);
});
```

---

## Azure Service Bus

```csharp
// Instalación
// dotnet add package Azure.Messaging.ServiceBus

// Configuración básica
builder.Services.AddSingleton(provider =>
{
    var connectionString = builder.Configuration["ServiceBus:ConnectionString"];
    return new ServiceBusClient(connectionString);
});
```

```csharp
// Producer — enviar a un Topic (fan-out a múltiples subscripciones)
public class ServiceBusEventPublisher
{
    private readonly ServiceBusSender _sender;

    public ServiceBusEventPublisher(ServiceBusClient client)
    {
        _sender = client.CreateSender("orders-topic");
    }

    public async Task PublishAsync(OrderCreatedEvent evt)
    {
        var json = JsonSerializer.Serialize(evt);
        var message = new ServiceBusMessage(json)
        {
            MessageId       = evt.OrderId.ToString(),  // idempotencia: no procesar duplicados
            ContentType     = "application/json",
            Subject         = "OrderCreated",           // permite filtros en subscripciones
            SessionId       = evt.CustomerId.ToString(), // garantiza orden por cliente
            ScheduledEnqueueTime = DateTimeOffset.UtcNow.AddMinutes(5) // mensaje diferido
        };

        await _sender.SendMessageAsync(message);
    }
}
```

```csharp
// Consumer — procesar con sessions (orden garantizado por clave de sesión)
public class ServiceBusOrderConsumer : BackgroundService
{
    private readonly ServiceBusSessionProcessor _processor;

    public ServiceBusOrderConsumer(ServiceBusClient client, ILogger<ServiceBusOrderConsumer> logger)
    {
        _processor = client.CreateSessionProcessor("orders-topic", "inventory-subscription",
            new ServiceBusSessionProcessorOptions
            {
                MaxConcurrentSessions = 4,       // procesar 4 sesiones en paralelo
                MaxConcurrentCallsPerSession = 1  // dentro de cada sesión, en orden
            });

        _processor.ProcessMessageAsync += OnMessageAsync;
        _processor.ProcessErrorAsync   += OnErrorAsync;
    }

    private async Task OnMessageAsync(ProcessSessionMessageEventArgs args)
    {
        var evt = JsonSerializer.Deserialize<OrderCreatedEvent>(args.Message.Body)!;

        try
        {
            await ProcessAsync(evt);
            await args.CompleteMessageAsync(args.Message); // ack: borrar el mensaje
        }
        catch (BusinessException ex)
        {
            // Error de negocio — no reintentar, ir directamente al DLQ
            await args.DeadLetterMessageAsync(args.Message,
                deadLetterReason: "BusinessError",
                deadLetterErrorDescription: ex.Message);
        }
        catch (Exception)
        {
            // Error técnico — soltar el lock para que Service Bus lo reintente
            await args.AbandonMessageAsync(args.Message);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _processor.StartProcessingAsync(stoppingToken);
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
```

---

## Patrones Event-Driven

### Outbox Pattern — atomicidad entre BD y message broker

**Problema**: ¿cómo garantizar que si guardamos en la BD, también publicamos el evento? Si publicamos el evento y luego falla el commit a la BD, el estado es inconsistente.

```
// ❌ Sin Outbox — no es atómico
await _dbContext.SaveChangesAsync();  // commit
await _eventBus.Publish(orderCreatedEvent);  // ← puede fallar aquí: BD actualizada pero evento no publicado
```

**Solución**: guardar el evento en una tabla `Outbox` **dentro de la misma transacción** de negocio.

```sql
-- Tabla Outbox
CREATE TABLE OutboxMessages (
    Id            UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWSEQUENTIALID(),
    OccurredAt    DATETIMEOFFSET   NOT NULL DEFAULT SYSUTCDATETIME(),
    EventType     NVARCHAR(200)    NOT NULL,
    Payload       NVARCHAR(MAX)    NOT NULL,  -- JSON del evento
    PublishedAt   DATETIMEOFFSET   NULL,       -- NULL = pendiente de publicar
    Error         NVARCHAR(MAX)    NULL
);
```

```csharp
// Guardar orden Y evento en la misma transacción
public class OrderService
{
    private readonly AppDbContext _dbContext;

    public async Task CreateOrderAsync(CreateOrderCommand cmd)
    {
        var order = new Order(cmd);
        var outboxMessage = new OutboxMessage
        {
            EventType = nameof(OrderCreatedEvent),
            Payload   = JsonSerializer.Serialize(new OrderCreatedEvent(
                order.Id, order.CustomerId, order.Total, DateTimeOffset.UtcNow))
        };

        _dbContext.Orders.Add(order);
        _dbContext.OutboxMessages.Add(outboxMessage); // misma transacción

        await _dbContext.SaveChangesAsync(); // atómico: ambos o ninguno
        // El evento AÚN NO está en Kafka/RabbitMQ, está en la BD
    }
}
```

```csharp
// Worker que publica los mensajes del Outbox al broker
public class OutboxPublisherWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IEventBus _eventBus;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await PublishPendingMessagesAsync(stoppingToken);
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); // polling cada 5s
        }
    }

    private async Task PublishPendingMessagesAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var pending = await dbContext.OutboxMessages
            .Where(m => m.PublishedAt == null)
            .OrderBy(m => m.OccurredAt)
            .Take(100)
            .ToListAsync(ct);

        foreach (var message in pending)
        {
            try
            {
                await _eventBus.PublishRawAsync(message.EventType, message.Payload);

                message.PublishedAt = DateTimeOffset.UtcNow;
                await dbContext.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                message.Error = ex.Message;
                await dbContext.SaveChangesAsync(ct);
            }
        }
    }
}
```

### Inbox Pattern — consumidor idempotente

**Problema**: con at-least-once delivery, el mismo mensaje puede llegar 2 o más veces (red, reintento del broker). Procesar un pedido dos veces es un problema.

```sql
-- Tabla Inbox: registro de mensajes ya procesados
CREATE TABLE InboxMessages (
    MessageId     NVARCHAR(200)    PRIMARY KEY,  -- ID único del mensaje del broker
    ProcessedAt   DATETIMEOFFSET   NOT NULL DEFAULT SYSUTCDATETIME(),
    EventType     NVARCHAR(200)    NOT NULL
);
```

```csharp
// Consumidor idempotente con Inbox
public class IdempotentOrderCreatedConsumer : IConsumer<OrderCreatedEvent>
{
    private readonly AppDbContext _dbContext;

    public async Task Consume(ConsumeContext<OrderCreatedEvent> context)
    {
        var messageId = context.MessageId?.ToString()
                        ?? throw new InvalidOperationException("Mensaje sin MessageId");

        // Idempotency check: ¿ya procesamos este mensaje?
        var alreadyProcessed = await _dbContext.InboxMessages
            .AnyAsync(m => m.MessageId == messageId);

        if (alreadyProcessed)
        {
            // Ack al broker pero no re-procesar
            Console.WriteLine($"Mensaje {messageId} ya procesado. Ignorando duplicado.");
            return;
        }

        // Procesar Y registrar en Inbox en la misma transacción
        await using var transaction = await _dbContext.Database.BeginTransactionAsync();

        try
        {
            await ProcessOrderCreatedAsync(context.Message);

            _dbContext.InboxMessages.Add(new InboxMessage
            {
                MessageId = messageId,
                EventType = nameof(OrderCreatedEvent)
            });

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch
        {
            await transaction.RollbackAsync();
            throw; // relanzar para que el broker reintente
        }
    }
}
```

### Saga Pattern

Una **saga** coordina una transacción distribuida que abarca múltiples servicios.

```
Pedido de e-commerce: CreateOrder → ReserveInventory → ProcessPayment → ShipOrder

Si ProcessPayment falla:
  → Compensar: ReleaseInventory + CancelOrder (compensating transactions)
```

#### Choreography Saga

```csharp
// Cada servicio publica eventos y reacciona a eventos — sin coordinador central
// Flujo: OrderCreated → InventoryReserved → PaymentProcessed → OrderShipped

// Orders Service
public class OrderService
{
    public async Task CreateOrderAsync(CreateOrderCommand cmd)
    {
        var order = new Order(cmd) { Status = OrderStatus.PendingInventory };
        await _repository.SaveAsync(order);
        await _eventBus.Publish(new OrderCreatedEvent(order.Id));  // dispara el flujo
    }

    // Compensa si el pago falla
    public async Task Handle(PaymentFailedEvent evt)
    {
        var order = await _repository.GetAsync(evt.OrderId);
        order.Status = OrderStatus.Cancelled;
        await _repository.SaveAsync(order);
        await _eventBus.Publish(new OrderCancelledEvent(order.Id)); // para compensar inventario
    }
}

// Inventory Service
public class InventoryConsumer : IConsumer<OrderCreatedEvent>
{
    public async Task Consume(ConsumeContext<OrderCreatedEvent> context)
    {
        var evt = context.Message;
        var reserved = await _inventory.TryReserveAsync(evt.OrderId);

        if (reserved)
            await context.Publish(new InventoryReservedEvent(evt.OrderId));
        else
            await context.Publish(new InventoryReservationFailedEvent(evt.OrderId));
    }
}
```

#### Orchestration Saga (con MassTransit Sagas)

```csharp
// El orquestador centraliza el estado y las decisiones
public class OrderSaga : MassTransitStateMachine<OrderSagaState>
{
    public State PendingInventory { get; private set; }
    public State PendingPayment   { get; private set; }
    public State Completed        { get; private set; }
    public State Cancelled        { get; private set; }

    public Event<OrderCreatedEvent>              OrderCreated              { get; private set; }
    public Event<InventoryReservedEvent>         InventoryReserved         { get; private set; }
    public Event<InventoryReservationFailedEvent> InventoryFailed          { get; private set; }
    public Event<PaymentProcessedEvent>          PaymentProcessed          { get; private set; }
    public Event<PaymentFailedEvent>             PaymentFailed             { get; private set; }

    public OrderSaga()
    {
        InstanceState(x => x.CurrentState);

        Initially(
            When(OrderCreated)
                .Then(ctx => ctx.Saga.OrderId = ctx.Message.OrderId)
                .TransitionTo(PendingInventory)
                .Publish(ctx => new ReserveInventoryCommand(ctx.Saga.OrderId)));

        During(PendingInventory,
            When(InventoryReserved)
                .TransitionTo(PendingPayment)
                .Publish(ctx => new ProcessPaymentCommand(ctx.Saga.OrderId)),
            When(InventoryFailed)
                .TransitionTo(Cancelled)
                .Publish(ctx => new CancelOrderCommand(ctx.Saga.OrderId)));

        During(PendingPayment,
            When(PaymentProcessed)
                .TransitionTo(Completed)
                .Publish(ctx => new ShipOrderCommand(ctx.Saga.OrderId)),
            When(PaymentFailed)
                .TransitionTo(Cancelled)
                .Publish(ctx => new ReleaseInventoryCommand(ctx.Saga.OrderId))
                .Publish(ctx => new CancelOrderCommand(ctx.Saga.OrderId)));
    }
}

// Estado persistido en BD (SQL Server, Redis, MongoDB...)
public class OrderSagaState : SagaStateMachineInstance
{
    public Guid CorrelationId { get; set; }  // = OrderId
    public string CurrentState { get; set; } = null!;
    public Guid OrderId { get; set; }
}
```

### Event Versioning — evolucionar eventos sin romper consumidores

```csharp
// ❌ Romper el contrato — cambiar el tipo de una propiedad
// Versión 1
public record OrderCreatedEvent(Guid OrderId, decimal Total);

// ❌ Versión 2 — cambiar Total de decimal a string rompe a todos los consumidores
public record OrderCreatedEvent(Guid OrderId, string Total);
```

```csharp
// ✅ Estrategia 1: Additive-only changes — solo agregar propiedades opcionales
// Versión 1: { OrderId, Total }
// Versión 2: { OrderId, Total, Region? } — Region es nullable, consumidores v1 lo ignoran

public record OrderCreatedEvent(
    Guid    OrderId,
    decimal Total,
    string? Region  = null,   // nuevo en v2, nullable para compatibilidad hacia atrás
    string? Currency = null); // nuevo en v3
```

```csharp
// ✅ Estrategia 2: Versioned event types — eventos con versión en el nombre
public record OrderCreatedEventV1(Guid OrderId, decimal Total);
public record OrderCreatedEventV2(Guid OrderId, decimal Total, string Region, string Currency);

// Los consumidores migran gradualmente de V1 a V2
// Mientras hay consumidores en V1, el producer publica ambos (fan-out)
```

```csharp
// ✅ Estrategia 3: Upcasting — transformar formato antiguo al nuevo al consumir
public class OrderCreatedEventUpcaster
{
    public OrderCreatedEventV2 Upcast(OrderCreatedEventV1 v1) =>
        new(v1.OrderId, v1.Total, Region: "unknown", Currency: "EUR");
}

// Al leer del broker, si el schema-version header es "1", hacemos upcast antes de procesar
public class OrderCreatedConsumer : IConsumer<OrderCreatedEventV2>
{
    public async Task Consume(ConsumeContext<OrderCreatedEventV2> context)
    {
        // Aquí siempre recibimos V2, independientemente de si fue publicado como V1 o V2
    }
}
```

---

## Comparativa: Kafka vs RabbitMQ vs Azure Service Bus

| Característica | Kafka | RabbitMQ | Azure Service Bus |
|----------------|-------|----------|-------------------|
| **Throughput** | Millones msgs/seg | Decenas de miles/seg | Miles/seg |
| **Retención de mensajes** | ✅ Días/semanas/indefinida | ❌ Se borran al consumir | ❌ Se borran al consumir |
| **Replay de eventos** | ✅ Sí, volver a cualquier offset | ❌ No | ❌ No |
| **Orden garantizado** | Por partición | Por queue | Por sesión |
| **Patrones de routing** | Simple (topic/partición) | Avanzado (exchanges/bindings) | Medio (topics/subscripciones/filtros) |
| **Dead Letter Queue** | Manual | ✅ Automática | ✅ Automática |
| **Facilidad de uso** | Complejo | Medio | Sencillo (managed) |
| **Cloud native** | Self-hosted / Confluent Cloud | Self-hosted / CloudAMQP | ✅ Azure fully managed |
| **Casos de uso ideales** | Event sourcing, stream processing, audit log, alto throughput | Task queues, RPC, routing complejo, work distribution | Integración Azure, workloads empresariales, sesiones ordenadas |
| **Casos de uso típicos** | Analytics en tiempo real, microservicios con millones de eventos/día | Procesamiento de tareas background, notificaciones, integración sistemas | Apps Azure, flujos empresariales, mensajería transaccional |

### ¿Cuándo elegir cuál?

```
¿Necesitas replay de eventos históricos?
  ├── Sí → Kafka
  └── No
       │
       ¿Estás en Azure y no quieres gestionar infraestructura?
       ├── Sí → Azure Service Bus
       └── No
            │
            ¿Necesitas routing complejo (exchanges, bindings, fanout, topic con wildcards)?
            ├── Sí → RabbitMQ
            └── No (caso simple) → cualquiera de los tres
```
