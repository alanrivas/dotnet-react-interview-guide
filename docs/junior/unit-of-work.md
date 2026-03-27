---
id: unit-of-work
title: Unit of Work Pattern
sidebar_position: 17
---

# Unit of Work Pattern 🟢

El patrón Unit of Work (UoW) es un pattern que coordina múltiples operaciones en la base de datos como una transacción. Es fundamental para trabajar con Entity Framework de forma profesional.

## ¿Por qué Unit of Work?

Cuando necesitas hacer múltiples cambios en diferentes entidades y garantizar que todos se guardan juntos o ninguno.

```csharp
// ❌ SIN Unit of Work: código acoplado, difícil de testear
public class ProductoService
{
    private readonly AppDbContext _db;
    
    public async Task CrearWithInventarioAsync(CrearProductoDto dto)
    {
        var producto = new Producto { Nombre = dto.Nombre };
        _db.Productos.Add(producto);
        await _db.SaveChangesAsync(); // Primer SaveChanges
        
        var inventario = new Inventario { ProductoId = producto.Id, Stock = 100 };
        _db.Inventarios.Add(inventario);
        await _db.SaveChangesAsync(); // Segundo SaveChanges
        
        // Si falla entre medio, quedan inconsistencias
    }
}

// ✓ CON Unit of Work: coordina todo
public async Task CrearWithInventarioAsync(CrearProductoDto dto)
{
    using (var uow = new UnitOfWork(_db))
    {
        var producto = new Producto { Nombre = dto.Nombre };
        await uow.Productos.AddAsync(producto);
        
        var inventario = new Inventario { ProductoId = producto.Id, Stock = 100 };
        await uow.Inventarios.AddAsync(inventario);
        
        // Un único SaveChanges
        await uow.SaveAsync();
    }
}
```

## Implementación del Unit of Work

### Básica (con DbContext directo)

```csharp
// Interfaz genérica de Repositorio
public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task AddAsync(T entity);
    void Update(T entity);
    void Remove(T entity);
}

// Implementación genérica de Repositorio
public class Repository<T> : IRepository<T> where T : class
{
    protected readonly AppDbContext _context;
    
    public Repository(AppDbContext context)
    {
        _context = context;
    }
    
    public virtual async Task<T?> GetByIdAsync(int id)
    {
        return await _context.Set<T>().FindAsync(id);
    }
    
    public virtual async Task<IEnumerable<T>> GetAllAsync()
    {
        return await _context.Set<T>().ToListAsync();
    }
    
    public virtual async Task AddAsync(T entity)
    {
        await _context.Set<T>().AddAsync(entity);
    }
    
    public virtual void Update(T entity)
    {
        _context.Set<T>().Update(entity);
    }
    
    public virtual void Remove(T entity)
    {
        _context.Set<T>().Remove(entity);
    }
}

// Unit of Work: coordina múltiples repositorios
public interface IUnitOfWork : IDisposable
{
    IRepository<Producto> Productos { get; }
    IRepository<Cliente> Clientes { get; }
    IRepository<Pedido> Pedidos { get; }
    IRepository<Inventario> Inventarios { get; }
    
    Task<int> SaveAsync();
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();
}

// Implementación
public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;
    
    public IRepository<Producto> Productos { get; private set; }
    public IRepository<Cliente> Clientes { get; private set; }
    public IRepository<Pedido> Pedidos { get; private set; }
    public IRepository<Inventario> Inventarios { get; private set; }
    
    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        
        Productos = new Repository<Producto>(context);
        Clientes = new Repository<Cliente>(context);
        Pedidos = new Repository<Pedido>(context);
        Inventarios = new Repository<Inventario>(context);
    }
    
    public async Task<int> SaveAsync()
    {
        return await _context.SaveChangesAsync();
    }
    
    public async Task BeginTransactionAsync()
    {
        _transaction = await _context.Database.BeginTransactionAsync();
    }
    
    public async Task CommitAsync()
    {
        try
        {
            await SaveAsync();
            await _transaction?.CommitAsync()!;
        }
        catch
        {
            await RollbackAsync();
            throw;
        }
    }
    
    public async Task RollbackAsync()
    {
        await _transaction?.RollbackAsync()!;
    }
    
    public void Dispose()
    {
        _transaction?.Dispose();
        _context?.Dispose();
    }
}
```

