---
id: caching-estrategias
title: Caching y Estrategias
sidebar_position: 20
---

# Caching y Estrategias de Caché 🟡

El caching es crítico para performance en aplicaciones modernas. Este documento cubre estrategias de caché en cliente (browser) y servidor.

## Tipos de Caché

### 1. HTTP Browser Cache

El navegador cachea automáticamente basado en headers HTTP.

```csharp
// ASP.NET Core - Configurar caché HTTP
app.Use(async (context, next) => {
    // Assets estáticos: 1 año
    if (context.Request.Path.StartsWithSegments("/assets"))
    {
        context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    }
    // Datos de API: 5 minutos
    else if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.CacheControl = "public, max-age=300";
    }
    // HTML: no cachear (o revalidar)
    else
    {
        context.Response.Headers.CacheControl = "no-cache, must-revalidate";
        context.Response.Headers.Pragma = "no-cache";
    }
    
    await next();
});

// Usando middleware de caché
builder.Services.AddResponseCaching();
app.UseResponseCaching();

// En controlador
[ResponseCache(Duration = 300, Location = ResponseCacheLocation.Any)]
[HttpGet("productos")]
public async Task<IActionResult> GetProductos()
{
    return Ok(await _service.ObtenerAsync());
}
```

**Headers HTTP importantes:**
- `Cache-Control`: Directivas de caché (age, revalidation, etag)
- `ETag`: Hash del contenido para validar si cambió
- `Last-Modified`: Fecha de última modificación
- `Expire`: Fecha absoluta de expiración (deprecated, usar `Cache-Control`)

### 2. Redis (Caché distribuida)

Redis es un almacén en memoria ultra-rápido. Ideal para estado compartido entre instancias.

```csharp
// Agregar Redis en DI
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    // ó: options.Configuration = "localhost:6379";
});

// Inyectar IDistributedCache
public class ProductoService
{
    private readonly IDistributedCache _cache;
    
    public ProductoService(IDistributedCache cache)
    {
        _cache = cache;
    }
    
    public async Task<Producto?> ObtenerPorIdAsync(int id)
    {
        var cacheKey = $"producto_{id}";
        
        // Intentar leer del caché
        var cached = await _cache.GetStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(cached))
        {
            return JsonSerializer.Deserialize<Producto>(cached);
        }
        
        // Si no está en caché, ir a BD
        var producto = await _db.Productos.FirstOrDefaultAsync(p => p.Id == id);
        if (producto == null) return null;
        
        // Guardar en caché por 10 minutos
        await _cache.SetStringAsync(
            cacheKey,
            JsonSerializer.Serialize(producto),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
            }
        );
        
        return producto;
    }
    
    public async Task ActualizarAsync(int id, ActualizarDto dto)
    {
        var producto = await _db.Productos.FindAsync(id);
        if (producto == null) throw new NotFoundException();
        
        producto.Nombre = dto.Nombre;
        producto.Precio = dto.Precio;
        await _db.SaveChangesAsync();
        
        // Invalidar caché
        var cacheKey = $"producto_{id}";
        await _cache.RemoveAsync(cacheKey);
        
        // Bonus: invalidar lista de productos también
        await _cache.RemoveAsync("productos_lista");
    }
}
```

**Patrones Redis:**
- **Cache-Aside**: pregunta al caché, si no está, busca en BD y cachea
- **Write-Through**: escribe en BD y caché simultáneamente
- **Write-Behind**: escribe en caché, asincronamente en BD

### 3. Memory Cache (En proceso)

Para datos pequeños que no necesitan compartirse entre instancias.

```csharp
// En DI
builder.Services.AddMemoryCache();

// En el servicio
public class CategoriaService
{
    private readonly IMemoryCache _memoryCache;
    private const string CACHE_KEY = "categorias_cache";
    
    public CategoriaService(IMemoryCache memoryCache)
    {
        _memoryCache = memoryCache;
    }
    
    public async Task<List<Categoria>> ObtenerAsync()
    {
        if (_memoryCache.TryGetValue(CACHE_KEY, out List<Categoria> categorias))
        {
            return categorias;
        }
        
        categorias = await _db.Categorias.ToListAsync();
        
        // Cachear con expiración y callback
        var cacheOptions = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1),
            SlidingExpiration = TimeSpan.FromMinutes(10), // se extiende si se accede
            Priority = CacheItemPriority.High
        };
        
        // Callback cuando expira
        cacheOptions.RegisterPostEvictionCallback((key, value, reason, state) =>
        {
            Console.WriteLine($"Caché {key} expiró por: {reason}");
        });
        
        _memoryCache.Set(CACHE_KEY, categorias, cacheOptions);
        return categorias;
    }
}
```

## Estrategias de Invalidación de Caché

### Cache Stampede

Problema: múltiples requests llegan cuando caché expira, todos van a BD.

```csharp
// Solución: usar locks para que solo uno vuelva a calcular
private readonly SemaphoreSlim _updateLock = new SemaphoreSlim(1, 1);

public async Task<List<Producto>> ObtenerProductosAsync()
{
    var cacheKey = "productos_lista";
    
    if (_cache.TryGetValue(cacheKey, out List<Producto> cached))
    {
        return cached;
    }
    
    // Esperar lock
    await _updateLock.WaitAsync();
    try
    {
        // Double-check: alguien podría haber llenado el caché mientras esperaba
        if (_cache.TryGetValue(cacheKey, out cached))
        {
            return cached;
        }
        
        // Ir a BD
        var productos = await _db.Productos.ToListAsync();
        
        _memoryCache.Set(cacheKey, productos, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
        });
        
        return productos;
    }
    finally
    {
        _updateLock.Release();
    }
}
```

