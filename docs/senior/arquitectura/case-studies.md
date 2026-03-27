---
id: case-studies
title: Case Studies - Decisiones Arquitectónicas Reales
sidebar_position: 10
---

# Case Studies: Decisiones Arquitectónicas Reales 📖

Empresas reales enfrentaron desafíos arquitectónicos complejos. Aquí analizamos cómo tomaron decisiones y qué podemos aprender.

---

## 1️⃣ Netflix: De Alquiladora de DVDs a Streaming Global

### El Problema (2008)

```
Netflix rentaba DVDs por correo.
En 2008 decide pivotar: Streaming online.

DESAFÍOS:
- Millones de usuarios simultáneos
- Contenido en diferentes formatos
- Fallos de infraestructura no pueden romper el negocio
- Necesidad de deployar cambios diarios

MONOLITO INICIAL:
├─ Catálogo
├─ Streaming player
├─ Billing
├─ Recommendations
├─ User accounts
└─ Toda lógica en una base de datos
```

El monolito: no podía escalar, un deploy roto rompía todo, 1 equipo para todo.

### La Decisión: Microservicios + Chaos Engineering

```
ARQUITECTURA:
┌─────────────────────────────────────────┐
│           API Gateway                   │
│         (Edge routing layer)            │
├─────────────────────────────────────────┤
│ [User] [Catalog] [Playback] [Billing]   │ Servicios independientes
│ [Recommendations] [Search]              │ Cada uno escalable
│ [Payments] [Logging] [Analytics]        │ Deploys independientes
└─────────────────────────────────────────┘
        ↓
     AWS (multi-region)

CADA SERVICIO:
├─ Tiene su propia BD (no BD compartida)
├─ Se comunica por REST/Async
├─ Puede deployarse independientemente
├─ Tiene su propia versión de código
└─ Responsabilidad única
```

### Key Decisions

| Decisión | Por qué | Trade-off |
|----------|---------|----------|
| **Microservicios** | Escalabilidad diferenciada, equipos independientes | Complejidad operacional masiva |
| **API Gateway** | Enrutamiento centralizado, rate limiting | Punto único de fallo (mitigado) |
| **Multi-region** | Tolerancia a fallos, disaster recovery | Complejidad de consistencia |
| **Eventual Consistency** | Disponibilidad sobre consistencia inmediata | Datos pueden estar "stale" |
| **Chaos Engineering** | "Si algo falla, el sistema continúa" | Requiere cultura de test |

### Chaos Engineering in Action

Netflix creó **Chaos Monkey** — herramienta que mata procesos al azar en producción:

```
Filosofía: "Si no hemos visto fallar en producción... 
           entonces vamos a causar fallos."

Resultado: Servicios diseñados para ANTICIPAR fallos.

Ejemplo:
  20:00 - Chaos Monkey mata instancia de Playback
  20:01 - Sistema automáticamente redirige a otra instancia
  20:02 - Usuarios no ven impacto (3ms de latencia extra)
  20:03 - Alarm: Equipo revisa logs
  20:04 - Fix propuesto
  20:05 - Deploy nuevo código
```

### Lección Aplicable

> Si construyes una arquitectura que NO permite fallos individuales, estás construyendo un monolito disfrazado de microservicios.

**Para TI:** Diseña cada componente asumiendo que puede fallar. Usa circuit breakers, timeouts, fallbacks.

---

## 2️⃣ Uber: Real-time Dispatch a Escala Global

### El Problema (2011-2015)

```
UBER CRECE EXPONENCIALMENTE:
2011: 1 ciudad, 100 users
2013: 10 ciudades, 100K users
2015: 60 ciudades, 10M users

REQUISITOS ARQUITECTÓNICOS:
├─ Match driver ↔ rider en TIEMPO REAL (< 1s)
├─ Geolocation de 1M+ drivers simultáneos
├─ Billing y ratings
├─ Fraud detection
├─ Surge pricing dinámico
├─ Multi-region global
└─ 99.9% uptime SLA
```

