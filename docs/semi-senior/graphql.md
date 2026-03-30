---
id: graphql
title: GraphQL con .NET y React
sidebar_position: 19
---

# GraphQL con .NET y React 🟡

GraphQL es un lenguaje de consulta para APIs que permite al cliente pedir exactamente los datos que necesita. Es una alternativa a REST que resuelve problemas concretos de over-fetching y under-fetching. Se pregunta cada vez más en entrevistas de roles full-stack.

---

## REST vs GraphQL — cuándo usar cada uno

```
REST: El servidor decide qué devolver
GET /api/usuarios/1
→ { id, nombre, email, telefono, direccion, fechaNacimiento, ... }
  (aunque solo necesites nombre y email)

GraphQL: El cliente decide qué necesita
POST /graphql
query { usuario(id: 1) { nombre email } }
→ { usuario: { nombre: "Ana", email: "ana@..." } }
  (solo lo que pediste)
```

| | REST | GraphQL |
|---|---|---|
| Over-fetching | Frecuente | Eliminado |
| Under-fetching (N+1 calls) | Frecuente | Resuelto con un query |
| Versionado | /v1/, /v2/ | Deprecación de campos |
| Tipado | OpenAPI/Swagger | Schema fuertemente tipado |
| Caching | Nativo (HTTP cache) | Requiere configuración |
| File upload | Simple (multipart) | Complejo |
| Curva de aprendizaje | Baja | Media-Alta |
| **Cuándo usarlo** | APIs públicas, simples, REST ya conocido | BFF, apps con múltiples clientes, datos complejos relacionados |

---

## Conceptos core

### Schema — el contrato

```graphql
# Schema GraphQL — define todos los tipos y operaciones

type Query {
  usuario(id: ID!): Usuario
  usuarios(filtro: FiltroUsuario): [Usuario!]!
  productos(pagina: Int = 1, porPagina: Int = 10): PaginaProductos!
}

type Mutation {
  crearUsuario(input: CrearUsuarioInput!): UsuarioPayload!
  actualizarUsuario(id: ID!, input: ActualizarUsuarioInput!): UsuarioPayload!
  eliminarUsuario(id: ID!): Boolean!
}

type Subscription {
  pedidoActualizado(pedidoId: ID!): Pedido!
}

type Usuario {
  id: ID!
  nombre: String!
  email: String!
  fechaCreacion: DateTime!
  pedidos: [Pedido!]!
  pedidosRecientes(limite: Int = 5): [Pedido!]!
}

type Pedido {
  id: ID!
  estado: EstadoPedido!
  total: Decimal!
  items: [ItemPedido!]!
  usuario: Usuario!
}

enum EstadoPedido {
  PENDIENTE
  PROCESANDO
  ENVIADO
  ENTREGADO
  CANCELADO
}

input CrearUsuarioInput {
  nombre: String!
  email: String!
}

type UsuarioPayload {
  usuario: Usuario
  errores: [Error!]
}

type Error {
  mensaje: String!
  campo: String
}
```

---

## Hot Chocolate — GraphQL en .NET

Hot Chocolate es la librería más completa para GraphQL en .NET. Mantenida activamente por ChilliCream.

```bash
dotnet add package HotChocolate.AspNetCore
dotnet add package HotChocolate.Data.EntityFramework
```

### Setup básico

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddDbContext<AppDbContext>(o => o.UseSqlServer(connectionString))
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .AddSubscriptionType<Subscription>()
    .AddFiltering()        // Habilita filtrado automático
    .AddSorting()          // Habilita ordenamiento automático
    .AddProjections()      // Optimiza queries SQL según campos pedidos
    .AddInMemorySubscriptions(); // Para Subscriptions (WebSockets)

var app = builder.Build();

app.MapGraphQL(); // Endpoint en /graphql
// Incluye GraphQL IDE en desarrollo (Banana Cake Pop)

app.Run();
```

### Queries

```csharp
// Tipos del dominio
public class Usuario
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime FechaCreacion { get; set; }
    public ICollection<Pedido> Pedidos { get; set; } = [];
}

