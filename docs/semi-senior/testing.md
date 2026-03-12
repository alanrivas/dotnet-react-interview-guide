---
id: testing
title: Testing
sidebar_position: 6
---

# Testing 🟡

## Pirámide de Testing

```
          /\
         /  \
        / E2E \        ← Pocos, lentos, costosos
       /--------\
      /Integration\    ← Algunos, más lentos
     /--------------\
    /   Unit Tests   \  ← Muchos, rápidos, baratos
   /------------------\
```

---

## Unit Testing en .NET con xUnit

```csharp
// Paquetes: xUnit, FluentAssertions, Moq, Microsoft.NET.Test.Sdk

public class CalculadoraTests
{
    private readonly Calculadora _calc = new();

    [Fact]
    public void Sumar_DosNumeros_RetornaSuma()
    {
        // Arrange
        int a = 5, b = 3;

        // Act
        int resultado = _calc.Sumar(a, b);

        // Assert
        Assert.Equal(8, resultado);
        // Con FluentAssertions (más legible):
        resultado.Should().Be(8);
    }

    [Theory]
    [InlineData(0, 5, 5)]
    [InlineData(-1, 1, 0)]
    [InlineData(10, -3, 7)]
    public void Sumar_VariosScenarios_RetornaCorrecto(int a, int b, int esperado)
    {
        _calc.Sumar(a, b).Should().Be(esperado);
    }

    [Fact]
    public void Dividir_PorCero_LanzaException()
    {
        Action accion = () => _calc.Dividir(10, 0);
        accion.Should().Throw<DivideByZeroException>();
    }
}
```

---

## Mocking con Moq

```csharp
public class ProductoServiceTests
{
    private readonly Mock<IProductoRepository> _repoMock;
    private readonly Mock<IEmailService> _emailMock;
    private readonly ProductoService _service;

    public ProductoServiceTests()
    {
        _repoMock = new Mock<IProductoRepository>();
        _emailMock = new Mock<IEmailService>();
        _service = new ProductoService(_repoMock.Object, _emailMock.Object);
    }

    [Fact]
    public async Task CrearProducto_Valido_RetornaProductoCreado()
    {
        // Arrange
        var dto = new CrearProductoDto("Laptop", 999.99m, 1);
        var productoEsperado = new Producto { Id = 1, Nombre = "Laptop", Precio = 999.99m };

        _repoMock
            .Setup(r => r.CrearAsync(It.IsAny<Producto>()))
            .ReturnsAsync(productoEsperado);

        // Act
        var resultado = await _service.CrearAsync(dto);

        // Assert
        resultado.Should().NotBeNull();
        resultado.Nombre.Should().Be("Laptop");
        _repoMock.Verify(r => r.CrearAsync(It.IsAny<Producto>()), Times.Once);
    }

    [Fact]
    public async Task CrearProducto_CategoriaInexistente_LanzaNotFoundException()
    {
        _repoMock
            .Setup(r => r.ExisteCategoriaAsync(It.IsAny<int>()))
            .ReturnsAsync(false);

        Func<Task> accion = () => _service.CrearAsync(new CrearProductoDto("Test", 10, 999));
        
        await accion.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*categoría*");
    }
}
```

---

## Integration Testing en ASP.NET Core

```csharp
// WebApplicationFactory: levanta la app en memoria para tests
public class ProductosControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public ProductosControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Reemplazar DB real con SQLite en memoria
                    var descriptor = services.SingleOrDefault(
                        d => d.ServiceType == typeof(DbContextOptions<AppDbContext>));
                    if (descriptor != null) services.Remove(descriptor);

                    services.AddDbContext<AppDbContext>(options =>
                        options.UseInMemoryDatabase("TestDb"));
                });
            })
            .CreateClient();
    }

    [Fact]
    public async Task GET_Productos_RetornaOk()
    {
        var response = await _client.GetAsync("/api/productos");
        
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<List<ProductoDto>>();
        body.Should().NotBeNull();
    }

    [Fact]
    public async Task POST_ProductoValido_Retorna201()
    {
        var dto = new { Nombre = "Test", Precio = 99.99, CategoriaId = 1 };
        var response = await _client.PostAsJsonAsync("/api/productos", dto);
        
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        response.Headers.Location.Should().NotBeNull();
    }
}
```

---

## Testing en React con Vitest y Testing Library

```tsx
// Vitest + @testing-library/react + @testing-library/user-event

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FormularioLogin } from './FormularioLogin';

describe('FormularioLogin', () => {
  it('muestra error cuando las credenciales son incorrectas', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Credenciales inválidas'));
    const user = userEvent.setup();

    render(<FormularioLogin onLogin={mockLogin} />);

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'incorrecta');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
    });
  });

  it('llama a onLogin con las credenciales correctas', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<FormularioLogin onLogin={mockLogin} />);

    await user.type(screen.getByLabelText(/email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'password123');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
  });
});

// Mock de módulos
vi.mock('../services/api', () => ({
  fetchProductos: vi.fn().mockResolvedValue([
    { id: 1, nombre: 'Laptop', precio: 999 }
  ])
}));
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre unit test e integration test?**
> **Unit test**: prueba una unidad aislada (clase, método) con dependencias mockeadas. Rápido. **Integration test**: prueba múltiples componentes juntos (controller + service + DB). Más lento pero prueba el flujo real.

**2. ¿Qué es TDD?**
> Test-Driven Development: escribes el test primero (falla), luego escribes el código mínimo para pasarlo, luego refactorizas. Ciclo: **Red → Green → Refactor**.

**3. ¿Qué deberías mockear y qué no?**
> Mockear: dependencias externas (DB, APIs externas, email, sistema de archivos). No mockear: la lógica que estás probando, ni clases del framework que ya tienen tests.

**4. ¿Cómo calculas la cobertura de código y qué porcentaje es bueno?**
> Con `dotnet test --collect:"XPlat Code Coverage"` o Coverlet. No hay un número mágico — 80% es un objetivo común, pero más importante que el número es cubrir los casos críticos y los edge cases. 100% de cobertura no significa 0 bugs.
