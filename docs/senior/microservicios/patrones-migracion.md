---
title: "🔀 Strangler Fig, Dapr y Distributed Tracing"
sidebar_position: 2
---

# 🔀 Strangler Fig, Dapr y Distributed Tracing

## Migración de Monolito a Microservicios (Strangler Fig)

```
El error más común: intentar reescribir todo el monolito de una vez.
La estrategia correcta: Strangler Fig Pattern (Martin Fowler).

PRINCIPIO: el nuevo sistema "estrangula" gradualmente al viejo,
           como una higuera estranguladora envuelve a un árbol.

FASE 1: Monolito + API Gateway enfrente
   ─────────────────────────────────────
   Todos los requests ──→ API Gateway ──→ Monolito
   (El gateway no hace nada especial aún, solo proxy)

FASE 2: Extraer el primer servicio (el más independiente)
   ─────────────────────────────────────────────────────
   GET /api/productos/* ──→ API Gateway ──→ Nuevo Servicio Catálogo
   Todo lo demás ──→ API Gateway ──→ Monolito

   El monolito sigue sirviendo el 95% del tráfico.
   El nuevo servicio sirve solo /productos.

FASE 3: Extraer más servicios iterativamente
   ─────────────────────────────────────────
   Priorizar servicios que:
   - Tienen equipos claros dueños
   - Escalan de forma diferente al resto
   - Cambian con mucha frecuencia (alta deuda técnica)
   - Son claramente independientes (pocas dependencias)

FASE 4: El monolito eventualmente desaparece
```

### Cómo mantener consistencia durante la migración

```csharp
// Strangler Fig en la práctica: el gateway decide el destino
// Esto puede ser nginx, YARP (Yet Another Reverse Proxy), o Ocelot

// YARP — reverse proxy en C#
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// appsettings.json
{
  "ReverseProxy": {
    "Routes": {
      "catalogo-route": {
        "ClusterId": "catalogo-cluster",
        "Match": { "Path": "/api/productos/{**catch-all}" }
      },
      "monolito-route": {
        "ClusterId": "monolito-cluster",
        "Match": { "Path": "/{**catch-all}" }  // Todo lo demás al monolito
      }
    },
    "Clusters": {
      "catalogo-cluster": {
        "Destinations": {
          "catalogo/d1": { "Address": "https://catalogo-service/" }
        }
      },
      "monolito-cluster": {
        "Destinations": {
          "monolito/d1": { "Address": "https://monolito/" }
        }
      }
    }
  }
}
```

---

## Dapr — Distributed Application Runtime

Dapr abstrae los problemas comunes de microservicios (pub/sub, service invocation, state, secrets) detrás de una API HTTP local estándar. Tu servicio habla con un sidecar local y Dapr se encarga del transporte real.

```
Sin Dapr:
  Servicio A ──(Confluent.Kafka SDK)──→ Kafka
  Servicio A ──(StackExchange.Redis)──→ Redis

Con Dapr:
  Servicio A ──(HTTP POST localhost:3500)──→ Dapr Sidecar ──→ Kafka/Redis/ServiceBus
  (El servicio no sabe qué broker usa en producción)
```

```csharp
// Con Dapr SDK para .NET

// Publicar un evento (sin conocer el broker)
var daprClient = new DaprClientBuilder().Build();

await daprClient.PublishEventAsync(
    pubsubName: "messagebus",   // Nombre del componente en Dapr
    topicName:  "pedido-creado",
    data:       new PedidoCreadoEvent { PedidoId = pedido.Id }
);

// Consumir — solo un endpoint HTTP POST que Dapr invoca
[ApiController]
[Route("api")]
public class EventosController : ControllerBase
{
    [Topic("messagebus", "pedido-creado")]  // Atributo de Dapr
    [HttpPost("pedido-creado")]
    public async Task<IActionResult> PedidoCreado([FromBody] PedidoCreadoEvent evento)
    {
        await _inventario.ReservarAsync(evento.PedidoId);
        return Ok();
    }
}

// Invocación de servicios (con service discovery automático)
var producto = await daprClient.InvokeMethodAsync<ProductoDto>(
    httpMethod: HttpMethod.Get,
    appId:      "catalogo-service",  // Nombre del servicio en Dapr
    methodName: $"productos/{id}"
);
// Dapr resuelve "catalogo-service" → IP real, aplica retry/circuit-breaker
```

