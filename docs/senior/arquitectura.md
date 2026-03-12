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
