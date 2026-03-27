---
id: migration-patterns
title: Patrones de Migración Arquitectónica
sidebar_position: 9
---

# Patrones de Migración Arquitectónica 🚀

Heredas un monolito legado, está creciendo, el equipo se expande. ¿Cómo evolucionas la arquitectura sin parar el negocio? Este documento te enseña patrones probados para migraciones sin reescrituras.

---

## El Desafío: No Puedes Parar

```
REALIDAD:
┌─────────────────────┐
│ Monolito en Prod    │
│ 100 QPS             │ ← Sistema VIVO, usuarios criticando
│ 5 años antiguo      │ ← Código técnicamente deuda
│ 10 equipos          │ ← Todos esperan que algo cambie
└─────────────────────┘
        ↓ ¿CÓMO?
    MIGRAR SIN BREAK
        ↓
┌──────────────────────────────┐
│ Arquitectura moderna + Live  │
│ Nuevas features nuevas       │
│ Old features soportadas      │
│ 0 downtime                   │
└──────────────────────────────┘

NO es opción:
🚫 "Vamos a reescribir en microservicios" (6 meses, extremadamente riesgoso)
🚫 "Migramos un fin de semana" (inevitablemente se rompe)

SÍ es opción:
✅ Strangler Fig (migrar gradualmente)
✅ Anti-Corruption Layer (aislamiento de cambios)
✅ Feature Flags (new code junto a old)
✅ Bubble patterns (extraer servicios sin reescribir)
```

---

## 1️⃣ Strangler Fig Pattern

La estrategia de migración más segura: **reemplazar funcionalmente sin tocar el código existente**.

```
FASE 0: Hoy
┌─────────────────────────────────────┐
│  Monolito (Orders, Inventory, etc)  │
│  ├─ Orders API                      │
│  ├─ Inventory API                   │
│  └─ Payments API                    │
└─────────────────────────────────────┘
        ↓ HTTP
    [Cliente]

FASE 1: Introducir Gateway
┌─────────────────┐
│ [API Gateway]   │ ← Nuevo, controla routing
├─ Routes /api/* → Monolito
└─────────────────┘
        ↓
    [Cliente]

FASE 2: Extract Inventory Service
┌─────────────────────┐
│ [API Gateway]       │
├─ /api/inventory/* → NEW Inventory Service ✅
├─ /api/orders/* → Monolito
└─────────────────────┘
         ↓
    [Cliente]

Monolito sigue funcionando, pero sin Inventory
● Orders Service ← Still in monolith
● Payments Service ← Still in monolith

FASE 3: Extract Orders Service
┌─────────────────────┐
│ [API Gateway]       │
├─ /api/inventory/* → Inventory Service
├─ /api/orders/* → NEW Orders Service ✅
├─ /api/payments/* → Monolito
└─────────────────────┘

FASE 4: Extract Payments Service
┌─────────────────────┐
│ [API Gateway]       │
├─ /api/inventory/* → Inventory Service
├─ /api/orders/* → Orders Service
├─ /api/payments/* → NEW Payments Service ✅
└─────────────────────┘

FIN: 100% Migrado, 0 pausa en servicio
```

### Implementación: Strangler Fig con API Gateway

