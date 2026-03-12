---
id: patrones-basicos
title: Patrones y Principios Básicos
sidebar_position: 12
---

# Patrones y Principios Básicos

Los patrones de diseño y los principios de programación son el lenguaje común de los equipos de desarrollo profesionales. No es necesario memorizar todos los patrones del libro "Gang of Four", pero sí entender los más frecuentes y poder aplicarlos en una entrevista.

---

## Principios de Diseño Fundamentales

### DRY — Don't Repeat Yourself

**"Cada pieza de conocimiento debe tener una representación única, no ambigua y autoritativa dentro de un sistema."**

Si encuentras el mismo código en dos lugares, es candidato a ser extraído a un método, clase o constante compartida.

```csharp
// ❌ VIOLACIÓN de DRY: la lógica de validación de email está repetida en 3 lugares
public class ServicioRegistro
{
    public void RegistrarCliente(string email)
    {
        if (string.IsNullOrEmpty(email) || !email.Contains("@"))
            throw new ArgumentException("Email inválido");
        // ... lógica de registro
    }
}

public class ServicioNotificaciones
{
    public void EnviarEmail(string email)
    {
        if (string.IsNullOrEmpty(email) || !email.Contains("@"))
            throw new ArgumentException("Email inválido"); // Duplicado
        // ... lógica de envío
    }
}

// ✅ APLICANDO DRY: extraer la validación a un lugar único
public static class ValidadorEmail
{
    public static bool EsValido(string email) =>
        !string.IsNullOrEmpty(email) && email.Contains("@");

    public static void Validar(string email)
    {
        if (!EsValido(email))
            throw new ArgumentException("Email inválido");
    }
}

public class ServicioRegistro
{
    public void RegistrarCliente(string email)
    {
        ValidadorEmail.Validar(email); // Un solo lugar, una sola responsabilidad
        // ... lógica de registro
    }
}

public class ServicioNotificaciones
{
    public void EnviarEmail(string email)
    {
        ValidadorEmail.Validar(email); // Reutilizamos la misma lógica
        // ... lógica de envío
    }
}
// Ahora, si las reglas de validación cambian, solo se cambia en UN lugar
```

> **Cuidado con el over-DRY**: No abstraigas dos cosas solo porque el código parece similar. Si la razón para cambiarlas es diferente, probablemente deban estar separadas.

### KISS — Keep It Simple, Stupid

**Prefiere la solución más simple que funcione.** La complejidad innecesaria hace el código difícil de leer, mantener y depurar.

```csharp
// ❌ Over-engineering: solución compleja para un problema simple
public interface IEstrategiaCalculoEdad { int Calcular(DateTime fechaNacimiento); }
public class CalculadoraEdadPorAños : IEstrategiaCalculoEdad { /* ... */ }
public class FabricaCalculadorasEdad
{
    public IEstrategiaCalculoEdad Crear(string tipo) { /* ... */ }
}
// 3 clases para calcular una edad... KISS dice: ¡no!

// ✅ KISS: solución directa y legible
public int CalcularEdad(DateTime fechaNacimiento)
{
    int edad = DateTime.Today.Year - fechaNacimiento.Year;
    if (fechaNacimiento.Date > DateTime.Today.AddYears(-edad))
        edad--;
    return edad;
}
```

```javascript
// ❌ Over-engineering en JavaScript
const procesarNombres = (nombres) => {
  const procesador = new NombreProcesador(new FormateadorMayusculas());
  return procesador.procesar(nombres.map(n => new NombreWrapper(n)));
};

// ✅ KISS
const procesarNombres = (nombres) =>
  nombres.map(n => n.trim().toLowerCase());
```

### YAGNI — You Aren't Gonna Need It

**No agregues funcionalidad "por si acaso" o "para el futuro".** Solo implementa lo que se necesita ahora.

