---
id: concurrencia
title: Concurrencia y Paralelismo
sidebar_position: 6
---

# Concurrencia y Paralelismo 🔴

## Conceptos fundamentales

```
Concurrencia:  múltiples tareas en progreso al mismo tiempo (pueden intercalarse)
Paralelismo:   múltiples tareas ejecutándose FÍSICAMENTE al mismo tiempo (multi-core)

Concurrencia sin paralelismo: single-core con context switching
Paralelismo sin concurrencia: múltiples cores haciendo una sola tarea (SIMD)

Asíncrono:     liberar el hilo mientras espera I/O (no bloquear)
Multithreading: múltiples hilos ejecutando código simultáneamente
```

---

## Threading en .NET

```csharp
// Thread — nivel más bajo (evitar en app code)
var hilo = new Thread(() =>
{
    Console.WriteLine($"Hilo {Thread.CurrentThread.ManagedThreadId}");
});
hilo.Start();
hilo.Join(); // esperar a que termine

// ThreadPool — mejor que Thread, reutiliza hilos
ThreadPool.QueueUserWorkItem(_ =>
{
    Console.WriteLine("En el ThreadPool");
});

// Task — abstracción recomendada sobre ThreadPool
var tarea = Task.Run(() => CalcularAlgoHeavy());
var resultado = await tarea;

// Parallel.ForEach — paralelismo de datos
Parallel.ForEach(lista, new ParallelOptions { MaxDegreeOfParallelism = 4 }, item =>
{
    ProcesarItem(item); // corre en paralelo
});

// PLINQ — paralelismo con LINQ
var resultados = lista
    .AsParallel()
    .WithDegreeOfParallelism(4)
    .Where(x => x.Activo)
    .Select(x => Procesar(x))
    .ToList();
```

---

## Race Conditions

Una race condition ocurre cuando el resultado depende del orden no determinístico de ejecución.

```csharp
// ❌ Race condition: dos hilos modifican la misma variable
int contador = 0;

var tareas = Enumerable.Range(0, 1000).Select(_ =>
    Task.Run(() => contador++) // NO es thread-safe
);
await Task.WhenAll(tareas);
Console.WriteLine(contador); // Podría ser < 1000!

// ¿Por qué? contador++ es 3 operaciones:
// 1. Leer contador (ej: 500)
// 2. Sumar 1 (501)
// 3. Escribir 501
// Dos hilos pueden leer 500 al mismo tiempo → ambos escriben 501

// ✅ Solución 1: Interlocked (más eficiente para operaciones simples)
int contadorSeguro = 0;
var tareas2 = Enumerable.Range(0, 1000).Select(_ =>
    Task.Run(() => Interlocked.Increment(ref contadorSeguro))
);
await Task.WhenAll(tareas2);
Console.WriteLine(contadorSeguro); // siempre 1000

// ✅ Solución 2: lock
int contadorLock = 0;
readonly object _lock = new();

Task.Run(() =>
{
    lock (_lock) // solo un hilo a la vez entra aquí
    {
        contadorLock++;
    }
});
```

---

## Locks y Sincronización

```csharp
// SemaphoreSlim — limitar concurrencia
public class ProductoService
{
    private static readonly SemaphoreSlim _semaforo = new(initialCount: 5);

    public async Task<Producto> ObtenerConRateLimitAsync(int id)
    {
        await _semaforo.WaitAsync(); // espera si hay 5 en ejecución
        try
        {
            return await _httpClient.GetFromJsonAsync<Producto>($"/api/{id}");
        }
        finally
        {
            _semaforo.Release();
        }
    }
}

// ReaderWriterLockSlim — múltiples lectores, un escritor
public class Cache<T>
{
    private readonly Dictionary<string, T> _datos = new();
    private readonly ReaderWriterLockSlim _lock = new();

    public T? Obtener(string clave)
    {
        _lock.EnterReadLock(); // múltiples lectores simultáneos
        try
        {
            return _datos.TryGetValue(clave, out var valor) ? valor : default;
        }
        finally { _lock.ExitReadLock(); }
    }

    public void Guardar(string clave, T valor)
    {
        _lock.EnterWriteLock(); // exclusivo, bloquea lectores
        try
        {
            _datos[clave] = valor;
        }
        finally { _lock.ExitWriteLock(); }
    }
}

// Mutex — exclusión mutua entre PROCESOS (no solo hilos)
using var mutex = new Mutex(false, "Global\\MiApp");
if (mutex.WaitOne(TimeSpan.Zero))
{
    // Solo una instancia de la app puede entrar aquí
    try { EjecutarApp(); }
    finally { mutex.ReleaseMutex(); }
}
```

---

## Deadlocks

Un deadlock ocurre cuando dos o más hilos esperan recursos que el otro tiene.

