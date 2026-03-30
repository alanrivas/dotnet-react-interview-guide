---
id: api-gateway
title: API Gateway — YARP y Azure APIM
sidebar_position: 15
---

# API Gateway — YARP y Azure APIM 🔴

Un API Gateway es el punto de entrada único para los clientes en una arquitectura de microservicios. En entrevistas Senior te van a preguntar qué responsabilidades tiene, cuándo usar cada herramienta (YARP, Azure APIM, Ocelot, NGINX) y cómo implementar el patrón BFF.

---

## ¿Qué hace un API Gateway?

```
                          ┌─────────────────────────────────────┐
                          │          API GATEWAY                │
                          │                                     │
Client ──► HTTPS ────────►│  ✓ SSL Termination                  │──► Servicio A
                          │  ✓ Autenticación / JWT validation   │──► Servicio B
Mobile ──► HTTPS ────────►│  ✓ Autorización                     │──► Servicio C
                          │  ✓ Rate Limiting                    │
3rd-party ► HTTPS ───────►│  ✓ Routing / Load Balancing         │
                          │  ✓ Logging centralizado             │
                          │  ✓ Transformación de requests       │
                          │  ✓ Caché de respuestas              │
                          │  ✓ Circuit Breaking                 │
                          └─────────────────────────────────────┘
```

**Sin API Gateway** cada microservicio debe implementar auth, rate limiting, logging, etc. — duplicación y acoplamiento a los clientes.

**Con API Gateway** los servicios internos se liberan de esas responsabilidades y el cliente habla con un único endpoint.

---

## Comparativa de opciones

| | YARP | Azure APIM | Ocelot | NGINX |
|---|---|---|---|---|
| Tipo | Librería .NET | SaaS managed | Librería .NET | Servidor dedicado |
| Lenguaje config | C# / JSON | Policies XML/JSON | JSON | nginx.conf |
| Mantenimiento | Microsoft | Microsoft | Comunidad | F5/NGINX |
| Escalabilidad | Horizontal con K8s | Automática | Manual | Manual |
| Costo | Gratis | $$ (por llamada) | Gratis | Gratis / Plus $$ |
| Developer Portal | No | Sí | No | No |
| Analytics integrado | No | Sí | No | Limitado |
| **Cuándo usarlo** | Proyectos .NET on-premise o K8s | Empresas cloud Azure | Legacy .NET (reemplazado por YARP) | Non-.NET, NGINX exp |

---

## YARP — Yet Another Reverse Proxy

YARP es la librería de Microsoft para construir reverse proxies en .NET. Reemplaza a Ocelot como el estándar del ecosistema .NET.

### Setup mínimo

```bash
dotnet new webapi -n ApiGateway
dotnet add package Yarp.ReverseProxy
```

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.MapReverseProxy();

app.Run();
```

```json
// appsettings.json
{
  "ReverseProxy": {
    "Routes": {
      "ruta-productos": {
        "ClusterId": "cluster-productos",
        "Match": {
          "Path": "/api/productos/{**catch-all}"
        }
      },
      "ruta-usuarios": {
        "ClusterId": "cluster-usuarios",
        "Match": {
          "Path": "/api/usuarios/{**catch-all}"
        }
      },
      "ruta-pedidos": {
        "ClusterId": "cluster-pedidos",
        "Match": {
          "Path": "/api/pedidos/{**catch-all}",
          "Headers": [
            {
              "Name": "X-Api-Version",
              "Values": ["2"],
              "Mode": "ExactHeader"
            }
          ]
        }
      }
    },
    "Clusters": {
      "cluster-productos": {
        "Destinations": {
          "destino1": { "Address": "http://productos-svc/" },
          "destino2": { "Address": "http://productos-svc-2/" }
        },
        "LoadBalancingPolicy": "RoundRobin",
        "HealthCheck": {
          "Active": {
            "Enabled": true,
            "Interval": "00:00:10",
            "Path": "/health"
          }
        }
      },
      "cluster-usuarios": {
        "Destinations": {
          "destino1": { "Address": "http://usuarios-svc/" }
        }
      },
      "cluster-pedidos": {
        "Destinations": {
          "destino1": { "Address": "http://pedidos-svc-v2/" }
        }
      }
    }
  }
}
```

---

### Autenticación JWT en el Gateway

```csharp
// Program.cs — validar JWT una sola vez en el gateway
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Auth:Authority"];
        options.Audience = builder.Configuration["Auth:Audience"];
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequiereAutenticacion", policy =>
        policy.RequireAuthenticatedUser());

    options.AddPolicy("SoloAdmin", policy =>
        policy.RequireClaim("role", "admin"));
});

