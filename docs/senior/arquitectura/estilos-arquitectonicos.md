---
id: estilos-arquitectonicos
title: Estilos Arquitectónicos
sidebar_position: 2
---

# Estilos Arquitectónicos 🏛️

En este documento compararemos los principales estilos de arquitectura de software y cuándo usar cada uno.

---

## 1. Arquitectura Monolítica

### ¿Qué es?

Una aplicación monolítica es un bloque único donde toda la funcionalidad reside en un mismo proceso. Toda la lógica de negocio, acceso a datos, UI y comunicación externa están acopladas en una base de código.

```
┌─────────────────────────────────────────┐
│         MONOLITHIC APPLICATION          │
├─────────────────────────────────────────┤
│  Presentation (MVC, API Controllers)    │
│  Business Logic (Services, Handlers)    │
│  Data Access (Repositories, DbContext)  │
│  Cross-cutting (Auth, Logging, Caching) │
├─────────────────────────────────────────┤
│  ONE DATABASE                           │
└─────────────────────────────────────────┘
```

### Ventajas ✅

- **Simplicidad inicial** — Fácil de empezar y entender
- **Debugging** — Stack traces claros, una base de código
- **Performance** — Llamadas in-process, sin latencia de red
- **Transacciones ACID** — Control transaccional completo
- **Deploy simple** — Un único artefacto a desplegar
- **Testing integrado** — Tests end-to-end simples

### Desventajas ❌

- **Escalabilidad limitada** — Todo escala como unidad (CPU, memoria, I/O)
- **Acoplamiento** — Los cambios en un área afectan todo
- **Deploys arriesgados** — Un bug detiene toda la aplicación
- **Tech stack único** — Todos los componentes usan la misma tecnología
- **Equipos bloqueados** — Muchos desarrolladores en el mismo código
- **Complejidad creciente** — A medida que crece, se hace difícil de entender

### Cuándo usarlo

**Usa monolito cuando:**
- Estás en una **startup/MVP** (primeros 6-12 meses)
- El **dominio es simple** (menos de 10-15 entidades principales)
- El equipo es **pequeño** (menos de 5-10 personas)
- **Performance** es crítica (requieres baja latencia)
- No necesitas **escalabilidad diferenciada** de componentes

```csharp
// Estructura típica de monolito bien estructurado
src/
├── API/                    // Controllers
│   └── Controllers/
├── Application/           // Use Cases, DTOs
│   ├── Services/
│   ├── Handlers/
│   └── Mappings/
├── Domain/               // Entities, Value Objects
│   ├── Entities/
│   ├── ValueObjects/
│   └── Events/
├── Infrastructure/      // DB, External APIs
│   ├── Persistence/
│   └── ExternalServices/
└── Shared/              // Utilities, Constants
    └── Utils/
```

### Transición desde monolito

Cuando un monolito comienza a mostrar problemas:

```
1. ESTRUCTURA (6 meses)
   → Implementa separación en capas
   → Aplica SOLID + DDD
   → Usa Dependency Injection

2. IDENTIFICAR LÍMITES (1 año)
   → Identifica bounded contexts
   → Desacopla con eventos de dominio
   → Crea abstracciones claras

3. EXTRAER SERVICIOS (cuando sea evidente)
   → Extrae funcionalidad que escala diferente
   → Comienza con un servicio no crítico
   → Mantén transacciones con Saga pattern
```

---

## 2. Arquitectura Modular (Monolito Modular)

### ¿Qué es?

Un monolito que está **internally modularizado**. Sigue principios de DDD con Bounded Contexts implementados dentro de un mismo proceso, pero con límites claros.

```
┌──────────────────────────────────────────────────────┐
│        MODULAR MONOLITH                              │
├──────────────┬──────────────┬───────────────┬────────┤
│  Orders BC   │ Inventory BC │ Payments BC   │ Users  │
│              │              │               │ BC     │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌────┐ │
│ │Service   │ │ │Service   │ │ │Service   │ │ │Svc │ │
│ │Repository│ │ │Repository│ │ │Repository│ │ │Repo│ │
│ │Events    │ │ │Events    │ │ │Events    │ │ └────┘ │
│ └──────────┘ │ └──────────┘ │ └──────────┘ │        │
├──────────────┴──────────────┴───────────────┴────────┤
│        APPLICATION SERVICES (Cross-cutting)        │
├──────────────────────────────────────────────────────┤
│        SHARED KERNEL (Entities Comunes, Utils)      │
├──────────────────────────────────────────────────────┤
│  INTERNAL EVENT BUS (Comunicación entre Bounded   │
│              Contexts sin acoplamiento)            │
├──────────────────────────────────────────────────────┤
│        ONE DATABASE (O múltiples esquemas)          │
└──────────────────────────────────────────────────────┘
```

### Ventajas ✅

- **Preserva beneficios del monolito** — Una DB, transacciones ACID, deploy simple
- **Límites claros** — DDD Bounded Contexts formales
- **Preparado para evolucionar** — Fácil extraer un módulo a microservicio
- **Independencia de equipos** — Cada equipo "posee" un Bounded Context
- **Mejora mantenibilidad** — Código organizado y desacoplado
- **Testing aislado** — Tests por módulo sin afectar otros

