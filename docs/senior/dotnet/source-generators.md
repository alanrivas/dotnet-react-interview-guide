---
id: source-generators
title: Source Generators en C#
sidebar_position: 17
---

# Source Generators en C# 🔴

Los Source Generators son un mecanismo del compilador de C# que genera código fuente adicional en tiempo de compilación. Reemplazan patrones lentos basados en Reflection y evitan el boilerplate manual. Los usa System.Text.Json, Entity Framework, el DI container de .NET, y muchas librerías de alto rendimiento.

---

## ¿Por qué existen?

```
Problema anterior — opciones para evitar boilerplate:

1. Reflection (runtime):
   - Lento (introspección en cada ejecución)
   - No compatible con AOT / Trimming
   - Errores en runtime, no en compilación

2. T4 Templates:
   - Complejos de escribir y debuggear
   - No integrados con el compilador
   - No acceso al modelo semántico del código

3. Code generation manual:
   - Propenso a errores
   - Difícil de mantener

Source Generators (compilación):
   ✓ Cero costo en runtime — el código ya está generado
   ✓ Errores en tiempo de compilación
   ✓ Compatible con AOT y Native AOT
   ✓ Acceso al modelo semántico completo (Roslyn)
   ✓ IntelliSense sobre el código generado
```

---

## Cómo funciona en la pipeline de compilación

```
Código fuente .cs
      │
      ▼
  Roslyn Parser  ──► Syntax Trees
      │
      ▼
  Source Generator  ──► Lee el código → Genera código nuevo
      │                    (acceso a símbolos, atributos, tipos)
      ▼
  Código generado .cs  (solo-lectura, en obj/Generated/)
      │
      ▼
  Compilación final (código original + código generado)
      │
      ▼
      DLL
```

---

## IIncrementalGenerator — la API moderna

Desde .NET 6, se usa `IIncrementalGenerator`. Es más performante que el `ISourceGenerator` original porque solo re-genera cuando cambia lo relevante.

### Estructura de un proyecto de Source Generator

```bash
# Estructura recomendada
MiLibreria/
  MiLibreria.csproj              ← Proyecto principal

MiLibreria.Generators/
  MiLibreria.Generators.csproj   ← Proyecto del generator
  MiGeneratorAttribute.cs        ← Atributo marker
  MiGenerator.cs                 ← El generator

MiLibreria.Tests/
  MiGeneratorTests.cs
```

```xml
<!-- MiLibreria.Generators.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.0</TargetFramework>  <!-- Siempre netstandard2.0 -->
    <LangVersion>latest</LangVersion>
    <Nullable>enable</Nullable>
    <EnforceExtendedAnalyzerRules>true</EnforceExtendedAnalyzerRules>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.CodeAnalysis.CSharp" Version="4.8.0" PrivateAssets="all" />
    <PackageReference Include="Microsoft.CodeAnalysis.Analyzers" Version="3.3.4" PrivateAssets="all" />
  </ItemGroup>
</Project>

<!-- MiLibreria.csproj — referencia al generator -->
<ItemGroup>
  <ProjectReference
    Include="..\MiLibreria.Generators\MiLibreria.Generators.csproj"
    OutputItemType="Analyzer"
    ReferenceOutputAssembly="false" />
</ItemGroup>
```

---

## Ejemplo práctico: auto-generar ToString()

Un generator que genera `ToString()` automáticamente para clases decoradas con `[GenerateToString]`.

### Paso 1 — El atributo marker

```csharp
// En MiLibreria (no en el generator)
namespace MiLibreria;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Struct)]
public sealed class GenerateToStringAttribute : Attribute { }
```

### Paso 2 — El Generator

```csharp
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using System.Text;

namespace MiLibreria.Generators;

[Generator]
public class ToStringGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // 1. PIPELINE: qué código queremos observar

        // Filtrar: solo clases con el atributo [GenerateToString]
        var clasesConAtributo = context.SyntaxProvider
            .ForAttributeWithMetadataName(
                fullyQualifiedMetadataName: "MiLibreria.GenerateToStringAttribute",
                predicate: static (node, _) => node is ClassDeclarationSyntax,
                transform: static (ctx, _) => GetClassInfo(ctx))
            .Where(static info => info is not null)
            .Select(static (info, _) => info!);

        // 2. ACCIÓN: generar el código cuando cambia la pipeline
        context.RegisterSourceOutput(clasesConAtributo, GenerateToString);
    }

    private static ClassInfo? GetClassInfo(GeneratorAttributeSyntaxContext ctx)
    {
        if (ctx.TargetSymbol is not INamedTypeSymbol classSymbol)
            return null;

        // Obtener todas las propiedades públicas
        var propiedades = classSymbol.GetMembers()
            .OfType<IPropertySymbol>()
            .Where(p => p.DeclaredAccessibility == Accessibility.Public
                     && !p.IsStatic)
            .Select(p => p.Name)
            .ToList();

        return new ClassInfo(
            Namespace: classSymbol.ContainingNamespace.ToDisplayString(),
            ClassName: classSymbol.Name,
            Propiedades: propiedades);
    }

    private static void GenerateToString(
        SourceProductionContext context,
        ClassInfo classInfo)
    {
        var sb = new StringBuilder();

        // Formato: NombreClase { Prop1 = valor1, Prop2 = valor2 }
        var propiedadesStr = string.Join(
            ", ",
            classInfo.Propiedades.Select(p => $"{p} = {{{p}}}"));

        sb.AppendLine("// <auto-generated/>");
        sb.AppendLine($"namespace {classInfo.Namespace};");
        sb.AppendLine();
        sb.AppendLine($"partial class {classInfo.ClassName}");
        sb.AppendLine("{");
        sb.AppendLine($"    public override string ToString()");
        sb.AppendLine($"        => $\"{classInfo.ClassName} {{ {propiedadesStr} }}\";");
        sb.AppendLine("}");

        context.AddSource(
            hintName: $"{classInfo.ClassName}.ToString.g.cs",
            source: sb.ToString());
    }

    private record ClassInfo(
        string Namespace,
        string ClassName,
        List<string> Propiedades);
}
```

