---
title: "🔐 OAuth 2.0, CORS, Security Headers y Scanning"
sidebar_position: 1
---

# 🔐 OAuth 2.0, CORS, Security Headers y Scanning

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
