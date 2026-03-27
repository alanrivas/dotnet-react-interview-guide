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

## Resumen: Matriz de decisión rápida

| Escala | Monolito | Async | DB | Cache | Microservicios |
|--------|----------|-------|-----|-------|---|
| **Startup** | ✅ | ❌ | SQL 1 | ❌ | ❌ |
| **Growth** | ✅ Modular | Parcial | SQL 1-2 | Redis | ❌ |
| **Scale** | CQRS | ✅ | SQL + NoSQL | ✅ | ✅ Evaluar |
| **Enterprise** | Modular | ✅ | Múltiples | ✅ | ✅ |

**Última actualización:** 2026-03-27
