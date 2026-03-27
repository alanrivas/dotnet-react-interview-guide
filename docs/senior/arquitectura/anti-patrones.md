---
id: anti-patrones
title: Anti-patrones Arquitectónicos
sidebar_position: 8
---

# Anti-patrones Arquitectónicos ⚠️

Errores comunes en arquitectura de software.

---

## 1. Anemia del Dominio (Anemic Domain Model)

### ¿Qué es?

Entidades vacías con solo getters/setters. Toda la lógica en servicios.

```csharp
// ❌ ANEMIA DEL DOMINIO
public class Order
{
    public Guid Id { get; set; }
    public Guid CustomerId { get; set; }
    public List<OrderLineItem> LineItems { get; set; }
    public OrderStatus Status { get; set; }
    public decimal Total { get; set; }
    // Solo data, sin lógica
}

public class OrderService
{
    public void ProcessOrder(Order order)
    {
        // Toda la lógica aquí ❌
        if (order.Total < 0) throw new Exception();
        if (order.LineItems.Count == 0) throw new Exception();
        
        if (order.Status != OrderStatus.Pending)
            throw new Exception();
        
        order.Status = OrderStatus.Confirmed;
        // ... procesamiento
    }
}

// Problemas:
// - Order no se puede usar sin OrderService
// - Lógica dispersa
// - Difícil de testear
// - Acoplamiento implícito
```

### ✅ Solución: Dominio Rico

```csharp
public class Order
{
    public Guid Id { get; private set; }
    public Guid CustomerId { get; private set; }
    public List<OrderLineItem> LineItems { get; private set; }
    public OrderStatus Status { get; private set; }
    public decimal Total { get; private set; }
    
    // ✅ Lógica encapsulada en la entidad
    public static Order CreateNew(CreateOrderDto dto)
    {
        if (string.IsNullOrEmpty(dto.CustomerId))
            throw new ArgumentException("Customer required");
        
        var order = new Order
        {
            Id = Guid.NewGuid(),
            CustomerId = dto.CustomerId,
            Status = OrderStatus.Pending
        };
        
        foreach (var item in dto.Items)
        {
            order.AddLineItem(item);
        }
        
        return order;
    }
    
    public void AddLineItem(OrderLineItemDto item)
    {
        if (item.Quantity <= 0)
            throw new OrderException("Qty must > 0");
        
        if (Status == OrderStatus.Shipped)
            throw new OrderException("Cannot edit shipped order");
        
        LineItems.Add(new OrderLineItem { ... });
        RecalculateTotal();
    }
    
    public void Confirm()
    {
        if (Status != OrderStatus.Pending)
            throw new OrderException("Only pending orders");
        
        if (LineItems.Count == 0)
            throw new OrderException("Order needs items");
        
        Status = OrderStatus.Confirmed;
    }
    
    private void RecalculateTotal()
    {
        Total = LineItems.Sum(li => li.Total);
    }
}

// ✅ Uso
var order = Order.CreateNew(dto);  // Lógica encapsulada
order.AddLineItem(item);           // Valida
order.Confirm();                    // Confirma
```

**Impacto:**
- ❌ Anemia: Code smell, difícil mantener, poco testeable
- ✅ Dominio rico: Lógica clara, testeable, reutilizable

---

## 2. Feature Envy (Envidia de Características)

### ¿Qué es?

Una clase accede constantemente a métodos/datos de otra clase.

```csharp
// ❌ FEATURE ENVY
public class OrderProcessor
{
    public decimal CalculateTotalWithDiscount(Order order, Customer customer)
    {
        // Accesa muchos atributos de Order
        decimal subtotal = order.LineItems.Sum(y => y.Price * y.Quantity);
        decimal discount = 0;
        
        // Accesa atributos de Customer (envidia)
        if (customer.MembershipLevel == "Gold")
            discount = subtotal * 0.20m;
        else if (customer.MembershipLevel == "Silver")
            discount = subtotal * 0.10m;
        
        return subtotal - discount;
    }
}

// Problema:
// - OrderProcessor "envidia" los datos de Order y Customer
// - Si Order o Customer cambian → rompe OrderProcessor
```

