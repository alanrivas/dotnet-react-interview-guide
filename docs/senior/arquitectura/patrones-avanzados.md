---
id: patrones-avanzados
title: Patrones Arquitectónicos Avanzados
sidebar_position: 5
---

# Patrones Arquitectónicos Avanzados 🚀

Patrones para sistemas distribuidos y dominios complejos.

---

## 1. CQRS — Command Query Responsibility Segregation

Separa las operaciones de lectura (queries) de las operaciones de escritura (commands).

### ¿Qué es?

```
┌────────────────────────────────────────────────────────┐
│                    APPLICATION                        │
├────────────────┬──────────────────────────────────────┤
│ WRITE SIDE     │  READ SIDE                           │
│ (Commands)     │  (Queries)                           │
├────────────────┼──────────────────────────────────────┤
│ Command        │  Query                               │
│ Handler        │  Handler                             │
│     │          │      │                               │
│     ▼          │      ▼                               │
│ ┌────────────┐ │  ┌────────────┐                      │
│ │ Write DB   │ │  │ Read DB    │                      │
│ │ (Normalized)    (Denormalized)                      │
│ └────┬───────┘ │  └────────────┘                      │
│      │         │         ▲                            │
│      └─────────┼─────────┘                            │
│       Event Stream (Sincronización)                   │
└────────────────┴──────────────────────────────────────┘
```

### Ventajas

- **Modelos optimizados** — Write DB normalizado, Read DB denormalizado
- **Escalabilidad independiente** — Escalar lecturas y escrituras por separado
- **Performance** — Read DB puede ser muy rápida (caché, índices, etc.)
- **Flexibilidad** — Múltiples vistas de lectura del mismo dato

### Implementación

```csharp
// ✅ CQRS: Separar Commands y Queries

// WRITE SIDE
public class CreateOrderCommand
{
    public Guid CustomerId { get; set; }
    public List<OrderItemDto> Items { get; set; }
}

public class CreateOrderCommandHandler : ICommandHandler<CreateOrderCommand, Guid>
{
    private readonly IOrderRepository _repository;
    private readonly IEventPublisher _eventPublisher;
    
    public async Task<Guid> Handle(CreateOrderCommand cmd)
    {
        var order = Order.CreateNew(cmd.CustomerId, cmd.Items);
        await _repository.SaveAsync(order);
        
        // Publicar eventos → sincronizan con Read DB
        foreach (var @event in order.GetDomainEvents())
        {
            await _eventPublisher.PublishAsync(@event);
        }
        
        return order.Id;
    }
}

// Proyección: Sincronizar write DB → read DB
public class OrderCreatedProjection : IConsumer<OrderCreatedEvent>
{
    private readonly IReadDbContext _readDb;
    
    public async Task Handle(OrderCreatedEvent @event)
    {
        // Crear una vista desnormalizada en Read DB
        var orderReadModel = new OrderReadModel
        {
            Id = @event.OrderId,
            CustomerId = @event.CustomerId,
            Total = @event.Total,
            ItemCount = @event.Items.Count,
            CreatedAt = DateTime.UtcNow
        };
        
        await _readDb.Orders.AddAsync(orderReadModel);
        await _readDb.SaveChangesAsync();
    }
}

// READ SIDE
public class GetOrdersQuery
{
    public Guid CustomerId { get; set; }
}

public class GetOrdersQueryHandler : IQueryHandler<GetOrdersQuery, List<OrderReadModel>>
{
    private readonly IReadDbContext _readDb;
    
    public async Task<List<OrderReadModel>> Handle(GetOrdersQuery query)
    {
        // Lectura super rápida desde Read DB (desnormalizado)
        return await _readDb.Orders
            .Where(o => o.CustomerId == query.CustomerId)
            .OrderByDescending(o => o.CreatedAt)
            .ToListAsync();
    }
}

// Modelos diferentes optimizados para cada lado
public class Order  // Write DB: Normalizado
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public List<OrderLineItem> LineItems { get; set; }
}

public class OrderReadModel  // Read DB: Desnormalizado
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public decimal Total { get; set; }
    public int ItemCount { get; set; }
    public string CustomerName { get; set; }
    public string CustomerEmail { get; set; }
    public DateTime CreatedAt { get; set; }
    // Agregados datos para lectura rápida
}
```

### Cuándo usar

✅ **Usa CQRS cuando:**
- Patrones de lectura/escritura son **muy diferentes**
- Necesitas **escalabilidad asimétrica** (muchas más lecturas que escrituras)
- Sistema es **complejo con múltiples vistas** de los mismos datos

❌ **NO uses CQRS para:**
- Aplicaciones CRUD simples
- Cuando patrones lectura/escritura son similares

---

## 2. Event Sourcing

