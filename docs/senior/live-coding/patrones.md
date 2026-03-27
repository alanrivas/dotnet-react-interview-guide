---
title: "🏗️ Patrones de Diseño"
sidebar_position: 2
---

# 🏗️ Patrones de Diseño

Implementaciones de patrones estructurales y de comportamiento frecuentes en entrevistas senior.

| Ejercicio | Dificultad | Tiempo |
|---|---|---|
| Event Bus en Memoria | 🟡 Media | 20 min |
| Middleware Pipeline | 🟡 Media | 20 min |
| CQRS con MediatR | 🔴 Difícil | 30 min |
| LRU Cache | 🔴 Difícil | 25 min |

---

## Ejercicio 2: Event Bus en Memoria

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: generics, delegates, patrones pub/sub, weak references

### Enunciado

Implementa un **event bus en memoria** genérico que soporte:
- `Publish<TEvent>(evento)`: notifica a todos los suscriptores del tipo de evento
- `Subscribe<TEvent>(handler)`: registra un manejador, retorna un token para desuscribirse
- `Unsubscribe(token)`: elimina el manejador
- Múltiples suscriptores por tipo de evento
- Thread-safe

**Ejemplo de uso:**
```csharp
bus.Subscribe<PedidoCreado>(e => Console.WriteLine($"Pedido {e.Id} creado"));
bus.Subscribe<PedidoCreado>(e => enviarEmail(e));
bus.Publish(new PedidoCreado { Id = 123 });
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `Dictionary<Type, List<Delegate>>` para mapear tipos de evento a sus handlers. La clave del diccionario es `typeof(TEvent)`.

</details>

<details>
<summary>Ver pista 2</summary>

Para el token de desuscripción, puedes retornar un `Guid` o un objeto `IDisposable` que al hacer `Dispose()` elimine el handler automáticamente.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading.Tasks;

// Token de suscripción — permite desuscribirse via IDisposable
public class SuscripcionToken : IDisposable
{
    private readonly Action _onDispose;
    private bool _disposed = false;

    public Guid Id { get; } = Guid.NewGuid();

    internal SuscripcionToken(Action onDispose) => _onDispose = onDispose;

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _onDispose();
    }
}

public interface IEventBus
{
    SuscripcionToken Subscribe<TEvent>(Action<TEvent> handler);
    SuscripcionToken SubscribeAsync<TEvent>(Func<TEvent, Task> handler);
    void Publish<TEvent>(TEvent evento);
    Task PublishAsync<TEvent>(TEvent evento);
}

public class EventBus : IEventBus
{
    // Diccionario: tipo de evento → lista de (id, handler)
    private readonly ConcurrentDictionary<Type, List<(Guid Id, Delegate Handler)>> _suscriptores
        = new ConcurrentDictionary<Type, List<(Guid, Delegate)>>();

    private readonly object _lock = new object();

    /// <summary>Registra un handler síncrono para el tipo de evento.</summary>
    public SuscripcionToken Subscribe<TEvent>(Action<TEvent> handler)
    {
        if (handler == null) throw new ArgumentNullException(nameof(handler));

        var tipo = typeof(TEvent);
        var id = Guid.NewGuid();

        lock (_lock)
        {
            var lista = _suscriptores.GetOrAdd(tipo, _ => new List<(Guid, Delegate)>());
            lista.Add((id, handler));
        }

        // Retornar token que al hacer Dispose elimina el handler
        return new SuscripcionToken(() => Unsubscribe(tipo, id));
    }

    /// <summary>Registra un handler asíncrono para el tipo de evento.</summary>
    public SuscripcionToken SubscribeAsync<TEvent>(Func<TEvent, Task> handler)
    {
        if (handler == null) throw new ArgumentNullException(nameof(handler));

        var tipo = typeof(TEvent);
        var id = Guid.NewGuid();

        lock (_lock)
        {
            var lista = _suscriptores.GetOrAdd(tipo, _ => new List<(Guid, Delegate)>());
            lista.Add((id, handler));
        }

        return new SuscripcionToken(() => Unsubscribe(tipo, id));
    }

    /// <summary>Publica un evento sincrónicamente a todos los suscriptores.</summary>
    public void Publish<TEvent>(TEvent evento)
    {
        var handlers = ObtenerHandlers(typeof(TEvent));

        foreach (var (_, handler) in handlers)
        {
            switch (handler)
            {
                case Action<TEvent> syncHandler:
                    syncHandler(evento);
                    break;
                case Func<TEvent, Task> asyncHandler:
                    // Ejecutar async handler de forma fire-and-forget (cuidado con excepciones)
                    _ = asyncHandler(evento);
                    break;
            }
        }
    }

    /// <summary>Publica un evento asíncronamente, esperando todos los handlers.</summary>
    public async Task PublishAsync<TEvent>(TEvent evento)
    {
        var handlers = ObtenerHandlers(typeof(TEvent));
        var tareas = new List<Task>();

        foreach (var (_, handler) in handlers)
        {
            switch (handler)
            {
                case Action<TEvent> syncHandler:
                    syncHandler(evento);
                    break;
                case Func<TEvent, Task> asyncHandler:
                    tareas.Add(asyncHandler(evento));
                    break;
            }
        }

        // Esperar todos los handlers asíncronos en paralelo
        await Task.WhenAll(tareas);
    }

    private void Unsubscribe(Type tipo, Guid id)
    {
        lock (_lock)
        {
            if (_suscriptores.TryGetValue(tipo, out var lista))
                lista.RemoveAll(s => s.Id == id);
        }
    }

    private List<(Guid Id, Delegate Handler)> ObtenerHandlers(Type tipo)
    {
        lock (_lock)
        {
            if (!_suscriptores.TryGetValue(tipo, out var lista))
                return new List<(Guid, Delegate)>();

            // Retornar copia para evitar problemas de concurrencia al iterar
            return new List<(Guid, Delegate)>(lista);
        }
    }
}

// ============================================================
// Uso
// ============================================================
/*
var bus = new EventBus();

// Suscribirse con IDisposable (se desuscribe automáticamente)
using var token = bus.Subscribe<PedidoCreado>(e =>
    Console.WriteLine($"Pedido {e.Id} creado por {e.ClienteNombre}")
);

bus.SubscribeAsync<PedidoCreado>(async e => {
    await emailService.EnviarConfirmacionAsync(e);
});

await bus.PublishAsync(new PedidoCreado { Id = 123, ClienteNombre = "Ana" });
// Al salir del using, el primer handler se desuscribe automáticamente
*/
```

