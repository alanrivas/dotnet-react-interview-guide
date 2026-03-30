---
id: nextjs-rsc
title: Next.js y React Server Components
sidebar_position: 16
---

# Next.js & React Server Components 🟡

Next.js es el framework React más usado en producción. Desde Next.js 13 con el **App Router**, el modelo mental cambió radicalmente con los **React Server Components (RSC)**. Es uno de los temas más preguntados en entrevistas React 2025.

---

## Pages Router vs App Router

| | Pages Router (legado) | App Router (actual) |
|---|---|---|
| Directorio | `/pages` | `/app` |
| Data fetching | `getServerSideProps`, `getStaticProps` | `async/await` en Server Components |
| Layouts | Manuales en `_app.tsx` | `layout.tsx` por carpeta |
| Streaming | No | Sí (con Suspense) |
| Server Components | No | Sí (por defecto) |
| Caché | Manual | Automática y configurable |

:::tip En entrevistas
Si te preguntan "¿conocés Next.js?", van a querer saber si conocés el App Router. Saber explicar la diferencia con Pages Router demuestra experiencia real.
:::

---

## React Server Components (RSC)

Los Server Components se renderizan **en el servidor** y nunca se envían como JavaScript al cliente. Tienen acceso directo a bases de datos, filesystem, secretos, etc.

```tsx
// app/productos/page.tsx — Server Component por defecto
// NO tiene 'use client' → se ejecuta en el servidor

async function ProductosPage() {
  // Fetch directo sin useEffect, sin estado de carga
  const productos = await fetch('https://api.ejemplo.com/productos', {
    next: { revalidate: 60 }, // revalidar cada 60 segundos
  }).then(r => r.json());

  return (
    <ul>
      {productos.map((p: Producto) => (
        <li key={p.id}>{p.nombre} — ${p.precio}</li>
      ))}
    </ul>
  );
}

export default ProductosPage;
```

**Lo que NO pueden hacer los Server Components:**
- Usar hooks (`useState`, `useEffect`, etc.)
- Usar event handlers (`onClick`, `onChange`, etc.)
- Acceder a APIs del browser (`window`, `localStorage`, `document`)

---

## Client Components

Se marcan con `'use client'` al inicio del archivo. Son los componentes React "clásicos" — se hidratan en el browser.

```tsx
'use client';

import { useState } from 'react';

interface Props {
  productoId: number;
  nombre: string;
}

export function BotonCarrito({ productoId, nombre }: Props) {
  const [agregado, setAgregado] = useState(false);

  const handleClick = async () => {
    await fetch('/api/carrito', {
      method: 'POST',
      body: JSON.stringify({ productoId }),
    });
    setAgregado(true);
  };

  return (
    <button onClick={handleClick} disabled={agregado}>
      {agregado ? '✓ En carrito' : `Agregar ${nombre}`}
    </button>
  );
}
```

:::info Regla clave
Un Server Component **puede** importar y renderizar Client Components.
Un Client Component **NO puede** importar Server Components directamente.
Pero sí puede recibirlos como `children` (prop pattern).
:::

---

## Composición: patrón correcto

```tsx
// app/productos/[id]/page.tsx — Server Component
import { BotonCarrito } from '@/components/BotonCarrito'; // Client Component
import { ResenasProducto } from './ResenasProducto'; // Server Component

async function ProductoPage({ params }: { params: { id: string } }) {
  // Data fetching en el servidor
  const producto = await db.producto.findUnique({ where: { id: params.id } });

  return (
    <div>
      <h1>{producto.nombre}</h1>
      <p>${producto.precio}</p>

      {/* Client Component recibe solo los datos necesarios */}
      <BotonCarrito productoId={producto.id} nombre={producto.nombre} />

      {/* Server Component anidado */}
      <ResenasProducto productoId={producto.id} />
    </div>
  );
}
```

```tsx
// Patrón: pasar Server Component como children a un Client Component
// ClientWrapper.tsx
'use client';

export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <button onClick={() => setAbierto(!abierto)}>Toggle</button>
      {abierto && children} {/* children puede ser un Server Component */}
    </div>
  );
}

// page.tsx
import { ClientWrapper } from './ClientWrapper';
import { TablaContenido } from './TablaContenido'; // Server Component

export default function Page() {
  return (
    <ClientWrapper>
      <TablaContenido /> {/* Pasado como children, no importado dentro de ClientWrapper */}
    </ClientWrapper>
  );
}
```

---

## Estructura de rutas con App Router

