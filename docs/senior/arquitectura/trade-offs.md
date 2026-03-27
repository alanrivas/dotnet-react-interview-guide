---
id: trade-offs
title: Trade-offs y Decisiones Arquitectónicas
sidebar_position: 7
---

# Trade-offs y Decisiones Arquitectónicas 🎯

Todo decisión arquitectónica involucra elegir entre opciones, cada una con ventajas y desventajas.

---

## Matriz de Trade-offs Comunes

### 1. Consistencia vs Disponibilidad

```
CONSISTENCIA FUERTE (ACID)
├─ ✅ Datos siempre correctos
├─ ✅ No hay anomalías
├─ ❌ Requiere bloqueos
├─ ❌ Baja disponibilidad (el sistema se detiene si hay problema)
└─ Ejemplo: Transacciones bancarias

DISPONIBILIDAD (Eventually Consistent)
├─ ✅ Sistema siempre responde
├─ ✅ Tolerante a fallos
├─ ❌ Datos pueden estar inconsistentes temporalmente
├─ ❌ Complejidad operacional
└─ Ejemplo: Redes sociales, e-commerce
```

**Decisión:**
- **Datos críticos** → Consistencia fuerte (pagos, inventario)
- **Datos no-críticos** → Consistencia eventual (recomendaciones, contadores)

### 2. Monolito vs Microservicios

```
┌─────────────────────────────────────────────────────────┐
│ MONOLITO                                                │
├─────────────────────────────────────────────────────────┤
│ ✅ Deploy simple        ❌ Escalabilidad limitada       │
│ ✅ Debugging fácil      ❌ Alto riesgo de deploy        │
│ ✅ Performance          ❌ Acoplamiento                  │
│ ✅ Transacciones ACID   ❌ Tecnología uniforme           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ MICROSERVICIOS                                          │
├─────────────────────────────────────────────────────────┤
│ ✅ Escalabilidad        ❌ Complejidad operacional      │
│ ✅ Deploy independiente ❌ Debugging complejo            │
│ ✅ Heterogeneidad       ❌ Consistencia eventual         │
│ ✅ Equipos autónomos    ❌ Latencia de red               │
└─────────────────────────────────────────────────────────┘
```

**Decisión:**
```
START_UP / MVP (0-6 meses)
↓
MONOLITO BIEN ESTRUCTURADO
↓
CRECIMIENTO (6-18 meses)
↓
MONOLITO MODULAR (DDD)
↓
ESCALADO (18+ meses)
↓
Considera MICROSERVICIOS si:
├─ Necesitas escalabilidad diferenciada
├─ Equipos crecen independientes
└─ Infraestructura DevOps madura
```

### 3. SQL vs NoSQL

```
┌────────────────────────────────────────────────────────┐
│ SQL (Relacional)                                       │
├────────────────────────────────────────────────────────┤
│ ✅ ACID, transacciones                                  │
│ ✅ Queries complejas (JOINs)                           │
│ ✅ Esquema definido                                     │
│ ❌ Escalabilidad horizontal limitada                    │
│ ❌ Estructura rígida                                    │
│ Ejemplos: PostgreSQL, SQL Server, MySQL               │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ NoSQL (Document/Key-Value)                             │
├────────────────────────────────────────────────────────┤
│ ✅ Escalabilidad horizontal                             │
│ ✅ Flexible (sin esquema)                               │
│ ✅ Alto throughput                                      │
│ ❌ Consistencia eventual                                │
│ ❌ Queries limitadas                                    │
│ ❌ Join manual                                          │
│ Ejemplos: MongoDB, DynamoDB, Redis                    │
└────────────────────────────────────────────────────────┘
```

**Marco de decisión:**
```
¿Necesitas ACID y JOINs complejos?
├─ SÍ → SQL (PostgreSQL)
└─ NO ↓
  ¿Escalabilidad horizontal crítica?
  ├─ SÍ → Considera NoSQL (MongoDB)
  └─ NO → SQL es suficiente
```

### 4. Sincrónico vs Asincrónico

```
SINCRÓNICO (RPC, REST, gRPC)
┌────────────┐  Request   ┌────────────┐
│ Client     │ ─────────→ │ Server     │
│            │ ←────────  │            │
└────────────┘ Response   └────────────┘
└─ Espera respuesta
└─ Rápido pero bloqueante
└─ Acoplado

ASINCRÓNICO (Message Queue, Event Bus)
┌────────────┐         ┌──────────────┐
│ Producer   │ ────→ │ Message Bus  │ ───→ │ Consumer 1 │
│            │     │ (RabbitMQ)     │      │            │
│            │     └──────────────┘ ───→ │ Consumer 2 │
└────────────┘                             │            │
                                          └────────────┘
└─ No bloquea
└─ Desacoplado
└─ Eventual consistency
```

