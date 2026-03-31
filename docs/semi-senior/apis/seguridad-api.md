---
id: seguridad-api
title: Seguridad en APIs
sidebar_position: 21
---

# Seguridad en APIs 🟡

La seguridad es un aspecto crítico en APIs. Este documento cubre vulnerabilidades comunes y cómo mitigarlas.

## CORS (Cross-Origin Resource Sharing)

CORS controla quién puede hacer requests a tu API desde dominios diferentes.

```csharp
// Configuración basada en entorno
builder.Services.AddCors(options =>
{
    options.AddPolicy("ProduccionPolicy", policy =>
    {
        policy.WithOrigins("https://mi-frontend.com", "https://app.midominio.com")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .WithExposedHeaders("X-Total-Count", "X-Page-Number");
    });
    
    options.AddPolicy("DesarrolloPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var policy = app.Environment.IsProduction() ? "ProduccionPolicy" : "DesarrolloPolicy";
app.UseCors(policy);

// ⚠️ MALA PRÁCTICA
// ❌ AllowAnyOrigin() + AllowCredentials() → error
// ❌ Hardcodear origins de clientes
// ❌ No validar origins

// BUENA PRÁCTICA
// ✓ Validar origins desde configuración
var allowedOrigins = app.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>();
policy.WithOrigins(allowedOrigins ?? []);
```

**Headers CORS importantes:**
- `Access-Control-Allow-Origin`: qué origen puede acceder
- `Access-Control-Allow-Methods`: GET, POST, PUT, DELETE, etc
- `Access-Control-Allow-Headers`: qué headers se permiten (Authorization, Content-Type, etc)
- `Access-Control-Max-Age`: cachear pre-flight por N segundos
- `Access-Control-Allow-Credentials`: permitir cookies/auth

## CSRF (Cross-Site Request Forgery)

CSRF: un atacante hace que ejecutes acciones sin intención.

```csharp
// Anti-CSRF con tokens
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.FormFieldName = "_RequestVerificationToken";
});

// En GET: devolver formulario con token
[HttpGet("editar/{id}")]
public IActionResult Editar(int id)
{
    var token = _antiforgery.GetAndStoreTokens(HttpContext).RequestToken;
    // Pasar token a la vista/cliente
    return View(new { token });
}

// En POST: validar token
[HttpPost("actualizar")]
[ValidateAntiForgeryToken] // Valida automáticamente
public async Task<IActionResult> Actualizar(ActualizarDto dto)
{
    // Si el token no coincide, lanza excepción
    await _service.ActualizarAsync(dto);
    return Ok();
}

// Para SPAs (Single Page Applications)
// El token viene en un header HTTP
[HttpGet("csrf-token")]
public IActionResult GetCsrfToken()
{
    var token = _antiforgery.GetAndStoreTokens(HttpContext).RequestToken;
    return Ok(new { token });
}

// Cliente: incluir en cada request que modifique
const response = await fetch('/api/actualizar', {
  method: 'POST',
  headers: {
    'X-CSRF-TOKEN': getCsrfToken(),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(datos)
});
```

**Mitigation:**
- Usar tokens anti-CSRF (validar state + token)
- SameSite cookies (Strict, Lax, None)
- Validar Referer/Origin header
- POST/PUT/DELETE nunca accesibles vía GET

## SQL Injection

SQL Injection: inyectar código SQL malicioso en parámetros.

```csharp
// ❌ VULNERABLE A SQL INJECTION
public async Task<Usuario?> BuscarPorEmail(string email)
{
    var query = $"SELECT * FROM Usuarios WHERE Email = '{email}'";
    // Si email = "' OR '1'='1", obtienes TODOS los usuarios
    return await _db.Usuarios.FromSqlRaw(query).FirstOrDefaultAsync();
}

// ✓ SEGURO: usar parámetros
public async Task<Usuario?> BuscarPorEmail(string email)
{
    return await _db.Usuarios
        .FirstOrDefaultAsync(u => u.Email == email);
    
    // O con raw SQL + parámetros
    var result = await _db.Usuarios
        .FromSqlInterpolated($"SELECT * FROM Usuarios WHERE Email = {email}")
        .FirstOrDefaultAsync();
}

// ✓ SEGURO: LINQ previene SQL injection
var usuarios = await _db.Usuarios
    .Where(u => u.Nombre.Contains(busqueda)) // parámetro interpolado
    .ToListAsync();
```

