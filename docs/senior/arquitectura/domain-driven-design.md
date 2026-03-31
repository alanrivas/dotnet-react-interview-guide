---
id: domain-driven-design
title: Domain-Driven Design (DDD)
sidebar_position: 3
---

# Domain-Driven Design (DDD) 🎯

Domain-Driven Design es una filosofía y conjunto de patrones para diseñar software complejo, enfocándose en el **dominio del negocio** como centro del diseño.

---

## Conceptos Fundamentales

### 1. Bounded Context (Contexto Acotado)

Un **Bounded Context** es un límite explícito dentro del cual un modelo de dominio está definido y es aplicable.

```
┌────────────────────────────────────┐
│    E-COMMERCE SYSTEM               │
├────────────┬──────────────┬────────┤
│  Orders BC │ Catalog BC   │Users BC│
├────────────┼──────────────┼────────┤
│            │              │        │
│ ・Order    │ ・Product    │ ・User │
│ ・LineItem │ ・Category   │ ・Profile
│ ・Customer │ ・Inventory  │ ・Address
│   (Ref)    │ ・Price      │        │
│            │              │        │
│ Models are │ Models are   │Models are
│ different! │ different!   │different!
└────────────┴──────────────┴────────┘

Nota: "Customer" en Orders es solo una REFERENCIA (Id)
      No is un objeto full — pertenece a Users BC
```

### Por qué Bounded Contexts

```csharp
// ❌ ACOPLAMIENTO: Mismo modelo en todo el sistema
public class Product
{
    public int Id { get; set; }
    public string Name { get; set; }
    public decimal Price { get; set; }           // Orders lo necesita
    public int StockQuantity { get; set; }        // Catalog lo necesita
    public string Description { get; set; }       // Catalog lo necesita
    public List<Review> Reviews { get; set; }     // Catalog lo necesita
    public SupplierInfo SupplierDetails { get; set; }  // Catalog lo necesita
    public List<WarehouseLocation> Locations { get; set; } // Inventory
    // Product se vuelve GIGANTE y acoplado
}

// ✅ BOUNDED CONTEXTS: Modelos diferentes por contexto
namespace Catalog
{
    public class Product  // El modelo de Catalog
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public List<Review> Reviews { get; set; }
        public int CurrentStock { get; set; }
    }
}

namespace Orders
{
    public class Product  // El modelo de Orders (diferente!)
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public decimal PriceAtPurchase { get; set; }  // Precio en momento de compra
        // Solo lo que Orders necesita
    }
}

// Entre contextos: comunicación por ID y mensajes
namespace Orders
{
    public record OrderLineItem
    {
        public int ProductId { get; set; }  // Solo la referencia
        public string ProductName { get; set; }
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
    }
}
```

### 2. Aggregate (Agregado)

Un **Aggregate** es un cluster de entidades y value objects que se tratan como una unidad para cambios de datos.

**Reglas:**
- Tiene un **Aggregate Root** (la entidad principal)
- Las entidades dentro solo se acceden a través del root
- El root es responsable de mantener invariantes
- Referencias externas usan solo el ID del root

