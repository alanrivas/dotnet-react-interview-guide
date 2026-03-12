---
id: algoritmos-basicos
title: Algoritmos y Estructuras de Datos Básicos
sidebar_position: 10
---

# Algoritmos y Estructuras de Datos Básicos

Comprender algoritmos y estructuras de datos es fundamental en cualquier entrevista técnica. No se trata de memorizar soluciones, sino de entender **por qué** una solución es mejor que otra y poder razonar sobre ella en voz alta.

---

## Complejidad Algorítmica (Big O Notation)

### ¿Qué es Big O y por qué importa?

Big O Notation describe **cómo crece el tiempo de ejecución (o el uso de memoria) de un algoritmo en función del tamaño de la entrada**. En entrevistas, el entrevistador espera que puedas razonar sobre la eficiencia de tu solución, no solo que funcione.

> "¿Cuál es la complejidad de tu solución?" es una de las preguntas más frecuentes en entrevistas técnicas.

Big O describe el **peor caso** (aunque a veces se habla de caso promedio). Ignoramos constantes y términos no dominantes:
- `3n + 5` → **O(n)**
- `n² + n` → **O(n²)**
- `2 * log n` → **O(log n)**

### O(1) — Tiempo Constante

El algoritmo tarda lo mismo sin importar el tamaño de la entrada.

```csharp
// Acceso a un elemento de un array por índice
int[] numeros = { 10, 20, 30, 40, 50 };
int primero = numeros[0]; // Siempre una operación, O(1)

// Verificar si un diccionario contiene una clave
var diccionario = new Dictionary<string, int> { { "age", 25 } };
bool existe = diccionario.ContainsKey("age"); // O(1)
```

### O(log n) — Tiempo Logarítmico

Cada iteración **divide el problema a la mitad**. Muy eficiente para entradas grandes.

```csharp
// Búsqueda binaria en un array ordenado
int BusquedaBinaria(int[] arr, int objetivo)
{
    int izq = 0, der = arr.Length - 1;
    while (izq <= der)
    {
        int medio = izq + (der - izq) / 2;
        if (arr[medio] == objetivo) return medio;
        if (arr[medio] < objetivo) izq = medio + 1;
        else der = medio - 1;
    }
    return -1; // No encontrado
}
// Con n=1.000.000 elementos, solo necesita ~20 iteraciones
```

### O(n) — Tiempo Lineal

El tiempo crece proporcionalmente al tamaño de la entrada.

```csharp
// Buscar el máximo en un array sin ordenar
int EncontrarMaximo(int[] arr)
{
    int maximo = arr[0];
    foreach (int num in arr) // Recorre todos los elementos: O(n)
    {
        if (num > maximo) maximo = num;
    }
    return maximo;
}
```

### O(n log n) — Tiempo Linearítmico

Típico de algoritmos de ordenamiento eficientes (Merge Sort, Quick Sort, Timsort).

```csharp
// Array.Sort usa Timsort internamente: O(n log n)
int[] numeros = { 5, 2, 8, 1, 9, 3 };
Array.Sort(numeros); // O(n log n)

// LINQ OrderBy también es O(n log n)
var ordenados = numeros.OrderBy(x => x).ToList();
```

### O(n²) — Tiempo Cuadrático

Aparece con loops anidados que dependen del mismo `n`. Se vuelve lento rápidamente.

```csharp
// Bubble sort — solo educativo, no usar en producción
void BubbleSort(int[] arr)
{
    int n = arr.Length;
    for (int i = 0; i < n - 1; i++)         // O(n)
    {
        for (int j = 0; j < n - i - 1; j++) // O(n)
        {
            if (arr[j] > arr[j + 1])
            {
                (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);
            }
        }
    }
} // Total: O(n²)
```

### Cómo calcular la complejidad

```csharp
// Loop simple → O(n)
for (int i = 0; i < n; i++)
{
    Console.WriteLine(i); // O(1) dentro del loop
}

// Loops anidados (mismo n) → O(n²)
for (int i = 0; i < n; i++)
{
    for (int j = 0; j < n; j++)
    {
        Console.WriteLine(i + j);
    }
}

// Loops secuenciales (no anidados) → O(n) + O(n) = O(n)
for (int i = 0; i < n; i++) { /* ... */ }
for (int j = 0; j < n; j++) { /* ... */ }

// Loop que divide a la mitad → O(log n)
int i = n;
while (i > 1)
{
    i = i / 2;
}
```

