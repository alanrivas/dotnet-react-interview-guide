---
id: live-coding
title: 💻 Live Coding — Semi-Senior
sidebar_position: 100
---

# 💻 Live Coding — Semi-Senior

Ejercicios para posiciones Semi-Senior. Se espera que reconozcas patrones, apliques principios SOLID y puedas razonar sobre rendimiento y escalabilidad.

:::tip Consejo
En este nivel, el entrevistador evalúa no solo que el código funcione, sino que **conozcas los trade-offs**: complejidad, mantenibilidad, y cómo evolucionaría el diseño con nuevos requisitos.
:::

---

## Ejercicio 1: Rate Limiter Simple

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: concurrencia, Dictionary, DateTime, patrones de diseño

### Enunciado

Implementa un rate limiter en memoria que limite a **N requests por ventana de tiempo por IP**. Si una IP supera el límite, el método debe retornar `false`.

Requisitos:
- Ventana deslizante de tiempo configurable (ej: 10 requests por segundo)
- Thread-safe
- Limpieza automática de entradas antiguas

**Ejemplo:**
- Config: `maxRequests = 3`, `ventana = 1 segundo`
- IP `192.168.1.1` hace 3 requests en 500ms → `true, true, true`
- IP `192.168.1.1` hace el 4° request en 800ms → `false`
- IP `192.168.1.1` hace un request a 1.5s → `true` (ventana expiró)

### Pistas

<details>
<summary>Ver pista 1</summary>

Para la ventana deslizante, necesitas guardar el **timestamp de cada request** por IP, no solo un contador. Así puedes calcular cuántos requests ocurrieron en los últimos N segundos.

</details>

<details>
<summary>Ver pista 2</summary>

Usa `ConcurrentDictionary<string, Queue<DateTime>>`. Cada vez que llega un request, elimina del frente de la cola los timestamps que ya están fuera de la ventana, luego verifica si el tamaño de la cola es menor al límite.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

Implementación con ventana deslizante usando timestamps, thread-safe con `lock`.

```csharp
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;

public class RateLimiter
{
    // Almacena el historial de timestamps por IP
    private readonly ConcurrentDictionary<string, Queue<DateTime>> _historial
        = new ConcurrentDictionary<string, Queue<DateTime>>();

    private readonly int _maxRequests;
    private readonly TimeSpan _ventana;

    // Lock por IP para granularidad fina (mejor que un lock global)
    private readonly ConcurrentDictionary<string, object> _locks
        = new ConcurrentDictionary<string, object>();

    public RateLimiter(int maxRequests, TimeSpan ventana)
    {
        _maxRequests = maxRequests;
        _ventana = ventana;
    }

    /// <summary>
    /// Verifica si una IP puede realizar un request.
    /// Retorna true si está dentro del límite, false si lo supera.
    /// </summary>
    public bool PermitirRequest(string ip)
    {
        var ahora = DateTime.UtcNow;

        // Obtener o crear el lock y la cola para esta IP
        var lockObj = _locks.GetOrAdd(ip, _ => new object());
        var cola = _historial.GetOrAdd(ip, _ => new Queue<DateTime>());

        lock (lockObj)
        {
            // Eliminar timestamps fuera de la ventana de tiempo
            var limiteVentana = ahora - _ventana;
            while (cola.Count > 0 && cola.Peek() <= limiteVentana)
                cola.Dequeue();

            // Verificar si se supera el límite
            if (cola.Count >= _maxRequests)
                return false;

            // Registrar este request
            cola.Enqueue(ahora);
            return true;
        }
    }

    /// <summary>
    /// Retorna cuántos requests quedan disponibles para una IP.
    /// </summary>
    public int RequestsRestantes(string ip)
    {
        if (!_historial.TryGetValue(ip, out var cola))
            return _maxRequests;

        var limiteVentana = DateTime.UtcNow - _ventana;
        int requestsActivos;

        var lockObj = _locks.GetOrAdd(ip, _ => new object());
        lock (lockObj)
        {
            // Limpiar expirados antes de contar
            while (cola.Count > 0 && cola.Peek() <= limiteVentana)
                cola.Dequeue();
            requestsActivos = cola.Count;
        }

        return Math.Max(0, _maxRequests - requestsActivos);
    }

    /// <summary>
    /// Limpieza periódica de IPs inactivas (llamar desde un background service).
    /// </summary>
    public void LimpiarEntradasAntiguas()
    {
        var limite = DateTime.UtcNow - _ventana;

        foreach (var (ip, cola) in _historial)
        {
            var lockObj = _locks.GetOrAdd(ip, _ => new object());
            lock (lockObj)
            {
                while (cola.Count > 0 && cola.Peek() <= limite)
                    cola.Dequeue();

                // Si la cola está vacía, eliminar la entrada del diccionario
                if (cola.Count == 0)
                {
                    _historial.TryRemove(ip, out _);
                    _locks.TryRemove(ip, out _);
                }
            }
        }
    }
}

// Uso:
// var limiter = new RateLimiter(maxRequests: 10, ventana: TimeSpan.FromSeconds(1));
// bool permitido = limiter.PermitirRequest("192.168.1.1");
```

**Complejidad**: Tiempo O(k) por request donde k = requests en la ventana, Espacio O(n×k) donde n = IPs activas

