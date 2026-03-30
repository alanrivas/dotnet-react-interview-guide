---
id: kubernetes
title: Kubernetes a fondo
sidebar_position: 14
---

# Kubernetes a fondo 🔴

Kubernetes (K8s) es el estándar de facto para orquestar contenedores en producción. En entrevistas Senior te van a preguntar no solo cómo escribir un Deployment, sino cómo tomar decisiones de diseño: cuándo usar StatefulSet, cómo escalar, cómo manejar configuración sensible, y cómo hacer zero-downtime deployments.

:::info Relación con DevOps
[DevOps & CI/CD](devops) cubre GitHub Actions y el pipeline. Este documento se centra específicamente en Kubernetes: arquitectura, workloads, networking, scaling y operaciones.
:::

---

## Arquitectura de un cluster

```
┌────────────────────────────────────────────────────────┐
│                     CLUSTER K8s                        │
│                                                        │
│  ┌─────────────────────┐   ┌──────────────────────┐   │
│  │    CONTROL PLANE     │   │       WORKER NODES    │   │
│  │                     │   │                      │   │
│  │  ┌───────────────┐  │   │  ┌────────────────┐  │   │
│  │  │ API Server    │  │   │  │   kubelet      │  │   │
│  │  │ (kube-api)    │◄─┼───┼──►  (agente)     │  │   │
│  │  └───────────────┘  │   │  └────────────────┘  │   │
│  │  ┌───────────────┐  │   │  ┌────────────────┐  │   │
│  │  │ etcd          │  │   │  │  kube-proxy    │  │   │
│  │  │ (estado)      │  │   │  │  (networking)  │  │   │
│  │  └───────────────┘  │   │  └────────────────┘  │   │
│  │  ┌───────────────┐  │   │  ┌────────────────┐  │   │
│  │  │ Scheduler     │  │   │  │    Pods        │  │   │
│  │  └───────────────┘  │   │  │  [c1][c2]      │  │   │
│  │  ┌───────────────┐  │   │  └────────────────┘  │   │
│  │  │ Controller    │  │   └──────────────────────┘   │
│  │  │ Manager       │  │                              │
│  │  └───────────────┘  │                              │
│  └─────────────────────┘                              │
└────────────────────────────────────────────────────────┘
```

| Componente | Rol |
|---|---|
| **API Server** | Punto de entrada de toda comunicación con el cluster (kubectl → API Server) |
| **etcd** | Base de datos distribuida clave-valor — guarda todo el estado del cluster |
| **Scheduler** | Decide en qué nodo correr cada Pod según recursos disponibles |
| **Controller Manager** | Loop de reconciliación — asegura que el estado deseado = estado real |
| **kubelet** | Agente en cada nodo — ejecuta y monitorea los Pods |
| **kube-proxy** | Maneja las reglas de red para comunicación entre Pods y Services |

---

## Pod — la unidad mínima

Un Pod es uno o más contenedores que comparten red y storage.

```yaml
# pod.yaml — rara vez creás Pods directamente (los maneja el Deployment)
apiVersion: v1
kind: Pod
metadata:
  name: mi-api-pod
  labels:
    app: mi-api
    version: "1.0"
spec:
  containers:
    - name: api
      image: miregistry/mi-api:1.0.0
      ports:
        - containerPort: 8080
      env:
        - name: ASPNETCORE_ENVIRONMENT
          value: "Production"
      resources:
        requests:         # Lo que K8s reserva en el nodo
          memory: "256Mi"
          cpu: "250m"     # 250 millicores = 0.25 CPU
        limits:           # Máximo que puede usar
          memory: "512Mi"
          cpu: "500m"

  # Sidecar pattern: contenedor auxiliar en el mismo Pod
  - name: log-collector
    image: fluent/fluent-bit:latest
    volumeMounts:
      - name: logs
        mountPath: /var/logs

  volumes:
    - name: logs
      emptyDir: {}
```

:::tip requests vs limits
- **requests**: lo que el Scheduler usa para decidir dónde colocar el Pod — el nodo debe tener al menos ese recurso disponible
- **limits**: el máximo que puede consumir — si lo supera, el contenedor es terminado (OOMKilled) o throttled (CPU)
- **Regla práctica**: `limits = 2x requests` para la mayoría de los casos
:::

---

## Workloads: cuándo usar cada uno

### Deployment — aplicaciones stateless

