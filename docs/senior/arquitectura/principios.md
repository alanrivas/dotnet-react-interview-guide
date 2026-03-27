---
id: principios
title: Principios Arquitectónicos (SOLID, KISS, DRY)
sidebar_position: 4
---

# Principios Arquitectónicos 📐

Los principios arquitectónicos son las "leyes" que guían buen diseño de software. SOLID es el conjunto más importante.

---

## SOLID Principles

### 1. S — Single Responsibility Principle (SRP)

**Una clase debe tener una única razón para cambiar.**

```csharp
// ❌ VIOLACIÓN: OrderService hace demasiadas cosas
public class OrderService
{
    public void ProcessOrder(Order order)
    {
        // Validación
        if (order.Total < 0) throw new Exception("Invalid total");
        
        // Persistencia
        var connection = new SqlConnection("...");
        var command = connection.CreateCommand();
        command.CommandText = "INSERT INTO Orders ...";
        command.ExecuteNonQuery();
        
        // Email
        var smtp = new SmtpClient("smtp.gmail.com");
        var message = new MailMessage("...", order.CustomerEmail);
        message.Body = "Order confirmed!";
        smtp.Send(message);
        
        // Logging
        var logFile = File.AppendText("log.txt");
        logFile.WriteLine($"Order {order.Id} processed");
        logFile.Close();
    }
}
// Cambios en: validación, DB, email, logging → afectan OrderService

// ✅ CORRECTO: Separar responsabilidades
public class OrderService  // Responsabilidad: Lógica de órdenes
{
    private readonly IOrderRepository _repository;
    private readonly IEmailService _emailService;
    private readonly ILogger _logger;
    
    public async Task<OrderResult> ProcessOrderAsync(Order order)
    {
        order.Validate();  // Delegado a Order (SRP)
        
        await _repository.SaveAsync(order);
        await _emailService.SendConfirmationAsync(order);
        
        _logger.LogOrderProcessed(order.Id);
        
        return new OrderResult { Success = true, OrderId = order.Id };
    }
}

public class Order  // Responsabilidad: Validar orden
{
    public void Validate()
    {
        if (Total < 0) throw new ArgumentException("Invalid total");
        if (CustomerId == Guid.Empty) throw new ArgumentException("Invalid customer");
    }
}

public interface IOrderRepository  // Responsabilidad: Persistencia
{
    Task SaveAsync(Order order);
}

public interface IEmailService  // Responsabilidad: Enviar emails
{
    Task SendConfirmationAsync(Order order);
}

public interface ILogger  // Responsabilidad: Logging
{
    void LogOrderProcessed(Guid orderId);
}
```

**Beneficios:**
- Cada clase tiene una razón clara para cambiar
- Fácil de testear
- Reutilizable
- Mantenible

---

### 2. O — Open/Closed Principle (OCP)

**Las clases deben estar abiertas para extensión pero cerradas para modificación.**

```csharp
// ❌ VIOLACIÓN: Modificar clase para agregar nuevos tipos
public class OrderProcessor
{
    public decimal CalculateDiscount(Order order)
    {
        // Cada vez que agrega tipo de cliente, modifica este método
        if (order.CustomerType == "Premium")
            return order.Total * 0.20m;
        else if (order.CustomerType == "Gold")
            return order.Total * 0.15m;
        else if (order.CustomerType == "Regular")
            return order.Total * 0.05m;
        else
            throw new Exception("Unknown customer type");
    }
}

// ✅ CORRECTO: Usar polimorfismo (Strategy pattern)
public interface IDiscountStrategy
{
    decimal CalculateDiscount(decimal total);
}

public class PremiumDiscountStrategy : IDiscountStrategy
{
    public decimal CalculateDiscount(decimal total) => total * 0.20m;
}

public class GoldDiscountStrategy : IDiscountStrategy
{
    public decimal CalculateDiscount(decimal total) => total * 0.15m;
}

public class RegularDiscountStrategy : IDiscountStrategy
{
    public decimal CalculateDiscount(decimal total) => total * 0.05m;
}

public class OrderProcessor
{
    public decimal CalculateDiscount(Order order, IDiscountStrategy strategy)
    {
        return strategy.CalculateDiscount(order.Total);
        // Nueva estrategia = nueva clase, NO modificar OrderProcessor
    }
}

// Uso
var strategy = order.CustomerType switch
{
    "Premium" => new PremiumDiscountStrategy(),
    "Gold" => new GoldDiscountStrategy(),
    _ => new RegularDiscountStrategy()
};

var discount = processor.CalculateDiscount(order, strategy);
```

