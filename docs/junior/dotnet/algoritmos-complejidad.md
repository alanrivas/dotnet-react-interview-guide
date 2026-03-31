---
id: algoritmos-complejidad
title: Algoritmos y Complejidad
sidebar_position: 19
---

# Algoritmos y Complejidad 🟢

Entender la complejidad algorítmica te permite elegir la estructura de datos correcta y justificar esa decisión en una entrevista.

## Notación Big O

Big O describe cómo crece el tiempo de ejecución (o el espacio en memoria) de un algoritmo a medida que crece el tamaño de la entrada **N**. Siempre nos interesa el **peor caso** y descartamos constantes.

| Notación | Nombre | Ejemplo |
|----------|--------|---------|
| O(1) | Constante | Acceso a un diccionario por clave |
| O(log N) | Logarítmica | Búsqueda binaria |
| O(N) | Lineal | Recorrer un array |
| O(N log N) | Log-lineal | Quicksort / Mergesort |
| O(N²) | Cuadrática | Dos loops anidados |

```
O(1) < O(log N) < O(N) < O(N log N) < O(N²)
```

---

## Casos comunes en C#

### O(1) — Acceso por índice o por clave

```csharp
int[] arr = { 10, 20, 30 };
int val = arr[2]; // O(1): acceso directo por índice

var dict = new Dictionary<string, int> { ["edad"] = 30 };
int edad = dict["edad"]; // O(1): tabla hash
```

### O(N) — Recorrer una colección

```csharp
int[] nums = { 3, 1, 4, 1, 5, 9 };

// Buscar un valor concreto en un array sin ordenar: O(N)
bool existe = nums.Contains(5); // recorre hasta encontrarlo o llegar al final

// FirstOrDefault también es O(N) en el peor caso
var encontrado = nums.FirstOrDefault(n => n == 5);
```

### O(N²) — Dos loops anidados

```csharp
int[] nums = { 1, 2, 3, 4 };

// Comparar todos los pares: O(N²)
for (int i = 0; i < nums.Length; i++)
{
    for (int j = 0; j < nums.Length; j++)
    {
        Console.WriteLine($"({nums[i]}, {nums[j]})");
        // Con N=4: 4 × 4 = 16 operaciones
        // Con N=100: 100 × 100 = 10 000 operaciones
    }
}
```

> **Regla práctica**: si ves dos loops anidados sobre la misma colección de tamaño N, casi siempre es O(N²). Tres loops anidados → O(N³).

---

## Array sin ordenar vs Dictionary: comparación directa

```csharp
var lista = new List<int> { 7, 3, 15, 2, 9 };
var dict = new Dictionary<int, string>
{
    [7] = "siete", [3] = "tres", [15] = "quince"
};

// ❌ Buscar en lista: O(N) — recorre elemento a elemento
bool enLista = lista.Contains(15); // puede recorrer los 5 elementos

// ✅ Buscar en Dictionary: O(1) — calcula el hash y va directo
bool enDict = dict.ContainsKey(15); // sin importar cuántas claves haya
```

**¿Cuándo importa?**  
Con 100 elementos la diferencia es imperceptible. Con 1 000 000 de elementos, O(N) puede tomar millones de operaciones mientras O(1) sigue siendo inmediato.

---

## Búsqueda binaria — O(log N)

La búsqueda binaria aplica **solo a colecciones ordenadas**. En cada paso descarta la mitad de los elementos restantes.

```csharp
int[] ordenado = { 1, 3, 5, 7, 9, 11, 13 };

// Buscar el 7: compara con el elemento del centro (7 en posición 3)
// → encontrado en 1 paso

// Buscar el 11:
//  paso 1: centro = 7 (índice 3) → 11 > 7, descartar mitad izquierda
//  paso 2: centro = 11 (índice 5) → encontrado
// → 2 pasos para N=7 (log₂ 7 ≈ 2.8)

// .NET tiene búsqueda binaria integrada:
int indice = Array.BinarySearch(ordenado, 11); // devuelve 5

// O con List<T>:
var lista = new List<int>(ordenado);
int idx = lista.BinarySearch(11); // igual, requiere que esté ordenada
```

**Comparación visual con búsqueda lineal:**

```
Array de 1 000 000 elementos, peor caso:
  Búsqueda lineal (O(N)):   hasta 1 000 000 comparaciones
  Búsqueda binaria (O(log N)):  hasta 20 comparaciones
```

> **Requisito clave**: la colección debe estar ordenada. Si no lo está, hay que ordenarla primero (O(N log N)) o usar un `Dictionary` (O(1)).

---

## Resumen rápido para entrevistas

| Operación | Estructura | Complejidad |
|-----------|-----------|-------------|
| Acceso por índice | `Array` / `List<T>` | O(1) |
| Búsqueda por valor (sin orden) | `Array` / `List<T>` | O(N) |
| Búsqueda por valor (ordenado) | `Array` / `List<T>` | O(log N) |
| Búsqueda por clave | `Dictionary<K,V>` | O(1) promedio |
| Inserción al final | `List<T>` | O(1) amortizado |
| Inserción al inicio | `List<T>` | O(N) |
| Dos loops anidados | — | O(N²) |