**Complejidad**: Publish O(n) donde n = suscriptores del tipo, Subscribe/Unsubscribe O(1) amortizado

**Variantes a considerar en la entrevista:**
- ¿Cómo manejarías excepciones en un handler para que no afecten a los demás suscriptores? (try/catch por handler, log del error)
- ¿Cómo lo harías con `WeakReference` para evitar memory leaks cuando el suscriptor es un objeto UI?
- ¿Qué diferencia hay entre este EventBus y MediatR? (MediatR soporta pipeline behaviors, validación, logging cross-cutting)
- ¿Cómo escalarías esto a múltiples instancias? (Azure Service Bus, RabbitMQ, Kafka)
- ¿Cómo garantizarías que los eventos se procesen en orden para un mismo agregado?

</details>

---

## Ejercicio 3: Middleware Pipeline

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: delegates, Func, closures, ASP.NET Core internals

### Enunciado

Implementa una versión simplificada del pipeline de middlewares de ASP.NET Core con:
- `Use(middleware)`: agrega un middleware que puede llamar al siguiente con `next()`
- `Run(handler)`: agrega el middleware terminal (no llama a next)
- `Build()`: construye el pipeline y retorna el `RequestDelegate` final

Un middleware tiene la firma: `Func<HttpContext, Func<Task>, Task>`

