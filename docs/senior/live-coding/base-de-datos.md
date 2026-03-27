---
title: "🗄️ Base de Datos y Queries"
sidebar_position: 3
---

# 🗄️ Base de Datos y Queries

Diseño de schemas relacionales y optimización de queries en entrevistas senior.

| Ejercicio | Dificultad | Tiempo |
|---|---|---|
| Schema RBAC | 🟡 Media | 25 min |
| Optimización del Problema N+1 | 🟡 Media | 20 min |

---

## Ejercicio 6: Schema RBAC en Base de Datos

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 25 minutos  
**Temas**: diseño de BD, normalización, RBAC, índices, SQL avanzado

### Enunciado

Diseña el **schema completo** para un sistema de control de acceso basado en roles (RBAC) que soporte:
- Usuarios con múltiples roles
- Roles con múltiples permisos
- Permisos con recurso + acción (ej: `pedidos:leer`, `usuarios:crear`)
- Herencia de roles (un rol puede heredar permisos de otro)
- Query eficiente: "¿puede el usuario X realizar la acción Y sobre el recurso Z?"

Incluye: schema SQL, índices recomendados, y las queries de verificación de permisos.

### Pistas

<details>
<summary>Ver pista 1</summary>

La estructura básica RBAC tiene 5 tablas: `Usuarios`, `Roles`, `Permisos`, `UsuarioRoles` (M:N), `RolPermisos` (M:N). La herencia de roles agrega una tabla `RolHerencia` (o una columna `RolPadreId` en `Roles`).

</details>

<details>
<summary>Ver pista 2</summary>

Para la query de verificación de permisos, un CTE recursivo es la forma más limpia de manejar la herencia de roles. `WITH RECURSIVE` (PostgreSQL/MySQL) o `WITH CTE` con `UNION ALL` (SQL Server).

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```sql
-- ============================================================
-- SCHEMA RBAC COMPLETO
-- ============================================================

-- Tabla de usuarios del sistema
CREATE TABLE Usuarios (
    Id          INT PRIMARY KEY IDENTITY(1,1),
    Email       NVARCHAR(255) NOT NULL UNIQUE,
    Nombre      NVARCHAR(100) NOT NULL,
    Activo      BIT NOT NULL DEFAULT 1,
    CreadoEn    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    INDEX IX_Usuarios_Email (Email)
);

-- Roles disponibles en el sistema
CREATE TABLE Roles (
    Id          INT PRIMARY KEY IDENTITY(1,1),
    Nombre      NVARCHAR(100) NOT NULL UNIQUE,
    Descripcion NVARCHAR(500),
    RolPadreId  INT NULL REFERENCES Roles(Id),  -- Para herencia de roles
    Activo      BIT NOT NULL DEFAULT 1,
    INDEX IX_Roles_Nombre (Nombre)
);

-- Permisos atómicos: recurso + acción
CREATE TABLE Permisos (
    Id          INT PRIMARY KEY IDENTITY(1,1),
    Recurso     NVARCHAR(100) NOT NULL,  -- ej: "pedidos", "usuarios", "reportes"
    Accion      NVARCHAR(50) NOT NULL,   -- ej: "leer", "crear", "actualizar", "eliminar"
    Descripcion NVARCHAR(500),
    UNIQUE (Recurso, Accion),
    INDEX IX_Permisos_Recurso_Accion (Recurso, Accion)
);

-- Relación M:N entre Usuarios y Roles
CREATE TABLE UsuarioRoles (
    UsuarioId   INT NOT NULL REFERENCES Usuarios(Id) ON DELETE CASCADE,
    RolId       INT NOT NULL REFERENCES Roles(Id) ON DELETE CASCADE,
    AsignadoPor INT NULL REFERENCES Usuarios(Id),
    AsignadoEn  DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    PRIMARY KEY (UsuarioId, RolId),
    INDEX IX_UsuarioRoles_RolId (RolId)
);

-- Relación M:N entre Roles y Permisos
CREATE TABLE RolPermisos (
    RolId       INT NOT NULL REFERENCES Roles(Id) ON DELETE CASCADE,
    PermisoId   INT NOT NULL REFERENCES Permisos(Id) ON DELETE CASCADE,
    PRIMARY KEY (RolId, PermisoId),
    INDEX IX_RolPermisos_PermisoId (PermisoId)
);

-- ============================================================
-- QUERY 1: ¿Tiene el usuario X el permiso Y?
-- Considera herencia de roles con CTE recursivo
-- ============================================================
DECLARE @UsuarioId INT = 42;
DECLARE @Recurso   NVARCHAR(100) = 'pedidos';
DECLARE @Accion    NVARCHAR(50)  = 'crear';

WITH RolesDelUsuario AS (
    -- Roles directamente asignados al usuario
    SELECT ur.RolId
    FROM UsuarioRoles ur
    WHERE ur.UsuarioId = @UsuarioId

    UNION ALL

    -- Roles heredados (padres de los roles ya encontrados)
    SELECT r.RolPadreId
    FROM RolesDelUsuario rdu
    INNER JOIN Roles r ON r.Id = rdu.RolId
    WHERE r.RolPadreId IS NOT NULL
)
SELECT TOP 1 1 AS TienePermiso
FROM RolesDelUsuario rdu
INNER JOIN RolPermisos rp ON rp.RolId = rdu.RolId
INNER JOIN Permisos p     ON p.Id = rp.PermisoId
WHERE p.Recurso = @Recurso
  AND p.Accion  = @Accion;
-- Retorna 1 fila si tiene permiso, 0 filas si no

-- ============================================================
-- QUERY 2: Todos los permisos de un usuario (con herencia)
-- ============================================================
WITH RolesConHerencia AS (
    SELECT ur.RolId, 0 AS Nivel
    FROM UsuarioRoles ur
    WHERE ur.UsuarioId = @UsuarioId

    UNION ALL

    SELECT r.RolPadreId, rch.Nivel + 1
    FROM RolesConHerencia rch
    INNER JOIN Roles r ON r.Id = rch.RolId
    WHERE r.RolPadreId IS NOT NULL
)
SELECT DISTINCT
    p.Recurso,
    p.Accion,
    r.Nombre AS RolOrigen
FROM RolesConHerencia rch
INNER JOIN RolPermisos rp ON rp.RolId = rch.RolId
INNER JOIN Permisos p     ON p.Id = rp.PermisoId
INNER JOIN Roles r        ON r.Id = rch.RolId
ORDER BY p.Recurso, p.Accion;

-- ============================================================
-- QUERY 3: Qué usuarios pueden realizar cierta acción
-- ============================================================
SELECT DISTINCT
    u.Id,
    u.Email,
    u.Nombre
FROM Usuarios u
INNER JOIN UsuarioRoles ur ON ur.UsuarioId = u.Id
INNER JOIN RolPermisos rp  ON rp.RolId = ur.RolId
INNER JOIN Permisos p      ON p.Id = rp.PermisoId
WHERE p.Recurso = @Recurso
  AND p.Accion  = @Accion
  AND u.Activo  = 1;
```