### La Decisión: Plataforma de Eventos en Tiempo Real

```
ARQUITECTURA:
┌──────────────────────────────────┐
│ Real-time Event Streaming Layer  │
│ (Kafka, Geospatial Index)        │
├──────────────────────────────────┤
│ EVENT STREAM:                    │
│ ├─ DriverLocationUpdated(lat,lon)
│ ├─ RideRequested(pickup,dropoff)
│ ├─ DriverAccepted(driver_id)
│ ├─ RideStarted, RideEnded
│ └─ PaymentProcessed
├──────────────────────────────────┤
│ CONSUMERS (Event subscribers):    │
│ ├─ [Matching Svc]  → Asigna ride
│ ├─ [Pricing Svc]   → Surge pricing
│ ├─ [Billing Svc]   → Cobra al usuario
│ ├─ [Rating Svc]    → Ratings
│ └─ [Analytics]     → Metrics
└──────────────────────────────────┘
```

### Key Decisions

| Componente | Elección | Razón |
|-----------|----------|-------|
| **Event Bus** | Kafka (particionado por geolocation) | Durabilidad, replay, escala masiva |
| **Geospatial** | H3 hexagons + Geohash | Clustering de drivers, búsqueda rápida |
| **Matching** | Algoritmo + ML | Minimizar tiempo de espera, maximizar utilización |
| **Pricing** | Real-time basado en demanda | Revenue, equilibrio supply/demand |
| **Consistency** | Eventual, tolerancia a stale data | Velocidad > consistencia perfecta |

### Code Example: Event-Driven Dispatch

```csharp
// EVENTO: Driver publica ubicación en tiempo real
public record DriverLocationUpdated(
    string DriverId,
    double Latitude,
    double Longitude,
    int H3Index  // Geospatial partitioning
);

// CONSUMER 1: Matching Service
public class MatchingConsumer : IEventConsumer<DriverLocationUpdated>
{
    private readonly IGeoIndex _geoIndex;
    private readonly IMatchingEngine _engine;
    
    public async Task HandleAsync(DriverLocationUpdated evt)
    {
        // Actualizar índice geoespacial
        _geoIndex.UpdateDriver(evt.DriverId, evt.Latitude, evt.Longitude);
        
        // Buscar riders cercanos (radio 1km)
        var nearbyRiders = _geoIndex.SearchRidersNearby(
            evt.Latitude, evt.Longitude, radiusKm: 1
        );
        
        // Intentar match para cada rider cercano
        foreach (var rider in nearbyRiders)
        {
            var match = _engine.TryMatch(evt.DriverId, rider.RiderId);
            if (match.Success)
            {
                // Publicar RideAssigned event
                await _eventBus.PublishAsync(new RideAssigned(
                    rider.RiderId,
                    evt.DriverId,
                    EstimatedPickupTime: 4  // minutes
                ));
            }
        }
    }
}

// CONSUMER 2: Pricing Service
public class SurgeConsumer : IEventConsumer<RideRequested>
{
    private readonly IPricingEngine _pricing;
    
    public async Task HandleAsync(RideRequested evt)
    {
        // Calcular surge pricing basado en demanda actual
        var demandLevel = await _analytics.GetDemandLevelAsync(
            evt.PickupLatitude, evt.PickupLongitude
        );
        
        var basePrice = 5.00m;
        var surgeFactor = demandLevel switch
        {
            DemandLevel.Low => 1.0m,
            DemandLevel.Medium => 1.5m,
            DemandLevel.High => 2.5m,
            DemandLevel.CriticalUndersupply => 4.0m
        };
        
        var estimatedPrice = basePrice * surgeFactor;
        
        await _eventBus.PublishAsync(new PriceEstimated(
            evt.RideId, estimatedPrice
        ));
    }
}
```

### Lección Aplicable

> Para sistemas de real-time a escala, event sourcing + event streams es superior a sincrónico.

**Para TI:** Si necesitas:
- Múltiples servicios reaccionando a mismo evento
- Escalabilidad logarítmica (add más consumers, no más código)
- Audit trail completo
- Replay de histórico

