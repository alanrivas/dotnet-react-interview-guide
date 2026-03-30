---
id: semantic-kernel-ai
title: AI e Integración con LLMs en .NET
sidebar_position: 20
---

# AI e Integración con LLMs en .NET 🔴

Integrar modelos de lenguaje (LLMs) en aplicaciones .NET es una de las habilidades más demandadas en 2025. **Semantic Kernel** es el SDK oficial de Microsoft para orquestar AI en .NET. Combina llamadas a LLMs con código tradicional, memoria, plugins y planificación automática.

---

## El ecosistema en .NET

```
Azure OpenAI / OpenAI API
         │
         ▼
  Semantic Kernel SDK          ← orquestación, plugins, memoria
         │
    ┌────┴────────────────────┐
    │                         │
  Plugins              Memory/RAG
  (funciones .NET      (embeddings,
   + prompts)           búsqueda semántica)
    │                         │
    ▼                         ▼
  ASP.NET Core API      Vector DB
  (expone el AI          (Azure AI Search,
   al cliente)            Qdrant, pgvector)
```

---

## Setup básico — Semantic Kernel

```xml
<!-- .csproj -->
<PackageReference Include="Microsoft.SemanticKernel"                   Version="1.21.1" />
<PackageReference Include="Microsoft.SemanticKernel.Connectors.AzureOpenAI" Version="1.21.1" />
```

```csharp
// Program.cs
using Microsoft.SemanticKernel;

var builder = WebApplication.CreateBuilder(args);

// Registrar Semantic Kernel como singleton
builder.Services.AddSingleton(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();

    var kernelBuilder = Kernel.CreateBuilder();

    // Opción A: Azure OpenAI
    kernelBuilder.AddAzureOpenAIChatCompletion(
        deploymentName: config["AzureOpenAI:DeploymentName"]!,   // "gpt-4o"
        endpoint:       config["AzureOpenAI:Endpoint"]!,
        apiKey:         config["AzureOpenAI:ApiKey"]!);

    // Opción B: OpenAI directo
    // kernelBuilder.AddOpenAIChatCompletion(
    //     modelId: "gpt-4o",
    //     apiKey:  config["OpenAI:ApiKey"]!);

    return kernelBuilder.Build();
});

var app = builder.Build();
```

---

## Chat Completion — lo básico

```csharp
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;

public class ChatService
{
    private readonly Kernel _kernel;
    private readonly IChatCompletionService _chat;

    public ChatService(Kernel kernel)
    {
        _kernel = kernel;
        _chat   = kernel.GetRequiredService<IChatCompletionService>();
    }

    // Llamada simple sin historial
    public async Task<string> ResponderAsync(string pregunta)
    {
        var result = await _kernel.InvokePromptAsync(pregunta);
        return result.ToString();
    }

    // Chat con historial de conversación
    public async Task<string> ChatAsync(List<ChatMessage> historial, string nuevaMensaje)
    {
        var chatHistory = new ChatHistory();

        // System prompt — define el comportamiento del asistente
        chatHistory.AddSystemMessage("""
            Eres un asistente experto en .NET y C#.
            Responde de forma concisa y con ejemplos de código cuando sea apropiado.
            Si no sabés algo, decilo — no inventes.
            """);

        // Cargar historial previo
        foreach (var msg in historial)
        {
            if (msg.Role == "user")
                chatHistory.AddUserMessage(msg.Content);
            else
                chatHistory.AddAssistantMessage(msg.Content);
        }

        chatHistory.AddUserMessage(nuevaMensaje);

        var settings = new OpenAIPromptExecutionSettings
        {
            MaxTokens    = 1000,
            Temperature  = 0.7,   // 0 = determinístico, 1 = creativo
            TopP         = 0.95
        };

        var response = await _chat.GetChatMessageContentAsync(chatHistory, settings, _kernel);
        return response.Content ?? string.Empty;
    }
}
```

---

## Streaming — respuestas en tiempo real

```csharp
// En el endpoint de ASP.NET Core — SSE (Server-Sent Events)
app.MapGet("/chat/stream", async (string pregunta, Kernel kernel, HttpResponse response) =>
{
    response.Headers.ContentType = "text/event-stream";
    response.Headers.CacheControl = "no-cache";

    var chat = kernel.GetRequiredService<IChatCompletionService>();
    var history = new ChatHistory();
    history.AddUserMessage(pregunta);

    await foreach (var chunk in chat.GetStreamingChatMessageContentsAsync(history))
    {
        if (chunk.Content is not null)
        {
            // Formato SSE: "data: {contenido}\n\n"
            await response.WriteAsync($"data: {chunk.Content}\n\n");
            await response.Body.FlushAsync();
        }
    }

    await response.WriteAsync("data: [DONE]\n\n");
});
```