builder.Services
    .AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

// El middleware de YARP aplica la política de autorización de la ruta
app.MapReverseProxy();
```

```json
// Rutas con autorización
"Routes": {
  "ruta-publica": {
    "ClusterId": "cluster-catalogo",
    "AuthorizationPolicy": "anonymous",    // Sin auth
    "Match": { "Path": "/api/catalogo/{**catch-all}" }
  },
  "ruta-autenticada": {
    "ClusterId": "cluster-pedidos",
    "AuthorizationPolicy": "RequiereAutenticacion",
    "Match": { "Path": "/api/pedidos/{**catch-all}" }
  },
  "ruta-admin": {
    "ClusterId": "cluster-admin",
    "AuthorizationPolicy": "SoloAdmin",
    "Match": { "Path": "/api/admin/{**catch-all}" }
  }
}
```

---

### Transformaciones de requests y responses

```csharp
// Transformaciones por código (más potente que JSON)
builder.Services
    .AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(context =>
    {
        // Agregar header con el userId del token al request downstream
        context.AddRequestTransform(async transformContext =>
        {
            var user = transformContext.HttpContext.User;
            if (user.Identity?.IsAuthenticated == true)
            {
                var userId = user.FindFirst("sub")?.Value;
                var email = user.FindFirst("email")?.Value;

                // Los microservicios reciben el userId listo — no validan JWT
                transformContext.ProxyRequest.Headers.Add("X-User-Id", userId);
                transformContext.ProxyRequest.Headers.Add("X-User-Email", email);

                // Correlation ID para trazabilidad
                var correlationId = transformContext.HttpContext
                    .Request.Headers["X-Correlation-Id"]
                    .FirstOrDefault() ?? Guid.NewGuid().ToString();
                transformContext.ProxyRequest.Headers.Add("X-Correlation-Id", correlationId);
            }
        });

        // Agregar headers de seguridad a todas las responses
        context.AddResponseTransform(transformContext =>
        {
            transformContext.HttpContext.Response.Headers["X-Gateway"] = "YARP/1.0";
            return ValueTask.CompletedTask;
        });
    });
```

```json
// Transformaciones en appsettings (para casos simples)
"Routes": {
  "ruta-productos": {
    "ClusterId": "cluster-productos",
    "Match": { "Path": "/api/v2/productos/{**catch-all}" },
    "Transforms": [
      // Reescribir el path — el servicio interno no conoce /v2
      { "PathPattern": "/productos/{**catch-all}" },
      // Agregar header
      { "RequestHeader": "X-Forwarded-Prefix", "Set": "/api/v2" },
      // Quitar header sensible antes de enviar downstream
      { "RequestHeaderRemove": "Authorization" }
    ]
  }
}
```

---

### Rate Limiting en YARP

```csharp
// Rate limiting integrado con el middleware nativo de .NET 8
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    options.AddFixedWindowLimiter("gateway-general", o =>
    {
        o.PermitLimit = 100;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueLimit = 0;
    });

    options.AddFixedWindowLimiter("gateway-auth", o =>
    {
        o.PermitLimit = 10;
        o.Window = TimeSpan.FromMinutes(5);
        o.QueueLimit = 0;
    });
});

