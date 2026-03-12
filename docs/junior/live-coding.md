---
id: live-coding
title: 💻 Live Coding — Junior
sidebar_position: 100
---

# 💻 Live Coding — Junior

Ejercicios típicos de entrevistas para posiciones Junior. Antes de ver la solución, intenta resolverlo tú solo.

:::tip Consejo
En la entrevista real: piensa en voz alta, explica tu razonamiento, pregunta por edge cases antes de codear.
:::

---

## Ejercicio 1: FizzBuzz

**Dificultad**: 🟢 Fácil  
**Tiempo estimado**: 5 minutos  
**Temas**: bucles, condicionales, módulo

### Enunciado

Dado un número entero `n`, imprime los números del 1 al `n` con las siguientes reglas:
- Si el número es divisible por 3, imprime **"Fizz"**
- Si el número es divisible por 5, imprime **"Buzz"**
- Si el número es divisible por ambos, imprime **"FizzBuzz"**
- En cualquier otro caso, imprime el número

**Ejemplo:**
- Input: `n = 15`
- Output: `1, 2, Fizz, 4, Buzz, Fizz, 7, 8, Fizz, Buzz, 11, Fizz, 13, 14, FizzBuzz`

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa el operador módulo `%` para verificar si un número es divisible. `n % 3 == 0` significa que `n` es divisible por 3.

</details>

<details>
<summary>Ver pista 2</summary>

El orden de las condiciones importa. El caso `FizzBuzz` (divisible por ambos) debe evaluarse **antes** que los casos individuales de Fizz y Buzz.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

El truco clave es evaluar primero la divisibilidad por 15 (o por 3 y 5 simultáneamente) antes que los casos individuales.

```csharp
// Approach clásico con if-else
public static IEnumerable<string> FizzBuzz(int n)
{
    var resultado = new List<string>();

    for (int i = 1; i <= n; i++)
    {
        // Primero verificar el caso combinado
        if (i % 3 == 0 && i % 5 == 0)
            resultado.Add("FizzBuzz");
        else if (i % 3 == 0)
            resultado.Add("Fizz");
        else if (i % 5 == 0)
            resultado.Add("Buzz");
        else
            resultado.Add(i.ToString());
    }

    return resultado;
}

// Approach más extensible con StringBuilder (más fácil de extender a FizzBuzzBaz)
public static IEnumerable<string> FizzBuzzExtensible(int n)
{
    var resultado = new List<string>();

    // Definir las reglas como pares (divisor, palabra)
    var reglas = new[] { (3, "Fizz"), (5, "Buzz"), (7, "Baz") };

    for (int i = 1; i <= n; i++)
    {
        var sb = new StringBuilder();

        foreach (var (divisor, palabra) in reglas)
        {
            if (i % divisor == 0)
                sb.Append(palabra);
        }

        // Si sb está vacío, agregar el número; si no, agregar la palabra acumulada
        resultado.Add(sb.Length > 0 ? sb.ToString() : i.ToString());
    }

    return resultado;
}
```

**Complejidad**: Tiempo O(n), Espacio O(n)

**Variantes a considerar en la entrevista:**
- ¿Cómo extenderías esto para agregar "Baz" para múltiplos de 7? (el segundo approach lo maneja sin cambios)
- ¿Cómo lo harías sin usar el operador `%`? (con restas sucesivas)
- ¿Qué pasa si `n` es negativo o 0?
- ¿Podrías hacerlo con LINQ en una sola expresión?

</details>

---

## Ejercicio 2: Contar Palabras

**Dificultad**: 🟢 Fácil  
**Tiempo estimado**: 10 minutos  
**Temas**: strings, Dictionary, LINQ

### Enunciado

Dado un string de texto, contar cuántas veces aparece cada palabra, ignorando mayúsculas/minúsculas. Retornar un `Dictionary<string, int>` con la frecuencia de cada palabra, ordenado de mayor a menor frecuencia.

**Ejemplo:**
- Input: `"el perro ve al gato el gato ve al perro el perro"`
- Output: `{ "el": 3, "perro": 3, "gato": 2, "ve": 2, "al": 2 }`

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `string.Split(' ')` para dividir el texto en palabras. No olvides manejar múltiples espacios consecutivos con `StringSplitOptions.RemoveEmptyEntries`.

