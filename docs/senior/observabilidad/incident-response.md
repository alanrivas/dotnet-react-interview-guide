---
id: incident-response
title: Incident Response & Post-Mortems
sidebar_position: 16
---

# Incident Response & Post-Mortems 🔴

Saber diseñar sistemas es necesario para un rol senior. Saber gestionar cuando fallan es lo que diferencia a un senior de un tech lead. En entrevistas senior de empresas medianas y grandes, esta es una pregunta casi obligatoria.

---

## ¿Qué es un incidente?

Un incidente es cualquier evento que afecta negativamente la disponibilidad, performance o integridad de un sistema en producción y requiere intervención humana inmediata.

```
Ejemplos de incidentes:
  P1 — Crítico:  API de pagos caída al 100%, pérdida de revenue activa
  P2 — Alto:     Degradación severa (latencia x10), errores al 30% de usuarios
  P3 — Medio:    Feature no crítica caída, afecta <10% de usuarios
  P4 — Bajo:     Bug visible, sin impacto en funcionalidad core

La severidad define la urgencia de la respuesta y quién se convoca.
```

---

## Las 5 fases del incident response

```
1. DETECCIÓN    → Alerta automática o reporte de usuario
2. TRIAGE       → ¿Qué tan grave es? ¿A quién convoco?
3. CONTENCIÓN   → Detener el sangrado, aunque no sea la solución perfecta
4. RESOLUCIÓN   → Fix o workaround permanente
5. POST-MORTEM  → Entender qué pasó y prevenir recurrencias
```

---

## Fase 1: Detección

Un buen sistema detecta problemas antes que los usuarios:

```
Síntomas que disparan alertas automáticas:
  Error rate   > 1% por 5 minutos     → PagerDuty/OpsGenie alerta al on-call
  Latencia p99 > 2000ms por 3 minutos → alerta de degradación
  CPU/Memoria  > 90% por 5 minutos    → alerta de capacidad
  Health check falla 3 veces seguidas → alerta de disponibilidad
  Deployment detectado + error spike  → alerta de regresión

Herramientas: Application Insights, Datadog, Prometheus + Alertmanager,
              AWS CloudWatch, Azure Monitor
```

---

## Fase 2: Triage — los primeros 5 minutos

```
Preguntas que responder en los primeros 5 minutos:

  1. ¿Qué está fallando?
     → Ver dashboards de error rate, latencia, disponibilidad
     → ¿Es un servicio específico o todo el sistema?

  2. ¿Cuándo empezó?
     → Correlacionar con deployments recientes
     → "¿Alguien deployó algo en los últimos 30 minutos?"

  3. ¿A quién afecta?
     → ¿Todos los usuarios o un subconjunto?
     → ¿Una región, un tenant, un plan?

  4. ¿Cuál es el impacto de negocio?
     → ¿Hay pérdida de revenue? ¿Cuánto por minuto?
     → ¿Hay datos en riesgo?

  5. ¿Hay un fix obvio e inmediato?
     → ¿Rollback? ¿Feature flag off? ¿Reinicio del servicio?
```

---

## Fase 3: Contención — detener el sangrado primero

**Principio clave:** La prioridad es restaurar el servicio, no encontrar la causa raíz.

```csharp
// Herramientas de contención inmediata:

// 1. Rollback de deployment (si el incidente coincide con un deploy)
// git revert HEAD && git push → pipeline lo despliega
// O más rápido: revertir en la UI del CI/CD (GitHub Actions, Azure DevOps)

// 2. Feature flag off (si la feature nueva está causando el problema)
// Apagar el flag en Azure App Configuration, LaunchDarkly, etc.
// → sin deploy, sin rollback, instantáneo

// 3. Escalar horizontal (si es problema de capacidad)
// kubectl scale deployment mi-api --replicas=10
// O en Azure: aumentar instancias en el App Service Plan

// 4. Redirigir tráfico (si es un nodo específico)
// Sacar el nodo enfermo del load balancer
// az network application-gateway backend-pool update...

// 5. Activar modo mantenimiento / circuit breaker manual
// Devolver 503 con retry-after header en lugar de errores aleatorios
// → mejor UX que errores inesperados
```

### Comunicación durante la contención

```
Canal de incidente (Slack #incident-YYYYMMDD-breve-descripcion):

[10:03] @oncall: 🔴 INCIDENTE ACTIVO — API de pagos con 45% error rate
        Empezó: ~09:58. Último deploy: 09:45 por @dev1
        Impacto: pagos fallando, ~$2K/min de revenue perdido
        Acción: investigando rollback del deploy de 09:45

[10:07] @oncall: Ejecutando rollback del commit abc123

[10:11] @oncall: Rollback completado. Error rate bajando... 20%... 5%... <1%
        ✅ Servicio restaurado. Duracion: ~13 minutos

[10:12] @oncall: Notificando a stakeholders. Post-mortem mañana 10:00.
```

