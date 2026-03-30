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

---

## .NET y C# — avanzado

### EF Core vs Dapper

| | EF Core | Dapper |
|---|---|---|
| **Tipo** | ORM completo | Micro-ORM (wrapper de ADO.NET) |
| **Curva de aprendizaje** | Alta | Baja |
| **Productividad** | Alta (migrations, change tracking, LINQ) | Media (SQL manual) |
| **Control del SQL** | Medio (genera SQL automático) | Total (escribís el SQL) |
| **Performance** | Buena — mejora con `AsNoTracking`, proyecciones | Excelente — zero overhead |
| **Migrations** | ✅ Integradas | ❌ Manual (Flyway, DbUp, etc.) |
| **Queries complejas** | A veces genera SQL ineficiente | SQL exacto que necesitás |
| **Cuándo usar** | Apps CRUD, dominios complejos, equipos que priorizan velocidad | Reportes, queries complejas con JOINs, hot paths críticos de performance |

**Regla práctica:** EF Core para el 90% del CRUD. Dapper (o EF + `FromSqlRaw`) para las queries que EF genera mal o para reporting.

```csharp
// Combinar ambos en el mismo proyecto
public class ProductoRepository
{
    private readonly AppDbContext _efContext;
    private readonly IDbConnection _dapperConn;

    // CRUD con EF Core
    public Task<Producto?> GetByIdAsync(int id) =>
        _efContext.Productos.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);

    // Reporte complejo con Dapper
    public Task<IEnumerable<ReporteVentasDto>> GetReporteVentasAsync(DateTime desde, DateTime hasta) =>
        _dapperConn.QueryAsync<ReporteVentasDto>("""
            SELECT c.Nombre, SUM(p.Total) as TotalVentas, COUNT(*) as CantidadPedidos
            FROM Pedidos p
            JOIN Clientes c ON p.ClienteId = c.Id
            WHERE p.Fecha BETWEEN @Desde AND @Hasta
            GROUP BY c.Nombre
            ORDER BY TotalVentas DESC
            """, new { Desde = desde, Hasta = hasta });
}
```

---

### Singleton vs Scoped vs Transient

La decisión más frecuente al registrar servicios en el DI container de .NET.

| | Singleton | Scoped | Transient |
|---|---|---|---|
| **Instancias** | 1 para toda la app | 1 por request HTTP | Nueva en cada inyección |
| **Vida útil** | Hasta que la app termina | Hasta que termina el request | Inmediata |
| **Thread safety** | ⚠️ Debe ser thread-safe | Solo dentro del request | No aplica |
| **Estado** | Compartido entre todos | Compartido dentro del request | Ninguno (nueva instancia) |
| **Cuándo usar** | Config, caché in-memory, HTTP clients, conexiones costosas | DbContext, servicios de negocio, repositorios | Helpers stateless, factories |

```csharp
// ✅ Singleton: sin estado mutable o thread-safe
builder.Services.AddSingleton<IConfiguration>();
builder.Services.AddSingleton<IMemoryCache, MemoryCache>();
builder.Services.AddSingleton<IHttpClientFactory>(); // ya es singleton por default

// ✅ Scoped: estado por request
builder.Services.AddScoped<AppDbContext>();
builder.Services.AddScoped<IProductoRepository, ProductoRepository>();
builder.Services.AddScoped<ICurrentUser, CurrentUserService>();

// ✅ Transient: sin estado
builder.Services.AddTransient<IEmailValidator, EmailValidator>();
builder.Services.AddTransient<IPasswordHasher, Argon2PasswordHasher>();
```

:::warning Captive dependency
Si un Singleton inyecta un Scoped, el Scoped queda "capturado" y vive tanto como el Singleton — pierde su semántica de request. El DI container lanza excepción en desarrollo. Regla: **un servicio nunca puede depender de uno con vida más corta**.
:::

---

### `async/await` vs `Task.Run`

Confusión frecuente en entrevistas.

| | `async/await` | `Task.Run` |
|---|---|---|
| **Propósito** | I/O-bound async (no bloquea el hilo) | CPU-bound (corre en ThreadPool) |
| **Hilo** | Libera el hilo mientras espera I/O | Usa un hilo del ThreadPool |
| **Cuándo usar** | DB queries, HTTP calls, file I/O | Cálculos pesados, operaciones CPU intensivas |

