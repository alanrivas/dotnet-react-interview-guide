---
id: signalr-websockets
title: SignalR & WebSockets — Real-Time en .NET
sidebar_position: 27
---

# SignalR & WebSockets — Real-Time en .NET 🟡

SignalR es la librería de .NET para comunicación en tiempo real. Abstrae WebSockets, Server-Sent Events y Long Polling en una sola API. Es la solución estándar para chats, notificaciones push, dashboards en vivo y colaboración en tiempo real.

---

## ¿Por qué no usar HTTP polling?

```
HTTP Polling — cliente pregunta cada N segundos:
  Cliente → GET /api/notificaciones  (t=0)   → 0 notificaciones nuevas
  Cliente → GET /api/notificaciones  (t=5s)  → 0 notificaciones nuevas
  Cliente → GET /api/notificaciones  (t=10s) → 1 notificación nueva

  ❌ Latencia = hasta N segundos
  ❌ Carga innecesaria en el servidor (99% de requests vacíos)
  ❌ No escala bien con muchos clientes

WebSocket — conexión bidireccional persistente:
  Cliente ←→ Servidor  (conexión abierta)
  Servidor → Cliente   (envío inmediato cuando hay datos)

  ✅ Latencia: ~1ms
  ✅ Solo viajan datos cuando hay eventos reales
  ✅ El servidor puede iniciar la comunicación
```

---

## Transporte: qué elige SignalR automáticamente

```
SignalR prueba transportes en orden:
  1. WebSockets     → mejor opción, requiere HTTP/1.1 upgrade
  2. Server-Sent Events → solo servidor → cliente, no requiere upgrade
  3. Long Polling   → fallback universal, mayor latencia

En la práctica: WebSockets funciona en todos los navegadores modernos
y en .NET. SignalR elige WebSockets automáticamente.
```

---

## Setup básico

```bash
# Backend — ya incluido en ASP.NET Core, sin paquete extra
# Frontend
npm install @microsoft/signalr
```

### Backend — Hub

```csharp
// Hubs/ChatHub.cs
// Un Hub es la clase que maneja las conexiones y mensajes
public class ChatHub : Hub
{
    // Método que los clientes pueden invocar desde el browser
    public async Task EnviarMensaje(string usuario, string mensaje)
    {
        // Clients.All — envía a TODOS los clientes conectados
        await Clients.All.SendAsync("RecibirMensaje", usuario, mensaje);
    }

    // Se ejecuta cuando un cliente se conecta
    public override async Task OnConnectedAsync()
    {
        Console.WriteLine($"Cliente conectado: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    // Se ejecuta cuando un cliente se desconecta
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Console.WriteLine($"Cliente desconectado: {Context.ConnectionId}");
        await base.OnDisconnectedAsync(exception);
    }
}

// Program.cs
builder.Services.AddSignalR();

app.MapHub<ChatHub>("/hubs/chat");  // URL del hub
```

### Frontend — React con TypeScript

```tsx
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { useEffect, useRef, useState } from 'react';

interface Mensaje {
  usuario: string;
  texto: string;
  timestamp: Date;
}

export function Chat() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    // Crear y configurar la conexión
    const connection = new HubConnectionBuilder()
      .withUrl('/hubs/chat')
      .withAutomaticReconnect()           // Reconectar automáticamente si cae
      .configureLogging(LogLevel.Warning)
      .build();

    // Registrar handler para mensajes entrantes
    // El nombre debe coincidir con el SendAsync del Hub
    connection.on('RecibirMensaje', (usuario: string, texto: string) => {
      setMensajes(prev => [...prev, { usuario, texto, timestamp: new Date() }]);
    });

    // Iniciar la conexión
    connection.start()
      .then(() => console.log('Conectado al hub'))
      .catch(err => console.error('Error conectando:', err));

    connectionRef.current = connection;

    // Cleanup: cerrar conexión al desmontar el componente
    return () => {
      connection.stop();
    };
  }, []);

  const enviarMensaje = async () => {
    if (!connectionRef.current || !texto.trim()) return;

    try {
      // Invocar método del Hub
      await connectionRef.current.invoke('EnviarMensaje', 'Usuario1', texto);
      setTexto('');
    } catch (err) {
      console.error('Error enviando mensaje:', err);
    }
  };

  return (
    <div>
      <ul>
        {mensajes.map((m, i) => (
          <li key={i}><strong>{m.usuario}:</strong> {m.texto}</li>
        ))}
      </ul>
      <input value={texto} onChange={e => setTexto(e.target.value)} />
      <button onClick={enviarMensaje}>Enviar</button>
    </div>
  );
}
```

