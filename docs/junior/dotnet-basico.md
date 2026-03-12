---
id: dotnet-basico
title: .NET - Conceptos Básicos
sidebar_position: 3
---

# .NET — Conceptos Básicos 🟢

## ¿Qué es .NET?

**.NET** es una plataforma de desarrollo de Microsoft, de código abierto y multiplataforma, que permite crear aplicaciones web, de escritorio, móviles, IoT y más.

### Evolución importante

| Versión | Nombre | Estado |
|---------|--------|--------|
| .NET Framework 4.x | Legacy | Solo Windows |
| .NET Core 3.1 | Moderno | Multiplataforma |
| .NET 5+ | Unificado | Multiplataforma (usar este) |
| .NET 8 | LTS actual | ✅ Recomendado |

:::tip
En entrevistas, si mencionan "**.NET Framework**" vs "**.NET Core/.NET 5+**", recuerda que son plataformas distintas. El moderno se llama simplemente ".NET".
:::

---

## CLR y el proceso de compilación

```
Código C# (.cs)
      ↓ Compilador de C# (csc / Roslyn)
  IL Code (.dll)
      ↓ CLR (JIT Compiler)
  Código nativo (ejecutable en la CPU)
```

- **CLR (Common Language Runtime)**: motor de ejecución, maneja memoria, GC, seguridad
- **IL (Intermediate Language)**: código intermedio independiente de plataforma
- **JIT (Just-In-Time)**: compila IL a código nativo en el momento de ejecución

---

## Garbage Collector (GC)

El GC administra automáticamente la memoria en .NET.

```csharp
// No necesitas hacer free() como en C/C++
var lista = new List<int>(); // Se aloja en el heap
// Cuando ya no hay referencias, el GC la limpiará

// Generaciones del GC:
// Gen 0: objetos recién creados (GC frecuente, rápido)
// Gen 1: objetos que sobrevivieron 1 colección
// Gen 2: objetos de larga vida (GC lento, infrecuente)
```

### IDisposable — Recursos no gestionados

```csharp
// Implementar cuando manejas recursos como: conexiones DB, archivos, streams
public class MiConexion : IDisposable
{
    private bool _disposed = false;
    private SqlConnection _connection;

    public MiConexion(string connectionString)
    {
        _connection = new SqlConnection(connectionString);
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
                _connection?.Dispose();
            _disposed = true;
        }
    }
}

// Uso correcto con using
using var conexion = new MiConexion(connectionString);
// Al salir del scope, Dispose() se llama automáticamente
```

---

## LINQ (Language Integrated Query)

LINQ es una de las características más usadas de C#/.NET.

```csharp
var productos = new List<Producto>
{
    new("Laptop", 999.99m, "Electrónica"),
    new("Mouse", 29.99m, "Electrónica"),
    new("Silla", 299.99m, "Muebles"),
    new("Monitor", 449.99m, "Electrónica"),
};

// Filtrar
var electronicos = productos.Where(p => p.Categoria == "Electrónica");

// Proyectar
var nombres = productos.Select(p => p.Nombre);

// Ordenar
var ordenados = productos.OrderByDescending(p => p.Precio);

// Agrupar
var porCategoria = productos.GroupBy(p => p.Categoria);

// First / FirstOrDefault
var laptop = productos.FirstOrDefault(p => p.Nombre == "Laptop");

// Any / All
bool hayCaros = productos.Any(p => p.Precio > 500);
bool todosTienenNombre = productos.All(p => !string.IsNullOrEmpty(p.Nombre));

// Aggregate / Sum / Count / Max / Min
decimal total = productos.Sum(p => p.Precio);
int cantidad = productos.Count(p => p.Categoria == "Electrónica");

// Encadenamiento
var resultado = productos
    .Where(p => p.Precio > 100)
    .OrderBy(p => p.Nombre)
    .Select(p => new { p.Nombre, PrecioFormateado = $"${p.Precio:N2}" })
    .ToList();
```

### Deferred Execution (Ejecución diferida)

```csharp
var query = productos.Where(p => p.Precio > 100); // No ejecuta aún
// La consulta se ejecuta cuando iteras:
foreach (var p in query) { ... }  // Se ejecuta aquí
var lista = query.ToList();        // O aquí
```

:::warning
`Where`, `Select`, `OrderBy` usan **ejecución diferida**.  
`ToList()`, `Count()`, `First()`, `Sum()` **fuerzan la ejecución**.
:::

---

## Async / Await

```csharp
// Método sincrónico (bloquea el hilo)
public string ObtenerDatos()
{
    Thread.Sleep(2000); // Bloquea 2 segundos
    return "datos";
}

// Método asincrónico (libera el hilo mientras espera)
public async Task<string> ObtenerDatosAsync()
{
    await Task.Delay(2000); // No bloquea el hilo
    return "datos";
}

// Uso correcto
public async Task EjemploAsync()
{
    // Await simple
    string datos = await ObtenerDatosAsync();
    
    // Await en paralelo (más eficiente)
    var tarea1 = ObtenerDatosAsync();
    var tarea2 = ObtenerDatosAsync();
    await Task.WhenAll(tarea1, tarea2);
    
    // ConfigureAwait (importante en libraries)
    string resultado = await ObtenerDatosAsync().ConfigureAwait(false);
}
```

:::tip Regla de oro
Si tu método llama a un método `async`, **él también debe ser `async`**. Evita `.Result` o `.Wait()` ya que pueden causar deadlocks.
:::

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es el Garbage Collector y cuándo libera memoria?**
> El GC es un proceso automático que libera memoria cuando detecta que un objeto ya no tiene referencias activas. No puedes controlar exactamente cuándo, pero puedes sugerir con `GC.Collect()` (no recomendado en producción).

**2. ¿Cuál es la diferencia entre `Task` y `Thread`?**
> Un `Thread` es un hilo del sistema operativo (costoso). Un `Task` es una abstracción de alto nivel sobre el ThreadPool de .NET, mucho más eficiente para operaciones I/O. En .NET moderno, siempre preferir `Task` y `async/await`.

**3. ¿Qué es el `ConfigureAwait(false)`?**
> Le dice al runtime que no necesita volver al contexto de sincronización original después del await. Importante en **library code** para evitar deadlocks. En ASP.NET Core no es necesario porque no hay contexto de sincronización.

**4. ¿Cuál es la diferencia entre `IEnumerable<T>` y `IQueryable<T>`?**
> `IEnumerable<T>` ejecuta la consulta en memoria (LINQ to Objects). `IQueryable<T>` puede traducir la consulta a SQL (Entity Framework), ejecutándola en la base de datos. Siempre preferir `IQueryable<T>` con EF para evitar traer datos innecesarios.
