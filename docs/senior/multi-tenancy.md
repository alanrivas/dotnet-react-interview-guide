---
id: multi-tenancy
title: Multi-tenancy — SaaS Architecture
sidebar_position: 16
---

# Multi-tenancy — Arquitectura SaaS 🔴

Multi-tenancy es la capacidad de una aplicación de servir a múltiples clientes (tenants) con una sola instancia del sistema. Es el patrón central de todo producto SaaS. En entrevistas Senior es un tema muy frecuente porque combina decisiones de arquitectura, seguridad, performance y base de datos.

---

## Los 3 modelos de aislamiento

```
Modelo 1: Database per Tenant
┌─────────┐  ┌─────────┐  ┌─────────┐
│  DB-A   │  │  DB-B   │  │  DB-C   │
│ Tenant A│  │ Tenant B│  │ Tenant C│
└────┬────┘  └────┬────┘  └────┬────┘
     └───────────┬┴────────────┘
          ┌──────┴──────┐
          │   App (1)   │
          └─────────────┘

Modelo 2: Schema per Tenant
┌──────────────────────────────────┐
│           Database única          │
│  ┌──────────┐  ┌──────────┐      │
│  │schema_a  │  │schema_b  │  ... │
│  │  users   │  │  users   │      │
│  │  orders  │  │  orders  │      │
│  └──────────┘  └──────────┘      │
└──────────────────────────────────┘

Modelo 3: Row-level (Shared Schema)
┌──────────────────────────────────┐
│           Database única          │
│  ┌───────────────────────────┐   │
│  │         tabla users        │   │
│  │ tenant_id | nombre | email │   │
│  │    A      | Ana    | ...   │   │
│  │    B      | Juan   | ...   │   │
│  │    A      | Pedro  | ...   │   │
│  └───────────────────────────┘   │
└──────────────────────────────────┘
```

| | Database per Tenant | Schema per Tenant | Row-level |
|---|---|---|---|
| **Aislamiento** | Máximo | Alto | Bajo |
| **Costo infra** | Alto | Medio | Bajo |
| **Escalabilidad** | Fácil (mover BD) | Media | Muy alta |
| **Migrations** | Complejo (N DBs) | Complejo (N schemas) | Simple (1 vez) |
| **Backup/restore** | Por tenant | Por schema | Complejo |
| **Data leak risk** | Mínimo | Bajo | Bug = catástrofe |
| **Cuándo usarlo** | Regulación estricta, enterprise | Balance seguridad/costo | Startups, muchos tenants pequeños |

---

## Resolución del tenant

Identificar a qué tenant pertenece cada request es el primer problema a resolver.

```csharp
// Opciones comunes:

// 1. Subdominio: tenant-a.miapp.com
// 2. Header HTTP: X-Tenant-Id: tenant-a
// 3. Claim en JWT: { "tid": "tenant-a" }
// 4. Path: /api/tenants/tenant-a/productos
// 5. Query string: /api/productos?tenantId=tenant-a (menos seguro)

// Interfaz para el contexto del tenant
public interface ITenantContext
{
    string TenantId { get; }
    string ConnectionString { get; }
    string Schema { get; }
}

public class TenantContext : ITenantContext
{
    public string TenantId { get; init; } = string.Empty;
    public string ConnectionString { get; init; } = string.Empty;
    public string Schema { get; init; } = string.Empty;
}
```

```csharp
// Middleware que resuelve el tenant de cada request
public class TenantMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ITenantRepository _tenantRepo;

    public TenantMiddleware(RequestDelegate next, ITenantRepository tenantRepo)
    {
        _next = next;
        _tenantRepo = tenantRepo;
    }

    public async Task InvokeAsync(HttpContext context, ITenantContext tenantContext)
    {
        var tenantId = ResolveTenantId(context);

        if (string.IsNullOrEmpty(tenantId))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { error = "Tenant no identificado" });
            return;
        }

        var tenant = await _tenantRepo.GetByIdAsync(tenantId);

        if (tenant == null)
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new { error = "Tenant no encontrado" });
            return;
        }

        // Poblar el contexto — disponible en toda la request
        if (tenantContext is TenantContext mutable)
        {
            mutable.TenantId = tenant.Id;
            mutable.ConnectionString = tenant.ConnectionString;
            mutable.Schema = tenant.Schema;
        }

        await _next(context);
    }

    private static string? ResolveTenantId(HttpContext context)
    {
        // Prioridad: JWT claim → Header → Subdominio

        // 1. JWT claim (usuario autenticado)
        var jwtTenant = context.User.FindFirst("tid")?.Value;
        if (!string.IsNullOrEmpty(jwtTenant)) return jwtTenant;

        // 2. Header explícito (comunicación servicio-a-servicio)
        if (context.Request.Headers.TryGetValue("X-Tenant-Id", out var headerTenant))
            return headerTenant.ToString();

        // 3. Subdominio: tenant-a.miapp.com
        var host = context.Request.Host.Host;
        var parts = host.Split('.');
        if (parts.Length >= 3) return parts[0]; // tenant-a

        return null;
    }
}
```

