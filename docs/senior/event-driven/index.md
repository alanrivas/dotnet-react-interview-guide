---
id: event-driven
title: Arquitectura Event-Driven
sidebar_position: 12
---

# Arquitectura Event-Driven

## ¿Qué es Event-Driven Architecture?

En una arquitectura event-driven (EDA), los componentes **no se llaman directamente entre sí**. En su lugar, emiten eventos que describen algo que ocurrió, y otros componentes reaccionan a esos eventos de forma independiente.

```
// ❌ Arquitectura acoplada (sincrónica directa)
class OrderService
{
    void CreateOrder(Order order)
    {
        _inventoryService.Reserve(order);      // llama directamente
        _notificationService.SendEmail(order); // llama directamente
        _loyaltyService.AddPoints(order);      // llama directamente
        // Si cualquiera falla → toda la operación falla
    }
}

// ✅ Arquitectura event-driven (desacoplada)
class OrderService
{
    void CreateOrder(Order order)
    {
        _repository.Save(order);
        _eventBus.Publish(new OrderCreatedEvent(order.Id, order.CustomerId, order.Total));
        // OrderService no sabe ni le importa quién reacciona al evento
    }
}

// En otro proceso/servicio:
class InventoryConsumer  : IConsumer<OrderCreatedEvent> { ... }
class NotificationConsumer : IConsumer<OrderCreatedEvent> { ... }
class LoyaltyConsumer    : IConsumer<OrderCreatedEvent> { ... }
```

### Ventajas

- **Desacoplamiento**: los productores no conocen a los consumidores. Puedes agregar nuevos consumidores sin tocar el productor.
- **Resiliencia**: si el servicio de notificaciones cae, los pedidos siguen creándose. Los eventos se procesan cuando el servicio se recupera.
- **Escalabilidad independiente**: cada consumidor escala por separado según su carga.
- **Audit log natural**: el stream de eventos es un registro inmutable de todo lo que ocurrió.

### Desventajas

- **Complejidad**: rastrear el flujo de un proceso requiere observabilidad (trazas distribuidas).
- **Eventual consistency**: los datos no son consistentes instantáneamente en todos los servicios.
- **Debugging más difícil**: un flujo que antes era una sola llamada ahora son 5 consumidores asincrónicos.
- **Garantías de entrega**: hay que decidir y gestionar at-least-once, at-most-once, exactly-once.

### ¿Cuándo usar EDA?

| Usar EDA | No usar EDA |
|----------|-------------|
| Múltiples consumidores del mismo evento | Un solo consumidor directo |
| Los consumidores pueden ser eventuales | Se necesita respuesta síncrona inmediata |
| Alto throughput y desacoplamiento son prioridad | Sistema simple con pocos componentes |
| Audit log y replay son necesarios | La consistencia inmediata es crítica |

---

## Conceptos Fundamentales

### Evento vs Comando vs Query

```
Comando (Command): "HazEstoCorrecto"         → puede rechazarse
  CreateOrderCommand, ReserveInventoryCommand

Evento (Event): "EstoYaOcurrió"             → inmutable, hecho del pasado
  OrderCreatedEvent, PaymentProcessedEvent

Query (Query): "DimeCuántoTienes"            → solo lectura, sin efectos
  GetOrderByIdQuery, ListOrdersQuery
```

```csharp
// Los eventos son inmutables — usa record para esto en C#
public record OrderCreatedEvent(
    Guid OrderId,
    Guid CustomerId,
    decimal Total,
    string Region,
    DateTimeOffset OccurredAt);

// Nunca modifiques un evento ya publicado — es un hecho histórico
// Si necesitas corregir un estado, publica un nuevo evento: OrderCancelledEvent
```

### Garantías de Entrega

| Garantía | Descripción | Consecuencia |
|----------|-------------|--------------|
| **At-most-once** | El mensaje llega 0 o 1 vez | Puede perderse. Rápido. |
| **At-least-once** | El mensaje llega 1 o más veces | Puede duplicarse. El más común. |
| **Exactly-once** | El mensaje llega exactamente 1 vez | Complejo, costoso, requiere coordinación. |

La mayoría de los sistemas usan **at-least-once + idempotencia en el consumidor** (Inbox Pattern) como solución práctica. "Exactly-once" real es muy difícil de garantizar a través de sistemas distribuidos.

---