// Query type
public class Query
{
    // Resolver simple
    public async Task<Usuario?> GetUsuarioAsync(
        int id,
        AppDbContext db,
        CancellationToken ct)
    {
        return await db.Usuarios
            .Include(u => u.Pedidos)
            .FirstOrDefaultAsync(u => u.Id == id, ct);
    }

    // [UseProjection] — Hot Chocolate solo hace SELECT de los campos pedidos
    // [UseFiltering] — agrega capacidad de filtrar: usuarios(where: { nombre: { contains: "Ana" } })
    // [UseSorting]   — agrega capacidad de ordenar: usuarios(order: { nombre: ASC })
    // [UsePaging]    — paginación automática con cursor o offset
    [UseDbContext(typeof(AppDbContext))]
    [UseProjection]
    [UseFiltering]
    [UseSorting]
    [UsePaging(MaxPageSize = 50)]
    public IQueryable<Usuario> GetUsuarios([ScopedService] AppDbContext db)
    {
        return db.Usuarios; // Hot Chocolate arma el query SQL según lo que pide el cliente
    }
}
```

### Mutations

```csharp
public class Mutation
{
    public async Task<UsuarioPayload> CrearUsuarioAsync(
        CrearUsuarioInput input,
        AppDbContext db,
        CancellationToken ct)
    {
        // Validación
        if (await db.Usuarios.AnyAsync(u => u.Email == input.Email, ct))
        {
            return new UsuarioPayload(
                null,
                [new UserError("El email ya está registrado", "EMAIL_DUPLICADO")]);
        }

        var usuario = new Usuario
        {
            Nombre = input.Nombre,
            Email = input.Email,
            FechaCreacion = DateTime.UtcNow,
        };

        db.Usuarios.Add(usuario);
        await db.SaveChangesAsync(ct);

        return new UsuarioPayload(usuario, null);
    }
}

// Input/Payload types
public record CrearUsuarioInput(string Nombre, string Email);

public class UsuarioPayload
{
    public Usuario? Usuario { get; }
    public IReadOnlyList<UserError>? Errores { get; }

    public UsuarioPayload(Usuario? usuario, IReadOnlyList<UserError>? errores)
    {
        Usuario = usuario;
        Errores = errores;
    }
}

public record UserError(string Mensaje, string Codigo);
```

### Subscriptions (tiempo real)

```csharp
// Subscription type
public class Subscription
{
    [Subscribe]
    [Topic("PedidoActualizado_{pedidoId}")]
    public Pedido PedidoActualizado(
        [EventMessage] Pedido pedido,
        int pedidoId) => pedido;
}

// Publicar un evento desde la mutation
public class Mutation
{
    public async Task<Pedido> ActualizarEstadoPedidoAsync(
        int pedidoId,
        EstadoPedido nuevoEstado,
        AppDbContext db,
        [Service] ITopicEventSender sender,
        CancellationToken ct)
    {
        var pedido = await db.Pedidos.FindAsync(pedidoId, ct)
            ?? throw new KeyNotFoundException();

        pedido.Estado = nuevoEstado;
        await db.SaveChangesAsync(ct);

        // Publicar el evento — los subscriptores lo reciben vía WebSocket
        await sender.SendAsync(
            $"PedidoActualizado_{pedidoId}",
            pedido,
            ct);

        return pedido;
    }
}
```

---

## DataLoader — solucionar el problema N+1

El problema N+1 en GraphQL es crítico: si pedís 10 usuarios con sus pedidos, hace 1 query para usuarios + 10 queries para pedidos de cada uno.

```graphql
# Esta query sin DataLoader hace 1 + N queries
query {
  usuarios {    # → 1 query: SELECT * FROM Usuarios
    nombre
    pedidos {   # → N queries: SELECT * FROM Pedidos WHERE UsuarioId = X (por cada usuario)
      total
    }
  }
}
```

```csharp
// DataLoader — agrupa y hace una sola query para todos
public class PedidosByUsuarioIdDataLoader : GroupedDataLoader<int, Pedido>
{
    private readonly IDbContextFactory<AppDbContext> _dbFactory;

    public PedidosByUsuarioIdDataLoader(
        IDbContextFactory<AppDbContext> dbFactory,
        IBatchScheduler batchScheduler,
        DataLoaderOptions options)
        : base(batchScheduler, options)
    {
        _dbFactory = dbFactory;
    }

