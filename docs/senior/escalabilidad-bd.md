---
id: escalabilidad-bd
title: Escalabilidad de Bases de Datos
sidebar_position: 13
---

# Escalabilidad de Bases de Datos

> **Regla de oro**: optimizar antes de escalar. Un índice bien puesto puede eliminar la necesidad de añadir servidores.

## Bottlenecks Comunes en la Base de Datos

### Cómo identificarlos

```sql
-- SQL Server: Query Store — las queries más lentas del último día
SELECT TOP 20
    qs.avg_duration / 1000.0                              AS avg_duration_ms,
    qs.max_duration / 1000.0                              AS max_duration_ms,
    qs.count_executions,
    SUBSTRING(qt.query_sql_text, 1, 200)                  AS query_text,
    qp.query_plan
FROM sys.query_store_query_stats qs
JOIN sys.query_store_query       qq ON qs.query_id       = qq.query_id
JOIN sys.query_store_plan        qp ON qs.plan_id        = qp.plan_id
JOIN sys.query_store_query_text  qt ON qq.query_text_id  = qt.query_text_id
WHERE qs.last_execution_time >= DATEADD(DAY, -1, GETUTCDATE())
ORDER BY qs.avg_duration DESC;
```

```sql
-- PostgreSQL: pg_stat_statements — requiere la extensión habilitada
SELECT
    round(total_exec_time::numeric, 2)  AS total_ms,
    round(mean_exec_time::numeric, 2)   AS avg_ms,
    calls,
    round(stddev_exec_time::numeric, 2) AS stddev_ms,
    left(query, 150)                    AS query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

```sql
-- SQL Server: detectar locks activos
SELECT
    r.session_id,
    r.blocking_session_id,
    r.wait_type,
    r.wait_time / 1000.0   AS wait_seconds,
    r.status,
    SUBSTRING(t.text, 1, 200) AS query_text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.blocking_session_id > 0;
```

```sql
-- SQL Server: ver el estado del connection pool (conexiones activas vs idle)
SELECT
    DB_NAME(dbid)            AS database_name,
    COUNT(*)                 AS total_connections,
    SUM(CASE WHEN status = 'sleeping' THEN 1 ELSE 0 END) AS idle,
    SUM(CASE WHEN status = 'running'  THEN 1 ELSE 0 END) AS active
FROM sys.sysprocesses
WHERE dbid > 0
GROUP BY dbid;
```

### Señales de alerta

| Señal | Posible causa | Acción |
|-------|---------------|--------|
| CPU BD > 80% constante | Queries sin índice, sorts en memoria | Analizar slow query log, añadir índices |
| I/O alta (wait IO_COMPLETION) | Muchos full table scans | Covering indexes, separar datos calientes/fríos |
| Lock waits (LCK_M_X) | Transacciones largas, deadlocks | Acortar transacciones, NOLOCK donde aplique |
| Connection pool exhaustion | Muchos requests concurrentes o conexiones no cerradas | pgBouncer, revisar using en EF Core |
| Latencia p99 alta pero p50 ok | Queries ocasionalmente lentas (index fragmentation, stats desactualizados) | Rebuild indexes, UPDATE STATISTICS |

---

## Índices Avanzados

### B-tree — el índice estándar

```sql
-- La mayoría de índices son B-tree (equilibrado, O(log n) en búsqueda)
-- Útil para: igualdad (=), rango (<, >, BETWEEN), ORDER BY, prefix LIKE

-- Índice simple
CREATE INDEX idx_orders_customer ON orders (customer_id);

-- Verificar que SQL Server usa el índice
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;
-- o en SQL Server:
SET STATISTICS IO ON;
SELECT * FROM orders WHERE customer_id = 42;
```

### Composite Index — el orden importa

```sql
-- Regla: poner primero las columnas de IGUALDAD, luego las de RANGO
-- Regla: el índice sirve para prefijos (A), (A,B), (A,B,C) — pero NO (B) ni (B,C) solos

-- Query: WHERE status = 'pending' AND created_at > '2024-01-01' ORDER BY created_at
-- ✅ Correcto: igualdad primero (status), luego rango (created_at)
CREATE INDEX idx_orders_status_date ON orders (status, created_at);

