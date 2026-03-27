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

## Ejercicio 10: Retry con Exponential Backoff y Jitter

**Dificultad**: 🔴 Difícil
**Tiempo estimado**: 20 minutos
**Temas**: resiliencia, patrones de distribución, async/await, distributed systems

### Enunciado

Implementa una política de **retry con exponential backoff + jitter** que:
- Reintente hasta N veces cuando la operación lanza una excepción
- El tiempo de espera sigue una progresión exponencial: `base × 2^intento`
- Agrega **jitter** aleatorio para evitar el **thundering herd** (muchos clientes reintentando al mismo tiempo)
- Solo reintente para excepciones "transitorias" (configurable por el caller)
- Soporte `CancellationToken`
- Invoque un callback opcional al reintentar (para logging)

**Progresión esperada (DelayBase = 1s, JitterMax = 500ms):**
```
Intento 1 falla → espera ~1.0s + jitter aleatorio [0-500ms]
Intento 2 falla → espera ~2.0s + jitter aleatorio [0-500ms]
Intento 3 falla → espera ~4.0s + jitter aleatorio [0-500ms]
Intento 4 falla → lanzar RetryExhaustedException
```

### Pistas

<details>
<summary>Ver pista 1</summary>

La fórmula del backoff es: `delay = min(base * 2^intento, maxDelay)`.

Para el **full jitter** (la estrategia más efectiva para distribuir la carga): en vez de agregar jitter al backoff, hazlo aleatorio entre `0` y el backoff calculado: `delay = random(0, min(base * 2^intento, maxDelay))`. Esto reduce la carga en el servidor de forma más uniforme que añadir jitter fijo.

</details>

<details>
<summary>Ver pista 2</summary>

Para filtrar excepciones retriables, acepta un `Func<Exception, bool> esTransitoria` en la configuración. El caller decide: `ex => ex is HttpRequestException or TimeoutException`. Importante: nunca reintentar `OperationCanceledException`.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;

public class RetryOptions
{
    /// <summary>Número máximo de intentos (incluyendo el primero).</summary>
    public int MaxIntentos { get; init; } = 3;

    /// <summary>Delay base para el backoff exponencial.</summary>
    public TimeSpan DelayBase { get; init; } = TimeSpan.FromSeconds(1);

    /// <summary>Cap máximo del delay entre reintentos.</summary>
    public TimeSpan DelayMaximo { get; init; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Determina si una excepción es transitoria y merece retry.
    /// Por defecto, todas las excepciones son retriables (salvo OperationCanceled).
    /// </summary>
    public Func<Exception, bool> EsTransitoria { get; init; } = _ => true;

    /// <summary>Callback al reintentar: (excepción, número de intento, delay calculado).</summary>
    public Func<Exception, int, TimeSpan, Task>? OnReintento { get; init; }
}

public class RetryExhaustedException : Exception
{
    public int TotalIntentos { get; }

    public RetryExhaustedException(int intentos, Exception inner)
        : base($"Operación falló después de {intentos} intentos: {inner.Message}", inner)
        => TotalIntentos = intentos;
}

public static class RetryPolicy
{
    // Thread-safe: Random.Shared es seguro en .NET 6+
    private static readonly Random _rng = Random.Shared;

    /// <summary>
    /// Ejecuta la operación con reintentos exponenciales + full jitter.
    /// </summary>
    public static async Task<T> EjecutarAsync<T>(
        Func<CancellationToken, Task<T>> operacion,
        RetryOptions? opciones = null,
        CancellationToken ct = default)
    {
        var opts = opciones ?? new RetryOptions();
        Exception? ultimaEx = null;

        for (int intento = 0; intento < opts.MaxIntentos; intento++)
        {
            ct.ThrowIfCancellationRequested();

            try
            {
                return await operacion(ct);
            }
            catch (OperationCanceledException)
            {
                throw; // Nunca reintentar cancelaciones
            }
            catch (Exception ex) when (opts.EsTransitoria(ex))
            {
                ultimaEx = ex;

                // En el último intento no esperar, lanzar directamente
                if (intento == opts.MaxIntentos - 1) break;

                var delay = CalcularDelay(intento, opts);

                if (opts.OnReintento != null)
                    await opts.OnReintento(ex, intento + 1, delay);

                await Task.Delay(delay, ct);
            }
        }

        throw new RetryExhaustedException(opts.MaxIntentos, ultimaEx!);
    }

    /// <summary>Sobrecarga sin valor de retorno.</summary>
    public static Task EjecutarAsync(
        Func<CancellationToken, Task> operacion,
        RetryOptions? opciones = null,
        CancellationToken ct = default)
        => EjecutarAsync(async c => { await operacion(c); return 0; }, opciones, ct);

