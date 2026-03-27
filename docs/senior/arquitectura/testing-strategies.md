---
id: testing-strategies
title: Estrategias de Testing por Arquitectura
sidebar_position: 8
---

# Estrategias de Testing por Arquitectura 🧪

La estrategia de testing cambio fundamentalmente dependiendo de tu arquitectura. Este documento te enseña qué testear, cómo y con qué herramientas según tu estilo arquitectónico.

---

## Pirámide de Testing Universal

```
            /\
           /  \
          / E2E \        5-10% — Pocos tests,  alto valor, lento
         /________\
        /          \
       /  Integration\    15-25% — Tests medianos
      /              \
     /________________\
    /                  \
   /   Unit Tests       \  65-75% — Rápidos, específicos
  /____________________\

Principio: MUCHOS tests rápidos (base), POCOS tests lentos (techo)
```

**Regla:**
- Unit: Objetivo es lógica pura, aislada (sin BD, sin HTTP)
- Integration: Objetivo es que A pueda hablar con B (BD, APIs)
- E2E: Objetivo es flujo completo usuario → usuario

---

## 1️⃣ Testing en MONOLITO (Layered + SOLID)

### Estructura de Tests

```
src/
  Orders/
    Controllers/ → Tests: OrdersControllerTests
    Services/ → Tests: OrderServiceTests
    Repositories/ → Tests: OrderRepositoryTests
    Models/ → Tests: OrderTests (Value Objects, Aggregates)
```

### Estrategia: Pirámide Clásica

```
              E2E (API)
         ↑────────────↑
      Integration
    (Mock BD, real servicios)
  ↑──────────────────────↑
       Unit Tests
   (Todo mockeado)
```

### Ejemplo: OrderService

```csharp
// ✅ UNIT TEST — Todo mockeado
public class OrderServiceTests
{
    private readonly Mock<IOrderRepository> _mockRepository;
    private readonly Mock<IEmailService> _mockEmailService;
    private readonly OrderService _service;
    
    public OrderServiceTests()
    {
        _mockRepository = new Mock<IOrderRepository>();
        _mockEmailService = new Mock<IEmailService>();
        _service = new OrderService(_mockRepository.Object, _mockEmailService.Object);
    }
    
    [Fact]
    public async Task CreateOrder_WithValidDto_ReturnsOrderId()
    {
        // Arrange
        var dto = new CreateOrderDto 
        { 
            CustomerId = Guid.NewGuid(),
            Items = new List<OrderItemDto> 
            { 
                new OrderItemDto { ProductId = 1, Quantity = 5, Price = 100 }
            }
        };
        
        var expectedOrderId = Guid.NewGuid();
        var savedOrder = new Order { Id = expectedOrderId, CustomerId = dto.CustomerId };
        
        _mockRepository
            .Setup(r => r.SaveAsync(It.IsAny<Order>()))
            .Callback<Order>(o => o.Id = expectedOrderId)
            .Returns(Task.CompletedTask);
        
        // Act
        var result = await _service.CreateOrderAsync(dto);
        
        // Assert
        Assert.Equal(expectedOrderId, result);
        _mockRepository.Verify(r => r.SaveAsync(It.IsAny<Order>()), Times.Once);
        _mockEmailService.Verify(e => e.SendConfirmationAsync(It.IsAny<Email>()), Times.Once);
    }
    
    [Fact]
    public async Task CreateOrder_WithInvalidItems_ThrowsException()
    {
        // Arrange
        var dto = new CreateOrderDto 
        { 
            Items = new List<OrderItemDto>() // Empty
        };
        
        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => 
            _service.CreateOrderAsync(dto)
        );
    }
}

// ✅ INTEGRATION TEST — Con BD real (o testcontainers)
public class OrderRepositoryIntegrationTests : IAsyncLifetime
{
    private readonly SqliteConnection _connection;
    private readonly AppDbContext _dbContext;
    private readonly OrderRepository _repository;
    
    public async Task InitializeAsync()
    {
        // Setup BD en memoria para test
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(_connection)
            .Options;
            
        _dbContext = new AppDbContext(options);
        await _dbContext.Database.EnsureCreatedAsync();
        
        _repository = new OrderRepository(_dbContext);
    }
    
    [Fact]
    public async Task SaveAsync_WithValidOrder_PersistsToDatabase()
    {
        // Arrange
        var order = new Order 
        { 
            Id = Guid.NewGuid(),
            CustomerId = Guid.NewGuid(),
            Total = 100,
            Status = OrderStatus.Pending
        };
        order.AddLineItem(1, "Product", 50, 2);
        
        // Act
        await _repository.SaveAsync(order);
        
        // Assert
        var retrieved = await _repository.GetByIdAsync(order.Id);
        Assert.NotNull(retrieved);
        Assert.Equal(100, retrieved.Total);
        Assert.Single(retrieved.LineItems);
    }
    
    public async Task DisposeAsync()
    {
        await _dbContext.DisposeAsync();
        _connection.Dispose();
    }
}

// ✅ E2E TEST — HTTP real
public class OrderApiE2ETests : IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    
    public async Task InitializeAsync()
    {
        _factory = new WebApplicationFactory<Program>();
        _client = _factory.CreateClient();
        
        // Seed datos si es necesario
        using var scope = _factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetService<AppDbContext>();
        await context.Database.EnsureCreatedAsync();
    }
    
    [Fact]
    public async Task CreateOrder_EndToEnd_ReturnsOkWithOrderId()
    {
        // Arrange
        var request = new CreateOrderDto
        {
            CustomerId = Guid.NewGuid(),
            Items = new List<OrderItemDto>
            {
                new OrderItemDto { ProductId = 1, Quantity = 3, Price = 99.99m }
            }
        };
        
        var json = JsonSerializer.Serialize(request);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        // Act
        var response = await _client.PostAsync("/api/orders", content);
        
        // Assert
        Assert.True(response.IsSuccessStatusCode);
        var resultJson = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<OrderResponse>(resultJson);
        Assert.NotNull(result?.OrderId);
    }
    
    public Task DisposeAsync()
    {
        _client.Dispose();
        _factory.Dispose();
        return Task.CompletedTask;
    }
}
```

