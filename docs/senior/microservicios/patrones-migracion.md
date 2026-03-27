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

---

## Branch by Abstraction

Cuando no puedes usar Strangler Fig (el módulo está demasiado acoplado internamente), Branch by Abstraction permite reemplazar una implementación gradualmente sin ramificar en git.

```
PASO 1: Crear una abstracción sobre el código existente
  // Antes:
  class OrderService {
    void Process(Order o) { _oldPaymentProcessor.Charge(o.Total); }
  }

  // Después:
  interface IPaymentProcessor { Task ChargeAsync(decimal amount); }
  class LegacyPaymentProcessor : IPaymentProcessor { ... }  // código viejo

PASO 2: Hacer que todo el código use la abstracción
  class OrderService {
    OrderService(IPaymentProcessor processor) { ... }  // DI
  }

PASO 3: Crear la nueva implementación en paralelo
  class StripePaymentProcessor : IPaymentProcessor { ... }  // nueva

PASO 4: Feature flag para elegir la implementación
  // appsettings.json
  { "Features": { "UseStripePayments": false } }

  // DI
  if (config["Features:UseStripePayments"] == "true")
    services.AddScoped<IPaymentProcessor, StripePaymentProcessor>();
  else
    services.AddScoped<IPaymentProcessor, LegacyPaymentProcessor>();

PASO 5: Cuando la nueva implementación está validada → eliminar la vieja y el flag
```

---

## Backend for Frontend (BFF)

En lugar de un único API Gateway genérico, el patrón BFF crea un backend dedicado por tipo de cliente.

```
Sin BFF (API Gateway genérico):
  Mobile App  ─────────┐
  Web SPA     ──────── API Gateway ──── Microservicios
  Smart TV    ─────────┘
  (Un gateway sirve a todos — difícil optimizar para cada cliente)

Con BFF:
  Mobile App  ──── BFF Mobile ───┐
  Web SPA     ──── BFF Web   ────┼──── Microservicios
  Smart TV    ──── BFF TV    ───┘
  (Cada BFF agrega y formatea los datos según las necesidades de su cliente)
```

```csharp
// BFF Web — agrega datos de múltiples servicios para la UI
[ApiController]
[Route("api/dashboard")]
public class DashboardBffController : ControllerBase
{
    private readonly IHttpClientFactory _http;

    [HttpGet("{userId}")]
    public async Task<DashboardViewModel> GetDashboard(Guid userId)
    {
        // Llamadas en paralelo a múltiples microservicios
        var pedidosTask    = GetPedidosAsync(userId);
        var perfilTask     = GetPerfilAsync(userId);
        var notifTask      = GetNotificacionesAsync(userId);

        await Task.WhenAll(pedidosTask, perfilTask, notifTask);

        // Agrega y formatea exactamente lo que necesita la UI
        return new DashboardViewModel
        {
            NombreUsuario     = (await perfilTask).Nombre,
            UltimosPedidos    = (await pedidosTask).Take(5),
            NotificacionesNuevas = (await notifTask).Count(n => !n.Leida)
        };
    }
}
```

**Cuándo usar BFF:**
- Clientes con necesidades muy diferentes (mobile vs web vs third-party API)
- Quieres que cada equipo de frontend sea dueño de su BFF
- Necesitas autenticación o autorización diferente por tipo de cliente

---

## Database per Service — Migración

Uno de los principios más importantes de microservicios: cada servicio tiene su propia base de datos. Pero ¿cómo llegamos ahí si arrancamos con una DB compartida?

```
Estado inicial (monolito):
  Servicio Pedidos  ───┐
  Servicio Catálogo ───┼──── DB única (esquema compartido)
  Servicio Usuarios ───┘

Estado objetivo:
  Servicio Pedidos  ──── DB Pedidos  (SQL Server)
  Servicio Catálogo ──── DB Catálogo (PostgreSQL)
  Servicio Usuarios ──── DB Usuarios (SQL Server)
```

```
Estrategia de migración (paso a paso):

1. IDENTIFICAR LÍMITES
   ¿Qué tablas pertenecen a cada servicio?
   ¿Qué JOINs entre ellas son cross-service?
   Esos JOINs son los puntos de dolor → deben convertirse en llamadas API o eventos.

2. SEPARAR LÓGICAMENTE PRIMERO
   Antes de separar la DB, separar el código.
   El Servicio Pedidos solo toca las tablas de Pedidos.
   Prohibir JOINs cross-service en code review.

3. CREAR LA DB SEPARADA CON REPLICACIÓN
   La nueva DB del servicio empieza recibiendo un feed de cambios desde la DB original.
   Cambiar la config del servicio para leer de la nueva DB.
   Validar que los datos son correctos.

4. CUTOVER
   Dirigir el tráfico de escritura a la nueva DB.
   Mantener la replicación inversa durante el período de seguridad.
   Una vez confirmado, cortar la replicación y limpiar la DB original.

Herramientas:
  - SQL Server: Change Data Capture (CDC) + replicación
  - Debezium: CDC open-source para cualquier DB
  - Azure Data Migration Service: para migraciones a Azure
```

---

## Service Mesh — Istio / Linkerd

Un Service Mesh desplaza la lógica de comunicación entre servicios (retry, circuit breaker, mTLS, observabilidad) fuera del código y a la infraestructura.

```
Sin Service Mesh:
  Servicio A (código con Polly retry + logging manual + mTLS manual)
      ──────→ Servicio B

Con Service Mesh (Istio/Linkerd):
  Servicio A (código limpio, sin retry ni TLS)
      ──→ Sidecar Proxy (Envoy) ──────→ Sidecar Proxy ──→ Servicio B
           ↑ retry, circuit breaker,      ↑ mTLS automático
             rate limiting, tracing
```

```
¿Qué hace el Service Mesh automáticamente?
  ✅ mTLS entre servicios (encriptación + autenticación mutua)
  ✅ Circuit breaker configurable sin código
  ✅ Retry con backoff exponencial
  ✅ Traffic splitting (canary deployments: 10% → nuevo, 90% → viejo)
  ✅ Distributed tracing automático (sin instrumentar el código)
  ✅ Métricas de RED entre servicios (latencia, error rate, throughput)

¿Cuándo NO usar Service Mesh?
  ❌ Equipos pequeños sin expertise en Kubernetes
  ❌ Cuando la complejidad operacional supera el beneficio
  ❌ Si ya tienes Polly para resiliencia y OpenTelemetry para observabilidad
  → Empieza simple; agrega Service Mesh cuando el pain lo justifique
```

---

## Preguntas adicionales de entrevista 🎯

**9. ¿Cómo diseñarías el manejo de autenticación en microservicios?**
> API Gateway valida el JWT en el borde — los microservicios internos confían en el gateway y reciben el token ya validado (o los claims vía header). Esto evita que cada microservicio valide el JWT independientemente. Los microservicios internos pueden comunicarse con mTLS (Service Mesh) sin JWT. Para comunicación servicio-a-servicio fuera del Service Mesh, uso Client Credentials flow de OAuth 2.0.

**10. ¿Qué es el patrón Sidecar y para qué sirve?**
> El Sidecar es un proceso secundario que corre junto al servicio principal (en el mismo pod en Kubernetes) y maneja concerns transversales: proxy de red, colección de métricas, gestión de configuración, autenticación. Ejemplos: Envoy proxy en Istio (red), Datadog Agent (métricas), Vault Agent (secrets). El servicio principal no sabe que el sidecar existe — habla con localhost y el sidecar intercepta el tráfico.
