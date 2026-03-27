---
title: "🧩 NoSQL, CQRS y Migración en Producción"
sidebar_position: 2
---

# 🧩 NoSQL, CQRS y Migración en Producción

## NoSQL y Polyglot Persistence

La idea es usar la herramienta correcta para cada caso de uso, en lugar de forzar todo en una BD relacional.

```
                         ┌─────────────────────────────────┐
                         │         Tu aplicación            │
                         └──┬──────┬─────────┬──────┬──────┘
                            │      │         │      │
                            ▼      ▼         ▼      ▼
                         SQL    Redis     MongoDB  Elastic
                       Server   (caché)  (docs)   (search)
                       (trans.)
```

### MongoDB — documentos flexibles

```csharp
// dotnet add package MongoDB.Driver

// Perfecto para: catálogos de productos con atributos variables,
// perfiles de usuario, contenido CMS, datos semi-estructurados

public record ProductDocument(
    [property: BsonId] ObjectId Id,
    string Name,
    string Category,
    decimal Price,
    BsonDocument Attributes  // cada categoría tiene atributos diferentes
);

// Zapatos: { size: 42, color: "negro", material: "cuero" }
// TV:      { screenSize: 55, resolution: "4K", hz: 120 }
// No necesitas una columna por atributo — en relacional sería una pesadilla

public class ProductRepository
{
    private readonly IMongoCollection<ProductDocument> _collection;

    public ProductRepository(IMongoDatabase database)
    {
        _collection = database.GetCollection<ProductDocument>("products");
    }

    public async Task<List<ProductDocument>> SearchAsync(string category, decimal maxPrice)
    {
        var filter = Builders<ProductDocument>.Filter.And(
            Builders<ProductDocument>.Filter.Eq(p => p.Category, category),
            Builders<ProductDocument>.Filter.Lte(p => p.Price, maxPrice));

        return await _collection.Find(filter)
            .Sort(Builders<ProductDocument>.Sort.Ascending(p => p.Price))
            .Limit(50)
            .ToListAsync();
    }

    // Búsqueda por atributo dinámico (imposible sin un índice en SQL)
    public async Task<List<ProductDocument>> FindByAttributeAsync(string attrKey, BsonValue attrValue)
    {
        var filter = Builders<ProductDocument>.Filter.Eq($"Attributes.{attrKey}", attrValue);
        return await _collection.Find(filter).ToListAsync();
    }
}
```

### Redis — caché, sesiones, rate limiting

```csharp
// dotnet add package StackExchange.Redis
// dotnet add package Microsoft.Extensions.Caching.StackExchangeRedis

// Caché de datos con IDistributedCache
public class OrderCacheService
{
    private readonly IDistributedCache _cache;
    private static readonly TimeSpan DefaultExpiry = TimeSpan.FromMinutes(10);

    public async Task<OrderDto?> GetOrderAsync(Guid orderId)
    {
        var cacheKey = $"order:{orderId}";
        var cached = await _cache.GetStringAsync(cacheKey);

        if (cached is not null)
            return JsonSerializer.Deserialize<OrderDto>(cached);

        return null;
    }

    public async Task SetOrderAsync(Guid orderId, OrderDto order)
    {
        var cacheKey = $"order:{orderId}";
        var serialized = JsonSerializer.Serialize(order);

        await _cache.SetStringAsync(cacheKey, serialized, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = DefaultExpiry,
            SlidingExpiration = TimeSpan.FromMinutes(2) // resetea el TTL si se accede
        });
    }
}

// Rate limiting con Redis (sliding window)
public class RedisRateLimiter
{
    private readonly IConnectionMultiplexer _redis;

    public async Task<bool> IsAllowedAsync(string clientId, int maxRequests, TimeSpan window)
    {
        var db = _redis.GetDatabase();
        var key = $"ratelimit:{clientId}:{DateTimeOffset.UtcNow:yyyyMMddHHmm}";

        var current = await db.StringIncrementAsync(key);

        if (current == 1) // primera request en esta ventana
            await db.KeyExpireAsync(key, window);

        return current <= maxRequests;
    }
}
```

### Elasticsearch — búsqueda full-text y analytics

