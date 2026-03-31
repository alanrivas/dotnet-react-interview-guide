---
id: testing-frontend
title: Testing Frontend — Vitest y MSW
sidebar_position: 17
---

# Testing Frontend — Vitest & MSW 🟡

El testing básico de React ya está cubierto en la sección de [Testing](./backend). Este documento profundiza en **configuración profesional** con Vitest, mocking de APIs con **MSW (Mock Service Worker)**, y testing de componentes que dependen de Providers, React Query y Router.

---

## Vitest — Configuración profesional

Vitest es el test runner recomendado para proyectos con Vite (y Next.js puede usarlo también). Es compatible con la API de Jest pero más rápido.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',      // Simula el browser DOM
    globals: true,             // Permite usar describe/it/expect sin importar
    setupFiles: ['./src/test/setup.ts'], // Corre antes de cada archivo de test
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/'],
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

```typescript
// src/test/setup.ts — se ejecuta antes de todos los tests
import '@testing-library/jest-dom'; // extiende expect con toBeInTheDocument, etc.
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';
import { server } from './mocks/server'; // MSW server (ver sección siguiente)

// Inicia el servidor MSW antes de todos los tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Resetea handlers después de cada test (para no contaminar otros tests)
afterEach(() => {
  server.resetHandlers();
  cleanup(); // Desmonta componentes de RTL
});

// Cierra el servidor al final
afterAll(() => server.close());
```

```json
// package.json — scripts
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:run": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.0.0",
    "@vitest/ui": "^2.0.0",
    "@vitest/coverage-v8": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "msw": "^2.0.0",
    "jsdom": "^25.0.0"
  }
}
```

---

## MSW — Mock Service Worker

MSW intercepta requests HTTP **a nivel de red**, no mockeando `fetch`. Esto hace los tests más realistas y evita el acoplamiento al código de fetching.

```
Sin MSW:  Componente → fetch() → [mock de fetch] (frágil, acoplado)
Con MSW:  Componente → fetch() → Red → [MSW intercepta] → respuesta mock
```

### Configuración inicial

```typescript
// src/test/mocks/handlers.ts — define los endpoints mockeados
import { http, HttpResponse } from 'msw';

export const handlers = [
  // GET /api/productos
  http.get('/api/productos', () => {
    return HttpResponse.json([
      { id: 1, nombre: 'Laptop', precio: 999 },
      { id: 2, nombre: 'Mouse', precio: 49 },
    ]);
  }),

  // GET /api/productos/:id
  http.get('/api/productos/:id', ({ params }) => {
    const { id } = params;
    if (id === '999') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({ id: Number(id), nombre: 'Laptop', precio: 999 });
  }),

  // POST /api/productos
  http.post('/api/productos', async ({ request }) => {
    const body = await request.json() as { nombre: string; precio: number };
    return HttpResponse.json(
      { id: 3, ...body },
      { status: 201 }
    );
  }),

  // DELETE /api/productos/:id
  http.delete('/api/productos/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
```

```typescript
// src/test/mocks/server.ts — servidor MSW para tests (Node.js)
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

### Tests con MSW

```tsx
// ListaProductos.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { ListaProductos } from './ListaProductos';

describe('ListaProductos', () => {
  it('muestra los productos al cargar', async () => {
    render(<ListaProductos />);

    // Mientras carga
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();

    // Espera a que aparezcan los datos del handler por defecto
    expect(await screen.findByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('Mouse')).toBeInTheDocument();
  });

  it('muestra error cuando la API falla', async () => {
    // Override del handler para este test específico
    server.use(
      http.get('/api/productos', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    render(<ListaProductos />);

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/error/i);
  });

  it('muestra mensaje cuando la lista está vacía', async () => {
    server.use(
      http.get('/api/productos', () => {
        return HttpResponse.json([]);
      })
    );

    render(<ListaProductos />);

    expect(await screen.findByText(/no hay productos/i)).toBeInTheDocument();
  });
});
```

:::tip MSW vs vi.fn() para mocking de APIs
- **`vi.fn()` mockeando fetch**: frágil — si cambias `fetch` a `axios` o cambia la URL, el test falla aunque el comportamiento sea igual
- **MSW**: intercepta a nivel de red — no le importa si usás `fetch`, `axios`, `React Query` o `ky`. El test sigue pasando
:::

---

## Testing de componentes con Providers

La mayoría de los componentes reales dependen de Context, React Router o React Query. Necesitás wrappearlos.

### Wrapper helper reutilizable

```tsx
// src/test/utils.tsx — render con providers incluidos
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';

// Query client con retry=false para tests (no reintentar en errores)
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
  initialRoute?: string;
}