**Variantes a considerar en la entrevista:**
- ¿Cómo lo harías para múltiples instancias del servidor? (Redis con sorted sets, `ZADD` + `ZREMRANGEBYSCORE`)
- ¿Cuál es la diferencia entre ventana fija y ventana deslizante? (ventana fija puede permitir el doble del límite en el borde)
- ¿Cómo lo registrarías como middleware en ASP.NET Core?
- ¿Cómo manejarías el caso de un cliente que hace requests desde múltiples IPs? (rate limiting por usuario/token además de por IP)
- ¿Cómo evitarías memory leaks si hay millones de IPs únicas?

</details>

---

## Ejercicio 2: Caché LRU

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 25 minutos  
**Temas**: Dictionary, LinkedList, patrones de caché, O(1)

### Enunciado

Implementa una caché **LRU (Least Recently Used)** con capacidad máxima configurable. Cuando la caché está llena y se agrega un nuevo elemento, debe eliminarse el que se usó hace más tiempo.

Operaciones requeridas con complejidad O(1):
- `Get(key)`: retorna el valor si existe, -1 si no. Marca el elemento como "recientemente usado"
- `Put(key, value)`: inserta o actualiza. Si la capacidad se supera, evicta el LRU

**Ejemplo:**
```
LRUCache cache = new LRUCache(2);  // capacidad: 2
cache.Put(1, 1);    // cache: {1=1}
cache.Put(2, 2);    // cache: {1=1, 2=2}
cache.Get(1);       // retorna 1. cache: {2=2, 1=1} (1 pasa al frente)
cache.Put(3, 3);    // evicta key 2. cache: {1=1, 3=3}
cache.Get(2);       // retorna -1 (no existe)
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Necesitas dos estructuras: un `Dictionary` para O(1) lookup, y una `LinkedList` para rastrear el orden de uso. El más reciente va al frente, el menos reciente al final.

</details>

<details>
<summary>Ver pista 2</summary>

El Dictionary debe guardar el nodo de la LinkedList, no el valor directamente. Así cuando hagas `Get`, puedes mover el nodo al frente de la lista en O(1) sin buscar.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

La combinación Dictionary + DoublyLinkedList permite O(1) en ambas operaciones.

```csharp
using System.Collections.Generic;

public class CacheLRU<TKey, TValue>
{
    private readonly int _capacidad;

    // Dictionary: key → nodo de la lista (para O(1) lookup)
    private readonly Dictionary<TKey, LinkedListNode<(TKey Key, TValue Value)>> _mapa;

    // LinkedList: mantiene el orden de uso (frente = más reciente, final = LRU)
    private readonly LinkedList<(TKey Key, TValue Value)> _lista;

    public CacheLRU(int capacidad)
    {
        if (capacidad <= 0) throw new ArgumentException("La capacidad debe ser mayor a 0");

        _capacidad = capacidad;
        _mapa = new Dictionary<TKey, LinkedListNode<(TKey, TValue)>>(capacidad);
        _lista = new LinkedList<(TKey, TValue)>();
    }

    /// <summary>O(1) — Obtiene un valor y lo marca como recientemente usado.</summary>
    public TValue Get(TKey key)
    {
        if (!_mapa.TryGetValue(key, out var nodo))
            return default; // Retorna null/0/-1 según el tipo

        // Mover al frente de la lista (más recientemente usado)
        MoverAlFrente(nodo);

        return nodo.Value.Value;
    }

    /// <summary>O(1) — Inserta o actualiza un valor. Evicta el LRU si es necesario.</summary>
    public void Put(TKey key, TValue value)
    {
        if (_mapa.TryGetValue(key, out var nodoExistente))
        {
            // Actualizar valor del nodo existente y moverlo al frente
            // Los valores de LinkedListNode no son mutables, así que removemos y re-insertamos
            _lista.Remove(nodoExistente);
            var nodoActualizado = _lista.AddFirst((key, value));
            _mapa[key] = nodoActualizado;
            return;
        }

        // Si la caché está llena, evictar el menos recientemente usado (último de la lista)
        if (_mapa.Count >= _capacidad)
            EvictarLRU();

        // Insertar el nuevo elemento al frente
        var nuevoNodo = _lista.AddFirst((key, value));
        _mapa[key] = nuevoNodo;
    }

    private void MoverAlFrente(LinkedListNode<(TKey Key, TValue Value)> nodo)
    {
        if (_lista.First == nodo) return; // Ya está al frente

        _lista.Remove(nodo);
        _lista.AddFirst(nodo);
    }

    private void EvictarLRU()
    {
        // El último elemento es el menos recientemente usado
        var lru = _lista.Last;
        if (lru == null) return;

        _mapa.Remove(lru.Value.Key);
        _lista.RemoveLast();
    }

    public int Count => _mapa.Count;
    public bool ContainsKey(TKey key) => _mapa.ContainsKey(key);
}

// Versión simplificada con int (típica de LeetCode)
public class LRUCacheInt
{
    private readonly int _capacidad;
    private readonly Dictionary<int, LinkedListNode<(int key, int val)>> _mapa;
    private readonly LinkedList<(int key, int val)> _lista;

    public LRUCacheInt(int capacity)
    {
        _capacidad = capacity;
        _mapa = new Dictionary<int, LinkedListNode<(int, int)>>();
        _lista = new LinkedList<(int, int)>();
    }

