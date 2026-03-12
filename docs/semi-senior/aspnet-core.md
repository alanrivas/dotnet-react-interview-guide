---
id: aspnet-core
title: ASP.NET Core
sidebar_position: 2
---

# ASP.NET Core 🟡

## Arquitectura y Pipeline

```csharp
// Program.cs — punto de entrada en .NET 6+
var builder = WebApplication.CreateBuilder(args);

// 1. REGISTRAR SERVICIOS (DI Container)
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
builder.Services.AddScoped<IProductoService, ProductoService>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* config JWT */ });

var app = builder.Build();

// 2. CONFIGURAR MIDDLEWARE (pipeline de requests)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();  // ¿quién eres?
app.UseAuthorization();   // ¿qué puedes hacer?
app.MapControllers();

app.Run();
```

:::tip Orden del middleware
El orden importa: `UseAuthentication` SIEMPRE antes de `UseAuthorization`. El middleware se ejecuta en el orden en que se agrega.
:::

---

## Controllers y Actions

```csharp
[ApiController]
[Route("api/[controller]")]
public class ProductosController : ControllerBase
{
    private readonly IProductoService _service;
    private readonly ILogger<ProductosController> _logger;

    public ProductosController(IProductoService service, ILogger<ProductosController> logger)
    {
        _service = service;
        _logger = logger;
    }

    // GET api/productos
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProductoDto>>> GetAll(
        [FromQuery] string? categoria,
        [FromQuery] int pagina = 1,
        [FromQuery] int porPagina = 10)
    {
        var productos = await _service.ObtenerAsync(categoria, pagina, porPagina);
        return Ok(productos);
    }

    // GET api/productos/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductoDto>> GetById(int id)
    {
        var producto = await _service.ObtenerPorIdAsync(id);
        if (producto is null)
            return NotFound(new { mensaje = $"Producto {id} no encontrado" });
        return Ok(producto);
    }

    // POST api/productos
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ProductoDto>> Create([FromBody] CrearProductoDto dto)
    {
        var producto = await _service.CrearAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = producto.Id }, producto);
    }

    // PUT api/productos/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] ActualizarProductoDto dto)
    {
        await _service.ActualizarAsync(id, dto);
        return NoContent();
    }

    // DELETE api/productos/5
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        await _service.EliminarAsync(id);
        return NoContent();
    }
}
```

---

## Model Validation

```csharp
public class CrearProductoDto
{
    [Required(ErrorMessage = "El nombre es obligatorio")]
    [StringLength(100, MinimumLength = 3)]
    public string Nombre { get; set; } = string.Empty;

    [Range(0.01, 999999.99, ErrorMessage = "El precio debe ser entre 0.01 y 999999.99")]
    public decimal Precio { get; set; }

    [Required]
    [Range(1, int.MaxValue)]
    public int CategoriaId { get; set; }
}

// [ApiController] valida automáticamente y retorna 400 si hay errores
// También puedes validar manualmente:
if (!ModelState.IsValid)
    return BadRequest(ModelState);
```

---

## Middleware personalizado

```csharp
// Middleware para logging de requests
public class RequestLoggingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RequestLoggingMiddleware> _logger;

    public RequestLoggingMiddleware(RequestDelegate next, ILogger<RequestLoggingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        
        _logger.LogInformation("Request: {Method} {Path}", 
            context.Request.Method, context.Request.Path);
        
        await _next(context); // llamar al siguiente middleware
        
        stopwatch.Stop();
        _logger.LogInformation("Response: {StatusCode} en {ElapsedMs}ms",
            context.Response.StatusCode, stopwatch.ElapsedMilliseconds);
    }
}

// Registrar en Program.cs
app.UseMiddleware<RequestLoggingMiddleware>();
```

---

## Configuración y appsettings

```json
// appsettings.json
{
  "ConnectionStrings": {
    "Default": "Server=.;Database=MiApp;Trusted_Connection=True;"
  },
  "Jwt": {
    "SecretKey": "mi-clave-super-secreta-larga",
    "Issuer": "mi-app",
    "Audience": "mi-app-clients",
    "ExpirationMinutes": 60
  },
  "AppSettings": {
    "MaxProductosPorPagina": 50,
    "AllowedOrigins": ["https://mi-frontend.com"]
  }
}
```

```csharp
// Leer configuración tipada
public class JwtSettings
{
    public string SecretKey { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; } = 60;
}

// Registrar en DI
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection("Jwt"));

// Usar en un servicio
public class JwtService
{
    private readonly JwtSettings _settings;
    
    public JwtService(IOptions<JwtSettings> options)
    {
        _settings = options.Value;
    }
}
```

---

## JWT Authentication

```csharp
// Generar token JWT
public string GenerarToken(Usuario usuario)
{
    var key = new SymmetricSecurityKey(
        Encoding.UTF8.GetBytes(_settings.SecretKey));
    
    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
        new Claim(ClaimTypes.Email, usuario.Email),
        new Claim(ClaimTypes.Role, usuario.Rol),
    };

    var token = new JwtSecurityToken(
        issuer: _settings.Issuer,
        audience: _settings.Audience,
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(_settings.ExpirationMinutes),
        signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
    );

    return new JwtSecurityTokenHandler().WriteToken(token);
}
```

---

## Global Exception Handling

```csharp
// Exception handler middleware centralizado
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exceptionHandler = context.Features.Get<IExceptionHandlerFeature>();
        var exception = exceptionHandler?.Error;

        var (statusCode, mensaje) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, exception.Message),
            ValidationException => (StatusCodes.Status400BadRequest, exception.Message),
            UnauthorizedException => (StatusCodes.Status401Unauthorized, exception.Message),
            _ => (StatusCodes.Status500InternalServerError, "Error interno del servidor")
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        
        await context.Response.WriteAsJsonAsync(new 
        { 
            error = mensaje,
            traceId = Activity.Current?.Id 
        });
    });
});
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es el middleware y cómo funciona el pipeline?**
> El middleware es código que se ejecuta en cada request HTTP, formando una cadena. Cada pieza puede procesar el request, llamar al siguiente middleware, y procesar la response. Se configura en orden y ese orden importa.

**2. ¿Cuál es la diferencia entre `[Authorize]` y `[AllowAnonymous]`?**
> `[Authorize]` requiere que el usuario esté autenticado (y opcionalmente tenga cierto rol/claim). `[AllowAnonymous]` permite acceso sin autenticación, incluso si hay un `[Authorize]` global.

**3. ¿Cuál es la diferencia entre `IActionResult` y `ActionResult<T>`?**
> `ActionResult<T>` es más específico y permite que Swagger infiera el tipo de respuesta automáticamente. También permite retornar tanto el tipo `T` directamente como cualquier `IActionResult` (NotFound, BadRequest, etc.).

**4. ¿Qué es CORS y cómo se configura?**
> CORS (Cross-Origin Resource Sharing) es el mecanismo que permite que un frontend en un dominio distinto haga requests al API.
```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("MiPolicy", policy =>
        policy.WithOrigins("https://mi-frontend.com")
              .AllowAnyMethod()
              .AllowAnyHeader());
});
app.UseCors("MiPolicy");
```