var app = builder.Build();
app.UseRateLimiter();
app.MapReverseProxy();
```

```json
// Asignar política por ruta
"Routes": {
  "ruta-login": {
    "ClusterId": "cluster-auth",
    "RateLimiterPolicy": "gateway-auth",
    "Match": { "Path": "/api/auth/{**catch-all}" }
  },
  "ruta-api": {
    "ClusterId": "cluster-productos",
    "RateLimiterPolicy": "gateway-general",
    "Match": { "Path": "/api/{**catch-all}" }
  }
}
```

---

### Logging y correlación centralizada

```csharp
// Middleware personalizado en YARP para logging
builder.Services
    .AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(context =>
    {
        context.AddRequestTransform(async transformContext =>
        {
            // Generar o propagar Correlation ID
            var correlationId = transformContext.HttpContext
                .Request.Headers["X-Correlation-Id"]
                .FirstOrDefault()
                ?? Guid.NewGuid().ToString("N");

            transformContext.HttpContext.Items["CorrelationId"] = correlationId;
            transformContext.ProxyRequest.Headers.TryAddWithoutValidation(
                "X-Correlation-Id", correlationId);
        });
    });

// Evento de proxy para loggear duración y resultado
app.MapReverseProxy(proxyPipeline =>
{
    proxyPipeline.Use(async (context, next) =>
    {
        var sw = Stopwatch.StartNew();
        await next(context);
        sw.Stop();

        var correlationId = context.Items["CorrelationId"];
        var statusCode = context.Response.StatusCode;
        var path = context.Request.Path;

        logger.LogInformation(
            "Gateway: {Method} {Path} → {StatusCode} ({Duration}ms) [{CorrelationId}]",
            context.Request.Method, path, statusCode, sw.ElapsedMilliseconds, correlationId);
    });
});
```

---

## BFF — Backend for Frontend

En vez de un único API Gateway genérico, el patrón BFF crea un backend dedicado **por tipo de cliente**. Cada BFF agrega, transforma y optimiza las respuestas para su cliente específico.

```
Sin BFF (Gateway genérico):
  Web SPA ─────────────────►│              │──► Usuarios
  App Mobile ───────────────►│ API Gateway  │──► Pedidos
  App de escritorio ────────►│              │──► Productos
  (todos reciben la misma respuesta genérica — ineficiente)

Con BFF:
  Web SPA ───────►│  BFF Web    │──► Usuarios
                  │  (React)    │──► Pedidos ──► agrega ambos
                  └─────────────┘──► Productos

  App Mobile ────►│  BFF Mobile │──► Usuarios
                  │  (iOS/And)  │──► Pedidos ──► respuesta compacta
                  └─────────────┘

  (cada BFF conoce las necesidades de su cliente)
```

```csharp
// BFF para Web — agrega datos de múltiples servicios
[ApiController]
[Route("bff/dashboard")]
[Authorize]
public class DashboardBffController : ControllerBase
{
    private readonly IUsuariosClient _usuarios;
    private readonly IPedidosClient _pedidos;
    private readonly INotificacionesClient _notificaciones;

    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var userId = User.FindFirst("sub")!.Value;

        // Paralelizar llamadas a microservicios
        var (perfil, pedidosRecientes, notifs) = await (
            _usuarios.GetPerfilAsync(userId),
            _pedidos.GetUltimosAsync(userId, limit: 5),
            _notificaciones.GetNoLeidasAsync(userId)
        ).WhenAll();

        // Respuesta optimizada para la UI web
        return Ok(new
        {
            usuario = new { perfil.Nombre, perfil.Avatar },
            pedidosRecientes = pedidosRecientes.Select(p => new
            {
                p.Id,
                p.Estado,
                p.Total,
                fechaCorta = p.FechaCreacion.ToString("dd/MM")
            }),
            notificaciones = new
            {
                cantidad = notifs.Count(),
                hayNuevas = notifs.Any(),
            }
        });
    }
}

