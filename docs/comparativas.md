---
id: comparativas
title: ⚖️ Comparativas — ¿Cuándo usar X vs Y?
sidebar_position: 11
---

# ⚖️ Comparativas — ¿Cuándo usar X vs Y?

Una de las preguntas más frecuentes en entrevistas es "¿cuándo usarías X en lugar de Y?". Esta página es tu referencia rápida de los trade-offs más preguntados.

:::tip La respuesta siempre empieza con "depende"
Un candidato Senior no da respuestas absolutas. Menciona los contextos donde cada opción gana. Eso es lo que el entrevistador quiere escuchar.
:::

---

## .NET y C#

### `Task<T>` vs `ValueTask<T>`

| | `Task<T>` | `ValueTask<T>` |
|---|---|---|
| **Alocación** | Siempre aloca en heap | No aloca cuando el resultado es síncrono |
| **Awaitable múltiple** | ✅ Se puede await N veces | ❌ Solo una vez |
| **Conversión a Task** | N/A | `.AsTask()` tiene costo |
| **Caso de uso** | Default — operaciones que casi siempre son async | Métodos que **frecuentemente** retornan síncronamente (cache hits) |
| **Complejidad** | Simple y predecible | Más restrictivo, fácil de usar mal |

**Regla práctica:** Usa `Task<T>` por defecto. Cambia a `ValueTask<T>` solo cuando hay evidencia de presión en el GC por alocaciones de Task en paths de alta frecuencia.

---

### `IEnumerable<T>` vs `IQueryable<T>`

| | `IEnumerable<T>` | `IQueryable<T>` |
|---|---|---|
| **Dónde ejecuta** | En memoria (.NET) | En el servidor (SQL, etc.) |
| **Filtros** | Se aplican después de cargar todo | Se traducen a SQL/query |
| **Uso con EF Core** | Carga toda la tabla, luego filtra | Genera query SQL óptima |
| **Cuándo usar** | Colecciones en memoria, resultados ya cargados | Queries a BD que deben optimizarse |

```csharp
// ❌ Carga TODOS los productos, luego filtra en memoria
context.Productos.ToList().Where(p => p.Precio > 100);

// ✅ Genera: SELECT * FROM Productos WHERE Precio > 100
context.Productos.Where(p => p.Precio > 100).ToList();
```

---

### `string` vs `StringBuilder`

| | `string` | `StringBuilder` |
|---|---|---|
| **Inmutabilidad** | Inmutable — cada + crea un nuevo objeto | Mutable — modifica el buffer interno |
| **Rendimiento** | O(n²) para concatenación en bucle | O(n) para concatenación en bucle |
| **Cuando usar** | Concatenaciones simples (< 5-10 strings) | Bucles, construcción dinámica de strings largos |
| **Legibilidad** | Mejor para casos simples | Verboso para casos simples |

**Regla práctica:** `string` para todo lo normal. `StringBuilder` cuando concatenas dentro de un bucle o construyes strings dinámicamente de partes.

---

### `record` vs `class`

| | `record` | `class` |
|---|---|---|
| **Igualdad** | Por valor (compara propiedades) | Por referencia (misma instancia) |
| **Inmutabilidad** | Por defecto con init-only properties | Mutable por defecto |
| **ToString()** | Generado automáticamente | Heredado de object (poco útil) |
| **Cuándo usar** | DTOs, Value Objects, resultados de queries | Entidades con identidad, servicios, repositorios |

---

## Base de Datos

### SQL vs NoSQL

| | SQL (Relacional) | NoSQL |
|---|---|---|
| **Modelo de datos** | Tablas con esquema fijo | Documentos, key-value, grafos, columnar |
| **Transacciones** | ACID completo | Eventual consistency (generalmente) |
| **Escalabilidad** | Vertical (scale-up), sharding complejo | Horizontal nativo (scale-out) |
| **Queries complejas** | JOINs, agregaciones, window functions | Limitado (varía por tipo) |
| **Esquema** | Rígido — migraciones necesarias | Flexible — fácil de cambiar |
| **Cuándo usar** | Datos relacionales, transacciones importantes, reporting | Alto throughput, datos semi-estructurados, escala masiva |

**Regla práctica:** Empieza con SQL. Cambia a NoSQL cuando tengas un problema de escala o un modelo de datos que no encaja en tablas.

---

### `DELETE` vs `TRUNCATE` vs `DROP`

