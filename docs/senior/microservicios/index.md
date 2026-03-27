---
id: microservicios
title: Microservicios
sidebar_position: 3
---

# Microservicios 🔴

## Comunicación entre servicios

### Síncrona (HTTP/gRPC)

```csharp
// HttpClient con Typed Client
public class ProductoClient
{
    private readonly HttpClient _httpClient;

    public ProductoClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ProductoDto?> ObtenerAsync(int id)
    {
        return await _httpClient.GetFromJsonAsync<ProductoDto>($"productos/{id}");
    }
}

// Registro en DI con Polly (resilience)
builder.Services.AddHttpClient<ProductoClient>(client =>
{
    client.BaseAddress = new Uri("https://productos-service/api/");
})
.AddTransientHttpErrorPolicy(p =>
    p.WaitAndRetryAsync(3, retryAttempt =>
        TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)))) // exponential backoff
.AddTransientHttpErrorPolicy(p =>
    p.CircuitBreakerAsync(5, TimeSpan.FromSeconds(30))); // circuit breaker
```

### Asíncrona (Mensajería)

```csharp
// Con MassTransit + RabbitMQ / Azure Service Bus
// Publicar mensaje
public class PedidoService
{
    private readonly IPublishEndpoint _publishEndpoint;

    public async Task ConfirmarPedidoAsync(int pedidoId)
    {
        // No llama al servicio de inventario directamente
        // Publica un mensaje al bus
        await _publishEndpoint.Publish(new PedidoConfirmadoMessage
        {
            PedidoId = pedidoId,
            FechaConfirmacion = DateTime.UtcNow
        });
    }
}

// Consumidor en el servicio de Inventario
public class ReservarStockAlConfirmarPedido : IConsumer<PedidoConfirmadoMessage>
{
    public async Task Consume(ConsumeContext<PedidoConfirmadoMessage> context)
    {
        await _inventarioService.ReservarAsync(context.Message.PedidoId);
    }
}

// Registro
builder.Services.AddMassTransit(x =>
{
    x.AddConsumer<ReservarStockAlConfirmarPedido>();
    x.UsingRabbitMq((ctx, cfg) =>
    {
        cfg.Host("rabbitmq://localhost");
        cfg.ConfigureEndpoints(ctx);
    });
});
```

---

## Patrones de resiliencia

### Circuit Breaker

```
CERRADO → operaciones normales
   ↓ (X fallos)
ABIERTO → retorna error inmediato sin llamar al servicio
   ↓ (timeout)
SEMI-ABIERTO → permite algunas llamadas de prueba
   ↓ (éxito) → CERRADO
   ↓ (fallo) → ABIERTO
```

### Saga Pattern — transacciones distribuidas

```csharp
// Choreography Saga (eventos)
// Cada servicio escucha eventos y publica el siguiente

// Pedido creado → Inventario reserva stock
// Stock reservado → Pagos procesa el pago
// Pago procesado → Envío genera guía
// Si falla el pago → Inventario libera el stock (compensación)

// Orchestration Saga (coordinador central)
public class ProcesarPedidoSaga : MassTransitStateMachine<PedidoSagaState>
{
    public ProcesarPedidoSaga()
    {
        Initially(
            When(PedidoCreado)
                .Then(ctx => ctx.Saga.PedidoId = ctx.Message.PedidoId)
                .PublishAsync(ctx => ctx.Init<ReservarStockCommand>(new
                {
                    ctx.Message.PedidoId
                }))
                .TransitionTo(EsperandoStock)
        );

        During(EsperandoStock,
            When(StockReservado)
                .PublishAsync(ctx => ctx.Init<ProcesarPagoCommand>(new
                {
                    ctx.Saga.PedidoId
                }))
                .TransitionTo(EsperandoPago),
            When(StockInsuficiente)
                .PublishAsync(ctx => ctx.Init<CancelarPedidoCommand>(new
                {
                    ctx.Saga.PedidoId, Razon = "Stock insuficiente"
                }))
                .Finalize()
        );
    }
}
```

---

## Service Discovery y Health Checks

```csharp
// Health Checks
builder.Services.AddHealthChecks()
    .AddSqlServer(connectionString, name: "sqlserver")
    .AddRabbitMQ(rabbitUri, name: "rabbitmq")
    .AddUrlGroup(new Uri("https://external-api.com/health"), name: "external-api");

app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

// Liveness vs Readiness
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false // Solo chequea que el proceso está vivo
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});
```

---

## Contenerización con Docker

```dockerfile
# Multi-stage build para imagen más pequeña
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MiApp.API/MiApp.API.csproj", "MiApp.API/"]
RUN dotnet restore "MiApp.API/MiApp.API.csproj"
COPY . .
RUN dotnet publish "MiApp.API/MiApp.API.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "MiApp.API.dll"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "5000:8080"
    environment:
      - ConnectionStrings__Default=Server=db;Database=MiApp;User=sa;Password=Pass@word1
    depends_on:
      - db
      - rabbitmq

  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=Pass@word1

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "15672:15672"
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo manejas la consistencia de datos entre microservicios?**
> Con **eventual consistency** mediante eventos/mensajes. Cada servicio es dueño de sus datos. Para operaciones que requieren consistencia fuerte, uso el patrón **Saga** con compensaciones en caso de fallo.

**2. ¿Cómo evitas que un fallo en cascada colapse todos los servicios?**
> Con el patrón **Circuit Breaker** (Polly): si un servicio falla X veces seguidas, el circuito se abre y retorna error inmediato sin intentar la llamada, dando tiempo al servicio caído para recuperarse.

**3. ¿Qué es Idempotency y por qué es crucial en microservicios?**
> La capacidad de ejecutar la misma operación múltiples veces con el mismo resultado. Crucial porque los mensajes pueden entregarse más de una vez (at-least-once delivery). Se implementa con Idempotency Keys o verificando si la operación ya fue procesada.

**4. ¿Cómo manejas el versionado de contratos entre servicios?**
> Con **backward compatibility**: agregar campos opcionales, nunca quitar campos existentes. Usar versionado semántico. Para cambios breaking, correr dos versiones en paralelo durante un período de migración.

---

