---
id: testing-basico
title: Testing — Fundamentos
sidebar_position: 11
---

# Testing — Fundamentos

El testing es una de las habilidades más valoradas en el mundo profesional. Un desarrollador que sabe cómo probar su código genera confianza en el equipo y en el producto. En entrevistas técnicas, saber explicar qué testear, cómo y por qué es tan importante como escribir el test en sí.

---

## ¿Por qué hacer tests?

### Detectar bugs antes de producción

Un bug encontrado en desarrollo cuesta minutos. El mismo bug en producción puede costar horas de debugging, pérdida de datos, o usuarios afectados.

```csharp
// Sin test: este bug podría llegar a producción
public decimal CalcularDescuento(decimal precio, int porcentaje)
{
    return precio * porcentaje / 100; // Bug: debería ser precio - (precio * porcentaje / 100)
}

// Con test: el bug se detecta inmediatamente
[Fact]
public void CalcularDescuento_PrecioYPorcentajeValidos_RetornaDescuentoCorrecto()
{
    var servicio = new ServicioPrecios();
    decimal resultado = servicio.CalcularDescuento(100, 20);
    Assert.Equal(80, resultado); // Falla → bug detectado antes de producción
}
```

### Documentación viva del comportamiento esperado

Los tests describen **exactamente** qué debe hacer el sistema en cada escenario. A diferencia de la documentación escrita, los tests no mienten: si el comportamiento cambia y el test no se actualiza, falla.

```csharp
// Este test documenta las reglas de negocio mejor que cualquier comentario
[Theory]
[InlineData(0, "Sin descuento")]
[InlineData(100, "Bronce")]
[InlineData(500, "Plata")]
[InlineData(1000, "Oro")]
public void ObtenerNivelCliente_SegunCompras_RetornaNivelCorrecto(
    decimal totalCompras, string nivelEsperado)
{
    // Cualquier desarrollador puede leer este test y entender las reglas
    var resultado = _servicioCliente.ObtenerNivel(totalCompras);
    Assert.Equal(nivelEsperado, resultado);
}
```

### Confianza para refactorizar

Sin tests, refactorizar es peligroso: ¿cómo sabes que no rompiste algo? Con tests, puedes restructurar el código con seguridad.

### CI/CD: los tests como gate de calidad

En un pipeline de CI/CD (GitHub Actions, Azure DevOps, etc.), los tests se ejecutan automáticamente en cada push. Si fallan, el despliegue se **bloquea**. Los tests son la red de seguridad que permite desplegar con confianza.

```yaml
# .github/workflows/ci.yml — ejemplo simplificado
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: dotnet test  # Si esto falla, no se despliega
      - run: npm test
```

---

## La Pirámide de Testing

```
         /\
        /E2E\        ← Pocos, lentos, costosos
       /------\
      /Integr. \     ← Medios, verifican la integración
     /----------\
    / Unit Tests  \  ← Muchos, rápidos, aislados
   /--------------\
```

### Unit Tests (base) — 70%

- Prueban **una sola unidad** de código (método, clase) en **aislamiento**
- Muy rápidos (milisegundos)
- No dependen de base de datos, red, ni sistema de archivos
- Se deben tener **muchos** de estos

### Integration Tests (medio) — 20%

- Prueban que **varios componentes funcionan juntos**
- Más lentos (pueden acceder a BD real o en memoria)
- Ejemplo: probar que un Controller + Service + Repository funcionan de extremo a extremo

### E2E Tests (cima) — 10%

- Prueban el **flujo completo** como lo haría un usuario real
- Muy lentos, frágiles, difíciles de mantener
- Herramientas: Playwright, Cypress, Selenium
- Solo para flujos críticos (login, checkout, etc.)

### La regla 70/20/10

No es una ley estricta, sino una guía. El objetivo es tener **muchos tests rápidos y pocos lentos**. Una pirámide invertida (más E2E que unit) es un anti-patrón: el suite de tests se vuelve lento, frágil y difícil de mantener.

