---
id: system-design
title: System Design
sidebar_position: 7
---

# System Design 🔴

El System Design es una sección crítica en entrevistas Senior. Se espera que puedas diseñar sistemas escalables desde cero.

## Framework para responder preguntas de System Design

```
1. Clarificar requerimientos (5 min)
   - ¿Cuántos usuarios? ¿Cuántas requests/seg?
   - ¿Consistencia o disponibilidad?
   - ¿Qué funcionalidades son core?

2. Estimaciones (2-3 min)
   - Usuarios: 10M DAU
   - Writes: 1000 rps, Reads: 10.000 rps
   - Storage: X GB/día

3. High-Level Design (10 min)
   - Componentes principales
   - Flujo de datos

4. Deep Dive (15 min)
   - Cuello de botella
   - Trade-offs

5. Cierre
   - Monitoreo
   - Puntos de falla
```

---

## Ejemplo: Diseñar un sistema de acortador de URLs (bit.ly)

### Requerimientos
```
Funcionales:
- Dado una URL larga, generar una URL corta
- Redirigir a la URL original al acceder a la corta
- Las URLs expiran después de 5 años

No funcionales:
- 100M URLs creadas por día = 1.160 escrituras/seg
- 10:1 ratio lectura/escritura = 11.600 lecturas/seg
- Alta disponibilidad (redireccionamiento no puede fallar)
- Latencia baja en redirecciones
```

### Estimaciones
```
Storage:
- 100M URLs/día × 365 × 5 años = 182.500M registros
- ~500 bytes por registro = 91 TB en 5 años

Bandwidth:
- Writes: 1.160 rps × 500 bytes = 580 KB/s
- Reads: 11.600 rps × 500 bytes = 5.8 MB/s
```

### Design

```
                           ┌─────────────────────────────┐
Usuarios ──→ DNS/CDN ──→   │        API Servers           │
                           │  (stateless, horizontally    │
                           │   scalable behind LB)        │
                           └──────┬──────────────┬────────┘
                                  │              │
                            ┌─────▼───┐    ┌────▼──────┐
                            │  Cache   │    │    DB     │
                            │ (Redis)  │    │(Cassandra)│
                            │          │    │           │
                            │ shortUrl │    │ shortUrl  │
                            │ → longUrl│    │ longUrl   │
                            └──────────┘    │ userId    │
                                           │ createdAt │
                                           └───────────┘
```

### Generación de Short URLs

```csharp
// Opción 1: Base62 encoding de un ID
// ID: 100000 → Base62: "27c" (7 caracteres = 62^7 = 3.5 trillones combinaciones)
public string AcortarUrl(long id)
{
    const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var sb = new StringBuilder();
    while (id > 0)
    {
        sb.Insert(0, chars[(int)(id % 62)]);
        id /= 62;
    }
    return sb.ToString().PadLeft(7, '0');
}

// Opción 2: Hash MD5/SHA256 + tomar primeros 7 chars
// Riesgo de colisiones

// Opción 3: UUID + base62 (globalmente único)
```

---

## Ejemplo: Diseñar un feed de redes sociales

### Fanout approaches

```
FANOUT ON WRITE (push model):
Al publicar, escribir en el feed de TODOS los seguidores
+ Leer el feed es O(1)
- Costoso para usuarios con millones de seguidores (celebrities)
- Usuarios inactivos reciben escrituras innecesarias

FANOUT ON READ (pull model):
Al leer el feed, traer posts de todos los seguidos y mergear
+ Publicar es barato
- Leer es costoso (N queries por N seguidos)

SOLUCIÓN HÍBRIDA (como Twitter/X):
- Usuarios normales: fanout on write
- Celebrities (>10K seguidores): fanout on read
- Al leer, mergear el feed pre-computado + posts de celebrities
```

---

## Escalabilidad horizontal