    protected override async Task<ILookup<int, Pedido>> LoadGroupedBatchAsync(
        IReadOnlyList<int> usuarioIds,
        CancellationToken ct)
    {
        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        // Una SOLA query para todos los usuario IDs del batch
        var pedidos = await db.Pedidos
            .Where(p => usuarioIds.Contains(p.UsuarioId))
            .ToListAsync(ct);

        return pedidos.ToLookup(p => p.UsuarioId);
        // SQL: SELECT * FROM Pedidos WHERE UsuarioId IN (1, 2, 3, ...)
    }
}

// Usar en el resolver del campo
public class UsuarioType : ObjectType<Usuario>
{
    protected override void Configure(IObjectTypeDescriptor<Usuario> descriptor)
    {
        descriptor
            .Field(u => u.Pedidos)
            .ResolveWith<Resolvers>(r => r.GetPedidosAsync(default!, default!, default!));
    }

    private class Resolvers
    {
        public async Task<IEnumerable<Pedido>> GetPedidosAsync(
            [Parent] Usuario usuario,
            PedidosByUsuarioIdDataLoader dataLoader,  // ← Hot Chocolate inyecta automático
            CancellationToken ct)
        {
            return await dataLoader.LoadAsync(usuario.Id, ct);
        }
    }
}
```

---

## Autenticación y autorización

```csharp
// Registrar auth en GraphQL
builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .AddAuthorization();  // ← Integración con ASP.NET Core Authorization

// Aplicar en resolvers
public class Query
{
    // Solo usuarios autenticados
    [Authorize]
    public async Task<Usuario?> GetMiPerfilAsync(
        [GlobalState(GlobalStateKeys.UserId)] int userId,
        AppDbContext db)
    {
        return await db.Usuarios.FindAsync(userId);
    }

    // Solo admins
    [Authorize(Roles = new[] { "admin" })]
    public IQueryable<Usuario> GetTodosUsuarios([ScopedService] AppDbContext db)
    {
        return db.Usuarios;
    }
}

// Middleware para extraer el userId del JWT al contexto global
builder.Services
    .AddGraphQLServer()
    .AddHttpRequestInterceptor<AuthRequestInterceptor>();

public class AuthRequestInterceptor : DefaultHttpRequestInterceptor
{
    public override ValueTask OnCreateAsync(
        HttpContext context,
        IRequestExecutor executor,
        IQueryRequestBuilder requestBuilder,
        CancellationToken ct)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var userId = context.User.FindFirst("sub")?.Value;
            requestBuilder.SetGlobalState(GlobalStateKeys.UserId, int.Parse(userId!));
        }

        return base.OnCreateAsync(context, executor, requestBuilder, requestBuilder, ct);
    }
}
```

---

## GraphQL en el cliente React

```bash
npm install @apollo/client graphql
```

```tsx
// src/lib/apollo.ts
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: '/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

```tsx
// src/App.tsx
import { ApolloProvider } from '@apollo/client';
import { client } from './lib/apollo';

export default function App() {
  return (
    <ApolloProvider client={client}>
      <Router />
    </ApolloProvider>
  );
}
```

