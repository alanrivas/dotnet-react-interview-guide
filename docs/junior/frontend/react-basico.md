---
id: react-basico
title: React - Fundamentos
sidebar_position: 5
---

# React — Fundamentos 🟢

## ¿Qué es React?

React es una **biblioteca de JavaScript** para construir interfaces de usuario. Desarrollada por Meta, usa un paradigma **declarativo** basado en **componentes**.

:::note Importante
React es una **biblioteca**, no un framework. Maneja solo la UI (la "V" de MVC). Para routing, estado global, etc., se necesitan librerías adicionales.
:::

---

## Componentes

Todo en React es un componente. Los modernos son **funcionales**.

```tsx
// Componente funcional (recomendado)
function Saludo({ nombre, edad }: { nombre: string; edad: number }) {
  return (
    <div>
      <h1>Hola, {nombre}!</h1>
      <p>Tienes {edad} años</p>
    </div>
  );
}

// Uso
<Saludo nombre="Juan" edad={25} />
```

### Props

```tsx
// Definir tipo de props con TypeScript
interface TarjetaProductoProps {
  nombre: string;
  precio: number;
  imagen?: string;       // opcional
  onAgregar: () => void; // función
}

function TarjetaProducto({ nombre, precio, imagen, onAgregar }: TarjetaProductoProps) {
  return (
    <div className="card">
      {imagen && <img src={imagen} alt={nombre} />}
      <h3>{nombre}</h3>
      <span>${precio.toFixed(2)}</span>
      <button onClick={onAgregar}>Agregar al carrito</button>
    </div>
  );
}
```

---

## useState — Estado local

```tsx
import { useState } from 'react';

function Contador() {
  const [contador, setContador] = useState(0);
  const [nombre, setNombre] = useState('');

  return (
    <div>
      <p>Contador: {contador}</p>
      <button onClick={() => setContador(contador + 1)}>+1</button>
      <button onClick={() => setContador(c => c - 1)}>-1</button>  {/* forma funcional */}
      
      <input 
        value={nombre} 
        onChange={(e) => setNombre(e.target.value)} 
        placeholder="Tu nombre"
      />
    </div>
  );
}
```

:::tip Regla de los Hooks
Los Hooks **solo pueden llamarse**:
1. En el nivel superior del componente (no dentro de if, loops, funciones)
2. En componentes funcionales o Custom Hooks
:::

---

## useEffect — Efectos secundarios

```tsx
import { useState, useEffect } from 'react';

function PerfilUsuario({ userId }: { userId: number }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Se ejecuta después del render, cuando userId cambia
  useEffect(() => {
    setCargando(true);
    
    fetch(`/api/usuarios/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUsuario(data);
        setCargando(false);
      });

    // Función de cleanup (se ejecuta antes del siguiente effect o al desmontar)
    return () => {
      console.log('Limpiando efecto');
    };
  }, [userId]); // Array de dependencias

  if (cargando) return <p>Cargando...</p>;
  return <div>{usuario?.nombre}</div>;
}
```

### Variantes del array de dependencias

```tsx
useEffect(() => { /* Se ejecuta en CADA render */ });
useEffect(() => { /* Se ejecuta solo al MONTAR */ }, []);
useEffect(() => { /* Se ejecuta cuando cambia x o y */ }, [x, y]);
```

---

## Renderizado de listas

```tsx
interface Producto {
  id: number;
  nombre: string;
  precio: number;
}