function AllProviders({ children, initialRoute = '/' }: WrapperProps) {
  const queryClient = makeQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// render customizado que incluye todos los providers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialRoute?: string }
) {
  const { initialRoute, ...renderOptions } = options ?? {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders initialRoute={initialRoute}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

// Re-exportar todo de RTL para no importar de dos lugares
export * from '@testing-library/react';
```

```tsx
// Uso en tests — importar de utils en vez de @testing-library/react
import { renderWithProviders, screen } from '../test/utils';
import { ProductoDetalle } from './ProductoDetalle';

it('muestra los detalles del producto', async () => {
  renderWithProviders(<ProductoDetalle />, {
    initialRoute: '/productos/1',
  });

  expect(await screen.findByText('Laptop')).toBeInTheDocument();
});
```

---

## Testing de componentes con React Query

Los componentes que usan `useQuery` necesitan `QueryClientProvider` y su comportamiento asíncrono requiere manejo cuidadoso.

```tsx
// hooks/useProductos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useProductos() {
  return useQuery({
    queryKey: ['productos'],
    queryFn: () => fetch('/api/productos').then(r => r.json()),
  });
}

export function useEliminarProducto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/productos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] });
    },
  });
}
```

```tsx
// ListaProductos.test.tsx
import { renderWithProviders, screen, waitFor } from '../test/utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { ListaProductos } from './ListaProductos';

describe('ListaProductos con React Query', () => {
  it('carga y muestra los productos', async () => {
    renderWithProviders(<ListaProductos />);

    // React Query muestra loading state
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();

    // Datos cargados del handler MSW
    await screen.findByText('Laptop');
    expect(screen.getByText('Mouse')).toBeInTheDocument();
  });

  it('elimina un producto y actualiza la lista', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ListaProductos />);

    await screen.findByText('Laptop');

    // Click en eliminar el primer producto
    const botones = screen.getAllByRole('button', { name: /eliminar/i });
    await user.click(botones[0]);

    // Verificar que la lista se actualizó (refetch por invalidación)
    await waitFor(() => {
      expect(screen.queryByText('Laptop')).not.toBeInTheDocument();
    });
  });

  it('muestra error cuando la API falla', async () => {
    server.use(
      http.get('/api/productos', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderWithProviders(<ListaProductos />);

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/error al cargar/i);
  });
});
```

---

## Testing de formularios con react-hook-form

```tsx
// components/FormProducto.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  nombre: z.string().min(3, 'Mínimo 3 caracteres'),
  precio: z.number().positive('El precio debe ser positivo'),
  categoria: z.enum(['electronica', 'ropa', 'hogar']),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onSubmit: (data: FormData) => Promise<void>;
}

export function FormProducto({ onSubmit }: Props) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label>
        Nombre
        <input {...register('nombre')} />
        {errors.nombre && <span role="alert">{errors.nombre.message}</span>}
      </label>

      <label>
        Precio
        <input type="number" {...register('precio', { valueAsNumber: true })} />
        {errors.precio && <span role="alert">{errors.precio.message}</span>}
      </label>

      <label>
        Categoría
        <select {...register('categoria')}>
          <option value="electronica">Electrónica</option>
          <option value="ropa">Ropa</option>
          <option value="hogar">Hogar</option>
        </select>
      </label>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar'}
      </button>
    </form>
  );
}
```

```tsx
// FormProducto.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FormProducto } from './FormProducto';