```tsx
// src/hooks/useUsuarios.ts — query con Apollo Client
import { gql, useQuery } from '@apollo/client';

const GET_USUARIOS = gql`
  query GetUsuarios($pagina: Int, $filtro: FiltroUsuarioInput) {
    usuarios(pagina: $pagina, filtro: $filtro) {
      nodes {
        id
        nombre
        email
        pedidos {
          id
          total
          estado
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

interface UsuariosQueryVars {
  pagina?: number;
  filtro?: { nombre?: string };
}

export function useUsuarios(vars?: UsuariosQueryVars) {
  const { data, loading, error, fetchMore } = useQuery(GET_USUARIOS, {
    variables: vars,
  });

  return {
    usuarios: data?.usuarios.nodes ?? [],
    loading,
    error,
    hasNextPage: data?.usuarios.pageInfo.hasNextPage,
    cargarMas: () =>
      fetchMore({
        variables: { ...vars, after: data?.usuarios.pageInfo.endCursor },
      }),
  };
}
```

```tsx
// src/hooks/useCrearUsuario.ts — mutation con Apollo Client
import { gql, useMutation } from '@apollo/client';

const CREAR_USUARIO = gql`
  mutation CrearUsuario($input: CrearUsuarioInput!) {
    crearUsuario(input: $input) {
      usuario {
        id
        nombre
        email
      }
      errores {
        mensaje
        campo
      }
    }
  }
`;

export function useCrearUsuario() {
  const [crearUsuario, { loading, error }] = useMutation(CREAR_USUARIO, {
    // Actualizar la caché local después de crear
    update(cache, { data }) {
      const nuevoUsuario = data?.crearUsuario.usuario;
      if (!nuevoUsuario) return;

      cache.modify({
        fields: {
          usuarios(usuariosExistentes = []) {
            const ref = cache.writeFragment({
              data: nuevoUsuario,
              fragment: gql`fragment NuevoUsuario on Usuario { id nombre email }`,
            });
            return { ...usuariosExistentes, nodes: [...usuariosExistentes.nodes, ref] };
          },
        },
      });
    },
  });

  const crear = async (nombre: string, email: string) => {
    const { data } = await crearUsuario({
      variables: { input: { nombre, email } },
    });

    if (data?.crearUsuario.errores?.length) {
      throw new Error(data.crearUsuario.errores[0].mensaje);
    }

    return data?.crearUsuario.usuario;
  };

  return { crear, loading, error };
}
```

---

## Introspection y documentación

```graphql
# GraphQL tiene introspection built-in — el cliente puede preguntar qué tipos existen
query {
  __schema {
    types {
      name
      kind
      fields {
        name
        type {
          name
        }
      }
    }
  }
}
```

:::warning Deshabilitar introspection en producción
La introspection expone todo el schema — tipos, campos, relaciones. En producción, deshabilitarla para no darle información al atacante.

```csharp
builder.Services
    .AddGraphQLServer()
    .ModifyRequestOptions(opt =>
        opt.EnableSchemaIntrospection = builder.Environment.IsDevelopment());
```
:::

---

## Preguntas frecuentes de entrevista 🎯

**1. ¿Cuándo elegirías GraphQL sobre REST?**
> GraphQL brilla cuando: el cliente necesita datos de múltiples recursos en una sola llamada (BFF pattern), diferentes clientes (web/mobile) necesitan formas distintas del mismo dato, hay over-fetching evidente (trayendo 20 campos cuando solo se necesitan 3), o cuando el schema evoluciona frecuentemente y querés deprecar campos sin versionar. REST sigue siendo mejor para APIs públicas simples, file uploads, o cuando el HTTP caching nativo importa.

**2. ¿Qué es el problema N+1 en GraphQL y cómo se soluciona?**
> Cuando se consultan entidades con relaciones (usuarios + sus pedidos), sin optimización se hace 1 query para los usuarios y luego 1 query por cada usuario para sus pedidos. La solución es **DataLoader** — agrupa todas las peticiones del mismo tipo en un batch y hace una sola query con `WHERE id IN (...)`. Hot Chocolate integra DataLoaders automáticamente.

**3. ¿Cómo versionar una API GraphQL?**
> GraphQL evita el versionado explícito (/v1/, /v2/) usando deprecación de campos: se agrega el nuevo campo, se marca el viejo como `@deprecated(reason: "Usar nuevoNombreCampo")`, y se elimina después de un período de gracia cuando los clientes migran. Solo si hay breaking changes masivos se crea un nuevo endpoint (infrecuente).

**4. ¿Qué es una Subscription en GraphQL?**
> Una operación que establece una conexión persistente (WebSocket) y envía actualizaciones en tiempo real al cliente cuando ocurren eventos. Equivalente a WebSockets o Server-Sent Events, pero con la misma sintaxis de queries GraphQL. Útil para dashboards en tiempo real, estado de pedidos, notificaciones.

**5. ¿Cuál es el riesgo de seguridad más importante en GraphQL?**
> **Queries complejas / depth attack** — un cliente puede enviar una query infinitamente anidada que explota la BD. Soluciones: limitar profundidad máxima (`MaxAllowedExecutionDepth`), limitar complejidad del query (`MaxAllowedComplexity`), deshabilitar introspection en producción, y rate limiting. Sin estas medidas, un solo request mal intencionado puede tirar el servidor.
