---
id: caching-redis
title: Caché y Redis
sidebar_position: 15
---

# Caché y Redis

## ¿Por Qué Cachear?

La caché es una capa intermedia que almacena resultados de operaciones costosas para reutilizarlos sin repetir el trabajo.

### Latencias de Referencia

| Operación | Latencia típica |
|-----------|----------------|
| Acceso a L1 cache (CPU) | ~0.5 ns |
| Acceso a RAM (memoria) | ~100 ns |
| Lectura de disco SSD | ~100 µs |
| Query a BD en misma red | ~1-10 ms |
| Llamada a API externa | ~50-500 ms |

Redis vive en memoria → **latencia de ~0.1-1 ms** vs una query a BD de ~5-20 ms.

### Beneficios Concretos

- **Reducir latencia**: servir desde memoria es 10-100x más rápido que ir a la BD.
- **Reducir carga en la BD**: menos queries = más capacidad para operaciones críticas.
- **Mejorar throughput**: la misma API puede servir 10x más requests por segundo.
- **Resiliencia**: si la BD cae brevemente, la caché sigue sirviendo datos.

### El Trade-off Fundamental

```
Rendimiento   ◄────────────────────────────────►   Consistencia
(datos viejos en caché)                     (siempre ir a la BD)
```

Siempre preguntar: **¿cuánto tiempo puede estar este dato desactualizado?**
- Precio de producto en e-commerce: quizás 5 minutos está bien.
- Saldo de cuenta bancaria: nunca cachear sin invalidación inmediata.

---

## Estrategias de Caché

### Cache-Aside (Lazy Loading)

La más común. La **aplicación** decide cuándo ir a la BD.

```
Request → App → ¿Está en caché? → SÍ → Devolver datos de caché
                                → NO → Ir a BD → Guardar en caché → Devolver datos
```

```csharp
// Cache-Aside con IDistributedCache
public async Task<Producto?> ObtenerProductoAsync(int id)
{
    var clave = $"producto:{id}";

    // 1. Intentar desde caché
    var json = await _cache.GetStringAsync(clave);
    if (json is not null)
    {
        return JsonSerializer.Deserialize<Producto>(json);
    }

    // 2. Miss — ir a la BD
    var producto = await _dbContext.Productos.FindAsync(id);
    if (producto is null) return null;

    // 3. Guardar en caché para la próxima vez
    var opciones = new DistributedCacheEntryOptions
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
    };
    await _cache.SetStringAsync(clave, JsonSerializer.Serialize(producto), opciones);

    return producto;
}
```

**Ventajas**: simple, solo cachea lo que se pide. **Desventajas**: primer request siempre es lento (cache miss).

### Read-Through

La **caché** obtiene los datos de la BD automáticamente en caso de miss. La app solo habla con la caché.

```
Request → App → Caché → ¿Existe? → SÍ → Devolver
                                  → NO → Caché va a BD → Guarda → Devuelve
```

Redis no hace esto nativamente; se implementa con un wrapper. Más limpio conceptualmente, pero más complejo de implementar.

### Write-Through

Al escribir, se actualiza **caché y BD de forma simultánea**. La caché siempre está fresca.

```csharp
public async Task ActualizarProductoAsync(Producto producto)
{
    // 1. Actualizar en BD
    _dbContext.Productos.Update(producto);
    await _dbContext.SaveChangesAsync();

    // 2. Actualizar en caché inmediatamente
    var clave = $"producto:{producto.Id}";
    var opciones = new DistributedCacheEntryOptions
    {
        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10)
    };
    await _cache.SetStringAsync(clave, JsonSerializer.Serialize(producto), opciones);
}
```

**Ventaja**: datos siempre frescos. **Desventaja**: mayor latencia de escritura, se escriben datos que quizás nunca se lean.

### Write-Behind (Write-Back)

Escribe en caché primero, y **luego de forma asíncrona** en la BD.

```
Request → App → Caché (ACK inmediato) → Background worker → BD
```

**Ventaja**: escrituras muy rápidas. **Desventaja**: riesgo de pérdida de datos si la caché cae antes de persistir. Solo para datos tolerantes a pérdidas (logs, métricas, likes en redes sociales).

