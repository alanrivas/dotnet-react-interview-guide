---
id: liderazgo-tecnico
title: Liderazgo Técnico
sidebar_position: 8
---

# Liderazgo Técnico 🔴

## El rol del Tech Lead / Senior Developer

En entrevistas Senior, además de preguntas técnicas, evaluarán tu capacidad para:

- Tomar decisiones técnicas y defenderlas con argumentos
- Mentorear a developers junior/semi-senior
- Comunicar soluciones técnicas a stakeholders no técnicos
- Manejar deuda técnica estratégicamente
- Balancear velocidad vs calidad

---

## Code Review — Buenas prácticas

### Qué revisar

```
✅ Revisar:
- Correctitud: ¿hace lo que dice que hace?
- Seguridad: ¿hay vulnerabilidades?
- Performance: ¿hay cuellos de botella obvios?
- Mantenibilidad: ¿se puede entender en 6 meses?
- Tests: ¿cubren los casos importantes?
- Nombrado: ¿variables y métodos tienen nombres claros?

❌ No obsesionarse con:
- Estilo de código (para eso están los linters)
- Preferencias personales sin justificación
- Reescribir todo porque "yo lo haría diferente"
```

### Cómo dar feedback constructivo

```
❌ Mal: "Este código es una porquería"
❌ Mal: "¿Por qué harías esto?"
❌ Mal: "Nunca hagas X"

✅ Bien: "Creo que aquí podría haber un bug si [caso]. ¿Consideraste X?"
✅ Bien: "Nit: podría renombrarse a X para ser más descriptivo (opcional)"
✅ Bien: "Sugiero considerar Y porque [razón técnica]. ¿Qué opinas?"
✅ Bien: "¡Gran idea! Pequeña sugerencia: ..."
```

---

## Manejo de Deuda Técnica

```
Cuadrante de deuda técnica:

                 DELIBERADA        ACCIDENTAL
              ┌──────────────┬──────────────────┐
   PRUDENTE   │ "Sabemos que │ "Ahora entendemos│
              │ esto no es   │ que debíamos     │
              │ correcto,    │ haberlo hecho    │
              │ pero lo      │ de otra manera"  │
              │ haremos así  │                  │
              │ por el       │                  │
              │ deadline"    │                  │
              ├──────────────┼──────────────────┤
   IMPRUDENTE │ "No hay      │ "¿Qué es         │
              │ tiempo para  │ diseño?"         │
              │ el diseño"   │                  │
              └──────────────┴──────────────────┘
```

### Estrategia para manejarla

```csharp
// 1. Identificar y documentar (no ignorar)
// TODO(tech-debt): Este servicio necesita refactoring cuando tengamos más tests
// Issue #234: Migrar de sync a async

// 2. Priorizar por impacto
// Alta: deuda en código de alta frecuencia, código difícil de cambiar
// Baja: deuda en código legacy que casi nadie toca

// 3. La regla del Boy Scout: "Dejar el código mejor de como lo encontraste"
// No tienes que refactorizar todo, pero mejora algo cada vez que tocas el código

// 4. Negociar con el negocio
// "Si pagamos esta deuda técnica ahora (2 sprints), la próxima feature
// tardará 3 semanas en vez de 3 meses"
```

---

## Estimación de tareas

```
Técnicas comunes:

1. STORY POINTS (Fibonacci: 1, 2, 3, 5, 8, 13, 21)
   - Mide complejidad relativa, no tiempo
   - Calibrar en base a una "tarea de referencia"
   - Velocidad del equipo se estabiliza con el tiempo

2. T-SHIRT SIZING (XS, S, M, L, XL)
   - Más rápido, menos preciso
   - Útil para planning de alto nivel

3. THREE-POINT ESTIMATION
   - Optimista + Pesimista + Más probable
   - E = (O + 4M + P) / 6

Tips:
- Incluir: desarrollo + tests + code review + deploy + buffer
- Si supera M/L, partir en subtareas
- "No sé" es una respuesta válida, seguida de "necesito investigar X horas"
```

---

## Architectural Decision Records (ADR)

Documentar decisiones técnicas importantes y su contexto.

```markdown
# ADR 001: Usar PostgreSQL en vez de SQL Server

## Fecha: 2024-01-15

## Estado: Aceptado

## Contexto
Necesitamos una base de datos relacional para el nuevo proyecto.
El equipo tiene experiencia en SQL Server pero el cliente tiene 
restricciones de presupuesto en licencias.

## Decisión
Usar PostgreSQL 16 con EF Core.

## Consecuencias
✅ Costo: open source, sin licencias
✅ Funcionalidades: JSON nativo, full-text search, extensiones
✅ Portabilidad: puede correr en cualquier cloud o on-premise
❌ Curva de aprendizaje: algunos dev solo conocen SQL Server
❌ Diferencias de sintaxis: algunas queries necesitan ajuste

## Alternativas consideradas
- SQL Server: descartado por costo de licencias
- MySQL: descartado por menos funcionalidades avanzadas
- MongoDB: descartado porque los datos son relacionales
```

---

## Preguntas conductuales (STAR method)

