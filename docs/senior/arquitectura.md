---
id: arquitectura
title: Arquitectura de Software
sidebar_position: 1
---

# Arquitectura de Software 🔴

## Estilos arquitectónicos

### Monolítico vs Microservicios vs Modular

```
MONOLÍTICO                    MODULAR                      MICROSERVICIOS
┌──────────────────┐          ┌──────────────────┐         ┌────┐ ┌────┐ ┌────┐
│   UI             │          │  ┌─────┐ ┌─────┐ │         │ UI │ │Auth│ │Prod│
│   Business Logic │    →     │  │Prod │ │Auth │ │   →     └──┬─┘ └──┬─┘ └──┬─┘
│   Data Access    │          │  └─────┘ └─────┘ │            │      │      │
│   Database       │          │  Shared Kernel   │         ┌──┴──────┴──────┴──┐
└──────────────────┘          └──────────────────┘         │   Message Bus      │
                                                           └────────────────────┘
```

| Criterio | Monolito | Microservicios |
|----------|---------|---------------|
| Complejidad inicial | Baja | Alta |
| Escalabilidad | Todo o nada | Por servicio |
| Deploy | Simple | Complejo (orquestación) |
| Comunicación | In-process | Red (latencia, fallos) |
| Team size | Equipos pequeños | Equipos grandes |
| Tecnología | Uniforme | Heterogénea |

:::tip Cuándo usar microservicios
No comiences con microservicios. Empieza con un **monolito bien estructurado** (modular), y extrae servicios cuando tengas necesidades claras de escalado diferenciado o equipos independientes.
:::

---

## Layered Architecture (N-Layer)

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │  Controllers, Views, DTOs
├─────────────────────────────────────────┤
│           Application Layer             │  Services, Use Cases, Commands/Queries
├─────────────────────────────────────────┤
│            Domain Layer                 │  Entities, Value Objects, Domain Events
├─────────────────────────────────────────┤
│         Infrastructure Layer            │  Repos, DB, External APIs, Email
└─────────────────────────────────────────┘
```

```csharp
// Ejemplo de separación por proyecto en .NET
// MiApp.API          → Controllers, Program.cs
// MiApp.Application  → Services, DTOs, Interfaces
// MiApp.Domain       → Entities, Value Objects, Interfaces de repo
// MiApp.Infrastructure → DbContext, Repos concretos, Emails
```

---

## Dependency Rule

La regla fundamental en arquitecturas en capas: **las dependencias solo apuntan hacia adentro** (hacia el dominio).

```
External (DB, Email)
    ↓ implementa
Infrastructure
    ↓ depende de interfaces
Application  
    ↓ depende de interfaces
Domain  ← núcleo, sin dependencias externas
```

---

## Event-Driven Architecture

```csharp
// Domain Events — comunicación desacoplada
public record PedidoCreadoEvent(int PedidoId, string ClienteEmail, decimal Total);

// Publisher
public class PedidoService
{
    private readonly IPublisher _publisher;

    public async Task<Pedido> CrearAsync(CrearPedidoDto dto)
    {
        var pedido = new Pedido(dto);
        await _repository.GuardarAsync(pedido);
        
        // Publicar evento — los handlers se ejecutan de forma desacoplada
        await _publisher.Publish(new PedidoCreadoEvent(
            pedido.Id, dto.ClienteEmail, pedido.Total));
        
        return pedido;
    }
}

// Handlers (pueden estar en distintos servicios)
public class EnviarEmailAlCrearPedido : INotificationHandler<PedidoCreadoEvent>
{
    public async Task Handle(PedidoCreadoEvent evt, CancellationToken ct)
    {
        await _emailService.EnviarConfirmacionAsync(evt.ClienteEmail, evt.PedidoId);
    }
}

public class ActualizarInventarioAlCrearPedido : INotificationHandler<PedidoCreadoEvent>
{
    public async Task Handle(PedidoCreadoEvent evt, CancellationToken ct)
    {
        await _inventarioService.ReservarAsync(evt.PedidoId);
    }
}
```

---

## CQRS (Command Query Responsibility Segregation)

```csharp
// Separar operaciones de LECTURA y ESCRITURA

// COMMAND — cambia el estado (no retorna datos)
public record CrearProductoCommand(string Nombre, decimal Precio, int CategoriaId);

public class CrearProductoHandler : IRequestHandler<CrearProductoCommand, int>
{
    public async Task<int> Handle(CrearProductoCommand cmd, CancellationToken ct)
    {
        var producto = new Producto(cmd.Nombre, cmd.Precio, cmd.CategoriaId);
        await _writeRepo.GuardarAsync(producto);
        return producto.Id;
    }
}

// QUERY — solo lee, sin efectos secundarios
public record ObtenerProductosQuery(string? Categoria, int Pagina);