### Desventajas ❌

- **Complejidad media** — Más que monolito simple, menos que microservicios
- **Una DB compartida** — Puede ser cuello de botella
- **Escalabilidad limitada** — Sigue siendo un único proceso
- **Conflictos en deploy** — Cambios en múltiples módulos requieren coordinación
- **Requiere disciplina** — Fácil romper límites si no se tiene cuidado

### Cuándo usarlo

**Usa arquitectura modular cuando:**
- Tu monolito **está creciendo** pero aún cabe en un proceso
- Tienes **múltiples dominios/equipos** pero no necesitas escalabilidad diferenciada
- Quieres **prepararte para microservicios** sin la complejidad todavía
- **Dominio es complejo**, necesitas DDD pero aún no quieres event-driven
- Necesitas **independencia de equipos** dentro de un proceso

```csharp
// Estructura de Monolito Modular con Bounded Contexts

src/
├── API/
│   ├── OrdersController
│   ├── InventoryController
│   └── PaymentController
├── OrdersModule/           // Bounded Context: Orders
│   ├── Domain/
│   │   ├── Order (Aggregate Root)
│   │   ├── OrderItem
│   │   └── OrderCreatedEvent
│   ├── Application/
│   │   ├── CreateOrderHandler
│   │   └── IOrderRepository (interface)
│   └── Infrastructure/
│       └── OrderRepository (implementación)
├── InventoryModule/        // Bounded Context: Inventory
│   ├── Domain/
│   ├── Application/
│   └── Infrastructure/
├── PaymentModule/          // Bounded Context: Payments
│   └── ...
├── SharedKernel/          // Código compartido
│   ├── DomainEvent (base class)
│   ├── Entity
│   ├── ValueObject
│   └── IEventBus
└── Infrastructure/        // Datos compartidos
    ├── EF DbContext
    └── EventBus (In-Process)
```

### Comunicación entre módulos

```csharp
// Desacoplamiento mediante eventos
namespace SharedKernel
{
    public abstract class DomainEvent
    {
        public DateTime OccurredAt { get; } = DateTime.UtcNow;
    }
}

namespace OrdersModule
{
    public record OrderCreatedEvent(
        Guid OrderId, 
        Guid CustomerId, 
        decimal Total
    ) : DomainEvent;
}

// En OrderService
public class CreateOrderCommandHandler
{
    private readonly IOrderRepository _repository;
    private readonly IEventBus _eventBus;

    public async Task Handle(CreateOrderCommand cmd)
    {
        var order = Order.CreateNew(cmd);
        await _repository.AddAsync(order);
        
        // Publicar evento — otros módulos reaccionan
        await _eventBus.PublishAsync(
            new OrderCreatedEvent(order.Id, order.CustomerId, order.Total)
        );
    }
}

// En InventoryModule
public class ReserveInventoryWhenOrderCreated
{
    private readonly IInventoryService _inventory;
    
    public async Task Handle(OrderCreatedEvent @event)
    {
        // No conoce OrderService, solo reacciona al evento
        await _inventory.ReserveForOrderAsync(@event.OrderId);
    }
}
```

---

## 3. Arquitectura de Microservicios

### ¿Qué es?

Cada servicio es un **proceso independiente, desacoplado, escalable por separado**, con su propia DB y responsabilidad.

```
┌────────────────────────────────────────────────────────────┐
│                    API GATEWAY                             │
└───┬──────────────────┬──────────────────┬─────────────┬────┘
    │                  │                  │             │
 ┌──▼──┐            ┌──▼──┐            ┌──▼──┐      ┌──▼────┐
 │Orders               │Inventory      │Payments   │Users    │
 │Service              │Service        │Service    │Service  │
 └──┬──┘               └──┬──┘          └──┬──┘     └──┬─────┘
    │  (port 5001)        │  (port 5002)  │ (5003)    │(5004)
┌───▼──┐            ┌──▼──┐            ┌──▼──┐       │
│Orders │           │Inven │            │Pay  │       │
│  DB   │           │ tory │            │ment │       │
│       │           │  DB  │            │ DB  │       │
└───────┘           └──────┘            └──┬──┘       │
                                           │          │
    ┌──────────────────────────────────────┼──────────┘
    │          MESSAGE BUS (RabbitMQ, Kafka, Service Bus)
    │
    └─► Event Stream: Order.Created, Inventory.Reserved, Payment.Completed
```

### Ventajas ✅

- **Escalabilidad independiente** — Cada servicio escala según su carga
- **Independencia tecnológica** — Cada equipo elige su stack
- **Deploy independiente** — Sin esperar a otros servicios
- **Equipos autónomos** — Ownership claro por servicio
- **Resiliencia** — Un servicio caído no derriba todo
- **Specialización** — Cada equipo es experta en su dominio

### Desventajas ❌