El workload más común. Maneja ReplicaSets, rolling updates y rollbacks.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mi-api
  namespace: produccion
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mi-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1         # Puede haber 1 Pod extra durante el update
      maxUnavailable: 0   # Nunca bajar de 3 Pods disponibles (zero-downtime)
  template:
    metadata:
      labels:
        app: mi-api
    spec:
      containers:
        - name: mi-api
          image: miregistry/mi-api:1.2.0
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: mi-api-config        # Variables no sensibles
            - secretRef:
                name: mi-api-secrets       # Variables sensibles
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
          startupProbe:               # Para apps lentas en arrancar
            httpGet:
              path: /health/live
              port: 8080
            failureThreshold: 30      # 30 * 10s = 5 minutos para arrancar
            periodSeconds: 10
```

### StatefulSet — aplicaciones stateful

Para bases de datos, caches con estado, o cualquier app que necesite identidad estable y storage persistente.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: "postgres"   # Headless Service requerido
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16
          ports:
            - containerPort: 5432
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  # Crea PVC automáticamente para cada réplica
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

**Diferencias clave vs Deployment:**
- Pods tienen identidad estable: `postgres-0`, `postgres-1`, `postgres-2`
- Se crean/eliminan en orden (0, 1, 2...)
- Cada Pod tiene su propio PersistentVolume
- DNS estable: `postgres-0.postgres.namespace.svc.cluster.local`

### DaemonSet — un Pod por nodo

```yaml
# Útil para: log collectors, monitoring agents, network plugins
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      containers:
        - name: node-exporter
          image: prom/node-exporter:latest
          ports:
            - containerPort: 9100
      tolerations:          # Permitir en nodos con taints
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
```

### Job y CronJob — tareas puntuales

```yaml
# Job: se ejecuta una vez
apiVersion: batch/v1
kind: Job
metadata:
  name: migracion-db
spec:
  completions: 1
  backoffLimit: 3          # Reintentos en caso de fallo
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migration
          image: miregistry/mi-api:1.2.0
          command: ["dotnet", "ef", "database", "update"]
          envFrom:
            - secretRef:
                name: mi-api-secrets

---
# CronJob: se ejecuta en schedule
apiVersion: batch/v1
kind: CronJob
metadata:
  name: limpieza-logs
spec:
  schedule: "0 2 * * *"   # Todos los días a las 2am (cron syntax)
  concurrencyPolicy: Forbid # No ejecutar si el anterior sigue corriendo
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: limpieza
              image: miregistry/tools:latest
              command: ["sh", "-c", "dotnet run --project CleanupJob"]
```

---

## Networking

### Service — exponer Pods

```yaml
# ClusterIP — solo accesible dentro del cluster (default)
apiVersion: v1
kind: Service
metadata:
  name: mi-api-service
spec:
  type: ClusterIP
  selector:
    app: mi-api
  ports:
    - port: 80          # Puerto del Service
      targetPort: 8080  # Puerto del contenedor

---
# NodePort — expone en un puerto de cada nodo (30000-32767)
# Útil para desarrollo, no recomendado en producción
apiVersion: v1
kind: Service
metadata:
  name: mi-api-nodeport
spec:
  type: NodePort
  selector:
    app: mi-api
  ports:
    - port: 80
      targetPort: 8080
      nodePort: 30080   # Accesible en <node-ip>:30080

---
# LoadBalancer — provisiona un LB en el cloud provider (AWS, Azure, GCP)
apiVersion: v1
kind: Service
metadata:
  name: mi-api-lb
spec:
  type: LoadBalancer
  selector:
    app: mi-api
  ports:
    - port: 80
      targetPort: 8080
```

### Ingress — routing HTTP/HTTPS

```yaml
# Requiere un Ingress Controller instalado (nginx, traefik, etc.)
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mi-app-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: "letsencrypt-prod"  # TLS automático
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.miapp.com
      secretName: api-tls-cert   # cert-manager lo crea automáticamente
  rules:
    - host: api.miapp.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: mi-api-service
                port:
                  number: 80
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
```

---

## ConfigMap y Secret — configuración

```yaml
# ConfigMap — valores no sensibles
apiVersion: v1
kind: ConfigMap
metadata:
  name: mi-api-config
data:
  ASPNETCORE_ENVIRONMENT: "Production"
  ASPNETCORE_URLS: "http://+:8080"
  Logging__LogLevel__Default: "Information"
  App__MaxPageSize: "100"

---
# Secret — valores sensibles (Base64 encoded, no encriptado por defecto)
apiVersion: v1
kind: Secret
metadata:
  name: mi-api-secrets
type: Opaque
data:
  # echo -n "Server=..." | base64
  ConnectionStrings__Default: U2VydmVyPW15c3FsO0RhdGFiYXNlPW15ZGI=
  JwtSettings__SecretKey: bXlzdXBlcnNlY3JldGtleTE=
