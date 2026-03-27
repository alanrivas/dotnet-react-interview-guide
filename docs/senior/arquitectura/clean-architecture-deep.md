---
id: clean-architecture-deep
title: Clean Architecture (Profundidad)
sidebar_position: 6
---

# Clean Architecture 🧹

La arquitectura limpia de Robert C. Martin (Uncle Bob) enfatiza independencia de frameworks y facilidad de testing.

---

## Conceptos Fundamentales

### La Regla de Dependencia

> **Las dependencias SIEMPRE apuntan hacia adentro, nunca hacia afuera.**

```
        OUTER LAYERS              INNER LAYERS
        ┌─────────────────┐       ┌──────────────┐
        │ Web, DB, Mobile │──────→│ Entidades    │
        │ (External)      │       │ (Core)       │
        └─────────────────┘       └──────────────┘

CORRECTO:
Presentation → Application → Domain
        ↓          ↓          ↑
    No puede regresar así

INCORRECTO:
Domain ← Application (❌ Violaría Clean Arch)
```

### Los 4 Anillos de Clean Architecture

```
                    ┌─────────────────────────────────────┐
                    │  FRAMEWORKS & DRIVERS               │
                    │  (Web, DB, UI, Devices)             │
                    │  ┌───────────────────────────────┐  │
                    │  │    INTERFACE ADAPTERS          │  │
                    │  │ (Controllers, Presenters,      │  │
                    │  │  Gateways, Repositories impl)  │  │
                    │  │ ┌─────────────────────────────┐ │  │
                    │  │ │   APPLICATION LOGIC          │ │  │
                    │  │ │ (Use Cases, Commands, Queries)│ │  │
                    │  │ │ ┌───────────────────────────┐ │ │  │
                    │  │ │ │  ENTITIES                  │ │ │  │
                    │  │ │ │ (Objects, Rules, Events)  │ │ │  │
                    │  │ │ └───────────────────────────┘ │ │  │
                    │  │ └─────────────────────────────┘ │ │  │
                    │  └───────────────────────────────┘  │  │
                    └─────────────────────────────────────┘  │
```

---

## Capa 1: Entities (Dominio)

Las **reglas de negocio más críticas**, independientes del framework.

```csharp
namespace MiApp.Domain.Entities
{
    // ✅ PURO: Sin dependencias externas
    public class Order
    {
        public Guid Id { get; private set; }
        public Guid CustomerId { get; private set; }
        public List<OrderLineItem> LineItems { get; private set; } = new();
        public OrderStatus Status { get; private set; }
        public decimal Total { get; private set; }
        
        // REGLAS DE NEGOCIO encapsuladas
        public void AddLineItem(OrderLineItem item)
        {
            if (item.Quantity <= 0)
                throw new OrderException("Quantity must be positive");
            
            if (Status == OrderStatus.Shipped)
                throw new OrderException("Cannot add items to shipped order");
            
            LineItems.Add(item);
            RecalculateTotal();
        }
        
        public void ConfirmOrder()
        {
            if (Status != OrderStatus.Pending)
                throw new OrderException("Only pending orders can be confirmed");
            
            if (LineItems.Count == 0)
                throw new OrderException("Order must have items");
            
            Status = OrderStatus.Confirmed;
        }
        
        private void RecalculateTotal()
        {
            Total = LineItems.Sum(li => li.Total);
        }
    }
    
    public record OrderLineItem
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; }
        public decimal UnitPrice { get; set; }
        public int Quantity { get; set; }
        public decimal Total => UnitPrice * Quantity;
    }
    
    public enum OrderStatus { Pending, Confirmed, Shipped, Delivered }
}

// Prueba de la entidad (sin framework)
[TestClass]
public class OrderTests
{
    [TestMethod]
    public void AddLineItem_WithPositiveQuantity_ShouldSucceed()
    {
        var order = new Order { Id = Guid.NewGuid(), CustomerId = Guid.NewGuid() };
        var item = new OrderLineItem { ProductId = 1, Quantity = 5, UnitPrice = 10 };
        
        // ✅ Sin framework, solo C#
        order.AddLineItem(item);
        
        Assert.AreEqual(1, order.LineItems.Count);
        Assert.AreEqual(50, order.Total);
    }
}
```

**Características:**
- ✅ Sin referencias a EF Core, DTOs, Controllers
- ✅ Puro C#, fácil de testear
- ✅ Encapsula toda la lógica de negocio
- ✅ Es la capa más protegida

---

## Capa 2: Application Logic (Casos de Uso)

Contiene los **casos de uso específicos** de la aplicación.