```csharp
// ❌ YAGNI violado: agregar funcionalidad que nadie pidió
public class ServicioProductos
{
    // Pedido: listar productos
    public List<Producto> ObtenerTodos() { /* ... */ }

    // "Por si acaso lo necesitamos después":
    public Producto ObtenerPorCodigoBarras(string codigo) { /* nunca se usará */ }
    public List<Producto> ObtenerPorCategoria(int id) { /* aún no hay categorías */ }
    public void ExportarAExcel() { /* nadie lo pidió */ }
    public void SincronizarConSAP() { /* SAP ni existe en la empresa */ }
}

// ✅ YAGNI aplicado: solo lo que se necesita ahora
public class ServicioProductos
{
    public List<Producto> ObtenerTodos() { /* la única función requerida */ }
}
// Cuando se necesite más, se agrega. No antes.
```

> **YAGNI y KISS trabajan juntos**: primero haz que funcione (KISS), no agregues lo que no necesitas (YAGNI), y no te repitas (DRY). Son tres caras del mismo principio: **simplicidad**.

### Principio de Responsabilidad Única (SRP)

**Una clase/método debe tener una sola razón para cambiar.** En términos prácticos: hace **una sola cosa**.

```csharp
// ❌ Violación de SRP: esta clase hace demasiado
public class GestorPedidos
{
    // Responsabilidad 1: lógica de negocio
    public void ProcesarPedido(Pedido pedido) { /* ... */ }
    public decimal CalcularTotal(Pedido pedido) { /* ... */ }

    // Responsabilidad 2: acceso a datos
    public void GuardarEnBaseDeDatos(Pedido pedido) { /* ... */ }
    public List<Pedido> ObtenerHistorial(int clienteId) { /* ... */ }

    // Responsabilidad 3: envío de emails
    public void EnviarConfirmacion(Pedido pedido) { /* ... */ }
    public void EnviarFactura(Pedido pedido) { /* ... */ }

    // Responsabilidad 4: generación de reportes
    public byte[] GenerarReportePDF(Pedido pedido) { /* ... */ }
}
// Esta clase tiene 4 razones para cambiar → 4 responsabilidades → violación de SRP

// ✅ SRP aplicado: una responsabilidad por clase
public class ServicioPedidos        { /* solo lógica de negocio */ }
public class RepositorioPedidos     { /* solo acceso a datos */ }
public class ServicioNotificaciones { /* solo envío de emails */ }
public class GeneradorReportes      { /* solo generación de PDFs */ }
```

**Señales de violación de SRP:**
- La clase tiene más de 200-300 líneas
- El nombre de un método usa "Y" o "And": `ProcesarYGuardar`, `ValidarYEnviar`
- La clase importa muchas dependencias no relacionadas entre sí
- No puedes describir qué hace la clase en una oración corta

```csharp
// Señal de alarma: método con "Y" en el nombre
public void ValidarYGuardarYEnviarEmail(Usuario usuario) { /* 3 responsabilidades */ }

// Mejor: tres métodos separados
public void Validar(Usuario usuario) { /* ... */ }
public void Guardar(Usuario usuario) { /* ... */ }
public void EnviarEmailBienvenida(Usuario usuario) { /* ... */ }
```

---

## Patrón MVC (Model-View-Controller)

### Flujo de una request en MVC

```
[Cliente/Browser]
       │
       │ HTTP Request: GET /productos/1
       ▼
[Router/Middleware]
       │
       ▼
[Controller] ← Recibe la request, coordina la respuesta
       │
       │ Llama a servicios/repositorios
       ▼
[Model/Service] ← Contiene la lógica de negocio
       │
       │ Lee/escribe datos
       ▼
[Base de Datos]
       │
       │ Retorna datos
       ▼
[Controller] ← Recibe el resultado
       │
       │ Pasa los datos a la vista
       ▼
[View/Response] ← Genera HTML o JSON
       │
       ▼
[Cliente/Browser] ← Recibe la respuesta HTTP
```

### MVC en ASP.NET Core