### Cuándo usar Dapr vs configuración directa

```
Usar Dapr cuando:
  ✅ El equipo cambia entre proveedores de infra (dev: Redis, prod: Azure Service Bus)
  ✅ Quieres observabilidad y resiliencia sin código adicional
  ✅ El team no tiene expertise profundo en Kafka/RabbitMQ

Usar SDKs directos cuando:
  ✅ Necesitas características avanzadas del broker (Kafka Streams, partitioning)
  ✅ Ya tienes expertise y no quieres otra capa de abstracción
  ✅ La latencia de la capa Dapr es inaceptable para tu caso de uso
```

---

## Distributed Tracing en microservicios

Cuando un request atraviesa múltiples servicios, necesitas poder seguir la traza completa. Ver sección de Observabilidad para la implementación, pero el concepto en microservicios:

```
Request del usuario
    │  TraceId: abc123
    ├──→ API Gateway  (SpanId: 0001)
    │       │
    │       ├──→ Servicio Pedidos  (SpanId: 0002, ParentSpanId: 0001)
    │       │       │
    │       │       ├──→ Servicio Inventario  (SpanId: 0003, ParentSpanId: 0002)
    │       │       │         └── 45ms
    │       │       │
    │       │       └──→ Servicio Pagos  (SpanId: 0004, ParentSpanId: 0002)
    │       │                 └── 120ms
    │       │
    │       └── 200ms total
    │
    └── Respuesta al usuario

En Jaeger o Zipkin puedes ver el "waterfall" completo del TraceId abc123
y pinpointear exactamente dónde se gastó el tiempo.
```

```csharp
// La propagación es automática con OpenTelemetry + HttpClient
// Solo necesitas que cada servicio tenga OTel configurado

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing =>
    {
        tracing
            .AddSource("MiApp.Pedidos")
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation() // Propaga el TraceId en los headers automáticamente
            .AddSqlClientInstrumentation()
            .AddOtlpExporter(o =>
            {
                o.Endpoint = new Uri("http://jaeger:4317");
            });
    });
```

---

## Preguntas adicionales de entrevista 🎯

**5. ¿Cuándo NO usarías microservicios?**
> Cuando el equipo es pequeño (< 5 personas), cuando el dominio no está bien entendido aún (necesitas iterar rápido), cuando el sistema no tiene requisitos de escala diferenciada por componente, o cuando no tienes infraestructura para manejar la complejidad operacional. Un monolito bien estructurado es mejor que microservicios prematuros.

**6. ¿Cómo harías la migración de un monolito a microservicios?**
> Con el **Strangler Fig Pattern**: primero poner un API Gateway frente al monolito, luego ir extrayendo servicios uno por uno empezando por los más independientes. El monolito sigue funcionando mientras se extrae. Nunca reescribir todo de una vez — demasiado riesgo.

**7. ¿Cuál es la diferencia entre Choreography y Orchestration en el patrón Saga?**
> En **Choreography** cada servicio publica eventos y otros reaccionan — no hay coordinador central, más desacoplado pero difícil de trazar el flujo completo. En **Orchestration** hay un coordinador (la Saga) que envía comandos explícitos a cada servicio — más fácil de entender y depurar, pero el coordinador es un componente adicional. Para flujos complejos con muchas compensaciones, prefiero orchestration porque puedo ver el estado de la saga en cualquier momento.

**8. ¿Cómo garantizas que un mensaje de RabbitMQ/Kafka no se procese dos veces?**
> Con el **Inbox Pattern**: antes de procesar el mensaje, verificar si su `MessageId` ya está en la tabla `processed_messages`. Si está, retornar OK sin procesar (idempotente). Si no está, insertar el `MessageId` y procesar en la misma transacción DB. Esto garantiza exactly-once processing a nivel de base de datos aunque el broker entregue at-least-once.
