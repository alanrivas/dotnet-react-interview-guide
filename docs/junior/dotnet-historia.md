---
id: dotnet-historia
title: Historia de .NET — Del Framework al Presente
sidebar_position: 3
---

# Historia de .NET — Del Framework al Presente 🟢

Entender de dónde viene .NET te da contexto para entender *por qué* las cosas funcionan como funcionan hoy. En entrevistas senior es frecuente que pregunten sobre la evolución del ecosistema.

---

## El mundo antes de .NET (1990s)

Microsoft dominaba el desarrollo de escritorio con **Visual Basic 6** y **Visual C++**. Para comunicación entre componentes existía **COM (Component Object Model)**: una arquitectura binaria para que DLLs escritas en distintos lenguajes se comunicaran.

```
COM / DCOM / COM+:
  ✅ Interoperabilidad entre lenguajes (VB, C++, Delphi)
  ✅ Reutilización de componentes
  ❌ Registro en Windows (Registry Hell)
  ❌ Gestión manual de memoria (AddRef/Release)
  ❌ DLL Hell — conflictos de versiones en System32
  ❌ Difícil de debuggear, testear y desplegar
```

La presión competitiva de Java (plataforma cross-platform con garbage collector) impulsó a Microsoft a diseñar algo desde cero.

---

## .NET Framework 1.0 — 2002

El gran reinicio. Microsoft presentó .NET como la respuesta a Java: managed code, garbage collector, y un runtime común para múltiples lenguajes.

### Conceptos nuevos que introdujo

```
CLR (Common Language Runtime)
  → Máquina virtual que ejecuta IL (Intermediate Language)
  → Garbage Collector automático
  → JIT (Just-In-Time compiler): IL → código nativo en ejecución

BCL (Base Class Library)
  → System.Collections, System.IO, System.Net, System.Text...

CLS (Common Language Specification)
  → Reglas para que C#, VB.NET, F# compilen al mismo IL
  → "Write in any language, run on the same runtime"
```

### Lenguajes en el lanzamiento

- **C# 1.0** — nuevo lenguaje, mezcla de Java y C++
- **VB.NET** — reescritura total de VB6, incompatible con él
- **Managed C++** — C++ con extensiones para el CLR

### Web: ASP.NET WebForms

El modelo web fue **WebForms**: intentó hacer la web "parecida a WinForms" con controles de servidor, postback y ViewState.

```csharp
// ASP.NET WebForms — archivos .aspx + .aspx.cs
protected void btnGuardar_Click(object sender, EventArgs e)
{
    // Código mezclado con "eventos" de UI
    var nombre = txtNombre.Text;
    lblResultado.Text = $"Hola, {nombre}";
}
// El estado de los controles viajaba en __VIEWSTATE (campo oculto enorme)
// Abstracción que "escondía" HTTP — y lo hacía difícil de testear
```

### Lo que NO existía en .NET 1.0

- ❌ Generics (tipado fuerte en colecciones)
- ❌ LINQ
- ❌ async/await
- ❌ Inyección de dependencias integrada
- ❌ NuGet (los paquetes eran DLLs que se copiaban a mano)
- ❌ Nullable reference types

---

## .NET Framework 1.1 — 2003

Mejora incremental. Soporte para IPv6, mejoras en ASP.NET. Sin cambios de lenguaje significativos.

---

## .NET Framework 2.0 — 2005 ⭐ Gran versión

La primera versión realmente madura. Dos features que cambiaron todo:

### Generics

```csharp
// ❌ Antes (1.x) — colecciones no tipadas, boxing/unboxing constante
ArrayList lista = new ArrayList();
lista.Add(42);           // boxing: int → object
int n = (int)lista[0];   // unboxing + cast explícito
// Un error de tipo → excepción en runtime, no en compilación

// ✅ Con Generics (2.0+)
List<int> lista = new List<int>();
lista.Add(42);           // sin boxing
int n = lista[0];        // sin cast
// Errores de tipo detectados en tiempo de compilación
```

### Otros highlights de 2.0

```csharp
// Nullable value types
int? numero = null;  // ← antes era imposible para structs
if (numero.HasValue) Console.WriteLine(numero.Value);

// Iterators con yield
IEnumerable<int> Fibonacci()
{
    int a = 0, b = 1;
    while (true)
    {
        yield return a;
        (a, b) = (b, a + b);
    }
}

// Anonymous methods (precursor de lambdas)
button.Click += delegate(object sender, EventArgs e) {
    MessageBox.Show("Clic!");
};

// Partial classes — separar código generado de código manual
partial class Form1 { /* generado por el designer */ }
partial class Form1 { /* tu código */ }
```

---

## .NET Framework 3.0 — 2006

**No cambió el CLR ni C#** — fue una capa encima de 2.0 con cuatro nuevas tecnologías:

| Tecnología | Reemplazaba | Para qué |
|-----------|-------------|----------|
| **WPF** (Windows Presentation Foundation) | WinForms | UI de escritorio con XAML + binding |
| **WCF** (Windows Communication Foundation) | ASMX Web Services | Servicios SOA, SOAP, configuración por XML |
| **WF** (Windows Workflow Foundation) | Nada directo | Flujos de trabajo declarativos |
| **CardSpace** | — | Identidad digital (fracasó, fue discontinuado) |