    public int Get(int key)
    {
        if (!_mapa.TryGetValue(key, out var nodo)) return -1;

        _lista.Remove(nodo);
        var nuevoNodo = _lista.AddFirst((key, nodo.Value.val));
        _mapa[key] = nuevoNodo;

        return nodo.Value.val;
    }

    public void Put(int key, int value)
    {
        if (_mapa.TryGetValue(key, out var nodoExistente))
            _lista.Remove(nodoExistente);
        else if (_mapa.Count >= _capacidad)
        {
            _mapa.Remove(_lista.Last!.Value.key);
            _lista.RemoveLast();
        }

        _mapa[key] = _lista.AddFirst((key, value));
    }
}
```

**Complejidad**: Tiempo O(1) para Get y Put, Espacio O(capacidad)

**Variantes a considerar en la entrevista:**
- ¿Cómo lo harías thread-safe? (añadir `lock` o usar `ReaderWriterLockSlim` para mejor concurrencia en reads)
- ¿Cómo agregarías expiración por tiempo (TTL) además del LRU? (guardar timestamp de inserción en el nodo)
- ¿Cómo implementarías LFU (Least Frequently Used) en vez de LRU? (más complejo: Dictionary de frecuencias + LinkedList por frecuencia)
- ¿Qué ventaja tiene esta implementación sobre simplemente usar `OrderedDictionary`?
- .NET 6+ tiene `System.Runtime.Caching.MemoryCache` — ¿cuándo implementarías el tuyo propio?

</details>

---

## Ejercicio 3: Refactoring con SOLID

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: SOLID, SRP, DI, Clean Code

### Enunciado

Dado el siguiente método `ProcessOrder()` que viola el principio de responsabilidad única (SRP), refactorizarlo aplicando SOLID y separando responsabilidades.

```csharp
// CÓDIGO A REFACTORIZAR — No modifiques esto, solo explica los problemas y escribe la versión mejorada
public class OrderService
{
    public void ProcessOrder(Order order)
    {
        // Validación
        if (order == null) throw new Exception("Order is null");
        if (order.Items == null || !order.Items.Any()) throw new Exception("No items");
        if (order.CustomerId <= 0) throw new Exception("Invalid customer");

        // Cálculo de totales
        decimal subtotal = order.Items.Sum(i => i.Price * i.Quantity);
        decimal tax = subtotal * 0.21m;
        decimal discount = order.Items.Count > 5 ? subtotal * 0.10m : 0;
        decimal total = subtotal + tax - discount;
        order.Total = total;

        // Persistencia directa a BD
        using var conn = new SqlConnection("Server=...;Database=...;");
        conn.Open();
        conn.Execute("INSERT INTO Orders VALUES (@Id, @Total, @Date)",
            new { order.Id, order.Total, Date = DateTime.Now });

        // Envío de email
        var smtp = new SmtpClient("smtp.server.com");
        var msg = new MailMessage("noreply@shop.com", order.CustomerEmail);
        msg.Subject = "Order confirmed";
        msg.Body = $"Your order #{order.Id} for ${total} has been confirmed.";
        smtp.Send(msg);

        // Log
        File.AppendAllText("orders.log", $"{DateTime.Now}: Order {order.Id} processed\n");
    }
}
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Identifica cuántas razones tiene esta clase para cambiar: si cambia la lógica de cálculo, si cambia la BD, si cambia el proveedor de email, si cambia el formato del log... Cada una de esas razones es una responsabilidad que debería estar en una clase separada.

</details>

<details>
<summary>Ver pista 2</summary>

Define interfaces para cada responsabilidad (`IOrderValidator`, `IOrderCalculator`, `IOrderRepository`, `IEmailService`, `ILogger`) e inyéctalas en el constructor. Esto también facilita el testing con mocks.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

Identificar responsabilidades, definir interfaces, implementar, e inyectar via constructor.