### ✅ Solución: Mover lógica a la clase adecuada

```csharp
// ✅ La lógica pertenece a Order
public class Order
{
    public decimal CalculateTotalWithDiscount(Customer customer)
    {
        var subtotal = LineItems.Sum(li => li.Total);
        var discount = customer.CalculateDiscount(subtotal);
        return subtotal - discount;
    }
}

public class Customer
{
    public decimal CalculateDiscount(decimal subtotal)
    {
        return MembershipLevel switch
        {
            "Gold" => subtotal * 0.20m,
            "Silver" => subtotal * 0.10m,
            _ => 0
        };
    }
}

// ✅ Uso
var total = order.CalculateTotalWithDiscount(customer);
```

---

## 3. God Object / Blob

### ¿Qué es?

Una clase hace todo: contiene 50+ propiedades, 100+ métodos.

```csharp
// ❌ GOD OBJECT
public class OrderService
{
    // Maneja órdenes
    public void CreateOrder(CreateOrderDto dto) { }
    public void UpdateOrder(...) { }
    public void DeleteOrder(...) { }
    
    // Maneja inventario
    public void ReserveInventory(...) { }
    public void ReleaseInventory(...) { }
    
    // Maneja pagos
    public void ProcessPayment(...) { }
    public void RefundPayment(...) { }
    
    // Envía emails
    public void SendConfirmationEmail(...) { }
    public void SendShippingEmail(...) { }
    
    // Logging
    public void LogOrderEvent(...) { }
    
    // Cache
    public void InvalidateOrderCache(...) { }
    
    // ... 50 métodos más
}

// Problemas:
// - Una clase hace demasiado
// - Difícil de testear
// - Difícil de cambiar
// - Violación de SRP
```

### ✅ Solución: Dividir responsabilidades

```csharp
// ✅ Clases especializadas
public class OrderService
{
    private readonly IOrderRepository _repository;
    private readonly IEmailService _email;
    
    public async Task CreateAsync(CreateOrderDto dto)
    {
        var order = Order.CreateNew(dto);
        await _repository.SaveAsync(order);
        // Solo crea órdenes
    }
}

public class InventoryService
{
    public async Task ReserveAsync(Guid orderId, List<Item> items)
    {
        // Solo maneja inventario
    }
}

public class PaymentService
{
    public async Task ProcessAsync(Payment payment)
    {
        // Solo maneja pagos
    }
}

public class OrderNotificationService
{
    public async Task SendConfirmationAsync(Order order)
    {
        // Solo envía emails
    }
}

public class CacheService
{
    public void InvalidateOrder(Guid orderId)
    {
        // Solo maneja cache
    }
}
```

---

## 4. Circular Dependencies (Dependencias Circulares)

### ¿Qué es?

A depende de B, B depende de A. Ciclo.

```csharp
// ❌ CIRCULAR DEPENDENCY
using OrderService;  // ProductService usa OrderService

public class OrderService
{
    private ProductService _productService;
    
    public OrderService(ProductService productService)
    {
        _productService = productService;  // OrderService usa ProductService
    }
}

public class ProductService
{
    private OrderService _orderService;
    
    public ProductService(OrderService orderService)
    {
        _orderService = orderService;
    }
}

// Problemas:
// - No se puede instanciar (A necesita B, B necesita A)
// - Acoplamiento fuerte
// - Difícil testear
```

### ✅ Solución: Inyectar interfaz o inverter dependencia