WCF fue la tecnología de servicios dominante por años, aunque su configuración en XML era notoriamente compleja:

```xml
<!-- web.config de WCF — 80 líneas para un servicio simple -->
<system.serviceModel>
  <services>
    <service name="MiServicio" behaviorConfiguration="MiServicioBehavior">
      <endpoint address="" binding="basicHttpBinding"
                contract="IMiServicio" />
      <endpoint address="mex" binding="mexHttpBinding"
                contract="IMetadataExchange" />
    </service>
  </services>
  <behaviors>
    <serviceBehaviors>
      <behavior name="MiServicioBehavior">
        <serviceMetadata httpGetEnabled="true"/>
        <serviceDebug includeExceptionDetailInFaults="false"/>
      </behavior>
    </serviceBehaviors>
  </behaviors>
</system.serviceModel>
```

---

## .NET Framework 3.5 — 2007 ⭐ Gran versión — LINQ

La versión que introdujo **LINQ** junto con todas las features de C# 3.0:

### C# 3.0 features

```csharp
// Lambda expressions
Func<int, bool> esPar = n => n % 2 == 0;

// Extension methods — base de LINQ
public static class StringExtensions
{
    public static bool EsPalindromo(this string s)
        => s == new string(s.Reverse().ToArray());
}
"aba".EsPalindromo(); // true

// Anonymous types
var persona = new { Nombre = "Ana", Edad = 30 };
Console.WriteLine(persona.Nombre); // "Ana"

// var — inferencia de tipos
var lista = new List<string>(); // el compilador infiere List<string>

// Object initializers
var producto = new Producto { Id = 1, Nombre = "PC", Precio = 999m };

// Collection initializers
var numeros = new List<int> { 1, 2, 3, 4, 5 };
```

### LINQ (Language Integrated Query)

```csharp
// LINQ to Objects — consultas sobre colecciones en memoria
var adultos = from p in personas
              where p.Edad >= 18
              orderby p.Nombre
              select new { p.Nombre, p.Edad };

// O con sintaxis de método (más popular)
var adultos = personas
    .Where(p => p.Edad >= 18)
    .OrderBy(p => p.Nombre)
    .Select(p => new { p.Nombre, p.Edad });

// LINQ to SQL — el primer ORM de Microsoft (luego reemplazado por EF)
var db = new NorthwindDataContext();
var pedidos = db.Orders
    .Where(o => o.OrderDate > DateTime.Today.AddDays(-30))
    .ToList();
// Genera SQL automáticamente — concepto radical en 2007
```

### ASP.NET MVC — también en 3.5

ASP.NET MVC llegó como alternativa a WebForms, separando lógica de presentación y haciéndolo testeable:

```csharp
// Controller — puro C#, sin herencia de Page
public class ProductosController : Controller
{
    public ActionResult Index()
    {
        var productos = _repo.ObtenerTodos();
        return View(productos);  // Retorna una View, no manipula controles
    }
}
// Sin ViewState, sin postback — HTTP real
// Mucho más fácil de testear con unit tests
```

---

## La era de los IoC Containers (2005–2012)

Con la popularidad de MVC y los patrones SOLID llegó la **Inyección de Dependencias** — pero .NET Framework no la incluía. El ecosistema respondió con contenedores externos:

### Castle Windsor

```csharp
// Castle Windsor — el más popular de la época
var container = new WindsorContainer();

// Registrar
container.Register(
    Component.For<IProductoRepository>()
             .ImplementedBy<ProductoRepository>()
             .LifestyleTransient(),
    Component.For<IProductoService>()
             .ImplementedBy<ProductoService>()
             .LifestyleTransient()
);

// Resolver
var service = container.Resolve<IProductoService>();
```

### Otros contenedores de la época

```csharp
// StructureMap (2004) — pionero en fluent API
ObjectFactory.Initialize(x => {
    x.For<IProductoRepository>().Use<ProductoRepository>();
});

// Ninject (2007) — "Ninja" IoC, syntax elegante
var kernel = new StandardKernel();
kernel.Bind<IProductoRepository>().To<ProductoRepository>();

// Autofac (2007) — muy popular, sigue activo hoy
var builder = new ContainerBuilder();
builder.RegisterType<ProductoRepository>().As<IProductoRepository>();
var container = builder.Build();

// Unity (Microsoft, 2008) — el oficial de Microsoft antes del built-in
var container = new UnityContainer();
container.RegisterType<IProductoRepository, ProductoRepository>();

// MEF (Managed Extensibility Framework, .NET 4.0) — basado en atributos
[Export(typeof(IProductoRepository))]
public class ProductoRepository : IProductoRepository { }

[Import]
public IProductoRepository Repo { get; set; }
```

**El problema:** cada proyecto usaba un contenedor diferente, con APIs incompatibles. Librerías como NHibernate o ASP.NET MVC tenían que soportar múltiples contenedores.

---

## .NET Framework 4.0 — 2010

### Task Parallel Library (TPL)

