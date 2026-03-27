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

---

## Deep-Dive: Implementación de OAuth 2.0 segura en ASP.NET Core

```csharp
// Modelo para guardar refresh tokens en BD
public class RefreshToken : BaseEntity
{
    public int UsuarioId { get; set; }
    public string Token { get; set; } = null!;
    public DateTime FechaExpiracion { get; set; }
    public bool Revocado { get; set; }
    public bool Usado { get; set; }  // Token reuse detection
    public string? TokenReemplazo { get; set; }  // Refresh Token Rotation
    public string? IpOrigen { get; set; }
    public string? UserAgent { get; set; }
}

// Servicio robusto de tokens
public interface ITokenService
{
    string GenerarAccessToken(Usuario usuario);
    string GenerarRefreshToken();
    ClaimsPrincipal ValidarToken(string token, bool esRefreshToken = false);
}

public class TokenService : ITokenService
{
    private readonly IConfiguration _config;
    private readonly ILogger<TokenService> _logger;

    public TokenService(IConfiguration config, ILogger<TokenService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public string GenerarAccessToken(Usuario usuario)
    {
        var secretKey = _config["Jwt:SecretKey"]!;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, usuario.Id.ToString()),
            new Claim(ClaimTypes.Email, usuario.Email),
            new Claim("roles", string.Join(",", usuario.Roles)),
            new Claim("iat", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(15),  // Access token: 15 minutos
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string GenerarRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(bytes);
    }

    public ClaimsPrincipal ValidarToken(string token, bool esRefreshToken = false)
    {
        var secretKey = _config["Jwt:SecretKey"]!;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));

        try
        {
            var principal = new JwtSecurityTokenHandler().ValidateToken(token,
                new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = true,
                    ValidIssuer = _config["Jwt:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = _config["Jwt:Audience"],
                    ValidateLifetime = !esRefreshToken,  // Refresh tokens pueden estar "expirados"
                    ClockSkew = TimeSpan.Zero
                }, out SecurityToken validatedToken);

            return principal;
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"Token validation failed: {ex.Message}");
            throw new UnauthorizedException("Token inválido o expirado");
        }
    }
}

// Servicio de autenticación con OAuth
public interface IAuthService
{
    Task<LoginResponseDto> LoginAsync(string email, string password, string ipOrigen, string userAgent);
    Task<LoginResponseDto> RefreshTokenAsync(string refreshToken, string ipOrigen, string userAgent);
    Task RevocarTokenAsync(string refreshToken);
    Task LogoutAsync(int usuarioId);
}

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly ITokenService _tokenService;
    private readonly IHashingService _hashingService;
    private readonly ILogger<AuthService> _logger;

    public async Task<LoginResponseDto> LoginAsync(
        string email, string password, string ipOrigen, string userAgent)
    {
        var usuario = await _db.Usuarios.FirstOrDefaultAsync(u => u.Email == email)
            ?? throw new UnauthorizedException("Credenciales inválidas");

        if (!_hashingService.Verificar(password, usuario.PasswordHash))
            throw new UnauthorizedException("Credenciales inválidas");

        var accessToken = _tokenService.GenerarAccessToken(usuario);
        var refreshToken = _tokenService.GenerarRefreshToken();

        // Guardar refresh token con context info
        var tokenEntity = new RefreshToken
        {
            UsuarioId = usuario.Id,
            Token = refreshToken,
            FechaExpiracion = DateTime.UtcNow.AddDays(30),
            IpOrigen = ipOrigen,
            UserAgent = userAgent,
        };

        _db.RefreshTokens.Add(tokenEntity);
        await _db.SaveChangesAsync();

        _logger.LogInformation($"Usuario {usuario.Email} logueado desde {ipOrigen}");

        return new LoginResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = 900  // 15 minutos en segundos
        };
    }

    public async Task<LoginResponseDto> RefreshTokenAsync(
        string refreshToken, string ipOrigen, string userAgent)
    {
        var tokenGuardado = await _db.RefreshTokens
            .Include(rt => rt.Usuario)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken)
            ?? throw new UnauthorizedException("Refresh token no encontrado");

        // Validaciones de seguridad
        if (tokenGuardado.Revocado)
        {
            _logger.LogWarning($"Reuse detection: Refresh token revocado fue usado. Usuario ID: {tokenGuardado.UsuarioId}");
            // Token reuse attack → revocar todos los tokens de este usuario
            await RevocarTodosLosTokenesDelUsuarioAsync(tokenGuardado.UsuarioId);
            throw new UnauthorizedException("Refresh token revocado");
        }

        if (tokenGuardado.Usado)
            throw new UnauthorizedException("Refresh token ya fue usado");

        if (tokenGuardado.FechaExpiracion < DateTime.UtcNow)
            throw new UnauthorizedException("Refresh token expirado");

        // Verificar cambios de contexto (IP, User-Agent)
        if (tokenGuardado.IpOrigen != ipOrigen || tokenGuardado.UserAgent != userAgent)
        {
            _logger.LogWarning($"Context mismatch for user {tokenGuardado.UsuarioId}");
            // Podrías requerir re-autenticación aquí
        }

        // Generar nuevos tokens (Refresh Token Rotation)
        var nuevoAccessToken = _tokenService.GenerarAccessToken(tokenGuardado.Usuario);
        var nuevoRefreshToken = _tokenService.GenerarRefreshToken();

        // Marcar antiguo como "usado" y guardar reemplazo
        tokenGuardado.Usado = true;
        tokenGuardado.TokenReemplazo = nuevoRefreshToken;

        var nuevoTokenEntity = new RefreshToken
        {
            UsuarioId = tokenGuardado.UsuarioId,
            Token = nuevoRefreshToken,
            FechaExpiracion = DateTime.UtcNow.AddDays(30),
            IpOrigen = ipOrigen,
            UserAgent = userAgent,
        };

        _db.RefreshTokens.Add(nuevoTokenEntity);
        await _db.SaveChangesAsync();

        _logger.LogInformation($"Token refrescado para usuario {tokenGuardado.Usuario.Email}");

        return new LoginResponseDto
        {
            AccessToken = nuevoAccessToken,
            RefreshToken = nuevoRefreshToken,
            ExpiresIn = 900
        };
    }

    public async Task RevocarTokenAsync(string refreshToken)
    {
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(rt => rt.Token == refreshToken);
        if (token != null)
        {
            token.Revocado = true;
            await _db.SaveChangesAsync();
            _logger.LogInformation($"Refresh token revocado para usuario {token.UsuarioId}");
        }
    }

    public async Task LogoutAsync(int usuarioId)
    {
        // Revocar todos los refresh tokens del usuario
        var tokens = _db.RefreshTokens.Where(rt => rt.UsuarioId == usuarioId && !rt.Revocado);
        foreach (var token in tokens)
        {
            token.Revocado = true;
        }
        await _db.SaveChangesAsync();
        _logger.LogInformation($"Usuario {usuarioId} deslogueado — todos los tokens revocados");
    }

    private async Task RevocarTodosLosTokenesDelUsuarioAsync(int usuarioId)
    {
        var tokens = _db.RefreshTokens.Where(rt => rt.UsuarioId == usuarioId && !rt.Revocado);
        foreach (var token in tokens)
        {
            token.Revocado = true;
        }
        await _db.SaveChangesAsync();
    }
}
```

