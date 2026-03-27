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

## OAuth 2.0 y OpenID Connect (OIDC)

### Conceptos clave

```
OAuth 2.0: protocolo de AUTORIZACIÓN
  → "Este cliente puede acceder a estos recursos en mi nombre"
  → Problema: ¿Pero quién es el usuario?

OpenID Connect (OIDC): capa de IDENTIDAD sobre OAuth 2.0
  → Agrega un ID Token (JWT con datos del usuario)
  → Responde a "¿quién eres?" además de "¿qué puedes hacer?"

Roles:
  - Resource Owner: el usuario
  - Client: la app (SPA, mobile, servidor)
  - Authorization Server: el proveedor de identidad (Entra ID, Auth0, Keycloak)
  - Resource Server: tu API
```

### Flujos OAuth 2.0

```
1. AUTHORIZATION CODE + PKCE (el correcto para SPAs y apps móviles)
   ─────────────────────────────────────────────────────────────────
   SPA genera:
     code_verifier = random_string(64)   ← guardado en memoria
     code_challenge = BASE64(SHA256(code_verifier))  ← enviado al server

   GET /authorize?
     response_type=code
     &client_id=...
     &redirect_uri=https://myapp.com/callback
     &scope=openid profile email
     &code_challenge=...
     &code_challenge_method=S256

   Usuario hace login → Authorization Server devuelve:
     GET https://myapp.com/callback?code=AUTH_CODE

   SPA intercambia code por tokens:
   POST /token
     grant_type=authorization_code
     &code=AUTH_CODE
     &code_verifier=...  ← verifica que eres quien inició el flujo

   Authorization Server devuelve:
     { access_token, id_token, refresh_token, expires_in }

2. CLIENT CREDENTIALS (para comunicación server-to-server, sin usuario)
   ────────────────────────────────────────────────────────────────────
   POST /token
     grant_type=client_credentials
     &client_id=service-a
     &client_secret=...
     &scope=api://resource-server/.default

   → Ideal para microservicios que llaman a otros microservicios
```

### Implementación en ASP.NET Core (API como Resource Server)

```csharp
// La API valida tokens emitidos por el Authorization Server
// No implementa login — solo verifica

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // El Authorization Server (Entra ID / Auth0 / Keycloak)
        options.Authority = "https://login.microsoftonline.com/{tenant}/v2.0";
        options.Audience  = "api://my-api-resource-id";

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ClockSkew                = TimeSpan.FromSeconds(30),
        };

        // Eventos para logging/diagnóstico
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                _logger.LogWarning("Token inválido: {Error}", ctx.Exception.Message);
                return Task.CompletedTask;
            }
        };
    });

// Política que requiere un scope específico del token
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequiereReadProductos", policy =>
        policy.RequireClaim("scp", "productos.read"));
});

// En el endpoint:
[Authorize(Policy = "RequiereReadProductos")]
[HttpGet("productos")]
public IActionResult GetProductos() => Ok();
```

### Tokens: Access Token vs ID Token vs Refresh Token

```
ACCESS TOKEN
  → Autoriza acceso a la API (bearer token)
  → Vida corta: 15 min – 1 hora
  → La API lo valida en cada request (sin llamar al Auth Server)
  → Nunca almacenar en localStorage — usarlo en memoria
  → Contiene: sub, scope, roles, exp, aud

ID TOKEN
  → Prueba de identidad del usuario (solo para el cliente)
  → Contiene: name, email, picture, sub
  → NO enviarlo a la API — es para el cliente, no el Resource Server
  → La API usa el Access Token, nunca el ID Token

REFRESH TOKEN
  → Obtener nuevos Access Tokens sin re-login del usuario
  → Vida larga: horas, días o indefinido con rotación
  → Almacenar en cookie HttpOnly Secure SameSite=Strict
  → Usar Refresh Token Rotation: cada uso invalida el anterior
```

---

## CORS (Cross-Origin Resource Sharing)

### Qué es y por qué importa

```
Same-Origin Policy: el navegador bloquea requests de origen A a origen B.
CORS: mecanismo para que el servidor indique qué orígenes están permitidos.

Origen = protocolo + dominio + puerto:
  https://app.midominio.com  ← origen de la SPA
  https://api.midominio.com  ← origen de la API (diferente puerto/subdominio)
  → La SPA necesita CORS para llamar a la API

CORS NO protege APIs llamadas desde servidores (Postman, curl, microservicios).
CORS solo aplica a requests desde navegadores.
```

### Configuración segura en ASP.NET Core

```csharp
// ❌ NUNCA en producción
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));
// AllowAnyOrigin + credentials = error de seguridad crítico

// ✅ Allowlist explícita por ambiente
var allowedOrigins = builder.Environment.IsProduction()
    ? new[] { "https://app.midominio.com", "https://admin.midominio.com" }
    : new[] { "http://localhost:3000", "http://localhost:5173" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy
            .WithOrigins(allowedOrigins)
            .WithMethods("GET", "POST", "PUT", "DELETE", "PATCH")
            .WithHeaders("Authorization", "Content-Type", "X-Request-ID")
            .AllowCredentials()             // Solo si usas cookies
            .SetPreflightMaxAge(TimeSpan.FromMinutes(10))); // Cache del preflight
});

// Orden importa: CORS antes de Auth
app.UseCors("FrontendPolicy");
app.UseAuthentication();
app.UseAuthorization();
```

### Preflight request (OPTIONS)

```
Cuando el navegador hace un request "no simple" (con Authorization header,
Content-Type: application/json, métodos PUT/DELETE), primero envía:

OPTIONS /api/productos HTTP/1.1
Origin: https://app.midominio.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization, content-type

Tu servidor debe responder:
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.midominio.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 600

Si el servidor no responde correctamente el preflight → el navegador
bloquea el request real. Esto es UNA FEATURE, no un bug.
```

