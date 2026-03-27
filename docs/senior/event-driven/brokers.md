---
title: "📨 Kafka, RabbitMQ y Azure Service Bus"
sidebar_position: 1
---

# 📨 Kafka, RabbitMQ y Azure Service Bus

## Apache Kafka

### Arquitectura

```
                    ┌──────────────────────────────────────────────┐
                    │               KAFKA CLUSTER                   │
                    │                                               │
  Producer          │  Topic: "orders"                             │
  (orders-api) ───► │  ┌─────────────┐ ┌─────────────┐            │
                    │  │ Partition 0 │ │ Partition 1 │            │
                    │  │ [msg0][msg1]│ │ [msg0][msg1]│            │
                    │  │ [msg2][msg3]│ │ [msg2]      │            │
                    │  └─────────────┘ └─────────────┘            │
                    │       offset: 4       offset: 3              │
                    └──────────────────────────────────────────────┘
                              │               │
                    ┌─────────▼───────────────▼─────────┐
                    │         Consumer Group: "inventory"│
                    │  ┌──────────────┐ ┌──────────────┐│
                    │  │  Consumer 1  │ │  Consumer 2  ││
                    │  │ (Partition 0)│ │ (Partition 1)││
                    │  └──────────────┘ └──────────────┘│
                    └───────────────────────────────────┘
```

**Conceptos clave:**

- **Topic**: canal lógico donde se publican mensajes. Se divide en particiones.
- **Partition**: unidad de paralelismo. Los mensajes dentro de una partición están **ordenados**.
- **Offset**: posición de un mensaje en una partición. Los consumidores gestionan su propio offset.
- **Consumer Group**: grupo de consumidores que cooperan. Cada partición es leída por exactamente un consumidor del grupo.
- **Retention**: los mensajes no se borran al consumirse. Persisten N días/horas. Permiten **replay**.

### ¿Por qué Kafka ≠ Queue tradicional?

| | Queue tradicional (RabbitMQ) | Kafka |
|--|------------------------------|-------|
| Mensajes consumidos | Se borran | Persisten (retention configurable) |
| Replay de eventos | ❌ No | ✅ Sí — vuelve al offset que quieras |
| Orden | Por queue | Garantizado por partición |
| Throughput | Miles/seg | Millones/seg |
| Complejidad | Menor | Mayor |

### Kafka con Confluent.Kafka en .NET

```bash
dotnet add package Confluent.Kafka
```

```csharp
// Producer — publicar eventos
public class KafkaOrderEventPublisher
{
    private readonly IProducer<string, string> _producer;

    public KafkaOrderEventPublisher(IConfiguration config)
    {
        var producerConfig = new ProducerConfig
        {
            BootstrapServers = config["Kafka:BootstrapServers"],
            // Acks.All = esperar confirmación de todas las réplicas (máxima durabilidad)
            Acks = Acks.All,
            // Reintentos automáticos con backoff
            MessageSendMaxRetries = 3,
            RetryBackoffMs = 1000
        };

        _producer = new ProducerBuilder<string, string>(producerConfig).Build();
    }

    public async Task PublishAsync(OrderCreatedEvent evt)
    {
        var message = new Message<string, string>
        {
            // La KEY determina en qué partición va el mensaje.
            // Usar el CustomerId garantiza que los pedidos del mismo cliente
            // siempre van a la misma partición → orden garantizado por cliente.
            Key   = evt.CustomerId.ToString(),
            Value = JsonSerializer.Serialize(evt),
            Headers = new Headers
            {
                { "event-type", Encoding.UTF8.GetBytes("OrderCreated") },
                { "schema-version", Encoding.UTF8.GetBytes("1") }
            }
        };

        var result = await _producer.ProduceAsync("orders", message);
        Console.WriteLine($"Mensaje entregado a partition {result.Partition} offset {result.Offset}");
    }
}
```