```csharp
// FASE 1: API Gateway nueva
public class StranglerGateway
{
    private readonly HttpClient _httpClient;
    private readonly IInventoryService _inventoryService;  // NEW SERVICE
    private readonly string _monolithUrl = "http://localhost:5001";
    
    public StranglerGateway(HttpClient httpClient, IInventoryService inventoryService)
    {
        _httpClient = httpClient;
        _inventoryService = inventoryService;
    }
    
    [HttpGet("/api/inventory/{productId}")]
    public async Task<IActionResult> GetInventory(int productId)
    {
        // NUEVA: Usar el servicio extraído
        try
        {
            var stock = await _inventoryService.GetStockAsync(productId);
            return Ok(new { productId, stock });
        }
        catch
        {
            // FALLBACK: Si nueva implementación falla, volver al monolito
            var response = await _httpClient.GetAsync($"{_monolithUrl}/api/inventory/{productId}");
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return Ok(content);
            }
            throw;
        }
    }
    
    [HttpPost("/api/orders")]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        // Aún no extraído: Forward al monolito
        var json = JsonSerializer.Serialize(dto);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        
        var response = await _httpClient.PostAsync($"{_monolithUrl}/api/orders", content);
        
        if (response.IsSuccessStatusCode)
        {
            // NOTA: OrderCreatedEvent se publica desde monolito
            // El gateway es transparente a los clientes
            var result = await response.Content.ReadAsAsync<OrderResponse>();
            return Ok(result);
        }
        
        return StatusCode((int)response.StatusCode);
    }
}

// FASE 2: Feature Flag para canary deployment
public class CanaryInventoryGateway
{
    private readonly IInventoryService _newService;
    private readonly HttpClient _oldMonolith;
    private readonly IFeatureFlagService _flags;
    
    public async Task<StockResponse> GetStock(int productId)
    {
        // % de tráfico a nueva implementación
        var useNewService = _flags.IsEnabled("inventory-service-v2", userId: null);
        
        if (useNewService)
        {
            try
            {
                var stock = await _newService.GetStockAsync(productId);
                await LogMetric("inventory_new_service_success");
                return stock;
            }
            catch (Exception ex)
            {
                // Fallo en nueva versión: fallback al monolito
                await LogMetric("inventory_new_service_error", ex);
                var response = await _oldMonolith.GetAsync($"/api/inventory/{productId}");
                return await response.Content.ReadAsAsync<StockResponse>();
            }
        }
        else
        {
            // Aún usando monolito
            var response = await _oldMonolith.GetAsync($"/api/inventory/{productId}");
            return await response.Content.ReadAsAsync<StockResponse>();
        }
    }
}

// Ejemplo de feature flag rollout
public class Program
{
    public static void Main()
    {
        var featureFlags = new FeatureFlagService();
        
        // Día 1: 0% new traffic
        featureFlags.SetFeatureFlag("inventory-service-v2", enabled: false, rolloutPercentage: 0);
        
        // Día 2: 5% new traffic
        featureFlags.SetFeatureFlag("inventory-service-v2", enabled: true, rolloutPercentage: 5);
        
        // Día 3: 25% (si todo ok)
        featureFlags.SetFeatureFlag("inventory-service-v2", enabled: true, rolloutPercentage: 25);
        
        // Día 5: 50% (a/b testing)
        featureFlags.SetFeatureFlag("inventory-service-v2", enabled: true, rolloutPercentage: 50);
        
        // Día 7: 100% new service
        featureFlags.SetFeatureFlag("inventory-service-v2", enabled: true, rolloutPercentage: 100);
        
        // Día 10: old monolith endpoint deprecated
    }
}
```

### Ventajas de Strangler Fig

| Ventaja | Beneficio |
|---------|-----------|
| **Zero downtime** | El servicio sigue activo durante la migración |
| **Rollback fácil** | Si falla nueva versión, vuelves al gateway |
| **Canary testing** | Pruebas con % de tráfico real antes de 100% |
| **Bajo riesgo** | Cada servicio extraído es aislado |
| **Equipos independientes** | Distintos teams pueden trabajar en nuevo servicio |

### Checklist: Implementar Strangler

- [ ] API Gateway implementado (Kong, Nginx, custom)
- [ ] Routing claro: qué endpoints van a dónde
- [ ] Feature flags para canary deployment
- [ ] Logging/tracing para monitorear migración
- [ ] Fallback a monolito si nueva versión falla
- [ ] Métricas: compara performance new vs old
- [ ] Plan de rollout: 0% → 5% → 25% → 50% → 100%
- [ ] Decomisionar old endpoint después de 100%

---

## 2️⃣ Anti-Corruption Layer (ACL)

Cuando integras con sistemas externos o heredados, **aísla tu dominio** del "ruido" externo.

