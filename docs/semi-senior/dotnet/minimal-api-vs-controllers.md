---
id: minimal-api-vs-controllers
title: Minimal API vs Controllers
sidebar_position: 24
---

# Minimal API vs Controllers 🟡

.NET 6 introdujo Minimal APIs como alternativa a los MVC Controllers tradicionales. En .NET 8 es una decisión de diseño que aparece en casi todas las entrevistas.

---

## La diferencia fundamental

```
Controllers (MVC):
  Program.cs → builder.Services.AddControllers()
             → app.MapControllers()
             → [ApiController] ProductosController : ControllerBase
             → [HttpGet] → método con atributos

Minimal API:
  Program.cs → app.MapGet("/api/productos", handler)
             → Sin clases, sin atributos, directamente en Program.cs o en grupos
```

---

## Controllers — Forma clásica

```csharp
// ✅ Controller tradicional
[ApiController]
[Route("api/[controller]")]
public class ProductosController : ControllerBase
{
    private readonly IProductoService _service;

    public ProductosController(IProductoService service)
    {
        _service = service;
    }

    [HttpGet]
    [ProducesResponseType(typeof(List<ProductoDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, int pageSize = 20)
    {
        var productos = await _service.ObtenerTodosAsync(page, pageSize);
        return Ok(productos);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ProductoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(int id)
    {
        var producto = await _service.ObtenerPorIdAsync(id);
        if (producto is null) return NotFound();
        return Ok(producto);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ProductoDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateProductoDto dto)
    {
        var creado = await _service.CrearAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = creado.Id }, creado);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        var eliminado = await _service.EliminarAsync(id);
        if (!eliminado) return NotFound();
        return NoContent();
    }
}
```

---

## Minimal API — Forma moderna

```csharp
// ✅ Minimal API — todo en Program.cs o en archivos de extensión
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped<IProductoService, ProductoService>();

var app = builder.Build();

// Agrupar endpoints relacionados
var productos = app.MapGroup("/api/productos")
    .WithTags("Productos")
    .WithOpenApi();

productos.MapGet("/", async (IProductoService service, int page = 1, int pageSize = 20) =>
{
    var resultado = await service.ObtenerTodosAsync(page, pageSize);
    return Results.Ok(resultado);
})
.WithName("GetProductos")
.Produces<List<ProductoDto>>();

productos.MapGet("/{id:int}", async (int id, IProductoService service) =>
{
    var producto = await service.ObtenerPorIdAsync(id);
    return producto is null ? Results.NotFound() : Results.Ok(producto);
})
.WithName("GetProductoById")
.Produces<ProductoDto>()
.Produces(404);

productos.MapPost("/", async (CreateProductoDto dto, IProductoService service) =>
{
    var creado = await service.CrearAsync(dto);
    return Results.CreatedAtRoute("GetProductoById", new { id = creado.Id }, creado);
})
.RequireAuthorization("Admin")
.Produces<ProductoDto>(201)
.Produces(400);

productos.MapDelete("/{id:int}", async (int id, IProductoService service) =>
{
    var eliminado = await service.EliminarAsync(id);
    return eliminado ? Results.NoContent() : Results.NotFound();
})
.RequireAuthorization("Admin");

app.Run();
```

---

## Organización de Minimal APIs a escala

El problema con Minimal APIs en proyectos grandes: `Program.cs` se vuelve enorme. La solución es organizar con extension methods:

```csharp
// ✅ Patrón de extensión por módulo
// Endpoints/ProductosEndpoints.cs
public static class ProductosEndpoints
{
    public static RouteGroupBuilder MapProductos(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetAll);
        group.MapGet("/{id:int}", GetById);
        group.MapPost("/", Create).RequireAuthorization("Admin");
        group.MapPut("/{id:int}", Update).RequireAuthorization("Admin");
        group.MapDelete("/{id:int}", Delete).RequireAuthorization("Admin");
        return group;
    }

    private static async Task<IResult> GetAll(
        IProductoService service, int page = 1, int pageSize = 20)
    {
        var resultado = await service.ObtenerTodosAsync(page, pageSize);
        return Results.Ok(resultado);
    }

    private static async Task<IResult> GetById(int id, IProductoService service)
    {
        var producto = await service.ObtenerPorIdAsync(id);
        return producto is null ? Results.NotFound() : Results.Ok(producto);
    }

    private static async Task<IResult> Create(
        CreateProductoDto dto, IProductoService service)
    {
        var creado = await service.CrearAsync(dto);
        return Results.CreatedAtRoute("GetProductoById", new { id = creado.Id }, creado);
    }

    private static async Task<IResult> Update(
        int id, UpdateProductoDto dto, IProductoService service)
    {
        var actualizado = await service.ActualizarAsync(id, dto);
        return actualizado is null ? Results.NotFound() : Results.Ok(actualizado);
    }

    private static async Task<IResult> Delete(int id, IProductoService service)
    {
        var eliminado = await service.EliminarAsync(id);
        return eliminado ? Results.NoContent() : Results.NotFound();
    }
}

// Endpoints/PedidosEndpoints.cs
public static class PedidosEndpoints
{
    public static RouteGroupBuilder MapPedidos(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetAll);
        group.MapPost("/", Create);
        return group;
    }
    // ...
}

// Program.cs — limpio
var api = app.MapGroup("/api").WithOpenApi();
api.MapGroup("/productos").MapProductos();
api.MapGroup("/pedidos").MapPedidos();
```

