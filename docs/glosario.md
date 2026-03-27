---
id: glosario
title: 📖 Glosario Técnico
sidebar_position: 10
---

# 📖 Glosario Técnico

Referencia rápida de términos técnicos que aparecen frecuentemente en entrevistas. Ordenados alfabéticamente por categoría.

:::tip Cómo usarlo
Cuando en una entrevista menciones un término, debes poder explicarlo en 1-2 oraciones. Este glosario te da esa definición concisa.
:::

---

## .NET y C#

| Término | Definición rápida |
|---|---|
| **async/await** | Palabras clave que permiten programación asíncrona sin bloquear el hilo. `await` suspende la ejecución del método hasta que la `Task` complete, liberando el hilo para otras tareas. |
| **Boxing/Unboxing** | Boxing: convertir un value type (int, struct) a `object` copiándolo al heap. Unboxing: el proceso inverso. Costoso en bucles por presión en el GC. |
| **CLR** | Common Language Runtime. El entorno de ejecución de .NET: gestiona la ejecución de código, garbage collection, JIT compilation y seguridad. |
| **Covariance / Contravariance** | Covariance (`out T`): una interfaz genérica puede usarse con un tipo más derivado. Contravariance (`in T`): con un tipo más base. |
| **Delegate** | Tipo que representa una referencia a un método con una firma específica. Base de eventos, LINQ y callbacks. `Action`, `Func`, `Predicate` son delegates predefinidos. |
| **Garbage Collector (GC)** | Administrador automático de memoria en .NET. Libera objetos en heap cuando no tienen referencias. Trabaja con 3 generaciones (Gen0, Gen1, Gen2) según longevidad del objeto. |
| **LINQ** | Language Integrated Query. Conjunto de métodos de extensión para consultar colecciones (y otras fuentes como bases de datos) con sintaxis fluida o declarativa. |
| **record** | Tipo de referencia inmutable con igualdad por valor. `record Person(string Name, int Age)` genera `==`, `ToString()` y `GetHashCode()` automáticamente. |
| **ref / out** | `ref`: pasar un argumento por referencia (debe inicializarse antes). `out`: pasar por referencia y el método debe asignarle un valor antes de retornar. |
| **Task / ValueTask** | `Task<T>`: representa una operación asíncrona con resultado. `ValueTask<T>`: evita la alocación en heap cuando el resultado ya está disponible síncronamente. |
| **Value Type / Reference Type** | Value Types (int, struct, enum) se copian por valor y viven en el stack (o inline en el heap). Reference Types (class, interface, delegate) se acceden por referencia y viven en el heap. |

---

## Arquitectura

| Término | Definición rápida |
|---|---|
| **Aggregate Root** | En DDD, el punto de entrada único a un cluster de objetos del dominio (Aggregate). Solo el Aggregate Root tiene repositorio propio. |
| **Bounded Context** | En DDD, un límite explícito dentro del cual un modelo de dominio es válido. El mismo concepto ("Producto") puede tener modelos distintos en distintos Bounded Contexts. |
| **CAP Theorem** | En sistemas distribuidos: Consistency (todos ven los mismos datos), Availability (siempre responde), Partition Tolerance (funciona con fallos de red). Solo puedes garantizar 2 de 3 simultáneamente. |
| **Clean Architecture** | Arquitectura en capas concéntricas donde las dependencias apuntan siempre hacia el interior (Domain). Las capas externas (Infrastructure, API) dependen de las internas, nunca al revés. |
| **CQRS** | Command Query Responsibility Segregation. Separar las operaciones de escritura (Commands) de las de lectura (Queries), cada una con su propio modelo. |
| **DDD** | Domain-Driven Design. Enfoque de diseño que pone el dominio del negocio en el centro. Tácticas: Entities, Value Objects, Aggregates, Domain Events, Repositories. |
| **Event Sourcing** | En lugar de guardar el estado actual, guardar la secuencia completa de eventos que lo produjeron. El estado actual se reconstruye reproduciendo los eventos. |
| **Hexagonal Architecture** | También llamada Ports & Adapters. El dominio está en el centro y se comunica con el exterior solo a través de puertos (interfaces) y adaptadores (implementaciones). Equivalente a Clean Architecture. |
| **Idempotency** | Una operación es idempotente si puede ejecutarse múltiples veces con el mismo resultado. Crítica en APIs y consumidores de mensajes para manejar duplicados. |
| **Saga Pattern** | Patrón para gestionar transacciones distribuidas sin ACID. Una saga es una secuencia de transacciones locales; si una falla, se ejecutan transacciones compensatorias. |
| **Value Object** | En DDD, un objeto sin identidad propia, definido por sus atributos. Inmutable. Ejemplos: `Money(amount, currency)`, `Address(street, city)`. |
| **Vertical Slice Architecture** | Organizar el código por features en lugar de por capas técnicas. Cada feature tiene su propio Handler, DTO, Validator, endpoint. |

