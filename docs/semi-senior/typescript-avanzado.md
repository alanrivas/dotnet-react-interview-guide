---
id: typescript-avanzado
title: TypeScript Avanzado
sidebar_position: 13
---

# TypeScript Avanzado

## Generics Avanzados

Los generics permiten escribir código reutilizable que funciona con múltiples tipos sin perder la seguridad de tipos.

### Constraints con `extends` y `keyof`

```typescript
// Sin constraint — T puede ser cualquier cosa
function identity<T>(arg: T): T {
  return arg;
}

// Con constraint — T debe tener la propiedad length
function logLength<T extends { length: number }>(arg: T): T {
  console.log(arg.length);
  return arg;
}

logLength("hola");        // ✅ string tiene length
logLength([1, 2, 3]);     // ✅ array tiene length
logLength(42);            // ❌ Error: number no tiene length

// keyof — T debe ser una clave válida de K
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const usuario = { nombre: "Ana", edad: 30 };
const nombre = getProperty(usuario, "nombre"); // tipo inferido: string
const edad   = getProperty(usuario, "edad");   // tipo inferido: number
getProperty(usuario, "email");                 // ❌ Error: no existe en el tipo
```

### Generic Functions vs Interfaces vs Classes

```typescript
// Generic function
function wrap<T>(value: T): { value: T } {
  return { value };
}

// Generic interface
interface Repositorio<T> {
  obtenerPorId(id: number): Promise<T>;
  guardar(entidad: T): Promise<T>;
  eliminar(id: number): Promise<void>;
}

class UsuarioRepositorio implements Repositorio<Usuario> {
  async obtenerPorId(id: number): Promise<Usuario> { /* ... */ }
  async guardar(usuario: Usuario): Promise<Usuario> { /* ... */ }
  async eliminar(id: number): Promise<void> { /* ... */ }
}

// Generic class
class Pila<T> {
  private elementos: T[] = [];

  push(elemento: T): void {
    this.elementos.push(elemento);
  }

  pop(): T | undefined {
    return this.elementos.pop();
  }

  peek(): T | undefined {
    return this.elementos[this.elementos.length - 1];
  }
}

const pilaNumeros = new Pila<number>();
pilaNumeros.push(1);
pilaNumeros.push(2);
const ultimo = pilaNumeros.pop(); // tipo: number | undefined
```

### Inferencia de Tipos en Generics

TypeScript puede inferir el tipo genérico a partir del argumento — no siempre hace falta anotarlo:

```typescript
// TypeScript infiere T = string
const resultado = wrap("hola");
// resultado: { value: string }

// TypeScript infiere T = number[]
const pilaNum = new Pila<number>(); // aquí sí es necesario porque no hay argumento inicial

function primero<T>(arr: T[]): T | undefined {
  return arr[0];
}

const x = primero([1, 2, 3]); // infiere T = number, x: number | undefined
const y = primero(["a", "b"]); // infiere T = string
```

### Multiple Type Parameters

```typescript
function par<A, B>(primero: A, segundo: B): [A, B] {
  return [primero, segundo];
}

const p = par("hola", 42); // [string, number]

// Más complejo: transformar un objeto
function mapValues<T extends object, U>(
  obj: T,
  fn: (value: T[keyof T]) => U
): Record<keyof T, U> {
  const resultado = {} as Record<keyof T, U>;
  for (const key in obj) {
    resultado[key] = fn(obj[key]);
  }
  return resultado;
}
```

### Ejemplo Práctico: `pick<T, K extends keyof T>`

```typescript
// Extraer un subconjunto de propiedades de un objeto, con tipos correctos
function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const resultado = {} as Pick<T, K>;
  keys.forEach((key) => {
    resultado[key] = obj[key];
  });
  return resultado;
}

interface Producto {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  descripcion: string;
}

const producto: Producto = {
  id: 1,
  nombre: "Laptop",
  precio: 999,
  stock: 5,
  descripcion: "Laptop de alto rendimiento",
};

// Solo extraemos id, nombre y precio — el tipo resultante lo sabe
const resumen = pick(producto, ["id", "nombre", "precio"]);
// tipo: { id: number; nombre: string; precio: number }
```

---

## Utility Types

TypeScript incluye tipos de utilidad predefinidos que transforman otros tipos.