### Checklist: Monolito bien testeado

- [ ] Unit tests para toda lógica de negocio (Services, Value Objects)
- [ ] Unit tests mínimo para Controllers (validación, mapeo)
- [ ] Integration tests para Repositories y APIs externas
- [ ] Tests de API end-to-end para happy paths críticos
- [ ] Coverage meta: 70%+ líneas, 85%+ lógica crítica
- [ ] Tests corren en < 30 segundos (para CI/CD rápido)

---

## 2️⃣ Testing en MODULAR MONOLITH

### Estructura de Tests

```
core/
  Orders/ (Modulo 1)
    Tests/
      OrderServiceTests
      OrderRepositoryTests
      OrderIntegrationTests ← Importante: test comunicación inter-módulos
  Inventory/ (Modulo 2)
    Tests/
  Payments/ (Modulo 3)
    Tests/

tests/
  CrossModuleTests/    ← Prueba que módulos interactúan correctamente
    OrderToInventoryTests
    PaymentsIntegrationTests
```

### Nueva Responsabilidad: Tests de Integración entre Módulos

```csharp
// ✅ TEST: Verification de contrato entre módulos
public class OrderInventoryIntegrationTests : IAsyncLifetime
{
    private readonly IOrderService _orderService;
    private readonly IInventoryService _inventoryService;
    private readonly AppDbContext _dbContext;
    
    public async Task InitializeAsync()
    {
        // Setup compartido
        var services = new ServiceCollection();
        services.AddOrderServices();                    // Modulo Orders
        services.AddInventoryServices();                // Modulo Inventory
        services.AddDbContext<AppDbContext>();
        
        var provider = services.BuildServiceProvider();
        _orderService = provider.GetRequiredService<IOrderService>();
        _inventoryService = provider.GetRequiredService<IInventoryService>();
        _dbContext = provider.GetRequiredService<AppDbContext>();
        
        await _dbContext.Database.EnsureCreatedAsync();
    }
    
    [Fact]
    public async Task CreateOrder_ConsumesInventory_AndUpdatesCounts()
    {
        // Arrange: Seed inventory
        var productId = 1;
        await _inventoryService.AddStockAsync(productId, 100);
        
        // Act: Crear orden que consume inventario
        var orderId = await _orderService.CreateOrderAsync(new CreateOrderDto
        {
            Items = new[] { new OrderItemDto { ProductId = productId, Quantity = 50 } }
        });
        
        // Assert: Verificar que inventory bajó
        var remainingStock = await _inventoryService.GetStockAsync(productId);
        Assert.Equal(50, remainingStock);
    }
    
    [Fact]
    public async Task WhenOrderCancelled_InventoryIsRestored()
    {
        // Arrange
        var productId = 1;
        await _inventoryService.AddStockAsync(productId, 100);
        var orderId = await _orderService.CreateOrderAsync(new CreateOrderDto
        {
            Items = new[] { new OrderItemDto { ProductId = productId, Quantity = 50 } }
        });
        
        // Act: Cancelar orden
        await _orderService.CancelOrderAsync(orderId);
        
        // Assert: Stock debe restaurarse
        var newStock = await _inventoryService.GetStockAsync(productId);
        Assert.Equal(100, newStock);
    }
    
    public async Task DisposeAsync()
    {
        await _dbContext.DisposeAsync();
    }
}

// ✅ TEST: Contrato de eventos entre módulos
public class OrderEventsTests : IAsyncLifetime
{
    private readonly IOrderService _orderService;
    private readonly IEventPublisher _eventPublisher;
    private readonly List<DomainEvent> _capturedEvents = new();
    
    public async Task InitializeAsync()
    {
        var services = new ServiceCollection();
        services.AddOrderServices();
        
        // Mock event publisher para capturar eventos
        var mockPublisher = new Mock<IEventPublisher>();
        mockPublisher
            .Setup(p => p.PublishAsync(It.IsAny<DomainEvent>()))
            .Callback<DomainEvent>(e => _capturedEvents.Add(e))
            .Returns(Task.CompletedTask);
        
        services.AddSingleton(mockPublisher.Object);
        _eventPublisher = mockPublisher.Object;
        _orderService = services.BuildServiceProvider().GetRequiredService<IOrderService>();
        
        await Task.CompletedTask;
    }
    
    [Fact]
    public async Task CreateOrder_PublishesOrderCreatedEvent()
    {
        // Act
        var orderId = await _orderService.CreateOrderAsync(new CreateOrderDto
        {
            CustomerId = Guid.NewGuid(),
            Items = new[] { new OrderItemDto { ProductId = 1, Quantity = 1 } }
        });
        
        // Assert
        var createdEvent = _capturedEvents
            .OfType<OrderCreatedEvent>()
            .FirstOrDefault();
        
        Assert.NotNull(createdEvent);
        Assert.Equal(orderId, createdEvent.OrderId);
    }
    
    public Task DisposeAsync() => Task.CompletedTask;
}
```