```csharp
// ✅ OPCIÓN 1: Interfaz
public interface IOrderService
{
    Task<Order> GetAsync(Guid id);
}

public class OrderService : IOrderService
{
    private readonly IProductService _productService;
    
    public async Task<Order> GetAsync(Guid id)
    {
        // Usa interfaz, no clase concreta
    }
}

public class ProductService : IProductService
{
    private readonly IOrderService _orderService;
    
    public async Task<Product> GetAsync(int id)
    {
        // Usa interfaz
    }
}

// ✅ OPCIÓN 2: Event-based (desacoplado)
public class OrderService
{
    private readonly IEventBus _eventBus;
    
    public async Task CreateAsync(Order order)
    {
        // No llama ProductService directamente
        await _eventBus.PublishAsync(new OrderCreatedEvent(order.Id));
    }
}

public class ProductService
{
    public async Task OnOrderCreated(OrderCreatedEvent @event)
    {
        // Reacciona al evento
    }
}
```

---

## 5. Premature Optimization (Over-engineering)

### ¿Qué es?

Optimizar antes de validar si es necesario.

```csharp
// ❌ OVER-ENGINEERING
// "Necesitaremos sharding en el futuro, así que voy a hacer..."

public interface IShardingStrategy { }
public class ConsistentHashSharding : IShardingStrategy { }
public class KetamaSharding : IShardingStrategy { }
public class RangeBasedSharding : IShardingStrategy { }

public class ShardingFactory
{
    public IShardingStrategy Create(ShardingConfig config)
    {
        // Factory pattern con múltiples estrategias
    }
}

// Resultado:
// - 1000+ líneas de código sin usar
// - Complejidad innecesaria
// - Tiempo desperdiciado
// - Mantenimiento extra
```

### ✅ Solución: YAGNI - You Aren't Gonna Need It

```csharp
// ✅ SIMPLE
public class ProductRepository
{
    private readonly AppDbContext _db;
    
    public async Task<Product> GetAsync(int id)
    {
        return await _db.Products.FindAsync(id);
    }
}

// CUANDO necesites sharding (en 2-3 años):
// Refactoriza en ese momento con datos reales
```

---

## 6. Tight Coupling (Acoplamiento Fuerte)

### ¿Qué es?

Las clases dependen directamente de implementaciones concretas.

```csharp
// ❌ ACOPLAMIENTO FUERTE
public class OrderService
{
    private readonly SmtpClient _smtpClient = new SmtpClient("smtp.gmail.com");
    private readonly SqlConnection _connection = new SqlConnection("...");
    
    public void SendConfirmation(Order order)
    {
        var message = new MailMessage(...);
        _smtpClient.Send(message);  // Acoplado a SMTP
    }
    
    public void Save(Order order)
    {
        var cmd = _connection.CreateCommand();
        // Acoplado a SQL Server
    }
}

// Problemas:
// - Imposible testear (requiere SMTP real, SQL Server real)
// - Cambiar a SendGrid requiere reescribir código
// - Cambiar a PostgreSQL requiere reescribir código
```

### ✅ Solución: Dependency Inversion

```csharp
// ✅ DESACOPLADO
public interface IEmailProvider
{
    Task SendAsync(Email email);
}

public interface IRepository<T>
{
    Task SaveAsync(T entity);
}

public class OrderService
{
    private readonly IEmailProvider _emailProvider;
    private readonly IRepository<Order> _repository;
    
    public OrderService(IEmailProvider emailProvider, IRepository<Order> repository)
    {
        _emailProvider = emailProvider;
        _repository = repository;
    }
    
    public async Task SendConfirmationAsync(Order order)
    {
        await _emailProvider.SendAsync(...);  // Interfaz
    }
    
    public async Task SaveAsync(Order order)
    {
        await _repository.SaveAsync(order);  // Interfaz
    }
}

// Para testing:
var mockProvider = new MockEmailProvider();
var mockRepository = new MockRepository<Order>();
var service = new OrderService(mockProvider, mockRepository);
```

---

## 7. CQRS Incorrecto

### ❌ Anti-patrón

```csharp
// ❌ CQRS = Command Query Responsibility Segregation
// Pero muchos lo implementan así:

// Write DB: SUPER normalizado
CREATE TABLE orders_with_line_items_and_customer_details_and_prices (...)

// Read DB: SUPER desnormalizado
CREATE TABLE orders_denormalized_for_ui (...)

// Resultado:
// - Sincronización compleja
// - Eventual consistency confusa
// - No resuelve el problema real
```

