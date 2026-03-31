---
id: microservicios-traps
title: Microservicios Traps y Anti-patrones
sidebar_position: 14
---

# Microservicios Traps y Anti-patrones 🔴

## Monolito vs Microservicios

```
Monolito:
┌──────────────────────┐
│ Usuarios   │ Pedidos │ (mismo proceso, misma BD)
│ Pagos      │ Email   │
└──────────────────────┘
✅ Simple deploy, debugging, transacciones ACID
❌ Escala solo todo, difícil cambios, gran dependencias

Microservicios:
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│ Usuarios    │  │ Pedidos       │  │ Pagos        │
│ BD separada │  │ BD separada   │  │ BD separada  │
└─────────────┘  └──────────────┘  └──────────────┘
     ↓                  ↓                  ↓
   API            API + Queue          API

✅ Escalabilidad independiente, equipos independientes, deploy frecuente
❌ Complejidad operacional, debugging distribuido, transacciones distribuidas, network calls
```

---

## Trampa #1: Microservicios "demasiado micro"

```csharp
// ❌ ANTI-PATRÓN: Cada función = micro servicio
Service.Users (solo login)
Service.UserProfile (perfil)
Service.UserPreferences (configuración)
Service.UserNotifications (notificaciones)

// Problema:
// - Llamar 4 servicios → 4 network round trips (4x latencia)
// - Transaccionalidad: si UserProfile API falla, Profile se queda inconsistente
// - Deployment pesado: cambio mínor requiere orquestar 4 deploys

// ✅ CORRECTO: Agrupar por Bounded Context (DDD)
Service.Users (login, profile, preferences, notificaciones)
Service.Orders (crear, actualizar, buscar, cancelar)
Service.Payments (procesar, refundar, reconciliar)

// Cada servicio contiene todo lo que un usuario necesita para esa entidad
// Balances: ~10-50 endpoints por servicio es bueno
```

---

## Trampa #2: Compartir BD entre servicios

```postgresql
-- ❌ ANTI-PATRÓN: Dos servicios contra la misma BD
-- Service.Orders accede: orders, items, status tables
-- Service.Inventory accede: orders, items, stock tables

-- Problema:
-- Schema coupling: cambio en "items" afecta ambos servicios
-- Data coupling: transacciones sincrónicas
-- Base de datos se convierte en bottleneck
-- No puedes escalar servicios independientemente

-- ✅ CORRECTO: Cada servicio su propia BD
-- Service.Orders BD: orders, items, status (dueño)
-- Service.Inventory BD: products, stock (dueño)

-- Comunicación eventual:
-- Cuando Order crea un item, publica evento
-- Inventory service escucha y actualiza su stock local
```

---

## Trampa #3: Network Calls síncronos en cascada

```
Request → Service A → Service B → Service C → BD
         (wait)     (wait)     (wait)
Latencia total: ~300ms (100ms * 3 servicios)
Si C es lento o cae: A y B quedan bloqueados

✅ SOLUCIONES:

Patrón 1: Cache agresivo
Request → Service A (cache) → si no tiene → Service B (cache) → Service C
Reduce cascadas efectivas

Patrón 2: Event-driven / Async
Request → Service A publica evento → Response inmediato
Service B, C escuchan async (sin bloquear)

Patrón 3: GraphQL + DataLoader
Cliente pide exactamente qué necesita
Backend resuelve con batching (menos calls)
```

```csharp
// ✅ Async approach
public class PedidoService
{
    private readonly IPublishEndpoint _bus;

    public async Task<int> CrearPedidoAsync(CreatePedidoRequest request)
    {
        // 1. Crear pedido localmente (rápido)
        var pedido = new Pedido { UsuarioId = request.UsuarioId, ... };
        await _db.Pedidos.AddAsync(pedido);
        await _db.SaveChangesAsync();

        // 2. Publicar evento (no esperar respuesta)
        await _bus.Publish(new PedidoCreado 
        { 
            PedidoId = pedido.Id,
            UsuarioId = request.UsuarioId,
            Items = request.Items
        });

        // Retornar inmediatamente — inventario y pagos procesarán async
        return pedido.Id;
    }
}

public class InventarioConsumer : IConsumer<PedidoCreado>
{
    public async Task Consume(ConsumeContext<PedidoCreado> context)
    {
        var evento = context.Message;
        
        // Procesar reserva de inventory async
        foreach (var item in evento.Items)
        {
            await _inventarioService.ReservarAsync(item.ProductoId, item.Cantidad);
        }

        // Publicar siguiente evento
        await context.Publish(new InventarioReservado 
        { 
            PedidoId = evento.PedidoId 
        });
    }
}
```

