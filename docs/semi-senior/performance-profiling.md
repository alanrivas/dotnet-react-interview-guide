---
id: performance-profiling
title: Performance & Profiling
sidebar_position: 22
---

# Performance & Profiling 🟡

El profiling es la herramienta fundamental para encontrar bottlenecks. Sin medir, solo estás adivinando.

## Principios de Performance

### Rules of Optimization

```
1. Don't optimize prematurely (Knuth)
2. Optimize based on profiling data, not intuition
3. Fix the biggest bottleneck first (80/20)
4. Measure before and after cada cambio
5. Considera el costo de mantenibilidad vs ganancia de velocidad
```

### Perfiles de rendimiento comunes

```
API típico:
- 40% BD (queries ineficientes, N+1)
- 30% Network (latencia, serialización)
- 15% Lógica (algoritmos ineficientes)
- 15% Otros (allocations, GC)

Frontend típico:
- 40% JS parsing/execution
- 30% Rendering
- 20% Network
- 10% Otros
```

## Profiling en Backend (.NET)

### 1. BenchmarkDotNet (Microbenchmarking)

```csharp
// Installar: dotnet add package BenchmarkDotNet

[SimpleJob(warmupCount: 3, iterationCount: 5)]
[MemoryDiagnoser]
public class StringConcatBench
{
    private string[] _datos = Enumerable.Range(0, 1000).Select(i => i.ToString()).ToArray();
    
    [Benchmark]
    public string UsandoConcat()
    {
        var resultado = "";
        foreach (var item in _datos)
        {
            resultado += item + ",";  // Crea string nuevo cada iteración
        }
        return resultado;
    }
    
    [Benchmark]
    public string UsandoStringBuilder()
    {
        var sb = new StringBuilder();
        foreach (var item in _datos)
        {
            sb.Append(item).Append(",");  // Usa buffer
        }
        return sb.ToString();
    }
    
    [Benchmark]
    public string UsandoString_Join()
    {
        return string.Join(",", _datos);  // Más rápido aún
    }
}

// Correr:
// dotnet run -c Release -- --benchmark BenchmarkDotNet
// 
// Resultado esperado:
// |           Method |     Mean |     Allocated |
// |          Concat |  225 ms  |    1.2 MB     |  ❌ Lento
// | StringBuilder   |   12 ms  |    45 KB      |  ✅ Mejor
// |   String_Join   |    3 ms  |    20 KB      |  ✅ Mejor
```

### 2. Diagnostic Tools (Visual Studio)

```csharp
// Performance Profiler en VS:
// Debug → Performance Profiler → CPU Usage
// Abre el código problemático y haz clic en "Collect"

public void OperacionLenta()
{
    var lista = new List<int>();
    
    // ❌ Ineficiente: ResizeArray múltiples veces
    for (int i = 0; i < 100_000; i++)
    {
        lista.Add(i);
    }
}

public void OperacionOptimizada()
{
    var lista = new List<int>(100_000); // Pre-allocate
    
    for (int i = 0; i < 100_000; i++)
    {
        lista.Add(i);
    }
}
```

### 3. Entity Framework Profiling

```csharp
// DbContextLoggerExtensions

public class ProductoService
{
    private readonly AppDbContext _db;
    private readonly ILogger<ProductoService> _logger;
    
    public async Task<List<Producto>> ObtenerConLoggingAsync()
    {
        // Opción 1: EnableSensitiveDataLogging (dev solo)
        _db.Database.EnableSensitiveDataLogging();
        
        // Opción 2: Usar LogTo
        _db.Database.LogTo(
            message => _logger.LogInformation(message),
            new[] { DbLoggerCategory.Database.Command.Name }
        );
        
        var productos = await _db.Productos.ToListAsync();
        return productos;
    }
}

// Problemas comunes:

// ❌ N+1 Query Problem
var productos = await _db.Productos.ToListAsync();
foreach (var p in productos)
{
    var comentarios = await _db.Comentarios
        .Where(c => c.ProductoId == p.Id)
        .ToListAsync(); // Query por CADA producto
    // Total: 1 query + N queries = N+1
}

// ✓ Solución: Include
var productos = await _db.Productos
    .Include(p => p.Comentarios)
    .ToListAsync();
// Total: 1 query con JOIN

// ❌ Lazy Loading
var producto = await _db.Productos.FindAsync(1);
var categoria = producto.Categoria; // Si hay navegación, query extra
// Dependencias ocultas, difícil de debuggear

// ✓ Eager Loading
var producto = await _db.Productos
    .Include(p => p.Categoria)
    .FirstOrDefaultAsync(p => p.Id == 1);
```

### 4. Memory Profiling

```csharp
// Identificar memory leaks

public class MemoryLeakExample
{
    // ❌ Static reference evita garbage collection
    private static List<string> _cache = new();
    
    public void AgregarAlCache(string item)
    {
        _cache.Add(item);  // Nunca se limpia
    }
}

// ✓ Usar WeakReference o LRU cache
public class LruCache<TKey, TValue>
{
    private readonly Dictionary<TKey, TValue> _cache = new();
    private readonly int _maxSize;
    private readonly LinkedList<TKey> _accessOrder = new();
    
    public LruCache(int maxSize) => _maxSize = maxSize;
    
    public void Set(TKey key, TValue value)
    {
        if (_cache.Count >= _maxSize && !_cache.ContainsKey(key))
        {
            var oldest = _accessOrder.First!.Value;
            _cache.Remove(oldest);
            _accessOrder.RemoveFirst();
        }
        
        _cache[key] = value;
        _accessOrder.AddLast(key);
    }
}
```

## Profiling en Frontend (Browser)