```csharp
// ❌ Potencial deadlock: dos locks en orden inverso
object lockA = new(), lockB = new();

// Hilo 1
Task.Run(() => {
    lock (lockA) {
        Thread.Sleep(100);
        lock (lockB) { /* ... */ } // espera a lockB
    }
});

// Hilo 2
Task.Run(() => {
    lock (lockB) {
        Thread.Sleep(100);
        lock (lockA) { /* ... */ } // espera a lockA → DEADLOCK
    }
});

// ✅ Prevención: siempre adquirir locks en el mismo orden
// Siempre: lock(lockA) → lock(lockB), nunca al revés

// ❌ Deadlock con async/await (clásico en apps pre-Core)
var resultado = servicio.ObtenerAsync().Result; // .Result en UI thread = deadlock
// porque el async intenta volver al UI thread que está bloqueado esperando .Result

// ✅ Siempre: await en vez de .Result o .Wait()
var resultado = await servicio.ObtenerAsync();
```

---

## ConcurrentCollections

```csharp
// Thread-safe por diseño — no necesitas lock
using System.Collections.Concurrent;

// ConcurrentDictionary
var dic = new ConcurrentDictionary<string, int>();
dic.TryAdd("clave", 1);
dic.AddOrUpdate("clave", 1, (k, old) => old + 1);
dic.GetOrAdd("clave", k => ComputarValor(k));

// ConcurrentQueue (FIFO)
var cola = new ConcurrentQueue<string>();
cola.Enqueue("item");
if (cola.TryDequeue(out var item)) { /* ... */ }

// ConcurrentBag (sin orden garantizado)
var bag = new ConcurrentBag<int>();
bag.Add(1);

// BlockingCollection — producer/consumer pattern
var buffer = new BlockingCollection<Tarea>(boundedCapacity: 100);

// Producer
Task.Run(async () => {
    foreach (var tarea in tareas) {
        buffer.Add(tarea);
        await Task.Delay(10);
    }
    buffer.CompleteAdding();
});

// Consumer
Task.Run(() => {
    foreach (var tarea in buffer.GetConsumingEnumerable()) {
        ProcesarTarea(tarea);
    }
});
```

---

## async/await — Detalles internos

```csharp
// ConfigureAwait
public async Task<string> ObtenerEnLibreriaAsync()
{
    // .ConfigureAwait(false) en library code:
    // No intenta volver al SynchronizationContext original
    // Más eficiente, evita deadlocks en contextos que tienen SynchronizationContext
    var datos = await _httpClient.GetStringAsync(url).ConfigureAwait(false);
    return datos.ToUpper(); // puede ejecutarse en cualquier hilo del pool
}

// ValueTask — cuando el resultado frecuentemente es síncrono
public ValueTask<int> ObtenerDeCache(string key)
{
    if (_cache.TryGetValue(key, out int valor))
        return ValueTask.FromResult(valor); // sin allocación de Task

    return new ValueTask<int>(ObtenerDeBDAsync(key)); // solo cuando es async
}

// IAsyncEnumerable — streaming de datos
public async IAsyncEnumerable<Evento> StreamEventosAsync(
    [EnumeratorCancellation] CancellationToken ct = default)
{
    await foreach (var evento in _messageQueue.ReadAllAsync(ct))
    {
        yield return evento;
    }
}

// Consumir el stream
await foreach (var evento in servicio.StreamEventosAsync(ct))
{
    await ProcesarEventoAsync(evento);
}
```

---

## Channel — Producer/Consumer moderno

```csharp
// Channel<T>: alternativa moderna y eficiente a BlockingCollection
var channel = Channel.CreateBounded<Pedido>(new BoundedChannelOptions(100)
{
    FullMode = BoundedChannelFullMode.Wait,
    SingleWriter = false,
    SingleReader = false,
});

// Producer
async Task ProducirAsync(CancellationToken ct)
{
    await foreach (var pedido in ObtenerPedidosStream(ct))
    {
        await channel.Writer.WriteAsync(pedido, ct);
    }
    channel.Writer.Complete();
}

// Consumer
async Task ConsumirAsync(CancellationToken ct)
{
    await foreach (var pedido in channel.Reader.ReadAllAsync(ct))
    {
        await ProcesarPedidoAsync(pedido);
    }
}
```

---

## Preguntas frecuentes 🎯

**1. ¿Cuál es la diferencia entre `Task.Run` y `await`?**
> `Task.Run` envía trabajo al ThreadPool (CPU-bound). `await` libera el hilo actual mientras espera I/O (I/O-bound). Para operaciones de red/DB: `await`, no `Task.Run`. Para trabajo CPU intenso: `Task.Run`.

**2. ¿Qué es un deadlock y cómo lo prevenirías?**
> Dos hilos esperándose mutuamente. Prevención: adquirir locks siempre en el mismo orden, usar `async/await` en vez de `.Result`/`.Wait()`, usar `CancellationToken` con timeout.

**3. ¿Cuándo usarías `Parallel.ForEach` vs `Task.WhenAll`?**
> `Parallel.ForEach`: operaciones CPU-bound síncronas sobre una colección. `Task.WhenAll`: operaciones I/O-bound asíncronas en paralelo. Para I/O (llamadas HTTP, DB), siempre `Task.WhenAll` con las tasks asíncronas.

**4. ¿Qué es thread safety y cómo garantizarla?**
> Que el código funciona correctamente con múltiples hilos concurrentes. Se garantiza con: `Interlocked` para contadores, `lock` para secciones críticas, `ConcurrentDictionary`/`ConcurrentQueue`, o diseñando objetos inmutables (la mejor opción).
