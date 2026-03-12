---
id: patrones-diseno
title: Patrones de Diseño
sidebar_position: 7
---

# Patrones de Diseño 🟡

## SOLID — Los 5 principios

### S — Single Responsibility Principle

```csharp
// ❌ Violación: una clase hace demasiadas cosas
public class Usuario
{
    public string Nombre { get; set; }
    public void GuardarEnBaseDeDatos() { /* SQL aquí */ }
    public void EnviarEmail() { /* SMTP aquí */ }
    public string GenerarReporte() { /* lógica de reporte */ }
}

// ✅ Correcto: separación de responsabilidades
public class Usuario { public string Nombre { get; set; } }
public class UsuarioRepository { public void Guardar(Usuario u) { } }
public class EmailService { public void Enviar(string destinatario) { } }
public class ReporteService { public string Generar(Usuario u) => ""; }
```

### O — Open/Closed Principle

```csharp
// ❌ Violación: modificar la clase para agregar descuentos
public class Descuento
{
    public decimal Calcular(string tipo, decimal precio) => tipo switch
    {
        "navidad" => precio * 0.9m,
        "black-friday" => precio * 0.7m,
        _ => precio
    };
}

// ✅ Abierto para extensión, cerrado para modificación
public abstract class Descuento
{
    public abstract decimal Calcular(decimal precio);
}
public class DescuentoNavidad : Descuento
{
    public override decimal Calcular(decimal precio) => precio * 0.9m;
}
public class DescuentoBlackFriday : Descuento
{
    public override decimal Calcular(decimal precio) => precio * 0.7m;
}
```

### L — Liskov Substitution Principle

```csharp
// ❌ Violación: Cuadrado hereda de Rectángulo pero viola el contrato
public class Rectangulo
{
    public virtual int Ancho { get; set; }
    public virtual int Alto { get; set; }
    public int Area() => Ancho * Alto;
}

public class Cuadrado : Rectangulo
{
    public override int Ancho { set => base.Ancho = base.Alto = value; }
    public override int Alto { set => base.Ancho = base.Alto = value; }
}
// Si hago: Rectangulo r = new Cuadrado(); r.Ancho = 5; r.Alto = 3;
// Esperaría Area() = 15, pero obtengo 9 — viola LSP

// ✅ Usar composición o interfaces separadas
public interface IForma { int Area(); }
public class Rectangulo : IForma { /* ... */ }
public class Cuadrado : IForma { /* ... */ }
```

### I — Interface Segregation Principle

```csharp
// ❌ Interfaz "gorda"
public interface IAnimal
{
    void Caminar();
    void Nadar();
    void Volar();
}
// Los peces tienen que implementar Volar() aunque no vuelan

// ✅ Interfaces pequeñas y específicas
public interface ICaminante { void Caminar(); }
public interface INadador { void Nadar(); }
public interface IVolador { void Volar(); }

public class Pato : ICaminante, INadador, IVolador { /* puede todo */ }
public class Pez : INadador { /* solo nada */ }
```

### D — Dependency Inversion Principle

```csharp
// ❌ Dependencia de implementación concreta
public class NotificacionService
{
    private readonly SmtpEmailSender _emailSender = new(); // depende del concreto

    public void Notificar(string msg) => _emailSender.Send(msg);
}

// ✅ Depender de abstracciones
public class NotificacionService
{
    private readonly INotificador _notificador; // depende de la abstracción

    public NotificacionService(INotificador notificador)
    {
        _notificador = notificador;
    }

    public void Notificar(string msg) => _notificador.Enviar(msg);
}
```

---

## Patrones de Creación

### Repository Pattern

```csharp
public interface IProductoRepository
{
    Task<Producto?> ObtenerPorIdAsync(int id);
    Task<IEnumerable<Producto>> ObtenerTodosAsync();
    Task<Producto> CrearAsync(Producto producto);
    Task ActualizarAsync(Producto producto);
    Task EliminarAsync(int id);
}

public class ProductoRepository : IProductoRepository
{
    private readonly AppDbContext _context;
    public ProductoRepository(AppDbContext context) => _context = context;

    public async Task<Producto?> ObtenerPorIdAsync(int id) =>
        await _context.Productos.FindAsync(id);

    // ... implementaciones
}
```

### Unit of Work

```csharp
public interface IUnitOfWork : IDisposable
{
    IProductoRepository Productos { get; }
    ICategoriaRepository Categorias { get; }
    Task<int> GuardarAsync();
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    
    public IProductoRepository Productos { get; }
    public ICategoriaRepository Categorias { get; }

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        Productos = new ProductoRepository(context);
        Categorias = new CategoriaRepository(context);
    }

    public Task<int> GuardarAsync() => _context.SaveChangesAsync();
    public void Dispose() => _context.Dispose();
}
```

---

## Patrones de Comportamiento

### Strategy Pattern

```csharp
public interface IEstrategiaOrdenamiento
{
    IEnumerable<Producto> Ordenar(IEnumerable<Producto> productos);
}

public class OrdenarPorPrecio : IEstrategiaOrdenamiento
{
    public IEnumerable<Producto> Ordenar(IEnumerable<Producto> p) =>
        p.OrderBy(x => x.Precio);
}

public class OrdenarPorNombre : IEstrategiaOrdenamiento
{
    public IEnumerable<Producto> Ordenar(IEnumerable<Producto> p) =>
        p.OrderBy(x => x.Nombre);
}

public class CatalogoService
{
    private IEstrategiaOrdenamiento _estrategia = new OrdenarPorNombre();

    public void CambiarEstrategia(IEstrategiaOrdenamiento e) => _estrategia = e;

    public IEnumerable<Producto> ObtenerCatalogo(IEnumerable<Producto> prods) =>
        _estrategia.Ordenar(prods);
}
```

### Observer Pattern (Events)

```csharp
// En .NET, los events son la implementación nativa del patrón Observer
public class PedidoService
{
    public event EventHandler<PedidoCreadoEventArgs>? PedidoCreado;

    public async Task<Pedido> CrearPedidoAsync(CrearPedidoDto dto)
    {
        var pedido = /* crear pedido */;
        
        // Notificar a todos los suscriptores
        PedidoCreado?.Invoke(this, new PedidoCreadoEventArgs(pedido));
        
        return pedido;
    }
}

// Suscriptores
pedidoService.PedidoCreado += async (s, e) => await emailService.NotificarClienteAsync(e.Pedido);
pedidoService.PedidoCreado += async (s, e) => await inventarioService.ReservarStockAsync(e.Pedido);
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre Factory Method y Abstract Factory?**
> **Factory Method**: define una interfaz para crear un objeto, pero las subclases deciden qué clase instanciar. **Abstract Factory**: crea familias de objetos relacionados sin especificar sus clases concretas.

**2. ¿Cuándo usarías el patrón Decorator?**
> Para agregar responsabilidades a un objeto dinámicamente sin usar herencia. Por ejemplo: logging, caching, validación sobre un repositorio existente.

**3. Explica el patrón Mediator y su uso con MediatR en .NET.**
> Mediator desacopla el emisor del receptor de una solicitud. En .NET con MediatR: en vez de que el controller llame directamente al service, envía un `Command` o `Query` que MediatR enruta al handler correcto. Reduce el acoplamiento.

**4. ¿Qué diferencia hay entre Composition y Inheritance?**
> **Herencia** ("es un"): fuerte acoplamiento, difícil de cambiar en runtime. **Composición** ("tiene un"): más flexible, favorece el SRP y OCP. La regla general: "Preferir composición sobre herencia".