### `Partial<T>` — Campos Opcionales

Hace todos los campos opcionales. Ideal para DTOs de actualización parcial (PATCH):

```typescript
interface Usuario {
  id: number;
  nombre: string;
  email: string;
  edad: number;
}

// Para actualizar solo algunos campos
type ActualizarUsuarioDto = Partial<Usuario>;
// Equivale a: { id?: number; nombre?: string; email?: string; edad?: number }

function actualizarUsuario(id: number, datos: Partial<Usuario>): void {
  // Solo se envían los campos que cambiaron
}

actualizarUsuario(1, { nombre: "Juan" });         // ✅ válido
actualizarUsuario(1, { email: "j@ejemplo.com" }); // ✅ válido
```

### `Required<T>` — Todos los Campos Requeridos

Elimina el `?` de todas las propiedades:

```typescript
interface ConfiguracionOpcional {
  host?: string;
  puerto?: number;
  timeout?: number;
}

type ConfiguracionCompleta = Required<ConfiguracionOpcional>;
// { host: string; puerto: number; timeout: number }

// Útil para validar que una configuración tiene todos sus valores
function iniciarServidor(config: Required<ConfiguracionOpcional>): void {
  console.log(`Conectando a ${config.host}:${config.puerto}`);
}
```

### `Readonly<T>` — Inmutabilidad en Tiempo de Compilación

```typescript
interface Estado {
  usuario: string;
  token: string;
}

const estadoInicial: Readonly<Estado> = {
  usuario: "ana",
  token: "abc123",
};

estadoInicial.usuario = "otro"; // ❌ Error: no se puede asignar a propiedad readonly

// Muy útil para el estado de Redux/Zustand
type EstadoApp = Readonly<{
  usuarios: readonly Usuario[];
  cargando: boolean;
  error: string | null;
}>;
```

### `Pick<T, K>` — Extraer Propiedades

```typescript
interface Articulo {
  id: number;
  titulo: string;
  contenido: string;
  autor: string;
  fechaPublicacion: Date;
  tags: string[];
}

// Vista de lista — solo necesitamos estos campos
type ArticuloResumen = Pick<Articulo, "id" | "titulo" | "autor" | "fechaPublicacion">;

function listarArticulos(): ArticuloResumen[] {
  // No devolvemos contenido completo para ahorrar ancho de banda
  return [];
}
```

### `Omit<T, K>` — Excluir Propiedades

```typescript
// Para un DTO de creación, omitimos el id (lo genera la BD)
type CrearUsuarioDto = Omit<Usuario, "id">;
// { nombre: string; email: string; edad: number }

// Excluir múltiples
type UsuarioPublico = Omit<Usuario, "id" | "email">;
// { nombre: string; edad: number }
```

### `Record<K, V>` — Objeto Tipado

```typescript
// Mapa de permisos por rol
type Rol = "admin" | "editor" | "lector";
type Permiso = "leer" | "escribir" | "eliminar";

const permisos: Record<Rol, Permiso[]> = {
  admin:  ["leer", "escribir", "eliminar"],
  editor: ["leer", "escribir"],
  lector: ["leer"],
};

// Caché en memoria tipada
const cache: Record<string, Usuario> = {};
cache["usuario:1"] = { id: 1, nombre: "Ana", email: "ana@e.com", edad: 30 };
```

### `ReturnType<T>` y `Parameters<T>`

```typescript
async function buscarUsuario(id: number, incluirPerfil: boolean): Promise<Usuario> {
  // ...
  return {} as Usuario;
}

// Inferir el tipo de retorno
type ResultadoBusqueda = ReturnType<typeof buscarUsuario>;
// Promise<Usuario>

// Inferir los parámetros
type ParamsBusqueda = Parameters<typeof buscarUsuario>;
// [id: number, incluirPerfil: boolean]

// Muy útil para wrappers o proxies de funciones
function conLog<T extends (...args: any[]) => any>(fn: T) {
  return (...args: Parameters<T>): ReturnType<T> => {
    console.log("Llamando con:", args);
    return fn(...args);
  };
}
```

---

## Tipos Condicionales

Permiten elegir un tipo basándose en una condición.

### Sintaxis Básica: `T extends U ? X : Y`

