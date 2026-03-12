---
id: live-coding
title: 💻 Live Coding — Senior
sidebar_position: 100
---

# 💻 Live Coding — Senior

Ejercicios para posiciones Senior. Se espera diseño robusto, conocimiento de patrones de distribución, manejo de concurrencia y capacidad de razonar sobre sistemas a escala.

:::tip Consejo
En este nivel, el entrevistador espera que **anticipes los problemas** antes de que se los menciones. Habla de thread-safety, scalabilidad, observabilidad y mantenibilidad sin esperar que te pregunten.
:::

---

## Ejercicio 1: Circuit Breaker

**Dificultad**: 🔴 Difícil  
**Tiempo estimado**: 30 minutos  
**Temas**: patrones de resiliencia, máquina de estados, concurrencia, distributed systems

### Enunciado

Implementa el patrón **Circuit Breaker** con tres estados:
- **Closed** (normal): las llamadas pasan. Si los fallos superan el threshold, pasa a Open
- **Open** (cortado): las llamadas fallan inmediatamente sin intentar. Después de un timeout, pasa a HalfOpen
- **HalfOpen** (prueba): se permite una llamada de prueba. Si tiene éxito, vuelve a Closed; si falla, vuelve a Open

Parámetros configurables:
- `umbralFallos`: número de fallos para abrir el circuito
- `timeoutRecuperacion`: tiempo en estado Open antes de intentar HalfOpen
- `umbralExito`: éxitos consecutivos en HalfOpen para cerrar

**Ejemplo:**
- Config: `umbralFallos=3, timeout=30s`
- 3 llamadas fallan → estado pasa a Open
- Durante 30s todas las llamadas lanzan `CircuitBreakerOpenException`
- A los 30s pasa a HalfOpen, se permite una llamada de prueba

### Pistas

<details>
<summary>Ver pista 1</summary>

Modela los estados como un enum. La transición de estados debe ser **thread-safe** — usa `Interlocked` o `lock` para las variables compartidas. Un `SemaphoreSlim(1,1)` es útil para permitir solo una llamada en HalfOpen.

</details>

<details>
<summary>Ver pista 2</summary>

Guarda el `DateTime` en que el circuito se abrió. En el método `Execute`, antes de lanzar `CircuitBreakerOpenException`, verifica si ya pasó el `timeoutRecuperacion` para pasar a HalfOpen.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

public enum EstadoCircuito { Closed, Open, HalfOpen }

public class CircuitBreakerOpenException : Exception
{
    public CircuitBreakerOpenException(string ip)
        : base($"Circuit breaker abierto para: {ip}") { }
}

public class CircuitBreakerOptions
{
    public int UmbralFallos { get; init; } = 5;
    public TimeSpan TimeoutRecuperacion { get; init; } = TimeSpan.FromSeconds(30);
    public int UmbralExitoHalfOpen { get; init; } = 2;
}

public class CircuitBreaker
{
    private readonly CircuitBreakerOptions _opciones;
    private readonly string _nombre;

    // Variables de estado — volátiles para visibilidad entre hilos
    private volatile EstadoCircuito _estado = EstadoCircuito.Closed;
    private int _fallosConsecutivos = 0;
    private int _exitosConsecutivosHalfOpen = 0;
    private DateTime _momentoApertura = DateTime.MinValue;

    // Semáforo para permitir solo UNA llamada en HalfOpen
    private readonly SemaphoreSlim _semaforoHalfOpen = new SemaphoreSlim(1, 1);

    // Lock para transiciones de estado
    private readonly object _lockEstado = new object();

    public EstadoCircuito Estado => _estado;

    public CircuitBreaker(string nombre, CircuitBreakerOptions? opciones = null)
    {
        _nombre = nombre;
        _opciones = opciones ?? new CircuitBreakerOptions();
    }

    /// <summary>
    /// Ejecuta la acción protegida por el circuit breaker.
    /// Lanza CircuitBreakerOpenException si el circuito está abierto.
    /// </summary>
    public async Task<T> EjecutarAsync<T>(Func<Task<T>> accion)
    {
        // Verificar si podemos ejecutar según el estado actual
        await VerificarEstadoAsync();

        try
        {
            var resultado = await accion();
            RegistrarExito();
            return resultado;
        }
        catch (Exception ex) when (ex is not CircuitBreakerOpenException)
        {
            RegistrarFallo();
            throw;
        }
    }

