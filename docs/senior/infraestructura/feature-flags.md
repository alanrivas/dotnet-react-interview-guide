---
id: feature-flags
title: Feature Flags & Progressive Delivery
sidebar_position: 9
---

# Feature Flags & Progressive Delivery 🔴

Los feature flags (también llamados feature toggles) permiten activar o desactivar funcionalidad en producción sin hacer un nuevo deploy. Son la base del progressive delivery: canary releases, A/B testing y dark launches.

---

## ¿Por qué feature flags?

```
Sin feature flags:
  Code → Merge → Deploy → Todos los usuarios ven el cambio
                              ↑
                  Si hay un bug, rollback = nuevo deploy (lento)

Con feature flags:
  Code → Merge → Deploy → Flag OFF → 0 usuarios afectados
                                   → Flag ON 1% → canary
                                   → Flag ON 50% → A/B test
                                   → Flag ON 100% → rollout completo
                                   → Flag OFF → rollback instantáneo
```

---

## Tipos de feature flags

| Tipo | Duración | Caso de uso |
|------|----------|-------------|
| **Release toggle** | Días/semanas | Ocultar feature incompleta mientras se desarrolla |
| **Experiment toggle** | Semanas | A/B testing, medir impacto de cambios |
| **Ops toggle** | Meses/permanente | Kill switch para funcionalidad en producción |
| **Permission toggle** | Permanente | Acceso diferenciado por plan/rol (premium features) |

---

## 1. Implementación en .NET con Microsoft.FeatureManagement

La forma nativa en .NET, sin dependencias externas:

```bash
dotnet add package Microsoft.FeatureManagement.AspNetCore
```

### Configuración básica

```csharp
// Program.cs
builder.Services.AddFeatureManagement();

// O con filtros de contexto
builder.Services.AddFeatureManagement()
    .AddFeatureFilter<PercentageFilter>()    // Porcentaje de usuarios
    .AddFeatureFilter<TimeWindowFilter>()    // Ventana de tiempo
    .AddFeatureFilter<TargetingFilter>();    // Targeting por usuario/grupo
```

```json
// appsettings.json
{
  "FeatureManagement": {
    "NuevoCheckout": true,
    "RecomendacionesIA": false,
    "DashboardV2": {
      "EnabledFor": [
        {
          "Name": "Percentage",
          "Parameters": {
            "Value": 20
          }
        }
      ]
    },
    "BetaFeature": {
      "EnabledFor": [
        {
          "Name": "TimeWindow",
          "Parameters": {
            "Start": "2026-04-01T00:00:00",
            "End": "2026-04-30T23:59:59"
          }
        }
      ]
    }
  }
}
```

### Uso en código

```csharp
// ✅ En un servicio
public class PedidoService
{
    private readonly IFeatureManager _featureManager;

    public PedidoService(IFeatureManager featureManager)
    {
        _featureManager = featureManager;
    }

    public async Task<PedidoDto> ProcesarAsync(PedidoRequest request)
    {
        if (await _featureManager.IsEnabledAsync("NuevoCheckout"))
        {
            return await ProcesarConNuevoFlujAsync(request);
        }

        return await ProcesarConFlujoClasico(request);
    }
}

// ✅ En un controller — attribute
[FeatureGate("NuevoCheckout")]  // Retorna 404 si el flag está OFF
[HttpGet("nuevo-checkout")]
public IActionResult NuevoCheckout()
{
    return Ok("Nuevo checkout activo");
}

// ✅ En una view/razor
@inject IFeatureManager FeatureManager

@if (await FeatureManager.IsEnabledAsync("DashboardV2"))
{
    <partial name="_DashboardV2" />
}
else
{
    <partial name="_Dashboard" />
}

// ✅ Con enum (evita strings mágicos)
public static class Features
{
    public const string NuevoCheckout = "NuevoCheckout";
    public const string RecomendacionesIA = "RecomendacionesIA";
    public const string DashboardV2 = "DashboardV2";
}

await _featureManager.IsEnabledAsync(Features.NuevoCheckout);
```

---

## 2. Targeting — Flags por usuario/grupo

El targeting permite activar flags para usuarios específicos o grupos antes de un rollout global:

```json
// appsettings.json
{
  "FeatureManagement": {
    "NuevaUI": {
      "EnabledFor": [
        {
          "Name": "Targeting",
          "Parameters": {
            "Audience": {
              "Users": ["alice@empresa.com", "bob@empresa.com"],
              "Groups": [
                {
                  "Name": "beta-testers",
                  "RolloutPercentage": 100
                },
                {
                  "Name": "empleados",
                  "RolloutPercentage": 50
                }
              ],
              "DefaultRolloutPercentage": 5
            }
          }
        }
      ]
    }
  }
}
```

