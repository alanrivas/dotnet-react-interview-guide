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

## Documentación con OpenAPI/Swagger

```csharp
// Instalar: dotnet add package Swashbuckle.AspNetCore

// Program.cs
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Mi API",
        Version = "v1",
        Description = "Documentación de mi API",
        Contact = new OpenApiContact { Name = "Alan Rivas" }
    });

    // Incluir XML comments de los métodos
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    options.IncludeXmlComments(xmlPath);

    // Security scheme para JWT
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        Description = "Token JWT"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            new string[] { }
        }
    });
});

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "API v1");
    options.RoutePrefix = string.Empty; // Swagger en la raíz
});

// Controllers con comentarios XML
/// <summary>
/// Obtiene un producto por ID
/// </summary>
/// <param name="id">ID del producto</param>
/// <response code="200">Producto encontrado</response>
/// <response code="404">Producto no encontrado</response>
[HttpGet("{id}")]
[ProduceResponseType(typeof(ProductoResponse), StatusCodes.Status200OK)]
[ProduceResponseType(StatusCodes.Status404NotFound)]
public async Task<ActionResult<ProductoResponse>> GetProducto(int id)
{
    var producto = await _db.Productos.FindAsync(id);
    return producto == null ? NotFound() : Ok(producto);
}
```

**Tres estrategias de documentación:**
1. **Auto-generada desde el código** (XML comments + Swagger)
2. **Manual con OpenAPI spec** (YAML/JSON, más control pero requiere sincronización)
3. **Hybrid** (Spec manual como fuente de verdad, código se genera desde ella)

---

## Estrategias de Versionado Avanzadas

```csharp
// Estrategia 1: Content Negotiation (media types)
// GET /api/productos
// Accept: application/vnd.company.v1+json
// Accept: application/vnd.company.v2+json

[ApiController]
[Route("api/[controller]")]
public class ProductosController : ControllerBase
{
    [HttpGet]
    [Produces("application/vnd.company.v1+json")]
    public IActionResult GetV1() => Ok(new { id = 1, nombre = "Producto" });

    [HttpGet]
    [Produces("application/vnd.company.v2+json")]
    public IActionResult GetV2() => Ok(new 
    { 
        id = 1, 
        nombre = "Producto",
        descripcion = "Descripción adicional"
    });
}

// Estrategia 2: Subdominios (poco común pero limpio conceptualmente)
// v1-api.example.com
// v2-api.example.com

// Estrategia 3: Deprecación gradual
// Header warning cuando una versión está deprecated
public class ApiVersionMiddleware
{
    public async Task InvokeAsync(HttpContext context)
    {
        var version = context.Request.Headers["api-version"].ToString();
        if (version == "1.0")
        {
            context.Response.Headers.Add(
                "Deprecation", "true"
            );
            context.Response.Headers.Add(
                "Sunset", DateTime.UtcNow.AddMonths(3).ToString("R")
            );
            context.Response.Headers.Add(
                "Link", "</api/v2/resource>; rel=\"successor-version\""
            );
        }
        await next(context);
    }
}

// Mejor práctica: mantener múltiples versiones en paralelo por 6-12 meses antes de deprecar
// Notificar a clientes 6 meses antes de apagar una versión
```

---

## HATEOAS (Nivel 3 de Richardson)

