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

## 💡 Regla de Oro

> **"No empieces con complejidad. Comienza con un monolito bien estructurado, y extrae servicios cuando tengas necesidades claras de escalado diferenciado o equipos independientes."**

---

## 📝 Preguntas típicas en entrevistas

- ¿Qué estilo arquitectónico elegirías para una red social con 100M usuarios?
- Explica la diferencia entre arquitectura por capas y Clean Architecture
- ¿Cuándo es apropiado usar microservicios?
- ¿Qué es Domain-Driven Design y por qué es importante?
- Diseña la arquitectura de un sistema de marketplace
- ¿Cómo manejarías transacciones distribuidas en microservicios?
- Explica CQRS y cuándo lo usarías
- ¿Cuál es la relación entre DDD y microservicios?

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
