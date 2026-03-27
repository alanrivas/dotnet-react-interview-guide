---
id: arquitectura-index
title: 🏗️ Arquitectura de Software
sidebar_position: 1
---

# Arquitectura de Software 🏗️

Bienvenido a la sección completa de Arquitectura de Software. Aquí encontrarás todo lo que necesitas para diseñar sistemas escalables y mantenibles a nivel Senior.

## 🎯 ¿Qué encontrarás aquí?

Esta sección está organizada en profundidad progresiva de temas:

### Fundamentos
- **[Estilos Arquitectónicos](./estilos-arquitectonicos.md)** — Monolítico, Modular, Microservicios y cuándo usar cada uno
- **[Domain-Driven Design](./domain-driven-design.md)** — Diseño orientado al dominio y Bounded Contexts
- **[Clean Architecture (Profundidad)](./clean-architecture-deep.md)** — La arquitectura limpia de Robert C. Martin

### Patrones y Principios
- **[Principios Arquitectónicos (SOLID)](./principios.md)** — SOLID, DRY, KISS y arquitectura hexagonal
- **[Patrones Avanzados](./patrones-avanzados.md)** — CQRS, Event Sourcing, Saga, Strangler Fig

### Decisiones y Trade-offs
- **[Trade-offs Arquitectónicos](./trade-offs.md)** — Cómo evaluar y justificar decisiones
- **[Anti-patrones](./anti-patrones.md)** — Errores comunes y cómo evitarlos

### Implementación y Testing
- **[Estrategias de Testing](./testing-strategies.md)** — Cómo testear cada arquitectura (Unit, Integration, E2E)
- **[Patrones de Migración](./migration-patterns.md)** — Evolucionar arquitectura sin parar el servicio (Strangler Fig, ACL)

### Tópicos Relacionados

También tenemos secciones complementarias en el sitio:
- 📊 [System Design](../system-design/) — Diseño de sistemas escalables
- 🔌 [Event-Driven Architecture](../event-driven/) — Arquitectura basada en eventos
- 🐳 [Microservicios](../microservicios/) — Arquitectura de microservicios profunda
- 🔒 [Seguridad](../seguridad/) — Principios de seguridad arquitectónica
- ⚡ [Performance](../performance/) — Optimización y rendimiento
- 📈 [Escalabilidad BD](../escalabilidad-bd/) — Escalado de datos

---

## 🚀 Cómo usar esta guía

### Para entrevistas técnicas
1. Comienza con [Estilos Arquitectónicos](./estilos-arquitectonicos.md)
2. Revisa [Clean Architecture (Profundidad)](./clean-architecture-deep.md)
3. Entiende [Domain-Driven Design](./domain-driven-design.md)
4. Prepárate con [Trade-offs](./trade-offs.md) para justificar decisiones

### Para diseñar un nuevo sistema
1. Define requerimientos y restricciones
2. Consulta [Trade-offs](./trade-offs.md) para elegir estilo
3. Aplica [Principios Arquitectónicos](./principios.md)
4. Documenta decisiones importantes en [Trade-offs](./trade-offs.md) con el patrón ADR
5. Revisa [Anti-patrones](./anti-patrones.md) para evitar errores

### Para mejorar código existente
1. Identifica el estilo actual
2. Consulta [Principios](./principios.md) y [Anti-patrones](./anti-patrones.md)
3. Planifica refactorización usando [Patrones Avanzados](./patrones-avanzados.md)
4. Documenta cambios importantes con ADR

---

## 🎯 Árbol de Decisión: ¿Qué Arquitectura Elegir?

```
¿Cuál es tu situación?
│
├─ STARTUP / MVP
│  ├─ Equipo pequeño (< 5 personas)
│  ├─ Timeline apretado
│  ├─ Presupuesto limitado
│  └─→ MONOLITO LAYERED CON SOLID
│      • Iteración rápida
│      • Deploy simple
│      • Fácil de debuggear
│
├─ CRECIMIENTO (Series A-B)
│  ├─ Equipo mediano (5-20 personas)
│  ├─ Necesidad de escalabilidad diferenciada
│  ├─ Dominios del negocio claros
│  └─→ MODULAR MONOLITH + DDD
│      • Preparación para microservicios
│      • Equipos semi-independientes
│      • Escalabilidad dentro del mismo proceso
│
├─ ESCALA ENTERPRISE
│  ├─ Múltiples equipos (20+ personas)
│  ├─ Alto tráfico y complejidad
│  ├─ Necesidad de deploys independientes
│  └─→ MICROSERVICIOS | EVENT-DRIVEN
│      • Escalabilidad y redundancia
│      • Autonomía de equipos
│      • Tecnologías heterogéneas
│
└─ SISTEMA LEGADO
   ├─ Código antiguo, sin estructura clara
   ├─ Necesidad de evolucionar sin reescribir
   └─→ STRANGLER FIG PATTERN
       • Extrae funcionalidad gradualmente
       • Minimiza riesgo
       • Transición suave a nueva arquitectura
```

