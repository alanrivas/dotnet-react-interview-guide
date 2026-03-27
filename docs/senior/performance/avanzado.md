---
title: "⚡ Análisis Avanzado: Query Plans, Benchmarking y Allocations"
sidebar_position: 1
---

# ⚡ Análisis Avanzado: Query Plans, Benchmarking y Allocations

## El problema N+1 en EF Core

Es el anti-patrón de performance más frecuente en entrevistas y en código real.

```csharp
// ❌ N+1: 1 query para los pedidos + N queries para cada cliente
var pedidos = await _context.Pedidos.ToListAsync(); // 1 query: SELECT * FROM Pedidos

foreach (var pedido in pedidos)
{
    // EF Core lanza 1 query por cada pedido: SELECT * FROM Clientes WHERE Id = @p0
    Console.WriteLine(pedido.Cliente.Nombre);  // N queries
}
// Total: 1 + N queries (si tienes 1000 pedidos → 1001 queries)

// ✅ Opción 1: Eager loading con Include (1 JOIN)
var pedidos = await _context.Pedidos
    .Include(p => p.Cliente)
    .ToListAsync();
// Total: 1 query con JOIN

// ✅ Opción 2: Select proyectando solo lo necesario (más eficiente)
var pedidos = await _context.Pedidos
    .Select(p => new PedidoResumenDto
    {
        Id             = p.Id,
        Total          = p.Total,
        NombreCliente  = p.Cliente.Nombre  // EF genera el JOIN automáticamente
    })
    .ToListAsync();
// Total: 1 query, solo las columnas necesarias (sin SELECT *)

// ✅ Opción 3: AsSplitQuery para Include de colecciones (evita producto cartesiano)
var pedidos = await _context.Pedidos
    .Include(p => p.Cliente)
    .Include(p => p.Items)          // Include de colección = producto cartesiano
        .ThenInclude(i => i.Producto)
    .AsSplitQuery()                 // Convierte en 3 queries separadas en vez de 1 JOIN explosivo
    .ToListAsync();
```

### Detectar N+1 en desarrollo

```csharp
// Opción 1: MiniProfiler muestra cada query SQL y el stack trace de dónde viene
builder.Services.AddMiniProfiler().AddEntityFramework();

// Opción 2: Logging de EF Core — ver todas las queries en consola
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString)
           .LogTo(Console.WriteLine, LogLevel.Information)
           .EnableSensitiveDataLogging()); // Ver los parámetros (solo desarrollo)

// Opción 3: Detectar automáticamente en tests con un interceptor
public class N1DetectorInterceptor : DbCommandInterceptor
{
    private int _queryCount;
    private readonly int _maxAllowed;

    public N1DetectorInterceptor(int maxAllowed = 5) => _maxAllowed = maxAllowed;

    public override ValueTask<DbDataReader> ReaderExecutedAsync(
        DbCommand command, CommandExecutedEventData eventData, DbDataReader result,
        CancellationToken cancellationToken = default)
    {
        _queryCount++;
        if (_queryCount > _maxAllowed)
            throw new InvalidOperationException(
                $"Demasiadas queries ({_queryCount}). Posible N+1. Query: {command.CommandText}");

        return new ValueTask<DbDataReader>(result);
    }
}
```

---

## Análisis de Query Plans (SQL Server)

Cuando una query es lenta, el execution plan te dice exactamente por qué.

```sql
-- Ver el plan estimado (sin ejecutar)
SET SHOWPLAN_TEXT ON;
SELECT p.Nombre, c.Nombre AS Categoria
FROM Productos p
JOIN Categorias c ON p.CategoriaId = c.Id
WHERE p.Precio > 500;

-- Ver el plan real (ejecuta y muestra el plan)
SET STATISTICS IO ON;  -- muestra lecturas lógicas/físicas
SET STATISTICS TIME ON; -- muestra tiempo de CPU y elapsed

SELECT p.Nombre, c.Nombre AS Categoria
FROM Productos p
JOIN Categorias c ON p.CategoriaId = c.Id
WHERE p.Precio > 500;

-- Output de STATISTICS IO:
-- Table 'Productos'. Scan count 1, logical reads 1432, physical reads 0
--   ↑ logical reads alto = muchas páginas leídas = candidato a índice
```