### Tabla comparativa de complejidades

| Notación     | Nombre         | n=10 | n=100 | n=1.000 | n=1.000.000 |
|-------------|----------------|------|-------|---------|-------------|
| O(1)        | Constante      | 1    | 1     | 1       | 1           |
| O(log n)    | Logarítmica    | 3    | 7     | 10      | 20          |
| O(n)        | Lineal         | 10   | 100   | 1.000   | 1.000.000   |
| O(n log n)  | Linearítmica   | 33   | 664   | 9.965   | ~20.000.000 |
| O(n²)       | Cuadrática     | 100  | 10.000| 1.000.000 | 10¹²     |

> **Regla práctica**: O(1) > O(log n) > O(n) > O(n log n) > O(n²) — cuanto más a la izquierda, mejor.

---

## Arrays y Listas

### Array vs `List<T>` en C#

```csharp
// Array: tamaño fijo, declarado en tiempo de compilación o con new
int[] arrayFijo = new int[5];
int[] arrayInicializado = { 1, 2, 3, 4, 5 };

// List<T>: tamaño dinámico, redimensionable automáticamente
var lista = new List<int> { 1, 2, 3, 4, 5 };
lista.Add(6);    // O(1) amortizado — a veces redimensiona el buffer interno
lista.Remove(3); // O(n) — debe buscar y desplazar elementos
```

| Operación               | Array  | List\<T\> |
|------------------------|--------|-----------|
| Acceso por índice       | O(1)   | O(1)      |
| Inserción al final      | N/A    | O(1)*     |
| Inserción en el medio   | N/A    | O(n)      |
| Búsqueda (sin ordenar)  | O(n)   | O(n)      |
| Tamaño fijo             | Sí     | No        |

*O(1) amortizado: ocasionalmente se realoca el buffer interno, pero el promedio es O(1).

**¿Cuándo usar Array vs List?**
- Usa **Array** cuando el tamaño es fijo y conocido de antemano (ej: días de la semana, coordenadas).
- Usa **List\<T\>** en la mayoría de los casos de uso real, cuando el tamaño puede variar.

### Técnica "Two Pointers"

Usada para resolver problemas en arrays **ordenados** de forma eficiente. En lugar de usar dos loops (O(n²)), usamos dos punteros que se mueven hacia el centro: O(n).

**Problema**: Dado un array ordenado, encontrar dos números que sumen un objetivo `X`.

```csharp
// Solución ingenua: O(n²)
int[] SumaDosNumerosBruta(int[] arr, int objetivo)
{
    for (int i = 0; i < arr.Length; i++)
        for (int j = i + 1; j < arr.Length; j++)
            if (arr[i] + arr[j] == objetivo)
                return new[] { i, j };
    return Array.Empty<int>();
}

// Solución con Two Pointers: O(n)
int[] SumaDosNumerosTwoPointers(int[] arr, int objetivo)
{
    int izq = 0;
    int der = arr.Length - 1;

    while (izq < der)
    {
        int suma = arr[izq] + arr[der];
        if (suma == objetivo)
            return new[] { izq, der };   // ¡Encontrado!
        else if (suma < objetivo)
            izq++;  // Necesitamos un número más grande
        else
            der--;  // Necesitamos un número más pequeño
    }
    return Array.Empty<int>(); // No encontrado
}

// Uso:
int[] nums = { 1, 3, 5, 7, 9, 11 };
int[] resultado = SumaDosNumerosTwoPointers(nums, 12); // [1, 4] → nums[1]+nums[4] = 3+9 = 12
```

### Sliding Window (Ventana Deslizante)

Útil para problemas con **subarrays contiguos** de tamaño fijo o variable. Evita recalcular desde cero en cada paso: O(n) en lugar de O(n*k).

**Problema**: Encontrar la suma máxima de un subarray de tamaño `k`.