</details>

<details>
<summary>Ver pista 2</summary>

Para el diccionario, puedes usar `TryGetValue` o el indexador con `ContainsKey`. LINQ tiene `GroupBy` que hace esto en pocas líneas.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

Dos approaches: uno manual con Dictionary (más didáctico) y uno con LINQ (más conciso).

```csharp
// Approach 1: Manual con Dictionary — muestra comprensión de estructuras de datos
public static Dictionary<string, int> ContarPalabras(string texto)
{
    if (string.IsNullOrWhiteSpace(texto))
        return new Dictionary<string, int>();

    var frecuencias = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

    // Dividir por espacios, eliminar entradas vacías
    var palabras = texto.Split(' ', StringSplitOptions.RemoveEmptyEntries);

    foreach (var palabra in palabras)
    {
        // Limpiar puntuación básica
        var limpia = palabra.Trim(',', '.', '!', '?').ToLower();

        if (frecuencias.TryGetValue(limpia, out int conteo))
            frecuencias[limpia] = conteo + 1;
        else
            frecuencias[limpia] = 1;
    }

    // Ordenar de mayor a menor frecuencia
    return frecuencias
        .OrderByDescending(kv => kv.Value)
        .ToDictionary(kv => kv.Key, kv => kv.Value);
}

// Approach 2: Con LINQ — más idiomático en C# moderno
public static Dictionary<string, int> ContarPalabrasLinq(string texto)
{
    if (string.IsNullOrWhiteSpace(texto))
        return new Dictionary<string, int>();

    return texto
        .Split(' ', StringSplitOptions.RemoveEmptyEntries)
        .Select(p => p.Trim(',', '.', '!', '?').ToLower())
        .GroupBy(p => p)
        .OrderByDescending(g => g.Count())
        .ToDictionary(g => g.Key, g => g.Count());
}
```

**Complejidad**: Tiempo O(n log n) por el ordenamiento, Espacio O(k) donde k = número de palabras únicas

**Variantes a considerar en la entrevista:**
- ¿Cómo ignorarías palabras vacías como "el", "la", "de"? (lista de stop words)
- ¿Cómo manejarías texto muy grande que no cabe en memoria? (streaming con `yield`)
- ¿Cómo lo harías thread-safe si múltiples hilos procesan texto simultáneamente? (`ConcurrentDictionary`)
- ¿Qué diferencia hay entre `StringComparer.OrdinalIgnoreCase` y `.ToLower()`?

</details>

---

## Ejercicio 3: Invertir un String

**Dificultad**: 🟢 Fácil  
**Tiempo estimado**: 8 minutos  
**Temas**: strings, arrays, two pointers

### Enunciado

Dado un string, devolver el string invertido **sin usar el método `Reverse()`** de .NET. Implementa al menos dos approaches diferentes.

**Ejemplo:**
- Input: `"Hola Mundo"`
- Output: `"odnuM aloH"`

### Pistas

<details>
<summary>Ver pista 1</summary>

Un string en C# es inmutable, pero puedes convertirlo a `char[]`. Piensa en cómo intercambiar elementos de un array.

</details>

<details>
<summary>Ver pista 2</summary>

El approach "two pointers" usa dos índices: uno al inicio y otro al final. Intercambia los caracteres y avanza ambos hacia el centro, hasta que se crucen.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

Tres approaches de menor a mayor eficiencia: StringBuilder, array nuevo, y two pointers in-place.