```csharp
// Antes: Thread manual — complejo y error-prone
var thread = new Thread(() => {
    // trabajo pesado
});
thread.Start();
thread.Join();

// Con TPL (4.0): Task — abstracción de alto nivel
var task = Task.Run(() => {
    return ComputarAlgo();
});
var resultado = task.Result; // Bloquea hasta que termine

// Parallel.For — paralelismo de datos
Parallel.For(0, 1000, i => {
    ProcesarItem(i);
});
```

### DLR (Dynamic Language Runtime)

```csharp
// dynamic — tipo resuelto en runtime, no en compilación
dynamic obj = ObtenerAlgoDesconocido();
obj.MetodoQueNoSeSiExiste(); // Si no existe → excepción en runtime

// Útil para: COM interop, JSON dinámico, scripts
```

### Entity Framework 1.0 (incluido en 4.0)

```csharp
// EF1 — Code First aún no existía, solo Database First y Model First
// Requería un archivo .edmx gigante (XML con el modelo)
using (var ctx = new NorthwindEntities())
{
    var productos = ctx.Products.Where(p => p.Price > 10).ToList();
}
// .edmx era molesto de versionar y difícil de mantener en equipo
```

---

## .NET Framework 4.5 — 2012 ⭐ async/await

La feature más importante desde LINQ: programación asíncrona sin el dolor de los callbacks.

### async/await

```csharp
// ❌ Antes (callbacks / APM — Asynchronous Programming Model)
public void DescargarArchivo(string url, Action<byte[]> callback)
{
    var client = new WebClient();
    client.DownloadDataCompleted += (s, e) => callback(e.Result);
    client.DownloadDataAsync(new Uri(url));
}
// Callback hell: leer, procesar, guardar, notificar... todo anidado

// ❌ Con Task pero sin await (TAP manual — .NET 4.0)
public Task<string> ObtenerDatosAsync(string url)
{
    return httpClient.GetStringAsync(url)
        .ContinueWith(t => t.Result.ToUpper()); // "promesa" manual
}

// ✅ Con async/await (.NET 4.5+) — código síncrono que es asíncrono
public async Task<string> ObtenerDatosAsync(string url)
{
    var datos = await httpClient.GetStringAsync(url);  // No bloquea el thread
    return datos.ToUpper();
}

// El compilador transforma async/await en una máquina de estados
// Libera el thread mientras espera I/O → mucho mejor throughput
```

### Otros highlights de 4.5

```csharp
// Caller Info Attributes
public void Log(string msg,
    [CallerMemberName] string method = "",
    [CallerFilePath] string file = "",
    [CallerLineNumber] int line = 0)
{
    Console.WriteLine($"{file}:{line} [{method}] {msg}");
}

// IReadOnlyList<T>, IReadOnlyDictionary<K,V>
// Mejoras en GC (background GC para Server)
// ZIP nativo (System.IO.Compression)
```

---

## .NET Framework 4.6 — 2015

- **RyuJIT** — nuevo compilador JIT de 64 bits, 25-30% más rápido que el anterior
- **Roslyn** — compilador de C# reescrito en C# (open source), base de Intellisense y analyzers
- **C# 6.0**: string interpolation, null-conditional operator, expression-bodied members

```csharp
// C# 6.0 features
var nombre = persona?.Nombre ?? "Desconocido";  // null-conditional
var msg = $"Hola, {nombre}!";                   // string interpolation

// Expression-bodied
public string Nombre => $"{_nombre} {_apellido}";
```

---

## .NET Framework 4.7 / 4.8 — 2017–2019

Mejoras incrementales. **4.8 (2019) fue la última versión de .NET Framework.**

Microsoft lo mantiene por compatibilidad pero no agrega features nuevas. Solo recibe parches de seguridad.

```
.NET Framework queda congelado en 4.8:
  ✅ Windows only — sigue siendo el runtime del sistema operativo Windows
  ✅ WinForms, WPF — siguen funcionando
  ✅ Compatibilidad total hacia atrás
  ❌ Sin nuevas features del lenguaje después de C# 8 parcial
  ❌ No cross-platform
  ❌ No open source (aunque el código se publicó en Reference Source)
```

---

## El giro: ASP.NET Web API y el camino hacia Core (2012)

ASP.NET Web API (2012) fue la señal de que el futuro era HTTP/REST, no SOAP/WCF:

```csharp
// Web API — mucho más simple que WCF
public class ProductosController : ApiController
{
    public IEnumerable<Producto> Get()
    {
        return _repo.ObtenerTodos();
    }

    public IHttpActionResult Get(int id)
    {
        var p = _repo.ObtenerPorId(id);
        if (p == null) return NotFound();
        return Ok(p);
    }
}
// Sin XML de configuración, REST nativo, serialización JSON automática
```

---

## .NET Core 1.0 — 2016 🔄 Ruptura total

Microsoft reinició desde cero: cross-platform, open source, modular.

### Qué cambió radicalmente