```csharp
namespace OrdersBC
{
    // ✅ CORRECTO: Order es el Aggregate Root
    public class Order
    {
        public Guid Id { get; private set; }
        public Guid CustomerId { get; private set; }
        public List<OrderLineItem> LineItems { get; private set; } = new();
        public OrderStatus Status { get; private set; }
        public decimal Total { get; private set; }

        // Invariante: Un orden no puede estar vacía
        public void AddLineItem(int productId, string productName, decimal price, int qty)
        {
            if (qty <= 0) throw new ArgumentException("Quantity must > 0");
            
            var item = new OrderLineItem(productId, productName, price, qty);
            LineItems.Add(item);
            RecalculateTotal();
        }

        // El agregado controla su estado
        public void ConfirmOrder()
        {
            if (Status != OrderStatus.Pending) 
                throw new InvalidOperationException("Only pending orders can be confirmed");
            Status = OrderStatus.Confirmed;
        }

        private void RecalculateTotal()
        {
            Total = LineItems.Sum(li => li.Total);
        }
    }

    // ❌ NO es un Aggregate Root (es parte de Order)
    public class OrderLineItem
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; }
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        
        public decimal Total => UnitPrice * Quantity;
    }

    // En repositorio: siempre trabaja con el Aggregate Root
    public interface IOrderRepository
    {
        Task<Order> GetByIdAsync(Guid orderId);  // ✅ Retorna Order completo
        Task SaveAsync(Order order);              // ✅ Guarda Order y sus LineItems
        
        // ❌ EVITA esto:
        // Task<OrderLineItem> GetLineItemAsync(int lineItemId);
    }
}
```

### 3. Value Object

Un objeto sin identidad que representa un valor o concepto del dominio.

```csharp
// ❌ MALO: Usar tipos primitivos directamente
public class Order
{
    public Guid Id { get; set; }
    public decimal TotalAmount { get; set; }        // ¿Qué moneda?
    public string Email { get; set; }               // ¿Validado?
    public string PhoneNumber { get; set; }         // ¿Validado?
    public int Quantity { get; set; }               // ¿Puede ser negativo?
}

// ✅ BUENO: Value Objects
public record Money(decimal Amount, string Currency)
{
    public static Money Zero(string currency) => new(0, currency);
    public Money Add(Money other)
    {
        if (other.Currency != Currency) 
            throw new InvalidOperationException("Cannot add different currencies");
        return new Money(Amount + other.Amount, Currency);
    }
}

public record Email(string Value)
{
    public Email(string value) : this(ValidateEmail(value)) { }
    
    private static string ValidateEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || !email.Contains("@"))
            throw new ArgumentException("Invalid email");
        return email;
    }
    
    public override string ToString() => Value;
}

public record PhoneNumber(string Value)
{
    public PhoneNumber(string value) : this(ValidatePhone(value)) { }
    
    private static string ValidatePhone(string phone)
    {
        if (!Regex.IsMatch(phone, @"^[0-9\-\+\(\)\s]{10,}$"))
            throw new ArgumentException("Invalid phone");
        return phone;
    }
}

public record Quantity(int Value)
{
    public Quantity(int value) : this(
        value > 0 ? value : throw new ArgumentException("Quantity must > 0")
    ) { }
}

// Uso
public class Order
{
    public Guid Id { get; set; }
    public Money Total { get; set; }          // Type-safe, validado
    public Email CustomerEmail { get; set; }  // Type-safe, validado
    public PhoneNumber Phone { get; set; }    // Type-safe, validado
    public Quantity Qty { get; set; }         // Type-safe, validado
}

// Beneficios
var order = new Order
{
    Id = Guid.NewGuid(),
    Total = new Money(100, "USD"),
    CustomerEmail = new Email("user@example.com"),  // Validación automática
    Phone = new PhoneNumber("+1-555-123-4567"),
    Qty = new Quantity(5)
};

// Operaciones seguras
var total2 = order.Total.Add(new Money(50, "USD"));  // ✅ OK
// var invalid = order.Total.Add(new Money(50, "EUR")); // ❌ Exception
```

### 4. Entity

Objeto con identidad única que es mutable y rastreable.

```csharp
// ❌ MALO: Entity sin identidad clara
public class Customer
{
    public string Email { get; set; }  // Cambios de email causarían problemas
    public string Name { get; set; }
}

// ✅ BUENO: Entity con identidad única
public class Customer
{
    public Guid Id { get; private set; }  // Identidad única e inmutable
    public Email Email { get; set; }
    public string Name { get; set; }
    
    // El Id NO cambia aunque el email cambie
    public void UpdateEmail(Email newEmail)
    {
        Email = newEmail;
        // Id sigue siendo el mismo
    }
}

public class Order
{
    public Guid Id { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CustomerId { get; private set; }  // Solo la referencia
    // No: public Customer Customer { get; set; }  // ❌ Acoplamiento
}
```

