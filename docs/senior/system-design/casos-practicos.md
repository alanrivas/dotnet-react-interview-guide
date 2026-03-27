---
title: "💬 Casos Prácticos: Chat, Pagos y Búsqueda"
sidebar_position: 2
---

# 💬 Casos Prácticos: Chat, Pagos y Búsqueda

## Ejemplo: Diseñar un sistema de chat (tipo WhatsApp)

### Requerimientos
```
Funcionales:
- Mensajes 1:1 y grupos (hasta 500 miembros)
- Indicadores de entrega (enviado ✓, entregado ✓✓, leído ✓✓ azul)
- Presencia online/offline
- Historial de mensajes

No funcionales:
- 50M DAU, cada usuario envía ~40 msgs/día
- Writes: ~23.000 msg/seg
- Latencia < 500ms para entrega
- Alta disponibilidad (99.99%)
```

### Estimaciones
```
Mensajes:
  50M usuarios × 40 msgs/día = 2.000M msgs/día
  2.000M / 86.400 seg ≈ 23.000 msgs/seg (writes)
  Reads: ~5× → 115.000 msgs/seg

Storage:
  Asumiendo retención de 5 años, ~100 bytes/msg:
  2.000M × 365 × 5 × 100 bytes ≈ 365 TB

Conexiones WebSocket simultáneas:
  50M DAU con ~10% concurrencia ≈ 5M conexiones activas
```

### Arquitectura

```
                         ┌──────────────────────────┐
Clientes ──WebSocket──→  │   Chat Servers            │
                         │   (stateful, millones de  │
                         │    conexiones por servidor)│
                         └──────────┬───────────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               ↓                    ↓                    ↓
        ┌─────────────┐    ┌─────────────────┐  ┌──────────────┐
        │  Presence   │    │  Message Queue  │  │  Push Notif  │
        │  Service    │    │  (Kafka)        │  │  Service     │
        │  (Redis)    │    │                 │  │  (APNs/FCM)  │
        └─────────────┘    └────────┬────────┘  └──────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │  Message Storage   │
                          │  (Cassandra)       │
                          │  Particionada por  │
                          │  conversation_id   │
                          └────────────────────┘
```

### Flujo de entrega de un mensaje

```
1. User A (conectado a ChatServer1) envía msg a User B

2. ChatServer1:
   a. Persiste msg en Cassandra con status=SENT
   b. Publica en Kafka: topic "messages", key=conversation_id

3. Message Router consume de Kafka:
   a. Busca en qué ChatServer está conectado User B
      (Lookup en Redis: user_id → server_id)
   b. Si User B está online → envía el msg al ChatServer de B
   c. Si User B está offline → encola en Push Notification Service

4. ChatServer de B entrega por WebSocket al cliente B
   B confirma recepción → actualizar status a DELIVERED

5. B abre el mensaje → actualizar status a READ
   ChatServer notifica a A el cambio de status
```

### Schema en Cassandra (optimizado para leer por conversación)

```sql
-- Partition key: conversation_id (todos los msgs de una conv juntos)
-- Clustering key: created_at DESC (últimos msgs primero)
CREATE TABLE messages (
    conversation_id UUID,
    created_at      TIMESTAMP,
    message_id      UUID,
    sender_id       BIGINT,
    content         TEXT,
    status          TEXT,   -- SENT | DELIVERED | READ
    PRIMARY KEY (conversation_id, created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC);

-- Para cargar últimos 50 msgs de una conversación:
-- SELECT * FROM messages WHERE conversation_id = ? LIMIT 50
-- → O(1) porque está en la misma partición
```

### Por qué Cassandra y no PostgreSQL

```
Chat tiene un patrón de acceso muy específico:
- Siempre lees mensajes de UNA conversación (sin JOINs)
- Writes extremadamente frecuentes (23K/seg)
- Los datos son inmutables (los msgs no se editan, solo se añade status)
- Necesitas escalar horizontalmente sin sharding manual

Cassandra resuelve todo esto nativamente:
- Partición por conversation_id → todos los msgs juntos en disco
- Escala horizontal simple (añadir nodos)
- Alta write throughput
- Tunable consistency (QUORUM para writes importantes)
```

---

## Ejemplo: Diseñar un sistema de pagos

### Por qué es especial

Los sistemas de pagos tienen requisitos únicos:
- **Idempotencia**: el mismo pago no puede procesarse dos veces
- **Atomicidad**: débito y crédito ocurren juntos o ninguno
- **Auditabilidad**: todo debe ser trazable y reversible

### Requerimientos
```
Funcionales:
- Procesar pagos entre usuarios (débito de origen, crédito a destino)
- Soportar múltiples métodos: tarjeta, wallet, transferencia
- Historial de transacciones
- Reembolsos

No funcionales:
- 1M transacciones/día = ~12 TPS en promedio, picos de 100 TPS
- Consistency FUERTE (nada de eventual consistency aquí)
- 99.999% availability (5 nines)
- Idempotencia garantizada
```

