---
title: "⚛️ React y Frontend"
sidebar_position: 4
---

# ⚛️ React y Frontend

Ejercicios de React + TypeScript que evalúan hooks avanzados, rendimiento y patrones de composición.

| Ejercicio | Dificultad | Tiempo |
|---|---|---|
| Infinite Scroll con React Query | 🟡 Media | 25 min |
| Custom Hook — useAsync | 🟡 Media | 20 min |

---

## Ejercicio 5: Infinite Scroll con React Query

**Dificultad**: 🟡 Media  
**Tiempo estimado**: 25 minutos  
**Temas**: React Query, useInfiniteQuery, Intersection Observer, TypeScript

### Enunciado

Implementa una lista con **scroll infinito** en React + TypeScript que:
- Use `useInfiniteQuery` de React Query para paginación
- Detecte cuando el usuario llega al final de la lista con **Intersection Observer**
- Muestre skeleton loaders mientras carga la siguiente página
- Maneje correctamente el estado de "no hay más páginas"

**API esperada:**
```typescript
// GET /api/productos?pagina=1&limite=20
// Retorna: { items: Producto[], pagina: number, totalPaginas: number }
```

### Pistas

<details>
<summary>Ver pista 1</summary>

`useInfiniteQuery` requiere una función `getNextPageParam` que determina el parámetro de la próxima página a partir del resultado de la página actual. Si retorna `undefined`, no hay más páginas.

</details>

<details>
<summary>Ver pista 2</summary>

Para Intersection Observer, crea un ref (`useRef`) y apúntalo al último elemento de la lista. En un `useEffect`, observa ese elemento y llama a `fetchNextPage()` cuando sea visible en el viewport.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```typescript
// components/ListaProductosInfinita.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

// ============================================================
// Tipos
// ============================================================
interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
}

interface PaginaProductos {
  items: Producto[];
  pagina: number;
  totalPaginas: number;
}

// ============================================================
// Función fetch de la API
// ============================================================
async function fetchProductos(pagina: number): Promise<PaginaProductos> {
  const res = await fetch(`/api/productos?pagina=${pagina}&limite=20`);
  if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
  return res.json();
}

// ============================================================
// Componente Skeleton Loader
// ============================================================
function SkeletonProducto() {
  return (
    <div className="producto-skeleton" aria-hidden="true">
      <div className="skeleton-imagen" />
      <div className="skeleton-texto skeleton-titulo" />
      <div className="skeleton-texto skeleton-precio" />
    </div>
  );
}

// ============================================================
// Hook personalizado para Intersection Observer
// ============================================================
function useIntersectionObserver(
  onIntersect: () => void,
  options: IntersectionObserverInit = { threshold: 0.1 }
) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = targetRef.current;
    if (!elemento) return;

    const observer = new IntersectionObserver((entries) => {
      // Disparar cuando el elemento sea visible en el viewport
      if (entries[0].isIntersecting) {
        onIntersect();
      }
    }, options);

    observer.observe(elemento);

    // Limpiar observer al desmontar
    return () => observer.disconnect();
  }, [onIntersect, options]);

  return targetRef;
}

// ============================================================
// Componente principal
// ============================================================
function ListaProductosInfinita() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery<PaginaProductos, Error>({
    queryKey: ['productos'],
    queryFn: ({ pageParam = 1 }) => fetchProductos(pageParam as number),

    // Determinar qué página cargar a continuación
    getNextPageParam: (ultimaPagina) => {
      if (ultimaPagina.pagina < ultimaPagina.totalPaginas) {
        return ultimaPagina.pagina + 1;
      }
      return undefined; // undefined = no hay más páginas
    },

    initialPageParam: 1,
  });

  // Callback estable para el observer (evitar recreación en cada render)
  const cargarMas = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Ref al elemento centinela (trigger de carga)
  const centinelaRef = useIntersectionObserver(cargarMas);

  // Aplanar todas las páginas en un array de items
  const productos = data?.pages.flatMap(pagina => pagina.items) ?? [];

  // Estado: carga inicial
  if (isLoading) {
    return (
      <div className="grid-productos">
        {Array.from({ length: 8 }, (_, i) => <SkeletonProducto key={i} />)}
      </div>
    );
  }

  // Estado: error
  if (isError) {
    return (
      <div className="error-estado" role="alert">
        <p>Error al cargar productos: {error.message}</p>
        <button onClick={() => fetchNextPage()}>Reintentar</button>
      </div>
    );
  }

  return (
    <div>
      {/* Grid de productos */}
      <div className="grid-productos">
        {productos.map(producto => (
          <div key={producto.id} className="producto-card">
            <img src={producto.imagen} alt={producto.nombre} loading="lazy" />
            <h3>{producto.nombre}</h3>
            <p>{producto.precio.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
          </div>
        ))}

        {/* Skeletons durante carga de página siguiente */}
        {isFetchingNextPage && (
          Array.from({ length: 4 }, (_, i) => <SkeletonProducto key={`skeleton-${i}`} />)
        )}
      </div>

      {/* Elemento centinela — invisible, dispara carga cuando es visible */}
      <div
        ref={centinelaRef}
        aria-hidden="true"
        style={{ height: '20px', margin: '20px 0' }}
      />

      {/* Indicador de fin de lista */}
      {!hasNextPage && productos.length > 0 && (
        <p className="fin-lista" aria-live="polite">
          ✓ Has visto todos los productos ({productos.length} en total)
        </p>
      )}
    </div>
  );
}

export default ListaProductosInfinita;
```