```csharp
// Consumer — consumir eventos en un background service
public class KafkaOrderConsumerService : BackgroundService
{
    private readonly IConsumer<string, string> _consumer;
    private readonly ILogger<KafkaOrderConsumerService> _logger;

    public KafkaOrderConsumerService(IConfiguration config, ILogger<KafkaOrderConsumerService> logger)
    {
        _logger = logger;

        var consumerConfig = new ConsumerConfig
        {
            BootstrapServers   = config["Kafka:BootstrapServers"],
            GroupId            = "inventory-service",       // nombre del consumer group
            AutoOffsetReset    = AutoOffsetReset.Earliest,  // si no hay offset, empezar desde el principio
            EnableAutoCommit   = false  // commit manual para at-least-once con control
        };

        _consumer = new ConsumerBuilder<string, string>(consumerConfig).Build();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _consumer.Subscribe("orders");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Poll con timeout — no bloquea indefinidamente
                var consumeResult = _consumer.Consume(TimeSpan.FromSeconds(1));
                if (consumeResult is null) continue;

                var evt = JsonSerializer.Deserialize<OrderCreatedEvent>(consumeResult.Message.Value)!;
                _logger.LogInformation("Procesando OrderCreated {OrderId}", evt.OrderId);

                await ProcessOrderCreatedAsync(evt, stoppingToken);

                // Commit manual: solo confirmamos que procesamos ESTE mensaje
                _consumer.Commit(consumeResult);
            }
            catch (ConsumeException ex)
            {
                _logger.LogError(ex, "Error al consumir mensaje de Kafka");
            }
        }
    }

    private async Task ProcessOrderCreatedAsync(OrderCreatedEvent evt, CancellationToken ct)
    {
        // lógica de reserva de inventario...
        await Task.Delay(10, ct);
    }

    public override void Dispose()
    {
        _consumer.Close(); // Commit offsets y notificar al grupo que este consumer se va
        _consumer.Dispose();
        base.Dispose();
    }
}
```

---

## RabbitMQ

### Exchanges — el corazón del routing

```
Producer                Exchange              Queue               Consumer
  │                        │                    │                    │
  │──── publica msg ───────►│                    │                    │
  │   (routing key)         │──── binding ──────►│──── consume ──────►│
  │                         │
  │  Direct Exchange: routing key == binding key (exacto)
  │  Fanout Exchange: a TODOS los queues enlazados (broadcast)
  │  Topic Exchange: routing key con wildcards (* = una palabra, # = cero o más)
  │  Headers Exchange: basado en headers del mensaje (raro, más flexible)
```

```csharp
// Ejemplo con MassTransit — abstracción sobre RabbitMQ

// Instalación
// dotnet add package MassTransit.RabbitMQ

// Program.cs
builder.Services.AddMassTransit(x =>
{
    // Registrar consumidores
    x.AddConsumer<OrderCreatedConsumer>();
    x.AddConsumer<PaymentProcessedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host("rabbitmq://localhost", h =>
        {
            h.Username("guest");
            h.Password("guest");
        });

        // Dead Letter Queue: mensajes que fallan N veces van aquí
        cfg.ReceiveEndpoint("orders-created-queue", e =>
        {
            e.PrefetchCount = 10;  // max 10 mensajes en vuelo por consumidor
            e.UseMessageRetry(r =>
            {
                r.Interval(3, TimeSpan.FromSeconds(5)); // 3 reintentos, 5s entre cada uno
            });
            e.ConfigureConsumer<OrderCreatedConsumer>(context);
        });

        cfg.ConfigureEndpoints(context);
    });
});
```

```csharp
// Publisher
public class OrderService
{
    private readonly IPublishEndpoint _publishEndpoint;

    public async Task CreateOrderAsync(CreateOrderCommand cmd)
    {
        var order = new Order(cmd);
        await _repository.SaveAsync(order);

        // MassTransit se encarga del Exchange, routing key, serialización, etc.
        await _publishEndpoint.Publish(new OrderCreatedEvent(
            OrderId: order.Id,
            CustomerId: order.CustomerId,
            Total: order.Total,
            OccurredAt: DateTimeOffset.UtcNow));
    }
}

// Consumer
public class OrderCreatedConsumer : IConsumer<OrderCreatedEvent>
{
    private readonly IInventoryService _inventory;

    public async Task Consume(ConsumeContext<OrderCreatedEvent> context)
    {
        var evt = context.Message;

        await _inventory.ReserveItemsAsync(evt.OrderId);

        // Si lanzamos una excepción, MassTransit reintenta según la política configurada.
        // Si agotan los reintentos, el mensaje va al Dead Letter Queue.
    }
}
```

