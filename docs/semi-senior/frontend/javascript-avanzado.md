---
id: javascript-avanzado
title: JavaScript Avanzado
sidebar_position: 5
---

# JavaScript Avanzado 🟡

## Prototypes y herencia prototipica

```javascript
// Todo objeto en JS tiene un prototipo (__proto__)
// La cadena de prototipos termina en null

function Animal(nombre) {
  this.nombre = nombre;
}

Animal.prototype.hablar = function() {
  return `${this.nombre} hace un sonido`;
};

function Perro(nombre) {
  Animal.call(this, nombre); // llamar al constructor padre
}

// Establecer cadena de prototipos
Perro.prototype = Object.create(Animal.prototype);
Perro.prototype.constructor = Perro;

Perro.prototype.ladrar = function() {
  return `${this.nombre} ladra`;
};

// class es "syntactic sugar" sobre prototypes
class AnimaES6 {
  constructor(nombre) {
    this.nombre = nombre;
  }
  hablar() { return `${this.nombre} hace sonido`; }
}

class PerroES6 extends AnimaES6 {
  constructor(nombre) {
    super(nombre);
  }
  ladrar() { return `${this.nombre} ladra`; }
}
```

---

## Manejo avanzado de arrays

```javascript
const productos = [
  { id: 1, nombre: 'Laptop', precio: 999, activo: true },
  { id: 2, nombre: 'Mouse', precio: 29, activo: false },
  { id: 3, nombre: 'Monitor', precio: 449, activo: true },
];

// map: transformar
const nombres = productos.map(p => p.nombre);
const conDescuento = productos.map(p => ({ ...p, precio: p.precio * 0.9 }));

// filter: filtrar
const activos = productos.filter(p => p.activo);

// reduce: acumular
const total = productos.reduce((acc, p) => acc + p.precio, 0);
const porId = productos.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});
// { 1: {nombre: 'Laptop'...}, 2: {...}, 3: {...} }

// find / findIndex
const laptop = productos.find(p => p.nombre === 'Laptop');
const idx = productos.findIndex(p => p.id === 2);

// flatMap: map + flat en un paso
const tags = [['js', 'ts'], ['react', 'vue']].flatMap(x => x);
// ['js', 'ts', 'react', 'vue']

// some / every
const hayCaros = productos.some(p => p.precio > 500);
const todosActivos = productos.every(p => p.activo);

// Encadenamiento
const resultado = productos
  .filter(p => p.activo)
  .sort((a, b) => a.precio - b.precio)
  .map(p => p.nombre);
```

---

## WeakMap / WeakSet / Map / Set

```javascript
// Set: colección de valores únicos
const set = new Set([1, 2, 2, 3, 3, 3]);
// {1, 2, 3}
set.add(4);
set.has(2); // true
set.delete(1);
const arr = [...set]; // convertir a array

// Map: diccionario con claves de cualquier tipo
const map = new Map();
map.set('clave', 'valor');
map.set({ id: 1 }, 'objeto como clave');
map.get('clave'); // 'valor'
map.has('clave'); // true
map.size; // 2

// Diferencia con objeto:
// Map: cualquier tipo de clave, preserva orden, .size nativo
// Objeto: solo strings/symbols como clave

// WeakMap / WeakSet: referencias débiles (permite GC)
// Útil para asociar datos privados sin impedir la liberación de memoria
const datosPrivados = new WeakMap();
class Persona {
  constructor(nombre) {
    datosPrivados.set(this, { nombre, secreto: 'xyz' });
  }
  getNombre() { return datosPrivados.get(this).nombre; }
}
```

---

## Iterators y Generators

```javascript
// Symbol.iterator: protocolo de iteración
class Rango {
  constructor(inicio, fin) {
    this.inicio = inicio;
    this.fin = fin;
  }

  [Symbol.iterator]() {
    let actual = this.inicio;
    const fin = this.fin;
    return {
      next() {
        return actual <= fin
          ? { value: actual++, done: false }
          : { value: undefined, done: true };
      }
    };
  }
}

for (const n of new Rango(1, 5)) {
  console.log(n); // 1, 2, 3, 4, 5
}

// Generator: función que puede pausar su ejecución
function* fibonacci() {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

const fib = fibonacci();
fib.next().value; // 0
fib.next().value; // 1
fib.next().value; // 1
fib.next().value; // 2

// Async generator
async function* fetchPaginas(url) {
  let pagina = 1;
  while (true) {
    const datos = await fetch(`${url}?page=${pagina}`).then(r => r.json());
    if (!datos.length) return;
    yield datos;
    pagina++;
  }
}

for await (const pagina of fetchPaginas('/api/productos')) {
  console.log(pagina);
}
```

---

## Patrones de módulo y IIFE