```
PROBLEMA:
┌──────────────────────┐
│ Tu Dominio (Clean)   │
├─ Order               │
├─ Customer           │
└──────────────────────┘
        ↓ Directo ❌
┌──────────────────────┐
│ Legacy System        │
├─ OrderDto           │ ← Diferente modelo
├─ ClientInfo         │ ← Nombres raros
├─ Campos obsoletos   │
└──────────────────────┘

Tu código "ensucia" con modelos legacy

SOLUCIÓN: Anti-Corruption Layer
┌──────────────────────┐
│ Tu Dominio (Clean)   │
├─ Order              │
├─ Customer           │
└──────────────────────┘
        ↓ (ACL)
┌──────────────────────┐
│ Anti-Corruption Layer│ ← Traduce modelos
├─ Maps Order → OrderDto
├─ Maps Customer → ClientInfo
└──────────────────────┘
        ↓ Traducido
┌──────────────────────┐
│ Legacy System        │
└──────────────────────┘

Tu código siempre ve Order limpio
```

### Implementación: ACL Pattern

```csharp
// TU DOMINIO: Limpio
namespace Orders.Domain
{
    public class Order
    {
        public Guid Id { get; set; }
        public Guid CustomerId { get; set; }
        public decimal Total { get; set; }
        public OrderStatus Status { get; set; }
    }
    
    public class Customer
    {
        public Guid Id { get; set; }
        public string Email { get; set; }
        public string FullName { get; set; }
    }
}

// LEGACY SYSTEM: Interface rara
namespace LegacyBridge.Models
{
    public class OrderDto
    {
        public string OrderCode { get; set; }  // No es Guid!
        public string ClientCode { get; set; } // ¿Quién es esto?
        public double OrderValue { get; set; } // Imprecisión decimal
        public int StatusCode { get; set; }    // 1=pending, 2=confirmed, etc
        public DateTime CreatedDate { get; set; }
    }
    
    public class ClientDto
    {
        public string Code { get; set; }
        public string Name { get; set; }      // Nombre completo o apellido?
        public string Contact { get; set; }   // Email, teléfono, ¿qué es?
    }
}

// ANTI-CORRUPTION LAYER: Aislamiento
namespace Orders.Infrastructure.Adapters
{
    public interface ILegacyOrderBridge
    {
        Task<Order> GetOrderFromLegacyAsync(string orderCode);
        Task<OrderDto> SendOrderToLegacyAsync(Order order);
    }
    
    public class LegacyOrderAdapter : ILegacyOrderBridge
    {
        private readonly ILegacyOrderService _legacyService;
        private readonly ILogger<LegacyOrderAdapter> _logger;
        
        public async Task<Order> GetOrderFromLegacyAsync(string orderCode)
        {
            try
            {
                // Paso 1: Obtener del legacy
                var legacyOrder = await _legacyService.GetOrderAsync(orderCode);
                
                // Paso 2: TRADUCE a tu dominio (aquí va la lógica obscura)
                var order = new Order
                {
                    Id = TranslateOrderCode(legacyOrder.OrderCode),
                    CustomerId = TranslateClientCode(legacyOrder.ClientCode),
                    Total = (decimal)legacyOrder.OrderValue,  // double → decimal
                    Status = TranslateStatus(legacyOrder.StatusCode)  // 1 → Pending
                };
                
                return order;
            }
            catch (LegacyException ex)
            {
                _logger.LogError($"Legacy error: {ex.Message}");
                throw new OrderNotFound($"Order {orderCode} not found in legacy system");
            }
        }
        
        public async Task<OrderDto> SendOrderToLegacyAsync(Order order)
        {
            // REVERSE: Tu orden → Dto del legacy
            var legacyOrder = new OrderDto
            {
                OrderCode = order.Id.ToString().ToUpperInvariant(),
                ClientCode = order.CustomerId.ToString().ToUpperInvariant(),
                OrderValue = (double)order.Total,
                StatusCode = order.Status switch
                {
                    OrderStatus.Pending => 1,
                    OrderStatus.Confirmed => 2,
                    OrderStatus.Shipped => 3,
                    _ => throw new Exception()
                }
            };
            
            return await _legacyService.CreateOrderAsync(legacyOrder);
        }
        
        private Guid TranslateOrderCode(string legacyCode)
        {
            // ¿Legacy usa "ORD-2024-001" y tú necesitas GUID?
            // Aquí va esa lógica rara
            if (Guid.TryParse(legacyCode, out var guid))
                return guid;
            
            // Mapeo lookup: legacy code → tu GUID
            var mapping = _legacyService.GetGuidMapping(legacyCode);
            return mapping ?? Guid.NewGuid();
        }
        
        private Guid TranslateClientCode(string clientCode)
        {
            // Similar, traducir client code → customer ID
            return new Guid(clientCode);  // O lo que sea necesario
        }
        
        private OrderStatus TranslateStatus(int statusCode)
        {
            return statusCode switch
            {
                1 => OrderStatus.Pending,
                2 => OrderStatus.Confirmed,
                3 => OrderStatus.Shipped,
                4 => OrderStatus.Cancelled,
                _ => throw new ArgumentException($"Unknown status: {statusCode}")
            };
        }
    }
}

// USO en tu servicio: Transparente
public class OrderService
{
    private readonly IOrderRepository _repository;
    private readonly ILegacyOrderBridge _legacyBridge;
    
    public async Task<Order> GetOrderAsync(string legacyOrderCode)
    {
        // Tu código NO sabe que viene del legacy
        var order = await _legacyBridge.GetOrderFromLegacyAsync(legacyOrderCode);
        return order;  // Order limpio, sin "suciedad" legacy
    }
}

// TESTING: ACL es fácil de testear
public class LegacyOrderAdapterTests
{
    [Fact]
    public void TranslateStatus_1_ReturnsOrderStatusPending()
    {
        var adapter = new LegacyOrderAdapter(...);
        var result = adapter.TranslateStatus(1);
        
        Assert.Equal(OrderStatus.Pending, result);
    }
    
    [Fact]
    public async Task GetOrderFromLegacyAsync_TransformsCorrectly()
    {
        // Arrange
        var legacyOrder = new OrderDto
        {
            OrderCode = "12345",
            ClientCode = "CLIENT-1",
            OrderValue = 99.99,
            StatusCode = 2
        };
        
        var mockLegacyService = new Mock<ILegacyOrderService>();
        mockLegacyService
            .Setup(s => s.GetOrderAsync("12345"))
            .ReturnsAsync(legacyOrder);
        
        var adapter = new LegacyOrderAdapter(mockLegacyService.Object, ...);
        
        // Act
        var order = await adapter.GetOrderFromLegacyAsync("12345");
        
        // Assert: Todo translate correctamente
        Assert.NotNull(order);
        Assert.Equal(OrderStatus.Confirmed, order.Status);
    }
}
```