### Checklist: Modular Monolith bien testeado

- [ ] Unit tests dentro de cada módulo (como monolito)
- [ ] **Integration tests entre módulos** (contrato de eventos, datos compartidos)
- [ ] Tests de "happy path" para workflows cross-módulo
- [ ] Simulación de fallo de módulo (si uno falla, ¿qué pasa al otro?)
- [ ] Coverage: 70%+ total, 85%+ lógica crítica
- [ ] Tests corren en < 1 minuto

---

## 3️⃣ Testing en MICROSERVICIOS

### Estructura de Tests

```
orders-service/
  src/
  tests/
    Unit/         — Tests de OrderService, Controllers
    Integration/  — Tests de OrderRepository, BD local
    Contract/     — Contract tests (verifica acuerdos con otros servicios)

inventory-service/
payments-service/

tests/
  E2E/           — Flujo completo multi-servicio
  ContractTests/ — Verifica compatibilidad entre servicios
```

### Pirámide modicada para microservicios

```
         E2E (multi-service)
       ↑────────────────────↑
    Contract Tests
  (Verifica que servicios
   hablan correctamente)
↑──────────────────────────────↑
  Integration (local BD)
    Service Unit Tests
   (Rápidos, aislados)
```

### Ejemplo 1: Contract Test (Verifica compatibilidad de APIs)