```typescript
// Consumir el stream desde React
function useStreamingChat(pregunta: string) {
  const [respuesta, setRespuesta] = useState("");

  useEffect(() => {
    const eventSource = new EventSource(`/chat/stream?pregunta=${encodeURIComponent(pregunta)}`);

    eventSource.onmessage = (e) => {
      if (e.data === "[DONE]") {
        eventSource.close();
        return;
      }
      setRespuesta(prev => prev + e.data);
    };

    return () => eventSource.close();
  }, [pregunta]);

  return respuesta;
}
```

---

## Plugins — extender el LLM con código .NET

Los plugins son la forma de darle al LLM acceso a funciones reales: consultar una BD, llamar una API, ejecutar lógica de negocio.

```csharp
using Microsoft.SemanticKernel;
using System.ComponentModel;

// Plugin: funciones que el LLM puede invocar
public class ProductoPlugin
{
    private readonly IProductoRepository _repo;

    public ProductoPlugin(IProductoRepository repo) => _repo = repo;

    [KernelFunction("buscar_productos")]
    [Description("Busca productos por nombre o categoría. Retorna lista de productos disponibles.")]
    public async Task<string> BuscarProductosAsync(
        [Description("Nombre o categoría a buscar")] string query,
        [Description("Número máximo de resultados (default: 5)")] int limite = 5)
    {
        var productos = await _repo.BuscarAsync(query, limite);

        if (!productos.Any())
            return "No se encontraron productos para ese criterio.";

        return string.Join("\n", productos.Select(p =>
            $"- {p.Nombre}: ${p.Precio:F2} ({p.Stock} en stock)"));
    }

    [KernelFunction("verificar_stock")]
    [Description("Verifica si un producto específico tiene stock disponible.")]
    public async Task<string> VerificarStockAsync(
        [Description("ID del producto")] int productoId)
    {
        var producto = await _repo.GetByIdAsync(productoId);

        if (producto is null)
            return "Producto no encontrado.";

        return producto.Stock > 0
            ? $"{producto.Nombre} tiene {producto.Stock} unidades disponibles."
            : $"{producto.Nombre} está agotado.";
    }
}

// Registrar el plugin en el Kernel
kernelBuilder.Plugins.AddFromType<ProductoPlugin>();

// O desde un objeto ya construido (con DI)
var plugin = new ProductoPlugin(productoRepository);
kernel.Plugins.AddFromObject(plugin, "Productos");
```

### Function Calling automático

```csharp
// El LLM decide automáticamente cuándo y cómo llamar los plugins
public async Task<string> AsistenteProductosAsync(string pregunta)
{
    var settings = new OpenAIPromptExecutionSettings
    {
        // Auto: el LLM llama funciones automáticamente hasta resolver la pregunta
        ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions
    };

    var result = await _kernel.InvokePromptAsync(pregunta, new(settings));
    return result.ToString();

    // Ejemplo: "¿Hay laptops disponibles?"
    // → El LLM llama buscar_productos("laptop")
    // → Recibe los resultados
    // → Formula una respuesta natural
}
```

---

## RAG — Retrieval Augmented Generation

RAG permite que el LLM responda basándose en **tu propio contenido** (documentos, BD, manuales) sin fine-tuning.

```
Flujo RAG:

  Pregunta del usuario
       │
       ▼
  Embeddings del texto      ← convertir pregunta
  (vector numérico)           a vector
       │
       ▼
  Búsqueda semántica         ← encontrar fragmentos
  en Vector DB                 similares
       │
       ▼
  Fragmentos relevantes      ← contexto recuperado
       │
       ▼
  Prompt = pregunta +        ← armar el prompt
           contexto recuperado
       │
       ▼
  LLM genera respuesta       ← solo con info real
  basada en el contexto        (sin alucinaciones)
```

### Indexar documentos (ingestión)

