---
id: http-web
title: HTTP & Web Fundamentals
sidebar_position: 8
---

# HTTP & Web Fundamentals 🟢

## ¿Qué pasa cuando escribes una URL en el navegador?

Este proceso es una de las preguntas más clásicas en entrevistas:

```
1. DNS Resolution
   "google.com" → IP: 142.250.80.46

2. TCP Handshake (3-way)
   Cliente → SYN → Servidor
   Cliente ← SYN-ACK ← Servidor
   Cliente → ACK → Servidor

3. TLS Handshake (si HTTPS)
   Negociación de cifrado, intercambio de certificados

4. HTTP Request
   GET / HTTP/1.1
   Host: www.google.com
   Accept: text/html

5. HTTP Response
   HTTP/1.1 200 OK
   Content-Type: text/html
   [body con el HTML]

6. Rendering
   Parse HTML → DOM
   Parse CSS → CSSOM
   DOM + CSSOM → Render Tree → Layout → Paint
```

---

## HTTP — Métodos

| Método | Uso | Idempotente | Body |
|--------|-----|-------------|------|
| GET | Obtener recurso | ✅ Sí | No |
| POST | Crear recurso | ❌ No | Sí |
| PUT | Reemplazar recurso | ✅ Sí | Sí |
| PATCH | Actualizar parcial | ✅ Sí | Sí |
| DELETE | Eliminar recurso | ✅ Sí | Opcional |
| HEAD | Solo headers (sin body) | ✅ Sí | No |
| OPTIONS | Ver métodos disponibles | ✅ Sí | No |

---

## HTTP — Códigos de estado

```
1xx — Informativos
  100 Continue

2xx — Éxito
  200 OK
  201 Created         → POST exitoso
  204 No Content      → DELETE/PUT sin body de respuesta

3xx — Redirecciones
  301 Moved Permanently  → redirección permanente (SEO)
  302 Found              → redirección temporal
  304 Not Modified       → caché válido, no se envía body

4xx — Error del cliente
  400 Bad Request        → request mal formado
  401 Unauthorized       → no autenticado
  403 Forbidden          → autenticado pero sin permisos
  404 Not Found          → recurso no existe
  409 Conflict           → email duplicado, versión incorrecta
  422 Unprocessable      → validación de negocio fallida
  429 Too Many Requests  → rate limiting

5xx — Error del servidor
  500 Internal Server Error → bug en el servidor
  502 Bad Gateway           → error en el proxy/load balancer
  503 Service Unavailable   → servidor caído/sobrecargado
  504 Gateway Timeout       → timeout del proxy
```

---

## HTTP Headers importantes

```http
# Request headers
GET /api/productos HTTP/1.1
Host: api.ejemplo.com
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json
Accept: application/json
Accept-Language: es-AR
Cache-Control: no-cache
X-Correlation-ID: abc-123-def  ← para tracing

# Response headers
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 1234
Cache-Control: max-age=3600, public
ETag: "abc123"                 ← para caché condicional
Location: /api/productos/42   ← en respuesta 201 Created
X-RateLimit-Remaining: 95
```

---

## Cookies vs localStorage vs sessionStorage

| | Cookie | localStorage | sessionStorage |
|---|---|---|---|
| **Capacidad** | ~4 KB | ~5-10 MB | ~5-10 MB |
| **Expiración** | Configurable | Sin expiración | Al cerrar pestaña |
| **Acceso desde JS** | Sí (si no HttpOnly) | Sí | Sí |
| **Enviado con request** | ✅ Automático | ❌ Manual | ❌ Manual |
| **Accesible entre tabs** | ✅ Sí | ✅ Sí | ❌ No |
| **Seguridad** | HttpOnly + Secure + SameSite | Vulnerable a XSS | Vulnerable a XSS |

```javascript
// localStorage
localStorage.setItem('token', valor);
const token = localStorage.getItem('token');
localStorage.removeItem('token');
localStorage.clear();

// sessionStorage — misma API, diferente scope
sessionStorage.setItem('tempData', datos);

// Cookie
document.cookie = "nombre=valor; expires=Fri, 31 Dec 2025 23:59:59 GMT; path=/";
```

---

## CORS (Cross-Origin Resource Sharing)

```
Origen = protocolo + dominio + puerto
https://mi-app.com:443 y http://mi-app.com:80 son orígenes DISTINTOS
```

```
// Escenario típico:
// Frontend en: https://mi-frontend.com
// API en: https://mi-api.com

// El navegador envía un preflight request OPTIONS:
OPTIONS /api/datos HTTP/1.1
Origin: https://mi-frontend.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Content-Type

// El servidor responde:
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://mi-frontend.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400  ← cachear el preflight 24hs
```

:::note CORS es del lado del navegador
CORS lo aplica el **navegador**, no el servidor. Si haces la request desde Postman o curl, no hay restricción CORS. Solo aplica en browsers.
:::

---

## HTTP/1.1 vs HTTP/2 vs HTTP/3

| Característica | HTTP/1.1 | HTTP/2 | HTTP/3 |
|----------------|----------|--------|--------|
| Protocolo base | TCP | TCP | UDP (QUIC) |
| Multiplexing | ❌ | ✅ (múltiples streams) | ✅ |
| Header compression | ❌ | ✅ HPACK | ✅ QPACK |
| Server Push | ❌ | ✅ | ✅ |
| HOL blocking | Por request | Por TCP | ❌ |
| Uso actual | Legacy | ~65% | Creciendo |

---

## WebSockets

Para comunicación bidireccional en tiempo real:

```javascript
// Cliente
const ws = new WebSocket('wss://mi-servidor.com/ws');

ws.onopen = () => {
  console.log('Conectado');
  ws.send(JSON.stringify({ tipo: 'suscribir', canal: 'precios' }));
};

ws.onmessage = (event) => {
  const datos = JSON.parse(event.data);
  console.log('Mensaje recibido:', datos);
};

ws.onclose = () => console.log('Desconectado');
ws.onerror = (error) => console.error('Error:', error);

// Cerrar
ws.close();
```

```csharp
// Servidor con ASP.NET Core SignalR (abstracción sobre WebSockets)
public class PreciosHub : Hub
{
    public async Task SuscribirATicker(string ticker)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, ticker);
    }

    // Enviar a todos los clientes en el grupo
    public async Task NotificarPrecio(string ticker, decimal precio)
    {
        await Clients.Group(ticker).SendAsync("PrecioActualizado", ticker, precio);
    }
}
```

---

## Cache HTTP

```http
# Sin caché
Cache-Control: no-store

# Siempre revalidar con el servidor
Cache-Control: no-cache

# Cacheable por 1 hora, solo en el cliente
Cache-Control: private, max-age=3600

# Cacheable por 1 día, en CDN y cliente
Cache-Control: public, max-age=86400

# Caché condicional con ETag
# Primera respuesta:
ETag: "abc123"

# Segunda request del cliente:
If-None-Match: "abc123"

# Si no cambió:
HTTP/1.1 304 Not Modified  ← sin body, ahorro de bandwidth
```