    private async Task VerificarEstadoAsync()
    {
        switch (_estado)
        {
            case EstadoCircuito.Closed:
                return; // Todo bien, continuar

            case EstadoCircuito.Open:
                // Verificar si es tiempo de intentar recuperación
                if (DateTime.UtcNow - _momentoApertura >= _opciones.TimeoutRecuperacion)
                {
                    TransicionarA(EstadoCircuito.HalfOpen);
                    // Caer en HalfOpen (no hay break)
                    goto case EstadoCircuito.HalfOpen;
                }
                throw new CircuitBreakerOpenException(_nombre);

            case EstadoCircuito.HalfOpen:
                // Solo permitir UNA llamada de prueba a la vez
                bool obtuvoCupo = await _semaforoHalfOpen.WaitAsync(TimeSpan.Zero);
                if (!obtuvoCupo)
                    throw new CircuitBreakerOpenException(_nombre);
                // El semáforo se libera en RegistrarExito/RegistrarFallo
                return;
        }
    }

    private void RegistrarExito()
    {
        lock (_lockEstado)
        {
            if (_estado == EstadoCircuito.HalfOpen)
            {
                _semaforoHalfOpen.Release(); // Liberar el cupo de HalfOpen

                _exitosConsecutivosHalfOpen++;

                if (_exitosConsecutivosHalfOpen >= _opciones.UmbralExitoHalfOpen)
                {
                    // Suficientes éxitos: volver a estado normal
                    TransicionarA(EstadoCircuito.Closed);
                }
            }
            else if (_estado == EstadoCircuito.Closed)
            {
                // Resetear contador de fallos en éxito
                Interlocked.Exchange(ref _fallosConsecutivos, 0);
            }
        }
    }

    private void RegistrarFallo()
    {
        lock (_lockEstado)
        {
            if (_estado == EstadoCircuito.HalfOpen)
            {
                // Fallo en prueba: volver a abrir
                _semaforoHalfOpen.Release();
                TransicionarA(EstadoCircuito.Open);
                return;
            }

            int fallos = Interlocked.Increment(ref _fallosConsecutivos);

            if (fallos >= _opciones.UmbralFallos)
                TransicionarA(EstadoCircuito.Open);
        }
    }

    private void TransicionarA(EstadoCircuito nuevoEstado)
    {
        var estadoAnterior = _estado;
        _estado = nuevoEstado;

        switch (nuevoEstado)
        {
            case EstadoCircuito.Open:
                _momentoApertura = DateTime.UtcNow;
                _fallosConsecutivos = 0;
                break;

            case EstadoCircuito.Closed:
                _fallosConsecutivos = 0;
                _exitosConsecutivosHalfOpen = 0;
                break;

            case EstadoCircuito.HalfOpen:
                _exitosConsecutivosHalfOpen = 0;
                break;
        }

        Console.WriteLine($"[CircuitBreaker:{_nombre}] {estadoAnterior} → {nuevoEstado}");
    }
}

// ============================================================
// Uso del Circuit Breaker
// ============================================================
/*
var cb = new CircuitBreaker("ServicioExterno", new CircuitBreakerOptions
{
    UmbralFallos = 3,
    TimeoutRecuperacion = TimeSpan.FromSeconds(30),
    UmbralExitoHalfOpen = 2
});

try
{
    var resultado = await cb.EjecutarAsync(async () =>
        await httpClient.GetStringAsync("https://api.externa.com/datos")
    );
}
catch (CircuitBreakerOpenException)
{
    // Usar valor de caché o respuesta degradada
}
*/
```

**Complejidad**: Tiempo O(1) por llamada, Espacio O(1)

**Variantes a considerar en la entrevista:**
- ¿Cómo lo harías distribuido entre múltiples instancias? (estado compartido en Redis con TTL)
- ¿Cómo expondrías métricas del circuit breaker? (contadores con `System.Diagnostics.Metrics`)
- ¿Polly ya implementa esto — cuándo escribirías tu propio Circuit Breaker? (para entender el patrón, o si necesitas lógica muy específica)
- ¿Cómo combinarías Circuit Breaker con Retry y Timeout? (Polly Policy.WrapAsync)
- ¿Cómo testearías las transiciones de estado? (inyectar un `IClock` para controlar el tiempo en tests)

</details>

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

## Ejercicio 4: Distributed Lock con Redis

**Dificultad**: 🔴 Difícil  
**Tiempo estimado**: 30 minutos  
**Temas**: Redis, distributed systems, concurrencia, Lua scripts

### Enunciado

Implementa un **distributed lock** usando Redis que:
- Adquiera el lock con `SETNX` + expiración atómica (para evitar deadlocks si el proceso muere)
- Solo el propietario del lock pueda liberarlo (con un valor único por instancia)
- Use un script Lua para el release atómico
- Soporte `IAsyncDisposable` para release automático con `await using`
- Maneje el caso de lock no disponible con timeout de espera

**Ejemplo de uso:**
```csharp
await using var lockObj = await redisLock.AcquireAsync("pedido:123", TimeSpan.FromSeconds(30));
if (lockObj.AcquirirFueSatisfactorio)
{
    // Sección crítica
}
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `SET key value NX PX milliseconds` en vez de SETNX separado del EXPIRE — el `NX` + `PX` en un solo comando es atómico, evitando la race condition de SETNX seguido de EXPIRE.