```csharp
// Approach 1: Con StringBuilder — fácil de entender
public static string InvertirConStringBuilder(string texto)
{
    if (texto == null) return null;
    
    var sb = new StringBuilder(texto.Length);
    
    // Recorrer de atrás hacia adelante
    for (int i = texto.Length - 1; i >= 0; i--)
        sb.Append(texto[i]);
    
    return sb.ToString();
}

// Approach 2: Convertir a array y reconstruir — más explícito
public static string InvertirConArray(string texto)
{
    if (texto == null) return null;
    
    char[] chars = texto.ToCharArray();
    char[] invertido = new char[chars.Length];
    
    for (int i = 0; i < chars.Length; i++)
        invertido[i] = chars[chars.Length - 1 - i];
    
    return new string(invertido);
}

// Approach 3: Two Pointers in-place — O(1) espacio extra, el más eficiente
public static string InvertirTwoPointers(string texto)
{
    if (texto == null) return null;
    
    char[] chars = texto.ToCharArray();
    int izquierda = 0;
    int derecha = chars.Length - 1;
    
    // Mientras los punteros no se crucen, intercambiar
    while (izquierda < derecha)
    {
        // Intercambio clásico sin variable temporal (usando XOR)
        // O más legible: (chars[izquierda], chars[derecha]) = (chars[derecha], chars[izquierda]);
        char temp = chars[izquierda];
        chars[izquierda] = chars[derecha];
        chars[derecha] = temp;
        
        izquierda++;
        derecha--;
    }
    
    return new string(chars);
}

// Bonus: versión en JavaScript/TypeScript para contexto Full Stack
/*
function invertirString(texto: string): string {
    // Sin usar .split('').reverse().join('')
    let resultado = '';
    for (let i = texto.length - 1; i >= 0; i--) {
        resultado += texto[i];
    }
    return resultado;
}
*/
```

**Complejidad**: Tiempo O(n), Espacio O(n) para los tres approaches (el string original no puede modificarse, necesitamos al menos O(n) para el resultado)

**Variantes a considerar en la entrevista:**
- ¿Cómo invertirías las palabras de una oración pero no las letras de cada palabra? (`"Hola Mundo"` → `"Mundo Hola"`)
- ¿Cómo manejarías caracteres Unicode multi-byte o emojis? (usar `StringInfo.GetTextElementEnumerator`)
- ¿Qué pasa con un string vacío o `null`?
- En JavaScript: ¿por qué `"🏳️‍🌈".split('').reverse().join('')` puede dar resultados inesperados?

</details>

---

## Ejercicio 4: Verificar Palíndromo

**Dificultad**: 🟢 Fácil  
**Tiempo estimado**: 8 minutos  
**Temas**: strings, two pointers, normalización

### Enunciado

Dado un string, determinar si es un palíndromo ignorando espacios, puntuación y diferencias de mayúsculas/minúsculas. Solo considerar caracteres alfanuméricos.

**Ejemplo:**
- Input: `"A man, a plan, a canal: Panama"`  → Output: `true`
- Input: `"race a car"` → Output: `false`
- Input: `"Was it a car or a cat I saw?"` → Output: `true`

### Pistas

<details>
<summary>Ver pista 1</summary>

Primero normaliza el string: convierte a minúsculas y elimina todos los caracteres que no sean letras o números. Luego verifica si el resultado es igual a sí mismo invertido.

</details>

<details>
<summary>Ver pista 2</summary>

Para una solución O(1) en espacio extra, usa dos punteros (izquierda y derecha) y avanza cada uno saltando caracteres no alfanuméricos, comparando a medida que avanzas.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

Dos approaches: normalización + comparación, y two pointers sin crear string auxiliar.

```csharp
// Approach 1: Normalizar y comparar — más legible
public static bool EsPalindromo(string texto)
{
    if (texto == null) return false;
    
    // Filtrar solo caracteres alfanuméricos y convertir a minúsculas
    string normalizado = new string(
        texto.ToLower()
             .Where(c => char.IsLetterOrDigit(c))
             .ToArray()
    );
    
    // Comparar con su inverso
    string invertido = new string(normalizado.Reverse().ToArray());
    
    return normalizado == invertido;
}

// Approach 2: Two Pointers — O(1) espacio extra, sin crear strings auxiliares
public static bool EsPalindromoTwoPointers(string texto)
{
    if (texto == null) return false;
    
    int izquierda = 0;
    int derecha = texto.Length - 1;
    
    while (izquierda < derecha)
    {
        // Saltar caracteres no alfanuméricos por la izquierda
        while (izquierda < derecha && !char.IsLetterOrDigit(texto[izquierda]))
            izquierda++;
        
        // Saltar caracteres no alfanuméricos por la derecha
        while (izquierda < derecha && !char.IsLetterOrDigit(texto[derecha]))
            derecha--;
        
        // Comparar los caracteres (ignorando mayúsculas)
        if (char.ToLower(texto[izquierda]) != char.ToLower(texto[derecha]))
            return false;
        
        izquierda++;
        derecha--;
    }
    
    return true;
}
```