→ Usa Event Sourcing + Event Streaming

---

## 3️⃣ Discord: Baja Latencia para Millones

### El Problema (2015-2020)

```
REQUISITOS DISCORD:
- Chat low-latency (< 100ms de end-to-end)
- Voice + Video crystal-clear
- 500M+ mensajes/día
- Millones de users concurrentes
- Comunidades/servidores (Bounded Contexts)
- Mobile + Desktop + Web
```

### La Decisión: Event Sourcing + Read Models Optimizados

```
ARQUITECTURA (Simplificada):
┌────────────────────────────────┐
│ Write Side (Command Handler)   │
├────────────────────────────────┤
│ User: "Send message in #chat"  │
│   └─ CommandHandler validates
│   └─ Publica MessageCreatedEvent
│   └─ Persist to Event Log
├────────────────────────────────┤
│ Read Side (Query Optimized)    │
│ "Get last 50 messages"         │
│   └─ Query read model          │
│   └─ Denormalized, indexed     │
│   └─ Super rápido (Redis)      │
├────────────────────────────────┤
│ Real-time Sync (WebSocket)     │
│   New message                  │
│   └─ Push a connected clients  │
│   └─ Update local cache        │
└────────────────────────────────┘

CQRS + Event Sourcing = Separar escritura de lectura
```

### Key Decisions

| Decisión | Por qué |
|----------|---------|
| **CQRS** | Comandos ≠ Queries. Optimiza cada uno independientemente |
| **Event Sourcing** | Audit log completo de mensajes |
| **Read Models** | Denormalizado, cached en Redis, super rápido |
| **WebSocket** | Push real-time, no polling |
| **Sharding por Server** | Cada servidor Discord es shard independiente |

### Latency Optimization

```
ANTES (Monolito):
┌─────────┐
│ Cliente │ 
└────┬────┘
     │ POST /messages
     ↓
┌──────────────────────┐
│ Validate             │ 10ms
│ Insert BD            │ 50ms (network + disk)
│ Cache invalidate     │ 20ms
│ Broadcast via poll   │ 200ms (client polls)
└──────────────────────┘
     TOTAL: 280ms 😞

DESPUÉS (CQRS + Event Sourcing):
┌─────────┐
│ Cliente │ 
└────┬────┘
  WebSocket (persistent)
     │
     ├─→ Command: "SendMessage"
     │      └─ Validate: 5ms
     │      └─ Append to event log: 15ms
     │      └─ ACK to client: 20ms (TOTAL 40ms)
     │
     └─ Event: MessageCreated
          └─ Update read model: async
          └─ Push real-time: 10ms
          
TOTAL: 40-50ms push, luego update async 🚀
```

### Lección Aplicable

> Para sistemas real-time, separar escritura (rápida) de lectura (optimizada) es patrón ganador.

**Para TI:** 
- Commands = rápido, simple validación, async side effects
- Queries = complejo, optimizado, cacheable

---

## 4️⃣ Amazon: DDD + Equipos Autónomos

### El Problema (Principios 2000s)

```
AMAZON CRECE:
- 1000+ ingenieros
- 100+ equipos
- Monolito está en estado caótico
- Cambio de un equipo rompe a otros
- "We're going nuts" - Jeff Bezos
```

### La Decisión: Amazon's "Two-Pizza Teams" + Services

```
ARQUITECTURA:
┌─────────────────────────────────┐
│ Cada equipo: 1 Bounded Context  │
│ + 1 servicio + 1 BD propia      │
└─────────────────────────────────┘

Teams (DDD Bounded Contexts):
├─ Catalog Team
│  └─ ProductCatalogService (BD propia)
├─ Orders Team
│  └─ OrderService (BD propia)
├─ Payments Team
│  └─ PaymentService (BD propia)
├─ Inventory Team
│  └─ InventoryService (BD propia)
├─ Recommendations Team
│  └─ RecommendationService (BD propia)
└─ Shipping Team
   └─ ShippingService (BD propia)

NO hay BD compartida
NO hay código compartido
Teams comunicarse por APIs ÚNICAMENTE
```

