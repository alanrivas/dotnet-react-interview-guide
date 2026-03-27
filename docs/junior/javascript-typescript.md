---
id: javascript-typescript
title: JavaScript & TypeScript
sidebar_position: 4
---

# JavaScript & TypeScript 🟢

## JavaScript moderno (ES6+)

### Variables y scope

```javascript
// var: function-scoped, hoisted — EVITAR
// let: block-scoped, mutable
// const: block-scoped, inmutable (la referencia, no el contenido)

const nombre = "Juan";
let contador = 0;

// Hoisting: var se "sube" al inicio de la función
console.log(x); // undefined (no error)
var x = 5;

console.log(y); // ReferenceError
let y = 5;
```

### Arrow functions y `this`

```javascript
// Arrow functions NO tienen su propio `this`
// Heredan el `this` del contexto donde fueron definidas

class Temporizador {
  constructor() {
    this.segundos = 0;
  }

  iniciar() {
    // ❌ función normal: `this` es undefined en strict mode
    setInterval(function() {
      this.segundos++; // Error: `this` no es el Temporizador
    }, 1000);

    // ✅ arrow function: `this` es el Temporizador
    setInterval(() => {
      this.segundos++;
    }, 1000);
  }
}
```

### Destructuring

```javascript
// Array destructuring
const [primero, segundo, ...resto] = [1, 2, 3, 4, 5];
// primero = 1, segundo = 2, resto = [3, 4, 5]

// Object destructuring
const { nombre, edad, ciudad = "Buenos Aires" } = persona;
// ciudad tiene valor por default si no existe en el objeto

// En parámetros de función
function mostrar({ nombre, edad }) {
  console.log(`${nombre} tiene ${edad} años`);
}

// Renombrar al desestructurar
const { nombre: nombreCompleto } = persona;
```

### Spread y Rest

```javascript
// Spread: expandir iterable
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]

const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3, b: 99 }; // b se sobreescribe: { a:1, b:99, c:3 }

// Clonar (shallow copy)
const copia = { ...original };
const copiaArr = [...original];

// Rest: agrupar en un array
function sumar(primero, ...resto) {
  return primero + resto.reduce((a, b) => a + b, 0);
}
```

---

## Closures

Una closure es una función que "recuerda" el scope donde fue creada.

```javascript
function crearContador() {
  let count = 0; // esta variable vive en el closure

  return {
    incrementar: () => ++count,
    decrementar: () => --count,
    obtener: () => count,
  };
}

const contador = crearContador();
contador.incrementar(); // 1
contador.incrementar(); // 2
contador.obtener(); // 2

// Uso práctico: función con configuración
function crearMultiplicador(factor) {
  return (numero) => numero * factor;
}

const doble = crearMultiplicador(2);
const triple = crearMultiplicador(3);
doble(5);  // 10
triple(5); // 15
```

---

## Promesas y Async/Await

```javascript
// Promise: representa un valor futuro
const promesa = new Promise((resolve, reject) => {
  setTimeout(() => {
    if (Math.random() > 0.5) {
      resolve("Éxito");
    } else {
      reject(new Error("Falló"));
    }
  }, 1000);
});

// Consumir con .then/.catch
promesa
  .then(resultado => console.log(resultado))
  .catch(error => console.error(error))
  .finally(() => console.log("Terminó"));

// Consumir con async/await (más legible)
async function obtenerDatos() {
  try {
    const resultado = await promesa;
    console.log(resultado);
  } catch (error) {
    console.error(error);
  }
}

// Promise combinators
const [usuarios, productos] = await Promise.all([
  fetchUsuarios(),
  fetchProductos(),
]);

// Promise.allSettled — no falla si alguna rechaza
const resultados = await Promise.allSettled([p1, p2, p3]);
// resultados = [{status: 'fulfilled', value: ...}, {status: 'rejected', reason: ...}]

// Promise.race — la primera que resuelva o rechace
const primero = await Promise.race([p1, p2]);
```

---

## Event Loop

```
Call Stack → Web APIs → Callback Queue → Event Loop → Call Stack

Microtask Queue (Promises): tiene prioridad sobre Macrotask Queue
Macrotask Queue (setTimeout, setInterval): se procesa después
```

```javascript
console.log("1");                    // sync → Call Stack

setTimeout(() => console.log("2"), 0); // macrotask → macrotask queue

Promise.resolve().then(() => console.log("3")); // microtask → microtask queue

console.log("4");                    // sync → Call Stack

// Orden de salida: 1, 4, 3, 2
// Explicación:
// - "1" y "4" son síncronos (Call Stack)
// - "3" es una microtask (Promise) → se ejecuta antes que la macrotask
// - "2" es una macrotask (setTimeout) → se ejecuta último
```

---

## Módulos ES