describe('FormProducto', () => {
  it('llama a onSubmit con los datos correctos', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn().mockResolvedValue(undefined);

    render(<FormProducto onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Laptop Gaming');
    await user.clear(screen.getByLabelText(/precio/i));
    await user.type(screen.getByLabelText(/precio/i), '1500');
    await user.selectOptions(screen.getByLabelText(/categoría/i), 'electronica');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        nombre: 'Laptop Gaming',
        precio: 1500,
        categoria: 'electronica',
      });
    });
  });

  it('muestra error de validación cuando el nombre es muy corto', async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();

    render(<FormProducto onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/nombre/i), 'AB'); // < 3 chars
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/mínimo 3 caracteres/i);
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('deshabilita el botón mientras se envía', async () => {
    const user = userEvent.setup();
    // Simula una operación lenta
    const mockSubmit = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<FormProducto onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Laptop');
    await user.type(screen.getByLabelText(/precio/i), '999');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    // Durante el envío
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();

    // Después de completar
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
    });
  });
});
```

---

## Testing de componentes con React Router

```tsx
// components/ProductoDetalle.tsx — usa useParams y navigate
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

export function ProductoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => fetch(`/api/productos/${id}`).then(r => {
      if (!r.ok) throw new Error('No encontrado');
      return r.json();
    }),
  });

  if (isLoading) return <p>Cargando...</p>;
  if (error) return <p role="alert">Producto no encontrado</p>;

  return (
    <div>
      <h1>{data.nombre}</h1>
      <p>${data.precio}</p>
      <button onClick={() => navigate('/productos')}>Volver</button>
    </div>
  );
}
```

```tsx
// ProductoDetalle.test.tsx
import { renderWithProviders, screen } from '../test/utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { ProductoDetalle } from './ProductoDetalle';
import { Route, Routes } from 'react-router-dom';

// Helper para renderizar con ruta específica
function renderProductoDetalle(id: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/productos/:id" element={<ProductoDetalle />} />
      <Route path="/productos" element={<div>Lista de productos</div>} />
    </Routes>,
    { initialRoute: `/productos/${id}` }
  );
}

describe('ProductoDetalle', () => {
  it('muestra los detalles del producto', async () => {
    renderProductoDetalle('1');

    await screen.findByText('Laptop');
    expect(screen.getByText('$999')).toBeInTheDocument();
  });

  it('muestra error cuando el producto no existe', async () => {
    renderProductoDetalle('999'); // el handler de MSW retorna 404 para id=999

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/no encontrado/i);
  });

  it('navega a la lista al hacer clic en Volver', async () => {
    const user = userEvent.setup();
    renderProductoDetalle('1');

    await screen.findByText('Laptop');
    await user.click(screen.getByRole('button', { name: /volver/i }));

    expect(screen.getByText('Lista de productos')).toBeInTheDocument();
  });
});
```

---

## Testing de Context personalizado

```tsx
// context/CarritoContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface Item { id: number; nombre: string; cantidad: number; }
interface CarritoContextType {
  items: Item[];
  agregar: (item: Omit<Item, 'cantidad'>) => void;
  vaciar: () => void;
  total: number;
}

const CarritoContext = createContext<CarritoContextType | null>(null);

export function CarritoProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);

  const agregar = (item: Omit<Item, 'cantidad'>) => {
    setItems(prev => {
      const existente = prev.find(i => i.id === item.id);
      if (existente) return prev.map(i => i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...prev, { ...item, cantidad: 1 }];
    });
  };

  const vaciar = () => setItems([]);
  const total = items.reduce((sum, i) => sum + i.cantidad, 0);

  return (
    <CarritoContext.Provider value={{ items, agregar, vaciar, total }}>
      {children}
    </CarritoContext.Provider>
  );
}

export const useCarrito = () => {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return ctx;
};
```

```tsx
// CarritoContext.test.tsx — testing del context con renderHook
import { renderHook, act } from '@testing-library/react';
import { CarritoProvider, useCarrito } from './CarritoContext';
import { ReactNode } from 'react';

const wrapper = ({ children }: { children: ReactNode }) => (
  <CarritoProvider>{children}</CarritoProvider>
);