### Operaciones costosas a buscar en el plan

```
TABLE SCAN / CLUSTERED INDEX SCAN
  → Lee TODA la tabla para encontrar los registros.
  → Si aparece en tablas grandes, necesitas un índice.
  → Señal: falta índice en la columna del WHERE.

INDEX SEEK
  → Va directamente a los registros que cumplen el filtro.
  → Lo que quieres ver. O(log N) en vez de O(N).

KEY LOOKUP
  → Encuentra la clave con el índice, luego va al clustered index por las columnas extra.
  → Costoso si hay muchos rows. Solución: "covering index" que incluya las columnas extra.

HASH MATCH (JOIN)
  → EL JOIN construyó una tabla hash porque no había índice que lo soportara.
  → Señal: falta índice en la columna del JOIN.

SORT
  → No había índice ordenado, tuvo que ordenar en memoria/disco.
  → Señal: falta índice en las columnas del ORDER BY.

NESTED LOOPS con alto número de ejecuciones
  → Puede ser un N+1 disfrazado de un solo query SQL.
```

### Índices: cuándo y cómo

```sql
-- Índice simple: acelera búsquedas por una columna
CREATE INDEX IX_Productos_Precio ON Productos (Precio);
-- Útil para: WHERE Precio > 500

-- Índice compuesto: cuando el filtro usa múltiples columnas
-- Regla: columnas de igualdad primero, columnas de rango después
CREATE INDEX IX_Pedidos_UsuarioFecha ON Pedidos (UsuarioId, FechaCreacion DESC);
-- Útil para: WHERE UsuarioId = 123 ORDER BY FechaCreacion DESC

-- Covering index: incluye las columnas del SELECT para evitar Key Lookup
CREATE INDEX IX_Productos_Precio_Covering
ON Productos (Precio)
INCLUDE (Nombre, CategoriaId);  -- Las columnas del SELECT van en INCLUDE
-- Útil para: SELECT Nombre, CategoriaId FROM Productos WHERE Precio > 500
-- Sin Key Lookup — el índice tiene todo lo necesario

-- Índice filtrado: solo indexa un subconjunto de filas
CREATE INDEX IX_Pedidos_Pendientes
ON Pedidos (FechaCreacion)
WHERE Estado = 'Pendiente';
-- Solo indexa pedidos pendientes (1% del total) → índice muy pequeño y rápido
```

### Detectar índices faltantes con Query Store (SQL Server)

```sql
-- Query Store registra todas las queries y sus planes de ejecución
-- Activar:
ALTER DATABASE MiBase SET QUERY_STORE = ON;

-- Ver las 10 queries con más tiempo de CPU en el último día
SELECT TOP 10
    qt.query_sql_text,
    rs.avg_cpu_time / 1000.0 AS avg_cpu_ms,
    rs.avg_duration / 1000.0 AS avg_duration_ms,
    rs.count_executions,
    rs.avg_logical_io_reads
FROM sys.query_store_query_text qt
JOIN sys.query_store_query q ON qt.query_text_id = q.query_text_id
JOIN sys.query_store_plan p ON q.query_id = p.query_id
JOIN sys.query_store_runtime_stats rs ON p.plan_id = rs.plan_id
ORDER BY rs.avg_cpu_time DESC;

-- Ver índices que SQL Server sugiere pero no existen (missing indexes)
SELECT
    mid.statement AS tabla,
    mid.equality_columns,
    mid.inequality_columns,
    mid.included_columns,
    migs.avg_user_impact AS ganancia_estimada_pct
FROM sys.dm_db_missing_index_details mid
JOIN sys.dm_db_missing_index_groups mig ON mid.index_handle = mig.index_handle
JOIN sys.dm_db_missing_index_group_stats migs ON mig.index_group_handle = migs.group_handle
WHERE migs.avg_user_impact > 30  -- Solo los que dan > 30% mejora estimada
ORDER BY migs.avg_user_impact DESC;
```