| | `DELETE` | `TRUNCATE` | `DROP` |
|---|---|---|---|
| **¿Qué elimina?** | Filas (con WHERE opcional) | Todas las filas | Tabla completa |
| **Rollback** | ✅ Sí | ❌ No (en la mayoría de motores) | ❌ No |
| **Velocidad** | Lento (log por cada fila) | Rápido (deallocate pages) | Instantáneo |
| **WHERE** | ✅ Sí | ❌ No | ❌ No |
| **Reinicia identity** | ❌ No | ✅ Sí | N/A |
| **Cuándo usar** | Borrar filas específicas | Vaciar una tabla completa rápido | Eliminar la estructura de la tabla |

---

### Offset Pagination vs Cursor Pagination

| | Offset (`SKIP`/`OFFSET`) | Cursor (basada en ID) |
|---|---|---|
| **Rendimiento** | O(n) — empeora con páginas profundas | O(log n) — constante gracias al índice |
| **Consistencia** | Puede saltear/duplicar si se insertan registros | Siempre consistente |
| **Salto a página** | ✅ Cualquier página arbitraria | ❌ Solo secuencial |
| **Implementación** | Simple | Más compleja |
| **Cuándo usar** | Reportes con datos estáticos, pocas páginas | Feeds en tiempo real, datasets grandes |

---

### Read Replica vs Cache

| | Read Replica | Cache (Redis) |
|---|---|---|
| **Latencia** | ~5-20ms (red + query) | &lt;1ms (memoria) |
| **Consistencia** | Eventual (lag de replicación) | Puede quedar stale (TTL) |
| **Tipo de datos** | Cualquier query SQL | Datos serializables |
| **Invalidación** | Automática por replicación | Manual o por TTL |
| **Cuándo usar** | Queries complejas, reportes, offload de la primary | Datos frecuentemente leídos, resultados de queries costosas |

---

## Arquitectura

### Microservicios vs Monolito Modular

| | Microservicios | Monolito Modular |
|---|---|---|
| **Deployabilidad** | Deploy independiente por servicio | Deploy del todo junto |
| **Escalabilidad** | Escalar servicios individualmente | Escalar todo junto |
| **Complejidad operacional** | Alta (K8s, service mesh, distributed tracing) | Baja |
| **Latencia** | Red entre servicios | Llamadas en proceso (nanosegundos) |
| **Consistencia** | Eventual consistency (difícil) | Transacciones ACID (fácil) |
| **Equipo** | Equipos grandes, múltiples teams | Equipos pequeños-medianos |
| **Cuándo usar** | Sistema maduro, escala diferenciada, múltiples equipos | MVP, dominios no bien entendidos, equipos pequeños |

**Regla:** Empieza con un monolito modular bien diseñado. Extrae microservicios cuando tengas un problema real de escala o de independencia de deploy.

---

### REST vs gRPC vs GraphQL

| | REST | gRPC | GraphQL |
|---|---|---|---|
| **Protocolo** | HTTP/1.1 con JSON | HTTP/2 con Protocol Buffers | HTTP con JSON |
| **Rendimiento** | Medio | Alto (binary, streaming) | Medio |
| **Flexibilidad** | Fija por endpoint | Fija por contrato | Cliente elige los campos |
| **Tooling** | Excelente (Swagger, etc.) | Bueno pero más complejo | Bueno (Apollo, etc.) |
| **Streaming** | No nativo | ✅ Bidireccional | ✅ Subscriptions |
| **Cuándo usar** | APIs públicas, web, móvil | Comunicación interna entre microservicios | APIs con clientes que necesitan flexibilidad (dashboards, móvil con BW limitado) |

---

### CQRS simple vs CQRS con DB separadas

| | CQRS lógico (misma DB) | CQRS con DB separadas |
|---|---|---|
| **Complejidad** | Baja-media | Alta |
| **Consistencia** | Inmediata | Eventual (replicación) |
| **Rendimiento de lectura** | Medio (misma DB) | Alto (DB optimizada para lecturas) |
| **Cuándo usar** | Quieres separar responsabilidades sin infraestructura extra | Reads y writes tienen perfiles de carga muy distintos, necesitas optimización extrema |

---

### Repository Pattern vs DbContext directo