```typescript
// Si T es string, devuelve "es string"; si no, devuelve "no es string"
type EsString<T> = T extends string ? "es string" : "no es string";

type R1 = EsString<string>;  // "es string"
type R2 = EsString<number>;  // "no es string"
type R3 = EsString<"hola">;  // "es string" (string literal extiende string)

// Distributivo: se aplica a cada miembro de una unión
type Aplanar<T> = T extends Array<infer U> ? U : T;
type A = Aplanar<string[]>;       // string
type B = Aplanar<number[]>;       // number
type C = Aplanar<boolean>;        // boolean (no es array)
```

### `infer` — Inferir Tipos Dentro de Condicionales

```typescript
// Extraer el tipo de retorno (reimplementando ReturnType)
type MiReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

function saludar(nombre: string): string {
  return `Hola ${nombre}`;
}

type TipoRetorno = MiReturnType<typeof saludar>; // string

// Extraer el tipo del primer parámetro
type PrimerParametro<T> = T extends (primero: infer P, ...resto: any[]) => any ? P : never;
type PP = PrimerParametro<typeof saludar>; // string
```

### `NonNullable<T>`, `Extract<T, U>`, `Exclude<T, U>`

```typescript
// NonNullable — elimina null y undefined de una unión
type SinNulos = NonNullable<string | null | undefined>; // string

// Exclude — elimina tipos de una unión
type SinBoolean = Exclude<string | number | boolean, boolean>; // string | number

// Extract — queda solo lo que extiende U
type SoloString = Extract<string | number | boolean, string>; // string

// Implementación interna de estos tipos:
type MiNonNullable<T> = T extends null | undefined ? never : T;
type MiExclude<T, U> = T extends U ? never : T;
type MiExtract<T, U> = T extends U ? T : never;
```

### Ejemplo: `UnwrapPromise<T>`

```typescript
// Extrae el tipo interno de una Promise, recursivamente
type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T;

type R1 = UnwrapPromise<Promise<string>>;           // string
type R2 = UnwrapPromise<Promise<Promise<number>>>;  // number
type R3 = UnwrapPromise<string>;                    // string (no era Promise)

// Útil para tipar funciones que reciben el resultado de una Promise
async function fetchUsuario(): Promise<Usuario> { return {} as Usuario; }

type TipoUsuario = UnwrapPromise<ReturnType<typeof fetchUsuario>>; // Usuario
```

---

## Mapped Types

Transforman cada propiedad de un tipo existente para crear uno nuevo.

### Sintaxis: `[K in keyof T]: ...`

```typescript
// Reimplementar Readonly manualmente
type MiReadonly<T> = {
  readonly [K in keyof T]: T[K];
};

// Reimplementar Partial manualmente
type MiPartial<T> = {
  [K in keyof T]?: T[K];
};

// Hacer todos los valores nullable
type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

interface Configuracion {
  host: string;
  puerto: number;
  ssl: boolean;
}

type ConfigNullable = Nullable<Configuracion>;
// { host: string | null; puerto: number | null; ssl: boolean | null }
```

### Modificadores: `+readonly`, `-readonly`, `+?`, `-?`

```typescript
// -readonly elimina el readonly de todas las propiedades
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

const config: Readonly<Configuracion> = { host: "localhost", puerto: 3000, ssl: false };
// config.host = "otro"; // ❌ Error

const configMutable: Mutable<typeof config> = { ...config };
configMutable.host = "produccion"; // ✅ ahora sí funciona

// -? elimina la opcionalidad (equivale a Required)
type Requerido<T> = {
  [K in keyof T]-?: T[K];
};
```

### Ejemplo: `Optional<T, K>` — Solo Algunas Propiedades Opcionales

```typescript
// Hace solo las propiedades K opcionales, el resto queda igual
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

interface Pedido {
  id: number;
  producto: string;
  cantidad: number;
  descuento: number;
  notas: string;
}

// En la creación: id lo genera la BD, descuento y notas son opcionales
type CrearPedidoDto = Optional<Omit<Pedido, "id">, "descuento" | "notas">;
// { producto: string; cantidad: number; descuento?: number; notas?: string }

const nuevoPedido: CrearPedidoDto = {
  producto: "Laptop",
  cantidad: 1,
  // descuento y notas son opcionales, no hace falta incluirlos
};
```

---

