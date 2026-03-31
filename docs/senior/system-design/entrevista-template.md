---
id: entrevista-template
title: Template de Entrevista de System Design (45 min)
sidebar_position: 4
---

# Template de Entrevista de System Design (45 min)

Este template te da una estructura de tiempo y contenido para conducir una entrevista de system design de 45 minutos. Seguir una estructura conocida reduce el estrés y demuestra madurez técnica.

:::tip Por qué importa la estructura
El entrevistador no espera que diseñes el sistema perfecto — quiere ver tu **proceso de pensamiento**. Saltar al diseño sin clarificar requisitos, o perderte en detalles antes de tener un diseño general, son señales negativas independientemente de cuánto sepas.
:::

---

## Vista general del tiempo

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: Clarificar requisitos          │  5 min  │  0:00-5:00  │
│  FASE 2: Estimaciones de escala         │  5 min  │  5:00-10:00 │
│  FASE 3: High-Level Design (HLD)        │ 10 min  │ 10:00-20:00 │
│  FASE 4: Deep Dive en componentes clave │ 15 min  │ 20:00-35:00 │
│  FASE 5: Discusión de trade-offs        │  5 min  │ 35:00-40:00 │
│  FASE 6: Preguntas y cierre             │  5 min  │ 40:00-45:00 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fase 1 — Clarificar Requisitos (0:00–5:00)

**Objetivo:** Definir exactamente qué estás diseñando antes de dibujar una sola caja.

No asumas nada. Los entrevistadores dan intencionalmente enunciados vagos para ver si preguntas o asumes.

### Preguntas funcionales (qué hace el sistema)

```
"Antes de empezar a diseñar, quiero clarificar el scope."

Sobre funcionalidades:
- ¿Cuáles son las features core para este diseño? (ej: ¿incluye búsqueda o solo upload?)
- ¿Hay features que explícitamente NO cubrimos hoy?
- ¿El sistema es de lectura intensiva, escritura intensiva o mixto?
- ¿Los datos son en tiempo real o pueden ser eventually consistent?

Sobre usuarios:
- ¿Quiénes son los usuarios? (consumidores, empresas, sistemas internos)
- ¿Hay distintos tipos de usuario con permisos distintos?
```

### Preguntas no funcionales (cómo de bien lo hace)

```
Sobre escala:
- ¿Cuántos usuarios activos diarios (DAU) esperamos?
- ¿Cuántas requests por segundo en pico?
- ¿Hay estacionalidad? (ej: Black Friday, eventos deportivos)

Sobre disponibilidad y consistencia:
- ¿Qué SLA de disponibilidad se espera? (99.9%? 99.99%?)
- ¿Es preferible disponibilidad o consistencia estricta?
- ¿Cuánta latencia es aceptable? (p99 < 200ms?)

Sobre datos:
- ¿Cuánto tiempo se retienen los datos?
- ¿Hay requisitos de compliance (GDPR, HIPAA)?
- ¿Los datos son sensibles o públicos?
```

### Cómo resumir antes de continuar

> "Entonces, voy a diseñar un sistema que [funcionalidad core], con aproximadamente [X] usuarios activos diarios, [Y] requests por segundo en pico, con alta disponibilidad y eventual consistency aceptable. ¿Estoy entendiendo bien el scope?"

---

## Fase 2 — Estimaciones de Escala (5:00–10:00)

**Objetivo:** Calcular órdenes de magnitud para validar que tu diseño tiene sentido a la escala pedida.

No se espera precisión. Se espera que estimes con lógica, no que memorices benchmarks.

### Cálculos base

```
Conversiones útiles:
  1 día      = 86.400 segundos ≈ 100.000 s
  1 mes      = 30 días
  1 año      = 365 días

Usuarios:
  100M DAU, 10% activos al mismo tiempo = 10M usuarios concurrentes
  10M usuarios × 10 requests/día = 100M requests/día
  100M / 100.000 s/día = 1.000 requests/segundo (media)
  Pico = media × 3-5x = 3.000-5.000 rps

Storage:
  100M usuarios × 1 post/día × 500 bytes = 50 GB/día
  50 GB/día × 365 = 18 TB/año
  Con replicación x3 = 54 TB/año
```

