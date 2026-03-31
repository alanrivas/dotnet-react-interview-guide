---
id: performance-frontend
title: Performance del Frontend
sidebar_position: 14
---

# Performance del Frontend

## Core Web Vitals

Google utiliza tres métricas principales para medir la experiencia de usuario real en una página:

### LCP — Largest Contentful Paint

Mide cuánto tarda en renderizarse el elemento más grande visible (imagen hero, bloque de texto principal). Refleja la **velocidad de carga percibida**.

| Resultado | Valor |
|-----------|-------|
| ✅ Bueno  | < 2.5s |
| ⚠️ Mejorable | 2.5s – 4s |
| ❌ Malo   | > 4s |

**Causas comunes de LCP lento**: imágenes sin optimizar, render-blocking JS/CSS, TTFB alto (servidor lento).

### CLS — Cumulative Layout Shift

Mide cuánto se mueven los elementos visibles mientras carga la página. Un botón que "salta" porque una imagen cargó encima tiene CLS alto.

| Resultado | Valor |
|-----------|-------|
| ✅ Bueno  | < 0.1 |
| ⚠️ Mejorable | 0.1 – 0.25 |
| ❌ Malo   | > 0.25 |

**Causa principal**: imágenes sin dimensiones definidas, anuncios que se insertan dinámicamente.

### INP — Interaction to Next Paint

Reemplaza a FID desde marzo 2024. Mide el tiempo desde que el usuario interactúa (click, tecla) hasta que el navegador pinta la respuesta visual.

| Resultado | Valor |
|-----------|-------|
| ✅ Bueno  | < 200ms |
| ⚠️ Mejorable | 200ms – 500ms |
| ❌ Malo   | > 500ms |

**Causas**: handlers pesados en el hilo principal, hidratación costosa en SSR, procesamiento síncrono largo.

### Herramientas de Medición

```bash
# Instalar web-vitals para medir en producción real
npm install web-vitals
```

```typescript
// src/reportWebVitals.ts
import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

function enviarAAnalytics(metric: { name: string; value: number }) {
  // Enviar a tu servicio de analytics
  console.log(metric.name, metric.value);
}

onCLS(enviarAAnalytics);
onINP(enviarAAnalytics);
onLCP(enviarAAnalytics);
onFCP(enviarAAnalytics);
onTTFB(enviarAAnalytics);
```

---

## Optimización de Carga

### Code Splitting con `React.lazy()` y `Suspense`

El bundle principal solo carga lo que se necesita en el primer render. El resto llega cuando se navega a esa sección.

```tsx
import React, { Suspense, lazy } from "react";

// ✅ Lazy loading — el componente se carga solo cuando se renderiza
const PanelAdmin    = lazy(() => import("./pages/PanelAdmin"));
const ReportePagos  = lazy(() => import("./pages/ReportePagos"));
const ConfigAvanzada = lazy(() => import("./pages/ConfigAvanzada"));

function App() {
  return (
    <Suspense fallback={<div className="spinner">Cargando...</div>}>
      <Routes>
        <Route path="/admin"    element={<PanelAdmin />} />
        <Route path="/reportes" element={<ReportePagos />} />
        <Route path="/config"   element={<ConfigAvanzada />} />
      </Routes>
    </Suspense>
  );
}
```

### Dynamic Imports para Módulos Pesados

```typescript
// ❌ Se carga siempre, aunque el usuario no exporte nada
import * as XLSX from "xlsx";

// ✅ Solo se carga cuando el usuario hace click en "Exportar"
async function exportarExcel(datos: unknown[]) {
  const { utils, writeFile } = await import("xlsx");
  const hoja = utils.json_to_sheet(datos);
  const libro = utils.book_new();
  utils.book_append_sheet(libro, hoja, "Datos");
  writeFile(libro, "reporte.xlsx");
}

// En el componente:
<button onClick={() => exportarExcel(filas)}>
  Exportar a Excel
</button>
```

### Preload vs Prefetch

```html
<!-- preload: recurso crítico para la página ACTUAL — el browser lo descarga con alta prioridad -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
<link rel="preload" href="/hero-image.webp" as="image" />

<!-- prefetch: recurso probable en la PRÓXIMA navegación — baja prioridad, en tiempo libre -->
<link rel="prefetch" href="/dashboard-bundle.js" />
```