### Patrón Idempotency Key

```
El cliente genera un idempotency_key único (UUID) antes de enviar.
Si el request falla o hay timeout, puede reenviar el MISMO key.
El servidor detecta el key duplicado y devuelve el resultado anterior
sin procesar el pago de nuevo.

Request:
  POST /payments
  Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
  {
    "from": "user_a",
    "to": "user_b",
    "amount": 100.00,
    "currency": "USD"
  }
```

```csharp
public class PaymentService
{
    private readonly AppDbContext _db;
    private readonly IDistributedCache _redis;

    public async Task<PaymentResult> ProcessPaymentAsync(
        PaymentRequest request,
        string idempotencyKey)
    {
        // 1. Verificar idempotencia: ¿ya procesamos este key?
        var existingResult = await _redis.GetStringAsync($"idempotency:{idempotencyKey}");
        if (existingResult is not null)
            return JsonSerializer.Deserialize<PaymentResult>(existingResult)!;

        // 2. Adquirir lock distribuido para este idempotency key
        //    (evitar race condition si dos requests llegan simultáneamente)
        var lockKey = $"lock:payment:{idempotencyKey}";
        var lockAcquired = await TryAcquireLockAsync(lockKey);
        if (!lockAcquired) throw new ConcurrentPaymentException();

        try
        {
            // 3. Doble verificación después del lock
            existingResult = await _redis.GetStringAsync($"idempotency:{idempotencyKey}");
            if (existingResult is not null)
                return JsonSerializer.Deserialize<PaymentResult>(existingResult)!;

            // 4. Ejecutar la transacción ACID en la DB
            using var transaction = await _db.Database.BeginTransactionAsync(
                IsolationLevel.Serializable); // El más estricto, evita phantom reads

            var from = await _db.Accounts
                .Where(a => a.UserId == request.FromUserId)
                .FirstOrDefaultAsync()
                ?? throw new AccountNotFoundException();

            if (from.Balance < request.Amount)
                throw new InsufficientFundsException();

            from.Balance -= request.Amount;

            var to = await _db.Accounts
                .Where(a => a.UserId == request.ToUserId)
                .FirstOrDefaultAsync()
                ?? throw new AccountNotFoundException();

            to.Balance += request.Amount;

            // 5. Registrar en el ledger (inmutable)
            _db.Transactions.Add(new Transaction
            {
                Id              = Guid.NewGuid(),
                IdempotencyKey  = idempotencyKey,
                FromAccountId   = from.Id,
                ToAccountId     = to.Id,
                Amount          = request.Amount,
                Currency        = request.Currency,
                Status          = "COMPLETED",
                CreatedAt       = DateTime.UtcNow
            });

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            var result = new PaymentResult { Success = true, TransactionId = Guid.NewGuid() };

            // 6. Guardar resultado en caché de idempotencia (TTL 24h)
            await _redis.SetStringAsync(
                $"idempotency:{idempotencyKey}",
                JsonSerializer.Serialize(result),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
                });

            return result;
        }
        finally
        {
            await ReleaseLockAsync(lockKey);
        }
    }
}
```

### Double-Entry Ledger (Libro mayor de doble entrada)

```
Principio contable fundamental: cada transacción tiene DÉBITO y CRÉDITO.
Los saldos nunca se borran, solo se añaden entradas.

Tabla transactions (append-only, nunca UPDATE ni DELETE):
┌──────────────┬───────────────┬──────────────┬──────────┬───────┐
│ tx_id        │ account_id    │ amount       │ type     │ ref   │
├──────────────┼───────────────┼──────────────┼──────────┼───────┤
│ tx001        │ account_A     │  -100.00     │ DEBIT    │ pay01 │
│ tx002        │ account_B     │  +100.00     │ CREDIT   │ pay01 │
│ tx003        │ account_A     │  +100.00     │ CREDIT   │ ref01 │ ← reembolso
│ tx004        │ account_B     │  -100.00     │ DEBIT    │ ref01 │
└──────────────┴───────────────┴──────────────┴──────────┴───────┘

Balance de account_A = SUM(amount) = -100 + 100 = 0
Balance de account_B = SUM(amount) = +100 - 100 = 0

Ventaja: Auditoría completa. Cualquier discrepancia es detectable.
         El saldo siempre se puede recalcular desde cero.
```

### Manejo de fallos con Saga Pattern