```
.NET Framework:        .NET Core 1.0:
  Windows only    →      Windows, Linux, macOS
  Closed source   →      Open source (github.com/dotnet)
  Monolítico      →      Modular (NuGet packages)
  IIS obligatorio →      Kestrel (server embebido)
  System.Web.dll  →      Reescritura completa como ASP.NET Core
  web.config XML  →      appsettings.json
  Global.asax     →      Program.cs + Startup.cs
  DI externo      →      DI integrada nativa
```

### DI nativa — fin de la era de los contenedores externos

```csharp
// ASP.NET Core — DI integrada desde el día 1
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // Registrar servicios
    services.AddScoped<IProductoRepository, ProductoRepository>();
    services.AddTransient<IEmailService, EmailService>();
    services.AddSingleton<IConfiguracion, Configuracion>();

    services.AddControllers();
    services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(Configuration.GetConnectionString("Default")));
}

// Constructor injection automático
public class ProductosController : ControllerBase
{
    private readonly IProductoRepository _repo;

    public ProductosController(IProductoRepository repo) // ← inyectado automáticamente
    {
        _repo = repo;
    }
}
// No más Castle Windsor, Autofac ni Unity para casos básicos
// (Autofac sigue usándose para features avanzadas)
```

### Lo que .NET Core 1.0 NO tenía

- ❌ WPF / WinForms (Windows desktop)
- ❌ Entity Framework completo (solo EF Core básico)
- ❌ SignalR (llegó después)
- ❌ Muchas APIs de .NET Framework (surface muy reducida)

---

## .NET Core 2.0 — 2017 ⭐ El punto de inflexión

El salto que hizo a .NET Core viable para proyectos reales. La clave fue **.NET Standard 2.0**:

```
.NET Standard — interfaz común para múltiples runtimes:
  .NET Framework 4.6.1+ implementa .NET Standard 2.0
  .NET Core 2.0         implementa .NET Standard 2.0
  Xamarin               implementa .NET Standard 2.0

Resultado: una librería compilada contra .NET Standard 2.0
funciona en los tres runtimes sin recompilar.

APIs disponibles:
  .NET Core 1.x:   ~13,000 APIs
  .NET Core 2.0:   ~32,000 APIs (2.5x más — la mayoría de .NET Framework portada)
```

```csharp
// .NET Standard library — compila una vez, corre en todas partes
// MiLibreria.csproj
<TargetFramework>netstandard2.0</TargetFramework>
```

---

## .NET Core 2.1 — 2018 (LTS)

- **Span\<T\>** y **Memory\<T\>** — tipos de alto rendimiento para trabajar con memoria sin allocations
- **HttpClientFactory** — fin de los problemas de socket exhaustion con `HttpClient`
- Mejoras significativas en performance

```csharp
// Span<T> — slice de memoria sin copiar
byte[] bytes = File.ReadAllBytes("archivo.bin");
Span<byte> header = bytes.AsSpan(0, 16);   // sin copia, acceso directo
Span<byte> body   = bytes.AsSpan(16);

// HttpClientFactory — forma correcta de usar HttpClient
services.AddHttpClient<IProductoApiClient, ProductoApiClient>(client =>
{
    client.BaseAddress = new Uri("https://api.productos.com");
});
// Reutiliza conexiones, evita socket exhaustion, permite Polly
```

---

## .NET Core 3.0 / 3.1 — 2019 (3.1 = LTS)

- **WPF y WinForms vuelven** — pero solo en Windows
- **Blazor Server** — C# en el browser via SignalR
- **gRPC** integrado
- **System.Text.Json** — serializer JSON nativo (alternativa a Newtonsoft.Json)
- **Worker Services** — `BackgroundService` formalizado

```csharp
// System.Text.Json — nativo, más rápido que Newtonsoft
using System.Text.Json;

var json = JsonSerializer.Serialize(producto);
var producto = JsonSerializer.Deserialize<ProductoDto>(json);

// vs Newtonsoft.Json (externo, más features, más flexible)
var json = JsonConvert.SerializeObject(producto);
var producto = JsonConvert.DeserializeObject<ProductoDto>(json);
```

---

## .NET 5 — 2020 🔀 Unificación

Microsoft eliminó el "Core" del nombre. Un solo .NET para todo:

```
Antes:                        .NET 5 en adelante:
  .NET Framework 4.8            .NET 5 (2020)
  .NET Core 3.1                 .NET 6 (2021) LTS
  Mono / Xamarin                .NET 7 (2022)
  .NET Standard 2.x             .NET 8 (2023) LTS
                                .NET 9 (2024)
         ↑                             ↑
  múltiples runtimes         un runtime unificado
```

### Nuevas features C# 9.0

```csharp
// Records — objetos inmutables con igualdad por valor
public record Punto(double X, double Y);

var p1 = new Punto(1, 2);
var p2 = new Punto(1, 2);
Console.WriteLine(p1 == p2);  // true — igualdad por valor, no por referencia

var p3 = p1 with { X = 5 };   // non-destructive mutation

// Top-level statements — sin class Program ni Main
// Program.cs puede ser solo:
Console.WriteLine("Hola mundo");
// Sin using, sin namespace, sin static void Main

// Pattern matching mejorado
if (obj is string { Length: > 5 } s)
    Console.WriteLine(s.ToUpper());

// Init-only setters
public class Persona
{
    public string Nombre { get; init; }  // Solo se puede setear en inicialización
}
```