---

## Unit Testing con xUnit (.NET)

### Instalación

```bash
# Crear proyecto de tests
dotnet new xunit -n MiProyecto.Tests

# Agregar referencia al proyecto que se va a testear
dotnet add MiProyecto.Tests/MiProyecto.Tests.csproj reference MiProyecto/MiProyecto.csproj

# Instalar dependencias (si usas dotnet add package)
dotnet add package xunit
dotnet add package xunit.runner.visualstudio
dotnet add package Microsoft.NET.Test.Sdk
```

El archivo `.csproj` de los tests se verá así:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <PackageReference Include="xunit" Version="2.6.1" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.5.3" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\MiProyecto\MiProyecto.csproj" />
  </ItemGroup>
</Project>
```

### Estructura Arrange-Act-Assert (AAA)

El patrón AAA organiza cada test en tres partes claras:

```csharp
[Fact]
public void Dividir_NumerosValidos_RetornaResultadoCorrecto()
{
    // ARRANGE: prepara los datos y el sistema bajo prueba (SUT)
    var calculadora = new Calculadora();
    double dividendo = 10;
    double divisor = 2;

    // ACT: ejecuta la acción que estás probando
    double resultado = calculadora.Dividir(dividendo, divisor);

    // ASSERT: verifica que el resultado es el esperado
    Assert.Equal(5.0, resultado);
}
```

### `[Fact]` vs `[Theory]` con `[InlineData]`

```csharp
// [Fact]: un test con datos fijos, sin parámetros
[Fact]
public void Suma_DosNumerosPositivos_RetornaSumaCorrecta()
{
    var calc = new Calculadora();
    Assert.Equal(5, calc.Sumar(2, 3));
}

// [Theory] + [InlineData]: el mismo test con múltiples conjuntos de datos
// Evita duplicar tests para cada caso
[Theory]
[InlineData(2, 3, 5)]
[InlineData(-1, 1, 0)]
[InlineData(0, 0, 0)]
[InlineData(100, -50, 50)]
public void Sumar_VariosEscenarios_RetornaSumaCorrecta(int a, int b, int esperado)
{
    var calc = new Calculadora();
    int resultado = calc.Sumar(a, b);
    Assert.Equal(esperado, resultado);
}
// Esto genera 4 tests independientes, uno por cada [InlineData]
```

### Convenciones de nombres

El nombre del test debe describir **qué se prueba, en qué condición y qué se espera**:

```
MetodoQueSeTestea_EstadoDelTest_ResultadoEsperado
```

```csharp
// BIEN: nombres descriptivos
public void Dividir_DivisorEsCero_LanzaArgumentException()
public void ObtenerUsuario_IdExiste_RetornaUsuarioCorrecto()
public void ObtenerUsuario_IdNoExiste_RetornaNull()
public void CalcularEdad_FechaNacimientoFutura_LanzaArgumentException()

// MAL: nombres vagos
public void Test1()
public void TestDivision()
public void MetodoFunciona()
```

### Asserts comunes

```csharp
// Igualdad
Assert.Equal(esperado, actual);
Assert.NotEqual(noEsperado, actual);

// Booleanos
Assert.True(condicion);
Assert.False(condicion);

// Null
Assert.Null(objeto);
Assert.NotNull(objeto);

// Colecciones
Assert.Empty(coleccion);
Assert.NotEmpty(coleccion);
Assert.Contains(elemento, coleccion);
Assert.Single(coleccion); // Verifica que tiene exactamente 1 elemento

// Excepciones — muy importante en entrevistas
[Fact]
public void Dividir_EntreZero_LanzaArgumentException()
{
    var calc = new Calculadora();

    // Assert.Throws verifica que se lanza la excepción correcta
    var excepcion = Assert.Throws<ArgumentException>(() =>
        calc.Dividir(10, 0)
    );

    // También puedes verificar el mensaje de la excepción
    Assert.Contains("cero", excepcion.Message, StringComparison.OrdinalIgnoreCase);
}