```csharp
// ✅ CONTRACT TEST — Verifica que OrderService conoce contrato de InventoryService
[TestClass]
public class InventoryServiceContractTests
{
    private const string InventoryServiceUrl = "http://inventory-service:5001";
    
    [TestMethod]
    public async Task InventoryService_ReserveStock_ReturnsExpectedResponse()
    {
        var client = new HttpClient();
        
        // Act: Llamar exactamente como OrderService lo haría
        var response = await client.PostAsJsonAsync(
            $"{InventoryServiceUrl}/api/stock/reserve",
            new { productId = 1, quantity = 5 }
        );
        
        // Assert: Respuesta tiene formato esperado
        Assert.IsTrue(response.IsSuccessStatusCode);
        
        var result = await response.Content.ReadAsAsync<StockReserveResponse>();
        Assert.IsNotNull(result.ReservationId);
        Assert.AreEqual(5, result.ReservedQuantity);
    }
    
    [TestMethod]
    public async Task InventoryService_ReserveStock_WithInsufficientStock_Returns400()
    {
        var client = new HttpClient();
        
        var response = await client.PostAsJsonAsync(
            $"{InventoryServiceUrl}/api/stock/reserve",
            new { productId = 1, quantity = 9999 }  // Más del disponible
        );
        
        // Contract especifica: debe retornar 400
        Assert.AreEqual(HttpStatusCode.BadRequest, response.StatusCode);
    }
}

// ✅ CONTRACT TEST — Verifica que OrderService publica eventos correctamente
[TestClass]
public class OrderServiceEventContractTests
{
    private readonly IMessageBroker _broker;
    
    [TestMethod]
    public async Task OrderService_PublishesOrderCreatedEvent_WithRequiredFields()
    {
        var capturedMessage = new TaskCompletionSource<Message>();
        
        _broker.Subscribe<OrderCreatedEvent>(msg => 
        {
            capturedMessage.SetResult(msg);
            return Task.CompletedTask;
        });
        
        // Act: Crear una orden
        var orderService = new OrderService(...);
        await orderService.CreateOrderAsync(new CreateOrderDto { ... });
        
        // Assert: Evento tiene estructura esperada
        var @event = await capturedMessage.Task;
        Assert.IsNotNull(@event.OrderId);
        Assert.IsNotNull(@event.CustomerId);
        Assert.IsNotNull(@event.Total);
    }
}
```

### Ejemplo 2: Integration Test (Servicio completo localmente)

```csharp
// ✅ INTEGRATION TEST — Todo el servicio con BD real
public class OrderServiceIntegrationTests : IAsyncLifetime
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;
    private readonly AppDbContext _dbContext;
    
    public async Task InitializeAsync()
    {
        // WithEnvironment para usar BD de test
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment("Test");
            });
        
        _client = _factory.CreateClient();
        _dbContext = _factory.Services.GetRequiredService<AppDbContext>();
        await _dbContext.Database.EnsureCreatedAsync();
    }
    
    [Fact]
    public async Task CreateOrder_WithValidData_Succeeds()
    {
        var response = await _client.PostAsJsonAsync("/api/orders", new
        {
            customerId = Guid.NewGuid(),
            items = new[] { new { productId = 1, quantity = 5 } }
        });
        
        Assert.True(response.IsSuccessStatusCode);
    }
    
    public async Task DisposeAsync()
    {
        await _dbContext.DisposeAsync();
        _client.Dispose();
        _factory.Dispose();
    }
}
```

### Ejemplo 3: E2E Test (Multiple Servicios)