**Best practices:**
- Usar ORM (Entity Framework, Dapper con parámetros)
- Nunca concatenar strings en queries
- Usar `FromSqlInterpolated` en vez de `FromSqlRaw`
- Validar y sanitizar entrada (aunque el ORM ya lo hace)

## XSS (Cross-Site Scripting)

XSS: inyectar HTML/JavaScript que se ejecuta en el navegador.

```csharp
// Backend: escapeando HTML (ASP.NET lo hace automáticamente)
public class Comentario
{
    public int Id { get; set; }
    public string Contenido { get; set; } = string.Empty;
}

[HttpPost("comentarios")]
public async Task<IActionResult> CrearComentario(CrearComentarioDto dto)
{
    // ASP.NET automáticamente escapeea el HTML en JSON responses
    var comentario = new Comentario { Contenido = dto.Contenido };
    _db.Comentarios.Add(comentario);
    await _db.SaveChangesAsync();
    
    return Ok(comentario); // {"contenido": "&lt;script&gt;...&lt;/script&gt;"}
}
```

```typescript
// Frontend: no insertar HTML crudo
// ❌ VULNERABLE
document.getElementById('comment').innerHTML = userInput;

// ✓ SEGURO
document.getElementById('comment').textContent = userInput;

// ✓ SEGURO con React (escapeea por defecto)
<div>{userInput}</div>

// ⚠️ Cuidado con dangerouslySetInnerHTML
// ❌ Nunca usar con input del usuario
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✓ Sanitizar si necesitas HTML
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

## Rate Limiting

Rate limiting: limitar número de requests por usuario/IP.

```csharp
// Usando AspNetCoreRateLimit
builder.Services.AddMemoryCache();
builder.Services.AddIpRateLimiting();

// Config en appsettings.json
{
  "IpRateLimiting": {
    "EnableEndpointRateLimiting": true,
    "StackBlockedRequests": false,
    "RealIpHeader": "X-Real-IP",
    "Rules": [
      {
        "Endpoint": "*",
        "Period": "60s",
        "Limit": 100  // 100 requests por minuto
      },
      {
        "Endpoint": "*:/api/auth/login",
        "Period": "15m",
        "Limit": 5    // 5 intentos de login por 15 minutos
      }
    ]
  }
}

app.UseIpRateLimiting();

// O implementar manualmente com Redis
public class RateLimiter
{
    private readonly IDistributedCache _cache;
    
    public async Task<bool> IsAllowedAsync(string key, int maxRequests, TimeSpan window)
    {
        var current = await _cache.GetStringAsync(key);
        var count = int.TryParse(current, out var c) ? c : 0;
        
        if (count >= maxRequests)
            return false;
        
        await _cache.SetStringAsync(key, (count + 1).ToString(), 
            new DistributedCacheEntryOptions 
            { 
                AbsoluteExpirationRelativeToNow = window 
            });
        
        return true;
    }
}
```

## Autenticación y Autorización

### JWT (JSON Web Tokens)

```csharp
// Generar JWT
public string GenerarToken(Usuario usuario)
{
    var key = new SymmetricSecurityKey(
        Encoding.UTF8.GetBytes(_settings.SecretKey));
    
    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
        new Claim(ClaimTypes.Email, usuario.Email),
        new Claim("roles", string.Join(",", usuario.Roles)),
    };
    
    var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
    
    var token = new JwtSecurityToken(
        issuer: _settings.Issuer,
        audience: _settings.Audience,
        claims: claims,
        expires: DateTime.UtcNow.AddMinutes(15), // Corto plazo
        signingCredentials: credentials
    );
    
    return new JwtSecurityTokenHandler().WriteToken(token);
}

// Validar JWT
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero // Sin tolerancia de tiempo
        };
    });

// Usar en controlador
[HttpGet("perfil")]
[Authorize]  // Requiere JWT válido
public IActionResult GetPerfil()
{
    var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return Ok(new { id = userId });
}

[Authorize(Roles = "Admin")]
[HttpDelete("usuario/{id}")]
public async Task<IActionResult> EliminarUsuario(int id)
{
    // Solo admins
    await _service.EliminarAsync(id);
    return NoContent();
}
```

### Refresh Tokens

```csharp
// Token corto vive: 15 minutos
// Refresh token: 7 días

