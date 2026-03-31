---
id: csharp-avanzado
title: C# Avanzado
sidebar_position: 1
---

# C# — Avanzado 🟡

## Generics

Los genéricos permiten escribir código reutilizable con seguridad de tipos.

```csharp
// Clase genérica
public class Repositorio<T> where T : class, IEntidad
{
    private readonly List<T> _items = new();

    public T? ObtenerPorId(int id) =>
        _items.FirstOrDefault(item => item.Id == id);

    public void Agregar(T item) => _items.Add(item);

    public IEnumerable<T> Filtrar(Func<T, bool> predicado) =>
        _items.Where(predicado);
}

// Método genérico
public static T DeserializarJson<T>(string json) =>
    JsonSerializer.Deserialize<T>(json) 
    ?? throw new InvalidOperationException("No se pudo deserializar");

// Constraints (restricciones)
public T Crear<T>() where T : new() => new T();
public void Procesar<T>(T item) where T : class, IDisposable, new() { }
public T Sumar<T>(T a, T b) where T : INumber<T> => a + b;
```

---

## Delegates, Events y Lambdas

```csharp
// Delegate: tipo que representa un método
public delegate int Operacion(int a, int b);

Operacion sumar = (a, b) => a + b;
Operacion multiplicar = (a, b) => a * b;
Console.WriteLine(sumar(3, 4)); // 7

// Func<> y Action<> (delegates predefinidos)
Func<int, int, int> suma = (a, b) => a + b;      // retorna valor
Action<string> imprimir = msg => Console.WriteLine(msg); // no retorna
Predicate<int> esPar = n => n % 2 == 0;           // retorna bool

// Events
public class Temporizador
{
    public event EventHandler<int>? TiempoTranscurrido;

    public void Iniciar()
    {
        for (int i = 1; i <= 10; i++)
        {
            Thread.Sleep(1000);
            TiempoTranscurrido?.Invoke(this, i); // raise event
        }
    }
}

var timer = new Temporizador();
timer.TiempoTranscurrido += (sender, segundos) =>
    Console.WriteLine($"Han pasado {segundos} segundos");
```

---

## Extension Methods

```csharp
// Agregar métodos a tipos existentes sin herencia
public static class StringExtensions
{
    public static bool EsEmailValido(this string email) =>
        email.Contains('@') && email.Contains('.');

    public static string Capitalizar(this string texto) =>
        string.IsNullOrEmpty(texto) 
            ? texto 
            : char.ToUpper(texto[0]) + texto[1..].ToLower();

    public static T? ParsearJson<T>(this string json) =>
        JsonSerializer.Deserialize<T>(json);
}

// Uso (parecen métodos nativos de string)
bool esValido = "user@example.com".EsEmailValido();
string titulo = "hOLA mUnDO".Capitalizar(); // "Hola mundo"
```

---

## Records (C# 9+)

```csharp
// Record: tipo inmutable por valor, ideal para DTOs y Value Objects
public record Punto(double X, double Y);
public record PersonaDto(int Id, string Nombre, string Email);

var p1 = new Punto(1.0, 2.0);
var p2 = new Punto(1.0, 2.0);
Console.WriteLine(p1 == p2); // true (igualdad por valor)

// With expression (crear copia con cambios)
var p3 = p1 with { Y = 5.0 };

// Record class vs record struct
public record class Persona(string Nombre); // referencia, nullable
public record struct Coordenada(int X, int Y); // valor, no nullable
```

---

## Pattern Matching

```csharp
// Type patterns
object valor = "Hola";
if (valor is string texto && texto.Length > 3)
    Console.WriteLine($"String largo: {texto}");

// Switch expression con patterns
string DescribirForma(object forma) => forma switch
{
    Circulo c when c.Radio > 10 => $"Círculo grande, radio {c.Radio}",
    Circulo c                   => $"Círculo pequeño, radio {c.Radio}",
    Rectangulo { Ancho: > 100 } => "Rectángulo ancho",
    Rectangulo r                => $"Rectángulo {r.Ancho}x{r.Alto}",
    null                        => "nulo",
    _                           => "Forma desconocida"
};

// Property pattern
bool EsMayorDeEdad(Persona p) => p is { Edad: >= 18, Activo: true };

// Tuple pattern
string ClasificarPunto(int x, int y) => (x, y) switch
{
    (0, 0) => "Origen",
    (> 0, > 0) => "Cuadrante I",
    (< 0, > 0) => "Cuadrante II",
    _ => "Otro cuadrante"
};
```

---

## Async Avanzado

```csharp
// CancellationToken — poder cancelar operaciones
public async Task<List<Producto>> BuscarProductosAsync(
    string termino, 
    CancellationToken cancellationToken = default)
{
    var response = await _httpClient.GetAsync(
        $"/api/productos?q={termino}", 
        cancellationToken);
    
    return await response.Content.ReadFromJsonAsync<List<Producto>>(
        cancellationToken: cancellationToken)
        ?? new List<Producto>();
}

// ValueTask — optimización para paths que pueden ser síncronos
public ValueTask<int> ObtenerCacheadoAsync(string key)
{
    if (_cache.TryGetValue(key, out int valor))
        return ValueTask.FromResult(valor); // sin allocación!
    
    return new ValueTask<int>(CargarDesdeDbAsync(key));
}

// Parallel processing
public async Task ProcesarLoteAsync(IEnumerable<int> ids)
{
    // Procesar en paralelo con límite de concurrencia
    var semaforo = new SemaphoreSlim(10); // max 10 concurrent
    
    var tareas = ids.Select(async id =>
    {
        await semaforo.WaitAsync();
        try
        {
            await ProcesarItemAsync(id);
        }
        finally
        {
            semaforo.Release();
        }
    });
    
    await Task.WhenAll(tareas);
}
```

---

## Dependency Injection manual

```csharp
// Interfaces y sus implementaciones
public interface IEmailService
{
    Task EnviarAsync(string destinatario, string asunto, string cuerpo);
}

public class SmtpEmailService : IEmailService
{
    public async Task EnviarAsync(string destinatario, string asunto, string cuerpo)
    {
        // implementación real
    }
}

// En .NET, se registra en Program.cs
builder.Services.AddScoped<IEmailService, SmtpEmailService>();
builder.Services.AddSingleton<ICache, MemoryCache>();
builder.Services.AddTransient<IValidator, FluentValidator>();
```

### Lifetimes de servicios

| Lifetime | Instancia | Uso típico |
|----------|-----------|-----------|
| **Singleton** | Una por aplicación | Cache, configuración |
| **Scoped** | Una por request HTTP | DbContext, repositorios |
| **Transient** | Nueva cada vez que se pide | Validators, stateless services |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es covariance y contravariance en generics?**
> **Covariance** (`out T`): puedes usar `IEnumerable<Derivada>` donde se espera `IEnumerable<Base>`. **Contravariance** (`in T`): puedes usar `Action<Base>` donde se espera `Action<Derivada>`.

**2. ¿Cuándo usar `ValueTask` vs `Task`?**
> `ValueTask` cuando el método frecuentemente retorna sin operación asincrónica real (resultado cacheado). `Task` en la mayoría de casos — `ValueTask` tiene restricciones de uso (no se puede awaitar múltiples veces).

**3. ¿Qué es la diferencia entre `yield return` y `return`?**
> `yield return` convierte el método en un iterador que produce valores uno a la vez (lazy). No crea una colección completa en memoria. Ideal para secuencias grandes.
```csharp
IEnumerable<int> NumerosPares(int hasta)
{
    for (int i = 0; i <= hasta; i += 2)
        yield return i; // produce un valor y suspende
}
```