**Complejidad**: La query de verificación es O(d×p) donde d = profundidad de herencia de roles y p = permisos por rol

**Variantes a considerar en la entrevista:**
- ¿Cómo manejarías permisos a nivel de instancia de recurso? (ej: el usuario puede editar SOLO sus propios pedidos) — ABAC vs RBAC
- ¿Cómo cachearías los permisos para evitar queries a BD en cada request? (Redis con clave `permisos:{usuarioId}`, invalida al cambiar roles)
- ¿Cómo implementarías esto en .NET con claims en JWT? (incluir roles en el token, verificar con `[Authorize(Policy = "...")]`)
- ¿Cuándo se vuelve problemática la herencia recursiva? (ciclos, profundidad excesiva)
- ¿Cómo auditarías cambios de permisos? (tabla `AuditoriaPermisos` con before/after + usuario que hizo el cambio)

</details>

---

## Ejercicio 8: Optimización del Problema N+1

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: EF Core, N+1, Include, proyección, performance

### Enunciado

El siguiente código tiene un **problema N+1** clásico. Identificalo y muestra 3 formas de resolverlo, ordenadas de menos a más control.

```csharp
// CÓDIGO CON PROBLEMA — identificar y corregir
public async Task<List<PedidoDto>> ObtenerPedidosConItemsAsync()
{
    var pedidos = await _db.Pedidos.ToListAsync(); // Query 1: obtiene N pedidos

    var resultado = new List<PedidoDto>();
    foreach (var pedido in pedidos)
    {
        var items = await _db.Items
            .Where(i => i.PedidoId == pedido.Id)
            .ToListAsync(); // Query 2...N+1: una query POR cada pedido

        resultado.Add(new PedidoDto
        {
            Id = pedido.Id,
            Total = pedido.Total,
            NombreCliente = pedido.Cliente.Nombre, // Lazy loading implícito = otra query!
            Items = items.Select(i => new ItemDto { ... }).ToList()
        });
    }
    return resultado;
}
```

### Pistas

<details>
<summary>Ver pista 1</summary>

`Include()` y `ThenInclude()` en EF Core generan un `LEFT JOIN` en la query SQL, cargando todas las entidades relacionadas en una sola query.

</details>

<details>
<summary>Ver pista 2</summary>

Para mayor control, usa `Select()` para proyectar directamente al DTO en la query SQL. Esto evita cargar entidades completas cuando solo necesitas algunos campos.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
// ============================================================
// PROBLEMA IDENTIFICADO:
// Si hay 100 pedidos → 1 (pedidos) + 100 (items) + 100 (clientes) = 201 queries
// ============================================================