</details>

<details>
<summary>Ver pista 2</summary>

Para el release, el script Lua garantiza atomicidad: `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`. Esto asegura que solo el propietario pueda liberar el lock.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
using StackExchange.Redis;
using System;
using System.Threading;
using System.Threading.Tasks;

// Resultado del intento de adquisición del lock
public class DistributedLockHandle : IAsyncDisposable
{
    private readonly IDatabase _db;
    private readonly string _clave;
    private readonly string _valorUnico;
    private bool _liberado = false;

    // Script Lua para release atómico:
    // Solo elimina la clave si el valor coincide (verificación + eliminación atómica)
    private static readonly string _scriptLuaRelease = @"
        if redis.call('get', KEYS[1]) == ARGV[1] then
            return redis.call('del', KEYS[1])
        else
            return 0
        end
    ";

    public bool AcquirirFueSatisfactorio { get; }

    internal DistributedLockHandle(IDatabase db, string clave, string valorUnico, bool adquirido)
    {
        _db = db;
        _clave = clave;
        _valorUnico = valorUnico;
        AcquirirFueSatisfactorio = adquirido;
    }

    /// <summary>Libera el lock. Solo tiene efecto si este handle adquirió el lock.</summary>
    public async ValueTask DisposeAsync()
    {
        if (!AcquirirFueSatisfactorio || _liberado) return;
        _liberado = true;

        try
        {
            // Ejecutar script Lua para release atómico
            await _db.ScriptEvaluateAsync(
                _scriptLuaRelease,
                keys: new RedisKey[] { _clave },
                values: new RedisValue[] { _valorUnico }
            );
        }
        catch (Exception ex)
        {
            // Log del error pero no relanzar — el lock expirará por TTL de todas formas
            Console.Error.WriteLine($"Error al liberar lock '{_clave}': {ex.Message}");
        }
    }
}

public class RedisDistributedLock
{
    private readonly IDatabase _db;
    private readonly string _prefijo;

    public RedisDistributedLock(IConnectionMultiplexer redis, string prefijo = "lock:")
    {
        _db = redis.GetDatabase();
        _prefijo = prefijo;
    }

    /// <summary>
    /// Intenta adquirir el lock. Si no está disponible, reintenta hasta el timeout.
    /// </summary>
    /// <param name="recurso">Identificador del recurso a lockear</param>
    /// <param name="ttlLock">Tiempo máximo que el lock permanece activo (previene deadlocks)</param>
    /// <param name="timeoutEspera">Tiempo máximo esperando a que el lock esté disponible</param>
    /// <param name="intervaloReintento">Tiempo entre reintentos</param>
    public async Task<DistributedLockHandle> AcquireAsync(
        string recurso,
        TimeSpan ttlLock,
        TimeSpan? timeoutEspera = null,
        TimeSpan? intervaloReintento = null)
    {
        var clave = $"{_prefijo}{recurso}";
        // Valor único por intento — identifica al propietario del lock
        var valorUnico = $"{Environment.MachineName}:{Guid.NewGuid()}";
        var espera = timeoutEspera ?? TimeSpan.Zero;
        var intervalo = intervaloReintento ?? TimeSpan.FromMilliseconds(50);
        var limite = DateTime.UtcNow + espera;

        do
        {
            // SET key value NX PX ttl — atómico: solo setea si no existe
            bool adquirido = await _db.StringSetAsync(
                key: clave,
                value: valorUnico,
                expiry: ttlLock,
                when: When.NotExists  // NX: solo si no existe
            );

            if (adquirido)
                return new DistributedLockHandle(_db, clave, valorUnico, adquirido: true);

            // Lock no disponible — esperar antes de reintentar
            if (DateTime.UtcNow < limite)
                await Task.Delay(intervalo);

        } while (DateTime.UtcNow < limite);

        // Timeout: retornar handle sin lock
        return new DistributedLockHandle(_db, clave, valorUnico, adquirido: false);
    }
}