**Ejemplo de uso:**
```csharp
var app = new ApplicationBuilder();
app.Use(async (ctx, next) => {
    Console.WriteLine("Antes");
    await next();
    Console.WriteLine("Después");
});
app.Run(async ctx => Console.WriteLine("Handler final"));
var pipeline = app.Build();
await pipeline(new HttpContext());
// Output: Antes → Handler final → Después
```

### Pistas

<details>
<summary>Ver pista 1</summary>

El pipeline se construye **de atrás hacia adelante**. El último middleware (Run) no llama a nadie. El penúltimo llama al último. Construye la cadena en reversa con `Aggregate` o iterando al revés.

</details>

<details>
<summary>Ver pista 2</summary>

Cada middleware recibe `next` como parámetro, donde `next` es el delegate del siguiente middleware ya construido. El cierre (closure) captura este delegate.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

// Contexto simplificado (en ASP.NET Core real es HttpContext)
public class RequestContext
{
    public string Path { get; set; } = "/";
    public Dictionary<string, string> Items { get; } = new();
    public int StatusCode { get; set; } = 200;
}

// Delegate del pipeline
public delegate Task RequestDelegate(RequestContext context);

// Middleware: recibe el contexto y el "siguiente" delegate
public delegate Task MiddlewareDelegate(RequestContext context, Func<Task> next);

public class ApplicationBuilder
{
    // Lista de middlewares en orden de registro
    private readonly List<Func<RequestDelegate, RequestDelegate>> _componentes = new();

    /// <summary>
    /// Agrega un middleware que puede llamar al siguiente.
    /// </summary>
    public ApplicationBuilder Use(MiddlewareDelegate middleware)
    {
        // Convertir el middleware en un componente del pipeline:
        // recibe el "next" delegate y retorna un nuevo delegate que lo envuelve
        _componentes.Add(next =>
            context => middleware(context, () => next(context))
        );
        return this;
    }

    /// <summary>
    /// Agrega un middleware usando la interfaz de ASP.NET Core real:
    /// Func<RequestDelegate, RequestDelegate>
    /// </summary>
    public ApplicationBuilder UseRaw(Func<RequestDelegate, RequestDelegate> middleware)
    {
        _componentes.Add(middleware);
        return this;
    }

    /// <summary>
    /// Agrega el handler terminal (no llama a next).
    /// </summary>
    public ApplicationBuilder Run(RequestDelegate handler)
    {
        // El terminal ignora el "next" porque es el último
        _componentes.Add(_ => handler);
        return this;
    }

    /// <summary>
    /// Construye el pipeline completo como un único RequestDelegate.
    /// </summary>
    public RequestDelegate Build()
    {
        // Comenzar con un delegate "vacío" al final del pipeline
        RequestDelegate pipeline = context =>
        {
            // Si ningún middleware llamó a Run, retornar 404
            context.StatusCode = 404;
            return Task.CompletedTask;
        };

        // Construir de atrás hacia adelante: cada componente envuelve al anterior
        // El último registrado con Use/Run es el que está más "adentro"
        for (int i = _componentes.Count - 1; i >= 0; i--)
        {
            pipeline = _componentes[i](pipeline);
        }

        return pipeline;
    }
}

