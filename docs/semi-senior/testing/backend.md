---
id: backend
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

---

## Testing avanzado en React

### Component Testing con React Testing Library

```tsx
// ✅ CORRECTO: Testear lo que el usuario ve
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Carrito } from './Carrito';

describe('Carrito', () => {
  // ❌ NO hacer esto: testear componentes internos
  // it('renderiza CartItem components', () => {
  //   render(<Carrito items={[...]} />);
  //   const items = screen.queryAllByTestId('cart-item');  // ← Acoplado
  // });

  // ✅ Hacer esto: testear comportamiento visible
  it('muestra el total correcto', () => {
    render(
      <Carrito items={[
        { id: 1, nombre: 'Laptop', precio: 1000, cantidad: 1 },
        { id: 2, nombre: 'Mouse', precio: 50, cantidad: 2 },
      ]} />
    );

    expect(screen.getByText(/total: \$1,100/i)).toBeInTheDocument();
  });

  it('elimina un artículo cuando el usuario hace clic en "Eliminar"', async () => {
    const mockOnRemove = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <Carrito
        items={[{ id: 1, nombre: 'Laptop', precio: 1000 }]}
        onRemove={mockOnRemove}
      />
    );

    const botonEliminar = screen.getByRole('button', { name: /eliminar/i });
    await user.click(botonEliminar);

    expect(mockOnRemove).toHaveBeenCalledWith(1);

    // Simular que el item fue removido
    rerender(
      <Carrito items={[]} onRemove={mockOnRemove} />
    );

    expect(screen.queryByText(/laptop/i)).not.toBeInTheDocument();
  });
});

// Testing de children props
describe('Modal', () => {
  it('renderiza children correctamente', () => {
    render(
      <Modal isOpen={true}>
        <div>Contenido del modal</div>
      </Modal>
    );

    expect(screen.getByText(/contenido del modal/i)).toBeInTheDocument();
  });
});
```

### Testing de Hooks personalizados

```tsx
// ✅ Usar react-hooks-testing-library
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCounter } from './useCounter';
import { useFetch } from './useFetch';

describe('useCounter', () => {
  it('incrementa el contador', () => {
    const { result } = renderHook(() => useCounter());

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('decrementa el contador', () => {
    const { result } = renderHook(() => useCounter({ initial: 10 }));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(9);
  });
});

describe('useFetch', () => {
  it('carga datos exitosamente', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, nombre: 'Producto' }),
    });

    const { result } = renderHook(() => useFetch('https://api.example.com/producto'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ id: 1, nombre: 'Producto' });
    expect(result.current.error).toBeNull();
  });

  it('maneja errores correctamente', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFetch('https://api.example.com/producto'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toBeNull();
  });
});
```

### Testing de async operations

```tsx
describe('Component con async', () => {
  it('espera correctamente a promesas', async () => {
    const { rerender } = render(
      <ProductoDetalle id="1" />
    );

    // Mientras carga
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();

    // Esperar a que se resuelva
    const nombre = await screen.findByText(/laptop/i);  // ← findBy espera
    expect(nombre).toBeInTheDocument();
  });

  it('maneja errores en async', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API error'));

    render(<ProductoDetalle id="1" />);

    const error = await screen.findByText(/error: api error/i);
    expect(error).toBeInTheDocument();
  });
});
```

### E2E Testing con Playwright (introducción)

```typescript
// tests/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test('usuario puede loguarse correctamente', async ({ page }) => {
    await page.goto('/login');

    // Llenar el formulario
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Enviar
    await page.click('button[type="submit"]');

    // Esperar a la redirección y verificar
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');

    // Verificar que el usuario está logueado
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toContainText('user@example.com');
  });

  test('mostrar error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    const error = page.locator('[role="alert"]');
    await expect(error).toContainText('Credenciales inválidas');
  });
});

// ✅ Correr E2E: npm run test:e2e
```

### Snapshot Testing (¡usar con cuidado!)

```tsx
// ✅ Bien: Snapshot de cambios críticos
describe('Factura', () => {
  it('renderiza factura correctamente', () => {
    const { container } = render(
      <Factura 
        items={[{ id: 1, descripcion: 'Laptop', precio: 1000 }]} 
        total={1000}
        numero="FAC-001"
      />
    );

    expect(container.firstChild).toMatchSnapshot();
  });
});

// ❌ Evitar: Snapshot de componentes que cambian constantemente
// (timestamps, datos dinámicos, dependencias externas)

// ✅ Mejor: Snapshot de partes específicas
it('renderiza estructura de componente', () => {
  const { container } = render(<ProductoTarjeta producto={...} />);
  const titulo = container.querySelector('h2');
  expect(titulo?.innerHTML).toMatchSnapshot();
});
```