```

:::warning Secrets en K8s
Los Secrets de K8s **no están encriptados** por defecto — solo están en Base64. Para producción real:
- Habilitar **encryption at rest** en etcd
- Usar **External Secrets Operator** con Azure Key Vault, AWS Secrets Manager o HashiCorp Vault
- O usar **Sealed Secrets** (Bitnami) para guardarlos en git de forma segura
:::

```yaml
# External Secrets Operator — mejor práctica
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: mi-api-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: azure-keyvault
    kind: ClusterSecretStore
  target:
    name: mi-api-secrets   # Nombre del Secret de K8s que se crea
  data:
    - secretKey: ConnectionStrings__Default
      remoteRef:
        key: mi-api-db-connection
```

---

## Persistent Volumes

```yaml
# PersistentVolumeClaim — solicitar storage
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mi-data-pvc
spec:
  accessModes:
    - ReadWriteOnce      # Solo un nodo puede escribir (ReadWriteMany para múltiples)
  storageClassName: managed-premium  # En Azure; "gp3" en AWS
  resources:
    requests:
      storage: 20Gi

---
# Usar en un Pod
spec:
  containers:
    - name: mi-api
      volumeMounts:
        - name: datos
          mountPath: /app/data
  volumes:
    - name: datos
      persistentVolumeClaim:
        claimName: mi-data-pvc
```

---

## Escalado horizontal — HPA

```yaml
# Horizontal Pod Autoscaler — escala Pods según CPU/memoria o métricas custom
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mi-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mi-api
  minReplicas: 2
  maxReplicas: 20
  metrics:
    # Escalar si CPU supera 70%
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    # Escalar si memoria supera 80%
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60   # Esperar 60s antes de escalar más
      policies:
        - type: Percent
          value: 100          # Doblar réplicas máximo por ciclo
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300  # Esperar 5min antes de desescalar
      policies:
        - type: Pods
          value: 1            # Bajar de a 1 Pod por vez
          periodSeconds: 60
```

:::tip HPA requiere metrics-server
El HPA necesita `metrics-server` instalado en el cluster para leer CPU/memoria. En AKS, EKS y GKE ya viene preinstalado. En clusters locales (minikube, k3s) hay que instalarlo.
:::

---

## Namespaces — aislamiento lógico

```bash
# Namespaces comunes en una empresa
kubectl create namespace produccion
kubectl create namespace staging
kubectl create namespace monitoring
kubectl create namespace tools

# Aplicar recursos en un namespace
kubectl apply -f deployment.yaml -n produccion

# Ver recursos de un namespace
kubectl get pods -n produccion
kubectl get all -n produccion
```

```yaml
# ResourceQuota — limitar recursos por namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: produccion-quota
  namespace: produccion
spec:
  hard:
    pods: "50"
    requests.cpu: "20"
    requests.memory: "40Gi"
    limits.cpu: "40"
    limits.memory: "80Gi"
    persistentvolumeclaims: "20"
```

---

## Health Probes — los tres tipos

```yaml
containers:
  - name: mi-api
    # 1. startupProbe — ¿ya arrancó la app?
    # Solo corre hasta que pasa. Si falla N veces, mata el contenedor.
    # Útil para apps lentas en arrancar (EF migrations, warmup caches)
    startupProbe:
      httpGet:
        path: /health/startup
        port: 8080
      failureThreshold: 30     # 30 * 10s = 5 minutos máximo para arrancar
      periodSeconds: 10

    # 2. readinessProbe — ¿está listo para recibir tráfico?
    # Si falla: K8s lo saca del Service (sin eliminarlo)
    # Si pasa: K8s lo agrega al Service
    readinessProbe:
      httpGet:
        path: /health/ready
        port: 8080
      initialDelaySeconds: 5
      periodSeconds: 5
      successThreshold: 1
      failureThreshold: 3

    # 3. livenessProbe — ¿sigue vivo?
    # Si falla N veces consecutivas: K8s reinicia el contenedor
    # Detecta deadlocks, memory leaks que cuelgan el proceso
    livenessProbe:
      httpGet:
        path: /health/live
        port: 8080
      initialDelaySeconds: 30  # Dar tiempo después del startup
      periodSeconds: 10
      failureThreshold: 3
```

```csharp
// .NET 8 — Health Checks
builder.Services.AddHealthChecks()
    .AddSqlServer(
        connectionString: builder.Configuration.GetConnectionString("Default")!,
        name: "database",
        tags: ["ready"])
    .AddRedis(
        redisConnectionString: builder.Configuration.GetConnectionString("Redis")!,
        name: "redis",
        tags: ["ready"])
    .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"]);