// Para async
[Fact]
public async Task ObtenerUsuarioAsync_IdInvalido_LanzaNotFoundException()
{
    await Assert.ThrowsAsync<NotFoundException>(() =>
        _servicio.ObtenerUsuarioAsync(-1)
    );
}
```

### Qué NO testear

```csharp
// NO testear getters/setters triviales
public class Producto
{
    public string Nombre { get; set; } = ""; // No necesita test
    public decimal Precio { get; set; }       // No necesita test
}

// NO testear el framework (Entity Framework, ASP.NET, etc.)
// Eso ya tiene sus propios tests

// NO testear código sin lógica
public string ObtenerSaludo() => "Hola"; // No hay lógica que pueda fallar

// SÍ testear lógica de negocio, validaciones, cálculos, condiciones
public decimal CalcularImpuesto(decimal precio)
{
    if (precio < 0) throw new ArgumentException("Precio negativo");
    if (precio > 10000) return precio * 0.21m; // 21%
    return precio * 0.10m; // 10%
}
// Esta función SÍ necesita tests: tiene 3 ramas lógicas
```

---

## Mocks básicos con Moq

### ¿Qué es un mock y para qué sirve?

Un mock es un **objeto falso** que simula el comportamiento de una dependencia real. Sirve para:
- Aislar el código que estás probando
- Evitar llamadas reales a la base de datos, APIs externas, etc.
- Controlar exactamente qué devuelve una dependencia
- Verificar que se llamaron los métodos correctos

```
Sin mock:  [Test] → [Servicio] → [Repositorio Real] → [Base de Datos]
Con mock:  [Test] → [Servicio] → [Mock de Repositorio] (controlado por el test)
```

### Instalación

```bash
dotnet add package Moq
```

### Uso básico de Moq

```csharp
// La interfaz que vamos a mockear
public interface IRepositorioUsuarios
{
    Usuario? ObtenerPorId(int id);
    void Guardar(Usuario usuario);
    bool Existe(string email);
}

// El servicio que queremos testear
public class ServicioUsuarios
{
    private readonly IRepositorioUsuarios _repositorio;

    public ServicioUsuarios(IRepositorioUsuarios repositorio)
    {
        _repositorio = repositorio;
    }

    public string ObtenerNombreUsuario(int id)
    {
        var usuario = _repositorio.ObtenerPorId(id);
        if (usuario == null) return "Usuario no encontrado";
        return usuario.Nombre;
    }

    public void RegistrarUsuario(string nombre, string email)
    {
        if (_repositorio.Existe(email))
            throw new InvalidOperationException("El email ya está registrado");

        var usuario = new Usuario { Nombre = nombre, Email = email };
        _repositorio.Guardar(usuario);
    }
}
```

```csharp
using Moq;
using Xunit;

public class ServicioUsuariosTests
{
    [Fact]
    public void ObtenerNombreUsuario_UsuarioExiste_RetornaNombre()
    {
        // ARRANGE
        var mockRepo = new Mock<IRepositorioUsuarios>();

        // Setup: cuando se llame ObtenerPorId(1), retornar este usuario
        mockRepo.Setup(r => r.ObtenerPorId(1))
                .Returns(new Usuario { Id = 1, Nombre = "Ana García" });

        var servicio = new ServicioUsuarios(mockRepo.Object); // .Object da el objeto mock

        // ACT
        string resultado = servicio.ObtenerNombreUsuario(1);

        // ASSERT
        Assert.Equal("Ana García", resultado);
    }

    [Fact]
    public void ObtenerNombreUsuario_UsuarioNoExiste_RetornaMensajeNoEncontrado()
    {
        // ARRANGE
        var mockRepo = new Mock<IRepositorioUsuarios>();
        mockRepo.Setup(r => r.ObtenerPorId(99))
                .Returns((Usuario?)null); // Retorna null

        var servicio = new ServicioUsuarios(mockRepo.Object);

        // ACT
        string resultado = servicio.ObtenerNombreUsuario(99);

        // ASSERT
        Assert.Equal("Usuario no encontrado", resultado);
    }

