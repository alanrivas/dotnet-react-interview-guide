---
id: autenticacion-oauth
title: Autenticación & OAuth 2.0
sidebar_position: 11
---

# Autenticación & OAuth 2.0 🟡

## Autenticación vs Autorización (repaso)

```
Autenticación → ¿Quién eres? (identidad)
Autorización  → ¿Qué puedes hacer? (permisos)

Ejemplo: Un empleado (autenticado) no puede acceder a nómina (no autorizado)
```

---

## Flujos de autenticación

### Session-based (tradicional)

```
1. Usuario hace login con email/password
2. Servidor verifica credenciales
3. Servidor crea una sesión (server-side) y devuelve Session ID en cookie
4. En cada request, el navegador envía la cookie
5. Servidor valida el Session ID en la BD/cache

Ventaja: Fácil de invalidar (borrar sesión del servidor)
Desventaja: Stateful — no escala bien horizontalmente sin sticky sessions o Redis
```

### JWT-based (stateless)

```
1. Usuario hace login
2. Servidor genera un JWT firmado (sin guardar nada)
3. Cliente almacena el JWT y lo envía en cada request
4. Servidor verifica la firma del JWT — sin consultar BD

Ventaja: Stateless — escala horizontalmente sin problemas
Desventaja: No se puede invalidar antes de que expire (necesitas blacklist)
```

---

## OAuth 2.0 — Conceptos clave

OAuth 2.0 es un protocolo de **autorización delegada**: permite que una app acceda a recursos en nombre del usuario sin que el usuario comparta sus credenciales.

### Roles en OAuth

```
Resource Owner  → el usuario (quien posee los datos)
Client          → la aplicación que quiere acceder a los datos
Authorization Server → quien emite tokens (Google, Microsoft, GitHub)
Resource Server → donde están los datos protegidos (Google API, etc.)
```

### Authorization Code Flow (el más seguro para web apps)

```
1. App redirige al usuario al Authorization Server
   GET /authorize?
     response_type=code
     &client_id=mi-app
     &redirect_uri=https://mi-app.com/callback
     &scope=openid email profile
     &state=xyz123  ← CSRF protection

2. Usuario se autentica y aprueba los permisos

3. Authorization Server redirige de vuelta con un código
   https://mi-app.com/callback?code=AUTH_CODE&state=xyz123

4. Backend intercambia el código por tokens (server-side, seguro)
   POST /token
   grant_type=authorization_code
   &code=AUTH_CODE
   &redirect_uri=https://mi-app.com/callback
   &client_id=mi-app
   &client_secret=SECRET

5. Authorization Server retorna:
   {
     "access_token": "...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "...",
     "id_token": "..."  // OpenID Connect
   }
```

### PKCE (Proof Key for Code Exchange)

Para SPAs y apps móviles (sin client_secret):

```
1. App genera un code_verifier (random string)
2. App genera code_challenge = SHA256(code_verifier) en base64
3. En el authorization request: &code_challenge=HASH&code_challenge_method=S256
4. En el token request: code_verifier=ORIGINAL (en vez de client_secret)
5. El Authorization Server verifica que SHA256(verifier) == challenge
```

---

## OpenID Connect (OIDC)

OIDC es una capa de **identidad** sobre OAuth 2.0. Mientras OAuth solo da autorización, OIDC agrega autenticación.

```json
// ID Token (JWT) con claims del usuario
{
  "iss": "https://accounts.google.com",      // issuer
  "sub": "110169484474386276334",            // subject (user ID)
  "aud": "mi-app-client-id",                // audience
  "exp": 1735603200,                         // expiration
  "iat": 1735599600,                         // issued at
  "email": "usuario@gmail.com",
  "name": "Juan Pérez",
  "picture": "https://...",
  "email_verified": true
}
```

### Scopes OIDC estándar

| Scope | Claims incluidos |
|-------|-----------------|
| `openid` | `sub` (obligatorio en OIDC) |
| `profile` | `name`, `family_name`, `picture`, `locale` |
| `email` | `email`, `email_verified` |
| `address` | `address` |
| `phone` | `phone_number` |