// Endpoints separados para cada probe
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("live"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
});
```

---

## Rolling Update y Rollback

```bash
# Ver el historial de rollouts
kubectl rollout history deployment/mi-api -n produccion

# REVISION  CHANGE-CAUSE
# 1         <none>
# 2         imagen actualizada a 1.2.0
# 3         imagen actualizada a 1.3.0

# Rollback al revision anterior
kubectl rollout undo deployment/mi-api -n produccion

# Rollback a una revision específica
kubectl rollout undo deployment/mi-api --to-revision=2 -n produccion

# Ver status del rollout en curso
kubectl rollout status deployment/mi-api -n produccion

# Pausar un rollout (para hacer canary manual)
kubectl rollout pause deployment/mi-api -n produccion

# Reanudar
kubectl rollout resume deployment/mi-api -n produccion
```

```yaml
# Anotar el motivo del cambio (aparece en rollout history)
kubectl annotate deployment/mi-api kubernetes.io/change-cause="imagen actualizada a 1.3.0" -n produccion
```

---

## kubectl — comandos esenciales

```bash
# ─────────── Inspección ───────────
kubectl get pods -n produccion                          # listar pods
kubectl get pods -n produccion -o wide                  # + nodo y IP
kubectl get pods -n produccion --watch                  # en tiempo real
kubectl describe pod mi-api-abc123 -n produccion        # detalles completos
kubectl get events -n produccion --sort-by=.lastTimestamp

# ─────────── Logs ───────────
kubectl logs mi-api-abc123 -n produccion                # logs del pod
kubectl logs mi-api-abc123 -n produccion --previous     # logs del container anterior (si crasheó)
kubectl logs -l app=mi-api -n produccion                # logs de todos los pods con el label
kubectl logs mi-api-abc123 -n produccion -f             # follow (stream)
kubectl logs mi-api-abc123 -n produccion --tail=100     # últimas 100 líneas

# ─────────── Debugging ───────────
kubectl exec -it mi-api-abc123 -n produccion -- /bin/bash   # shell interactivo
kubectl exec mi-api-abc123 -n produccion -- env             # ver variables de entorno
kubectl port-forward pod/mi-api-abc123 8080:8080 -n produccion  # tunneling local

# ─────────── Aplicar cambios ───────────
kubectl apply -f deployment.yaml -n produccion
kubectl delete -f deployment.yaml -n produccion
kubectl set image deployment/mi-api mi-api=miregistry/mi-api:1.3.0 -n produccion

# ─────────── Escala manual ───────────
kubectl scale deployment/mi-api --replicas=5 -n produccion

# ─────────── Ver configuración ───────────
kubectl get configmap mi-api-config -n produccion -o yaml
kubectl get secret mi-api-secrets -n produccion -o jsonpath='{.data.ConnectionStrings__Default}' | base64 -d
```

---

## Ejemplo completo: API .NET en K8s

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mi-app

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mi-api-config
  namespace: mi-app
data:
  ASPNETCORE_ENVIRONMENT: Production
  ASPNETCORE_URLS: http://+:8080
  App__BaseUrl: https://api.miapp.com

---
# k8s/secret.yaml (en la práctica, usar External Secrets)
apiVersion: v1
kind: Secret
metadata:
  name: mi-api-secrets
  namespace: mi-app
type: Opaque
stringData:  # stringData acepta texto plano, K8s lo convierte a base64
  ConnectionStrings__Default: "Server=postgres;Database=midb;User=sa;Password=xxx"
  JwtSettings__SecretKey: "mi-super-secret-key-32-chars-long"

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mi-api
  namespace: mi-app
  annotations:
    kubernetes.io/change-cause: "deploy inicial"
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mi-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: mi-api
    spec:
      containers:
        - name: mi-api
          image: miregistry/mi-api:1.0.0
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: mi-api-config
            - secretRef:
                name: mi-api-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          startupProbe:
            httpGet: { path: /health/live, port: 8080 }
            failureThreshold: 30
            periodSeconds: 10
          readinessProbe:
            httpGet: { path: /health/ready, port: 8080 }
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            httpGet: { path: /health/live, port: 8080 }
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3

---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: mi-api-svc
  namespace: mi-app
spec:
  selector:
    app: mi-api
  ports:
    - port: 80
      targetPort: 8080

---
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mi-api-hpa
  namespace: mi-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mi-api
  minReplicas: 3
  maxReplicas: 15
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mi-app-ingress
  namespace: mi-app
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts: [api.miapp.com]
      secretName: mi-app-tls
  rules:
    - host: api.miapp.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: mi-api-svc
                port:
                  number: 80
```