```csharp
// MODEL — representa los datos y la lógica de negocio
public class Producto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public decimal Precio { get; set; }
    public int Stock { get; set; }
}

// SERVICE — lógica de negocio (en apps reales, el Model se separa del Service)
public class ServicioProductos
{
    private readonly IRepositorioProductos _repo;
    public ServicioProductos(IRepositorioProductos repo) => _repo = repo;

    public async Task<Producto?> ObtenerPorIdAsync(int id) =>
        await _repo.ObtenerPorIdAsync(id);
}

// CONTROLLER — recibe la request, delega al servicio, retorna la respuesta
[ApiController]
[Route("api/[controller]")]
public class ProductosController : ControllerBase
{
    private readonly ServicioProductos _servicio;

    public ProductosController(ServicioProductos servicio)
    {
        _servicio = servicio;
    }

    // GET api/productos/1
    [HttpGet("{id}")]
    public async Task<ActionResult<Producto>> ObtenerProducto(int id)
    {
        var producto = await _servicio.ObtenerPorIdAsync(id);
        if (producto == null) return NotFound();
        return Ok(producto);
    }
}
```

### MVC en React: no existe MVC puro, pero se separa la lógica

En React no existe un "Controller" explícito, pero la separación de responsabilidades se logra con hooks y servicios:

```jsx
// "MODEL": types/interfaces que representan los datos
// types/Producto.ts
export interface Producto {
  id: number;
  nombre: string;
  precio: number;
}

// "SERVICE": lógica de llamadas a la API (equivalente a un repositorio)
// services/productosService.ts
export const productosService = {
  async obtenerPorId(id: number): Promise<Producto> {
    const response = await fetch(`/api/productos/${id}`);
    if (!response.ok) throw new Error('Producto no encontrado');
    return response.json();
  }
};

// "CONTROLLER" implícito: custom hook con la lógica de estado
// hooks/useProducto.ts
export function useProducto(id: number) {
  const [producto, setProducto] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    productosService.obtenerPorId(id)
      .then(setProducto)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [id]);

  return { producto, cargando, error };
}

// "VIEW": componente que solo renderiza, sin lógica de negocio
// components/DetalleProducto.tsx
function DetalleProducto({ id }: { id: number }) {
  const { producto, cargando, error } = useProducto(id);

  if (cargando) return <p>Cargando...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!producto) return null;

  return (
    <div>
      <h1>{producto.nombre}</h1>
      <p>Precio: ${producto.precio}</p>
    </div>
  );
}
```

---

## Patrón MVVM (Model-View-ViewModel)

### Diferencia con MVC

| Aspecto | MVC | MVVM |
|---------|-----|------|
| Comunicación | Controller → View (unidireccional) | ViewModel ↔ View (bidireccional) |
| ViewModel | No existe | Estado + lógica de UI |
| Uso típico | Web tradicional | SPA, apps móviles, WPF |

### MVVM implícito en React con `useState`

React implementa MVVM de forma natural: el `useState` + la lógica del componente actúan como el ViewModel.

```jsx
// MODEL: datos que vienen del servidor (DTO)
interface UsuarioDto {
  id: number;
  nombre: string;
  email: string;
}

// VIEWMODEL: estado de UI + lógica de presentación
// (separado del modelo de datos del servidor)
interface FormularioUsuarioViewModel {
  nombre: string;           // Estado del input
  email: string;            // Estado del input
  nombreError: string;      // Validación de UI
  emailError: string;       // Validación de UI
  enviando: boolean;        // Estado de la operación async
  guardadoExitosamente: boolean; // Feedback al usuario
}

// VIEW: componente que usa el ViewModel
function FormularioUsuario() {
  // El ViewModel es el estado del componente
  const [viewModel, setViewModel] = useState<FormularioUsuarioViewModel>({
    nombre: '',
    email: '',
    nombreError: '',
    emailError: '',
    enviando: false,
    guardadoExitosamente: false,
  });

  const validar = (): boolean => {
    const errores = {
      nombreError: viewModel.nombre.length < 2 ? 'El nombre es muy corto' : '',
      emailError: !viewModel.email.includes('@') ? 'Email inválido' : '',
    };
    setViewModel(prev => ({ ...prev, ...errores }));
    return !errores.nombreError && !errores.emailError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;

    setViewModel(prev => ({ ...prev, enviando: true }));

    await fetch('/api/usuarios', {
      method: 'POST',
      body: JSON.stringify({ nombre: viewModel.nombre, email: viewModel.email }),
    });

    setViewModel(prev => ({ ...prev, enviando: false, guardadoExitosamente: true }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={viewModel.nombre}
        onChange={e => setViewModel(prev => ({ ...prev, nombre: e.target.value }))}
        placeholder="Nombre"
      />
      {viewModel.nombreError && <span>{viewModel.nombreError}</span>}

      <input
        value={viewModel.email}
        onChange={e => setViewModel(prev => ({ ...prev, email: e.target.value }))}
        placeholder="Email"
      />
      {viewModel.emailError && <span>{viewModel.emailError}</span>}

      <button type="submit" disabled={viewModel.enviando}>
        {viewModel.enviando ? 'Guardando...' : 'Guardar'}
      </button>

      {viewModel.guardadoExitosamente && <p>¡Usuario guardado correctamente!</p>}
    </form>
  );
}
```