```csharp
// Configurar el contexto de targeting (quién es el usuario actual)
builder.Services.AddFeatureManagement()
    .AddFeatureFilter<TargetingFilter>();

builder.Services.AddSingleton<ITargetingContextAccessor, HttpContextTargetingContextAccessor>();

// Implementar el accessor
public class HttpContextTargetingContextAccessor : ITargetingContextAccessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public HttpContextTargetingContextAccessor(IHttpContextAccessor accessor)
    {
        _httpContextAccessor = accessor;
    }

    public ValueTask<TargetingContext> GetContextAsync()
    {
        var user = _httpContextAccessor.HttpContext?.User;

        return new ValueTask<TargetingContext>(new TargetingContext
        {
            UserId = user?.FindFirst(ClaimTypes.Email)?.Value ?? "anonymous",
            Groups = user?.Claims
                .Where(c => c.Type == "grupo")
                .Select(c => c.Value)
                .ToList() ?? new List<string>()
        });
    }
}
```

---

## 3. Feature flags en React (frontend)

```tsx
// ✅ Obtener flags del backend al iniciar la app
interface FeatureFlags {
  nuevoCheckout: boolean;
  recomendacionesIA: boolean;
  dashboardV2: boolean;
}

// Context para flags
const FeatureFlagContext = createContext<FeatureFlags>({
  nuevoCheckout: false,
  recomendacionesIA: false,
  dashboardV2: false,
});

export function FeatureFlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);

  useEffect(() => {
    fetch('/api/feature-flags')  // Endpoint que retorna flags del usuario actual
      .then(r => r.json())
      .then(setFlags);
  }, []);

  if (!flags) return <LoadingSpinner />;

  return (
    <FeatureFlagContext.Provider value={flags}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// ✅ Hook para consumir flags
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const flags = useContext(FeatureFlagContext);
  return flags[flag];
}

// ✅ Componente de guardia
export function FeatureFlag({
  name,
  children,
  fallback = null,
}: {
  name: keyof FeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const enabled = useFeatureFlag(name);
  return enabled ? <>{children}</> : <>{fallback}</>;
}

// ✅ Uso en componentes
function Checkout() {
  const nuevoCheckout = useFeatureFlag('nuevoCheckout');

  return nuevoCheckout ? <NuevoCheckoutFlow /> : <CheckoutClasico />;
}

// O con el componente guard
function App() {
  return (
    <FeatureFlag name="dashboardV2" fallback={<DashboardV1 />}>
      <DashboardV2 />
    </FeatureFlag>
  );
}
```

---

## 4. Endpoint de flags para el frontend

```csharp
// ✅ Controller que expone flags al frontend
[ApiController]
[Route("api/feature-flags")]
[Authorize]
public class FeatureFlagsController : ControllerBase
{
    private readonly IFeatureManager _featureManager;

    public FeatureFlagsController(IFeatureManager featureManager)
    {
        _featureManager = featureManager;
    }

    [HttpGet]
    public async Task<IActionResult> GetFlags()
    {
        // Los flags se evalúan en contexto del usuario actual (via TargetingContextAccessor)
        var flags = new
        {
            nuevoCheckout = await _featureManager.IsEnabledAsync(Features.NuevoCheckout),
            recomendacionesIA = await _featureManager.IsEnabledAsync(Features.RecomendacionesIA),
            dashboardV2 = await _featureManager.IsEnabledAsync(Features.DashboardV2),
        };

        return Ok(flags);
    }
}
```

---

## 5. Estrategias de rollout progresivo

```
Estrategia canary (porcentaje incremental):

Día 1:  1%  → Sin alertas → OK
Día 2:  5%  → Sin alertas → OK
Día 3: 20%  → Sin alertas → OK
Día 5: 50%  → Sin alertas → OK
Día 7: 100% → Rollout completo

Si en cualquier punto hay anomalías:
  → Flag OFF → 0% instantáneamente sin deploy
```