```csharp
using Microsoft.SemanticKernel.Embeddings;
using Microsoft.SemanticKernel.Memory;

// Setup con Azure AI Search como vector store
builder.Services.AddSingleton<ISemanticTextMemory>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();

    return new MemoryBuilder()
        .WithAzureOpenAITextEmbeddingGeneration(
            deploymentName: "text-embedding-3-small",
            endpoint:       config["AzureOpenAI:Endpoint"]!,
            apiKey:         config["AzureOpenAI:ApiKey"]!)
        .WithAzureAISearch(
            endpoint: config["AzureAISearch:Endpoint"]!,
            apiKey:   config["AzureAISearch:ApiKey"]!)
        .Build();
});

// Indexar un documento
public class DocumentoIndexador
{
    private readonly ISemanticTextMemory _memory;

    public DocumentoIndexador(ISemanticTextMemory memory) => _memory = memory;

    public async Task IndexarAsync(string id, string texto, string fuente)
    {
        // Dividir en chunks si el documento es grande
        var chunks = ChunkearTexto(texto, maxTokens: 500);

        for (int i = 0; i < chunks.Count; i++)
        {
            await _memory.SaveInformationAsync(
                collection: "documentos",
                id:          $"{id}-chunk-{i}",
                text:        chunks[i],
                description: fuente);
        }
    }

    private static List<string> ChunkearTexto(string texto, int maxTokens)
    {
        // Dividir por párrafos manteniendo contexto
        var parrafos = texto.Split("\n\n", StringSplitOptions.RemoveEmptyEntries);
        var chunks = new List<string>();
        var chunkActual = new StringBuilder();

        foreach (var parrafo in parrafos)
        {
            // Estimación simple: ~4 chars = 1 token
            if (chunkActual.Length + parrafo.Length > maxTokens * 4)
            {
                if (chunkActual.Length > 0)
                {
                    chunks.Add(chunkActual.ToString());
                    chunkActual.Clear();
                }
            }
            chunkActual.AppendLine(parrafo);
        }

        if (chunkActual.Length > 0)
            chunks.Add(chunkActual.ToString());

        return chunks;
    }
}
```

### Consultar con RAG

```csharp
public class RagChatService
{
    private readonly Kernel _kernel;
    private readonly ISemanticTextMemory _memory;

    public RagChatService(Kernel kernel, ISemanticTextMemory memory)
    {
        _kernel = kernel;
        _memory = memory;
    }

    public async Task<string> PreguntarAsync(string pregunta)
    {
        // 1. Recuperar fragmentos relevantes
        var resultados = _memory.SearchAsync(
            collection: "documentos",
            query:      pregunta,
            limit:      3,             // top 3 más similares
            minRelevanceScore: 0.7);   // filtrar por relevancia mínima

        var contexto = new StringBuilder();
        await foreach (var resultado in resultados)
        {
            contexto.AppendLine($"Fuente: {resultado.Metadata.Description}");
            contexto.AppendLine(resultado.Metadata.Text);
            contexto.AppendLine("---");
        }

        if (contexto.Length == 0)
            return "No encontré información relevante en la base de conocimiento.";

        // 2. Construir prompt con el contexto recuperado
        var prompt = $"""
            Responde la siguiente pregunta SOLO basándote en el contexto proporcionado.
            Si la respuesta no está en el contexto, di "No tengo esa información".
            No inventes datos.

            CONTEXTO:
            {contexto}

            PREGUNTA: {pregunta}

            RESPUESTA:
            """;

        // 3. Generar respuesta
        var result = await _kernel.InvokePromptAsync(prompt);
        return result.ToString();
    }
}
```

---

## Prompt Templates — reutilizar prompts

```csharp
// Definir un prompt reutilizable con parámetros
// Los backticks del bloque de código se escapan como &#96; en el template
const string promptTemplate =
    "Eres un experto en {{$lenguaje}}.\n" +
    "Analiza el siguiente código y:\n" +
    "1. Identifica problemas o code smells\n" +
    "2. Sugiere mejoras concretas\n" +
    "3. Provee el código mejorado\n\n" +
    "CÓDIGO:\n" +
    "{{$codigo}}";

// Crear la función de prompt
var revisarCodigo = _kernel.CreateFunctionFromPrompt(
    promptTemplate,
    new OpenAIPromptExecutionSettings { MaxTokens = 2000 });

// Invocar con argumentos
var resultado = await _kernel.InvokeAsync(revisarCodigo, new KernelArguments
{
    ["lenguaje"] = "csharp",
    ["codigo"]   = codigoARevisar
});

Console.WriteLine(resultado);
```

---

## Manejo de costos y límites