public class ObtenerProductosHandler : IRequestHandler<ObtenerProductosQuery, PagedResult<ProductoDto>>
{
    public async Task<PagedResult<ProductoDto>> Handle(ObtenerProductosQuery q, CancellationToken ct)
    {
        // Puede usar una DB de lectura optimizada (projections, vistas materializadas)
        return await _readRepo.BuscarAsync(q.Categoria, q.Pagina);
    }
}

// Controller usa MediatR para enviar commands/queries
[HttpPost]
public async Task<IActionResult> Crear([FromBody] CrearProductoCommand cmd)
{
    var id = await _mediator.Send(cmd);
    return CreatedAtAction(nameof(GetById), new { id }, null);
}
```

---

## API Gateway Pattern

```
Clientes (Web, Mobile, Third-party)
          ↓
    ┌─────────────┐
    │  API Gateway │  ← Punto único de entrada
    │  - Auth      │    - Rate limiting
    │  - Routing   │    - Load balancing
    │  - SSL       │    - Logging centralizado
    └──────────────┘
     ↓      ↓      ↓
  ┌────┐ ┌────┐ ┌──────┐
  │Auth│ │Prod│ │Orders│  ← Microservicios internos
  └────┘ └────┘ └──────┘
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo decides cuándo partir un monolito en microservicios?**
> Cuando hay necesidades claras: equipos independientes, escalado diferenciado, deployments independientes frecuentes. Los signos de alarma son: el deploy de una feature pequeña requiere coordinar muchos equipos, o una parte del sistema necesita escalar 10x más que el resto.

**2. ¿Qué es Event Sourcing y en qué se diferencia de CQRS?**
> **Event Sourcing**: almacenar el estado como una secuencia de eventos en vez del estado actual. Puedes reconstruir cualquier estado histórico. **CQRS**: separar reads de writes. Son complementarios pero independientes.

**3. ¿Cuáles son los trade-offs de una arquitectura orientada a eventos?**
> Ventajas: desacoplamiento, escalabilidad, auditoría natural. Desventajas: eventual consistency (no immediate), debugging complejo (flujo no lineal), garantías de ordering más difíciles.

**4. ¿Qué es el CAP Theorem?**
> En un sistema distribuido, solo puedes garantizar 2 de 3: **Consistency** (todos ven el mismo dato), **Availability** (siempre responde), **Partition tolerance** (funciona con fallos de red). Como P es inevitable, eliges entre CP (SQL databases) o AP (NoSQL como Cassandra).

---

## Event Sourcing

Event Sourcing es un patrón donde el **estado no se almacena directamente** — solo los eventos que lo produjeron. El estado actual se calcula reproduciendo todos los eventos desde el inicio (o desde un snapshot).

```
PERSISTENCIA TRADICIONAL:
  Estado actual en la DB:
  Pedido { Id: 1, Estado: "Enviado", Total: 150 }
  → Si quiero saber cuándo se confirmó o quién lo aprobó, no hay forma de saberlo

EVENT SOURCING:
  Secuencia de eventos en el Event Store:
  [PedidoCreado { Total: 150, ts: 10:00 }]
  [PedidoConfirmado { AprobadoPor: "Ana", ts: 10:05 }]
  [PedidoEnviado { NumeroGuia: "DHL-123", ts: 11:30 }]

  Estado actual = reproducir todos los eventos
  Historia completa = auditoria gratuita
  Puedes "viajar en el tiempo" a cualquier estado histórico
```

### Implementación en C#

