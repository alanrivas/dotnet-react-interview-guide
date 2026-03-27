---
title: "🧵 Patrones Event-Driven y Comparativa"
sidebar_position: 2
---

# 🧵 Patrones Event-Driven y Comparativa

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