### Con Repositorios específicos

A menudo necesitas lógica específica por entidad. Heredas del Repository genérico:

```csharp
// Repositorio específico para Producto
public interface IProductoRepository : IRepository<Producto>
{
    Task<Producto?> ObtenerConInventarioAsync(int id);
    Task<IEnumerable<Producto>> ObtenerPorCategoriaAsync(int categoriaId);
    Task<IEnumerable<Producto>> BuscarPorNombreAsync(string nombre);
}

public class ProductoRepository : Repository<Producto>, IProductoRepository
{
    public ProductoRepository(AppDbContext context) : base(context) { }
    
    public async Task<Producto?> ObtenerConInventarioAsync(int id)
    {
        return await _context.Productos
            .Include(p => p.Inventario)
            .FirstOrDefaultAsync(p => p.Id == id);
    }
    
    public async Task<IEnumerable<Producto>> ObtenerPorCategoriaAsync(int categoriaId)
    {
        return await _context.Productos
            .Where(p => p.CategoriaId == categoriaId)
            .ToListAsync();
    }
    
    public async Task<IEnumerable<Producto>> BuscarPorNombreAsync(string nombre)
    {
        return await _context.Productos
            .Where(p => p.Nombre.Contains(nombre))
            .ToListAsync();
    }
}

// UnitOfWork mejorado
public interface IUnitOfWork : IDisposable
{
    IProductoRepository Productos { get; }
    IClienteRepository Clientes { get; }
    IPedidoRepository Pedidos { get; }
    IInventarioRepository Inventarios { get; }
    
    Task<int> SaveAsync();
    Task BeginTransactionAsync();
    Task CommitAsync();
    Task RollbackAsync();
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;
    
    public IProductoRepository Productos { get; private set; }
    public IClienteRepository Clientes { get; private set; }
    // ... más repositorios
    
    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        Productos = new ProductoRepository(context);
        Clientes = new ClienteRepository(context);
        // ... inicializar más
    }
    
    // ... resto implementación igual
}
```

## Uso en Servicios (Dependency Injection)