### Refresh-Ahead

Actualiza en caché **antes de que expire**, para datos de acceso muy frecuente.

```csharp
// Cuando queda poco tiempo de vida, refrescar en background
public async Task<DashboardData> ObtenerDashboardAsync()
{
    var clave = "dashboard:global";
    var entrada = await _redisDb.StringGetWithExpiryAsync(clave);

    if (entrada.Value.HasValue)
    {
        // Si queda menos del 20% del TTL, refrescar en background
        if (entrada.Expiry < TimeSpan.FromMinutes(2))
        {
            _ = Task.Run(() => RefrescarDashboardAsync(clave)); // fuego y olvida
        }
        return JsonSerializer.Deserialize<DashboardData>(entrada.Value!)!;
    }

    return await RefrescarDashboardAsync(clave);
}
```

---

## Cache Invalidation

> *"There are only two hard things in Computer Science: cache invalidation and naming things."*
> — Phil Karlton

### TTL (Time To Live)

La forma más simple: el dato expira automáticamente después de X tiempo.

```csharp
var opciones = new DistributedCacheEntryOptions
{
    // Expira 10 minutos después de ser creado — independiente del acceso
    AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10),

    // O: expira si no se accede en 5 minutos (se renueva con cada acceso)
    SlidingExpiration = TimeSpan.FromMinutes(5),

    // Combinados: máximo 1 hora aunque se siga accediendo
    AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1),
    SlidingExpiration = TimeSpan.FromMinutes(15),
};
```

### Invalidación Activa por Evento

Cuando el dato cambia, borrar la clave de caché explícitamente:

```csharp
public async Task ActualizarPrecioAsync(int productoId, decimal nuevoPrecio)
{
    // Actualizar en BD
    var producto = await _dbContext.Productos.FindAsync(productoId);
    producto!.Precio = nuevoPrecio;
    await _dbContext.SaveChangesAsync();

    // Invalidar caché — el próximo request traerá el dato fresco
    await _cache.RemoveAsync($"producto:{productoId}");

    // También invalidar cachés relacionadas
    await _cache.RemoveAsync($"catalogo:categoria:{producto.CategoriaId}");
    await _cache.RemoveAsync("productos:destacados");
}
```

### Versioned Keys

Cambiar el prefijo invalida masivamente sin borrar clave por clave:

```csharp
// Guardamos la versión en otra clave de Redis
public async Task<string> ObtenerVersionCatalogoAsync()
{
    return await _redisDb.StringGetAsync("catalogo:version") ?? "v1";
}

public async Task<List<Producto>> ObtenerCatalogoAsync()
{
    var version = await ObtenerVersionCatalogoAsync();
    var clave = $"catalogo:{version}:todos"; // "catalogo:v3:todos"

    // Si cambia la versión, esta clave ya no existe → cache miss automático
    var cached = await _cache.GetStringAsync(clave);
    if (cached is not null) return JsonSerializer.Deserialize<List<Producto>>(cached)!;

    var productos = await _dbContext.Productos.ToListAsync();
    await _cache.SetStringAsync(clave, JsonSerializer.Serialize(productos));
    return productos;
}

public async Task InvalidarCatalogoCompletoAsync()
{
    // Incrementar versión invalida TODAS las claves del catálogo de golpe
    await _redisDb.StringIncrementAsync("catalogo:version");
}
```

### Cache Stampede / Thundering Herd

Cuando una clave popular expira, miles de requests intentan recalcularla simultáneamente, colapsando la BD.

```csharp
// Solución: distributed lock — solo uno recalcula, los demás esperan
public async Task<Producto?> ObtenerProductoConLockAsync(int id)
{
    var clave = $"producto:{id}";
    var json = await _cache.GetStringAsync(clave);
    if (json is not null) return JsonSerializer.Deserialize<Producto>(json);

    var claveBloqueo = $"lock:producto:{id}";

    // Solo un proceso puede tener el lock; los demás esperan
    var lockAdquirido = await _redisDb.StringSetAsync(
        claveBloqueo, "1",
        TimeSpan.FromSeconds(30),
        When.NotExists // SETNX — solo si no existe
    );

    if (!lockAdquirido)
    {
        await Task.Delay(100); // Esperar y reintentar
        return await ObtenerProductoConLockAsync(id);
    }

    try
    {
        var producto = await _dbContext.Productos.FindAsync(id);
        if (producto is not null)
            await _cache.SetStringAsync(clave, JsonSerializer.Serialize(producto));
        return producto;
    }
    finally
    {
        await _redisDb.KeyDeleteAsync(claveBloqueo);
    }
}
```

