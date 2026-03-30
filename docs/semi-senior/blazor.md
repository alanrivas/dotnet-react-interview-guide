---
id: blazor
title: Blazor — C# en el browser
sidebar_position: 21
---

# Blazor — C# en el browser 🟡

Blazor es el framework de Microsoft para construir UIs interactivas con C# en lugar de JavaScript. En entrevistas de roles .NET fullstack es un tema frecuente: no para que lo domines, sino para que expliques **cuándo elegirías Blazor vs React** y que entiendas sus modelos de rendering.

---

## Los 4 modelos de Blazor

```
┌──────────────────────────────────────────────────────────────────────┐
│                         MODELOS DE BLAZOR                            │
│                                                                      │
│  1. Blazor Server         2. Blazor WebAssembly (WASM)               │
│  ─────────────────        ──────────────────────────                 │
│  C# corre en servidor     C# corre en el browser                     │
│  UI sync via SignalR      .NET runtime descargado al browser         │
│  Sin descarga .NET        Funciona offline                           │
│                                                                      │
│  3. Blazor Hybrid          4. Blazor United / Auto (Net 8+)          │
│  ─────────────────         ─────────────────────────────             │
│  MAUI + Blazor             Combina todos los modelos                 │
│  Apps nativas con UI       SSR + Server + WASM en 1 app              │
│  Blazor                    Elige el modo por componente               │
└──────────────────────────────────────────────────────────────────────┘
```

### Comparativa de los 4 modelos

| | Blazor Server | Blazor WASM | Blazor Hybrid | Blazor United (Auto) |
|---|---|---|---|---|
| **Dónde ejecuta el C#** | Servidor | Browser (WASM) | App nativa | Servidor + Browser |
| **Descarga inicial** | Pequeña | Grande (~10MB) | N/A | Pequeña (luego más) |
| **Latencia UI** | Alta (red por cada acción) | Baja (local) | Muy baja | Depende del modo |
| **Funciona offline** | ❌ No | ✅ Sí | ✅ Sí | Parcial |
| **Acceso a servidor** | Directo (in-process) | HTTP calls | HTTP calls | Directo/HTTP |
| **Escalabilidad** | Limitada (estado por conexión) | Excelente | N/A | Buena |
| **SEO** | Bueno (HTML en servidor) | Malo sin prerendering | N/A | Excelente |
| **Cuándo usar** | Intranet, apps internas, prototipado | Apps públicas offline-first | Desktop/Mobile con .NET MAUI | Apps públicas complejas .NET 8+ |

---

## Componentes Razor — sintaxis básica

```razor
@* ContadorProductos.razor *@
@page "/productos"
@inject IProductoService ProductoService

<h1>Productos</h1>

@if (cargando)
{
    <p>Cargando...</p>
}
else if (error is not null)
{
    <p class="error">@error</p>
}
else
{
    <p>Total: @productos.Count productos</p>

    <ul>
        @foreach (var producto in productos)
        {
            <li>
                <strong>@producto.Nombre</strong> — $@producto.Precio
                <button @onclick="() => Eliminar(producto.Id)">Eliminar</button>
            </li>
        }
    </ul>
}

<button @onclick="CargarProductos">Recargar</button>

@code {
    private List<Producto> productos = [];
    private bool cargando = true;
    private string? error;

    // Ciclo de vida: equivalente a useEffect([], []) en React
    protected override async Task OnInitializedAsync()
    {
        await CargarProductos();
    }

    private async Task CargarProductos()
    {
        cargando = true;
        error = null;

        try
        {
            productos = await ProductoService.GetTodosAsync();
        }
        catch (Exception ex)
        {
            error = $"Error al cargar: {ex.Message}";
        }
        finally
        {
            cargando = false;
        }
    }

    private async Task Eliminar(int id)
    {
        await ProductoService.EliminarAsync(id);
        productos.RemoveAll(p => p.Id == id);
        // StateHasChanged() se llama automáticamente después de event handlers
    }
}
```

---

## Parámetros — equivalente a props de React

```razor
@* TarjetaProducto.razor — componente hijo *@

@* Parámetros de entrada *@
<div class="tarjeta">
    <h3>@Producto.Nombre</h3>
    <p>$@Producto.Precio</p>

    @if (MostrarBoton)
    {
        <button @onclick="() => OnEliminar.InvokeAsync(Producto.Id)">
            Eliminar
        </button>
    }
</div>

@code {
    // [Parameter] = prop de React
    [Parameter, EditorRequired]
    public Producto Producto { get; set; } = default!;

    [Parameter]
    public bool MostrarBoton { get; set; } = true;

    // EventCallback = callback prop de React
    [Parameter]
    public EventCallback<int> OnEliminar { get; set; }

    // [CascadingParameter] = Context de React (recibe valores de ancestros)
    [CascadingParameter]
    public Tema TemaApp { get; set; } = Tema.Claro;
}
```