// ============================================================
// Ejemplo: middleware de logging, autenticación y handler
// ============================================================
/*
var app = new ApplicationBuilder();

// Middleware 1: Logging
app.Use(async (ctx, next) =>
{
    var inicio = DateTime.UtcNow;
    Console.WriteLine($"[{inicio:HH:mm:ss}] → {ctx.Path}");
    
    await next(); // Llamar al siguiente middleware
    
    var duracion = DateTime.UtcNow - inicio;
    Console.WriteLine($"[{DateTime.UtcNow:HH:mm:ss}] ← {ctx.StatusCode} ({duracion.TotalMilliseconds}ms)");
});

// Middleware 2: Autenticación
app.Use(async (ctx, next) =>
{
    if (!ctx.Items.ContainsKey("Authorization"))
    {
        ctx.StatusCode = 401;
        return; // No llamar a next = cortocircuito
    }
    await next();
});

// Handler terminal
app.Run(async ctx =>
{
    ctx.StatusCode = 200;
    Console.WriteLine($"Procesando {ctx.Path}");
    await Task.CompletedTask;
});

var pipeline = app.Build();

// Ejecutar
await pipeline(new RequestContext { Path = "/api/pedidos" });
*/
```

**Complejidad**: Build O(n), Execute O(n) donde n = número de middlewares

**Variantes a considerar en la entrevista:**
- ¿Por qué ASP.NET Core construye el pipeline de atrás hacia adelante?
- ¿Cuál es la diferencia entre `Use` y `Run`? (`Use` puede llamar al siguiente, `Run` no)
- ¿Cómo implementarías `Map` para branching del pipeline según el path? (crear un sub-pipeline condicional)
- ¿Cómo agregarías soporte para middlewares como clases con `IMiddleware`? (resolver del DI container)
- ¿Cómo funciona `UseMiddleware<T>()` de ASP.NET Core internamente?

</details>

---

## Ejercicio 7: CQRS con MediatR

**Dificultad**: 🔴 Difícil  
**Tiempo estimado**: 30 minutos  
**Temas**: CQRS, MediatR, Domain Events, EF Core, patrones DDD

### Enunciado

Implementa el flujo CQRS completo para crear un pedido usando MediatR:
1. **Command**: `CrearPedidoCommand` con los datos del pedido
2. **Handler**: valida, persiste con EF Core, y publica un `PedidoCreado` Domain Event
3. **Domain Event Handler**: envía notificación (simular con log)
4. **Pipeline Behavior**: logging automático de todos los commands/queries

**Flujo esperado:**
```
Controller → CrearPedidoCommand → [LoggingBehavior] → CrearPedidoCommandHandler
  → Validar → Persistir con EF → Publish(PedidoCreado)
    → PedidoCreadoEventHandler → Log("Email enviado a...")
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Un `IRequest<TResponse>` representa el command/query. Un `IRequestHandler<TRequest, TResponse>` es el handler. Los Domain Events se publican con `IPublisher.Publish()` y se manejan con `INotificationHandler<T>`.

</details>

<details>
<summary>Ver pista 2</summary>

`IPipelineBehavior<TRequest, TResponse>` permite interceptar todos los commands/queries. Implementa `Handle` y llama a `next()` para continuar el pipeline.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

// ============================================================
// MODELOS DE DOMINIO
// ============================================================

public class Pedido
{
    public int Id { get; set; }
    public int ClienteId { get; set; }
    public string DireccionEntrega { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public EstadoPedido Estado { get; set; } = EstadoPedido.Pendiente;
    public DateTime CreadoEn { get; set; } = DateTime.UtcNow;
    public List<ItemPedido> Items { get; set; } = new();
}

public enum EstadoPedido { Pendiente, Confirmado, EnPreparacion, Enviado, Entregado }

// ============================================================
// COMMAND (datos de entrada)
// ============================================================

// IRequest<int> significa "command que retorna un int (el Id del pedido creado)"
public record CrearPedidoCommand(
    int ClienteId,
    string DireccionEntrega,
    List<CrearItemPedidoDto> Items
) : IRequest<int>;

public record CrearItemPedidoDto(int ProductoId, int Cantidad, decimal PrecioUnitario);

// ============================================================
// DOMAIN EVENT (notificación de algo que ocurrió)
// ============================================================

// INotification = evento que puede tener múltiples handlers
public record PedidoCreadoEvent(
    int PedidoId,
    int ClienteId,
    decimal Total,
    DateTime CreadoEn
) : INotification;

// ============================================================
// PIPELINE BEHAVIOR: logging automático
// ============================================================

public class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public LoggingBehavior(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
        => _logger = logger;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var nombre = typeof(TRequest).Name;
        var sw = Stopwatch.StartNew();

        _logger.LogInformation("Iniciando {CommandName}: {@Command}", nombre, request);

        try
        {
            var respuesta = await next(); // Ejecutar el siguiente behavior o el handler

            sw.Stop();
            _logger.LogInformation(
                "Completado {CommandName} en {ElapsedMs}ms",
                nombre, sw.ElapsedMilliseconds);

            return respuesta;
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex,
                "Error en {CommandName} después de {ElapsedMs}ms",
                nombre, sw.ElapsedMilliseconds);
            throw;
        }
    }
}