// ============================================================
// Uso
// ============================================================
/*
var redisLock = new RedisDistributedLock(connectionMultiplexer);

await using var lockHandle = await redisLock.AcquireAsync(
    recurso: $"pedido:{pedidoId}",
    ttlLock: TimeSpan.FromSeconds(30),
    timeoutEspera: TimeSpan.FromSeconds(5)
);

if (!lockHandle.AcquirirFueSatisfactorio)
{
    throw new InvalidOperationException("No se pudo adquirir el lock. Inténtalo más tarde.");
}

// Sección crítica — garantizado que solo una instancia ejecuta esto
await procesarPedido(pedidoId);
// El lock se libera automáticamente al salir del await using
*/
```

**Complejidad**: Tiempo O(1) para acquire/release en Redis, Espacio O(1)

**Variantes a considerar en la entrevista:**
- ¿Qué es el algoritmo **Redlock** y cuándo es necesario? (para alta disponibilidad con múltiples nodos Redis independientes)
- ¿Por qué el script Lua para el release? (atomicidad: verificar + eliminar en una sola operación)
- ¿Qué pasa si el proceso muere mientras tiene el lock? (el TTL garantiza que expirará automáticamente)
- ¿Qué pasa si la operación tarda más que el TTL del lock? (el lock expira y otro proceso puede entrar — necesitas lock extension o watchdog)
- ¿Cómo lo testearías sin un Redis real? (Testcontainers, o mockear `IDatabase`)

</details>

---

## Ejercicio 5: Infinite Scroll con React Query

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 25 minutos  
**Temas**: React Query, useInfiniteQuery, Intersection Observer, TypeScript

### Enunciado

Implementa una lista con **scroll infinito** en React + TypeScript que:
- Use `useInfiniteQuery` de React Query para paginación
- Detecte cuando el usuario llega al final de la lista con **Intersection Observer**
- Muestre skeleton loaders mientras carga la siguiente página
- Maneje correctamente el estado de "no hay más páginas"

**API esperada:**
```typescript
// GET /api/productos?pagina=1&limite=20
// Retorna: { items: Producto[], pagina: number, totalPaginas: number }
```

### Pistas

<details>
<summary>Ver pista 1</summary>

`useInfiniteQuery` requiere una función `getNextPageParam` que determina el parámetro de la próxima página a partir del resultado de la página actual. Si retorna `undefined`, no hay más páginas.

</details>

<details>
<summary>Ver pista 2</summary>

Para Intersection Observer, crea un ref (`useRef`) y apúntalo al último elemento de la lista. En un `useEffect`, observa ese elemento y llama a `fetchNextPage()` cuando sea visible en el viewport.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```typescript
// components/ListaProductosInfinita.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

// ============================================================
// Tipos
// ============================================================
interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
}

interface PaginaProductos {
  items: Producto[];
  pagina: number;
  totalPaginas: number;
}

// ============================================================
// Función fetch de la API
// ============================================================
async function fetchProductos(pagina: number): Promise<PaginaProductos> {
  const res = await fetch(`/api/productos?pagina=${pagina}&limite=20`);
  if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
  return res.json();
}

// ============================================================
// Componente Skeleton Loader
// ============================================================
function SkeletonProducto() {
  return (
    <div className="producto-skeleton" aria-hidden="true">
      <div className="skeleton-imagen" />
      <div className="skeleton-texto skeleton-titulo" />
      <div className="skeleton-texto skeleton-precio" />
    </div>
  );
}

// ============================================================
// Hook personalizado para Intersection Observer
// ============================================================
function useIntersectionObserver(
  onIntersect: () => void,
  options: IntersectionObserverInit = { threshold: 0.1 }
) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = targetRef.current;
    if (!elemento) return;

    const observer = new IntersectionObserver((entries) => {
      // Disparar cuando el elemento sea visible en el viewport
      if (entries[0].isIntersecting) {
        onIntersect();
      }
    }, options);

    observer.observe(elemento);

    // Limpiar observer al desmontar
    return () => observer.disconnect();
  }, [onIntersect, options]);

  return targetRef;
}