    [Fact]
    public void RegistrarUsuario_EmailYaExiste_LanzaInvalidOperationException()
    {
        // ARRANGE
        var mockRepo = new Mock<IRepositorioUsuarios>();
        mockRepo.Setup(r => r.Existe("ana@mail.com"))
                .Returns(true); // Simula que el email ya existe

        var servicio = new ServicioUsuarios(mockRepo.Object);

        // ACT & ASSERT
        Assert.Throws<InvalidOperationException>(() =>
            servicio.RegistrarUsuario("Ana", "ana@mail.com")
        );
    }

    [Fact]
    public void RegistrarUsuario_EmailNuevo_LlamaAGuardar()
    {
        // ARRANGE
        var mockRepo = new Mock<IRepositorioUsuarios>();
        mockRepo.Setup(r => r.Existe("nuevo@mail.com"))
                .Returns(false);

        var servicio = new ServicioUsuarios(mockRepo.Object);

        // ACT
        servicio.RegistrarUsuario("Carlos", "nuevo@mail.com");

        // ASSERT: verificar que Guardar fue llamado exactamente una vez
        mockRepo.Verify(
            r => r.Guardar(It.Is<Usuario>(u => u.Email == "nuevo@mail.com")),
            Times.Once
        );
    }
}
```

### Métodos útiles de Moq

```csharp
// It.IsAny<T>(): acepta cualquier valor del tipo T
mockRepo.Setup(r => r.ObtenerPorId(It.IsAny<int>()))
        .Returns(new Usuario());

// It.Is<T>(): con condición específica
mockRepo.Setup(r => r.Guardar(It.Is<Usuario>(u => u.Nombre.Length > 0)))
        .Verifiable();

// Throws: simular que se lanza una excepción
mockRepo.Setup(r => r.ObtenerPorId(-1))
        .Throws<ArgumentException>();

// SetupSequence: retornar valores diferentes en llamadas sucesivas
mockRepo.SetupSequence(r => r.Existe("test@mail.com"))
        .Returns(false)  // Primera llamada
        .Returns(true);  // Segunda llamada

// Verify: verificar cuántas veces se llamó
mockRepo.Verify(r => r.Guardar(It.IsAny<Usuario>()), Times.Once);
mockRepo.Verify(r => r.Guardar(It.IsAny<Usuario>()), Times.Never);
mockRepo.Verify(r => r.Guardar(It.IsAny<Usuario>()), Times.Exactly(3));
```

---

## Testing de React con Testing Library

### Instalación

```bash
# Create React App ya incluye Testing Library
npx create-react-app mi-app --template typescript

# En proyectos existentes:
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event

# En Vite, también instalar vitest o jest
npm install --save-dev vitest @vitest/ui jsdom
```

### Filosofía: testear comportamiento, no implementación

```jsx
// MAL: testea la implementación interna (nombre de estado, métodos privados)
test('el estado "mostrar" se vuelve true al hacer clic', () => {
    const { container } = render(<Componente />);
    // Acceder al estado interno → frágil, acoplado a la implementación
});

// BIEN: testea lo que el usuario ve y hace
test('muestra el mensaje al hacer clic en el botón', async () => {
    render(<Componente />);
    await userEvent.click(screen.getByRole('button', { name: /mostrar/i }));
    expect(screen.getByText('¡Hola!')).toBeInTheDocument();
});
// Si cambias de useState a useReducer, el test sigue pasando
```

### Queries principales

```jsx
import { render, screen } from '@testing-library/react';

render(<MiComponente />);