---

## Grupos — enviar a subconjuntos de clientes

El patrón más útil: salas de chat, canales, suscripciones por entidad.

```csharp
public class ChatHub : Hub
{
    // Cliente se une a un grupo (sala)
    public async Task UnirseASala(string sala)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, sala);

        // Notificar a todos en la sala que alguien se unió
        await Clients.Group(sala)
            .SendAsync("UsuarioUnido", Context.User?.Identity?.Name ?? "Anónimo");
    }

    // Cliente abandona un grupo
    public async Task AbandonarSala(string sala)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, sala);
        await Clients.Group(sala)
            .SendAsync("UsuarioSalio", Context.User?.Identity?.Name ?? "Anónimo");
    }

    // Enviar mensaje solo a la sala
    public async Task EnviarMensajeSala(string sala, string mensaje)
    {
        // Clients.Group — solo los de esa sala
        await Clients.Group(sala).SendAsync("MensajeSala",
            Context.User?.Identity?.Name, mensaje);
    }

    // Otros targets disponibles:
    // Clients.All          → todos los conectados
    // Clients.Caller       → solo quien invocó el método
    // Clients.Others       → todos excepto quien invocó
    // Clients.Client(id)   → conexión específica por ConnectionId
    // Clients.Users(ids)   → usuarios específicos (requiere autenticación)
    // Clients.OthersInGroup(sala) → grupo excluyendo al caller
}
```

---

## Autenticación en SignalR

```csharp
// Program.cs — habilitar autenticación en hubs
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // ⚠️ SignalR envía el token como query string, no en header
        // Esto es necesario porque WebSockets no soporta headers personalizados
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrEmpty(accessToken) &&
                    path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

// En el Hub — acceder al usuario autenticado
public class ChatHub : Hub
{
    [Authorize]  // Requiere autenticación
    public async Task EnviarMensaje(string mensaje)
    {
        var userId = Context.UserIdentifier;     // ClaimTypes.NameIdentifier
        var userName = Context.User?.Identity?.Name;

        await Clients.All.SendAsync("RecibirMensaje", userName, mensaje);
    }
}

// Frontend — enviar JWT en la conexión
const connection = new HubConnectionBuilder()
    .withUrl('/hubs/chat', {
        accessTokenFactory: () => localStorage.getItem('token') ?? ''
    })
    .withAutomaticReconnect()
    .build();
```

---

## Enviar desde fuera del Hub — IHubContext

El caso de uso más común en producción: un controller o servicio necesita notificar a los clientes cuando pasa algo en el backend.

```csharp
// Inyectar IHubContext<T> en cualquier servicio
public class PedidoService
{
    private readonly IHubContext<NotificacionesHub> _hubContext;
    private readonly AppDbContext _db;

    public PedidoService(
        IHubContext<NotificacionesHub> hubContext,
        AppDbContext db)
    {
        _hubContext = hubContext;
        _db = db;
    }

    public async Task ActualizarEstadoPedidoAsync(int pedidoId, string nuevoEstado)
    {
        var pedido = await _db.Pedidos.FindAsync(pedidoId);
        pedido!.Estado = nuevoEstado;
        await _db.SaveChangesAsync();

        // Notificar en tiempo real al cliente dueño del pedido
        await _hubContext.Clients
            .User(pedido.UsuarioId.ToString())
            .SendAsync("EstadoPedidoCambiado", new
            {
                PedidoId = pedidoId,
                Estado = nuevoEstado,
                Timestamp = DateTime.UtcNow
            });
    }
}

// También desde un controller
[ApiController]
[Route("api/pedidos")]
public class PedidosController : ControllerBase
{
    private readonly IHubContext<NotificacionesHub> _hub;

    [HttpPost("{id}/cancelar")]
    public async Task<IActionResult> Cancelar(int id)
    {
        // ... lógica de cancelación ...

        // Notificar a todos los admins
        await _hub.Clients.Group("admins")
            .SendAsync("PedidoCancelado", id);

        return NoContent();
    }
}
```

---

## Reconexión y manejo de errores