```csharp
// Registrar en DI como Scoped (vive por request)
builder.Services.AddScoped<ITenantContext, TenantContext>();
builder.Services.AddScoped<ITenantRepository, TenantRepository>();

// Agregar antes de Auth para que el tenant ya esté disponible
app.UseMiddleware<TenantMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
```

---

## Modelo 1: Database per Tenant con EF Core

```csharp
// TenantDbContextFactory — crea un DbContext para la BD del tenant actual
public class TenantDbContextFactory
{
    private readonly ITenantContext _tenantContext;
    private readonly IServiceProvider _serviceProvider;

    public TenantDbContextFactory(ITenantContext tenantContext, IServiceProvider serviceProvider)
    {
        _tenantContext = tenantContext;
        _serviceProvider = serviceProvider;
    }

    public AppDbContext Create()
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseSqlServer(_tenantContext.ConnectionString);
        return new AppDbContext(optionsBuilder.Options);
    }
}

// Registrar
builder.Services.AddScoped<TenantDbContextFactory>();
builder.Services.AddScoped<AppDbContext>(sp =>
    sp.GetRequiredService<TenantDbContextFactory>().Create());
```

```csharp
// Migraciones para múltiples bases de datos
// Se ejecutan al provisionar el tenant o en un job periódico

public class MigrationService
{
    private readonly ITenantRepository _tenantRepo;

    public async Task MigratarTodosLosTenantsAsync()
    {
        var tenants = await _tenantRepo.GetAllAsync();

        foreach (var tenant in tenants)
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseSqlServer(tenant.ConnectionString)
                .Options;

            await using var db = new AppDbContext(options);
            await db.Database.MigrateAsync();

            Console.WriteLine($"Migrado: {tenant.Id}");
        }
    }
}
```

---

## Modelo 2: Schema per Tenant con EF Core

```csharp
// DbContext que cambia el schema según el tenant
public class AppDbContext : DbContext
{
    private readonly ITenantContext _tenantContext;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Pedido> Pedidos => Set<Pedido>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var schema = _tenantContext.Schema; // "tenant_a", "tenant_b", etc.

        // Todas las entidades usan el schema del tenant actual
        modelBuilder.HasDefaultSchema(schema);

        // O por entidad si querés más control:
        modelBuilder.Entity<Usuario>().ToTable("usuarios", schema);
        modelBuilder.Entity<Pedido>().ToTable("pedidos", schema);

        base.OnModelCreating(modelBuilder);
    }
}
```

```sql
-- Provisionar un nuevo tenant: crear su schema
CREATE SCHEMA tenant_nuevo;
CREATE TABLE tenant_nuevo.usuarios (
    id INT PRIMARY KEY IDENTITY,
    nombre NVARCHAR(100),
    email NVARCHAR(200) UNIQUE,
    tenant_id NVARCHAR(50) DEFAULT 'tenant_nuevo'
);
-- ... resto de tablas
```

---

## Modelo 3: Row-level con Global Query Filters

El más simple de implementar — EF Core filtra automáticamente por `TenantId` en todas las queries.

```csharp
// Entidad base con TenantId
public abstract class TenantEntity
{
    public int Id { get; set; }
    public string TenantId { get; set; } = string.Empty;
}

public class Usuario : TenantEntity
{
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public ICollection<Pedido> Pedidos { get; set; } = [];
}

public class Pedido : TenantEntity
{
    public int UsuarioId { get; set; }
    public decimal Total { get; set; }
    public string Estado { get; set; } = string.Empty;
}
```