```csharp
int SumaMaximaVentana(int[] arr, int k)
{
    if (arr.Length < k) return -1;

    // Calcular la suma de la primera ventana
    int sumaActual = 0;
    for (int i = 0; i < k; i++)
        sumaActual += arr[i];

    int sumaMaxima = sumaActual;

    // Deslizar la ventana: agregar el nuevo elemento, quitar el primero
    for (int i = k; i < arr.Length; i++)
    {
        sumaActual += arr[i];        // Entra el nuevo elemento
        sumaActual -= arr[i - k];    // Sale el elemento más antiguo
        sumaMaxima = Math.Max(sumaMaxima, sumaActual);
    }
    return sumaMaxima;
}

// Uso:
int[] nums = { 2, 1, 5, 1, 3, 2 };
int max = SumaMaximaVentana(nums, 3); // 9 → subarray [5, 1, 3]
```

---

## Búsqueda

### Búsqueda Lineal — O(n)

Recorre todos los elementos uno a uno. Funciona en **cualquier colección**, ordenada o no.

```csharp
int BusquedaLineal(int[] arr, int objetivo)
{
    for (int i = 0; i < arr.Length; i++)
    {
        if (arr[i] == objetivo)
            return i; // Retorna el índice
    }
    return -1; // No encontrado
}

// ¿Cuándo usar búsqueda lineal?
// - Array pequeño (< ~50 elementos)
// - Array no ordenado y no vale la pena ordenarlo
// - Búsqueda única (no se repetirá)
// - Buscar en una List<T> con .Contains() o .FirstOrDefault() ya lo hace internamente
```

### Búsqueda Binaria — O(log n)

**Requisito**: el array debe estar **ordenado**. Divide el espacio de búsqueda a la mitad en cada paso.

```csharp
// Implementación manual
int BusquedaBinaria(int[] arr, int objetivo)
{
    int izq = 0;
    int der = arr.Length - 1;

    while (izq <= der)
    {
        int medio = izq + (der - izq) / 2; // Evita overflow vs (izq+der)/2

        if (arr[medio] == objetivo)
            return medio;       // ¡Encontrado!
        else if (arr[medio] < objetivo)
            izq = medio + 1;    // El objetivo está en la mitad derecha
        else
            der = medio - 1;    // El objetivo está en la mitad izquierda
    }
    return -1; // No encontrado
}

// .NET ya tiene esto incorporado:
int[] sortedArr = { 1, 3, 5, 7, 9, 11, 13 };
int indice = Array.BinarySearch(sortedArr, 7); // Retorna 3

// Ejemplo práctico de rendimiento:
// Array de 1.000.000 elementos
// - Búsqueda lineal: hasta 1.000.000 comparaciones
// - Búsqueda binaria: máximo 20 comparaciones (log₂ 1.000.000 ≈ 20)
```

### Dictionary\<TKey, TValue\> para búsqueda O(1)

Cuando necesitas buscar **muchas veces** en la misma colección, convierte los datos a un `Dictionary`. El costo de construcción es O(n), pero cada búsqueda es O(1).

```csharp
// Escenario: verificar si un usuario existe por su email
var usuarios = new List<string> { "ana@mail.com", "bob@mail.com", "carlos@mail.com" };

// MAL: búsqueda O(n) en cada verificación
bool existeMal = usuarios.Contains("bob@mail.com"); // O(n) cada vez

// BIEN: construir un HashSet/Dictionary una vez, buscar O(1)
var emailSet = new HashSet<string>(usuarios);
bool existeBien = emailSet.Contains("bob@mail.com"); // O(1)

// Con datos adicionales: usar Dictionary
var usuariosPorEmail = new Dictionary<string, int>
{
    { "ana@mail.com", 1 },
    { "bob@mail.com", 2 },
    { "carlos@mail.com", 3 }
};
int idUsuario = usuariosPorEmail["bob@mail.com"]; // O(1)
```

---

## Ordenamiento

### Bubble Sort — O(n²)

Solo tiene valor educativo. **No lo uses en producción**.

```csharp
void BubbleSort(int[] arr)
{
    int n = arr.Length;
    for (int i = 0; i < n - 1; i++)
    {
        for (int j = 0; j < n - i - 1; j++)
        {
            if (arr[j] > arr[j + 1])
            {
                // Intercambiar
                (arr[j], arr[j + 1]) = (arr[j + 1], arr[j]);
            }
        }
    }
}
// Por qué es O(n²): dos loops anidados de tamaño n
// Ejemplo: 1000 elementos → ~500.000 comparaciones
```