---

## DTO (Data Transfer Object)

### ¿Qué es y para qué sirve?

Un DTO es un objeto simple que **transporta datos entre capas** o entre el servidor y el cliente. No tiene lógica de negocio; solo propiedades.

**Problema que resuelve**: las entidades de la base de datos a menudo tienen campos que **no deben exponerse** a la API (passwordHash, campos internos, etc.) o que la UI no necesita.

### Diferencia entre Entidad y DTO

```csharp
// ENTIDAD (mapea a la tabla de la base de datos)
public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";  // ← NUNCA exponer en la API
    public string SaltSeguridad { get; set; } = ""; // ← NUNCA exponer en la API
    public DateTime FechaCreacion { get; set; }
    public DateTime? UltimoLogin { get; set; }
    public bool Activo { get; set; }
    public List<Pedido> Pedidos { get; set; } = []; // Navegación a otra entidad
}

// DTO para GET /api/usuarios/{id} — solo expone lo seguro y necesario
public class UsuarioDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = "";
    public string Email { get; set; } = "";
    public DateTime FechaCreacion { get; set; }
}

// DTO para POST /api/usuarios — lo que el cliente envía para crear un usuario
public class CrearUsuarioDto
{
    public string Nombre { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = ""; // Texto plano — se hashea en el servidor
}

// DTO para PATCH /api/usuarios/{id} — actualización parcial
public class ActualizarUsuarioDto
{
    public string? Nombre { get; set; }  // null = no actualizar
    public string? Email { get; set; }
}
```

### AutoMapper básico

AutoMapper automatiza la conversión entre Entidades y DTOs, evitando código repetitivo.

```bash
dotnet add package AutoMapper
dotnet add package AutoMapper.Extensions.Microsoft.DependencyInjection
```

```csharp
// Configurar el perfil de mapeo
public class PerfilUsuario : Profile
{
    public PerfilUsuario()
    {
        // Mapeo automático cuando los nombres de propiedades coinciden
        CreateMap<Usuario, UsuarioDto>();

        // Mapeo con transformaciones personalizadas
        CreateMap<CrearUsuarioDto, Usuario>()
            .ForMember(dest => dest.FechaCreacion, opt => opt.MapFrom(_ => DateTime.UtcNow))
            .ForMember(dest => dest.Activo, opt => opt.MapFrom(_ => true))
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore()); // Se asigna manualmente
    }
}

// Registrar en Program.cs
builder.Services.AddAutoMapper(typeof(PerfilUsuario));

// Uso en un Controller
[ApiController]
[Route("api/[controller]")]
public class UsuariosController : ControllerBase
{
    private readonly IMapper _mapper;
    private readonly IRepositorioUsuarios _repo;

    public UsuariosController(IMapper mapper, IRepositorioUsuarios repo)
    {
        _mapper = mapper;
        _repo = repo;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<UsuarioDto>> ObtenerUsuario(int id)
    {
        var usuario = await _repo.ObtenerPorIdAsync(id);
        if (usuario == null) return NotFound();

        var dto = _mapper.Map<UsuarioDto>(usuario); // Sin AutoMapper: asignación manual de cada campo
        return Ok(dto);
    }

    [HttpPost]
    public async Task<ActionResult<UsuarioDto>> CrearUsuario(CrearUsuarioDto dto)
    {
        var usuario = _mapper.Map<Usuario>(dto);
        usuario.PasswordHash = HashPassword(dto.Password); // Lógica que AutoMapper no puede hacer

        await _repo.GuardarAsync(usuario);
        return CreatedAtAction(nameof(ObtenerUsuario), new { id = usuario.Id },
            _mapper.Map<UsuarioDto>(usuario));
    }
}
```