```csharp
// DbContext con Global Query Filters
public class AppDbContext : DbContext
{
    private readonly ITenantContext _tenantContext;

    public AppDbContext(DbContextOptions<AppDbContext> options, ITenantContext tenantContext)
        : base(options)
    {
        _tenantContext = tenantContext;
    }

    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Pedido> Pedidos => Set<Pedido>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Global Query Filter — se agrega automáticamente a TODAS las queries
        modelBuilder.Entity<Usuario>()
            .HasQueryFilter(u => u.TenantId == _tenantContext.TenantId);

        modelBuilder.Entity<Pedido>()
            .HasQueryFilter(p => p.TenantId == _tenantContext.TenantId);

        // Índice para performance — siempre consultar por TenantId
        modelBuilder.Entity<Usuario>()
            .HasIndex(u => u.TenantId);

        modelBuilder.Entity<Pedido>()
            .HasIndex(p => new { p.TenantId, p.UsuarioId });

        base.OnModelCreating(modelBuilder);
    }
}
```

```csharp
// Uso — el filtro es invisible para el desarrollador
public class UsuarioService
{
    private readonly AppDbContext _db;
    private readonly ITenantContext _tenant;

    // Este query AUTOMÁTICAMENTE agrega WHERE TenantId = 'tenant-a'
    public async Task<List<Usuario>> GetTodosAsync()
    {
        return await _db.Usuarios.ToListAsync();
        // SQL: SELECT * FROM Usuarios WHERE TenantId = 'tenant-a'
    }

    // Crear usuario — TenantId se asigna automáticamente
    public async Task<Usuario> CrearAsync(string nombre, string email)
    {
        var usuario = new Usuario
        {
            Nombre = nombre,
            Email = email,
            TenantId = _tenant.TenantId,  // ← asignar siempre al crear
        };

        _db.Usuarios.Add(usuario);
        await _db.SaveChangesAsync();
        return usuario;
    }

    // ⚠️ Deshabilitar el filtro SOLO para operaciones admin (con cuidado)
    public async Task<int> ContarTodosLosTenantsAsync()
    {
        return await _db.Usuarios
            .IgnoreQueryFilters()  // Bypasea el global filter
            .CountAsync();
    }
}
```

:::danger Data leak — el riesgo más crítico
Con Row-level, si alguien olvida asignar `TenantId` al crear un registro, ese registro no aparecerá para ningún tenant (perdido) o, peor, si el filtro no se configura bien, puede aparecer para todos. **Tests de seguridad que verifiquen el aislamiento son obligatorios.**
:::

---

## Tenant Provisioning — alta de un nuevo tenant

```csharp
public class TenantProvisioningService
{
    private readonly TenantRepository _tenantRepo;
    private readonly IEmailService _email;
    private readonly AppDbContext _adminDb; // DB de administración del SaaS

    public async Task<Tenant> ProvisionarAsync(NuevoTenantDto dto)
    {
        // 1. Validar que el slug no esté tomado
        if (await _tenantRepo.ExisteAsync(dto.Slug))
            throw new ConflictException($"El slug '{dto.Slug}' ya está en uso");

        // 2. Crear el registro del tenant
        var tenant = new Tenant
        {
            Id = dto.Slug,
            Nombre = dto.NombreEmpresa,
            Plan = dto.Plan,                           // "starter", "pro", "enterprise"
            ConnectionString = GenerarConnectionString(dto.Slug),
            Schema = $"tenant_{dto.Slug}",
            FechaCreacion = DateTime.UtcNow,
            Estado = TenantEstado.Provisionando,
        };

        await _tenantRepo.CrearAsync(tenant);

        // 3. Aprovisionar la infraestructura (async — puede tardar)
        await ProvisionarInfraestructuraAsync(tenant);

        // 4. Crear el usuario admin del tenant
        var adminUser = new Usuario
        {
            Nombre = dto.NombreAdmin,
            Email = dto.EmailAdmin,
            TenantId = tenant.Id,
            Rol = "admin",
        };
        // ... guardar en la BD del tenant

        // 5. Marcar como activo
        tenant.Estado = TenantEstado.Activo;
        await _tenantRepo.ActualizarAsync(tenant);

        // 6. Enviar bienvenida
        await _email.EnviarBienvenidaAsync(dto.EmailAdmin, tenant.Id);

        return tenant;
    }

    private async Task ProvisionarInfraestructuraAsync(Tenant tenant)
    {
        // Según el modelo de aislamiento:

        // Opción A: Database per tenant
        await CrearBaseDeDatosAsync(tenant.Id);
        await EjecutarMigracionesAsync(tenant.ConnectionString);

        // Opción B: Schema per tenant
        // await CrearSchemaAsync(tenant.Schema);
        // await CrearTablasEnSchemaAsync(tenant.Schema);

        // Opción C: Row-level — nada que aprovisionar en la BD
    }
}
```

