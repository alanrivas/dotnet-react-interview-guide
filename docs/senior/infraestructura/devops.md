---
id: devops
title: DevOps & CI/CD
sidebar_position: 6
---

# DevOps & CI/CD 🔴

## GitHub Actions — Pipeline CI/CD para .NET + React

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # ─────────────────────── BACKEND ───────────────────────
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Restore dependencies
        run: dotnet restore

      - name: Build
        run: dotnet build --no-restore --configuration Release

      - name: Test
        run: dotnet test --no-build --configuration Release --collect:"XPlat Code Coverage"

      - name: Publish coverage
        uses: codecov/codecov-action@v3

  # ─────────────────────── FRONTEND ───────────────────────
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Lint
        run: npm run lint
        working-directory: frontend

      - name: Test
        run: npm run test:ci
        working-directory: frontend

      - name: Build
        run: npm run build
        working-directory: frontend

  # ─────────────────────── DEPLOY ───────────────────────
  deploy:
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: mi-app
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          package: .
```

---

## Docker y Kubernetes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mi-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mi-api
  template:
    metadata:
      labels:
        app: mi-api
    spec:
      containers:
      - name: mi-api
        image: miregistry/mi-api:latest
        ports:
        - containerPort: 8080
        env:
        - name: ConnectionStrings__Default
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: connection-string
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: mi-api-service
spec:
  selector:
    app: mi-api
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

---

## Infrastructure as Code

```hcl
# Terraform — Azure App Service
resource "azurerm_service_plan" "main" {
  name                = "mi-app-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "P1v3"
}

resource "azurerm_linux_web_app" "api" {
  name                = "mi-api-app"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_service_plan.main.location
  service_plan_id     = azurerm_service_plan.main.id

  site_config {
    application_stack {
      dotnet_version = "8.0"
    }
    health_check_path = "/health"
  }

  app_settings = {
    "ASPNETCORE_ENVIRONMENT" = "Production"
    "WEBSITES_PORT"          = "8080"
  }

  connection_string {
    name  = "Default"
    type  = "SQLServer"
    value = azurerm_mssql_server.main.connection_string
  }
}
```

---

## Observabilidad (3 Pilares)

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│    LOGS      │  │   MÉTRICAS   │  │   TRAZAS     │
│              │  │              │  │              │
│ Qué pasó     │  │ Cuánto/Cuán  │  │ Por dónde    │
│ (eventos)    │  │ frecuente    │  │ pasó el req  │
│              │  │              │  │              │
│ Serilog      │  │ Prometheus   │  │ OpenTelemetry│
│ ELK Stack    │  │ Grafana      │  │ Jaeger       │
└──────────────┘  └──────────────┘  └──────────────┘
```

```csharp
// Serilog configuración
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .Enrich.WithCorrelationId()
    .WriteTo.Console(outputTemplate:
        "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId} {Message:lj}{NewLine}{Exception}")
    .WriteTo.Seq("http://seq:5341")
    .CreateLogger();

// Log estructurado (siempre preferir sobre string interpolation)
_logger.LogInformation("Pedido {PedidoId} creado por usuario {UsuarioId}", 
    pedido.Id, usuarioId);
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué es un pipeline CI/CD y cuáles son sus etapas?**
> **CI** (Integración Continua): build, lint, tests automáticos al hacer push. **CD** (Entrega/Deployment Continuo): deployment automático a staging/producción cuando CI pasa. Etapas típicas: checkout → build → test → security scan → build imagen → deploy → smoke tests.

**2. ¿Cuál es la diferencia entre Blue/Green deployment y Canary deployment?**
> **Blue/Green**: dos entornos idénticos, se cambia el tráfico de golpe de uno al otro. Rollback instantáneo. **Canary**: se envía un % pequeño del tráfico a la nueva versión, se monitorea, y gradualmente se aumenta. Menos riesgo pero más complejo.

**3. ¿Cómo manejas los secretos en un pipeline CI/CD?**
> Usando el sistema de secrets del CI/CD (GitHub Secrets, GitLab CI Variables). **Nunca** en el código ni en archivos de configuración commiteados. En producción, usando servicios como Azure Key Vault, AWS Secrets Manager, o HashiCorp Vault.

**4. ¿Qué es un readiness probe vs liveness probe en Kubernetes?**
> **Liveness**: ¿está vivo el proceso? Si falla, K8s reinicia el pod. **Readiness**: ¿está listo para recibir tráfico? Si falla, K8s lo saca del load balancer temporalmente (sin reiniciarlo). Útil para warm-up de la app.