**Regla:** comunicar proactivamente cada 15-30 minutos aunque no haya novedades. El silencio genera más ansiedad que las malas noticias.

---

## Roles en un incidente

```
Incident Commander (IC):
  → Coordina la respuesta, toma decisiones finales
  → NO hace debugging — delega y coordina
  → Mantiene el canal de comunicación actualizado
  → En incidentes pequeños: el mismo on-call

Technical Lead:
  → Lidera la investigación técnica
  → Propone y ejecuta la contención/fix
  → Reporta hallazgos al IC

Communications Lead (en incidentes grandes):
  → Actualiza a stakeholders internos (management, CS, ventas)
  → Redacta comunicaciones externas (status page, emails a clientes)
  → El IC no debería estar escribiendo emails mientras debuggea

Scribe:
  → Documenta en tiempo real: timeline, decisiones, comandos ejecutados
  → Crítico para el post-mortem
  → Puede ser el mismo IC en incidentes pequeños
```

---

## Runbooks — respuestas pre-escritas

Un runbook es una guía paso a paso para diagnosticar y resolver un tipo específico de incidente. Se escribe en calma para ejecutarse bajo presión.

```markdown
# Runbook: Alta latencia en API de Pedidos

## Síntomas
- Alerta "PedidosAPI_HighLatency" en PagerDuty
- p99 latencia > 2000ms por más de 3 minutos

## Diagnóstico rápido (< 5 min)

### 1. Verificar deployments recientes
  - GitHub Actions: https://github.com/org/repo/actions
  - ¿Hay un deploy en las últimas 2 horas?

### 2. Verificar base de datos
  - Azure Portal → SQL Database → Query Performance Insight
  - Buscar queries lentas (> 1000ms)
  - Verificar CPU/DTUs del servidor de BD

### 3. Verificar dependencias externas
  - curl https://api.pagos.com/health
  - ¿El servicio de pagos está lento?

## Acciones de contención

### Si hay deploy reciente → Rollback
  1. GitHub Actions → último workflow exitoso anterior → "Re-run jobs"
  2. O: git revert <commit> en main → push → esperar pipeline

### Si es la base de datos → Matar queries lentas
  SELECT session_id, status, command, wait_type, sql_text
  FROM sys.dm_exec_requests
  WHERE total_elapsed_time > 30000

  KILL <session_id>  -- para queries que llevan > 30s

### Si es una dependencia externa → Activar circuit breaker
  - Azure App Configuration → Feature Flags
  - Apagar flag "ServicioPagosExterno"
  - App usará respaldo local hasta recuperación

## Escalación
  Si no se resuelve en 15 min: escalar a @tech-lead en #incident
  Si hay pérdida de datos confirmada: escalar a @cto inmediatamente
```

---

## Fase 5: Post-Mortem

El post-mortem es la reunión (y documento) que analiza el incidente para entender qué pasó y cómo evitar que se repita.

### Principios del blameless post-mortem

```
❌ "Juan deployó sin tests y tumbó producción"
   → Busca culpables → la gente oculta errores → cultura de miedo

✅ "El pipeline no bloqueó un deploy con tests fallidos"
   → Busca causas sistémicas → la gente es honesta → mejora continua

Filosofía: las personas no fallan intencionalmente.
Si un sistema permite que un error humano cause un outage,
el sistema tiene un problema de diseño.
```

### Plantilla de post-mortem

