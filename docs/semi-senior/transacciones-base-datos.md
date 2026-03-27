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

## Deadlocks y cómo evitarlos

```csharp
// ❌ DEADLOCK: Transacción A espera por recurso de B, B espera por A
// Transacción A
using var tx1 = await db.Database.BeginTransactionAsync();
var usuario1 = await db.Usuarios.FirstAsync(u => u.Id == 1);
usuario1.Saldo -= 50;
await Task.Delay(2000);  // Simular trabajo
var usuario2 = await db.Usuarios.FirstAsync(u => u.Id == 2);  // ← DEADLOCK aquí

// Transacción B (corre en paralelo)
using var tx2 = await db.Database.BeginTransactionAsync();
var usuario2b = await db.Usuarios.FirstAsync(u => u.Id == 2);
usuario2b.Saldo += 50;
await Task.Delay(2000);
var usuario1b = await db.Usuarios.FirstAsync(u => u.Id == 1);  // ← DEADLOCK aquí

// ✅ SOLUCIÓN 1: Siempre acceder a recursos en el mismo orden
using var tx1 = await db.Database.BeginTransactionAsync();
var usuario1 = await db.Usuarios.Where(u => u.Id == 1 || u.Id == 2)
    .OrderBy(u => u.Id)
    .ToListAsync();  // Ambas transacciones acceden en orden: 1, 2

// ✅ SOLUCIÓN 2: Retry con exponential backoff
public async Task<T> RetryOnDeadlock<T>(
    Func<Task<T>> operacion, 
    int maxReintentos = 3)
{
    for (int intento = 0; intento < maxReintentos; intento++)
    {
        try
        {
            return await operacion();
        }
        catch (DbUpdateException ex) when (
            ex.InnerException?.Message.Contains("DEADLOCK") == true)
        {
            if (intento == maxReintentos - 1) throw;

            var delay = (int)Math.Pow(2, intento) * 100;  // 100ms, 200ms, 400ms
            await Task.Delay(delay);
            _logger.LogWarning($"Deadlock detectado. Reintentando en {delay}ms...");
        }
    }

    throw new InvalidOperationException("Max retries reached");
}

// Uso
var resultado = await RetryOnDeadlock(async () =>
{
    using var tx = await db.Database.BeginTransactionAsync();
    // Transacción riesgosa de deadlock
    await tx.CommitAsync();
    return true;
});
```

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