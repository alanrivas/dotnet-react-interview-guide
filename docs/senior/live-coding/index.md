---
id: live-coding
title: "💻 Live Coding — Senior"
sidebar_position: 100
---

# 💻 Live Coding — Senior

Ejercicios para posiciones Senior. Se espera diseño robusto, conocimiento de patrones de distribución, manejo de concurrencia y capacidad de razonar sobre sistemas a escala.

:::tip Consejo
En este nivel, el entrevistador espera que **anticipes los problemas** antes de que se los menciones. Habla de thread-safety, scalabilidad, observabilidad y mantenibilidad sin esperar que te pregunten.
:::

---

## Metodología de Approach para Live Coding

Antes de escribir una sola línea de código, sigue este framework. El entrevistador evalúa **cómo piensas**, no solo si llegas a la solución.

### Framework UREQ-CA

| Paso | Qué hacer | Tiempo |
|---|---|---|
| **U**nderstand | Leer el problema 2 veces. Reformular en tus palabras. | 1-2 min |
| **R**equirements | Preguntar sobre casos no especificados | 2-3 min |
| **E**dge Cases | Listar inputs extremos antes de codear | 1-2 min |
| **Q**uerys (API) | Definir la firma de la función/clase | 1 min |
| **C**ode | Implementar la solución básica primero | 15-20 min |
| **A**nalyze | Complejidad, mejoras, variantes | 3-5 min |

### Preguntas de Clarificación a Hacer Siempre

```text
¿Cuál es el rango de valores de entrada? (¿puede ser negativo, nulo, vacío?)
¿Cuántos elementos esperamos? (¿cabe en memoria? ¿necesito streaming?)
¿Es single-threaded o multi-threaded? (¿necesito thread-safety?)
¿Optimizamos para lecturas o escrituras?
¿Hay restricciones de memoria?
```

### Cómo Hablar Mientras Codeas

En entrevistas senior el silencio es tu enemigo. Usa este patrón:

- **Antes de escribir**: "Voy a usar un `Dictionary` para O(1) lookup y una `LinkedList` para mantener el orden. Podría también usar un array pero penaliza las inserciones…"
- **Mientras escribes**: "Aquí el `lock` es necesario porque si dos hilos llegan simultáneamente al check, ambos podrían pasar la condición…"
- **Al terminar**: "Esta solución es O(n) tiempo y O(n) espacio. Podría optimizarse a O(log n) con un heap si el caso de uso lo requiere…"

### Cuando No Sabes la Respuesta

```text
"No conozco la API exacta de memoria, pero lo implementaría de esta forma general…"
"No recuerdo si Task.WhenAll propaga CancellationToken, déjame asumir que sí y lo verifico."
"Conozco el concepto pero no la implementación en C# específicamente.
 En Python lo haría con X. En C# sería análogo usando Y…"
```

**Lo que nunca debes hacer**: decir "No sé" y quedarte en silencio. Siempre muestra tu razonamiento incluso con información incompleta.

### Trade-offs que Siempre Debes Mencionar Proactivamente

```
Consistency vs Availability    → ¿qué pasa si esto falla a mitad?
Latencia vs Throughput         → ¿optimizamos p99 o requests/s?
Simplicidad vs Escalabilidad   → ¿cuándo esto deja de funcionar?
Memory vs CPU                  → ¿cuál es el cuello de botella?
```

---

## Whiteboarding y Capacity Estimation

Para ejercicios de diseño de sistemas en pizarra, usa estas herramientas base.

### Template de 8 Pasos

```
1. CLARIFY     → ¿Qué features incluimos? ¿Cuántos usuarios? ¿Geo distribuido?
2. ESTIMATE    → Tráfico (QPS), storage, ancho de banda
3. API DESIGN  → Endpoints y contratos
4. DATA MODEL  → Entidades, relaciones, índices clave
5. HIGH LEVEL  → Diagrama de componentes
6. DEEP DIVE   → El componente más crítico o el que el entrevistador elige
7. SCALE       → ¿Qué falla primero? ¿Cómo lo escalamos?
8. TRADE-OFFS  → ¿Qué sacrificamos? (Consistency vs Availability, etc.)
```

### Fórmulas de Estimación Rápida

```
DAU (usuarios activos diarios) = MAU × 0.3  (30% de mensuales son diarios)
QPS                            = DAU × acciones_por_día / 86,400
Peak QPS                       = QPS × 2–3x (factor de pico)
Storage/año                    = DAU × tamaño_objeto × acciones/día × 365

Tamaños típicos:
  Tweet / mensaje corto  ≈  300 bytes
  Foto comprimida        ≈  300 KB
  Video 1 min (360p)     ≈  50 MB
  Metadata de usuario    ≈  1 KB

Conversiones útiles:
  1 día   = 86,400 s  (≈ 10^5)
  1 TB    = 10^12 bytes
  1 PB    = 10^15 bytes
```

