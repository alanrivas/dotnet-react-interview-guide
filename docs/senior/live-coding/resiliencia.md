---
title: "🛡️ Resiliencia y Tolerancia a Fallos"
sidebar_position: 1
---

# 🛡️ Resiliencia y Tolerancia a Fallos

Ejercicios de patrones que permiten a un sistema degradarse de forma controlada ante fallos externos.

| Ejercicio | Dificultad | Tiempo |
|---|---|---|
| Circuit Breaker | 🔴 Difícil | 30 min |
| Distributed Lock con Redis | 🔴 Difícil | 30 min |
| Retry con Exponential Backoff y Jitter | 🔴 Difícil | 20 min |

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