### Key Principle: "Build It, Run It, Own It"

```
ANTES:
Team A escribe código
  ↓
Team B lo integra
  ↓
Team C lo deploya
  ↓
Si falla, culpa de A, B, o C?

DESPUÉS (Amazon):
Team A escribe código
  ↓
Team A lo integra
  ↓
Team A lo deploya
  ↓
Team A monitorea
  ↓
Si falla, es responsabilidad 100% de Team A
  ↓
Ownership crea calidad
```

### Lección Aplicable

> Arquiectura = Estructura de la organización

**Para TI:** Si tienes 5 equipos y 1 monolito:
- No van a poder escalar
- Necesitas architecture que empuje autonomía

Solución: 1 equipo = 1 servicio = 1 BD

---

## 5️⃣ Stripe: Confiabilidad y Auditoría

### El Problema

```
REQUISITOS STRIPE:
- Procesar pagos en MÚLTIPLES paises
- NEVER lose a transaction
- Audit trail completo (regulaciones)
- Idempotent APIs (retry-safety)
- Multi-currency, conversiones en tiempo real
- 99.99% uptime
```

### La Decisión: Event Log + Idempotency Keys

```
ARQUITECTURA:
┌────────────────────────────────┐
│ API: POST /v1/charges          │
│ Body: {amount, currency, ...}  │
├────────────────────────────────┤
│ Stripe checks Idempotency-Key  │
│ (header: Idempotency-Key:...)  │
│                                │
│ IF seen before → return cached │
│ ELSE → continue               │
├────────────────────────────────┤
│ CREATE Event in Log:           │
│ ├─ ChargeRequested             │
│ ├─ Timestamp                   │
│ ├─ Amount, Currency            │
│ └─ Idempotency-Key             │
├────────────────────────────────┤
│ Process Payment:               │
│ 1. Reserve funds from card     │
│ 2. Hit payment gateway         │
│ 3. Confirm or rollback         │
├────────────────────────────────┤
│ Publish Event:                 │
│ ├─ ChargeSucceeded or          │
│ ├─ ChargeFailed                │
│ └─ Idempotent retry-safe       │
│                                │
└────────────────────────────────┘
```

### Idempotency in Action

```csharp
// CLIENT code
var idempotencyKey = Guid.NewGuid().ToString();

for (int attempt = 1; attempt <= 3; attempt++)
{
    try
    {
        var charge = await stripe.CreateChargeAsync(new CreateChargeRequest
        {
            Amount = 10000,  // $100
            Currency = "usd",
            IdempotencyKey = idempotencyKey  // SAME key on retry
        });
        
        return charge;  // Success!
    }
    catch (TemporaryNetworkException ex) when (attempt < 3)
    {
        await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)));
        // Retry with SAME idempotency key
    }
}

// STRIPE behavior
// Request 1: POST /charges + Idempotency-Key: ABC123
//   └─ Process, create charge, save in request log
//
// Request 2 (retry): POST /charges + Idempotency-Key: ABC123
//   └─ See ABC123 in log
//   └─ Return SAME result immediately (no recharge!)
//
// Request 3 (retry): POST /charges + Idempotency-Key: ABC123
//   └─ Still ABC123 in log
//   └─ Return SAME result
```

### Lección Aplicable

> Para sistemas financieros, idempotency + event log = tranquilidad.

**Para TI:**
```
Diseña APIs idempotentes:
  PUT /users/{id} with ID → idempotent
  POST /charges with Idempotency-Key → idempotent
  DELETE /resource/{id} → debería ser idempotent
  
Mantén audit log:
  Quién hizo qué y cuándo
  Replay toda la historia si necesitas
```

---

## 6️⃣ Airbnb: Search y Recomendaciones a Escala

### El Problema