// ============================================================
// COMMAND HANDLER (lógica de negocio)
// ============================================================

public class CrearPedidoCommandHandler : IRequestHandler<CrearPedidoCommand, int>
{
    private readonly AppDbContext _db;
    private readonly IPublisher _publisher;  // Para publicar domain events

    public CrearPedidoCommandHandler(AppDbContext db, IPublisher publisher)
    {
        _db = db;
        _publisher = publisher;
    }

    public async Task<int> Handle(CrearPedidoCommand command, CancellationToken ct)
    {
        // 1. Validaciones de negocio
        bool clienteExiste = await _db.Clientes.AnyAsync(c => c.Id == command.ClienteId, ct);
        if (!clienteExiste)
            throw new NotFoundException($"Cliente {command.ClienteId} no encontrado");

        // 2. Construir el agregado Pedido
        var pedido = new Pedido
        {
            ClienteId = command.ClienteId,
            DireccionEntrega = command.DireccionEntrega,
            Items = command.Items.Select(i => new ItemPedido
            {
                ProductoId = i.ProductoId,
                Cantidad = i.Cantidad,
                PrecioUnitario = i.PrecioUnitario,
            }).ToList()
        };

        pedido.Total = pedido.Items.Sum(i => i.Cantidad * i.PrecioUnitario);

        // 3. Persistir
        _db.Pedidos.Add(pedido);
        await _db.SaveChangesAsync(ct);

        // 4. Publicar domain event (después de persistir exitosamente)
        // IPublisher.Publish es asíncrono y espera todos los handlers
        await _publisher.Publish(new PedidoCreadoEvent(
            PedidoId: pedido.Id,
            ClienteId: pedido.ClienteId,
            Total: pedido.Total,
            CreadoEn: pedido.CreadoEn
        ), ct);

        return pedido.Id;
    }
}

// ============================================================
// DOMAIN EVENT HANDLER (efecto secundario)
// ============================================================

public class PedidoCreadoEventHandler : INotificationHandler<PedidoCreadoEvent>
{
    private readonly ILogger<PedidoCreadoEventHandler> _logger;
    // En producción: IEmailService _emailService

    public PedidoCreadoEventHandler(ILogger<PedidoCreadoEventHandler> logger)
        => _logger = logger;

    public Task Handle(PedidoCreadoEvent notification, CancellationToken ct)
    {
        // Simular envío de email de confirmación
        _logger.LogInformation(
            "Email de confirmación enviado para pedido {PedidoId}, cliente {ClienteId}, total {Total:C}",
            notification.PedidoId,
            notification.ClienteId,
            notification.Total);

        return Task.CompletedTask;
    }
}

// ============================================================
// CONTROLLER — solo orquesta, sin lógica de negocio
// ============================================================

[ApiController]
[Route("api/[controller]")]
public class PedidosController : ControllerBase
{
    private readonly ISender _sender;

    public PedidosController(ISender sender) => _sender = sender;

    [HttpPost]
    public async Task<IActionResult> CrearPedido([FromBody] CrearPedidoCommand command)
    {
        var pedidoId = await _sender.Send(command);
        return CreatedAtAction(nameof(ObtenerPedido), new { id = pedidoId }, new { id = pedidoId });
    }
}