---

## .NET 6 — 2021 (LTS) ⭐ Minimal APIs

La primera versión con soporte de largo plazo post-unificación:

```csharp
// Minimal APIs — toda una API en Program.cs
var app = WebApplication.Create();

app.MapGet("/hola", () => "Hola mundo!");
app.MapGet("/productos/{id}", (int id) => new Producto { Id = id });

app.Run();

// Global using — se aplican a todo el proyecto
// GlobalUsings.cs
global using System.Collections.Generic;
global using Microsoft.AspNetCore.Builder;

// File-scoped namespaces
namespace MiApp.Models;  // ← sin llaves, aplica a todo el archivo

public class Producto { ... }

// DateOnly / TimeOnly — tipos de fecha sin tiempo
DateOnly fecha = new DateOnly(2024, 1, 15);
TimeOnly hora  = new TimeOnly(14, 30);
```

---

## .NET 7 — 2022

```csharp
// Required members — campos obligatorios en inicialización
public class Producto
{
    public required string Nombre { get; set; }  // Error de compilación si no se inicializa
    public required decimal Precio { get; set; }
}
// sin required: new Producto { Precio = 10 }  // Error: Nombre es requerido

// Rate Limiting nativo en ASP.NET Core
builder.Services.AddRateLimiter(options =>
    options.AddFixedWindowLimiter("api", o => {
        o.PermitLimit = 100;
        o.Window = TimeSpan.FromMinutes(1);
    }));

// HTTP/3 estable, mejoras en WASM, AOT mejorado
```

---

## .NET 8 — 2023 (LTS) ⭐ Versión actual recomendada

```csharp
// Primary constructors en clases (antes solo en records)
public class ProductoService(IProductoRepository repo, ILogger<ProductoService> logger)
{
    // repo y logger disponibles en todo el cuerpo de la clase
    public async Task<Producto?> ObtenerAsync(int id)
    {
        logger.LogInformation("Obteniendo producto {Id}", id);
        return await repo.ObtenerPorIdAsync(id);
    }
}

// Collection expressions — nueva sintaxis unificada para colecciones
int[] numeros    = [1, 2, 3, 4, 5];
List<string> lst = ["uno", "dos", "tres"];
Span<int> span   = [10, 20, 30];

// Spread operator en colecciones
int[] a = [1, 2, 3];
int[] b = [4, 5, 6];
int[] c = [..a, ..b];  // [1, 2, 3, 4, 5, 6]

// Native AOT estable — compila a binario nativo sin CLR
// Arranque <10ms, memoria mínima — ideal para serverless/containers

// Frozen collections — colecciones de solo lectura ultra-optimizadas
var frozen = new Dictionary<string, int> { ... }.ToFrozenDictionary();
// 2-3x más rápido en lookups que Dictionary normal

// Blazor United — SSR + Server + WASM en una sola app
```

---

## .NET 9 — 2024

```csharp
// LINQ: CountBy, AggregateBy, Index
var conteo = personas.CountBy(p => p.Ciudad);
// [("Buenos Aires", 5), ("Madrid", 3), ...]

// Span<T> para strings — sin allocations
ReadOnlySpan<char> span = "hola mundo".AsSpan();

// Mejoras en HybridCache (L1+L2 cache integrado)
// Task.WhenEach — iterar resultados de Tasks a medida que completan
await foreach (var resultado in Task.WhenEach(tasks))
    Console.WriteLine(resultado.Result);
```

---

## Línea de tiempo visual

```
2002  .NET Framework 1.0  → CLR, GC, WebForms, C# 1.0
2003  .NET Framework 1.1  → mejoras menores
2005  .NET Framework 2.0  → Generics, Nullable, yield ⭐
2006  .NET Framework 3.0  → WPF, WCF, WF
2007  .NET Framework 3.5  → LINQ, lambdas, extension methods ⭐
2010  .NET Framework 4.0  → TPL, DLR, EF1
2012  .NET Framework 4.5  → async/await ⭐
2015  .NET Framework 4.6  → RyuJIT, Roslyn, C# 6
2017  .NET Framework 4.7
2019  .NET Framework 4.8  → ÚLTIMA versión de Framework 🔒
────────────────────────────────────────────────────────────
2016  .NET Core 1.0       → Cross-platform, open source, DI nativa 🔄
2017  .NET Core 2.0       → .NET Standard 2.0, API parity ⭐
2018  .NET Core 2.1 LTS   → Span<T>, HttpClientFactory
2019  .NET Core 3.1 LTS   → WPF/WinForms back, Blazor Server, gRPC
────────────────────────────────────────────────────────────
2020  .NET 5              → Unificación (fin del "Core") ⭐
2021  .NET 6 LTS          → Minimal APIs, Hot Reload ⭐
2022  .NET 7              → Rate limiting, required members
2023  .NET 8 LTS          → Primary constructors, AOT ⭐ (versión actual recomendada)
2024  .NET 9              → CountBy, WhenEach, HybridCache
```

---

## Evolución del ecosistema

### ORM