### Selection Sort — O(n²)

```csharp
void SelectionSort(int[] arr)
{
    int n = arr.Length;
    for (int i = 0; i < n - 1; i++)
    {
        int minIdx = i;
        for (int j = i + 1; j < n; j++)
        {
            if (arr[j] < arr[minIdx])
                minIdx = j;
        }
        (arr[i], arr[minIdx]) = (arr[minIdx], arr[i]);
    }
}
// También O(n²), pero hace menos intercambios que Bubble Sort
```

### Ordenamiento en .NET — Timsort O(n log n)

.NET usa **Timsort** (una combinación de Merge Sort e Insertion Sort) internamente para `Array.Sort`, `List.Sort` y LINQ `OrderBy`. Es O(n log n) en el caso promedio y peor caso.

```csharp
// Array.Sort — in-place, modifica el array original
int[] numeros = { 5, 2, 8, 1, 9, 3 };
Array.Sort(numeros); // { 1, 2, 3, 5, 8, 9 }

// List.Sort — in-place
var lista = new List<int> { 5, 2, 8, 1, 9, 3 };
lista.Sort(); // { 1, 2, 3, 5, 8, 9 }

// Con comparador personalizado
var personas = new List<string> { "Carlos", "Ana", "Bob" };
personas.Sort((a, b) => string.Compare(a, b, StringComparison.OrdinalIgnoreCase));

// LINQ OrderBy — crea una nueva colección, no modifica la original
var ordenados = lista.OrderBy(x => x).ToList();
var ordenadosDesc = lista.OrderByDescending(x => x).ToList();

// Múltiples criterios de ordenamiento
var empleados = new List<(string Nombre, int Edad)>
{
    ("Carlos", 30), ("Ana", 25), ("Bob", 30)
};
var resultado = empleados
    .OrderBy(e => e.Edad)
    .ThenBy(e => e.Nombre)
    .ToList();
// Resultado: (Ana, 25), (Bob, 30), (Carlos, 30)
```

### ¿Ordenar en memoria o en SQL?

```sql
-- Cuando los datos ya están en la base de datos, es más eficiente
-- usar ORDER BY en SQL antes de traerlos a la aplicación
SELECT * FROM Productos ORDER BY Precio ASC

-- Los índices de la BD pueden hacer esto muy rápido
-- Evitas traer todos los datos a memoria solo para ordenarlos
```

```csharp
// En Entity Framework: genera ORDER BY en SQL (eficiente)
var productos = await dbContext.Productos
    .OrderBy(p => p.Precio)
    .ToListAsync(); // ORDER BY se ejecuta en la BD

// En memoria (solo si ya tienes los datos cargados)
productos.Sort((a, b) => a.Precio.CompareTo(b.Precio));
```

---

## Estructuras de Datos Básicas

### Stack (Pila) — LIFO

**Last In, First Out**: el último en entrar es el primero en salir. Como una pila de platos.

```csharp
var pila = new Stack<int>();

// Push: agregar al tope — O(1)
pila.Push(1);
pila.Push(2);
pila.Push(3);

// Peek: ver el tope sin quitar — O(1)
int tope = pila.Peek(); // 3

// Pop: quitar del tope — O(1)
int sacado = pila.Pop(); // 3
// Ahora pila = [1, 2]

Console.WriteLine(pila.Count); // 2
```

**Casos de uso reales:**
- **Undo/Redo**: cada acción se apila; deshacer = pop
- **Call stack** del runtime (cómo funciona la recursión internamente)
- **Verificar paréntesis balanceados**:

```csharp
bool ParentesisBalanceados(string s)
{
    var pila = new Stack<char>();
    var pares = new Dictionary<char, char> { { ')', '(' }, { ']', '[' }, { '}', '{' } };

    foreach (char c in s)
    {
        if (c == '(' || c == '[' || c == '{')
        {
            pila.Push(c);
        }
        else if (pares.ContainsKey(c))
        {
            if (pila.Count == 0 || pila.Pop() != pares[c])
                return false;
        }
    }
    return pila.Count == 0;
}

Console.WriteLine(ParentesisBalanceados("({[]})")); // true
Console.WriteLine(ParentesisBalanceados("({[})]"));  // false
```