---

## 📋 Evaluación Rápida: Matrix de Requisitos vs Arquitectura

| Requisito | Monolito | Modular | Microservicios | Event-Driven |
|-----------|----------|---------|---|---|
| **Velocidad de desarrollo inicial** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Escalabilidad diferenciada** | ❌ | Parcial | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Independencia de equipos** | ❌ | Parcial | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Consistencia de datos** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Debugging / Trazabilidad** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Costo operacional** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |
| **Complejidad de testing** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐ |
| **Tolerancia a fallos** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Curva de aprendizaje** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ |

**Léase:** Más ⭐ = mejor en ese aspecto para esa arquitectura

---

## 🛠️ Checklist: ¿Estás Listo para...?

### ✓ MONOLITO (Layered + SOLID)

- [ ] Has definido claramente las responsabilidades de cada capa
- [ ] Usas inyección de dependencias
- [ ] Las dependencias apuntan hacia el nivel más profundo (arquitectura hexagonal)
- [ ] Tienes tests automatizados (unitarios + integración)
- [ ] Documentas ADRs para decisiones importantes
- **¿Falta algo?** → Lee [Principios Arquitectónicos](./principios.md)

### ✓ MODULAR MONOLITH (Monolito modular + DDD)

- [ ] Has identificado Bounded Contexts claros
- [ ] Cada módulo es independiente (podría extraerse a microservicio)
- [ ] Comunicación entre módulos es explícita (eventos o interfaces)
- [ ] Existe "contrato" claro entre módulos
- [ ] Tests de integración entre módulos
- [ ] Documentas Context Maps (relaciones entre contextos)
- **¿Falta algo?** → Lee [Domain-Driven Design](./domain-driven-design.md)

### ✓ MICROSERVICIOS

- [ ] Cada servicio tiene una razón de ser (Bounded Context)
- [ ] Servicios pueden deployarse de forma independiente
- [ ] Communication patterns están definidas (síncrono, eventos, etc.)
- [ ] Has pensado en consistencia eventual
- [ ] Tienes estrategia de observabilidad (logging, tracing, metrics)
- [ ] Deploy automation está en lugar
- [ ] Has considerado monitoreo y alertas
- **¿Falta algo?** → Lee [Estilos Arquitectónicos](./estilos-arquitectonicos.md)

### ✓ EVENT-DRIVEN

- [ ] Eventos están bien definidos (qué información llevan)
- [ ] Tenés un event bus o message broker (RabbitMQ, Kafka, etc.)
- [ ] Manejadores de eventos son idempotentes (pueden ejecutarse múltiples veces)
- [ ] Existe estrategia de dead lettering (qué pasa cuando falla)
- [ ] Tests de eventos integrados
- [ ] Monitoreo de lag (qué tan atrasados están los consumidores)
- **¿Falta algo?** → Lee [Patrones Avanzados](./patrones-avanzados.md)

---

## 🧠 Matriz: Roles vs Enfoque de Lectura

### Si eres **Arquitecto**
Comienza por entender **por qué** se elige cada patrón:

1. [Estilos Arquitectónicos](./estilos-arquitectonicos.md) — Compara opciones
2. [Trade-offs Arquitectónicos](./trade-offs.md) — Entiende el costo de cada decisión
3. [Domain-Driven Design](./domain-driven-design.md) — Diseñando alrededor del dominio
4. [Principios Arquitectónicos](./principios.md) — Criterios de calidad

### Si eres **Senior Engineer / Tech Lead**
Necesitas implementar decisiones:

1. [Principios Arquitectónicos](./principios.md) — Cómo estructurar código
2. [Clean Architecture (Profundidad)](./clean-architecture-deep.md) — Patrón práctico probado
3. [Domain-Driven Design](./domain-driven-design.md) — Modelado estratégico
4. [Patrones Avanzados](./patrones-avanzados.md) — Cuando el sistema escala
5. [Anti-patrones](./anti-patrones.md) — Qué evitar

