# Arquitectura actual comprobada

## Stack

- Node.js 20 o superior.
- Express 4.
- JavaScript ESM sin framework de frontend ni bundler.
- `bcryptjs` para claves y HMAC propio para la sesión.
- Persistencia intercambiable: adaptador JSON (servidor) y adaptador localStorage (standalone).
- Frontend estático: `index.html`, `app.js`, `styles.css` y `manifest.webmanifest`.

## Capas reales

### Datos

`data/` define tenants, planes, clases, socios, membresías, pagos, plantillas, traducciones y datos demo. Existen dos tenants demo: MONKEYS y SOMA.

### Dominio

`engine/` contiene reglas para conversación, intención, catálogo, fechas, socios, membresías, pagos, autenticación, automatización y salida compatible con WhatsApp. El reloj es inyectable vía `engine/clock.js` (E1A).

### Persistencia (E1B)

- Contrato en `engine/persistencia/`: estados de carga (vacío, V0 migrable, V1 válido, corrupto), `WorldSnapshotV1`, `TenantSnapshotV1`, `migrateV0toV1`.
- Adaptador JSON (`persistencia/json.js`): ruta inyectable, escritura atómica temp→rename.
- Adaptador localStorage (`persistencia/local.js`): clave `forkza_demo_state_<tenant>`; migra `monkeys_demo_state`.
- `engine/store.js`: motor de dominio en memoria (hidratar mundo ≠ hidratar tenant).
- `engine/store-local.js` y `server/index.js` delegan carga/guardado a los adaptadores.
- Demo solo en bootstrap vacío, reset explícito o migración de campo documentada. Snapshot corrupto → error; no se reemplaza con demo.

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

## Automatización e IA

Comprensión determinista local; sin LLM. Los agentes generan acciones por reglas. Tras bootstrap, los datos persistidos son la fuente de verdad (`automation.extraer` ya no rellena desde demo).

## Diferencias frente a la arquitectura objetivo

La regla `.cursor/rules/forkza.mdc` menciona `/server/store/*` y `/channels/*` como objetivo. Hoy: `engine/persistencia/*`, `engine/store.js`, `engine/store-local.js`. Forja Training no está implementado.

## Prácticas observadas

- Lógica de negocio separada del DOM en gran parte.
- Respuestas con límites compatibles con WhatsApp.
- Clock inyectable en motor y persistencia; UI (`app.js`) aún puede usar reloj de pared.
- Sin Postgres/SQL, colas, RBAC granular ni almacenamiento de archivos productivo.