```typescript
// En React: prefetch de una ruta cuando el usuario hover sobre un link
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const handleMouseEnter = () => {
    // Iniciar descarga del chunk antes de que haga click
    import(`./pages/${to}`);
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter}>
      {children}
    </Link>
  );
}
```

### Optimización de Imágenes

```tsx
// Con Next.js — optimización automática
import Image from "next/image";

function HeroBanner() {
  return (
    <Image
      src="/banner.jpg"
      alt="Banner principal"
      width={1200}
      height={600}
      priority          // LCP image — no lazy, preload automático
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
    />
  );
}

// Sin Next.js — buenas prácticas manuales
function ProductoImagen({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"          // Lazy loading nativo
      decoding="async"        // No bloquea el hilo principal
      width={400}
      height={300}            // Evita CLS al reservar el espacio
    />
  );
}
```

---

## Optimización de React

### `React.memo()` — Evitar Re-renders Innecesarios

```tsx
interface Props {
  nombre: string;
  edad: number;
  onClick: () => void;
}

// Sin memo: re-renderiza siempre que el padre re-renderice
function TarjetaUsuario({ nombre, edad, onClick }: Props) {
  console.log("Renderizando TarjetaUsuario");
  return (
    <div onClick={onClick}>
      {nombre} — {edad} años
    </div>
  );
}

// Con memo: solo re-renderiza si nombre, edad u onClick cambian
const TarjetaUsuarioMemo = React.memo(TarjetaUsuario);

// Con comparación personalizada
const TarjetaUsuarioCustom = React.memo(TarjetaUsuario, (prevProps, nextProps) => {
  // Devuelve true si las props son "iguales" (no re-renderizar)
  return prevProps.nombre === nextProps.nombre && prevProps.edad === nextProps.edad;
});
```

### `useMemo()` — Memoizar Cálculos Costosos

```tsx
function ListaProductos({ productos, filtro }: Props) {
  // ❌ Se recalcula en cada render aunque productos y filtro no hayan cambiado
  const productosFiltrados = productos.filter(
    (p) => p.categoria === filtro && p.precio < 1000
  );

  // ✅ Solo se recalcula cuando productos o filtro cambian
  const productosFiltradosMemo = useMemo(
    () => productos.filter((p) => p.categoria === filtro && p.precio < 1000),
    [productos, filtro]
  );

  // ✅ También para cálculos estadísticos costosos
  const estadisticas = useMemo(() => ({
    total:    productosFiltradosMemo.length,
    promedio: productosFiltradosMemo.reduce((s, p) => s + p.precio, 0) / productosFiltradosMemo.length,
    masCaro:  Math.max(...productosFiltradosMemo.map((p) => p.precio)),
  }), [productosFiltradosMemo]);

  return <div>{/* ... */}</div>;
}
```

### `useCallback()` — Memoizar Funciones

```tsx
function FormularioBusqueda({ onResultados }: { onResultados: (r: Resultado[]) => void }) {
  const [query, setQuery] = useState("");

  // ❌ Nueva función en cada render → rompe React.memo en hijo que la recibe
  const buscar = async () => {
    const resultados = await api.buscar(query);
    onResultados(resultados);
  };

  // ✅ Misma referencia si query y onResultados no cambian
  const buscarMemo = useCallback(async () => {
    const resultados = await api.buscar(query);
    onResultados(resultados);
  }, [query, onResultados]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <BotonBuscarMemo onClick={buscarMemo} /> {/* No re-renderiza por la función */}
    </div>
  );
}
```

### Cuándo NO Usar Memoización

```tsx
// ❌ NO vale la pena memoizar esto — el cálculo es trivial
const nombre = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);

// ❌ NO vale la pena si el componente es simple y rápido
const Etiqueta = React.memo(({ texto }: { texto: string }) => <span>{texto}</span>);

// La regla: memoiza cuando el profiler muestra que es un cuello de botella,
// no "por si acaso". La comparación de dependencias también tiene un costo.
```

### Virtualización de Listas Largas

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