En entrevistas Senior, esperan preguntas conductuales. Responder con **STAR**:
- **S**ituation: contexto
- **T**ask: cuál era tu responsabilidad
- **A**ction: qué hiciste específicamente  
- **R**esult: cuál fue el resultado (con métricas si es posible)

### Preguntas frecuentes y cómo prepararlas

**"Cuéntame de un sistema que diseñaste y qué cambiarías hoy"**
> Prepara 1-2 sistemas que hayas diseñado. Menciona las decisiones técnicas, trade-offs, y qué aprendiste. Mostrar humildad técnica ("hoy lo haría diferente porque...") es positivo.

**"¿Cómo manejas un desacuerdo técnico con un colega?"**
> Proceso: escuchar su perspectiva, presentar datos/argumentos, buscar consenso. Si no hay consenso, escalar al tech lead o hacer un spike para validar ambas opciones.

**"¿Cómo priorizas cuando todo parece urgente?"**
> Impacto × Urgencia ÷ Esfuerzo. Comunicar claramente con stakeholders. Decir "no" con contexto técnico cuando es necesario.

**"¿Cómo mentorearías a un developer Junior?"**
> Code reviews constructivos, pair programming, explicar el "por qué" no solo el "qué", dar tareas con ownership progresivo, celebrar sus éxitos.

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo decides entre construir una solución custom vs usar una librería/servicio externo?**
> Evalúo: ¿cuánto tiempo requiere implementar vs integrar? ¿La librería está activamente mantenida? ¿Es un core business concern (sería una ventaja competitiva construirlo)? ¿Cuál es la complejidad de migración futura? Regla general: **no reinventar la rueda para commodities** (auth, email, storage). Sí construir lo que es diferenciador del negocio.

**2. ¿Cómo comunicarías una decisión técnica compleja a un stakeholder no técnico?**
> Con analogías del mundo real, focalizando en el impacto de negocio (tiempo, dinero, riesgo), evitando jerga técnica, presentando opciones con trade-offs claros. Ejemplo: "Migrar la base de datos es como remodelar los cimientos de un edificio: requiere 2 semanas de trabajo, pero sin hacerlo el edificio no puede crecer más allá de 3 pisos."

**3. ¿Cuánto código es "suficiente" testear?**
> El 100% de cobertura no significa 0 bugs. Priorizar: lógica de negocio crítica, edge cases conocidos, regresiones de bugs previos. No testear: código trivial (getters/setters), código generado. El objetivo es confianza para hacer cambios, no un número.

---

## Onboarding Técnico — Primeros 90 días

Como Tech Lead, eres responsable de que los nuevos integrantes sean productivos rápido y se integren bien.

```
Semana 1: Orientación
  □ Setup del entorno de desarrollo (documentado, idealmente automatizado)
  □ Primera PR pequeña el día 2-3 (aunque sea de docs o un bug trivial)
  □ Explicar el "por qué" de las decisiones de arquitectura, no solo el "qué"
  □ Presentar a las personas clave del equipo y sus áreas

Mes 1: Exploración
  □ Pair programming en al menos 2 features
  □ Que el nuevo revise PRs de otros (aprende leyendo código real)
  □ Primera 1:1 formal para detectar bloqueos o dudas
  □ Asignar un "buddy" del equipo (no el Tech Lead)

Mes 2-3: Contribución creciente
  □ Features completas con autonomía, Tech Lead disponible para preguntas
  □ Que el nuevo presente algo técnico al equipo (fuerza a aprender)
  □ Evaluación informal: ¿en qué está atascado? ¿qué le resulta confuso?
```

---

## 1:1s Efectivos con Desarrolladores

Las 1:1s no son status updates (eso es para los stand-ups). Son para la persona.

```
Lo que NO es una 1:1:
  ❌ "¿Cómo va el ticket JIRA-123?"
  ❌ Un monólogo del Tech Lead
  ❌ Solo cuando hay un problema

Lo que SÍ es una 1:1:
  ✅ "¿Qué te está bloqueando? ¿Qué te está frustrando?"
  ✅ "¿En qué área quieres crecer en los próximos 6 meses?"
  ✅ "¿Hay algo en el equipo que podría mejorar?"
  ✅ Feedback bidireccional (también pide feedback sobre ti)
```

### Preguntas poderosas para 1:1s

```
Sobre el trabajo actual:
  - "¿Cuál fue el momento más frustrante de la última semana?"
  - "¿Hay algo en lo que necesitas más contexto o apoyo?"

Sobre el crecimiento:
  - "¿Qué tipo de tarea te gustaría tener más en los próximos meses?"
  - "¿Hay alguna tecnología o área que quieras explorar?"

Sobre el equipo:
  - "¿Hay algo en la forma en que trabajamos que mejorarías?"
  - "¿Sientes que tus contribuciones son reconocidas?"
```

---

## Roadmap Técnico — Cómo construirlo

Un roadmap técnico comunica hacia dónde va la arquitectura y por qué.