**Beneficios:**
- Extensible sin riesgo de romper código existente
- Nuevas funcionalidades = new classes
- Testeable
- Mantenible

---

### 3. L — Liskov Substitution Principle (LSP)

**Los objetos de una clase derivada pueden reemplazar objetos de la clase base sin afectar la correctitud.**

```csharp
// ❌ VIOLACIÓN: Rectangle vs Square
public class Rectangle
{
    public virtual int Width { get; set; }
    public virtual int Height { get; set; }
    
    public int GetArea() => Width * Height;
}

public class Square : Rectangle
{
    // Square viola LSP: Width y Height deben ser iguales
    private int _size;
    public override int Width
    {
        get => _size;
        set => _size = value;  // ❌ También cambia Height
    }
    public override int Height
    {
        get => _size;
        set => _size = value;
    }
}

// Bug:
var shape = new Square();
shape.Width = 5;
shape.Height = 3;
Console.WriteLine(shape.Width);  // 3, no 5!
// ❌ Violaría expectativas de contrato

// ✅ CORRECTO: Jerarquía apropiada
public abstract class Shape
{
    public abstract int GetArea();
}

public class Rectangle : Shape
{
    public int Width { get; set; }
    public int Height { get; set; }
    public override int GetArea() => Width * Height;
}

public class Square : Shape
{
    public int Side { get; set; }
    public override int GetArea() => Side * Side;
}

// Ahora LSP se cumple
Shape shape = new Square { Side = 5 };
Console.WriteLine(shape.GetArea());  // 25, correcto

shape = new Rectangle { Width = 5, Height = 3 };
Console.WriteLine(shape.GetArea());  // 15, correcto
```

**Beneficios:**
- Comportamiento predecible de subclases
- Código que usa la clase base funciona con subclases
- Evita sorpresas y bugs

---

### 4. I — Interface Segregation Principle (ISP)

**Los clientes no deberían depender de interfaces que no usan.**

```csharp
// ❌ VIOLACIÓN: Interfaz "gorda"
public interface IRepository
{
    Task<T> GetByIdAsync<T>(int id);
    Task SaveAsync<T>(T entity);
    Task DeleteAsync<T>(int id);
    Task<List<T>> GetAllAsync<T>();
    Task<PagedResult<T>> GetPagedAsync<T>(int page, int pageSize);
    Task BulkInsertAsync<T>(List<T> entities);
    Task ExecuteSqlAsync(string sql);
    Task<IEnumerable<T>> ExecuteQueryAsync<T>(string sql);
    // ... 20 métodos más
}

public class OrderService
{
    private readonly IRepository _repository;  // ❌ Depende de 20 métodos, usa solo 3
    
    public async Task<Order> GetOrderAsync(int id)
    {
        return await _repository.GetByIdAsync<Order>(id);  // Solo este
    }
}

// ✅ CORRECTO: Interfaces segregadas
public interface IReadRepository<T>
{
    Task<T> GetByIdAsync(int id);
    Task<List<T>> GetAllAsync();
}

public interface IWriteRepository<T>
{
    Task SaveAsync(T entity);
    Task DeleteAsync(int id);
}

public interface IPagedRepository<T> : IReadRepository<T>
{
    Task<PagedResult<T>> GetPagedAsync(int page, int pageSize);
}

public interface ISqlRepository
{
    Task<IEnumerable<T>> ExecuteQueryAsync<T>(string sql);
}

// Ahora cada servicio depende SOLO de lo que usa
public class OrderService
{
    private readonly IReadRepository<Order> _readRepo;
    
    public async Task<Order> GetOrderAsync(int id)
    {
        return await _readRepo.GetByIdAsync(id);
    }
}

public class OrderReportService
{
    private readonly ISqlRepository _sqlRepo;
    
    public async Task<Report> GenerateReportAsync()
    {
        var data = await _sqlRepo.ExecuteQueryAsync<ReportData>(
            "SELECT ... FROM Orders WHERE ..."
        );
        return new Report(data);
    }
}
```

