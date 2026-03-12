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