```csharp
// ============================================================
// PASO 1: Identificar las responsabilidades y definir interfaces
// ============================================================

// Responsabilidad 1: Validación de pedidos
public interface IOrderValidator
{
    void Validar(Order order);  // Lanza excepción si no es válido
}

// Responsabilidad 2: Cálculo de totales
public interface IOrderCalculator
{
    OrderTotals Calcular(Order order);
}

// Responsabilidad 3: Persistencia
public interface IOrderRepository
{
    Task GuardarAsync(Order order);
}

// Responsabilidad 4: Notificaciones
public interface IEmailService
{
    Task EnviarConfirmacionAsync(Order order);
}

// Responsabilidad 5: Logging (usar ILogger<T> de Microsoft.Extensions.Logging)

// ============================================================
// PASO 2: Value object para los resultados del cálculo
// ============================================================

public record OrderTotals(decimal Subtotal, decimal Impuesto, decimal Descuento, decimal Total);

// ============================================================
// PASO 3: Implementaciones concretas
// ============================================================

public class OrderValidator : IOrderValidator
{
    public void Validar(Order order)
    {
        if (order == null)
            throw new ArgumentNullException(nameof(order));
        if (order.Items == null || !order.Items.Any())
            throw new InvalidOperationException("El pedido no tiene ítems");
        if (order.CustomerId <= 0)
            throw new InvalidOperationException("El cliente no es válido");
    }
}

public class OrderCalculator : IOrderCalculator
{
    private const decimal TasaImpuesto = 0.21m;
    private const decimal PorcentajeDescuento = 0.10m;
    private const int MinItemsParaDescuento = 5;

    public OrderTotals Calcular(Order order)
    {
        decimal subtotal = order.Items.Sum(i => i.Price * i.Quantity);
        decimal impuesto = subtotal * TasaImpuesto;
        decimal descuento = order.Items.Count > MinItemsParaDescuento
            ? subtotal * PorcentajeDescuento
            : 0m;
        decimal total = subtotal + impuesto - descuento;

        return new OrderTotals(subtotal, impuesto, descuento, total);
    }
}

// ============================================================
// PASO 4: OrderService refactorizado — solo orquesta el flujo
// ============================================================

public class OrderService
{
    private readonly IOrderValidator _validator;
    private readonly IOrderCalculator _calculator;
    private readonly IOrderRepository _repository;
    private readonly IEmailService _emailService;
    private readonly ILogger<OrderService> _logger;

    // Inyección de dependencias por constructor (facilita testing con mocks)
    public OrderService(
        IOrderValidator validator,
        IOrderCalculator calculator,
        IOrderRepository repository,
        IEmailService emailService,
        ILogger<OrderService> logger)
    {
        _validator = validator;
        _calculator = calculator;
        _repository = repository;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task ProcessOrderAsync(Order order)
    {
        // 1. Validar
        _validator.Validar(order);

        // 2. Calcular totales
        var totales = _calculator.Calcular(order);
        order.Total = totales.Total;

        // 3. Persistir
        await _repository.GuardarAsync(order);

        // 4. Notificar
        await _emailService.EnviarConfirmacionAsync(order);

        // 5. Registrar
        _logger.LogInformation(
            "Pedido {OrderId} procesado. Total: {Total:C}",
            order.Id, order.Total);
    }
}

// ============================================================
// PASO 5: Registro en el contenedor de DI (Program.cs)
// ============================================================
/*
builder.Services.AddScoped<IOrderValidator, OrderValidator>();
builder.Services.AddScoped<IOrderCalculator, OrderCalculator>();
builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
*/
```

**Complejidad**: No aplica — es un ejercicio de diseño

**Variantes a considerar en la entrevista:**
- ¿Cómo testearías la nueva versión? (mock de las dependencias, cada clase se testa aislada)
- ¿Por qué inyectar interfaces en vez de clases concretas? (principio de inversión de dependencias, facilita cambios y testing)
- ¿Dónde aplicarías el patrón Decorator para agregar logging sin modificar `OrderService`?
- ¿Cuándo usarías `AddScoped` vs `AddSingleton` vs `AddTransient`?
- ¿Cómo agregarías manejo transaccional para que si el email falla, se haga rollback de la BD?

</details>

---

## Ejercicio 4: API REST con Validación

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: ASP.NET Core, validación, ProblemDetails, manejo de errores

### Enunciado

Implementa un endpoint `POST /api/pedidos` en ASP.NET Core que:
- Reciba un DTO con validación robusta
- Retorne `201 Created` con el pedido creado
- Retorne `400 Bad Request` con `ProblemDetails` si la validación falla
- Retorne `409 Conflict` si el pedido ya existe
- Use FluentValidation o DataAnnotations

**DTO de entrada:**
```json
{
  "clienteId": 123,
  "items": [
    { "productoId": 1, "cantidad": 2 }
  ],
  "direccionEntrega": "Calle Mayor 1, Madrid"
}
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `[ApiController]` en el controlador — esto activa la validación automática de modelos y retorna `400` con `ValidationProblemDetails` cuando `ModelState` no es válido.

</details>

<details>
<summary>Ver pista 2</summary>

Para `ProblemDetails` personalizado, usa `Problem()` o `ValidationProblem()` del `ControllerBase`. Para conflictos, usa `Conflict(new ProblemDetails { ... })`.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
// ============================================================
// DTOs con validación via DataAnnotations
// ============================================================

public class CrearPedidoRequest
{
    [Required(ErrorMessage = "El ID de cliente es requerido")]
    [Range(1, int.MaxValue, ErrorMessage = "El ID de cliente debe ser mayor a 0")]
    public int ClienteId { get; set; }

    [Required(ErrorMessage = "Debe incluir al menos un ítem")]
    [MinLength(1, ErrorMessage = "Debe incluir al menos un ítem")]
    public List<ItemPedidoRequest> Items { get; set; } = new();

    [Required(ErrorMessage = "La dirección de entrega es requerida")]
    [StringLength(200, MinimumLength = 10, ErrorMessage = "La dirección debe tener entre 10 y 200 caracteres")]
    public string DireccionEntrega { get; set; } = string.Empty;
}

public class ItemPedidoRequest
{
    [Required]
    [Range(1, int.MaxValue, ErrorMessage = "El ID de producto debe ser mayor a 0")]
    public int ProductoId { get; set; }

    [Range(1, 100, ErrorMessage = "La cantidad debe estar entre 1 y 100")]
    public int Cantidad { get; set; }
}

// ============================================================
// Controlador
// ============================================================

[ApiController]
[Route("api/[controller]")]
public class PedidosController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<PedidosController> _logger;

    public PedidosController(IOrderService orderService, ILogger<PedidosController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }

    /// <summary>Crea un nuevo pedido.</summary>
    /// <response code="201">Pedido creado exitosamente</response>
    /// <response code="400">Datos de entrada inválidos</response>
    /// <response code="409">El pedido ya existe</response>
    [HttpPost]
    [ProducesResponseType(typeof(PedidoResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CrearPedido([FromBody] CrearPedidoRequest request)
    {
        // Si [ApiController] está activo, ModelState se valida automáticamente
        // y retorna 400 antes de llegar aquí si hay errores.
        // Pero podemos agregar validaciones de negocio adicionales:

        try
        {
            var pedido = await _orderService.CrearPedidoAsync(request);

            // 201 Created con la URL del recurso creado
            return CreatedAtAction(
                nameof(ObtenerPedido),
                new { id = pedido.Id },
                pedido
            );
        }
        catch (PedidoDuplicadoException ex)
        {
            // 409 Conflict con ProblemDetails
            return Conflict(new ProblemDetails
            {
                Title = "Pedido duplicado",
                Detail = ex.Message,
                Status = StatusCodes.Status409Conflict,
                Instance = HttpContext.Request.Path
            });
        }
        catch (ClienteNoEncontradoException ex)
        {
            // 404 Not Found
            return NotFound(new ProblemDetails
            {
                Title = "Cliente no encontrado",
                Detail = ex.Message,
                Status = StatusCodes.Status404NotFound
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> ObtenerPedido(int id)
    {
        var pedido = await _orderService.ObtenerPorIdAsync(id);
        return pedido is null ? NotFound() : Ok(pedido);
    }
}

// ============================================================
// Configuración en Program.cs para ProblemDetails consistente
// ============================================================
/*
builder.Services.AddProblemDetails();

// Personalizar la respuesta de validación automática de [ApiController]
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var problemDetails = new ValidationProblemDetails(context.ModelState)
        {
            Title = "Error de validación",
            Status = StatusCodes.Status400BadRequest,
            Instance = context.HttpContext.Request.Path
        };
        return new BadRequestObjectResult(problemDetails)
        {
            ContentTypes = { "application/problem+json" }
        };
    };
});
*/
```

