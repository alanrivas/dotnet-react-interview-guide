---
id: csharp-fundamentos
title: C# - Fundamentos
sidebar_position: 1
---

# C# — Fundamentos 🟢

## Tipos de datos

C# es un lenguaje de tipado estático. Los tipos se dividen en **value types** y **reference types**.

```csharp
// Value types (se almacenan en el stack)
int edad = 25;
double precio = 99.99;
bool activo = true;
char inicial = 'A';
DateTime fecha = DateTime.Now;

// Reference types (se almacenan en el heap)
string nombre = "Juan";
int[] numeros = { 1, 2, 3 };
object obj = new object();
```

### Diferencia entre `var`, tipo explícito e implícito

```csharp
var numero = 42;        // Inferido en tiempo de compilación (int)
int numero2 = 42;       // Explícito
dynamic numero3 = 42;   // Resuelto en tiempo de ejecución (evitar)
```

:::note Pregunta frecuente
**¿Cuál es la diferencia entre `string` y `String`?**  
Son exactamente lo mismo. `string` es un alias de C# para `System.String`. Por convención se usa `string` en el código.
:::

---

## Nullable Types

```csharp
int? edad = null;           // int nullable
string? nombre = null;      // string nullable (C# 8+)

// Null-coalescing operator
string resultado = nombre ?? "Sin nombre";

// Null-conditional operator
int? longitud = nombre?.Length;

// Null-forgiving operator (solo cuando estás seguro)
string nombreSeguro = nombre!;
```

---

## Control de flujo

```csharp
// if/else
if (edad >= 18)
    Console.WriteLine("Mayor de edad");
else
    Console.WriteLine("Menor de edad");

// switch expression (C# 8+)
string categoria = edad switch
{
    < 13 => "Niño",
    < 18 => "Adolescente",
    < 65 => "Adulto",
    _    => "Senior"
};

// Ternary operator
string mensaje = activo ? "Activo" : "Inactivo";
```

---

## Arrays y Colecciones

```csharp
// Array
int[] numeros = new int[5];
int[] inicializado = { 1, 2, 3, 4, 5 };

// List<T>
var lista = new List<string> { "uno", "dos", "tres" };
lista.Add("cuatro");
lista.Remove("uno");

// Dictionary<TKey, TValue>
var dic = new Dictionary<string, int>
{
    { "manzana", 3 },
    { "pera", 5 }
};
dic["naranja"] = 2;

// IEnumerable vs List
// IEnumerable: solo lectura, lazy evaluation
// List: acceso por índice, métodos de modificación
IEnumerable<int> numsPares = inicializado.Where(n => n % 2 == 0);
```

---

## Métodos y Parámetros

```csharp
// Parámetros opcionales
void Saludar(string nombre, string saludo = "Hola")
{
    Console.WriteLine($"{saludo}, {nombre}!");
}

// Parámetros named
Saludar(saludo: "Buenas", nombre: "Ana");

// ref y out
void Incrementar(ref int valor) => valor++;

bool TryParsearEdad(string texto, out int edad)
{
    return int.TryParse(texto, out edad);
}

// params
int Sumar(params int[] numeros) => numeros.Sum();
int total = Sumar(1, 2, 3, 4, 5); // 15
```

---

## String Manipulation

```csharp
string texto = "  Hola Mundo  ";

// Métodos comunes
texto.Trim();                    // "Hola Mundo"
texto.ToUpper();                 // "  HOLA MUNDO  "
texto.Replace("Mundo", "C#");   // "  Hola C#  "
texto.Contains("Hola");         // true
texto.StartsWith("  H");        // true
texto.Split(' ');                // ["", "", "Hola", "Mundo", "", ""]
texto.Substring(2, 4);          // "Hola"

// String interpolation (preferido)
string nombre = "Juan";
int edad = 30;
string msg = $"Me llamo {nombre} y tengo {edad} años";

// StringBuilder para concatenaciones masivas
var sb = new StringBuilder();
for (int i = 0; i < 1000; i++)
    sb.Append($"Item {i}, ");
string resultado = sb.ToString();
```

:::tip Pregunta frecuente
**¿Por qué usar StringBuilder en vez de concatenar strings con +?**  
Porque `string` es inmutable. Cada `+` crea un nuevo objeto string en el heap. `StringBuilder` usa un buffer interno, lo que es mucho más eficiente en loops.
:::

---

## Exception Handling

```csharp
try
{
    int resultado = int.Parse("no es un numero");
}
catch (FormatException ex)
{
    Console.WriteLine($"Error de formato: {ex.Message}");
}
catch (Exception ex)
{
    Console.WriteLine($"Error inesperado: {ex.Message}");
    throw; // re-throw preservando el stack trace
}
finally
{
    // Siempre se ejecuta (cleanup)
    Console.WriteLine("Fin del proceso");
}

// Excepciones personalizadas
public class ProductoNoEncontradoException : Exception
{
    public int ProductoId { get; }
    
    public ProductoNoEncontradoException(int id) 
        : base($"Producto con ID {id} no encontrado")
    {
        ProductoId = id;
    }
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre `==` y `.Equals()` para strings?**
> Para strings, funcionan igual. Pero `==` compara referencia para objetos no-string. `.Equals()` puede ser sobreescrito para comparar por valor.

**2. ¿Qué es boxing y unboxing?**
> Boxing: convertir un value type a object (heap). Unboxing: extraerlo de vuelta. Tiene costo de performance, evitar en loops.
```csharp
int n = 42;
object boxed = n;       // boxing
int unboxed = (int)boxed; // unboxing
```

**3. ¿Qué es la inmutabilidad de string?**
> Un string nunca cambia. Toda operación como `Replace()` o `ToUpper()` retorna un **nuevo** string. El original queda intacto.

**4. ¿Para qué sirve `using`?**
> Para dos cosas: importar namespaces, y garantizar que un objeto `IDisposable` se libere al salir del bloque (llama a `Dispose()` automáticamente).
```csharp
using (var connection = new SqlConnection(connectionString))
{
    // Al salir del bloque, connection.Dispose() se llama automáticamente
}
// Sintaxis moderna (C# 8+)
using var connection = new SqlConnection(connectionString);
```