```csharp
// ✅ E2E TEST — Flujo completo entre servicios
public class CreateOrderE2ETests : IAsyncLifetime
{
    private readonly DockerCompose _docker;
    private readonly HttpClient _orderServiceClient;
    private readonly HttpClient _inventoryServiceClient;
    
    public async Task InitializeAsync()
    {
        // Levantar servicios en Docker
        _docker = new DockerComposeBuilder()
            .AddService("orders", "orders-service:latest")
            .AddService("inventory", "inventory-service:latest")
            .AddService("postgres", "postgres:15")
            .Build();
        
        await _docker.StartAsync();
        
        _orderServiceClient = new HttpClient { BaseAddress = new Uri("http://localhost:5000") };
        _inventoryServiceClient = new HttpClient { BaseAddress = new Uri("http://localhost:5001") };
        
        // Wait for services ready
        await Task.Delay(5000);
    }
    
    [Fact]
    public async Task UserCreatesOrder_InventoryDecreases_OrderConfirmed()
    {
        // Arrange: Verificar stock inicial
        var initialStockResponse = await _inventoryServiceClient
            .GetAsync("/api/stock/1");
        var initialStock = await initialStockResponse.Content.ReadAsAsync<int>();
        
        // Act: Crear orden
        var orderResponse = await _orderServiceClient.PostAsJsonAsync("/api/orders", new
        {
            customerId = Guid.NewGuid(),
            items = new[] { new { productId = 1, quantity = 5 } }
        });
        
        var orderId = (await orderResponse.Content.ReadAsAsync<OrderResponse>()).OrderId;
        
        // Assert 1: Orden creada
        Assert.True(orderResponse.IsSuccessStatusCode);
        
        // Assert 2: Inventario disminuyó
        await Task.Delay(1000);  // Eventual consistency
        var newStockResponse = await _inventoryServiceClient
            .GetAsync("/api/stock/1");
        var newStock = await newStockResponse.Content.ReadAsAsync<int>();
        
        Assert.AreEqual(initialStock - 5, newStock);
    }
    
    public async Task DisposeAsync()
    {
        _orderServiceClient.Dispose();
        _inventoryServiceClient.Dispose();
        await _docker.StopAsync();
    }
}
```

### Herramientas para Microservicios

| Herramienta | Uso | Ejemplo |
|-------------|-----|---------|
| **Testcontainers** | BD real en containers | PostgreSQL, RabbitMQ en tests |
| **Docker Compose** | Multi-servicio testing | Levantar stack completo |
| **Pact** | Contract testing entre servicios | Verificar compatibilidad de APIs |
| **WireMock** | Mock de servicios externos | Simular PaymentService |
| **xUnit + Moq** | Unit/Integration tests | Tests estándar |

### Checklist: Microservicios bien testeados

- [ ] Unit tests para cada servicio (70%+ coverage)
- [ ] Integration tests con BD real (Testcontainers)
- [ ] Contract tests verificando acuerdos entre servicios
- [ ] E2E tests con Docker Compose (happy path crítico)
- [ ] Mock para servicios que no controlas (upstream)
- [ ] Tests de resiliencia: ¿qué pasa si servicio X falla?
- [ ] Tests de eventual consistency (BD sync delay)
- [ ] Chaos engineering: tests con fallos inyectados

---

## 4️⃣ Testing en EVENT-DRIVEN / CQRS

### Estrategia única: Tests de Comandos, Queries, y Eventos

```
Command Tests
  CreateOrderCommand → PublishOrderCreatedEvent
  ↓
Event Handler Tests
  OrderCreatedEvent → UpdateInventory, SendEmail
  ↓
Query Tests
  GetOrdersQuery → QueryModel desnormalizado
```

### Ejemplo: Command Testing