**Decisión:**
```
¿Necesita respuesta inmediata (<100ms)?
├─ SÍ → Sincrónico (REST, gRPC)
└─ NO ↓
  ¿Puede tolerar latencia?
  ├─ SÍ → Asincrónico (Message Queue)
```

### 5. Cache vs Sin Cache

```
SIN CACHE
├─ ✅ Datos siempre frescos
├─ ✅ Sin invalidación
├─ ❌ Lento
├─ ❌ Alto load en DB
└─ Respuesta: 200ms (promedio)

CON CACHE
├─ ✅ Muy rápido (1-10ms)
├─ ✅ Reduce DB load
├─ ❌ Datos pueden estar stale
├─ ❌ Invalidación compleja
└─ Respuesta: 5ms (promedio)
```

**Niveles de cache:**

```csharp
// L1: In-Memory (aplicación)
var data = _memoryCache.GetOrCreate(key, entry => {
    return _db.GetData();
});

// L2: Distributed (Redis)
var cached = await _redis.GetAsync(key);
if (cached == null) {
    cached = await _db.GetDataAsync();
    await _redis.SetAsync(key, cached, TimeSpan.FromHours(1));
}

// Invalidación
// En caso de actualización:
await _redis.RemoveAsync(key);  // Invalidar
```

---

## Marco de Decisión Arquitectónica (ADR)

Para **documentar decisiones importantes** y por qué se tomaron:

```markdown
# ADR-001: Usar PostgreSQL en lugar de MongoDB

## Contexto
Necesitábamos elegir base de datos para nuevo servicio de reportes.

## Opciones consideradas
1. PostgreSQL (SQL)
   - Pros: ACID, JOINs, ecosystem maduro
   - Cons: Escalabilidad horizontal limitada

2. MongoDB (NoSQL)
   - Pros: Escalabilidad horizontal, flexible
   - Cons: Consistencia eventual, JOINs complejos

3. Cassandra (Distributed)
   - Pros: Escalabilidad extrema
   - Cons: Complejo, overhead operacional

## Decisión
**Usar PostgreSQL**

## Justificación
- Reportes requieren JOINs complejos (ventaja SQL)
- Consistencia fuerte necesaria (ventaja PostgreSQL)
- Volumen de datos no requiere escalabilidad horizontal YET
- Team familiarizado con PostgreSQL

## Consecuencias
✅ JOINs eficientes para reportes
✅ ACID garantiza reports correctos
❌ Si escalamos a 1TB+, reevaluar NoSQL
❌ Sharding horizontal requeriría rewrite

## Riesgos mitigados
- Monitoreo de crecimiento de DB
- Plan de archivado de datos antiguos
- Replica read-only para queries de reporting
```

---

## Decisiones por Escala

### Startup (Menos de 100 usuarios)

```
✅ Monolito
✅ 1 Base de datos (SQL)
✅ Sincrónico (REST)
✅ Sin cache (overhead no vale)
✅ 1 Servidor
```

### Growth (100K a 1M usuarios)

```
✅ Monolito modular (DDD)
✅ PostgreSQL (con índices, vacuum)
✅ Sincrónico + caché (Redis L2)
❌ NO Microservicios yet
✅ Load balancer + replicas read
✅ 2-3 Servidores
```

### Scale (1M más usuarios)

```
❌ Monolito → considera CQRS
✅ Múltiples DBs
├─ Primary: Orders (SQL)
├─ Analytics: Data Warehouse (Elasticsearch)
└─ Cache: Redis
✅ Asincrónico (Message API)
✅ Microservicios (si equipos grandes)
✅ 10+ Servidores, K8s
```

---

## Preguntas para tomar decisiones

```
1. ESCALA
   └─ ¿Cuántos usuarios? ¿Cuántas requests/sec?

2. CONSISTENCIA
   └─ ¿Puedo tolerar datos stale?

3. COMPLEJIDAD
   └─ ¿Mi equipo puede operar esto?

4. COSTO
   └─ ¿Cuál es el presupuesto?

5. EVOLUCIÓN
   └─ ¿Escalará esto en 2 años?

6. RIESGO
   └─ ¿Qué pasa si esto falla?
```