### Template de cálculo estándar

```
DAU:             [N] millones de usuarios activos diarios
Reads por usuario: [X] reads/día
Writes por usuario: [Y] writes/día

Total reads/día:  [N × X] millones
Total writes/día: [N × Y] millones

Reads/segundo (media):  [Total / 86.400]
Writes/segundo (media): [Total / 86.400]
Pico (× 3-5):           [media × 3 a 5]

Tamaño por registro:   [bytes]
Storage/día:           [writes/día × tamaño]
Storage/año:           [storage/día × 365 × factor_replicación]
Bandwidth (ingress):   [writes/seg × tamaño]
Bandwidth (egress):    [reads/seg × tamaño]
```

### Verbaliza el razonamiento

> "Si tenemos 100M de usuarios activos y cada uno hace 10 requests al día, son 1.000 millones de requests diarios. Dividido entre 86.400 segundos son ~11.000 rps en media. En pico asumo 3x, así que necesito soportar ~33.000 rps. ¿Tiene sentido o esperas un número diferente?"

---

## Fase 3 — High-Level Design (10:00–20:00)

**Objetivo:** Diseñar los componentes principales y el flujo de datos. Sin detalles de implementación todavía.

Empieza dibujando los bloques principales y explicando el flujo de datos de una request típica.

### Componentes estándar de un sistema distribuido

```
┌──────────┐    ┌──────────┐    ┌──────────────────┐
│  Cliente  │───▶│    DNS   │───▶│   Load Balancer  │
│(web/móvil)│    │  + CDN   │    │  (L4/L7, HTTPS)  │
└──────────┘    └──────────┘    └────────┬─────────┘
                                         │
                              ┌──────────▼──────────┐
                              │    API Gateway /     │
                              │    BFF Layer         │
                              └──────┬───────────────┘
                                     │
              ┌──────────────────────┼───────────────────────┐
              │                      │                       │
   ┌──────────▼───────┐  ┌───────────▼────────┐  ┌──────────▼──────┐
   │  Servicio A      │  │  Servicio B         │  │  Servicio C     │
   │  (read-heavy)    │  │  (write-heavy)      │  │  (async jobs)   │
   └──────┬───────────┘  └─────────┬──────────┘  └─────────┬───────┘
          │                        │                        │
   ┌──────▼──────┐        ┌────────▼────────┐    ┌──────────▼──────┐
   │    Cache    │        │   Message Queue  │    │   Worker        │
   │   (Redis)   │        │  (Kafka/RabbitMQ)│    │   (Background)  │
   └──────┬──────┘        └────────┬────────┘    └─────────────────┘
          │                        │
   ┌──────▼──────┐        ┌────────▼────────┐
   │  DB (Read   │        │  DB (Write      │
   │  Replica)   │        │  Primary)       │
   └─────────────┘        └─────────────────┘
```

### Explica el flujo happy path

> "Para una request de lectura típica: el cliente llega al Load Balancer, que lo dirige a uno de los N app servers. El app server primero verifica Redis; si hay cache hit, responde en < 5ms. Si es cache miss, consulta la read replica de Postgres. El resultado se guarda en Redis con TTL de [X] minutos."

> "Para una write request: el app server valida la request, escribe en Postgres primary (sincrónico para confirmar al usuario), y publica un evento en Kafka para procesamiento asíncrono — fanout a seguidores, actualización de contadores, notificaciones."

### Checklist del HLD

- [ ] Cliente → DNS/CDN → Load Balancer
- [ ] API Gateway o BFF si hay múltiples clientes
- [ ] App servers (stateless para escalar horizontalmente)
- [ ] Caching layer (Redis) con estrategia indicada
- [ ] Base de datos principal + read replicas si aplica
- [ ] Message queue para operaciones asíncronas
- [ ] Storage de archivos (S3/Blob) si hay uploads
- [ ] CDN para assets estáticos