```csharp
// ✅ COMMAND TEST — Verifica que comando dispara evento
public class CreateOrderCommandTests
{
    [Fact]
    public async Task CreateOrderCommand_WithValidData_PublishesOrderCreatedEvent()
    {
        // Arrange
        var command = new CreateOrderCommand
        {
            CustomerId = Guid.NewGuid(),
            Items = new[] { new OrderItem { ProductId = 1, Quantity = 5 } }
        };
        
        var eventCapture = new List<DomainEvent>();
        var mockPublisher = new Mock<IEventPublisher>();
        mockPublisher
            .Setup(p => p.PublishAsync(It.IsAny<DomainEvent>()))
            .Callback<DomainEvent>(e => eventCapture.Add(e))
            .Returns(Task.CompletedTask);
        
        var handler = new CreateOrderCommandHandler(
            mockPublisher.Object,
            new OrderRepository(...),
            new OrderFactory()
        );
        
        // Act
        await handler.HandleAsync(command);
        
        // Assert
        var orderCreatedEvent = eventCapture.OfType<OrderCreatedEvent>().Single();
        Assert.Equal(command.CustomerId, orderCreatedEvent.CustomerId);
        Assert.Equal(command.Items.Count, orderCreatedEvent.Items.Count);
    }
}

// ✅ EVENT HANDLER TEST — Verifica que evento dispara acciones
public class OrderCreatedEventHandlerTests
{
    [Fact]
    public async Task OrderCreatedEvent_TriggersInventoryReservation()
    {
        // Arrange
        var @event = new OrderCreatedEvent(
            orderId: Guid.NewGuid(),
            customerId: Guid.NewGuid(),
            items: new[] { new { ProductId = 1, Quantity = 5 } }
        );
        
        var mockInventoryService = new Mock<IInventoryService>();
        var handler = new OrderCreatedEventHandler(mockInventoryService.Object);
        
        // Act
        await handler.HandleAsync(@event);
        
        // Assert: Inventario fue reservado
        mockInventoryService.Verify(
            s => s.ReserveStockAsync(@event.OrderId, It.IsAny<IEnumerable<OrderItem>>()),
            Times.Once
        );
    }
    
    [Fact]
    public async Task OrderCreatedEvent_TriggersEmailNotification()
    {
        // Arrange
        var @event = new OrderCreatedEvent(
            customerId: Guid.NewGuid(),
            total: 100
        );
        
        var mockEmailService = new Mock<IEmailService>();
        var handler = new OrderCreatedEventHandler(mockEmailService: mockEmailService.Object);
        
        // Act
        await handler.HandleAsync(@event);
        
        // Assert: Email fue enviado
        mockEmailService.Verify(
            e => e.SendOrderConfirmationAsync(It.IsAny<Email>()),
            Times.Once
        );
    }
}

// ✅ QUERY TEST — Verifica que Query retorna datos desnormalizados
public class GetOrdersQueryTests : IAsyncLifetime
{
    private readonly IReadDbContext _readDb;
    private readonly GetOrdersQueryHandler _handler;
    
    public async Task InitializeAsync()
    {
        _readDb = new InMemoryReadDbContext();
        _handler = new GetOrdersQueryHandler(_readDb);
        
        // Seed read model
        await _readDb.Orders.AddRangeAsync(new[]
        {
            new OrderReadModel { Id = Guid.NewGuid(), CustomerId = Guid.NewGuid(), Total = 100 },
            new OrderReadModel { Id = Guid.NewGuid(), CustomerId = Guid.NewGuid(), Total = 200 }
        });
        await _readDb.SaveChangesAsync();
    }
    
    [Fact]
    public async Task GetOrdersQuery_ReturnsOrdersForCustomer()
    {
        // Arrange
        var customerId = Guid.NewGuid();
        var query = new GetOrdersQuery { CustomerId = customerId };
        
        // Act
        var result = await _handler.HandleAsync(query);
        
        // Assert
        Assert.Empty(result);  // No hay órdenes para este customer
    }
    
    public Task DisposeAsync() => Task.CompletedTask;
}

// ✅ EVENTUAL CONSISTENCY TEST — Verifica que datos eventualmente consistentes
public class EventualConsistencyTests : IAsyncLifetime
{
    private readonly IEventPublisher _eventPublisher;
    private readonly IReadDbContext _readDb;
    
    public async Task InitializeAsync()
    {
        _eventPublisher = new RealEventPublisher();  // Usa broker real o en-memory
        _readDb = new InMemoryReadDbContext();
    }
    
    [Fact]
    public async Task WhenOrderCreated_ReadModelUpdatedEventually()
    {
        // Arrange
        var orderId = Guid.NewGuid();
        var @event = new OrderCreatedEvent(orderId, ...);
        
        // Act: Publicar evento
        await _eventPublisher.PublishAsync(@event);
        
        // Assert: Esperar a que Handler procese (eventual consistency)
        var readModel = null as OrderReadModel;
        var retries = 0;
        while (readModel == null && retries < 5)
        {
            await Task.Delay(100);
            readModel = await _readDb.Orders.FirstOrDefaultAsync(o => o.Id == orderId);
            retries++;
        }
        
        Assert.NotNull(readModel);
        Assert.Equal(orderId, readModel.Id);
    }
    
    public Task DisposeAsync() => Task.CompletedTask;
}
```

