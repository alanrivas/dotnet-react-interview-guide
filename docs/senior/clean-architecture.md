---
id: clean-architecture
title: Clean Architecture & DDD
sidebar_position: 2
---

# Clean Architecture & DDD 🔴

## Clean Architecture

Propuesta por Robert C. Martin ("Uncle Bob"). Las capas internas no conocen a las externas.

```
        ┌─────────────────────────────────────┐
        │         Frameworks & Drivers         │  Web, DB, External APIs
        │  ┌───────────────────────────────┐   │
        │  │    Interface Adapters          │   │  Controllers, Presenters, Gateways
        │  │  ┌─────────────────────────┐  │   │
        │  │  │    Application Layer     │  │   │  Use Cases
        │  │  │  ┌───────────────────┐  │  │   │
        │  │  │  │   Domain/Entities  │  │  │   │  Business Rules
        │  │  │  └───────────────────┘  │  │   │
        │  │  └─────────────────────────┘  │   │
        │  └───────────────────────────────┘   │
        └─────────────────────────────────────┘
```

### Estructura de proyecto

```
src/
├── MiApp.Domain/          ← Sin dependencias externas
│   ├── Entities/
│   ├── ValueObjects/
│   ├── Interfaces/        ← IRepository (definición)
│   └── DomainEvents/
│
├── MiApp.Application/     ← Depende solo de Domain
│   ├── Commands/
│   ├── Queries/
│   ├── DTOs/
│   └── Interfaces/        ← IEmailService (definición)
│
├── MiApp.Infrastructure/  ← Implementa interfaces de Domain y Application
│   ├── Persistence/       ← EF Core, Repositories concretos
│   ├── Services/          ← EmailService, JwtService
│   └── External/
│
└── MiApp.API/             ← Punto de entrada, inyección de dependencias
    ├── Controllers/
    ├── Middleware/
    └── Program.cs
```

---

## Domain-Driven Design (DDD)

### Entities y Value Objects

```csharp
// Entity: tiene identidad (Id), puede cambiar de estado
public class Pedido
{
    public PedidoId Id { get; private set; }
    public ClienteId ClienteId { get; private set; }
    public EstadoPedido Estado { get; private set; }
    private readonly List<PedidoItem> _items = new();
    public IReadOnlyCollection<PedidoItem> Items => _items.AsReadOnly();

    // Constructor privado — solo se crea mediante factory method
    private Pedido(ClienteId clienteId)
    {
        Id = new PedidoId(Guid.NewGuid());
        ClienteId = clienteId;
        Estado = EstadoPedido.Pendiente;
    }

    // Factory method — valida invariantes del negocio
    public static Pedido Crear(ClienteId clienteId)
    {
        if (clienteId is null) throw new ArgumentNullException(nameof(clienteId));
        return new Pedido(clienteId);
    }

    // Métodos de dominio — las reglas de negocio viven aquí
    public void AgregarItem(ProductoId productoId, int cantidad, Dinero precio)
    {
        if (Estado != EstadoPedido.Pendiente)
            throw new DomainException("Solo se pueden agregar items a pedidos pendientes");
        
        var itemExistente = _items.FirstOrDefault(i => i.ProductoId == productoId);
        if (itemExistente is not null)
            itemExistente.IncrementarCantidad(cantidad);
        else
            _items.Add(new PedidoItem(productoId, cantidad, precio));
    }

    public void Confirmar()
    {
        if (!_items.Any())
            throw new DomainException("No se puede confirmar un pedido sin items");
        Estado = EstadoPedido.Confirmado;
        AddDomainEvent(new PedidoConfirmadoEvent(Id));
    }
}

// Value Object: igualdad por valor, inmutable
public record Dinero(decimal Monto, string Moneda)
{
    public static Dinero Cero(string moneda) => new(0, moneda);
    
    public Dinero Sumar(Dinero otro)
    {
        if (Moneda != otro.Moneda)
            throw new DomainException("No se pueden sumar monedas distintas");
        return new Dinero(Monto + otro.Monto, Moneda);
    }
    
    public bool EsPositivo() => Monto > 0;
}

// Strongly Typed IDs (evitan confundir IDs de distintas entidades)
public record PedidoId(Guid Value);
public record ClienteId(Guid Value);
public record ProductoId(int Value);
```