```csharp
// ✅ async/await para I/O — libera el hilo mientras espera
public async Task<Producto?> GetProductoAsync(int id)
{
    return await _db.Productos.FindAsync(id); // hilo libre mientras espera la BD
}

// ✅ Task.Run para CPU-bound — mueve el trabajo al ThreadPool
public async Task<byte[]> GenerarReportePdfAsync(ReporteData data)
{
    // Operación CPU-intensiva — no queremos bloquear el request thread
    return await Task.Run(() => PdfGenerator.Generate(data));
}

// ❌ Incorrecto: Task.Run para I/O (desperdicia un hilo extra)
public async Task<Producto?> GetProductoMal(int id)
{
    return await Task.Run(() => _db.Productos.Find(id)); // usa un hilo para esperar otro
}

// ❌ Incorrecto: async/await para CPU (bloquea el hilo igual)
public async Task<byte[]> GenerarPdfMal(ReporteData data)
{
    await Task.Delay(0); // no ayuda — el cómputo sigue en el mismo hilo
    return PdfGenerator.Generate(data);
}
```

---

### `IHostedService` vs `BackgroundService` vs `Worker Service`

| | `IHostedService` | `BackgroundService` | Worker Service |
|---|---|---|---|
| **Qué es** | Interfaz de bajo nivel | Clase base abstracta sobre IHostedService | Template de proyecto |
| **Implementación** | `StartAsync` y `StopAsync` manuales | Solo sobreescribir `ExecuteAsync` | Usa BackgroundService por defecto |
| **Cuándo usar** | Control total del ciclo de vida | 99% de los casos de background tasks | Punto de entrada para workers standalone |

```csharp
// BackgroundService: solo implementar ExecuteAsync
public class ProcesadorColaService : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var mensaje = await _cola.RecibirAsync(stoppingToken);
            await ProcesarAsync(mensaje, stoppingToken);
        }
    }
}
```

---

## Frontend avanzado

### Next.js (App Router) vs Vite + React (SPA)

| | Next.js App Router | Vite + React (SPA pura) |
|---|---|---|
| **Rendering** | SSR, SSG, ISR, RSC | Solo CSR (cliente) |
| **SEO** | ✅ Excelente (HTML pre-renderizado) | ❌ Malo sin configuración extra |
| **Bundle inicial** | Más pequeño (Server Components) | Completo |
| **Routing** | File-based (carpetas) | Manual (React Router) |
| **Backend integrado** | ✅ API Routes, Server Actions | ❌ Necesitás API separada |
| **Complejidad** | Alta (Server/Client components, caché) | Baja-media |
| **Cuándo usar** | Apps públicas con SEO, e-commerce, marketing sites | Apps internas (dashboards, admin), detrás de login, alta interactividad |

**Regla:** Si la página necesita SEO o se beneficia de pre-rendering → Next.js. Si es una app interna o dashboard donde el SEO no importa → Vite + React es más simple.

---

### `useEffect` vs `useLayoutEffect` vs `useSyncExternalStore`

| | `useEffect` | `useLayoutEffect` | `useSyncExternalStore` |
|---|---|---|---|
| **Cuándo corre** | Después del paint del navegador | Antes del paint (síncrono) | Suscripción a stores externos |
| **Bloquea el render** | No | Sí | No |
| **Cuándo usar** | Fetch de datos, subscriptions, cleanup | Medir DOM, evitar flash visual | Integrar con stores de terceros |

```csharp
// useLayoutEffect: medir un elemento ANTES de que el usuario lo vea
function Tooltip({ texto, targetRef }) {
  const [posicion, setPosicion] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {  // corre antes del paint — sin flicker
    const rect = targetRef.current.getBoundingClientRect();
    setPosicion({ top: rect.bottom, left: rect.left });
  }, []);

  return <div style={posicion}>{texto}</div>;
}
```

---

## Seguridad y autenticación

### JWT vs Session Cookies

