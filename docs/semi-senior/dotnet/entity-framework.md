---
id: entity-framework
title: Entity Framework Core
sidebar_position: 3
---

# Entity Framework Core 🟡

## DbContext y Entidades

```csharp
// Entidades
public class Producto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public decimal Precio { get; set; }
    public int Stock { get; set; }
    public int CategoriaId { get; set; }
    
    // Navigation properties
    public Categoria Categoria { get; set; } = null!;
    public ICollection<PedidoItem> PedidoItems { get; set; } = new List<PedidoItem>();
}

public class Categoria
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public ICollection<Producto> Productos { get; set; } = new List<Producto>();
}

// DbContext
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Producto> Productos { get; set; }
    public DbSet<Categoria> Categorias { get; set; }
    public DbSet<Pedido> Pedidos { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Fluent API (preferido sobre DataAnnotations para lógica compleja)
        modelBuilder.Entity<Producto>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Nombre).IsRequired().HasMaxLength(100);
            entity.Property(p => p.Precio).HasColumnType("decimal(10,2)");
            
            entity.HasOne(p => p.Categoria)
                  .WithMany(c => c.Productos)
                  .HasForeignKey(p => p.CategoriaId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Seed data
        modelBuilder.Entity<Categoria>().HasData(
            new Categoria { Id = 1, Nombre = "Electrónica" },
            new Categoria { Id = 2, Nombre = "Muebles" }
        );
    }
}
```

---

## CRUD con EF Core

```csharp
public class ProductoRepository
{
    private readonly AppDbContext _context;

    public ProductoRepository(AppDbContext context)
    {
        _context = context;
    }

    // READ — con include para eager loading
    public async Task<List<Producto>> ObtenerTodosAsync()
    {
        return await _context.Productos
            .Include(p => p.Categoria)
            .AsNoTracking() // optimización para consultas de solo lectura
            .ToListAsync();
    }

    public async Task<Producto?> ObtenerPorIdAsync(int id)
    {
        return await _context.Productos
            .Include(p => p.Categoria)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    // CREATE
    public async Task<Producto> CrearAsync(Producto producto)
    {
        _context.Productos.Add(producto);
        await _context.SaveChangesAsync();
        return producto;
    }

    // UPDATE
    public async Task ActualizarAsync(Producto producto)
    {
        _context.Productos.Update(producto);
        await _context.SaveChangesAsync();
    }

    // DELETE
    public async Task EliminarAsync(int id)
    {
        var producto = await _context.Productos.FindAsync(id)
            ?? throw new NotFoundException($"Producto {id} no encontrado");
        
        _context.Productos.Remove(producto);
        await _context.SaveChangesAsync();
    }
}
```

---

## Consultas avanzadas

```csharp
// Paginación
public async Task<PagedResult<Producto>> BuscarAsync(
    string? termino, int pagina, int porPagina)
{
    var query = _context.Productos
        .Include(p => p.Categoria)
        .AsNoTracking()
        .AsQueryable();

    if (!string.IsNullOrEmpty(termino))
        query = query.Where(p => p.Nombre.Contains(termino));

    var total = await query.CountAsync();
    
    var items = await query
        .OrderBy(p => p.Nombre)
        .Skip((pagina - 1) * porPagina)
        .Take(porPagina)
        .ToListAsync();

    return new PagedResult<Producto>(items, total, pagina, porPagina);
}

// Proyección para DTOs (más eficiente que traer entidades completas)
public async Task<List<ProductoDto>> ObtenerDtosAsync()
{
    return await _context.Productos
        .Select(p => new ProductoDto
        {
            Id = p.Id,
            Nombre = p.Nombre,
            Precio = p.Precio,
            CategoriaNombre = p.Categoria.Nombre  // SQL JOIN automático
        })
        .ToListAsync();
}

// Raw SQL cuando LINQ no alcanza
public async Task<List<Producto>> BuscarFullTextAsync(string termino)
{
    return await _context.Productos
        .FromSqlRaw("SELECT * FROM Productos WHERE CONTAINS(Nombre, {0})", termino)
        .ToListAsync();
}
```

---

## Migrations

```bash
# Crear una migration
dotnet ef migrations add AgregarProductos

# Aplicar migrations a la BD
dotnet ef database update

# Revertir a una migration específica
dotnet ef database update NombreMigracionAnterior

# Generar script SQL (para producción)
dotnet ef migrations script --idempotent -o migrations.sql

# Ver migrations pendientes
dotnet ef migrations list
```

```csharp
// Aplicar migrations automáticamente al iniciar (desarrollo)
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.MigrateAsync();
}
```

---

## Tracking vs No-Tracking

```csharp
// Tracking (default): EF monitorea los cambios del objeto
var producto = await _context.Productos.FindAsync(1);
producto.Precio = 999.99m;
await _context.SaveChangesAsync(); // detecta el cambio automáticamente

// No-Tracking: más eficiente para consultas de solo lectura
var productos = await _context.Productos
    .AsNoTracking()
    .ToListAsync();
// NO actualices estos objetos y esperes que EF los guarde
```

---

## Transacciones en EF Core

```csharp
public async Task TransferirStockAsync(int origenId, int destinoId, int cantidad)
{
    using var transaction = await _context.Database.BeginTransactionAsync();
    
    try
    {
        var origen = await _context.Productos.FindAsync(origenId)
            ?? throw new NotFoundException("Origen no encontrado");
        var destino = await _context.Productos.FindAsync(destinoId)
            ?? throw new NotFoundException("Destino no encontrado");

        if (origen.Stock < cantidad)
            throw new BusinessException("Stock insuficiente");

        origen.Stock -= cantidad;
        destino.Stock += cantidad;

        await _context.SaveChangesAsync();
        await transaction.CommitAsync();
    }
    catch
    {
        await transaction.RollbackAsync();
        throw;
    }
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre Eager Loading, Lazy Loading y Explicit Loading?**
> - **Eager Loading** (`Include`): carga las entidades relacionadas en la misma consulta SQL
> - **Lazy Loading**: carga relacionadas automáticamente cuando accedes a la propiedad (N+1 problema)
> - **Explicit Loading** (`LoadAsync`): cargas manualmente cuando lo necesitas

**2. ¿Qué es el problema N+1?**
> Al iterar una lista y acceder a propiedades de navegación sin `Include`, EF hace una consulta SQL por cada elemento. Para 100 productos = 101 queries. Se soluciona con `Include()`.

**3. ¿Cuándo usar `AsNoTracking()`?**
> Cuando haces consultas de solo lectura (GETs de APIs). Mejora el rendimiento porque EF no necesita rastrear cambios. No usar cuando planeas modificar y guardar los objetos.

**4. ¿Cómo manejas las migrations en un entorno de producción?**
> Genero un script SQL con `dotnet ef migrations script --idempotent`, lo reviso, y lo aplico como parte del proceso de deployment (CI/CD pipeline o manualmente con DBA). Nunca aplico migrations automáticas en producción sin revisión.
