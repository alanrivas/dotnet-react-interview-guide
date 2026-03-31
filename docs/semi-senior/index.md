---
id: index
title: Nivel Semi-Senior
sidebar_position: 0
---

# 🟡 Nivel Semi-Senior

El nivel semi-senior asume que ya dominas los fundamentos y evalúa tu capacidad para construir soluciones robustas, mantenibles y escalables.

## Prerequisitos

Antes de abordar este nivel, deberías estar cómodo con **todo el nivel Junior**:

- ✅ C# y POO — tipos, colecciones, herencia, interfaces
- ✅ React — componentes, hooks básicos, estado y efectos
- ✅ SQL básico — CRUD, JOINs, GROUP BY, subconsultas
- ✅ Git — branching, merging, pull requests
- ✅ HTTP / REST — métodos, status codes, autenticación básica

> Si alguno de estos puntos te genera dudas, repasa el [nivel Junior](../junior/index.md) antes de continuar.

## ¿Qué se evalúa en entrevistas Semi-Senior?

- **Buenas prácticas y patrones**: SOLID, patrones de diseño aplicados
- **Profundidad técnica**: "¿cómo funciona internamente?", "¿cuándo usarías X en vez de Y?"
- **Decisiones de diseño**: arquitectura básica, organización del código
- **Experiencia práctica**: resolución de problemas reales (N+1, race conditions, memory leaks)
- **Testing**: cómo testeas tu código, qué cubres
- **Colaboración**: code reviews, trabajo en equipo

:::tip Lo que marca la diferencia
A este nivel, el entrevistador no busca solo que "funcione". Busca que expliques **por qué** tomaste cada decisión y que puedas identificar trade-offs.
:::

## Temas del nivel Semi-Senior

### ⚙️ C# y .NET