```razor
@* Uso en el padre *@
<TarjetaProducto
    Producto="@miProducto"
    MostrarBoton="true"
    OnEliminar="HandleEliminar" />

@code {
    private async Task HandleEliminar(int id)
    {
        await ProductoService.EliminarAsync(id);
    }
}
```

---

## Ciclo de vida de un componente

```
Equivalencias con React:

Blazor                          React (hooks)
───────────────────────────────────────────────
SetParametersAsync()         ←  (antes del render con props nuevas)
OnInitialized()              ←  useEffect(() => {}, []) síncrono
OnInitializedAsync()         ←  useEffect(() => { fetch... }, [])
OnParametersSet()            ←  useEffect(() => {}, [prop])
OnParametersSetAsync()       ←  useEffect(() => { fetch... }, [prop])
ShouldRender()               ←  React.memo / shouldComponentUpdate
OnAfterRender()              ←  useEffect(() => { DOM ops }, [])
Dispose() / IAsyncDisposable ←  cleanup de useEffect
```

```razor
@implements IAsyncDisposable

@code {
    private Timer? _timer;

    // Solo en primera renderización (como useEffect con [])
    protected override void OnInitialized()
    {
        Console.WriteLine("Componente montado");
    }

    // Async — para fetch inicial de datos
    protected override async Task OnInitializedAsync()
    {
        datos = await Service.GetDatosAsync();
    }

    // Corre cada vez que cambian los parámetros (como useEffect con [prop])
    protected override async Task OnParametersSetAsync()
    {
        if (ProductoId != _ultimoProductoId)
        {
            _ultimoProductoId = ProductoId;
            producto = await Service.GetProductoAsync(ProductoId);
        }
    }

    // Después de que el DOM se actualizó (como useEffect después del paint)
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            // Interop con JS para DOM manipulation
            await JS.InvokeVoidAsync("initChart", chartElementRef);
        }
    }

    // Optimización: evitar re-renders innecesarios
    protected override bool ShouldRender()
    {
        return _datosHanCambiado; // solo re-renderizar si es necesario
    }

    // Cleanup (como el return de useEffect)
    public async ValueTask DisposeAsync()
    {
        _timer?.Dispose();
        await JS.InvokeVoidAsync("destroyChart", chartElementRef);
    }
}
```

---

## Data binding

```razor
@* One-way binding (de C# al HTML) *@
<p>@mensaje</p>
<input value="@nombre" />   @* Solo lee — no actualiza nombre al tipear *@

@* Two-way binding — equivalente a value + onChange en React *@
<input @bind="nombre" />
<input @bind="nombre" @bind:event="oninput" />  @* Actualiza en cada tecla *@

<select @bind="categoriaSeleccionada">
    @foreach (var cat in categorias)
    {
        <option value="@cat.Id">@cat.Nombre</option>
    }
</select>

@code {
    private string nombre = "";
    private int categoriaSeleccionada;
    private string mensaje => $"Hola, {nombre}";
}
```

---

## Formularios y validación

```razor
@* FormularioProducto.razor *@
<EditForm Model="@dto" OnValidSubmit="GuardarAsync">
    <DataAnnotationsValidator />
    <ValidationSummary />

    <div>
        <label for="nombre">Nombre</label>
        <InputText id="nombre" @bind-Value="dto.Nombre" />
        <ValidationMessage For="() => dto.Nombre" />
    </div>

    <div>
        <label for="precio">Precio</label>
        <InputNumber id="precio" @bind-Value="dto.Precio" />
        <ValidationMessage For="() => dto.Precio" />
    </div>

    <div>
        <label for="categoria">Categoría</label>
        <InputSelect id="categoria" @bind-Value="dto.CategoriaId">
            <option value="">-- Seleccioná --</option>
            @foreach (var cat in categorias)
            {
                <option value="@cat.Id">@cat.Nombre</option>
            }
        </InputSelect>
    </div>

    <button type="submit" disabled="@guardando">
        @(guardando ? "Guardando..." : "Guardar")
    </button>
</EditForm>

@code {
    private CrearProductoDto dto = new();
    private List<Categoria> categorias = [];
    private bool guardando;

    protected override async Task OnInitializedAsync()
    {
        categorias = await CategoriaService.GetTodasAsync();
    }

    private async Task GuardarAsync()
    {
        guardando = true;
        try
        {
            await ProductoService.CrearAsync(dto);
            NavigationManager.NavigateTo("/productos");
        }
        finally
        {
            guardando = false;
        }
    }
}
```