### Queue (Cola) — FIFO

**First In, First Out**: el primero en entrar es el primero en salir. Como una fila de personas.

```csharp
var cola = new Queue<string>();

// Enqueue: agregar al final — O(1)
cola.Enqueue("Tarea 1");
cola.Enqueue("Tarea 2");
cola.Enqueue("Tarea 3");

// Peek: ver el frente sin quitar — O(1)
string frente = cola.Peek(); // "Tarea 1"

// Dequeue: quitar del frente — O(1)
string procesada = cola.Dequeue(); // "Tarea 1"
// Ahora cola = ["Tarea 2", "Tarea 3"]
```

**Casos de uso reales:**
- **Procesamiento de tareas en orden** (colas de mensajes, workers)
- **BFS (Breadth-First Search)** en grafos/árboles
- **Rate limiting**: procesar N requests por segundo en orden

### LinkedList\<T\> — ¿Cuándo es mejor que List\<T\>?

```csharp
var linkedList = new LinkedList<int>();

linkedList.AddFirst(1);  // O(1)
linkedList.AddLast(3);   // O(1)
linkedList.AddAfter(linkedList.Find(1)!, 2); // O(1) la inserción, O(n) el Find

// Ventaja principal: inserción/eliminación al inicio o en el medio O(1)
// (siempre que ya tengas el nodo — no necesitas desplazar elementos)

// LinkedList es mejor que List cuando:
// - Insertas/eliminas frecuentemente al inicio o en el medio
// - No necesitas acceso aleatorio por índice
// - Implementas una cola de doble extremo (Deque)

// List es mejor que LinkedList cuando:
// - Necesitas acceso por índice frecuente
// - El uso de memoria importa (LinkedList tiene overhead por nodo)
// - La mayoría de operaciones son al final de la colección
```

### HashSet\<T\> — Búsqueda O(1), sin duplicados

```csharp
var conjunto = new HashSet<int> { 1, 2, 3, 4, 5 };

// Agregar — O(1), ignora duplicados silenciosamente
bool agregado = conjunto.Add(6); // true
bool agregadoDup = conjunto.Add(3); // false (ya existe)

// Contiene — O(1)
bool existe = conjunto.Contains(3); // true

// Operaciones de conjuntos matemáticos
var setA = new HashSet<int> { 1, 2, 3, 4, 5 };
var setB = new HashSet<int> { 3, 4, 5, 6, 7 };

// Unión: todos los elementos de A y B
var union = new HashSet<int>(setA);
union.UnionWith(setB); // { 1, 2, 3, 4, 5, 6, 7 }

// Intersección: solo los que están en ambos
var interseccion = new HashSet<int>(setA);
interseccion.IntersectWith(setB); // { 3, 4, 5 }

// Diferencia: los de A que no están en B
var diferencia = new HashSet<int>(setA);
diferencia.ExceptWith(setB); // { 1, 2 }

// Caso de uso: eliminar duplicados de una lista rápidamente
var lista = new List<int> { 1, 2, 2, 3, 3, 3, 4 };
var sinDuplicados = new HashSet<int>(lista).ToList(); // { 1, 2, 3, 4 }
```

---

## Recursión

### ¿Qué es y cómo funciona?

Una función recursiva se **llama a sí misma** con una entrada reducida hasta llegar a un **caso base** que detiene la recursión.

```
factorial(4)
  → 4 * factorial(3)
         → 3 * factorial(2)
                → 2 * factorial(1)
                       → 1  ← caso base
```

### Caso base vs caso recursivo

```csharp
// SIEMPRE debe tener un caso base, o habrá StackOverflowException
int Factorial(int n)
{
    // Caso base: detiene la recursión
    if (n <= 1) return 1;

    // Caso recursivo: se llama a sí mismo con entrada reducida
    return n * Factorial(n - 1);
}

Console.WriteLine(Factorial(5)); // 120 → 5*4*3*2*1

// Fibonacci recursivo
int Fibonacci(int n)
{
    if (n <= 1) return n; // Casos base: F(0)=0, F(1)=1
    return Fibonacci(n - 1) + Fibonacci(n - 2); // Caso recursivo
}

Console.WriteLine(Fibonacci(10)); // 55
// ⚠️ Fibonacci recursivo es O(2^n) — muy ineficiente para n grandes
// Para n=40 hace más de 1.000 millones de llamadas
```