```csharp
// Registro en Program.cs
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

// En un servicio
public class PedidoService
{
    private readonly IUnitOfWork _uow;
    private readonly ILogger<PedidoService> _logger;
    
    public PedidoService(IUnitOfWork uow, ILogger<PedidoService> logger)
    {
        _uow = uow;
        _logger = logger;
    }
    
    // Crear varios cambios como una unidad
    public async Task<Pedido> CrearPedidoAsync(CrearPedidoDto dto)
    {
        try
        {
            await _uow.BeginTransactionAsync();
            
            // 1. Crear pedido
            var pedido = new Pedido
            {
                ClienteId = dto.ClienteId,
                Fecha = DateTime.Now,
                Monto = dto.Items.Sum(i => i.PrecioUnitario * i.Cantidad),
                Estado = EstadoPedido.Pendiente
            };
            await _uow.Pedidos.AddAsync(pedido);
            
            // 2. Crear items del pedido y actualizar inventario
            foreach (var item in dto.Items)
            {
                var producto = await _uow.Productos.GetByIdAsync(item.ProductoId);
                if (producto == null)
                    throw new ProductoNoEncontradoException(item.ProductoId);
                
                var detalle = new PedidoDetalle
                {
                    ProductoId = item.ProductoId,
                    Cantidad = item.Cantidad,
                    PrecioUnitario = producto.Precio
                };
                await _uow.PedidoDetalles.AddAsync(detalle);
                
                // Actualizar inventario
                var inventario = await _uow.Inventarios.ObtenerPorProductoAsync(item.ProductoId);
                if (inventario.Stock < item.Cantidad)
                    throw new StockInsuficienteException(item.ProductoId);
                
                inventario.Stock -= item.Cantidad;
                _uow.Inventarios.Update(inventario);
            }
            
            // 3. Guardar todo como una unidad
            await _uow.CommitAsync();
            
            _logger.LogInformation($"Pedido {pedido.Id} creado exitosamente");
            return pedido;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al crear pedido");
            throw;
        }
    }
    
    public async Task CancelarPedidoAsync(int pedidoId)
    {
        try
        {
            await _uow.BeginTransactionAsync();
            
            var pedido = await _uow.Pedidos.GetByIdAsync(pedidoId);
            if (pedido == null)
                throw new PedidoNoEncontradoException(pedidoId);
            
            // Revertir inventario
            var detalles = await _uow.PedidoDetalles.ObtenerPorPedidoAsync(pedidoId);
            foreach (var detalle in detalles)
            {
                var inventario = await _uow.Inventarios.ObtenerPorProductoAsync(detalle.ProductoId);
                inventario.Stock += detalle.Cantidad;
                _uow.Inventarios.Update(inventario);
            }
            
            // Marcar pedido como cancelado
            pedido.Estado = EstadoPedido.Cancelado;
            _uow.Pedidos.Update(pedido);
            
            await _uow.CommitAsync();
        }
        catch
        {
            await _uow.RollbackAsync();
            throw;
        }
    }
}
```

## En Controladores

```csharp
[ApiController]
[Route("api/[controller]")]
public class PedidosController : ControllerBase
{
    private readonly IUnitOfWork _uow;
    private readonly PedidoService _service;
    
    public PedidosController(IUnitOfWork uow, PedidoService service)
    {
        _uow = uow;
        _service = service;
    }
    
    [HttpPost]
    public async Task<ActionResult<PedidoDto>> Crear([FromBody] CrearPedidoDto dto)
    {
        var pedido = await _service.CrearPedidoAsync(dto);
        return CreatedAtAction(nameof(ObtenerPorId), new { id = pedido.Id }, pedido);
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<PedidoDto>> ObtenerPorId(int id)
    {
        var pedido = await _uow.Pedidos.GetByIdAsync(id);
        if (pedido == null)
            return NotFound();
        
        return Ok(_mapper.Map<PedidoDto>(pedido));
    }
}
```

## Testing con Unit of Work

```csharp
// Mock IUnitOfWork para tests
[TestClass]
public class PedidoServiceTests
{
    private Mock<IUnitOfWork> _mockUow = new();
    private Mock<ILogger<PedidoService>> _mockLogger = new();
    private PedidoService _service = null!;
    
    [TestInitialize]
    public void Setup()
    {
        _service = new PedidoService(_mockUow.Object, _mockLogger.Object);
    }
    
    [TestMethod]
    public async Task CrearPedido_WithValidData_SavesSuccessfully()
    {
        // Arrange
        var dto = new CrearPedidoDto
        {
            ClienteId = 1,
            Items = [new() { ProductoId = 1, Cantidad = 2 }]
        };
        
        var producto = new Producto { Id = 1, Precio = 100 };
        var inventario = new Inventario { Stock = 10 };
        
        _mockUow.Setup(x => x.Productos.GetByIdAsync(1))
            .ReturnsAsync(producto);
        _mockUow.Setup(x => x.Inventarios.ObtenerPorProductoAsync(1))
            .ReturnsAsync(inventario);
        
        // Act
        var result = await _service.CrearPedidoAsync(dto);
        
        // Assert
        Assert.IsNotNull(result);
        _mockUow.Verify(x => x.CommitAsync(), Times.Once);
    }
    
    [TestMethod]
    public async Task CrearPedido_WithInsufficientStock_Throws()
    {
        // Arrange
        var dto = new CrearPedidoDto { /* ... */ };
        var inventario = new Inventario { Stock = 1 }; // stock < cantidad necesaria
        
        _mockUow.Setup(x => x.Inventarios.ObtenerPorProductoAsync(It.IsAny<int>()))
            .ReturnsAsync(inventario);
        
        // Act & Assert
        await Assert.ThrowsExceptionAsync<StockInsuficienteException>(
            () => _service.CrearPedidoAsync(dto));
    }
}
```

