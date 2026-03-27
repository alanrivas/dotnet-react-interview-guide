---
id: linq-avanzado
title: LINQ Avanzado
sidebar_position: 18
---

# LINQ Avanzado 🟢

LINQ (Language Integrated Query) es tan potente y frecuente en entrevistas que merece una guía dedicada. Este documento cubre técnicas avanzadas y casos reales.

## Fundamentales: IEnumerable vs IQueryable

```csharp
// IEnumerable: LINQ to Objects (en memoria)
// Se ejecuta inmediatamente
List<producto> lista = [/*...*/];
var resultado = lista
    .Where(p => p.Precio > 100)
    .Select(p => p.Nombre)
    .ToList();
// LINQ to Objects: filtra y transforma EN MEMORIA

// IQueryable: LINQ to Entity Framework (en BD)
// Se traduce a SQL
var resultado = _db.Productos
    .Where(p => p.Precio > 100)  // Se convierte a SQL WHERE
    .Select(p => p.Nombre)        // Se convierte a SQL SELECT
    .ToList();                     // AQUÍ se ejecuta el SQL
// Un único query a BD, mucho más eficiente

// ❌ MALO: traer todo a memoria y filtrar
var todoAlta = _db.Productos.ToList();          // Trae 10,000 productos
var caros = todoAlta.Where(p => p.Precio > 1000).ToList(); // filtra en memoria

// ✓ BUENO: filtrar en BD
var caros = _db.Productos
    .Where(p => p.Precio > 1000)  // Se ejecuta en BD
    .ToList();
```

## Métodos LINQ avanzados

### GroupBy (agrupar)

```csharp
var productos = new List<Producto>
{
    new() { Id = 1, Nombre = "Laptop", Categoria = "Electrónica", Precio = 1000 },
    new() { Id = 2, Nombre = "Mouse", Categoria = "Electrónica", Precio = 29 },
    new() { Id = 3, Nombre = "Silla", Categoria = "Mueble", Precio = 199 },
    new() { Id = 4, Nombre = "Escritorio", Categoria = "Mueble", Precio = 399 },
};

// GroupBy simple
var porCategoria = productos
    .GroupBy(p => p.Categoria)
    .Select(g => new
    {
        Categoria = g.Key,
        Cantidad = g.Count(),
        Promedio = g.Average(p => p.Precio),
        Total = g.Sum(p => p.Precio)
    });

// Resultado:
// { Categoria: "Electrónica", Cantidad: 2, Promedio: 514.5, Total: 1029 }
// { Categoria: "Mueble", Cantidad: 2, Promedio: 299, Total: 598 }

// GroupBy con elemento anidado
var detalladoPorCategoria = productos
    .GroupBy(p => p.Categoria)
    .Select(g => new
    {
        Categoria = g.Key,
        Items = g.Select(p => new { p.Nombre, p.Precio }).ToList(),
        Total = g.Sum(p => p.Precio)
    });
```

### SelectMany (flatten)

`SelectMany` aplana colecciones anidadas.

```csharp
var clientes = new List<Cliente>
{
    new() 
    { 
        Id = 1, 
        Nombre = "Juan",
        Pedidos = [
            new Pedido { Id = 100, Monto = 500 },
            new Pedido { Id = 101, Monto = 750 }
        ]
    },
    new()
    {
        Id = 2,
        Nombre = "María",
        Pedidos = [
            new Pedido { Id = 200, Monto = 1200 }
        ]
    }
};

// ❌ Sin SelectMany (anidado)
var pedidosAnidados = clientes
    .Select(c => new { c.Nombre, Pedidos = c.Pedidos })
    .ToList();
// [
//   { Nombre: "Juan", Pedidos: [{Id: 100}, {Id: 101}] },
//   { Nombre: "María", Pedidos: [{Id: 200}] }
// ]

// ✓ Con SelectMany (flat)
var todosLosPedidos = clientes
    .SelectMany(c => c.Pedidos, (cliente, pedido) => new
    {
        Cliente = cliente.Nombre,
        PedidoId = pedido.Id,
        Monto = pedido.Monto
    })
    .ToList();
// [
//   { Cliente: "Juan", PedidoId: 100, Monto: 500 },
//   { Cliente: "Juan", PedidoId: 101, Monto: 750 },
//   { Cliente: "María", PedidoId: 200, Monto: 1200 }
// ]

// SelectMany es equivalente a INNER JOIN
```