---

## Feature Flags por tenant

Distintos tenants pueden tener distintas funcionalidades habilitadas (plan Free vs Pro vs Enterprise).

```csharp
// Modelo de features del tenant
public class TenantFeatures
{
    public string TenantId { get; set; } = string.Empty;
    public bool ExportacionExcel { get; set; }
    public bool ApiAccess { get; set; }
    public int MaxUsuarios { get; set; }
    public int MaxProductos { get; set; }
    public bool SsoHabilitado { get; set; }
    public string[] ModulosHabilitados { get; set; } = [];
}

public interface IFeatureService
{
    Task<bool> EstaHabilitadoAsync(string feature);
    Task<TenantFeatures> GetFeaturesAsync();
}

public class TenantFeatureService : IFeatureService
{
    private readonly ITenantContext _tenantContext;
    private readonly ICache _cache;
    private readonly TenantRepository _repo;

    public async Task<bool> EstaHabilitadoAsync(string feature)
    {
        var features = await GetFeaturesAsync();
        return feature switch
        {
            "exportacion_excel" => features.ExportacionExcel,
            "api_access"        => features.ApiAccess,
            "sso"               => features.SsoHabilitado,
            _ => features.ModulosHabilitados.Contains(feature),
        };
    }

    public async Task<TenantFeatures> GetFeaturesAsync()
    {
        var key = $"features:{_tenantContext.TenantId}";

        return await _cache.GetOrCreateAsync(key, async () =>
        {
            var tenant = await _repo.GetByIdAsync(_tenantContext.TenantId);
            return MapPlanToFeatures(tenant!.Plan);
        }, TimeSpan.FromMinutes(10));
    }

    private static TenantFeatures MapPlanToFeatures(string plan) => plan switch
    {
        "starter"    => new TenantFeatures { MaxUsuarios = 5,   MaxProductos = 100,  ApiAccess = false },
        "pro"        => new TenantFeatures { MaxUsuarios = 50,  MaxProductos = 5000, ApiAccess = true, ExportacionExcel = true },
        "enterprise" => new TenantFeatures { MaxUsuarios = 999, MaxProductos = 999999, ApiAccess = true, ExportacionExcel = true, SsoHabilitado = true },
        _ => throw new ArgumentException($"Plan desconocido: {plan}"),
    };
}
```

```csharp
// Attribute para decorar endpoints restringidos por feature
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
public class RequiereFeatureAttribute : Attribute
{
    public string Feature { get; }
    public RequiereFeatureAttribute(string feature) => Feature = feature;
}

// Filter de ASP.NET Core que verifica la feature
public class FeatureFilter : IAsyncActionFilter
{
    private readonly IFeatureService _features;

    public FeatureFilter(IFeatureService features) => _features = features;

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var attr = context.ActionDescriptor.EndpointMetadata
            .OfType<RequiereFeatureAttribute>()
            .FirstOrDefault();

        if (attr != null && !await _features.EstaHabilitadoAsync(attr.Feature))
        {
            context.Result = new ObjectResult(new
            {
                error = "Feature no disponible en tu plan",
                feature = attr.Feature,
                upgradeUrl = "https://miapp.com/pricing",
            })
            { StatusCode = 402 }; // Payment Required
            return;
        }

        await next();
    }
}

// Uso en controllers
[HttpGet("exportar")]
[RequiereFeature("exportacion_excel")]
public async Task<IActionResult> ExportarExcel()
{
    // Solo accesible para tenants con plan Pro o superior
    var datos = await _service.GetDatosExportAsync();
    return File(datos, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}
```

