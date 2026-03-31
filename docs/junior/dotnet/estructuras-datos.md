---
id: estructuras-datos
title: Estructuras de Datos
sidebar_position: 20
---

# Estructuras de Datos 🟢

Elegir la estructura correcta comunica que entiendes el problema. Esta guía cubre las estructuras más frecuentes en entrevistas junior.

## Stack&lt;T&gt; — LIFO (último en entrar, primero en salir)

Un **Stack** (pila) funciona como una pila de platos: solo puedes agregar o quitar del tope.

```csharp
var historial = new Stack<string>();

// Navegar páginas (Push agrega al tope)
historial.Push("inicio");
historial.Push("productos");
historial.Push("detalle/42");

// Volver atrás (Pop quita del tope)
string paginaActual = historial.Pop();   // "detalle/42"
string paginaAnterior = historial.Pop(); // "productos"

// Ver sin quitar
string siguiente = historial.Peek(); // "inicio" (sin modificar el stack)

Console.WriteLine($"Quedan: {historial.Count} páginas"); // 1
```

**Casos de uso:**
- Historial de navegación (botón "Atrás")
- Deshacer/rehacer en editores de texto (`Ctrl+Z`)
- Evaluación de expresiones matemáticas (`3 + (4 * 2)`)
- Llamadas recursivas (el call stack de .NET es literalmente un Stack)

---

## Queue&lt;T&gt; — FIFO (primero en entrar, primero en salir)

Una **Queue** (cola) funciona como una fila de caja: el primero que llega es el primero en ser atendido.

```csharp
var colaImpresion = new Queue<string>();

// Enviar documentos a imprimir
colaImpresion.Enqueue("factura.pdf");
colaImpresion.Enqueue("contrato.docx");
colaImpresion.Enqueue("imagen.png");

// Imprimir en orden de llegada
string primero = colaImpresion.Dequeue(); // "factura.pdf"
string segundo = colaImpresion.Dequeue(); // "contrato.docx"

// Ver el siguiente sin quitarlo
string enEspera = colaImpresion.Peek(); // "imagen.png"
```

**Casos de uso:**
- Cola de impresión (primer trabajo → primero en imprimirse)
- Procesamiento de mensajes / eventos en orden de llegada
- BFS (búsqueda en anchura) en grafos
- Sistemas de tickets de soporte

---

## Comparación Stack vs Queue

| | Stack&lt;T&gt; | Queue&lt;T&gt; |
|-|---------|---------|
| Orden | LIFO — último primero | FIFO — primero primero |
| Agregar | `Push(item)` | `Enqueue(item)` |
| Quitar | `Pop()` | `Dequeue()` |
| Ver sin quitar | `Peek()` | `Peek()` |
| Caso de uso típico | Historial, deshacer | Colas de trabajo, mensajes |

```csharp
// Truco mnemotécnico:
// Stack  → como una PILA de platos, agregas y sacas POR ARRIBA
// Queue  → como una FILA de personas, entras por atrás, sales por adelante
```

---

## LinkedList&lt;T&gt; — lista doblemente enlazada

Una `LinkedList<T>` conecta nodos entre sí. Cada nodo conoce el anterior y el siguiente.

```csharp
var lista = new LinkedList<string>();

lista.AddLast("B");
lista.AddFirst("A");  // A ↔ B
lista.AddLast("C");   // A ↔ B ↔ C

// Insertar en medio: O(1) si ya tienes el nodo de referencia
var nodoB = lista.Find("B");
lista.AddAfter(nodoB, "B2"); // A ↔ B ↔ B2 ↔ C

// Eliminar: O(1) si ya tienes el nodo
lista.Remove(nodoB); // A ↔ B2 ↔ C
```

**Cuándo elegir `LinkedList<T>` sobre `List<T>`:**

| Operación | `List<T>` | `LinkedList<T>` |
|-----------|-----------|-----------------|
| Acceso por índice (`list[3]`) | O(1) ✅ | O(N) ❌ |
| Insertar al principio | O(N) ❌ | O(1) ✅ |
| Insertar en medio (con referencia) | O(N) ❌ | O(1) ✅ |
| Recorrer todos | O(N) | O(N) |

> En la práctica, `List<T>` es la opción por defecto. `LinkedList<T>` brilla cuando haces muchas inserciones/eliminaciones al inicio o en el medio y tienes referencias directas a los nodos.

---

## Cuándo usar cada estructura

```
¿Necesitas acceso por índice (lista[i])?
  → List<T>

¿Buscas frecuentemente por clave?
  → Dictionary<K, V>

¿El último en entrar debe salir primero (LIFO)?
  → Stack<T>

¿El primero en entrar debe salir primero (FIFO)?
  → Queue<T>

¿Muchas inserciones/eliminaciones en el medio?
  → LinkedList<T>

¿Solo necesitas iterar sin modificar?
  → IEnumerable<T> (la interfaz más genérica)
```

---

## Resumen de complejidades

| Estructura | Agregar al final | Agregar al inicio | Buscar por valor | Acceso por índice |
|-----------|-----------------|------------------|-----------------|------------------|
| `List<T>` | O(1)* | O(N) | O(N) | O(1) |
| `Stack<T>` | O(1)* Push | — | O(N) | — |
| `Queue<T>` | O(1)* Enqueue | — | O(N) | — |
| `LinkedList<T>` | O(1) | O(1) | O(N) | O(N) |
| `Dictionary<K,V>` | O(1)* | — | O(1)* | — |
| `HashSet<T>` | O(1)* | — | O(1)* | — |

\* Amortizado: puede redimensionarse internamente de vez en cuando.