---

## Política de Token en React + .NET

```tsx
// React hook para OAuth flow
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay token en cookie HttpOnly (no podemos leerlo desde JS)
    // El servidor puede setear la cookie httpOnly en el login
    restaurarSesion();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // ← Enviar cookies HttpOnly
    });

    if (!response.ok) throw new Error('Login fallido');
    
    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
  };

  // Interceptor para detectar 401 y refrescar token
  const apiCall = async (url: string, opciones: RequestInit = {}) => {
    let response = await fetch(url, {
      ...opciones,
      headers: {
        ...opciones.headers,
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      credentials: 'include',  // Para refresh token en cookie
    });

    if (response.status === 401) {
      // Token expirado — intentar refrescar
      const refrescado = await refrescarToken();
      if (!refrescado) {
        logout();
        return null;
      }

      // Reintentar la request original con nuevo token
      response = await fetch(url, {
        ...opciones,
        headers: {
          ...opciones.headers,
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        credentials: 'include',
      });
    }

    return response;
  };

  const refrescarToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',  // Enviar refresh token cookie
      });

      if (!response.ok) {
        logout();
        return false;
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    } catch (error) {
      logout();
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setUser(null);
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  };

  return { user, loading, login, logout, apiCall };
}
```

---

## Seguridad en OAuth: Checklist

```
✅ SIEMPRE
- [ ] Usar HTTPS (no HTTP)
- [ ] Enviar client_secret solo en backend, nunca en frontend
- [ ] Validar el state parameter en el callback
- [ ] Usar PKCE si es una SPA
- [ ] Validar la firma del JWT
- [ ] Usar HttpOnly cookies para refresh tokens
- [ ] Implementar Refresh Token Rotation
- [ ] Validar que el token no esté revocado
- [ ] Rate limit en endpoints de login
- [ ] Log todas las acciones de auth (succeso, fallos, revocaciones)

❌ NUNCA
- [ ] Guardar credenciales en localStorage o sessionStorage
- [ ] Confiar en un token sin validar su firma
- [ ] Usar "aud" vacío o ignorarlo
- [ ] Permitir refresh tokens sin expiración
- [ ] Reutilizar refresh tokens (hacer rotation)
- [ ] Guardar access tokens en localStorage (XSS risk)
- [ ] Hardcodear secrets en el código
```

---

## Preguntas frecuentes de entrevista expandidas 🎯

**4. ¿Cómo implementarías Refresh Token Rotation para detectar ataques?**
> Cada vez que se usa un refresh token, marcarlo como "usado" y generar uno nuevo. Si alguien intenta usar un token que ya fue usado, es potencial ataque (token stolen). Revocar inmediatamente todos los tokens del usuario y forzar login nuevamente.

**5. ¿Por qué guardar refresh tokens en BD en lugar de solo en el JWT?**
> Porque necesitas poder revocarlos. Si pusiera todo en el JWT no firmado, no podrías revocar un token antes de que expire. Con BD, puedes marcarlo como revocado → próximo refresh fallará.

**6. ¿Cómo manejarías un atacante que stolen mi refresh token?**
> 1. Detectar: Si el refresh token viene desde IP/User-Agent diferente, es sospechoso. 2. Actuar: Revocar el token. 3. Escalable: Si el token robado es usado, revocar TODOS los tokens del usuario y forzar login. 4. Auditar: Logguear intentos sospechosos.

**7. ¿OAuth o mTLS (mutual TLS) para machine-to-machine?**
> Para APIs entre servicios (machine-to-machine): **mTLS** (certificados de cliente) es más simple. Para aplicaciones SPA/mobile: **OAuth 2.0 con PKCE**. Para integraciones públicas: **OAuth 2.0 con client_secret**.