### Checklist: Event-Driven/CQRS bien testeado

- [ ] Command tests verifican que comando → evento
- [ ] Event handler tests verifican que evento → acción correcta
- [ ] Query tests verifican que read model tiene datos correctos
- [ ] Idempotence tests: handler puede ejecutarse múltiples veces sin problema
- [ ] Eventual consistency tests: Read model se actualiza en tiempo
- [ ] Dead letter tests: qué pasa cuando handler falla
- [ ] Tests de orden: eventos procesados en orden correcto

---

## 5️⃣ Comparativa: Estrategia por Arquitectura

| Aspecto | Monolito | Modular | Microservicios | Event-Driven |
|---------|----------|---------|---|---|
| **Nivel focal** | Unit > Integration > E2E | Unit + Integration inter-módulos | Contract + Integration | Command/Event/Query |
| **Tiempo tests** | < 30s | < 1m | < 5m (con containers) | < 2m |
| **% Coverage** | 70%+ líneas | 70%+ | 60-70% (services < BD) | 75%+ commands |
| **Mocks vs Real** | Muchos mocks | Pocos mocks | Mocks externos | Mocks de servicios |
| **BD en tests** | SQLite in-memory | SQLite/Postgres | Testcontainers | Testcontainers |
| **Desafío principal** | Coupling | Inter-módulo contracts | Servicios comunicándose | Eventual consistency |

---

## 🛠️ Herramientas Recomendadas (Stack .NET)

### Core Testing

```csharp
// Instalación
dotnet add package xunit
dotnet add package Moq
dotnet add package FluentAssertions
```

**xUnit**: Framework de tests  
**Moq**: Mocking library  
**FluentAssertions**: Assertions legibles

```csharp
// Ejemplo con FluentAssertions
var result = await service.GetOrderAsync(orderId);

result.Should().NotBeNull();
result.Id.Should().Be(orderId);
result.Items.Should().HaveCount(3);
result.Total.Should().BeGreaterThan(0);
```

### Integración

```csharp
dotnet add package Microsoft.EntityFrameworkCore.Sqlite  // BD tests
dotnet add package Testcontainers                        // Docker containers
dotnet add package Testcontainers.PostgreSql             // PostgreSQL container
```

### Media

```csharp
dotnet add package MassTransit                           // Message broker
dotnet add package MassTransit.RabbitMQ                  // RabbitMQ integration
```

### Contract Testing

```csharp
dotnet add package PactNet                               // Contract tests
```

---

## 📊 Template: Plan de Testing por Arquitectura

### Para un MONOLITO nuevo

```markdown
## Testing Plan

### Phase 1: Unit Tests (Semana 1-2)
- [ ] Tests para 100% de lógica de negocio
- [ ] Mocks para todos los servicios externos
- [ ] Coverage goal: 70%

### Phase 2: Integration Tests (Semana 2-3)
- [ ] Tests de Repository con BD real
- [ ] Tests de API controllers
- [ ] Coverage goal: 80%

### Phase 3: E2E Tests (Semana 3)
- [ ] Happy path: Crear orden → Pagar → Enviar
- [ ] Error paths: Pago rechazado, inventario vacío
- [ ] Tests: 5-10 scenarios críticos

### Phase 4: CI/CD (Ongoing)
- [ ] Tests corren en PR antes de merge
- [ ] Coverage < 70% bloquea merge
- [ ] E2E corre nightly
```

