---
id: accesibilidad
title: Accesibilidad Web (a11y)
sidebar_position: 20
---

# Accesibilidad Web (a11y) 🟡

Accesibilidad (a11y — "a" + 11 letras + "y") es hacer que las aplicaciones web sean usables por personas con discapacidades visuales, motoras, auditivas o cognitivas. Se pregunta cada vez más en entrevistas de frontend porque las empresas enfrentan requisitos legales (WCAG, ADA, Ley 26.522 en Argentina) y porque es un indicador de calidad técnica.

:::info Relación con HTML semántico
[HTML & CSS](../junior/html-css) cubre el HTML semántico básico. Este documento profundiza en ARIA, manejo de foco, patrones React y testing de accesibilidad.
:::

---

## WCAG — Las reglas del juego

Las **Web Content Accessibility Guidelines** (WCAG 2.1) definen los estándares internacionales. Están organizadas en 4 principios: **POUR**.

```
P — Perceptible:   el contenido debe poder percibirse (no solo visualmente)
O — Operable:      debe poder operarse (teclado, sin tiempo límite)
U — Understandable: el contenido debe ser comprensible
R — Robust:        debe funcionar con tecnologías asistivas actuales y futuras
```

**Niveles de conformidad:**
- **A** — Mínimo (bloqueos críticos)
- **AA** — Estándar empresarial (la mayoría de las leyes exigen esto)
- **AAA** — Óptimo (muy difícil de lograr en toda la app)

---

## HTML semántico — la base

El HTML semántico correcto da accesibilidad gratis. Los screen readers entienden los roles implícitos.

```html
<!-- ❌ Problema: divs sin significado -->
<div class="btn" onclick="enviar()">Enviar</div>
<div class="input-container">
  <div class="label">Email</div>
  <input type="text" />
</div>

<!-- ✅ Correcto: elementos nativos con semántica built-in -->
<button type="submit">Enviar</button>
<label for="email">Email</label>
<input type="email" id="email" />
```

```html
<!-- Estructura de página accesible -->
<header>
  <nav aria-label="Navegación principal">
    <ul>
      <li><a href="/">Inicio</a></li>
      <li><a href="/productos">Productos</a></li>
    </ul>
  </nav>
</header>

<main id="contenido-principal">
  <h1>Catálogo de Productos</h1>  <!-- Solo UN h1 por página -->

  <section aria-labelledby="titulo-destacados">
    <h2 id="titulo-destacados">Destacados</h2>
    <!-- contenido -->
  </section>
</main>

<footer>
  <nav aria-label="Navegación del pie">
    <a href="/privacidad">Política de privacidad</a>
  </nav>
</footer>
```

---

## ARIA — cuando el HTML no alcanza

ARIA (Accessible Rich Internet Applications) agrega semántica cuando el HTML nativo no es suficiente — especialmente en componentes custom como dropdowns, modales y tabs.

:::warning Regla de oro de ARIA
> "No uses ARIA si un elemento HTML nativo puede hacer el trabajo."
> `<button>` es mejor que `<div role="button">`. ARIA solo añade semántica — no agrega comportamiento de teclado automáticamente.
:::

### Atributos ARIA fundamentales

```html
<!-- aria-label: nombre accesible cuando no hay texto visible -->
<button aria-label="Cerrar modal">✕</button>
<button aria-label="Eliminar producto Laptop">🗑</button>

<!-- aria-labelledby: nombre accesible apuntando a otro elemento -->
<h2 id="titulo-modal">Confirmar compra</h2>
<dialog aria-labelledby="titulo-modal">
  <!-- el modal se anuncia como "Confirmar compra" -->
</dialog>

<!-- aria-describedby: descripción adicional -->
<input
  type="password"
  id="password"
  aria-describedby="password-hint"
/>
<p id="password-hint">Mínimo 8 caracteres, una mayúscula y un número</p>

<!-- aria-required: campo obligatorio (complementa required nativo) -->
<input type="email" required aria-required="true" />

<!-- aria-invalid + aria-errormessage: estado de error -->
<input
  type="email"
  id="email"
  aria-invalid="true"
  aria-errormessage="email-error"
/>
<p id="email-error" role="alert">El formato del email es inválido</p>

<!-- role="alert": contenido urgente anunciado automáticamente -->
<div role="alert">¡Error al guardar los cambios!</div>

<!-- role="status": anuncio no urgente -->
<div role="status" aria-live="polite">Guardando...</div>
```

