---
id: seguridad
title: Seguridad
sidebar_position: 5
---

# Seguridad 🔴

## OWASP Top 10 para APIs

### 1. Broken Object Level Authorization (BOLA)

```csharp
// ❌ Vulnerable: cualquier usuario puede ver cualquier pedido
[HttpGet("pedidos/{id}")]
public async Task<IActionResult> GetPedido(int id)
{
    var pedido = await _repo.ObtenerAsync(id);
    return Ok(pedido);
}

// ✅ Verificar que el recurso pertenece al usuario actual
[HttpGet("pedidos/{id}")]
[Authorize]
public async Task<IActionResult> GetPedido(int id)
{
    var usuarioId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    var pedido = await _repo.ObtenerAsync(id);
    
    if (pedido is null) return NotFound();
    if (pedido.UsuarioId != usuarioId) return Forbid(); // 403, no 404
    
    return Ok(pedido);
}
```

### 2. SQL Injection

```csharp
// ❌ NUNCA: concatenación directa
var query = $"SELECT * FROM Usuarios WHERE Email = '{email}'";
// Si email = "' OR '1'='1" → devuelve todos los usuarios

// ✅ Parámetros siempre (EF Core lo hace automáticamente)
var usuario = await _context.Usuarios
    .Where(u => u.Email == email) // Genera WHERE Email = @p0
    .FirstOrDefaultAsync();

// ✅ Si usas SQL raw, siempre parámetros
var usuarios = await _context.Usuarios
    .FromSqlRaw("SELECT * FROM Usuarios WHERE Email = {0}", email)
    .ToListAsync();
```

### 3. JWT — Implementación segura

```csharp
public class JwtService
{
    public string GenerarToken(Usuario usuario)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_settings.SecretKey));
        
        // Claims mínimos necesarios (principio de mínimo privilegio)
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()), // ID único
            new Claim("rol", usuario.Rol),
        };

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            // Access token: corta duración (15 min - 1 hora)
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // Refresh token: larga duración, almacenado en DB
    public string GenerarRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
}
```

### 4. XSS Prevention

```csharp
// .NET encodes automáticamente en Razor. En APIs REST:
// - El frontend debe usar textContent, no innerHTML
// - Content-Type: application/json (no text/html)
// - Configurar Content Security Policy

app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Add("X-Frame-Options", "DENY");
    context.Response.Headers.Add("Content-Security-Policy", 
        "default-src 'self'; script-src 'self'");
    context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
    await next();
});
```

### 5. Input Validation

```csharp
// Validación en múltiples capas
public class CrearUsuarioDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 8)]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$",
        ErrorMessage = "La contraseña debe tener mayúsculas, minúsculas y números")]
    public string Password { get; set; } = string.Empty;
}

// Sanitización de HTML si es necesario almacenarlo
using HtmlSanitizer;
var sanitizer = new HtmlSanitizer();
var htmlSeguro = sanitizer.Sanitize(htmlEntrada);
```

---

## Autenticación y Autorización

### Policy-Based Authorization

```csharp
// Definir políticas
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SoloAdmin", policy =>
        policy.RequireRole("Admin"));
    
    options.AddPolicy("EmpresaPremium", policy =>
        policy.RequireClaim("Plan", "Premium", "Enterprise"));
    
    options.AddPolicy("MayorDeEdad", policy =>
        policy.Requirements.Add(new EdadMinimaRequirement(18)));
});

// Handler personalizado
public class EdadMinimaHandler : AuthorizationHandler<EdadMinimaRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        EdadMinimaRequirement requirement)
    {
        var fechaNacimientoClaim = context.User.FindFirst("fecha_nacimiento");
        if (fechaNacimientoClaim is null) return Task.CompletedTask;

        var edad = CalcularEdad(DateTime.Parse(fechaNacimientoClaim.Value));
        if (edad >= requirement.EdadMinima)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}

// Uso en controller
[Authorize(Policy = "EmpresaPremium")]
[HttpGet("reportes-avanzados")]
public IActionResult ReportesAvanzados() => Ok();
```

---

## Secretos y Configuración segura