---

## Trampa #4: Distributed Transactions

```csharp
// ❌ ANTI-PATRÓN: 2PC (Two-Phase Commit)
// Coordinar transacción en multiple BDs — SLOWWW y FRAGILE

using (var transaction = new TransactionScope())
{
    // Order service
    await _orderDb.CrearPedidoAsync(pedido);

    // Inventory service (esperar confirmación)
    await _inventarioDb.ReservarAsync(pedidoId, items);

    // Payment service (esperar confirmación)
    await _paymentDb.ProcesarPagoAsync(pedidoId, total);

    transaction.Complete();  // Todos confirman o todos rollback
}

// Problema: Si payment falla después de 5 segundos, todo se rollback
// ¿Qué pasó con el email que se envió? ¿Los logs?

// ✅ CORRECTO: Saga Pattern (compensating transactions)
public class PedidoSaga : ISaga
{
    public async Task Ejecutar(PedidoCreado evento)
    {
        try
        {
            // Paso 1: Crear pedido (local)
            await _orderService.CrearAsync(evento);

            // Paso 2: Reservar inventario
            var inventarioReservado = await _inventarioService.ReservarAsync(evento);
            if (!inventarioReservado.Success)
            {
                throw new InventarioNoDisponibleException();
            }

            // Paso 3: Procesar pago
            var pagoProcesado = await _paymentService.ProcesarAsync(evento);
            if (!pagoProcesado.Success)
            {
                // Compensar: desreservar inventario
                await _inventarioService.DesreservarAsync(evento);
                throw new PagoFallidoException();
            }

            // Paso 4: Enviar confirmación
            await _emailService.EnviarConfirmacionAsync(evento);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Saga falló para pedido {PedidoId}", evento.PedidoId);
            // Log ya registró la falla — es responsabilidad del sistema manejar
        }
    }
}
```

---

## Trampa #5: Service Discovery Manual

```csharp
// ❌ ANTI-PATRÓN: Hardcodear direcciones de servicios
var userServiceUrl = "http://192.168.1.10:8000";
var orderServiceUrl = "http://192.168.2.20:8001";

// Problema:
// - Si server 10 cae, necesitas actualizar código
// - Escalabilidad: agregar instancia requiere cambio de código
// - No escalas automáticamente

// ✅ CORRECTO: Service Discovery (Consul, Kubernetes DNS)
var userService = _serviceDiscovery.Resolve("user-service");  // Retorna uno de N instancias

// O mejor: usar load balancer que maneja discovery
var response = await _httpClient.GetAsync("http://user-service/api/usuarios/1");
// DNS dinámico o service mesh resuelve

// En Kubernetes:
// http://user-service  → automáticamente resuelve a uno de los Pods
// Escalas: kubectl scale deployment user-service --replicas=5
// Kubernetes automáticamente actualiza el DNS
```

---

## Trampa #6: Logging distribuido desorganizado

```csharp
// ❌ SIN estructura: Cada servicio loguea differently
Service A: "Usuario creado"
Service B: "Pedido: 123 for User: 456"
Service C: "[2024-01-15 10:30:15] Order processed"

// Imposible correlacionar a través de servicios

// ✅ CORRECTO: Structured logging con correlation ID
public static class LoggingMiddleware
{
    public static void Apply(IApplicationBuilder app)
    {
        app.Use(async (context, next) =>
        {
            var correlationId = context.Request.Headers
                .TryGetValue("X-Correlation-ID", out var val) 
                ? val.ToString() 
                : Guid.NewGuid().ToString();

            using (LogContext.PushProperty("CorrelationId", correlationId))
            {
                context.Response.Headers.Add("X-Correlation-ID", correlationId);
                await next();
            }
        });
    }
}

// Service A
_logger.LogInformation("Creando usuario {UsuarioId}", usuarioId);
// Output: {"timestamp": "...", "message": "Creando usuario 123", "CorrelationId": "abc-123"}

// Service B (recibe correlation ID en header)
_logger.LogInformation("Procesando pago para pedido {PedidoId}", pedidoId);
// Output: {"timestamp": "...", "message": "Procesando pago para pedido 456", "CorrelationId": "abc-123"}

// Ahora puedes buscar todas las líneas de ejecución:
// elasticsearch query: CorrelationId == "abc-123"
// Obtener el flujo completo de request
```

---

