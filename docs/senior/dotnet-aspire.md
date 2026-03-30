---
id: dotnet-aspire
title: .NET Aspire
sidebar_position: 21
---

# .NET Aspire 🔴

.NET Aspire es el stack oficial de Microsoft para desarrollar aplicaciones **cloud-native** con .NET. No es un framework nuevo — es una capa de orquestación que resuelve los problemas más dolorosos del desarrollo local con microservicios: levantar múltiples servicios, service discovery, variables de entorno, conexiones a bases de datos, y observabilidad. Disponible desde .NET 8.

---

## ¿Qué problema resuelve?

```
Sin Aspire:                         Con Aspire:
──────────────────────────────      ──────────────────────────────
docker-compose up (5 archivos)  →   dotnet run en el AppHost

Hardcodear connection strings   →   Service discovery automático
en cada proyecto                    (http://nombre-servicio)

Configurar Jaeger + Prometheus  →   Dashboard integrado con
manualmente                         trazas, métricas y logs

Variables de entorno por         →   Configuración centralizada
cada servicio                       en el AppHost

"En mi máquina funciona"         →   Misma configuración para
                                    local, CI, y producción
```

---

## Estructura de un proyecto Aspire

```
MiApp.AppHost/          ← Orquestador — define qué corre y cómo
  Program.cs
  MiApp.AppHost.csproj

MiApp.ServiceDefaults/  ← Configuración compartida (telemetría, health checks)
  Extensions.cs
  MiApp.ServiceDefaults.csproj

MiApp.ApiService/       ← Tu API (ASP.NET Core normal)
  Program.cs

MiApp.Worker/           ← Tu worker (Background Service normal)
  Program.cs

MiApp.Web/              ← Tu frontend (Blazor, React via proxy, etc.)
  Program.cs
```

---

## AppHost — el orquestador

```csharp
// MiApp.AppHost/Program.cs
var builder = DistributedApplication.CreateBuilder(args);

// 1. INFRAESTRUCTURA — bases de datos, caches, colas
var redis = builder.AddRedis("cache")
    .WithRedisCommander();   // UI de Redis en desarrollo

var postgres = builder.AddPostgres("db")
    .WithPgAdmin()           // pgAdmin en desarrollo
    .AddDatabase("appdb");   // crea la base de datos "appdb"

var rabbit = builder.AddRabbitMQ("messaging")
    .WithManagementPlugin();  // RabbitMQ Management UI

// 2. SERVICIOS — tus proyectos
var apiService = builder.AddProject<Projects.MiApp_ApiService>("api")
    .WithReference(redis)         // inyecta la connection string de Redis
    .WithReference(postgres)      // inyecta la connection string de Postgres
    .WithReference(rabbit)        // inyecta la connection string de RabbitMQ
    .WithHttpHealthCheck("/health");

var worker = builder.AddProject<Projects.MiApp_Worker>("worker")
    .WithReference(postgres)
    .WithReference(rabbit);

// 3. FRONTEND
builder.AddProject<Projects.MiApp_Web>("webfrontend")
    .WithReference(apiService)    // webfrontend puede hablar con api
    .WithExternalHttpEndpoints(); // expuesto fuera de la red Aspire

builder.Build().Run();
```

:::tip Qué hace WithReference
`WithReference` inyecta automáticamente las connection strings y URLs como variables de entorno con el nombre correcto. No hardcodeás nada — Aspire genera `ConnectionStrings__cache`, `services__api__http__0`, etc.
:::

---

## ServiceDefaults — configuración compartida

```csharp
// MiApp.ServiceDefaults/Extensions.cs
// Este archivo se genera automáticamente — no modificar salvo que necesitás personalizar

public static class Extensions
{
    public static IHostApplicationBuilder AddServiceDefaults(
        this IHostApplicationBuilder builder)
    {
        // OpenTelemetry — trazas, métricas y logs unificados
        builder.ConfigureOpenTelemetry();

        // Health checks estándar
        builder.AddDefaultHealthChecks();

        // Service discovery — permite resolver "http://api" a la URL real
        builder.Services.AddServiceDiscovery();
        builder.Services.ConfigureHttpClientDefaults(http =>
        {
            http.AddStandardResilienceHandler();  // retry + circuit breaker automático
            http.AddServiceDiscovery();
        });

        return builder;
    }

    public static WebApplication MapDefaultEndpoints(this WebApplication app)
    {
        // /health — usado por Aspire para saber si el servicio está listo
        // /alive  — liveness
        app.MapHealthChecks("/health");
        app.MapHealthChecks("/alive", new() { Predicate = r => r.Tags.Contains("live") });

        return app;
    }
}
```

```csharp
// En cada servicio — una sola línea activa todo
// MiApp.ApiService/Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();  // ← OpenTelemetry + health checks + service discovery

// Tu configuración normal...
builder.Services.AddControllers();

var app = builder.Build();

app.MapDefaultEndpoints(); // ← /health y /alive
app.MapControllers();
app.Run();
```

---

## Service Discovery — comunicación entre servicios