---

## IMemoryCache en .NET

Caché en memoria del **proceso** — rápida y simple, pero limitada a una sola instancia.

### Cuándo Usar

- App monolítica con **una sola instancia** (sin escalar horizontalmente).
- Datos que caben en la RAM del servidor.
- Necesitas velocidad máxima (sin serialización, sin red).

### Registro y Configuración

```csharp
// Program.cs
builder.Services.AddMemoryCache(options =>
{
    options.SizeLimit = 1024;           // Límite de entradas (si usas SetSize)
    options.CompactionPercentage = 0.25; // Reducir 25% cuando se llena
});
```

### Operaciones Principales

```csharp
public class ProductoService
{
    private readonly IMemoryCache _cache;
    private readonly AppDbContext _db;

    public ProductoService(IMemoryCache cache, AppDbContext db)
    {
        _cache = cache;
        _db    = db;
    }

    // GetOrCreate — el patrón más limpio para Cache-Aside
    public async Task<Producto?> ObtenerAsync(int id)
    {
        return await _cache.GetOrCreateAsync($"producto:{id}", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            entry.SlidingExpiration = TimeSpan.FromMinutes(5);
            entry.Priority = CacheItemPriority.Normal;
            // CacheItemPriority.NeverRemove — nunca expulsar bajo presión de memoria

            return await _db.Productos.FindAsync(id);
        });
    }

    // Set manual
    public void GuardarEnCache(Producto producto)
    {
        var opciones = new MemoryCacheEntryOptions()
            .SetAbsoluteExpiration(TimeSpan.FromMinutes(10))
            .SetPriority(CacheItemPriority.High)
            .RegisterPostEvictionCallback((key, value, reason, state) =>
            {
                Console.WriteLine($"Cache evicted: {key}, reason: {reason}");
            });

        _cache.Set($"producto:{producto.Id}", producto, opciones);
    }

    // Invalidar
    public void Invalidar(int id) => _cache.Remove($"producto:{id}");

    // TryGetValue — verificar sin crear
    public bool EstaEnCache(int id, out Producto? producto)
    {
        return _cache.TryGetValue($"producto:{id}", out producto);
    }
}
```

---

## IDistributedCache en .NET

Abstracción de caché compartida entre **múltiples instancias** de la aplicación.

### Cuándo Usar

- App en **Kubernetes** con múltiples pods.
- Detrás de un **load balancer** sin sticky sessions.
- Necesitas que la caché sobreviva a un reinicio de la app.

### Registro con Redis

```csharp
// Program.cs
builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration.GetConnectionString("Redis");
    // appsettings.json: "Redis": "localhost:6379,password=secret,ssl=false"
    options.InstanceName = "MiApp:"; // Prefijo para todas las claves
});
```

### Uso Completo

```csharp
public class ProductoDistribuidoService
{
    private readonly IDistributedCache _cache;
    private readonly AppDbContext _db;

    public ProductoDistribuidoService(IDistributedCache cache, AppDbContext db)
    {
        _cache = cache;
        _db    = db;
    }

    public async Task<Producto?> ObtenerAsync(int id, CancellationToken ct = default)
    {
        var clave = $"producto:{id}";

        // Leer de Redis
        var bytes = await _cache.GetAsync(clave, ct);
        if (bytes is not null)
        {
            return JsonSerializer.Deserialize<Producto>(bytes);
        }

        // Miss — ir a BD
        var producto = await _db.Productos.FindAsync(new object[] { id }, ct);
        if (producto is null) return null;

        // Guardar serializado en Redis
        var opciones = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(15)
        };

        var json = JsonSerializer.SerializeToUtf8Bytes(producto);
        await _cache.SetAsync(clave, json, opciones, ct);

        return producto;
    }

    // Método de conveniencia con strings
    public async Task<T?> ObtenerOCrearAsync<T>(
        string clave,
        Func<Task<T>> factory,
        TimeSpan? expiracion = null) where T : class
    {
        var json = await _cache.GetStringAsync(clave);
        if (json is not null)
            return JsonSerializer.Deserialize<T>(json);

        var valor = await factory();
        if (valor is null) return null;

        var opciones = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = expiracion ?? TimeSpan.FromMinutes(10)
        };
        await _cache.SetStringAsync(clave, JsonSerializer.Serialize(valor), opciones);

        return valor;
    }
}
```