**Beneficios:**
- Interfaces específicas y claras
- Cada cliente depende solo de lo que necesita
- Testing simplificado
- Bajo acoplamiento

---

### 5. D — Dependency Inversion Principle (DIP)

**Depende de abstracciones, no de concreciones.**

```csharp
// ❌ VIOLACIÓN: Dependencia de implementaciones concretas
public class EmailService
{
    private readonly SmtpClient _smtpClient;  // ❌ Concretión
    private readonly SqlConnection _dbConnection;  // ❌ Concretión
    
    public void SendOrderConfirmation(Order order)
    {
        var message = new MailMessage("...", order.CustomerEmail);
        message.Body = "Order confirmed!";
        _smtpClient.Send(message);  // Acoplado a SMTP
        
        var command = _dbConnection.CreateCommand();
        command.CommandText = "INSERT INTO SentEmails ...";
        _dbConnection.ExecuteNonQuery();  // Acoplado a SQL
    }
}

// Problemas:
// - ❌ Imposible testear (requiere SMTP real)
// - ❌ Cambiar a SendGrid requiere modificar clase
// - ❌ Difícil reutilizar

// ✅ CORRECTO: Depender de abstracciones
public interface IEmailProvider
{
    Task SendAsync(Email email);
}

public interface IAuditLog
{
    Task LogEmailSentAsync(Guid orderId, string recipient);
}

public class EmailService
{
    private readonly IEmailProvider _emailProvider;  // ✅ Abstracción
    private readonly IAuditLog _auditLog;  // ✅ Abstracción
    
    public EmailService(IEmailProvider emailProvider, IAuditLog auditLog)
    {
        _emailProvider = emailProvider;
        _auditLog = auditLog;
    }
    
    public async Task SendOrderConfirmationAsync(Order order)
    {
        var email = new Email
        {
            From = "noreply@shop.com",
            To = order.CustomerEmail,
            Subject = "Order Confirmed",
            Body = "..."
        };
        
        await _emailProvider.SendAsync(email);  // Usa abstracción
        await _auditLog.LogEmailSentAsync(order.Id, order.CustomerEmail);
    }
}

// Implementaciones pueden cambiar sin afectar EmailService
public class SmtpEmailProvider : IEmailProvider
{
    private readonly ISmtpClient _client;
    public async Task SendAsync(Email email) => await _client.SendMailAsync(email);
}

public class SendGridEmailProvider : IEmailProvider
{
    private readonly ISendGridClient _client;
    public async Task SendAsync(Email email) => await _client.SendAsync(email);
}

// Para testing:
public class MockEmailProvider : IEmailProvider
{
    public List<Email> SentEmails { get; } = new();
    public Task SendAsync(Email email)
    {
        SentEmails.Add(email);
        return Task.CompletedTask;
    }
}

// Inyección de dependencias en Startup
services.AddScoped<IEmailProvider>(sp => 
    Environment.GetEnvironmentVariable("EMAIL_PROVIDER") switch
    {
        "sendgrid" => new SendGridEmailProvider(...),
        _ => new SmtpEmailProvider(...)
    }
);

// En test:
var mockProvider = new MockEmailProvider();
var service = new EmailService(mockProvider, new MockAuditLog());
await service.SendOrderConfirmationAsync(order);
Assert.AreEqual(1, mockProvider.SentEmails.Count);
```