// Helper para Task.WhenAll con deconstruct
static class TaskExtensions
{
    public static TaskAwaiter<(T1, T2, T3)> GetAwaiter<T1, T2, T3>(
        this (Task<T1>, Task<T2>, Task<T3>) tasks)
    {
        async Task<(T1, T2, T3)> Combine()
        {
            await Task.WhenAll(tasks.Item1, tasks.Item2, tasks.Item3);
            return (tasks.Item1.Result, tasks.Item2.Result, tasks.Item3.Result);
        }
        return Combine().GetAwaiter();
    }
}
```

---

## Azure API Management (APIM)

APIM es el API Gateway managed de Azure. Ideal cuando necesitás developer portal, analytics, monetización de APIs, o tenés equipos sin experiencia en .NET.

### Policies — el corazón de APIM

```xml
<!-- Policy global aplicada a todas las APIs -->
<policies>
  <inbound>
    <!-- 1. Validar JWT de Azure AD -->
    <validate-jwt header-name="Authorization" failed-validation-httpcode="401">
      <openid-config url="https://login.microsoftonline.com/{tenant}/.well-known/openid-configuration" />
      <audiences>
        <audience>api://mi-api</audience>
      </audiences>
    </validate-jwt>

    <!-- 2. Rate limiting por suscripción -->
    <rate-limit-by-key calls="100" renewal-period="60"
      counter-key="@(context.Subscription.Id)" />

    <!-- 3. Inyectar correlation ID -->
    <set-header name="X-Correlation-Id" exists-action="skip">
      <value>@(Guid.NewGuid().ToString())</value>
    </set-header>

    <!-- 4. Logging a Application Insights -->
    <log-to-eventhub logger-id="app-insights">
      @(string.Format("Method: {0}, URL: {1}", context.Request.Method, context.Request.Url))
    </log-to-eventhub>
  </inbound>

  <backend>
    <!-- Circuit breaker: si el backend falla, usar cache -->
    <retry condition="@(context.Response.StatusCode == 503)" count="3" interval="1" />
  </backend>

  <outbound>
    <!-- Cachear respuestas GET por 5 minutos -->
    <cache-store duration="300" />

    <!-- Quitar headers internos antes de enviar al cliente -->
    <set-header name="X-Powered-By" exists-action="delete" />
    <set-header name="Server" exists-action="delete" />
  </outbound>

  <on-error>
    <set-status code="500" reason="Error interno" />
    <set-body>{"error": "Ocurrió un error. TrackingId: @(context.RequestId)"}</set-body>
  </on-error>
</policies>
```

```xml
<!-- Policy específica para un endpoint: transformar respuesta -->
<outbound>
  <!-- Reemplazar URLs internas en la respuesta con la URL del gateway -->
  <find-and-replace from="http://productos-svc-internal"
                    to="https://api.miempresa.com" />

  <!-- Agregar HATEOAS links -->
  <set-body>@{
    var body = context.Response.Body.As<JObject>();
    body["links"] = new JObject {
      ["self"] = context.Request.Url.ToString(),
      ["collection"] = "https://api.miempresa.com/productos"
    };
    return body.ToString();
  }</set-body>
</outbound>
```

### Versioning en APIM

```xml
<!-- APIM maneja versiones de API de forma nativa -->
<!-- Ruta: /api/v1/productos → Backend v1 -->
<!--       /api/v2/productos → Backend v2 -->

<!-- Se configura en el portal de Azure o con Bicep/Terraform -->
```

```bicep
// Infraestructura como código — APIM con Bicep
resource apimService 'Microsoft.ApiManagement/service@2023-03-01-preview' = {
  name: 'mi-apim'
  location: resourceGroup().location
  sku: {
    name: 'Consumption'  // Pago por llamada, ideal para empezar
    capacity: 0
  }
  properties: {
    publisherEmail: 'admin@miempresa.com'
    publisherName: 'Mi Empresa'
  }
}