---

## Benchmarking con BenchmarkDotNet

Nunca midas performance con `Stopwatch` en código de producción — hay demasiado ruido. Usa BenchmarkDotNet para mediciones confiables.

```csharp
// dotnet add package BenchmarkDotNet

[MemoryDiagnoser]       // Mide allocations
[SimpleJob(RuntimeMoniker.Net80)]
public class StringConcatenationBenchmarks
{
    private const int Iterations = 1000;
    private readonly string[] _words = Enumerable.Range(0, Iterations)
        .Select(i => $"word{i}").ToArray();

    [Benchmark(Baseline = true)]
    public string Concatenation()
    {
        var result = "";
        foreach (var word in _words)
            result += word + " "; // ❌ O(N²) allocations
        return result;
    }

    [Benchmark]
    public string StringBuilder()
    {
        var sb = new StringBuilder();
        foreach (var word in _words)
            sb.Append(word).Append(' ');
        return sb.ToString(); // ✅ O(N) allocations
    }

    [Benchmark]
    public string StringJoin() => string.Join(' ', _words); // ✅ Más limpio

    [Benchmark]
    public string InterpolatedStringHandler()
    {
        // .NET 6+: DefaultInterpolatedStringHandler evita allocations intermedias
        var handler = new DefaultInterpolatedStringHandler(0, _words.Length);
        foreach (var word in _words)
        {
            handler.AppendFormatted(word);
            handler.AppendLiteral(" ");
        }
        return handler.ToStringAndClear();
    }
}

// Correr: dotnet run -c Release
// Output:
// | Method                    | Mean      | Ratio | Allocated |
// |--------------------------- |----------:|------:|----------:|
// | Concatenation             | 2,341 μs  |  1.00 | 3,906 KB  |
// | StringBuilder             |    42 μs  |  0.02 |    32 KB  |
// | StringJoin                |    38 μs  |  0.02 |    16 KB  |
// | InterpolatedStringHandler |    35 μs  |  0.02 |    16 KB  |
```

---

## Reducir allocations: Span\<T\> y ArrayPool\<T\>

En hot paths (código ejecutado millones de veces), las allocations matan el GC.

```csharp
// Span<T>: slice de memoria sin allocation
// Útil para parsear strings, arrays, streams sin copiar datos

// ❌ Crea 3 strings (allocations)
public static (string año, string mes, string dia) ParsearFecha(string fecha)
{
    var partes = fecha.Split('-');       // allocation: array + 3 strings
    return (partes[0], partes[1], partes[2]);
}

// ✅ Cero allocations con Span<char>
public static (int año, int mes, int dia) ParsearFecha(ReadOnlySpan<char> fecha)
{
    var primerGuion  = fecha.IndexOf('-');
    var segundoGuion = fecha[(primerGuion + 1)..].IndexOf('-') + primerGuion + 1;

    var año = int.Parse(fecha[..primerGuion]);
    var mes = int.Parse(fecha[(primerGuion + 1)..segundoGuion]);
    var dia = int.Parse(fecha[(segundoGuion + 1)..]);

    return (año, mes, dia);
}

// ArrayPool<T>: reutilizar arrays en vez de hacer GC
// ❌ Allocation + GC por cada request
public byte[] ProcesarDatos(Stream stream)
{
    var buffer = new byte[4096]; // allocation en cada llamada
    // ...
    return buffer;
}

// ✅ Reutilizar un array del pool
public async Task ProcesarDatosAsync(Stream stream)
{
    var buffer = ArrayPool<byte>.Shared.Rent(4096); // toma del pool
    try
    {
        var bytesLeídos = await stream.ReadAsync(buffer.AsMemory(0, buffer.Length));
        // procesar buffer[..bytesLeídos]
    }
    finally
    {
        ArrayPool<byte>.Shared.Return(buffer); // devuelve al pool
    }
}
```