// ============================================================
// REGISTRO EN PROGRAM.CS
// ============================================================
/*
builder.Services.AddMediatR(cfg => {
    cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
    // También podemos agregar ValidationBehavior con FluentValidation
});
*/
```

**Complejidad**: O(n) para el handler (n = items del pedido)

**Variantes a considerar en la entrevista:**
- ¿Cuándo publicarías el domain event antes vs después del `SaveChangesAsync`? (antes: el event podría perderse si falla el save; después: garantizas que el estado está persistido)
- ¿Cómo garantizarías que el event handler se ejecute exactamente una vez si el sistema falla a mitad? (Outbox Pattern)
- ¿Cuál es la diferencia entre `ISender.Send()` e `IPublisher.Publish()`? (Send = un handler, Publish = todos los handlers)
- ¿Cómo agregarías validación con FluentValidation como pipeline behavior?
- ¿En qué casos CQRS es overkill y no vale la complejidad adicional?

</details>

---

## Ejercicio 9: LRU Cache

**Dificultad**: 🔴 Difícil
**Tiempo estimado**: 25 minutos
**Temas**: estructuras de datos, LinkedList, Dictionary, O(1) operations, thread-safety

### Enunciado

Implementa una caché **LRU (Least Recently Used)** genérica con:
- `Get(key)`: retorna el valor si existe y actualiza su posición como "más reciente". Retorna `default` si no existe.
- `Put(key, value)`: agrega o actualiza. Si la caché está llena, **evicta el elemento menos recientemente usado**
- Ambas operaciones deben ser **O(1)**
- Thread-safe

**Ejemplo:**
```csharp
var cache = new LruCache<int, string>(capacity: 3);
cache.Put(1, "uno");
cache.Put(2, "dos");
cache.Put(3, "tres");
cache.Get(1);           // "uno" — 1 se vuelve el más reciente
cache.Put(4, "cuatro"); // capacidad llena → evicta 2 (el menos reciente)
cache.Get(2);           // null — fue evictado
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Para O(1) en ambas operaciones necesitas **dos estructuras combinadas**:
- `Dictionary<TKey, LinkedListNode<...>>`: acceso O(1) por clave al nodo de la lista
- `LinkedList<...>`: mantiene el orden de uso (head = más reciente, tail = menos reciente)

Al hacer `Get`, mueves el nodo al head. Al hacer `Put` con capacidad llena, eliminas el nodo del tail.

</details>

<details>
<summary>Ver pista 2</summary>

Guarda en cada nodo de la LinkedList **tanto la clave como el valor**: `LinkedListNode<(TKey Key, TValue Value)>`. Necesitas la clave al evictar para poder eliminarla también del Dictionary en O(1).

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
using System;
using System.Collections.Generic;

/// <summary>
/// LRU Cache genérico con operaciones O(1).
/// Internamente: Dictionary (lookup O(1)) + LinkedList (orden de uso O(1) insert/remove)
/// Head = más reciente, Tail = candidato a evicción
/// </summary>
public class LruCache<TKey, TValue> where TKey : notnull
{
    private readonly int _capacidad;
    private readonly Dictionary<TKey, LinkedListNode<(TKey Key, TValue Value)>> _mapa;
    private readonly LinkedList<(TKey Key, TValue Value)> _lista;
    private readonly object _lock = new();

    public int Count    => _mapa.Count;
    public int Capacity => _capacidad;

    public LruCache(int capacity)
    {
        if (capacity <= 0) throw new ArgumentOutOfRangeException(nameof(capacity));
        _capacidad = capacity;
        _mapa  = new Dictionary<TKey, LinkedListNode<(TKey, TValue)>>(capacity);
        _lista = new LinkedList<(TKey, TValue)>();
    }