```javascript
// IIFE (Immediately Invoked Function Expression)
// Patrón pre-módulos para encapsular código
const MiModulo = (function() {
  let estado = 0; // privado

  function incrementar() { estado++; }

  return {
    incrementar,
    getEstado: () => estado,
  };
})();

// Module pattern moderno (ES Modules)
// Cada archivo es automáticamente un módulo con su propio scope
```

---

## Optional Chaining y Nullish Coalescing

```javascript
const usuario = {
  perfil: {
    direccion: {
      ciudad: "Buenos Aires"
    }
  }
};

// ❌ Sin optional chaining (verboso y frágil)
const ciudad = usuario && usuario.perfil && usuario.perfil.direccion
  && usuario.perfil.direccion.ciudad;

// ✅ Con optional chaining
const ciudad2 = usuario?.perfil?.direccion?.ciudad;
// Si cualquier parte es null/undefined, retorna undefined (no lanza error)

// En llamadas a métodos
const longitud = usuario?.nombre?.toUpperCase()?.length;

// En arrays
const primer = arr?.[0];

// Nullish coalescing: ?? vs ||
const nombre = valor ?? "Default";
// ?? solo evalúa el lado derecho si el izquierdo es null o undefined
// || evalúa si el izquierdo es falsy (0, "", false, null, undefined)

const cantidad = 0 || 10;  // 10 (0 es falsy)
const cantidad2 = 0 ?? 10; // 0  (0 no es null/undefined)
```

---

## Manejo de errores avanzado

```javascript
// Custom error classes
class ApiError extends Error {
  constructor(message, statusCode, data = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
    // Mantener stack trace correcto en V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

class ValidationError extends ApiError {
  constructor(errors) {
    super('Error de validación', 422, errors);
    this.name = 'ValidationError';
  }
}

// Uso
try {
  throw new ValidationError({ email: 'Email inválido' });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Errores de validación:', error.data);
  } else if (error instanceof ApiError) {
    console.log(`Error API ${error.statusCode}: ${error.message}`);
  } else {
    throw error; // re-throw si no lo sabemos manejar
  }
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo funciona la cadena de prototipos en JavaScript?**
> Todo objeto en JavaScript tiene un `[[Prototype]]` interno (`__proto__`). Cuando accedes a una propiedad, JS busca:
> 1. En el objeto mismo
> 2. En su `[[Prototype]]`
> 3. En el prototype del prototype (cadena)
> 4. Hasta llegar a `null` (fin de cadena)

```javascript
const animal = { suena: true };
const perro = Object.create(animal);
perro.ladra = true;

console.log(perro.ladra);   // true (en perro)
console.log(perro.suena);   // true (en animal, su prototype)
console.log(perro.vuela);   // undefined (no existe en la cadena)

// Object.getPrototypeOf
Object.getPrototypeOf(perro) === animal; // true
```

**2. ¿Cuál es la diferencia entre `this` en funciones normales vs arrow functions?**
> - Función normal: `this` se determina por **cómo es llamada** (dynamic binding).
> - Arrow function: `this` se determina por **dónde está definida** (lexical binding).

```javascript
const obj = {
  valor: 42,
  normal() {
    console.log(this.valor); // this = obj (porque obj.normal())
  },
  flecha: () => {
    console.log(this.valor); // this = global (porque fue definida aquí)
  },
};

obj.normal();  // 42
obj.flecha();  // undefined (en módulos) o window.valor

// call/apply/bind solo funcionan en funciones normales
const norma = obj.normal;
obj.normal.call({valor: 99}); // 99 (this cambia)
obj.flecha.call({valor: 99});  // undefined (this NO cambia)
```

**3. ¿Qué es un Iterator y un Generator?**
> - **Iterator**: objeto con método `next()` que devuelve `{value, done}`.
> - **Generator**: función que devuelve un iterator. Usa `yield` para "pausar".

```javascript
// Generator
function* generador() {
  yield 1;
  yield 2;
  yield 3;
}

const it = generador();
it.next(); // {value: 1, done: false}
it.next(); // {value: 2, done: false}
it.next(); // {value: 3, done: false}
it.next(); // {value: undefined, done: true}

// Usar en for...of
for (const valor of generador()) {
  console.log(valor); // 1, 2, 3
}
```

**4. ¿Para qué sirven Map/Set vs objeto plano/array?**
> - **Map**: mejora sobre objetos. Permite cualquier tipo de key, tiene métodos útiles (size, has, delete).
> - **Set**: colección de valores únicos. Deduplicación automática, performance en búsquedas.

```javascript
// Map > objeto para claves dinámicas
const mapa = new Map();
mapa.set("nombre", "Juan");
mapa.set(1, "uno");
mapa.set(true, "booleano");

// Set > array para unicidad
const ids = [1, 2, 2, 3, 3, 3];
const unicos = new Set(ids); // {1, 2, 3}
unicos.has(2); // true
unicos.size;   // 3

// Ventaja de rendimiento
const set = new Set(millonesDeElementos);
set.has(elemento); // O(1)