function ListaGrande({ items }: { items: string[] }) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => contenedorRef.current,
    estimateSize: () => 50, // altura estimada de cada fila en px
  });

  return (
    // Solo se renderizan las filas visibles + un buffer pequeño
    <div ref={contenedorRef} style={{ height: "500px", overflow: "auto" }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${item.size}px`,
              transform: `translateY(${item.start}px)`,
            }}
          >
            {items[item.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
// Con 100,000 items, solo ~12 divs están en el DOM en todo momento
```

### `useTransition()` y `useDeferredValue()` — React 18

```tsx
import { useState, useTransition, useDeferredValue } from "react";

// useTransition: marcar una actualización de estado como no urgente
function BuscadorConTransicion() {
  const [query, setQuery]       = useState("");
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setQuery(valor); // urgente — actualiza el input de inmediato

    startTransition(() => {
      // No urgente — puede interrumpirse si el usuario sigue escribiendo
      setResultados(filtrarGranDataset(valor));
    });
  };

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <span>Actualizando...</span>}
    </div>
  );
}

// useDeferredValue: versión "retrasada" de un valor para cálculos pesados
function ListaFiltrada({ query }: { query: string }) {
  const queryDeferida = useDeferredValue(query);
  // queryDeferida se actualiza cuando el browser tiene tiempo libre
  const resultados = filtrarGranDataset(queryDeferida);

  return <Lista items={resultados} />;
}
```

---

## Bundle y Assets

### Webpack Bundle Analyzer

```bash
npm install --save-dev webpack-bundle-analyzer
# O en Create React App:
npx source-map-explorer 'build/static/js/*.js'
```

Identifica qué módulos ocupan más espacio. Preguntas clave:
- ¿Hay librerías duplicadas en diferentes chunks?
- ¿Se está incluyendo toda una librería cuando solo usas una función?

### Tree Shaking — Eliminar Código Muerto

```typescript
// ❌ Importa TODA la librería lodash (~70KB gzipped)
import _ from "lodash";
const resultado = _.debounce(fn, 300);

// ✅ Tree shaking importa solo debounce (~2KB) — requiere ES Modules
import { debounce } from "lodash-es";
const resultado = debounce(fn, 300);

// ❌ Barrel imports pueden romper tree shaking
import { Button, Input, Modal } from "@/components"; // carga todos los componentes

// ✅ Import directo
import { Button } from "@/components/Button";
import { Input }  from "@/components/Input";
```

> **Importante**: el tree shaking funciona con **ES Modules** (`import`/`export`). Los módulos CommonJS (`require`/`module.exports`) no son tree-shakeable.

### Compresión: gzip vs Brotli

| Característica | gzip | Brotli |
|---------------|------|--------|
| Compresión | Buena | ~20-26% mejor que gzip |
| Velocidad de compresión | Rápida | Más lenta (nivel máximo) |
| Velocidad de descompresión | Rápida | Similar |
| Soporte navegadores | Universal | Todos los modernos (>95%) |

```nginx
# Nginx — habilitar Brotli
brotli on;
brotli_comp_level 6;
brotli_types text/html text/css application/javascript application/json;

# Gzip como fallback
gzip on;
gzip_types text/html text/css application/javascript;
```

### Cache Busting con Content Hashes

```javascript
// vite.config.ts — Vite genera hashes automáticamente
export default {
  build: {
    rollupOptions: {
      output: {
        // main.[hash].js — el hash cambia solo si el contenido cambia
        entryFileNames: "assets/[name].[hash].js",
        chunkFileNames: "assets/[name].[hash].js",
        assetFileNames: "assets/[name].[hash][extname]",
      },
    },
  },
};
// Resultado: main.3f7a2c1d.js
// El servidor puede servir estos archivos con Cache-Control: max-age=31536000, immutable
```

---

## Caché del Navegador

### Cache-Control Headers

```
Cache-Control: max-age=3600
  → Cachear por 1 hora. Después, el browser hace una petición nueva.

Cache-Control: s-maxage=86400, max-age=3600
  → CDN cachea por 24h, el browser por 1h.

Cache-Control: no-cache
  → NO significa "no cachear". Significa: cachear, pero siempre revalidar con el servidor.
  → Si el servidor dice 304 Not Modified, usa la caché.

Cache-Control: no-store
  → No guardar nada en caché (datos sensibles: datos bancarios, médicos).

Cache-Control: max-age=31536000, immutable
  → Cachear por 1 año y nunca revalidar. Para assets con hash en el nombre.
```

```typescript
// Estrategia recomendada para SPA:
// 1. HTML — no cachear (siempre fresco)
// Cache-Control: no-cache
// <html> siempre tiene el índice actualizado

// 2. Assets con hash — cachear para siempre
// Cache-Control: max-age=31536000, immutable
// main.3f7a2c1d.js — si cambia, el hash cambia, el browser pide el nuevo
```

### Service Workers y Caché Offline

```typescript
// src/sw.ts — Service Worker básico con Workbox
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, CacheFirst } from "workbox-strategies";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST); // Assets del build con hash

// Imágenes: caché primero, red como fallback
registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({ cacheName: "imagenes", plugins: [/* expiración */] })
);

// API calls: stale-while-revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new StaleWhileRevalidate({ cacheName: "api-cache" })
);
```

### Stale-While-Revalidate

```
Flujo:
1. Browser pide /api/productos
2. SW sirve la respuesta cacheada (rápido, aunque sea "vieja")
3. En segundo plano, SW hace la petición real a la red
4. Cuando llega la respuesta fresca, actualiza la caché
5. La PRÓXIMA vez ya tendrá la versión actualizada

Resultado: siempre rápido, eventualmente consistente.
Ideal para: feeds, dashboards, datos que pueden estar ligeramente desactualizados.
```

---

## Performance de CSS

### Critical CSS

```html
<!-- Inline del CSS necesario para el contenido above-the-fold -->
<head>
  <style>
    /* Solo el CSS mínimo para renderizar lo visible sin scroll */
    body { margin: 0; font-family: sans-serif; }
    .header { height: 64px; background: #fff; }
    .hero { min-height: 400px; }
  </style>
  <!-- El resto del CSS se carga de forma diferida -->
  <link rel="stylesheet" href="/styles.css" media="print" onload="this.media='all'">
</head>
```

### Propiedades que Triggean Layout (Evitar en Animaciones)

```css
/* ❌ Estas propiedades triggean layout recalculation — muy costosas */
.elemento {
  animation: mover 1s infinite;
}
@keyframes mover {
  to { top: 100px; left: 200px; }    /* layout */
  to { width: 200px; height: 100px; } /* layout */
}

/* ✅ transform y opacity solo triggean composite — muy baratas */
@keyframes moverOptimizado {
  to { transform: translate(200px, 100px); } /* solo composite */
}

@keyframes aparecer {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### `will-change` y `contain`

```css
/* will-change: hint al browser para crear una capa GPU */
.menu-animado {
  will-change: transform; /* El browser crea la capa GPU antes de la animación */
}
/* ⚠️ No abusar — cada capa GPU consume memoria. Solo en elementos que REALMENTE animan */

/* contain: le dice al browser que este componente es independiente del resto */
.widget {
  contain: layout style paint; /* Los cambios dentro no afectan al resto del DOM */
}
/* Muy útil para widgets de terceros o componentes con contenido dinámico frecuente */
```

---

## Medición y Profiling

### Chrome DevTools

```
Performance tab:
  1. Click en Record
  2. Interactuar con la página
  3. Stop — ver flame chart
  4. Buscar "Long Tasks" (barras rojas > 50ms)
  5. Identificar qué función causa el bloqueo

Network tab:
  - Waterfall de peticiones
  - "Slow 3G" throttling para simular móvil
  - Ver Transfer Size vs Resource Size (ratio de compresión)

Memory tab:
  - Heap snapshots para detectar memory leaks
  - Grabar asignaciones de memoria en el tiempo
```

### React Developer Tools Profiler

```tsx
// Envolver componentes sospechosos con Profiler para medir
import { Profiler } from "react";

function onRenderCallback(
  id: string,
  phase: "mount" | "update",
  actualDuration: number,   // tiempo real de render
  baseDuration: number,     // tiempo estimado sin memoización
  startTime: number,
  commitTime: number
) {
  if (actualDuration > 16) { // > 1 frame a 60fps
    console.warn(`⚠️ ${id} tardó ${actualDuration.toFixed(2)}ms en ${phase}`);
  }
}

function App() {
  return (
    <Profiler id="ListaProductos" onRender={onRenderCallback}>
      <ListaProductos />
    </Profiler>
  );
}
```

### Performance API Nativa

```typescript
// Medir tiempos precisos de operaciones propias
performance.mark("inicio-carga-datos");
const datos = await fetchDatos();
performance.mark("fin-carga-datos");

performance.measure("carga-datos", "inicio-carga-datos", "fin-carga-datos");

const [medicion] = performance.getEntriesByName("carga-datos");
console.log(`Carga de datos: ${medicion.duration.toFixed(2)}ms`);

// También para medir renders costosos
function ComponentePesado() {
  performance.mark("render-inicio");

  useEffect(() => {
    performance.mark("render-fin");
    performance.measure("render-ComponentePesado", "render-inicio", "render-fin");
  });

  return <div>{/* contenido pesado */}</div>;
}
```
