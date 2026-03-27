---
id: performance
title: Performance y Optimización
sidebar_position: 4
---

# Performance y Optimización 🔴

## Caching

### Memory Cache (in-process)

```csharp
builder.Services.AddMemoryCache();

public class ProductoService
{
    private readonly IMemoryCache _cache;
    private readonly IProductoRepository _repo;

    public async Task<ProductoDto?> ObtenerAsync(int id)
    {
        var cacheKey = $"producto:{id}";
        
        if (_cache.TryGetValue(cacheKey, out ProductoDto? cached))
            return cached;

        var producto = await _repo.ObtenerPorIdAsync(id);
        if (producto is null) return null;

        var dto = producto.ToDto();
        _cache.Set(cacheKey, dto, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),
            SlidingExpiration = TimeSpan.FromMinutes(2),
            Priority = CacheItemPriority.Normal
        });

        return dto;
    }

    public async Task ActualizarAsync(int id, ActualizarProductoDto dto)
    {
        await _repo.ActualizarAsync(id, dto);
        _cache.Remove($"producto:{id}"); // invalidar caché
    }
}
```

### Redis (distributed cache)

```csharp
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = "localhost:6379";
});

public class CacheService
{
    private readonly IDistributedCache _cache;

    public async Task<T?> ObtenerAsync<T>(string key)
    {
        var valor = await _cache.GetStringAsync(key);
        return valor is null ? default : JsonSerializer.Deserialize<T>(valor);
    }

    public async Task GuardarAsync<T>(string key, T valor, TimeSpan? expiracion = null)
    {
        var opciones = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiracion ?? TimeSpan.FromMinutes(30)
        };
        await _cache.SetStringAsync(key, JsonSerializer.Serialize(valor), opciones);
    }
}
```

---

## Optimización de Queries EF Core

```csharp
// ❌ Trae toda la entidad y hace filtrado en memoria
var productos = await _context.Productos.ToListAsync();
var caros = productos.Where(p => p.Precio > 500);

// ✅ Filtra en la BD
var caros = await _context.Productos
    .Where(p => p.Precio > 500)
    .AsNoTracking()
    .ToListAsync();

// ✅ Solo proyecta lo necesario (evita SELECT *)
var nombres = await _context.Productos
    .Where(p => p.CategoriaId == 1)
    .Select(p => new { p.Id, p.Nombre })
    .ToListAsync();

// ✅ Split queries para Include con colecciones grandes
var pedidos = await _context.Pedidos
    .Include(p => p.Items)
    .AsSplitQuery() // Dos queries separadas en vez de un JOIN cartesiano
    .ToListAsync();

// ✅ Compiled queries para queries frecuentes
private static readonly Func<AppDbContext, int, Task<Producto?>> _queryPorId =
    EF.CompileAsyncQuery((AppDbContext ctx, int id) =>
        ctx.Productos.FirstOrDefault(p => p.Id == id));
```

---

## Response Compression y HTTP/2

```csharp
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

app.UseResponseCompression();
```

---

## Profiling y Diagnóstico

```csharp
// MiniProfiler — analiza tiempos de queries y código
builder.Services.AddMiniProfiler(options =>
{
    options.RouteBasePath = "/profiler";
    options.ColorScheme = ColorScheme.Dark;
})
.AddEntityFramework(); // muestra todas las queries SQL y su tiempo

// Activity y OpenTelemetry
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddEntityFrameworkCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddOtlpExporter(); // Jaeger, Zipkin, etc.
    });
```

---

## Async y paralelismo

```csharp
// ❌ Secuencial: 3 segundos total
var usuario = await GetUsuarioAsync();     // 1s
var pedidos = await GetPedidosAsync();     // 1s
var productos = await GetProductosAsync(); // 1s

// ✅ Paralelo: ~1 segundo total
var usuarioTask = GetUsuarioAsync();
var pedidosTask = GetPedidosAsync();
var productosTask = GetProductosAsync();

await Task.WhenAll(usuarioTask, pedidosTask, productosTask);

var usuario = await usuarioTask;
var pedidos = await pedidosTask;
var productos = await productosTask;

// Procesamiento paralelo con límite de concurrencia
var semaforo = new SemaphoreSlim(maxConcurrency: 5);
var tareas = ids.Select(async id =>
{
    await semaforo.WaitAsync();
    try { return await ProcesarAsync(id); }
    finally { semaforo.Release(); }
});
var resultados = await Task.WhenAll(tareas);
```

---

## Frontend Performance

```tsx
// Code splitting — carga bajo demanda
const AdminPanel = React.lazy(() => import('./AdminPanel'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Suspense>
  );
}

// Virtualización para listas largas
import { FixedSizeList } from 'react-window';

function ListaGrande({ items }: { items: Item[] }) {
  return (
    <FixedSizeList
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={50}  // altura fija por item
    >
      {({ index, style }) => (
        <div style={style}>
          {items[index].nombre}
        </div>
      )}
    </FixedSizeList>
  );
}

// Image optimization
<img
  src="foto-original.jpg"
  loading="lazy"           // lazy loading nativo
  decoding="async"
  width={800}
  height={600}
  srcSet="foto-400.jpg 400w, foto-800.jpg 800w"
  sizes="(max-width: 600px) 400px, 800px"
/>
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo abordarías la optimización de una API lenta?**
> Primero medir (no adivinar): revisar logs, traces (OpenTelemetry), analizar queries con EXPLAIN/Query Plan. Identificar el cuello de botella: ¿es la DB? ¿el código? ¿la red? Luego aplicar la optimización adecuada: caché, índices, query tuning, async.

**2. ¿Cuál es la diferencia entre caché en memoria y caché distribuida?**
> **In-memory**: ultra rápida, datos en el proceso, se pierde al reiniciar, no se comparte entre instancias. **Distribuida** (Redis): compartida entre instancias, persiste reinicios, ligeramente más lenta por red. Para apps con múltiples instancias/pods, usar Redis.

**3. ¿Qué es el problema del thundering herd y cómo se previene?**
> Cuando el caché expira y muchas requests simultáneas intentan regenerarlo al mismo tiempo, saturando la DB. Se previene con **cache stampede protection**: usar un lock/semáforo para que solo una request regenere el caché, o con **probabilistic early expiration**.

**4. ¿Qué métricas de performance monitorizarías en producción?**
> Latencia P50/P95/P99 (no solo el promedio), throughput (requests/seg), error rate, DB query time, CPU/memoria, cache hit ratio, y métricas de negocio (órdenes procesadas/min).

---