```
ADO.NET (2002)      → SQL manual, DataSet/DataReader
LINQ to SQL (2007)  → simple, solo SQL Server, discontinued
EF1–EF6 (2008–)    → Database First, Model First (.edmx), luego Code First
EF Core (2016–)     → reescritura desde cero, cross-platform, open source
                      EF Core 7: ExecuteUpdate/ExecuteDelete
                      EF Core 8: JSON columns, primitive collections
```

### Web frameworks

```
WebForms (2002)     → event-driven, ViewState, difícil de testear
ASP.NET MVC (2009)  → REST-friendly, testeable, Razor views
Web API (2012)      → APIs HTTP/REST puras
ASP.NET Core (2016) → unificación MVC + Web API, cross-platform, DI nativa
Minimal API (2021)  → sin controllers, menos overhead, .NET 6+
Blazor (2019+)      → C# en el browser (WASM) o server-side
```

### Testing

```
NUnit (2002, port de JUnit)        → el clásico
MSTest (2005, Microsoft)           → integrado en Visual Studio
xUnit (2008, creadores de NUnit)   → estándar moderno en .NET Core
FluentAssertions (2010)            → sintaxis legible para asserts
Moq, NSubstitute                   → mocking de interfaces
```

### Paquetes y dependencias

```
Antes de NuGet (–2010):
  DLLs copiadas a /bin o a carpeta lib
  "Funciona en mi máquina" era real
  Actualizaciones: descargar zip, reemplazar DLL

NuGet (2010):
  dotnet add package Newtonsoft.Json
  packages.config → luego PackageReference en .csproj
  nuget.org como repositorio central
  Hoy: >350,000 paquetes disponibles
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre .NET Framework y .NET (Core)?**
> .NET Framework es Windows-only, closed source (el código está disponible como referencia pero no es contribuible), y su última versión es 4.8 de 2019. .NET (antes Core) es cross-platform, open source, y recibe nuevas versiones anuales. Para proyectos nuevos siempre se usa .NET moderno.

**2. ¿Para qué servían Castle Windsor y Autofac? ¿Siguen siendo relevantes?**
> Eran contenedores de inyección de dependencias para .NET Framework, que no tenía DI integrada. Hoy ASP.NET Core tiene DI nativa que cubre el 90% de los casos. Autofac sigue siendo relevante para features avanzadas como módulos, decoradores, o factories convencionales.

**3. ¿Qué es .NET Standard?**
> Una especificación de APIs comunes que múltiples runtimes (.NET Framework, .NET Core, Xamarin) debían implementar. Permitía escribir librerías que funcionaran en todos lados. Con la unificación en .NET 5+, .NET Standard fue dejado en segundo plano — hoy se apunta directamente a `net8.0` o `net6.0`.

**4. ¿Cuándo se introdujo async/await en .NET?**
> En .NET Framework 4.5 (2012) con C# 5.0. Antes existían callbacks (APM), IAsyncResult, y Task sin await (TAP manual en .NET 4.0). async/await fue revolucionario porque permite escribir código asíncrono con la misma claridad que código síncrono.

**5. ¿Qué versión de .NET usarías para un proyecto nuevo hoy?**
> .NET 8 (LTS, soporte hasta noviembre 2026) o .NET 9 si se quiere la última versión. Nunca .NET Framework para proyectos nuevos, salvo que haya una dependencia crítica de Windows Forms legacy o una librería que no tenga versión para .NET moderno.

**6. ¿Por qué Microsoft hizo el salto a .NET Core en lugar de evolucionar .NET Framework?**
> .NET Framework arrastraba 15 años de decisiones de diseño ligadas a Windows y al modelo de IIS. Era imposible hacerlo cross-platform o modular sin romper compatibilidad. Reescribirlo desde cero permitió eliminar System.Web, hacer DI nativa, usar Kestrel como servidor embebido, y abrir el código. El costo fue la migración — muchas empresas siguen en .NET Framework por eso.

---

## 🔴 Cambios DRÁSTICOS entre eras (lo que la entrevista va a investigar)

### De .NET Framework a .NET Core: La ruptura

| Aspecto | .NET Framework 4.8 | .NET Core 1.0+ |
|--------|------------------|----------------|
| **Servidor web** | IIS obligatorio | Kestrel embebido, sin IIS |
| **Configuración** | web.config (XML) | appsettings.json (YAML/JSON) |
| **Inyección de DI** | Externa (Castle, Autofac, Ninject) | Nativa en `IServiceCollection` |
| **ORM recomendado** | Entity Framework 6 | Entity Framework Core (reescritura) |
| **Routing** | Atributos `[RoutePrefix]` | Minimal APIs o Controllers con `MapControllers()` |
| **Clase base** | `System.Web.Mvc.Controller` (pesada) | `ControllerBase` (ligera) o sin controller |
| **Globales** | `Global.asax` con `Application_Start` | `Program.cs` con `builder.Services` |
| **Serialización JSON** | Json.NET (Newtonsoft) externo | System.Text.Json nativo (+ opción Newtonsoft) |
| **System.Web.dll** | Enorme, con todo incluido | ❌ Eliminada completamente |
| **Características desktop** | WinForms, WPF | ✅ Disponibles (con limitaciones) |
| **Plataformas** | Windows only | Windows, Linux, macOS (Docker) |

### De .NET Core 3.1 a .NET 5+ : Consolidación

```csharp
// .NET Core 3.1: Todavía era "Core", cambios frecuentes
dotnet new console  // output: "old school"

