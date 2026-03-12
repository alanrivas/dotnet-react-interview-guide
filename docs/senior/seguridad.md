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
