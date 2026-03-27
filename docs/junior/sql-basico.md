---
id: sql-basico
title: SQL - Fundamentos
sidebar_position: 4
---

# SQL — Fundamentos 🟢

## Comandos básicos (CRUD)

```sql
-- CREATE TABLE
CREATE TABLE Productos (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Nombre NVARCHAR(100) NOT NULL,
    Precio DECIMAL(10,2) NOT NULL,
    Stock INT DEFAULT 0,
    CategoriaId INT,
    FechaCreacion DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (CategoriaId) REFERENCES Categorias(Id)
);

-- INSERT
INSERT INTO Productos (Nombre, Precio, Stock, CategoriaId)
VALUES ('Laptop Dell', 999.99, 50, 1);

-- SELECT
SELECT Id, Nombre, Precio FROM Productos WHERE Precio > 100;

-- UPDATE
UPDATE Productos SET Precio = 1099.99 WHERE Id = 1;

-- DELETE
DELETE FROM Productos WHERE Id = 1;
```

---

## Cláusulas SELECT

```sql
SELECT 
    p.Nombre,
    p.Precio,
    c.Nombre AS Categoria
FROM Productos p
INNER JOIN Categorias c ON p.CategoriaId = c.Id
WHERE p.Precio > 100
    AND p.Stock > 0
ORDER BY p.Precio DESC
LIMIT 10;  -- En SQL Server: TOP 10 en el SELECT
```

---

## JOINs — El tema más preguntado

```sql
-- INNER JOIN: solo registros que coinciden en AMBAS tablas
SELECT p.Nombre, c.Nombre
FROM Productos p
INNER JOIN Categorias c ON p.CategoriaId = c.Id;

-- LEFT JOIN: todos los productos, aunque no tengan categoría
SELECT p.Nombre, c.Nombre
FROM Productos p
LEFT JOIN Categorias c ON p.CategoriaId = c.Id;

-- RIGHT JOIN: todas las categorías, aunque no tengan productos
SELECT p.Nombre, c.Nombre
FROM Productos p
RIGHT JOIN Categorias c ON p.CategoriaId = c.Id;

-- FULL OUTER JOIN: todos, con o sin coincidencia
SELECT p.Nombre, c.Nombre
FROM Productos p
FULL OUTER JOIN Categorias c ON p.CategoriaId = c.Id;
```

:::tip Visualización
```
INNER JOIN: A ∩ B        LEFT JOIN: A completo + B donde coincide
RIGHT JOIN: B completo + A donde coincide    FULL: A ∪ B
```
:::

---

## GROUP BY y funciones de agregación

```sql
-- Contar productos por categoría
SELECT 
    c.Nombre AS Categoria,
    COUNT(p.Id) AS CantidadProductos,
    AVG(p.Precio) AS PrecioPromedio,
    MAX(p.Precio) AS PrecioMaximo,
    MIN(p.Precio) AS PrecioMinimo,
    SUM(p.Stock) AS StockTotal
FROM Categorias c
LEFT JOIN Productos p ON p.CategoriaId = c.Id
GROUP BY c.Id, c.Nombre
HAVING COUNT(p.Id) > 5  -- Filtrar después del GROUP BY
ORDER BY CantidadProductos DESC;
```

:::note Diferencia clave
- **WHERE**: filtra **antes** del GROUP BY (sobre filas individuales)
- **HAVING**: filtra **después** del GROUP BY (sobre grupos)
:::

---

## Subqueries

```sql
-- Productos más caros que el promedio
SELECT Nombre, Precio
FROM Productos
WHERE Precio > (SELECT AVG(Precio) FROM Productos);

-- Existe al menos un pedido
SELECT Nombre
FROM Clientes c
WHERE EXISTS (
    SELECT 1 FROM Pedidos p WHERE p.ClienteId = c.Id
);
```

---

## Índices

```sql
-- Índice simple
CREATE INDEX IX_Productos_Precio ON Productos(Precio);

-- Índice compuesto
CREATE INDEX IX_Productos_Cat_Precio ON Productos(CategoriaId, Precio);

-- Índice único
CREATE UNIQUE INDEX UX_Productos_Nombre ON Productos(Nombre);
```

**¿Cuándo usar índices?**
- Columnas usadas frecuentemente en `WHERE`, `JOIN`, `ORDER BY`
- Columnas con alta cardinalidad (muchos valores distintos)

**¿Cuándo NO usar índices?**
- Tablas pequeñas
- Columnas que se actualizan muy frecuentemente
- Columnas con baja cardinalidad (ej: columna booleana)

---

## Transacciones