```
Estrategias clave:

1. LOAD BALANCING
   - Round Robin, Least Connections, IP Hash
   - Health checks para eliminar instancias caídas

2. DATABASE SCALING
   - Read Replicas: para escalar reads
   - Sharding: para escalar writes (ej: por user_id % N_shards)
   - Master-Slave vs Multi-Master

3. CACHING LAYERS
   - CDN: assets estáticos (CSS, JS, imágenes)
   - Application Cache (Redis): queries frecuentes
   - Query Cache: resultados de DB

4. MESSAGE QUEUES
   - Desacoplar writes asíncronos
   - Absorber picos de tráfico
   - Fan-out processing

5. ASYNC PROCESSING
   - Background jobs (Hangfire, Quartz)
   - Event-driven con RabbitMQ/Kafka
```

---

## Números útiles para estimaciones

```
Latencia aproximada:
- L1 cache reference:     0.5 ns
- L2 cache reference:     7 ns
- Main memory:            100 ns
- SSD read:               150 μs
- HDD seek:               10 ms
- Packet: CA → Netherlands: 150 ms

Tamaños:
- 1 char = 1 byte
- UUID/GUID = 36 bytes (string) o 16 bytes (binary)
- 1 KB = 1.000 bytes
- 1 MB = 10^6 bytes
- 1 GB = 10^9 bytes

DAU típicos:
- 1M DAU: startup
- 10M DAU: scale-up (pensando en horizontal scaling)
- 100M+ DAU: big tech (microservicios, sharding, etc.)
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo diseñarías un sistema de notificaciones en tiempo real?**
> **WebSockets** para conexión bidireccional persistente. Un servidor de notificaciones con un Message Broker (Redis Pub/Sub o Kafka). Al llegar un evento, el servicio publica en Redis, el servidor de notificaciones lo recibe y lo envía al cliente conectado por WebSocket. Para escalar: usar sticky sessions o un broker centralizado.

**2. ¿Cómo manejarías la consistencia de datos en un sistema de reservas (ej: tickets)?**
> Usar **optimistic locking**: en la fila del ticket, tener una columna `version`. Al reservar: `UPDATE tickets SET reservado=true, version=version+1 WHERE id=X AND reservado=false AND version=N`. Si 0 rows afectadas → alguien más se adelantó. Para alta concurrencia: Redis con `SETNX` (atómica) como sistema de locks distribuidos.

**3. ¿Cuándo usarías SQL vs NoSQL?**
> **SQL**: relaciones complejas, ACID necesario, esquema bien definido, reporting. **NoSQL**: escala masiva horizontal, esquema flexible/variable, alto throughput de escritura, datos jerárquicos/documentos. No es SQL vs NoSQL, muchas apps usan ambos (polyglot persistence).

**4. ¿Cómo harías para que un sistema soporte 10x más tráfico del actual?**
> Primero: medir dónde está el bottleneck. Luego (en orden de costo/impacto): agregar caché (Redis), read replicas en la DB, escalar horizontalmente los app servers, optimizar queries más lentas, CDN para assets, separar servicios con mucho tráfico (microservicios), sharding de la DB.

---

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

## Ejemplo: Diseñar un sistema de chat (tipo WhatsApp)

### Requerimientos
```
Funcionales:
- Mensajes 1:1 y grupos (hasta 500 miembros)
- Indicadores de entrega (enviado ✓, entregado ✓✓, leído ✓✓ azul)
- Presencia online/offline
- Historial de mensajes

No funcionales:
- 50M DAU, cada usuario envía ~40 msgs/día
- Writes: ~23.000 msg/seg
- Latencia < 500ms para entrega
- Alta disponibilidad (99.99%)
```

### Estimaciones
```
Mensajes:
  50M usuarios × 40 msgs/día = 2.000M msgs/día
  2.000M / 86.400 seg ≈ 23.000 msgs/seg (writes)
  Reads: ~5× → 115.000 msgs/seg

Storage:
  Asumiendo retención de 5 años, ~100 bytes/msg:
  2.000M × 365 × 5 × 100 bytes ≈ 365 TB

Conexiones WebSocket simultáneas:
  50M DAU con ~10% concurrencia ≈ 5M conexiones activas
```

### Arquitectura

```
                         ┌──────────────────────────┐