### Patrones de ACL

| Tipo | Cuándo | Ejemplo |
|------|--------|---------|
| **Traducción de tipos** | Data types diferentes | double → decimal, String → Guid |
| **Mapeo de modelos** | Estructuras diferentes | ClientDto → Customer |
| **Enum translation** | Status codes raros | 1,2,3 → Pending, Confirmed, Shipped |
| **Validación adicional** | Legacy no valida bien | Check email format, stock > 0 |
| **Caching** | Legacy es lento | Cache resultados por 5 min |
| **Retry logic** | Legacy inconsistente | Reintentar 3 veces con backoff |

---

## 3️⃣ Extract Method / Service Pattern

Cuando veas un "servicio" dentro del monolito que debería ser independiente:

```
MONOLITO HOY:
src/
  Orders/
    Controllers/
    Services/
      OrderService
      PaymentProcessor ← Esto va para afuera
      InventoryChecker ← Esto va para afuera

PASO 1: Extract dentro del monolito
└─ Isolar payment logic en interfaz
   └ public interface IPaymentProcessor

PASO 2: New Payment Microservice
└─ Implementa IPaymentProcessor
  └ HttpClient llamado desde OrderService

PASO 3: Old Payment Code → Deprecated
└ OrderService ← Usa HTTP, no código local
```