```csharp
// Evento base
public abstract record DomainEvent
{
    public Guid EventId    { get; } = Guid.NewGuid();
    public DateTime OccurredAt { get; } = DateTime.UtcNow;
}

// Eventos de la raíz de agregado
public record PedidoCreadoEvent(int PedidoId, string ClienteEmail, decimal Total) : DomainEvent;
public record PedidoConfirmadoEvent(int PedidoId, string AprobadoPor) : DomainEvent;
public record PedidoCanceladoEvent(int PedidoId, string Motivo) : DomainEvent;

// El agregado aplica eventos y reconstruye su propio estado
public class Pedido
{
    public int Id       { get; private set; }
    public string Estado { get; private set; } = "Nuevo";
    public decimal Total { get; private set; }

    private readonly List<DomainEvent> _eventsPendientes = [];
    public IReadOnlyList<DomainEvent> EventsPendientes => _eventsPendientes;

    // Reconstruir desde eventos históricos
    public static Pedido Reconstruct(IEnumerable<DomainEvent> events)
    {
        var pedido = new Pedido();
        foreach (var e in events)
            pedido.Apply(e);
        return pedido;
    }

    // Command — lógica de negocio + emitir evento
    public void Confirmar(string aprobadoPor)
    {
        if (Estado != "Nuevo")
            throw new InvalidOperationException($"No se puede confirmar un pedido en estado {Estado}");

        var evt = new PedidoConfirmadoEvent(Id, aprobadoPor);
        Apply(evt);
        _eventsPendientes.Add(evt);
    }

    // Apply — solo cambia el estado, sin validaciones de negocio
    private void Apply(DomainEvent e)
    {
        switch (e)
        {
            case PedidoCreadoEvent c:
                Id = c.PedidoId; Total = c.Total; Estado = "Nuevo";
                break;
            case PedidoConfirmadoEvent:
                Estado = "Confirmado";
                break;
            case PedidoCanceladoEvent:
                Estado = "Cancelado";
                break;
        }
    }
}

// Event Store — el repositorio guarda y carga eventos, no estado
public class PedidoRepository
{
    private readonly AppDbContext _db;

    public async Task GuardarAsync(Pedido pedido)
    {
        foreach (var evento in pedido.EventsPendientes)
        {
            _db.EventStore.Add(new EventRecord
            {
                AggregateId   = pedido.Id,
                AggregateType = "Pedido",
                EventType     = evento.GetType().Name,
                Payload       = JsonSerializer.Serialize(evento, evento.GetType()),
                OccurredAt    = evento.OccurredAt,
                Version       = ++_currentVersion
            });
        }
        await _db.SaveChangesAsync();
    }

    public async Task<Pedido> GetByIdAsync(int pedidoId)
    {
        var eventRecords = await _db.EventStore
            .Where(e => e.AggregateId == pedidoId && e.AggregateType == "Pedido")
            .OrderBy(e => e.Version)
            .ToListAsync();

        var events = eventRecords.Select(r => DeserializeEvent(r));
        return Pedido.Reconstruct(events);
    }
}
```

### Snapshots para optimizar la reconstrucción

```csharp
// Problema: reproducir 10.000 eventos para reconstruir el estado es lento
// Solución: guardar un snapshot cada N eventos

public async Task<Pedido> GetByIdAsync(int pedidoId)
{
    // 1. Buscar el snapshot más reciente
    var snapshot = await _db.Snapshots
        .Where(s => s.AggregateId == pedidoId)
        .OrderByDescending(s => s.Version)
        .FirstOrDefaultAsync();

    Pedido pedido;
    int desdeVersion;

    if (snapshot is not null)
    {
        // 2. Restaurar desde snapshot
        pedido = JsonSerializer.Deserialize<Pedido>(snapshot.Data)!;
        desdeVersion = snapshot.Version;
    }
    else
    {
        pedido = new Pedido();
        desdeVersion = 0;
    }

    // 3. Aplicar solo los eventos POSTERIORES al snapshot
    var eventosNuevos = await _db.EventStore
        .Where(e => e.AggregateId == pedidoId && e.Version > desdeVersion)
        .OrderBy(e => e.Version)
        .ToListAsync();

    foreach (var record in eventosNuevos)
        pedido.Apply(DeserializeEvent(record));

    return pedido;
}
```

### Event Sourcing vs CQRS — cómo se complementan

```
Sin CQRS, consultar datos de Event Sourcing es difícil:
  "Dame todos los pedidos confirmados hoy" → reproducir TODOS los eventos → lento

Con CQRS + Projections:
  Al guardar un evento → también actualizar una Read Model (tabla desnormalizada)
  La Read Model es solo para lecturas, siempre actualizada

  PedidoConfirmadoEvent guardado en Event Store
      ↓ (síncrono o asíncrono via bus)
  Handler actualiza tabla Lectura_Pedidos:
  { PedidoId, Estado: "Confirmado", FechaConfirmacion, NombreCliente }

  Query sobre Lectura_Pedidos → instantáneo, sin reproducir eventos
```

---

## Arquitectura Hexagonal (Ports & Adapters)

También llamada "Clean Architecture" en la variante de Uncle Bob. El principio es el mismo: el **dominio es el centro**, todo lo externo (DB, HTTP, UI, mensajes) se conecta a través de **puertos (interfaces) y adaptadores (implementaciones)**.

```
                    ┌─────────────────────────────────┐
                    │           DOMINIO                │
                    │  (Entities, Use Cases, Policies) │
                    │    sin dependencias externas     │
                    └──────────┬──────────┬────────────┘
                               │          │
              ┌────────────────┘          └────────────────┐
              │  Puerto Entrada                Puerto Salida│
              │  (IUseCase interface)     (IRepository int) │
              ↓                                             ↓
  ┌───────────────────┐                      ┌──────────────────────┐
  │  Adapter Entrada  │                      │  Adapter Salida      │
  │  - REST Controller│                      │  - SQL Repository    │
  │  - gRPC Handler   │                      │  - Redis Cache       │
  │  - Message Consumer│                     │  - HTTP Client       │
  └───────────────────┘                      └──────────────────────┘
```