### Take y Skip (paginación)

```csharp
var numPagina = 2;
var porPagina = 10;

var pagina = _db.Productos
    .Skip((numPagina - 1) * porPagina)  // Saltar 10
    .Take(porPagina)                     // Tomar los próximos 10
    .ToList();

// Página 1: Skip(0).Take(10)   → items 0-9
// Página 2: Skip(10).Take(10)  → items 10-19
// Página 3: Skip(20).Take(10)  → items 20-29
```

### OrderBy con múltiples niveles

```csharp
var productos = _db.Productos
    .OrderBy(p => p.Categoria)      // Primero por categoría
    .ThenBy(p => p.Precio)           // Luego por precio
    .ThenByDescending(p => p.Nombre) // Luego por nombre descendente
    .ToList();

// Resultado: ordenado primero por categoría (A→Z),
// luego por precio (bajo→alto),
// luego por nombre (Z→A)
```

### Aggregate (reduce)

```csharp
var numeros = new[] { 1, 2, 3, 4, 5 };

// Suma
var suma = numeros.Aggregate((acc, n) => acc + n);
// 1 + 2 + 3 + 4 + 5 = 15

// Producto
var producto = numeros.Aggregate(1, (acc, n) => acc * n);
// 1 * 1 * 2 * 3 * 4 * 5 = 120

// Cadena concatenada
var concatenado = numeros.Aggregate(
    "",
    (acc, n) => acc + n + "-"
).TrimEnd('-');
// "1-2-3-4-5"

// Caso real: calcular estadísticas
var resultado = productos.Aggregate(
    new { Total = 0m, Cantidad = 0, Promedio = 0m },
    (acc, p) => new
    {
        Total = acc.Total + p.Precio,
        Cantidad = acc.Cantidad + 1,
        Promedio = (acc.Total + p.Precio) / (acc.Cantidad + 1)
    }
);
// { Total: 1000, Cantidad: 4, Promedio: 250 }
```

### FirstOrDefault, SingleOrDefault, LastOrDefault

```csharp
// FirstOrDefault: primer elemento o null
var primero = _db.Productos
    .Where(p => p.Precio > 500)
    .FirstOrDefault();
// Si no hay coincidencias: null
// Si hay multiple: toma el primero

// SingleOrDefault: exactamente uno o null
var unico = _db.Usuarios
    .Where(u => u.Email == "juan@example.com")
    .SingleOrDefault();
// Si hay 0 coincidencias: null
// Si hay multiple: ❌ EXCEPCIÓN

// LastOrDefault: último elemento o null
var ultimo = _db.Productos
    .OrderByDescending(p => p.FechaCreacion)
    .LastOrDefault();

// Cuidado: FirstOrDefault vs First
_db.Productos.FirstOrDefault(p => p.Id == 999);  // null
_db.Productos.First(p => p.Id == 999);           // ❌ InvalidOperationException
```

## Casos de uso reales

### 1. Búsqueda y filtrado complejos