```
app/
├── layout.tsx          ← Layout raíz (siempre presente)
├── page.tsx            ← Ruta: /
├── loading.tsx         ← UI de carga mientras page.tsx se resuelve
├── error.tsx           ← UI de error para esta ruta
├── not-found.tsx       ← UI 404
├── productos/
│   ├── layout.tsx      ← Layout compartido para /productos y sub-rutas
│   ├── page.tsx        ← Ruta: /productos
│   └── [id]/
│       ├── page.tsx    ← Ruta: /productos/123
│       └── loading.tsx ← Loading específico de este segmento
└── api/
    └── productos/
        └── route.ts    ← API Route: GET/POST /api/productos
```

```tsx
// app/layout.tsx — Layout raíz
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <NavBar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

// app/productos/layout.tsx — Layout del segmento /productos
export default function ProductosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="productos-container">
      <Sidebar />
      <div className="contenido">{children}</div>
    </div>
  );
}
```

---

## Streaming con Suspense

Next.js + RSC permiten enviar HTML en partes al browser, mostrando UI parcial mientras los datos lentos cargan.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Estos se renderizan inmediatamente */}
      <Metricas />

      {/* Este se stream mientras carga (puede tardar) */}
      <Suspense fallback={<SkeletonGrafico />}>
        <GraficoPedidos /> {/* async Server Component */}
      </Suspense>

      {/* Este también stream independientemente */}
      <Suspense fallback={<SkeletonTabla />}>
        <TablaPedidosRecientes />
      </Suspense>
    </div>
  );
}

// GraficoPedidos — async Server Component
async function GraficoPedidos() {
  // Esta operación puede tardar
  const datos = await obtenerDatosGrafico(); // query pesada
  return <Grafico datos={datos} />;
}
```

:::tip Por qué importa
En vez de esperar a que **todo** cargue antes de mostrar algo, el usuario ve el layout y los datos rápidos inmediatamente. Los lentos aparecen después. Mejora percepción de performance significativamente.
:::

---

## Server Actions

Funciones que se ejecutan en el servidor, llamadas directamente desde el cliente. Reemplazan muchos endpoints de API.

```tsx
// app/actions.ts — definición de Server Actions
'use server';

import { revalidatePath } from 'next/cache';

export async function crearProducto(formData: FormData) {
  const nombre = formData.get('nombre') as string;
  const precio = Number(formData.get('precio'));

  // Validación
  if (!nombre || precio <= 0) {
    return { error: 'Datos inválidos' };
  }

  // Acceso directo a la BD — esto corre en el servidor
  await db.producto.create({ data: { nombre, precio } });

  // Invalidar caché de la ruta
  revalidatePath('/productos');

  return { ok: true };
}
```

```tsx
// Uso en un formulario — sin fetch, sin API route
'use client';

import { crearProducto } from '../actions';
import { useActionState } from 'react'; // React 19

export function FormProducto() {
  const [estado, action, isPending] = useActionState(crearProducto, null);

  return (
    <form action={action}>
      <input name="nombre" placeholder="Nombre" required />
      <input name="precio" type="number" placeholder="Precio" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Guardando...' : 'Crear producto'}
      </button>
      {estado?.error && <p className="error">{estado.error}</p>}
    </form>
  );
}
```

```tsx
// También se pueden llamar programáticamente
'use client';

import { actualizarStock } from '../actions';

export function BtnActualizarStock({ productoId }: { productoId: string }) {
  const handleClick = async () => {
    const resultado = await actualizarStock(productoId, 100);
    if (resultado.ok) alert('Stock actualizado');
  };

  return <button onClick={handleClick}>Actualizar Stock</button>;
}
```

---

## Caché en Next.js App Router

Next.js tiene 4 capas de caché. Es importante entenderlas porque controlan cuándo se actualiza el contenido.

```tsx
// 1. Request Memoization — deduplication de fetch en el mismo render
// Estos dos fetch al mismo URL se hacen UNA sola vez por request
async function ComponenteA() {
  const data = await fetch('https://api.ejemplo.com/config'); // fetch 1
  return <div>{data.version}</div>;
}

async function ComponenteB() {
  const data = await fetch('https://api.ejemplo.com/config'); // deduplicado — no hace segundo request
  return <div>{data.entorno}</div>;
}


// 2. Data Cache — persiste entre requests (Next.js lo controla)
const data = await fetch('https://api.ejemplo.com/productos', {
  cache: 'force-cache',          // Cachear indefinidamente (default)
  next: { revalidate: 60 },      // Revalidar cada 60 segundos (ISR)
  cache: 'no-store',             // Nunca cachear (SSR clásico)
});


// 3. Full Route Cache — HTML pre-renderizado en build
// Las rutas estáticas se pre-construyen y sirven desde CDN

// 4. Router Cache — caché del cliente entre navegaciones
// Next.js guarda los segmentos visitados por 30s-5min en memoria del browser
```

```tsx
// Forzar revalidación desde Server Actions o Route Handlers
import { revalidatePath, revalidateTag } from 'next/cache';