-- ❌ Incorrecto para esta query: rango primero
CREATE INDEX idx_orders_date_status ON orders (created_at, status);
-- → SQL Server usaría el índice solo para created_at, luego filtraría status con scan
```

### Covering Index — evitar el "key lookup"

```sql
-- Un "key lookup" (o "bookmark lookup") ocurre cuando el índice no tiene todas
-- las columnas necesarias y el motor debe volver a la tabla principal.

-- Query:
SELECT order_id, total, status FROM orders WHERE customer_id = 42;

-- Índice sin covering: tiene customer_id pero no total ni status
CREATE INDEX idx_orders_customer ON orders (customer_id);
-- → SQL usa el índice para encontrar filas, pero luego hace key lookup para total y status

-- ✅ Covering index: incluir columnas extras sin indexarlas
CREATE INDEX idx_orders_customer_covering
    ON orders (customer_id)
    INCLUDE (total, status, created_at);
-- → SQL satisface la query completamente desde el índice, sin tocar la tabla
```

### Filtered Index (SQL Server) / Partial Index (PostgreSQL)

```sql
-- Indexar solo un SUBSET de filas — útil cuando la mayoría del tráfico es sobre ese subset

-- SQL Server: solo índice para pedidos pendientes
-- Si el 95% de las queries buscan pedidos 'pending', el índice es mucho más pequeño
CREATE INDEX idx_orders_pending
    ON orders (created_at, customer_id)
    WHERE status = 'pending';  -- filtered index

-- PostgreSQL: equivalente con partial index
CREATE INDEX idx_orders_pending
    ON orders (created_at, customer_id)
    WHERE status = 'pending';

-- Solo se usa cuando la query tiene: WHERE status = 'pending'
SELECT * FROM orders WHERE status = 'pending' AND customer_id = 42;  -- ✅ usa el índice
SELECT * FROM orders WHERE customer_id = 42;                          -- ❌ no lo usa
```

### Index Fragmentation — detectar y remediar

```sql
-- SQL Server: detectar fragmentación
SELECT
    OBJECT_NAME(ips.object_id)      AS table_name,
    i.name                           AS index_name,
    ips.avg_fragmentation_in_percent,
    ips.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'SAMPLED') ips
JOIN sys.indexes i ON ips.object_id = i.object_id AND ips.index_id = i.index_id
WHERE ips.avg_fragmentation_in_percent > 5
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- < 30% fragmentación: REORGANIZE (online, no bloquea)
ALTER INDEX idx_orders_customer ON orders REORGANIZE;

-- > 30% fragmentación: REBUILD (más costoso pero más efectivo)
ALTER INDEX idx_orders_customer ON orders REBUILD WITH (ONLINE = ON);

-- Rebuild todos los índices de una tabla
ALTER INDEX ALL ON orders REBUILD WITH (ONLINE = ON);
```

### Cuándo los índices perjudican

```sql
-- Cada índice ralentiza INSERT, UPDATE, DELETE porque el motor debe mantenerlo actualizado.
-- Regla práctica: si una tabla tiene > 5-7 índices, revisar si todos se usan.

-- SQL Server: detectar índices que NUNCA se usan (desde el último reinicio)
SELECT
    OBJECT_NAME(i.object_id) AS table_name,
    i.name                    AS index_name,
    i.type_desc,
    us.user_seeks,
    us.user_scans,
    us.user_lookups,
    us.user_updates           -- coste de mantener el índice
FROM sys.indexes i
LEFT JOIN sys.dm_db_index_usage_stats us
    ON i.object_id = us.object_id AND i.index_id = us.index_id
    AND us.database_id = DB_ID()
WHERE OBJECT_NAME(i.object_id) = 'orders'
    AND i.type_desc <> 'HEAP'
ORDER BY COALESCE(us.user_seeks + us.user_scans + us.user_lookups, 0) ASC;
```

---

## Read Replicas

La replicación copia los datos del servidor primario (escrituras) a uno o más servidores secundarios (lecturas).

```
                  ┌──────────────────────────────────────────────┐
Escrituras ──────►│          PRIMARY (Read-Write)                │
                  │  INSERT, UPDATE, DELETE, DDL                  │
                  └──────────────────┬───────────────────────────┘
                    Replicación      │
                    (async/sync)     │
          ┌──────────────────────────▼──────────────────────────┐
          │                                                       │
          ▼                                                       ▼