---

## Redis

### ¿Qué es Redis?

**RE**mote **DI**ctionary **S**erver — base de datos en memoria, clave-valor, con persistencia opcional y soporte para múltiples estructuras de datos.

### Tipos de Datos y Comandos

```bash
# ── String ─────────────────────────────────────────────────────────────────
SET usuario:1:nombre "Ana García"
GET usuario:1:nombre          # "Ana García"
SETEX sesion:abc123 3600 "datos_de_sesion"  # SET con expiración en segundos
EXPIRE clave 600              # Dar 600s de vida a una clave existente
TTL sesion:abc123             # Cuántos segundos quedan (-1 = sin TTL, -2 = no existe)
DEL producto:42               # Eliminar clave

# ── Counter ─────────────────────────────────────────────────────────────────
SET visitas:pagina:home 0
INCR visitas:pagina:home      # Incrementar en 1 (atómico)
INCRBY contador 5             # Incrementar en 5
DECR stock:producto:1

# ── Hash — ideal para objetos ───────────────────────────────────────────────
HSET usuario:1 nombre "Ana" email "ana@e.com" edad 30
HGET usuario:1 nombre         # "Ana"
HGETALL usuario:1             # Todos los campos
HMSET usuario:1 nombre "Ana" email "ana@e.com"

# ── List — cola FIFO/LIFO ───────────────────────────────────────────────────
LPUSH cola:emails "mensaje1"  # Insertar al inicio
RPUSH cola:emails "mensaje2"  # Insertar al final
RPOP cola:emails              # Sacar del final (FIFO si se usa con LPUSH)
LRANGE cola:emails 0 -1       # Ver todos los elementos
BLPOP cola:emails 0           # Blocking pop — esperar si está vacía

# ── Set — valores únicos ────────────────────────────────────────────────────
SADD usuarios:online "user:1" "user:2" "user:3"
SISMEMBER usuarios:online "user:1"  # 1 (true)
SMEMBERS usuarios:online      # Todos los miembros
SCARD usuarios:online         # Cantidad de miembros

# ── Sorted Set — ranking ────────────────────────────────────────────────────
ZADD leaderboard 1500 "jugador:ana"
ZADD leaderboard 2300 "jugador:luis"
ZADD leaderboard 1800 "jugador:maria"
ZRANGE leaderboard 0 -1 WITHSCORES REV   # Top jugadores (desc)
ZRANK leaderboard "jugador:maria"         # Posición (0-indexed)
ZINCRBY leaderboard 100 "jugador:ana"     # Sumar puntos
```

### Persistencia en Redis

```
RDB (Redis Database):
  - Snapshot periódico a disco
  - Eficiente, poco overhead
  - Puede perder datos entre snapshots

AOF (Append Only File):
  - Log de todos los comandos de escritura
  - Más durabilidad (configurable: cada segundo, por cada escritura)
  - Archivos más grandes, recovery más lento

Recomendación: usar ambos juntos en producción
```

### Redis Cluster vs Redis Sentinel

```
Redis Sentinel — Alta Disponibilidad:
  - Monitorea el nodo principal
  - Promueve automáticamente un réplica si el principal falla
  - Failover automático
  - NO escala escrituras

Redis Cluster — Escalabilidad Horizontal:
  - Distribuye datos entre múltiples nodos (sharding automático)
  - Escala tanto lecturas como escrituras
  - Mínimo 3 nodos primarios + 3 réplicas (6 nodos)
  - Más complejo de operar
```

