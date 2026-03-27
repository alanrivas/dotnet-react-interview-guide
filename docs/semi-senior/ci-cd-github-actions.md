---
id: ci-cd-github-actions
title: CI/CD con GitHub Actions
sidebar_position: 20
---

# CI/CD con GitHub Actions 🟡

## ¿Qué es CI/CD?

**CI (Continuous Integration):** Integrar código constantemente en la rama principal, validando con tests automatizados.

**CD (Continuous Deployment):** Desplegar automáticamente a producción cada cambio validado (o Continuous Delivery: prepara para deployment manual).

```
Push → CI Pipeline (build + test + lint) → Validación → CD (deploy)
```

---

## Conceptos de GitHub Actions

- **Workflow:** Archivo YAML que define automatización (`.github/workflows/`)
- **Event:** Qué dispara el workflow (push, pull request, schedule, manual)
- **Job:** Conjunto de pasos que corren en un runner
- **Runner:** Máquina virtual donde corre el job (Ubuntu, Windows, macOS, o self-hosted)
- **Step:** Comando o action individual
- **Action:** Componente reutilizable (ej: checkout, setup-dotnet)

---

## Estructura básica

```yaml
name: Build and Test
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '8.0.x'
      
      - name: Restore dependencies
        run: dotnet restore
      
      - name: Build
        run: dotnet build --no-restore
      
      - name: Test
        run: dotnet test --no-build --verbosity normal
```

---

## Workflow completo para .NET API

```yaml
name: .NET API CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        dotnet-version: ['7.0.x', '8.0.x']  # Test en múltiples versiones
    
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # ← Necesario para análisis de cobertura
      
      - name: Setup .NET ${{ matrix.dotnet-version }}
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: ${{ matrix.dotnet-version }}
      
      - name: Cache NuGet packages
        uses: actions/cache@v3
        with:
          path: ~/.nuget/packages
          key: ${{ runner.os }}-nuget-${{ hashFiles('**/packages.lock.json') }}
          restore-keys: |
            ${{ runner.os }}-nuget-
      
      - name: Restore
        run: dotnet restore
      
      - name: Build
        run: dotnet build --configuration Release --no-restore
      
      - name: Run unit tests
        run: dotnet test ./MiApp.Tests --configuration Release --no-build --verbosity normal --collect:"XPlat Code Coverage"
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./MiApp.Tests/coverage.cobertura.xml
          fail_ci_if_error: false
      
      - name: SonarQube analysis
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # ─── Linting y análisis de código ───────────────────
  code-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '8.0.x'
      
      - name: Restore
        run: dotnet restore
      
      - name: Lint with StyleCop
        run: dotnet build /p:EnforceCodeStyleInBuild=true
      
      - name: Check for code issues with Roslyn
        run: dotnet analyzers

  # ─── Construir imagen Docker ───────────────────────
  build-docker:
    needs: [build-and-test, code-quality]  # Solo si pasó los tests
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-
            type=ref,event=branch
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─── Deploy a producción ──────────────────────────
  deploy:
    needs: build-docker
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Azure App Service
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ secrets.AZURE_APP_NAME }}
          publish-profile: ${{ secrets.AZURE_PUBLISH_PROFILE }}
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
      
      - name: Run smoke tests
        run: |
          echo "Waiting for deployment..."
          sleep 30
          curl -f https://${{ secrets.AZURE_APP_NAME }}.azurewebsites.net/health || exit 1
      
      - name: Notify Slack on deployment
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🚀 Deploy exitoso",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*API desplegada a producción* 🎉\n*Commit:* ${{ github.sha }}\n*Autor:* ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
          SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK
```

---

## Workflow para React/TypeScript + tests

```yaml
name: React CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Build
        run: npm run build
      
      - name: Run tests
        run: npm run test -- --coverage --watchAll=false
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/coverage-final.json
      
      - name: Archive build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: build/

  # ─── Deploy a GitHub Pages ────────────────────────
  deploy-pages:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      pages: write
      id-token: write
    
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-artifacts
      
      - name: Setup Pages
        uses: actions/configure-pages@v3
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: '.'
      
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2

  # ─── Deploy a Vercel ──────────────────────────────
  deploy-vercel:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Manejo de secretos y variables

```yaml
# ✅ Correcto: Usar secrets para datos sensibles
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}  # ← En Settings → Secrets
  AWS_ACCESS_KEY: ${{ secrets.AWS_ACCESS_KEY }}

# ❌ Incorrecto: Hardcodear credenciales
env:
  DATABASE_URL: "Server=mydb.azure.com;Password=admin123"
  AWS_ACCESS_KEY: "AKIA2EXAMPLE1234"

# Definir variables reutilizables
env:
  ARTIFACT_RETENTION_DAYS: 30
  DOTNET_VERSION: '8.0.x'

