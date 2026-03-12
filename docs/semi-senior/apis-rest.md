---
id: apis-rest
title: APIs REST
sidebar_position: 4
---

# APIs REST 🟡

## Principios REST

REST (Representational State Transfer) es un estilo arquitectónico para APIs web.

### Constraints de REST

1. **Cliente-Servidor**: separación de responsabilidades
2. **Sin estado (Stateless)**: cada request contiene toda la información necesaria
3. **Cacheable**: las respuestas deben indicar si son cacheables
4. **Interfaz uniforme**: recursos bien definidos, verbos HTTP estándar
5. **Sistema en capas**: el cliente no sabe si habla directo al servidor o a un proxy

---

## Verbos HTTP y Convenciones

```
GET    /api/productos          → Listar todos
GET    /api/productos/{id}     → Obtener uno
POST   /api/productos          → Crear
PUT    /api/productos/{id}     → Reemplazar completo
PATCH  /api/productos/{id}     → Actualización parcial
DELETE /api/productos/{id}     → Eliminar

# Recursos anidados
GET    /api/categorias/{id}/productos    → Productos de una categoría
POST   /api/pedidos/{id}/items          → Agregar item al pedido
```

---

## Códigos de estado HTTP

| Código | Significado | Cuándo usarlo |
|--------|-------------|---------------|
| 200 OK | Éxito | GET, PUT, PATCH exitoso |
| 201 Created | Creado | POST exitoso |
| 204 No Content | Sin contenido | DELETE, PUT sin body |
| 400 Bad Request | Request inválido | Validación fallida |
| 401 Unauthorized | No autenticado | Sin token / token inválido |
| 403 Forbidden | No autorizado | Autenticado pero sin permiso |
| 404 Not Found | No encontrado | Recurso no existe |
| 409 Conflict | Conflicto | Email duplicado, concurrencia |
| 422 Unprocessable | Error de negocio | Regla de negocio violada |
| 429 Too Many Requests | Rate limit | Throttling |
| 500 Internal Error | Error del servidor | Excepción no manejada |

---

## Versionado de API

```csharp
// Opción 1: URL versioning (más común y simple)
// GET /api/v1/productos
// GET /api/v2/productos

[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[ApiVersion("2.0")]
public class ProductosController : ControllerBase
{
    [HttpGet]
    [MapToApiVersion("1.0")]
    public IActionResult GetV1() => Ok("Versión 1");

    [HttpGet]
    [MapToApiVersion("2.0")]
    public IActionResult GetV2() => Ok("Versión 2 con más datos");
}

// Opción 2: Header versioning
// GET /api/productos
// Header: api-version: 2.0

// Opción 3: Query string
// GET /api/productos?api-version=2.0
```

---

## Paginación, Filtrado y Ordenamiento

```csharp
// Query parameters bien diseñados
// GET /api/productos?pagina=2&porPagina=20&categoria=electronica&ordenPor=precio&desc=true

public record ProductosQueryParams(
    int Pagina = 1,
    int PorPagina = 20,
    string? Categoria = null,
    string? Busqueda = null,
    string OrdenarPor = "nombre",
    bool Descendente = false
);

// Respuesta con metadata de paginación
public class PagedResponse<T>
{
    public IEnumerable<T> Items { get; set; }
    public int Total { get; set; }
    public int Pagina { get; set; }
    public int PorPagina { get; set; }
    public int TotalPaginas => (int)Math.Ceiling((double)Total / PorPagina);
    public bool TieneSiguiente => Pagina < TotalPaginas;
    public bool TieneAnterior => Pagina > 1;
}
```

---

## Diseño de DTOs

```csharp
// Separar DTOs de entrada y salida (principio de responsabilidad única)

// Request DTOs (entrada)
public record CrearProductoRequest(
    [Required] string Nombre,
    [Range(0.01, double.MaxValue)] decimal Precio,
    int CategoriaId
);

public record ActualizarProductoRequest(
    string? Nombre,
    decimal? Precio  // solo campos opcionales para PATCH
);

// Response DTOs (salida)
public record ProductoResponse(
    int Id,
    string Nombre,
    decimal Precio,
    string Categoria,
    DateTime FechaCreacion
);

// Nunca exponer la entidad directamente:
// - Expone estructura interna de la BD
// - Puede tener circular references (serialización)
// - No puedes controlar qué campos se exponen
```

---

## Idempotencia

```
GET    → Idempotente ✅ (leer no cambia el estado)
DELETE → Idempotente ✅ (borrar dos veces = mismo resultado)
PUT    → Idempotente ✅ (reemplazar con el mismo valor = igual)
POST   → NO idempotente ❌ (crear dos veces = dos recursos)
PATCH  → Depende de la implementación
```

---

## Rate Limiting

```csharp
// .NET 7+ tiene rate limiting built-in
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("api", config =>
    {
        config.PermitLimit = 100;          // 100 requests
        config.Window = TimeSpan.FromMinutes(1); // por minuto
        config.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        config.QueueLimit = 10;
    });
});

app.UseRateLimiter();

[HttpGet]
[EnableRateLimiting("api")]
public IActionResult Get() => Ok();
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre PUT y PATCH?**
> `PUT` reemplaza el recurso completo (envías todos los campos). `PATCH` actualización parcial (solo envías los campos que cambian). Si pones un `PUT` con campos faltantes, esos campos se ponen en null/default.

**2. ¿Qué es REST vs SOAP vs GraphQL?**
> - **REST**: estilo arquitectónico, JSON, HTTP nativo, simple
> - **SOAP**: protocolo con XML, más verboso, tiene estándares estrictos (WS-Security, etc.)
> - **GraphQL**: el cliente especifica exactamente qué datos necesita, evita over/under-fetching

**3. ¿Qué es HATEOAS?**
> Hypermedia As The Engine Of Application State. Incluir links en las respuestas para guiar al cliente sobre qué puede hacer a continuación. Nivel 3 del modelo de madurez de Richardson (pocas APIs lo implementan completamente).

**4. ¿Cómo documentas tu API?**
> Con **Swagger/OpenAPI** mediante el paquete `Swashbuckle.AspNetCore`. Permite documentación interactiva y genera clients en múltiples lenguajes. También agrego XML comments en los controllers para enriquecer la documentación.