### Ejemplo: URL Shortener en 5 minutos

```
CLARIFY
  - 100M URLs acortados por día
  - Ratio lectura:escritura = 100:1
  - URLs viven 5 años

ESTIMATE
  - Writes: 100M / 86400 ≈ 1,160 QPS  → Peak ~3,500 QPS
  - Reads:  10B  / 86400 ≈ 115,740 QPS → Peak ~350,000 QPS
  - Storage: 100M × 365 × 5 × 500B = ~90 TB en 5 años
  - Bandwidth write: 3,500 × 500B = 1.75 MB/s
  - Bandwidth read:  350,000 × 500B = 175 MB/s

KEY DECISIONS
  - Short code: Base62, 7 chars = 62^7 ≈ 3.5 trillones de combinaciones
  - Generación: hash(URL)[0:7] con retry en colisión, o ID auto-incremental en Base62
  - 350K QPS en lectura → cache agresivo (20% de URLs = 80% del tráfico → hit rate ~99%)

ARQUITECTURA
  ┌──────────┐  write   ┌─────────────┐    ┌──────────────┐
  │  Client  │─────────►│  API Server │───►│   DB (SQL)   │
  │          │  redirect│             │    │ shortId→url  │
  │          │◄─────────│  + Redis    │◄───│              │
  └──────────┘          └──────┬──────┘    └──────────────┘
                               │
                          ┌────▼────┐
                          │   CDN   │ ← absorbe 80%+ del tráfico read
                          └─────────┘

TRADE-OFFS
  - NoSQL vs SQL: NoSQL (DynamoDB) para sharding fácil. No necesitamos
    transacciones aquí → vale la pena el scale horizontal.
  - Eventual consistency en cache: si Redis devuelve URL desactualizada,
    el redirect es incorrecto. Aceptable porque los URLs no cambian.
```

---

## Ejercicios Clásicos Senior

### LRU Cache — O(1) get y put

**Enunciado:** Implementar una caché LRU con capacidad fija. `get(key)` retorna el valor o -1. `put(key, value)` inserta; si supera capacidad, desaloja el menos recientemente usado.

```csharp
// Solución: Dictionary + LinkedList doblemente enlazada
// Dictionary → O(1) lookup
// LinkedList → O(1) move-to-front y remove-last

public class LRUCache
{
    private readonly int _capacity;
    private readonly Dictionary<int, LinkedListNode<(int key, int value)>> _map;
    private readonly LinkedList<(int key, int value)> _list;

    public LRUCache(int capacity)
    {
        _capacity = capacity;
        _map = new Dictionary<int, LinkedListNode<(int, int)>>(capacity);
        _list = new LinkedList<(int, int)>();
    }

    public int Get(int key)
    {
        if (!_map.TryGetValue(key, out var node)) return -1;
        // Mover al frente (más recientemente usado)
        _list.Remove(node);
        _list.AddFirst(node);
        return node.Value.value;
    }

    public void Put(int key, int value)
    {
        if (_map.TryGetValue(key, out var existing))
        {
            _list.Remove(existing);
            _map.Remove(key);
        }
        else if (_map.Count >= _capacity)
        {
            // Desalojar el menos recientemente usado (último)
            var lru = _list.Last!;
            _list.RemoveLast();
            _map.Remove(lru.Value.key);
        }

        var node = new LinkedListNode<(int, int)>((key, value));
        _list.AddFirst(node);
        _map[key] = node;
    }
}

// Complejidad: Get O(1), Put O(1), Space O(n)
```

**Puntos de discusión:**
- Thread-safety: añadir `lock (_syncRoot)` o usar `ConcurrentDictionary` + `ReaderWriterLockSlim`
- Variante: LFU Cache (Least Frequently Used) — más complejo, requiere contadores de frecuencia
- En producción: Redis ya implementa LRU; esta implementación es para caches en proceso

---

### Rate Limiter — Token Bucket

**Enunciado:** Implementar un rate limiter que permita hasta N requests por segundo. Thread-safe.