**Beneficios:**
- Altamente testeable
- Fácil cambiar implementaciones
- Bajo acoplamiento
- Flexible

---

## Otros Principios Importantes

### DRY — Don't Repeat Yourself

**Evita código duplicado. Abstrae lógica común.**

```csharp
// ❌ REPETICIÓN
public class OrderValidator
{
    public bool ValidateOrderEmail(Order order)
    {
        if (string.IsNullOrWhiteSpace(order.Email) || 
            !order.Email.Contains("@"))
            return false;
        return true;
    }
}

public class CustomerValidator
{
    public bool ValidateCustomerEmail(Customer customer)
    {
        if (string.IsNullOrWhiteSpace(customer.Email) || 
            !customer.Email.Contains("@"))
            return false;
        return true;
    }
}

// ✅ ABSTRACCIÓN
public static class EmailValidator
{
    public static bool IsValid(string email)
    {
        return !string.IsNullOrWhiteSpace(email) && email.Contains("@");
    }
}

public class OrderValidator
{
    public bool ValidateOrderEmail(Order order) => EmailValidator.IsValid(order.Email);
}

public class CustomerValidator
{
    public bool ValidateCustomerEmail(Customer customer) => EmailValidator.IsValid(customer.Email);
}
```

### KISS — Keep It Simple, Stupid

**La solución más simple es usualmente la mejor. Evita over-engineering.**

```csharp
// ❌ OVER-ENGINEERING
public interface IStrategyFactory<T> where T : IBaseStrategy
{
    T CreateStrategy(string type);
}

public abstract class StrategyRegistry
{
    private readonly Dictionary<string, Func<IConfiguration, IStrategy>> _strategies;
}

// A veces una simple expresión switch es suficiente ✅

public static DiscountStrategy GetDiscountStrategy(Customer customer)
{
    return customer.Type switch
    {
        "Premium" => new PremiumDiscountStrategy(),
        "Gold" => new GoldDiscountStrategy(),
        _ => new RegularDiscountStrategy()
    };
}
```

### YAGNI — You Aren't Gonna Need It

**No implementes funcionalidades que "podrían ser útiles". Implementa lo que necesitas HOY.**

```csharp
// ❌ YAGNI VIOLATION: "Ah, podría necesitar soporte multi-moneda..."
public class Order
{
    public decimal Total { get; set; }
    public string Currency { get; set; }
    public ExchangeRate ExchangeRate { get; set; }
    public decimal ConvertedTotal { get; set; }
    public decimal TaxByCountry { get; set; }
    public int CountryId { get; set; }
    // ... 10 más propiedades "por si acaso"
}

// ✅ Implementa solo lo que necesitas HOY
public class Order
{
    public decimal Total { get; set; }
}

// Cuando necesites moneda, lo agregas:
public class Order
{
    public Money Total { get; set; }  // Value Object con Currency
}
```

---

## Principios Arquitectónicos Avanzados

### 1. Separation of Concerns (SoC)

Cada parte del sistema debe manejar una preocupación única.

```
┌─────────────────────────┐
│    Presentation         │  ← Cómo mostramos datos (MVC, API)
├─────────────────────────┤
│    Business Logic       │  ← QUÉ hacer (Rules, Decisions)
├─────────────────────────┤
│    Data Access          │  ← CÓMO guardar/obtener datos
├─────────────────────────┤
│    Cross-Cutting        │  ← Logging, Auth, Caching
└─────────────────────────┘
```

### 2. DRY Principle ("No Repeat Yourself") Aplicado a Arquitectura

Evita duplicar lógica entre servicios/módulos.

### 3. High Cohesion, Low Coupling