```sql
BEGIN TRANSACTION;

BEGIN TRY
    UPDATE CuentasBancarias SET Saldo = Saldo - 1000 WHERE Id = 1;
    UPDATE CuentasBancarias SET Saldo = Saldo + 1000 WHERE Id = 2;
    
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    THROW;
END CATCH
```

### Propiedades ACID

| Propiedad | Descripción |
|-----------|-------------|
| **Atomicity** | Todo o nada — si falla algo, se revierte todo |
| **Consistency** | La BD pasa de un estado válido a otro |
| **Isolation** | Las transacciones concurrentes no se afectan |
| **Durability** | Los cambios confirmados persisten |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre DELETE, TRUNCATE y DROP?**
> - `DELETE`: elimina filas con posibilidad de WHERE y rollback
> - `TRUNCATE`: elimina TODAS las filas sin condición, más rápido, reinicia identity
> - `DROP`: elimina la tabla completa (estructura + datos)

**2. ¿Qué es un índice y cómo mejora el rendimiento?**
> Un índice es una estructura de datos (generalmente B-tree) que permite al motor de BD encontrar filas sin escanear toda la tabla. Acelera lecturas pero ralentiza escrituras (INSERT/UPDATE/DELETE deben actualizar el índice también).

**3. ¿Cuál es la diferencia entre Primary Key y Unique Key?**
> Ambos garantizan unicidad. La diferencia es que Primary Key no puede ser NULL y solo puede haber una por tabla. Unique Key puede aceptar un NULL y puede haber varias.

**4. ¿Qué es la normalización?**
> Proceso de organizar las tablas para reducir redundancia y dependencias. Las formas normales principales son 1NF, 2NF y 3NF. En la práctica, se normaliza hasta 3NF y a veces se desnormaliza intencionalmente por performance.

---

## Manejo de NULL

NULL en SQL no significa vacío ni cero — significa **valor desconocido**. Tiene reglas especiales.

```sql
-- ❌ Esto NO funciona para detectar NULL
SELECT * FROM Productos WHERE CategoriaId = NULL;    -- siempre devuelve 0 filas
SELECT * FROM Productos WHERE CategoriaId != NULL;   -- también devuelve 0 filas

-- ✅ Esto SÍ funciona
SELECT * FROM Productos WHERE CategoriaId IS NULL;
SELECT * FROM Productos WHERE CategoriaId IS NOT NULL;

-- COALESCE: retorna el primer valor no-NULL
SELECT Nombre, COALESCE(Descripcion, 'Sin descripción') AS Descripcion
FROM Productos;

-- ISNULL (SQL Server): reemplaza NULL por un valor
SELECT Nombre, ISNULL(Descripcion, 'Sin descripción') AS Descripcion
FROM Productos;

-- NULL en operaciones matemáticas → siempre NULL
SELECT 10 + NULL;    -- NULL
SELECT NULL * 5;     -- NULL

-- NULL en comparaciones → UNKNOWN (no TRUE ni FALSE)
-- Esto puede causar resultados inesperados con NOT IN
SELECT * FROM Productos
WHERE CategoriaId NOT IN (1, 2, NULL);  -- ⚠️ Devuelve 0 filas (UNKNOWN contamina)
-- Solución: filtrar NULLs explícitamente
SELECT * FROM Productos
WHERE CategoriaId NOT IN (1, 2) AND CategoriaId IS NOT NULL;
```

---

## Constraints — Restricciones de Integridad

Las constraints garantizan la integridad de los datos directamente en la base de datos.

```sql
CREATE TABLE Empleados (
    Id          INT PRIMARY KEY IDENTITY(1,1),   -- Clave primaria, auto-incremental
    Email       NVARCHAR(200) NOT NULL UNIQUE,    -- No nulo y único
    Nombre      NVARCHAR(100) NOT NULL,
    Edad        INT CHECK (Edad >= 18 AND Edad <= 120),  -- Validación de rango
    Salario     DECIMAL(10,2) CHECK (Salario > 0),
    DepartamentoId INT FOREIGN KEY REFERENCES Departamentos(Id)  -- Integridad referencial
        ON DELETE SET NULL    -- Si se borra el depto, pone NULL en el empleado
        ON UPDATE CASCADE,    -- Si cambia el Id del depto, actualiza acá también
    Estado      NVARCHAR(20) DEFAULT 'Activo'    -- Valor por defecto
);

-- Agregar constraint después de crear la tabla
ALTER TABLE Empleados
ADD CONSTRAINT CHK_SalarioMinimo CHECK (Salario >= 1000);

-- Ver constraints de una tabla
SELECT * FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_NAME = 'Empleados';
```

