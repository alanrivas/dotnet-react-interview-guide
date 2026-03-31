---
id: system-design-patterns-advanced
title: System Design Patterns Avanzados
sidebar_position: 13
---

# System Design Patterns Avanzados 🔴

## Consistency Models

### Eventual Consistency vs Strong Consistency

```
Strong Consistency (ACID):
┌─────────┐
│  Write  │ ──→ Actualiza registros → ✓ Visible inmediatamente
└─────────┘
✅ Garantizado: "Pregunto después, obtengo nuevo valor"
❌ Costo: Latencia (esperar sincronización), lower throughput

Eventual Consistency (BASE):
┌─────────┐
│  Write  │ ──→ Encolá evento → Visible en milisegundos-segundos
└─────────┘     Múltiples replicas se sincronizan async
✅ Beneficio: Alta disponibilidad, bajo latency, high throughput
❌ Riesgo: "Pregunto antes de sincronizar, obtengo valor viejo"
```

### Patrón CQRS (Command Query Responsibility Segregation)

```csharp
// ✅ Separar modelo de escritura (Command) y lectura (Query)
// Problema: Una BD no puede ser simultáneamente rápida para writes y reads denormalizadas

// Modelo de escritura: Normalizado, ACID
public class PedidoAggregate
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public List<ItemPedido> Items { get; set; }
    public decimal Total { get; set; }
    
    // Eventos de dominio
    public void CrearPedido(CreatePedidoCommand cmd)
    {
        // Validaciones estrictas
        if (Items.Count == 0) throw new InvalidOperationException("Pedido vacío");
        
        // Event sourcing
        DomainEvents.Add(new PedidoCreado { PedidoId = this.Id, ... });
    }
}

// Modelo de lectura: Denormalizado, optimizado para queries
public class PedidoReadModel
{
    public int Id { get; set; }
    public string UsuarioNombre { get; set; }
    public string UsuarioEmail { get; set; }
    public List<string> ProductosNombres { get; set; }
    public decimal Total { get; set; }
    public DateTime FechaCreacion { get; set; }
}

// Cuando ocurre evento, actualizar read model async
public class PedidoCreadoEventHandler
{
    private readonly PedidoReadModelDb _readDb;

    public async Task Handle(PedidoCreado evento)
    {
        // Obtener datos completos del write model
        var pedido = await _writeDb.ObtenerPedidoAsync(evento.PedidoId);
        var usuario = await _usuarioService.ObtenerAsync(pedido.UsuarioId);
        var productos = await _productoDb.ObtenerPorIdsAsync(pedido.Items.Select(i => i.ProductoId));

        // Crear read model denormalizado
        var readModel = new PedidoReadModel
        {
            Id = pedido.Id,
            UsuarioNombre = usuario.Nombre,
            UsuarioEmail = usuario.Email,
            ProductosNombres = productos.Select(p => p.Nombre).ToList(),
            Total = pedido.Total,
            FechaCreacion = pedido.FechaCreacion
        };

        await _readDb.GuardarAsync(readModel);
    }
}

// Query (escala horizontalmente, sin contención)
[HttpGet("mis-pedidos")]
public async Task<List<PedidoReadModel>> MisPedidos(int usuarioId)
{
    // Lectura desde read model — muy rápida, sin locks
    return await _readDb.ObtenerPorUsuarioAsync(usuarioId);
}

// ✅ Beneficios:
// - Writes optimizados para transacciones
// - Reads optimizados para reporting (denormalizados, con índices específicos)
// - Escalabilidad independiente (podrías tener múltiples read DBs)

// ❌ Complejidad:
// - Sincronización eventual entre write y read models
// - Si read model falla, debes poder regenerarla desde eventos
```

### Event Sourcing

