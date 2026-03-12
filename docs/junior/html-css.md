---
id: html-css
title: HTML & CSS
sidebar_position: 6
---

# HTML & CSS 🟢

## HTML Semántico

El HTML semántico usa etiquetas que describen el significado del contenido.

```html
<!-- ❌ No semántico -->
<div class="header">
  <div class="nav">...</div>
</div>
<div class="main">
  <div class="article">...</div>
  <div class="sidebar">...</div>
</div>

<!-- ✅ Semántico -->
<header>
  <nav>...</nav>
</header>
<main>
  <article>...</article>
  <aside>...</aside>
</main>
<footer>...</footer>
```

**Etiquetas semánticas importantes:**
- `<header>`, `<nav>`, `<main>`, `<footer>`, `<aside>`
- `<section>`, `<article>`
- `<h1>`-`<h6>`, `<p>`, `<figure>`, `<figcaption>`
- `<button>`, `<form>`, `<label>`, `<input>`

---

## Box Model

Todo elemento HTML es una caja:

```
┌─────────────────────────────┐
│           Margin            │
│  ┌───────────────────────┐  │
│  │        Border         │  │
│  │  ┌─────────────────┐  │  │
│  │  │     Padding     │  │  │
│  │  │  ┌───────────┐  │  │  │
│  │  │  │  Content  │  │  │  │
│  │  │  └───────────┘  │  │  │
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

```css
/* box-sizing: border-box (RECOMENDADO - el ancho incluye padding y border) */
* {
  box-sizing: border-box;
}

.caja {
  width: 300px;
  padding: 20px;
  border: 2px solid #333;
  margin: 10px;
}
```

---

## Flexbox

```css
/* Contenedor flex */
.contenedor {
  display: flex;
  flex-direction: row;        /* row | column | row-reverse | column-reverse */
  justify-content: center;    /* distribución en el eje principal */
  align-items: center;        /* alineación en el eje cruzado */
  flex-wrap: wrap;            /* permite salto de línea */
  gap: 16px;                  /* espacio entre items */
}

/* Items flex */
.item {
  flex: 1;                    /* crecer, shrink, base (shorthand) */
  flex-grow: 1;               /* factor de crecimiento */
  flex-shrink: 0;             /* no encoger */
  flex-basis: 200px;          /* tamaño base */
  align-self: flex-start;     /* override align-items para este item */
}
```

---

## CSS Grid

```css
/* Grid layout */
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* 3 columnas iguales */
  grid-template-rows: auto;
  gap: 20px;
}

/* Item que ocupa múltiples columnas */
.destacado {
  grid-column: 1 / 3;   /* desde col 1 hasta col 3 */
  grid-row: 1 / 2;
}

/* Áreas nombradas */
.layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main main"
    "footer footer footer";
  grid-template-columns: 250px 1fr 1fr;
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
```

---

## Responsive Design

```css
/* Mobile first approach (RECOMENDADO) */

/* Estilos base para móvil */
.container {
  width: 100%;
  padding: 16px;
}

/* Tablet (≥ 768px) */
@media (min-width: 768px) {
  .container {
    max-width: 768px;
    margin: 0 auto;
  }
}

/* Desktop (≥ 1024px) */
@media (min-width: 1024px) {
  .container {
    max-width: 1200px;
  }
}
```

---

## CSS Variables y especificidad

```css
/* Variables CSS */
:root {
  --color-primary: #0066cc;
  --color-text: #333;
  --spacing-md: 16px;
  --font-size-base: 16px;
}

.boton {
  background: var(--color-primary);
  padding: var(--spacing-md);
}

/* Especificidad (de menor a mayor):
   Elemento (p, div)     → 0,0,1
   Clase (.clase)        → 0,1,0
   ID (#id)              → 1,0,0
   Inline (style="")     → (más específico)
   !important            → (máxima especificidad, evitar)
*/
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre `display: none` y `visibility: hidden`?**
> `display: none` elimina el elemento del flujo del documento (no ocupa espacio). `visibility: hidden` lo hace invisible pero mantiene su espacio.

**2. ¿Cuál es la diferencia entre `position: relative`, `absolute` y `fixed`?**
> - `relative`: se posiciona respecto a su posición normal en el flujo
> - `absolute`: se posiciona respecto al ancestro posicionado más cercano
> - `fixed`: se posiciona respecto al viewport (no se mueve al hacer scroll)
> - `sticky`: mezcla de relative y fixed (se queda fijo al hacer scroll hasta cierto punto)

**3. ¿Cuándo usar Flexbox vs Grid?**
> **Flexbox**: una dimensión (fila O columna). Perfecto para barras de navegación, centrar elementos, distribución en una dirección. **Grid**: dos dimensiones (filas Y columnas). Perfecto para layouts de página completos.

**4. ¿Qué es el z-index y cuándo funciona?**
> Controla la superposición de elementos en el eje Z. Solo funciona en elementos con `position` distinto de `static` (relative, absolute, fixed, sticky).
