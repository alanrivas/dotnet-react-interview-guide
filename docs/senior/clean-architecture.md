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