┌──────────────────────┐                             ┌──────────────────────┐
│  REPLICA 1 (Read)    │                             │  REPLICA 2 (Read)    │
│  SELECT, reportes    │                             │  SELECT, analytics   │
└──────────────────────┘                             └──────────────────────┘
          ▲                                                       ▲
Lecturas  │──────────────────────────────────────────────────────│
```

### Síncrona vs Asíncrona

| | Síncrona | Asíncrona |
|--|----------|-----------|
| **Consistencia** | Fuerte — la réplica tiene los datos inmediatamente | Eventual — puede haber retraso (lag) |
| **Latencia de escritura** | Alta — esperar confirmación de la réplica | Baja — el primary no espera |
| **Riesgo** | Si la réplica falla, el primary se degrada | Si el primary falla, puede haber pérdida de datos mínima |
| **Uso típico** | DR crítico, financial | Lectura de reportes, analytics |

### En EF Core — separar reads de writes

```csharp
// Opción 1: DbContextFactory con connection string según operación
builder.Services.AddDbContextFactory<AppDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("Primary")));

builder.Services.AddDbContextFactory<AppDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("ReadReplica")),
    ServiceLifetime.Scoped); // alias diferente registrando como named

// Opción 2 (más limpia): dos DbContext distintos
public class WriteDbContext : AppDbContext
{
    public WriteDbContext(DbContextOptions<WriteDbContext> options) : base(options) { }
}

public class ReadDbContext : AppDbContext
{
    public ReadDbContext(DbContextOptions<ReadDbContext> options) : base(options)
    {
        // Modo read-only: evitar tracking, no permite SaveChanges
        ChangeTracker.QueryTrackingBehavior = QueryTrackingBehavior.NoTracking;
        ChangeTracker.AutoDetectChangesEnabled = false;
    }
}

// appsettings.json
// "ConnectionStrings": {
//   "Write": "Server=primary-db;...",
//   "Read":  "Server=replica-db;..."
// }

builder.Services.AddDbContext<WriteDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("Write")));

builder.Services.AddDbContext<ReadDbContext>(opts =>
    opts.UseSqlServer(builder.Configuration.GetConnectionString("Read")));
```

```csharp
// Uso en el servicio — separar claramente reads de writes
public class OrderService
{
    private readonly WriteDbContext _writeDb;
    private readonly ReadDbContext  _readDb;

    public async Task<Order> CreateOrderAsync(CreateOrderCommand cmd)
    {
        var order = new Order(cmd);
        _writeDb.Orders.Add(order);
        await _writeDb.SaveChangesAsync(); // va al primary
        return order;
    }

    public async Task<List<OrderDto>> GetOrdersByCustomerAsync(Guid customerId)
    {
        return await _readDb.Orders              // va a la réplica
            .Where(o => o.CustomerId == customerId)
            .Select(o => new OrderDto(o.Id, o.Total, o.Status))
            .ToListAsync();
    }
}
```

---

## Particionamiento (Sharding)

### Partición vertical — dividir columnas

```sql
-- Antes: tabla orders con TODAS las columnas (incluyendo datos pesados)
CREATE TABLE orders (
    id           UNIQUEIDENTIFIER PRIMARY KEY,
    customer_id  UNIQUEIDENTIFIER NOT NULL,
    total        DECIMAL(18,2)    NOT NULL,
    status       NVARCHAR(50)     NOT NULL,
    created_at   DATETIMEOFFSET   NOT NULL,
    -- estas columnas se leen raramente pero engordan todas las queries:
    shipping_address NVARCHAR(MAX),
    billing_address  NVARCHAR(MAX),
    notes            NVARCHAR(MAX),
    internal_audit_log NVARCHAR(MAX)  -- 50KB por fila
);

-- ✅ Después: separar datos frecuentes de datos pesados
CREATE TABLE orders (            -- tabla "caliente" — pequeña y rápida
    id          UNIQUEIDENTIFIER PRIMARY KEY,
    customer_id UNIQUEIDENTIFIER NOT NULL,
    total       DECIMAL(18,2)    NOT NULL,
    status      NVARCHAR(50)     NOT NULL,
    created_at  DATETIMEOFFSET   NOT NULL
);