---

## Output Caching (ASP.NET Core 7+)

Cache de respuestas HTTP completas — más simple que el cache manual y con soporte de variaciones por ruta/header/query.

```csharp
// Program.cs
builder.Services.AddOutputCache(options =>
{
    // Política base: 60 segundos
    options.AddBasePolicy(builder => builder.Expire(TimeSpan.FromSeconds(60)));

    // Política por nombre para casos específicos
    options.AddPolicy("CatalogoProductos", builder =>
        builder
            .Expire(TimeSpan.FromMinutes(5))
            .SetVaryByQuery("categoria", "pagina")  // Cache diferente por query params
            .Tag("productos"));                      // Tag para invalidación selectiva
});

app.UseOutputCache(); // Antes de MapControllers

// En el endpoint:
[HttpGet("productos")]
[OutputCache(PolicyName = "CatalogoProductos")]
public async Task<IActionResult> GetProductos(
    [FromQuery] string? categoria, [FromQuery] int pagina = 1)
{
    return Ok(await _service.GetProductosAsync(categoria, pagina));
}

// Invalidar por tag cuando los productos cambian:
[HttpPost("productos")]
public async Task<IActionResult> CrearProducto(
    [FromBody] CrearProductoDto dto,
    [FromServices] IOutputCacheStore cacheStore)
{
    var producto = await _service.CrearAsync(dto);

    // Invalida todas las respuestas en caché con el tag "productos"
    await cacheStore.EvictByTagAsync("productos", HttpContext.RequestAborted);

    return CreatedAtAction(nameof(GetProducto), new { id = producto.Id }, producto);
}
```

---

## Preguntas adicionales de entrevista 🎯

**5. Explica el problema N+1 y cómo lo detectarías en producción.**
> El N+1 ocurre cuando cargas N entidades y luego accedes a una relación de cada una, generando N queries adicionales. En producción: MiniProfiler en desarrollo (muestra cada SQL), logging de EF Core, o Application Insights que agrupa queries lentas. La solución es `Include()` o proyecciones con `Select()` para resolver la relación en una sola query.

**6. ¿Cuándo añadirías un índice y cuándo NO?**
> Añadir cuando hay `WHERE`, `JOIN ON`, u `ORDER BY` sobre columnas con alta cardinalidad y la query es frecuente. NO añadir cuando: la tabla tiene pocas filas, la columna tiene baja cardinalidad (ej: `bool`), la tabla recibe muchos writes (los índices ralentizan INSERT/UPDATE/DELETE). Cada índice tiene un costo de mantenimiento.

**7. ¿Cuál es la diferencia entre `AsNoTracking()` y la query normal en EF Core?**
> Con tracking: EF Core registra cada entidad en el Change Tracker para detectar cambios en `SaveChanges()`. Para queries de solo lectura (GETs), esto es overhead puro. `AsNoTracking()` elimina ese overhead, reduciendo memoria y CPU hasta un 40% en queries grandes. Siempre usar en queries de lectura que no necesiten `SaveChanges()`.

**8. ¿Cómo medirías si una optimización realmente mejoró algo?**
> Con BenchmarkDotNet para micro-benchmarks (no con `Stopwatch` — tiene demasiado ruido). Para el sistema completo: métricas P95/P99 antes y después del deploy, con el mismo tráfico. Nunca optimizar sin medir primero (puede ser que el problema esté en otro lugar) y siempre verificar con datos reales, no estimaciones.