### Aggregates y Aggregate Roots

```csharp
// Un Aggregate es un cluster de objetos del dominio tratados como unidad.
// El Aggregate Root es el único punto de entrada.

// Pedido es el Aggregate Root
// PedidoItem solo se accede a través de Pedido
// Nunca: _context.PedidoItems.Add(item) directamente

// Repositorios solo para Aggregate Roots
public interface IPedidoRepository
{
    Task<Pedido?> ObtenerPorIdAsync(PedidoId id);
    Task GuardarAsync(Pedido pedido);
}
```

### Domain Events

```csharp
public abstract class Entity
{
    private List<IDomainEvent> _domainEvents = new();
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void AddDomainEvent(IDomainEvent evt) => _domainEvents.Add(evt);
    public void ClearDomainEvents() => _domainEvents.Clear();
}

// El repositorio publica los eventos al guardar
public class PedidoRepository : IPedidoRepository
{
    public async Task GuardarAsync(Pedido pedido)
    {
        _context.Pedidos.Update(pedido);
        
        // Publicar domain events DESPUÉS de guardar exitosamente
        foreach (var evento in pedido.DomainEvents)
            await _publisher.Publish(evento);
        
        pedido.ClearDomainEvents();
        await _context.SaveChangesAsync();
    }
}
```

---

## Specification Pattern

```csharp
public abstract class Specification<T>
{
    public abstract Expression<Func<T, bool>> ToExpression();
    
    public bool EsSatisfechaPor(T entidad) =>
        ToExpression().Compile()(entidad);
    
    public Specification<T> Y(Specification<T> otra) =>
        new AndSpecification<T>(this, otra);
}

public class ProductosActivosSpec : Specification<Producto>
{
    public override Expression<Func<Producto, bool>> ToExpression() =>
        p => p.Activo && p.Stock > 0;
}

public class ProductosPorCategoriaSpec : Specification<Producto>
{
    private readonly int _categoriaId;
    public ProductosPorCategoriaSpec(int categoriaId) => _categoriaId = categoriaId;
    
    public override Expression<Func<Producto, bool>> ToExpression() =>
        p => p.CategoriaId == _categoriaId;
}

// Uso
var spec = new ProductosActivosSpec().Y(new ProductosPorCategoriaSpec(1));
var productos = await _repo.ListarAsync(spec);
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre DDD y Clean Architecture?**
> No son lo mismo. **DDD** es una forma de modelar el dominio del negocio (Entities, Value Objects, Aggregates, Bounded Contexts). **Clean Architecture** es una forma de estructurar el código en capas con la regla de dependencias. Se complementan muy bien.

**2. ¿Qué es un Bounded Context?**
> Un límite explícito dentro del cual un modelo de dominio particular es válido. Por ejemplo, "Producto" en el contexto de Catálogo tiene nombre, descripción, precio. En el contexto de Inventario, "Producto" tiene SKU, ubicación, stock. Son modelos distintos del mismo concepto.

**3. ¿Cuándo aplicarías DDD completo y cuándo no?**
> DDD completo vale la pena en dominios **complejos con muchas reglas de negocio**. Para CRUD simple o dominios técnicos (logs, configuraciones), es overengineering. Tácticas de DDD (Entities, Value Objects) siempre; el diseño estratégico completo solo cuando el dominio lo justifica.

**4. ¿Cómo manejas la consistencia entre Aggregates?**
> Los Aggregates no se modifican juntos en una transacción. Se usa **eventual consistency** mediante Domain Events. El Aggregate A publica un evento, y el handler actualiza el Aggregate B en una transacción separada.

---

## Application Layer — Use Cases con MediatR

La Application Layer orquesta los Use Cases (Commands y Queries). No contiene lógica de negocio — eso es del Domain. No habla directamente con infraestructura — usa las interfaces definidas en Domain/Application.

```csharp
// Command — modifica estado
public record ConfirmarPedidoCommand(PedidoId PedidoId) : ICommand<PedidoDto>;

