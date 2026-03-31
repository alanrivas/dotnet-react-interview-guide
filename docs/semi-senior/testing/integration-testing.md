---
id: integration-testing
title: Integration Testing con WebApplicationFactory
sidebar_position: 23
---

# Integration Testing con WebApplicationFactory 🟡

Los tests de integración verifican que múltiples capas funcionan juntas: controllers, servicios, base de datos, middleware. En .NET, `WebApplicationFactory<T>` levanta toda la aplicación en memoria para testear endpoints reales.

---

## ¿Por qué integration tests?

```
Unit tests comprueban: ¿funciona la pieza?
Integration tests comprueban: ¿funcionan las piezas juntas?

Unit test:
  OrderService.Calculate() → ✅ Retorna precio correcto

Integration test:
  POST /api/orders → pasa por middleware → controller → service → DB → respuesta 201
                                                ↑
                          Un unit test nunca hubiera encontrado un bug aquí
```

---

## Setup básico

### Paquetes necesarios

```bash
dotnet add package Microsoft.AspNetCore.Mvc.Testing
dotnet add package Microsoft.EntityFrameworkCore.InMemory  # O SQLite para tests
dotnet add package FluentAssertions
```

### Proyecto de tests

```xml
<!-- MiApp.IntegrationTests.csproj -->
<ItemGroup>
  <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.*" />
  <PackageReference Include="xunit" Version="2.9.*" />
  <PackageReference Include="FluentAssertions" Version="6.*" />
</ItemGroup>
```

---

## 1. WebApplicationFactory básica

```csharp
// Forma más simple — levanta la app tal cual
public class BasicIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public BasicIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHealth_ReturnsOk()
    {
        var response = await _client.GetAsync("/health");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

### Hacer Program accesible

```csharp
// En tu proyecto principal — Program.cs
// Agregar al final del archivo:
public partial class Program { }  // ← Necesario para WebApplicationFactory
```

---

## 2. Custom WebApplicationFactory (la forma correcta)

En la práctica necesitas reemplazar la DB real por una de test y configurar el entorno:

```csharp
// CustomWebApplicationFactory.cs
public class CustomWebApplicationFactory<TProgram>
    : WebApplicationFactory<TProgram> where TProgram : class
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            // ✅ Reemplazar DbContext real por InMemory
            var dbDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));

            if (dbDescriptor != null)
                services.Remove(dbDescriptor);

            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase("TestDb-" + Guid.NewGuid()));  // Guid = DB aislada por test

            // ✅ Reemplazar servicios externos por mocks
            services.AddScoped<IEmailService, FakeEmailService>();
            services.AddScoped<IPaymentGateway, FakePaymentGateway>();

            // ✅ Asegurar que la DB se crea con los seeds necesarios
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Database.EnsureCreated();
            SeedTestData(db);
        });
    }

    private static void SeedTestData(AppDbContext db)
    {
        db.Productos.AddRange(
            new Producto { Id = 1, Nombre = "Producto Test", Precio = 100m },
            new Producto { Id = 2, Nombre = "Otro Producto", Precio = 200m }
        );
        db.SaveChanges();
    }
}
```

---

## 3. Tests de endpoints REST

```csharp
public class ProductosApiTests : IClassFixture<CustomWebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ProductosApiTests(CustomWebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    // ✅ Test GET
    [Fact]
    public async Task GetProductos_RetornaListaConStatus200()
    {
        var response = await _client.GetAsync("/api/productos");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var productos = await response.Content.ReadFromJsonAsync<List<ProductoDto>>();
        productos.Should().NotBeNull();
        productos!.Should().HaveCount(2);  // Los 2 seeded
    }

    // ✅ Test GET por ID
    [Fact]
    public async Task GetProducto_IdExistente_Retorna200ConProducto()
    {
        var response = await _client.GetAsync("/api/productos/1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var producto = await response.Content.ReadFromJsonAsync<ProductoDto>();
        producto!.Id.Should().Be(1);
        producto.Nombre.Should().Be("Producto Test");
    }

    // ✅ Test 404
    [Fact]
    public async Task GetProducto_IdInexistente_Retorna404()
    {
        var response = await _client.GetAsync("/api/productos/999");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ✅ Test POST
    [Fact]
    public async Task CreateProducto_DatosValidos_Retorna201ConLocation()
    {
        var nuevo = new CreateProductoDto { Nombre = "Nuevo", Precio = 50m };

        var response = await _client.PostAsJsonAsync("/api/productos", nuevo);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();

        var creado = await response.Content.ReadFromJsonAsync<ProductoDto>();
        creado!.Nombre.Should().Be("Nuevo");
    }

    // ✅ Test validación — 400 con campos inválidos
    [Fact]
    public async Task CreateProducto_NombreVacio_Retorna400()
    {
        var invalido = new CreateProductoDto { Nombre = "", Precio = -1m };

        var response = await _client.PostAsJsonAsync("/api/productos", invalido);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ✅ Test DELETE
    [Fact]
    public async Task DeleteProducto_IdExistente_Retorna204()
    {
        var response = await _client.DeleteAsync("/api/productos/1");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Verificar que ya no existe
        var getResponse = await _client.GetAsync("/api/productos/1");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
```

---

## 4. Autenticación en integration tests

```csharp
// ✅ Helper para crear cliente autenticado
public class CustomWebApplicationFactory<TProgram> : WebApplicationFactory<TProgram>
    where TProgram : class
{
    // Crear cliente con JWT falso
    public HttpClient CreateAuthenticatedClient(string role = "User", int userId = 1)
    {
        var client = CreateClient();

        var token = GenerateTestJwt(role, userId);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        return client;
    }

    private static string GenerateTestJwt(string role, int userId)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes("test-secret-key-at-least-32-characters!"));

        var token = new JwtSecurityToken(
            issuer: "TestIssuer",
            audience: "TestAudience",
            claims: new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Role, role),
                new Claim("email", $"test-{userId}@test.com"),
            },
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Reemplazar validación de JWT para usar la misma key del test
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, opts =>
            {
                opts.TokenValidationParameters.IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes("test-secret-key-at-least-32-characters!"));
                opts.TokenValidationParameters.ValidIssuer = "TestIssuer";
                opts.TokenValidationParameters.ValidAudience = "TestAudience";
            });
        });
    }
}