```csharp
// ❌ NUNCA: secrets en código o appsettings.json commiteado
var connectionString = "Server=prod;Password=SuperSecret123";

// ✅ User Secrets (desarrollo local)
// dotnet user-secrets set "ConnectionStrings:Default" "..."

// ✅ Variables de entorno
var secret = Environment.GetEnvironmentVariable("JWT_SECRET");

// ✅ Azure Key Vault / AWS Secrets Manager (producción)
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{vaultName}.vault.azure.net/"),
    new DefaultAzureCredential()
);
```

---

## HTTPS y TLS

```csharp
// Forzar HTTPS
app.UseHttpsRedirection();

// HSTS — indica al navegador que siempre use HTTPS
app.UseHsts();

// En producción, configurar certificados apropiados
builder.WebHost.ConfigureKestrel(options =>
{
    options.ListenAnyIP(443, listenOptions =>
    {
        listenOptions.UseHttps(certPath, certPassword);
    });
});
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre autenticación y autorización?**
> **Autenticación**: verificar quién eres (identidad). **Autorización**: verificar qué puedes hacer (permisos). Primero autenticas, luego autorizas.

**2. ¿Cómo almacenarías contraseñas de forma segura?**
> **Nunca en texto plano, nunca con MD5 o SHA sin salt**. Usar **bcrypt**, **Argon2** o **PBKDF2** con salt único por contraseña. En .NET: `PasswordHasher<T>` de ASP.NET Core Identity.

**3. ¿Qué es CSRF y cómo se previene?**
> Cross-Site Request Forgery: un sitio malicioso engaña al navegador del usuario para hacer requests autenticadas a tu sitio. Se previene con: tokens CSRF, verificar el header `Origin`/`Referer`, usar `SameSite=Strict` en cookies, o usando JWT en Authorization header (no cookies).

**4. ¿Cómo manejarías el almacenamiento de JWT en el frontend?**
> Opciones:
> - **localStorage**: vulnerable a XSS (JavaScript puede leerlo)
> - **cookie con HttpOnly + Secure + SameSite=Strict**: no accesible desde JS, más seguro
> La opción más segura para SPAs es: **access token en memoria (variable JS) + refresh token en cookie HttpOnly**.

---

## OWASP Top 10 — Items restantes

### 6. Broken Authentication

```csharp
// ❌ Problemas comunes de autenticación rota:
// - No limitar intentos fallidos de login
// - Contraseñas débiles permitidas
// - Tokens predecibles o de larga duración sin rotación

// ✅ Account lockout tras intentos fallidos
public class LoginService
{
    private const int MaxIntentos = 5;
    private const int LockoutMinutos = 15;

    public async Task<LoginResult> LoginAsync(string email, string password)
    {
        var usuario = await _db.Usuarios.FirstOrDefaultAsync(u => u.Email == email);

        // Siempre el mismo tiempo de respuesta (evita user enumeration timing attack)
        if (usuario is null)
        {
            _hasher.VerifyHashedPassword(null, "dummy", password); // dummy hash
            return LoginResult.Fallido("Credenciales incorrectas");
        }

        if (usuario.BloqueoHasta > DateTime.UtcNow)
            return LoginResult.Fallido($"Cuenta bloqueada hasta {usuario.BloqueoHasta}");

        var resultado = _hasher.VerifyHashedPassword(usuario, usuario.PasswordHash, password);

        if (resultado == PasswordVerificationResult.Failed)
        {
            usuario.IntentosFallidos++;
            if (usuario.IntentosFallidos >= MaxIntentos)
                usuario.BloqueoHasta = DateTime.UtcNow.AddMinutes(LockoutMinutos);

            await _db.SaveChangesAsync();
            return LoginResult.Fallido("Credenciales incorrectas");
        }

        usuario.IntentosFallidos = 0;
        usuario.BloqueoHasta = null;
        await _db.SaveChangesAsync();
        return LoginResult.Exitoso(usuario);
    }
}
```

### 7. Security Misconfiguration

```csharp
// ❌ Errores comunes de configuración:
// - Stack traces expuestos en producción
// - Endpoints de diagnóstico accesibles sin auth
// - Cabeceras que revelan tecnología (X-Powered-By, Server)
// - CORS configurado como wildcard en producción

// ✅ Eliminar información del servidor
app.UseHsts();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.Remove("Server");
    ctx.Response.Headers.Remove("X-Powered-By");
    await next();
});