```
Estructura de un roadmap técnico:

NOW (0-3 meses)
  ├── Migrar autenticación a OAuth 2.0 + PKCE
  │   Por qué: vulnerabilidad en el flujo actual (issue SEC-045)
  │   Por quién: Equipo Backend
  │   Métrica de éxito: 0 endpoints con auth por cookie de sesión
  │
  └── Instrumentar OpenTelemetry en todos los servicios
      Por qué: sin trazabilidad distribuida, cada outage tarda 4h en diagnosticar
      Por quién: Plataforma
      Métrica: p99 de tiempo de diagnóstico < 30 min

NEXT (3-6 meses)
  ├── Extraer servicio de Notificaciones del monolito (Strangler Fig)
  └── Migrar tests de integración a TestContainers

LATER (6-12 meses)
  ├── Evaluar migración a .NET 9 (cuando salga LTS)
  └── Implementar feature flags para deploys sin riesgo
```

**Cómo presentarlo a stakeholders no técnicos:**

```
❌ "Vamos a implementar OpenTelemetry con Jaeger para distributed tracing"
✅ "Actualmente cuando el sistema falla, tardamos un promedio de 4 horas en
   encontrar la causa. Con esta inversión de 3 semanas, bajaremos eso a
   menos de 30 minutos, reduciendo el impacto en usuarios."
```

---

## Manejo de Conflictos Técnicos en el Equipo

Dos desarrolladores tienen opiniones técnicas opuestas. ¿Cómo lo manejas?

```
Proceso recomendado:

1. ESCUCHAR AMBAS POSICIONES
   Cada posición probablemente tiene mérito.
   "Cuéntame más sobre por qué propones X..."

2. EXTERNALIZAR EL DEBATE
   Escribir ambas opciones con pros/cons en un doc compartido.
   Esto despersonaliza el conflicto — ya no es A vs B, sino Opción 1 vs Opción 2.

3. APLICAR CRITERIOS OBJETIVOS
   - ¿Cuál opción es más fácil de revertir si nos equivocamos?
   - ¿Cuál opción está mejor probada en nuestro tipo de sistema?
   - ¿Cuál opción el equipo puede mantener en 2 años?

4. SPIKE SI HAY INCERTIDUMBRE TÉCNICA
   Timeboxed (1-2 días): cada posición prueba su solución.
   Los datos hablan más que las opiniones.

5. DECIDIR Y DOCUMENTAR
   Usar un ADR para registrar la decisión y el contexto.
   Una vez decidido, todos ejecutan en la misma dirección.
```

---

## Métricas de Salud del Equipo y Código

Un Tech Lead no solo mira el código — mira las señales del sistema más amplio.

```
Métricas de código (DORA):
  Deployment Frequency   → ¿Cada cuánto desplegamos?
  Lead Time for Changes  → ¿Cuánto desde commit hasta producción?
  Change Failure Rate    → ¿Qué % de deploys requiere rollback?
  Time to Restore        → ¿Cuánto tardamos en recuperarnos de un incidente?

Señales de deuda técnica acumulándose:
  ⚠️  Las estimaciones son cada vez más imprecisas
  ⚠️  Los bugs regresionan (arreglamos algo y rompe otra cosa)
  ⚠️  Las onboardings son lentas (nadie entiende bien el sistema)
  ⚠️  Miedo a tocar ciertos módulos ("ese código no lo toca nadie")

Señales de problemas en el equipo:
  ⚠️  PRs que tardan días en ser revisadas
  ⚠️  Desarrolladores que rara vez piden ayuda
  ⚠️  Silencio en las retrospectivas
  ⚠️  Estimaciones siempre conservadoras o siempre optimistas
```

---

## Preguntas adicionales de entrevista 🎯

**4. ¿Cómo construirías un roadmap técnico alineado con el negocio?**
> Primero entiendo las prioridades del negocio para los próximos 6-12 meses. Luego mapeo qué limitaciones técnicas actuales bloquean o ralentizan esas prioridades. El roadmap técnico resulta de conectar esas dos perspectivas — no es una lista de deseos tecnológicos, sino inversiones técnicas con ROI de negocio claro. Cada ítem del roadmap debe responder: "¿Qué problema de negocio resuelve esto?"

**5. ¿Cómo manejarías a un desarrollador que consistentemente entrega tarde?**
> Primero en una 1:1 privada, sin asumir intención maliciosa. Podría ser falta de claridad en los requerimientos, bloqueos técnicos que no escaló, o problemas personales. Identifico la causa raíz antes de actuar. Si es capacidad técnica, pair programming y mentoring. Si es comunicación, trabajamos en dividir tareas más pequeñas y pedir ayuda antes. Si persiste después de apoyo y claridad de expectativas, escalo a management.

**6. ¿Cuál es la diferencia entre un Tech Lead y un Engineering Manager?**
> El Tech Lead es principalmente técnico: diseña arquitecturas, hace code reviews, establece estándares de ingeniería, es el referente técnico del equipo. El Engineering Manager es principalmente de personas y procesos: gestiona carreras, contrata, maneja conflictos interpersonales, planifica capacidad. Muchas empresas tienen ambos roles; en equipos pequeños una persona puede cubrir ambos, pero hay que ser consciente de cuándo priorizas cada hat.