---

## Refresh Token Rotation

```csharp
// Flujo seguro con Refresh Tokens
public class AuthService
{
    public async Task<TokensDto> RefreshAsync(string refreshToken)
    {
        // 1. Validar que el refresh token existe y no está revocado
        var tokenGuardado = await _repo.ObtenerRefreshTokenAsync(refreshToken)
            ?? throw new UnauthorizedException("Refresh token inválido");

        if (tokenGuardado.Revocado)
            throw new UnauthorizedException("Refresh token revocado");

        if (tokenGuardado.FechaExpiracion < DateTime.UtcNow)
            throw new UnauthorizedException("Refresh token expirado");

        // 2. Generar nuevos tokens
        var usuario = await _repo.ObtenerUsuarioAsync(tokenGuardado.UsuarioId);
        var nuevoAccess = _jwtService.GenerarToken(usuario);
        var nuevoRefresh = GenerarRefreshToken();

        // 3. Rotation: revocar el anterior, guardar el nuevo
        tokenGuardado.Revocado = true;
        tokenGuardado.TokenReemplazo = nuevoRefresh;

        await _repo.GuardarRefreshTokenAsync(new RefreshToken
        {
            Token = nuevoRefresh,
            UsuarioId = usuario.Id,
            FechaExpiracion = DateTime.UtcNow.AddDays(30),
        });

        await _repo.GuardarAsync();

        return new TokensDto(nuevoAccess, nuevoRefresh);
    }

    private string GenerarRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }
}
```

---

## Social Login con ASP.NET Core

```csharp
// Program.cs
builder.Services.AddAuthentication()
    .AddGoogle(options =>
    {
        options.ClientId = builder.Configuration["Auth:Google:ClientId"]!;
        options.ClientSecret = builder.Configuration["Auth:Google:ClientSecret"]!;
        options.Scope.Add("email");
        options.Scope.Add("profile");
    })
    .AddMicrosoftAccount(options =>
    {
        options.ClientId = builder.Configuration["Auth:Microsoft:ClientId"]!;
        options.ClientSecret = builder.Configuration["Auth:Microsoft:ClientSecret"]!;
    });

// Controller
[HttpGet("login/google")]
public IActionResult LoginConGoogle()
{
    var properties = new AuthenticationProperties
    {
        RedirectUri = Url.Action(nameof(CallbackGoogle)),
    };
    return Challenge(properties, GoogleDefaults.AuthenticationScheme);
}

[HttpGet("callback/google")]
public async Task<IActionResult> CallbackGoogle()
{
    var resultado = await HttpContext.AuthenticateAsync(
        GoogleDefaults.AuthenticationScheme);
    
    var email = resultado.Principal?.FindFirstValue(ClaimTypes.Email)!;
    var nombre = resultado.Principal?.FindFirstValue(ClaimTypes.Name)!;
    
    // Crear/obtener usuario en nuestra BD
    var usuario = await _authService.ObtenerOCrearPorEmailAsync(email, nombre);
    var token = _jwtService.GenerarToken(usuario);
    
    return Redirect($"/auth/callback?token={token}");
}
```

---

## Preguntas frecuentes 🎯

**1. ¿Cuál es la diferencia entre OAuth y OIDC?**
> OAuth 2.0 es un framework de **autorización** (dar acceso a recursos). OpenID Connect (OIDC) es una capa de **autenticación** sobre OAuth 2.0 que agrega información sobre la identidad del usuario mediante el `id_token`.

**2. ¿Por qué no se debe guardar el access token en localStorage?**
> Porque es vulnerable a ataques XSS. Cualquier script en la página puede leer localStorage. La alternativa más segura es usar cookies HttpOnly (no accesibles desde JS) para el refresh token, y guardar el access token solo en memoria.

**3. ¿Qué es el state parameter en OAuth y para qué sirve?**
> Es un valor aleatorio que se envía en el authorization request y debe retornar igual en el callback. Sirve para prevenir ataques CSRF: verificas que el state que retornó es el mismo que enviaste.