## Entity Framework DbContext vs Unit of Work

| Aspecto | DbContext | Unit of Work |
|---------|-----------|--------------|
| **Responsabilidad** | Mapear BD + cambios | Coordinar operaciones |
| **Transacciones** | Automáticas por SaveChanges | Explícitas |
| **Testing** | Difícil (DbContext es grafo de objetos) | Fácil (mock repositorios) |
| **Complejidad** | Simple para CRUD | Más código inicial |
| **Casos de uso** | Aplicaciones simples | Operaciones complejas, multi-tabla |

**Nota**: DbContext YA es un patrón similar a Unit of Work. En aplicaciones modernas muchas veces:
- Pequeñas apps: usar DbContext directamente
- Apps medianas: usar Unit of Work + Repositorio
- Apps grandes: usar Unit of Work + Repositorio + MediatR/CQRS

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es el patrón Unit of Work?**
> Unit of Work coordina múltiples repositorios para que cambios en varias entidades se guarden como una unidad (transacción). Garantiza consistencia: o se guardan todos o ninguno.

**2. ¿Cómo se diferencia Unit of Work de DbContext?**
> DbContext ES una implementación de Unit of Work. DbContext mantiene el grafo de objetos y SaveChanges es la "unidad". Unit of Work es un patrón más abstracto que usualmente envuelve DbContext.

**3. ¿Por qué usar repositories si ya tengo DbContext?**
> Los repositorios abstraen DbContext, permitiendo:
> - Testear servicios sin BD real (mockear repositorios)
> - Cambiar a otra BD sin afectar servicios
> - Centralizar lógica de acceso a datos

**4. ¿Cuándo hacer BeginTransaction vs confiar en SaveChanges?**
> - **SaveChanges solo**: operaciones de una sola tabla, simple
> - **BeginTransaction**: múltiples tablas que deben ser atómicas, o rollback explícito

```csharp
// SaveChanges: simplicial
await _uow.Productos.AddAsync(producto);
await _uow.SaveAsync();

// BeginTransaction: complejo
await _uow.BeginTransactionAsync();
try {
  // múltiples operaciones
  await _uow.CommitAsync(); // SaveAsync + Commit
} catch {
  await _uow.RollbackAsync();
}
```

**5. ¿Es Unit of Work un anti-patrón?**
> No. Algunos dicen que DbContext ya es Unit of Work, así que "unit of work sobre unit of work" es innecesario. Pero para aplicaciones medianas, la abstracción es útil. Para apps gigantes, CQRS es mejor.

**6. ¿Qué pasa si uso multiple DbContext en una transacción?**
> ❌ No funciona. Las transacciones son por DbContext. Para múltiples DbContext usar `TransactionScope` o base de datos nativa transactions.

```csharp
using (var scope = new TransactionScope())
{
  using (var db1 = new Db1Context()) { /* ... */ }
  using (var db2 = new Db2Context()) { /* ... */ }
  scope.Complete(); // atomicidad
}
```

**7. ¿Unit of Work es necesario en .NET Core + Entity Framework?**
> No es obligatorio. DbContext ya coordina cambios. Unit of Work es más útil si:
> - Necesitas múltiples repositorios trabajar juntos
> - Quieres diseño orientado al dominio
> - Testeas mucho (mocks)