**Complejidad**: No aplica — componente de UI con paginación O(n) para renderizar

**Variantes a considerar en la entrevista:**
- ¿Cómo manejarías el caso de que el usuario navega hacia atrás? (React Query mantiene los datos en caché, `keepPreviousData`)
- ¿Cómo implementarías "virtualización" para no renderizar miles de nodos DOM? (`react-virtual` o `react-window`)
- ¿Cuándo usarías cursor-based pagination vs offset-based? (cursor es más consistente cuando los datos cambian)
- ¿Cómo pre-fetchearías la siguiente página antes de que el usuario llegue al final? (`prefetchQuery` cuando quedan pocos items)
- ¿Cómo manejarías que aparezcan nuevos productos mientras el usuario scrollea? (invalidación con `refetchInterval` o WebSockets)

</details>

---

## Ejercicio 11: Custom Hook — useAsync

**Dificultad**: 🟡 Media
**Tiempo estimado**: 20 minutos
**Temas**: React hooks, TypeScript generics, useReducer, AbortController, lifecycle

### Enunciado

Implementa un hook `useAsync<T>` que encapsule el patrón de **llamadas asíncronas** en React con:
- Estado tipado: `'idle' | 'loading' | 'success' | 'error'`
- Cancelación al desmontar el componente con `AbortController`
- Sin `setState` sobre componentes ya desmontados
- Modo **automático** (se ejecuta al montar y al cambiar dependencias)
- Modo **lazy** (se ejecuta solo al llamar a `execute()` manualmente)

**API esperada:**
```typescript
// Modo automático
const { data, isLoading, isError } = useAsync(
  (signal) => fetchUser(userId, signal),
  [userId]
);

// Modo lazy (submit de formulario)
const { execute, isLoading, isSuccess } = useAsync(
  (signal) => submitForm(data, signal),
  [],
  { lazy: true }
);
```

### Pistas

<details>
<summary>Ver pista 1</summary>

Usa `useReducer` en vez de múltiples `useState` para los estados de la llamada. Si usas tres `useState` separados (`loading`, `data`, `error`), React puede renderizar estados intermedios inconsistentes (ej: `loading=false, data=undefined` durante la transición). Un reducer garantiza que el estado cambia de forma atómica.

</details>

<details>
<summary>Ver pista 2</summary>

Crea un `AbortController` **dentro** del `useEffect`. En el cleanup (`return () => controller.abort()`), cancela la llamada cuando el componente se desmonta o cuando cambian las dependencias. En la promesa, atrapa el `AbortError` y no lo trates como error real.

</details>

### Solución

<details>
<summary>Ver solución completa</summary>