### Cache Invalidation (TTL vs Event-driven)

```csharp
// Opción 1: TTL (Time To Live)
// Pro: simple, no requiere coordinación
// Contra: puede servir datos stale, o hacer refetch innecesario
await _cache.SetStringAsync("producto_1", json, 
    new DistributedCacheEntryOptions 
    { 
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) 
    }
);

// Opción 2: Event-driven
// Cuando algo cambia, invalida explícitamente
public async Task ActualizarAsync(int id, ActualizarDto dto)
{
    // Actualizar BD
    await _db.Productos.Where(p => p.Id == id)
        .ExecuteUpdateAsync(p => 
            p.SetProperty(x => x.Nombre, dto.Nombre)
             .SetProperty(x => x.Precio, dto.Precio));
    
    // Invalidar caché relacionado
    await _cache.RemoveAsync($"producto_{id}");
    await _cache.RemoveAsync("productos_lista");
    
    // Bonus: notificar a otros servicios (RabbitMQ, Kafka)
    await _messagePublisher.PublishAsync(new ProductoActualizadoEvent(id, dto));
}
```

## Cliente (Frontend) - Caching

### Cache de red (HTTP)

```javascript
// El navegador cachea automáticamente según headers HTTP

// Best practices:
// - Assets con hash: cache forever (immutable)
// - HTML: no-cache (revalidar siempre)
// - API: depende del caso

fetch('/api/productos', {
  method: 'GET',
  cache: 'default' // 'no-store', 'no-cache', 'force-cache', 'only-if-cached'
});
```

### React Query caching

```typescript
import { useQuery } from '@tanstack/react-query';

function ListaProductos() {
  // React Query cachea automáticamente
  const { data, isLoading, error } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const res = await fetch('/api/productos');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,      // Datos frescos por 5 minutos
    gcTime: 10 * 60 * 1000,        // Mantener en memoria por 10 min después
    refetchOnMount: false,         // No refetch al montar
    refetchOnWindowFocus: true,    // Refetch cuando vuelve a la ventana
  });

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.map(p => <li key={p.id}>{p.nombre}</li>)}
    </ul>
  );
}

// Invalidar caché manualmente
const queryClient = useQueryClient();

const handleActualizar = async () => {
  // Invalida y refetcha
  await queryClient.invalidateQueries({ 
    queryKey: ['productos'] 
  });
};
```

## Monitoreo de caché

```csharp
// Métricas de caché
public class CacheMetrics
{
    public long Hits { get; set; }
    public long Misses { get; set; }
    public decimal HitRate => Hits + Misses > 0 ? (double)Hits / (Hits + Misses) * 100 : 0;
}

// Wrapper para monitorear
public class MonitoredCache : IDistributedCache
{
    private readonly IDistributedCache _inner;
    private readonly CacheMetrics _metrics;
    
    public async Task<byte[]?> GetAsync(string key, CancellationToken token = default)
    {
        var result = await _inner.GetAsync(key, token);
        
        if (result != null)
            _metrics.Hits++;
        else
            _metrics.Misses++;
        
        _logger.LogInformation($"Cache hit rate: {_metrics.HitRate:F2}%");
        
        return result;
    }
    
    // ... implementar otros métodos ...
}
```

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuándo cachear y cuándo no?**
> Cachear si:
> - Los datos cambian poco frecuentemente
> - El acceso es costoso (BD, API externa)
> - Toleras datos un poco stale
> 
> No cachear si:
> - Los datos son críticos y deben estar siempre actualizados
> - Ocupan mucha memoria
> - El acceso ya es rápido (caché de BD, índices)

**2. ¿Cuál es la diferencia entre Redis y MemoryCache?**
> - **MemoryCache**: en el proceso de la aplicación. Rápido pero no se comparte entre instancias, se pierde en reinicio.
> - **Redis**: separado, en red. Compartido entre instancias, persiste, pero más latencia por la red.

**3. ¿Qué es Cache Stampede?**
> Cuando el caché expira al mismo tiempo, múltiples requests llegan a BD simultáneamente (la "estampida"). Se soluciona con locks o probabilistic early expiration.

**4. ¿Cuál es el mejor TTL (Time To Live)?**
> Depende del caso:
> - Datos críticos: 1-5 minutos
> - Datos que cambian poco: 30 minutos - 1 hora
> - Assets estáticos: 1 año
> 
> Considerar: frecuencia de cambio, impacto si stale, carga de BD

**5. ¿Cómo monitorear que el caché funciona?**
> - Hit rate: % de requests que vienen del caché
> - Miss rate: % de requests que van a BD
> - Latencia: comparar con y sin caché
> - Memory usage: monitorear tamaño del caché
> 
> Target: hit rate > 80% es bueno

**6. ¿Qué estrategia de invalidación usar?**
> - **TTL**: simple pero datos stale
> - **Event-driven**: más complejo pero siempre fresco
> - **Hybrid**: TTL corto + invalidación en cambios críticos