### Cuándo evitar recursión profunda

```csharp
// PROBLEMA: Stack Overflow con recursión profunda
// La call stack tiene un límite (~1000-10000 llamadas según el entorno)
int SumaRecursiva(int n)
{
    if (n == 0) return 0;
    return n + SumaRecursiva(n - 1); // Con n=100.000 → StackOverflowException
}

// SOLUCIÓN: usar iteración
int SumaIterativa(int n)
{
    int suma = 0;
    for (int i = 1; i <= n; i++)
        suma += i;
    return suma; // Funciona para cualquier n
}

// ALTERNATIVA: Fibonacci eficiente con memoización (cachear resultados)
int FibonacciMemo(int n, Dictionary<int, int>? memo = null)
{
    memo ??= new Dictionary<int, int>();
    if (n <= 1) return n;
    if (memo.ContainsKey(n)) return memo[n]; // Retorna resultado cacheado

    memo[n] = FibonacciMemo(n - 1, memo) + FibonacciMemo(n - 2, memo);
    return memo[n];
}
// Ahora es O(n) en lugar de O(2^n)
```

---

## Problemas Típicos de Entrevista Junior

### FizzBuzz

Clásico de entrevistas. Imprimir números del 1 al n, pero:
- Múltiplos de 3 → "Fizz"
- Múltiplos de 5 → "Buzz"
- Múltiplos de ambos → "FizzBuzz"

```csharp
void FizzBuzz(int n)
{
    for (int i = 1; i <= n; i++)
    {
        // Verificar ambos ANTES de verificar cada uno por separado
        if (i % 15 == 0)      Console.WriteLine("FizzBuzz");
        else if (i % 3 == 0)  Console.WriteLine("Fizz");
        else if (i % 5 == 0)  Console.WriteLine("Buzz");
        else                   Console.WriteLine(i);
    }
}
FizzBuzz(15);
// 1, 2, Fizz, 4, Buzz, Fizz, 7, 8, Fizz, Buzz, 11, Fizz, 13, 14, FizzBuzz
```

### Invertir un String

```csharp
// Opción 1: usando la API de .NET (más rápida en práctica)
string InvertirString(string s)
{
    char[] chars = s.ToCharArray();
    Array.Reverse(chars);
    return new string(chars);
}

// Opción 2: manual con two pointers (demuestra comprensión del algoritmo)
string InvertirStringManual(string s)
{
    char[] chars = s.ToCharArray();
    int izq = 0, der = chars.Length - 1;
    while (izq < der)
    {
        (chars[izq], chars[der]) = (chars[der], chars[izq]);
        izq++;
        der--;
    }
    return new string(chars);
}

Console.WriteLine(InvertirString("Hola Mundo")); // "odnuM aloH"
```

```javascript
// En JavaScript
function invertirString(s) {
  return s.split('').reverse().join('');
}

// O de forma manual:
function invertirStringManual(s) {
  let resultado = '';
  for (let i = s.length - 1; i >= 0; i--) {
    resultado += s[i];
  }
  return resultado;
}

console.log(invertirString("Hola Mundo")); // "odnuM aloH"
```

### Verificar si un String es Palíndromo

Un palíndromo se lee igual de izquierda a derecha que de derecha a izquierda: "radar", "level", "anilina".

```csharp
bool EsPalindromo(string s)
{
    // Normalizar: minúsculas y sin espacios
    s = s.ToLower().Replace(" ", "");

    int izq = 0, der = s.Length - 1;
    while (izq < der)
    {
        if (s[izq] != s[der]) return false;
        izq++;
        der--;
    }
    return true;
}

Console.WriteLine(EsPalindromo("radar"));        // true
Console.WriteLine(EsPalindromo("Anita lava la tina")); // true (tras normalizar)
Console.WriteLine(EsPalindromo("hello"));        // false

// Versión corta con LINQ (menos eficiente pero más legible)
bool EsPalindromoLinq(string s)
{
    s = s.ToLower().Replace(" ", "");
    return s == new string(s.Reverse().ToArray());
}
```

### Encontrar el Máximo y Mínimo