---

## Patrón Repository (Introducción)

### ¿Qué problema resuelve?

Sin el patrón Repository, los servicios contienen código de acceso a datos directamente. Esto:
- Mezcla lógica de negocio con lógica de persistencia (viola SRP)
- Hace muy difícil escribir tests unitarios (no se puede mockear EF Core fácilmente)
- Acopla el código al ORM específico que se usa

### Implementación básica

```csharp
// Interfaz genérica del repositorio
public interface IRepositorio<T> where T : class
{
    Task<T?> ObtenerPorIdAsync(int id);
    Task<List<T>> ObtenerTodosAsync();
    Task AgregarAsync(T entidad);
    Task ActualizarAsync(T entidad);
    Task EliminarAsync(int id);
}

// Interfaz específica para Usuario (puede extender la genérica)
public interface IRepositorioUsuarios : IRepositorio<Usuario>
{
    Task<Usuario?> ObtenerPorEmailAsync(string email);
    Task<List<Usuario>> ObtenerActivosAsync();
}

// Implementación concreta con Entity Framework Core
public class RepositorioUsuarios : IRepositorioUsuarios
{
    private readonly AppDbContext _contexto;

    public RepositorioUsuarios(AppDbContext contexto)
    {
        _contexto = contexto;
    }

    public async Task<Usuario?> ObtenerPorIdAsync(int id) =>
        await _contexto.Usuarios.FindAsync(id);

    public async Task<List<Usuario>> ObtenerTodosAsync() =>
        await _contexto.Usuarios.ToListAsync();

    public async Task AgregarAsync(Usuario usuario)
    {
        await _contexto.Usuarios.AddAsync(usuario);
        await _contexto.SaveChangesAsync();
    }

    public async Task ActualizarAsync(Usuario usuario)
    {
        _contexto.Usuarios.Update(usuario);
        await _contexto.SaveChangesAsync();
    }

    public async Task EliminarAsync(int id)
    {
        var usuario = await ObtenerPorIdAsync(id);
        if (usuario != null)
        {
            _contexto.Usuarios.Remove(usuario);
            await _contexto.SaveChangesAsync();
        }
    }

    public async Task<Usuario?> ObtenerPorEmailAsync(string email) =>
        await _contexto.Usuarios.FirstOrDefaultAsync(u => u.Email == email);

    public async Task<List<Usuario>> ObtenerActivosAsync() =>
        await _contexto.Usuarios.Where(u => u.Activo).ToListAsync();
}

// Registro en Program.cs
builder.Services.AddScoped<IRepositorioUsuarios, RepositorioUsuarios>();
```

### Por qué facilita el testing

```csharp
// El servicio depende de la INTERFAZ, no de la implementación concreta
public class ServicioUsuarios
{
    private readonly IRepositorioUsuarios _repo;

    public ServicioUsuarios(IRepositorioUsuarios repo) // ← Recibe la interfaz
    {
        _repo = repo;
    }

    public async Task<bool> EmailYaRegistradoAsync(string email)
    {
        var usuario = await _repo.ObtenerPorEmailAsync(email);
        return usuario != null;
    }
}

// En los tests: se puede mockear la interfaz sin necesidad de base de datos real
[Fact]
public async Task EmailYaRegistrado_EmailExiste_RetornaTrue()
{
    var mockRepo = new Mock<IRepositorioUsuarios>();
    mockRepo.Setup(r => r.ObtenerPorEmailAsync("existe@mail.com"))
            .ReturnsAsync(new Usuario { Email = "existe@mail.com" });

    var servicio = new ServicioUsuarios(mockRepo.Object);

    bool resultado = await servicio.EmailYaRegistradoAsync("existe@mail.com");

    Assert.True(resultado);
}
```