---

## Anti-patterns en decisiones

❌ **"Vamos a hacer microservicios porque es moderno"**
- Pregunta: ¿Realmente necesito escalabilidad diferenciada?
- Resultado esperado: No, es overhead innecesario

❌ **"Usemos NoSQL porque es más rápido"**
- Pregunta: ¿Confirmo con benchmark real?
- Realidad: MongoDB + consistencia eventual = complejidad

❌ **"Vamos a cachar todo"**
- Problema: Invalidación, coherencia, overhead
- Solución: Cache solo datos frecuentes y estables

❌ **"Architecture sin entender el dominio"**
- Problema: Elegir basado en tech stack favorito
- Solución: Primero dominio, luego architecture

---

## Checklist: Antes de tomar una decisión arquitectónica

```
□ ¿Entiendo el problema real?
□ ¿He explorado múltiples opciones?
□ ¿Consulté experiencias similares?
□ ¿Mi equipo entiende el trade-off?
□ ¿Tengo plan de evolución/rollback?
□ ¿Documenté la decisión (ADR)?
□ ¿Reviví con arquitecto/senior?
□ ¿Comuniqué el riesgo claramente?
```

---

## Decisiones Difíciles: Cuando No Hay Respuesta Clara

### Caso 1: ¿Esperar o Reescribir?

```
SITUACIÓN:
Sistema en producción, 2M usuarios.
Performance degrada (500ms → 2s).
Equipo discute: ¿Optimizar actual o reescribir?

OPCIÓN A: OPTIMIZAR (Quick wins)
├─ Tiempo: 2-4 semanas
├─ Riesgo: Bajo
├─ Resultado: Maybe 30% improvement
├─ Costo: $50K
└─ Futuro: Problema vuelve en 6 meses

OPCIÓN B: REFACTOR GRADUAL (Strangler Fig)
├─ Tiempo: 3-6 meses
├─ Riesgo: Medio
├─ Resultado: 70% improvement + mantenible
├─ Costo: $150K
└─ Futuro: Problema resuelto por años

OPCIÓN C: REESCRIBIR (Full rewrite)
├─ Tiempo: 6-12 meses
├─ Riesgo: Alto (downtime posible)
├─ Resultado: 95% improvement
├─ Costo: $500K+
└─ Futuro: Tech debt reset

DECISIÓN FRAMEWORK:
├─ Timeline crítico? (< 3 meses)
│  └─ SÍ: Opción A (optimizar rápido)
├─ Hay recursos? (3-6 meses disponibles)
│  └─ SÍ: Opción B (refactor gradual) ← MEJOR
├─ Equipo nuevo + presupuesto ilimitado?
│  └─ SÍ: Opción C (rewrite)
└─ Else: Opción A + plan B en roadmap
```

### Caso 2: ¿Monolito Creciente o Microservicios?

```
SITUACIÓN:
Startup con $5M Serie A.
Monolito está a 200 RPS (limit ~500 RPS).
CTO dice: "Hagamos microservicios"
CFO dice: "Demasiado operacional, monolito cuesta menos"

MATRIZ DECISIÓN:

                   Monolito Modular    Microservicios
Velocidad dev      ✅ Rápido           ⚠️ Medio
Escalabilidad      ⚠️ 1000 RPS max     ✅ Ilimitado
Costo infra        ✅ $5K/mes          ⚠️ $50K+/mes
Complejidad ops    ✅ Simple           ❌ Compleja
Equipos autónomos  ⚠️ Difícil          ✅ Fácil
Time to market     ✅ Breve            ❌ Largo

SCORE MONOLITO MODULAR: 4/5
SCORE MICROSERVICIOS:  2.5/5 (operacional es problema)

DECISIÓN: MONOLITO MODULAR
├─ Equipo <30 personas? Modular suficiente
├─ Llega a 1000 RPS? Plan B para microservicios
├─ Si Series B cambia requisitos, refactor
└─ Reavalu anualmente
```

### Caso 3: ¿Esperar a la BD "CORRECTA" o Pragmático?