// ✅ Manejo de errores sin stack traces en producción
if (app.Environment.IsProduction())
{
    app.UseExceptionHandler("/error"); // Página genérica de error
    // NO usar app.UseDeveloperExceptionPage()
}

// ✅ Swagger solo en desarrollo
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
```

### 8. Server-Side Request Forgery (SSRF)

```csharp
// SSRF: el atacante hace que tu servidor haga requests a recursos internos
// Ejemplo malicioso: url = "http://169.254.169.254/metadata" (AWS metadata service)
//                   url = "http://internal-db:5432"

// ❌ Vulnerable
[HttpPost("fetch-url")]
public async Task<IActionResult> FetchUrl([FromBody] string url)
{
    var content = await _httpClient.GetStringAsync(url); // ¡Peligroso!
    return Ok(content);
}

// ✅ Validar la URL contra una allowlist
private static readonly HashSet<string> AllowedHosts = ["api.trusted.com", "cdn.trusted.com"];

[HttpPost("fetch-url")]
public async Task<IActionResult> FetchUrl([FromBody] string url)
{
    if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        return BadRequest("URL inválida");

    // Solo HTTPS y hosts permitidos
    if (uri.Scheme != "https" || !AllowedHosts.Contains(uri.Host))
        return BadRequest("Host no permitido");

    // Resolver la IP para evitar DNS rebinding
    var addresses = await Dns.GetHostAddressesAsync(uri.Host);
    if (addresses.Any(ip => IsPrivateIp(ip)))
        return BadRequest("No se permiten IPs privadas");

    var content = await _httpClient.GetStringAsync(uri);
    return Ok(content);
}

private static bool IsPrivateIp(IPAddress ip)
{
    var bytes = ip.GetAddressBytes();
    return bytes[0] == 10
        || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
        || (bytes[0] == 192 && bytes[1] == 168)
        || bytes[0] == 127;
}
```

### 9. Broken Function Level Authorization

```csharp
// ❌ Asume que los usuarios no conocen las URLs admin
// Un usuario normal podría probar GET /api/admin/usuarios y acceder

// ✅ Autorización explícita en cada endpoint, nunca por oscuridad
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")] // Aplica a todo el controller
public class AdminController : ControllerBase
{
    [HttpGet("usuarios")]
    public async Task<IActionResult> GetUsuarios() => Ok(await _service.GetAllAsync());

    [HttpDelete("usuarios/{id}")]
    [Authorize(Policy = "SuperAdmin")] // Requiere permiso adicional
    public async Task<IActionResult> EliminarUsuario(int id) { /*...*/ }
}

// ✅ Para APIs que mezclan roles, verificar explícitamente
[HttpPut("pedidos/{id}/estado")]
[Authorize]
public async Task<IActionResult> CambiarEstado(int id, [FromBody] CambiarEstadoDto dto)
{
    var userId = GetCurrentUserId();
    var esAdmin = User.IsInRole("Admin");

    // Solo admin puede cancelar pedidos ajenos
    if (dto.NuevoEstado == "Cancelado" && !esAdmin)
    {
        var pedido = await _repo.GetAsync(id);
        if (pedido.UsuarioId != userId) return Forbid();
    }

    await _service.CambiarEstadoAsync(id, dto.NuevoEstado);
    return Ok();
}
```

### 10. Unrestricted Resource Consumption

```csharp
// ❌ Sin límites en el tamaño de payloads o la cantidad de registros

// ✅ Limitar tamaño de requests
builder.Services.Configure<KestrelServerOptions>(options =>
{
    options.Limits.MaxRequestBodySize = 10 * 1024 * 1024; // 10 MB
});

// ✅ Paginación obligatoria — nunca devolver colecciones sin límite
[HttpGet("productos")]
public async Task<IActionResult> GetProductos(
    [FromQuery] int pagina = 1,
    [FromQuery] int tamaño = 20)
{
    tamaño = Math.Min(tamaño, 100); // Máximo 100 por página, aunque pidan más

    var productos = await _db.Productos
        .Skip((pagina - 1) * tamaño)
        .Take(tamaño)
        .ToListAsync();

    return Ok(new { pagina, tamaño, datos = productos });
}

// ✅ Timeout en operaciones costosas
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
var resultado = await _service.OperacionCostosaAsync(cts.Token);
```

---