**Complejidad**: 
- Approach 1: Tiempo O(n), Espacio O(n)
- Approach 2: Tiempo O(n), Espacio O(1)

**Variantes a considerar en la entrevista:**
- ¿Cómo verificarías si un número entero es palíndromo sin convertirlo a string? (invertir el número matemáticamente)
- ¿Cómo encontrarías el palíndromo más largo dentro de un string? (algoritmo de Manacher o expand-around-center)
- ¿Qué consideraciones especiales hay con caracteres Unicode (acentos, ñ)?
- ¿Cómo verificarías si una lista enlazada es palíndroma?

</details>

---

## Ejercicio 5: Encontrar el Número que Falta

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 10 minutos  
**Temas**: arrays, matemáticas, XOR

### Enunciado

Dado un array de `n-1` enteros distintos que contiene números del 1 al `n` con exactamente un número faltante, encontrar ese número. La solución debe ser O(n) tiempo y O(1) espacio.

**Ejemplo:**
- Input: `[3, 7, 1, 2, 8, 4, 5]`, `n = 8`  → Output: `6`
- Input: `[1, 2, 3, 5]`, `n = 5` → Output: `4`

### Pistas

<details>
<summary>Ver pista 1</summary>

La suma de los números del 1 al n tiene una fórmula matemática: `n * (n + 1) / 2`. Si calculas la suma real del array, la diferencia te da el número faltante.

</details>

<details>
<summary>Ver pista 2</summary>

Hay un approach alternativo usando XOR. `a XOR a = 0` y `a XOR 0 = a`. Si haces XOR de todos los números del 1 al n con todos los elementos del array, los números presentes se cancelan y queda solo el faltante.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

Tres approaches: fuerza bruta (para mostrar evolución), suma matemática, y XOR.

```csharp
// Approach 1: Fuerza bruta — O(n²) tiempo, no recomendado pero útil para explicar la evolución
public static int NumeroFaltanteBruto(int[] nums, int n)
{
    for (int i = 1; i <= n; i++)
    {
        bool encontrado = false;
        foreach (int num in nums)
        {
            if (num == i) { encontrado = true; break; }
        }
        if (!encontrado) return i;
    }
    return -1; // No debería llegar aquí
}

// Approach 2: Suma matemática — O(n) tiempo, O(1) espacio ✅ Recomendado
public static int NumeroFaltanteSuma(int[] nums, int n)
{
    // La suma esperada de 1 a n es n*(n+1)/2
    long sumaEsperada = (long)n * (n + 1) / 2;
    
    // Calcular la suma real del array
    long sumaReal = 0;
    foreach (int num in nums)
        sumaReal += num;
    
    // La diferencia es el número faltante
    return (int)(sumaEsperada - sumaReal);
}

// Approach 3: XOR — O(n) tiempo, O(1) espacio, evita overflow de suma
public static int NumeroFaltanteXor(int[] nums, int n)
{
    int xor = 0;
    
    // XOR de todos los números del 1 al n
    for (int i = 1; i <= n; i++)
        xor ^= i;
    
    // XOR con todos los elementos del array
    // Los pares se cancelan, queda solo el número faltante
    foreach (int num in nums)
        xor ^= num;
    
    return xor;
}

// Usando LINQ (más conciso, mismo approach de suma)
public static int NumeroFaltanteLinq(int[] nums, int n)
{
    long sumaEsperada = (long)n * (n + 1) / 2;
    return (int)(sumaEsperada - nums.Sum(x => (long)x));
}
```

**Complejidad**: Tiempo O(n), Espacio O(1)

**Variantes a considerar en la entrevista:**
- ¿Qué pasaría si hay **dos** números faltantes? (necesitas más información, ej: suma + suma de cuadrados)
- ¿Por qué usamos `long` en el approach de suma? (prevenir overflow con n grande)
- ¿Qué pasa si los números van del 0 al n en vez del 1 al n?
- ¿Cómo lo harías si el array puede tener duplicados?

</details>

---

## Ejercicio 6: Primer Carácter No Repetido

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 10 minutos  
**Temas**: strings, Dictionary, orden de inserción

### Enunciado

Dado un string, encontrar el **primer** carácter que aparece exactamente una vez. Si todos los caracteres se repiten, retornar `'\0'` o `-1` (índice).

