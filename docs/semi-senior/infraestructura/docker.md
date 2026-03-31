---
id: docker
title: Docker
sidebar_position: 12
---

# Docker 🟡

## ¿Qué es Docker y por qué importa?

Docker permite **empaquetar una aplicación con todas sus dependencias** en un contenedor que corre de forma idéntica en cualquier entorno.

```
Sin Docker:          Con Docker:
"En mi máquina       "Si corre en mi contenedor,
 funciona..."         corre en todos lados"
```

### Conceptos clave

```
Image    → plantilla inmutable (como una clase)
Container → instancia en ejecución de una imagen (como un objeto)
Registry → repositorio de imágenes (Docker Hub, ACR, ECR)
Volume   → almacenamiento persistente fuera del container
Network  → comunicación entre containers
```

---

## Dockerfile

```dockerfile
# ─── Producción: Multi-stage build ───────────────────────────

# Etapa 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copiar solo los .csproj primero (caching de layers)
COPY ["MiApp.API/MiApp.API.csproj", "MiApp.API/"]
COPY ["MiApp.Application/MiApp.Application.csproj", "MiApp.Application/"]
COPY ["MiApp.Domain/MiApp.Domain.csproj", "MiApp.Domain/"]
COPY ["MiApp.Infrastructure/MiApp.Infrastructure.csproj", "MiApp.Infrastructure/"]
RUN dotnet restore "MiApp.API/MiApp.API.csproj"

# Copiar el resto del código
COPY . .
WORKDIR "/src/MiApp.API"
RUN dotnet publish -c Release -o /app/publish --no-restore

# Etapa 2: Runtime (imagen mucho más pequeña)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

# Usuario no-root (seguridad)
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /app
USER appuser

COPY --from=build /app/publish .

# Variables de entorno por defecto
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 8080
ENTRYPOINT ["dotnet", "MiApp.API.dll"]
```

```dockerfile
# ─── Frontend React ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Copiar package files primero (caching)
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Servir con Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

## Comandos Docker esenciales

```bash
# Imágenes
docker pull nginx:alpine          # descargar imagen
docker images                     # listar imágenes locales
docker rmi nginx:alpine           # eliminar imagen
docker build -t mi-app:1.0 .     # construir imagen
docker build -t mi-app:latest --no-cache .  # sin caché

# Contenedores
docker run -d -p 8080:80 nginx           # en background, mapear puertos
docker run -it ubuntu bash               # interactivo con terminal
docker run --rm mi-app:1.0               # eliminar al terminar
docker run -e "DB_HOST=localhost" mi-app # variable de entorno

docker ps                    # containers en ejecución
docker ps -a                 # todos (incluidos detenidos)
docker stop <id>             # detener gracefully
docker rm <id>               # eliminar container
docker logs -f <id>          # logs en tiempo real
docker exec -it <id> bash    # entrar al container

# Inspección
docker inspect <id>          # detalles en JSON
docker stats                 # uso de recursos en tiempo real
```

---

## docker-compose — Orquestar múltiples servicios

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ─── API Backend ─────────────────────────────
  api:
    build:
      context: .
      dockerfile: MiApp.API/Dockerfile
    ports:
      - "5000:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ConnectionStrings__Default=Server=sqlserver;Database=MiAppDb;User=sa;Password=Pass@word1!
      - Jwt__SecretKey=${JWT_SECRET}         # desde .env file
    depends_on:
      sqlserver:
        condition: service_healthy           # esperar a que esté listo
      redis:
        condition: service_started
    volumes:
      - ./logs:/app/logs                     # montar directorio de logs
    networks:
      - backend
    restart: unless-stopped

  # ─── Frontend ────────────────────────────────
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - api
    networks:
      - backend

  # ─── SQL Server ──────────────────────────────
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=Pass@word1!
      - MSSQL_PID=Developer
    ports:
      - "1433:1433"
    volumes:
      - sqlserver_data:/var/opt/mssql        # datos persistentes
    healthcheck:
      test: /opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P Pass@word1! -Q "SELECT 1" || exit 1
      interval: 10s
      timeout: 5s
      retries: 10
    networks:
      - backend

  # ─── Redis ───────────────────────────────────
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - backend

volumes:
  sqlserver_data:
  redis_data:

networks:
  backend:
    driver: bridge
```

```bash
# Comandos docker-compose
docker compose up -d              # levantar en background
docker compose up --build         # reconstruir imágenes
docker compose down               # detener y eliminar containers
docker compose down -v            # también eliminar volumes
docker compose logs -f api        # logs de un servicio
docker compose ps                 # estado de los servicios
docker compose exec api bash      # entrar a un servicio
docker compose restart api        # reiniciar un servicio
```

---

## .dockerignore

```
# .dockerignore — equivalente a .gitignore para Docker
**/bin/
**/obj/
**/node_modules/
**/.git/
**/.env
**/Dockerfile*
**/*.md
**/tests/
```

---

## Docker en desarrollo vs producción

```
Desarrollo:
- docker-compose con hot-reload
- Montar el código como volumen para evitar rebuild
- Variables de entorno en .env file (NO commitear)

Producción:
- Multi-stage build (imagen más pequeña y segura)
- Usuario no-root
- Health checks
- Sin herramientas de build en la imagen final
- Variables de entorno desde secrets manager o CI/CD
- Imagen inmutable: misma imagen, distintas configs
```

---

## Preguntas frecuentes 🎯

**1. ¿Cuál es la diferencia entre una imagen y un contenedor?**
> Una **imagen** es una plantilla inmutable (como una clase). Un **contenedor** es una instancia en ejecución de esa imagen (como un objeto). De una imagen puedes crear muchos contenedores.

**2. ¿Qué es un multi-stage build y para qué sirve?**
> Usar múltiples `FROM` en un Dockerfile. En la primera etapa compilas el código (con el SDK completo). En la segunda etapa copias solo el resultado compilado a una imagen de runtime (mucho más pequeña y sin herramientas de build). Reduce el tamaño de la imagen final drásticamente.

**3. ¿Por qué copias el `.csproj` antes que el código fuente?**
> Por el sistema de caché de layers de Docker. Si el `.csproj` no cambió, Docker reutiliza el layer del `dotnet restore` (que descarga paquetes NuGet). Así el build es mucho más rápido. Si copias todo junto, cualquier cambio en el código invalida el restore.