---

## Fase 4 — Deep Dive en Componentes Clave (20:00–35:00)

**Objetivo:** Profundizar en los 2-3 componentes más críticos o difíciles del sistema.

El entrevistador suele guiar este deep dive. Si no lo hace, proactivamente elige los componentes más interesantes técnicamente.

### Preguntas guía para el deep dive

```
Sobre la base de datos:
- ¿Qué esquema/índices necesitamos para las queries más frecuentes?
- ¿Sharding? ¿Por qué columna? ¿Qué hotspots evitamos?
- ¿SQL o NoSQL? ¿Por qué para este caso?

Sobre el caching:
- ¿Qué estrategia? (cache-aside, write-through, write-behind)
- ¿Cómo evitamos cache stampede (thundering herd)?
- ¿Cache invalidation — cómo garantizamos consistencia?

Sobre la escalabilidad:
- ¿Cuál es el componente que más presión recibe?
- ¿Cómo maneja el sistema un pico de 10x tráfico?
- ¿Qué pasa si se cae uno de los app servers?

Sobre el manejo de fallos:
- ¿Single points of failure? ¿Cómo los eliminamos?
- ¿Qué pasa si la DB primaria cae?
- ¿Cómo garantizamos idempotencia en las writes?
```

### Patrones frecuentes de deep dive

#### Cache Stampede (Thundering Herd)

```
Problema: 10.000 usuarios consultan la misma key que acaba de expirar.
          Todos van a la DB al mismo tiempo → DB colapsa.

Soluciones:
  1. Probabilistic early expiration: renovar la cache antes de que expire
     (con cierta probabilidad cuando queda poco TTL)
  2. Lock: solo 1 proceso consulta la DB, los demás esperan
     (Redis SETNX como lock distribuido)
  3. Background refresh: job que renueva las keys populares antes de que expiren
```

#### Idempotencia en writes

```
Problema: el cliente reintenta un POST porque no recibió confirmación.
          Se duplican los registros.

Solución: Idempotency Key
  1. El cliente genera un UUID por request
  2. El servidor guarda UUID → resultado en una tabla idempotency_cache
  3. Si recibe el mismo UUID, devuelve el resultado almacenado sin re-ejecutar
  4. TTL de 24h en la tabla de idempotency keys
```

---

## Fase 5 — Trade-offs y Evolución (35:00–40:00)

**Objetivo:** Demostrar madurez técnica articulando qué sacrificaste en tu diseño y por qué.

Los entrevistadores valoran más a quienes identifican trade-offs sin que se los pidan, que a quienes tienen el diseño "perfecto".

### Framework para articular trade-offs

```
"Elegí [decisión A] sobre [decisión B] porque [razón].
 El costo de esta decisión es [consecuencia].
 En un escenario donde [condición diferente], cambiaría a [alternativa]."
```

### Trade-offs comunes

| Decisión | Beneficio | Costo | Cuándo reconsiderar |
|----------|-----------|-------|---------------------|
| Eventual consistency | Alta disponibilidad, menor latencia | Los usuarios pueden ver datos desactualizados | Si el negocio requiere consistencia estricta (banca, inventario) |
| Fanout on write | Reads O(1) | Writes costosas para usuarios con muchos seguidores | Si > 1% de usuarios tiene > 10.000 seguidores |
| Read replicas | Escala reads sin sharding | Lag de replicación, reads pueden ser stale | Si el negocio no tolera ningún stale read |
| Microservicios | Escalabilidad y despliegue independiente | Latencia de red, complexity operacional | Si el equipo tiene < 5-6 desarrolladores |
| Sharding horizontal | Escala writes infinitamente | Cross-shard queries complejas, rebalanceo difícil | Primero agotar vertical scaling + read replicas |

### Cómo presentar evolución del sistema

> "Este diseño soporta hasta ~50M DAU. Si crecemos a 500M DAU necesitaría: (1) sharding de la DB por user_id, (2) separar el servicio de notificaciones en un componente dedicado con Kafka, y (3) CDN regional para reducir latencia en otros continentes."