---

## Dependency Injection (Inyección de Dependencias)

### El problema: alto acoplamiento

```csharp
// ❌ SIN DI: alto acoplamiento
public class ServicioReportes
{
    private readonly RepositorioVentas _repo;

    public ServicioReportes()
    {
        _repo = new RepositorioVentas(); // Dependencia "hardcoded"
        // Problemas:
        // 1. No se puede testear sin la BD real
        // 2. No se puede cambiar la implementación sin modificar esta clase
        // 3. Si RepositorioVentas necesita parámetros, este constructor se complica
    }
}
```

### La solución: Constructor Injection

```csharp
// ✅ CON DI: bajo acoplamiento
public class ServicioReportes
{
    private readonly IRepositorioVentas _repo; // Depende de la interfaz, no de la clase

    // Las dependencias se "inyectan" desde afuera
    public ServicioReportes(IRepositorioVentas repo)
    {
        _repo = repo;
    }

    public async Task<ReporteDto> GenerarReporteMensualAsync(int mes, int año)
    {
        var ventas = await _repo.ObtenerVentasPorMesAsync(mes, año);
        return new ReporteDto
        {
            Total = ventas.Sum(v => v.Monto),
            CantidadVentas = ventas.Count
        };
    }
}
// Ventajas:
// 1. Fácil de testear — puedes pasar un mock de IRepositorioVentas
// 2. Fácil de cambiar — si cambias la BD, solo cambias la implementación
// 3. Las dependencias son explícitas y visibles en el constructor
```

### Cómo .NET Core gestiona las dependencias

```csharp
// Program.cs — registro de dependencias en el contenedor IoC
var builder = WebApplication.CreateBuilder(args);

// AddTransient: crea una nueva instancia CADA VEZ que se solicita
// Usa para servicios sin estado, ligeros
builder.Services.AddTransient<IServicioEmail, ServicioEmailSmtp>();

// AddScoped: crea UNA instancia por REQUEST HTTP
// Usa para servicios con estado por request (DbContext, Unit of Work)
builder.Services.AddScoped<IRepositorioUsuarios, RepositorioUsuarios>();
builder.Services.AddScoped<ServicioUsuarios>(); // La misma instancia durante toda la request

// AddSingleton: crea UNA instancia para toda la vida de la aplicación
// Usa para servicios costosos de crear o que mantienen estado global
builder.Services.AddSingleton<IServicioCache, ServicioCacheEnMemoria>();

var app = builder.Build();
```

```
┌─────────────────────────────────────────────────────────────┐
│  Lifetime      │  Instancias          │  Cuándo usar        │
├────────────────┼──────────────────────┼─────────────────────┤
│  Transient     │  Nueva cada vez      │  Sin estado         │
│  Scoped        │  Una por request     │  DbContext, UoW     │
│  Singleton     │  Una por app         │  Config, Cache      │
└─────────────────────────────────────────────────────────────┘
```

### Ejemplo completo con DI

```csharp
// Interfaces
public interface IServicioEmail
{
    Task EnviarAsync(string destinatario, string asunto, string cuerpo);
}

// Implementación real (producción)
public class ServicioEmailSmtp : IServicioEmail
{
    public async Task EnviarAsync(string destinatario, string asunto, string cuerpo)
    {
        // Lógica real de envío con SmtpClient
        await Task.Delay(100); // Simulando envío
        Console.WriteLine($"Email enviado a {destinatario}");
    }
}

// Implementación para tests/desarrollo
public class ServicioEmailFalso : IServicioEmail
{
    public List<string> EmailsEnviados { get; } = new();

    public Task EnviarAsync(string destinatario, string asunto, string cuerpo)
    {
        EmailsEnviados.Add(destinatario);
        return Task.CompletedTask; // No hace nada real
    }
}

// El servicio que usa el email
public class ServicioRegistroUsuarios
{
    private readonly IRepositorioUsuarios _repo;
    private readonly IServicioEmail _email;

    // DI: ambas dependencias inyectadas en el constructor
    public ServicioRegistroUsuarios(IRepositorioUsuarios repo, IServicioEmail email)
    {
        _repo = repo;
        _email = email;
    }

    public async Task RegistrarAsync(string nombre, string emailUsuario)
    {
        var usuario = new Usuario { Nombre = nombre, Email = emailUsuario };
        await _repo.AgregarAsync(usuario);
        await _email.EnviarAsync(emailUsuario, "Bienvenido", $"Hola {nombre}!");
    }
}
```