```csharp
// dotnet add package Elastic.Clients.Elasticsearch

// Perfecto para: búsqueda de productos, logs, analytics, autocompletado

public class ProductSearchService
{
    private readonly ElasticsearchClient _client;

    public async Task IndexProductAsync(Product product)
    {
        await _client.IndexAsync(new
        {
            Id          = product.Id,
            Name        = product.Name,         // analizado: tokenizado, stemmed, lowercase
            Description = product.Description,
            Category    = product.Category,     // keyword: exacto, para filtros/agregaciones
            Price       = product.Price,
            Tags        = product.Tags,
            CreatedAt   = product.CreatedAt
        }, i => i.Index("products").Id(product.Id.ToString()));
    }

    public async Task<List<ProductSearchResult>> SearchAsync(string query, string? category = null)
    {
        var response = await _client.SearchAsync<JsonElement>(s => s
            .Index("products")
            .Query(q => q
                .Bool(b => b
                    // Multi-match: busca en nombre (más relevante) y descripción
                    .Must(m => m.MultiMatch(mm => mm
                        .Query(query)
                        .Fields(new[] { "Name^3", "Description", "Tags^2" })  // ^N = boost
                        .Fuzziness(new Fuzziness("AUTO"))))  // tolerancia a errores ortográficos
                    // Filtro por categoría (no afecta al scoring)
                    .Filter(f => category != null
                        ? f.Term(t => t.Field("Category").Value(category))
                        : f.MatchAll())))
            .Sort(sort => sort.Score(sc => sc.Order(SortOrder.Desc)))
            .Size(20)
            .Highlight(h => h.Fields(f => f.Add("Description", new HighlightField()))));

        return response.Hits.Select(h => new ProductSearchResult(
            Id: h.Id!,
            Score: (float)(h.Score ?? 0),
            Highlights: h.Highlight?.GetValueOrDefault("Description") ?? []
        )).ToList();
    }
}
```

### Cuándo usar cada motor

| Motor | Cuándo usarlo | Cuándo NO usarlo |
|-------|---------------|------------------|
| **SQL Server / PostgreSQL** | Transacciones ACID, datos relacionales, reporting | Datos semi-estructurados, escala horizontal masiva |
| **MongoDB** | Documentos con estructura variable, catálogos, CMS | Transacciones complejas multi-documento, datos muy relacionales |
| **Redis** | Caché, sesiones, rate limiting, pub/sub, leaderboards | Datos persistentes críticos (sin backup), queries complejas |
| **Elasticsearch** | Búsqueda full-text, logs, analytics, autocompletado | Datos transaccionales, operaciones ACID |
| **Cassandra / CosmosDB** | Escrituras masivas, multi-región, series temporales | Queries ad-hoc complejas, joins |

---

## CQRS y Bases de Datos Separadas

En CQRS avanzado, el **write model** y el **read model** pueden estar en bases de datos completamente distintas, cada una optimizada para su propósito.

```
Comando                   Write Model               Domain Event
─────────────────────────►│ SQL Server         │──────────────────────►
CreateOrderCommand        │ normalizado        │   OrderCreatedEvent
                          │ consistencia fuerte│
                          └────────────────────┘

Domain Event              Read Model Projections
─────────────────────────►│ Elasticsearch      │◄──── GET /orders/search?q=...
OrderCreatedEvent         │ MongoDB             │◄──── GET /orders/{id}
                          │ Redis               │◄──── GET /dashboard/stats
                          └────────────────────┘
                          (desnormalizado, eventual consistency)
```

