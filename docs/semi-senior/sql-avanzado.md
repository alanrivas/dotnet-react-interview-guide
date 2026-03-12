---
id: sql-avanzado
title: SQL Avanzado
sidebar_position: 8
---

# SQL — Avanzado 🟡

## Window Functions

Las funciones de ventana operan sobre un conjunto de filas relacionadas sin colapsar el resultado.

```sql
-- ROW_NUMBER: número de fila dentro de la partición
SELECT 
    Nombre,
    Precio,
    CategoriaId,
    ROW_NUMBER() OVER (PARTITION BY CategoriaId ORDER BY Precio DESC) AS RankEnCategoria
FROM Productos;

-- RANK vs DENSE_RANK
-- RANK: 1, 2, 2, 4 (salta números si hay empate)
-- DENSE_RANK: 1, 2, 2, 3 (no salta)
SELECT 
    Nombre,
    Precio,
    RANK() OVER (ORDER BY Precio DESC) AS Ranking,
    DENSE_RANK() OVER (ORDER BY Precio DESC) AS RankingDenso
FROM Productos;

-- Agregar con OVER (sin GROUP BY)
SELECT 
    Nombre,
    Precio,
    AVG(Precio) OVER () AS PromedioGlobal,
    AVG(Precio) OVER (PARTITION BY CategoriaId) AS PromedioCategoria,
    Precio - AVG(Precio) OVER (PARTITION BY CategoriaId) AS DiferenciaDelPromedio
FROM Productos;

-- LAG y LEAD: acceder a filas anteriores/posteriores
SELECT 
    Fecha,
    Ventas,
    LAG(Ventas, 1) OVER (ORDER BY Fecha) AS VentasAyer,
    Ventas - LAG(Ventas, 1) OVER (ORDER BY Fecha) AS Diferencia
FROM VentasDiarias;
```

---

## CTEs (Common Table Expressions)

```sql
-- CTE básica
WITH ProductosCostosos AS (
    SELECT Id, Nombre, Precio
    FROM Productos
    WHERE Precio > 500
),
CategoriasConCostosos AS (
    SELECT DISTINCT c.Nombre AS Categoria
    FROM Categorias c
    INNER JOIN ProductosCostosos p ON p.CategoriaId = c.Id
)
SELECT * FROM CategoriasConCostosos;

-- CTE recursiva (jerarquías, árboles)
WITH EmpleadosJerarquia AS (
    -- Caso base: empleados sin jefe (CEO)
    SELECT Id, Nombre, JefeId, 0 AS Nivel
    FROM Empleados
    WHERE JefeId IS NULL
    
    UNION ALL
    
    -- Caso recursivo
    SELECT e.Id, e.Nombre, e.JefeId, h.Nivel + 1
    FROM Empleados e
    INNER JOIN EmpleadosJerarquia h ON e.JefeId = h.Id
)
SELECT * FROM EmpleadosJerarquia ORDER BY Nivel, Nombre;
```

---

## Índices avanzados

```sql
-- Índice cubriente (covering index) — include columns
-- El query puede resolverse solo con el índice sin acceder a la tabla
CREATE INDEX IX_Productos_Cat_Precio
ON Productos (CategoriaId, Precio)
INCLUDE (Nombre, Stock);  -- columnas adicionales en las hojas del B-tree

-- Filtered index — para columnas con muchos NULLs o valores específicos
CREATE INDEX IX_Pedidos_Pendientes
ON Pedidos (FechaCreacion)
WHERE Estado = 'Pendiente';  -- solo indexa pendientes

-- Índice columnstore — para analítica y reportes
CREATE COLUMNSTORE INDEX IX_Ventas_Columnstore
ON Ventas (Fecha, ProductoId, Cantidad, Monto);
```

### Cómo analizar performance de queries

```sql
-- Ver el plan de ejecución
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT * FROM Productos WHERE CategoriaId = 1 AND Precio > 100;

-- Buscar: Table Scan (malo) vs Index Seek (bueno)
-- Ver: Estimated Rows, Actual Rows (si difieren mucho, estadísticas desactualizadas)

-- Actualizar estadísticas
UPDATE STATISTICS Productos;
```