---

## Convenciones de Código

### Naming Conventions en C#

```csharp
// PascalCase: clases, interfaces, métodos, propiedades, eventos, namespaces
public class GestorPedidos { }
public interface IRepositorioProductos { }
public void CalcularDescuento() { }
public string NombreCompleto { get; set; }
public event EventHandler PedidoCreado;
namespace MiEmpresa.Ventas.Servicios { }

// camelCase: variables locales, parámetros de métodos
string nombreCliente = "Ana García";
int cantidadProductos = 5;
public void Procesar(int pedidoId, string codigoDescuento) { }

// _camelCase (con guión bajo): campos privados de instancia
private readonly IRepositorio _repositorio;
private string _cacheNombre = "";

// UPPER_SNAKE_CASE: constantes
public const int MAX_INTENTOS_LOGIN = 3;
public const string URL_BASE_API = "https://api.miempresa.com";

// Prefijo I: interfaces
public interface IServicioEmail { }
public interface IRepositorio<T> { }

// Sufijos descriptivos:
// Dto, Request, Response: para objetos de transferencia
public class CrearUsuarioDto { }
public class LoginRequest { }
public class ProductoResponse { }
// Exception: para excepciones personalizadas
public class UsuarioNoEncontradoException : Exception { }
// Tests: sufijo Tests en la clase
public class ServicioUsuariosTests { }
```

### Naming Conventions en JavaScript/TypeScript

```typescript
// camelCase: variables, funciones, parámetros, propiedades de objetos
const nombreUsuario = 'Ana García';
const cantidadItems = 5;
function calcularDescuento(precio: number, porcentaje: number): number { return 0; }
const usuario = { primerNombre: 'Ana', apellido: 'García' };

// PascalCase: clases, interfaces, tipos, enums, componentes React
class GestorPedidos { }
interface RepositorioProductos { }
type ResultadoOperacion = { exitoso: boolean; mensaje: string };
enum EstadoPedido { Pendiente, Procesando, Enviado, Entregado }
function DetalleProducto({ id }: { id: number }) { return null; } // Componente React

// UPPER_SNAKE_CASE: constantes globales
const MAX_INTENTOS_LOGIN = 3;
const URL_BASE_API = 'https://api.miempresa.com';

// Convenciones de React:
// - Componentes: PascalCase → ListaProductos, DetalleUsuario
// - Hooks personalizados: prefijo "use" en camelCase → useCarrito, useAutenticacion
// - Archivos de componentes: PascalCase.tsx → ListaProductos.tsx
// - Archivos de hooks: camelCase.ts → useCarrito.ts
// - Archivos de servicios: camelCase.ts → productosService.ts

// Ejemplo completo:
interface ProductoDto {
  id: number;
  nombreProducto: string;
  precioUnitario: number;
}

const MAX_PRODUCTOS_PAGINA = 20;

async function obtenerProductos(pagina: number): Promise<ProductoDto[]> {
  const respuesta = await fetch(`/api/productos?pagina=${pagina}`);
  return respuesta.json();
}

function useProductos(pagina: number) {
  const [productos, setProductos] = useState<ProductoDto[]>([]);
  // ...
  return { productos };
}

function ListaProductos({ pagina }: { pagina: number }) {
  const { productos } = useProductos(pagina);
  return <ul>{productos.map(p => <li key={p.id}>{p.nombreProducto}</li>)}</ul>;
}
```

### Comentarios: cuándo sí y cuándo no

