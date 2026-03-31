---
id: transacciones-base-datos
title: Transacciones en Base de Datos
sidebar_position: 13
---

# Transacciones en Base de Datos 🟡

## ACID Properties

Toda transacción debe cumplir ACID para garantizar integridad de datos:

```
Atomicity        → Todo o nada. Si falla un paso, rollback completo
Consistency      → Los datos pasan de un estado válido a otro válido
Isolation        → Las transacciones no interfieren entre sí
Durability       → Una vez commiteada, persiste ante fallos
```

---

## Transaction Basics en Entity Framework Core

```csharp
// Transacción simple implícita (SaveChanges inicia automáticamente)
using var context = new AppDbContext();

var usuario = new Usuario { Email = "nuevo@test.com", Nombre = "Juan" };
context.Usuarios.Add(usuario);
context.SaveChanges();  // ← Transacción implícita: BEGIN → INSERT → COMMIT

// ✅ Transacción explícita con control total
using var context = new AppDbContext();
using var transaction = await context.Database.BeginTransactionAsync();

try
{
    var usuario = await context.Usuarios.FirstAsync(u => u.Id == 1);
    usuario.Saldo -= 100;

    var pedido = new Pedido { UsuarioId = usuario.Id, Total = 100 };
    context.Pedidos.Add(pedido);

    await context.SaveChangesAsync();
    await transaction.CommitAsync();
    
    return Ok("Pedido creado exitosamente");
}
catch (Exception ex)
{
    await transaction.RollbackAsync();
    _logger.LogError(ex, "Error creando pedido");
    throw;
}

// ✅ Using AutoTransaction para no repetir try-catch
public class TransactionService
{
    private readonly AppDbContext _db;

    public async Task<T> ExecuteInTransactionAsync<T>(
        Func<Task<T>> operacion, 
        IsolationLevel isolationLevel = IsolationLevel.ReadCommitted)
    {
        using var transaction = await _db.Database
            .BeginTransactionAsync(isolationLevel);

        try
        {
            var resultado = await operacion();
            await transaction.CommitAsync();
            return resultado;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }
}

// Uso
var resultado = await _transactionService.ExecuteInTransactionAsync(async () =>
{
    var usuario = await _db.Usuarios.FirstAsync(u => u.Id == 1);
    usuario.Saldo -= 100;
    await _db.SaveChangesAsync();
    return "Actualizado";
});
```

---

## Isolation Levels

```csharp
// ⚠️ Cada nivel tiene trade-offs: consistencia vs concurrencia

var isolationLevels = new Dictionary<IsolationLevel, string>
{
    // READ UNCOMMITTED: Dirty reads posible (lectura de datos no commiteados)
    // ❌ Evitar — muy riesgoso
    [IsolationLevel.ReadUncommitted] = "dirty_read_posible",

    // READ COMMITTED: (Default en SQL Server)
    // ✅ Leer solo datos ya commiteados
    // ⚠️ Non-repeatable reads: puedo leer distinto si otro hace UPDATE
    [IsolationLevel.ReadCommitted] = "consistencia_razonable",

    // REPEATABLE READ: (Default en MySQL)
    // ✅ Misma query retorna mismos datos en la misma transacción
    // ⚠️ Phantom reads: otros pueden INSERT nuevas filas
    [IsolationLevel.RepeatableRead] = "repeatable_reads_ok",

    // SERIALIZABLE: (Máxima consistencia, mínima velocidad)
    // ✅ Completa aislamiento — actúa como si las transacciones corren secuencialmente
    // ❌ Lento — lock agresivo
    [IsolationLevel.Serializable] = "máximo_aislamiento",
};

// Ejemplo: READ COMMITTED (default safe)
using var transaction = await context.Database
    .BeginTransactionAsync(IsolationLevel.ReadCommitted);

// Ejemplo: SERIALIZABLE para operaciones críticas (transferencias de dinero)
using var criticalTransaction = await context.Database
    .BeginTransactionAsync(IsolationLevel.Serializable);
```

---

## Deadlocks — Detección y Prevención

### ¿Qué es un deadlock?

Un deadlock ocurre cuando dos (o más) transacciones se esperan mutuamente, formando un ciclo. La base de datos detecta el ciclo y mata a la "víctima" (la transacción con menor costo de rollback), que recibe el error 1205 en SQL Server.

```
Transacción A                     Transacción B
─────────────────────────         ─────────────────────────
LOCK Row(usuario_id=1)            LOCK Row(usuario_id=2)
... hace trabajo ...              ... hace trabajo ...
Espera LOCK Row(usuario_id=2) ←→  Espera LOCK Row(usuario_id=1)
         ↑                                    ↑
         └──────────── DEADLOCK ──────────────┘
```