**Complejidad**: No aplica — es diseño de API

**Variantes a considerar en la entrevista:**
- ¿Cuándo usarías FluentValidation vs DataAnnotations? (FluentValidation para reglas complejas o que requieren DI, DataAnnotations para validaciones simples)
- ¿Qué es RFC 7807 y cómo lo implementa `ProblemDetails`?
- ¿Cómo agregarías validación de autorización (el cliente solo puede crear pedidos para sí mismo)?
- ¿Cómo implementarías idempotencia en este endpoint? (header `Idempotency-Key`, guardar en caché/BD)
- ¿Cómo documentarías este endpoint con Swagger/OpenAPI?

</details>

---

## Ejercicio 5: Custom Hook — useFetch

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: React Hooks, TypeScript generics, AbortController, estados asíncronos

### Enunciado

Implementa un custom hook genérico `useFetch<T>(url: string)` que:
- Maneje los estados `loading`, `data`, y `error`
- Cancele el request si el componente se desmonta (AbortController)
- Re-ejecute el fetch cuando cambie la URL
- Sea completamente tipado con TypeScript generics

**Ejemplo de uso:**
```typescript
const { data, loading, error } = useFetch<User[]>('/api/users');
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `useEffect` para ejecutar el fetch. La función de limpieza del efecto (`return () => {...}`) es donde debes abortar el request con `controller.abort()`.

</details>

<details>
<summary>Ver pista 2</summary>

Si el componente se desmonta mientras el fetch está pendiente, no debes llamar a `setState` (causará un warning de memory leak). El `AbortController` cancela el request y el error de `AbortError` debe ignorarse.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```typescript
// hooks/useFetch.ts
import { useState, useEffect, useCallback } from 'react';

// Estado del hook con discriminated union para mejor type safety
type FetchState<T> =
  | { status: 'idle';    data: null;    error: null }
  | { status: 'loading'; data: null;    error: null }
  | { status: 'success'; data: T;       error: null }
  | { status: 'error';   data: null;    error: Error };

// Opciones adicionales del hook
interface UseFetchOptions extends RequestInit {
  enabled?: boolean;  // Permite deshabilitar el fetch condicionalmente
}

// Tipo de retorno explícito para mejor DX (developer experience)
interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