```
REQUISITOS AIRBNB:
- Search: "Hotels en Barcelona, 5 noches, 4 personas"
  └─ Index: 5M+ listings
  └─ Latency: < 500ms
  └─ Actualizado en tiempo real (nuevo listing aparece)

- Recommendations: "Te puede gustar..."
  └─ ML models corriendo continuously
  └─ Milisegundos de latencia
  └─ Personalizado por usuario

- Dynamic Pricing: "Precio varía por demand"
  └─ Real-time pricing adjustments
  └─ Maximizar revenue
```

### La Decisión: Multi-Layer Caching + Service Mesh

```
┌──────────────────────────────────┐
│ Client (Web/Mobile)              │
├──────────────────────────────────┤
        ↓
┌──────────────────────────────────┐
│ API Gateway                      │
│ (Request routing, rate limiting) │
├──────────────────────────────────┤
        ↓
┌──────────────────────────────────┐
│ CACHE LAYER 1 (CDN)              │
│ Geo-distributed, static content  │ ← 1ms
├──────────────────────────────────┤
        ↓
┌──────────────────────────────────┐
│ CACHE LAYER 2 (Redis)            │
│ Hot searches, popular listings   │ ← 5ms
├──────────────────────────────────┤
        ↓
┌──────────────────────────────────┐
│ Service Mesh (Istio)             │
│ Load-balance to Search Service   │
├──────────────────────────────────┤
        ↓
┌──────────────────────────────────┐
│ Search Service (Elasticsearch)   │
│ Index full-text + filters        │ ← 200ms
├──────────────────────────────────┤
        ↓
┌──────────────────────────────────┐
│ ML Ranking Service               │
│ Re-rank results by relevance     │ ← 100ms
└──────────────────────────────────┘

TOTAL: 1 + 5 + 10 + 200 + 100 = 316ms (within SLA)
```

### Key Architecture Decisions

| Layer | Technology | Why |
|-------|-----------|-----|
| **Caching** | Multi-tier (CDN → Redis → In-process) | Cost, latency |
| **Search** | Elasticsearch | Full-text, near real-time |
| **Ranking** | Custom ML service | Business logic |
| **Service Mesh** | Istio | Load-balance, circuit-break, trace |
| **Storage** | Cassandra (read-optimized) | High-throughput reads |

### Lección Aplicable

> Para search/recommendations, caching + indexing + ranking es la trifecta.

**Para TI:**
1. Cache aggressively (CDN → Redis → memory)
2. Index data smartly (Elasticsearch, Solr)
3. Rank smartly (ML models, relevance)

---

## 🎓 Patrones Aparecen Repetidamente

| Pattern | Netflix | Uber | Discord | Stripe | Airbnb |
|---------|---------|------|---------|--------|--------|
| **Microservicios** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Event-Driven** | ✅ Async | ✅ Real-time | ✅ CQRS | ✅ Audit log | ✅ Updates |
| **Caching** | ✅ | ✅ | ✅ Redis | ✅ | ✅ Multi-tier |
| **Observabilidad** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Eventual Consistency** | ✅ | ✅ | ✅ | Sparse | ✅ |
| **Escalabilidad Horizontal** | ✅ | ✅ | ✅ | ✅ | ✅ |

### Pattern Summary

```
ALL OF THEM:
├─ Microservicios (autonomía de equipos)
├─ Events (comunicación async, decoupling)
├─ Caching (performance)
├─ Observabilidad (production visibility)
└─ Escalabilidad horizontal (growth)

Conclusión: ESTOS patrones NO son opcionales a escala
           Son REQUISITOS
```

---

## 📋 Como Aplicar a Tu Proyecto

### Pregunta Frame de Entrevista

> **"¿Cómo diseñarías un sistema para competir con Airbnb?"**

Respuesta estructura:

```
1. REQUISITOS:
   - Search: 5M listings, < 500ms latency
   - Recommendations: Personalized, real-time
   - Booking: ACID compliance (dinero involucrado)
   - Dynamic pricing: Real-time adjustments

2. ARQUITECTURA HIGH-LEVEL:
   ├─ API Gateway (enrutamiento, rate limiting)
   ├─ Search Service (Elasticsearch)
   ├─ Listing Service (CRUD listings)
   ├─ Booking Service (transactional)
   ├─ Recommendation Service (ML)
   ├─ Pricing Service (real-time adjustments)
   └─ Payment Service (Stripe-like)

3. KEY DECISIONS:
   - Microservicios (escalabilidad diferenciada)
   - Multi-tier caching (CDN → Redis → in-process)
   - Event-driven (consistency eventual para no-critical data)
   - Circuit breakers (resilience)
   - Idempotent APIs (retry-safety)

4. DATA STORAGE:
   - Elasticsearch: Search index
   - PostgreSQL: Listings, bookings (ACID needed)
   - Redis: Hot data, cache
   - Cassandra: Analytics, time-series

5. CHALLENGES & MITIGATION:
   - Network latency → Cache, CDN
   - Data consistency → Event sourcing para audit
   - Fraud → Rate limiting, ML anomaly detection
   - Scalability → Sharding, horizontal scaling
```

---

## 💡 Lecciones Síntesis

### 1. Start Simple, Evolve Complex

```
Netflix DIDN'T start with 200 microservices.
  Year 1: Monolito
  Year 3: Extract high-load services
  Year 5: Full microservices + chaos engineering

Lección: Premature optimization es enemigo
```

### 2. Event-Driven es More Flexible

```
Uber: Si hubieran hecho HTTP sync calls:
  Matching → Pricing → Billing
  Risk: Si Pricing service falla, todo falla
  
Actually: Event stream:
  Async, publishers/subscribers decoupled
  Si Pricing falla, Matching sigue funcionando
  
Lección: Asincronía = Resiliencia
```

### 3. Consistency Trade-offs

```
Stripe: STRICT consistency (money involved)
  ├─ Event log (audit)
  ├─ Idempotency (retry-safe)
  └─ ACID transactions

Uber: EVENTUAL consistency (UX > perfection)
  ├─ Driver puede ver rider 0.5s después
  ├─ Pero matched rápido
  └─ Latency matters more than immediate consistency

Lección: Context determines pattern
```

### 4. Observability from Day 1

```
Todos estos casos:
├─ Logging centralizado
├─ Distributed tracing (request flow)
├─ Metrics (latency, errors, throughput)
└─ Alertas (pages engineers at 3am)

Lección: Can't optimize what you can't see
```

### 5. Ownership Drives Quality

```
Amazon: "Build it, run it, own it"
  Team responsable by 100%
  → Cuidadoso en production
  → No "throw over wall" mentality

Lección: Architecture shapes culture
```

---

## 🚀 Resumen: 6 Patrones Clave

| Caso | Pattern | Cuándo Usar |
|------|---------|------------|
| Netflix | Microservicios + Chaos | Escala masiva, tolerancia a fallos |
| Uber | Event streaming + Geospatial | Real-time, global scale |
| Discord | CQRS + Event sourcing | Low-latency, audit trail |
| Stripe | Idempotency + Event log | Transaccional, regulatory |
| Airbnb | Multi-tier caching + ML ranking | Search, recommendations |
| Amazon | DDD + Team autonomy | Large organization scaling |

---

## 📝 Preguntas en Entrevistas Basadas en Case Studies

1. **"How would you design Uber for a specific country?"**
   - Esperado: Mencionar geospatial, real-time, eventual consistency

2. **"Explain Netflix's transition to microservices"**
   - Esperado: Strangler pattern, autonomía, chaos engineering

3. **"How would you ensure Stripe never loses a transaction?"**
   - Esperado: Idempotency, event log, audit trail, retry-safety

4. **"Design a real-time search like Airbnb"**
   - Esperado: Caching layers, indexing, ML ranking

5. **"How does Discord handle millions of messages per second?"**
   - Esperado: Event sourcing, CQRS, WebSocket, sharding

---

**Última actualización:** 2026-03-27  
**Dificultad:** 🔴 Senior