```csharp
// ✅ En lugar de guardar estado, guardar todos los eventos que lo generaron
// Evento = "fuente de verdad"

// Tabla de eventos (event store)
public class Event
{
    public int Id { get; set; }
    public Guid AggregateId { get; set; }  // Pedido ID, Usuario ID, etc
    public string EventType { get; set; }  // "PedidoCreado", "ItemAgregado"
    public string EventData { get; set; }  // JSON del evento
    public int Version { get; set; }       // Versión del agregado
    public DateTime Timestamp { get; set; }
}

// Reconstruir estado reproduciendo eventos
public async Task<PedidoAggregate> ReconstructAsync(int pedidoId)
{
    var eventos = await _eventStore.ObtenerPorAggregateAsync(pedidoId);
    
    var pedido = new PedidoAggregate();  // Estado inicial vacío
    
    foreach (var evento in eventos.OrderBy(e => e.Version))
    {
        switch (evento.EventType)
        {
            case nameof(PedidoCreado):
                var pedidoCreado = JsonSerializer.Deserialize<PedidoCreado>(evento.EventData);
                pedido.Id = pedidoCreado.PedidoId;
                pedido.UsuarioId = pedidoCreado.UsuarioId;
                pedido.Total = pedidoCreado.Total;
                break;

            case nameof(ItemAgregado):
                var itemAgregado = JsonSerializer.Deserialize<ItemAgregado>(evento.EventData);
                pedido.Items.Add(new ItemPedido { ProductoId = itemAgregado.ProductoId, ... });
                break;

            case nameof(PedidoConfirmado):
                pedido.Estado = EstadoPedido.Confirmado;
                break;
        }
    }

    return pedido;
}

// ✅ Beneficios:
// - Auditoría completa: Cada cambio está registrado
// - Debugging: Reproducir exactamente qué pasó
// - Temporal queries: "¿Cuál era el estado hace 1 hora?"
// - Event replay: Regenerar read models

// ❌ Desafíos:
// - Event store puede crecer enormemente
// - Refactorings de eventos complejos (upcasting)
// - Eventual consistency
```

---

## Circuit Breaker en Cascada

```csharp
// ❌ PROBLEMA: Sin circuit breaker, fallo en un servicio causa cascada
// Servicio A → Servicio B → Servicio C

// Si C cae, B sigue reinten... reintentan... A se bloquea esperando B
// Todo colapsa

// ✅ SOLUCIÓN: Circuit Breaker pattern
public interface ICircuitBreaker<T>
{
    Task<T> ExecuteAsync(Func<Task<T>> operation);
}

public class CircuitBreaker<T> : ICircuitBreaker<T>
{
    private CircuitState _state = CircuitState.Closed;
    private int _failureCount = 0;
    private DateTime _lastFailureTime;
    private readonly int _threshold = 5;
    private readonly TimeSpan _timeout = TimeSpan.FromSeconds(60);

    public async Task<T> ExecuteAsync(Func<Task<T>> operation)
    {
        if (_state == CircuitState.Open)
        {
            if (DateTime.UtcNow - _lastFailureTime > _timeout)
            {
                _state = CircuitState.HalfOpen;
            }
            else
            {
                throw new CircuitBreakerOpenException("Circuit breaker is open");
            }
        }

        try
        {
            var result = await operation();
            OnSuccess();
            return result;
        }
        catch (Exception ex)
        {
            OnFailure();
            throw;
        }
    }

    private void OnSuccess()
    {
        _failureCount = 0;
        _state = CircuitState.Closed;
    }

    private void OnFailure()
    {
        _failureCount++;
        _lastFailureTime = DateTime.UtcNow;

        if (_failureCount >= _threshold)
        {
            _state = CircuitState.Open;
            _logger.LogWarning("Circuit breaker opened after {FailureCount} failures", _failureCount);
        }
    }
}

// Uso con Polly (librería .NET estándar)
var policy = Policy<HttpResponseMessage>
    .Handle<HttpRequestException>()
    .OrResult(r => r.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable)
    .CircuitBreakerAsync(
        handledEventsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(30),
        onBreak: (outcome, duration) =>
        {
            _logger.LogWarning("Circuit breaker opened for {Duration}", duration.TotalSeconds);
        }
    );

var response = await policy.ExecuteAsync(() =>
    _httpClient.GetAsync("https://external-service/api"));
```

---

## Load Balancing Strategies

```
Round Robin:
Request 1 → Server A
Request 2 → Server B
Request 3 → Server C
Request 4 → Server A
✅ Simple, fair distribution
❌ No considera load actual, session affinity

Least Connections:
Monitor conexiones activas, enviar a server con menos
✅ Mejor para conexiones de larga duración
❌ Más overhead de monitoreo

Weighted Round Robin:
Server A (4 CPUs)    → 40% tráfico
Server B (2 CPUs)    → 20% tráfico
Server C (2 CPUs)    → 20% tráfico (reserved)
✅ Considera capacidad del servidor
❌ Requiere configuración manual

Consistent Hashing:
Hash(userId) % num_servers → siempre el mismo server
✅ Session affinity, cache local
❌ Si un server cae, redistribuir a siguiente en el anillo

IP Hash:
Hash(client_ip) % servers → siempre el mismo server (para sticky sessions)
✅ Preserva session
❌ Si un cliente tiene múltiples IPs (proxies), inconsistencia
```