```tsx
// Frontend — manejo robusto de reconexión
const connection = new HubConnectionBuilder()
    .withUrl('/hubs/notificaciones', {
        accessTokenFactory: () => getToken()
    })
    .withAutomaticReconnect({
        // Tiempos de espera entre intentos: 0s, 2s, 10s, 30s
        nextRetryDelayInMilliseconds: (ctx) => {
            if (ctx.previousRetryCount < 4) {
                return [0, 2000, 10000, 30000][ctx.previousRetryCount];
            }
            return 30000; // Después del 4to intento, cada 30s
        }
    })
    .build();

// Estados de la conexión
connection.onreconnecting(error => {
    console.warn('Reconectando...', error);
    setStatus('reconectando');
});

connection.onreconnected(connectionId => {
    console.log('Reconectado con ID:', connectionId);
    setStatus('conectado');
    // Re-suscribirse a grupos si es necesario
    connection.invoke('UnirseASala', salaActual);
});

connection.onclose(error => {
    console.error('Conexión cerrada:', error);
    setStatus('desconectado');
    // Mostrar UI para reconexión manual si es necesario
});
```

---

## Scaled-out SignalR — múltiples instancias

En producción con múltiples instancias del servidor, las conexiones de un usuario pueden ir a instancias distintas. SignalR necesita un backplane para sincronizar:

```csharp
// ✅ Azure SignalR Service — backplane gestionado (recomendado en producción)
builder.Services.AddSignalR()
    .AddAzureSignalR(connectionString);
// Azure gestiona el backplane, la escala y la resiliencia

// ✅ Redis como backplane — alternativa self-hosted
builder.Services.AddSignalR()
    .AddStackExchangeRedis(connectionString, options =>
    {
        options.Configuration.ChannelPrefix = RedisChannel.Literal("MiApp");
    });
```

```
Sin backplane (❌ en múltiples instancias):
  Usuario A conectado a Instancia 1
  Servidor envía mensaje desde Instancia 2
  → Usuario A nunca lo recibe

Con backplane Redis (✅):
  Instancia 2 publica mensaje en Redis
  Instancia 1 suscrita a Redis recibe y reenvía a Usuario A
```

---

## Cuándo usar SignalR vs otras opciones

| Necesidad | Solución |
|-----------|----------|
| Chat, colaboración en tiempo real (bidireccional) | SignalR (WebSockets) |
| Notificaciones push del servidor al cliente | SignalR o Server-Sent Events |
| Dashboard con datos que se actualizan | SignalR o polling con React Query |
| Streaming de datos grandes | Server-Sent Events o gRPC streaming |
| Juego multijugador / latencia crítica < 50ms | WebSockets puro (sin SignalR) |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es SignalR y qué problema resuelve?**
> SignalR es una librería de ASP.NET Core que abstrae la comunicación en tiempo real. Maneja automáticamente WebSockets (preferido), Server-Sent Events y Long Polling como fallbacks. Resuelve el problema de que HTTP es un protocolo request-response — si el servidor necesita notificar al cliente sin que este pregunte, necesitas algo como SignalR.

**2. ¿Cuál es la diferencia entre WebSockets y SignalR?**
> WebSockets es el protocolo de bajo nivel (RFC 6455) para conexiones TCP persistentes y bidireccionales. SignalR es una abstracción encima que añade: selección automática de transporte, reconexión automática, grupos de clientes, autenticación integrada y RPC (invocar métodos por nombre). Para la mayoría de casos se usa SignalR; WebSockets puro solo para latencia crítica o control total.

**3. ¿Cómo envías un mensaje desde un Controller a los clientes conectados?**
> Inyectando `IHubContext<THub>` en el controller o servicio. Es el patrón más común en producción: una acción en el sistema (pedido cambia estado, nueva alerta) dispara una notificación a los clientes relevantes sin que ellos tengan que preguntar.

**4. ¿Cómo escala SignalR con múltiples instancias?**
> Con un backplane: Azure SignalR Service (gestionado, recomendado) o Redis. Sin backplane, dos instancias no comparten el estado de conexiones y los mensajes se pierden. Azure SignalR Service es la opción más simple en Azure — delega toda la gestión de conexiones al servicio.

**5. ¿Por qué el token JWT se pasa como query string en SignalR y no en el header?**
> Porque WebSockets no soporta headers personalizados durante el handshake inicial en los navegadores. SignalR soluciona esto enviando el token como `?access_token=...` en la URL. En el servidor se configura `OnMessageReceived` en JwtBearer para leer el token desde el query string cuando el path es un hub.