```markdown
# Post-Mortem: [Título descriptivo]
**Fecha del incidente:** 2026-03-30
**Duración:** 13 minutos (09:58 – 10:11)
**Severidad:** P1
**Redactado por:** @oncall

## Resumen ejecutivo (2-3 oraciones)
La API de pagos estuvo caída 13 minutos por un deploy que introdujo
una query sin índice. El deploy fue revertido y el servicio restaurado.
~$26K de revenue afectado.

## Impacto
- Duración: 13 minutos
- Usuarios afectados: ~2,400 (45% de usuarios activos en ese momento)
- Revenue perdido: ~$26,000 (estimado: $2K/min × 13 min)
- Errores registrados: 8,432

## Timeline
| Hora  | Evento |
|-------|--------|
| 09:45 | Deploy de PR #482 a producción |
| 09:58 | Alerta automática: error rate > 1% |
| 10:00 | On-call confirma incidente P1, abre canal |
| 10:03 | Correlación con deploy de 09:45 identificada |
| 10:07 | Rollback iniciado |
| 10:11 | Error rate < 0.1%, incidente cerrado |
| 10:12 | Comunicación a stakeholders |

## Causa raíz
PR #482 agregó una query `SELECT * FROM Pedidos WHERE EstadoId = @id`
sobre una tabla de 8M registros sin índice en `EstadoId`.
En staging la tabla tiene 1,000 registros — la query tardaba 2ms.
En producción tardaba 8-12 segundos, agotando el connection pool.

## Causas contribuyentes
1. No hay validación de query performance en el pipeline de CI
2. Los datos de staging no son representativos (1K vs 8M registros)
3. El code review no incluye análisis de queries EF Core generadas

## ¿Qué salió bien?
- La alerta automática detectó el problema en < 2 minutos
- El runbook de alta latencia guió la investigación correctamente
- El rollback fue ejecutado sin dudas en < 5 minutos
- Comunicación al equipo fue inmediata y clara

## ¿Qué salió mal?
- No hay pruebas de performance en el pipeline
- Staging no replica la escala de producción
- El PR no incluyó el SQL generado por EF Core

## Action items
| Acción | Responsable | Fecha límite |
|--------|-------------|--------------|
| Agregar índice en Pedidos.EstadoId | @dev1 | 2026-04-02 |
| Agregar lint rule: .ToList() sin .Where() | @dev2 | 2026-04-05 |
| Seed staging con datos representativos (1M+ registros) | @infra | 2026-04-10 |
| Agregar performance test en pipeline (NBomber) | @dev3 | 2026-04-15 |
| Agregar análisis de SQL en template de PR | @tech-lead | 2026-04-03 |
```

---

## Métricas de madurez en incident response

```
Tiempo medio de detección (MTTD):
  Inmaduro: horas (usuarios reportan antes que las alertas)
  Maduro:   minutos (alertas automáticas antes que usuarios)

Tiempo medio de resolución (MTTR):
  Inmaduro: horas (debugging en caliente sin runbooks)
  Maduro:   minutos (runbooks + feature flags + rollback rápido)

Tasa de incidentes recurrentes:
  Inmaduro: > 30% (mismos problemas se repiten)
  Maduro:   < 10% (post-mortems con action items que se cumplen)
```

---

## On-call — rotación saludable

```csharp
// Principios de una guardia on-call sana:

// 1. Alertas accionables — si suena, hay algo que hacer
//    ❌ Alerta de CPU al 80% que "siempre suena" y todos ignoran
//    ✅ Alerta de CPU al 95% sostenida 10 min → acción clara

// 2. Runbooks para cada alerta — sin investigar desde cero bajo presión
//    Cada alerta tiene link a su runbook

// 3. Rotación justa — no siempre las mismas personas
//    Herramientas: PagerDuty, OpsGenie

// 4. Post-mortem tras cada P1/P2 — siempre, sin excepción

// 5. "You build it, you run it" — el equipo que hace el deploy
//    es responsable de la guardia (Amazon model)
//    → incentivo directo para hacer deploys seguros
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál fue el último incidente que gestionaste? ¿Qué hiciste?**
> Estructura STAR: Situación (qué estaba pasando), Tarea (tu rol), Acción (qué hiciste exactamente), Resultado (cómo terminó y qué se mejoró). Mencioná métricas: duración, impacto, MTTR.

**2. ¿Qué es un blameless post-mortem?**
> Un análisis post-incidente que busca causas sistémicas en lugar de culpables individuales. La premisa es que las personas no fallan intencionalmente — si un error humano causó un outage, el sistema tenía una brecha de diseño. La cultura blameless incentiva transparencia: la gente reporta y documenta errores sin miedo a consecuencias, lo que genera aprendizaje real.

**3. ¿Cuál es la diferencia entre MTTD y MTTR?**
> MTTD (Mean Time To Detect) es el tiempo promedio entre que ocurre un problema y que el equipo se entera. MTTR (Mean Time To Recover) es el tiempo promedio desde la detección hasta la resolución. Son los dos KPIs principales de incident response. Un MTTD alto sugiere problemas de observabilidad; un MTTR alto sugiere falta de runbooks, procesos lentos o deploys difíciles de revertir.

**4. ¿Qué es un runbook?**
> Una guía paso a paso pre-escrita para diagnosticar y resolver un tipo específico de incidente. Se escribe en calma y se ejecuta bajo presión. Un buen runbook incluye: síntomas que lo activan, pasos de diagnóstico con comandos concretos, acciones de contención por escenario, y a quién escalar si no se resuelve en X minutos.

**5. Cuando hay un incidente en producción, ¿cuál es tu primera prioridad?**
> Restaurar el servicio, no encontrar la causa raíz. Primero contención (rollback, feature flag off, escalar infraestructura) para minimizar el impacto. La investigación de la causa raíz viene después, en el post-mortem, cuando la presión bajó y hay tiempo para analizar correctamente.