---

## Fase 6 — Cierre y Preguntas (40:00–45:00)

**Objetivo:** Demostrar que piensas en observabilidad y operabilidad, no solo en el diseño.

### Preguntas de cierre que puedes incluir proactivamente

```
Observabilidad:
- "Para monitorear este sistema usaría: métricas (RPS, latencia p99, tasa de errores)
   con alertas si p99 > 200ms o error rate > 1%."
- "Distributed tracing (OpenTelemetry) para rastrear requests cross-servicio."

Puntos de falla:
- "Los SPOFs que veo son: [lista]. Los mitigaría con [solución]."

Seguridad:
- "Consideraciones de seguridad: rate limiting en el API Gateway, JWT en endpoints
   protegidos, encriptación en reposo para datos sensibles."
```

### Preguntas del entrevistador que deberías poder responder

- "¿Qué parte de tu diseño es más frágil?"
- "¿Qué cambiarías si tuvieras que implementar esto en 2 semanas?"
- "¿Cómo debuggeas un problema de latencia alta en producción con este diseño?"

---

## Ejemplo de agenda completa: "Diseña Twitter/X"

```
[0:00-5:00] REQUISITOS
  Funcionales: post de tweets, timeline, follow, likes
  No funcionales: 150M DAU, 5K tweets/seg, lectura 10x escritura,
                  disponibilidad > consistencia, latencia < 200ms p99

[5:00-10:00] ESTIMACIONES
  150M DAU × 20 tweets leídos/día = 3B reads/día = 35K rps
  150M DAU × 1 tweet/3 días = 50M tweets/día = 580 writes/seg
  Pico writes: 580 × 5 = 2.900 writes/seg (trending events)
  Storage: 580 writes/seg × 140 bytes × 86.400 = 7 GB/día → 2.5 TB/año

[10:00-20:00] HLD
  - CDN para media (imágenes, videos)
  - API Gateway → Tweet Service, Timeline Service, User Service
  - Timeline: fan-out on write para usuarios normales,
              fan-out on read para celebrities (>500K seguidores)
  - Redis para timelines pre-computados (TTL 24h)
  - Kafka para fan-out asíncrono y contadores
  - Cassandra para tweets (write-heavy, time-series friendly)
  - MySQL para relaciones usuario-usuario (follows)

[20:00-35:00] DEEP DIVE: Timeline Service
  - Fan-out híbrido explicado
  - Estructura de datos en Redis (sorted set por timestamp)
  - Estrategia para celebrities: merge en read-time
  - Cache invalidation: TTL + event-driven invalidation al nuevo tweet

[35:00-40:00] TRADE-OFFS
  - Eventual consistency del timeline (ok para este caso)
  - Costo del fan-out para usuarios con muchos seguidores
  - Cassandra vs Postgres: elegí Cassandra por write throughput
  - Evolución: sharding por user_id en Cassandra ya está built-in

[40:00-45:00] CIERRE
  - Monitoreo: alertas en fan-out lag > 30s, timeline cache hit rate < 90%
  - Failure modes: si Redis cae, fallback a DB (lento pero funcional)
  - Security: rate limiting en tweets (max 300/hora), JWT auth
```

---

## Señales positivas vs. negativas para el entrevistador

| ✅ Positivo | ❌ Negativo |
|------------|------------|
| Clarifica antes de diseñar | Salta al diseño sin preguntar |
| Verbaliza el razonamiento | Dibuja en silencio |
| Menciona trade-offs espontáneamente | Solo menciona trade-offs si le preguntan |
| Prioriza con criterio ("empiezo por X porque es el bottleneck") | Profundiza en detalles irrelevantes |
| Gestiona el tiempo activamente | Pasa los 45 min en la Fase 1 o en un solo componente |
| "No sé exactamente, pero lo estimaría así..." | Silencio o inventar datos de memoria |
| Menciona observabilidad y operabilidad | Solo habla del happy path |