```typescript
import { useReducer, useEffect, useCallback, useRef } from 'react';

// ============================================================
// TIPOS
// ============================================================
type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

interface AsyncState<T> {
  status: AsyncStatus;
  data: T | undefined;
  error: Error | undefined;
}

type AsyncAction<T> =
  | { type: 'LOADING' }
  | { type: 'SUCCESS'; payload: T }
  | { type: 'ERROR'; payload: Error }
  | { type: 'RESET' };

interface UseAsyncOptions {
  lazy?: boolean;
}

interface UseAsyncResult<T> extends AsyncState<T> {
  execute: () => void;
  reset: () => void;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
}

// ============================================================
// REDUCER — transiciones atómicas de estado
// ============================================================
function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  switch (action.type) {
    case 'LOADING': return { status: 'loading', data: undefined, error: undefined };
    case 'SUCCESS': return { status: 'success', data: action.payload, error: undefined };
    case 'ERROR':   return { status: 'error',   data: undefined, error: action.payload };
    case 'RESET':   return { status: 'idle',    data: undefined, error: undefined };
    default:        return state;
  }
}

const initialState = { status: 'idle' as AsyncStatus, data: undefined, error: undefined };

// ============================================================
// HOOK
// ============================================================
export function useAsync<T>(
  asyncFn: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncOptions = {}
): UseAsyncResult<T> {
  const { lazy = false } = options;

  const [state, dispatch] = useReducer(
    asyncReducer as React.Reducer<AsyncState<T>, AsyncAction<T>>,
    initialState as AsyncState<T>
  );

  // Ref para saber si el componente sigue montado
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Función de ejecución — retorna el controller para que useEffect pueda cancelar
  const execute = useCallback((): AbortController => {
    const controller = new AbortController();
    dispatch({ type: 'LOADING' });

    asyncFn(controller.signal)
      .then((data) => {
        if (mountedRef.current && !controller.signal.aborted)
          dispatch({ type: 'SUCCESS', payload: data });
      })
      .catch((error: Error) => {
        if (error.name === 'AbortError') return; // Cancelación intencional — no es error
        if (mountedRef.current)
          dispatch({ type: 'ERROR', payload: error });
      });

    return controller;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Ejecución automática al montar / cambiar deps (si no es lazy)
  useEffect(() => {
    if (lazy) return;
    const controller = execute();
    return () => controller.abort(); // Cancelar si el componente desmonta o deps cambian
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lazy, ...deps]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return {
    ...state,
    execute: () => execute(),
    reset,
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError:   state.status === 'error',
  };
}

// ============================================================
// Uso — Modo automático
// ============================================================
/*
function PerfilUsuario({ userId }: { userId: number }) {
  const { data: user, isLoading, isError, error } = useAsync(
    (signal) => fetch(`/api/usuarios/${userId}`, { signal }).then(r => r.json()),
    [userId]
  );

  if (isLoading) return <Spinner />;
  if (isError)   return <p>Error: {error?.message}</p>;
  return <div>{user?.nombre}</div>;
}

// ============================================================
// Uso — Modo lazy (submit)
// ============================================================
function FormularioPedido() {
  const [formData, setFormData] = useState({ ... });

  const { execute: enviar, isLoading, isSuccess } = useAsync(
    (signal) => fetch('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify(formData),
      signal,
    }).then(r => r.json()),
    [],
    { lazy: true }
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); enviar(); }}>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Enviando...' : 'Crear Pedido'}
      </button>
      {isSuccess && <p>¡Pedido creado exitosamente!</p>}
    </form>
  );
}
*/
```

**Complejidad**: O(1) por render, el estado se actualiza en transiciones atómicas

**Variantes a considerar en la entrevista:**
- ¿Por qué `useReducer` en vez de múltiples `useState`? (evita renders con estado inconsistente: con useState separados puedes renderizar `data=undefined, loading=false` entre el `setLoading(false)` y el `setData(result)`)
- ¿Qué problema resuelve el `AbortController`? (en React 18 Strict Mode, los effects se montan/desmontan dos veces en desarrollo — sin cancelación, la segunda llamada sobreescribe la primera; en producción evita memory leaks y setState sobre componentes desmontados)
- ¿Por qué pasar `AbortSignal` a `asyncFn` en vez de cancelar internamente? (el hook no sabe si la función usa fetch, axios, o algo custom — el caller decide cómo propagar la señal)
- ¿Cuándo usarías React Query en vez de este hook? (cuando necesitas caché entre componentes, deduplicación de requests, revalidación en foco, optimistic updates, o sincronización entre pestañas)
- ¿Cómo agregarías soporte para reintentos automáticos? (contador de reintentos en el reducer; en el catch, si no es `AbortError` y `intentos < maxReintentos`, volver a llamar `asyncFn`)

</details>
