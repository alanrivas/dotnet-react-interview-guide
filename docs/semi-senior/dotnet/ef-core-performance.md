---
id: ef-core-performance
title: EF Core — Performance y N+1
sidebar_position: 25
---

# EF Core — Performance y N+1 🟡

Entity Framework Core es conveniente, pero mal usado genera consultas ineficientes que destruyen el rendimiento en producción. El problema N+1 es la pregunta de EF Core más frecuente en entrevistas.

---

## El problema N+1

Se llama N+1 porque en lugar de 1 consulta, haces 1 + N consultas (una por cada elemento de la lista).

```csharp
// ❌ PROBLEMA N+1 — genera N+1 queries a la DB
var pedidos = await _db.Pedidos.ToListAsync();  // Query 1: SELECT * FROM Pedidos

foreach (var pedido in pedidos)
{
    // EF hace una query POR CADA pedido para cargar el cliente (lazy loading)
    Console.WriteLine(pedido.Cliente.Nombre);  // Query 2, 3, 4... N+1
}

// Si hay 100 pedidos → 101 queries a la base de datos
```

```sql
-- Lo que EF genera en la base de datos:
SELECT * FROM Pedidos                    -- 1 query
SELECT * FROM Clientes WHERE Id = 1      -- query por pedido 1
SELECT * FROM Clientes WHERE Id = 2      -- query por pedido 2
SELECT * FROM Clientes WHERE Id = 3      -- query por pedido 3
-- ... x100 pedidos = 101 queries totales
```

### La solución: Eager Loading con `.Include()`

```csharp
// ✅ Eager loading — 1 sola query con JOIN
var pedidos = await _db.Pedidos
    .Include(p => p.Cliente)            // JOIN con Clientes
    .Include(p => p.Items)              // JOIN con Items
        .ThenInclude(i => i.Producto)   // JOIN anidado con Productos
    .ToListAsync();

// Resultado: 1 query con todos los datos necesarios
```

```sql
-- Lo que EF genera:
SELECT p.*, c.*, i.*, pr.*
FROM Pedidos p
JOIN Clientes c ON p.ClienteId = c.Id
LEFT JOIN Items i ON i.PedidoId = p.Id
LEFT JOIN Productos pr ON i.ProductoId = pr.Id
```

---

## AsNoTracking — cuándo y por qué

Por defecto EF Core rastrea todas las entidades que carga (change tracking). Esto consume memoria y CPU innecesariamente en operaciones de solo lectura.

```csharp
// ❌ Con tracking — EF guarda snapshot de cada entidad en memoria
var productos = await _db.Productos.ToListAsync();
// EF mantiene en memoria: entidad original + copia para detectar cambios

// ✅ Sin tracking — para lectura pura, 20-40% más rápido
var productos = await _db.Productos
    .AsNoTracking()
    .ToListAsync();

// ✅ AsNoTrackingWithIdentityResolution — para queries con relaciones
// AsNoTracking normal puede duplicar entidades si la misma aparece en múltiples relaciones
var pedidos = await _db.Pedidos
    .Include(p => p.Items)
        .ThenInclude(i => i.Producto)
    .AsNoTrackingWithIdentityResolution()  // Garantiza una instancia por entidad
    .ToListAsync();

// ✅ Configurar a nivel de DbContext para lectura por defecto
public class AppDbContext : DbContext
{
    protected override void OnConfiguring(DbContextOptionsBuilder options)
    {
        options.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
    }
}
```

**Regla práctica:**
- `AsNoTracking()` → endpoints GET (lectura pura)
- Tracking activado → operaciones de escritura (UPDATE, DELETE)

---

## Select — proyecta solo lo que necesitas

Cargar entidades completas cuando solo necesitas 2 campos desperdicia ancho de banda y memoria.

```csharp
// ❌ Carga toda la entidad — 20 columnas para usar 2
var productos = await _db.Productos.ToListAsync();
var nombres = productos.Select(p => new { p.Id, p.Nombre });

// ✅ Proyección en la query — solo las columnas necesarias viajan por la red
var productos = await _db.Productos
    .Where(p => p.Activo)
    .Select(p => new ProductoResumenDto
    {
        Id = p.Id,
        Nombre = p.Nombre,
        Precio = p.Precio
        // EF genera: SELECT Id, Nombre, Precio FROM Productos WHERE Activo = 1
    })
    .AsNoTracking()
    .ToListAsync();
```

