---
id: live-coding
title: "💻 Live Coding — Senior"
sidebar_position: 100
---

# 💻 Live Coding — Senior

Ejercicios para posiciones Senior. Se espera diseño robusto, conocimiento de patrones de distribución, manejo de concurrencia y capacidad de razonar sobre sistemas a escala.

:::tip Consejo
En este nivel, el entrevistador espera que **anticipes los problemas** antes de que se los menciones. Habla de thread-safety, scalabilidad, observabilidad y mantenibilidad sin esperar que te pregunten.
:::

---

## Metodología de Approach para Live Coding

Antes de escribir una sola línea de código, sigue este framework. El entrevistador evalúa **cómo piensas**, no solo si llegas a la solución.

### Framework UREQ-CA

| Paso | Qué hacer | Tiempo |
|---|---|---|
| **U**nderstand | Leer el problema 2 veces. Reformular en tus palabras. | 1-2 min |
| **R**equirements | Preguntar sobre casos no especificados | 2-3 min |
| **E**dge Cases | Listar inputs extremos antes de codear | 1-2 min |
| **Q**uerys (API) | Definir la firma de la función/clase | 1 min |
| **C**ode | Implementar la solución básica primero | 15-20 min |
| **A**nalyze | Complejidad, mejoras, variantes | 3-5 min |

### Preguntas de Clarificación a Hacer Siempre

```text
¿Cuál es el rango de valores de entrada? (¿puede ser negativo, nulo, vacío?)
¿Cuántos elementos esperamos? (¿cabe en memoria? ¿necesito streaming?)
¿Es single-threaded o multi-threaded? (¿necesito thread-safety?)
¿Optimizamos para lecturas o escrituras?
¿Hay restricciones de memoria?
```

### Cómo Hablar Mientras Codeas

En entrevistas senior el silencio es tu enemigo. Usa este patrón:

- **Antes de escribir**: "Voy a usar un `Dictionary` para O(1) lookup y una `LinkedList` para mantener el orden. Podría también usar un array pero penaliza las inserciones…"
- **Mientras escribes**: "Aquí el `lock` es necesario porque si dos hilos llegan simultáneamente al check, ambos podrían pasar la condición…"
- **Al terminar**: "Esta solución es O(n) tiempo y O(n) espacio. Podría optimizarse a O(log n) con un heap si el caso de uso lo requiere…"

### Cuando No Sabes la Respuesta

```text
"No conozco la API exacta de memoria, pero lo implementaría de esta forma general…"
"No recuerdo si Task.WhenAll propaga CancellationToken, déjame asumir que sí y lo verifico."
"Conozco el concepto pero no la implementación en C# específicamente.
 En Python lo haría con X. En C# sería análogo usando Y…"
```

**Lo que nunca debes hacer**: decir "No sé" y quedarte en silencio. Siempre muestra tu razonamiento incluso con información incompleta.

### Trade-offs que Siempre Debes Mencionar Proactivamente

```
Consistency vs Availability    → ¿qué pasa si esto falla a mitad?
Latencia vs Throughput         → ¿optimizamos p99 o requests/s?
Simplicidad vs Escalabilidad   → ¿cuándo esto deja de funcionar?
Memory vs CPU                  → ¿cuál es el cuello de botella?
```

---

## Whiteboarding y Capacity Estimation

Para ejercicios de diseño de sistemas en pizarra, usa estas herramientas base.

### Template de 8 Pasos

```
1. CLARIFY     → ¿Qué features incluimos? ¿Cuántos usuarios? ¿Geo distribuido?
2. ESTIMATE    → Tráfico (QPS), storage, ancho de banda
3. API DESIGN  → Endpoints y contratos
4. DATA MODEL  → Entidades, relaciones, índices clave
5. HIGH LEVEL  → Diagrama de componentes
6. DEEP DIVE   → El componente más crítico o el que el entrevistador elige
7. SCALE       → ¿Qué falla primero? ¿Cómo lo escalamos?
8. TRADE-OFFS  → ¿Qué sacrificamos? (Consistency vs Availability, etc.)
```

### Fórmulas de Estimación Rápida

```
DAU (usuarios activos diarios) = MAU × 0.3  (30% de mensuales son diarios)
QPS                            = DAU × acciones_por_día / 86,400
Peak QPS                       = QPS × 2–3x (factor de pico)
Storage/año                    = DAU × tamaño_objeto × acciones/día × 365

Tamaños típicos:
  Tweet / mensaje corto  ≈  300 bytes
  Foto comprimida        ≈  300 KB
  Video 1 min (360p)     ≈  50 MB
  Metadata de usuario    ≈  1 KB

Conversiones útiles:
  1 día   = 86,400 s  (≈ 10^5)
  1 TB    = 10^12 bytes
  1 PB    = 10^15 bytes
```

### Ejemplo: URL Shortener en 5 minutos

```
CLARIFY
  - 100M URLs acortados por día
  - Ratio lectura:escritura = 100:1
  - URLs viven 5 años

ESTIMATE
  - Writes: 100M / 86400 ≈ 1,160 QPS  → Peak ~3,500 QPS
  - Reads:  10B  / 86400 ≈ 115,740 QPS → Peak ~350,000 QPS
  - Storage: 100M × 365 × 5 × 500B = ~90 TB en 5 años
  - Bandwidth write: 3,500 × 500B = 1.75 MB/s
  - Bandwidth read:  350,000 × 500B = 175 MB/s

KEY DECISIONS
  - Short code: Base62, 7 chars = 62^7 ≈ 3.5 trillones de combinaciones
  - Generación: hash(URL)[0:7] con retry en colisión, o ID auto-incremental en Base62
  - 350K QPS en lectura → cache agresivo (20% de URLs = 80% del tráfico → hit rate ~99%)

ARQUITECTURA
  ┌──────────┐  write   ┌─────────────┐    ┌──────────────┐
  │  Client  │─────────►│  API Server │───►│   DB (SQL)   │
  │          │  redirect│             │    │ shortId→url  │
  │          │◄─────────│  + Redis    │◄───│              │
  └──────────┘          └──────┬──────┘    └──────────────┘
                               │
                          ┌────▼────┐
                          │   CDN   │ ← absorbe 80%+ del tráfico read
                          └─────────┘

TRADE-OFFS
  - NoSQL vs SQL: NoSQL (DynamoDB) para sharding fácil. No necesitamos
    transacciones aquí → vale la pena el scale horizontal.
  - Eventual consistency en cache: si Redis devuelve URL desactualizada,
    el redirect es incorrecto. Aceptable porque los URLs no cambian.
```

---

