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