// .NET 5+: Unified, más estable, yearly releases 
dotnet new console  // output: top-level statements por defecto

// .NET 6+: Hot Reload en VS, pausa el programa y actualiza métodos sin reiniciar
dotnet watch run

// .NET 8+: Native AOT — compila todo a binario sin CLR (startup <10ms)
dotnet publish -c Release -p:PublishAot=true
```

---

## 📅 Versiones y End-of-Life (EOL)

| Versión | Lanzamiento | Tipo | EOL | Por qué EOL |
|---------|------------|------|-----|-----------|
| .NET FW 4.8 | Sep 2019 | Legacy | ∞ (indefinido) | Soporte indefinido en Windows; no evoluciona |
| .NET Core 1.x | Jun 2016 | Preview | Jun 2017 | Demasiado inestable |
| .NET Core 2.0 | Aug 2017 | STS | Oct 2018 | Short-Term Support |
| .NET Core 2.1 | May 2018 | LTS | Aug 2021 | LTS de 3 años, migración esperada |
| .NET Core 3.0 | Sep 2019 | STS | Mar 2020 | Solo 6 meses |
| .NET Core 3.1 | Dec 2019 | LTS | Dec 2022 | LTS de 3 años, sucesor fue .NET 5 |
| **.NET 5** | Nov 2020 | STS | May 2022 | 6 meses después de 6 |
| **.NET 6** | Nov 2021 | LTS | **Nov 2024** | ⚠️ **EOL inminente o próximo** |
| **.NET 7** | Nov 2022 | STS | May 2024 | Ya deprecado |
| **.NET 8** | Nov 2023 | LTS | **Nov 2026** | ✅ **Versión LTS recomendada AHORA** |
| .NET 9 | Nov 2024 | STS | May 2025 | Standard de 6 meses |
| .NET 10 (plan) | Nov 2025 | LTS | Nov 2028 | Próximo LTS |

**Patrón de Microsoft:**
- **STS (Standard Term Support)** = 6 meses de soporte
- **LTS (Long-Term Support)** = 3 años de soporte
- Nuevas versiones cada noviembre (Patch Tuesdays)

---

## 🚀 Guía de migración: .NET Framework → .NET Moderno

### Paso 1: Identificar dependencias problemáticas

```csharp
// ❌ Imposible migrar sin reescritura—
EntityFramework = EF6               // → EntityFrameworkCore
WebActivator                        // → NuGet/Assembly binding
HttpServer                          // → Kestrel
System.Web.* namespaces            // → Microsoft.AspNetCore.*

// ⚠️ Requiere trabajo adicional:
WCF services (SOAP)                 // → gRPC o REST
ASP.NET WebForms                    // → ASP.NET Core MVC/Razor Pages
COM interop                         // → P/Invoke o Runtime.InteropServices
AppDomains                          // → AssemblyLoadContext (limited)

// ✅ Relativamente fácil si está bien diseñado:
Business logic (POCOs, repos)       // → Copy as-is, recompile
Services (interfaces)               // → Funciona igual
Unit tests (NUnit/MSTest/xUnit)     // → Funciona igual (recompilar)
```

### Paso 2: Usar el analizador de compatibilidad

```powershell
# Microsoft publica herramienta gratuita
dotnet add package Microsoft.Porting.Client
dotnet porting-client analyze --csproj MiProyecto.csproj

# Output: reporte detallado de qué no es compatible
```

### Paso 3: Crear nuevo proyecto y migrar

```bash
# No editar .csproj viejo — arrancar con una plantilla moderna
dotnet new webapi -n MiProyecto.Moderno

# Copiar code: Controllers, Services, Models
# Actualizar: Namespaces, configuración en Program.cs, inyección de DI
```

---

## ⚡ Comparación de Performance Real

Datos de [TechEmpower Benchmarks](https://www.techempower.com/benchmarks/) (2024):

### Throughput (req/sec en JSON serialization)

```
.NET Framework 4.8:        ~120k req/sec
.NET Core 2.1 (2018):     ~180k req/sec (+50%)
.NET 5:                   ~320k req/sec (+80%)
.NET 6:                   ~350k req/sec (+9%)
.NET 8 (Native AOT):      ~420k req/sec (+20%)