---

## Split Query — para relaciones con colecciones grandes

Cuando un `Include` genera un producto cartesiano (JOIN de muchas filas), Split Query divide en múltiples queries simples.

```csharp
// ❌ Una sola query con JOIN → puede generar millones de filas (producto cartesiano)
// Si un pedido tiene 50 items y 10 notas → 500 filas por pedido
var pedidos = await _db.Pedidos
    .Include(p => p.Items)       // colección grande
    .Include(p => p.Notas)       // otra colección
    .ToListAsync();

// ✅ Split Query — múltiples queries simples en lugar de un JOIN masivo
var pedidos = await _db.Pedidos
    .Include(p => p.Items)
    .Include(p => p.Notas)
    .AsSplitQuery()   // EF ejecuta 3 queries separadas y las une en memoria
    .ToListAsync();

// ✅ Configurar a nivel global en el DbContext
protected override void OnConfiguring(DbContextOptionsBuilder options)
{
    options.UseSqlServer(connectionString, sql =>
        sql.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery));
}
```

**Cuándo usar Split Query:**
- Múltiples `.Include()` sobre colecciones (`ICollection<T>`)
- La query única genera miles de filas duplicadas
- **No usar** si necesitas consistencia transaccional absoluta (Split Query son múltiples roundtrips)

---

## Compiled Queries — para queries de alta frecuencia

Compilar una query en tiempo de startup elimina el costo de traducción LINQ → SQL en cada ejecución.

```csharp
// ✅ Compiled Query — compila una vez, ejecuta N veces sin re-traducir
public class ProductoRepository
{
    // Definir como campo estático — se compila una vez al iniciar la app
    private static readonly Func<AppDbContext, int, Task<ProductoDto?>> GetByIdQuery =
        EF.CompileAsyncQuery((AppDbContext db, int id) =>
            db.Productos
                .AsNoTracking()
                .Where(p => p.Id == id && p.Activo)
                .Select(p => new ProductoDto { Id = p.Id, Nombre = p.Nombre, Precio = p.Precio })
                .FirstOrDefault());

    public async Task<ProductoDto?> ObtenerPorIdAsync(int id)
    {
        return await GetByIdQuery(_db, id);
    }
}

// Útil para endpoints que se llaman miles de veces por segundo
```

---

## Paginación eficiente

```csharp
// ❌ Paginación en memoria — carga TODOS los registros, luego filtra
var productos = await _db.Productos.ToListAsync();
var pagina = productos.Skip((page - 1) * pageSize).Take(pageSize);

// ✅ Paginación en la DB — solo trae los registros de la página
var productos = await _db.Productos
    .AsNoTracking()
    .OrderBy(p => p.Id)          // ← ORDER BY es OBLIGATORIO para paginación consistente
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .Select(p => new ProductoDto { Id = p.Id, Nombre = p.Nombre })
    .ToListAsync();

// ✅ Contar el total en paralelo para la UI
var totalTask = _db.Productos.CountAsync();
var productosTask = _db.Productos
    .AsNoTracking()
    .OrderBy(p => p.Id)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();

await Task.WhenAll(totalTask, productosTask);

return new PagedResult<ProductoDto>
{
    Items = productosTask.Result,
    Total = totalTask.Result,
    Page = page,
    PageSize = pageSize
};

// ✅ Keyset pagination (más eficiente en tablas grandes)
// En lugar de SKIP/TAKE, filtra por el último ID visto
var productos = await _db.Productos
    .AsNoTracking()
    .Where(p => p.Id > lastSeenId)   // Cursor-based: sin OFFSET costoso
    .OrderBy(p => p.Id)
    .Take(pageSize)
    .ToListAsync();
```

---

## Bulk operations con ExecuteUpdate / ExecuteDelete (.NET 7+)