## Template Literal Types

Permiten construir tipos de strings combinando literales.

```typescript
// Tipo básico
type Saludo = `Hola ${string}`;
const s1: Saludo = "Hola Ana";    // ✅
const s2: Saludo = "Chau Ana";    // ❌ Error

// Combinar con uniones
type Direccion = "norte" | "sur" | "este" | "oeste";
type Movimiento = `mover-${Direccion}`;
// "mover-norte" | "mover-sur" | "mover-este" | "mover-oeste"

// Eventos de cambio
type Campo = "nombre" | "email" | "edad";
type EventoCambio = `${Campo}Changed`;
// "nombreChanged" | "emailChanged" | "edadChanged"

// Rutas de API tipadas
type RecursoApi = "usuarios" | "productos" | "pedidos";
type RutaApi = `/${RecursoApi}` | `/${RecursoApi}/${number}`;

function fetch(ruta: RutaApi): Promise<unknown> {
  return globalThis.fetch(ruta).then(r => r.json());
}

fetch("/usuarios");     // ✅
fetch("/usuarios/1");   // ✅ — pero TypeScript no puede verificar el number en el string literal
fetch("/pagos");        // ❌ Error: no es una ruta válida

// CSS properties tipadas
type CssPropiedad = "margin" | "padding" | "border";
type CssLado = "Top" | "Bottom" | "Left" | "Right";
type CssPropiedadCompleta = `${CssPropiedad}${CssLado}`;
// "marginTop" | "marginBottom" | ... | "borderRight"
```

---

## Decorators (TypeScript Experimental)

Los decorators son funciones que modifican clases, métodos, propiedades o parámetros. Son ampliamente usados en **Angular** y **NestJS**.

### Habilitar en tsconfig.json

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Class Decorator

```typescript
// Decorator de clase — recibe el constructor
function Singleton<T extends { new(...args: any[]): {} }>(constructor: T) {
  let instancia: T;
  return class extends constructor {
    constructor(...args: any[]) {
      if (instancia) return instancia;
      super(...args);
      instancia = this as unknown as T;
    }
  };
}

@Singleton
class ServicioConfig {
  valor = Math.random();
}

const a = new ServicioConfig();
const b = new ServicioConfig();
console.log(a.valor === b.valor); // true — misma instancia
```

### Method Decorator

```typescript
// Decorator que registra llamadas a métodos
function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const metodoOriginal = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log(`[LOG] ${propertyKey} llamado con:`, args);
    const inicio = performance.now();
    const resultado = metodoOriginal.apply(this, args);
    const fin = performance.now();
    console.log(`[LOG] ${propertyKey} tardó ${(fin - inicio).toFixed(2)}ms`);
    return resultado;
  };

  return descriptor;
}

class UsuarioServicio {
  @Log
  buscarUsuario(id: number): string {
    // Simular operación
    return `Usuario ${id}`;
  }
}

const servicio = new UsuarioServicio();
servicio.buscarUsuario(42);
// [LOG] buscarUsuario llamado con: [42]
// [LOG] buscarUsuario tardó 0.05ms
```

### Property Decorator

```typescript
function NoVacio(target: any, propertyKey: string) {
  let valor: string;

  Object.defineProperty(target, propertyKey, {
    get: () => valor,
    set: (nuevoValor: string) => {
      if (!nuevoValor || nuevoValor.trim() === "") {
        throw new Error(`${propertyKey} no puede estar vacío`);
      }
      valor = nuevoValor;
    },
  });
}

class Producto {
  @NoVacio
  nombre: string = "";
}

const p = new Producto();
p.nombre = "Laptop"; // ✅
p.nombre = "";       // ❌ Error en runtime
```

### Uso en NestJS (contexto)

```typescript
// NestJS usa decorators extensamente para inyección de dependencias y rutas
@Controller("usuarios")
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get(":id")
  async obtener(@Param("id") id: string): Promise<Usuario> {
    return this.usuariosService.buscarPorId(+id);
  }

  @Post()
  @HttpCode(201)
  async crear(@Body() dto: CrearUsuarioDto): Promise<Usuario> {
    return this.usuariosService.crear(dto);
  }
}
```

---

## Módulos y Namespaces

### ES Modules: `export` / `import`