// getBy*: lanza error si no encuentra el elemento (bueno para asegurarse de que existe)
screen.getByText('Hola mundo');                          // por texto exacto
screen.getByText(/hola/i);                               // por regex (case insensitive)
screen.getByRole('button', { name: /enviar/i });         // por rol ARIA + nombre
screen.getByRole('heading', { level: 1 });               // h1
screen.getByRole('textbox', { name: /email/i });         // input de texto
screen.getByLabelText('Nombre completo');                 // input asociado a un label
screen.getByTestId('mi-elemento');                        // por data-testid (último recurso)
screen.getByPlaceholderText('Escribe tu email...');

// queryBy*: retorna null si no encuentra (útil para verificar ausencia)
const elemento = screen.queryByText('Error de validación');
expect(elemento).not.toBeInTheDocument();

// findBy*: async, espera a que aparezca el elemento
const elemento = await screen.findByText('Datos cargados');
```

### `fireEvent` vs `userEvent`

```jsx
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// fireEvent: dispara eventos DOM directamente — simple pero menos realista
fireEvent.click(screen.getByRole('button'));
fireEvent.change(screen.getByRole('textbox'), { target: { value: 'texto' } });

// userEvent: simula la interacción real del usuario — PREFERIDO
// Incluye hover, focus, keyboard events, etc.
const user = userEvent.setup();
await user.click(screen.getByRole('button'));
await user.type(screen.getByRole('textbox'), 'Hola mundo');
await user.clear(screen.getByRole('textbox'));
await user.selectOptions(screen.getByRole('combobox'), ['opcion1']);
```

### `waitFor` para operaciones asíncronas

```jsx
import { waitFor } from '@testing-library/react';

// Cuando el DOM tarda en actualizarse (ej: después de un fetch)
await waitFor(() => {
    expect(screen.getByText('Datos cargados')).toBeInTheDocument();
});

// O usar findBy* que ya es asíncrono
const mensaje = await screen.findByText('Datos cargados');
expect(mensaje).toBeInTheDocument();
```

### Ejemplo completo: componente con botón y estado

```jsx
// Contador.jsx
import { useState } from 'react';

function Contador({ valorInicial = 0 }) {
  const [contador, setContador] = useState(valorInicial);

  return (
    <div>
      <p data-testid="valor-contador">Contador: {contador}</p>
      <button onClick={() => setContador(c => c + 1)}>Incrementar</button>
      <button onClick={() => setContador(c => c - 1)} disabled={contador <= 0}>
        Decrementar
      </button>
      <button onClick={() => setContador(0)}>Reiniciar</button>
    </div>
  );
}

export default Contador;
```

```jsx
// Contador.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // Extiende expect con matchers como toBeInTheDocument
import Contador from './Contador';

describe('Contador', () => {
  test('muestra el valor inicial por defecto (0)', () => {
    render(<Contador />);
    expect(screen.getByTestId('valor-contador')).toHaveTextContent('Contador: 0');
  });

  test('muestra el valor inicial proporcionado como prop', () => {
    render(<Contador valorInicial={5} />);
    expect(screen.getByTestId('valor-contador')).toHaveTextContent('Contador: 5');
  });

  test('incrementa el contador al hacer clic en Incrementar', async () => {
    const user = userEvent.setup();
    render(<Contador />);

    await user.click(screen.getByRole('button', { name: /incrementar/i }));

    expect(screen.getByTestId('valor-contador')).toHaveTextContent('Contador: 1');
  });

  test('decrementa el contador al hacer clic en Decrementar', async () => {
    const user = userEvent.setup();
    render(<Contador valorInicial={3} />);

    await user.click(screen.getByRole('button', { name: /decrementar/i }));

    expect(screen.getByTestId('valor-contador')).toHaveTextContent('Contador: 2');
  });

  test('el botón Decrementar está deshabilitado cuando el contador es 0', () => {
    render(<Contador valorInicial={0} />);
    const botonDecrementar = screen.getByRole('button', { name: /decrementar/i });
    expect(botonDecrementar).toBeDisabled();
  });

  test('reinicia el contador al hacer clic en Reiniciar', async () => {
    const user = userEvent.setup();
    render(<Contador valorInicial={10} />);

    await user.click(screen.getByRole('button', { name: /reiniciar/i }));

    expect(screen.getByTestId('valor-contador')).toHaveTextContent('Contador: 0');
  });
});
```

### Ejemplo con llamada asíncrona (fetch)

```jsx
// ListaUsuarios.jsx
import { useState, useEffect } from 'react';

function ListaUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/usuarios')
      .then(res => res.json())
      .then(data => { setUsuarios(data); setCargando(false); })
      .catch(() => { setError('Error al cargar usuarios'); setCargando(false); });
  }, []);

  if (cargando) return <p>Cargando...</p>;
  if (error) return <p role="alert">{error}</p>;

  return (
    <ul>
      {usuarios.map(u => <li key={u.id}>{u.nombre}</li>)}
    </ul>
  );
}
```

```jsx
// ListaUsuarios.test.jsx
import { render, screen } from '@testing-library/react';
import ListaUsuarios from './ListaUsuarios';

// Mockear fetch globalmente para este archivo de tests
global.fetch = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

test('muestra "Cargando..." mientras se obtienen los datos', () => {
  // fetch nunca resuelve — simula carga lenta
  fetch.mockImplementation(() => new Promise(() => {}));

  render(<ListaUsuarios />);

  expect(screen.getByText('Cargando...')).toBeInTheDocument();
});

test('muestra la lista de usuarios cuando la carga es exitosa', async () => {
  fetch.mockResolvedValue({
    json: () => Promise.resolve([
      { id: 1, nombre: 'Ana García' },
      { id: 2, nombre: 'Carlos López' },
    ]),
  });

  render(<ListaUsuarios />);

  // findBy* espera a que aparezcan los elementos
  expect(await screen.findByText('Ana García')).toBeInTheDocument();
  expect(screen.getByText('Carlos López')).toBeInTheDocument();
});

test('muestra un error cuando la carga falla', async () => {
  fetch.mockRejectedValue(new Error('Network error'));

  render(<ListaUsuarios />);

  const error = await screen.findByRole('alert');
  expect(error).toHaveTextContent('Error al cargar usuarios');
});
```

---

## Cobertura de Código (Code Coverage)

### Qué mide

- **Line coverage**: porcentaje de líneas ejecutadas por los tests
- **Branch coverage**: porcentaje de ramas (if/else, switch, ternarios) ejecutadas
- **Function coverage**: porcentaje de funciones/métodos llamados

### Cómo ejecutar en .NET

```bash
# Ejecutar tests con cobertura
dotnet test --collect:"XPlat Code Coverage"

# Instalar la herramienta de reporte (una vez)
dotnet tool install -g dotnet-reportgenerator-globaltool

# Generar reporte HTML
reportgenerator -reports:"**/coverage.cobertura.xml" -targetdir:"coverage-report" -reporttypes:Html

# Abrir coverage-report/index.html en el navegador
```

### En JavaScript con Jest

```json
// package.json
{
  "scripts": {
    "test:coverage": "jest --coverage"
  },
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70
      }
    }
  }
}
```

```bash
npm run test:coverage
# Genera un reporte en /coverage/lcov-report/index.html
```

### El 100% de coverage NO garantiza ausencia de bugs

```csharp
// Este test tiene 100% de coverage pero NO detecta el bug
public int Dividir(int a, int b) => a / b; // Bug: no maneja b=0

[Fact]
public void Dividir_Test()
{
    var calc = new Calculadora();
    Assert.Equal(5, calc.Dividir(10, 2)); // Pasa, 100% coverage
    // Pero nunca testea Dividir(10, 0) → DivideByZeroException en producción
}
```

> **Objetivo realista**: apunta a **70-80% de coverage** en código de negocio crítico. No te obsesiones con el 100%; enfócate en testear los caminos importantes y los casos límite.

---

## Buenas Prácticas

### Un assert principal por test

```csharp
// MAL: múltiples asserts no relacionados — si el primero falla, no sabes qué pasó con los demás
[Fact]
public void TestVarios()
{
    var calc = new Calculadora();
    Assert.Equal(5, calc.Sumar(2, 3));
    Assert.Equal(1, calc.Restar(3, 2));
    Assert.Equal(6, calc.Multiplicar(2, 3));
}