---

## Testing de aislamiento entre tenants

```csharp
// Test crítico: verificar que los datos de un tenant NO son visibles para otro
public class AislamientoTenantTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    [Fact]
    public async Task TenantA_NoPuedeVerDatos_DeTenantB()
    {
        // Arrange: crear datos para Tenant B
        var clienteTenantB = CrearClienteConTenant("tenant-b");
        await clienteTenantB.PostAsJsonAsync("/api/productos", new { Nombre = "Prod B", Precio = 99 });

        // Act: Tenant A intenta leer
        var clienteTenantA = CrearClienteConTenant("tenant-a");
        var response = await clienteTenantA.GetAsync("/api/productos");

        // Assert: no debe ver los productos de Tenant B
        var productos = await response.Content.ReadFromJsonAsync<List<ProductoDto>>();
        productos.Should().NotContain(p => p.Nombre == "Prod B");
    }

    [Fact]
    public async Task CrearProducto_SiempreAsignaTenantIdCorrecto()
    {
        var cliente = CrearClienteConTenant("tenant-test");
        var response = await cliente.PostAsJsonAsync("/api/productos",
            new { Nombre = "Test", Precio = 10 });

        var producto = await response.Content.ReadFromJsonAsync<ProductoDto>();

        // El TenantId fue asignado automáticamente
        producto!.TenantId.Should().Be("tenant-test");
    }

    private HttpClient CrearClienteConTenant(string tenantId)
    {
        return _factory.CreateClient();
        // Configurar header o JWT con tenantId...
    }
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre los 3 modelos de multi-tenancy?**
> **Database per Tenant**: máximo aislamiento, una base de datos por cliente — ideal para regulaciones estrictas (HIPAA, GDPR con separación de datos) pero caro y complejo de migrar. **Schema per Tenant**: una base de datos, un schema por cliente — buen balance seguridad/costo. **Row-level**: todo en las mismas tablas con una columna `TenantId` — barato y fácil de migrar, pero un bug puede exponer datos de todos los tenants.

**2. ¿Cómo prevenís un data leak en el modelo row-level?**
> Con Global Query Filters en EF Core — se aplican automáticamente a todas las queries sin que el desarrollador tenga que recordarlo. Test de seguridad obligatorio: verificar que `GET /api/recursos` de Tenant A no devuelve datos de Tenant B. Code review checklist: toda entidad nueva debe heredar de `TenantEntity` y el filter debe estar registrado.

**3. ¿Cómo manejás las migraciones de base de datos con múltiples tenants?**
> En row-level: una sola migración aplica para todos. En database/schema per tenant: necesitás correr la migración para cada tenant — con un Job o BackgroundService que itere todos los tenants activos y ejecute `db.Database.MigrateAsync()`. La estrategia de deployment debe contemplar que la migración puede tardar si hay muchos tenants.

**4. ¿Cómo identificás el tenant actual en cada request?**
> Depende del contexto. Para usuarios finales: del claim `tid` en el JWT. Para comunicación interna entre servicios: header `X-Tenant-Id`. Para onboarding con subdominios: del host (`tenant-a.miapp.com`). El tenant se resuelve en middleware antes de que llegue al controller, y se inyecta vía `ITenantContext` (Scoped).

**5. ¿Cómo diseñarías el sistema de planes (Free/Pro/Enterprise)?**
> Con una tabla de features por tenant o por plan. Al autenticar, cargo las features en caché (Redis, 10 minutos). Los endpoints usan un attribute `[RequiereFeature("api_access")]` que verifica la feature antes de ejecutar. Los límites (max usuarios, max productos) se verifican en la capa de servicio antes de permitir crear. El cambio de plan invalida el caché inmediatamente.

**6. ¿Qué pasa si un tenant crece mucho y necesita más performance?**
> En row-level o schema: migrar ese tenant a su propia base de datos — técnica llamada **tenant sharding**. Podés tener una columna `ConnectionString` en la tabla de tenants: tenants pequeños comparten la DB por defecto, tenants enterprise apuntan a una DB dedicada. El código no cambia — solo el connection string que devuelve `ITenantContext`. Es uno de los argumentos a favor de tener esa abstracción desde el inicio.