function useFetch<T>(url: string, options?: UseFetchOptions): UseFetchResult<T> {
  const { enabled = true, ...fetchOptions } = options ?? {};

  const [state, setState] = useState<FetchState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });

  // Contador para forzar re-fetch manual
  const [refetchIndex, setRefetchIndex] = useState(0);

  const refetch = useCallback(() => {
    setRefetchIndex(prev => prev + 1);
  }, []);

  useEffect(() => {
    // No ejecutar si está deshabilitado
    if (!enabled) return;

    // Crear AbortController para poder cancelar el request
    const controller = new AbortController();
    const { signal } = controller;

    const fetchData = async () => {
      setState({ status: 'loading', data: null, error: null });

      try {
        const response = await fetch(url, { ...fetchOptions, signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json: T = await response.json();

        // Solo actualizar estado si el request no fue cancelado
        if (!signal.aborted) {
          setState({ status: 'success', data: json, error: null });
        }
      } catch (err) {
        // Ignorar errores de cancelación (AbortError)
        if (err instanceof Error && err.name === 'AbortError') return;

        if (!signal.aborted) {
          setState({
            status: 'error',
            data: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    };

    fetchData();

    // Función de limpieza: cancelar el request al desmontar o cambiar URL
    return () => {
      controller.abort();
    };
  }, [url, enabled, refetchIndex]); // Re-ejecutar cuando cambie la URL

  return {
    data: state.data,
    loading: state.status === 'loading',
    error: state.error,
    refetch,
  };
}

export default useFetch;

// ============================================================
// Uso del hook en un componente
// ============================================================
/*
interface Usuario {
  id: number;
  nombre: string;
  email: string;
}

function ListaUsuarios() {
  const { data: usuarios, loading, error, refetch } = useFetch<Usuario[]>('/api/usuarios');

  if (loading) return <div>Cargando...</div>;
  if (error)   return <div>Error: {error.message} <button onClick={refetch}>Reintentar</button></div>;
  if (!usuarios) return null;

  return (
    <ul>
      {usuarios.map(u => <li key={u.id}>{u.nombre}</li>)}
    </ul>
  );
}
*/
```

**Complejidad**: No aplica — es un hook de React

**Variantes a considerar en la entrevista:**
- ¿Cómo agregarías caché para no re-fetchear la misma URL? (con `useRef` o context, o usar React Query directamente)
- ¿Cómo manejarías reintentos automáticos con exponential backoff?
- ¿Por qué no incluir `fetchOptions` en el array de dependencias del `useEffect`? (causaría bucle infinito si el objeto se recrea cada render)
- ¿Cuándo preferirías usar React Query o SWR en vez de un hook propio?
- ¿Cómo testearías este hook? (`renderHook` de Testing Library + `msw` para mockear fetch)

</details>

---

## Ejercicio 6: Debounce y Throttle

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: TypeScript, closures, timers, React hooks

### Enunciado

Implementa las funciones `debounce` y `throttle` desde cero en TypeScript. Luego aplica debounce en un input de búsqueda en React.

- **Debounce**: ejecuta la función solo después de que hayan pasado N ms sin que se vuelva a llamar
- **Throttle**: ejecuta la función como máximo una vez cada N ms, sin importar cuántas veces se llame

**Ejemplo:**
- Debounce(200ms): llamadas a 0ms, 100ms, 300ms → se ejecuta solo a 500ms (300+200)
- Throttle(200ms): llamadas a 0ms, 100ms, 300ms → se ejecuta a 0ms y 300ms

### Pistas

<details>
<summary>Ver pista 1</summary>

Debounce usa `setTimeout` y `clearTimeout`. Cada vez que se llama la función, cancela el timer anterior y crea uno nuevo.

</details>

<details>
<summary>Ver pista 2</summary>

Throttle guarda el timestamp de la última ejecución. Si el tiempo desde la última ejecución es mayor al delay, ejecuta y actualiza el timestamp.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```typescript
// utils/debounce-throttle.ts

// ============================================================
// DEBOUNCE: espera que el usuario "pare" antes de ejecutar
// ============================================================
function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    // Cancelar el timer anterior si existe
    if (timerId !== null) clearTimeout(timerId);

    // Crear nuevo timer: ejecutar fn después de 'delay' ms de inactividad
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
    }, delay);
  };
}

// Versión con cancelación y flush explícitos
function debounceAvanzado<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
) {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn(...args);
      timerId = null;
      lastArgs = null;
    }, delay);
  };

  // Cancelar el timer pendiente sin ejecutar
  debouncedFn.cancel = () => {
    if (timerId !== null) clearTimeout(timerId);
    timerId = null;
  };

  // Ejecutar inmediatamente con los últimos args
  debouncedFn.flush = () => {
    if (timerId !== null && lastArgs !== null) {
      clearTimeout(timerId);
      fn(...lastArgs);
      timerId = null;
      lastArgs = null;
    }
  };

  return debouncedFn;
}

// ============================================================
// THROTTLE: ejecuta como máximo una vez cada N ms
// ============================================================
function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let ultimaEjecucion = 0;

  return function (...args: Parameters<T>) {
    const ahora = Date.now();

    // Solo ejecutar si ha pasado suficiente tiempo desde la última vez
    if (ahora - ultimaEjecucion >= limit) {
      ultimaEjecucion = ahora;
      fn(...args);
    }
  };
}

// ============================================================
// APLICACIÓN EN REACT: Input de búsqueda con debounce
// ============================================================
import React, { useState, useCallback, useRef } from 'react';

function BuscadorConDebounce() {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  // useRef para mantener la función debounced estable entre renders
  // (no recrearla en cada render como haría useCallback)
  const buscarDebounced = useRef(
    debounce(async (termino: string) => {
      if (!termino.trim()) {
        setResultados([]);
        return;
      }

      setCargando(true);
      try {
        const res = await fetch(`/api/buscar?q=${encodeURIComponent(termino)}`);
        const data = await res.json();
        setResultados(data.resultados);
      } finally {
        setCargando(false);
      }
    }, 300) // Esperar 300ms tras el último keystroke
  ).current;

  const manejarCambio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setQuery(valor);       // Actualizar UI inmediatamente
    buscarDebounced(valor); // Buscar con debounce
  };

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={manejarCambio}
        placeholder="Buscar..."
      />
      {cargando && <span>Buscando...</span>}
      <ul>
        {resultados.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  );
}