En lugar de guardar **estado actual**, guarda **todos los eventos** que ocurrieron.

### ¿Qué es?

```
APROXIMACIÓN TRADICIONAL (State)
┌──────────┐  Put(Order)  ┌──────────────┐
│ Order Id │ ─────────────> │ Current State│
│ 123      │               │ Status: Done │
└──────────┘               | Amount: 1000 │
                           └──────────────┘

EVENT SOURCING (Events)
┌──────────────────────────────────────┐
│ Event Stream for Order 123           │
├──────────────────────────────────────┤
│ 1. OrderCreated(123, cust_5, 1000)  │
│    @2024-01-01 10:00                │
├──────────────────────────────────────┤
│ 2. OrderConfirmed(123)              │
│    @2024-01-01 10:05                │
├──────────────────────────────────────┤
│ 3. PaymentProcessed(123, paid)      │
│    @2024-01-01 10:06                │
├──────────────────────────────────────┤
│ 4. OrderShipped(123, track_abc)     │
│    @2024-01-01 11:00                │
└──────────────────────────────────────┘
     Reproducir: Order actual = Reproducir todos los eventos
```

### Ventajas

- **Audit trail completo** — Saber exactamente qué pasó y cuándo
- **Debugging** — Reproducir estado en cualquier punto del tiempo
- **Replicación** — Crear múltiples vistas publicando eventos
- **Temporal queries** — "¿Cuál era el estado el 2024-01-01?"

### Implementación

```csharp
// Eventos de dominio
public abstract record DomainEvent
{
    public Guid Id { get; } = Guid.NewGuid();
    public long Version { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public record OrderCreatedEvent(
    Guid OrderId,
    Guid CustomerId,
    decimal Total,
    List<OrderItemDto> Items
) : DomainEvent;

public record OrderConfirmedEvent(
    Guid OrderId,
    DateTime ConfirmedAt
) : DomainEvent;

public record OrderShippedEvent(
    Guid OrderId,
    string TrackingNumber
) : DomainEvent;

// Almacenamiento de eventos
public interface IEventStore
{
    Task AppendEventsAsync(Guid aggregateId, List<DomainEvent> events);
    Task<List<DomainEvent>> GetEventsAsync(Guid aggregateId);
    Task<List<DomainEvent>> GetEventsSinceAsync(Guid aggregateId, DateTime since);
}

// Agregado que maneja eventos
public class Order
{
    private List<DomainEvent> _uncommittedEvents = new();
    
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }
    public decimal Total { get; private set; }
    public List<OrderLineItem> LineItems { get; private set; } = new();
    
    // Factory: Crear orden desde evento inicial
    public static Order CreateFromEvents(List<DomainEvent> events)
    {
        var order = new Order();
        foreach (var @event in events)
        {
            order.Apply(@event);
        }
        return order;
    }
    
    // Crear nueva orden
    public static Order Create(CreateOrderDto dto)
    {
        var order = new Order();
        var @event = new OrderCreatedEvent(
            Guid.NewGuid(),
            dto.CustomerId,
            dto.Items.Sum(i => i.Price * i.Quantity),
            dto.Items
        );
        order.Apply(@event);
        order._uncommittedEvents.Add(@event);
        return order;
    }
    
    // Persistencia: Confirmar orden
    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException("Only pending orders can be confirmed");
        
        var @event = new OrderConfirmedEvent(Id, DateTime.UtcNow);
        Apply(@event);
        _uncommittedEvents.Add(@event);
    }
    
    // Persistencia: Enviar orden
    public void Ship(string trackingNumber)
    {
        if (Status != OrderStatus.Confirmed)
            throw new InvalidOperationException("Only confirmed orders can be shipped");
        
        var @event = new OrderShippedEvent(Id, trackingNumber);
        Apply(@event);
        _uncommittedEvents.Add(@event);
    }
    
    // Reproducir evento para reconstruir estado
    private void Apply(DomainEvent @event)
    {
        switch (@event)
        {
            case OrderCreatedEvent oce:
                Id = oce.OrderId;
                CustomerId = oce.CustomerId;
                Total = oce.Total;
                Status = OrderStatus.Pending;
                LineItems = oce.Items.Select(i =>
                    new OrderLineItem { ProductId = i.ProductId, Qty = i.Quantity }
                ).ToList();
                break;
                
            case OrderConfirmedEvent oce:
                Status = OrderStatus.Confirmed;
                break;
                
            case OrderShippedEvent ose:
                Status = OrderStatus.Shipped;
                break;
        }
    }
    
    public IReadOnlyList<DomainEvent> GetUncommittedEvents() => _uncommittedEvents.AsReadOnly();
    public void ClearUncommittedEvents() => _uncommittedEvents.Clear();
}

// Uso
public class OrderService
{
    private readonly IEventStore _eventStore;
    
    public async Task<Guid> CreateOrderAsync(CreateOrderDto dto)
    {
        var order = Order.Create(dto);
        await _eventStore.AppendEventsAsync(
            order.Id,
            order.GetUncommittedEvents().ToList()
        );
        order.ClearUncommittedEvents();
        return order.Id;
    }
    
    public async Task ConfirmOrderAsync(Guid orderId)
    {
        var events = await _eventStore.GetEventsAsync(orderId);
        var order = Order.CreateFromEvents(events);
        
        order.Confirm();
        
        await _eventStore.AppendEventsAsync(
            order.Id,
            order.GetUncommittedEvents().ToList()
        );
    }
    
    // Temporal query: ¿Cuál era el estado el 2024-01-01 10:05?
    public async Task<Order> GetOrderAtTimeAsync(Guid orderId, DateTime atTime)
    {
        var events = await _eventStore.GetEventsSinceAsync(orderId, atTime);
        var order = Order.CreateFromEvents(events);
        return order;
    }
}
```