**Ejemplo:**
- Input: `"leetcode"` → Output: `'l'` (índice 0)
- Input: `"loveleetcode"` → Output: `'v'` (índice 2)
- Input: `"aabb"` → Output: `'\0'` (no hay)

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa un `Dictionary<char, int>` para contar las frecuencias de cada carácter en un primer recorrido. Luego en un segundo recorrido, busca el primero con frecuencia 1.

</details>

<details>
<summary>Ver pista 2</summary>

¿Por qué necesitas dos recorridos? Porque al hacer el primero, no sabes si un carácter que acabas de ver volverá a aparecer más adelante. El segundo recorrido respeta el orden original del string.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

La clave es usar dos pasadas: una para contar, otra para encontrar el primero único en orden.

```csharp
// Approach principal: dos pasadas con Dictionary
public static char PrimerCaracterUnico(string texto)
{
    if (string.IsNullOrEmpty(texto))
        return '\0';
    
    // Primera pasada: contar frecuencias de cada carácter
    var frecuencias = new Dictionary<char, int>();
    
    foreach (char c in texto)
    {
        if (frecuencias.ContainsKey(c))
            frecuencias[c]++;
        else
            frecuencias[c] = 1;
        
        // Alternativa más concisa:
        // frecuencias[c] = frecuencias.GetValueOrDefault(c, 0) + 1;
    }
    
    // Segunda pasada: encontrar el primero con frecuencia 1
    // Recorremos el string original para respetar el orden
    foreach (char c in texto)
    {
        if (frecuencias[c] == 1)
            return c;
    }
    
    return '\0'; // Ningún carácter es único
}

// Retornar índice en vez del carácter (variante común en LeetCode)
public static int PrimerCaracterUnicoIndice(string texto)
{
    if (string.IsNullOrEmpty(texto))
        return -1;
    
    var frecuencias = new Dictionary<char, int>();
    
    foreach (char c in texto)
        frecuencias[c] = frecuencias.GetValueOrDefault(c, 0) + 1;
    
    for (int i = 0; i < texto.Length; i++)
    {
        if (frecuencias[texto[i]] == 1)
            return i;
    }
    
    return -1;
}

// Approach con array de 26 posiciones (solo letras minúsculas inglesas) — O(1) espacio
public static char PrimerCaracterUnicoArray(string texto)
{
    // Usar array en vez de Dictionary cuando el espacio del alfabeto es fijo
    int[] conteo = new int[26];
    
    foreach (char c in texto)
        conteo[c - 'a']++;
    
    foreach (char c in texto)
    {
        if (conteo[c - 'a'] == 1)
            return c;
    }
    
    return '\0';
}
```

**Complejidad**: Tiempo O(n), Espacio O(1) — el Dictionary/array tiene como máximo 26 entradas (alfabeto fijo)

**Variantes a considerar en la entrevista:**
- ¿Cómo manejarías caracteres Unicode o emojis? (el array de 26 no es suficiente)
- ¿Podrías hacerlo en una sola pasada? (con una lista ordenada de índices, más complejo)
- ¿Cómo encontrarías el **último** carácter no repetido?
- ¿Qué diferencia hay entre `Dictionary` y un array de conteo para este problema?

</details>

---

## Ejercicio 7: Componente React — Contador

**Dificultad**: 🟢 Fácil  
**Tiempo estimado**: 10 minutos  
**Temas**: React, useState, TypeScript, props

### Enunciado

Implementa un componente React `Contador` en TypeScript que:
- Muestre el valor actual del contador
- Tenga botones para incrementar (+1), decrementar (-1) y resetear (0)
- Acepte un valor inicial como prop opcional (default: 0)
- Acepte un límite mínimo y máximo como props opcionales
- Los botones de +/- deben deshabilitarse al alcanzar los límites

**Ejemplo:**
- `<Contador valorInicial={5} min={0} max={10} />`
- El botón `-` se deshabilita cuando el contador llega a 0
- El botón `+` se deshabilita cuando llega a 10

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `useState` para manejar el valor actual del contador. El valor inicial del estado puede venir de una prop.

</details>

<details>
<summary>Ver pista 2</summary>

Para deshabilitar los botones, usa la prop `disabled` de `<button>`. La condición es simple: `disabled={valor <= min}` para el botón de decremento.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