### Si estás en **Entrevista Técnica**
Demuestra pensamiento arquitectónico profundo:

1. [Trade-offs Arquitectónicos](./trade-offs.md) — Justifica tus decisiones
2. [Estilos Arquitectónicos](./estilos-arquitectonicos.md) — Conoce las opciones
3. [Domain-Driven Design](./domain-driven-design.md) — Modela el problema
4. [Principios Arquitectónicos](./principios.md) — Cita principios SOLID
5. [Anti-patrones](./anti-patrones.md) — Muestra lo que NO harías

### Si necesitas **Actualizar un Sistema Existente**
Sigue este flujo:

1. [Anti-patrones](./anti-patrones.md) — Identifica problemas actuales
2. [Principios Arquitectónicos](./principios.md) — Define calidad esperada
3. [Patrones Avanzados](./patrones-avanzados.md) — Extrae y moderniza gradualmente
4. [Trade-offs Arquitectónicos](./trade-offs.md) — Documenta cambios con ADR

---

## 📊 Evolución de una arquitectura

```
STARTUP (MVP)
  ↓ — Monolito bien estructurado (Layered + principios SOLID)
  ↓ — Crece, buscas escalar
  ↓
SCALING
  ↓ — Identificas límites del dominio → DDD
  ↓ — Equipos crecen independientes → Event-Driven/Microservicios
  ↓
ENTERPRISE
  ↓ — Múltiples dominios, equipos distribuidos
  ↓ — Event Sourcing, CQRS, saga orchestration
  ↓
EVOLUTION
  ↓ — Recolectas métricas (observabilidad)
  ↓ — Refinás patrones iterativamente
```

---

## 🎓 Conceptos clave

| Concepto | ¿Qué es? | ¿Cuándo lo necesitas? |
|----------|---------|--------|
| **Layering** | Separación en capas lógicas | Siempre, incluso en monolitos pequeños |
| **DDD** | Orientar diseño al negocio | Cuando el dominio es complejo |
| **CQRS** | Separar lectura de escritura | Cuando patrones de lectura/escritura difieren |
| **Event Sourcing** | Persistir eventos, no estado | Cuando necesitas audit log completo |
| **Microservicios** | Servicios independientes | Cuando necesitas escalar diferenciado |
| **SOLID** | Principios de diseño | Siempre, en todo nivel de código |

---

## 💡 Reglas de Oro de la Arquitectura

### 1. YAGNI (You Aren't Gonna Need It)
> **No construyas para un problema que no tienes.** Comienza simple, agrega complejidad cuando sea necesario.

```
❌ INCORRECTO: "Voy a usar microservicios porque pueden escalar"
   (Tu startup tiene 10 usuarios)

✅ CORRECTO: "Haré un monolito bien estructurado. Si llego a 100K RPS, 
   usaré los límites lógicos ya definidos para extraer servicios"
```

### 2. KISS (Keep It Simple, Stupid)
> **La arquitectura más simple que resuelve el problema es la mejor.**

```
COMPLEJIDAD cronológica:
Tiempo 0: Monolito layered + SOLID
   ↓ (después de 1 año, 50M requisiciones/mes)
Tiempo 1: Modular monolith + DDD
   ↓ (después de 3 años, 1B requisiciones/mes)
Tiempo 2: Microservicios + Event-Driven
```

### 3. Comienza con boundaries lógicos
> **Incluso en un monolito, define límites claros (Bounded Contexts).** Estos límites te permitirán extraer servicios después sin reescribir.

```csharp
// HOY: Todo en un binario
OurApp.dll
  └─ Orders (limite lógico)
     ├─ Models
     ├─ Services
     └─ Repositories
  └─ Inventory (limite lógico)
  └─ Payments (limite lógico)

// MAÑANA: Extraes a microservicios sin cambiar la lógica
orders-service.dll
inventory-service.dll
payments-service.dll
```

---

## 📝 Preguntas típicas en entrevistas

### Nivel 1: Comprensión Teórica

**P: "¿Cuál es la diferencia entre arquitectura por capas y Clean Architecture?"**  
R: Ambas usan capas, pero Clean se enfoca en inversión de dependencias. Lee [Clean Architecture (Profundidad)](./clean-architecture-deep.md) para ver ejemplos concretos.

**P: "¿Qué es Domain-Driven Design y por qué importa?"**  
En 30 segundos: DDD alinea código con el negocio, usa Bounded Contexts para organizar sistemas grandes.  
Detalle: [Domain-Driven Design](./domain-driven-design.md)