### Dead Letter Queue (DLQ) — mensajes que fallaron

```csharp
// Configurar DLQ con MassTransit
cfg.ReceiveEndpoint("inventory-queue", e =>
{
    e.UseMessageRetry(r =>
    {
        r.Intervals(
            TimeSpan.FromSeconds(5),
            TimeSpan.FromSeconds(15),
            TimeSpan.FromMinutes(1));  // backoff exponencial
    });
    
    // Después de todos los reintentos, va al DLQ para inspección manual
    // MassTransit crea automáticamente: inventory-queue_error
    e.ConfigureConsumer<InventoryConsumer>(context);
});
```

---

## Azure Service Bus

```csharp
// Instalación
// dotnet add package Azure.Messaging.ServiceBus

// Configuración básica
builder.Services.AddSingleton(provider =>
{
    var connectionString = builder.Configuration["ServiceBus:ConnectionString"];
    return new ServiceBusClient(connectionString);
});
```

```csharp
// Producer — enviar a un Topic (fan-out a múltiples subscripciones)
public class ServiceBusEventPublisher
{
    private readonly ServiceBusSender _sender;

    public ServiceBusEventPublisher(ServiceBusClient client)
    {
        _sender = client.CreateSender("orders-topic");
    }

    public async Task PublishAsync(OrderCreatedEvent evt)
    {
        var json = JsonSerializer.Serialize(evt);
        var message = new ServiceBusMessage(json)
        {
            MessageId       = evt.OrderId.ToString(),  // idempotencia: no procesar duplicados
            ContentType     = "application/json",
            Subject         = "OrderCreated",           // permite filtros en subscripciones
            SessionId       = evt.CustomerId.ToString(), // garantiza orden por cliente
            ScheduledEnqueueTime = DateTimeOffset.UtcNow.AddMinutes(5) // mensaje diferido
        };

        await _sender.SendMessageAsync(message);
    }
}
```

```csharp
// Consumer — procesar con sessions (orden garantizado por clave de sesión)
public class ServiceBusOrderConsumer : BackgroundService
{
    private readonly ServiceBusSessionProcessor _processor;

    public ServiceBusOrderConsumer(ServiceBusClient client, ILogger<ServiceBusOrderConsumer> logger)
    {
        _processor = client.CreateSessionProcessor("orders-topic", "inventory-subscription",
            new ServiceBusSessionProcessorOptions
            {
                MaxConcurrentSessions = 4,       // procesar 4 sesiones en paralelo
                MaxConcurrentCallsPerSession = 1  // dentro de cada sesión, en orden
            });

        _processor.ProcessMessageAsync += OnMessageAsync;
        _processor.ProcessErrorAsync   += OnErrorAsync;
    }

    private async Task OnMessageAsync(ProcessSessionMessageEventArgs args)
    {
        var evt = JsonSerializer.Deserialize<OrderCreatedEvent>(args.Message.Body)!;

        try
        {
            await ProcessAsync(evt);
            await args.CompleteMessageAsync(args.Message); // ack: borrar el mensaje
        }
        catch (BusinessException ex)
        {
            // Error de negocio — no reintentar, ir directamente al DLQ
            await args.DeadLetterMessageAsync(args.Message,
                deadLetterReason: "BusinessError",
                deadLetterErrorDescription: ex.Message);
        }
        catch (Exception)
        {
            // Error técnico — soltar el lock para que Service Bus lo reintente
            await args.AbandonMessageAsync(args.Message);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _processor.StartProcessingAsync(stoppingToken);
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
```

---