```csharp
public async Task<List<ProductoDto>> BuscarAsync(FiltroProductoDto filtro)
{
    var query = _db.Productos.AsQueryable();
    
    // Nombre (case-insensitive)
    if (!string.IsNullOrEmpty(filtro.Nombre))
    {
        query = query.Where(p => 
            p.Nombre.ToLower().Contains(filtro.Nombre.ToLower()));
    }
    
    // Rango de precios
    if (filtro.PrecioMin.HasValue)
        query = query.Where(p => p.Precio >= filtro.PrecioMin);
    
    if (filtro.PrecioMax.HasValue)
        query = query.Where(p => p.Precio <= filtro.PrecioMax);
    
    // Categorías múltiples
    if (filtro.Categorias?.Any() == true)
        query = query.Where(p => filtro.Categorias.Contains(p.CategoriaId));
    
    // Solo productos disponibles
    if (filtro.SoloDisponibles)
        query = query.Where(p => p.Stock > 0);
    
    // Ordenamiento
    query = filtro.OrdenPor switch
    {
        "precio" => filtro.Descendente 
            ? query.OrderByDescending(p => p.Precio)
            : query.OrderBy(p => p.Precio),
        "nombre" => filtro.Descendente
            ? query.OrderByDescending(p => p.Nombre)
            : query.OrderBy(p => p.Nombre),
        _ => query.OrderByDescending(p => p.FechaCreacion)
    };
    
    // Paginación
    query = query
        .Skip((filtro.Pagina - 1) * filtro.PorPagina)
        .Take(filtro.PorPagina);
    
    return await query
        .Select(p => new ProductoDto
        {
            Id = p.Id,
            Nombre = p.Nombre,
            Precio = p.Precio,
            Stock = p.Stock
        })
        .ToListAsync();
}
```

### 2. Reportes con agrupación

```csharp
public async Task<VentasPorMesDto> ObtenerVentasPorMesAsync(int año)
{
    var ventasPorMes = await _db.Pedidos
        .Where(p => p.Fecha.Year == año)
        .GroupBy(p => p.Fecha.Month)
        .Select(g => new
        {
            Mes = g.Key,
            Cantidad = g.Count(),
            Total = g.Sum(p => p.Monto),
            Promedio = g.Average(p => p.Monto)
        })
        .OrderBy(x => x.Mes)
        .ToListAsync();
    
    return new VentasPorMesDto
    {
        Año = año,
        Datos = ventasPorMes.Select(x => new MesDto
        {
            Mes = x.Mes,
            Cantidad = x.Cantidad,
            Venta = x.Total,
            VentaPromedio = x.Promedio
        }).ToList()
    };
}
```

### 3. Eliminar duplicados

```csharp
// ❌ Mal: Distinct ingenuamente
var nombres = _db.Productos
    .Select(p => p.Nombre)
    .Distinct()
    .ToList();

// ✓ Mejor: Distinct por propiedad
var productosUnicos = _db.Productos
    .GroupBy(p => p.CodIgo)
    .Select(g => g.First()) // Tomar primero de cada grupo
    .ToList();

// ✓ Mejor aún: usar IEqualityComparer
public class ProductoComparer : IEqualityComparer<Producto>
{
    public bool Equals(Producto? x, Producto? y)
    {
        return x?.Codigo == y?.Codigo;
    }
    
    public int GetHashCode(Producto obj)
    {
        return obj.Codigo.GetHashCode();
    }
}

var unicos = _db.Productos
    .Distinct(new ProductoComparer())
    .ToList();
```

### 4. Joins complejos

```csharp
// INNER JOIN
var ventasConCliente = await _db.Pedidos
    .Join(
        _db.Clientes,
        pedido => pedido.ClienteId,
        cliente => cliente.Id,
        (pedido, cliente) => new { Pedido = pedido, Cliente = cliente }
    )
    .Select(x => new
    {
        x.Pedido.Id,
        x.Cliente.Nombre,
        x.Pedido.Monto
    })
    .ToListAsync();

// LEFT JOIN (con DefaultIfEmpty)
var clientesSinPedidos = await _db.Clientes
    .GroupJoin(
        _db.Pedidos,
        cliente => cliente.Id,
        pedido => pedido.ClienteId,
        (cliente, pedidos) => new { Cliente = cliente, Pedidos = pedidos }
    )
    .Where(x => !x.Pedidos.Any())
    .Select(x => x.Cliente)
    .ToListAsync();

// O más simple con Include (si hay relación FK)
var clientesConPedidos = await _db.Clientes
    .Include(c => c.Pedidos)
    .Where(c => c.Pedidos.Any())
    .ToListAsync();
```

## Performance: AsNoTracking