---

## StackExchange.Redis en .NET

El cliente Redis más popular para .NET. Más bajo nivel que `IDistributedCache`, da acceso a todos los tipos de Redis.

```csharp
// Program.cs — registrar el cliente
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
    ConnectionMultiplexer.Connect(builder.Configuration["Redis:ConnectionString"]!));

// Obtener la base de datos Redis (thread-safe, reutilizar)
builder.Services.AddScoped<IDatabase>(sp =>
    sp.GetRequiredService<IConnectionMultiplexer>().GetDatabase());
```

```csharp
// Uso directo con IDatabase
public class RedisService
{
    private readonly IDatabase _db;

    public RedisService(IDatabase db) => _db = db;

    // ── Caché de sesión ───────────────────────────────────────────────────
    public async Task GuardarSesionAsync(string token, SesionUsuario sesion)
    {
        var clave = $"sesion:{token}";
        var json  = JsonSerializer.Serialize(sesion);
        await _db.StringSetAsync(clave, json, TimeSpan.FromHours(8));
    }

    public async Task<SesionUsuario?> ObtenerSesionAsync(string token)
    {
        var json = await _db.StringGetAsync($"sesion:{token}");
        if (!json.HasValue) return null;
        return JsonSerializer.Deserialize<SesionUsuario>(json!);
    }

    // ── Rate limiting ─────────────────────────────────────────────────────
    public async Task<bool> PermitirRequestAsync(string ip, int limiteXMinuto = 60)
    {
        var clave = $"ratelimit:{ip}:{DateTime.UtcNow:yyyyMMddHHmm}";

        var cuenta = await _db.StringIncrementAsync(clave);
        if (cuenta == 1)
            await _db.KeyExpireAsync(clave, TimeSpan.FromMinutes(1));

        return cuenta <= limiteXMinuto;
    }

    // ── Leaderboard con Sorted Set ────────────────────────────────────────
    public async Task RegistrarPuntuacionAsync(string jugadorId, double puntos)
    {
        await _db.SortedSetAddAsync("leaderboard:global", jugadorId, puntos);
    }

    public async Task<IEnumerable<(string Jugador, double Puntos)>> ObtenerTop10Async()
    {
        var entradas = await _db.SortedSetRangeByRankWithScoresAsync(
            "leaderboard:global", 0, 9, Order.Descending);

        return entradas.Select(e => ((string)e.Element!, e.Score));
    }

    // ── Pub/Sub para notificaciones ───────────────────────────────────────
    public async Task PublicarEventoAsync(string canal, object evento)
    {
        var subscriber = _db.Multiplexer.GetSubscriber();
        await subscriber.PublishAsync(canal, JsonSerializer.Serialize(evento));
    }
}
```

---

## Patrones con Redis

### Distributed Lock

Garantizar que **solo un proceso** ejecute una tarea a la vez (útil para jobs en Kubernetes con múltiples pods):

```csharp
public class DistributedLockService
{
    private readonly IDatabase _db;

    public async Task<bool> EjecutarConLockAsync(
        string recurso,
        Func<Task> accion,
        TimeSpan timeout)
    {
        var claveBloqueo = $"lock:{recurso}";
        var lockId = Guid.NewGuid().ToString(); // ID único para este proceso

        // SETNX — Set if Not Exists (atómico)
        var adquirido = await _db.StringSetAsync(
            claveBloqueo, lockId, timeout, When.NotExists);

        if (!adquirido)
        {
            return false; // Otro proceso tiene el lock
        }

        try
        {
            await accion();
            return true;
        }
        finally
        {
            // Solo liberar si somos nosotros quienes tenemos el lock (Lua script atómico)
            var script = @"
                if redis.call('get', KEYS[1]) == ARGV[1] then
                    return redis.call('del', KEYS[1])
                else
                    return 0
                end";
            await _db.ScriptEvaluateAsync(script, new RedisKey[] { claveBloqueo }, new RedisValue[] { lockId });
        }
    }
}

// Uso:
await lockService.EjecutarConLockAsync("procesar-facturas", async () =>
{
    await facturasService.ProcesarFacturasPendientesAsync();
}, TimeSpan.FromMinutes(5));
```

