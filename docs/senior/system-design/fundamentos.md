---
title: "📐 Fundamentos: CAP, Caché, Rate Limiting y Sharding"
sidebar_position: 1
---

# 📐 Fundamentos: CAP, Caché, Rate Limiting y Sharding

## Teorema CAP y modelos de consistencia

El **Teorema CAP** (Brewer, 2000) establece que un sistema distribuido solo puede garantizar dos de estas tres propiedades simultáneamente:

```
         Consistency (C)
         Todos los nodos ven
         los mismos datos al
         mismo tiempo
              /\
             /  \
            /    \
           /  ??? \
          /________\
Availability (A)          Partition
Todas las requests         Tolerance (P)
reciben respuesta          El sistema funciona
(sin garantía de           aunque haya fallos
datos más recientes)       de red entre nodos
```

En sistemas reales, los fallos de red (P) son inevitables, por lo que **debes elegir entre C y A**:

| Sistema | Elección | Razón |
|---------|----------|-------|
| **PostgreSQL, MySQL** | CP | Prioriza consistencia; puede negarse a responder si no hay quorum |
| **Cassandra, DynamoDB** | AP | Prioriza disponibilidad; puede devolver datos desactualizados |
| **MongoDB** | CP (configurable) | Puede configurarse para AP con lecturas en secondary |
| **Redis** | CP (en cluster) | Master falla → la partición no acepta writes |
| **ZooKeeper** | CP | Coordinación distribuida necesita consistencia |

### Modelos de consistencia (de más fuerte a más débil)

```
STRONG CONSISTENCY (Linearizability)
  → Toda lectura devuelve el último write.
  → Ejemplo: Transacciones SQL. Costoso en latencia.

SEQUENTIAL CONSISTENCY
  → Los writes de un proceso se ven en orden por todos,
    pero puede haber lag entre procesos.

CAUSAL CONSISTENCY
  → Operaciones causalmente relacionadas se ven en orden.
  → "Si ves el efecto, debes ver la causa".

EVENTUAL CONSISTENCY
  → Eventualmente todos los nodos convergen al mismo valor.
  → Puede haber ventanas donde nodos distintos devuelven
    resultados distintos.
  → Ejemplo: DNS propagation, DynamoDB default.

READ-YOUR-OWN-WRITES
  → Garantía específica: siempre ves tus propios writes.
  → Ejemplo: después de publicar un post, tú lo ves
    inmediatamente aunque otros tengan lag.
```

**Pregunta de entrevista típica:** "¿Cuándo aceptarías consistencia eventual?"
> En datos donde el lag es aceptable: feeds de redes sociales, contadores de likes, catálogos de productos. **No** en saldos bancarios, inventario de stock, reservas de asientos de avión.

---

## Patrones de Caché

### Los 4 patrones principales

```
1. CACHE-ASIDE (Lazy Loading) — el más común
   ─────────────────────────────────────────
   App ──→ Cache: ¿tienes user:123?
             ↓ MISS
   App ──→ DB: SELECT * FROM users WHERE id=123
   App ←── DB: {datos}
   App ──→ Cache: SET user:123 = {datos} TTL=300s
   App ←── Cache: OK

   Pros: Solo se cachea lo que se pide
   Cons: 3 viajes en el primer acceso (cache stampede posible)

2. WRITE-THROUGH
   ─────────────
   App ──→ Cache: SET user:123 = {datos}
   Cache ──→ DB: INSERT/UPDATE (síncrono)

   Pros: Cache siempre consistente con DB
   Cons: Latencia de write aumenta (doble escritura)

3. WRITE-BACK (Write-Behind)
   ──────────────────────────
   App ──→ Cache: SET user:123 = {datos} (inmediato)
   Cache ──→ DB: UPDATE (asíncrono, cada X segundos)

   Pros: Writes muy rápidos, agrupa múltiples writes
   Cons: Riesgo de pérdida de datos si el caché cae antes de flush

4. READ-THROUGH
   ─────────────
   App ──→ Cache: GET user:123
             ↓ MISS
   Cache ──→ DB: (el caché mismo consulta la DB)
   Cache ←── DB: {datos}
   App ←── Cache: {datos}

   Pros: Transparente para la app
   Cons: Requiere que el caché soporte esta lógica (Redis + plugin)
```