    /// <summary>
    /// Obtiene el valor. Marca el elemento como el más recientemente usado. O(1).
    /// </summary>
    public bool TryGet(TKey key, out TValue value)
    {
        lock (_lock)
        {
            if (!_mapa.TryGetValue(key, out var nodo))
            {
                value = default!;
                return false;
            }

            // Mover al frente: accedido recientemente
            _lista.Remove(nodo);
            _lista.AddFirst(nodo);

            value = nodo.Value.Value;
            return true;
        }
    }

    /// <summary>Acceso por método — retorna default si no existe.</summary>
    public TValue? Get(TKey key) => TryGet(key, out var v) ? v : default;

    /// <summary>
    /// Inserta o actualiza. Si supera capacidad, evicta el LRU (tail). O(1).
    /// </summary>
    public void Put(TKey key, TValue value)
    {
        lock (_lock)
        {
            if (_mapa.TryGetValue(key, out var nodoExistente))
            {
                // Actualizar valor y mover al frente
                _lista.Remove(nodoExistente);
                _lista.AddFirst((key, value));
                _mapa[key] = _lista.First!;
                return;
            }

            // Evictar el menos reciente si se alcanzó la capacidad
            if (_mapa.Count >= _capacidad)
            {
                var lru = _lista.Last!;       // Tail = LRU
                _mapa.Remove(lru.Value.Key);  // Eliminar del mapa por la clave guardada en el nodo
                _lista.RemoveLast();
            }

            // Insertar al frente (más reciente)
            var nuevoNodo = _lista.AddFirst((key, value));
            _mapa[key] = nuevoNodo;
        }
    }

    /// <summary>Elimina una entrada explícitamente. O(1).</summary>
    public bool Remove(TKey key)
    {
        lock (_lock)
        {
            if (!_mapa.TryGetValue(key, out var nodo)) return false;
            _lista.Remove(nodo);
            _mapa.Remove(key);
            return true;
        }
    }

    /// <summary>Retorna las claves en orden: más reciente primero.</summary>
    public IEnumerable<TKey> GetKeysInOrder()
    {
        lock (_lock)
        {
            var snapshot = new List<TKey>(_lista.Count);
            foreach (var item in _lista) snapshot.Add(item.Key);
            return snapshot;
        }
    }
}

// ============================================================
// Uso
// ============================================================
/*
var cache = new LruCache<int, string>(capacity: 3);
cache.Put(1, "uno");
cache.Put(2, "dos");
cache.Put(3, "tres");

cache.Get(1);             // "uno" — 1 es ahora el más reciente
cache.Put(4, "cuatro");   // evicta 2 (era el menos reciente)

Console.WriteLine(cache.Get(2));  // null
Console.WriteLine(cache.Get(3));  // "tres"
Console.WriteLine(cache.Get(4));  // "cuatro"
// Orden actual (más→menos reciente): 4 → 3 → 1
*/
```

**Complejidad**: Get O(1), Put O(1), Remove O(1), Espacio O(capacidad)

**Variantes a considerar en la entrevista:**
- ¿Cómo implementarías **LFU** (Least Frequently Used)? (más complejo: mapa de frecuencias + lista de listas agrupadas por frecuencia — sigue siendo O(1) con la estructura correcta)
- ¿Cómo agregarías **TTL por entrada**? (guardar `ExpiresAt` en el nodo; verificar en `Get`; una tarea de fondo limpia expirados)
- ¿Por qué guardar la clave dentro del nodo de la LinkedList? (para poder eliminarla del Dictionary al evictar, sin una búsqueda inversa)
- ¿Qué pasaría si usaras `SortedDictionary` en vez de LinkedList? (operaciones O(log n) en vez de O(1) para reordenar)
- ¿Cuándo usarías `IMemoryCache` de ASP.NET Core vs implementación propia? (casi siempre `IMemoryCache` — la implementación propia solo para lógica de evicción muy específica)

</details>

---