```csharp
namespace MiApp.Application.UseCases
{
    // Input (DTO)
    public record CreateOrderRequest
    {
        public Guid CustomerId { get; set; }
        public List<CreateLineItemRequest> Items { get; set; }
    }
    
    public record CreateLineItemRequest
    {
        public int ProductId { get; set; }
        public int Quantity { get; set; }
    }
    
    // Output (DTO)
    public record CreateOrderResponse
    {
        public Guid OrderId { get; set; }
        public decimal Total { get; set; }
    }
    
    // Caso de uso
    public class CreateOrderUseCase
    {
        private readonly IOrderRepository _orderRepository;
        private readonly IProductService _productService;
        private readonly IEmailService _emailService;
        
        public CreateOrderUseCase(
            IOrderRepository orderRepository,
            IProductService productService,
            IEmailService emailService)
        {
            _orderRepository = orderRepository;
            _productService = productService;
            _emailService = emailService;
        }
        
        public async Task<CreateOrderResponse> ExecuteAsync(CreateOrderRequest request)
        {
            // 1. Validar entrada
            if (request.CustomerId == Guid.Empty)
                throw new ArgumentException("Invalid customer");
            
            // 2. Obtener datos (abstraído)
            var productDetails = await _productService.GetProductsAsync(
                request.Items.Select(i => i.ProductId).ToList()
            );
            
            // 3. Crear entidad (lógica de negocio)
            var order = new Order { Id = Guid.NewGuid(), CustomerId = request.CustomerId };
            foreach (var item in request.Items)
            {
                var product = productDetails.First(p => p.Id == item.ProductId);
                order.AddLineItem(new OrderLineItem
                {
                    ProductId = product.Id,
                    ProductName = product.Name,
                    UnitPrice = product.Price,
                    Quantity = item.Quantity
                });
            }
            
            // 4. Persistencia (abstraída mediante interfaz)
            await _orderRepository.SaveAsync(order);
            
            // 5. Notificaciones (abstraídas)
            await _emailService.SendConfirmationAsync(order.CustomerId, order);
            
            return new CreateOrderResponse
            {
                OrderId = order.Id,
                Total = order.Total
            };
        }
    }
}
```

**Características:**
- Depende de Domain e Interfaces
- No conoce EF Core, Controllers, etc.
- Usa Dependency Injection para abstraer detalles
- Fácil de testear con mocks

---

## Capa 3: Interface Adapters

Adapta datos entre casos de uso y el mundo exterior.

### Repositories (Persistencia)

```csharp
namespace MiApp.Domain.Interfaces
{
    // ✅ INTERFAZ en Domain (la define el dominio)
    public interface IOrderRepository
    {
        Task<Order> GetByIdAsync(Guid id);
        Task SaveAsync(Order order);
    }
}

namespace MiApp.Infrastructure.Persistence
{
    // ✅ IMPLEMENTACIÓN en Infrastructure
    public class OrderRepository : IOrderRepository
    {
        private readonly AppDbContext _dbContext;
        
        public OrderRepository(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        
        public async Task<Order> GetByIdAsync(Guid id)
        {
            return await _dbContext.Orders
                .Include(o => o.LineItems)
                .FirstOrDefaultAsync(o => o.Id == id);
        }
        
        public async Task SaveAsync(Order order)
        {
            if (order.Id == Guid.Empty)
                _dbContext.Orders.Add(order);
            else
                _dbContext.Orders.Update(order);
            
            await _dbContext.SaveChangesAsync();
        }
    }
}
```

### Controllers (Web)

```csharp
namespace MiApp.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrdersController : ControllerBase
    {
        private readonly CreateOrderUseCase _createOrderUseCase;
        
        public OrdersController(CreateOrderUseCase createOrderUseCase)
        {
            _createOrderUseCase = createOrderUseCase;
        }
        
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateOrderRequest request)
        {
            try
            {
                var response = await _createOrderUseCase.ExecuteAsync(request);
                return Ok(response);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }
    }
}
```

**Responsabilidades:**
- Convertir HTTP → DTOs
- Invocar Use Cases
- Convertir respuestas → HTTP

---

## Capa 4: Frameworks & Drivers

Web, Base de datos, librerías externas.

```csharp
namespace MiApp.Infrastructure.Persistence
{
    public class AppDbContext : DbContext
    {
        public DbSet<Order> Orders { get; set; }
        public DbSet<Customer> Customers { get; set; }
        
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Configuración de EF Core
            modelBuilder.Entity<Order>()
                .HasMany(o => o.LineItems)
                .WithOne()
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
```

---

## Estructura de Carpetas Clean Architecture