// BIEN: un test por comportamiento
[Fact]
public void Sumar_DosPositivos_RetornaSumaCorrecta()
{
    Assert.Equal(5, new Calculadora().Sumar(2, 3));
}

[Fact]
public void Restar_NumeroMenorDeNumeroMayor_RetornaDiferenciaCorrecta()
{
    Assert.Equal(1, new Calculadora().Restar(3, 2));
}
```

### Tests independientes entre sí

```csharp
// MAL: el Test2 depende de que Test1 se haya ejecutado antes
private static List<int> _listaCompartida = new();

[Fact]
public void Test1_AgregaElemento() => _listaCompartida.Add(1);

[Fact]
public void Test2_VerificaElemento() => Assert.Contains(1, _listaCompartida); // Puede fallar

// BIEN: cada test crea su propio estado
[Fact]
public void Test1_AgregaElemento()
{
    var lista = new List<int>(); // Estado local
    lista.Add(1);
    Assert.Contains(1, lista);
}
```

### Tests deterministas

```csharp
// MAL: depende de la hora actual — puede fallar en ciertas horas o fechas
[Fact]
public void EsHorarioLaboral_DevuelveResultadoCorrecto()
{
    var servicio = new ServicioHorario();
    bool resultado = servicio.EsHorarioLaboral(); // Usa DateTime.Now internamente
    Assert.True(resultado); // ¡Falla en fines de semana!
}

// BIEN: inyectar la dependencia de tiempo para poder controlarla en tests
public interface IReloj { DateTime Ahora { get; } }

public class ServicioHorario
{
    private readonly IReloj _reloj;
    public ServicioHorario(IReloj reloj) => _reloj = reloj;
    public bool EsHorarioLaboral() => _reloj.Ahora.Hour >= 9 && _reloj.Ahora.Hour < 18;
}

[Fact]
public void EsHorarioLaboral_ALasMedioDia_RetornaTrue()
{
    var mockReloj = new Mock<IReloj>();
    mockReloj.Setup(r => r.Ahora).Returns(new DateTime(2024, 1, 15, 12, 0, 0)); // Lunes 12:00
    var servicio = new ServicioHorario(mockReloj.Object);
    Assert.True(servicio.EsHorarioLaboral());
}
```

### Nombres descriptivos

```csharp
// MAL
public void Test1() { }
public void ProbarLogin() { }
public void VerificarEmailError() { }

// BIEN — el nombre es una oración que describe el escenario completo
public void Login_CredencialesCorrectas_RetornaTokenJwt() { }
public void Login_PasswordIncorrecto_LanzaUnauthorizedException() { }
public void Login_UsuarioNoExiste_LanzaNotFoundException() { }
public void Login_UsuarioBloqueado_LanzaAccountLockedException() { }
```

---

## Resumen para la Entrevista

| Concepto | Punto clave |
|---------|-------------|
| Pirámide | Muchos unit tests, pocos E2E |
| AAA | Arrange-Act-Assert — estructura de todo test |
| `[Fact]` vs `[Theory]` | Theory para múltiples casos con InlineData |
| Mock | Objeto falso para aislar dependencias |
| `getByRole` | Forma preferida de buscar elementos en React Testing Library |
| `userEvent` vs `fireEvent` | Prefiere userEvent — más realista |
| Coverage | 70-80% en código crítico es un objetivo razonable |
| Determinismo | Los tests no deben depender de la hora, DB real, ni estado externo |

> **Consejo para entrevistas**: Si te piden escribir un test en vivo, empieza por el nombre descriptivo y la estructura AAA. Demuestra que entiendes qué estás probando y por qué, antes de escribir el código del test.