---

## Job de migraciones antes del deploy

Patrón común: correr `dotnet ef database update` como Job de K8s antes de actualizar el Deployment.

```yaml
# k8s/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migracion-v1-2-0
  namespace: mi-app
spec:
  backoffLimit: 3
  template:
    spec:
      restartPolicy: OnFailure
      initContainers: []
      containers:
        - name: migration
          image: miregistry/mi-api:1.2.0  # misma imagen que el deployment
          command: ["dotnet", "MiApp.dll", "--migrate-only"]
          envFrom:
            - secretRef:
                name: mi-api-secrets
```

```bash
# En el pipeline CI/CD:
# 1. Aplicar el Job de migración
kubectl apply -f k8s/migration-job.yaml -n mi-app

# 2. Esperar a que termine
kubectl wait --for=condition=complete job/migracion-v1-2-0 -n mi-app --timeout=300s

# 3. Si falló, salir con error
kubectl get job migracion-v1-2-0 -n mi-app -o jsonpath='{.status.failed}'

# 4. Recién ahora actualizar el Deployment
kubectl apply -f k8s/deployment.yaml -n mi-app
```

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Qué diferencia hay entre Deployment y StatefulSet?**
> Deployment es para apps **stateless** — los Pods son intercambiables, no tienen identidad. StatefulSet es para apps **stateful** — cada Pod tiene nombre estable (`pod-0`, `pod-1`), DNS propio y PersistentVolume propio. Los Pods se crean y eliminan en orden. Usás StatefulSet para bases de datos, Kafka, Redis con persistencia.

**2. ¿Cuál es la diferencia entre liveness, readiness y startup probe?**
> - **startup**: ¿ya terminó de arrancar? K8s espera antes de activar los otros probes — para apps lentas (migrations, warmup)
> - **readiness**: ¿puede recibir tráfico? Si falla, lo saca del Service load balancer pero no lo reinicia — para cuando la app está temporalmente saturada
> - **liveness**: ¿sigue vivo? Si falla N veces seguidas, reinicia el contenedor — para detectar deadlocks o estados corruptos

**3. ¿Cómo harías un zero-downtime deployment?**
> Con `RollingUpdate` en el Deployment: `maxUnavailable: 0` (nunca bajar de las réplicas actuales) y `maxSurge: 1` (puede haber un Pod extra). Combinado con `readinessProbe` — K8s no manda tráfico al nuevo Pod hasta que el readiness pase. El viejo Pod se termina después de que el nuevo esté ready.

**4. ¿Cómo guardás credenciales de forma segura en K8s?**
> Los Secrets nativos de K8s son solo Base64, no encriptados. Las opciones seguras son: (1) **encryption at rest** en etcd con KMS, (2) **External Secrets Operator** integrando Azure Key Vault / AWS SM, (3) **Sealed Secrets** para guardar en git. En producción, External Secrets Operator es el estándar actual.

**5. ¿Qué pasa si no definís `requests` y `limits` en los contenedores?**
> Sin `requests`, el Scheduler no puede tomar buenas decisiones de placement — puede sobrecargar un nodo. Sin `limits`, un contenedor con memory leak puede consumir toda la memoria del nodo y matar otros Pods (OOMKilled a nivel de nodo). Es una mala práctica que puede causar cascadas de fallos. En clusters con LimitRange configurado, K8s asigna defaults automáticamente.

**6. ¿Cómo escalaría una app con K8s cuando el CPU no es el indicador correcto?**
> El HPA también soporta **métricas custom** — por ejemplo, longitud de una cola de mensajes (RabbitMQ, Azure Service Bus). Con KEDA (Kubernetes Event Driven Autoscaling), podés escalar a 0 cuando no hay mensajes y hasta N réplicas cuando la cola crece, sin depender de CPU/memoria. Esto es especialmente útil para workers de procesamiento de colas.

**7. ¿Qué es un Ingress y por qué es mejor que exponer un LoadBalancer por Service?**
> Un LoadBalancer por Service crea un IP externo con costo en el cloud — si tenés 10 Services, 10 IPs. Un Ingress Controller es un único LoadBalancer que enruta tráfico HTTP/HTTPS internamente según el host y path, manejando también TLS termination. Más barato, más manejable, y puede hacer cosas como rate limiting, auth, rewrite de URLs.