### Implementación Cache-Aside en C# con IMemoryCache y Redis

```csharp
public class UserService
{
    private readonly IDistributedCache _redis;
    private readonly AppDbContext _db;

    // Cache-Aside pattern
    public async Task<User?> GetUserAsync(int userId)
    {
        var cacheKey = $"user:{userId}";

        // 1. Buscar en caché
        var cached = await _redis.GetStringAsync(cacheKey);
        if (cached is not null)
            return JsonSerializer.Deserialize<User>(cached);

        // 2. Cache miss → consultar DB
        var user = await _db.Users.FindAsync(userId);
        if (user is null) return null;

        // 3. Guardar en caché con TTL
        await _redis.SetStringAsync(cacheKey,
            JsonSerializer.Serialize(user),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5),
                SlidingExpiration = TimeSpan.FromMinutes(2) // Resetea TTL si se accede
            });

        return user;
    }

    // Invalidación al actualizar
    public async Task UpdateUserAsync(User user)
    {
        await _db.SaveChangesAsync();
        await _redis.RemoveAsync($"user:{user.Id}"); // Cache invalidation
    }
}
```

### Cache Stampede (Thundering Herd) — cómo evitarlo

**Problema:** 10.000 requests llegan cuando una clave expiró al mismo tiempo. Todas van a la DB.

```csharp
// Solución: Probabilistic Early Expiration o Mutex/Lock por clave
public async Task<User?> GetUserWithLockAsync(int userId)
{
    var cacheKey = $"user:{userId}";
    var lockKey  = $"lock:user:{userId}";

    var cached = await _redis.GetStringAsync(cacheKey);
    if (cached is not null) return JsonSerializer.Deserialize<User>(cached);

    // Solo 1 thread reconstruye el caché; los demás esperan
    var lockAcquired = await _redis.SetAsync(lockKey, "1",
        new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(5) },
        When.NotExists); // SETNX atómico

    if (!lockAcquired)
    {
        await Task.Delay(50); // Esperar y reintentar
        return await GetUserWithLockAsync(userId);
    }

    try
    {
        var user = await _db.Users.FindAsync(userId);
        if (user is not null)
            await _redis.SetStringAsync(cacheKey, JsonSerializer.Serialize(user));
        return user;
    }
    finally
    {
        await _redis.RemoveAsync(lockKey);
    }
}
```

### Estrategias de invalidación de caché

```
Las dos cosas más difíciles en CS: naming things y cache invalidation.

1. TTL (Time-To-Live) — más simple, aceptable para datos que cambian poco
   SET key value EX 300 (expira en 5 min)

2. Event-driven invalidation — más preciso
   Al actualizar user:123 en DB → publicar evento → invalidar cache key
   (Ver CQRS: el command handler invalida el caché además de actualizar la DB)

3. Write-through — el caché se actualiza junto con la DB
   Garantiza consistencia inmediata

4. Versioned keys — evita invalidar, simplemente cambia la clave
   user:123:v1 → user:123:v2
   Las keys viejas expiran solas por TTL
```

---

## Rate Limiting

### Por qué es esencial
- Protege la API de abusos y DDoS
- Garantiza fair-use entre clientes
- Previene que un cliente monopolice recursos

### Algoritmos