// Revalidar una ruta específica
revalidatePath('/productos');

// Revalidar por tag (más granular)
const datos = await fetch('https://api.ejemplo.com/productos', {
  next: { tags: ['productos'] }
});

// Después, en una acción:
revalidateTag('productos'); // invalida todos los fetch con este tag
```

---

## Metadata y SEO

```tsx
// app/productos/[id]/page.tsx
import { Metadata } from 'next';

// Metadata estática
export const metadata: Metadata = {
  title: 'Catálogo de productos',
  description: 'Explorá nuestra colección',
};

// Metadata dinámica (basada en datos)
export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  const producto = await getProducto(params.id);

  return {
    title: `${producto.nombre} | Tienda`,
    description: producto.descripcion,
    openGraph: {
      images: [producto.imagenUrl],
    },
  };
}
```

---

## API Routes con Route Handlers

```typescript
// app/api/productos/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pagina = Number(searchParams.get('pagina') ?? 1);

  const productos = await db.producto.findMany({
    skip: (pagina - 1) * 10,
    take: 10,
  });

  return NextResponse.json(productos);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const nuevo = await db.producto.create({ data: body });

  return NextResponse.json(nuevo, { status: 201 });
}

// app/api/productos/[id]/route.ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.producto.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
```

---

## Comparativa de estrategias de rendering

| Estrategia | Cuándo usar | Cómo en App Router |
|---|---|---|
| **SSG** — Static Site Generation | Contenido que no cambia (blog, docs) | Sin `cache: 'no-store'`, sin parámetros dinámicos |
| **ISR** — Incremental Static Regeneration | Contenido que cambia poco (catálogo, precios) | `next: { revalidate: N }` en fetch |
| **SSR** — Server Side Rendering | Datos por usuario, personalizados | `cache: 'no-store'` o usar `cookies()`/`headers()` |
| **CSR** — Client Side Rendering | Dashboards, datos post-autenticación | `'use client'` + React Query / SWR |

```tsx
// SSG — se pre-renderiza en build
async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await fetch(`/api/posts/${params.slug}`).then(r => r.json());
  return <article>{post.contenido}</article>;
}

// ISR — se regenera cada 10 minutos
async function PreciosPage() {
  const precios = await fetch('https://api.precios.com/latest', {
    next: { revalidate: 600 },
  }).then(r => r.json());
  return <TablaPreciosPage datos={precios} />;
}

// SSR — siempre fresh, por usuario
import { cookies } from 'next/headers';

async function PerfilPage() {
  const token = cookies().get('token')?.value;
  const perfil = await fetch('/api/perfil', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store', // next.js detecta cookies() y hace no-store auto
  }).then(r => r.json());
  return <Perfil datos={perfil} />;
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué diferencia hay entre un Server Component y un Client Component?**
> Los Server Components se ejecutan solo en el servidor, no tienen JavaScript en el cliente, pueden hacer fetch y acceder a la BD directamente, pero no pueden usar hooks ni eventos. Los Client Components se ejecutan en el browser (con hidratación), tienen acceso a estado, eventos y APIs del browser, pero requieren enviar JS al cliente.

**2. ¿Por qué Next.js en vez de Create React App?**
> Next.js resuelve problemas reales de producción: SEO (SSR/SSG), routing integrado, optimización automática de imágenes/fuentes, caché multi-capa, Server Actions, code splitting automático. CRA está en modo mantenimiento y no tiene soporte oficial.

**3. ¿Qué es ISR y cuándo lo usarías?**
> Incremental Static Regeneration — sirve páginas pre-construidas (rápido como CDN) pero las regenera en el servidor cada N segundos. Ideal para contenido que cambia pero no en tiempo real: catálogos, precios, posts de blog. La primera persona post-expiración dispara la regeneración, el resto sigue viendo el contenido anterior mientras tanto.

**4. ¿Cuándo NO usarías Server Components?**
> Para cualquier interactividad: formularios con validación en tiempo real, modales, dropdown dinámicos, animaciones, acceso a `localStorage`, suscripciones a eventos. Todo eso necesita `'use client'`.

**5. ¿Cómo protegerías rutas autenticadas en Next.js?**
> Con `middleware.ts` en la raíz del proyecto — se ejecuta antes de cada request y puede redirigir si no hay sesión válida. También con `auth()` de libraries como NextAuth en Server Components para redirección en el servidor.

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;

  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
```

**6. ¿Qué son los Server Actions y qué ventaja tienen sobre API routes?**
> Son funciones marcadas con `'use server'` que se ejecutan en el servidor pero se pueden llamar directamente desde el cliente. Ventajas: no necesitás crear un endpoint separado, funcionan nativamente con formularios HTML (`action={serverAction}`), TypeScript end-to-end sin serialización manual, revalidación de caché integrada.