| Constraint | ¿Qué garantiza? |
|---|---|
| `PRIMARY KEY` | Unicidad + NOT NULL. Solo una por tabla. |
| `UNIQUE` | Unicidad, pero permite NULL (uno). Puede haber varias. |
| `NOT NULL` | El campo siempre tiene valor. |
| `CHECK` | El valor cumple una condición. |
| `FOREIGN KEY` | El valor existe en la tabla referenciada. |
| `DEFAULT` | Valor automático si no se especifica. |

---

## ORDER BY y DISTINCT

```sql
-- ORDER BY: ordenar resultados
SELECT Nombre, Precio, Stock
FROM Productos
ORDER BY Precio DESC,    -- Primero por precio descendente
         Nombre ASC;     -- Luego por nombre ascendente

-- DISTINCT: eliminar filas duplicadas
SELECT DISTINCT CategoriaId FROM Productos;  -- IDs únicos de categorías

-- TOP / LIMIT: limitar resultados
SELECT TOP 5 Nombre, Precio FROM Productos ORDER BY Precio DESC;  -- SQL Server
-- SELECT Nombre, Precio FROM Productos ORDER BY Precio DESC LIMIT 5;  -- MySQL/PostgreSQL

-- OFFSET-FETCH: paginación (SQL Server)
SELECT Nombre, Precio
FROM Productos
ORDER BY Nombre
OFFSET 20 ROWS       -- Saltar los primeros 20
FETCH NEXT 10 ROWS ONLY;  -- Traer los siguientes 10 (página 3 de 10 elementos)
```

---

## Errores Comunes en SQL

```sql
-- 1. Usar * en producción (trae columnas innecesarias, rompe si agrega columnas)
SELECT * FROM Productos;          -- ❌ En código de app
SELECT Id, Nombre, Precio FROM Productos;  -- ✅

-- 2. No usar índices en WHERE de alta frecuencia
SELECT * FROM Logs WHERE Mensaje LIKE '%error%';  -- ❌ Full scan
-- Para búsqueda de texto → usar Full-Text Index o buscar por columnas indexadas

-- 3. Condiciones que anulan índices
WHERE YEAR(FechaCreacion) = 2024;           -- ❌ Función sobre la columna anula el índice
WHERE FechaCreacion >= '2024-01-01'         -- ✅ Sargable (puede usar el índice)
  AND FechaCreacion < '2025-01-01';

-- 4. DELETE sin WHERE (borra toda la tabla)
DELETE FROM Productos;        -- ⚠️ Borra TODO — usa TRUNCATE si es intencional
DELETE FROM Productos WHERE Id = 1;  -- ✅

-- 5. UPDATE sin WHERE
UPDATE Productos SET Precio = 0;    -- ⚠️ Actualiza TODOS los registros
```

---

## Preguntas adicionales de entrevista 🎯

**5. ¿Qué es un deadlock en SQL y cómo se previene?**
> Un deadlock ocurre cuando dos transacciones se bloquean mutuamente esperando recursos que la otra tiene. Ejemplo: T1 bloquea tabla A y espera B; T2 bloquea B y espera A. SQL Server lo detecta automáticamente y mata una de las transacciones (la víctima). Se previene: accediendo a las tablas siempre en el mismo orden, manteniendo las transacciones cortas, y usando el nivel de aislamiento adecuado.

**6. ¿Cuál es la diferencia entre INNER JOIN y LEFT JOIN? ¿Cuándo usas cada uno?**
> INNER JOIN: solo filas con coincidencia en ambas tablas — usarlo cuando el dato relacionado es obligatorio (un pedido siempre tiene cliente). LEFT JOIN: todas las filas de la tabla izquierda aunque no tengan coincidencia en la derecha — usarlo cuando la relación es opcional (un cliente puede no tener pedidos, pero quiero ver todos los clientes igualmente).

**7. ¿Qué pasa si hago un JOIN entre dos tablas de un millón de filas sin índice?**
> El motor hace un nested loop scan: por cada fila de la tabla A, escanea toda la tabla B → O(n²) operaciones. Con 1M de filas sería ~10¹² comparaciones. Con un índice en la columna del JOIN → O(n log n). En la práctica: ALWAYS crear índices en las columnas usadas en JOINs y WHEREs con alta cardinalidad.

**8. ¿Para qué sirve BEGIN TRANSACTION y cuándo la usarías?**
> Para agrupar múltiples operaciones en una unidad atómica (ACID). Si alguna falla, el ROLLBACK deshace todo. Casos de uso: transferencias bancarias (debitar una cuenta + acreditar otra deben ser atómicas), reservas de asientos (verificar disponibilidad + crear reserva sin race conditions), cualquier operación que modifique múltiples tablas relacionadas y deba ser "todo o nada".