---

## Base de Datos

| Término | Definición rápida |
|---|---|
| **ACID** | Atomicity, Consistency, Isolation, Durability. Propiedades que garantizan que las transacciones de BD son procesadas de forma confiable. |
| **B-Tree Index** | Estructura de datos en árbol balanceado usada por la mayoría de los índices de BD. Permite búsquedas, inserciones y eliminaciones en O(log n). |
| **Cardinalidad** | Número de valores distintos en una columna. Alta cardinalidad (email, ID) = buenos candidatos para índices. Baja cardinalidad (boolean, estado) = índices menos útiles. |
| **Change Data Capture (CDC)** | Técnica para capturar y registrar cambios en una base de datos (inserts, updates, deletes) en tiempo real. Usado en migraciones y sistemas de replicación. |
| **Deadlock** | Dos transacciones bloqueadas mutuamente esperando recursos que la otra tiene. El motor de BD lo detecta y mata una de las transacciones (la víctima). |
| **Eventual Consistency** | Un modelo donde los datos pueden estar momentáneamente inconsistentes entre nodos, pero eventualmente convergen al mismo estado. Trade-off de disponibilidad en sistemas distribuidos. |
| **Index Covering** | Un índice que incluye todas las columnas necesarias para satisfacer una query sin acceder a la tabla base. `CREATE INDEX IX ON T (A) INCLUDE (B, C)`. |
| **N+1 Problem** | Bug de rendimiento: 1 query para obtener N entidades + N queries adicionales para obtener sus relaciones. Solución: eager loading con `Include()`. |
| **Read Replica** | Copia de solo lectura de la base de datos principal, que recibe los cambios por replicación. Permite escalar las lecturas sin afectar las escrituras. |
| **Sharding** | Particionamiento horizontal de datos entre múltiples instancias de BD (shards). Cada shard contiene un subconjunto de los datos según una shard key. |
| **Sargable** | Una condición WHERE que puede usar un índice eficientemente. `WHERE col = ?` es sargable. `WHERE YEAR(col) = ?` no lo es (función sobre la columna anula el índice). |

---

## Microservicios y Sistemas Distribuidos

| Término | Definición rápida |
|---|---|
| **API Gateway** | Punto de entrada único para múltiples microservicios. Maneja routing, autenticación, rate limiting, logging y SSL termination. |
| **Circuit Breaker** | Patrón de resiliencia. Cuando un servicio falla repetidamente, el circuit breaker "abre" y retorna error inmediatamente sin intentar la llamada. Se "cierra" cuando el servicio se recupera. |
| **Choreography** | Coordinación de microservicios mediante eventos: cada servicio reacciona a los eventos de otros sin coordinador central. Más desacoplado pero difícil de trazar. |
| **Consumer Group** | En Kafka, grupo de consumidores que cooperan para procesar un topic. Cada partición es procesada por exactamente un consumidor del grupo. |
| **Dead Letter Queue (DLQ)** | Cola donde van los mensajes que fallaron repetidamente en ser procesados. Permite análisis y reprocessing manual sin bloquear la cola principal. |
| **Idempotency Key** | Identificador único incluido en una request que permite al servidor detectar y desechar duplicados. Patrón fundamental en APIs de pagos y sistemas distribuidos. |
| **Orchestration** | Coordinación de microservicios mediante un orquestador central (la Saga) que envía comandos explícitos a cada servicio. Más fácil de depurar que Choreography. |
| **Outbox Pattern** | Garantía de publicación atómica de eventos: los eventos se guardan en una tabla `outbox` en la misma transacción DB que los datos, y un worker los publica al broker. |
| **Service Mesh** | Capa de infraestructura que gestiona la comunicación entre microservicios (mTLS, retry, circuit breaker, observabilidad) mediante proxies sidecar sin modificar el código. |
| **Sidecar** | Proceso secundario que corre junto al servicio principal (mismo pod en K8s) y maneja concerns transversales: proxy de red, colección de métricas, gestión de secrets. |

---

## Frontend y React