```csharp
// Response con links de navegación
public class ProductoResponse
{
    public int Id { get; set; }
    public string Nombre { get; set; }
    public decimal Precio { get; set; }
    
    // Links para acciones posibles
    [JsonPropertyName("_links")]
    public Links Links { get; set; }
}

public class Links
{
    [JsonPropertyName("self")]
    public Link Self { get; set; }

    [JsonPropertyName("all")]
    public Link All { get; set; }

    [JsonPropertyName("update")]
    public Link Update { get; set; }

    [JsonPropertyName("delete")]
    public Link Delete { get; set; }
}

public class Link
{
    [JsonPropertyName("href")]
    public string Href { get; set; }

    [JsonPropertyName("method")]
    public string Method { get; set; }
}

// Implementación en el controller
[HttpGet("{id}")]
public async Task<ActionResult<ProductoResponse>> GetProducto(int id)
{
    var producto = await _db.Productos.FindAsync(id);
    if (producto == null) return NotFound();

    return Ok(new ProductoResponse
    {
        Id = producto.Id,
        Nombre = producto.Nombre,
        Precio = producto.Precio,
        Links = new Links
        {
            Self = new Link { Href = $"/api/productos/{id}", Method = "GET" },
            All = new Link { Href = "/api/productos", Method = "GET" },
            Update = new Link { Href = $"/api/productos/{id}", Method = "PUT" },
            Delete = new Link { Href = $"/api/productos/{id}", Method = "DELETE" }
        }
    });
}

/* Respuesta JSON con HATEOAS:
{
  "id": 1,
  "nombre": "Laptop",
  "precio": 999.99,
  "_links": {
    "self": { "href": "/api/productos/1", "method": "GET" },
    "all": { "href": "/api/productos", "method": "GET" },
    "update": { "href": "/api/productos/1", "method": "PUT" },
    "delete": { "href": "/api/productos/1", "method": "DELETE" }
  }
}
*/
```

**Ventajas de HATEOAS:**
- El cliente descubre las acciones disponibles dinámicamente
- Si la API cambia, el cliente sigue funcionando si sigue los links
- Auto-documentado: el cliente ve qué hacer a continuación

**Desventajas:**
- Mayor payload (más datos en cada respuesta)
- Más complejo de cache
- Muchos clients REST siguen esperando URLs fijas

**Cuándo usar HATEOAS:**
- APIs públicas grandes que evolucionan frequentemente
- Cuando quieres loose coupling total cliente-servidor
- **Cuando NO**: integraciones B2B, clients mobile con ancho de banda limitado

---

## Modelo de Madurez de Richardson

```
Nivel 0: HTTP como protocolo de transporte
├─ POST /api para todo
├─ Respuestas JSON con estado en el body
└─ No usas verbos HTTP ni códigos de estado

Nivel 1: Recursos
├─ GET /api/productos, POST /api/productos
├─ Cada recurso tiene su URL
└─ Todavía todo es éxito en 200 OK

Nivel 2: Verbos HTTP y Status Codes (ESTO ES REST BÁSICO)
├─ GET/POST/PUT/DELETE con códigos correctos (200, 201, 404, 500)
├─ URIs semánticas para recursos
└─ El cliente entiende los errores por el status code (AQUÍ ESTÁN MUCHAS APIs)

Nivel 3: HATEOAS (REST completo según Fielding)
└─ Incluir links en las respuestas para guiar al cliente
```

**Realidad:**
- **80% de APIs** están en Nivel 1-2
- **Level 3** es raro (requiere coordinación cliente-servidor)
- **Suficiente:** Nivel 2 bien implementado es profesional

---

## Anti-patrones comunes en APIs REST