const arr = millonesDeElementos;
arr.includes(elemento); // O(n)
```

**5. ¿Qué diferencia hay entre `reduce()`, `forEach()` y `map()`?**
> - **map()**: transforma array en nuevo array (1:1). Retorna array.
> - **forEach()**: itera sin retornar nada. Effect-driven, no functional.
> - **reduce()**: acumula a un valor único (puede ser cualquier tipo). Very flexible.

```javascript
const n = [1, 2, 3];

// map: [1, 2, 3] → [2, 4, 6]
n.map(x => x * 2);

// forEach: solo itera
n.forEach(x => console.log(x)); // undefined

// reduce: [1, 2, 3] → 6
n.reduce((acc, x) => acc + x, 0);

// reduce es versátil, puede hacer cualquier cosa
const porId = n.reduce((acc, x) => ({ ...acc, [x]: true }), {});
// {1: true, 2: true, 3: true}
```

**6. ¿Qué es WeakMap y cuándo usarlo?**
> WeakMap es como Map pero con referencias débiles (weak references). Las claves se pueden recolectar si no hay otras referencias.
> 
> Útil para: asociar datos privados a objetos sin prevenir garbage collection.

```javascript
// WeakMap no permite enumerar, solo get/set/has/delete
const privateData = new WeakMap();

class Usuario {
  constructor(nombre) {
    privateData.set(this, { _password: "secreto" });
  }
  
  getPwd() {
    return privateData.get(this)?._password;
  }
}

// Si Usuario se elimina de memoria, la entrada de WeakMap también
const u = new Usuario("Juan");
// Si u = null, privateData se limpia automáticamente
```

**7. ¿Cuál es la diferencia entre `.map().filter().reduce()` vs un loop manual?**
> Functionally equivalentes pero hay diferencias:
> - **Chainable**: mucho más legible con map/filter/reduce
> - **Performance**: loops manuales son más eficientes (menos arrays intermedios)
> - **Memory**: chainable crea arrays intermedios (mala para datos grandes)

```javascript
// Chainable: crea 3 arrays intermedios
const resultado = data
  .filter(x => x > 5)      // nuevo array
  .map(x => x * 2)         // nuevo array
  .reduce((a, b) => a + b, 0); // resultado

// Manual: un solo paso
let resultado = 0;
for (const x of data) {
  if (x > 5) resultado += x * 2;
}

// Optimización: usar reduce para todo de una vez
const resultado = data.reduce((acc, x) => 
  x > 5 ? acc + (x * 2) : acc, 0);
```

**8. ¿Cómo implementarías un sistema de eventos personalizado?**
> Patrón Observer/Pub-Sub usando Object con Map de listeners.

```javascript
class EventEmitter {
  constructor() {
    this.events = new Map();
  }
  
  on(evento, callback) {
    if (!this.events.has(evento)) {
      this.events.set(evento, []);
    }
    this.events.get(evento).push(callback);
  }
  
  emit(evento, datos) {
    if (this.events.has(evento)) {
      this.events.get(evento).forEach(cb => cb(datos));
    }
  }
  
  off(evento, callback) {
    if (this.events.has(evento)) {
      const listeners = this.events.get(evento);
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    }
  }
}

// Uso
const emitter = new EventEmitter();
emitter.on('login', (user) => console.log(`${user} logged in`));
emitter.emit('login', 'Juan'); // "Juan logged in"
```

**9. ¿Qué es el patrón IIFE y cuándo usarlo?**
> IIFE (Immediately Invoked Function Expression) es una función que se auto-ejecuta. Útil para:
> - Crear scope privado (evitar contaminación global)
> - Módulos antes de módulos ES6

```javascript
// Patrón clásico de módulo con IIFE
const miModulo = (() => {
  let privada = "solo accesible aquí";
  
  return {
    publica() {
      return privada;
    },
  };
})();

miModulo.publica();     // "solo accesible aquí"
miModulo.privada;       // undefined (privada)

// Hoy: usar ES6 modules en vez de IIFE
// export const publica = () => { };
```

**10. ¿Qué diferencia hay aplicar `Object.freeze()` vs hacer el objeto "inmutable"?**
> - `Object.freeze()`: congela el objeto de primer nivel (shallow freeze). Las propiedades del mismo NO pueden cambiar, pero objetos anidados sí.
> - Verdadera inmutabilidad: requiere congelar recursivamente todo el árbol de objetos.

```javascript
const obj = Object.freeze({
  a: 1,
  b: { c: 2 }
});

obj.a = 99;        // ✗ error en strict mode, silentemente ignorado sin
obj.b.c = 99;      // ✓ permitido (b es un objeto anidado)

// Deep freeze
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.values(obj).forEach(v => 
    typeof v === 'object' && v !== null && deepFreeze(v)
  );
  return obj;
}

const congelado = deepFreeze({...obj});
congelado.b.c = 99; // ✗ error en strict mode
```