```
SITUACIÓN:
Necesitas store documents (user profiles, settings).
Opciones:
1. PostgreSQL JSONB (pragmático)
2. MongoDB (flexible)
3. Elasticsearch (searchable)

ANÁLISIS:
Size: 10M documents, queries simple
Performance: < 100ms SLA

├─ PostgreSQL JSONB
│  ├─ Familiar al team
│  ├─ ACID transactions
│  ├─ JSONB indexing
│  ├─ Suficiente para queries
│  └─ ✅ GANADOR (pragmático)

├─ MongoDB
│  ├─ Flexible schema
│  ├─ Pero team no know ops
│  ├─ Eventual consistency adds complexity
│  └─ ❌ Overhead innecesario

└─ Elasticsearch
   ├─ Full-text search = overkill
   ├─ Costo operacional alto
   └─ ❌ Premature optimization

PRINCIPIO: "Elige la tecnología más SIMPLE que resuelve"
           PostgreSQL JSONB es suficiente hoy.
           Si necesitas ES search, agrega después.
```

---

## Framework de Evaluación: RICE Scoring

Para elegir entre múltiples opciones arquitectónicas:

```
RICE = (Reach × Impact × Confidence) / Effort

REACH:      Cuántos usuarios afectados (1-10 scale)
IMPACT:     Beneficio por usuario (1-10 scale)
CONFIDENCE: Qué tan seguro estás (10-100%)
EFFORT:    Meses de desarrollo (1-100)

EJEMPLO: Elegir entre 3 arquitecturas

OPCIÓN A: Monolito modular
├─ Reach: 8 (afecta a todo)
├─ Impact: 7 (mejora dev speed)
├─ Confidence: 95%
├─ Effort: 3 meses
└─ RICE = (8 × 7 × 0.95) / 3 = 17.7

OPCIÓN B: Microservicios
├─ Reach: 10 (todo puede escalar)
├─ Impact: 9 (escalabilidad ilimitada)
├─ Confidence: 60% (riesgo operators)
├─ Effort: 12 meses
└─ RICE = (10 × 9 × 0.60) / 12 = 4.5

OPCIÓN C: Refactor gradual + cache
├─ Reach: 9 (performance global)
├─ Impact: 8 (rápido + sostenible)
├─ Confidence: 90%
├─ Effort: 6 meses
└─ RICE = (9 × 8 × 0.90) / 6 = 10.8

RANKING: A (17.7) > C (10.8) > B (4.5)
DECISIÓN: Opción A (Monolito modular)
          Reevalúa B en 6 meses si escala lo requiere
```

---

## Matriz: Compatibilidad de Decisiones

Cuando cambias 1 decisión, afecta otras:

```
Si eliges:        Implica:
───────────────────────────────────────────
MICROSERVICIOS  → ✅ Asincrónico vs Sincrónico
                → ✅ Múltiples DBs posible
                → ✅ Message broker (Kafka/RabbitMQ)
                → ✅ Distributed tracing
                → ✅ Circuit breakers + resilience
                → ❌ Monolito puro

EVENT-DRIVEN    → ✅ Eventual consistency
                → ✅ CQRS (si read models needed)
                → ✅ Asincrónico
                → ✅ Event log/sourcing
                → ✅ Multiple subscribers

CONSISTENCIA    → ✅ Sincrónico
FUERTE          → ✅ Transacciones ACID
                → ✅ SQL databases
                → ❌ Alta escalabilidad horizontal
                → ❌ Event-driven simple

CACHE HEAVY     → ✅ Multi-tier (CDN → Redis → L1)
                → ✅ Invalidation strategy
                → ✅ Monitoring stale data
                → ❌ Código sencillo (complejidad de invalidación)

SERVERLESS      → ✅ Asincrónico
                → ✅ Stateless
                → ✅ Económico para spiky traffic
                → ❌ Cold starts (latency)
                → ❌ Debugging complejo
```

---

## Análisis de Riesgo: 2x2 Matrix

Evalúa opciones por impacto vs probabilidad:

```
                HIGH IMPACT
                    ↑
        │           │           │
        │  MITIGATE │ AVOID     │
        │           │           │
────────┼───────────┼───────────┼────→ PROBABILITY
        │ ACCEPT    │ MONITOR   │
        │           │           │
        │           ↓           │
                LOW IMPACT

EJEMPLOS:

OPCIÓN A: Monolito modular
├─ Risk: Escalabilidad limitada en 2 años
├─ Impact: High (need rewrite)
├─ Probability: Medium (may not scale that much)
├─ Position: "MONITOR + Plan B"
└─ Mitigation: Anual review, DDD limits


OPCIÓN B: Premature microservicios
├─ Risk: Operational complexity
├─ Impact: High (team productivity ↓)
├─ Probability: High (proven con small teams)
├─ Position: "AVOID"
└─ Reason: Not needed yet


OPCIÓN C: No cache
├─ Risk: Performance degradation
├─ Impact: High (users leave)
├─ Probability: High (at 100K+ users)
├─ Position: "MITIGATE"
└─ Action: Implement Redis now


OPCIÓN D: Synchronous everywhere
├─ Risk: Cascading failures
├─ Impact: High (whole system down)
├─ Probability: High (network happens)
├─ Position: "MITIGATE + AVOID"
├─ Action: Circuit breakers, timeouts, retries
└─ Alternative: Async critical paths
```