```csharp
// ❌ Comentario innecesario: el código ya se explica solo
// Incrementar contador en 1
contador++;

// Verificar si el usuario es nulo
if (usuario == null)
{
    // Lanzar excepción
    throw new ArgumentNullException(nameof(usuario));
}

// ✅ Comentario útil: explica una decisión no obvia (el "por qué", no el "qué")
// Usamos UTC internamente y convertimos a la zona horaria del usuario solo en la UI
// para evitar bugs con el horario de verano y facilitar las comparaciones
var fechaExpiracion = DateTime.UtcNow.AddHours(24);

// ✅ Comentario útil: explica una limitación o workaround
// WORKAROUND: La API de pagos no soporta decimales con más de 2 cifras.
// Redondeamos aquí hasta que migren a la versión v2 de su API (previsto Q2 2025).
var montoRedondeado = Math.Round(monto, 2, MidpointRounding.AwayFromZero);

// ✅ Comentario útil: explica una fórmula o algoritmo complejo
// Calculamos el descuento compuesto: d_total = 1 - (1-d1)(1-d2)...
// que es diferente a simplemente sumar los porcentajes
decimal descuentoCompuesto = 1 - descuentos.Aggregate(1m, (acc, d) => acc * (1 - d / 100));

// ✅ TODO o FIXME con contexto (en código de trabajo en progreso)
// TODO: Implementar paginación cuando el número de productos supere 1000 (Issue #234)
var todosLosProductos = await _repo.ObtenerTodosAsync();
```

### Estructura de carpetas estándar en un proyecto .NET

```
MiProyecto/
├── Controllers/          # Controladores de la API — reciben requests HTTP
│   ├── UsuariosController.cs
│   └── ProductosController.cs
│
├── Services/             # Lógica de negocio
│   ├── IServicioUsuarios.cs    (interfaz)
│   └── ServicioUsuarios.cs     (implementación)
│
├── Repositories/         # Acceso a datos
│   ├── IRepositorioUsuarios.cs
│   └── RepositorioUsuarios.cs
│
├── Models/               # Entidades de dominio / base de datos
│   ├── Usuario.cs
│   └── Producto.cs
│
├── DTOs/                 # Objetos de transferencia de datos
│   ├── UsuarioDto.cs
│   ├── CrearUsuarioDto.cs
│   └── ActualizarUsuarioDto.cs
│
├── Data/                 # Configuración de Entity Framework
│   ├── AppDbContext.cs
│   └── Migrations/
│
├── Middleware/           # Middleware personalizado de ASP.NET Core
│   └── ManejadorErroresGlobal.cs
│
├── Extensions/           # Métodos de extensión y configuración
│   └── ServiceCollectionExtensions.cs
│
├── Program.cs            # Punto de entrada, registro de servicios
└── appsettings.json      # Configuración de la aplicación
```

```
MiProyecto.Tests/
├── Controllers/          # Tests de integración de controllers
├── Services/             # Tests unitarios de servicios
│   └── ServicioUsuariosTests.cs
├── Repositories/         # Tests de integración de repositorios
└── Helpers/              # Utilidades compartidas entre tests
    └── TestDbContextFactory.cs
```

---

## Resumen para la Entrevista

| Principio/Patrón | Frase clave para la entrevista |
|-----------------|-------------------------------|
| DRY | "Si el mismo código está en dos lugares, extraerlo a uno" |
| KISS | "La solución más simple que funciona es la mejor" |
| YAGNI | "No implementar lo que no se necesita ahora" |
| SRP | "Una clase, una razón para cambiar" |
| MVC | "El Controller coordina, el Model tiene la lógica, la View presenta" |
| DTO | "Nunca exponer las entidades de BD directamente en la API" |
| Repository | "Abstrae el acceso a datos detrás de una interfaz" |
| DI | "Las dependencias se inyectan desde afuera, no se crean internamente" |
| Naming | "PascalCase para tipos/métodos en C#, camelCase para variables" |

> **Consejo para entrevistas**: Cuando expliques un patrón, siempre menciona **qué problema resuelve** antes de explicar cómo funciona. Los entrevistadores valoran que entiendas el "por qué" más que la implementación exacta.