### Paso 3 — Uso

```csharp
// El usuario escribe esto:
using MiLibreria;

namespace MiApp;

[GenerateToString]  // ← Solo esto
public partial class Producto  // partial es requerido
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public decimal Precio { get; set; }
}

// El generator produce automáticamente en obj/Generated/:
// namespace MiApp;
// partial class Producto
// {
//     public override string ToString()
//         => $"Producto { Id = {Id}, Nombre = {Nombre}, Precio = {Precio} }";
// }

// Resultado en runtime:
var p = new Producto { Id = 1, Nombre = "Laptop", Precio = 999 };
Console.WriteLine(p); // → Producto { Id = 1, Nombre = Laptop, Precio = 999 }
```

---

## Ejemplo práctico: auto-generar mappers

Evita AutoMapper o escribir `MapToDto()` a mano.

```csharp
// Atributo que indica qué mapear
[AttributeUsage(AttributeTargets.Class)]
public sealed class MapFromAttribute<T> : Attribute { }

// Clase de dominio
public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty; // NO exponer
    public DateTime FechaCreacion { get; set; }
}

// DTO — decorado con el atributo
[MapFrom<Usuario>]
public partial class UsuarioDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    // No tiene PasswordHash — el generator solo mapea lo que está en el DTO
}

// El generator produce:
// partial class UsuarioDto
// {
//     public static UsuarioDto From(Usuario source)
//         => new UsuarioDto
//         {
//             Id = source.Id,
//             Nombre = source.Nombre,
//             Email = source.Email,
//         };
//
//     public static IEnumerable<UsuarioDto> FromMany(IEnumerable<Usuario> sources)
//         => sources.Select(From);
// }

// Uso:
var usuario = await db.Usuarios.FindAsync(1);
var dto = UsuarioDto.From(usuario!); // Sin reflection, sin AutoMapper
```

---

## Source Generators en el ecosistema .NET

Muchas de las librerías más importantes ya los usan internamente:

```csharp
// System.Text.Json — serialización sin Reflection (AOT compatible)
[JsonSerializable(typeof(Producto))]
[JsonSerializable(typeof(List<Producto>))]
public partial class AppJsonContext : JsonSerializerContext { }

// Uso: el generator crea el serializador en compilación
var json = JsonSerializer.Serialize(producto, AppJsonContext.Default.Producto);

// ---

// Microsoft.Extensions.Logging — evita string interpolation en hot paths
public partial class ProductoService
{
    [LoggerMessage(
        EventId = 1001,
        Level = LogLevel.Information,
        Message = "Producto {ProductoId} creado por usuario {UsuarioId}")]
    private partial void LogProductoCreado(int productoId, string usuarioId);
}

// El generator crea el método LogProductoCreado que solo formatea el string
// si el nivel de log está habilitado — zero overhead cuando no loggea

// ---

// Entity Framework — Compiled Models (AOT)
// dotnet ef dbcontext optimize
// Genera el modelo EF sin Reflection → startup más rápido

// ---

// Regex — compilación en tiempo de compilación
[GeneratedRegex(@"^\d{4}-\d{2}-\d{2}$")]
private static partial Regex FechaRegex();

// 10-30x más rápido que new Regex(...) en runtime
if (FechaRegex().IsMatch(input)) { ... }
```

---

## Debugging de Source Generators

```xml
<!-- Habilitar debugging en el .csproj del generator -->
<PropertyGroup>
  <IsRoslynComponent>true</IsRoslynComponent>
</PropertyGroup>

<!-- Ver el código generado en el proyecto que usa el generator -->
<PropertyGroup>
  <EmitCompilerGeneratedFiles>true</EmitCompilerGeneratedFiles>
  <CompilerGeneratedFilesOutputPath>Generated</CompilerGeneratedFilesOutputPath>
</PropertyGroup>
```