### Feature Flags con Hash

```csharp
public class FeatureFlagService
{
    private readonly IDatabase _db;
    private const string HashClave = "feature-flags";

    public async Task<bool> EstaActivadoAsync(string feature)
    {
        var valor = await _db.HashGetAsync(HashClave, feature);
        return valor.HasValue && (bool)valor;
    }

    public async Task ActivarAsync(string feature)
        => await _db.HashSetAsync(HashClave, feature, true);

    public async Task DesactivarAsync(string feature)
        => await _db.HashSetAsync(HashClave, feature, false);
}

// Uso:
if (await _flags.EstaActivadoAsync("nueva-experiencia-checkout"))
{
    return View("CheckoutNuevo");
}
```

---

## Buenas Prácticas

### Nomenclatura de Claves

```
✅ Estructura: objeto:id:campo  o  servicio:objeto:id

app:usuario:123:perfil
app:usuario:123:sesiones
app:producto:456:detalle
app:catalogo:categoria:electronica
ratelimit:ip:192.168.1.1:2024011015  (incluir ventana de tiempo)

❌ Evitar:
usuario123          (sin separadores, ambiguo)
u:1                 (demasiado críptico)
USUARIO:123:PERFIL  (mayúsculas, inconsistente)
```

### TTL Siempre

```csharp
// ❌ NUNCA guardar sin TTL a menos que sea explícitamente intencional
await _cache.SetStringAsync("datos-importantes", json); // ← sin expiración

// ✅ Siempre establecer una expiración razonable
await _cache.SetStringAsync("datos-importantes", json, new DistributedCacheEntryOptions
{
    AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1)
});

// ✅ O en Redis directo
await _db.StringSetAsync("clave", "valor", TimeSpan.FromMinutes(30));
```

### No Cachear Objetos Grandes

```csharp
// ❌ Un objeto de 5MB en Redis es un problema
var reporteCompleto = await GenerarReporteConTodoElHistorialAsync(); // 5MB
await _cache.SetStringAsync("reporte:completo", JsonSerializer.Serialize(reporteCompleto));

// ✅ Cachear solo el resumen
var resumen = await GenerarResumenReporteAsync(); // ~10KB
await _cache.SetStringAsync("reporte:resumen", JsonSerializer.Serialize(resumen));

// ✅ O comprimir si es necesario cachear objetos grandes
public async Task SetCompressedAsync(string clave, object valor, TimeSpan ttl)
{
    var json  = JsonSerializer.SerializeToUtf8Bytes(valor);
    using var ms = new MemoryStream();
    using (var gzip = new GZipStream(ms, CompressionLevel.Fastest))
        await gzip.WriteAsync(json);

    await _db.StringSetAsync(clave, ms.ToArray(), ttl);
}
```

### Monitorear Redis

```bash
# Estadísticas en tiempo real
redis-cli INFO stats
redis-cli INFO memory

# Métricas clave a monitorear:
# keyspace_hits / keyspace_misses → hit rate (objetivo > 90%)
# used_memory → no debe superar maxmemory
# evicted_keys → si es > 0, necesitas más memoria o TTLs más cortos
# connected_clients → clientes conectados simultáneamente

# Ver comandos en tiempo real (precaución en producción)
redis-cli MONITOR

# Buscar claves por patrón (usar SCAN, nunca KEYS en producción)
redis-cli SCAN 0 MATCH "producto:*" COUNT 100
```

### Resumen de Decisiones

| Situación | Recomendación |
|-----------|--------------|
| App de instancia única | `IMemoryCache` |
| Múltiples instancias / Kubernetes | `IDistributedCache` con Redis |
| Necesitas Sorted Sets / Pub-Sub / Locks | `StackExchange.Redis` directo |
| Datos que no pueden estar desactualizados | Cache-Aside + invalidación por evento |
| Datos que toleran minutos de desfase | Cache-Aside + TTL |
| Contadores / rate limiting | `INCR` + `EXPIRE` en Redis |
| Leaderboards | Sorted Sets en Redis |