### 5. Domain Event (Evento de Dominio)

Representa algo importante que ocurrió en el dominio.

```csharp
// Eventos de dominio
public abstract record DomainEvent
{
    public Guid Id { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}

public record OrderCreatedEvent(
    Guid OrderId,
    Guid CustomerId,
    Money Total,
    List<OrderLineItem> Items
) : DomainEvent;

public record OrderConfirmedEvent(
    Guid OrderId,
    DateTime ConfirmedAt
) : DomainEvent;

public record OrderShippedEvent(
    Guid OrderId,
    string TrackingNumber
) : DomainEvent;

// En la entidad
public class Order
{
    private List<DomainEvent> _domainEvents = new();
    
    public Guid Id { get; set; }
    public OrderStatus Status { get; set; }
    public Money Total { get; set; }
    
    public static Order CreateNew(CreateOrderDto dto)
    {
        var order = new Order
        {
            Id = Guid.NewGuid(),
            Status = OrderStatus.Pending,
            Total = dto.Total
        };
        
        // Registrar evento
        order._domainEvents.Add(new OrderCreatedEvent(
            order.Id, dto.CustomerId, order.Total, dto.Items
        ));
        
        return order;
    }
    
    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new InvalidOperationException();
        
        Status = OrderStatus.Confirmed;
        _domainEvents.Add(new OrderConfirmedEvent(Id, DateTime.UtcNow));
    }
    
    public IReadOnlyList<DomainEvent> GetDomainEvents() => _domainEvents.AsReadOnly();
    
    public void ClearDomainEvents() => _domainEvents.Clear();
}

// En aplicación/repositorio
public class CreateOrderCommandHandler
{
    private readonly IOrderRepository _repository;
    private readonly IEventPublisher _eventPublisher;
    
    public async Task Handle(CreateOrderCommand cmd)
    {
        var order = Order.CreateNew(cmd.ToDto());
        await _repository.SaveAsync(order);
        
        // Publicar eventos de dominio
        foreach (var @event in order.GetDomainEvents())
        {
            await _eventPublisher.PublishAsync(@event);
        }
        
        order.ClearDomainEvents();
    }
}
```

---

## Patrones DDD

### 1. Specification Pattern

Para encapsular lógica de query compleja:

```csharp
public abstract class Specification<T>
{
    public Expression<Func<T, bool>> Criteria { get; protected set; }
    public List<Expression<Func<T, object>>> Includes { get; } = new();
    public bool IsPagingEnabled { get; protected set; }
    public int PageNumber { get; protected set; }
    public int PageSize { get; protected set; }
    
    protected virtual void AddInclude(Expression<Func<T, object>> includeExpression)
    {
        Includes.Add(includeExpression);
    }
}

// Implementación
public class OrdersByCustomerSpecification : Specification<Order>
{
    public OrdersByCustomerSpecification(Guid customerId, OrderStatus? status = null)
    {
        Criteria = o => o.CustomerId == customerId && 
                       (status == null || o.Status == status);
        
        AddInclude(o => o.LineItems);
        
        IsPagingEnabled = true;
        PageNumber = 1;
        PageSize = 10;
    }
}

// Uso
var spec = new OrdersByCustomerSpecification(customerId, OrderStatus.Confirmed);
var orders = await _repository.ListAsync(spec);
```

### 2. Repository Pattern