### Componentes custom con ARIA

```html
<!-- Dropdown accesible -->
<button
  id="btn-menu"
  aria-haspopup="true"
  aria-expanded="false"
  aria-controls="menu-opciones"
>
  Opciones ▼
</button>
<ul
  id="menu-opciones"
  role="menu"
  aria-labelledby="btn-menu"
  hidden
>
  <li role="menuitem"><a href="/editar">Editar</a></li>
  <li role="menuitem"><a href="/eliminar">Eliminar</a></li>
</ul>

<!-- Tabs accesibles -->
<div role="tablist" aria-label="Secciones del perfil">
  <button role="tab" aria-selected="true" aria-controls="panel-info" id="tab-info">
    Información
  </button>
  <button role="tab" aria-selected="false" aria-controls="panel-pedidos" id="tab-pedidos">
    Pedidos
  </button>
</div>
<div role="tabpanel" id="panel-info" aria-labelledby="tab-info">
  <!-- contenido de información -->
</div>
<div role="tabpanel" id="panel-pedidos" aria-labelledby="tab-pedidos" hidden>
  <!-- contenido de pedidos -->
</div>
```

---

## Accesibilidad en React

### Componente de input accesible

```tsx
interface InputAccesibleProps {
  id: string;
  label: string;
  tipo?: string;
  error?: string;
  descripcion?: string;
  requerido?: boolean;
}

export function InputAccesible({
  id,
  label,
  tipo = 'text',
  error,
  descripcion,
  requerido = false,
  ...props
}: InputAccesibleProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${id}-error`;
  const descripcionId = `${id}-desc`;

  return (
    <div>
      <label htmlFor={id}>
        {label}
        {requerido && <span aria-hidden="true"> *</span>}
        {requerido && <span className="sr-only"> (requerido)</span>}
      </label>

      <input
        id={id}
        type={tipo}
        required={requerido}
        aria-required={requerido}
        aria-invalid={!!error}
        aria-describedby={[
          error ? errorId : null,
          descripcion ? descripcionId : null,
        ].filter(Boolean).join(' ') || undefined}
        {...props}
      />

      {descripcion && (
        <p id={descripcionId} className="input-hint">
          {descripcion}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="input-error">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Manejo de foco en modales

```tsx
import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, titulo, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const anteriorFocoRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Guardar el elemento que tenía el foco antes de abrir
      anteriorFocoRef.current = document.activeElement;

      // Mover el foco al modal
      modalRef.current?.focus();
    } else {
      // Restaurar el foco al elemento original al cerrar
      if (anteriorFocoRef.current instanceof HTMLElement) {
        anteriorFocoRef.current.focus();
      }
    }
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    // Backdrop — clic fuera cierra el modal
    <div
      role="presentation"
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        tabIndex={-1}          // Permite recibir foco programáticamente
        className="modal"
        onClick={e => e.stopPropagation()} // Evitar cerrar al clickear adentro
      >
        <h2 id="modal-titulo">{titulo}</h2>

        {children}

        <button onClick={onClose} aria-label="Cerrar modal">
          ✕
        </button>
      </div>
    </div>
  );
}
```

### Focus trap — mantener el foco dentro del modal

```tsx
function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;

    const elemento = ref.current;
    const focusables = elemento.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: si está en el primero, ir al último
        if (document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        }
      } else {
        // Tab: si está en el último, ir al primero
        if (document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };

    elemento.addEventListener('keydown', handleTab);
    return () => elemento.removeEventListener('keydown', handleTab);
  }, [active, ref]);
}

// Uso
export function ModalConFocusTrap({ isOpen, ...props }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  // ...
}
```

### Notificaciones accesibles con live regions

```tsx
// Hook para notificaciones que se anuncian automáticamente
function useAnuncio() {
  const [mensaje, setMensaje] = useState('');

  const anunciar = useCallback((texto: string) => {
    setMensaje('');               // Reset para que re-anuncie si es el mismo texto
    setTimeout(() => setMensaje(texto), 100);
  }, []);

  return { mensaje, anunciar };
}

// Componente invisible para screen readers
function LiveRegion({ mensaje }: { mensaje: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"    // Visualmente oculto pero legible por screen readers
    >
      {mensaje}
    </div>
  );
}

// CSS para .sr-only (visually hidden)
// .sr-only {
//   position: absolute;
//   width: 1px;
//   height: 1px;
//   padding: 0;
//   margin: -1px;
//   overflow: hidden;
//   clip: rect(0, 0, 0, 0);
//   white-space: nowrap;
//   border: 0;
// }

// Uso
function FormularioPedido() {
  const { mensaje, anunciar } = useAnuncio();

  const handleSubmit = async () => {
    await guardarPedido();
    anunciar('Pedido guardado exitosamente'); // Screen reader lo anuncia automáticamente
  };

  return (
    <>
      <LiveRegion mensaje={mensaje} />
      <form onSubmit={handleSubmit}>
        {/* ... */}
      </form>
    </>
  );
}
```

---

## Contraste y color

```css
/* WCAG AA requiere ratio mínimo de contraste:
   - Texto normal: 4.5:1
   - Texto grande (18px+ o 14px+ bold): 3:1
   - UI components: 3:1 */

/* ❌ Insuficiente: gris claro sobre blanco */
.texto-gris-claro {
  color: #aaaaaa;  /* ratio ~2.3:1 */
  background: #ffffff;
}

/* ✅ Suficiente */
.texto-accesible {
  color: #595959;  /* ratio ~7.0:1 — supera AA y AAA */
  background: #ffffff;
}

/* No usar color como único indicador */
/* ❌ Solo color para indicar error */
.input-error { border-color: red; }

/* ✅ Color + icono + texto */
.input-error {
  border-color: #d32f2f;
  border-width: 2px;
}
.input-error::after {
  content: "⚠ Error: ";  /* Icono + texto descriptivo */
}
```

---

## Navegación por teclado

```tsx
// Asegurar que componentes custom son operables por teclado

// ❌ Solo responde a clic — inaccesible por teclado
<div onClick={handleClick} className="tarjeta-clickeable">
  Ver detalles
</div>

// ✅ Usa button nativo (maneja Enter y Space automáticamente)
<button onClick={handleClick} className="tarjeta-clickeable">
  Ver detalles
</button>

// Si necesitás un div clickeable (caso raro):
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Ver detalles
</div>

// Skip link — para saltar la navegación directamente al contenido
// Aparece solo cuando recibe foco (primera vez que presionás Tab)
<a href="#contenido-principal" className="skip-link">
  Saltar al contenido principal
</a>

// CSS del skip link
// .skip-link {
//   position: absolute;
//   transform: translateY(-100%);
//   transition: transform 0.2s;
// }
// .skip-link:focus {
//   transform: translateY(0);
// }
```

---

## Testing de accesibilidad

### jest-axe — tests automáticos

```bash
npm install --save-dev jest-axe @types/jest-axe
```

```tsx
// FormularioLogin.a11y.test.tsx
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FormularioLogin } from './FormularioLogin';

expect.extend(toHaveNoViolations);

describe('FormularioLogin — accesibilidad', () => {
  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = render(<FormularioLogin onLogin={jest.fn()} />);

    const resultados = await axe(container);

    expect(resultados).toHaveNoViolations();
    // Verifica: labels, contraste, roles ARIA, orden de foco, etc.
  });

  it('no tiene violaciones cuando hay errores de validación', async () => {
    const { container } = render(
      <FormularioLogin onLogin={jest.fn()} errores={{ email: 'Email inválido' }} />
    );

    const resultados = await axe(container);
    expect(resultados).toHaveNoViolations();
  });
});
```

### Checklist manual básico

```
□ Puedo navegar toda la app solo con Tab, Shift+Tab, Enter y Space
□ El orden de foco es lógico (top → bottom, left → right)
□ El foco nunca "desaparece" — siempre hay un indicador visual
□ Los modales atrapan el foco mientras están abiertos
□ Al cerrar un modal, el foco vuelve al elemento que lo abrió
□ Todos los inputs tienen labels asociados (htmlFor ↔ id)
□ Los errores se anuncian con role="alert" o aria-live
□ Las imágenes decorativas tienen alt="" (vacío)
□ Las imágenes informativas tienen alt descriptivo
□ El contraste de texto cumple WCAG AA (4.5:1)
□ No uso color como único indicador (también icono o texto)
□ La página tiene un solo h1 y la jerarquía de headings es correcta
□ Hay skip link para saltar la navegación
```

---

## Herramientas de desarrollo

| Herramienta | Uso |
|---|---|
| **axe DevTools** (extensión) | Audit automático en el browser |
| **Lighthouse** (Chrome DevTools) | Auditoría completa con score de accesibilidad |
| **NVDA** (Windows, gratis) | Screen reader real para probar |
| **VoiceOver** (Mac/iOS) | Screen reader de Apple |
| **jest-axe** | Tests automáticos en CI |
| **eslint-plugin-jsx-a11y** | Linting de accesibilidad en JSX |

```bash
# ESLint con reglas de accesibilidad
npm install --save-dev eslint-plugin-jsx-a11y

# .eslintrc
{
  "plugins": ["jsx-a11y"],
  "extends": ["plugin:jsx-a11y/recommended"]
}
# Detecta: imágenes sin alt, divs clickeables sin rol, inputs sin label, etc.
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es WCAG y qué nivel debería cumplir una app empresarial?**
> WCAG (Web Content Accessibility Guidelines) es el estándar internacional de accesibilidad web. El nivel **AA** es el estándar requerido por la mayoría de las legislaciones y el objetivo razonable para apps empresariales. Cubre: texto con contraste suficiente, navegación por teclado, labels en formularios, alternativas textuales para imágenes, y anuncios dinámicos para lectores de pantalla.

**2. ¿Cuándo usarías ARIA y cuándo no?**
> La regla es: primero intentar con HTML semántico nativo (`<button>`, `<nav>`, `<label>`). ARIA solo cuando no hay elemento HTML equivalente — por ejemplo, un componente de tabs custom, un combobox, o un slider. ARIA agrega semántica pero **no agrega comportamiento**: si usás `<div role="button">`, tenés que agregar teclado (Enter/Space) manualmente. Con `<button>` ya viene incluido.

**3. ¿Por qué no se debe usar `display: none` para ocultar contenido de screen readers y qué se usa en cambio?**
> `display: none` y `visibility: hidden` ocultan el elemento tanto visualmente como para screen readers. Para ocultar visualmente pero mantener el contenido para screen readers (ej: texto de relleno para iconos), se usa la clase CSS `visually-hidden` / `sr-only` que posiciona el elemento fuera de la pantalla con `position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0)`. Al revés, `aria-hidden="true"` oculta de screen readers pero mantiene visible — útil para iconos decorativos.

**4. ¿Cómo manejarías el foco cuando se abre un modal?**
> Al abrir: mover el foco al primer elemento interactivo dentro del modal (o al modal mismo con `tabIndex={-1}`). Implementar focus trap para que Tab cicle solo dentro del modal. Al cerrar: restaurar el foco al elemento que disparó la apertura (guardado en un ref antes de abrir). Cerrar con Escape. El foco perdido en modales es uno de los problemas más comunes que fallan los screen readers.

**5. ¿Cómo anunciarías un mensaje de éxito/error dinámico a screen readers?**
> Con ARIA live regions. Un `<div role="alert">` para mensajes urgentes (errores) — se anuncia inmediatamente interrumpiendo lo que esté leyendo el screen reader. Un `<div role="status" aria-live="polite">` para mensajes no urgentes (éxito, progreso) — espera a que el screen reader termine de leer antes de anunciar. El elemento debe estar en el DOM antes de actualizar su contenido (no montarlo con el mensaje ya dentro).
