---
id: manejo-errores
title: Manejo de Errores
sidebar_position: 19
---

# Manejo de Errores 🟡

## Estrategias de manejo de errores

### Try-Catch básico (NO HACER ESTO)

```csharp
// ❌ ANTI-PATRÓN: Swallow the exception
try
{
    var usuario = await _repo.ObtenerUsuarioAsync(id);
}
catch
{
    // Silenciar el error — no logs, no manejo
}

// ✅ MEJOR: Loguear y relanzar o manejar específicamente
try
{
    var usuario = await _repo.ObtenerUsuarioAsync(id);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Error obteniendo usuario {UserId}", id);
    throw;  // Re-lanzar para que lo maneje el middleware
}
```

---

## Jerarquía de excepciones personalizada

```csharp
// ✅ Base exception personalizada
public abstract class ApplicationException : Exception
{
    public string ErrorCode { get; }
    public Dictionary<string, object> Metadata { get; } = new();

    protected ApplicationException(string message, string errorCode) 
        : base(message)
    {
        ErrorCode = errorCode;
    }
}

// ✅ Excepciones específicas de negocio
public class NotFoundException : ApplicationException
{
    public NotFoundException(string recurso, object id)
        : base($"{recurso} con ID {id} no encontrado", "NOT_FOUND")
    {
        Metadata["recurso"] = recurso;
        Metadata["id"] = id;
    }
}

public class ValidationException : ApplicationException
{
    public IDictionary<string, string[]> Errors { get; }

    public ValidationException(IDictionary<string, string[]> errors)
        : base("Validación fallida", "VALIDATION_FAILED")
    {
        Errors = errors;
    }
}

public class DuplicateEntityException : ApplicationException
{
    public DuplicateEntityException(string campo, object valor)
        : base($"{campo} '{valor}' ya existe", "DUPLICATE_ENTITY")
    {
        Metadata["campo"] = campo;
        Metadata["valor"] = valor;
    }
}

public class UnauthorizedException : ApplicationException
{
    public UnauthorizedException(string mensaje = "No autorizado")
        : base(mensaje, "UNAUTHORIZED") { }
}

public class ForbiddenException : ApplicationException
{
    public ForbiddenException(string mensaje = "Acceso denegado")
        : base(mensaje, "FORBIDDEN") { }
}

public class ConflictException : ApplicationException
{
    public ConflictException(string mensaje)
        : base(mensaje, "CONFLICT") { }
}

// ✅ Exception para problemas externos (APIs, BD)
public class ExternalServiceException : ApplicationException
{
    public ExternalServiceException(string servicio, string mensaje, Exception? inner = null)
        : base($"Error en servicio externo {servicio}: {mensaje}", "EXTERNAL_SERVICE_ERROR", inner)
    {
        Metadata["servicio"] = servicio;
    }
    
    protected ExternalServiceException(
        string message, string errorCode, Exception? innerException = null)
        : base(message, errorCode, innerException) { }
}

// Versión completa con inner exception
public abstract class ApplicationException : Exception
{
    public string ErrorCode { get; }
    public Dictionary<string, object> Metadata { get; } = new();

    protected ApplicationException(string message, string errorCode, Exception? inner = null)
        : base(message, inner)
    {
        ErrorCode = errorCode;
    }
}
```

---

## Global Exception Handling Middleware

```csharp
// Middleware para capturar TODAS las excepciones
public class GlobalExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandlingMiddleware> _logger;

    public GlobalExceptionHandlingMiddleware(RequestDelegate next, 
        ILogger<GlobalExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {ExceptionMessage}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        
        var response = new ErrorResponse();

        switch (exception)
        {
            case NotFoundException ex:
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                response = new ErrorResponse(ex.ErrorCode, ex.Message, ex.Metadata);
                break;

            case UnauthorizedException ex:
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                response = new ErrorResponse(ex.ErrorCode, ex.Message);
                break;

            case ForbiddenException ex:
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                response = new ErrorResponse(ex.ErrorCode, ex.Message);
                break;

            case ValidationException ex:
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                response = new ErrorResponse(ex.ErrorCode, ex.Message, new { errors = ex.Errors });
                break;

            case DuplicateEntityException ex:
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                response = new ErrorResponse(ex.ErrorCode, ex.Message, ex.Metadata);
                break;

            case ConflictException ex:
                context.Response.StatusCode = StatusCodes.Status409Conflict;
                response = new ErrorResponse(ex.ErrorCode, ex.Message);
                break;

            case ExternalServiceException ex:
                context.Response.StatusCode = StatusCodes.Status502BadGateway;
                response = new ErrorResponse(ex.ErrorCode, 
                    "Servicio externo no disponible", ex.Metadata);
                break;

            default:
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                response = new ErrorResponse("INTERNAL_ERROR", 
                    "Ocurrió un error interno. Por favor intenta más tarde.", 
                    new { exceptionId = context.TraceIdentifier });
                break;
        }

        return context.Response.WriteAsJsonAsync(response);
    }
}

// DTO de respuesta de error
public record ErrorResponse(
    string Code,
    string Message,
    object? Metadata = null,
    DateTime Timestamp = default)
{
    public DateTime Timestamp { get; } = Timestamp == default ? DateTime.UtcNow : Timestamp;
}

// Registrar en Program.cs
app.UseMiddleware<GlobalExceptionHandlingMiddleware>();
```