```csharp
// ✅ CORRECTO: Abstractar persistencia
public interface IOrderRepository
{
    Task<Order> GetByIdAsync(Guid id);
    Task<List<Order>> GetByCustomerAsync(Guid customerId);
    Task SaveAsync(Order order);
    Task DeleteAsync(Guid id);
}

public class OrderRepository : IOrderRepository
{
    private readonly AppDbContext _db;
    
    public async Task<Order> GetByIdAsync(Guid id)
    {
        return await _db.Orders
            .Include(o => o.LineItems)
            .FirstOrDefaultAsync(o => o.Id == id);
    }
    
    public async Task SaveAsync(Order order)
    {
        if (order.Id == Guid.Empty)
            _db.Orders.Add(order);
        else
            _db.Orders.Update(order);
        
        await _db.SaveChangesAsync();
    }
}
```

### 3. Factory Pattern

Para crear agregados complejos:

```csharp
public class OrderFactory
{
    public static Order CreateFromCart(Cart cart, Customer customer)
    {
        if (cart.IsEmpty) 
            throw new InvalidOperationException("Cart cannot be empty");
        
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            Total = cart.CalculateTotal(),
            Status = OrderStatus.Pending
        };
        
        foreach (var cartItem in cart.Items)
        {
            order.AddLineItem(
                cartItem.ProductId,
                cartItem.ProductName,
                cartItem.Price,
                cartItem.Quantity
            );
        }
        
        return order;
    }
}

// Uso
var order = OrderFactory.CreateFromCart(cart, customer);
```

---

## Context Mapping (Relación entre Bounded Contexts)

```
┌──────────────────┐         ┌──────────────────┐
│   Orders BC      │         │ Catalog BC       │
├──────────────────┤         ├──────────────────┤
│ ・Order          │         │ ・Product        │
│ ・LineItem       │         │ ・Category       │
└──────────────────┘         │ ・Price          │
        ▲                      └──────────────────┘
        │
        └─── PARTNERSHIP
             ↓
        Compartir eventos
        Order publica: OrderPlaced
        Catalog subscribe: Actualizar inventario

     ┌──────────────────┐     ┌──────────────────┐
     │ Payments BC      │     │ Notification BC  │
     ├──────────────────┤     ├──────────────────┤
     │ ・Payment        │     │ ・Notification   │
     │ ・Transaction    │     │ ・Template       │
     └──────────────────┘     └──────────────────┘
             ▲                        ▲
             └────────────────────────┘
                    CUSTOMER

          Both consume OrderPlaced event
          Payments: initiate payment
          Notification: send email/SMS
```

---

## Anti-patrones en DDD

```csharp
// ❌ ANTI-PATRÓN: Anemia del dominio
public class OrderEntity
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public List<OrderLineItemEntity> LineItems { get; set; }
    public OrderStatus Status { get; set; }
    // Solo getters/setters, sin lógica
}

public class OrderService
{
    public void CreateOrder(CreateOrderDto dto)
    {
        // Toda la lógica aquí ❌
        var order = new OrderEntity { Id = Guid.NewGuid() };
        foreach (var item in dto.Items)
        {
            if (item.Quantity <= 0) throw new Exception();
            order.LineItems.Add(new OrderLineItemEntity { ... });
        }
        order.Status = OrderStatus.Pending;
        _repository.Save(order);
    }
}

// ✅ CORRECTO: Dominio rico
public class Order
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public List<OrderLineItem> LineItems { get; private set; } = new();
    public OrderStatus Status { get; private set; }
    
    public static Order CreateNew(CreateOrderDto dto)  // Factory
    {
        var order = new Order { Id = Guid.NewGuid() };
        foreach (var item in dto.Items)
        {
            order.AddLineItem(item); // Lógica encapsulada
        }
        return order;
    }
    
    public void AddLineItem(CreateLineItemDto item)
    {
        // Validación y lógica aquí ✅
        if (item.Quantity <= 0) throw new Exception();
        // ...
    }
}
```

---

## Cuándo usar DDD