```csharp
// ❌ Por defecto: Entity Framework trackea cambios (lento para lecturas)
var productos = await _db.Productos
    .Where(p => p.Activo)
    .ToListAsync(); // Trackea cada objeto

// ✓ Para solo lectura: AsNoTracking
var productos = await _db.Productos
    .AsNoTracking()  // No rastrear cambios
    .Where(p => p.Activo)
    .ToListAsync(); // Mucho más rápido

// Especialmente importante con muchos datos
var reporteDatos = await _db.Pedidos
    .AsNoTracking()
    .GroupBy(p => p.ClienteId)
    .Select(g => new { /* estadísticas */ })
    .ToListAsync();
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuál es la diferencia entre IEnumerable y IQueryable?**
> - **IEnumerable**: LINQ to Objects, filtra EN MEMORIA. Trae todo y filtra después.
> - **IQueryable**: LINQ to Providers (EF, SQL, etc), traduce a SQL. Filtra EN LA BD.
>
> Siempre preferir IQueryable (DbContext) para grandes volúmenes.

**2. ¿Cuándo usar FirstOrDefault vs SingleOrDefault?**
> - **FirstOrDefault**: cuando esperas 0+ resultados, tomas el primero
> - **SingleOrDefault**: cuando esperas exactamente 1, falla si hay más de 1
>
> Usar SingleOrDefault cuando busques por ID único o email.

**3. ¿Qué es SelectMany?**
> SelectMany es "flatten" + map. Aplana colecciones anidadas. Equivalente a INNER JOIN.

```csharp
// SelectMany
var todos = clientes.SelectMany(c => c.Pedidos);
// ES EQUI A:
var todos = (from c in clientes
             from p in c.Pedidos
             select p).ToList();
```

**4. ¿Cuándo usar GroupBy?**
> Cuando necesitas agrupar datos y calcular agregados (Sum, Count, Average, etc) por grupo.

```csharp
// Ventas por mes
_db.Pedidos
    .GroupBy(p => p.Fecha.Month)
    .Select(g => new { Mes = g.Key, Total = g.Sum(p => p.Monto) })
```

**5. ¿Qué es ToList() vs ToListAsync()?**
> - **ToList()**: sincrónico, bloquea thread
> - **ToListAsync()**: asincrónico, libera thread mientras la BD ejecuta
>
> Siempre usar ToListAsync() en ASP.NET Core.

**6. ¿Por qué AsNoTracking() es importante?**
> EF trackea cambios por defecto (Entity State). Para solo lectura, AsNoTracking() desactiva el tracking, reduciendo memory y CPU significativamente. 30-50% más rápido.

**7. ¿Cómo hacer un LEFT JOIN en LINQ?**
> Usar GroupJoin + SelectMany, o Include si hay relación FK.

```csharp
// LEFT JOIN: clientes aunque no tengan pedidos
var resultado = _db.Clientes
    .GroupJoin(
        _db.Pedidos,
        cliente => cliente.Id,
        pedido => pedido.ClienteId,
        (cliente, pedidos) => new { cliente, pedidos }
    )
    .SelectMany(x => x.pedidos.DefaultIfEmpty(), 
               (x, pedido) => new { x.cliente, pedido })
    .ToList();
```

**8. ¿Cuándo LINQ es más lento que SQL raw?**
> Rara vez. LINQ genera SQL bastante óptimo. Excepciones:
> - Queries muy complejas: a veces SQL raw es más claro
> - Performance crítica: profile primero con SQL real
> - Raw SQL cuando necesites hints específicas (hints, índices)

**9. ¿Qué es Distinct vs GroupBy para eliminar duplicados?**
> - **Distinct()**: simple, solo marca únicos
> - **GroupBy().Select(g => g.First())**: más control, puedes elegir qué elemento tomar por grupo

**10. ¿Cómo debuggear un query LINQ lento?**
> - Usar `.ToQueryString()` para ver SQL generado
> - Profile con SQL Profiler
> - Asegurarse de filtrar en BD, no en memoria
> - Usar AsNoTracking() para lecturas
> - Verificar índices en BD