```csharp
// ❌ DEADLOCK: Transacción A accede 1→2, Transacción B accede 2→1
// Transacción A
using var tx1 = await db.Database.BeginTransactionAsync();
var usuario1 = await db.Usuarios.FirstAsync(u => u.Id == 1); // LOCK fila 1
await Task.Delay(100); // simula trabajo
var usuario2 = await db.Usuarios.FirstAsync(u => u.Id == 2); // espera LOCK fila 2 ← DEADLOCK

// Transacción B (paralela)
using var tx2 = await db.Database.BeginTransactionAsync();
var u2 = await db.Usuarios.FirstAsync(u => u.Id == 2); // LOCK fila 2
await Task.Delay(100);
var u1 = await db.Usuarios.FirstAsync(u => u.Id == 1); // espera LOCK fila 1 ← DEADLOCK
```

---

### Prevención: acceso ordenado a recursos

La solución más efectiva: **siempre acceder a los recursos en el mismo orden**.

```csharp
// ✅ SOLUCIÓN 1: Ordenar los IDs antes de acceder
public async Task TransferirAsync(int idOrigen, int idDestino, decimal monto)
{
    // Ordenar para garantizar acceso consistente
    var ids = new[] { idOrigen, idDestino }.OrderBy(id => id).ToArray();

    using var tx = await db.Database.BeginTransactionAsync();

    // Carga ambas filas en orden (el ORDER BY garantiza el lock en mismo orden)
    var usuarios = await db.Usuarios
        .Where(u => ids.Contains(u.Id))
        .OrderBy(u => u.Id)  // ← CLAVE: mismo orden en todas las transacciones
        .ToListAsync();

    var origen  = usuarios.First(u => u.Id == idOrigen);
    var destino = usuarios.First(u => u.Id == idDestino);

    if (origen.Saldo < monto)
        throw new InvalidOperationException("Saldo insuficiente");

    origen.Saldo  -= monto;
    destino.Saldo += monto;

    await db.SaveChangesAsync();
    await tx.CommitAsync();
}
```

### Prevención: reducir la duración de las transacciones

```csharp
// ❌ Transacción larga — maximiza la ventana de deadlock
using var tx = await db.Database.BeginTransactionAsync();
var datos = await db.Pedidos.ToListAsync();
await ProcesarPedidosExternos(datos); // ← llamada externa lenta dentro de tx
await db.SaveChangesAsync();
await tx.CommitAsync();

// ✅ Mínimo trabajo dentro de la transacción
var datos = await db.Pedidos.AsNoTracking().ToListAsync(); // lectura fuera de tx
var resultado = await ProcesarPedidosExternos(datos); // procesamiento fuera de tx

// Solo la escritura va dentro de la tx
using var tx = await db.Database.BeginTransactionAsync();
await GuardarResultados(resultado);
await tx.CommitAsync();
```

### Prevención: UPDLOCK hint para read-then-update

Cuando sabes que vas a modificar lo que lees, usa `UPDLOCK` para prevenir conflictos:

```csharp
// ✅ UPDLOCK: toma lock de escritura en la lectura
// Evita el patrón "read-modify-write" que genera deadlocks
var producto = await db.Productos
    .FromSqlRaw("SELECT * FROM Productos WITH (UPDLOCK) WHERE Id = {0}", id)
    .FirstAsync();

producto.Stock -= cantidad;
await db.SaveChangesAsync();
```

---

### Detección: identificar deadlocks en SQL Server

```sql
-- Ver sesiones bloqueadas actualmente
SELECT
    blocking.session_id AS bloqueador,
    blocked.session_id  AS bloqueado,
    blocked_sql.text    AS query_bloqueada,
    blocked.wait_time   AS tiempo_espera_ms,
    blocked.wait_type
FROM sys.dm_exec_requests blocked
JOIN sys.dm_exec_requests blocking
    ON blocked.blocking_session_id = blocking.session_id
CROSS APPLY sys.dm_exec_sql_text(blocked.sql_handle) blocked_sql;

-- Habilitar Trace Flag para loguear deadlocks en el error log
DBCC TRACEON(1222, -1); -- detalle completo del deadlock graph

-- En PostgreSQL: ver locks activos
SELECT pid, query, state, wait_event_type, wait_event
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```

### Detección: retry automático en .NET