**P: "¿Cuáles son los principios SOLID?"**  
Leer [Principios Arquitectónicos](./principios.md) con ejemplos de violación + corrección.

### Nivel 2: Decisión y Trade-offs

**P: "¿Cuándo es apropiado usar microservicios?"**  
No es "siempre". Es cuando:
- Team > 10 personas
- Patrones de escalabilidad muy diferentes
- Necesidad de deploys independientes
- Lee [Estilos Arquitectónicos](./estilos-arquitectonicos.md) para la matriz completa

**P: "¿Cuándo usarías CQRS y cuándo NO?"**  
Consulta [Patrones Avanzados](./patrones-avanzados.md) — Sección CQRS tiene el checklist.

**P: "¿Cómo manejarías transacciones distribuidas en microservicios?"**  
Opciones: Saga (orquestación), Saga (coreografía), o event sourcing.  
Ver: [Patrones Avanzados](./patrones-avanzados.md) — Sección Saga Pattern

### Nivel 3: Diseño de Sistemas Completos

**P: "Diseña la arquitectura de un sistema de marketplace con millones de usuarios"**  
Sigue este framework:
1. Define requerimientos (RPS, latencia, escalabilidad)
2. Elige estilo base (likely: Microservicios)
3. Identifica Bounded Contexts (Sellers, Orders, Payments, Reviews)
4. Define comunicación (sincrónica para pagos, eventos para notificaciones)
5. Explica trade-offs (consistencia eventual aceptada, observabilidad crítica)

Recursos: [Trade-offs Arquitectónicos](./trade-offs.md) + [Estilos Arquitectónicos](./estilos-arquitectonicos.md)

**P: "Heredas un monolito caótico. ¿Cómo lo mejoras sin reescribir?"**  
Respuesta estructurada:
1. Identifica anti-patrones actuales ([Anti-patrones](./anti-patrones.md))
2. Define principios de calidad ([Principios Arquitectónicos](./principios.md))
3. Extrae funcionalidad gradualmente (Strangler Fig en [Estilos Arquitectónicos](./estilos-arquitectonicos.md))
4. Documenta cambios (ADR en [Trade-offs Arquitectónicos](./trade-offs.md))

---

## 🚀 Estrategia de Respuestas en Entrevistas

**ESTRUCTURA GANADORA para cualquier pregunta arquitectónica:**

```
1. CONTEXTO
   "Para responder bien, necesito entender..."
   - Escala (usuarios, RPS, volumen datos)
   - Requerimientos funcionales
   - Restricciones (presupuesto, timing, equipo)

2. OPCIONES
   "Las opciones principales son..."
   (Lista 2-3 arquitecturas viables)

3. ANÁLISIS
   "Cada opción tiene trade-offs..."
   (Pros y contras con números si es posible)

4. RECOMENDACIÓN
   "Yo elegiría... porque..."
   (La opción con mejor relación costo/beneficio)

5. IMPLEMENTACIÓN
   "Para implementarla..."
   (Pasos concretos, herramientas, equipos)

6. MITIGACIÓN
   "Los riesgos principales son..."
   (Qué podría salir mal, cómo prepararse)
```

Ejemplo aplicado:

> P: "Diseña un feed de redes sociales para 100M usuarios"
>
> R: "Para responder bien: ¿Qué latencia esperamos (~100ms)? ¿Consistencia eventual OK? ¿Equipo tamaño?
>
> Opciones: (a) Monolito con caché, (b) Microservicios, (c) Event-sourcing
>
> Trade-offs: Monolito es simple pero feed service será cuello de botella. Microservicios escala pero requiere equipo 20+.
>
> Mi recomendación: Microservicios con capa de caché (Redis) y event-driven para notifications. Feed es read-heavy, lo optimizamos separately.
>
> Mitigación: Testing en producción, gradual rollout con feature flags, observabilidad día 1."

---

## 🔗 Recursos externos recomendados

- 📖 *Clean Architecture* — Robert C. Martin
- 📖 *Domain-Driven Design* — Eric Evans
- 📖 *Building Microservices* — Sam Newman
- 📖 *Enterprise Integration Patterns* — Gregor Hohpe
- 🎬 [System Design Master Course](https://www.youtube.com/results?search_query=system+design) — YouTube

---

**Última actualización:** 2026-03-27  
**Dificultad:** 🔴 Senior