### Para MICROSERVICIOS

```markdown
## Testing Plan

### Per-Service Level
- [ ] Unit tests: 60%+ coverage
- [ ] Integration tests: BD real
- [ ] Contract tests: Verificar API

### Cross-Service Level
- [ ] E2E tests: Docker Compose
- [ ] Chaos tests: Fallos inyectados
- [ ] Observability: Logs/traces en tests

### Periodic
- [ ] Performance tests: Latencia por percentil
- [ ] Load tests: Comportamiento bajo presión
- [ ] Failure scenarios: Cascading failures
```

---

## 🎓 Best Practices Universales

### 1. Nombres Claros de Tests

```csharp
// ❌ MALO
[Fact]
public void Test1() { }

[Fact]
public void OrderTest() { }

// ✅ BUENO
[Fact]
public async Task CreateOrder_WithValidData_ReturnsOrderId() { }

[Fact]
public async Task CreateOrder_WithoutCustomer_ThrowsArgumentException() { }

// Patrón: [Method]_[GivenCondition]_[ExpectedResult]
```

### 2. AAA: Arrange - Act - Assert

```csharp
[Fact]
public async Task CreateOrder_ShouldReserveInventory()
{
    // ARRANGE: Setup
    var dto = new CreateOrderDto { Items = new[] { ... } };
    var mockInventory = new Mock<IInventoryService>();
    var service = new OrderService(mockInventory.Object);
    
    // ACT: Ejecutar
    await service.CreateOrderAsync(dto);
    
    // ASSERT: Verificar
    mockInventory.Verify(i => i.ReserveAsync(It.IsAny<int>()), Times.Once);
}
```

### 3. Evitar Test Interdependencia

```csharp
// ❌ MALO: Los tests dependen del orden
[Fact]
public void CreateOrder() { /* seed data */ }

[Fact]
public void GetOrder() { /* usa datos del test anterior */ }

// ✅ BUENO: Cada test es independiente
[Fact]
public async Task CreateOrder()
{
    // Setup completo, cleanup al final
}

[Fact]
public async Task GetOrder()
{
    // Setup completo, cleanup al final
}
```

### 4. Data Builders para Objetos Complejos

```csharp
public class OrderBuilder
{
    private Guid _customerId = Guid.NewGuid();
    private decimal _total = 100;
    
    public OrderBuilder WithCustomerId(Guid customerId)
    {
        _customerId = customerId;
        return this;
    }
    
    public Order Build()
    {
        return new Order { CustomerId = _customerId, Total = _total };
    }
}

// Uso
[Fact]
public void Test()
{
    var order = new OrderBuilder()
        .WithCustomerId(customerId)
        .Build();
}
```

### 5. No Testear Frameworks

```csharp
// ❌ MALO: Testing Entity Framework
[Fact]
public void EntityFramework_SavesData() { /* ... */ }

// ✅ BUENO: Testing TU lógica con EF como implementación
[Fact]
public async Task OrderRepository_SavesOrder_PersistsToDatabase() { /* ... */ }
```

---

## 📋 Checklist Final

- [ ] Estrategia de testing definida según arquitectura
- [ ] Pirámide de tests implementada (muchos unit, pocos E2E)
- [ ] CI/CD pipeline corre tests en toda PR
- [ ] Coverage mínimo establecido (70%+)
- [ ] Tests de fallo: ¿qué pasa cuando algo falla?
- [ ] Documentación de cómo correr tests localmente
- [ ] Performance: Tests no tardan más de lo aceptable
- [ ] Nombres de tests claros y descriptivos

---

**Última actualización:** 2026-03-27  
**Dificultad:** 🔴 Senior