```csharp
// Monitorear uso de tokens
public class TokenUsageLogger
{
    private readonly ILogger<TokenUsageLogger> _logger;

    public TokenUsageLogger(ILogger<TokenUsageLogger> logger) => _logger = logger;

    public void LogUsage(FunctionResult result)
    {
        var usage = result.Metadata?["Usage"] as CompletionsUsage;
        if (usage is null) return;

        _logger.LogInformation(
            "Tokens — Prompt: {Prompt}, Completion: {Completion}, Total: {Total}",
            usage.PromptTokens,
            usage.CompletionTokens,
            usage.TotalTokens);

        // Alertar si el costo sube (gpt-4o: ~$0.005/1K tokens input, $0.015/1K output)
        if (usage.TotalTokens > 3000)
            _logger.LogWarning("Uso elevado de tokens: {Total}", usage.TotalTokens);
    }
}

// Middleware para rate limiting de la API de AI
public class AiRateLimitMiddleware
{
    private static readonly SemaphoreSlim _semaphore = new(10); // max 10 concurrent

    public async Task<string> EjecutarConLimiteAsync(Func<Task<string>> operacion)
    {
        await _semaphore.WaitAsync();
        try
        {
            return await operacion();
        }
        finally
        {
            _semaphore.Release();
        }
    }
}
```

---

## Patrones de arquitectura para AI

### Patrón: AI como servicio encapsulado

```csharp
// NO exponer Semantic Kernel directamente en los controllers
// SÍ encapsular en un servicio de dominio

// ❌ Mal — el controller conoce detalles de SK
[ApiController]
public class ChatController : ControllerBase
{
    private readonly Kernel _kernel; // acoplado a SK
    // ...
}

// ✅ Bien — abstracción de dominio
public interface IAsistenteService
{
    Task<string> ResponderAsync(string pregunta, CancellationToken ct = default);
    IAsyncEnumerable<string> StreamearAsync(string pregunta, CancellationToken ct = default);
}

public class AsistenteService : IAsistenteService
{
    private readonly Kernel _kernel; // SK es un detalle de implementación
    // ...
}

[ApiController]
public class ChatController : ControllerBase
{
    private readonly IAsistenteService _asistente; // desacoplado
    // ...
}
```

### Patrón: caché de respuestas

```csharp
// Muchas preguntas son repetidas — cachear ahorra costo
public class CachedAsistenteService : IAsistenteService
{
    private readonly IAsistenteService _inner;
    private readonly IDistributedCache  _cache;

    public async Task<string> ResponderAsync(string pregunta, CancellationToken ct = default)
    {
        // Hash de la pregunta como clave de cache
        var cacheKey = $"ai:{Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(pregunta)))}";

        var cached = await _cache.GetStringAsync(cacheKey, ct);
        if (cached is not null)
            return cached;

        var respuesta = await _inner.ResponderAsync(pregunta, ct);

        await _cache.SetStringAsync(cacheKey, respuesta, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24)
        }, ct);

        return respuesta;
    }
}
```

---

## Seguridad en aplicaciones AI

```csharp
// 1. PROMPT INJECTION — el usuario intenta manipular el sistema
// Siempre separar sistema de usuario con mensajes de roles

// ❌ Vulnerable: mezclar system prompt con input del usuario
var prompt = $"Eres un asistente útil. Usuario dijo: {userInput}";
// Un usuario malicioso puede escribir: "Ignora todo lo anterior y..."

// ✅ Seguro: usar ChatHistory con roles separados
var history = new ChatHistory();
history.AddSystemMessage("Eres un asistente útil. Solo responde sobre productos de la tienda.");
history.AddUserMessage(userInput); // separado, el modelo sabe que es input de usuario

// 2. Validación de output
public async Task<string> ResponderSeguoAsync(string pregunta)
{
    var respuesta = await _asistente.ResponderAsync(pregunta);

    // Filtrar información sensible en la respuesta
    if (ContieneDatosPersonales(respuesta))
    {
        _logger.LogWarning("Respuesta AI contenía datos potencialmente sensibles");
        return "No puedo proporcionar esa información.";
    }

    return respuesta;
}

// 3. Rate limiting por usuario
// (usar el rate limiting nativo de .NET 8 — ver sección rate-limiting)
```

---

## Testing de código AI