```
YourApp/
├── YourApp.Domain/
│   ├── Entities/
│   │   ├── Order.cs
│   │   ├── Customer.cs
│   │   └── ValueObjects/
│   ├── Interfaces/              ← Abstracciones sin deps
│   │   ├── IRepository.cs
│   │   └── IEmailService.cs
│   ├── Events/
│   │   └── OrderCreatedEvent.cs
│   └── Exceptions/
│       └── OrderException.cs
│
├── YourApp.Application/
│   ├── UseCases/
│   │   ├── CreateOrder/
│   │   │   ├── CreateOrderUseCase.cs
│   │   │   ├── CreateOrderRequest.cs
│   │   │   └── CreateOrderResponse.cs
│   │   ├── GetOrder/
│   │   └── CancelOrder/
│   ├── Interfaces/              ← Aplicación las requiere
│   │   └── ICacheService.cs
│   └── Mappers/
│       └── OrderMappingProfile.cs
│
├── YourApp.Infrastructure/
│   ├── Persistence/
│   │   ├── AppDbContext.cs
│   │   ├── Configuration/
│   │   └── OrderRepository.cs   ← Implementa IOrderRepository
│   ├── Services/
│   │   ├── EmailService.cs      ← Implementa IEmailService
│   │   └── PdfGeneratorService.cs
│   ├── External/
│   │   └── StripePaymentClient.cs
│   └── Logging/
│
├── YourApp.API/
│   ├── Controllers/
│   │   └── OrdersController.cs
│   ├── Middleware/
│   ├── Filters/
│   └── Program.cs               ← Inyección de dependencias
│
└── YourApp.Tests/
    ├── Unit/
    │   ├── Domain/
    │   │   └── OrderTests.cs
    │   └── Application/
    │       └── CreateOrderUseCaseTests.cs
    └── Integration/
        └── OrderControllerTests.cs
```

---

## Inyección de Dependencias (Program.cs)

```csharp
// Configurar todas las dependencias respetando Clean Architecture

var builder = WebApplication.CreateBuilder(args);

// Registrar Domain (no tiene dependencias)
// No necesita registro

// Registrar Application
builder.Services.AddScoped<CreateOrderUseCase>();
builder.Services.AddScoped<GetOrderUseCase>();

// Registrar Infrastructure (implementaciones)
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IProductService, ProductService>();

// Registrar DbContext (Framework)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"))
);

builder.Services.AddControllers();
var app = builder.Build();

app.MapControllers();
app.Run();
```

---

## Testing en Clean Architecture

### Unit Test (Entidad)

```csharp
[TestClass]
public class OrderEntityTests
{
    [TestMethod]
    [ExpectedException(typeof(OrderException))]
    public void ConfirmOrder_WithNoItems_ShouldThrow()
    {
        var order = new Order { Id = Guid.NewGuid() };
        order.ConfirmOrder();  // ❌ Sin items
    }
    
    [TestMethod]
    public void ConfirmOrder_WithItems_ShouldSucceed()
    {
        var order = new Order { Id = Guid.NewGuid() };
        order.AddLineItem(new OrderLineItem { Quantity = 1, UnitPrice = 100 });
        
        order.ConfirmOrder();
        
        Assert.AreEqual(OrderStatus.Confirmed, order.Status);
    }
}
```

### Integration Test (Use Case)

```csharp
[TestClass]
public class CreateOrderUseCaseTests
{
    private Mock<IOrderRepository> _mockRepository;
    private Mock<IEmailService> _mockEmailService;
    private CreateOrderUseCase _useCase;
    
    [TestInitialize]
    public void Setup()
    {
        _mockRepository = new Mock<IOrderRepository>();
        _mockEmailService = new Mock<IEmailService>();
        _useCase = new CreateOrderUseCase(_mockRepository, _mockEmailService);
    }
    
    [TestMethod]
    public async Task Execute_ShouldSaveOrderAndSendEmail()
    {
        var request = new CreateOrderRequest { ... };
        
        var response = await _useCase.ExecuteAsync(request);
        
        _mockRepository.Verify(r => r.SaveAsync(It.IsAny<Order>()), Times.Once);
        _mockEmailService.Verify(e => e.SendConfirmationAsync(...), Times.Once);
        Assert.IsNotNull(response.OrderId);
    }
}
```

---

## Beneficios de Clean Architecture

```
✅ Independencia de Frameworks
   └─ Cambiar EF Core → Dapper sin afectar lógica

✅ Testeable
   └─ 90%+ coverage, tests rápidos

✅ Mantenible
   └─ Código organizado, responsabilidades claras

✅ Escalable
   └─ Fácil agregar nuevas features

✅ Flexible
   └─ Cambiar UI, DB, servicios externos sin afectar core
```

---

## Comparativa: Layered vs Clean

| Aspecto | Layered | Clean |
|--------|---------|-------|
| **Capas** | 3-4 (similar) | 4 (más explícito) |
| **Dependencia** | Hacia adentro | Hacia adentro (CRUCIAL) |
| **Testing** | Mediano | Excelente |
| **Frameworks** | Más acoplados | Aislados en Infrastructure |
| **Framework-agnostic** | Parcialmente | ✅ Sí |

---

## Cuándo usar Clean Architecture

✅ **Usa Clean Architecture cuando:**
- Dominio es **complejo y evolucionará**
- Requieres **cambios frecuentes** de frameworks
- Necesitas **testabilidad extrema**
- Es un proyecto **long-term**

❌ **NO es necesario para:**
- CRUD simples
- Prototipos rápidos
- MVPs descartables

---

## Referencia

- 📖 **Clean Architecture** — Robert C. Martin (Uncle Bob)
- 🎥 **Clean Architecture with ASP.NET Core** — courses online

**Última actualización:** 2026-03-27