export { debounce, throttle, debounceAvanzado };
```

**Complejidad**: Tiempo O(1) por llamada, Espacio O(1)

**Variantes a considerar en la entrevista:**
- ¿Cuándo usarías debounce vs throttle? (debounce: búsqueda/autoguardado; throttle: scroll/resize/mouse move)
- ¿Por qué usar `useRef` en vez de `useCallback` para la función debounced?
- ¿Cómo agregarías ejecución inmediata en debounce (ejecutar en el leading edge, no trailing)?
- ¿Cómo testearías estas funciones? (`jest.useFakeTimers()` para controlar el tiempo)
- ¿Qué diferencia hay con `requestAnimationFrame` para throttle de animaciones?

</details>

---

## Ejercicio 7: Query SQL con Window Functions

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: SQL, window functions, LAG, CTEs, análisis de datos

### Enunciado

Dado el historial de ventas mensuales por vendedor, calcular el **crecimiento porcentual mes a mes** para cada vendedor. Si no hay mes anterior, mostrar `NULL`.

```sql
CREATE TABLE VentasMensuales (
    VendedorId   INT,
    NombreVendedor VARCHAR(100),
    Anio         INT,
    Mes          INT,
    TotalVentas  DECIMAL(12,2)
);
```

**Ejemplo de salida esperada:**
```
| Vendedor | Año  | Mes | Ventas    | VentasMesAnterior | CrecimientoPct |
|----------|------|-----|-----------|-------------------|----------------|
| Ana      | 2024 | 1   | 10000.00  | NULL              | NULL           |
| Ana      | 2024 | 2   | 12000.00  | 10000.00          | 20.00%         |
| Ana      | 2024 | 3   | 11000.00  | 12000.00          | -8.33%         |
```

### Pistas

<details>
<summary>Ver pista 1</summary>

`LAG(columna, 1) OVER (PARTITION BY VendedorId ORDER BY Anio, Mes)` te da el valor de la fila anterior dentro del mismo vendedor, ordenado cronológicamente.

</details>

<details>
<summary>Ver pista 2</summary>

Para el crecimiento porcentual: `(VentasActuales - VentasAnteriores) / VentasAnteriores * 100`. Usa `NULLIF(VentasAnteriores, 0)` para evitar división por cero.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```sql
-- ============================================================
-- Solución con LAG() y CTE
-- ============================================================
WITH VentasConAnterior AS (
    SELECT
        NombreVendedor,
        Anio,
        Mes,
        TotalVentas,
        -- LAG obtiene el valor de la fila anterior en la misma partición
        LAG(TotalVentas, 1) OVER (
            PARTITION BY VendedorId      -- Separar por vendedor
            ORDER BY Anio, Mes           -- Ordenar cronológicamente
        ) AS VentasMesAnterior
    FROM VentasMensuales
)
SELECT
    NombreVendedor AS Vendedor,
    Anio,
    Mes,
    TotalVentas                                           AS Ventas,
    VentasMesAnterior,
    -- Calcular crecimiento porcentual, manejar NULL y división por cero
    CASE
        WHEN VentasMesAnterior IS NULL THEN NULL
        WHEN VentasMesAnterior = 0     THEN NULL  -- No podemos calcular desde 0
        ELSE ROUND(
            (TotalVentas - VentasMesAnterior) / VentasMesAnterior * 100,
            2
        )
    END AS CrecimientoPct
FROM VentasConAnterior
ORDER BY NombreVendedor, Anio, Mes;