✅ **Usa DDD cuando:**
- Dominio es **complejo y evoluciona**
- Requieres **comunicación constante con expertos del negocio**
- Tienes **múltiples equipos** trabajando en dominios diferentes
- Necesitas **modelos diferentes** por contexto
- La aplicación es **long-lived** (no es un MVP descartable)

❌ **NO uses DDD para:**
- CRUD simples
- MVP inicial (aprende primero, refactoriza después)
- Dominios triviales

---

## Estructura de proyecto DDD

```
YourProject/
├── YourProject.Api/
│   └── Controllers/
├── YourProject.Domain/              # El dominio, sin deps externas
│   ├── Orders/
│   │   ├── Order.cs (Aggregate Root)
│   │   ├── OrderLineItem.cs (Entity)
│   │   ├── OrderStatus.cs (Value Object)
│   │   └── IOrderRepository.cs (interface)
│   ├── Shared/
│   │   ├── Entity.cs (base class)
│   │   ├── ValueObject.cs (base class)
│   │   └── DomainEvent.cs
│   └── Events/
│       ├── OrderCreatedEvent.cs
│       └── OrderConfirmedEvent.cs
├── YourProject.Application/        # Use cases, handlers
│   ├── Orders/
│   │   ├── Commands/
│   │   │   ├── CreateOrderCommand.cs
│   │   │   └── CreateOrderCommandHandler.cs
│   │   └── Queries/
│   │       ├── GetOrderQuery.cs
│   │       └── GetOrderQueryHandler.cs
│   └── Mapping/
│       └── OrderMappingProfile.cs
├── YourProject.Infrastructure/    # Persistencia, APIs externas
│   ├── Persistence/
│   │   ├── OrderRepository.cs
│   │   └── AppDbContext.cs
│   └── ExternalServices/
│       └── PaymentService.cs
└── YourProject.Tests/
    ├── Unit/
    │   └── OrderTests.cs
    └── Integration/
        └── CreateOrderTests.cs
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuándo aplicarías DDD y cuándo no?**
> **Aplicar DDD cuando**: el dominio es complejo con reglas de negocio no triviales, hay un equipo dedicado y expertos del dominio disponibles, el proyecto tiene vida útil larga y crecerá. **No aplicar cuando**: es un CRUD simple, un script de procesamiento de datos, un proyecto pequeño o de vida corta. DDD tiene overhead real — no usar en proyectos donde no justifique.

**2. ¿Qué es un Aggregate Root y cuál es su responsabilidad?**
> El Aggregate Root es el único punto de entrada al Aggregate. Garantiza las invariantes del negocio (ej: un Pedido no puede tener items con precio negativo). Solo el Root tiene un repositorio propio. Las entidades internas solo se modifican a través del Root, nunca directamente desde fuera.

**3. ¿Cómo comunicas cambios entre Bounded Contexts?**
> Mediante Domain Events y mensajería asíncrona (MassTransit, RabbitMQ). Cada BC es autónomo — no comparte su base de datos ni su modelo de dominio. El BC emisor publica un evento; el BC receptor lo consume y actualiza su propio modelo. Esto garantiza bajo acoplamiento y eventual consistency.

**4. ¿Cuál es la diferencia entre una Entity y un Value Object?**
> **Entity**: tiene identidad única que persiste en el tiempo (un Usuario con Id=42 sigue siendo el mismo aunque cambie su email). **Value Object**: definido por sus atributos, sin identidad propia (una Dirección con calle="Main St" es igual a cualquier otra Dirección con los mismos campos). Los Value Objects son inmutables y se comparan por valor.

**5. ¿Cómo evitas que el modelo de dominio se corrompa por dependencias externas (Anti-Corruption Layer)?**
> Implementando un ACL como un adaptador en la capa de Infrastructure. Traduce el modelo externo al modelo de dominio interno. El dominio solo conoce sus propias interfaces — nunca toca directamente SDKs, APIs externas o modelos de otras BCs. El ACL es el "guardabosques" que mantiene el modelo limpio.
