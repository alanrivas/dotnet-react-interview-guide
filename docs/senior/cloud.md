---
id: cloud
title: Cloud — Azure para .NET
sidebar_position: 8
---

# Cloud — Azure para .NET 🔴

## Servicios Azure más relevantes para Full Stack .NET

### Compute

```
Azure App Service         → hosting de APIs y web apps (PaaS)
Azure Container Apps      → contenedores serverless con escala automática
Azure Kubernetes Service  → K8s administrado
Azure Functions           → serverless, event-driven

¿Cuándo usar cada uno?
- App Service: apps tradicionales, fácil deploy, sin gestión de infra
- Container Apps: apps contenerizadas que necesitan escala a cero
- AKS: microservicios complejos, control total de K8s
- Functions: triggers de eventos (colas, timers, HTTP esporádico)
```

### Storage y Bases de datos

```
Azure SQL Database        → SQL Server administrado (PaaS)
Azure Cosmos DB           → NoSQL multi-modelo, distribución global
Azure Blob Storage        → archivos, imágenes, backups
Azure Cache for Redis     → cache distribuido
Azure Service Bus         → mensajería empresarial (colas, topics)
Azure Event Hub           → streaming de eventos a gran escala
```

---

## Azure App Service — Deploy de APIs .NET

```yaml
# GitHub Actions para deploy a Azure App Service
- name: Deploy to Azure Web App
  uses: azure/webapps-deploy@v3
  with:
    app-name: mi-api-prod
    publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
    package: ./publish

# O con Azure CLI
- name: Login a Azure
  uses: azure/login@v1
  with:
    creds: ${{ secrets.AZURE_CREDENTIALS }}

- name: Deploy
  run: |
    az webapp deployment source config-zip \
      --resource-group mi-rg \
      --name mi-api \
      --src ./publish.zip
```

```csharp
// Leer configuración de Azure App Service
// Las variables de entorno del App Service se convierten en config de .NET
// "ConnectionStrings:Default" en App Settings → ConnectionStrings__Default

var builder = WebApplication.CreateBuilder(args);

// En producción, Azure App Service inyecta config automáticamente
// Adicional: Azure Key Vault para secrets
if (builder.Environment.IsProduction())
{
    builder.Configuration.AddAzureKeyVault(
        new Uri($"https://{builder.Configuration["KeyVaultName"]}.vault.azure.net/"),
        new DefaultAzureCredential() // usa Managed Identity
    );
}
```

---

## Azure Blob Storage

```csharp
// Instalar: Azure.Storage.Blobs
public class BlobStorageService
{
    private readonly BlobServiceClient _blobServiceClient;

    public BlobStorageService(IConfiguration config)
    {
        _blobServiceClient = new BlobServiceClient(
            config.GetConnectionString("AzureStorage"));
    }

    public async Task<string> SubirArchivoAsync(
        string containerName, string fileName, Stream contenido, string contentType)
    {
        var containerClient = _blobServiceClient.GetBlobContainerClient(containerName);
        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

        var blobClient = containerClient.GetBlobClient(fileName);
        await blobClient.UploadAsync(contenido, new BlobHttpHeaders
        {
            ContentType = contentType
        });

        return blobClient.Uri.ToString();
    }

    public async Task<Stream> DescargarArchivoAsync(string containerName, string fileName)
    {
        var blobClient = _blobServiceClient
            .GetBlobContainerClient(containerName)
            .GetBlobClient(fileName);

        var response = await blobClient.DownloadStreamingAsync();
        return response.Value.Content;
    }

    // Generar SAS URL para acceso temporal (ej: para download seguro)
    public string GenerarSasUrl(string containerName, string fileName, TimeSpan duracion)
    {
        var blobClient = _blobServiceClient
            .GetBlobContainerClient(containerName)
            .GetBlobClient(fileName);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = fileName,
            Resource = "b",
            ExpiresOn = DateTimeOffset.UtcNow.Add(duracion),
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Read);

        return blobClient.GenerateSasUri(sasBuilder).ToString();
    }
}
```

---

## Azure Service Bus