### Cuándo usar

✅ **Usa Event Sourcing cuando:**
- Necesitas **audit trail completo**
- Requieres **temporal queries** (estado en punto X del tiempo)
- Trabajas con **dominios financieros/críticos**
- Necesitas **debugging avanzado**

❌ **NO uses para:**
- Aplicaciones simples CRUD
- Cuando consistencia eventual no es aceptable
- Alto volumen de eventos pequeños

---

## 3. Saga Pattern

Transacciones distribuidas en microservicios.

```
PROBLEMA: Transacción en 3 servicios
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│   Orders    │  │  Inventory   │  │  Payments   │
│  Service    │  │  Service     │  │  Service    │
└─────────────┘  └──────────────┘  └─────────────┘
      │                │                  │
      └────────────────┴──────────────────┘
        ¿Cómo mantener consistencia?

SOLUCIÓN: Saga (Orquestación de transacciones)
┌──────────────────────────────────────────────┐
│          SAGA ORCHESTRATOR                   │
│  (Coordinador de transacción distribuida)   │
├──────────────────────────────────────────────┤
│ 1. OrderService: CreateOrder ✓               │
│ 2. InventoryService: ReserveStock ✓          │
│ 3. PaymentService: ProcessPayment ✓          │
│    └─ Si falla:                              │
│       ROLLBACK (ejecutar compensaciones)     │
│       - InventoryService: UndoReservation    │
│       - OrderService: CancelOrder            │
└──────────────────────────────────────────────┘
```

### Orquestación (Orchestration Pattern)

Un orquestador central dirige los pasos:

```csharp
public class CreateOrderSaga : IEventConsumer<CreateOrderCommand>
{
    private readonly IOrderService _orderService;
    private readonly IInventoryService _inventoryService;
    private readonly IPaymentService _paymentService;
    private readonly IEventPublisher _eventPublisher;
    
    public async Task Handle(CreateOrderCommand cmd)
    {
        var sagaId = Guid.NewGuid();
        
        try
        {
            // Paso 1: Crear orden
            var order = await _orderService.CreateAsync(cmd);
            
            // Paso 2: Reservar inventario
            var inventoryReserved = await _inventoryService.ReserveAsync(
                order.Id, cmd.Items
            );
            
            if (!inventoryReserved)
            {
                await _orderService.CancelAsync(order.Id);
                throw new Exception("Could not reserve inventory");
            }
            
            // Paso 3: Procesar pago
            var paymentResult = await _paymentService.ProcessAsync(
                order.Id, order.Total
            );
            
            if (!paymentResult.Success)
            {
                // COMPENSACIÓN: Deshacer pasos anteriores
                await _inventoryService.UndoReservationAsync(order.Id);
                await _orderService.CancelAsync(order.Id);
                throw new Exception("Payment failed");
            }
            
            // Éxito: Publicar evento
            await _eventPublisher.PublishAsync(
                new OrderCompletedEvent(order.Id)
            );
        }
        catch (Exception ex)
        {
            // Log y manejo de error
            await _eventPublisher.PublishAsync(
                new OrderFailedEvent(sagaId, ex.Message)
            );
        }
    }
}
```

### Coreografía (Choreography Pattern)

Los servicios reaccionan a eventos (desacoplado):