Aspire inyecta las URLs de los servicios automáticamente. No hay hardcoding de puertos ni IPs.

```csharp
// En el ApiService, llamar al Worker o a otro servicio:
builder.Services.AddHttpClient<CatalogoClient>(client =>
{
    // "http://catalogo" → Aspire resuelve automáticamente a la URL real
    client.BaseAddress = new Uri("http://catalogo");
});

// En producción (Azure Container Apps) funciona igual —
// Aspire configura el service discovery en el entorno de destino
```

---

## Componentes — integración con infraestructura

Aspire tiene paquetes listos para las tecnologías más comunes. Cada uno:
- Registra el cliente correctamente en DI
- Agrega health checks automáticos
- Configura OpenTelemetry para tracing
- Lee la connection string desde la configuración de Aspire

```xml
<!-- En el proyecto que necesita Redis -->
<PackageReference Include="Aspire.StackExchange.Redis" Version="8.2.0" />

<!-- Para Postgres con EF Core -->
<PackageReference Include="Aspire.Npgsql.EntityFrameworkCore.PostgreSQL" Version="8.2.0" />

<!-- Para SQL Server con EF Core -->
<PackageReference Include="Aspire.Microsoft.EntityFrameworkCore.SqlServer" Version="8.2.0" />

<!-- Para Azure Service Bus -->
<PackageReference Include="Aspire.Azure.Messaging.ServiceBus" Version="8.2.0" />

<!-- Para Azure Blob Storage -->
<PackageReference Include="Aspire.Azure.Storage.Blobs" Version="8.2.0" />
```

```csharp
// ApiService/Program.cs — usar los componentes Aspire
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

// Redis — registra IConnectionMultiplexer + IDistributedCache + health check
builder.AddRedisDistributedCache("cache");  // "cache" = nombre en el AppHost

// EF Core con Postgres — registra DbContext + health check + retry automático
builder.AddNpgsqlDbContext<AppDbContext>("appdb");  // "appdb" = nombre en el AppHost

// Azure Service Bus
builder.AddAzureServiceBusClient("messaging");
```

---

## Dashboard — observabilidad local

Al correr el AppHost, Aspire levanta un **dashboard** en `http://localhost:15888` con:

```
┌─────────────────────────────────────────────────────┐
│  .NET Aspire Dashboard                              │
├─────────────────────────────────────────────────────┤
│  Resources                                          │
│  ├── api          ● Running  → http://localhost:5001│
│  ├── worker       ● Running                         │
│  ├── webfrontend  ● Running  → http://localhost:3000│
│  ├── cache        ● Running  → Redis                │
│  └── db           ● Running  → Postgres             │
├─────────────────────────────────────────────────────┤
│  Structured Logs  │  Traces  │  Metrics             │
│                   │          │                      │
│  Todos los logs   │  Trazas  │  CPU, memoria,       │
│  de todos los     │  distrib.│  request rate,       │
│  servicios en     │  end-to- │  error rate          │
│  un solo lugar    │  end     │                      │
└─────────────────────────────────────────────────────┘
```

Sin configuración extra, tenés:
- Logs estructurados de todos los servicios en un solo lugar
- Trazas distribuidas end-to-end (request que pasa por 3 servicios)
- Métricas de runtime (.NET y HTTP)
- Estado y variables de entorno de cada recurso

---

## Persistencia de datos en desarrollo

Por defecto, los contenedores de Aspire son **efímeros** — los datos se pierden al reiniciar. Para persistir:

```csharp
// AppHost/Program.cs
var postgres = builder.AddPostgres("db")
    .WithDataVolume("mi-app-postgres-data")  // volumen Docker nombrado
    .AddDatabase("appdb");

var redis = builder.AddRedis("cache")
    .WithDataVolume("mi-app-redis-data");
```

---

## Ejecutar comandos en contenedores (migraciones)

```csharp
// AppHost/Program.cs — ejecutar migraciones de EF Core automáticamente
var postgres = builder.AddPostgres("db").AddDatabase("appdb");

// Proyecto de migraciones que corre antes del api
builder.AddProject<Projects.MiApp_Migrations>("migrations")
    .WithReference(postgres)
    .WaitFor(postgres);   // esperar que Postgres esté listo

// La API espera a que las migraciones terminen
var api = builder.AddProject<Projects.MiApp_ApiService>("api")
    .WithReference(postgres)
    .WaitForCompletion("migrations");  // esperar que termine el job
```

```csharp
// MiApp.Migrations/Program.cs — proyecto de migración simple
var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();
builder.AddNpgsqlDbContext<AppDbContext>("appdb");

var host = builder.Build();

using var scope = host.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

await db.Database.MigrateAsync();

Console.WriteLine("Migraciones aplicadas correctamente.");
// Al terminar el proceso, WaitForCompletion lo detecta
```

---

## Deploy a Azure Container Apps

Aspire tiene integración directa con Azure Developer CLI (`azd`):