```csharp
// Projection: actualizar el read model cuando ocurre un evento de dominio
public class OrderProjection :
    INotificationHandler<OrderCreatedEvent>,
    INotificationHandler<OrderStatusChangedEvent>
{
    private readonly IElasticsearchClient _elastic;
    private readonly IMongoCollection<OrderReadModel> _mongo;

    // Cuando se crea un pedido → indexar en Elasticsearch para búsqueda
    public async Task Handle(OrderCreatedEvent evt, CancellationToken ct)
    {
        var readModel = new OrderReadModel
        {
            OrderId    = evt.OrderId,
            CustomerId = evt.CustomerId,
            Total      = evt.Total,
            Status     = "Pending",
            CreatedAt  = evt.OccurredAt,
            // datos desnormalizados — no hace falta un JOIN para mostrarlos
            CustomerName  = await _customerService.GetNameAsync(evt.CustomerId, ct),
            CustomerEmail = await _customerService.GetEmailAsync(evt.CustomerId, ct)
        };

        // Persistir en MongoDB para queries por ID
        await _mongo.InsertOneAsync(readModel, cancellationToken: ct);

        // Indexar en Elasticsearch para búsqueda full-text
        await _elastic.IndexAsync(readModel, i => i.Index("orders").Id(evt.OrderId.ToString()), ct);
    }

    // Cuando cambia el estado → actualizar ambos read models
    public async Task Handle(OrderStatusChangedEvent evt, CancellationToken ct)
    {
        // MongoDB update
        var update = Builders<OrderReadModel>.Update.Set(o => o.Status, evt.NewStatus);
        await _mongo.UpdateOneAsync(
            o => o.OrderId == evt.OrderId, update, cancellationToken: ct);

        // Elasticsearch update
        await _elastic.UpdateAsync<OrderReadModel>(
            evt.OrderId.ToString(),
            u => u.Index("orders").Doc(new { Status = evt.NewStatus }), ct);
    }
}
```

### Manejar la Eventual Consistency explícitamente

```csharp
// El cliente debe saber que puede haber un lag entre el comando y el read model

[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderRequest request)
    {
        var command = new CreateOrderCommand(request.CustomerId, request.Items);
        var orderId = await _mediator.Send(command);

        // Retornar 202 Accepted (no 201 Created) para indicar que el procesamiento
        // es asíncrono y el read model puede no estar disponible inmediatamente
        return AcceptedAtAction(
            actionName: nameof(GetOrder),
            routeValues: new { id = orderId },
            value: new
            {
                OrderId = orderId,
                Message = "Pedido aceptado. Los datos pueden tardar unos segundos en reflejarse."
            });
    }
}
```

---

## Estrategias de Migración en Producción

### Expand/Contract — migraciones sin downtime

El patrón **Expand/Contract** (también llamado Parallel Change) permite cambiar el schema sin interrumpir el servicio.

```
Ejemplo: renombrar columna "client_id" → "customer_id" en tabla orders

FASE 1 — EXPAND (código y BD son compatibles con ambas versiones)
  1. Agregar la nueva columna customer_id (nullable)
  2. Actualizar el código para escribir en AMBAS columnas
  3. Crear índice en customer_id
  4. Migrar datos: UPDATE orders SET customer_id = client_id WHERE customer_id IS NULL

FASE 2 — MIGRATE (datos completos en nueva columna)
  5. Verificar que customer_id tiene todos los datos: SELECT COUNT(*) WHERE customer_id IS NULL
  6. Hacer customer_id NOT NULL

FASE 3 — CONTRACT (eliminar lo viejo)
  7. Actualizar código para leer/escribir SOLO customer_id
  8. En el siguiente deploy: DROP COLUMN client_id
```

```sql
-- FASE 1: Expand — agregar nueva columna
ALTER TABLE orders ADD customer_id UNIQUEIDENTIFIER NULL;
CREATE INDEX idx_orders_customer_id ON orders (customer_id);

-- FASE 1: Migrar datos en batches (no un UPDATE masivo que bloquee)
DECLARE @BatchSize INT = 1000;
DECLARE @Rows INT = 1;

WHILE @Rows > 0
BEGIN
    UPDATE TOP (@BatchSize) orders
    SET customer_id = client_id
    WHERE customer_id IS NULL;

    SET @Rows = @@ROWCOUNT;
    
    WAITFOR DELAY '00:00:01'; -- pausa entre batches para no saturar la BD
END;

-- FASE 2: Hacer NOT NULL cuando todos los datos están migrados
ALTER TABLE orders ALTER COLUMN customer_id UNIQUEIDENTIFIER NOT NULL;

-- FASE 3: Contract — eliminar columna vieja (deploy separado)
ALTER TABLE orders DROP COLUMN client_id;
```