```csharp
// Agregar un breakpoint en el generator
[Generator]
public class MiGenerator : IIncrementalGenerator
{
    public void Initialize(IncrementalGeneratorInitializationContext context)
    {
        // Para debuggear: lanzar el debugger
        // ⚠️ Solo en desarrollo, nunca en producción
        // if (!System.Diagnostics.Debugger.IsAttached)
        //     System.Diagnostics.Debugger.Launch();
    }
}
```

---

## Testing de Source Generators

```csharp
// Tests con Microsoft.CodeAnalysis.CSharp.Testing
// dotnet add package Microsoft.CodeAnalysis.CSharp.Testing

using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Testing;
using Microsoft.CodeAnalysis.Testing;

public class ToStringGeneratorTests
{
    [Fact]
    public async Task Generator_AgregaToString_ParaClaseConAtributo()
    {
        var sourceCode = """
            using MiLibreria;
            namespace TestApp;

            [GenerateToString]
            public partial class Producto
            {
                public int Id { get; set; }
                public string Nombre { get; set; } = "";
            }
            """;

        var codigoEsperado = """
            // <auto-generated/>
            namespace TestApp;

            partial class Producto
            {
                public override string ToString()
                    => $"Producto { Id = {Id}, Nombre = {Nombre} }";
            }
            """;

        await new CSharpSourceGeneratorTest<ToStringGenerator, DefaultVerifier>
        {
            TestCode = sourceCode,
            GeneratedSources =
            {
                (typeof(ToStringGenerator), "Producto.ToString.g.cs", codigoEsperado)
            }
        }.RunAsync();
    }

    [Fact]
    public async Task Generator_NoGenera_SinAtributo()
    {
        var sourceCode = """
            namespace TestApp;
            public class Producto
            {
                public int Id { get; set; }
            }
            """;

        await new CSharpSourceGeneratorTest<ToStringGenerator, DefaultVerifier>
        {
            TestCode = sourceCode,
            GeneratedSources = { } // No debe generar nada
        }.RunAsync();
    }
}
```

---

## Source Generator vs alternativas

| | Source Generator | Reflection | T4 Templates | AutoMapper |
|---|---|---|---|---|
| Cuándo ejecuta | Compilación | Runtime | Compilación (manual) | Runtime |
| Performance | Máxima | Lenta | Alta | Media |
| AOT compatible | Sí | No | Sí | No |
| IntelliSense | Sí | No | Parcial | No |
| Errores | Compilación | Runtime | Compilación | Runtime |
| Curva aprendizaje | Alta | Baja | Media | Baja |
| **Usar cuando** | Librerías, hot paths, AOT | Prototipos | Proyectos legacy | Apps estándar sin AOT |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es un Source Generator y cuándo lo usarías?**
> Un Source Generator es un componente del compilador Roslyn que analiza el código y genera archivos `.cs` adicionales en tiempo de compilación. Lo usaría cuando: quiero evitar Reflection por performance o compatibilidad AOT, necesito generar código boilerplate (mappers, ToString, validadores), o quiero liberar al desarrollador de escribir código repetitivo sin sacrificar type safety.

**2. ¿Qué diferencia hay entre `ISourceGenerator` e `IIncrementalGenerator`?**
> `ISourceGenerator` (original) re-ejecuta todo el generator en cada compilación incremental — lento. `IIncrementalGenerator` (moderno, .NET 6+) usa una pipeline de transformaciones que solo re-ejecuta las partes que cambiaron. Es lo que se debe usar hoy — mejor performance del IDE y compilación incremental significativamente más rápida.

**3. ¿Por qué los Source Generators son importantes para Native AOT?**
> Native AOT compila la app a código nativo eliminando el runtime de .NET — lo que significa que **no hay JIT ni Reflection** en runtime. Las librerías que dependen de Reflection (AutoMapper, muchos serializers) no funcionan con AOT. Los Source Generators resuelven esto generando en compilación todo el código que antes se generaba dinámicamente en runtime via Reflection.

**4. ¿Por qué la clase que usa el generator debe ser `partial`?**
> Porque el generator necesita agregar código a una clase ya existente. En C#, múltiples archivos pueden contribuir a la misma clase si es `partial`. El developer escribe la parte "pública" (propiedades, lógica de negocio), el generator agrega los métodos generados (ToString, From, etc.) en un archivo separado. Sin `partial`, el compilador no puede tener la misma clase en dos archivos.

**5. ¿Cómo manejarías errores en un Source Generator?**
> Con `context.ReportDiagnostic()` — el mismo mecanismo que usan los analyzers de Roslyn. Se crea un `DiagnosticDescriptor` con un código (ej: `MG001`), severidad (Error/Warning/Info), mensaje, y se reporta apuntando al símbolo o nodo donde está el problema. El error aparece en el IDE como un error de compilación, con la ubicación exacta en el archivo fuente — igual que los errores nativos de C#.
