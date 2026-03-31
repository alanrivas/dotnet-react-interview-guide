---
id: signalr-react
title: SignalR & WebSockets — Consumo desde React
sidebar_position: 9
---

# SignalR & WebSockets — Consumo desde React 🟡

El lado servidor de SignalR se cubre en [SignalR & WebSockets — Real-Time en .NET](../dotnet/signalr-websockets). Este documento se enfoca en **cómo consumirlo desde React**: instalar el cliente, manejar el ciclo de vida de la conexión, tipado con TypeScript y patrones recomendados.

---

## Instalación

```bash
npm install @microsoft/signalr
```

---

## Conexión básica

```tsx
import * as signalR from '@microsoft/signalr';

// Crear la conexión — por convención, en un módulo separado o custom hook
const connection = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/notificaciones')          // URL relativa al servidor ASP.NET
  .withAutomaticReconnect()                  // reconexión automática con backoff
  .configureLogging(signalR.LogLevel.Warning)
  .build();

// Iniciar la conexión
await connection.start();

// Escuchar eventos del servidor
connection.on('NuevaNotificacion', (mensaje: string) => {
  console.log('Notificación recibida:', mensaje);
});

// Invocar métodos del servidor
await connection.invoke('SuscribirseAGrupo', 'sala-1');

// Detener cuando ya no se necesita
await connection.stop();
```

---

## Custom Hook — patrón recomendado

Encapsular la lógica de conexión en un custom hook mantiene los componentes limpios y garantiza que la conexión se cierre al desmontar.

```tsx
// hooks/useSignalR.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface UseSignalROptions {
  hubUrl: string;
  onReconnecting?: (error?: Error) => void;
  onReconnected?: (connectionId?: string) => void;
  onClose?: (error?: Error) => void;
}

export function useSignalR({ hubUrl, onReconnecting, onReconnected, onClose }: UseSignalROptions) {
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000]) // tiempos de reintento
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Eventos de ciclo de vida
    connection.onreconnecting((err) => {
      setState('reconnecting');
      onReconnecting?.(err ?? undefined);
    });

    connection.onreconnected((connectionId) => {
      setState('connected');
      onReconnected?.(connectionId);
    });

    connection.onclose((err) => {
      setState('disconnected');
      setError(err ?? null);
      onClose?.(err ?? undefined);
    });

    connectionRef.current = connection;

    setState('connecting');
    connection
      .start()
      .then(() => setState('connected'))
      .catch((err: Error) => {
        setState('disconnected');
        setError(err);
      });

    // Cleanup: detener la conexión al desmontar el componente
    return () => {
      connection.stop();
    };
  }, [hubUrl]); // Solo reconectar si cambia la URL

  // Escuchar un evento del servidor
  const on = useCallback(<T>(eventName: string, handler: (data: T) => void) => {
    connectionRef.current?.on(eventName, handler);
    return () => connectionRef.current?.off(eventName, handler);
  }, []);

  // Invocar un método del servidor
  const invoke = useCallback(async <T>(methodName: string, ...args: unknown[]): Promise<T | undefined> => {
    if (connectionRef.current?.state !== signalR.HubConnectionState.Connected) {
      console.warn('SignalR: intento de invoke sin conexión activa');
      return undefined;
    }
    return connectionRef.current.invoke<T>(methodName, ...args);
  }, []);

  return { state, error, on, invoke };
}
```

---

## Uso del hook en un componente

```tsx
// components/NotificacionesPanel.tsx
import { useEffect, useState } from 'react';
import { useSignalR } from '../hooks/useSignalR';

interface Notificacion {
  id: string;
  mensaje: string;
  fecha: string;
}

export function NotificacionesPanel() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const { state, error, on, invoke } = useSignalR({ hubUrl: '/hubs/notificaciones' });

  // Registrar el handler cuando la conexión esté lista
  useEffect(() => {
    // on() devuelve un cleanup para desregistrar el handler
    const cleanup = on<Notificacion>('NuevaNotificacion', (notif) => {
      setNotificaciones(prev => [notif, ...prev]);
    });

    return cleanup;
  }, [on]);

  // Invocar método del servidor al montar
  useEffect(() => {
    if (state === 'connected') {
      invoke('SuscribirseAGrupo', 'notificaciones-generales');
    }
  }, [state, invoke]);

  if (state === 'connecting') return <p>Conectando...</p>;
  if (state === 'reconnecting') return <p>Reconectando...</p>;
  if (error) return <p>Error de conexión: {error.message}</p>;

  return (
    <div>
      <h3>Notificaciones en tiempo real ({state})</h3>
      <ul>
        {notificaciones.map(n => (
          <li key={n.id}>{n.fecha} — {n.mensaje}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Autenticación — enviar JWT en la conexión

```tsx
import { getAccessToken } from '../auth/tokenService'; // tu función de obtener token