Clientes ──WebSocket──→  │   Chat Servers            │
                         │   (stateful, millones de  │
                         │    conexiones por servidor)│
                         └──────────┬───────────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               ↓                    ↓                    ↓
        ┌─────────────┐    ┌─────────────────┐  ┌──────────────┐
        │  Presence   │    │  Message Queue  │  │  Push Notif  │
        │  Service    │    │  (Kafka)        │  │  Service     │
        │  (Redis)    │    │                 │  │  (APNs/FCM)  │
        └─────────────┘    └────────┬────────┘  └──────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Message Storage   │
                          │  (Cassandra)       │
                          │  Particionada por  │
                          │  conversation_id   │
                          └────────────────────┘
```

### Flujo de entrega de un mensaje

```
1. User A (conectado a ChatServer1) envía msg a User B

2. ChatServer1:
   a. Persiste msg en Cassandra con status=SENT
   b. Publica en Kafka: topic "messages", key=conversation_id

3. Message Router consume de Kafka:
   a. Busca en qué ChatServer está conectado User B
      (Lookup en Redis: user_id → server_id)
   b. Si User B está online → envía el msg al ChatServer de B
   c. Si User B está offline → encola en Push Notification Service

4. ChatServer de B entrega por WebSocket al cliente B
   B confirma recepción → actualizar status a DELIVERED

5. B abre el mensaje → actualizar status a READ
   ChatServer notifica a A el cambio de status