## Trampa #7: Sin API Gateway

```
Sin Gateway:
Client → Service A (auth, logging, rate limit)
Client → Service B (auth, logging, rate limit) [duplicado]
Client → Service C (auth, logging, rate limit) [duplicado]

❌ Lógica duplicada en cada servicio
❌ Cliente necesita conocer múltiples URLs
❌ Cambiar auth requiere actualizar N servicios

Con Gateway:
Client → API Gateway (auth, logging, rate limit, versioning)
         ├→ Service A
         ├→ Service B
         └→ Service C

✅ Lógica centralizada
✅ Cliente une URL
✅ Composición de servicios transparente
```

```csharp
// ✅ API Gateway con routing
public class ApiGateway
{
    [Route("api/usuarios/{id}")]
    public async Task<IActionResult> GetUsuario(int id)
    {
        var response = await _httpClient.GetAsync($"http://user-service/usuarios/{id}");
        return Ok(await response.Content.ReadAsAsync<dynamic>());
    }

    [Route("api/pedidos")]
    [Authorize]
    [RateLimit(100)]  // ← Centralizado
    public async Task<IActionResult> GetPedidos()
    {
        var usuarioId = User.FindFirst("sub").Value;
        var response = await _httpClient.GetAsync(
            $"http://order-service/pedidos?usuarioId={usuarioId}");
        return Ok(await response.Content.ReadAsAsync<dynamic>());
    }
}
```

---

## Service Mesh para Microservicios

```
Sin Service Mesh:
Service A → Service B (retry, timeout, circuit breaker en código)
           → Service C
           → Service D

Cada servicio reimplementa resiliencia — código duplicado

Con Service Mesh (Istio, Linkerd):
Service A → Sidecar Proxy (automático retry, timeout, circuit breaker)
   ├→ Service B
   ├→ Service C
   └→ Service D

✅ Resiliencia en infraestructura, no en código
✅ Observabilidad automática (tracing, metrics)
✅ Cambiar políticas sin redeploy de servicios
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuándo NO usar microservicios?**
> Si el equipo es &lt;10 personas, si el sistema es &lt;$100M/año de ingresos, si cambian requisitos frecuentemente. Monolito es más simple. Microservicios requieren: DevOps expertise, observabilidad, gestión de complejidad distribuida.

**2. ¿Monolito → Microservicios cómo migro sin downtime?**
> Strangler pattern: agregar servicio nuevo al lado de monolito, redirigir tráfico gradualmente (10% → 25% → 50%), rollback fácil si falla. Estrategia: extraer servicios pequeños primero (email, notificaciones que son independientes).

**3. ¿Qué pasa si un microservicio cae?**
> Depende de cómo lo diseñaste. Si es crítico (pagos), necesita redundancia (multiple instancias con load balancing). Si es no-crítico (recomendaciones), degradación elegante — retornar resultado vacío, sin fallar todo. Circuit breaker previene cascada.

**4. ¿CQRS en microservicios?**
> Sí, útil. Servicio A es productor de eventos, Servicio B es consumidor y mantiene read model de datos que A produce. Permite coupling loose entre servicios.

**5. ¿Transaction saga vs Outbox Pattern?**
> **Saga**: Coordinar pasos manualmente, aplicación maneja lógica. **Outbox**: Escribe to BD + escribe evento en misma transacción, proceso separado publica eventos confiablemente. Outbox es más robusto, pero más overhead de infraestructura.

**6. ¿Cuántos microservicios es "demasiado"?**
> Regla de dedo: 1 microservicio por equipo (pizza team — 6-8 personas). Si tienes 50 servicios y 10 personas, imposible mantener. Cada servicio requiere: deploy pipeline, monitoring, toil operacional.

**7. ¿Timeout en llamadas entre servicios?**
> Siempre. Default HTTP timeout es infinito — malo. Set a corto (ej: 5 segundos). Si servicio B normalmente tarda 2 segundos, timeout a 10 segundos evita race conditions. Si B tarda >10 segundos regularmente, arquitectura problema.

**8. ¿Compartir librería entre servicios?**
> Evita si puedes. Si lo haces, version estrictamente. Mejor: cada servicio auto-suficiente. Excepción: librería de logging, metrics (bajo level infrastructure).

**9. ¿API versioning en microservicios?**
> API Gateway puede traducir `/v1/usuarios` → `/usuarios` en servicio. Dentro, mantén compatibilidad backward. Versioning en URL es público, versioning interno (BD schema) es privado. Evita romper contratos entre servicios.