```csharp
// Código durante la FASE 1 (compatible con ambas columnas)
public class OrderRepository
{
    public async Task SaveAsync(Order order)
    {
        var sql = @"
            INSERT INTO orders (id, client_id, customer_id, total, status, created_at)
            VALUES (@Id, @CustomerId, @CustomerId, @Total, @Status, @CreatedAt)";
            // ↑ escribe en ambas columnas durante la migración

        await _connection.ExecuteAsync(sql, new
        {
            order.Id,
            order.CustomerId, // mismo valor para ambas columnas
            order.Total,
            order.Status,
            CreatedAt = DateTimeOffset.UtcNow
        });
    }
}
```

### Zero-downtime ALTER TABLE

```sql
-- ❌ En SQL Server, este ALTER TABLE bloquea la tabla completa
ALTER TABLE orders ADD notes NVARCHAR(MAX) NOT NULL DEFAULT '';
-- Esto puede bloquear la tabla durante minutos si tiene millones de filas

-- ✅ Alternativa: agregar como nullable primero, luego agregar el constraint
ALTER TABLE orders ADD notes NVARCHAR(MAX) NULL;  -- inmediato, sin bloqueo
-- ... actualizar datos ...
ALTER TABLE orders ALTER COLUMN notes NVARCHAR(MAX) NOT NULL
    WITH VALUES;  -- WITH VALUES usa el DEFAULT para filas NULL existentes
```

```sql
-- PostgreSQL: operaciones que sí son online (no bloquean)
-- Agregar columna nullable: SÍ online
ALTER TABLE orders ADD COLUMN notes TEXT;

-- Agregar índice: SÍ online con CONCURRENTLY
CREATE INDEX CONCURRENTLY idx_orders_notes ON orders (notes);
-- Sin CONCURRENTLY: bloquea toda la tabla durante la creación
-- Con CONCURRENTLY: tarda más pero no bloquea

-- Agregar constraint NOT NULL: NO es online en versiones < 14
-- En PostgreSQL 14+: usar NOT VALID y luego VALIDATE
ALTER TABLE orders ADD CONSTRAINT chk_notes_not_null
    CHECK (notes IS NOT NULL) NOT VALID;  -- no valida filas existentes (rápido)
-- ... cuando tengas ventana de mantenimiento:
ALTER TABLE orders VALIDATE CONSTRAINT chk_notes_not_null;
```

### Feature Flags para cambios de schema

```csharp
// Usar un feature flag para controlar el switch entre schema viejo y nuevo
// Permite hacer rollback inmediato si hay problemas

public class OrderRepository
{
    private readonly IFeatureManager _featureManager;

    public async Task<List<Order>> GetByCustomerAsync(Guid customerId)
    {
        // Durante la migración: la mitad del tráfico usa la columna vieja, la otra el nuevo schema
        // Permite verificar que la nueva columna funciona antes de hacer el switch completo
        if (await _featureManager.IsEnabledAsync("UseNewCustomerIdColumn"))
        {
            return await GetByCustomerNewSchemaAsync(customerId);  // usa customer_id
        }
        else
        {
            return await GetByCustomerOldSchemaAsync(customerId);  // usa client_id
        }
    }
}
```

```json
// appsettings.json — Microsoft.FeatureManagement
{
  "FeatureManagement": {
    "UseNewCustomerIdColumn": {
      "EnabledFor": [
        {
          "Name": "Percentage",
          "Parameters": {
            "Value": 10  // 10% del tráfico usa el nuevo schema → ir subiendo gradualmente
          }
        }
      ]
    }
  }
}
```

### Blue/Green Database Deployment

```
BLUE (actual)              GREEN (nueva versión)
┌──────────────────┐       ┌──────────────────┐
│  App v1          │       │  App v2          │
│  Schema v1       │       │  Schema v2       │
└──────────────────┘       └──────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐       ┌──────────────────┐
│  DB Primary      │◄──────│  DB Réplica      │
│  (lectura/escr.) │ replic │  (solo lectura)  │
└──────────────────┘       └──────────────────┘

Pasos:
1. Desplegar App v2 + Schema v2 en GREEN (sin tráfico)
2. Sincronizar datos BLUE → GREEN via replicación
3. Switch del load balancer: 0% → GREEN
4. Verificar GREEN durante N minutos
5. Switch completo: 100% → GREEN
6. BLUE queda como rollback por N horas
```