```csharp
// ✅ Polly: política de retry específica para deadlocks
using Polly;
using Polly.Retry;

public class TransaccionService
{
    private readonly AsyncRetryPolicy _deadlockRetry;

    public TransaccionService()
    {
        _deadlockRetry = Policy
            .Handle<DbUpdateException>(ex =>
                ex.InnerException?.Message.Contains("deadlock", StringComparison.OrdinalIgnoreCase) == true ||
                ex.InnerException?.Message.Contains("1205") == true) // SQL Server error code
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: attempt => TimeSpan.FromMilliseconds(Math.Pow(2, attempt) * 100),
                onRetry: (ex, delay, attempt, _) =>
                    _logger.LogWarning("Deadlock detectado (intento {Attempt}). Reintentando en {Delay}ms", attempt, delay.TotalMilliseconds)
            );
    }

    public async Task EjecutarConRetry(Func<Task> operacion)
    {
        await _deadlockRetry.ExecuteAsync(operacion);
    }
}

// Uso
await _transaccionService.EjecutarConRetry(async () =>
{
    using var tx = await db.Database.BeginTransactionAsync();
    await TransferirAsync(origenId, destinoId, monto);
    await tx.CommitAsync();
});
```

---

### Resumen: estrategias de prevención

| Estrategia | Cómo | Cuándo |
|---|---|---|
| Acceso ordenado | `OrderBy(id)` antes de lockear | Siempre que accedas a múltiples filas |
| Transacciones cortas | Mínimo trabajo dentro de `tx` | Siempre |
| UPDLOCK hint | `WITH (UPDLOCK)` en el SELECT | Read-then-update de filas individuales |
| Optimistic locking | `RowVersion`/`[Timestamp]` + retry | Alta concurrencia, conflictos poco frecuentes |
| Retry automático | Polly con retry en deadlock | Como último recurso, no como primera opción |

---

## SaveChanges vs SaveChangesAsync

```csharp
// ❌ NUNCA hacer esto: Transacción de larga duración en el thread pool
var resultado = await context.SaveChangesAsync();  // ← Corre en thread pool

// ✅ MEJOR: Usar async/await correctamente
public async Task<int> CrearProductoAsync(CreateProductoDto dto)
{
    var producto = new Producto { Nombre = dto.Nombre, Precio = dto.Precio };
    context.Productos.Add(producto);
    
    // SaveChangesAsync puede tomar tiempo — dejar que sea async de verdad
    await context.SaveChangesAsync();
    
    return producto.Id;
}

// ⚠️ Problema: SaveChanges dentro de un middleware/controller sin await puede causar issues
[HttpPost]
public IActionResult CrearProducto(CreateProductoDto dto)
{
    var producto = new Producto { Nombre = dto.Nombre };
    context.Productos.Add(producto);
    context.SaveChanges();  // ← Bloqueante pero okay en controller
    
    return CreatedAtAction(nameof(GetProducto), new { id = producto.Id });
}

// ✅ Mejor: Hacer todo async
[HttpPost]
public async Task<IActionResult> CrearProductoAsync(CreateProductoDto dto)
{
    var producto = new Producto { Nombre = dto.Nombre };
    context.Productos.Add(producto);
    await context.SaveChangesAsync();
    
    return CreatedAtAction(nameof(GetProducto), new { id = producto.Id });
}
```

---

## Optimistic vs Pessimistic Locking

```csharp
// ✅ OPTIMISTIC LOCKING: Asumir que no habrá conflictos, validar al commit
public class Producto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = null!;
    public decimal Precio { get; set; }
    
    [Timestamp]  // ← Columna special en BD (rowversion en SQL Server)
    public byte[] RowVersion { get; set; } = null!;
}

// Uso
try
{
    var producto = await context.Productos.FirstAsync(p => p.Id == 1);
    producto.Precio = 99.99m;
    
    await context.SaveChangesAsync();  // Valida que RowVersion no cambió
}
catch (DbUpdateConcurrencyException ex)
{
    // Otro proceso cambió el producto entre read y update
    _logger.LogWarning("Concurrency conflict — retry or merge manually");
}

// ✅ PESSIMISTIC LOCKING: Lock inmediato en la BD
using var context = new AppDbContext();

// FOR UPDATE lock (en MySQL) o WITH (UPDLOCK) en SQL Server
var producto = await context.Productos
    .FromSqlInterpolated(@"SELECT * FROM Productos WHERE Id = {0} WITH (UPDLOCK)")
    .FirstAsync(1);

producto.Precio = 99.99m;
await context.SaveChangesAsync();  // Nadie más puede modificar mientras esto corre
```