Componente con tipado estricto, manejo de límites y separación de lógica de presentación.

```typescript
// Contador.tsx
import React, { useState } from 'react';

// Definir las props con tipos explícitos
interface ContadorProps {
  valorInicial?: number;  // Valor inicial (default: 0)
  min?: number;           // Límite mínimo (default: -Infinity)
  max?: number;           // Límite máximo (default: +Infinity)
  paso?: number;          // Incremento por paso (default: 1)
  onCambio?: (valor: number) => void;  // Callback al cambiar
}

const Contador: React.FC<ContadorProps> = ({
  valorInicial = 0,
  min = -Infinity,
  max = Infinity,
  paso = 1,
  onCambio,
}) => {
  const [valor, setValor] = useState<number>(valorInicial);

  // Función helper para actualizar el valor y notificar al padre
  const actualizar = (nuevoValor: number) => {
    setValor(nuevoValor);
    onCambio?.(nuevoValor);  // Optional chaining: llamar solo si existe
  };

  const incrementar = () => {
    if (valor + paso <= max) actualizar(valor + paso);
  };

  const decrementar = () => {
    if (valor - paso >= min) actualizar(valor - paso);
  };

  const resetear = () => actualizar(valorInicial);

  // Determinar si los botones deben estar deshabilitados
  const puedeIncrementar = valor + paso <= max;
  const puedeDecrementar = valor - paso >= min;

  return (
    <div className="contador">
      <button
        onClick={decrementar}
        disabled={!puedeDecrementar}
        aria-label="Decrementar"
      >
        −
      </button>

      <span className="contador__valor" aria-live="polite">
        {valor}
      </span>

      <button
        onClick={incrementar}
        disabled={!puedeIncrementar}
        aria-label="Incrementar"
      >
        +
      </button>

      <button
        onClick={resetear}
        className="contador__reset"
        aria-label="Resetear"
      >
        Reset
      </button>
    </div>
  );
};

export default Contador;

// Uso del componente:
// <Contador valorInicial={5} min={0} max={10} onCambio={(v) => console.log(v)} />
```

**Complejidad**: No aplica (componente de UI)

**Variantes a considerar en la entrevista:**
- ¿Cómo extraerías la lógica a un custom hook `useContador()`? (separar lógica de presentación)
- ¿Cómo agregarías un historial de cambios para poder hacer "undo"? (`useReducer` con array de estados)
- ¿Cómo persistirías el valor en `localStorage`? (efecto secundario con `useEffect`)
- ¿Qué consideraciones de accesibilidad tiene el componente? (`aria-live`, `aria-label`)
- ¿Por qué se usa `React.FC<Props>` vs solo definir la función con tipos?

</details>

---

## Ejercicio 8: Consultas SQL Básicas

**Dificultad**: 🟢 Fácil  
**Tiempo estimado**: 15 minutos  
**Temas**: SQL, GROUP BY, window functions, subconsultas

### Enunciado

Dada la siguiente tabla de empleados:

```sql
CREATE TABLE Empleados (
    Id          INT PRIMARY KEY,
    Nombre      VARCHAR(100),
    Departamento VARCHAR(50),
    Salario     DECIMAL(10,2),
    FechaIngreso DATE
);
```

Escribe las siguientes queries:

**A)** Los 3 empleados con mayor salario por departamento  
**B)** Empleados cuyo salario es mayor al promedio de su departamento  
**C)** El departamento con mayor masa salarial total

**Ejemplo de datos:**
```
| Id | Nombre | Departamento | Salario |
|----|--------|--------------|---------|
| 1  | Ana    | IT           | 80000   |
| 2  | Bob    | IT           | 70000   |
| 3  | Carol  | IT           | 90000   |
| 4  | David  | RRHH         | 60000   |
| 5  | Eva    | RRHH         | 65000   |
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Para el top 3 por departamento, necesitas particionar los datos. `ROW_NUMBER() OVER (PARTITION BY Departamento ORDER BY Salario DESC)` te da un número de fila dentro de cada departamento.

</details>

<details>
<summary>Ver pista 2</summary>

Para comparar con el promedio del propio departamento, puedes usar una subconsulta correlacionada, un CTE con `AVG() GROUP BY`, o una window function `AVG() OVER (PARTITION BY Departamento)`.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```sql
-- ============================================================
-- A) Top 3 empleados por salario dentro de cada departamento
-- ============================================================