| Término | Definición rápida |
|---|---|
| **Batching** | React 18 agrupa múltiples `setState` en una sola operación de re-render. Aplica incluso dentro de `setTimeout`, `fetch` y eventos nativos. |
| **Bundle Splitting** | Dividir el JavaScript en múltiples archivos (chunks) que se cargan bajo demanda. Reduce el bundle inicial y mejora el Time to Interactive. |
| **Closure** | Función que recuerda el ámbito léxico donde fue creada. En React, los hooks crean closures sobre las variables del render actual. |
| **Controlled Component** | Componente de formulario cuyo valor es controlado por React (`useState`). El opuesto es un Uncontrolled Component donde el DOM gestiona el valor. |
| **Hydration** | En SSR/SSG, el proceso de adjuntar los event listeners de React a un HTML pre-renderizado por el servidor. Hace el HTML interactivo. |
| **Memoization** | Técnica de optimización que cachea el resultado de una función para los mismos inputs. En React: `React.memo`, `useMemo`, `useCallback`. |
| **Reconciliation** | El proceso por el que React compara el Virtual DOM anterior con el nuevo para calcular el mínimo conjunto de cambios DOM necesarios. |
| **Stale Closure** | Bug donde una función en un `useEffect` captura valores de un render anterior porque una dependencia fue omitida del array de deps. |
| **Virtual DOM** | Representación en memoria del DOM real. React calcula cambios en el Virtual DOM y aplica solo los cambios mínimos al DOM real (diffing). |
| **Web Vitals** | Métricas clave de rendimiento de Google: LCP (carga), FID/INP (interactividad), CLS (estabilidad visual). Afectan el ranking en buscadores. |

---

## Seguridad

| Término | Definición rápida |
|---|---|
| **CORS** | Cross-Origin Resource Sharing. Mecanismo que controla qué orígenes externos pueden hacer requests a tu API. Configurado en el servidor con headers `Access-Control-Allow-Origin`. |
| **CSRF** | Cross-Site Request Forgery. Ataque donde un sitio malicioso hace requests en nombre del usuario autenticado. Mitigado con `SameSite=Strict` en cookies y CSRF tokens. |
| **JWT** | JSON Web Token. Token auto-contenido con claims firmados criptográficamente. Compuesto de Header.Payload.Signature codificados en Base64. No encriptado (usar JWE para eso). |
| **mTLS** | Mutual TLS. Ambos lados de la conexión (cliente y servidor) presentan certificados y se autentican mutuamente. Usado en comunicación servicio-a-servicio en microservicios. |
| **OAuth 2.0** | Framework de autorización que permite a aplicaciones obtener acceso limitado a recursos sin compartir credenciales. Define Flows (Authorization Code, Client Credentials, etc.). |
| **OWASP Top 10** | Lista de las 10 vulnerabilidades de seguridad web más críticas. Incluye SQL Injection, XSS, IDOR, Security Misconfiguration, Cryptographic Failures, etc. |
| **PKCE** | Proof Key for Code Exchange. Extensión de OAuth 2.0 que protege el Authorization Code flow para clientes públicos (SPAs, apps móviles) contra ataques de intercepción. |
| **SQL Injection** | Ataque que inserta SQL malicioso en inputs no sanitizados. Mitigado con parámetros de query o un ORM (nunca concatenar strings en SQL). |
| **XSS** | Cross-Site Scripting. Inyección de JavaScript malicioso en páginas web. Tipos: Stored (en BD), Reflected (en URL), DOM-based. Mitigado con CSP y escape de output. |

---

## DevOps y Cloud

| Término | Definición rápida |
|---|---|
| **Blue/Green Deployment** | Estrategia de deploy donde se mantienen dos entornos idénticos (blue=producción actual, green=nueva versión). El tráfico se redirige de blue a green al verificar que green está ok. |
| **Canary Deployment** | Deploy gradual donde solo un pequeño % de tráfico (ej. 5%) va a la nueva versión. Si no hay errores, se incrementa gradualmente hasta el 100%. |
| **Container** | Unidad de software que empaqueta el código y sus dependencias para ejecutarse de forma aislada y reproducible. Docker es la implementación más común. |
| **IaC** | Infrastructure as Code. Gestión de infraestructura mediante archivos de configuración versionados (Terraform, Bicep, ARM Templates) en lugar de configuración manual. |
| **Observability** | Capacidad de entender el estado interno de un sistema desde sus outputs externos. Se basa en los 3 pilares: Logs, Metrics y Traces. |
| **SLA / SLO / SLI** | SLI: métrica real (error rate). SLO: objetivo (< 0.1% error rate). SLA: contrato formal con consecuencias si se incumple el SLO. |
| **Terraform** | Herramienta de IaC para crear y gestionar infraestructura en múltiples clouds (Azure, AWS, GCP) con un lenguaje declarativo (HCL). |