```javascript
// named exports
export const PI = 3.14159;
export function calcularArea(radio) { return PI * radio ** 2; }
export class Circulo { /* ... */ }

// default export (uno por módulo)
export default function principal() { /* ... */ }

// imports
import { PI, calcularArea } from './matematicas.js';
import { calcularArea as area } from './matematicas.js'; // alias
import * as Mat from './matematicas.js'; // namespace
import principal from './matematicas.js'; // default
import principal, { PI } from './matematicas.js'; // ambos
```

---

## TypeScript — Fundamentos

```typescript
// Tipos básicos
let nombre: string = "Juan";
let edad: number = 30;
let activo: boolean = true;
let datos: any = "cualquier cosa"; // evitar any

// Arrays
let numeros: number[] = [1, 2, 3];
let nombres: Array<string> = ["Ana", "Bob"];

// Tuple
let par: [string, number] = ["Juan", 30];

// Union types
let id: string | number = "abc123";
id = 42; // también válido

// Type assertion
const input = document.getElementById("nombre") as HTMLInputElement;
```

### Interfaces y Types

```typescript
// Interface — para describir la forma de un objeto
interface Usuario {
  id: number;
  nombre: string;
  email: string;
  edad?: number; // opcional
  readonly createdAt: Date; // solo lectura
}

// Type alias — más flexible
type ID = string | number;
type Coordenadas = { x: number; y: number };
type Direccion = "norte" | "sur" | "este" | "oeste"; // literal union

// Diferencia clave:
// Interface: extensible con `extends` y `implements`, puede mergearse
// Type: puede ser union/intersection, no se puede mergear

interface Animal { nombre: string; }
interface Perro extends Animal { raza: string; }

type AnimalConRaza = Animal & { raza: string }; // intersection type
```

### Generics en TypeScript

```typescript
// Función genérica
function primero<T>(arr: T[]): T | undefined {
  return arr[0];
}

const num = primero([1, 2, 3]); // tipo: number
const str = primero(["a", "b"]); // tipo: string

// Interface genérica
interface Respuesta<T> {
  data: T;
  status: number;
  mensaje: string;
}

type RespuestaUsuario = Respuesta<Usuario>;
type RespuestaLista = Respuesta<Usuario[]>;

// Utility types más usados
type UsuarioParcial = Partial<Usuario>;       // todos los campos opcionales
type UsuarioRequerido = Required<Usuario>;     // todos requeridos
type SoloNombre = Pick<Usuario, 'nombre' | 'email'>; // solo algunos campos
type SinId = Omit<Usuario, 'id'>;             // sin algunos campos
type IdOEmail = keyof Pick<Usuario, 'id' | 'email'>; // "id" | "email"
type IdsRecord = Record<string, number>;      // { [key: string]: number }
```

### Enums

```typescript
// Enum numérico
enum Direccion {
  Arriba,    // 0
  Abajo,     // 1
  Izquierda, // 2
  Derecha,   // 3
}

// Enum string (preferido — más legible en debugging)
enum Estado {
  Pendiente = "PENDIENTE",
  Activo = "ACTIVO",
  Inactivo = "INACTIVO",
}

// Alternativa moderna: const assertion (más liviano que enum)
const ESTADO = {
  Pendiente: "PENDIENTE",
  Activo: "ACTIVO",
  Inactivo: "INACTIVO",
} as const;

type EstadoType = typeof ESTADO[keyof typeof ESTADO];
// EstadoType = "PENDIENTE" | "ACTIVO" | "INACTIVO"
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre `var`, `let` y `const`?**
> - `var`: function-scoped, hoisted, mutable. **Evitar en código moderno.**
> - `let`: block-scoped (if, for, {}), no hoisted, mutable. **Preferido para variables.**
> - `const`: block-scoped, no hoisted, inmutable a nivel de referencia (pero el contenido de un objeto sí puede mutarse). **Preferido por defecto.**

```javascript
// var: hoisted
console.log(x); // undefined (no error)
var x = 5;

// let/const: no hoisted
console.log(y); // ReferenceError: Cannot access 'y' before initialization
let y = 5;

// const es inmutable a nivel de referencia
const obj = { a: 1 };
obj.a = 2;         // ✓ permitido (muta el objeto)
obj = { a: 2 };    // ✗ error: asignación a una constante
```

**2. ¿Qué es una closure? ¿Por qué es importante?**
> Una closure es una función que "recuerda" el scope léxico donde fue creada. Es importante porque permite encapsulación de variables privadas y es la base de patrones como callbacks, HOCs, Redux reducers.

```javascript
function crear Contador() {
  let count = 0; // privada, solo accesible a través de la closure
  
  return {
    incrementar: () => ++count,
    obtener: () => count,
  };
}