```csharp
// Abstraer el kernel para poder mockear en tests
public interface IKernelWrapper
{
    Task<string> InvokeAsync(string prompt);
}

// Tests sin llamar a la API real (caro y lento)
public class AsistenteServiceTests
{
    [Fact]
    public async Task Responder_PropagaPromptAlKernel()
    {
        // Arrange
        var mockKernel = Substitute.For<IKernelWrapper>();
        mockKernel.InvokeAsync(Arg.Any<string>())
                  .Returns("respuesta del modelo");

        var service = new AsistenteService(mockKernel);

        // Act
        var resultado = await service.ResponderAsync("hola");

        // Assert
        Assert.Equal("respuesta del modelo", resultado);
        await mockKernel.Received(1).InvokeAsync(Arg.Is<string>(p => p.Contains("hola")));
    }
}

// Integration test con modelo real (ejecutar solo en CI dedicado)
[Trait("Category", "Integration-AI")]
public class AsistenteIntegrationTests
{
    [Fact]
    public async Task Responder_ConPreguntaSimple_RetornaRespuestaCoherente()
    {
        // Requiere variables de entorno con credenciales reales
        var kernel = BuildKernelFromEnvironment();
        var service = new AsistenteService(kernel);

        var respuesta = await service.ResponderAsync("¿Cuánto es 2 + 2?");

        Assert.Contains("4", respuesta);
    }
}
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es Semantic Kernel y por qué existe?**
> Semantic Kernel es el SDK de Microsoft para integrar LLMs en aplicaciones .NET. Resuelve el problema de orquestar llamadas a modelos de AI con código tradicional: conecta prompts, funciones .NET (plugins), memoria semántica y planificación automática. Existe porque usar la API de OpenAI directamente es suficiente para llamadas simples, pero cuando necesitás RAG, function calling, historial de conversación y routing entre modelos, se vuelve complejo. SK encapsula esa complejidad.

**2. ¿Qué es RAG y cuándo lo usarías?**
> RAG (Retrieval Augmented Generation) es un patrón que recupera fragmentos de texto relevantes de una base de conocimiento propia y los inyecta en el prompt antes de enviarlo al LLM. Lo usaría cuando: el LLM necesita conocimiento específico de la empresa (documentos internos, catálogo de productos, FAQs), los datos cambian frecuentemente (el fine-tuning es costoso y lento), o necesito que el modelo cite fuentes verificables. El LLM responde solo con información real — reduce alucinaciones.

**3. ¿Cómo prevenís prompt injection?**
> Separando siempre el system prompt del input del usuario usando roles de ChatHistory — el modelo trata diferente las instrucciones del sistema de las del usuario. Nunca concatenar input del usuario directamente en un system prompt. Validar y sanitizar el input antes de enviarlo. Validar también el output — filtrar respuestas que contengan patrones sospechosos. Y usar el principio de least privilege en los plugins: un plugin de catálogo no debería poder escribir en la BD.

**4. ¿Cómo manejás los costos de la API de OpenAI?**
> Varias estrategias en capas: cachear respuestas para preguntas repetidas (muchas preguntas se repiten, ahorra 40-60% en proyectos reales), limitar el tamaño del contexto (maxTokens, context window), usar el modelo más barato que resuelva el problema (gpt-4o-mini para tareas simples, gpt-4o para razonamiento complejo), monitorear tokens por request con los metadatos de uso, y rate limiting para evitar abuse. También diseñar los prompts para ser concisos — un prompt mal diseñado puede usar 3x más tokens que uno bien diseñado.

**5. ¿Qué diferencia hay entre temperatura 0 y temperatura 1 en un LLM?**
> Temperatura controla la aleatoriedad del sampling. Temperatura 0 = el modelo siempre elige el token más probable — respuestas determinísticas y consistentes, ideal para código, SQL, extracción de datos estructurados. Temperatura 1 = sampling con toda la distribución de probabilidad — respuestas más variadas y creativas, mejor para generación de contenido, brainstorming. En producción para casos de uso técnicos (clasificación, extracción, código) usamos 0 o cerca de 0. Para asistentes conversacionales, 0.7 es un buen balance.

**6. ¿Cómo testearías una feature que usa un LLM?**
> En unit tests, mockeo la abstracción del kernel para no llamar a la API real — verifico que el prompt se construye correctamente y que se procesa bien la respuesta. Para integration tests, los separo con un trait y solo corren en un CI dedicado con credenciales reales — verifico que la respuesta sea semánticamente correcta para inputs conocidos. Para evaluación de calidad, uso un enfoque LLM-as-judge: otro LLM evalúa si la respuesta cumple los criterios definidos. También hago tests de regresión con un golden dataset de pregunta/respuesta esperada.