---

## Revisión Periódica de Decisiones

Arquitectura NO es set-and-forget:

```
Q1: "Está funcionando como esperado?"
├─ Métrica 1: Performance (p95 latency)
├─ Métrica 2: Throughput (RPS)
├─ Métrica 3: Errors (error rate)
├─ Métrica 4: Team velocity (features/sprint)
└─ Métrica 5: Operational load (incidents/week)

Q2: "Cambiaron los requisitos?"
├─ Usuario count: 10K → 100K? (10x)
├─ Traffic pattern: Steady → Spiky?
├─ Dominio: Más complejo?
├─ Equipo: Creció?
└─ Si sí a alguno: Reevalúa

Q3: "Qué salió mal vs plan?"
├─ Performance worse than expected?
├─ Operacional más complex?
├─ Costs higher?
├─ Team struggling?
└─ Aprender + documento ADR por qué

Q4: "Estamos listos para next step?"
├─ Escala actual: 

Próximo nivel?
├─ Complejidad: Monolito → Modular?
├─ Datos: SQL → SQL + NoSQL?
├─ Async: Agregar mensajes?
└─ Plan: 6-12 meses forward roadmap
```

### Revisión Template

```markdown
# Revisión Arquitectónica - Q2 2026

## Summary
- Current architecture: Monolito modular
- Status: ✅ Performing well
- Issue: P95 latency creeping up (45ms → 120ms)

## Metrics
| Métrica | Target | Actual | Status |
|---------|--------|--------|--------|
| P95 Latency | <100ms | 120ms | ⚠️ MISS |
| Error Rate | <1% | 0.8% | ✅ OK |
| Team velocity | 15 pts | 14 pts | ✅ OK |
| Incidents | <1/week | 0 | ✅ OK |

## Root Cause (P95 Latency)
- Users: 50K → 150K (3x growth)
- DB queries not indexed properly
- Cache not utilized

## Solution
1. Add 3 compound indexes (1 week)
2. Add Redis layer (2 weeks)
3. Monitor (ongoing)

## Decision
Continue with monolito modular.
Reevaluate microservicios if scales to 500K+

## Next Review
Q4 2026
```

---

## Resumen: Matriz de decisión rápida

| Escala | Monolito | Async | DB | Cache | Microservicios |
|--------|----------|-------|-----|-------|---|
| **Startup** | ✅ | ❌ | SQL 1 | ❌ | ❌ |
| **Growth** | ✅ Modular | Parcial | SQL 1-2 | Redis | ❌ |
| **Scale** | CQRS | ✅ | SQL + NoSQL | ✅ | ✅ Evaluar |
| **Enterprise** | Modular | ✅ | Múltiples | ✅ | ✅ |

---

## Preguntas Entrevista: Trade-offs Complejos

1. **"Tienes 1M usuarios, la latencia es 2s. ¿Qué haces?"**
   - Framework: Analizar, buscar bottleneck (DB? API?)
   - Opciones: Cache, índices, refactor, microservicios
   - Justificar: Por qué eliges una solución

2. **"Tu startup tiene presupuesto $100K pero 10M de potencial. ¿Arquitectura?"**
   - Startup: Monolito modular
   - Cash: Simple infra, 1 DB
   - Plan: Crecimiento sin rewrite

3. **"¿Cuándo cambiarias SQL a NoSQL?"**
   - Respuesta: Cuando JOINs sean problema OR escalabilidad crítica
   - Ejemplo: Analytics → Elasticsearch
   - Ejemplo: Documents → MongoDB

4. **"Heredas monolito en 3M usuarios. Performance degrada. Opciones?"**
   - Monitorea (antes de actuar)
   - Rápidas: Query optimization, índices, caché
   - Medium: Refactor hot paths
   - Largo: Microservicios (si realmente necesario)

---

**Última actualización:** 2026-03-27  
**Dificultad:** 🔴 Senior