---

## Validación en Minimal APIs

Controllers tienen `[ApiController]` que activa validación automática. En Minimal APIs hay que hacerlo manualmente o con FluentValidation:

```csharp
// ✅ Opción 1: Validar manualmente con Results.ValidationProblem
productos.MapPost("/", async (CreateProductoDto dto, IProductoService service) =>
{
    var errores = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(dto.Nombre))
        errores["nombre"] = ["El nombre es requerido"];

    if (dto.Precio <= 0)
        errores["precio"] = ["El precio debe ser mayor a 0"];

    if (errores.Count > 0)
        return Results.ValidationProblem(errores);

    var creado = await service.CrearAsync(dto);
    return Results.Created($"/api/productos/{creado.Id}", creado);
});

// ✅ Opción 2: Endpoint Filter (reutilizable, como middleware por endpoint)
public class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var dto = context.Arguments.OfType<T>().FirstOrDefault();
        if (dto is null) return Results.BadRequest("Request body requerido");

        var validator = context.HttpContext.RequestServices
            .GetRequiredService<IValidator<T>>();

        var result = await validator.ValidateAsync(dto);
        if (!result.IsValid)
            return Results.ValidationProblem(result.ToDictionary());

        return await next(context);
    }
}

// Usar el filter en el endpoint
productos.MapPost("/", async (CreateProductoDto dto, IProductoService service) =>
{
    var creado = await service.CrearAsync(dto);
    return Results.Created($"/api/productos/{creado.Id}", creado);
})
.AddEndpointFilter<ValidationFilter<CreateProductoDto>>();
```

---

## Comparativa directa

| Aspecto | Controllers | Minimal API |
|---------|-------------|-------------|
| **Verbosidad** | Alta — clase + atributos | Baja — una línea por endpoint |
| **Organización** | Natural por clase | Requiere disciplina extra |
| **Validación automática** | ✅ `[ApiController]` | ❌ Manual o con filtros |
| **Binding de parámetros** | `[FromBody]`, `[FromQuery]`... | Automático por convención |
| **Filtros de acción** | `IActionFilter` | `IEndpointFilter` |
| **Testing** | `WebApplicationFactory` | `WebApplicationFactory` (igual) |
| **Swagger/OpenAPI** | Automático con `[ApiController]` | `.WithOpenApi()`, `.Produces<T>()` |
| **Performance** | Buena | Ligeramente mejor (menos overhead MVC) |
| **Curva de aprendizaje** | Más alta (más conceptos) | Baja para APIs simples |
| **Proyectos grandes** | ✅ Escala bien naturalmente | ✅ Escala con extensiones |

---

## ¿Cuándo usar cada uno?

```
Usa Controllers cuando:
✅ El equipo ya los conoce bien
✅ El proyecto es grande y complejo
✅ Necesitas features avanzadas de MVC (ViewComponents, Razor, Areas)
✅ Hay lógica compleja en filtros de acción (IActionFilter)
✅ Migración incremental — no quieres reescribir todo

Usa Minimal API cuando:
✅ API nueva desde cero en .NET 6+
✅ Microservicio pequeño con pocos endpoints
✅ Performance es crítica (menos overhead)
✅ El equipo prefiere estilo más funcional/explícito
✅ Quieres aprovechar los últimos features de .NET 8+
```

---

## TypedResults — mejor que Results (.NET 7+)

```csharp
// ✅ TypedResults — el compilador conoce el tipo de retorno → mejor OpenAPI automático
productos.MapGet("/{id:int}", async Task<Results<Ok<ProductoDto>, NotFound>>
    (int id, IProductoService service) =>
{
    var producto = await service.ObtenerPorIdAsync(id);

    return producto is null
        ? TypedResults.NotFound()
        : TypedResults.Ok(producto);
});

// Swagger genera automáticamente los schemas de respuesta correctos sin .Produces<T>()
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre Minimal API y Controllers?**
> Controllers son clases con atributos que siguen el patrón MVC. Minimal APIs registran endpoints directamente con lambdas o métodos estáticos, sin clases intermedias. Minimal API tiene menos overhead y código más conciso; Controllers escalan mejor en proyectos grandes por su organización natural.

**2. ¿Pueden coexistir Controllers y Minimal APIs en el mismo proyecto?**
> Sí. Puedes tener ambos en el mismo proyecto. Es común en migraciones incrementales: los endpoints nuevos se crean como Minimal API y los existentes siguen siendo Controllers hasta que se migran.

**3. ¿Minimal API tiene validación automática como `[ApiController]`?**
> No. `[ApiController]` activa la validación de ModelState automáticamente. En Minimal APIs hay que validar manualmente, usar `IEndpointFilter` reutilizable, o integrar FluentValidation con un filtro.

**4. ¿Son más performantes las Minimal APIs?**
> Ligeramente. Al no pasar por el pipeline completo de MVC (model binding, action filters, result executors), hay menos overhead. Para la mayoría de aplicaciones la diferencia es imperceptible, pero sí se nota en benchmarks de alta carga.

**5. ¿Cómo organizas Minimal APIs en proyectos grandes?**
> Usando extension methods por módulo/dominio. Cada archivo de `*Endpoints.cs` define un método `MapX(this RouteGroupBuilder group)` que agrupa los endpoints relacionados. `Program.cs` solo hace el registro y queda limpio.