```
HIGH COHESION        LOW COUPLING
┌─────────────────┐  ┌─────────────────┐
│ Order Module    │  │ Order Module    │
├─────────────────┤  ├─────────────────┤
│ ・Order         │ ▌│ ─ ─ ─ ─ ─ ─ ─│
│ ・LineItem      │  │ References only │
│ ・Discount      │  │ via ID          │
│ ・Total Calc    │  └─────────────────┘
│ logically        │           │
│ related         │           ├─ Weak dependency
│ ✅ GOOD        │           ├─ easy to change
└─────────────────┘           ├─ easy to test
     │
     └─ Fuerte relación
        ✅ GOOD
```

### 4. Explicit Dependencies

Haz visibles todas las dependencias:

```csharp
// ❌ IMPLÍCITAS: No se ve qué necesita
public class OrderService
{
    public async Task<Order> CreateAsync(CreateOrderDto dto)
    {
        // ¿De dónde vienen las dependencias? No se sabe
        var order = new Order(dto);
        await SaveAsync(order);
        return order;
    }
}

// ✅ EXPLÍCITAS: Inyección por constructor
public class OrderService
{
    private readonly IOrderRepository _repository;
    private readonly IEmailService _emailService;
    private readonly ILogger _logger;
    
    public OrderService(
        IOrderRepository repository,         // ← Dependencias visibles
        IEmailService emailService,         // ← Claro qué necesita
        ILogger logger)                     // ← Fácil testear
    {
        _repository = repository;
        _emailService = emailService;
        _logger = logger;
    }
}
```

---

## Checklist: ¿Cumple SOLID?

```
[ ] S - Single Responsibility
    ├─ ¿Esta clase tiene una única razón para cambiar?
    └─ ¿Puedo describirla en menos de 10 palabras?

[ ] O - Open/Closed
    ├─ ¿Puedo extender sin modificar?
    └─ ¿Uso polimorfismo cuando tengo variaciones?

[ ] L - Liskov Substitution
    ├─ ¿Subclase puede reemplazar clase base sin problemas?
    └─ ¿Respeta el contrato de la clase base?

[ ] I - Interface Segregation
    ├─ ¿Mi interfaz es pequeña y específica?
    └─ ¿Clientes usan todos los métodos?

[ ] D - Dependency Inversion
    ├─ ¿Dependo de abstracciones, no de concreciones?
    └─ ¿Puedo testear fácilmente?

[ ] DRY - No Repeat Yourself
    ├─ ¿Hay código duplicado?
    └─ ¿Podría abstraerlo en una función/clase?

[ ] KISS - Keep It Simple
    ├─ ¿Es mi solución simple de entender?
    └─ ¿He over-engineered?

[ ] YAGNI - You Aren't Gonna Need It
    ├─ ¿Estoy implementando cosas "por si acaso"?
    └─ ¿Es realmente necesario hoy?
```

---

## Aplicando SOLID a un Sistema Real

```csharp
// EJEMPLO: Sistema de pagos

// 1️⃣ S: Responsabilidades claras
public interface IPaymentProcessor         { Task<PaymentResult> ProcessAsync(Payment p); }
public interface IPaymentValidator         { bool Validate(Payment p); }
public interface IPaymentAuditLog          { Task LogAsync(PaymentEvent e); }
public interface IFraudDetector            { bool IsSuspicious(Payment p); }

// 2️⃣ O: Extensible para nuevas formas de pago
public interface IPaymentGateway           { Task<GatewayResponse> SendAsync(Payment p); }
public class StripeGateway : IPaymentGateway { ... }
public class PayPalGateway : IPaymentGateway { ... }

// 3️⃣ L: Las subclases respetan el contrato
// Las clases payment pueden intercambiarse

// 4️⃣ I: Interfaces pequeñas
public interface INotificationService      { Task NotifyAsync(Payment p); }
public interface IReconciliation           { Task ReconcileAsync(Payment p); }

// 5️⃣ D: Inyección de dependencias
public class PaymentProcessingService
{
    public PaymentProcessingService(
        IPaymentValidator validator,
        IFraudDetector fraudDetector,
        IPaymentGateway gateway,
        IPaymentAuditLog auditLog,
        INotificationService notifier)
    { ... }
}

// Resultado: Extensible, testeable, mantenible ✅
```
