# Arquitectura actual comprobada

## Stack

- Node.js 20 o superior.
- Express 4.
- JavaScript ESM sin framework de frontend ni bundler.
- `bcryptjs` para claves y HMAC propio para la sesión.
- Persistencia del servidor en JSON local; alternativa standalone en `localStorage`.
- Frontend estático: `index.html`, `app.js`, `styles.css` y `manifest.webmanifest`.

## Capas reales

### Datos

`data/` define tenants, planes, clases, socios, membresías, pagos, plantillas, traducciones y datos demo. Existen dos tenants demo: MONKEYS y SOMA.

### Dominio

`engine/` contiene reglas para conversación, intención, catálogo, fechas, socios, membresías, pagos, autenticación, automatización y salida compatible con WhatsApp.

### Estado

- `engine/store.js`: memoria de servidor, separada por `tenantId`.
- `engine/store-local.js`: fallback de navegador por tenant.
- `server/data/data.json`: persistencia JSON en servidor; está ignorada por Git.

### API

`server/index.js` sirve frontend y 35 rutas API. Incluye salud, tema, login/sesión, conversaciones, clases, planes, reservas, leads, automatización, socios, importación CSV y pagos.

### Interfaz

La SPA usa rutas hash y puede operar contra API o en modo local. Presenta asistente, panel, socios, pagos y automatizaciones. La marca se inyecta por tenant mediante variables CSS.

## Seguridad y tenancy existente

- El tenant se resuelve por encabezado/parámetro según la ruta.
- Entidades principales incluyen `tenantId` y los stores mantienen partición por tenant.
- Las vistas internas requieren sesión; el asistente público no.
- Sesión en cookie `HttpOnly`, `SameSite=Lax`, firmada por HMAC.
- Hay bloqueo temporal tras cinco intentos fallidos.
- Los usuarios demo y motores para MONKEYS/SOMA están definidos de forma estática.

## Automatización e IA

La comprensión actual es determinista y local; no hay LLM conectado. Los agentes de retención, cobranza, reactivación, recordatorio y referidos generan acciones mediante reglas y plantillas. “IA” describe una arquitectura sustituible/proyectada, no un modelo generativo ya operativo.

## Diferencias frente a la arquitectura objetivo

La regla `.cursor/rules/forkza.mdc` menciona `/server/store/*`, `/channels/*` y contratos futuros. Es una arquitectura objetivo, no una descripción exacta del árbol actual: hoy existen `engine/store.js`, `engine/store-local.js` y no existe una capa `/channels` implementada. El README también menciona una interfaz `MessageChannel`, pero no hay implementación con ese nombre.

Forja Training todavía no está implementado en el código. Su diseño existe en los documentos maestros: modalidades, ejercicios, planificación, wellness, RPE, cargas y progreso.

## Prácticas observadas

- La lógica de negocio está separada del DOM en gran parte.
- Las respuestas pasan por límites compatibles con WhatsApp.
- Se usa inyección de fecha en varios motores, pero quedan llamadas directas a `new Date()` y `fechaHoy()` que reducen el determinismo.
- No hay base de datos relacional, migraciones, colas, almacenamiento de archivos ni RBAC granular implementados.