const contador = crearContador();
contador.incrementar(); // 1
// No existe forma de acceder a count directamente desde afuera
```

**3. ¿Cuál es el orden de ejecución en Event Loop?**
> Call Stack → Microtask Queue → Macrotask Queue
> 
> Las microtasks (Promises, `queueMicrotask`, `MutationObserver`) se ejecutan ANTES que las macrotasks (setTimeout, setInterval, I/O).

```javascript
console.log("1");                      // sync: 1
setTimeout(() => console.log("2"), 0); // macrotask
Promise.resolve().then(() => console.log("3")); // microtask
console.log("4");                      // sync: 4

// Salida: 1, 4, 3, 2
```

**4. ¿Cuál es la diferencia entre promesas y async/await?**
> Son equivalentes: `async/await` es sintaxis azúcar sobre promesas. La diferencia es que `async/await` es más legible y permite usar `try/catch` como en código síncrono.

```javascript
// Promesas
function obtenerApi() {
  return fetch('/api')
    .then(res => res.json())
    .then(data => data)
    .catch(err => console.error(err));
}

// Async/Await (equivalente, más legible)
async function obtenerApi() {
  try {
    const res = await fetch('/api');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(err);
  }
}
```

**5. ¿Qué es destructuring y para qué sirve?**
> Destructuring es extraer valores de arrays u objetos en variables separadas. Sirve para hacer código más legible y conciso.

```javascript
// Array destructuring
const [primero, segundo, ...resto] = [1, 2, 3, 4];

// Object destructuring
const { nombre, edad, ciudad = "Buenos Aires" } = persona;

// En parámetros (muy usado en React)
function mostrar({ nombre, edad }) { }

// Renombrar (alias)
const { nombreCompleto: nombre } = persona;
```

**6. ¿Qué pasa con `this` en arrow functions?**
> Arrow functions NO tienen su propio `this`. Heredan el `this` del contexto léxico donde fueron creadas. Esto contrasta con funciones normales donde `this` se determina por cómo fueron llamadas.

```javascript
const obj = {
  valor: 42,
  normal: function() {
    console.log(this.valor); // this es obj
  },
  flecha: () => {
    console.log(this.valor); // this es el objeto global (undefined en módulos)
  },
};

obj.normal();  // 42
obj.flecha();  // undefined
```

**7. ¿Qué es `Promise.all()` vs `Promise.allSettled()` vs `Promise.race()`?**
> - `Promise.all()`: Espera a que todas las promesas se resuelvan O que UNA falle (fail fast).
> - `Promise.allSettled()`: Espera a que TODAS terminen (resueltas o rechazadas).
> - `Promise.race()`: Devuelve la primera que termine (resuelva o rechace).

```javascript
// all: falla si alguna rechaza
Promise.all([p1, p2, p3]) // rechaza si p2 falla

// allSettled: siempre devuelve resultado
Promise.allSettled([p1, p2, p3])
// [{status: 'fulfilled', value: ...}, {status: 'rejected', reason: ...}]

// race: la primera gana
Promise.race([delayedPromise(1000), delayedPromise(500)])
// resuelve en ~500ms
```

**8. ¿Cuál es la diferencia entre `interface` y `type` en TypeScript?**
> - `interface`: para describir contratos de objetos. Extensible con `extends`, puede mergearse.
> - `type`: más flexible, puede ser union, intersection. Mejor para alias de tipos.

```typescript
interface Animal { nombre: string; }
interface Perro extends Animal { raza: string; }

// vs

type Animal = { nombre: string };
type Perro = Animal & { raza: string };

// Merge: solo Interface
interface Usuario { name: string; }
interface Usuario { age: number; } // se mergean
// Usuario = { name: string; age: number }
```

**9. ¿Para qué sirven los Generics en TypeScript?**
> Generics permiten escribir código reutilizable que trabaja con múltiples tipos. Son especialmente útiles en funciones y estructuras que no dependen de un tipo específico.

```typescript
function primero<T>(arr: T[]): T | undefined {
  return arr[0];
}

const num = primero([1, 2, 3]);           // T = number
const str = primero(["a", "b"]);          // T = string
const usuario = primero([user1, user2]);  // T = Usuario
```

**10. ¿Qué diferencia hay entre `any` y `unknown` en TypeScript?**
> - `any`: desactiva type checking completamente. ¡Evitar!
> - `unknown`: es seguro. Requiere type narrowing (comprobar el tipo) antes de usar.

```typescript
let algo: any = "texto";
algo.toUpperCase(); // ✓ permitido (pero unsafe)

let desconocido: unknown = "texto";
desconocido.toUpperCase(); // ✗ error: no sabemos que es string

// Type narrowing
if (typeof desconocido === "string") {
  desconocido.toUpperCase(); // ✓ ahora es seguro
}
```