---

## Result Pattern (Alternativa a excepciones)

```csharp
// ✅ Pattern de Result para operaciones que pueden fallar
public abstract record Result
{
    public sealed record Success(object? Data = null) : Result;
    public sealed record Failure(string Code, string Message, object? Metadata = null) : Result;
}

// Genérico con tipo
public abstract record Result<T>
{
    public sealed record Success(T Data) : Result<T>;
    public sealed record Failure(string Code, string Message) : Result<T>;
}

// Método que retorna Result
public async Task<Result<UsuarioDto>> ObtenerUsuarioAsync(int id)
{
    var usuario = await _db.Usuarios.FindAsync(id);
    
    if (usuario == null)
        return new Result<UsuarioDto>.Failure("USUARIO_NO_ENCONTRADO", 
            $"Usuario con ID {id} no existe");

    return new Result<UsuarioDto>.Success(new UsuarioDto(usuario));
}

// Uso con pattern matching
var resultado = await ObtenerUsuarioAsync(1);

if (resultado is Result<UsuarioDto>.Success success)
{
    return Ok(success.Data);
}
else if (resultado is Result<UsuarioDto>.Failure failure)
{
    return BadRequest(new { error = failure.Code, message = failure.Message });
}

// ✅ Útil para encadenar operaciones
public class OperacionEncadenada
{
    public async Task<Result<string>> CrearPedidoConValidacionAsync(
        CreateOrderDto dto, int usuarioId)
    {
        // Paso 1: Validar
        var validacion = ValidarPedido(dto);
        if (validacion is Result<string>.Failure f1)
            return f1;

        // Paso 2: Verificar usuario
        var usuario = await _db.Usuarios.FindAsync(usuarioId);
        if (usuario == null)
            return new Result<string>.Failure("USUARIO_NO_ENCONTRADO", 
                "Usuario no existe");

        // Paso 3: Crear
        var pedido = new Pedido { UsuarioId = usuarioId, ... };
        _db.Pedidos.Add(pedido);
        await _db.SaveChangesAsync();

        return new Result<string>.Success(pedido.Id.ToString());
    }
}
```

---

## Error Handling en React

```tsx
// ✅ Error Boundary: Capturar errores en árbol de componentes
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Loguear a servicio de error tracking (Sentry, LogRocket, etc.)
    console.error('Error caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
    
    this.setState({
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Algo salió mal</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error?.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
          <button onClick={() => this.setState({ hasError: false })}>
            Intentar de nuevo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ✅ Usar Error Boundary
<ErrorBoundary onError={(error, info) => logearAExterno(error)}>
  <Dashboard />
  <router>
    <Home />
    <ProductoDetalle />
  </router>
</ErrorBoundary>

// ⚠️ Error Boundary NO captura:
// - Errores en event handlers (usar try-catch)
// - Errores async (promises rechazadas)
// - Server-side rendering
```

### Manejo de errores async en componentes

```tsx
import { useEffect, useState } from 'react';

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;  // ← Prevenir memory leaks

    (async () => {
      try {
        setLoading(true);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        
        if (isMounted) {  // ← Solo actualizar si el componente sigue montado
          setData(json);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error desconocido');
          setData(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;  // ← Cleanup
    };
  }, [url]);

  return { data, error, loading };
}

// Uso
function Producto({ id }: { id: number }) {
  const { data, error, loading } = useFetch(`/api/productos/${id}`);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!data) return <div>Sin datos</div>;

  return <div>{data.nombre}</div>;
}

// ✅ Con retry automático
export function useFetchConRetry<T>(url: string, maxRetries = 3) {
  const [retryCount, setRetryCount] = useState(0);
  const { data, error, loading } = useFetch(url);

  const retry = () => {
    if (retryCount < maxRetries) {
      setRetryCount(retryCount + 1);
    }
  };

  // Reintentar automáticamente con exponential backoff
  useEffect(() => {
    if (error && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;  // 1s, 2s, 4s...
      const timeout = setTimeout(retry, delay);
      return () => clearTimeout(timeout);
    }
  }, [error, retryCount]);

  return { data, error: retryCount >= maxRetries ? error : null, loading, retry };
}
```