```
1. TOKEN BUCKET (usado por AWS, Stripe)
   ──────────────────────────────────────
   Bucket con capacidad N tokens.
   Se añaden R tokens/segundo (constante).
   Cada request consume 1 token.
   Si no hay tokens → 429 Too Many Requests.

   Ventaja: permite bursts hasta N requests.

   [★★★★] bucket: 100 tokens, refill: 10/seg
     0s: 100 tokens → 30 requests → 70 tokens
     5s: 70 + 50 = 100 tokens (máximo cap)
    10s: 100 tokens → disponible para burst de nuevo

2. LEAKY BUCKET
   ─────────────
   Las requests entran en una cola (el "balde").
   Se procesan a tasa constante R (el "goteo").
   Si la cola está llena → se descarta la request.

   Ventaja: output absolutamente constante (bueno para downstream APIs).
   Desventaja: los bursts se encolan, no se sirven rápido.

3. FIXED WINDOW COUNTER
   ──────────────────────
   Ventana de tiempo fija (ej: 1 min).
   Contador de requests en esa ventana.
   Al pasar el minuto → resetear contador.

   Problema: boundary burst — 100 requests al final del minuto 1
   + 100 al inicio del minuto 2 = 200 requests en 2 segundos.

4. SLIDING WINDOW LOG
   ───────────────────
   Guardar timestamps de todas las requests en una lista.
   Para cada nueva request: eliminar timestamps > ventana atrás.
   Si len(lista) >= limite → rechazar.

   Preciso pero costoso en memoria para ventanas largas.

5. SLIDING WINDOW COUNTER (balance entre precisión y eficiencia)
   ───────────────────────────────────────────────────────────────
   Combina dos ventanas fijas con peso proporcional:

   requests = current_window_count
            + previous_window_count × (tiempo_restante / tamaño_ventana)
```

### Implementación con Redis en ASP.NET Core

```csharp
// Middleware de Rate Limiting con Token Bucket en Redis
public class RateLimitMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IDistributedCache _redis;
    private const int MAX_TOKENS = 100;
    private const int REFILL_RATE = 10; // tokens por segundo

    public async Task InvokeAsync(HttpContext context)
    {
        var clientId = context.Request.Headers["X-API-Key"].ToString()
                       ?? context.Connection.RemoteIpAddress?.ToString()
                       ?? "anonymous";

        var allowed = await CheckRateLimit(clientId);
        if (!allowed)
        {
            context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
            context.Response.Headers["Retry-After"] = "1";
            await context.Response.WriteAsJsonAsync(new { error = "Rate limit exceeded" });
            return;
        }

        await _next(context);
    }

    private async Task<bool> CheckRateLimit(string clientId)
    {
        // Lua script para operación atómica en Redis (evita race conditions)
        var script = @"
            local key = KEYS[1]
            local max_tokens = tonumber(ARGV[1])
            local refill_rate = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])

            local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
            local tokens = tonumber(bucket[1]) or max_tokens
            local last_refill = tonumber(bucket[2]) or now

            -- Calcular tokens a añadir desde última recarga
            local elapsed = now - last_refill
            tokens = math.min(max_tokens, tokens + elapsed * refill_rate)

            if tokens >= 1 then
                tokens = tokens - 1
                redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
                redis.call('EXPIRE', key, 3600)
                return 1  -- permitido
            else
                return 0  -- rechazado
            end";

        // Ejecutar script Lua atómicamente
        var result = await _redis.ScriptEvaluateAsync(script,
            new RedisKey[] { $"ratelimit:{clientId}" },
            new RedisValue[] { MAX_TOKENS, REFILL_RATE, DateTimeOffset.UtcNow.ToUnixTimeSeconds() });

        return (int)result == 1;
    }
}
```

### Rate limiting nativo en ASP.NET Core 7+

```csharp
// Program.cs — sin necesidad de Redis para casos simples
builder.Services.AddRateLimiter(options =>
{
    // Por IP: ventana fija
    options.AddFixedWindowLimiter("fixed", o =>
    {
        o.PermitLimit = 100;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 10;
    });

    // Por API key: token bucket
    options.AddTokenBucketLimiter("api-key", o =>
    {
        o.TokenLimit = 1000;
        o.TokensPerPeriod = 100;
        o.ReplenishmentPeriod = TimeSpan.FromSeconds(10);
    });

    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers["Retry-After"] = retryAfter.TotalSeconds.ToString();
    };
});

// En el controller o endpoint
app.MapGet("/api/data", () => "data")
   .RequireRateLimiting("api-key");
```