function ListaProductos({ productos }: { productos: Producto[] }) {
  return (
    <ul>
      {productos.map(producto => (
        // key es OBLIGATORIO y debe ser único y estable
        <li key={producto.id}>
          {producto.nombre} — ${producto.precio}
        </li>
      ))}
    </ul>
  );
}
```

:::warning Key
- La `key` debe ser única entre hermanos
- Usa el ID del dato, **no el índice del array** (salvo que la lista nunca cambie)
- El índice como key causa bugs en listas que se reordenan/filtran
:::

---

## Renderizado condicional

```tsx
function Notificacion({ mensajes }: { mensajes: string[] }) {
  const tieneMensajes = mensajes.length > 0;

  return (
    <div>
      {/* Operador && */}
      {tieneMensajes && <span>Tienes {mensajes.length} mensajes</span>}
      
      {/* Ternario */}
      {tieneMensajes 
        ? <ul>{mensajes.map((m, i) => <li key={i}>{m}</li>)}</ul>
        : <p>No tienes mensajes</p>
      }
    </div>
  );
}
```

---

## Eventos

```tsx
function Formulario() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // Prevenir recarga de página
    console.log('Formulario enviado');
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log('Click en', e.currentTarget);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Valor:', e.target.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input onChange={handleChange} />
      <button type="submit" onClick={handleClick}>Enviar</button>
    </form>
  );
}
```

---

## Patrones de composición

### Pattern 1: Children

El patrón más simple: pasar componentes como `children`.

```tsx
// Componente contenedor
function Modal({ title, children }: { title: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  
  return (
    <>
      <button onClick={() => setAbierto(true)}>Abrir modal</button>
      {abierto && (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>{title}</h2>
            {children} {/* El contenido se inserta aquí */}
            <button onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}

// Uso flexible
<Modal title="Confirmación">
  <p>¿Estás seguro?</p>
  <button>Confirmar</button>
</Modal>

// O con componente
<Modal title="Crear usuario">
  <FormularioUsuario />
</Modal>
```

### Pattern 2: Render Props

Pasar una función como prop que retorna JSX.

```tsx
// Componente que maneja lógica
function RatonTracker({ children }: { children: (x: number, y: number) => React.ReactNode }) {
  const [posicion, setPosicion] = useState({ x: 0, y: 0 });
  
  return (
    <div 
      onMouseMove={(e) => setPosicion({ x: e.clientX, y: e.clientY })}
      style={{ width: '100%', height: '100vh' }}
    >
      {children(posicion.x, posicion.y)}
    </div>
  );
}

// Uso
<RatonTracker>
  {(x, y) => (
    <div>
      La posición del ratón: x={x}, y={y}
    </div>
  )}
</RatonTracker>
```

### Pattern 3: Higher-Order Component (HOC)

Una función que envuelve un componente y agrega funcionalidad.

```tsx
// HOC que agrega autenticación
function conAutenticacion<P extends {usuario?: User}>(
  Componente: React.ComponentType<P>
): React.FC<Omit<P, 'usuario'>> {
  return function ConAutenticacionEnvuelto(props: Omit<P, 'usuario'>) {
    const [usuario, setUsuario] = useState<User | null>(null);
    
    useEffect(() => {
      // Simular obtener usuario autenticado
      setUsuario({ id: 1, nombre: 'Juan', email: 'juan@example.com' });
    }, []);
    
    if (!usuario) return <div>Cargando...</div>;
    
    return <Componente {...(props as P)} usuario={usuario} />;
  };
}

// Componente que necesita usuario
function Perfil({ usuario }: { usuario: User }) {
  return <div>Bienvenido, {usuario.nombre}</div>;
}

// Usar HOC
const PerfilProtegido = conAutenticacion(Perfil);

// En app
<PerfilProtegido /> {/* usuario se inyecta automáticamente */}
```

---

## Renderizado condicional avanzado

### Múltiples condiciones

```tsx
function EstadoPedido({ estado }: { estado: 'pendiente' | 'confirmado' | 'enviado' | 'entregado' }) {
  return (
    <>
      {/* Condicional simple */}
      {estado === 'pendiente' && <div className="alert-warning">Pendiente de confirmación</div>}
      
      {/* Switch con map */}
      {
        {
          'pendiente': <div>⏳ Espera confirmación</div>,
          'confirmado': <div>✓ Confirmado, se enviará pronto</div>,
          'enviado': <div>📦 En camino</div>,
          'entregado': <div>✅ Entregado</div>,
        }[estado]
      }
      
      {/* O con componentes diferentes */}
      {estado === 'pendiente' && <PendientePage />}
      {estado === 'confirmado' && <ConfirmadoPage />}
      {estado === 'enviado' && <EnviadoPage />}
      {estado === 'entregado' && <EntregadoPage />}
    </>
  );
}

// Patrón reusable: helper function
function renderizarSegunEstado(estado: string) {
  const mapa = {
    pendiente: () => <PendientePage />,
    confirmado: () => <ConfirmadoPage />,
    enviado: () => <EnviadoPage />,
    entregado: () => <EntregadoPage />,
  };
  
  const Componente = mapa[estado as keyof typeof mapa];
  return Componente ? <Componente /> : <div>Estado desconocido</div>;
}

// Uso
<div>{renderizarSegunEstado(estado)}</div>
```

### Renderizado condicional con temporizador

```tsx
function MensajeTemporal({ mensaje, duracion = 3000 }: { mensaje: string; duracion?: number }) {
  const [visible, setVisible] = useState(true);
  
  useEffect(() => {
    if (!visible) return;
    
    const timer = setTimeout(() => setVisible(false), duracion);
    return () => clearTimeout(timer); // cleanup
  }, [visible, duracion]);
  
  return visible ? <div className="toast">{mensaje}</div> : null;
}

// Uso
<MensajeTemporal mensaje="¡Producto agregado!" duracion={2000} />
```

### Renderizado condicional basado en datos

```tsx
function ListaProductos({ productos }: { productos: Producto[] }) {
  // Estado vacío
  if (productos.length === 0) {
    return <div className="empty-state">No hay productos. Agrega uno para comenzar.</div>;
  }
  
  // Estado de carga
  if (productos.some(p => p.cargando)) {
    return <div>Cargando productos...</div>;
  }
  
  // Estado con error
  const conError = productos.filter(p => p.error);
  if (conError.length > 0) {
    return (
      <div className="error-state">
        <p>Error cargando {conError.length} producto(s)</p>
        {conError.map(p => <div key={p.id}>{p.nombre}: {p.error}</div>)}
      </div>
    );
  }
  
  // Renderizado normal
  return (
    <ul>
      {productos.map(p => (
        <li key={p.id}>{p.nombre} - ${p.precio}</li>
      ))}
    </ul>
  );
}
```

---

## Virtual DOM

React usa un **Virtual DOM** para optimizar las actualizaciones:

1. El estado cambia → React crea un nuevo Virtual DOM
2. Compara el nuevo con el anterior (**diffing**)
3. Calcula los cambios mínimos necesarios (**reconciliation**)
4. Aplica solo esos cambios al DOM real (**commit phase**)

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuándo se re-renderiza un componente?**
> Cuando cambia su estado (`useState`), cuando cambian sus props, o cuando el componente padre se re-renderiza.

**2. ¿Qué es el Virtual DOM?**
> Una representación en memoria del DOM real. React lo usa para calcular los cambios mínimos necesarios antes de actualizar el DOM real, lo que mejora el rendimiento.

**3. ¿Cuál es la diferencia entre componente controlado y no controlado?**
> **Controlado**: el estado del input está en React (`value + onChange`). **No controlado**: el DOM maneja el estado, se accede con `ref`. Preferir componentes controlados.

**4. ¿Por qué no se debe mutar el estado directamente?**
> React detecta cambios comparando la referencia del estado. Si mutas directamente (`array.push()`), la referencia no cambia y React no re-renderiza. Siempre crear nuevos objetos/arrays:
```tsx
// MAL
estado.lista.push(nuevoItem);
setEstado(estado);

// BIEN
setEstado({ ...estado, lista: [...estado.lista, nuevoItem] });
```