---

## Stored Procedures vs Queries Dinámicas

```sql
-- Stored Procedure
CREATE PROCEDURE sp_BuscarProductos
    @Termino NVARCHAR(100),
    @CategoriaId INT = NULL,
    @PrecioMin DECIMAL(10,2) = 0,
    @PrecioMax DECIMAL(10,2) = 9999999
AS
BEGIN
    SELECT p.Id, p.Nombre, p.Precio, c.Nombre AS Categoria
    FROM Productos p
    INNER JOIN Categorias c ON p.CategoriaId = c.Id
    WHERE p.Nombre LIKE '%' + @Termino + '%'
      AND (@CategoriaId IS NULL OR p.CategoriaId = @CategoriaId)
      AND p.Precio BETWEEN @PrecioMin AND @PrecioMax;
END

-- Ejecución
EXEC sp_BuscarProductos @Termino = 'laptop', @CategoriaId = 1;
```

---

## Optimización de queries comunes

```sql
-- ❌ SELECT * (trae columnas innecesarias)
SELECT * FROM Productos;

-- ✅ Solo las columnas necesarias
SELECT Id, Nombre, Precio FROM Productos;

-- ❌ Función en WHERE (no puede usar índice)
SELECT * FROM Pedidos WHERE YEAR(FechaCreacion) = 2024;

-- ✅ Rango de fechas (usa índice)
SELECT * FROM Pedidos 
WHERE FechaCreacion >= '2024-01-01' AND FechaCreacion < '2025-01-01';

-- ❌ OR puede deshabilitar índices
SELECT * FROM Clientes WHERE Nombre = 'Juan' OR Email = 'juan@example.com';

-- ✅ UNION para permitir uso de índices separados
SELECT * FROM Clientes WHERE Nombre = 'Juan'
UNION
SELECT * FROM Clientes WHERE Email = 'juan@example.com';
```

---

## Niveles de aislamiento de transacciones

| Nivel | Dirty Read | Non-Repeatable Read | Phantom Read |
|-------|-----------|---------------------|--------------|
| Read Uncommitted | ✅ posible | ✅ posible | ✅ posible |
| Read Committed (default) | ❌ | ✅ posible | ✅ posible |
| Repeatable Read | ❌ | ❌ | ✅ posible |
| Serializable | ❌ | ❌ | ❌ |
| Snapshot | ❌ | ❌ | ❌ |

```sql
SET TRANSACTION ISOLATION LEVEL READ COMMITTED; -- default SQL Server
SET TRANSACTION ISOLATION LEVEL SNAPSHOT;       -- MVCC, menos bloqueos
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre un índice clustered y non-clustered?**
> **Clustered**: determina el orden físico de los datos en disco (solo uno por tabla, generalmente la PK). **Non-clustered**: estructura separada con punteros a los datos (puede haber varios). Lecturas por PK son muy rápidas en clustered.

**2. ¿Qué es un deadlock y cómo se previene?**
> Ocurre cuando dos transacciones se bloquean mutuamente esperando recursos que la otra tiene. Se previene: accediendo a recursos en el mismo orden, usando transacciones cortas, con `NOLOCK` (cuidado con dirty reads), o con niveles de aislamiento SNAPSHOT.

**3. ¿Cuándo usarías una CTE vs una subquery vs una tabla temporal?**
> **CTE**: legibilidad, queries recursivas, una sola vez. **Subquery**: simple, una sola referencia. **Tabla temporal (`#tabla`)**: cuando necesitas referenciar múltiples veces el mismo resultado o realizar operaciones sobre él.

**4. ¿Qué es el problema de N+1 en SQL?**
> Ejecutar 1 query principal y luego N queries adicionales (una por cada resultado). Ej: traer 100 pedidos y luego hacer 100 queries para los items de cada pedido. Se soluciona con JOINs o eager loading.