```
Problema: un pago puede involucrar múltiples servicios (bank, fraud-check, ledger).
Las transacciones distribuidas con 2PC son lentas y frágiles.

SAGA PATTERN: secuencia de transacciones locales + compensaciones.

Pago exitoso:
  1. ReservarFondos(from) → OK
  2. FraudCheck() → OK
  3. TransferirFondos(from, to) → OK
  4. NotificarUsuarios() → OK

Pago fallido en paso 3:
  3. TransferirFondos → FALLA
  ← LiberarFondos(from) [compensación de paso 1]

Cada paso tiene una transacción de compensación para deshacer su efecto.
```

---

## Ejemplo: Diseñar un sistema de búsqueda (tipo Elasticsearch)

### Concepto clave: Índice Invertido

```
ÍNDICE NORMAL (tabla → fila):
  doc_id 1: "el gato come pescado"
  doc_id 2: "el perro come carne"
  doc_id 3: "el gato duerme"

ÍNDICE INVERTIDO (palabra → documentos que la contienen):
  "el"      → [1, 2, 3]
  "gato"    → [1, 3]
  "come"    → [1, 2]
  "pescado" → [1]
  "perro"   → [2]
  "carne"   → [2]
  "duerme"  → [3]

Buscar "gato come" → intersección de [1,3] y [1,2] = [1]
Resultado: doc_id 1, en O(1) sin escanear todos los documentos.
```

### Arquitectura de ingesta

```
Datos fuente
    │
    ↓
┌───────────────┐
│  Indexer      │  ← Tokenización, stemming, stop words
│  Service      │     "gatos" → "gat" (stem)
│               │     "el, la, los" → ignorar (stop words)
└───────┬───────┘
        │
        ↓
┌───────────────┐     ┌──────────────────────┐
│  Kafka        │────→│  Index Shards        │
│  (buffer de   │     │  (Lucene segments)   │
│   ingesta)    │     │  Shard por rango     │
└───────────────┘     │  de doc_ids          │
                      └──────────────────────┘
```

### Arquitectura de consulta

```
Query: "gato AND come NOT perro"
    │
    ↓
┌───────────────────┐
│  Query Parser     │  ← Parsea sintaxis, expande sinónimos
└──────────┬────────┘
           │
           ↓ (broadcast a todos los shards en paralelo)
┌──────────┬──────────┬──────────┐
│ Shard 1  │ Shard 2  │ Shard 3  │  ← Cada shard evalúa la query
│ results  │ results  │ results  │     y calcula relevancia (TF-IDF)
└──────────┴──────────┴──────────┘
           │
           ↓
┌───────────────────┐
│  Result Merger    │  ← Merge de resultados, ranking global
│  & Ranker         │
└──────────┬────────┘
           │
           ↓
        Top-K resultados al cliente
```

### TF-IDF (Relevancia básica)

```
TF (Term Frequency): cuántas veces aparece el término en el doc
  TF("gato", doc1) = 2/10 = 0.2 (2 ocurrencias en 10 palabras)

IDF (Inverse Document Frequency): cuán raro es el término en el corpus
  IDF("gato") = log(N_docs / N_docs_con_gato) = log(1M / 50K) = 3.0

  Palabras raras tienen IDF alto → más discriminativas
  Palabras comunes ("el", "de") tienen IDF bajo → menos relevantes

TF-IDF = TF × IDF
  → Docs que usan el término frecuentemente Y el término es raro = alta relevancia
```

---

## Checklist de System Design para entrevistas

Antes de empezar a diseñar, preguntar siempre:

```
ESCALA:
□ ¿Cuántos usuarios (DAU/MAU)?
□ ¿Cuántas requests por segundo (peak/promedio)?
□ ¿Cuánto storage necesitamos?

CONSISTENCIA:
□ ¿Necesitamos consistencia fuerte o eventual es aceptable?
□ ¿Qué pasa si perdemos un dato? ¿Cuánto durability necesitamos?

DISPONIBILIDAD:
□ ¿Cuánto downtime es aceptable? (99.9% = 8.7h/año, 99.99% = 52min/año)
□ ¿Necesitamos multi-región?

LATENCIA:
□ ¿Cuál es la latencia máxima aceptable (p99)?
□ ¿Es lectura o escritura el path crítico?
```

### Los 6 trade-offs que siempre aparecen

| Trade-off | Opción A | Opción B |
|-----------|----------|----------|
| **Consistencia vs Disponibilidad** | CP (SQL) | AP (Cassandra) |
| **Latencia vs Consistencia** | Caché (rápido, puede ser stale) | DB directa (lento, siempre fresco) |
| **Normalización vs Denormalización** | Sin redundancia, JOINs | Redundancia, lecturas rápidas |
| **Push vs Pull (fanout)** | Write costoso, read barato | Write barato, read costoso |
| **Sharding vs Replicación** | Escala writes | Escala reads |
| **SQL vs NoSQL** | ACID, JOINs, schema fijo | Escala horizontal, schema flexible |