// ============================================================
// SOLUCIÓN 1: Include / ThenInclude — más simple, menos control
// ============================================================
public async Task<List<PedidoDto>> ObtenerConIncludeAsync()
{
    // EF Core genera un LEFT JOIN automático — 1 sola query SQL
    var pedidos = await _db.Pedidos
        .Include(p => p.Items)          // JOIN con Items
        .Include(p => p.Cliente)        // JOIN con Clientes
        .AsNoTracking()                 // Optimización: no rastrear entidades (solo lectura)
        .ToListAsync();

    // El mapeo a DTO ocurre en memoria (los datos ya están cargados)
    return pedidos.Select(p => new PedidoDto
    {
        Id = p.Id,
        Total = p.Total,
        NombreCliente = p.Cliente.Nombre,
        Items = p.Items.Select(i => new ItemDto
        {
            ProductoId = i.ProductoId,
            Cantidad = i.Cantidad
        }).ToList()
    }).ToList();
}

// ============================================================
// SOLUCIÓN 2: Proyección con Select — más eficiente (solo traer campos necesarios)
// ============================================================
public async Task<List<PedidoDto>> ObtenerConProyeccionAsync()
{
    // EF Core traduce el Select a SQL — solo trae los campos que necesitamos
    // No carga entidades completas (optimiza el payload de red)
    return await _db.Pedidos
        .AsNoTracking()
        .Select(p => new PedidoDto
        {
            Id = p.Id,
            Total = p.Total,
            NombreCliente = p.Cliente.Nombre,  // EF Core hace el JOIN automáticamente
            Items = p.Items.Select(i => new ItemDto
            {
                ProductoId = i.ProductoId,
                Cantidad = i.Cantidad
            }).ToList()
        })
        .ToListAsync();
    // SQL generado: SELECT p.Id, p.Total, c.Nombre, i.ProductoId, i.Cantidad
    //               FROM Pedidos p
    //               LEFT JOIN Clientes c ON c.Id = p.ClienteId
    //               LEFT JOIN Items i ON i.PedidoId = p.Id
}

// ============================================================
// SOLUCIÓN 3: Split Query — para evitar producto cartesiano en colecciones grandes
// ============================================================
public async Task<List<PedidoDto>> ObtenerConSplitQueryAsync()
{
    // AsSplitQuery divide la query en múltiples queries optimizadas
    // en vez de un JOIN que puede crear filas duplicadas (producto cartesiano)
    // Útil cuando hay múltiples Include de colecciones grandes
    var pedidos = await _db.Pedidos
        .Include(p => p.Items)
        .Include(p => p.Cliente)
        .Include(p => p.Pagos)     // Múltiples colecciones → Split Query brilla aquí
        .AsSplitQuery()            // Genera 3 queries separadas en vez de un JOIN con duplicados
        .AsNoTracking()
        .ToListAsync();

    return pedidos.Select(p => new PedidoDto { /* mapeo */ }).ToList();
}

// ============================================================
// SOLUCIÓN 4: Query manual con Dapper (máximo control)
// ============================================================
public async Task<List<PedidoDto>> ObtenerConDapperAsync()
{
    using var conn = _db.Database.GetDbConnection();

    // Query SQL optimizada manualmente
    const string sql = @"
        SELECT
            p.Id, p.Total, c.Nombre AS NombreCliente,
            i.ProductoId, i.Cantidad
        FROM Pedidos p
        INNER JOIN Clientes c ON c.Id = p.ClienteId
        LEFT JOIN Items i ON i.PedidoId = p.Id
        ORDER BY p.Id";

    // Usar multi-mapping de Dapper para mapear el resultado aplanado a objetos anidados
    var pedidoDict = new Dictionary<int, PedidoDto>();

    await conn.QueryAsync<PedidoDto, ItemDto, PedidoDto>(
        sql,
        (pedido, item) =>
        {
            if (!pedidoDict.TryGetValue(pedido.Id, out var dto))
            {
                dto = pedido;
                dto.Items = new List<ItemDto>();
                pedidoDict.Add(dto.Id, dto);
            }
            if (item != null) dto.Items.Add(item);
            return dto;
        },
        splitOn: "ProductoId"
    );

    return pedidoDict.Values.ToList();
}
```

**Complejidad**: 
- N+1 original: O(n) queries → inaceptable para n grande
- Include/Select/SplitQuery: O(1) queries con JOIN → óptimo
- La complejidad de tiempo sigue siendo O(n×m) para procesar los datos

**Variantes a considerar en la entrevista:**
- ¿Cuándo preferirías `AsSplitQuery` sobre `Include` con JOIN? (cuando hay múltiples colecciones y el producto cartesiano genera muchas filas duplicadas)
- ¿Cuándo usarías Dapper en vez de EF Core? (cuando necesitas control total del SQL, stored procedures, o rendimiento crítico)
- ¿Cómo detectarías N+1 en producción? (EF Core logging, MiniProfiler, Application Insights)
- ¿Qué es lazy loading y por qué está deshabilitado por defecto en EF Core?
- ¿Cómo cargarías datos paginados evitando traer todos los registros? (`Skip().Take()` antes del `ToListAsync()`)

</details>

---