| | Repository | DbContext directo |
|---|---|---|
| **Abstracción** | Alta — oculta EF Core | Baja — EF Core es visible |
| **Testabilidad** | Fácil mockear con interfaces | Requiere InMemory/TestContainers |
| **IQueryable** | Generalmente oculto | Accesible — composición de queries |
| **Overhead** | Una capa adicional | Ninguno |
| **Cuándo usar** | Testing con mocks, posibilidad real de cambiar ORM, Clean Architecture | Proyectos simples, cuando IQueryable tiene valor, cuando el equipo conoce bien EF Core |

---

## Mensajería

### RabbitMQ vs Kafka vs Azure Service Bus

| | RabbitMQ | Kafka | Azure Service Bus |
|---|---|---|---|
| **Modelo** | Push (broker → consumer) | Pull (consumer lee particiones) | Push (broker → consumer) |
| **Throughput** | Alto | Muy alto (millones/s) | Medio-alto |
| **Retención** | Hasta que se consume | Configurable (días, semanas, para siempre) | Hasta que se consume |
| **Replay** | ❌ No nativo | ✅ Sí | ❌ No nativo |
| **Routing** | Muy flexible (exchanges, bindings) | Simple (topic + particiones) | Medio (topics, subscriptions, filtros) |
| **Ordering** | Por queue | Por partición | Por session |
| **Cuándo usar** | Routing complejo, RPC, queues de trabajo | Event sourcing, log de auditoría, alto throughput, streaming | Apps Azure, cuando prefieres PaaS sin gestión |

---

## Frontend

### `useState` vs `useReducer`

| | `useState` | `useReducer` |
|---|---|---|
| **Complejidad** | Simple | Más verboso |
| **Múltiples sub-estados** | Varios useState separados | Un solo objeto de estado |
| **Transiciones** | Directas | Explícitas vía actions |
| **Testing del estado** | Difícil de testear aislado | Reducer es función pura — fácil de testear |
| **Cuándo usar** | Estado simple (boolean, string, number) | 3+ sub-estados relacionados, transiciones complejas |

---

### Redux Toolkit vs Zustand vs Context API

| | Redux Toolkit | Zustand | Context API |
|---|---|---|---|
| **Bundle size** | ~50KB | ~1KB | 0 (nativo) |
| **Boilerplate** | Medio (reducido vs Redux puro) | Mínimo | Mínimo |
| **DevTools** | ✅ Excelentes | ✅ Disponibles | ❌ Ninguno |
| **Performance** | Excelente con selectores | Excelente | Re-renders innecesarios si no se optimiza |
| **Cuándo usar** | Apps grandes, estado complejo, múltiples equipos | Apps medianas, estado simple-medio | Estado de poca frecuencia de cambio, tema/locale, auth |

---

### React Query vs SWR vs fetch manual

| | React Query | SWR | fetch manual + useState |
|---|---|---|---|
| **Cache** | ✅ Potente | ✅ Sí | ❌ Manual |
| **Revalidación** | ✅ On focus, interval, etc. | ✅ Sí | ❌ Manual |
| **Mutations** | ✅ Con optimistic updates | ✅ Básico | ❌ Manual |
| **Paginación** | ✅ Infinite scroll, cursors | ✅ Básico | ❌ Manual |
| **Bundle size** | ~40KB | ~4KB | 0 |
| **Cuándo usar** | Apps con mucha data fetching | Apps medianas con SWR sufficing | Muy pocas requests, máximo control |

---

## Caching

### In-Memory Cache vs Redis

| | IMemoryCache (in-process) | Redis (distribuido) |
|---|---|---|
| **Latencia** | ~nanosegundos (RAM local) | ~1-5ms (red) |
| **Consistencia** | Solo ese proceso | Compartido entre instancias |
| **Multi-instancia** | ❌ Cada instancia tiene su caché | ✅ Caché compartido |
| **Persistencia** | No (se pierde al reiniciar) | Opcional (AOF / RDB) |
| **Cuándo usar** | Single-instance, dev, datos de configuración | Load balancer, múltiples pods, sesiones |

---

### Cache-Aside vs Write-Through vs Write-Behind

| | Cache-Aside | Write-Through | Write-Behind |
|---|---|---|---|
| **Quien actualiza** | La app | El caché (synced) | El caché (async) |
| **Cache miss** | Carga de DB y almacena | No hay miss (siempre sync) | No hay miss |
| **Consistencia** | Eventual | Inmediata | Eventual |
| **Escrituras** | Directamente a DB | Synced con caché | Async (riesgo de pérdida) |
| **Cuándo usar** | Default, más simple | Datos críticos sin tolerancia a staleness | Alto throughput de escritura, pérdida tolerable |