### 1. Chrome DevTools Performance

```javascript
// Usar Performance tab en Chrome DevTools:
// 1. Abrir DevTools (F12)
// 2. Performance tab
// 3. Record
// 4. Interactuar con la app
// 5. Stop

// Métricas importantes:
// - FCP (First Contentful Paint): contenido visible
// - LCP (Largest Contentful Paint): elemento más grande
// - CLS (Cumulative Layout Shift): movimiento involuntario
// - FID (First Input Delay): latencia en responder a input
// - TTFB (Time to First Byte): tiempo del servidor

// Programatically
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});

observer.observe({ entryTypes: ['measure', 'navigation'] });

// Medir secciones específicas
performance.mark('inicio-render');
// ... hacer cosas ...
performance.mark('fin-render');
performance.measure('tiempo-render', 'inicio-render', 'fin-render');
```

### 2. React Profiler

```typescript
// Detectar renders lentos
import { Profiler } from 'react';

const onRenderCallback = (
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
  interactions: Set<any>
) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
  if (actualDuration > 100) {
    console.warn(`Slow render: ${id}`);
  }
};

export default function App() {
  return (
    <Profiler id="App" onRender={onRenderCallback}>
      <MiComponente />
    </Profiler>
  );
}

// React DevTools Profiler sección también muestra wasted renders
```

### 3. Lighthouse (Google)

```
Auditoría completa de performance:
- Performance: 0-100 (busca CLS, LCP, FID)
- Accessibility: accesibilidad web
- Best Practices: seguridad, cookies, etc
- SEO: indexación en buscadores
- PWA: Progressive Web App

Ejecutar en DevTools:
Lighthouse tab → Generate report
```

## Optimizaciones comunes

### Backend Optimization

```csharp
// 1. Caché
[ResponseCache(Duration = 300)]
[HttpGet("productos")]
public async Task<IActionResult> GetProductos()
{
    // Se cachea por 5 minutos
    return Ok(await _service.ObtenerAsync());
}

// 2. Paginación
var pagina = await _db.Productos
    .Skip((pageNum - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync();

// 3. Batch processing
var productosIds = ids.Chunk(500); // procesar en lotes de 500
foreach (var chunk in productosIds)
{
    await ProcessChunck(chunk);
}

// 4. Asincronía real
// ✓ Correcto
await Task.WhenAll(
    _db.Productos.ToListAsync(),
    _db.Categorias.ToListAsync(),
    _db.Usuarios.ToListAsync()
); // Paralelo

// ❌ Incorrecto (secuencial)
var p = await _db.Productos.ToListAsync();
var c = await _db.Categorias.ToListAsync();
var u = await _db.Usuarios.ToListAsync();
```

### Frontend Optimization

```javascript
// 1. Code splitting
const AdminPanel = React.lazy(() => import('./AdminPanel.js'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminPanel /> {/* Solo se carga cuando es necesario */}
    </Suspense>
  );
}

// 2. Image optimization
// ❌ Cargar imagen sin optimizar
<img src="/images/hero.jpg" /> {/* 3MB */}

// ✓ Usar srcset + WebP
<picture>
  <source srcSet="/images/hero.webp" type="image/webp" />
  <source srcSet="/images/hero.jpg" type="image/jpeg" />
  <img src="/images/hero.jpg" alt="Hero" />
</picture>

// 3. Virtualization (para listas largas)
import { FixedSizeList } from 'react-window';

function LargeList({ items }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={35}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}

// 4. Memoization
const Memoizado = React.memo(({ id, nombre }) => {
  return <div>{nombre}</div>;
});

// 5. useCallback para evitar recrear funciones
const handleClick = useCallback(() => {
  console.log('click');
}, []);
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo identificarías un bottleneck de performance?**
> Usar profiling/tracing tools, no intuición:
> - Backend: BenchmarkDotNet, SQL Profiler, Entity Framework logging
> - Frontend: Chrome DevTools Performance, React Profiler, Lighthouse
> - Medir antes, cambiar, medir después

**2. ¿Qué es el problema N+1 en bases de datos?**
> Hacer 1 query + N queries en loop. Ejemplo: obtener 100 productos, luego hacer 100 queries para sus comentarios = 101 queries.
> Solución: Include (eager loading) o batch loading.

**3. ¿Cómo optimizar una lista de 10,000 items en React?**
> Usar virtualization (react-window): solo renderiza items visibles en pantalla.

**4. ¿Cuándo es importante AsNoTracking() en EF?**
> Para queries de solo lectura con muchos datos. Reduce memory y CPU ~30%. No lo uses si necesitas rastrear cambios.

**5. ¿Qué es un memory leak y cómo prevenirlo?**
> Objetos que no se limpian aunque ya no se usen. En .NET: evitar referencias estáticas innecesarias. En JS: usar cleanup en useEffect.

```csharp
// .NET memory leak
static List<Data> cache = new();

void AddToCache(Data d) {
  cache.Add(d); // Nunca se limpia
}

// Solución: usar WeakReference o LRU cache
```

**6. ¿Cuál es la diferencia entre rendering en ruta vs lazy loading?**
> - **Rendering en ruta**: todo se carga al inicio (rápido interactuar, lento inicio)
> - **Lazy loading**: cargar bajo demanda (más lento inicio pero más rápido globalmente)
>
> Hoy: lazy loading + code splitting es mejor para apps grandes.

**7. ¿Cómo sabes si une query SQL es lento?**
> - SQL Profiler: time, CPU, reads
> - EXPLAIN PLAN: ejecución step-by-step
> - Missing índices: queries que hacen table scan
> - ToQueryString() en EF ver SQL generado