```csharp
public class TokenBucketRateLimiter
{
    private readonly int _maxTokens;
    private readonly double _refillRatePerSecond;
    private double _tokens;
    private DateTime _lastRefill;
    private readonly object _lock = new();

    public TokenBucketRateLimiter(int maxTokens, double refillRatePerSecond)
    {
        _maxTokens = maxTokens;
        _refillRatePerSecond = refillRatePerSecond;
        _tokens = maxTokens;
        _lastRefill = DateTime.UtcNow;
    }

    public bool TryConsume(int tokens = 1)
    {
        lock (_lock)
        {
            Refill();
            if (_tokens < tokens) return false;
            _tokens -= tokens;
            return true;
        }
    }

    private void Refill()
    {
        var now = DateTime.UtcNow;
        var elapsed = (now - _lastRefill).TotalSeconds;
        _tokens = Math.Min(_maxTokens, _tokens + elapsed * _refillRatePerSecond);
        _lastRefill = now;
    }
}

// Uso en middleware ASP.NET Core
public class RateLimitMiddleware
{
    private static readonly ConcurrentDictionary<string, TokenBucketRateLimiter>
        _limiters = new();

    public async Task InvokeAsync(HttpContext ctx, RequestDelegate next)
    {
        var key = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        var limiter = _limiters.GetOrAdd(key,
            _ => new TokenBucketRateLimiter(maxTokens: 100, refillRatePerSecond: 10));

        if (!limiter.TryConsume())
        {
            ctx.Response.StatusCode = 429; // Too Many Requests
            await ctx.Response.WriteAsync("Rate limit exceeded");
            return;
        }

        await next(ctx);
    }
}

// En producción: usar ASP.NET Core Rate Limiting (System.Threading.RateLimiting)
// o Redis con sliding window para distribuido
```

**Trade-offs a mencionar:**
- Token Bucket vs Sliding Window vs Fixed Window: TB permite bursts, SW es más justo, FW es más simple
- Distribuido: Redis con `INCRBY` + `EXPIRE` o Lua scripts para atomicidad
- Sliding Window distribuida: `ZADD` (sorted set) + `ZREMRANGEBYSCORE`

---

### Productor-Consumidor con Channel

**Enunciado:** Implementar un sistema donde múltiples productores escriben y múltiples consumidores leen, de forma thread-safe y eficiente.

```csharp
// System.Threading.Channels — la forma moderna en .NET
public class PipelineProcessor
{
    private readonly Channel<string> _channel;
    private readonly int _consumerCount;

    public PipelineProcessor(int capacity = 1000, int consumerCount = 4)
    {
        _channel = Channel.CreateBounded<string>(new BoundedChannelOptions(capacity)
        {
            FullMode = BoundedChannelFullMode.Wait, // Backpressure: el productor espera
            SingleWriter = false,
            SingleReader = false
        });
        _consumerCount = consumerCount;
    }

    public async Task ProduceAsync(IEnumerable<string> items, CancellationToken ct)
    {
        foreach (var item in items)
        {
            await _channel.Writer.WriteAsync(item, ct);
        }
        _channel.Writer.Complete();
    }

    public async Task StartConsumersAsync(CancellationToken ct)
    {
        var tasks = Enumerable.Range(0, _consumerCount)
            .Select(id => ConsumeAsync(id, ct));
        await Task.WhenAll(tasks);
    }

    private async Task ConsumeAsync(int consumerId, CancellationToken ct)
    {
        await foreach (var item in _channel.Reader.ReadAllAsync(ct))
        {
            await ProcessAsync(consumerId, item);
        }
    }

    private async Task ProcessAsync(int consumerId, string item)
    {
        // Simular trabajo
        await Task.Delay(10);
        Console.WriteLine($"[Consumer {consumerId}] Procesado: {item}");
    }
}
```

---

## Checklist de Code Review para Live Coding

Cuando el entrevistador te pida revisar código ajeno, evalúa en este orden:

```
1. CORRECTITUD
   □ ¿El algoritmo produce el resultado esperado?
   □ ¿Maneja todos los edge cases? (null, vacío, un elemento, INT_MAX)
   □ ¿Hay off-by-one errors?

2. COMPLEJIDAD
   □ ¿Cuál es la complejidad temporal y espacial?
   □ ¿Hay operaciones O(n²) que podrían ser O(n log n)?
   □ ¿Hay alocaciones innecesarias en el hot path?

3. CONCURRENCIA
   □ ¿Hay acceso a estado compartido sin sincronización?
   □ ¿Puede haber deadlock? (locks en orden diferente)
   □ ¿Los campos son volátiles si se acceden desde múltiples threads?

4. ERRORES Y RECURSOS
   □ ¿Los IDisposable se liberan? (using statement)
   □ ¿Las excepciones se manejan o propagan correctamente?
   □ ¿Hay swallow de excepciones (catch sin rethrow)?

5. DISEÑO
   □ ¿Las responsabilidades están bien separadas?
   □ ¿Los nombres comunican la intención?
   □ ¿Hay código duplicado que podría extraerse?
```

---

## Subtemas de Live Coding

- [Base de Datos](live-coding/base-de-datos) — Queries complejas, optimización, índices
- [Resiliencia](live-coding/resiliencia) — Circuit breaker, retry, timeout, bulkhead
- [Patrones](live-coding/patrones) — Diseño de sistemas, patrones de concurrencia
- [Frontend](live-coding/frontend) — React hooks avanzados, optimización, arquitectura

---