| Tema | Descripción | Prioridad |
|------|-------------|-----------|
| [C# Avanzado](semi-senior/dotnet/csharp-avanzado) | Generics, delegates, pattern matching, async avanzado | 🔥 Alta |
| [ASP.NET Core](semi-senior/dotnet/aspnet-core) | Pipeline, middleware, DI, JWT, validación | 🔥 Alta |
| [Entity Framework Core](semi-senior/dotnet/entity-framework) | Queries avanzados, migrations, performance | 🔥 Alta |
| [EF Core — Performance & N+1](semi-senior/dotnet/ef-core-performance) | Include, proyecciones, AsNoTracking, split queries | 🔥 Alta |
| [Inyección de Dependencias](semi-senior/dotnet/inyeccion-dependencias) | Scopes, lifetimes, keyed services, factory | 🔥 Alta |
| [Manejo de Errores](semi-senior/dotnet/manejo-errores) | ProblemDetails, middleware, Result pattern | 🔥 Alta |
| [Rate Limiting en .NET 8](semi-senior/dotnet/rate-limiting) | Fixed Window, Sliding Window, Token Bucket, Concurrency | 🟡 Media |
| [Minimal API vs Controllers](semi-senior/dotnet/minimal-api-vs-controllers) | Trade-offs, endpoint filters, grupos | 🟡 Media |
| [Background Services](semi-senior/dotnet/background-services) | IHostedService, Worker, Channels, Quartz | 🟡 Media |
| [Polly & Resiliencia](semi-senior/dotnet/polly-resiliencia) | Retry, circuit breaker, timeout, bulkhead | 🟡 Media |
| [SignalR & WebSockets](semi-senior/dotnet/signalr-websockets) | Real-time en .NET, hubs, grupos, reconexión | 🟡 Media |
| [Serilog & Structured Logging](semi-senior/dotnet/serilog-logging) | Enrichers, sinks, correlation ID, context | 🟡 Media |

### 🎨 Frontend

| Tema | Descripción | Prioridad |
|------|-------------|-----------|
| [JavaScript Avanzado](semi-senior/frontend/javascript-avanzado) | Closures, event loop, prototypes, módulos | 🔥 Alta |
| [TypeScript Avanzado](semi-senior/frontend/typescript-avanzado) | Generics, utility types, decorators, type guards | 🟡 Media |
| [React Avanzado](semi-senior/frontend/react-avanzado) | Hooks avanzados, Context, Custom Hooks, React Query | 🔥 Alta |
| [Estado Global](semi-senior/frontend/estado-global) | Redux Toolkit, Zustand, cuándo usar cada uno | 🟡 Media |
| [Next.js & React Server Components](semi-senior/frontend/nextjs-rsc) | App Router, RSC, Server Actions, caché, SSR/ISR/SSG | 🔥 Alta |
| [Performance Frontend](semi-senior/frontend/performance-frontend) | Bundle size, lazy loading, memoización, Web Vitals | 🟡 Media |
| [Accesibilidad Web (a11y)](semi-senior/frontend/accesibilidad) | ARIA, foco, live regions, testing con jest-axe | 🟡 Media |
| [Blazor](semi-senior/frontend/blazor) | Blazor Server/WASM/Hybrid, componentes, lifecycle, JS Interop | 🟡 Media |

### 🗄️ Datos y Persistencia

| Tema | Descripción | Prioridad |
|------|-------------|-----------|
| [SQL Avanzado](semi-senior/datos/sql-avanzado) | Window Functions, CTEs, índices, ejecución de queries | 🟡 Media |
| [Caching & Redis](semi-senior/datos/caching-redis) | Cache distribuida, invalidación, patrones de cache | 🟡 Media |
| [Caching — Estrategias](semi-senior/datos/caching-estrategias) | Cache-aside, write-through, read-through, TTL | 🟡 Media |
| [Transacciones en BD](semi-senior/datos/transacciones-base-datos) | ACID, IsolationLevel, savepoints, distributed tx | 🟡 Media |

### 🧪 Testing

| Tema | Descripción | Prioridad |
|------|-------------|-----------|
| [Testing (Backend)](semi-senior/testing/backend) | xUnit, Moq, Integration Testing, Testing Library | 🔥 Alta |
| [Testing Frontend — Vitest & MSW](semi-senior/testing/testing-frontend) | Configuración profesional, MSW, providers, React Query | 🔥 Alta |
| [Integration Testing](semi-senior/testing/integration-testing) | WebApplicationFactory, TestContainers, mocks | 🔥 Alta |

### 🔌 APIs y Comunicación

| Tema | Descripción | Prioridad |
|------|-------------|-----------|
| [APIs REST](semi-senior/apis/apis-rest) | Principios REST, versionado, paginación, documentación | 🔥 Alta |
| [Autenticación & OAuth](semi-senior/apis/autenticacion-oauth) | OAuth 2.0, OpenID Connect, JWT, Refresh Tokens | 🟡 Media |
| [Seguridad en APIs](semi-senior/apis/seguridad-api) | OWASP, CORS, CSRF, input validation | 🔥 Alta |
| [GraphQL con .NET y React](semi-senior/apis/graphql) | Hot Chocolate, DataLoader, Apollo Client, N+1 | 🟡 Media |
| [gRPC con .NET](semi-senior/apis/grpc) | Protobuf, 4 tipos de comunicación, interceptores, testing | 🟡 Media |
| [Message Queues](semi-senior/apis/message-queues) | RabbitMQ, Azure Service Bus, patrones async | 🟡 Media |

### 🐳 Infraestructura

| Tema | Descripción | Prioridad |
|------|-------------|-----------|
| [Docker](semi-senior/infraestructura/docker) | Contenedores, Dockerfile, docker-compose | 🟡 Media |
| [CI/CD con GitHub Actions](semi-senior/infraestructura/ci-cd-github-actions) | Workflows, matrix, secrets, deploy automático | 🟡 Media |

### Otros

| Tema | Descripción | Prioridad |
|------|-------------|-----------|
| [Patrones de Diseño](semi-senior/patrones-diseno) | SOLID, Repository, Strategy, Observer, MediatR | 🔥 Alta |
| [Performance & Profiling](semi-senior/performance-profiling) | BenchmarkDotNet, dotnet-trace, memory leaks | 🟡 Media |

## Horas de estudio recomendadas

| Tema | Horas estimadas | Prioridad |
|------|----------------|-----------|
| C# Avanzado | 8-10h | 🔥 Alta |
| ASP.NET Core | 8-10h | 🔥 Alta |
| Entity Framework Core | 6-8h | 🔥 Alta |
| APIs REST | 5-6h | 🔥 Alta |
| JavaScript Avanzado | 6-8h | 🔥 Alta |
| React Avanzado | 8-10h | 🔥 Alta |
| Testing | 6-8h | 🔥 Alta |
| Patrones de Diseño | 8-10h | 🔥 Alta |
| SQL Avanzado | 5-6h | 🟡 Media |
| Autenticación & OAuth | 4-5h | 🟡 Media |
| Docker | 4-5h | 🟡 Media |
| Caching & Redis | 4-5h | 🟡 Media |
| Estado Global | 3-4h | 🟡 Media |
| Performance Frontend | 3-4h | 🟡 Media |
| TypeScript Avanzado | 4-5h | 🟡 Media |
| Next.js & RSC | 6-8h | 🔥 Alta |
| Testing Frontend (Vitest & MSW) | 5-6h | 🔥 Alta |
| Rate Limiting en .NET 8 | 3-4h | 🟡 Media |
| GraphQL con .NET y React | 4-5h | 🟡 Media |
| Accesibilidad Web (a11y) | 3-4h | 🟡 Media |
| Blazor | 4-5h | 🟡 Media |
| SignalR & WebSockets | 3-4h | 🟡 Media |
| Transacciones en BD | 3-4h | 🟡 Media |
| Message Queues | 4-5h | 🟡 Media |
| Inyección de Dependencias | 4-5h | 🔥 Alta |
| Manejo de Errores | 3-4h | 🔥 Alta |
| Seguridad en APIs | 4-5h | 🔥 Alta |
| Caching — Estrategias | 3-4h | 🟡 Media |
| Performance & Profiling | 4-5h | 🟡 Media |
| EF Core — Performance & N+1 | 4-5h | 🔥 Alta |
| Integration Testing | 5-6h | 🔥 Alta |
| Minimal API vs Controllers | 2-3h | 🟡 Media |
| Polly & Resiliencia | 3-4h | 🟡 Media |
| CI/CD con GitHub Actions | 3-4h | 🟡 Media |
| Background Services | 3-4h | 🟡 Media |
| Serilog & Structured Logging | 2-3h | 🟡 Media |
| gRPC con .NET | 4-5h | 🟡 Media |
| **Total** | **~167-210h** | |

:::tip Plan sugerido
Dedica 2-3 horas diarias durante 5-6 semanas. Empieza con C# Avanzado, Patrones de Diseño y Testing — son los más preguntados en entrevistas Semi-Senior.
:::

## Práctica y simulacros

| Recurso | Descripción |
|---------|-------------|
| [Live Coding Semi-Senior](semi-senior/live-coding) | Ejercicios de código en tiempo real: patrones y APIs |
| [Preguntas frecuentes](semi-senior/preguntas) | Banco de preguntas reales de entrevistas Semi-Senior |
| [Simulacro de entrevista](semi-senior/simulacro) | Entrevista completa simulada con feedback |

## Lo que diferencia a un Junior de un Semi-Senior

```
Junior:             Semi-Senior:
"Funciona"    →    "Funciona Y es mantenible"
"No sé por qué"→   "Sé exactamente por qué"
"Copy-paste"  →    "Entiendo lo que copio"
"Sin tests"   →    "Tests en lógica crítica"
"1 solución"  →    "Veo múltiples enfoques y sus trade-offs"
```

## Lo que diferencia a un Semi-Senior de un Senior

| Semi-Senior | Senior |
|-------------|--------|
| Diseña módulos y servicios | Diseña sistemas completos |
| Aplica patrones conocidos | Elige cuándo NO aplicar un patrón |
| Conoce los trade-offs técnicos | Define los trade-offs con impacto en el negocio |
| Trabaja dentro de la arquitectura | Define y evoluciona la arquitectura |
| Resuelve problemas técnicos reactivamente | Anticipa problemas antes de que ocurran |
| Código correcto y bien testeado | Decisiones técnicas con visión a largo plazo |
| Mentoreado por seniors | Mentora a juniors y semi-seniors |