```csharp
// Manual — O(n)
(int min, int max) EncontrarMinMax(int[] arr)
{
    if (arr.Length == 0) throw new ArgumentException("Array vacío");

    int min = arr[0];
    int max = arr[0];

    foreach (int num in arr)
    {
        if (num < min) min = num;
        if (num > max) max = num;
    }
    return (min, max);
}

// Con LINQ
int[] numeros = { 3, 1, 4, 1, 5, 9, 2, 6 };
int min = numeros.Min(); // 1
int max = numeros.Max(); // 9

var (minVal, maxVal) = EncontrarMinMax(numeros);
Console.WriteLine($"Min: {minVal}, Max: {maxVal}"); // Min: 1, Max: 9
```

### Eliminar Duplicados de una Lista

```csharp
// Opción 1: con HashSet — O(n), preserva el orden de primera aparición
List<int> EliminarDuplicados(List<int> lista)
{
    var vistos = new HashSet<int>();
    var resultado = new List<int>();

    foreach (int num in lista)
    {
        if (vistos.Add(num)) // Add retorna false si ya existe
            resultado.Add(num);
    }
    return resultado;
}

// Opción 2: con LINQ Distinct — O(n), mismo resultado
var lista = new List<int> { 1, 2, 2, 3, 3, 3, 4, 1 };
var sinDuplicados = lista.Distinct().ToList(); // { 1, 2, 3, 4 }

var resultado = EliminarDuplicados(lista);
Console.WriteLine(string.Join(", ", resultado)); // 1, 2, 3, 4
```

```javascript
// En JavaScript
const lista = [1, 2, 2, 3, 3, 3, 4, 1];

// Con Set (equivalente a HashSet)
const sinDuplicados = [...new Set(lista)]; // [1, 2, 3, 4]

// Con filter
const sinDuplicadosFilter = lista.filter(
  (valor, indice, arr) => arr.indexOf(valor) === indice
);
```

### Contar Ocurrencias con Dictionary

```csharp
// Contar cuántas veces aparece cada elemento
Dictionary<string, int> ContarOcurrencias(string[] elementos)
{
    var conteo = new Dictionary<string, int>();

    foreach (string elemento in elementos)
    {
        if (conteo.ContainsKey(elemento))
            conteo[elemento]++;
        else
            conteo[elemento] = 1;

        // Forma más concisa:
        // conteo[elemento] = conteo.GetValueOrDefault(elemento, 0) + 1;
    }
    return conteo;
}

string[] frutas = { "manzana", "pera", "manzana", "uva", "pera", "manzana" };
var conteo = ContarOcurrencias(frutas);

foreach (var par in conteo.OrderByDescending(p => p.Value))
{
    Console.WriteLine($"{par.Key}: {par.Value}");
}
// manzana: 3
// pera: 2
// uva: 1

// La palabra más frecuente
string masFrequente = conteo.MaxBy(p => p.Value)!.Key; // "manzana"
```

```javascript
// En JavaScript
function contarOcurrencias(arr) {
  return arr.reduce((conteo, elemento) => {
    conteo[elemento] = (conteo[elemento] || 0) + 1;
    return conteo;
  }, {});
}

const frutas = ['manzana', 'pera', 'manzana', 'uva', 'pera', 'manzana'];
const resultado = contarOcurrencias(frutas);
// { manzana: 3, pera: 2, uva: 1 }

// La más frecuente
const masFrecuente = Object.entries(resultado)
  .sort(([, a], [, b]) => b - a)[0][0]; // "manzana"
```

---

## Resumen para la Entrevista

| Concepto | Punto clave para mencionar |
|---------|---------------------------|
| Big O | Siempre menciona la complejidad de tu solución. "Esta solución es O(n)" |
| Two Pointers | Solo funciona en arrays **ordenados** |
| Binary Search | Solo funciona en arrays **ordenados**, O(log n) |
| Dictionary | Convierte O(n) searches en O(1) |
| Stack | LIFO — undo/redo, paréntesis |
| Queue | FIFO — procesar en orden |
| HashSet | Cuando solo importa si existe, no cuántas veces |
| Recursión | Siempre define el caso base primero |

> **Consejo para entrevistas**: Antes de escribir código, explica en voz alta tu enfoque y su complejidad. Los entrevistadores valoran el razonamiento tanto como el código correcto.