// Command Handler — orquesta el use case
public class ConfirmarPedidoHandler : ICommandHandler<ConfirmarPedidoCommand, PedidoDto>
{
    private readonly IPedidoRepository _pedidos;
    private readonly IInventarioService _inventario; // Interface definida en Application

    public ConfirmarPedidoHandler(IPedidoRepository pedidos, IInventarioService inventario)
    {
        _pedidos = pedidos;
        _inventario = inventario;
    }

    public async Task<PedidoDto> Handle(ConfirmarPedidoCommand cmd, CancellationToken ct)
    {
        // 1. Cargar el aggregate
        var pedido = await _pedidos.ObtenerPorIdAsync(cmd.PedidoId)
            ?? throw new PedidoNotFoundException(cmd.PedidoId);

        // 2. Ejecutar la lógica de dominio (en el aggregate, no aquí)
        pedido.Confirmar();

        // 3. Verificar disponibilidad de inventario (servicio de aplicación)
        await _inventario.ReservarItemsAsync(pedido.Items, ct);

        // 4. Persistir (los Domain Events se publican dentro de GuardarAsync)
        await _pedidos.GuardarAsync(pedido);

        // 5. Retornar DTO (nunca exponer el aggregate fuera de Application)
        return PedidoDto.From(pedido);
    }
}

// Query — solo lectura, puede ir directo a DB sin pasar por domain
public record ObtenerPedidoQuery(PedidoId PedidoId) : IQuery<PedidoDto>;

public class ObtenerPedidoHandler : IQueryHandler<ObtenerPedidoQuery, PedidoDto>
{
    // Para queries, es común "shortcircuit" y leer directo del DbContext
    // El domain model es para escrituras; para lecturas, optimiza con proyecciones
    private readonly AppDbContext _context;

    public async Task<PedidoDto> Handle(ObtenerPedidoQuery query, CancellationToken ct)
    {
        return await _context.Pedidos
            .AsNoTracking()
            .Where(p => p.Id == query.PedidoId)
            .Select(p => new PedidoDto
            {
                Id = p.Id.Value,
                Estado = p.Estado.ToString(),
                Total = p.Items.Sum(i => i.Precio.Monto * i.Cantidad)
            })
            .FirstOrDefaultAsync(ct)
            ?? throw new PedidoNotFoundException(query.PedidoId);
    }
}
```

---

## Testing en Clean Architecture

La separación de capas facilita el testing: el Domain se testea con unit tests puros (sin mocks), la Application Layer se testea mockeando los repositories.

```csharp
// Unit test del Domain — CERO mocks, CERO infraestructura
public class PedidoTests
{
    [Fact]
    public void Confirmar_PedidoConItems_CambiaEstadoAConfirmado()
    {
        // Arrange
        var pedido = Pedido.Crear(new ClienteId(Guid.NewGuid()));
        pedido.AgregarItem(
            new ProductoId(1),
            cantidad: 2,
            precio: new Dinero(50, "ARS"));

        // Act
        pedido.Confirmar();

        // Assert
        Assert.Equal(EstadoPedido.Confirmado, pedido.Estado);
        Assert.Single(pedido.DomainEvents.OfType<PedidoConfirmadoEvent>());
    }

    [Fact]
    public void Confirmar_PedidoSinItems_LanzaDomainException()
    {
        var pedido = Pedido.Crear(new ClienteId(Guid.NewGuid()));

        Assert.Throws<DomainException>(() => pedido.Confirmar());
    }
}