-- Con Window Function ROW_NUMBER (SQL Server, PostgreSQL, MySQL 8+)
WITH EmpleadosRankeados AS (
    SELECT
        Id,
        Nombre,
        Departamento,
        Salario,
        -- Numerar filas dentro de cada departamento, de mayor a menor salario
        ROW_NUMBER() OVER (
            PARTITION BY Departamento      -- Reiniciar conteo por departamento
            ORDER BY Salario DESC          -- De mayor a menor
        ) AS RankSalario
    FROM Empleados
)
SELECT Id, Nombre, Departamento, Salario, RankSalario
FROM EmpleadosRankeados
WHERE RankSalario <= 3
ORDER BY Departamento, RankSalario;

-- Nota: Usar RANK() en vez de ROW_NUMBER() si quieres incluir empates
-- ROW_NUMBER: 1, 2, 3 (siempre único)
-- RANK:       1, 2, 2, 4 (empates reciben el mismo rank, salta el siguiente)
-- DENSE_RANK: 1, 2, 2, 3 (empates reciben el mismo rank, no salta)


-- ============================================================
-- B) Empleados con salario mayor al promedio de su departamento
-- ============================================================

-- Approach 1: Subconsulta correlacionada
SELECT e.Id, e.Nombre, e.Departamento, e.Salario
FROM Empleados e
WHERE e.Salario > (
    SELECT AVG(e2.Salario)
    FROM Empleados e2
    WHERE e2.Departamento = e.Departamento  -- Correlación: mismo departamento
)
ORDER BY e.Departamento, e.Salario DESC;

-- Approach 2: Con CTE + JOIN (más legible, puede ser más eficiente)
WITH PromediosPorDepto AS (
    SELECT
        Departamento,
        AVG(Salario) AS SalarioPromedio
    FROM Empleados
    GROUP BY Departamento
)
SELECT e.Id, e.Nombre, e.Departamento, e.Salario,
       ROUND(p.SalarioPromedio, 2) AS PromedioDepto
FROM Empleados e
INNER JOIN PromediosPorDepto p ON e.Departamento = p.Departamento
WHERE e.Salario > p.SalarioPromedio
ORDER BY e.Departamento, e.Salario DESC;

-- Approach 3: Window Function (moderno, en una sola pasada)
SELECT Id, Nombre, Departamento, Salario
FROM (
    SELECT
        Id, Nombre, Departamento, Salario,
        AVG(Salario) OVER (PARTITION BY Departamento) AS PromedioDepto
    FROM Empleados
) t
WHERE Salario > PromedioDepto
ORDER BY Departamento, Salario DESC;


-- ============================================================
-- C) Departamento con mayor masa salarial total
-- ============================================================

-- Con TOP 1 (SQL Server)
SELECT TOP 1
    Departamento,
    SUM(Salario)   AS MasaSalarial,
    COUNT(*)       AS NumEmpleados,
    AVG(Salario)   AS SalarioPromedio
FROM Empleados
GROUP BY Departamento
ORDER BY MasaSalarial DESC;

-- Con LIMIT 1 (MySQL, PostgreSQL)
SELECT
    Departamento,
    SUM(Salario)   AS MasaSalarial,
    COUNT(*)       AS NumEmpleados
FROM Empleados
GROUP BY Departamento
ORDER BY MasaSalarial DESC
LIMIT 1;
```

**Complejidad**: O(n log n) para la mayoría de las queries (por el ordenamiento interno de las window functions)

**Variantes a considerar en la entrevista:**
- ¿Cuál es la diferencia entre `ROW_NUMBER()`, `RANK()` y `DENSE_RANK()`? (comportamiento con empates)
- ¿Cuándo usarías una subconsulta correlacionada vs un JOIN con CTE? (rendimiento, legibilidad)
- ¿Cómo añadirías un índice para optimizar la query B? (`CREATE INDEX idx_empleados_depto_salario ON Empleados(Departamento, Salario)`)
- ¿Cómo encontrarías empleados que ganaron más que **todos** los empleados de otro departamento? (`> ALL(...)`)
- ¿Qué hace `HAVING` y en qué se diferencia de `WHERE`? (WHERE filtra filas, HAVING filtra grupos)

</details>