```typescript
// usuarios.ts — named exports (preferido)
export interface Usuario {
  id: number;
  nombre: string;
}

export function crearUsuario(nombre: string): Usuario {
  return { id: Date.now(), nombre };
}

export const VERSION_API = "v2";

// main.ts — importar por nombre
import { Usuario, crearUsuario, VERSION_API } from "./usuarios";
```

### `export default` vs Named Exports

```typescript
// ❌ export default — dificulta el refactoring y el tree shaking
export default function procesarPago() { /* ... */ }
import procesarPago from "./pago"; // el nombre puede ser cualquiera

// ✅ named exports — nombre explícito, mejor para herramientas
export function procesarPago() { /* ... */ }
import { procesarPago } from "./pago"; // el nombre es consistente
```

### Re-exports con `export * from`

```typescript
// index.ts — barrel file que re-exporta todo el módulo
export * from "./usuarios";
export * from "./productos";
export { default as PagoServicio } from "./pago-servicio";

// Ahora se puede importar desde un solo punto:
import { Usuario, Producto, PagoServicio } from "@/services";
```

### `namespace` — Cuándo No Usar

```typescript
// ❌ namespace es una característica legacy de TypeScript
namespace Utilidades {
  export function formatearFecha(fecha: Date): string {
    return fecha.toISOString();
  }
}

// ✅ Usar módulos ES en su lugar
// utils/fecha.ts
export function formatearFecha(fecha: Date): string {
  return fecha.toISOString();
}
```

> **Regla general**: usa módulos ES (`import`/`export`). Los `namespace` solo tienen sentido en archivos de declaración `.d.ts` para librerías legacy.

### Aliases con `paths` en tsconfig

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"]
    }
  }
}
```

```typescript
// Sin alias — frágil ante restructuración
import { BotonPrimario } from "../../../components/ui/botones";

// Con alias — más robusto y legible
import { BotonPrimario } from "@components/ui/botones";
```

---

## Configuración `tsconfig.json`

### Opciones Esenciales

```json
{
  "compilerOptions": {
    // ── Rigor ──────────────────────────────────────────────────────────────
    "strict": true,             // Habilita: noImplicitAny, strictNullChecks,
                                //   strictFunctionTypes, strictBindCallApply,
                                //   strictPropertyInitialization, noImplicitThis
    "noUncheckedIndexedAccess": true, // arr[0] tiene tipo T | undefined

    // ── Target y Lib ───────────────────────────────────────────────────────
    "target": "ES2022",         // A qué JS se compila (afecta el output)
    "lib": ["ES2022", "DOM"],   // Qué APIs están disponibles en tiempo de tipos
                                // target define el output; lib define los tipos disponibles

    // ── Módulos ────────────────────────────────────────────────────────────
    "module": "ESNext",
    "moduleResolution": "bundler", // Para Vite/webpack (no sigue node_modules estrictamente)
    // "moduleResolution": "node16", // Para Node.js moderno con ESM

    // ── Paths ──────────────────────────────────────────────────────────────
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },

    // ── Salida ─────────────────────────────────────────────────────────────
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "declaration": true,        // Genera archivos .d.ts

    // ── Interop ────────────────────────────────────────────────────────────
    "esModuleInterop": true,    // Permite import React from 'react'
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,    // Cada archivo es un módulo aislado (compatible con esbuild/swc)

    // ── JSX ────────────────────────────────────────────────────────────────
    "jsx": "react-jsx"          // No hace falta importar React en cada archivo
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### `target` vs `lib`: La Diferencia Clave

```
target: ES2022
  → El código TypeScript se compila a JavaScript ES2022
  → Si el entorno soporta ES2022, no hay polyfills
  → Afecta el OUTPUT (lo que se genera)

lib: ["ES2022", "DOM"]
  → Define qué tipos/APIs TypeScript conoce
  → Promise, Map, fetch, document.querySelector, etc.
  → Afecta los TIPOS disponibles (no el output)
```

### `moduleResolution: bundler` vs `node16`

```
bundler:
  - Para proyectos con Vite, webpack, esbuild
  - No requiere extensiones .js en los imports
  - import { foo } from './utils' ✅

node16:
  - Para Node.js con ESM nativo
  - Requiere extensiones explícitas
  - import { foo } from './utils.js' (aunque el archivo sea .ts)
```