---

## Distributed Transactions (Avanzado)

```csharp
// ❌ Evitar: Transacciones explícitas que abarcan múltiples servidores
// (MSDTC en Windows — costoso, lento, frágil)

// ✅ MEJOR: Usar patrón Saga para transacciones distribuidas
public class TransferenciaSagaOrchestrator
{
    private readonly IEventBus _eventBus;

    public async Task EjecutarTransferenciaSaga(
        int usuarioOrigenId, int usuarioDestinoId, decimal monto)
    {
        // Paso 1: Debitar cuenta origen (compensable)
        var debitEvent = new CuentaDebitada 
        { 
            UsuarioId = usuarioOrigenId, 
            Monto = monto,
            TransferId = Guid.NewGuid() 
        };
        await _eventBus.PublishAsync(debitEvent);

        // Paso 2: Creditar cuenta destino (compensable)
        var creditEvent = new CuentaCreditada 
        { 
            UsuarioId = usuarioDestinoId, 
            Monto = monto,
            TransferId = debitEvent.TransferId 
        };
        
        try
        {
            await _eventBus.PublishAsync(creditEvent);
        }
        catch
        {
            // Si falló el crédito — compensar el débito
            var compensateDebit = new DeshazerDebito 
            { 
                TransferId = debitEvent.TransferId 
            };
            await _eventBus.PublishAsync(compensateDebit);
            throw;
        }
    }
}

// vs. Transacción local simple en una BD
public async Task TransferirSinSaga(
    int usuarioOrigenId, int usuarioDestinoId, decimal monto)
{
    using var tx = await context.Database.BeginTransactionAsync();
    try
    {
        var origen = await context.Usuarios.FirstAsync(u => u.Id == usuarioOrigenId);
        origen.Saldo -= monto;

        var destino = await context.Usuarios.FirstAsync(u => u.Id == usuarioDestinoId);
        destino.Saldo += monto;

        await context.SaveChangesAsync();
        await tx.CommitAsync();
    }
    catch
    {
        await tx.RollbackAsync();
        throw;
    }
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué diferencia hay entre Optimistic y Pessimistic locking?**
> **Optimistic**: Asumir que no habrá conflictos, validar al commit. Si otro proceso modificó, falla y reintentas. Mejor concurrencia, peor para datos muy contenciosos. **Pessimistic**: Lock inmediato en la BD. Garantiza no hay conflictos pero bloquea otros. Mejor para datos que modifican mucho.

**2. ¿Cuándo usar transacciones explícitas vs SaveChanges implícitas?**
> SaveChanges implícitas están bien para operaciones simples. Transacciones explícitas cuando necesitas múltiples operaciones como unidad atómica, o cuando quieres especificar Isolation Level.

**3. ¿Qué causa un deadlock y cómo lo evitas?**
> Deadlock: Transacción A espera recurso de B, B espera recurso de A. Precaución: Acceder a recursos siempre en el mismo orden, usar timeouts, implementar retry con exponential backoff.

**4. ¿SERIALIZABLE vs READ_COMMITTED?**
> SERIALIZABLE: máxima consistencia, actúa secuencialmente, muy lento. READ_COMMITTED: default, otros pueden modificar datos que leíste (non-repeatable reads). Para casos normales usa READ_COMMITTED, para críticos (pagos) usa SERIALIZABLE o Optimistic locking.

**5. ¿Saga pattern vs distributed transactions with MSDTC?**
> **Saga**: cada paso es una transacción local, si uno falla compensas los anteriores. Resiliente, escalable. **MSDTC**: 2PC distribuido, frágil, lento. Usa Saga — es el estándar moderno.

**6. ¿Cómo manejas savechanges que timeout?**
> Usa SaveChangesAsync con timeout en la conexión (`database.connection-timeout`). Implementa retry con exponential backoff específicamente para deadlocks. Loguea timeouts para identificar operaciones lentas.

**7. ¿Usar Dapper vs EF Core para manejar transacciones?**
> **Dapper**: Control fino, más rápido para queries complejas. **EF Core**: Más simple para operaciones standard (CRUD + transacciones). Usa EF Core para business logic (garantiza transaction management), Dapper para reporting pesado.

**8. ¿Cómo debuggueas un deadlock?**
> En SQL Server: queriar `dm_exec_requests` y `dm_tran_locks`. En MySQL: `SHOW ENGINE INNODB STATUS`. Mira quién está esperando qué recurso. Soluciona siempre: acceso ordenado a recursos.