```bash
# 1. Instalar Azure Developer CLI
winget install microsoft.azd

# 2. Inicializar el proyecto para Azure
azd init

# 3. Provisionar infraestructura y desplegar
azd up
# Esto:
# - Crea Azure Container Apps Environment
# - Crea Azure Container Registry
# - Conteneriza cada servicio
# - Despliega y configura service discovery en la nube
# - Configura Azure Monitor / Application Insights automáticamente

# 4. Updates posteriores
azd deploy
```

El mismo AppHost que usás localmente define lo que se despliega en Azure — un único source of truth.

---

## Aspire vs Docker Compose

| | .NET Aspire | Docker Compose |
|---|---|---|
| Lenguaje de config | C# tipado | YAML |
| Service discovery | Automático | Manual (nombres de servicio) |
| Observabilidad | Dashboard integrado | Manual (stack ELK/Grafana) |
| Health checks | Integrados | Manual |
| Deploy a cloud | `azd up` (Azure) | Requiere CI/CD custom |
| Refactoring | Rename en IDE | Buscar/reemplazar en YAML |
| Curva de aprendizaje | Baja (es C#) | Media |
| Multicloud | Solo Azure nativo | Cualquier cloud |
| **Ideal para** | Apps .NET con Azure | Stacks heterogéneos, multicloud |

:::tip Cuándo elegir qué
Aspire si tu stack es .NET + Azure. Docker Compose si tenés servicios en múltiples lenguajes o necesitás portabilidad entre clouds. No son excluyentes — Aspire puede usar imágenes Docker directamente.
:::

---

## Integrar un servicio externo (imagen Docker)

```csharp
// AppHost/Program.cs — agregar servicios que no son proyectos .NET
var builder = DistributedApplication.CreateBuilder(args);

// Imagen Docker directa
var jaeger = builder.AddContainer("jaeger", "jaegertracing/all-in-one")
    .WithHttpEndpoint(port: 16686, targetPort: 16686, name: "ui")
    .WithEndpoint(port: 4317, targetPort: 4317, name: "otlp");

// Keycloak para auth
var keycloak = builder.AddContainer("keycloak", "quay.io/keycloak/keycloak", "24.0")
    .WithArgs("start-dev")
    .WithHttpEndpoint(port: 8080, targetPort: 8080)
    .WithEnvironment("KEYCLOAK_ADMIN", "admin")
    .WithEnvironment("KEYCLOAK_ADMIN_PASSWORD", "admin");

var api = builder.AddProject<Projects.MiApp_ApiService>("api")
    .WithReference(jaeger.GetEndpoint("otlp"))
    .WithReference(keycloak.GetEndpoint("http"));
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es .NET Aspire y qué problema resuelve?**
> Aspire es un stack de Microsoft para desarrollar aplicaciones cloud-native con .NET. Resuelve el problema de la complejidad de desarrollo local con microservicios: en lugar de mantener docker-compose, scripts de setup, configuración manual de connection strings y herramientas de observabilidad separadas, Aspire los unifica en un AppHost escrito en C#. Al correr el AppHost, levanta todos los servicios, inyecta las configuraciones automáticamente, y provee un dashboard con logs, trazas y métricas de todos los servicios en un solo lugar.

**2. ¿Qué es el AppHost y qué es ServiceDefaults?**
> El AppHost es el proyecto orquestador — define qué servicios corren, qué infraestructura necesitan (Redis, Postgres), y cómo se relacionan entre sí. Es el único lugar con conocimiento de la topología. ServiceDefaults es un proyecto de librería compartida que configura automáticamente OpenTelemetry, health checks y service discovery en cada servicio — con `AddServiceDefaults()` en una línea se activa todo.

**3. ¿Cómo funciona el service discovery en Aspire?**
> Aspire inyecta las URLs de los servicios como variables de entorno (`services__nombre__http__0`). El cliente de service discovery las resuelve cuando hacés `new Uri("http://nombre-servicio")`. En desarrollo apunta a `localhost:puerto-aleatorio`. En producción con Azure Container Apps, Aspire configura el mismo mecanismo de discovery del entorno. El código del servicio nunca hardcodea URLs ni puertos.

**4. ¿Qué ventaja tiene configurar Aspire en C# en lugar de YAML?**
> Al ser C# tipado, el compilador valida la configuración, tenés autocompletado e IntelliSense, podés usar lógica condicional (`if (builder.Environment.IsDevelopment())`), y los renames en el IDE actualizan todo el proyecto. Con YAML, un typo en el nombre de un servicio es un error silencioso que aparece en runtime.

**5. ¿Aspire reemplaza Kubernetes?**
> No — son para niveles diferentes. Aspire es para el ciclo de desarrollo local y opcionalmente para deploy a Azure Container Apps. Kubernetes es el orquestador de producción para escenarios complejos con múltiples réplicas, rolling updates, HPA, etc. La integración típica es: Aspire para dev local + Azure Container Apps para producción (Aspire genera la infraestructura via `azd up`). Si necesitás K8s específicamente, Aspire puede generar los manifiestos con `azd` también.