### Testing de async en React Testing Library

```tsx
describe('Búsqueda de productos', () => {
  it('muestra resultados después de buscar', async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, nombre: 'Laptop' },
        { id: 2, nombre: 'Tablet' },
      ],
    });

    render(<BuscadorProductos />);

    const input = screen.getByPlaceholderText(/buscar/i);
    await user.type(input, 'Laptop');

    // Esperar a que aparezca el resultado (waitFor o findBy)
    const resultado = await screen.findByText(/laptop/i);
    expect(resultado).toBeInTheDocument();
  });

  it('limpia resultados cuando borras la búsqueda', async () => {
    const user = userEvent.setup();
    render(<BuscadorProductos />);

    const input = screen.getByPlaceholderText(/buscar/i);
    await user.type(input, 'Laptop');

    const resultado = await screen.findByText(/laptop/i);
    expect(resultado).toBeInTheDocument();

    await user.clear(input);

    // Debe desaparecer
    await waitFor(() => {
      expect(screen.queryByText(/laptop/i)).not.toBeInTheDocument();
    });
  });
});
```

---

## Anti-patrones en Testing

```typescript
// ❌ ANTI-PATRÓN: Usar getBy cuando no esperas que exista
// Si falla, el test explota inmediatamente
const elemento = screen.getByText('No existe');  // ← Throws!

// ✅ CORRECTO: Usar queryBy si necesitas verificar que NO existe
expect(screen.queryByText('Error')).not.toBeInTheDocument();

// ❌ ANTI-PATRÓN: Tests sin cleanup (state compartido)
describe('Contador', () => {
  let count = 0;  // ← Estado compartido entre tests!
  
  it('incrementa', () => {
    count++;
    expect(count).toBe(1);
  });
  
  it('puede tener estado anterior', () => {
    expect(count).toBe(1);  // ← Falla si corre primero
  });
});

// ✅ CORRECTO: Tests aislados
describe('Contador', () => {
  it('incrementa', () => {
    const { result } = renderHook(() => useCounter());
    act(() => result.current.increment());
    expect(result.current.count).toBe(1);
  });
});

// ❌ ANTI-PATRÓN: Esperar con setTimeout
it('muestra mensaje', async () => {
  render(<Notificacion />);
  await new Promise(resolve => setTimeout(resolve, 1000));  // ← Flaky!
  expect(screen.getByText(/mensaje/)).toBeInTheDocument();
});

// ✅ CORRECTO: Usar waitFor o findBy
it('muestra mensaje', async () => {
  render(<Notificacion />);
  const mensaje = await screen.findByText(/mensaje/);  // Espera inteligente
  expect(mensaje).toBeInTheDocument();
});
```

---

## Preguntas frecuentes de entrevista expandidas 🎯

**5. ¿Testing Library vs Enzyme? ¿Cuál prefieres?**
> **React Testing Library** porque testea lo que el usuario ve (queries semánticas: getByRole, getByLabelText) versus el DOM interno. Enzyme permite acceder a estado interno y props — eso desacoplamiento es malo. Con RTL estás protegido contra refactorings innecesarios.

**6. ¿Cómo testas un hook que depende de otro hook?**
> Con `renderHook`, que ejecuta el hook en un contexto de React. Si el hook A depende del hook B, renderHook setupea todo correctamente. El contexto (Provider) también se puede pasar si necesitas.

**7. ¿Snapshot testing sí o no?**
> Usar snapshots **solo para cambios críticos** (layouts, estructura HTML). NO para: componentes que cambian a menudo, timestamps, IDs dinámicos. Los snapshots comunes causan "snapshot rotting" donde actualizas el snapshot sin revisar qué cambió.

**8. ¿Cómo pruebas localStorage/sessionStorage en tests?**
> Mockearlo: `vi.stubGlobal('localStorage', mockStorage)`. Pero mejor: extraer la lógica de localStorage a un hook o servicio (`useLocalStorage`), y mockear ese. Evita acoplar tests al storage API.

**9. ¿E2E vs Integration vs Unit? Cuándo usar cada uno?**
> - **Unit** (80%): lógica pura, funciones, utilidades
> - **Integration** (15%): componentes + servicios, hooks + APIs mockeadas
> - **E2E** (5%): flujos críticos en navegador real (login, pago, contacto) — lentos pero garantizan que funciona todo junto
