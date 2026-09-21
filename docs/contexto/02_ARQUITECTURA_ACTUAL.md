# Arquitectura actual comprobada

## Stack

- Node.js 20 o superior.
- Express 4.
- JavaScript ESM sin framework de frontend ni bundler.
- `bcryptjs` para claves y HMAC propio para la sesión.
- Persistencia intercambiable: adaptador JSON (servidor) y adaptador localStorage (standalone).
- Frontend estático: `index.html`, `app.js`, `styles.css` y `manifest.webmanifest`.

## Capas reales

### Core (E3A)

`core/` — contratos puros ESM: `identity/`, `organizations/`, `authorization/`, `audit/`, `contracts/`, `features/`.
No importa `engine/`, `data/demo.js`, `server/`, `app.js`, ni futuros `gestion/`/`forja/`.
Prueba negativa de dependencias en `tests/e3a-core-boundaries.test.js`.

Compatibilidad: `workspaceId === tenantId` para MONKEYS/SOMA; `tenantId` se conserva como alias hasta E3B.

### Datos

`data/` define tenants (incl. `features: { gestion, forja }`), planes, clases, socios, membresías, pagos, plantillas, i18n y demo. Dos tenants demo: MONKEYS y SOMA.

### Dominio

`engine/` — conversación, intención, catálogo, fechas, socios, membresías, pagos, auth, automatización, WhatsApp-out. Clock inyectable (`engine/clock.js`). Acciones pasan por contrato Core (destinatario/origen) sin cambiar textos ni agentes.

### Persistencia (E1B/E2)

Contrato en `engine/persistencia/`: V1 histórico, V2 actual con `sedeId`. Adaptadores JSON y localStorage. Semántica V1/V2 intacta en E3A (sin Snapshot V3).

### API

`server/index.js` — salud, tema, login/sesión (`userId`+`workspaceId` aditivos), conversaciones, clases, planes, reservas, leads, automatización, socios, CSV y pagos.

### Interfaz

SPA hash; API o local. Asistente, panel, socios, pagos, automatizaciones. Marca por tenant (CSS). Sin pestañas de rol.

## Seguridad y tenancy

- Tenant por encabezado/parámetro; entidades con `tenantId`.
- Sesión cookie HttpOnly; login enriquece `userId`/`workspaceId` sin quitar campos previos.
- RBAC contractual en Core; aplicación plena a rutas = E3C.
- Bloqueo tras cinco fallos.

## Automatización e IA

Comprensión determinista local; sin LLM. Agentes → acciones con `destinatarioRol` (`socio`/`equipo`) y `origenDominio: gestion`.

## Diferencias frente al objetivo

Regla `.cursor/rules/forkza.mdc` menciona `/server/store/*` y `/channels/*` como objetivo. Hoy: `engine/persistencia/*`, `engine/store.js`. Forja Training no implementado (`features.forja: false`).

## Prácticas observadas

- Lógica de negocio separada del DOM en gran parte.
- Clock inyectable en motor/persistencia; UI puede usar reloj de pared.
- Sin Postgres/SQL, colas, ni almacenamiento de archivos productivo.