```csharp
// ❌ Cargar + modificar + guardar — múltiples roundtrips
var productos = await _db.Productos
    .Where(p => p.CategoriaId == 5)
    .ToListAsync();                        // Query 1: SELECT
foreach (var p in productos) p.Precio *= 1.1m;
await _db.SaveChangesAsync();              // Query 2: UPDATE x cada producto

// ✅ ExecuteUpdate — un solo UPDATE sin cargar entidades
await _db.Productos
    .Where(p => p.CategoriaId == 5)
    .ExecuteUpdateAsync(set =>
        set.SetProperty(p => p.Precio, p => p.Precio * 1.1m));
// Genera: UPDATE Productos SET Precio = Precio * 1.1 WHERE CategoriaId = 5

// ✅ ExecuteDelete — un solo DELETE sin cargar entidades
await _db.Logs
    .Where(l => l.FechaCreacion < DateTime.UtcNow.AddDays(-30))
    .ExecuteDeleteAsync();
// Genera: DELETE FROM Logs WHERE FechaCreacion < '2026-02-26'
```

---

## Diagnóstico: detectar N+1 y queries lentas

```csharp
// ✅ Loguear todas las queries en desarrollo
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString);

    if (builder.Environment.IsDevelopment())
    {
        options.LogTo(Console.WriteLine, LogLevel.Information)
               .EnableSensitiveDataLogging()    // muestra parámetros
               .EnableDetailedErrors();
    }
});

// ✅ Detectar queries lentas — loguear solo las que tardan más de 500ms
options.LogTo(
    log => Console.WriteLine(log),
    (eventId, level) =>
        eventId == RelationalEventId.CommandExecuted && level == LogLevel.Information)
    .ConfigureWarnings(w =>
        w.Log((RelationalEventId.CommandExecuted, LogLevel.Warning)));

// ✅ Usar MiniProfiler en desarrollo para ver todas las queries por request
builder.Services.AddMiniProfiler(options =>
    options.RouteBasePath = "/profiler")
    .AddEntityFramework();
// Agrega un widget en la UI con el listado de queries por request
```

---

## Resumen: checklist de performance en EF Core

```
✅ Siempre:
   - .AsNoTracking() en endpoints de lectura
   - .Select() para proyectar solo campos necesarios
   - Paginación en DB con .Skip().Take() + ORDER BY

✅ Cuando hay relaciones:
   - .Include() para cargar relaciones necesarias (evita N+1)
   - .AsSplitQuery() cuando los JOINs generan producto cartesiano grande

✅ Para alta carga:
   - EF.CompileAsyncQuery para queries críticas de alta frecuencia
   - ExecuteUpdateAsync / ExecuteDeleteAsync para bulk operations
   - Índices en columnas usadas en WHERE, ORDER BY y JOIN

❌ Nunca:
   - Cargar toda la tabla y filtrar en memoria
   - Lazy loading en producción sin entender el impacto
   - .ToList() antes de .Where() o .Select()
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es el problema N+1 en EF Core y cómo lo solucionas?**
> Ocurre cuando cargas una lista de entidades y luego accedes a una propiedad de navegación dentro de un loop, generando una query adicional por elemento. Se soluciona con `.Include()` para hacer eager loading y cargar todo en una sola query con JOIN.

**2. ¿Cuándo usas `AsNoTracking()`?**
> En cualquier operación de solo lectura (endpoints GET). El change tracking de EF Core mantiene snapshots en memoria de cada entidad para detectar cambios. En lectura pura es overhead puro. `AsNoTracking()` da un 20-40% de mejora en estas operaciones.

**3. ¿Qué diferencia hay entre `AsNoTracking()` y `AsNoTrackingWithIdentityResolution()`?**
> `AsNoTracking()` puede crear múltiples instancias de la misma entidad si aparece en varias relaciones. `AsNoTrackingWithIdentityResolution()` garantiza una sola instancia por entidad, igual que el tracking normal, pero sin el overhead del change tracker.

**4. ¿Para qué sirve `AsSplitQuery()`?**
> Divide un query con múltiples `.Include()` en varias queries simples en lugar de un solo JOIN masivo. Útil cuando las colecciones incluidas son grandes y el JOIN genera un producto cartesiano con miles de filas duplicadas.

**5. ¿Cómo detectas queries lentas o N+1 en desarrollo?**
> Con `options.LogTo(Console.WriteLine)` para ver todas las queries en la consola, o con MiniProfiler que muestra un resumen por request. En producción, con Application Insights o el slow query log de SQL Server/PostgreSQL.

**6. ¿Qué hace `ExecuteUpdateAsync`?**
> Genera un `UPDATE` directo en la DB sin cargar las entidades a memoria. Mucho más eficiente que cargar-modificar-guardar para updates masivos. Disponible desde EF Core 7.
