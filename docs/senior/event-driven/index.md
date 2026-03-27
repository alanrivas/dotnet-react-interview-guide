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

## Outbox Pattern — Publicación Atómica de Eventos

El problema clásico: guardar en DB y publicar al broker son dos operaciones distintas. Si el proceso muere entre ambas, pierdes el evento.

```
❌ Sin Outbox Pattern:
  1. _context.SaveChangesAsync()   // ✅ Guardado
  2. Proceso muere aquí 💀
  3. _bus.Publish(OrderCreated)     // ❌ Nunca se ejecuta → evento perdido

✅ Con Outbox Pattern:
  1. Guardar entidad + evento en la MISMA transacción DB
  2. Un worker separado lee la tabla outbox y publica al broker
  3. Marca el evento como procesado
  → Nunca se pierden eventos (aunque el proceso muera)
```

```csharp
// 1. Tabla Outbox en la DB
public class OutboxMessage
{
    public Guid Id { get; set; }
    public string Type { get; set; }        // "OrderCreatedEvent"
    public string Payload { get; set; }     // JSON serializado
    public DateTime OccurredAt { get; set; }
    public DateTime? ProcessedAt { get; set; } // null = pendiente
}

// 2. Al guardar el aggregate, insertar también en Outbox (misma transacción)
public async Task GuardarAsync(Pedido pedido)
{
    _context.Pedidos.Update(pedido);

    foreach (var evento in pedido.DomainEvents)
    {
        _context.OutboxMessages.Add(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            Type = evento.GetType().Name,
            Payload = JsonSerializer.Serialize(evento),
            OccurredAt = DateTime.UtcNow
        });
    }

    await _context.SaveChangesAsync(); // Atómico: pedido + eventos
    pedido.ClearDomainEvents();
}

// 3. Background worker que publica al broker
public class OutboxProcessor : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var pendientes = await _context.OutboxMessages
                .Where(m => m.ProcessedAt == null)
                .OrderBy(m => m.OccurredAt)
                .Take(100)
                .ToListAsync(ct);

            foreach (var msg in pendientes)
            {
                await _bus.PublishAsync(msg.Type, msg.Payload);
                msg.ProcessedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(ct);
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }
}
```

---

## Diseño de Eventos — Versionado y Compatibilidad

Los eventos son contratos públicos. Una vez publicado un tipo de evento, otros servicios dependen de él. Cambiar su estructura puede romper consumidores.

```csharp
// ❌ Cambio breaking: renombrar una propiedad
public record OrderCreatedEvent(Guid OrderId, string UserEmail); // v1
public record OrderCreatedEvent(Guid OrderId, string Email);     // v2 — rompe consumidores de v1

// ✅ Estrategia: solo agregar propiedades, nunca eliminar ni renombrar
public record OrderCreatedEvent(
    Guid OrderId,
    string UserEmail,          // v1 — mantenida para compatibilidad
    string? Email = null,      // v2 — nueva, opcional, valor default
    int SchemaVersion = 2      // útil para routing en el consumidor
);

// ✅ Estrategia alternativa: versionar el tipo del evento
// Topic: "order.created.v1" → consumidores legacy
// Topic: "order.created.v2" → consumidores nuevos
// El productor publica en ambos durante el período de transición
```

### Reglas de diseño de eventos

```
✅ DO:
  - Nombres en pasado: OrderCreated, PaymentFailed, UserRegistered
  - Incluir siempre: eventId, occurredAt, correlationId
  - Payload autosuficiente: incluir los datos necesarios, no solo IDs
  - Ser backward compatible: solo agregar campos opcionales

❌ DON'T:
  - Eventos con nombres de comandos: ProcessOrder, SendEmail
  - Eventos con payload vacío que solo sirven como señal (usa solo el nombre)
  - Eventos que describen el estado completo de la entidad (muy grandes)
  - Cambiar el significado de una propiedad existente
```

---

## Dead Letter Queue (DLQ)

Cuando un consumidor falla repetidamente procesando un mensaje, ese mensaje va a la DLQ en lugar de bloquear la cola principal.

```
Flujo normal:
  Broker → Consumer → ACK ✅

Flujo con error:
  Broker → Consumer → Error 💥
  Broker → Retry 1  → Error 💥
  Broker → Retry 2  → Error 💥
  Broker → Retry 3  → Error 💥
  Broker → DLQ ← mensaje muerto (para análisis y reprocessing manual)
```

