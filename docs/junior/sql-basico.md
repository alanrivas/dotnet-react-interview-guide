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