- **Complejidad operacional alta** — Múltiples procesos, logs, replicas
- **Consistencia eventual** — No tienes transacciones ACID
- **Network latency** — Llamadas entre servicios atraviesan la red
- **Testing complejo** — Tests de integración requieren orquestación
- **Debugging difícil** — Traces distribuidos, múltiples logs
- **Transacciones distribuidas** — Requiere Saga pattern
- **Data consistency** — Sincronizar datos entre servicios es reto

### Cuándo usarlo

**Usa microservicios SOLO cuando:**
- Tienes **múltiples dominios independientes**
- Necesitas **escalabilidad diferenciada** (algunos servicios reciben 10x más tráfico)
- Tienes **equipos grandes y distribuidos** (5-10+ personas por área)
- Aceptas la **complejidad operacional** (observabilidad, monitoring, debugging)
- Requieres **independencia de deploy** (cambios frecuentes sin sincronización)
- Tu infraestructura es **cloud-native** (Kubernetes, CI/CD maduros)

### Cuándo NO usarlo

**EVITA microservicios si:**
- Tu equipo tiene menos de 10 personas
- Es tu primera aplicación con este equipo
- No tienes infraestructura DevOps madura
- Tu dominio es simple o no tiene límites claros
- Necesitas transacciones ACID frecuentes
- Performance/latencia es crítica (APIs menores a 100ms)

```csharp
// Ejemplo: Orders Microservice
// src/OrdersService/Program.cs

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<CreateOrderHandler>();

builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<PaymentCompletedConsumer>();
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host("rabbitmq://localhost");
        cfg.ReceiveEndpoint("orders-service", e => e.ConfigureConsumer<PaymentCompletedConsumer>(context));
    });
});

var app = builder.Build();

app.MapPost("/api/orders", async (CreateOrderCommand cmd, CreateOrderHandler handler) =>
{
    var orderId = await handler.Handle(cmd);
    return Results.Created($"/api/orders/{orderId}", new { id = orderId });
});

app.Run();

// Cada microservicio tiene su propia DB
// Connection string solo del Orders Service
// builder.Configuration["ConnectionStrings:OrdersDb"]
```

---

## 4. Comparativa: ¿Cuál elegir?

| Aspecto | Monolito | Modular | Microservicios |
|--------|---------|---------|---|
| **Complejidad inicial** | ⭐ Baja | ⭐⭐ Media | ⭐⭐⭐⭐⭐ Alta |
| **Team size** | Menos de 5 | 5-20 | 20 o más |
| **Escalabilidad** | Todo o nada | Limitada | Diferenciada ✅ |
| **Performance** | ⭐⭐⭐⭐⭐ Excelente | ⭐⭐⭐⭐ Buena | ⭐⭐ Latencia red |
| **Consistencia** | ACID completa | ACID parcial | Eventual |
| **Deploy** | Simple | Mediano | Complicado |
| **Tech diversity** | Nula | Minimal | Alta ✅ |
| **Independencia de equipo** | Baja | Media | Alta ✅ |
| **Testing** | Fácil | Medio | Complejo |
| **Debugging** | Trivial | Mediano | Muy complejo |
| **DevOps necesario** | Bajo | Bajo | Crítico ✅ |
| **Observabilidad** | Simple | Simple | Compleja ✅ |

---

## 5. Marco de decisión

```
START: ¿Necesito escalar diferentes partes diferenciadamente?
  ├─ NO → ¿Tengo múltiples dominios independientes?
  │      ├─ NO → MONOLITO BIEN ESTRUCTURADO
  │      └─ SÍ → ¿Crecerá el equipo >10 personas?
  │             ├─ NO → MONOLITO MODULAR
  │             └─ SÍ → MONOLITO MODULAR (preparado para microservicios)
  └─ SÍ → ¿Mi equipo puede manejar complejidad operacional?
         ├─ NO → MONOLITO MODULAR + Load balancer
         └─ SÍ → MICROSERVICIOS
```

---

## 6. Transición recomendada

```
FASE 1: MVP (0-6 meses)
└─ Monolito simple
   - Estructura clara (folders lógicos)
   - Dependency Injection
   - Unit tests basic

FASE 2: Crecimiento (6-18 meses)
└─ Monolito modular
   - Implementa DDD Bounded Contexts
   - Eventos de dominio
   - Equipos asignados a módulos
   - Prueba el evento bus in-process

FASE 3: Escalado (18+ meses)
└─ Considera microservicios SI:
   - Equipos independientes quieren deploy propio
   - Componentes tienen patrones de carga diferentes
   - Necesitas heterogeneidad tecnológica

FASE 4: Madurez
└─ Observabilidad, CQRS, Event Sourcing
   - Métricas detalladas
   - Separar modelos de lectura/escritura si es necesario
```

---

## Resumen

✅ **Regla de Oro:**
> Comienza con un **monolito bien estructurado**. Siempre. Extrae microservicios solo cuando tengas problemas claros que la arquitectura actual no resuelve.

**La mayoría de aplicaciones son monolitos**, incluso empresas grandes mantienen componentes importantes como monolitos internos bien estructurados.