```csharp
// Con MassTransit — configuración de retry + DLQ
services.AddMassTransit(x =>
{
    x.AddConsumer<OrderCreatedConsumer>();

    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.ReceiveEndpoint("order-created", ep =>
        {
            ep.UseMessageRetry(r =>
            {
                r.Exponential(
                    retryLimit: 3,
                    minInterval: TimeSpan.FromSeconds(1),
                    maxInterval: TimeSpan.FromSeconds(30),
                    intervalDelta: TimeSpan.FromSeconds(5)
                );
            });

            ep.ConfigureConsumer<OrderCreatedConsumer>(ctx);
            // Si se superan los reintentos → va automáticamente a
            // queue: order-created_error (la DLQ de MassTransit)
        });
    });
});
```

---

## Consumer Groups y Partitioning (Kafka)

En Kafka, los consumer groups permiten escalar el procesamiento sin procesar el mismo mensaje dos veces.

```
Topic: order-events (4 particiones)

Consumer Group A (Inventario) — 2 instancias:
  Instancia 1 → Particiones 0, 1
  Instancia 2 → Particiones 2, 3

Consumer Group B (Notificaciones) — 1 instancia:
  Instancia 1 → Particiones 0, 1, 2, 3

→ Cada grupo recibe TODOS los mensajes
→ Dentro del mismo grupo, cada mensaje va a UNA sola instancia
→ Máximo paralelismo = número de particiones
```

```csharp
// Con Confluent.Kafka
var config = new ConsumerConfig
{
    BootstrapServers = "localhost:9092",
    GroupId = "inventario-service",     // Grupo único por servicio
    AutoOffsetReset = AutoOffsetReset.Earliest,
    EnableAutoCommit = false            // Control manual del commit (más seguro)
};

using var consumer = new ConsumerBuilder<string, string>(config).Build();
consumer.Subscribe("order-events");

while (true)
{
    var result = consumer.Consume(ct);
    try
    {
        await ProcessarAsync(result.Message.Value);
        consumer.Commit(result); // Confirmar solo después de procesar exitosamente
    }
    catch (Exception ex)
    {
        // Loguear y enviar a DLQ manual
        _logger.LogError(ex, "Error procesando {Key}", result.Message.Key);
        await _dlq.PublishAsync(result.Message.Value);
        consumer.Commit(result); // Commit igual para no bloquear la partición
    }
}
```

---

## Temas relacionados

- [Brokers de Mensajería](event-driven/brokers) — Kafka, RabbitMQ, Azure Service Bus en detalle
- [Patrones Event-Driven](event-driven/patrones) — Saga, Choreography vs Orchestration, Event Sourcing

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es el Outbox Pattern y por qué es necesario?**
> Garantiza que los eventos se publiquen atómicamente con los cambios en la base de datos. Sin él, existe el riesgo de guardar en DB sin publicar el evento (proceso muere entre ambas operaciones). Con Outbox, ambas operaciones van en la misma transacción DB; un worker separado publica los eventos pendientes al broker.

**2. ¿Cómo versionas los eventos en un sistema EDA?**
> Los eventos son contratos públicos — solo agrego propiedades opcionales, nunca elimino ni renombro. Para cambios mayores, versiono el tipo del evento (`order.created.v2`) y mantengo el v1 durante la transición. Siempre incluyo `schemaVersion` en el payload para que los consumidores puedan adaptar su comportamiento.

**3. ¿Qué es idempotencia en el contexto de consumidores de eventos?**
> Un consumidor idempotente puede recibir el mismo mensaje múltiples veces sin efectos secundarios adicionales. Se implementa con un Inbox Pattern: antes de procesar, verificar si el `messageId` ya está en la tabla `processed_messages`. Si está, ignorar el mensaje y responder ACK. Esto permite usar at-least-once delivery sin preocuparse por duplicados.

**4. ¿Cuándo usarías Kafka vs RabbitMQ?**
> Kafka para: alto throughput (millones de msg/s), replay de eventos, procesamiento de streams, log de auditoría permanente. RabbitMQ para: routing complejo, colas de prioridad, dead letter queues configurables, cuando el equipo ya lo conoce y el throughput no es extremo. Para la mayoría de microservicios, RabbitMQ es más simple y suficiente.