// ============================================================
// Componente principal
// ============================================================
function ListaProductosInfinita() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery<PaginaProductos, Error>({
    queryKey: ['productos'],
    queryFn: ({ pageParam = 1 }) => fetchProductos(pageParam as number),

    // Determinar qué página cargar a continuación
    getNextPageParam: (ultimaPagina) => {
      if (ultimaPagina.pagina < ultimaPagina.totalPaginas) {
        return ultimaPagina.pagina + 1;
      }
      return undefined; // undefined = no hay más páginas
    },

    initialPageParam: 1,
  });

  // Callback estable para el observer (evitar recreación en cada render)
  const cargarMas = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Ref al elemento centinela (trigger de carga)
  const centinelaRef = useIntersectionObserver(cargarMas);

  // Aplanar todas las páginas en un array de items
  const productos = data?.pages.flatMap(pagina => pagina.items) ?? [];

  // Estado: carga inicial
  if (isLoading) {
    return (
      <div className="grid-productos">
        {Array.from({ length: 8 }, (_, i) => <SkeletonProducto key={i} />)}
      </div>
    );
  }

  // Estado: error
  if (isError) {
    return (
      <div className="error-estado" role="alert">
        <p>Error al cargar productos: {error.message}</p>
        <button onClick={() => fetchNextPage()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      {/* Grid de productos */}
      <div className="grid-productos">
        {productos.map(producto => (
          <div key={producto.id} className="producto-card">
            <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
            <h3>{producto.nombre}</h3>
            <p>{producto.precio.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
        ))}

        {/* Skeletons durante carga de página siguiente */}
        {isFetchingNextPage && (
          Array.from({ length: 4 }, (_, i) => <SkeletonProducto key={`skeleton-${i}`} />)
        )}
      </div>

      {/* Elemento centinela — invisible, dispara carga cuando es visible */}
      <div
        ref={centinelaRef}
        aria-hidden="true"
        style={{ height: '20px', margin: '20px 0' }}
      />

      {/* Indicador de fin de lista */}
      {!hasNextPage && productos.length > 0 && (
        <p className="fin-lista" aria-live="polite">
          ✓ Has visto todos los productos ({productos.length} en total)
        </p>
      )}
    </div>
  );
}

export default ListaProductosInfinita;
```

**Complejidad**: No aplica — componente de UI con paginación O(n) para renderizar

**Variantes a considerar en la entrevista:**
- ¿Cómo manejarías el caso de que el usuario navega hacia atrás? (React Query mantiene los datos en caché, `keepPreviousData`)
- ¿Cómo implementarías "virtualización" para no renderizar miles de nodos DOM? (`react-virtual` o `react-window`)
- ¿Cuándo usarías cursor-based pagination vs offset-based? (cursor es más consistente cuando los datos cambian)
- ¿Cómo pre-fetchearías la siguiente página antes de que el usuario llegue al final? (`prefetchQuery` cuando quedan pocos items)
- ¿Cómo manejarías que aparezcan nuevos productos mientras el usuario scrollea? (invalidación con `refetchInterval` o WebSockets)

</details>

---

## Ejercicio 6: Schema RBAC en Base de Datos

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 25 minutos  
**Temas**: diseño de BD, normalización, RBAC, índices, SQL avanzado

### Enunciado

Diseña el **schema completo** para un sistema de control de acceso basado en roles (RBAC) que soporte:
- Usuarios con múltiples roles
- Roles con múltiples permisos
- Permisos con recurso + acción (ej: `pedidos:leer`, `usuarios:crear`)
- Herencia de roles (un rol puede heredar permisos de otro)
- Query eficiente: "¿puede el usuario X realizar la acción Y sobre el recurso Z?"

Incluye: schema SQL, índices recomendados, y las queries de verificación de permisos.

### Pistas

<details>
<summary>Ver pista 1</summary>

La estructura básica RBAC tiene 5 tablas: `Usuarios`, `Roles`, `Permisos`, `UsuarioRoles` (M:N), `RolPermisos` (M:N). La herencia de roles agrega una tabla `RolHerencia` (o una columna `RolPadreId` en `Roles`).

</details>

<details>
<summary>Ver pista 2</summary>

Para la query de verificación de permisos, un CTE recursivo es la forma más limpia de manejar la herencia de roles. `WITH RECURSIVE` (PostgreSQL/MySQL) o `WITH CTE` con `UNION ALL` (SQL Server).

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```sql
-- ============================================================
-- SCHEMA RBAC COMPLETO
-- ============================================================

-- Tabla de usuarios del sistema
CREATE TABLE Usuarios (
    Id          INT PRIMARY KEY IDENTITY(1,1),
    Email       NVARCHAR(255) NOT NULL UNIQUE,
    Nombre      NVARCHAR(100) NOT NULL,
    Activo      BIT NOT NULL DEFAULT 1,
    CreadoEn    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    INDEX IX_Usuarios_Email (Email)
);

-- Roles disponibles en el sistema
CREATE TABLE Roles (
    Id          INT PRIMARY KEY IDENTITY(1,1),
    Nombre      NVARCHAR(100) NOT NULL UNIQUE,
    Descripcion NVARCHAR(500),
    RolPadreId  INT NULL REFERENCES Roles(Id),  -- Para herencia de roles
    Activo      BIT NOT NULL DEFAULT 1,
    INDEX IX_Roles_Nombre (Nombre)
);

-- Permisos atómicos: recurso + acción
CREATE TABLE Permisos (
    Id          INT PRIMARY KEY IDENTITY(1,1),
    Recurso     NVARCHAR(100) NOT NULL,  -- ej: "pedidos", "usuarios", "reportes"
    Accion      NVARCHAR(50) NOT NULL,   -- ej: "leer", "crear", "actualizar", "eliminar"
    Descripcion NVARCHAR(500),
    UNIQUE (Recurso, Accion),
    INDEX IX_Permisos_Recurso_Accion (Recurso, Accion)
);

-- Relación M:N entre Usuarios y Roles
CREATE TABLE UsuarioRoles (
    UsuarioId   INT NOT NULL REFERENCES Usuarios(Id) ON DELETE CASCADE,
    RolId       INT NOT NULL REFERENCES Roles(Id) ON DELETE CASCADE,
    AsignadoPor INT NULL REFERENCES Usuarios(Id),
    AsignadoEn  DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    PRIMARY KEY (UsuarioId, RolId),
    INDEX IX_UsuarioRoles_RolId (RolId)
);

-- Relación M:N entre Roles y Permisos
CREATE TABLE RolPermisos (
    RolId       INT NOT NULL REFERENCES Roles(Id) ON DELETE CASCADE,
    PermisoId   INT NOT NULL REFERENCES Permisos(Id) ON DELETE CASCADE,
    PRIMARY KEY (RolId, PermisoId),
    INDEX IX_RolPermisos_PermisoId (PermisoId)
);

-- ============================================================
-- QUERY 1: ¿Tiene el usuario X el permiso Y?
-- Considera herencia de roles con CTE recursivo
-- ============================================================
DECLARE @UsuarioId INT = 42;
DECLARE @Recurso   NVARCHAR(100) = 'pedidos';
DECLARE @Accion    NVARCHAR(50)  = 'crear';

WITH RolesDelUsuario AS (
    -- Roles directamente asignados al usuario
    SELECT ur.RolId
    FROM UsuarioRoles ur
    WHERE ur.UsuarioId = @UsuarioId

    UNION ALL

    -- Roles heredados (padres de los roles ya encontrados)
    SELECT r.RolPadreId
    FROM RolesDelUsuario rdu
    INNER JOIN Roles r ON r.Id = rdu.RolId
    WHERE r.RolPadreId IS NOT NULL
)
SELECT TOP 1 1 AS TienePermiso
FROM RolesDelUsuario rdu
INNER JOIN RolPermisos rp ON rp.RolId = rdu.RolId
INNER JOIN Permisos p     ON p.Id = rp.PermisoId
WHERE p.Recurso = @Recurso
  AND p.Accion  = @Accion;
-- Retorna 1 fila si tiene permiso, 0 filas si no

-- ============================================================
-- QUERY 2: Todos los permisos de un usuario (con herencia)
-- ============================================================
WITH RolesConHerencia AS (
    SELECT ur.RolId, 0 AS Nivel
    FROM UsuarioRoles ur
    WHERE ur.UsuarioId = @UsuarioId

    UNION ALL

    SELECT r.RolPadreId, rch.Nivel + 1
    FROM RolesConHerencia rch
    INNER JOIN Roles r ON r.Id = rch.RolId
    WHERE r.RolPadreId IS NOT NULL
)
SELECT DISTINCT
    p.Recurso,
    p.Accion,
    r.Nombre AS RolOrigen
FROM RolesConHerencia rch
INNER JOIN RolPermisos rp ON rp.RolId = rch.RolId
INNER JOIN Permisos p     ON p.Id = rp.PermisoId
INNER JOIN Roles r        ON r.Id = rch.RolId
ORDER BY p.Recurso, p.Accion;

-- ============================================================
-- QUERY 3: Qué usuarios pueden realizar cierta acción
-- ============================================================
SELECT DISTINCT
    u.Id,
    u.Email,
    u.Nombre
FROM Usuarios u
INNER JOIN UsuarioRoles ur ON ur.UsuarioId = u.Id
INNER JOIN RolPermisos rp  ON rp.RolId = ur.RolId
INNER JOIN Permisos p      ON p.Id = rp.PermisoId
WHERE p.Recurso = @Recurso
  AND p.Accion  = @Accion
  AND u.Activo  = 1;
```

**Complejidad**: La query de verificación es O(d×p) donde d = profundidad de herencia de roles y p = permisos por rol

**Variantes a considerar en la entrevista:**
- ¿Cómo manejarías permisos a nivel de instancia de recurso? (ej: el usuario puede editar SOLO sus propios pedidos) — ABAC vs RBAC
- ¿Cómo cachearías los permisos para evitar queries a BD en cada request? (Redis con clave `permisos:{usuarioId}`, invalida al cambiar roles)
- ¿Cómo implementarías esto en .NET con claims en JWT? (incluir roles en el token, verificar con `[Authorize(Policy = "...")]`)
- ¿Cuándo se vuelve problemática la herencia recursiva? (ciclos, profundidad excesiva)
- ¿Cómo auditarías cambios de permisos? (tabla `AuditoriaPermisos` con before/after + usuario que hizo el cambio)

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

## Ejercicio 8: Optimización del Problema N+1

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: EF Core, N+1, Include, proyección, performance

### Enunciado

El siguiente código tiene un **problema N+1** clásico. Identificalo y muestra 3 formas de resolverlo, ordenadas de menos a más control.

```csharp
// CÓDIGO CON PROBLEMA — identificar y corregir
public async Task<List<PedidoDto>> ObtenerPedidosConItemsAsync()
{
    var pedidos = await _db.Pedidos.ToListAsync(); // Query 1: obtiene N pedidos

    var resultado = new List<PedidoDto>();
    foreach (var pedido in pedidos)
    {
        var items = await _db.Items
            .Where(i => i.PedidoId == pedido.Id)
            .ToListAsync(); // Query 2...N+1: una query POR cada pedido

        resultado.Add(new PedidoDto
        {
            Id = pedido.Id,
            Total = pedido.Total,
            NombreCliente = pedido.Cliente.Nombre, // Lazy loading implícito = otra query!
            Items = items.Select(i => new ItemDto { ... }).ToList()
        });
    }
    return resultado;
}
```

### Pistas

<details>
<summary>Ver pista 1</summary>

`Include()` y `ThenInclude()` en EF Core generan un `LEFT JOIN` en la query SQL, cargando todas las entidades relacionadas en una sola query.

</details>

<details>
<summary>Ver pista 2</summary>

Para mayor control, usa `Select()` para proyectar directamente al DTO en la query SQL. Esto evita cargar entidades completas cuando solo necesitas algunos campos.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
// ============================================================
// PROBLEMA IDENTIFICADO:
// Si hay 100 pedidos → 1 (pedidos) + 100 (items) + 100 (clientes) = 201 queries
// ============================================================

// ============================================================
// SOLUCIÓN 1: Include / ThenInclude — más simple, menos control
// ============================================================
public async Task<List<PedidoDto>> ObtenerConIncludeAsync()
{
    // EF Core genera un LEFT JOIN automático — 1 sola query SQL
    var pedidos = await _db.Pedidos
        .Include(p => p.Items)          // JOIN con Items
        .Include(p => p.Cliente)        // JOIN con Clientes
        .AsNoTracking()                 // Optimización: no rastrear entidades (solo lectura)
        .ToListAsync();

    // El mapeo a DTO ocurre en memoria (los datos ya están cargados)
    return pedidos.Select(p => new PedidoDto
    {
        Id = p.Id,
        Total = p.Total,
        NombreCliente = p.Cliente.Nombre,
        Items = p.Items.Select(i => new ItemDto
        {
            ProductoId = i.ProductoId,
            Cantidad = i.Cantidad
        }).ToList()
    }).ToList();
}

// ============================================================
// SOLUCIÓN 2: Proyección con Select — más eficiente (solo traer campos necesarios)
// ============================================================
public async Task<List<PedidoDto>> ObtenerConProyeccionAsync()
{
    // EF Core traduce el Select a SQL — solo trae los campos que necesitamos
    // No carga entidades completas (optimiza el payload de red)
    return await _db.Pedidos
        .AsNoTracking()
        .Select(p => new PedidoDto
        {
            Id = p.Id,
            Total = p.Total,
            NombreCliente = p.Cliente.Nombre,  // EF Core hace el JOIN automáticamente
            Items = p.Items.Select(i => new ItemDto
            {
                ProductoId = i.ProductoId,
                Cantidad = i.Cantidad
            }).ToList()
        })
        .ToListAsync();
    // SQL generado: SELECT p.Id, p.Total, c.Nombre, i.ProductoId, i.Cantidad
    //               FROM Pedidos p
    //               LEFT JOIN Clientes c ON c.Id = p.ClienteId
    //               LEFT JOIN Items i ON i.PedidoId = p.Id
}

// ============================================================
// SOLUCIÓN 3: Split Query — para evitar producto cartesiano en colecciones grandes
// ============================================================
public async Task<List<PedidoDto>> ObtenerConSplitQueryAsync()
{
    // AsSplitQuery divide la query en múltiples queries optimizadas
    // en vez de un JOIN que puede crear filas duplicadas (producto cartesiano)
    // Útil cuando hay múltiples Include de colecciones grandes
    var pedidos = await _db.Pedidos
        .Include(p => p.Items)
        .Include(p => p.Cliente)
        .Include(p => p.Pagos)     // Múltiples colecciones → Split Query brilla aquí
        .AsSplitQuery()            // Genera 3 queries separadas en vez de un JOIN con duplicados
        .AsNoTracking()
        .ToListAsync();

    return pedidos.Select(p => new PedidoDto { /* mapeo */ }).ToList();
}

// ============================================================
// SOLUCIÓN 4: Query manual con Dapper (máximo control)
// ============================================================
public async Task<List<PedidoDto>> ObtenerConDapperAsync()
{
    using var conn = _db.Database.GetDbConnection();

    // Query SQL optimizada manualmente
    const string sql = @"
        SELECT
            p.Id, p.Total, c.Nombre AS NombreCliente,
            i.ProductoId, i.Cantidad
        FROM Pedidos p
        INNER JOIN Clientes c ON c.Id = p.ClienteId
        LEFT JOIN Items i ON i.PedidoId = p.Id
        ORDER BY p.Id";

    // Usar multi-mapping de Dapper para mapear el resultado aplanado a objetos anidados
    var pedidoDict = new Dictionary<int, PedidoDto>();

    await conn.QueryAsync<PedidoDto, ItemDto, PedidoDto>(
        sql,
        (pedido, item) =>
        {
            if (!pedidoDict.TryGetValue(pedido.Id, out var dto))
            {
                dto = pedido;
                dto.Items = new List<ItemDto>();
                pedidoDict.Add(dto.Id, dto);
            }
            if (item != null) dto.Items.Add(item);
            return dto;
        },
        splitOn: "ProductoId"
    );

    return pedidoDict.Values.ToList();
}
```

**Complejidad**: 
- N+1 original: O(n) queries → inaceptable para n grande
- Include/Select/SplitQuery: O(1) queries con JOIN → óptimo
- La complejidad de tiempo sigue siendo O(n×m) para procesar los datos

**Variantes a considerar en la entrevista:**
- ¿Cuándo preferirías `AsSplitQuery` sobre `Include` con JOIN? (cuando hay múltiples colecciones y el producto cartesiano genera muchas filas duplicadas)
- ¿Cuándo usarías Dapper en vez de EF Core? (cuando necesitas control total del SQL, stored procedures, o rendimiento crítico)
- ¿Cómo detectarías N+1 en producción? (EF Core logging, MiniProfiler, Application Insights)
- ¿Qué es lazy loading y por qué está deshabilitado por defecto en EF Core?
- ¿Cómo cargarías datos paginados evitando traer todos los registros? (`Skip().Take()` antes del `ToListAsync()`)

</details>