```

### Schema en Cassandra (optimizado para leer por conversación)

```sql
-- Partition key: conversation_id (todos los msgs de una conv juntos)
-- Clustering key: created_at DESC (últimos msgs primero)
CREATE TABLE messages (
    conversation_id UUID,
    created_at      TIMESTAMP,
    message_id      UUID,
    sender_id       BIGINT,
    content         TEXT,
    status          TEXT,   -- SENT | DELIVERED | READ
    PRIMARY KEY (conversation_id, created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC);

-- Para cargar últimos 50 msgs de una conversación:
-- SELECT * FROM messages WHERE conversation_id = ? LIMIT 50
-- → O(1) porque está en la misma partición
```

### Por qué Cassandra y no PostgreSQL

```
Chat tiene un patrón de acceso muy específico:
- Siempre lees mensajes de UNA conversación (sin JOINs)
- Writes extremadamente frecuentes (23K/seg)
- Los datos son inmutables (los msgs no se editan, solo se añade status)
- Necesitas escalar horizontalmente sin sharding manual

Cassandra resuelve todo esto nativamente:
- Partición por conversation_id → todos los msgs juntos en disco
- Escala horizontal simple (añadir nodos)
- Alta write throughput
- Tunable consistency (QUORUM para writes importantes)
```

---

## Ejemplo: Diseñar un sistema de pagos

### Por qué es especial

Los sistemas de pagos tienen requisitos únicos:
- **Idempotencia**: el mismo pago no puede procesarse dos veces
- **Atomicidad**: débito y crédito ocurren juntos o ninguno
- **Auditabilidad**: todo debe ser trazable y reversible

### Requerimientos
```
Funcionales:
- Procesar pagos entre usuarios (débito de origen, crédito a destino)
- Soportar múltiples métodos: tarjeta, wallet, transferencia
- Historial de transacciones
- Reembolsos

No funcionales:
- 1M transacciones/día = ~12 TPS en promedio, picos de 100 TPS
- Consistency FUERTE (nada de eventual consistency aquí)
- 99.999% availability (5 nines)
- Idempotencia garantizada
```

### Patrón Idempotency Key

```
El cliente genera un idempotency_key único (UUID) antes de enviar.
Si el request falla o hay timeout, puede reenviar el MISMO key.
El servidor detecta el key duplicado y devuelve el resultado anterior
sin procesar el pago de nuevo.

Request:
  POST /payments
  Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
  {
    "from": "user_a",
    "to": "user_b",
    "amount": 100.00,
    "currency": "USD"
  }
```

```csharp
public class PaymentService
{
    private readonly AppDbContext _db;
    private readonly IDistributedCache _redis;

    public async Task<PaymentResult> ProcessPaymentAsync(
        PaymentRequest request,
        string idempotencyKey)
    {
        // 1. Verificar idempotencia: ¿ya procesamos este key?
        var existingResult = await _redis.GetStringAsync($"idempotency:{idempotencyKey}");
        if (existingResult is not null)
            return JsonSerializer.Deserialize<PaymentResult>(existingResult)!;

        // 2. Adquirir lock distribuido para este idempotency key
        //    (evitar race condition si dos requests llegan simultáneamente)
        var lockKey = $"lock:payment:{idempotencyKey}";
        var lockAcquired = await TryAcquireLockAsync(lockKey);
        if (!lockAcquired) throw new ConcurrentPaymentException();

        try
        {
            // 3. Doble verificación después del lock
            existingResult = await _redis.GetStringAsync($"idempotency:{idempotencyKey}");
            if (existingResult is not null)
                return JsonSerializer.Deserialize<PaymentResult>(existingResult)!;

            // 4. Ejecutar la transacción ACID en la DB
            using var transaction = await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable); // El más estricto, evita phantom reads

            var from = await _db.Accounts
                .Where(a => a.UserId == request.FromUserId)
                .FirstOrDefaultAsync()
                ?? throw new AccountNotFoundException();

            if (from.Balance < request.Amount)
                throw new InsufficientFundsException();

            from.Balance -= request.Amount;

            var to = await _db.Accounts
                .Where(a => a.UserId == request.ToUserId)
                .FirstOrDefaultAsync()
                ?? throw new AccountNotFoundException();

            to.Balance += request.Amount;

            // 5. Registrar en el ledger (inmutable)
            _db.Transactions.Add(new Transaction
            {
                Id              = Guid.NewGuid(),
                IdempotencyKey  = idempotencyKey,
                FromAccountId   = from.Id,
                ToAccountId     = to.Id,
                Amount          = request.Amount,
                Currency        = request.Currency,
                Status          = "COMPLETED",
                CreatedAt       = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            var result = new PaymentResult { Success = true, TransactionId = Guid.NewGuid() };

            // 6. Guardar resultado en caché de idempotencia (TTL 24h)
            await _redis.SetStringAsync(
                $"idempotency:{idempotencyKey}",
                JsonSerializer.Serialize(result),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
                });

            return result;
        }
        finally
        {
            await ReleaseLockAsync(lockKey);
        }
    }
}
```

### Double-Entry Ledger (Libro mayor de doble entrada)

```
Principio contable fundamental: cada transacción tiene DÉBITO y CRÉDITO.
Los saldos nunca se borran, solo se añaden entradas.

Tabla transactions (append-only, nunca UPDATE ni DELETE):
┌──────────────┬───────────────┬──────────────┬──────────┬───────┐
│ tx_id        │ account_id    │ amount       │ type     │ ref   │
├──────────────┼───────────────┼──────────────┼──────────┼───────┤
│ tx001        │ account_A     │  -100.00     │ DEBIT    │ pay01 │
│ tx002        │ account_B     │  +100.00     │ CREDIT   │ pay01 │
│ tx003        │ account_A     │  +100.00     │ CREDIT   │ ref01 │ ← reembolso
│ tx004        │ account_B     │  -100.00     │ DEBIT    │ ref01 │
└──────────────┴───────────────┴──────────────┴──────────┴───────┘

Balance de account_A = SUM(amount) = -100 + 100 = 0
Balance de account_B = SUM(amount) = +100 - 100 = 0

Ventaja: Auditoría completa. Cualquier discrepancia es detectable.
         El saldo siempre se puede recalcular desde cero.
```

### Manejo de fallos con Saga Pattern

```
Problema: un pago puede involucrar múltiples servicios (bank, fraud-check, ledger).
Las transacciones distribuidas con 2PC son lentas y frágiles.

SAGA PATTERN: secuencia de transacciones locales + compensaciones.

Pago exitoso:
  1. ReservarFondos(from) → OK
  2. FraudCheck() → OK
  3. TransferirFondos(from, to) → OK
  4. NotificarUsuarios() → OK

Pago fallido en paso 3:
  3. TransferirFondos → FALLA
  ← LiberarFondos(from) [compensación de paso 1]

Cada paso tiene una transacción de compensación para deshacer su efecto.
```

---

## Ejemplo: Diseñar un sistema de búsqueda (tipo Elasticsearch)

### Concepto clave: Índice Invertido

```
ÍNDICE NORMAL (tabla → fila):
  doc_id 1: "el gato come pescado"
  doc_id 2: "el perro come carne"
  doc_id 3: "el gato duerme"

ÍNDICE INVERTIDO (palabra → documentos que la contienen):
  "el"      → [1, 2, 3]
  "gato"    → [1, 3]
  "come"    → [1, 2]
  "pescado" → [1]
  "perro"   → [2]
  "carne"   → [2]
  "duerme"  → [3]

Buscar "gato come" → intersección de [1,3] y [1,2] = [1]
Resultado: doc_id 1, en O(1) sin escanear todos los documentos.
```

### Arquitectura de ingesta

```
Datos fuente
    │
    ↓
┌───────────────┐
│  Indexer      │  ← Tokenización, stemming, stop words
│  Service      │     "gatos" → "gat" (stem)
│               │     "el, la, los" → ignorar (stop words)
└───────┬───────┘
        │
        ↓
┌───────────────┐     ┌──────────────────────┐
│  Kafka        │────→│  Index Shards        │
│  (buffer de   │     │  (Lucene segments)   │
│   ingesta)    │     │  Shard por rango     │
└───────────────┘     │  de doc_ids          │
                      └──────────────────────┘
```

### Arquitectura de consulta

```
Query: "gato AND come NOT perro"
    │
    ↓
┌───────────────────┐
│  Query Parser     │  ← Parsea sintaxis, expande sinónimos
└──────────┬────────┘
           │
           ↓ (broadcast a todos los shards en paralelo)
┌──────────┬──────────┬──────────┐
│ Shard 1  │ Shard 2  │ Shard 3  │  ← Cada shard evalúa la query
│ results  │ results  │ results  │     y calcula relevancia (TF-IDF)
└──────────┴──────────┴──────────┘
           │
           ↓
┌───────────────────┐
│  Result Merger    │  ← Merge de resultados, ranking global
│  & Ranker         │
└──────────┬────────┘
           │
           ↓
        Top-K resultados al cliente
```

### TF-IDF (Relevancia básica)

```
TF (Term Frequency): cuántas veces aparece el término en el doc
  TF("gato", doc1) = 2/10 = 0.2 (2 ocurrencias en 10 palabras)

IDF (Inverse Document Frequency): cuán raro es el término en el corpus
  IDF("gato") = log(N_docs / N_docs_con_gato) = log(1M / 50K) = 3.0

  Palabras raras tienen IDF alto → más discriminativas
  Palabras comunes ("el", "de") tienen IDF bajo → menos relevantes

TF-IDF = TF × IDF
  → Docs que usan el término frecuentemente Y el término es raro = alta relevancia
```

---

## Checklist de System Design para entrevistas

Antes de empezar a diseñar, preguntar siempre:

```
ESCALA:
□ ¿Cuántos usuarios (DAU/MAU)?
□ ¿Cuántas requests por segundo (peak/promedio)?
□ ¿Cuánto storage necesitamos?

CONSISTENCIA:
□ ¿Necesitamos consistencia fuerte o eventual es aceptable?
□ ¿Qué pasa si perdemos un dato? ¿Cuánto durability necesitamos?

DISPONIBILIDAD:
□ ¿Cuánto downtime es aceptable? (99.9% = 8.7h/año, 99.99% = 52min/año)
□ ¿Necesitamos multi-región?

LATENCIA:
□ ¿Cuál es la latencia máxima aceptable (p99)?
□ ¿Es lectura o escritura el path crítico?
```

### Los 6 trade-offs que siempre aparecen

| Trade-off | Opción A | Opción B |
|-----------|----------|----------|
| **Consistencia vs Disponibilidad** | CP (SQL) | AP (Cassandra) |
| **Latencia vs Consistencia** | Caché (rápido, puede ser stale) | DB directa (lento, siempre fresco) |
| **Normalización vs Denormalización** | Sin redundancia, JOINs | Redundancia, lecturas rápidas |
| **Push vs Pull (fanout)** | Write costoso, read barato | Write barato, read costoso |
| **Sharding vs Replicación** | Escala writes | Escala reads |
| **SQL vs NoSQL** | ACID, JOINs, schema fijo | Escala horizontal, schema flexible |