```csharp
// ❌ ANTI-PATRÓN: Usar siempre 200 OK
// Respuesta de error con status 200
POST /api/usuarios
{
  "success": false,
  "error": "El email ya existe"
}
// Status: 200 OK ← INCORRECTO

// ✅ CORRECTO: Usar códigos HTTP semánticos
POST /api/usuarios
{ "success": false, "error": "El email ya existe" }
// Status: 409 Conflict

// ❌ ANTI-PATRÓN: Verbos en las URLs
POST /api/usuarios/crear           // ← Redundante, POST ya significa crear
GET /api/usuarios/obtener?id=1     // ← El verbo está en la URL
DELETE /api/usuarios/eliminar/5    // ← DELETE ya lo dice

// ✅ CORRECTO: URLs con sustantivos, verbos en HTTP
POST /api/usuarios
GET /api/usuarios/1
DELETE /api/usuarios/5

// ❌ ANTI-PATRÓN: Retornar múltiples tipos según el resultado
GET /api/usuarios/1
// Puede retornar:
// - ProductoResponse { id, nombre, ... }
// - ErrorResponse { error, ... }
// - SuccessResponse { data: ProductoResponse }
// ← El cliente no sabe qué esperar

// ✅ CORRECTO: Status code determina contenido
GET /api/usuarios/1
// 200 OK: ProductoResponse
// 404 Not Found: ErrorResponse
// El cliente sabe qué esperar por el status

// ❌ ANTI-PATRÓN: Exponer entidades de BD directamente
public class Producto
{
    public int Id { get; set; }
    [Ignore] public string _internalHash { get; set; } // ← Se expone igual
    public int CategoriaId { get; set; }               // ← No exposar IDs foráneos
    public DateTime? FechaEliminacion { get; set; }    // ← Lógica interna
    public Categoria Categoria { get; set; }          // ← Circular refs en JSON
}

// ✅ CORRECTO: DTOs específicos para la API
public record ProductoResponse(
    int Id,
    string Nombre,
    decimal Precio,
    string Categoria
);
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre PUT y PATCH?**
> `PUT` reemplaza el recurso completo (envías todos los campos). `PATCH` actualización parcial (solo envías los campos que cambian). Si pones un `PUT` con campos faltantes, esos campos se ponen en null/default. Ejemplo: `PUT /usuarios/1 { "nombre": "Juan" }` eliminaría el email; `PATCH /usuarios/1 { "nombre": "Juan" }` solo cambiaría el nombre.

**2. ¿Qué es REST vs SOAP vs GraphQL?**
> - **REST**: estilo arquitectónico, JSON, HTTP nativo, simple, idempotente
> - **SOAP**: protocolo con XML, más verboso, tiene estándares estrictos (WS-Security, WS-Addressing)
> - **GraphQL**: el cliente especifica exactamente qué datos necesita, una sola URL para todo, evita over/under-fetching

**3. ¿Qué es HATEOAS?**
> Hypermedia As The Engine Of Application State. Incluir links en las respuestas para guiar al cliente sobre qué puede hacer a continuación. Nivel 3 del modelo de madurez de Richardson. Ventaja: el cliente descubre acciones dinámicamente y puede adaptarse si cambia la API.

**4. ¿Cómo documentas tu API?**
> Con **Swagger/OpenAPI** usando `Swashbuckle.AspNetCore`. Agrego XML comments en los controllers y parámetros, configuro security schemes (JWT), y expongo el UI en `/swagger`. Genera documentación interactiva y puede generar SDKs en múltiples lenguajes.

**5. ¿Cuál es la diferencia entre 401 y 403 en HTTP?**
> - **401 Unauthorized**: no estás autenticado o tu token expiró. El cliente debe enviar credenciales.
> - **403 Forbidden**: estás autenticado pero no tienes permiso para acceder al recurso. Retornar 401 cuando es realmente 403 es confuso para el cliente.

**6. ¿Cómo manejarías la paginación en una API con millones de registros?**
> Usar offset/limit con un máximo (ej: máx 100 items por página). Para datos muy grandes, considerar cursor-based pagination (ID del último item) que escala mejor. Ejemplo: `GET /api/productos?cursor=123&limit=20`. Con offset/limit, si alguien pide página 1M, es costoso.

**7. ¿Por qué es importante idempotencia en APIs?**
> Porque la red es poco confiable. Si un cliente hace `POST /pedidos` dos veces (timeout, reintentos), sin idempotencia creas dos pedidos. Solución: cliente envía ID único, servidor chequea si ya existe. Similar a una transacción: `POST /pedidos` con `Idempotency-Key: uuid` crea el pedido solo una vez.

**8. ¿Qué es over-fetching y under-fetching?**
> - **Over-fetching**: la API retorna más datos de los que necesitas (toda la entidad cuando solo querías 2 campos)
> - **Under-fetching**: necesitas múltiples requests para obtener lo que querías
> **REST**: Solución es tener múltiples endpoints: `/productos/1/basico` vs `/productos/1/completo`. **GraphQL** resuelve esto: el cliente especifica exactamente qué campos necesita.