### Integración con servicio de error tracking

```tsx
import * as Sentry from '@sentry/react';

// ✅ Inicializar Sentry
Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filtrar errores que no quieres reportar
    if (event.exception) {
      const error = hint.originalException;
      if (error instanceof NetworkError) {
        return null;  // No reportar errores de red sin importancia
      }
    }
    return event;
  },
});

// ✅ Capturar errores manualmente
try {
  await api.crearProducto(data);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      seccion: 'productos',
      operacion: 'crear'
    },
    extra: {
      usuarioId: currentUser.id,
      input: data
    },
    level: 'error',
  });
}

// ✅ Envolver con Sentry
const App = Sentry.withProfiler(
  <ErrorBoundary fallback={<ErrorPage />}>
    <Dashboard />
  </ErrorBoundary>
);
```

---

## Graceful Degradation (Manejo elegante de fallos)

```csharp
// ✅ Si un servicio externo falla, continuar con funcionalidad básica
public class ProductoService
{
    private readonly IProductoRepository _repo;
    private readonly IRecomendacionService _recomendacion;  // Servicio externo

    public async Task<ProductoDto> ObtenerProductoAsync(int id)
    {
        var producto = await _repo.ObtenerAsync(id)
            ?? throw new NotFoundException(nameof(Producto), id);

        var dto = new ProductoDto(producto);

        // Intentar obtener recomendaciones, pero si falla, continuar sin ellas
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
            dto.Recomendaciones = await _recomendacion
                .ObtenerRecomendacionesAsync(id, cts.Token);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, 
                "Error obteniendo recomendaciones. Continuando sin recomendaciones.");
            // No lanzar exception — retornar producto sin recomendaciones
        }

        return dto;
    }
}

// ✅ En React: fallback UI
export function ProductoDetalle({ id }: Props) {
  const { data: producto, error: errorProducto } = useFetch(`/api/productos/${id}`);
  const { data: recomendaciones, error: errorRec } = useFetch(
    `/api/recomendaciones/${id}`
  );

  if (errorProducto) return <ErrorPage error={errorProducto} />;

  return (
    <div>
      <h1>{producto?.nombre}</h1>
      
      {/* Si fallan las recomendaciones, simplemente no mostrar */}
      {recomendaciones && recomendaciones.length > 0 && (
        <section>
          <h3>Recomendaciones</h3>
          {recomendaciones.map(r => <ProductoCard key={r.id} {...r} />)}
        </section>
      )}
    </div>
  );
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Excepciones o Result Pattern? ¿Cuál es mejor?**
> **Excepciones**: Simples para flujos "happy path", naturales en C#. **Result Pattern**: Más explícito, mejor para operaciones que fallan frecuentemente, fuerza el manejo. Recomendación: Excepciones para errores inesperados (siempre las captura el middleware), Result Pattern para operaciones que pueden fallar obviar (validación).

**2. ¿Cómo evitas memory leaks en hooks con fetch?**
> Usar una bandera `isMounted` que se pone a `false` en el cleanup. Así no haces `setState` en un componente unmounted. Mejor: usar librerías como `react-query` o `swr` que manejan esto automáticamente.

**3. ¿Por qué usar Error Boundary si tienes try-catch?**
> Error Boundary captura errores del árbol de componentes. Try-catch solo funciona en el mismo componente. Si un componente hijo lanza un error, propaga arriba. Error Boundary lo atrapa.

**4. ¿Timeout en APIs externas?**
> Siempre. `HttpClient.Timeout`, `CancellationToken`, o `Task.TimeoutAfter()`. Si un servicio externo es lento, bloquea tu aplicación. Timeout + reintentos + fallback es el patrón.

**5. ¿Cuándo relanzar (throw) vs retornar resultado?**
> **Relanzar**: Si es un error irrecuperable (BD desconectada). **Retornar**: Si es esperado (usuario no encontrado). Regla: ¿El caller espera este error? Si sí, retorna un Result o excepción específica. Si no, middleware lo maneja.

**6. ¿Cómo logueas errores sin llenarte de spam?**
> 1. Diferentes niveles (Error, Warning, Info). 2. Filtrar logs en producción (solo errores críticos). 3. Agrupar errores repetidos en Sentry. 4. Samplear logs (50% de requests, no todos).

**7. ¿Circuit Breaker para servicios externos?**
> Sí. Si un servicio falla 5 veces seguidas, dejar de intentar por 30 segundos (circuit abierto). Evitas sobrecargar un servicio que está caído. Librerías: Polly (C#), axios retry (JS).

**8. ¿Error Boundary en Next.js / SSR?**
> Error Boundary solo funciona en client-side. En Next.js, usa `error.js` file para SSR errors. En client, usa Error Boundary. Son conceptos complementarios.