```csharp
// Puerto de entrada (definido en el dominio)
public interface ICrearPedidoUseCase
{
    Task<PedidoId> ExecuteAsync(CrearPedidoInput input);
}

// Puerto de salida (definido en el dominio)
public interface IPedidoRepository
{
    Task<Pedido?> GetByIdAsync(PedidoId id);
    Task SaveAsync(Pedido pedido);
}

public interface IEmailNotifier
{
    Task NotificarPedidoCreadoAsync(string email, PedidoId pedidoId);
}

// Caso de uso (dominio puro, sin frameworks)
public class CrearPedidoUseCase : ICrearPedidoUseCase
{
    private readonly IPedidoRepository _repo;
    private readonly IEmailNotifier _notifier;

    public async Task<PedidoId> ExecuteAsync(CrearPedidoInput input)
    {
        var pedido = Pedido.Crear(input.ClienteId, input.Items); // lógica de dominio
        await _repo.SaveAsync(pedido);
        await _notifier.NotificarPedidoCreadoAsync(input.Email, pedido.Id);
        return pedido.Id;
    }
}

// Adaptador de entrada (HTTP — framework ASP.NET Core)
[ApiController, Route("api/pedidos")]
public class PedidosController : ControllerBase
{
    private readonly ICrearPedidoUseCase _crearPedido;

    [HttpPost]
    public async Task<IActionResult> Crear([FromBody] CrearPedidoRequest request)
    {
        var input = new CrearPedidoInput(request.ClienteId, request.Items, request.Email);
        var id = await _crearPedido.ExecuteAsync(input);
        return CreatedAtAction(nameof(GetById), new { id }, null);
    }
}

// Adaptador de salida (EF Core)
public class EfPedidoRepository : IPedidoRepository
{
    public async Task SaveAsync(Pedido pedido)
        => await _context.Pedidos.AddAsync(pedido);
}

// Adaptador de salida (SendGrid)
public class SendGridEmailNotifier : IEmailNotifier
{
    public async Task NotificarPedidoCreadoAsync(string email, PedidoId pedidoId)
        => await _sendGrid.SendEmailAsync(email, $"Pedido {pedidoId} creado");
}
```

**La clave**: el dominio (`CrearPedidoUseCase`) **no sabe** que existe ASP.NET Core, EF Core ni SendGrid. Si mañana cambias de EF Core a Dapper, o de SendGrid a Resend, solo reescribes el adaptador — el dominio no cambia.

---

## Preguntas adicionales de entrevista 🎯

**5. ¿Cuándo usarías Event Sourcing y cuándo NO?**
> Usar cuando: necesitas auditoría completa (finanzas, compliance), necesitas reproducir el estado en cualquier punto del tiempo, o el dominio es naturalmente orientado a eventos (pedidos, reservas, transacciones). **No usar** cuando: el dominio es CRUD simple sin historia importante, el equipo no tiene experiencia (curva de aprendizaje alta), o las queries son complejas y frecuentes sin un buen modelo de proyecciones.

**6. ¿Cuál es la diferencia entre Arquitectura Hexagonal y N-Layer?**
> En **N-Layer**: la capa superior depende de la inferior (Presentation → Application → Domain → Infrastructure). El problema: el Domain puede terminar dependiendo de Infrastructure para cosas como repositorios. En **Hexagonal**: el Domain es el centro absoluto y define puertos (interfaces). Infrastructure **implementa** esos puertos. Las dependencias siempre apuntan hacia el dominio — Infrastructure depende del Domain, nunca al revés. La diferencia es sutil pero crucial para testabilidad.

**7. ¿Cómo testearías un sistema con Event Sourcing?**
> Los tests unitarios son naturales: `Given [eventos anteriores] When [comando] Then [nuevos eventos emitidos]`. No necesitas mocks de DB. Los tests de integración verifican que el Event Store serializa/deserializa correctamente y que las proyecciones se actualizan. Los tests de snapshot verifican que la reconstrucción desde snapshot + eventos nuevos da el mismo resultado que reconstruir desde todos los eventos.

**8. ¿Qué es el Aggregate Root en DDD y por qué importa?**
> Es la única entidad del agregado accesible desde fuera. Todas las modificaciones al agregado pasan por el Aggregate Root, que garantiza las invariantes del dominio. Ejemplo: `Pedido` es el Aggregate Root, `LineaDePedido` es interna. No puedes modificar una `LineaDePedido` directamente — debes hacerlo a través de `pedido.AgregarItem(...)`, que puede validar el total máximo del pedido, stock disponible, etc.