Mejora acumulada: 3.5x más rápido en 8 años
(especialmente gracias a RyuJIT y cambios en GC)
```

### Memory footprint (Linux container, "Hello world")

```
ASP.NET Framework:    ~250 MB (solo startup del IIS en Windows)
.NET Core 3.1:       ~50 MB
.NET 6:             ~40 MB
.NET 8 (AOT):       ~15 MB (sin CLR)
```

### Cold startup (tiempo hasta first request)

```
.NET Framework:    ~1500ms (inicialización de AppDomain)
.NET Core 1.0:    ~300ms
.NET Core 3.1:    ~150ms
.NET 6:          ~80ms
.NET 8 (AOT):    ~5ms (para serverless = revolucionario)
```

---

## 🎯 Cambios QUE DESAPARECIERON (features retiradas)

Esto es **crucial** para entrevistas de arquitectura — hay casos donde se NECESITABA esa feature:

### Eliminado en .NET Core / .NET 5+

| Feature | Era | Razón | Alternativa |
|---------|-----|-------|-----------|
| **AppDomains** | FW clásico | No existe en .NET moderno (islas de código) | AssemblyLoadContext (muy limitado) |
| **Remoting** | FW clásico | Seguridad + cross-platform incompatible | gRPC, HTTP, Azure Service Bus |
| **WebForms** | FW 1.0–4.8 | Modelo antiguo, ViewState pesado | ASP.NET Core Razor Pages/MVC |
| **GlobalResources (RESX)** | FW ASP.NET | Localización compleja | Localization middleware +  JSON |
| **Reflection.Emit** | Parcial | Limitado en AOT | IL Weaving + Roslyn (source generators) |
| **Binary serialization** | .NET Framework | Inseguro (RCE remote code exec risk) | JSON, protobuf |
| **Obsolete APIs** | Various | Deprecated por ser inseguras | Modern replacements |
| **CAS (Code Access Security)** | FW 4.x | Obsoleto (nunca fue seguro de verdad) | ❌ Nada (asumir confianza en assembly) |

---

## 🔮 El futuro: .NET 10 y más allá

### RoadMap oficial (Microsoft)

```
2025 (Nov):   .NET 10 LTS     → Core Focus: Performance AOT, Razor improvements
2026 (Nov):   .NET 11 STS     → Uncertain, posible deprecation de algo legacy
2028 (Nov):   .NET 12 LTS     → Coincide con Windows 12 release (rumores)

Prioridades actuales:
  ✅ Native AOT — cada vez más maduro (hoy .NET 9, casi production-ready)
  ✅ WASM — Blazor United (SSR + Server + Client en 1 app)
  ✅ Performance — Siempre, competencia con Go, Rust
  ✅ Interop — Better P/Invoke, C# 13+ con extern methods
  ✅ Containers — Optimizaciones para Docker/Kubernetes
  ❌ Windows Forms en Linux — Muy complejo, probablemente no
  ❌ "Eliminar" .NET Framework — Indefinido (legacy = compatible eternamente)
```

### C# roadmap paralelo

```
C# 13 (hoy, 2024):      Extension types, ref structs improvements
C# 14 (esperado 2025):  Params collections, mejor pattern matching
C# 15 (2026):           Speculation, posibles macros
```

---

## 🎓 Preparación para entrevistas: Una sola pregunta que lo resume TODO

**Pregunta tipo "senior":**
> *"Describí la evolución de .NET incluyendo qué cambió, por qué, y cuáles fueron los tradeoffs. ¿Cuándo usarías .NET Framework hoy? ¿Y cuándo NO lo usarías?"*

**Respuesta esperada** (la que te hace parecer competente):

> ".NET Framework y .NET Core surgieron de necesidades diferentes. Framework fue robusto durante años pero Windows-only y monolítico. El salto a Core en 2016 fue un reset para eliminar técnica deuda, permitir cross-platform, e integrar DI nativa — pero rompió compatibilidad. Hoy (.NET 8 LTS) es claramente superior para proyectos nuevos: mucho más rápido (3.5x performance), menor huella, despliegue simple sin servidor. 
>
> Usaría .NET Framework SOLO si:
> - heredé código que depende de WinForms legacy sin posibilidad de migrar
> - Necesito AppDomains (extremadamente raro)
> - Una librería crítica no tiene versión para .NET Core
>
> Para todo lo demás: .NET 8. Migrar WebForms/WCF es trabajo, pero vale la pena.
>
> Sobre los contenedores (Castle, Autofac): eran necesarios porque Framework no tenía DI. Hoy Core tiene DI integrada que cubre 90%, aunque Autofac sigue siendo útil para decoradores y factories convencionales."

---

## 📚 Recursos adicionales para ir más profundo

### Documentación oficial (Microsoft Docs)
- [.NET Foundation History](https://dot.net/en-us/platform/why-choose-dotnet)
- [Migration guide Framework → Core](https://docs.microsoft.com/en-us/dotnet/core/porting/)
- [C# version history](https://docs.microsoft.com/en-us/dotnet/csharp/whats-new/)

### Artículos técnicos recomendados
- **"The Evolution of .NET"** — Matt Warren (MSDN Blog, 2020)
- **"Why we built .NET Core"** — Immo Landwerth (Microsoft Tech Lead)
- **"Native AOT in .NET"** — .NET Blog (2022)

### Benchmarks y datos reales
- TechEmpower — techempower.com/benchmarks (actualizado cada trimestre)
- BenchmarkDotNet — github.com/dotnet/benchmarkdotnet (librería para hacer micro-benchmarks)

### "Historias de horror" de migraciones reales
- Company that migrated 200k LOC from .NET FW → search "enterprise .NET migration reddit"
- Common pitfalls: EF6 queries breaking in EF Core, DI configuration, async all the way