### Ejemplo: Extract Payment Service

```csharp
// STEP 1: Interface clara (ya debería existir)
namespace Orders.Domain.Interfaces
{
    public interface IPaymentProcessor
    {
        Task<PaymentResult> ProcessAsync(Order order, PaymentMethod method);
    }
}

// MONOLITO HOY: Local implementation
namespace Orders.Infrastructure.Payments
{
    public class LocalPaymentProcessor : IPaymentProcessor
    {
        public async Task<PaymentResult> ProcessAsync(Order order, PaymentMethod method)
        {
            // Toda la lógica aquí (frágil, acoplada)
            var gateway = new StripeGateway();
            var charge = gateway.Charge(order.Total, method.Token);
            // ...
        }
    }
}

// LANZAR NUEVO MICROSERVICIO: Payments
// Repository en github.com/alanrivas/payments-service

// PASO 2: HttpClient wrapper (Anti-Corruption Layer)
namespace Orders.Infrastructure.Payments
{
    public class RemotePaymentProcessor : IPaymentProcessor
    {
        private readonly HttpClient _httpClient;
        
        public async Task<PaymentResult> ProcessAsync(Order order, PaymentMethod method)
        {
            var request = new ProcessPaymentRequest
            {
                OrderId = order.Id,
                Amount = order.Total,
                Token = method.Token,
                IdempotencyKey = GenerateIdempotencyKey(order.Id)
            };
            
            var response = await _httpClient.PostAsJsonAsync(
                "http://payments-service/api/payments/process",
                request
            );
            
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadAsAsync<PaymentResult>();
                return result;
            }
            
            throw new PaymentServiceException("Payment service failed");
        }
        
        private string GenerateIdempotencyKey(Guid orderId)
        {
            // Importante: Si se reintenta, mismo ID = mismo resultado
            return $"order-payment-{orderId}";
        }
    }
}

// STEP 3: Dependency Injection switching
public class Program
{
    public static void Main()
    {
        var services = new ServiceCollection();
        
        var useRemotePayments = bool.Parse(
            Configuration["Features:RemotePaymentService"] ?? "false"
        );
        
        if (useRemotePayments)
        {
            // Usar nuevo servicio
            services.AddScoped<IPaymentProcessor, RemotePaymentProcessor>();
            services.AddHttpClient<RemotePaymentProcessor>();
        }
        else
        {
            // Aún usar local
            services.AddScoped<IPaymentProcessor, LocalPaymentProcessor>();
        }
    }
}

// STEP 4: Feature flag para canary
public class PaymentFacade : IPaymentProcessor
{
    private readonly LocalPaymentProcessor _local;
    private readonly RemotePaymentProcessor _remote;
    private readonly IFeatureFlags _flags;
    
    public async Task<PaymentResult> ProcessAsync(Order order, PaymentMethod method)
    {
        var useRemote = _flags.IsEnabled("use-remote-payments");
        
        try
        {
            var processor = useRemote ? (IPaymentProcessor)_remote : _local;
            return await processor.ProcessAsync(order, method);
        }
        catch when (useRemote)
        {
            // Si remote falla, fallback a local
            _logger.LogWarning("Remote payment service failed, falling back to local");
            return await _local.ProcessAsync(order, method);
        }
    }
}
```

---

## 4️⃣ Strangler + DDD + Event-Driven: La Estrategia Completa

Para una migración de verdad a escala, combina:

```
FASE 1: PREPARAR (Semanas 1-4)
  ├─ Implementa API Gateway (Kong, Nginx, o custom)
  ├─ Agrega feature flags (LaunchDarkly, custom)
  ├─ Implementa centralized logging (ELK, DataDog)
  ├─ Define Bounded Contexts (usar DDD)
  └─ Plan de rollout (5% → 25% → 50% → 100%)

FASE 2: EXTRACT PRIMER SERVICIO (Semanas 5-12)
  ├─ Elige contexto NO crítico (ej: Inventory vs Payments)
  ├─ Implementa nuevo servicio (microservicio simple)
  ├─ Implementa ACL en gateway
  ├─ Canary: 5% tráfico → logs/metrics OK?
  ├─ Scale: 5% → 25% → 50% → 100%
  └─ Decomisionar old endpoint en monolito

FASE 3: EVENT SOURCING EN MONOLITO (Semanas 13-16)
  ├─ Monolito publica eventos (OrderCreated, etc)
  ├─ Nuevos servicios subscriben a eventos
  ├─ Eventual consistency entre servicio old y new
  ├─ Queries → read model desnormalizado
  └─ Commands mantenidos en nuevo servicio

FASE 4: EXTRACT SERVICIOS SECUNDARIOS (Semanas 17-24)
  ├─ Payments, Notifications, Reports
  ├─ Seguir patrón: Extract → ACL → Canary → 100%
  └─ Monolito va reduciendo

FINAL: EQUILIBRIO (Semanal)
  ├─ Monolito: Negocio core (Orders logic)
  ├─ Servicios: Escalabilidad diferenciada
  ├─ Observabilidad: Logs centrales, tracing
  └─ Documentación: Context maps, ADRs
```

### Ejemplo Timeline Real

```markdown
## Timeline de Migración Real

### Mes 1: Prep
- Semana 1: Implementar API Gateway (Kong)
- Semana 2: Feature flags (LaunchDarkly)
- Semana 3: Centralized logging (ELK)
- Semana 4: Identify Bounded Contexts

### Mes 2-3: Extract Inventory Service
- Semana 5-8: Implementar InventoryService (nueva BD)
- Semana 9: Canary 5% tráfico read operations
- Semana 10: 50% tráfico (a/b test vs monolito)
- Semana 11: 100% tráfico a Inventory Service
- Semana 12: Remover inventory code del monolito

### Mes 4-5: Event-Driven Setup
- Semana 13-14: RabbitMQ/Kafka en monolito
- Semana 15: Monolito publica OrderCreated events
- Semana 16: InventoryService consume eventos

### Mes 6-8: Extract Payments & Notifications
- Similar a Inventory (3 semanas por servicio)

### Mes 9+: Mantenimiento
- Monolito es solo Orders core
- 5-7 microservicios independientes
- Observabilidad centralizada
```

---

## ⚠️ Desafíos Comunes y Soluciones

| Desafío | Solución |
|---------|----------|
| **"Migración se ve lenta"** | Es así, es seguridad. "Move fast, break things" causa incidentes críticos |
| **Shared BD entre viejo y nuevo** | ACL + Polling al principio, luego événements |
| **Eventual consistency bugs** | Idempotence keys, read-your-writes consistency |
| **Feature flag complexity** | Herramienta de feature flags (LaunchDarkly) simplifica |
| **Team fatiga** | Celebra small wins, dedica resources exclusivas |
| **Testing explosion** | Contract tests previenen regressions masivas |

---

## 🧪 Testing en Migraciones

### Contract Tests

```csharp
// Verifica que API Gateway habla bien con ambos servicios
[TestClass]
public class StranglerGatewayContractTests
{
    [TestMethod]
    public async Task Gateway_ForwardInventoryToNewService_ReturnsCorrect()
    {
        var gateway = new StranglerGateway(...);
        
        var response = await gateway.GetInventory(productId: 1);
        
        Assert.IsTrue(response.IsSuccessStatusCode);
        var data = await response.Content.ReadAsAsync<InventoryResponse>();
        Assert.IsNotNull(data.Stock);
    }
    
    [TestMethod]
    public async Task Gateway_FallbackToMonolith_IfNewServiceFails()
    {
        var gateway = new StranglerGateway(
            newService: FailingInventoryService,
            monolith: WorkingMonolith
        );
        
        var response = await gateway.GetInventory(1);
        
        // Debe volver al monolito
        Assert.IsTrue(response.IsSuccessStatusCode);
    }
}
```