---

## Sharding y Replicación de Base de Datos

### Replicación

```
MASTER-REPLICA (Master-Slave)
──────────────────────────────
         ┌─────────────┐
Writes ──→   MASTER     │──→ Async replication
         └──────────────┘
                │
        ┌───────┼───────┐
        ↓       ↓       ↓
   Replica1  Replica2  Replica3
   (Reads)   (Reads)   (Reads)

Pros: Reads escalan fácilmente (add replicas)
Cons: Replication lag → consistencia eventual
      Master es SPOF para writes

MULTI-MASTER
─────────────
Todos los nodos aceptan writes.
Requiere conflict resolution (last-write-wins, vector clocks).
Ejemplo: CockroachDB, Cassandra.
```

### Sharding (Horizontal Partitioning)

```
Distribución de datos entre múltiples instancias de DB:

1. RANGE-BASED SHARDING
   users con id 1-1M    → Shard A
   users con id 1M-2M   → Shard B
   users con id 2M-3M   → Shard C

   Pros: Fácil de implementar, queries por rango eficientes
   Cons: Hotspots (nuevos users siempre en último shard)

2. HASH-BASED SHARDING
   shard = hash(user_id) % N_shards

   Pros: Distribución uniforme
   Cons: Re-sharding costoso al añadir shards

3. CONSISTENT HASHING (ver sección siguiente)
   Minimiza re-distribución al añadir/quitar shards

4. DIRECTORY-BASED SHARDING
   Servicio de lookup: user:123 → Shard B

   Pros: Flexible, fácil de cambiar
   Cons: El lookup service es un SPOF
```

### Problemas del sharding que hay que mencionar en entrevista

```
1. CROSS-SHARD QUERIES
   SELECT * FROM orders JOIN users ON ...
   → Si orders y users están en shards diferentes, la JOIN es costosa.
   Solución: denormalización, o co-location (guardar juntos datos que
   se consultan juntos).

2. CROSS-SHARD TRANSACTIONS
   Transacción que afecta user en Shard A y su balance en Shard B.
   Requiere Two-Phase Commit (2PC) o Saga pattern.

3. REBALANCING
   Al añadir un shard: mover X% de datos.
   Con hash-based: tienes que re-hashear todo.
   Con consistent hashing: solo mover ~1/N de los datos.
```

---

## Consistent Hashing

**El problema que resuelve:** con hash simple (`key % N`), añadir o quitar un servidor requiere remapear casi todas las claves.

```
HASH RING (anillo de 0 a 2^32-1)

Los servidores se mapean a puntos del anillo:
  Server A → hash("ServerA") = 25
  Server B → hash("ServerB") = 90
  Server C → hash("ServerC") = 180

Una clave se asigna al primer servidor cuyo hash es ≥ hash(clave):
  key "user:1" → hash = 10 → Server A (el siguiente en el anillo desde 10)
  key "user:2" → hash = 60 → Server B
  key "user:3" → hash = 120 → Server C

Al añadir Server D en posición 50:
  Solo las claves entre 25 y 50 se reasignan (de B a D)
  El resto no se mueve → O(K/N) keys reasignadas, no O(K)

VIRTUAL NODES (para distribución uniforme):
  Cada servidor físico tiene múltiples puntos en el anillo.
  Server A: posiciones 10, 70, 150, 220
  Server B: posiciones 30, 95, 175, 250
  Esto evita que la distribución sea desigual por mala suerte
  en los hashes de los servidores reales.
```

**Usos de Consistent Hashing:**
- Distribución de claves en Redis Cluster
- Distribución de requests en balanceadores de carga
- Cassandra para asignación de particiones
- CDN para seleccionar nodo de caché

---