resource productosApi 'Microsoft.ApiManagement/service/apis@2023-03-01-preview' = {
  parent: apimService
  name: 'productos-api'
  properties: {
    displayName: 'API de Productos'
    path: 'productos'
    protocols: ['https']
    serviceUrl: 'http://productos-svc.produccion.svc.cluster.local'
    subscriptionRequired: true
  }
}
```

---

## Decisiones arquitectónicas: cuándo usar qué

```
¿Tenés un equipo .NET y querés control total?
  └─► YARP — code-first, testeable, integrado con ASP.NET Core pipeline

¿Es un proyecto cloud-first en Azure y necesitás developer portal, analytics, monetización?
  └─► Azure APIM — todo managed, sin ops

¿Tenés un monolito .NET legacy que querés migrar a microservicios gradualmente?
  └─► YARP como Strangler Fig — empezás proxeando todo al monolito
      y vas moviendo rutas al nuevo servicio

¿El equipo no es .NET o ya tienen experiencia con NGINX/Traefik?
  └─► NGINX / Traefik — no fuerces .NET si no agrega valor

¿Cada cliente (web, mobile, 3rd-party) necesita respuestas muy distintas?
  └─► BFF Pattern — un backend por tipo de cliente, cada uno con su lógica de agregación
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es un API Gateway y qué responsabilidades tiene?**
> Punto de entrada único para todos los clientes. Concentra: routing a microservicios, autenticación/autorización, rate limiting, logging centralizado, SSL termination, transformación de requests/responses, load balancing y health checks. Libera a los microservicios de implementar esas funciones cross-cutting.

**2. ¿Cuál es la diferencia entre API Gateway y Load Balancer?**
> Un Load Balancer opera a nivel L4 (TCP/UDP) — distribuye tráfico entre instancias del mismo servicio sin entender el contenido. Un API Gateway opera a nivel L7 (HTTP) — entiende el contenido, puede rutear según path/headers, transformar requests, aplicar auth, etc. En la práctica usás ambos: LB enfrente del gateway para escalar el gateway, gateway para lógica de aplicación.

**3. ¿Cuándo elegirías YARP sobre Azure APIM?**
> YARP cuando: necesitás control total del código, tenés lógica de routing compleja en C#, el proyecto es on-premise o en K8s no-Azure, o querés evitar costos variables de APIM. APIM cuando: necesitás developer portal para exponer APIs a terceros, querés analytics y monetización sin construirlo, el equipo prefiere configuración sobre código, o ya estás en el ecosistema Azure.

**4. ¿Qué es el patrón BFF y cuándo lo usarías?**
> Backend for Frontend — un backend dedicado por tipo de cliente. Lo usaría cuando los clientes tienen necesidades muy diferentes: el app mobile necesita respuestas compactas con campos distintos a los de la web, o cuando la web necesita agregar datos de varios servicios en una sola llamada. Evita que el frontend haga múltiples llamadas o que el gateway genérico sea demasiado genérico para todos.

**5. ¿Cómo propagarías la identidad del usuario desde el Gateway a los microservicios internos?**
> El Gateway valida el JWT (operación costosa, una sola vez). Luego extrae los claims relevantes (userId, roles, email) y los inyecta como headers en el request downstream (`X-User-Id`, `X-User-Roles`). Los microservicios internos confían en esos headers sin re-validar el JWT. La comunicación interna se puede asegurar con mTLS o una red privada (VNet, K8s NetworkPolicy).

**6. ¿Cuál es el riesgo principal de un API Gateway y cómo lo mitigás?**
> Es un **single point of failure** — si cae el gateway, cae todo. Mitigaciones: múltiples réplicas detrás de un Load Balancer, health checks y autoscaling, circuit breakers para backends lentos, retry policies con backoff, deployment separado con alta disponibilidad. En K8s: mínimo 3 réplicas con PodDisruptionBudget que garantice al menos 2 siempre disponibles.