### Chaos Testing

```csharp
[TestClass]
public class MigrationChaosTests
{
    [TestMethod]
    public async Task WhenNewServiceReturns500_SystemStillWorks()
    {
        // Simula que nuevo servicio explota
        var chaosService = new ChaosInventoryService(failureRate: 1.0);
        var gateway = new StranglerGateway(newService: chaosService, fallback: monolith);
        
        for (int i = 0; i < 100; i++)
        {
            var result = await gateway.GetInventory(1);
            Assert.IsTrue(result.IsSuccessStatusCode, $"Failed at iteration {i}");
        }
    }
}
```

---

## 📋 Checklist de Migración

### Pre-Migración
- [ ] Definir Bounded Contexts (qué servicios extraer)
- [ ] Implementar API Gateway
- [ ] Implementar Feature Flags
- [ ] Logging centralizado en lugar
- [ ] Plan comunicación con equipos
- [ ] Documentar estado actual (ADRs)

### Durante Migración (Por Servicio)
- [ ] Implementar nuevo servicio en paralelo
- [ ] Escribir ACL/Gateway routing
- [ ] Contract tests pasar
- [ ] Canary 5% tráfico (monitorear logs)
- [ ] Métricas: Latencia, errors, throughput
- [ ] AB test vs monolito si critical
- [ ] Rollout gradual: 5% → 25% → 50% → 100%
- [ ] Remover código old después ✅

### Post-Migración
- [ ] Decomisionar endpoints old
- [ ] Actualizar documentación
- [ ] Celebrated wins con equipo
- [ ] Retrospectiva: qué salió bien/mal
- [ ] Plan para próximo servicio

---

## 🎓 Casos de Estudio Reales

### Netflix: Strangler Fig (2009-2015)

Netflix comenzó monolito, necesitaba escalar. Usó Strangler Fig para pasar a microservicios:

1. **Fase 1**: API Gateway (no existía, Netflix lo creó)
2. **Fase 2**: Extraer recommendation engine (criterio critical)
3. **Fase 3**: Playback, search, billing gradualmente
4. **Resultado**: 200+ microservicios, deploy 1000+ veces por día

**Lección**: Strangler Fig funciona a escala.

### Amazon: DDD + Extract

1. **Identificar**: Bounded contexts (Inventory, Pricing, Fulfillment)
2. **Extract**: Cada contexto → servicio con BD propia
3. **Communication**: Eventos, no llamadas sincrónicas
4. **Resultado**: Equipos autonomos, escalabilidad masiva

**Lección**: Antes de extraer, define límites claros (DDD).

### Shopify: Feature Flags para Migración

1. **Preparar**: Nuevo código, feature flags OFF
2. **Deploy**: Código nuevo en prod, 0% tráfico
3. **Canary**: Habilitar para % pequeño de merchants
4. **Monitoreo**: Métricas detalladas
5. **Scale**: Si OK, aumentar %
6. **Resultado**: Migration con 0 incidents

**Lección**: Feature flags =seguridad, observabilidad es crítica.

---

## 🚀 Resumen: Tu Roadmap

```
SEMANA 1:  Define estrategia (Strangler + DDD + Events)
SEMANA 2:  Implementar infraestructura (Gateway, Flags)
SEMANA 3:  Identificar primer servicio easy to extract
SEMANA 4-8: Implementar, test, canary
SEMANA 9+: Scale gradualmente

MENSUAL:
  ├─ Extraer 1 nuevo servicio
  ├─ Monitorear health
  ├─ Celebrar progreso
  └─ Documentar decisiones
```

Si necesitas una migración segura, sin break, con equipos happy: **Strangler Fig + Feature Flags + Observabilidad**.

---

**Última actualización:** 2026-03-27  
**Dificultad:** 🔴 Senior
