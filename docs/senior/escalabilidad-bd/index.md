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