describe('useCarrito', () => {
  it('empieza con carrito vacío', () => {
    const { result } = renderHook(() => useCarrito(), { wrapper });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.total).toBe(0);
  });

  it('agrega un item al carrito', () => {
    const { result } = renderHook(() => useCarrito(), { wrapper });

    act(() => {
      result.current.agregar({ id: 1, nombre: 'Laptop' });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.total).toBe(1);
  });

  it('incrementa la cantidad si el item ya existe', () => {
    const { result } = renderHook(() => useCarrito(), { wrapper });

    act(() => {
      result.current.agregar({ id: 1, nombre: 'Laptop' });
      result.current.agregar({ id: 1, nombre: 'Laptop' });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidad).toBe(2);
    expect(result.current.total).toBe(2);
  });

  it('vacía el carrito', () => {
    const { result } = renderHook(() => useCarrito(), { wrapper });

    act(() => {
      result.current.agregar({ id: 1, nombre: 'Laptop' });
      result.current.vaciar();
    });

    expect(result.current.items).toHaveLength(0);
  });

  it('lanza error si se usa fuera del Provider', () => {
    // Sin wrapper — no tiene CarritoProvider
    expect(() => renderHook(() => useCarrito())).toThrow(
      'useCarrito debe usarse dentro de CarritoProvider'
    );
  });
});
```

---

## Queries: jerarquía y cuándo usar cada una

```tsx
// Prioridad de queries de RTL (de mayor a menor recomendada):

// 1. getByRole — PREFERIDA (semántica, accesibilidad)
screen.getByRole('button', { name: /enviar/i })
screen.getByRole('textbox', { name: /email/i })
screen.getByRole('heading', { level: 1 })
screen.getByRole('checkbox', { name: /acepto términos/i })
screen.getByRole('link', { name: /ver más/i })

// 2. getByLabelText — para inputs con labels
screen.getByLabelText('Nombre completo')
screen.getByLabelText(/contraseña/i)

// 3. getByPlaceholderText — si no hay label (menos ideal)
screen.getByPlaceholderText('Buscar productos...')

// 4. getByText — para texto visible
screen.getByText('Hola mundo')
screen.getByText(/bienvenido/i)

// 5. getByDisplayValue — para inputs con valor actual
screen.getByDisplayValue('valor inicial')

// 6. getByAltText — para imágenes
screen.getByAltText('Logo de la empresa')

// 7. getByTitle — para atributo title
screen.getByTitle('Cerrar modal')

// 8. getByTestId — ÚLTIMO RECURSO (no aporta semántica)
screen.getByTestId('tabla-resumen')
```

:::warning Sobre data-testid
`data-testid` es una escapatoria válida para casos donde no hay forma semántica de identificar el elemento. Pero si abusás de `data-testid`, estás testeando implementación en vez de comportamiento. El usuario no sabe que existe `data-testid="btn-submit"`, pero sí sabe que existe un botón que dice "Enviar".
:::

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué ventaja tiene MSW sobre mockear `fetch` directamente?**
> MSW intercepta a nivel de red (usando Service Workers en browser, interceptores HTTP en Node). Eso significa que no importa cómo hagas el request — `fetch`, `axios`, React Query — MSW lo captura igual. Además, si cambiás la librería de HTTP, los tests siguen funcionando sin tocarlos. Con `vi.fn()` sobre `fetch`, tenés que conocer los detalles de implementación.

**2. ¿Por qué `retry: false` en el QueryClient de tests?**
> Por defecto React Query reintenta queries fallidas 3 veces. En tests, eso hace que el test tarde y sea impredecible. Con `retry: false`, si la API falla, el error aparece inmediatamente — tests más rápidos y deterministas.

**3. ¿Cuándo usarías `waitFor` vs `findBy`?**
> `findBy*` = `waitFor` + `getBy*` — son equivalentes para esperar que un elemento aparezca. Usá `findByText('algo')` cuando esperás que aparezca un elemento. Usá `waitFor` cuando necesitás afirmar que algo **desapareció** o cuando la condición es más compleja: `await waitFor(() => expect(fn).toHaveBeenCalled())`.

**4. ¿Cómo probarías que un componente navega a otra ruta?**
> Renderizando las dos rutas en el mismo test con `MemoryRouter` y verificando que el componente de destino aparece. No testear `navigate()` directamente — testear el resultado observable: que la UI cambia.

**5. ¿Cómo testearías un custom hook que usa Context?**
> Con `renderHook` pasando un `wrapper` que incluye el Provider. El `wrapper` le da al hook el contexto que necesita para funcionar, igual que un componente padre en la app real.

**6. ¿Qué pasa si no llamás a `server.resetHandlers()` entre tests?**
> Los overrides de handlers que hiciste en un test (con `server.use(...)`) se acumulan y afectan tests posteriores. El orden de ejecución de los tests empieza a importar — un anti-patrón. `resetHandlers` en `afterEach` garantiza que cada test parte del estado base definido en `handlers.ts`.