### ✅ CQRS apropiado

```csharp
// CQRS se justifica SOLO SI:
// - Patrones lectura/escritura son MUY diferentes
// - Necesitas múltiples vistas de los mismos datos
// - Escalabilidad asimétrica es crítica

// Si NO tienes eso:
// ✅ Usa un modelo simple (Read y Write idénticos)
// No es "CQRS" pero es suficiente
```

---

## 8. Microservicios Prematuros

### ❌ Anti-patrón

```
START_UP
  ↓
  "Vamos a usar Kubernetes, microservicios, event sourcing"
  ↓
1 año después:
  - 10 servicios con 2 desarrolladores
  - No pueden desplegar nada
  - Debugging imposible
  - ❌ FRACASO
```

### ✅ Evolución correcta

```
START_UP (0-6 meses)
  ✅ Monolito
  └─ Focus: MVP rápido

GROWTH (6-18 meses)
  ✅ Monolito modular (DDD)
  └─ Equipos crecen, estructura mejora

SCALE (18+ meses)
  ✅ Considera CQRS, asincrónico
  ✅ Evalúa microservicios SI:
     - Equipos >5 personas por dominio
     - Escalabilidad diferenciada EVIDENCIA
     - DevOps infraestructura MADURA
```

---

## 9. Ignorar Observabilidad

### ❌ Anti-patrón

```csharp
// El código:

public void ProcessOrder(Order order)
{
    // Lógica
    _repository.Save(order);
    // Nada de logs, metrics, traces
}

// En producción:
// "¿Por qué los órdenes no se procesan?"
// "No sé, no hay logs"
// "¿Cuál es el latency?"
// "No hay métricas"
```

### ✅ Observabilidad desde el inicio

```csharp
public async Task ProcessOrderAsync(Order order)
{
    using (_logger.BeginScope("OrderId: {0}", order.Id))
    {
        _metrics.IncrementOrdersStarted();
        
        try
        {
            _logger.LogInformation("Processing order");
            await _repository.SaveAsync(order);
            
            _metrics.RecordOrderProcessingTime(stopwatch.Elapsed);
            _logger.LogInformation("Order processed successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process order");
            _metrics.IncrementOrdersFailed();
            throw;
        }
    }
}
```

---

## Checklist: Evitar Anti-patrones

```
□ ¿Hay entidades sin lógica? (Anemia)
  └─ Mover lógica a la entidad

□ ¿Las clases acceden constantemente a otras? (Feature Envy)
  └─ Mover método a la clase adecuada

□ ¿Una clase hace todo? (God Object)
  └─ Dividir responsabilidades

□ ¿Hay dependencias circulares?
  └─ Usar interfaces o events

□ ¿He optimizado sin medir?
  └─ YAGNI: Simplificar primero

□ ¿Todo está acoplado a concretos?
  └─ Inyectar interfaces

□ ¿Estoy en una startup con microservicios?
  └─ Vuelve a monolito modular

□ ¿No hay logs/metrics?
  └─ Agregar observabilidad
```

---

## Resumen

| Anti-patrón | Síntoma | Solución |
|-------------|---------|----------|
| Anemia | Entidades sin lógica | Dominio rico |
| Feature Envy | A envidia métodos de B | Mover lógica a clase correcta |
| God Object | 100+ métodos | Dividir responsabilidades |
| Circular Deps | A ↔ B | Inyectar interfaces |
| Over-engineering | Código sin usar | YAGNI |
| Tight Coupling | Acoplado a concretos | Dependency Inversion |
| CQRS incorrecto | Usado equivocadamente | Evaluar si es realmente necesario |
| Micros prematuros | Complejidad innecesaria | Monolito modular primero |
| No observar | No sé qué passa | Logs, metrics, traces |

**Última actualización:** 2026-03-27