```csharp
// DTO con Data Annotations — mismas que en la API
public class CrearProductoDto
{
    [Required(ErrorMessage = "El nombre es requerido")]
    [StringLength(100, MinimumLength = 3)]
    public string Nombre { get; set; } = string.Empty;

    [Range(0.01, double.MaxValue, ErrorMessage = "El precio debe ser positivo")]
    public decimal Precio { get; set; }

    [Required]
    public int CategoriaId { get; set; }
}
```

---

## JavaScript Interop

Blazor puede llamar JavaScript (y viceversa) cuando necesitás APIs del browser que no están disponibles en .NET.

```razor
@inject IJSRuntime JS

@code {
    private ElementReference canvasRef;

    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (firstRender)
        {
            // Llamar función JS desde C#
            await JS.InvokeVoidAsync("inicializarGrafico", canvasRef, datos);
        }
    }

    private async Task CopiarAlPortapapeles(string texto)
    {
        await JS.InvokeVoidAsync("navigator.clipboard.writeText", texto);
    }

    private async Task<string> LeerDelLocalStorage(string key)
    {
        // InvokeAsync retorna un valor desde JS
        return await JS.InvokeAsync<string>("localStorage.getItem", key);
    }
}
```

```javascript
// wwwroot/js/interop.js
window.inicializarGrafico = (canvasElement, datos) => {
    const ctx = canvasElement.getContext('2d');
    new Chart(ctx, { type: 'bar', data: datos });
};

// Llamar C# desde JavaScript
// En componentes Blazor Server con DotNet.invokeMethodAsync
window.notificarCambio = () => {
    DotNet.invokeMethodAsync('MiApp', 'RecibirNotificacion');
};
```

---

## State Management

```csharp
// Patrón 1: Service como state container (para estado global simple)
// Se registra como Scoped en Blazor Server, Singleton en WASM

public class CarritoState
{
    private readonly List<ItemCarrito> _items = [];

    public IReadOnlyList<ItemCarrito> Items => _items.AsReadOnly();
    public int Total => _items.Sum(i => i.Cantidad);

    // Notificar a los componentes que el estado cambió
    public event Action? OnChange;

    public void Agregar(Producto producto)
    {
        var existente = _items.FirstOrDefault(i => i.ProductoId == producto.Id);
        if (existente != null)
            existente.Cantidad++;
        else
            _items.Add(new ItemCarrito { ProductoId = producto.Id, Nombre = producto.Nombre });

        OnChange?.Invoke(); // Dispara re-render en los componentes suscritos
    }

    public void Vaciar()
    {
        _items.Clear();
        OnChange?.Invoke();
    }
}
```

```razor
@* Componente que usa el state *@
@inject CarritoState Carrito
@implements IDisposable

<span>Carrito: @Carrito.Total items</span>

@code {
    protected override void OnInitialized()
    {
        // Suscribirse a cambios del state
        Carrito.OnChange += StateHasChanged;
    }

    public void Dispose()
    {
        // Desuscribirse al desmontar (evitar memory leaks)
        Carrito.OnChange -= StateHasChanged;
    }
}
```

```csharp
// Patrón 2: CascadingValue — pasar estado a componentes descendientes
// Equivalente al Context.Provider de React
```

```razor
@* En el layout raíz *@
<CascadingValue Value="@tema" Name="TemaApp">
    @Body
</CascadingValue>

@* En cualquier componente descendiente *@
@code {
    [CascadingParameter(Name = "TemaApp")]
    public Tema TemaApp { get; set; } = Tema.Claro;
}
```

---

## Autenticación y autorización

```razor
@* Verificar autenticación en componentes *@
<AuthorizeView>
    <Authorized>
        <p>Bienvenido, @context.User.Identity?.Name</p>
        <NavLink href="/dashboard">Dashboard</NavLink>
    </Authorized>
    <NotAuthorized>
        <p>Por favor <a href="/login">iniciá sesión</a></p>
    </NotAuthorized>
</AuthorizeView>

@* Restringir una página completa *@
@page "/admin"
@attribute [Authorize(Roles = "admin")]

<h1>Panel de administración</h1>
```

```csharp
// Program.cs — configurar auth en Blazor WASM
builder.Services
    .AddOidcAuthentication(options =>
    {
        builder.Configuration.Bind("Auth", options.ProviderOptions);
        options.ProviderOptions.DefaultScopes.Add("openid");
        options.ProviderOptions.DefaultScopes.Add("profile");
        options.ProviderOptions.DefaultScopes.Add("api");
    });

// Program.cs — configurar auth en Blazor Server
builder.Services
    .AddAuthentication(options => { /* JWT o Cookie */ })
    .AddJwtBearer(options => { /* config */ });
```