    // Full jitter: aleatorio entre 0 y el backoff exponencial con cap
    // Distribuye mejor la carga que jitter fijo (ver paper AWS "Exponential Backoff and Jitter")
    private static TimeSpan CalcularDelay(int intento, RetryOptions opts)
    {
        double maxMs = Math.Min(
            opts.DelayBase.TotalMilliseconds * Math.Pow(2, intento),
            opts.DelayMaximo.TotalMilliseconds
        );
        return TimeSpan.FromMilliseconds(_rng.NextDouble() * maxMs);
    }
}

// ============================================================
// Uso
// ============================================================
/*
var resultado = await RetryPolicy.EjecutarAsync(
    async ct => await httpClient.GetStringAsync("https://api.externa.com/datos", ct),
    new RetryOptions
    {
        MaxIntentos = 4,
        DelayBase   = TimeSpan.FromSeconds(1),
        DelayMaximo = TimeSpan.FromSeconds(15),
        EsTransitoria = ex => ex is HttpRequestException or TaskCanceledException,
        OnReintento = async (ex, intento, delay) =>
        {
            logger.LogWarning(ex, "Intento {N} fallido. Reintentando en {Ms}ms",
                intento, delay.TotalMilliseconds);
            await Task.CompletedTask;
        }
    },
    cancellationToken
);

// En producción: Polly v8 / Microsoft.Extensions.Resilience
// hace todo esto con una línea + integración con DI y métricas:
services.AddResiliencePipeline("http-retry", builder =>
    builder.AddRetry(new RetryStrategyOptions
    {
        MaxRetryAttempts = 4,
        BackoffType      = DelayBackoffType.Exponential,
        UseJitter        = true,
        Delay            = TimeSpan.FromSeconds(1),
    })
);
*/
```

**Complejidad**: O(1) por intento. Tiempo total worst-case: suma de backoffs ≈ O(2^n × base)

**Variantes a considerar en la entrevista:**
- ¿Cuál es la diferencia entre **full jitter** y **equal jitter**? (full: `random(0, delay)` — mejor distribución; equal: `delay/2 + random(0, delay/2)` — garantiza un mínimo de espera)
- ¿Por qué el jitter es crítico en sistemas distribuidos? (**thundering herd**: sin jitter, 1000 clientes que fallaron al mismo tiempo reintentan al mismo segundo cuando el servidor se recupera, volviendo a colapsarlo)
- ¿Cuándo **no** debes reintentar? (errores 4xx excepto 429, errores de validación, operaciones no idempotentes como `POST /pagar` sin idempotency key)
- ¿Cómo combinas Retry con Circuit Breaker? (Retry dentro, Circuit Breaker por fuera — el CB evita intentar cuando el servicio claramente está caído)
- ¿`Random.Shared` vs `new Random()`? (`.Shared` es thread-safe desde .NET 6 — `new Random()` sin semilla podría generar la misma secuencia en hilos que arrancan al mismo tiempo)

</details>

---

## Ejercicio 11: Custom Hook — useAsync

**Dificultad**: 🟡 Media
**Tiempo estimado**: 20 minutos
**Temas**: React hooks, TypeScript generics, useReducer, AbortController, lifecycle

### Enunciado

Implementa un hook `useAsync<T>` que encapsule el patrón de **llamadas asíncronas** en React con:
- Estado tipado: `'idle' | 'loading' | 'success' | 'error'`
- Cancelación al desmontar el componente con `AbortController`
- Sin `setState` sobre componentes ya desmontados
- Modo **automático** (se ejecuta al montar y al cambiar dependencias)
- Modo **lazy** (se ejecuta solo al llamar a `execute()` manualmente)

**API esperada:**
```typescript
// Modo automático
const { data, isLoading, isError } = useAsync(
  (signal) => fetchUser(userId, signal),
  [userId]
);

// Modo lazy (submit de formulario)
const { execute, isLoading, isSuccess } = useAsync(
  (signal) => submitForm(data, signal),
  [],
  { lazy: true }
);
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `useReducer` en vez de múltiples `useState` para los estados de la llamada. Si usas tres `useState` separados (`loading`, `data`, `error`), React puede renderizar estados intermedios inconsistentes (ej: `loading=false, data=undefined` durante la transición). Un reducer garantiza que el estado cambia de forma atómica.

</details>

<details>
<summary>Ver pista 2</summary>

Crea un `AbortController` **dentro** del `useEffect`. En el cleanup (`return () => controller.abort()`), cancela la llamada cuando el componente se desmonta o cuando cambian las dependencias. En la promesa, atrapa el `AbortError` y no lo trates como error real.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```typescript
import { useReducer, useEffect, useCallback, useRef } from 'react';

// ============================================================
// TIPOS
// ============================================================
type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface AsyncState<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: Error | undefined;
}

type AsyncAction<T> =
  | { type: 'LOADING' }
  | { type: 'SUCCESS'; payload: T }
  | { type: 'ERROR'; payload: Error }
  | { type: 'RESET' };

interface UseAsyncOptions {
  lazy?: boolean;
}

interface UseAsyncResult<T> extends AsyncState<T> {
  execute: () => void;
  reset: () => void;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

// ============================================================
// REDUCER — transiciones atómicas de estado
// ============================================================
function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case 'LOADING': return { status: 'loading', data: undefined, error: undefined };
    case 'SUCCESS': return { status: 'success', data: action.payload, error: undefined };
    case 'ERROR':   return { status: 'error',   data: undefined, error: action.payload };
    case 'RESET':   return { status: 'idle',    data: undefined, error: undefined };
    default:        return state;
  }
}

const initialState = { status: 'idle' as AsyncStatus, data: undefined, error: undefined };

// ============================================================
// HOOK
// ============================================================
export function useAsync<T>(
  asyncFn: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncOptions = {}
): UseAsyncResult<T> {
  const { lazy = false } = options;

  const [state, dispatch] = useReducer(
    asyncReducer as React.Reducer<AsyncState<T>, AsyncAction<T>>,
    initialState as AsyncState<T>
  );

  // Ref para saber si el componente sigue montado
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Función de ejecución — retorna el controller para que useEffect pueda cancelar
  const execute = useCallback((): AbortController => {
    const controller = new AbortController();
    dispatch({ type: 'LOADING' });

    asyncFn(controller.signal)
      .then((data) => {
        if (mountedRef.current && !controller.signal.aborted)
          dispatch({ type: 'SUCCESS', payload: data });
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return; // Cancelación intencional — no es error
        if (mountedRef.current)
          dispatch({ type: 'ERROR', payload: error });
      });

    return controller;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Ejecución automática al montar / cambiar deps (si no es lazy)
  useEffect(() => {
    if (lazy) return;
    const controller = execute();
    return () => controller.abort(); // Cancelar si el componente desmonta o deps cambian
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lazy, ...deps]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return {
    ...state,
    execute: () => execute(),
    reset,
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError:   state.status === 'error',
  };
}

// ============================================================
// Uso — Modo automático
// ============================================================
/*
function PerfilUsuario({ userId }: { userId: number }) {
  const { data: user, isLoading, isError, error } = useAsync(
    (signal) => fetch(`/api/usuarios/${userId}`, { signal }).then(r => r.json()),
    [userId]
  );

  if (isLoading) return <Spinner />;
  if (isError)   return <p>Error: {error?.message}</p>;
  return <div>{user?.nombre}</div>;
}

// ============================================================
// Uso — Modo lazy (submit)
// ============================================================
function FormularioPedido() {
  const [formData, setFormData] = useState({ ... });

  const { execute: enviar, isLoading, isSuccess } = useAsync(
    (signal) => fetch('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify(formData),
      signal,
    }).then(r => r.json()),
    [],
    { lazy: true }
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); enviar(); }}>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Enviando...' : 'Crear Pedido'}
      </button>
      {isSuccess && <p>¡Pedido creado exitosamente!</p>}
    </form>
  );
}
*/
```

**Complejidad**: O(1) por render, el estado se actualiza en transiciones atómicas

**Variantes a considerar en la entrevista:**
- ¿Por qué `useReducer` en vez de múltiples `useState`? (evita renders con estado inconsistente: con useState separados puedes renderizar `data=undefined, loading=false` entre el `setLoading(false)` y el `setData(result)`)
- ¿Qué problema resuelve el `AbortController`? (en React 18 Strict Mode, los effects se montan/desmontan dos veces en desarrollo — sin cancelación, la segunda llamada sobreescribe la primera; en producción evita memory leaks y setState sobre componentes desmontados)
- ¿Por qué pasar `AbortSignal` a `asyncFn` en vez de cancelar internamente? (el hook no sabe si la función usa fetch, axios, o algo custom — el caller decide cómo propagar la señal)
- ¿Cuándo usarías React Query en vez de este hook? (cuando necesitas caché entre componentes, deduplicación de requests, revalidación en foco, optimistic updates, o sincronización entre pestañas)
- ¿Cómo agregarías soporte para reintentos automáticos? (contador de reintentos en el reducer; en el catch, si no es `AbortError` y `intentos < maxReintentos`, volver a llamar `asyncFn`)

</details>