const connection = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/privado', {
    // accessTokenFactory se llama antes de cada request/conexión
    // Si el token expira durante la sesión, SignalR lo refresca automáticamente
    accessTokenFactory: () => getAccessToken(),
  })
  .withAutomaticReconnect()
  .build();
```

:::tip JWT y reconexión
`accessTokenFactory` puede ser una función async que devuelve `Promise<string>`. Cuando SignalR intenta reconectarse, llama a la factory de nuevo — ideal para refrescar tokens expirados antes de reconectar.
:::

---

## Manejo de errores de `invoke`

Los métodos del servidor pueden lanzar excepciones. Siempre maneja los errores de `invoke`:

```tsx
const enviarMensaje = async (texto: string) => {
  try {
    await invoke('EnviarMensaje', { texto, sala: 'sala-1' });
  } catch (err) {
    // El servidor lanzó una excepción o la conexión se perdió
    console.error('Error enviando mensaje:', err);
    setMensajeError('No se pudo enviar el mensaje. Intenta de nuevo.');
  }
};
```

---

## WebSocket nativo (sin SignalR)

Si el servidor no usa SignalR sino WebSockets directamente:

```tsx
// hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = (e) => console.error('WebSocket error:', e);
    ws.onmessage = (e) => setLastMessage(e.data);

    return () => ws.close(); // cleanup al desmontar
  }, [url]);

  const send = useCallback((data: string | ArrayBufferLike | Blob) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  return { isConnected, lastMessage, send };
}
```

```tsx
// Uso con JSON
const { isConnected, lastMessage, send } = useWebSocket('wss://api.ejemplo.com/ws');

useEffect(() => {
  if (lastMessage) {
    const data = JSON.parse(lastMessage);
    // procesar data
  }
}, [lastMessage]);

const enviar = () => send(JSON.stringify({ tipo: 'ping', timestamp: Date.now() }));
```

---

## Diferencias clave: SignalR vs WebSocket nativo

| Aspecto | SignalR (`@microsoft/signalr`) | WebSocket nativo |
|---------|-------------------------------|-----------------|
| Reconexión automática | ✅ Incorporada con backoff | ❌ Manual |
| Fallback de transporte | ✅ WebSocket → SSE → Long Polling | ❌ Solo WebSocket |
| Tipado de mensajes | ✅ via `.on('EventName', handler)` | Manual via JSON.parse |
| Autenticación | ✅ `accessTokenFactory` | Manual (query param o header) |
| Grupos/salas | ✅ Nativo en el servidor | ❌ Manual |
| Peso del bundle | ~200KB (minificado) | 0KB (nativo del browser) |

**Usa SignalR** cuando el backend es ASP.NET Core. **Usa WebSocket nativo** cuando el servidor no es .NET o quieres máxima ligereza de bundle.

---

## Testing del custom hook

```tsx
// hooks/useSignalR.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSignalR } from './useSignalR';
import * as signalR from '@microsoft/signalr';

// Mock del módulo signalR
vi.mock('@microsoft/signalr', () => ({
  HubConnectionBuilder: vi.fn(() => ({
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    configureLogging: vi.fn().mockReturnThis(),
    build: vi.fn(() => mockConnection),
  })),
  LogLevel: { Warning: 1 },
  HubConnectionState: { Connected: 'Connected' },
}));

const mockConnection = {
  start: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  invoke: vi.fn(),
  onreconnecting: vi.fn(),
  onreconnected: vi.fn(),
  onclose: vi.fn(),
  state: 'Connected',
};

describe('useSignalR', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inicia la conexión al montar', async () => {
    const { result } = renderHook(() =>
      useSignalR({ hubUrl: '/hubs/test' })
    );

    await waitFor(() => {
      expect(result.current.state).toBe('connected');
    });

    expect(mockConnection.start).toHaveBeenCalledOnce();
  });

  it('detiene la conexión al desmontar', async () => {
    const { unmount } = renderHook(() =>
      useSignalR({ hubUrl: '/hubs/test' })
    );

    unmount();

    expect(mockConnection.stop).toHaveBeenCalledOnce();
  });
});
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Por qué usar SignalR en vez de polling desde React?**
> Polling genera una petición HTTP cada N segundos, la mayoría vacías. SignalR abre una conexión persistente y solo envía datos cuando hay eventos reales. Menos latencia, menos carga en servidor, mejor experiencia de usuario.

**2. ¿Cómo manejas que el usuario pierda la conexión y la recupere?**
> Con `withAutomaticReconnect()` que reintenta con backoff exponencial. En el componente, manejo los estados `reconnecting` y `connected` para mostrar feedback visual y re-suscribirme a grupos del servidor cuando se reconecte (evento `onreconnected`).

**3. ¿Qué hace el cleanup en `useEffect` para SignalR?**
> Llama a `connection.stop()`, que cierra el WebSocket de forma limpia. Sin el cleanup, si el componente se desmonta la conexión queda abierta, consumiendo recursos del servidor y potencialmente recibiendo eventos en un componente ya destruido.