---

## Blazor vs React — la comparativa clave para entrevistas

```
¿Cuándo elegirías Blazor sobre React?

✅ Equipo es .NET, nadie sabe JS/TS profundamente
✅ App interna / intranet sin SEO crítico
✅ Necesitás compartir lógica entre API y UI (mismos DTOs, validaciones)
✅ Blazor Server para prototipos rápidos (latencia no importa)
✅ Blazor WASM para apps offline-first (campo, sin red)
✅ Blazor Hybrid para desktop/mobile con MAUI

✅ Cuándo elegirías React sobre Blazor:
✅ SEO crítico (blogs, e-commerce público)
✅ Equipo mixto o front-end specialists
✅ Ecosistema npm necesario (librerías de charts, UI, etc.)
✅ Performance de UI de alta frecuencia (juegos, real-time intenso)
✅ PWA o app móvil standalone (sin MAUI)
✅ Posibilidad de que el backend cambie de .NET a otro stack
```

| | Blazor | React |
|---|---|---|
| **Lenguaje** | C# | JavaScript / TypeScript |
| **Ecosistema** | NuGet (más chico) | npm (enorme) |
| **Bundle inicial** | WASM: ~10MB / Server: ~pequeño | ~200-500KB (SPA) |
| **SEO** | Bueno (Server/United) | Requiere Next.js para SSR |
| **Curva de aprendizaje** | Baja para devs .NET | Media-alta para devs .NET |
| **Performance** | Buena (mejora con AOT) | Excelente |
| **Tooling** | Visual Studio / Rider | VS Code + toda la toolchain JS |
| **Jobs/mercado** | Nicho (.NET shops) | Masivo |

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es Blazor y cuáles son sus modelos de rendering?**
> Blazor es el framework de Microsoft para construir UIs web con C#. Tiene 4 modelos: **Server** (C# en el servidor, UI via SignalR — baja latencia de startup pero red en cada acción), **WebAssembly** (C# compila a WASM y corre en el browser — offline-first, sin servidor), **Hybrid** (WASM dentro de MAUI para apps nativas) y **United/Auto** (.NET 8+, combina todos — elige SSR, Server o WASM por componente).

**2. ¿Cuándo recomendarías Blazor en vez de React?**
> Cuando el equipo es 100% .NET y no hay expertise en JavaScript, cuando es una app interna donde el SEO no importa y la latencia de Blazor Server es aceptable, cuando se quiere compartir DTOs y validaciones entre API y UI (mismo proyecto), o cuando se necesita una app offline-first en entorno controlado (Blazor WASM). Para apps públicas con SEO, ecosistema npm, o equipos mixtos, React/Next.js es la mejor opción.

**3. ¿Qué es el JS Interop y cuándo lo usarías?**
> `IJSRuntime` permite llamar funciones JavaScript desde C# y viceversa. Lo usaría cuando Blazor no tiene acceso nativo a una API del browser (Clipboard, Canvas, WebSockets de browser, librerías JS de terceros como Chart.js). En Blazor WASM es sincrónico; en Blazor Server es siempre asíncrono porque cruza la conexión SignalR.

**4. ¿Cuál es la diferencia entre `OnInitializedAsync` y `OnParametersSetAsync`?**
> `OnInitializedAsync` corre **una sola vez** cuando el componente se monta por primera vez — equivalente a `useEffect(() => {}, [])`. `OnParametersSetAsync` corre cada vez que los parámetros del componente cambian (incluyendo la primera vez) — equivalente a `useEffect(() => {}, [parametro])`. Para fetch inicial de datos se usa `OnInitializedAsync`; para reaccionar a cambios de props se usa `OnParametersSetAsync`.

**5. ¿Cómo manejarías el state global en Blazor?**
> Dos opciones principales: (1) **Service como state container** registrado en DI — el componente se suscribe al evento `OnChange` del service y llama `StateHasChanged()` cuando recibe la notificación. (2) **CascadingValue/CascadingParameter** — equivalente al Context de React, para pasar estado a componentes descendientes sin prop drilling. Para apps más complejas hay librerías como Fluxor (flux pattern) o Blazored.

**6. ¿Qué problema tiene Blazor Server en producción a escala?**
> Cada usuario tiene una conexión SignalR activa con el servidor, y el estado de la UI se mantiene en memoria del servidor. Esto limita la escalabilidad horizontal — no podés balancear libremente entre instancias sin sticky sessions o backplane de SignalR (Redis, Azure SignalR Service). Con miles de usuarios simultáneos, la memoria del servidor crece linealmente. Blazor WASM no tiene este problema porque todo corre en el cliente.