```csharp
// OrderService emite evento
public class OrderCreatedEventPublisher
{
    private readonly IEventBus _eventBus;
    
    public async Task PublishAsync(Order order)
    {
        await _eventBus.PublishAsync(
            new OrderCreatedEvent(order.Id, order.Items)
        );
    }
}

// InventoryService escucha y reacciona
public class ReserveStockOnOrderCreated : IEventConsumer<OrderCreatedEvent>
{
    private readonly IInventoryService _inventory;
    private readonly IEventBus _eventBus;
    
    public async Task Handle(OrderCreatedEvent @event)
    {
        try
        {
            await _inventory.ReserveAsync(@event.OrderId, @event.Items);
            
            // Emitir éxito
            await _eventBus.PublishAsync(
                new StockReservedEvent(@event.OrderId)
            );
        }
        catch
        {
            // Emitir fallo
            await _eventBus.PublishAsync(
                new StockReservationFailedEvent(@event.OrderId)
            );
        }
    }
}

// PaymentService escucha StockReserved
public class ProcessPaymentOnStockReserved : IEventConsumer<StockReservedEvent>
{
    private readonly IPaymentService _payment;
    private readonly IEventBus _eventBus;
    
    public async Task Handle(StockReservedEvent @event)
    {
        try
        {
            await _payment.ProcessAsync(@event.OrderId);
            await _eventBus.PublishAsync(
                new PaymentProcessedEvent(@event.OrderId)
            );
        }
        catch
        {
            // Si pago falla, otros servicios escuchan y hacen rollback
            await _eventBus.PublishAsync(
                new PaymentFailedEvent(@event.OrderId)
            );
        }
    }
}

// Si algo falla, una saga de COMPENSACIÓN se ejecuta
public class CompensateSagaOnPaymentFailure
    : IEventConsumer<PaymentFailedEvent>
{
    private readonly IInventoryService _inventory;
    private readonly IOrderService _orders;
    
    public async Task Handle(PaymentFailedEvent @event)
    {
        // Compensación:
        await _inventory.UndoReservationAsync(@event.OrderId);
        await _orders.CancelAsync(@event.OrderId);
    }
}
```

---

## 4. Strangler Fig Pattern

Reemplazar monolito con microservicios sin stop.

```
FASE 1: Monolito con Facade
┌─────────────────────────────────┐
│  External Requests              │
│         │                       │
│         ▼                       │
│  ┌────────────────────────────┐ │
│  │ Strangler Facade           │ │
│  │ (Nuevo proxy)              │ │
│  └────────────────────────────┘ │
│    │                       │    │
│    ▼ (new)         (legacy)▼   │
│  ┌────────────────────────────┐ │
│  │ New Microservice │ Monolith  │ │
│  │ Orders Service   │ Old Code  │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘

FASE 2: Migración gradual
New Micro: 30%              Monolith: 70%
New Micro: 60%              Monolith: 40%
New Micro: 100%             Monolith: 0% ← Desconectado

VENTAJA: Despliegue sin downtime
```

---

## 5. API Gateway Pattern

Una única entrada para múltiples servicios.

```
┌──────────────────────────────────┐
│   Clients                        │
│   (Web, Mobile, Third-party)     │
└──────────────┬───────────────────┘
               │
        ┌──────▼──────┐
        │  API Gateway│
        │ (Kong, Tyk) │
        └─┬─┬─┬─┬────┬┘
          │ │ │ │    │
    ┌─────┘ │ │ │    │
    │ ┌──────┘ │ │    │
    │ │ ┌──────┘ │    │
    │ │ │ ┌──────┘    │
    ▼ ▼ ▼ ▼          ▼
  ┌────┐ ┌────┐ ┌────┐
  │Orders│ │Inventory│ │Payments│
  └────┘ └────┘ └────┘

Responsabilidades del API Gateway:
- Enrutamiento
- Autenticación/Autorización
- Rate limiting
- Transformación de payloads
- Logging/Tracing
- Cache
```

---

## Comparativa de Patrones

| Patrón | Caso de Uso | Complejidad | Cuándo Usarlo |
|--------|-----------|-----------|---|
| **CQRS** | Lectura/Escritura asimétrica | Media | Múltiples vistas, escalabilidad |
| **Event Sourcing** | Audit completo | Alta | Dominio financiero, temporal queries |
| **Saga** | Transacción distribuida | Alta | 3+ servicios, consistencia eventual |
| **Strangler Fig** | Monolito → Microservicios | Media | Migración gradual |
| **API Gateway** | Gestionar múltiples servicios | Baja | Siempre en microservicios |

---

## Resumen

```
┌─────────────────────────────────────────┐
│ PATRONES ARQUITECTÓNICOS AVANZADOS      │
├─────────────────────────────────────────┤
│ CQRS         → Escalabilidad asimétrica │
│ Event        → Histórico completo,      │
│ Sourcing       debugging avanzado       │
│ Saga         → Transacciones distribuidas
│ Strangler    → Migración sin downtime   │
│ API Gateway  → Punto único de entrada   │
└─────────────────────────────────────────┘
```

**Importante:** No uses todos simultáneamente. Cada uno resuelve un problema específico.