CREATE TABLE orders_details (    -- tabla "fría" — datos pesados, acceso menos frecuente
    order_id             UNIQUEIDENTIFIER PRIMARY KEY REFERENCES orders(id),
    shipping_address     NVARCHAR(MAX),
    billing_address      NVARCHAR(MAX),
    notes                NVARCHAR(MAX),
    internal_audit_log   NVARCHAR(MAX)
);
```

### Sharding horizontal — distribuir filas entre servidores

```
Shard 1 (Europa):    customer_id hash % 3 == 0
Shard 2 (América):   customer_id hash % 3 == 1
Shard 3 (Asia):      customer_id hash % 3 == 2

                  ┌────────────────────────────────────────────┐
                  │           Shard Router / Proxy              │
                  │  determina a qué shard va la query          │
                  └──────────┬─────────────┬───────────────────┘
                             │             │             │
                             ▼             ▼             ▼
                        ┌─────────┐  ┌─────────┐  ┌─────────┐
                        │ Shard 1 │  │ Shard 2 │  │ Shard 3 │
                        │ users   │  │ users   │  │ users   │
                        │ 0,3,6.. │  │ 1,4,7.. │  │ 2,5,8.. │
                        └─────────┘  └─────────┘  └─────────┘
```

### Estrategias de sharding

```csharp
// Range-based: shards por rango de valores
// Pros: fácil de entender, las queries de rango van a un shard
// Cons: hotspot si los datos recientes están en un solo shard
int GetShard_Range(Guid customerId, int totalShards)
{
    // Por ejemplo, shardear por fecha de creación del cliente
    // Shard 0: clientes 2020-2021, Shard 1: 2022-2023, etc.
    // ❌ Problema: el shard del año actual recibe TODA la escritura
    return 0; // simplificado
}

// Hash-based: distribución uniforme
// Pros: distribución uniforme de carga
// Cons: cross-shard queries son lentas, rebalancing es doloroso
int GetShard_Hash(Guid customerId, int totalShards)
{
    var hash = Math.Abs(customerId.GetHashCode());
    return hash % totalShards;
}

// Directory-based: tabla de mapeo explícita
// Pros: flexible, fácil de mover datos entre shards
// Cons: la tabla de directorio es un punto de fallo / cuello de botella
async Task<int> GetShard_Directory(Guid customerId)
{
    return await _shardDirectory.LookupAsync(customerId);
    // { CustomerId: X, Shard: 2, Region: "EU" }
}
```

### Problemas del sharding

```
❌ Cross-shard queries:
   SELECT * FROM orders WHERE status = 'pending'
   → Hay que ir a TODOS los shards y hacer UNION de resultados (scatter-gather)
   → Lento y consume recursos en todos los servidores

❌ Rebalancing:
   Si añades un shard 4 al sistema hash % 3:
   → Hay que mover ~25% de los datos a los shards correctos
   → Durante la migración, el sistema está degradado

❌ Hotspot:
   Si la sharding key es "fecha de creación" y los usuarios solo escriben datos nuevos,
   el shard más reciente recibe el 100% de las escrituras

✅ Regla: NO hacer sharding hasta que hayas agotado:
   1. Optimización de queries e índices
   2. Read replicas para escalar lecturas
   3. Caché (Redis) para reducir la carga en BD
   4. Particionamiento de tablas (table partitioning nativo de SQL Server/PostgreSQL)
```

### Table Partitioning nativo (alternativa al sharding)

```sql
-- SQL Server: particionar una tabla grande por fecha — todo en un servidor
-- pero los datos se organizan físicamente en particiones separadas

-- 1. Función de partición
CREATE PARTITION FUNCTION pf_OrderDate (DATETIMEOFFSET)
AS RANGE RIGHT FOR VALUES (
    '2023-01-01', '2024-01-01', '2025-01-01'
);
-- Partición 1: < 2023, Partición 2: 2023, Partición 3: 2024, Partición 4: >= 2025

-- 2. Esquema de partición
CREATE PARTITION SCHEME ps_OrderDate
AS PARTITION pf_OrderDate
TO (FG_2022, FG_2023, FG_2024, FG_2025); -- cada partición en su filegroup

