---
id: poo
title: Programación Orientada a Objetos
sidebar_position: 2
---

# Programación Orientada a Objetos (POO) 🟢

Los 4 pilares de POO son los temas **más preguntados** en entrevistas Junior y Semi-Senior.

## 1. Encapsulamiento

Ocultar el estado interno y exponer solo lo necesario mediante accesores.

```csharp
public class CuentaBancaria
{
    private decimal _saldo; // privado, no accesible desde fuera

    public decimal Saldo => _saldo; // solo lectura desde fuera

    public void Depositar(decimal monto)
    {
        if (monto <= 0)
            throw new ArgumentException("El monto debe ser positivo");
        _saldo += monto;
    }

    public void Retirar(decimal monto)
    {
        if (monto > _saldo)
            throw new InvalidOperationException("Saldo insuficiente");
        _saldo -= monto;
    }
}
```

---

## 2. Herencia

Una clase puede heredar comportamiento y estado de otra.

```csharp
public class Animal
{
    public string Nombre { get; set; }

    public Animal(string nombre)
    {
        Nombre = nombre;
    }

    public virtual string HacerSonido()
    {
        return "...";
    }

    public void Respirar() => Console.WriteLine($"{Nombre} respira");
}

public class Perro : Animal
{
    public string Raza { get; set; }

    public Perro(string nombre, string raza) : base(nombre)
    {
        Raza = raza;
    }

    public override string HacerSonido() => "¡Guau!";
}

public class Gato : Animal
{
    public Gato(string nombre) : base(nombre) { }

    public override string HacerSonido() => "¡Miau!";
}
```

:::warning Regla importante
C# **no soporta herencia múltiple** de clases. Una clase puede heredar de **una sola clase base**, pero puede implementar **múltiples interfaces**.
:::

---

## 3. Polimorfismo

La capacidad de tratar objetos de distintos tipos de forma uniforme.

```csharp
// Polimorfismo en tiempo de ejecución
List<Animal> animales = new()
{
    new Perro("Rex", "Labrador"),
    new Gato("Michi"),
    new Perro("Bobby", "Poodle")
};

foreach (var animal in animales)
{
    // Llama al override correcto según el tipo real
    Console.WriteLine($"{animal.Nombre}: {animal.HacerSonido()}");
}
// Rex: ¡Guau!
// Michi: ¡Miau!
// Bobby: ¡Guau!
```

### `virtual` vs `abstract` vs `override`

```csharp
public abstract class Forma
{
    // abstract: DEBE ser implementado por la subclase
    public abstract double CalcularArea();

    // virtual: PUEDE ser sobreescrito (tiene implementación por defecto)
    public virtual string Describir() => $"Soy una forma con área {CalcularArea():F2}";
}

public class Circulo : Forma
{
    public double Radio { get; set; }
    
    public override double CalcularArea() => Math.PI * Radio * Radio;
}

public class Rectangulo : Forma
{
    public double Ancho { get; set; }
    public double Alto { get; set; }
    
    public override double CalcularArea() => Ancho * Alto;
    
    // sealed: impide que subclases vuelvan a sobreescribir
    public sealed override string Describir() => "Soy un rectángulo";
}
```

---

## 4. Abstracción

Definir contratos (qué hace algo) sin especificar el cómo.

### Clases abstractas vs Interfaces

```csharp
// Interfaz: CONTRATO PURO (lo que puede hacer)
public interface IRepositorio<T>
{
    Task<T?> ObtenerPorIdAsync(int id);
    Task<IEnumerable<T>> ObtenerTodosAsync();
    Task AgregarAsync(T entidad);
    Task ActualizarAsync(T entidad);
    Task EliminarAsync(int id);
}

// Clase abstracta: CONTRATO + COMPORTAMIENTO COMPARTIDO
public abstract class ServicioBase
{
    protected readonly ILogger _logger;

    protected ServicioBase(ILogger logger)
    {
        _logger = logger;
    }

    // Método concreto compartido
    protected void LogInfo(string mensaje) => _logger.LogInformation(mensaje);

    // Método abstracto que cada hijo debe implementar
    public abstract Task EjecutarAsync();
}
```

| Característica | Clase Abstracta | Interfaz |
|----------------|----------------|----------|
| Herencia múltiple | ❌ No | ✅ Sí |
| Constructores | ✅ Sí | ❌ No |
| Estado (campos) | ✅ Sí | ❌ No (solo props) |
| Métodos con implementación | ✅ Sí | ✅ Desde C# 8 (default) |
| Uso | "Es un..." | "Puede hacer..." |

---

## Modificadores de acceso

```csharp
public class EjemploAcceso
{
    public string Publico = "todos pueden verme";
    private string Privado = "solo esta clase";
    protected string Protegido = "esta clase y subclases";
    internal string Interno = "solo dentro del assembly";
    protected internal string ProtectedInternal = "subclases O mismo assembly";
    private protected string PrivateProtected = "subclases en el mismo assembly";
}
```

---

## Clases estáticas y métodos estáticos

```csharp
public static class Utilidades
{
    // No se puede instanciar, no tiene estado de instancia
    public static string FormatearMoneda(decimal valor) => $"${valor:N2}";
    
    public static bool EsEmailValido(string email) =>
        email.Contains('@') && email.Contains('.');
}

// Uso
string precio = Utilidades.FormatearMoneda(1234.5m); // $1,234.50
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuándo usar clase abstracta vs interfaz?**
> **Clase abstracta**: cuando las clases comparten código e implementación base (relación "es un tipo de"). **Interfaz**: cuando solo defines un contrato/capacidad que diferentes clases pueden implementar (relación "puede hacer").

**2. ¿Qué es el principio de sustitución de Liskov?**
> Si una clase `B` hereda de `A`, deberías poder usar `B` en cualquier lugar donde uses `A` sin romper el programa. Las subclases no deben debilitar las postcondiciones ni fortalecer las precondiciones.

**3. ¿Puede una clase abstracta no tener métodos abstractos?**
> Sí. Simplemente no se puede instanciar directamente, pero puede tener solo métodos concretos.

**4. ¿Qué pasa si no llamo a `base()` en el constructor hijo?**
> C# llama automáticamente al constructor sin parámetros del padre. Si el padre no tiene constructor sin parámetros, es un **error de compilación** si no se llama a `base(...)` explícitamente.