---

## Security Headers completos

```csharp
// Middleware centralizado de security headers
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;

    // Evitar MIME-type sniffing
    headers["X-Content-Type-Options"] = "nosniff";

    // Evitar clickjacking (iframes)
    headers["X-Frame-Options"] = "DENY";

    // Forzar HTTPS por 1 año, incluir subdominios
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";

    // Content Security Policy — ajustar según la app
    headers["Content-Security-Policy"] =
        "default-src 'self'; " +
        "script-src 'self' 'nonce-{nonce}'; " +   // Solo scripts del origen + nonce
        "style-src 'self' 'unsafe-inline'; " +     // Permitir estilos inline (ajustar si posible)
        "img-src 'self' data: https:; " +
        "font-src 'self'; " +
        "connect-src 'self' https://api.midominio.com; " +
        "frame-ancestors 'none'; " +               // Nadie puede embeber tu app en un iframe
        "base-uri 'self'; " +
        "form-action 'self'";

    // Controlar información enviada en el header Referer
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    // Desactivar APIs del navegador que no necesitas
    headers["Permissions-Policy"] =
        "camera=(), microphone=(), geolocation=(), payment=()";

    // Eliminar headers que revelan tecnología
    headers.Remove("Server");
    headers.Remove("X-Powered-By");

    await next();
});
```

### Content Security Policy (CSP) — diagnóstico

```
Para implementar CSP sin romper la app:

1. Empezar en modo reporte:
   Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report
   → No bloquea nada, solo reporta violaciones

2. Revisar los reportes (POST a /csp-report con el JSON de la violación)

3. Ajustar la política para permitir lo legítimo

4. Cambiar a Content-Security-Policy (modo enforce)
```

---

## Dependency Vulnerability Scanning

### dotnet list package --vulnerable

```bash
# Listar paquetes con vulnerabilidades conocidas
dotnet list package --vulnerable

# Output ejemplo:
# Project `MiApp.API` has the following vulnerable packages
#    [net8.0]:
#    Top-level Package        Requested   Resolved   Severity   Advisory URL
#    > Newtonsoft.Json        12.0.1      12.0.1     High       https://github.com/advisories/GHSA-...

# Incluir paquetes transitivos (dependencias de dependencias)
dotnet list package --vulnerable --include-transitive
```

### GitHub Dependabot + Actions

```yaml
# .github/dependabot.yml — actualización automática de paquetes
version: 2
updates:
  - package-ecosystem: nuget
    directory: "/"
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
      - "security"

# .github/workflows/security.yml — escaneo en cada PR
name: Security Scan
on: [pull_request]

jobs:
  vulnerability-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.x'
      - name: Restore dependencies
        run: dotnet restore
      - name: Check for vulnerabilities
        run: |
          dotnet list package --vulnerable --include-transitive 2>&1 | tee vuln-report.txt
          if grep -q "High\|Critical" vuln-report.txt; then
            echo "❌ Vulnerabilidades críticas encontradas"
            cat vuln-report.txt
            exit 1
          fi
```

### OWASP Dependency-Check (más completo)

```yaml
# En GitHub Actions
- name: OWASP Dependency Check
  uses: dependency-check/Dependency-Check_Action@main
  with:
    project: 'MiApp'
    path: '.'
    format: 'HTML'
    args: >
      --failOnCVSS 7
      --enableRetired
      --scan **/*.csproj
- name: Upload report
  uses: actions/upload-artifact@v4
  with:
    name: dependency-check-report
    path: reports/
```

---

## Preguntas adicionales de entrevista 🎯

**5. ¿Cuál es la diferencia entre OAuth 2.0 y OpenID Connect?**
> **OAuth 2.0** es un protocolo de *autorización*: delega acceso a recursos sin compartir credenciales. No define cómo obtener datos del usuario. **OpenID Connect** es una capa de *identidad* sobre OAuth 2.0: añade el ID Token (JWT con datos del usuario como nombre, email) y el endpoint `/userinfo`. Si solo necesitas autorización usa OAuth 2.0; si necesitas saber quién es el usuario, usa OIDC.

**6. ¿Qué es PKCE y por qué es necesario para SPAs?**
> **Proof Key for Code Exchange**: protege el Authorization Code Flow cuando el cliente no puede mantener un `client_secret` en secreto (SPAs, apps móviles). El cliente genera un `code_verifier` aleatorio, lo hashea a `code_challenge` y lo envía al inicio. Al intercambiar el code por tokens, envía el `code_verifier` original. El Auth Server verifica que `SHA256(code_verifier) == code_challenge` guardado. Si alguien intercepta el `code`, no puede canjearlo sin el `code_verifier` original.

**7. ¿Qué es un Content Security Policy y para qué sirve?**
> Es un header HTTP que le dice al navegador qué recursos puede cargar y desde dónde. Principal defensa contra XSS: aunque un atacante inyecte un `<script>`, el navegador no lo ejecuta si el CSP no permite scripts de ese origen. Se implementa gradualmente: primero en modo `Report-Only` para detectar violaciones sin romper la app, luego en modo enforce.

**8. ¿Cómo harías un pen test básico de tu propia API?**
> 1. **OWASP ZAP** o **Burp Suite Community** para escaneo automático de vulnerabilidades comunes. 2. Probar BOLA manualmente: acceder a recursos de otros usuarios cambiando IDs. 3. Verificar security headers con `securityheaders.com`. 4. Revisar el JWT en `jwt.io`: ¿algoritmo `none`? ¿Claims sensibles? ¿Expiración razonable? 5. `dotnet list package --vulnerable` para dependencias. 6. Revisar logs de CORS para orígenes bloqueados inesperadamente.
