---
id: estado-global
title: Estado Global - Redux & Zustand
sidebar_position: 7
---

# Estado Global — Redux Toolkit & Zustand 🟡

## ¿Cuándo necesitas estado global?

```
✅ Usar estado global cuando:
- El estado se comparte entre componentes no relacionados
- Hay mucho prop drilling (pasar props 3+ niveles)
- El estado persiste entre rutas/páginas
- Lógica de sincronización compleja (auth, cart, notifications)

❌ No usar estado global para:
- Estado de un solo componente (useState es suficiente)
- Datos del servidor → usar React Query / SWR
- Estado de UI simple (abrir/cerrar modal)
```

---

## Redux Toolkit (RTK)

Redux moderno — elimina el boilerplate del Redux clásico.

### Store y Slices

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import carritoReducer from './carritoSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    carrito: carritoReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

```typescript
// store/carritoSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Item {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

interface CarritoState {
  items: Item[];
  descuento: number;
}

const initialState: CarritoState = {
  items: [],
  descuento: 0,
};

const carritoSlice = createSlice({
  name: 'carrito',
  initialState,
  reducers: {
    agregarItem(state, action: PayloadAction<Omit<Item, 'cantidad'>>) {
      const existente = state.items.find(i => i.id === action.payload.id);
      if (existente) {
        existente.cantidad++; // RTK usa Immer internamente → mutación segura
      } else {
        state.items.push({ ...action.payload, cantidad: 1 });
      }
    },
    quitarItem(state, action: PayloadAction<number>) {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
    vaciarCarrito(state) {
      state.items = [];
    },
    aplicarDescuento(state, action: PayloadAction<number>) {
      state.descuento = action.payload;
    },
  },
});

export const { agregarItem, quitarItem, vaciarCarrito, aplicarDescuento } =
  carritoSlice.actions;

// Selectors
export const selectItems = (state: RootState) => state.carrito.items;
export const selectTotal = (state: RootState) =>
  state.carrito.items.reduce((acc, i) => acc + i.precio * i.cantidad, 0) *
  (1 - state.carrito.descuento / 100);
export const selectCantidadItems = (state: RootState) =>
  state.carrito.items.reduce((acc, i) => acc + i.cantidad, 0);

export default carritoSlice.reducer;
```

### RTK Query — Estado del servidor con Redux

```typescript
// store/productosApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

interface Producto {
  id: number;
  nombre: string;
  precio: number;
}

export const productosApi = createApi({
  reducerPath: 'productosApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api/' }),
  tagTypes: ['Producto'],
  endpoints: (builder) => ({
    getProductos: builder.query<Producto[], void>({
      query: () => 'productos',
      providesTags: ['Producto'],
    }),
    getProducto: builder.query<Producto, number>({
      query: (id) => `productos/${id}`,
      providesTags: (result, error, id) => [{ type: 'Producto', id }],
    }),
    crearProducto: builder.mutation<Producto, Omit<Producto, 'id'>>({
      query: (body) => ({
        url: 'productos',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Producto'], // refresca la lista
    }),
  }),
});

export const { useGetProductosQuery, useGetProductoQuery, useCrearProductoMutation } =
  productosApi;
```

### Uso en componentes

```tsx
// Conectar con hooks tipados
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';

// Custom hooks tipados (buena práctica)
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (state: RootState) => T) =>
  useSelector(selector);

// Componente
function CarritoIcono() {
  const cantidad = useAppSelector(selectCantidadItems);
  const dispatch = useAppDispatch();

  return (
    <button onClick={() => dispatch(vaciarCarrito())}>
      Carrito ({cantidad})
    </button>
  );
}
```

---

## Zustand — Estado global minimalista

Mucho más simple que Redux. Ideal para proyectos medianos.

```typescript
// store/useCarritoStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware'; // persiste en localStorage

interface Item {
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

interface CarritoStore {
  items: Item[];
  agregarItem: (item: Omit<Item, 'cantidad'>) => void;
  quitarItem: (id: number) => void;
  vaciarCarrito: () => void;
  total: () => number;
}

export const useCarritoStore = create<CarritoStore>()(
  persist(
    (set, get) => ({
      items: [],

      agregarItem: (item) =>
        set((state) => {
          const existente = state.items.find(i => i.id === item.id);
          if (existente) {
            return {
              items: state.items.map(i =>
                i.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i
              ),
            };
          }
          return { items: [...state.items, { ...item, cantidad: 1 }] };
        }),

      quitarItem: (id) =>
        set((state) => ({
          items: state.items.filter(i => i.id !== id),
        })),

      vaciarCarrito: () => set({ items: [] }),

      total: () =>
        get().items.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
    }),
    {
      name: 'carrito-storage', // key en localStorage
    }
  )
);

// Uso en componente (sin Provider!)
function Carrito() {
  const { items, agregarItem, quitarItem, total } = useCarritoStore();

  return (
    <div>
      <p>Total: ${total().toFixed(2)}</p>
      {items.map(item => (
        <div key={item.id}>
          {item.nombre} x{item.cantidad}
          <button onClick={() => quitarItem(item.id)}>X</button>
        </div>
      ))}
    </div>
  );
}
```

---

## Comparación: Redux Toolkit vs Zustand vs Context

| Criterio | Redux Toolkit | Zustand | Context API |
|----------|--------------|---------|-------------|
| **Boilerplate** | Medio | Mínimo | Ninguno |
| **DevTools** | ✅ Excelente | ✅ Bueno | ❌ Limitado |
| **Performance** | ✅ Alto | ✅ Alto | ⚠️ Re-renders |
| **Curva de aprendizaje** | Media-Alta | Baja | Ninguna |
| **Escalabilidad** | ✅ Alta | ✅ Media | ❌ Baja |
| **TypeScript** | ✅ Excelente | ✅ Bueno | ✅ Bueno |
| **Tamaño bundle** | ~47KB | ~1KB | 0 |
| **Ideal para** | Apps grandes, equipos grandes | Apps medianas | Estado simple |

---

## ¿Cuándo usar cada uno?

```
React Query / SWR          → estado del servidor (datos de API)
useState / useReducer      → estado local del componente
Context API                → estado de UI liviano (tema, idioma)
Zustand                    → estado global en apps medianas
Redux Toolkit              → apps grandes, equipos grandes, redux devtools
```