// Uso en tests
public class AuthProductosTests : IClassFixture<CustomWebApplicationFactory<Program>>
{
    private readonly CustomWebApplicationFactory<Program> _factory;

    public AuthProductosTests(CustomWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task DeleteProducto_SinAutenticacion_Retorna401()
    {
        var client = _factory.CreateClient();  // Sin token

        var response = await client.DeleteAsync("/api/productos/1");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DeleteProducto_SinRolAdmin_Retorna403()
    {
        var client = _factory.CreateAuthenticatedClient(role: "User");

        var response = await client.DeleteAsync("/api/productos/1");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task DeleteProducto_ConRolAdmin_Retorna204()
    {
        var client = _factory.CreateAuthenticatedClient(role: "Admin");

        var response = await client.DeleteAsync("/api/productos/1");

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
```

---

## 5. Aislamiento entre tests

Con `InMemoryDatabase`, si dos tests comparten la misma instancia de `Factory`, comparten la base de datos y los tests se pisan.

```csharp
// ❌ PROBLEMA: tests comparten datos
public class CustomWebApplicationFactory<T> : WebApplicationFactory<T> where T : class
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            services.AddDbContext<AppDbContext>(o =>
                o.UseInMemoryDatabase("TestDb"));  // ← Todos comparten esta DB
        });
    }
}

// ✅ SOLUCIÓN 1: DB única por instancia de factory
services.AddDbContext<AppDbContext>(o =>
    o.UseInMemoryDatabase("TestDb-" + Guid.NewGuid()));  // ← Cada factory = DB nueva

// ✅ SOLUCIÓN 2: Resetear DB entre tests con IAsyncLifetime
public class ProductosTests : IClassFixture<CustomWebApplicationFactory<Program>>,
                               IAsyncLifetime
{
    private readonly CustomWebApplicationFactory<Program> _factory;
    private AppDbContext _db = null!;

    public ProductosTests(CustomWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        _db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await _db.Database.EnsureDeletedAsync();  // Limpiar
        await _db.Database.EnsureCreatedAsync();  // Recrear
        // Seed data fresca
    }

    public Task DisposeAsync() => Task.CompletedTask;
}
```

---

## 6. SQLite en lugar de InMemory (más realista)

InMemory no soporta todas las features de SQL (constraints, transacciones reales). SQLite es mejor:

```csharp
services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=:memory:")  // En memoria, no crea archivo
           .EnableSensitiveDataLogging());

// Crear la DB antes de los tests
var sp = services.BuildServiceProvider();
using var scope = sp.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
db.Database.Migrate();  // Aplica migraciones reales
```

---

## Comparativa: Unit vs Integration vs E2E

| Aspecto | Unit | Integration | E2E |
|---------|------|-------------|-----|
| **Velocidad** | ⚡ Muy rápido | 🔄 Medio | 🐌 Lento |
| **Costo** | Bajo | Medio | Alto |
| **Cobertura** | Una clase | Varias capas | Sistema completo |
| **Confianza** | Media | Alta | Muy alta |
| **Cuántos tener** | Muchos | Algunos | Pocos |
| **Herramienta .NET** | xUnit + Moq | WebApplicationFactory | Playwright / Selenium |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es `WebApplicationFactory` y para qué sirve?**
> Es una clase de `Microsoft.AspNetCore.Mvc.Testing` que levanta toda tu aplicación ASP.NET Core en memoria durante los tests. Permite testear endpoints reales con un `HttpClient` sin necesidad de un servidor real.

**2. ¿Por qué no usar solo unit tests?**
> Los unit tests comprueban componentes aislados. Pero un bug puede vivir en la interacción entre capas: middleware que no maneja un error, un mapper que rompe la serialización, una validación que no se activa. Los integration tests cubren eso.

**3. ¿Cómo evitas que los tests se contaminen entre sí?**
> Usando una base de datos InMemory con `Guid.NewGuid()` en el nombre (cada test crea su propia DB), o implementando `IAsyncLifetime` para limpiar y re-seedear antes de cada test.

**4. ¿Cuándo usarías `UseInMemoryDatabase` vs SQLite?**
> InMemory es más rápido pero no soporta constraints de FK, transacciones reales ni algunas queries complejas. SQLite en memoria (`Data Source=:memory:`) es más fiel al comportamiento real de SQL Server. Si tus tests fallan en producción pero pasan en InMemory, probablemente sea por esto.

**5. ¿Cómo testeas endpoints protegidos por JWT?**
> Generas un JWT de prueba firmado con la misma clave secreta configurada en el test y lo pones en el header `Authorization: Bearer`. También puedes usar `PostConfigure<JwtBearerOptions>` en la factory para reemplazar la configuración de validación.
