---
id: system-design
title: System Design
sidebar_position: 7
---

# System Design 🔴

El System Design es una sección crítica en entrevistas Senior. Se espera que puedas diseñar sistemas escalables desde cero.

## Framework para responder preguntas de System Design

```
1. Clarificar requerimientos (5 min)
   - ¿Cuántos usuarios? ¿Cuántas requests/seg?
   - ¿Consistencia o disponibilidad?
   - ¿Qué funcionalidades son core?

2. Estimaciones (2-3 min)
   - Usuarios: 10M DAU
   - Writes: 1000 rps, Reads: 10.000 rps
   - Storage: X GB/día

3. High-Level Design (10 min)
   - Componentes principales
   - Flujo de datos

4. Deep Dive (15 min)
   - Cuello de botella
   - Trade-offs

5. Cierre
   - Monitoreo
   - Puntos de falla
```

---

## Ejemplo: Diseñar un sistema de acortador de URLs (bit.ly)

### Requerimientos
```
Funcionales:
- Dado una URL larga, generar una URL corta
- Redirigir a la URL original al acceder a la corta
- Las URLs expiran después de 5 años

No funcionales:
- 100M URLs creadas por día = 1.160 escrituras/seg
- 10:1 ratio lectura/escritura = 11.600 lecturas/seg
- Alta disponibilidad (redireccionamiento no puede fallar)
- Latencia baja en redirecciones
```

### Estimaciones
```
Storage:
- 100M URLs/día × 365 × 5 años = 182.500M registros
- ~500 bytes por registro = 91 TB en 5 años

Bandwidth:
- Writes: 1.160 rps × 500 bytes = 580 KB/s
- Reads: 11.600 rps × 500 bytes = 5.8 MB/s
```

### Design

```
                           ┌─────────────────────────────┐
Usuarios ──→ DNS/CDN ──→   │        API Servers           │
                           │  (stateless, horizontally    │
                           │   scalable behind LB)        │
                           └──────┬──────────────┬────────┘
                                  │              │
                            ┌─────▼───┐    ┌────▼──────┐
                            │  Cache   │    │    DB     │
                            │ (Redis)  │    │(Cassandra)│
                            │          │    │           │
                            │ shortUrl │    │ shortUrl  │
                            │ → longUrl│    │ longUrl   │
                            └──────────┘    │ userId    │
                                           │ createdAt │
                                           └───────────┘
```

### Generación de Short URLs

```csharp
// Opción 1: Base62 encoding de un ID
// ID: 100000 → Base62: "27c" (7 caracteres = 62^7 = 3.5 trillones combinaciones)
public string AcortarUrl(long id)
{
    const string chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    var sb = new StringBuilder();
    while (id > 0)
    {
        sb.Insert(0, chars[(int)(id % 62)]);
        id /= 62;
    }
    return sb.ToString().PadLeft(7, '0');
}

// Opción 2: Hash MD5/SHA256 + tomar primeros 7 chars
// Riesgo de colisiones

// Opción 3: UUID + base62 (globalmente único)
```

---

## Ejemplo: Diseñar un feed de redes sociales

### Fanout approaches

```
FANOUT ON WRITE (push model):
Al publicar, escribir en el feed de TODOS los seguidores
+ Leer el feed es O(1)
- Costoso para usuarios con millones de seguidores (celebrities)
- Usuarios inactivos reciben escrituras innecesarias

FANOUT ON READ (pull model):
Al leer el feed, traer posts de todos los seguidos y mergear
+ Publicar es barato
- Leer es costoso (N queries por N seguidos)

SOLUCIÓN HÍBRIDA (como Twitter/X):
- Usuarios normales: fanout on write
- Celebrities (>10K seguidores): fanout on read
- Al leer, mergear el feed pre-computado + posts de celebrities
```

---

## Escalabilidad horizontal

```
Estrategias clave:

1. LOAD BALANCING
   - Round Robin, Least Connections, IP Hash
   - Health checks para eliminar instancias caídas

2. DATABASE SCALING
   - Read Replicas: para escalar reads
   - Sharding: para escalar writes (ej: por user_id % N_shards)
   - Master-Slave vs Multi-Master

3. CACHING LAYERS
   - CDN: assets estáticos (CSS, JS, imágenes)
   - Application Cache (Redis): queries frecuentes
   - Query Cache: resultados de DB

4. MESSAGE QUEUES
   - Desacoplar writes asíncronos
   - Absorber picos de tráfico
   - Fan-out processing

5. ASYNC PROCESSING
   - Background jobs (Hangfire, Quartz)
   - Event-driven con RabbitMQ/Kafka
```

---

## Números útiles para estimaciones

```
Latencia aproximada:
- L1 cache reference:     0.5 ns
- L2 cache reference:     7 ns
- Main memory:            100 ns
- SSD read:               150 μs
- HDD seek:               10 ms
- Packet: CA → Netherlands: 150 ms

Tamaños:
- 1 char = 1 byte
- UUID/GUID = 36 bytes (string) o 16 bytes (binary)
- 1 KB = 1.000 bytes
- 1 MB = 10^6 bytes
- 1 GB = 10^9 bytes

DAU típicos:
- 1M DAU: startup
- 10M DAU: scale-up (pensando en horizontal scaling)
- 100M+ DAU: big tech (microservicios, sharding, etc.)
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cómo diseñarías un sistema de notificaciones en tiempo real?**
> **WebSockets** para conexión bidireccional persistente. Un servidor de notificaciones con un Message Broker (Redis Pub/Sub o Kafka). Al llegar un evento, el servicio publica en Redis, el servidor de notificaciones lo recibe y lo envía al cliente conectado por WebSocket. Para escalar: usar sticky sessions o un broker centralizado.

**2. ¿Cómo manejarías la consistencia de datos en un sistema de reservas (ej: tickets)?**
> Usar **optimistic locking**: en la fila del ticket, tener una columna `version`. Al reservar: `UPDATE tickets SET reservado=true, version=version+1 WHERE id=X AND reservado=false AND version=N`. Si 0 rows afectadas → alguien más se adelantó. Para alta concurrencia: Redis con `SETNX` (atómica) como sistema de locks distribuidos.

**3. ¿Cuándo usarías SQL vs NoSQL?**
> **SQL**: relaciones complejas, ACID necesario, esquema bien definido, reporting. **NoSQL**: escala masiva horizontal, esquema flexible/variable, alto throughput de escritura, datos jerárquicos/documentos. No es SQL vs NoSQL, muchas apps usan ambos (polyglot persistence).

**4. ¿Cómo harías para que un sistema soporte 10x más tráfico del actual?**
> Primero: medir dónde está el bottleneck. Luego (en orden de costo/impacto): agregar caché (Redis), read replicas en la DB, escalar horizontalmente los app servers, optimizar queries más lentas, CDN para assets, separar servicios con mucho tráfico (microservicios), sharding de la DB.

---