[HttpPost("refresh")]
public async Task<IActionResult> Refresh(RefreshTokenRequest request)
{
    var refreshTokenValidation = await _tokenService.ValidarRefreshTokenAsync(request.Token);
    
    if (!refreshTokenValidation.IsValid)
        return Unauthorized(new { error = "Refresh token inválido o expirado" });
    
    var usuario = await _db.Usuarios.FindAsync(refreshTokenValidation.UsuarioId);
    var newAccessToken = _tokenService.GenerarToken(usuario);
    
    // Opcionalmente: generar nuevo refresh token también
    var newRefreshToken = _tokenService.GenerarRefreshToken();
    usuario.RefreshToken = newRefreshToken;
    await _db.SaveChangesAsync();
    
    return Ok(new { 
        accessToken = newAccessToken,
        refreshToken = newRefreshToken
    });
}
```

## Validación y Sanitización

```csharp
// Modelos con validación
public class CrearProductoDto
{
    [Required(ErrorMessage = "El nombre es requerido")]
    [StringLength(100, MinimumLength = 3)]
    public string Nombre { get; set; } = string.Empty;
    
    [Range(0.01, decimal.MaxValue, ErrorMessage = "El precio debe ser positivo")]
    public decimal Precio { get; set; }
    
    [EmailAddress]
    public string ContactoEmail { get; set; } = string.Empty;
}

// ASP.NET Core valida automáticamente
[HttpPost]
[ApiController]
public async Task<IActionResult> Crear([FromBody] CrearProductoDto dto)
{
    // Si hay errores, automáticamente retorna 400 con ModelState
    if (!ModelState.IsValid)
        return BadRequest(ModelState);
    
    // ... procesar ...
}

// Sanitizar HTML específicamente
public static string SanitizarHtml(string input)
{
    var encoder = System.Net.WebUtility.HtmlEncode(input);
    return encoder;
}

// Validar URLs
var uri = new Uri(input);
if (uri.Scheme != Uri.UriSchemeHttps)
    throw new ArgumentException("Solo HTTPS permitido");
```

## Headers de Seguridad

```csharp
// Agregar headers de seguridad
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Add("X-Frame-Options", "DENY"); // Prevenir clickjacking
    context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Add("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    context.Response.Headers.Add("Content-Security-Policy", "default-src 'self'");
    
    await next();
});
```

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es CORS y por qué existe?**
> CORS es un mecanismo de seguridad del navegador. Sin CORS, cualquier sitio podría hacer requests a tu API en nombre del usuario. CORS valida que el frontend tiene permiso.

**2. ¿Cuál es la diferencia entre CSRF y XSS?**
> - **CSRF**: atacante hace que EJECUTES una acción (transferir dinero)
> - **XSS**: atacante inyecta código que se ejecuta EN TU NAVEGADOR (roba cookie)

**3. ¿Cómo proteger contra SQL Injection?**
> - Usar ORM (Entity Framework) — nunca concatenar strings
> - Parámetros en queries raw (`FromSqlInterpolated`)
> - Validar/sanitizar input
> - Usar stored procedures con parámetros

**4. ¿Por qué los passwords siempre deben estar hasheados?**
> Si BD se filtra, los passwords en texto plano son riesgo inmediato. Hash (bcrypt, Argon2) es one-way: puedes validar pero no recuperar.

```csharp
// Crear: hashear password
var hashedPassword = BCrypt.Net.BCrypt.HashPassword(password);
user.PasswordHash = hashedPassword;

// Validar: comparar input con hash
bool isValid = BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
```

**5. ¿Cuándo usar JWT vs Session cookies?**
> - **JWT**: APIs stateless, microservicios, mobile
> - **Cookies**: aplicaciones monolíticas, más simple, CSRF protection built-in

**6. ¿Qué es el principio de Least Privilege?**
> Dar al usuario/app el MÍNIMO de permisos necesarios. Si un admin solo necesita leer reportes, no dale permisos de delete.

**7. ¿Cómo manejar secretos (keys, conexiones)?**
> - NUNCA en código
> - NUNCA en git
> - Usar variables de entorno, Azure Key Vault, AWS Secrets Manager
> - Rotar secretos regularmente