```csharp
// Mensajería empresarial: colas y topics/subscriptions

// Producer
public class PedidoPublisher
{
    private readonly ServiceBusClient _client;
    private readonly ServiceBusSender _sender;

    public PedidoPublisher(IConfiguration config)
    {
        _client = new ServiceBusClient(config["ServiceBus:ConnectionString"]);
        _sender = _client.CreateSender("pedidos"); // queue o topic name
    }

    public async Task PublicarPedidoCreado(PedidoCreadoEvent evento)
    {
        var mensaje = new ServiceBusMessage(JsonSerializer.Serialize(evento))
        {
            ContentType = "application/json",
            Subject = "PedidoCreado",
            MessageId = Guid.NewGuid().ToString(),
            // Propiedades para filtrado en subscriptions
            ApplicationProperties = { ["Prioridad"] = evento.EsUrgente ? "Alta" : "Normal" }
        };

        await _sender.SendMessageAsync(mensaje);
    }
}

// Consumer (hosted service)
public class PedidoConsumer : BackgroundService
{
    private readonly ServiceBusProcessor _processor;

    public PedidoConsumer(IConfiguration config, IServiceProvider services)
    {
        var client = new ServiceBusClient(config["ServiceBus:ConnectionString"]);
        _processor = client.CreateProcessor("pedidos", new ServiceBusProcessorOptions
        {
            MaxConcurrentCalls = 10,
            AutoCompleteMessages = false,
        });

        _processor.ProcessMessageAsync += async args =>
        {
            var evento = JsonSerializer.Deserialize<PedidoCreadoEvent>(
                args.Message.Body.ToString())!;

            using var scope = services.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IPedidoService>();
            await service.ProcesarAsync(evento);

            await args.CompleteMessageAsync(args.Message); // ACK
        };

        _processor.ProcessErrorAsync += args =>
        {
            // Log error, el mensaje vuelve a la cola
            return Task.CompletedTask;
        };
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        await _processor.StartProcessingAsync(ct);
        await Task.Delay(Timeout.Infinite, ct);
    }
}
```

---

## Azure Functions

```csharp
// Trigger HTTP
public class ProductosFunctions
{
    [Function("GetProducto")]
    public async Task<HttpResponseData> GetProducto(
        [HttpTrigger(AuthorizationLevel.Function, "get", Route = "productos/{id}")] 
        HttpRequestData req,
        int id)
    {
        var producto = await _service.ObtenerAsync(id);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(producto);
        return response;
    }

    // Timer trigger: corre cada día a las 2 AM
    [Function("LimpiarRegistrosAntiguos")]
    public async Task LimpiarAntiguos(
        [TimerTrigger("0 0 2 * * *")] TimerInfo timer)
    {
        await _cleanupService.EjecutarAsync();
    }

    // Service Bus trigger: procesar mensajes
    [Function("ProcesarPedido")]
    public async Task ProcesarPedido(
        [ServiceBusTrigger("pedidos", Connection = "ServiceBus")] 
        PedidoCreadoEvent evento)
    {
        await _pedidoService.ProcesarAsync(evento);
    }

    // Blob trigger: procesar archivos subidos
    [Function("ProcesarImagen")]
    public async Task ProcesarImagen(
        [BlobTrigger("imagenes/{name}", Connection = "Storage")] 
        Stream blob, string name)
    {
        await _imageService.ProcesarAsync(blob, name);
    }
}
```

---

## Managed Identity — Sin contraseñas en código

```csharp
// La forma correcta de autenticar servicios Azure en producción
// La VM/App Service/Container tiene una identidad → Azure AD la autentica automáticamente

// ❌ Con connection string con contraseña
var client = new SecretClient(
    new Uri("https://mi-vault.vault.azure.net/"),
    new ClientSecretCredential(tenantId, clientId, clientSecret)); // secret en código!

// ✅ Con Managed Identity (sin secrets)
var client = new SecretClient(
    new Uri("https://mi-vault.vault.azure.net/"),
    new DefaultAzureCredential()); // usa Managed Identity en Azure, dev credentials localmente

// DefaultAzureCredential prueba en orden:
// 1. EnvironmentCredential
// 2. WorkloadIdentityCredential
// 3. ManagedIdentityCredential (en Azure)
// 4. SharedTokenCacheCredential
// 5. VisualStudioCredential (en local)
// 6. AzureCliCredential (en local con az login)
```

---

## Preguntas frecuentes 🎯

**1. ¿Cuál es la diferencia entre IaaS, PaaS y SaaS?**
> **IaaS** (VMs): tú gestionas OS, runtime, app. **PaaS** (App Service, Azure SQL): el proveedor gestiona OS y runtime, tú solo la app. **SaaS** (Office 365): el proveedor gestiona todo. En .NET generalmente usamos PaaS para mayor velocidad y menos gestión.

**2. ¿Qué es una Managed Identity y por qué usarla?**
> Es una identidad en Azure AD para un recurso Azure (VM, App Service). Permite autenticar a otros servicios Azure sin guardar contraseñas ni connection strings. La identidad se rota automáticamente. Principio de **zero credentials en código**.

**3. ¿Cuándo usarías Azure Service Bus vs Event Hub?**
> **Service Bus**: mensajería empresarial, garantía de entrega at-least-once, transacciones, dead-letter queue. Ideal para microservicios. **Event Hub**: streaming de eventos a enorme escala (millones/seg), telemetría, IoT. No tiene la semántica de mensajería empresarial de Service Bus.

**4. ¿Cómo escalaría horizontalmente una API en Azure?**
> App Service Plan con auto-scale rules basadas en CPU/métricas, o Azure Container Apps con scale-to-zero. Para estado, usar Redis para cache distribuido y Azure SQL con read replicas. Asegurar que la app sea stateless (sin estado en memoria del proceso).