-- 3. Tabla particionada
CREATE TABLE orders (
    id         UNIQUEIDENTIFIER NOT NULL,
    created_at DATETIMEOFFSET   NOT NULL,
    total      DECIMAL(18,2)    NOT NULL,
    status     NVARCHAR(50)     NOT NULL
) ON ps_OrderDate(created_at); -- particionada por created_at

-- Las queries con WHERE created_at >= '2024-01-01' solo leen la partición 2024
-- "Partition elimination" → mucho más rápido que full scan
```

---

## Connection Pooling

### Por qué crear conexiones es costoso

Establecer una conexión a SQL Server implica: autenticación TLS, negociación de protocolo, asignación de memoria en el servidor, y puede tomar 50-200ms. El connection pool reutiliza conexiones ya establecidas.

```csharp
// ADO.NET gestiona el pool automáticamente — no necesitas hacer nada especial
// Solo asegúrate de CERRAR (o usar using) las conexiones

// ✅ Correcto — la conexión vuelve al pool al salir del using
await using var connection = new SqlConnection(connectionString);
await connection.OpenAsync();
// ... usar la conexión ...
// Al salir del using, no se cierra realmente, vuelve al pool

// ❌ Incorrecto — la conexión permanece "abierta" y el pool se agota
var connection = new SqlConnection(connectionString);
await connection.OpenAsync();
// ... se olvida de cerrarla ...
```

### Configurar el pool en la connection string

```csharp
// appsettings.json — connection string con parámetros del pool
// "Server=.;Database=MiApp;Integrated Security=true;
//  Min Pool Size=5;Max Pool Size=100;Connect Timeout=30;
//  Pooling=true;Connection Lifetime=300"

// En EF Core
builder.Services.AddDbContext<AppDbContext>(opts =>
{
    opts.UseSqlServer(connectionString, sqlOpts =>
    {
        sqlOpts.CommandTimeout(30); // timeout por query en segundos
        sqlOpts.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null); // retry automático en errores transitorios
    });
    
    // En producción: no usar sensitive data logging
    if (!builder.Environment.IsDevelopment())
        opts.EnableSensitiveDataLogging(false);
});
```

### pgBouncer para PostgreSQL

```ini
; pgbouncer.ini — pooler externo para PostgreSQL
[databases]
miapp = host=postgresql-primary port=5432 dbname=miapp

[pgbouncer]
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

; Transaction pooling: la conexión al servidor vuelve al pool entre transacciones
; Modo más eficiente — permite muchos más clientes que conexiones reales al servidor
pool_mode = transaction
max_client_conn = 1000    ; conexiones que acepta pgBouncer de los clientes
default_pool_size = 25    ; conexiones REALES hacia PostgreSQL por base de datos
min_pool_size = 5
reserve_pool_size = 5     ; conexiones extra para picos
```

```yaml
# docker-compose.yml — stack PostgreSQL con pgBouncer
services:
  postgresql:
    image: postgres:16
    environment:
      POSTGRES_DB: miapp
      POSTGRES_USER: appuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data

  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    ports:
      - "6432:6432"       # La app conecta a pgBouncer, no a PostgreSQL directamente
    volumes:
      - ./pgbouncer.ini:/etc/pgbouncer/pgbouncer.ini
    depends_on:
      - postgresql
```

### DbContext no es thread-safe

```csharp
// ❌ NUNCA compartir un DbContext entre requests o threads
public class OrderController : ControllerBase
{
    private static readonly AppDbContext _sharedContext; // ← DESASTRE

    // ✅ Correcto: DI inyecta un DbContext POR REQUEST (Scoped)
    private readonly AppDbContext _dbContext;
    
    public OrderController(AppDbContext dbContext) => _dbContext = dbContext;
}

// ❌ NUNCA usar DbContext en paralelo
var orders = new List<Order>();
await Parallel.ForEachAsync(customerIds, async (id, ct) =>
{
    var order = await _dbContext.Orders.FirstOrDefaultAsync(o => o.CustomerId == id, ct);
    // ← InvalidOperationException: "A second operation was started on this context instance"
});

// ✅ Correcto: crear un scope por tarea paralela
await Parallel.ForEachAsync(customerIds, async (id, ct) =>
{
    using var scope = _serviceScopeFactory.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var order = await dbContext.Orders.FirstOrDefaultAsync(o => o.CustomerId == id, ct);
});
```

---

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
