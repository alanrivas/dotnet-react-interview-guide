---
title: "🔁 Réplicas, Sharding y Connection Pooling"
sidebar_position: 1
---

# 🔁 Réplicas, Sharding y Connection Pooling

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