---

## Batch vs Stream Processing

```
Batch Processing:
Collect 1000 events → Process all at once → Save to DB
✅ Eficiente para procesamiento (menos overhead)
✅ Fácil de debuggear — procesaste exactamente esto
❌ Latencia: esperas acumular el batch
❌ Si batch falla, reimplementar es complejo

Stream Processing:
Process event 1 → Process event 2 → Process event 3
✅ Latencia baja, procesamiento continuo
✅ Más resiliente (procesa algo siempre, aunque falle parte)
❌ Overhead por evento
❌ State management complejo (ventanas de tiempo, etc)

Micro-batching:
Process eventos cada 100ms o 50 eventos (lo que llegue primero)
✅ Equilibrio: latencia razonable + eficiencia
✅ Usado por Spark, Dataflow
```

---

## Sharding (Partitioning)

```csharp
// ✅ Dividir datos en múltiples DBs basado en clave de sharding
// Sin sharding: Una BD con 1B registros = lento

public interface IShardResolver
{
    int GetShard(int userId);
}

public class UserIdShardResolver : IShardResolver
{
    private readonly int _shardCount = 4;

    public int GetShard(int userId)
    {
        return userId % _shardCount;  // Usuario ID 1001 → Shard 1
    }
}

public class PedidoRepository
{
    private readonly List<AppDbContext> _shards;
    private readonly IShardResolver _shardResolver;

    public async Task<Pedido> ObtenerAsync(int pedidoId, int usuarioId)
    {
        var shardIndex = _shardResolver.GetShard(usuarioId);
        var db = _shards[shardIndex];
        
        return await db.Pedidos.FirstOrDefaultAsync(p => p.Id == pedidoId);
    }
}

// ✅ Beneficios:
// - Cada shard es más pequeño → queries rápidas
// - Escalabilidad horizontal: agregar shards

// ❌ Desafíos:
// - Cross-shard queries (ej: "lista pedidos de todos usuarios") problématico
// - Hot shards: Si usuario popular está en shard único, ese shard sobrecarga
// - Resharding: Si 4 shards → 8, cómo migramos datos?
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿CQRS + Event Sourcing es siempre la respuesta?**
> No. CQRS es complejo, úsalo solo si tienes separation clara entre writes complejos y reads específicas. Event Sourcing es poderoso pero agrega overhead. Empieza con CRUD simple, evoluciona a CQRS si lo necesitas.

**2. ¿Eventual Consistency — si espero 1 segundo, estoy seguro?**
> En teoría sí, pero depende de tu sistema. Si usas Redis + escribes a múltiples replicas, talvez 100ms. Si es async entre servicios, puede ser segundos. Mide en tu infraestructura.

**3. ¿Cómo debuggeo CQRS si el read model está desincronizado?**
> 1. Verificar si hay eventos pendientes en la queue. 2. Reproducir eventos desde el event store. 3. Loguea cada actualización de read model. 4. Almacenar timestamp de última sincronización por agregado.

**4. ¿Circuit Breaker vs Retry?**
> Não tienen conflicto. Usa ambos: Retries para transitorios (timeout 100ms), Circuit Breaker para detectar que el servicio está caído (5 fallos en 30 seg). Retry sin Circuit Breaker = DDoS a servicio herido.

**5. ¿Cuándo aplicar sharding?**
> Cuando una tabla es muy grande (>500M registros) o crece rápidamente. Si la BD entra en memoria, no necesitas. Sharding causa complejidad operacional — evítalo mientras puedas.

**6. ¿Qué pasa con JOINs en una arquitectura sharded?**
> Difícil. Si necesitas JOIN entre dos tablas en shards diferentes, tiene que hacer el application-side. Mejor: desnormalizar datos en el read model. Ej: guardar usuario_nombre en pedido directamente.

**7. ¿Batch vs Stream para analytics?**
> **Batch**: Data warehouse, reportes históricos (noche anterior). **Stream**: Real-time dashboards, alertas (dentro de segundos). Mejor: ambos. Batch para histórico optimizado, stream para real-time.

**8. ¿Event Sourcing y GDPR (derecho al olvido)?**
> Conflicto. GDPR requiere borrar datos, Event Sourcing requiere guardarlos para auditoria. Soluciones: 1. Usar soft-delete (marcar como borrado) 2. Snapshots sin datos personales 3. Encriptar PII separadamente.