-- ============================================================
-- Consulta adicional: vendedores con crecimiento consistente
-- (3 meses consecutivos con crecimiento positivo)
-- ============================================================
WITH VentasConCrecimiento AS (
    SELECT
        VendedorId,
        NombreVendedor,
        Anio,
        Mes,
        TotalVentas,
        LAG(TotalVentas) OVER (PARTITION BY VendedorId ORDER BY Anio, Mes) AS VentasAnterior
    FROM VentasMensuales
),
ConIndicador AS (
    SELECT *,
        CASE WHEN TotalVentas > VentasAnterior THEN 1 ELSE 0 END AS CrecioEsteMes
    FROM VentasConCrecimiento
)
SELECT DISTINCT NombreVendedor
FROM (
    SELECT
        NombreVendedor,
        -- Suma de 3 filas consecutivas usando ROWS BETWEEN
        SUM(CrecioEsteMes) OVER (
            PARTITION BY VendedorId
            ORDER BY Anio, Mes
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS CrecimientoConsecutivo
    FROM ConIndicador
) t
WHERE CrecimientoConsecutivo = 3;
```

**Complejidad**: O(n log n) por el ordenamiento interno de las window functions

**Variantes a considerar en la entrevista:**
- ¿Qué diferencia hay entre `LAG(col, 1)` y una subconsulta correlacionada para obtener el mes anterior?
- ¿Cómo calcularías el crecimiento respecto al mismo mes del año anterior? (`LAG(TotalVentas, 12)` si hay datos mensuales)
- ¿Qué hace `ROWS BETWEEN` vs `RANGE BETWEEN` en una window function?
- ¿Cómo indexarías esta tabla para optimizar la query? (`INDEX (VendedorId, Anio, Mes)`)
- ¿Cómo lo harías si necesitas el top 3 de vendedores por crecimiento promedio anual?

</details>

---

## Ejercicio 8: Pipeline de Transformación

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 20 minutos  
**Temas**: Chain of Responsibility, generics, Func&lt;T&gt;, patrones de diseño

### Enunciado

Implementa un pipeline de transformación genérico donde cada paso transforma un objeto del mismo tipo. El pipeline debe:
- Permitir agregar pasos dinámicamente
- Ejecutar los pasos en orden
- Permitir que un paso cancele la ejecución del resto (cortocircuito)
- Ser fluent (encadenable con `.AddStep(...).AddStep(...)`)

**Ejemplo de uso:**
```csharp
var pipeline = new Pipeline<string>()
    .AddStep(s => s.Trim())
    .AddStep(s => s.ToUpper())
    .AddStep(s => s.Replace(" ", "_"));

string resultado = pipeline.Execute("  hola mundo  "); // "HOLA_MUNDO"
```

### Pistas

<details>
<summary>Ver pista 1</summary>

El approach más simple usa una `List<Func<T, T>>` donde cada función toma el valor del paso anterior y devuelve el nuevo valor.

</details>

<details>
<summary>Ver pista 2</summary>

Para el cortocircuito, puedes usar un tipo resultado que indique si se debe continuar, o lanzar una excepción específica. Una opción elegante es usar `Func<T, (T result, bool continuar)>`.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```csharp
// ============================================================
// Approach 1: Simple con Func<T, T> — limpio y funcional
// ============================================================
public class Pipeline<T>
{
    private readonly List<Func<T, T>> _pasos = new();

    // Fluent API: retorna this para poder encadenar
    public Pipeline<T> AddStep(Func<T, T> paso)
    {
        if (paso == null) throw new ArgumentNullException(nameof(paso));
        _pasos.Add(paso);
        return this;
    }

    public T Execute(T entrada)
    {
        // Aplicar cada paso en orden, pasando el resultado al siguiente
        return _pasos.Aggregate(entrada, (valorActual, paso) => paso(valorActual));
    }
}

// ============================================================
// Approach 2: Con soporte para cortocircuito y contexto
// ============================================================
public class PipelineContext<T>
{
    public T Value { get; set; }
    public bool Cancelado { get; private set; }
    public string? MotivosCancelacion { get; private set; }

    public PipelineContext(T valorInicial) => Value = valorInicial;

    public void Cancelar(string motivo)
    {
        Cancelado = true;
        MotivosCancelacion = motivo;
    }
}

public class PipelineConContexto<T>
{
    private readonly List<Action<PipelineContext<T>>> _pasos = new();

    public PipelineConContexto<T> AddStep(Action<PipelineContext<T>> paso)
    {
        _pasos.Add(paso);
        return this;
    }

    public PipelineContext<T> Execute(T entrada)
    {
        var contexto = new PipelineContext<T>(entrada);

        foreach (var paso in _pasos)
        {
            if (contexto.Cancelado) break; // Cortocircuito

            paso(contexto);
        }

        return contexto;
    }
}

// ============================================================
// Approach 3: Con interfaces (más extensible, permite DI)
// ============================================================
public interface IPipelineStep<T>
{
    T Ejecutar(T input);
}

public class PipelineConInterfaces<T>
{
    private readonly List<IPipelineStep<T>> _pasos = new();

    public PipelineConInterfaces<T> AddStep(IPipelineStep<T> paso)
    {
        _pasos.Add(paso);
        return this;
    }

    public T Execute(T entrada) =>
        _pasos.Aggregate(entrada, (current, paso) => paso.Ejecutar(current));
}

// ============================================================
// Ejemplo de uso con procesamiento de pedidos
// ============================================================
public class PedidoDto
{
    public string? DireccionEntrega { get; set; }
    public List<ItemDto> Items { get; set; } = new();
    public decimal Total { get; set; }
    public bool EsValido { get; set; } = true;
}

// Cada paso de transformación como clase separada (SRP)
public class NormalizarDireccionStep : IPipelineStep<PedidoDto>
{
    public PedidoDto Ejecutar(PedidoDto pedido)
    {
        pedido.DireccionEntrega = pedido.DireccionEntrega?.Trim().ToUpper();
        return pedido;
    }
}

public class CalcularTotalStep : IPipelineStep<PedidoDto>
{
    public PedidoDto Ejecutar(PedidoDto pedido)
    {
        pedido.Total = pedido.Items.Sum(i => i.Precio * i.Cantidad);
        return pedido;
    }
}

// Uso:
// var pipeline = new PipelineConInterfaces<PedidoDto>()
//     .AddStep(new NormalizarDireccionStep())
//     .AddStep(new CalcularTotalStep());
//
// var resultado = pipeline.Execute(nuevoPedido);
```

**Complejidad**: Tiempo O(n×m) donde n = pasos, m = complejidad de cada paso; Espacio O(1) extra

**Variantes a considerar en la entrevista:**
- ¿Cómo lo harías asíncrono con `Func<T, Task<T>>`? (encadenar con `await` en cada paso)
- ¿Cómo agregarías logging automático antes y después de cada paso sin modificar los pasos?  (Decorator pattern)
- ¿Qué diferencia hay entre Pipeline y Chain of Responsibility? (en CoR cada paso decide si pasar al siguiente; en Pipeline siempre se pasa)
- ¿Cómo manejarías errores en un paso para que no cancelen toda la cadena? (try/catch con estrategia configurable)
- ¿Cuándo usarías este patrón vs un sistema de eventos/mensajes?

</details>