// Integration test del Handler — mock de repositories
public class ConfirmarPedidoHandlerTests
{
    [Fact]
    public async Task Handle_PedidoValido_PublicaEventoYRetornaDto()
    {
        // Arrange
        var pedido = Pedido.Crear(new ClienteId(Guid.NewGuid()));
        pedido.AgregarItem(new ProductoId(1), 1, new Dinero(100, "ARS"));

        var mockRepo = new Mock<IPedidoRepository>();
        mockRepo.Setup(r => r.ObtenerPorIdAsync(pedido.Id)).ReturnsAsync(pedido);

        var mockInventario = new Mock<IInventarioService>();
        mockInventario.Setup(i => i.ReservarItemsAsync(It.IsAny<IEnumerable<PedidoItem>>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var handler = new ConfirmarPedidoHandler(mockRepo.Object, mockInventario.Object);

        // Act
        var result = await handler.Handle(new ConfirmarPedidoCommand(pedido.Id), CancellationToken.None);

        // Assert
        Assert.Equal(EstadoPedido.Confirmado.ToString(), result.Estado);
        mockRepo.Verify(r => r.GuardarAsync(pedido), Times.Once);
    }
}
```

---

## Anti-Patrones en Clean Architecture

```
❌ Anemic Domain Model
  El domain model solo tiene propiedades y getters/setters.
  Toda la lógica de negocio está en los Services/Handlers.
  Síntoma: Entities con solo { get; set; } y un PedidoService
           de 500 líneas con métodos ConfirmarPedido, CancelarPedido, etc.

❌ Dependencias inversas en el Domain
  El Domain referencia un paquete de NuGet externo (como MediatR o EF Core).
  El Domain debe ser CERO dependencias externas — solo BCL y otros proyectos del domain.

❌ Repository que retorna IQueryable
  interface IPedidoRepository { IQueryable<Pedido> GetAll(); }
  Esto filtra la abstracción — el llamador puede componer queries EF Core
  desde fuera de Infrastructure, acoplando la Application Layer a EF Core.

❌ Lógica en DTOs o Controllers
  Un Controller que contiene reglas de negocio (validaciones complejas, cálculos).
  Los Controllers solo coordinan: deserializar, llamar al Handler, serializar.

❌ Un Repository por tabla (no por Aggregate)
  IPedidoItemRepository — los PedidoItems se acceden SIEMPRE a través del Aggregate Root.
  Tener su propio repository viola el patrón Aggregate.
```

---

## ¿Cuándo NO usar Clean Architecture / DDD?

```
Clean Architecture / DDD completo AGREGA complejidad.
Solo vale la pena cuando el dominio justifica esa inversión.

Usar CA/DDD cuando:
  ✅ El dominio es complejo con muchas reglas de negocio
  ✅ El sistema vivirá y evolucionará por años
  ✅ Hay múltiples equipos trabajando en distintas capas
  ✅ Se necesita testear el dominio de forma aislada

No usar CA/DDD cuando:
  ❌ Es un CRUD simple sin lógica de negocio compleja
  ❌ Es un MVP o prototipo donde la velocidad es prioritaria
  ❌ El equipo no conoce los patrones (genera confusión, no claridad)
  ❌ Es un proyecto pequeño/personal (overengineering)

Alternativa pragmática para proyectos medianos:
  Vertical Slice Architecture:
  - Una carpeta por feature: /Features/Orders/CreateOrder/
  - Dentro: Command.cs, Handler.cs, Endpoint.cs, Validator.cs
  - Sin capas horizontales, con cohesión vertical
  - Más simple, igualmente testeable
```

---

## Preguntas adicionales de entrevista 🎯

**5. ¿Cómo mapeas entre el Domain Model y los DTOs de la API?**
> En la Application Layer, los Handlers proyectan el aggregate a DTOs antes de retornarlo al Controller. Nunca expongo el aggregate directamente en la API (violaría el encapsulamiento del domain). Uso métodos factory estáticos en el DTO (`PedidoDto.From(pedido)`) o AutoMapper para proyecciones complejas. Para queries de solo lectura, suelo leer directamente con proyecciones de EF Core sin pasar por el aggregate.

**6. ¿Qué haces cuando la lógica de un Use Case requiere coordinar dos Aggregates?**
> Los Aggregates no deben modificarse en la misma transacción. El Handler confirma el Aggregate A y guarda. El Domain Event que emite A dispara un segundo Handler que modifica el Aggregate B en su propia transacción. Esto garantiza eventual consistency sin transacciones distribuidas. Si la consistencia inmediata es crítica, revisar si ambas entidades deberían ser el mismo Aggregate.