# También en Settings → Variables se puede usar ${{ vars.VARIABLE_NAME }}
```

**Tipos de secretos:**
- **Repository secrets:** Solo ese repo
- **Organization secrets:** Todos los repos de la organización
- **Environment secrets:** Solo para deployments a ese environment (prod, staging, etc.)

---

## Conditional workflows y matrix builds

```yaml
# ─── Ejecutar job solo si algo cambió ───────────────
jobs:
  test-api:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.modified, 'src/Api/')
    steps:
      - uses: actions/checkout@v4
      - run: echo "Solo corro si cambió algo en src/Api/"

  # ─── Multi-versión testing ───────────────────────
  test-multiple-versions:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
        os: [ubuntu-latest, windows-latest]
        include:
          # ← Configuraciones especiales
          - node-version: 20
            experimental: true
        exclude:
          # ← Excluir combinaciones innecesarias
          - os: windows-latest
            node-version: 18
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Test
        run: npm test
        continue-on-error: ${{ matrix.experimental }}
```

---

## Anti-patrones en CI/CD

```yaml
# ❌ ANTI-PATRÓN: Correr tests pero ignorar fallos
- name: Tests
  run: npm test
  continue-on-error: true  # ← Ahora pasa aunque fallen los tests!

# ✅ CORRECTO: Fallar si los tests fallan
- name: Tests
  run: npm test
  # continue-on-error: false (default)

# ❌ ANTI-PATRÓN: Descargar toda la historia de commits
- uses: actions/checkout@v4
  # fetch-depth: 0 es muy lento para repos grandes

# ✅ CORRECTO: Shallow clone
- uses: actions/checkout@v4
  with:
    fetch-depth: 1  # Solo el commit actual

# ❌ ANTI-PATRÓN: Sin cache de dependencias
- run: npm install  # ← 2-5 minutos cada vez

# ✅ CORRECTO: Con cache
- uses: actions/setup-node@v3
  with:
    node-version: '20'
    cache: 'npm'  # ← Automático
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué diferencia hay entre Continuous Integration, Continuous Delivery y Continuous Deployment?**
> **CI**: Integrar y testear código constantemente en main. **CD Delivery**: Prepara automáticamente para deploy (builds, tests) pero deploy es manual a prod. **CD Deployment**: Todo automático hasta producción. Jenkins/GitHub Actions/GitLab hacen CI. El nombre "CD" depende de si alguien aprueba antes de ir a prod.

**2. ¿Por qué cachear dependencias en CI?**
> Instalar npm packages o restaurar NuGet packages toma 2-5 minutos cada build. Caché las dependencias según el lock file, reduce tiempo a 10-30 segundos. GitHub Actions tiene cache built-in: `actions/setup-node@v3` con `cache: 'npm'` automáticamente cachea node_modules.

**3. ¿Cómo evitas que un build rompa producción?**
> 1. Tener tests unitarios + integración que deben pasar. 2. Code review obligatorio antes de merge. 3. Desplegar a staging primero, hacer smoke tests. 4. Canary deployments (10% de tráfico a nueva versión). 5. Blue-green deploys (dos ambientes productivos, cambiar router si falla).

**4. ¿Cuándo deberías hacer deploy automático vs manual?**
> - **Automático**: Cambios pequeños, tests robustos, rollback rápido. Típicamente feature branches → staging → manual a prod.
> - **Manual**: Cambios críticos de BD, datos sensibles. Generar artifacts automático pero alguien aprueba el deploy.
> Mejor: CD hasta staging, CD manualmente a prod.

**5. ¿Qué es un "smoke test" en CI/CD?**
> Tests mínimos que verifican que lo básico funciona post-deploy (ej: GET /health retorna 200, puedo loguearme). Corren rápido (segundos) después de deploy. Si falla, rollback automático. Si pasa, considerat validado.

**6. ¿Cómo manejas secretos en GitHub Actions sin exponerlos?**
> Usar GitHub Secrets en Settings. En el workflow: `${{ secrets.MY_SECRET }}`. GitHub los maskarita en los logs (output nunca muestra el valor). Nunca commitear `.env` o archivos con credenciales. Considerar usar OpenID Connect en lugar de Personal Access Tokens para auth a proveedores cloud.

**7. ¿Qué es una matrix build strategy?**
> Correr el mismo workflow en múltiples configuraciones (ej: Node 18, 20, 22; Linux, Windows). Define una matriz de variables, GitHub Actions genera un job por combinación. Ventaja: Asegurarse que el código corre en múltiples plataformas. Desventaja: X veces más tiempo.

**8. ¿Cómo optimizas los tiempos de build?**
> 1. Cache (dependencies, Docker layers). 2. Parallel jobs: tests y lint juntos, no secuencial. 3. Shallow clone (fetch-depth: 1). 4. Skipear jobs innecesarios (ej: solo actualizar docs si cambió _docs/ folder). 5. Self-hosted runners si repos son grandes. 6. Matrix builds solo para versiones que importan.