```csharp
// Patrón: Dark Launch
// La feature se activa para TODOS pero los usuarios no la ven
// Se ejecuta en paralelo con la feature antigua para medir impacto

public async Task<RecomendacionesDto> ObtenerRecomendacionesAsync(int usuarioId)
{
    var resultadoClasico = await _recomendacionClasica.ObtenerAsync(usuarioId);

    if (await _featureManager.IsEnabledAsync(Features.RecomendacionesIA))
    {
        try
        {
            // Ejecutar nueva feature en paralelo pero NO retornar a usuario aún
            var resultadoIA = await _recomendacionIA.ObtenerAsync(usuarioId);

            // Solo loguear para comparar resultados
            _logger.LogInformation(
                "DarkLaunch - Clasico: {Classic}, IA: {AI}",
                resultadoClasico.Count, resultadoIA.Count);

            // Métricas de calidad del nuevo algoritmo
            _metrics.Track("recommendations.ia.quality", CalcularCalidad(resultadoIA));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "DarkLaunch IA falló, no afecta al usuario");
        }
    }

    return resultadoClasico;  // Siempre retorna el resultado clásico por ahora
}
```

---

## 6. Azure App Configuration (flags centralizados)

Para múltiples servicios o equipos grandes, los flags deben ser centralizados:

```bash
dotnet add package Microsoft.Azure.AppConfiguration.AspNetCore
```

```csharp
// Program.cs
builder.Configuration.AddAzureAppConfiguration(options =>
{
    options.Connect(connectionString)
           .UseFeatureFlags(ff =>
           {
               ff.Select("*");  // Todos los flags
               ff.CacheExpirationInterval = TimeSpan.FromSeconds(30);  // Refresh cada 30s
           });
});

builder.Services.AddAzureAppConfiguration();
builder.Services.AddFeatureManagement();

// En middleware pipeline
app.UseAzureAppConfiguration();  // Habilita refresh automático
```

Con Azure App Configuration puedes:
- Cambiar flags en tiempo real sin reiniciar la app
- Gestionar flags de múltiples servicios desde un solo lugar
- Auditar quién cambió qué flag y cuándo

---

## Antipatrones que evitar

```
❌ Flag zombie: flags que permanecen meses después del rollout completo
   → Agregar fecha de expiración a cada flag, revisión periódica

❌ Demasiados flags anidados:
   if (flagA && flagB && !flagC) { ... }
   → Confuso, difícil de testear

❌ Lógica de negocio dentro del flag:
   if (await IsEnabled("PrecioEspecial")) { precio *= 0.9m; }
   → El flag debe activar una ruta, no contener la lógica

❌ Flags sin tests:
   → Testea siempre ambos paths (flag ON y flag OFF)
```

---

## Testing con feature flags

```csharp
// ✅ Testear ambos estados del flag
public class PedidoServiceTests
{
    [Fact]
    public async Task ProcesarPedido_FlagNuevoCheckoutON_UsaNuevoFlujo()
    {
        var featureManager = new Mock<IFeatureManager>();
        featureManager
            .Setup(x => x.IsEnabledAsync("NuevoCheckout"))
            .ReturnsAsync(true);

        var service = new PedidoService(featureManager.Object, ...);

        await service.ProcesarAsync(new PedidoRequest());

        // Verificar que se usó el nuevo flujo
    }

    [Fact]
    public async Task ProcesarPedido_FlagNuevoCheckoutOFF_UsaFlujoClasico()
    {
        var featureManager = new Mock<IFeatureManager>();
        featureManager
            .Setup(x => x.IsEnabledAsync("NuevoCheckout"))
            .ReturnsAsync(false);

        // ...
    }
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es un feature flag y cuándo lo usarías?**
> Un feature flag es un condicional en el código que permite activar o desactivar funcionalidad sin hacer un deploy. Lo usaría para: rollouts progresivos, A/B testing, kill switches de emergencia, y separar el deploy del release.

**2. ¿Cuál es la diferencia entre "deploy" y "release"?**
> Deploy es llevar el código a producción. Release es hacer la feature visible a los usuarios. Los feature flags permiten deployar código constantemente (CI/CD) y elegir cuándo hacer el release.

**3. ¿Cómo evitarías la deuda técnica de feature flags?**
> Cada flag debe tener una fecha de expiración y un dueño. Al hacer rollout al 100%, se crea un ticket para remover el flag y el código del path antiguo. Sin disciplina, acaban siendo "flag zombies" que nadie toca.

**4. ¿Qué es un canary release?**
> Activar una nueva feature para un pequeño porcentaje de usuarios (1-5%) antes del rollout completo. Permite detectar bugs en producción con impacto mínimo. Si hay anomalías, el flag se apaga instantáneamente.

**5. ¿Cómo testeas código con feature flags?**
> Mockeas `IFeatureManager` y ejecutas los tests para ambos estados del flag (ON y OFF). Nunca dejes un path sin testear — es exactamente lo que pasa en producción.