| | JWT (stateless) | Session Cookies (stateful) |
|---|---|---|
| **Estado en servidor** | Ninguno | Sesión guardada (memoria/Redis) |
| **Escalabilidad** | Trivial (cualquier instancia valida) | Requiere session store compartido |
| **Revocación** | Difícil (hasta que expira) | Inmediata (borrar la sesión) |
| **CSRF** | No vulnerable (no en cookies) | Vulnerable sin anti-CSRF token |
| **XSS** | Vulnerable si se guarda en localStorage | Mitigable con `HttpOnly` cookie |
| **Cuándo usar** | APIs stateless, microservicios, mobile, SPAs | Apps web tradicionales, cuando la revocación inmediata es crítica |

**Regla:** JWT para APIs y microservicios donde la escalabilidad importa. Sessions cuando necesitás revocar tokens inmediatamente (bancas, admin). Para SPAs con backend propio, cookies HttpOnly son más seguras que localStorage.

---

### OAuth 2.0 vs API Keys

| | OAuth 2.0 / OIDC | API Keys |
|---|---|---|
| **Delegación** | ✅ El usuario autoriza sin compartir credenciales | ❌ La key tiene acceso directo |
| **Expiración** | ✅ Tokens de corta vida | ❌ Generalmente permanentes |
| **Revocación** | ✅ Por token o refresh token | Revocar la key entera |
| **Scopes** | ✅ Acceso granular por scope | ❌ Todo o nada |
| **Complejidad** | Alta | Baja |
| **Cuándo usar** | Acceso en nombre de un usuario, third-party integrations | Server-to-server, webhooks, cuando no hay usuario involucrado |

---

## Rate Limiting

### Fixed Window vs Sliding Window vs Token Bucket

| | Fixed Window | Sliding Window | Token Bucket |
|---|---|---|---|
| **Burst al borde** | ❌ Posible (2× el límite) | ✅ Eliminado | ✅ Controlado |
| **Memoria** | Baja | Alta (timestamps por request) | Baja |
| **Recuperación** | Al inicio de la ventana | Continua | Gradual |
| **Burst deliberado** | ❌ No permite | ❌ No permite | ✅ Permite (hasta capacidad) |
| **Cuándo usar** | Límites simples de API pública | APIs donde el burst en bordes es problema | APIs que toleran picos ocasionales |

---

## Multi-tenancy

### Database per Tenant vs Schema per Tenant vs Row-level

| | Database per Tenant | Schema per Tenant | Row-level |
|---|---|---|---|
| **Aislamiento** | Máximo | Alto | Bajo |
| **Costo** | Alto (N DBs) | Medio | Bajo (1 DB) |
| **Migrations** | Complejo (correr en N DBs) | Complejo | Simple |
| **Riesgo de data leak** | Mínimo | Bajo | Bug = exposición total |
| **Cuándo usar** | Regulación estricta (HIPAA, GDPR) | Balance seguridad/costo | Startups, muchos tenants pequeños |

---

## DevOps

### Docker Compose vs Kubernetes

| | Docker Compose | Kubernetes |
|---|---|---|
| **Propósito** | Desarrollo local, testing | Producción, orquestación |
| **Auto-healing** | ❌ No | ✅ Reinicia pods caídos |
| **Scaling** | Manual | ✅ HPA automático |
| **Load balancing** | Básico | ✅ Nativo (Service) |
| **Secretos** | `.env` files | Secrets, External Secrets |
| **Curva de aprendizaje** | Baja | Alta |
| **Cuándo usar** | Dev local, CI, staging simple | Producción, múltiples réplicas, escala |

**Regla:** Docker Compose para desarrollo y CI. Kubernetes para producción cuando necesitás escala, self-healing o deploys complejos.

---

### GitHub Actions vs Azure DevOps vs GitLab CI

| | GitHub Actions | Azure DevOps | GitLab CI |
|---|---|---|---|
| **Integración** | GitHub nativo | Azure ecosystem | GitLab nativo |
| **Marketplace** | ✅ Enorme | Medio | Medio |
| **Self-hosted runners** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Cost (public repos)** | Gratis | Gratis (5 usuarios) | Gratis |
| **Cuándo usar** | Repos en GitHub | Empresa con Azure/ADO ya instalado | Repos en GitLab, on-premise |
