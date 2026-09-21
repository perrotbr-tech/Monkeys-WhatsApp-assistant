# Arquitectura actual comprobada

## Stack

- Node.js 20 o superior.
- Express 4.
- JavaScript ESM sin framework de frontend ni bundler.
- `bcryptjs` para claves y HMAC propio para la sesión.
- Persistencia intercambiable: adaptador JSON (servidor) y adaptador localStorage (standalone).
- Frontend estático: `index.html`, `app.js`, `styles.css` y `manifest.webmanifest`.

## Capas reales

### Datos y configuración de tenant (E2)

`data/tenants.js` define el contrato único de configuración: `tenantId`/`slug`/nombre visible, idioma, zona, marca, `codigoPrefix`, sedes con `sedeId` estable + nombre, menú, capacidades (cupos, trial, emoji), textos y `aliasHistoricos`. Sin lógica de negocio en el objeto. Catálogo registrable (`registrarTenant`) para tenants adicionales sin tocar motor/servidor.

`data/demo.js` construye slices vía builders registrados por `tenantId`, no por `if (slug === …)`.

### Dominio

`engine/` contiene reglas para conversación, intención, catálogo, fechas, socios, membresías, pagos, autenticación, automatización y salida WhatsApp. Reloj inyectable (`engine/clock.js`). Conversación lee menús/capacidades desde config; sin bifurcaciones `tid === "soma"|"monkeys"`.

### Persistencia (E1B + E2)

- Contrato en `engine/persistencia/`: estados de carga, `WorldSnapshotV1`/`TenantSnapshotV1` (históricos), `WorldSnapshotV2`/`TenantSnapshotV2` (actual, `schemaVersion: 2`).
- Migración `V0→V1→V2` y `migrateV1toV2`: nombres de sede → `sedeId` estable; idempotente; rechaza ambiguos/corruptos sin sobrescribir.
- Claves localStorage `forkza_demo_state_<tenant>`; legacy `monkeys_demo_state` solo como compatibilidad histórica.
- Adaptadores JSON/localStorage; demo solo en vacío, reset o migración de campo documentada.

### API

`server/index.js` construye `engines`/`autos` recorriendo `idsTenantsActivos()`. Sin propiedades manuales `.monkeys`/`.soma`.

### Interfaz

SPA con selector de tenants desde `listarTenants()`. Rutas hash; API o modo local. Marca por CSS variables.

## Seguridad y tenancy

- Tenant por encabezado/parámetro; entidades con `tenantId`; sedes/planes por ID estable.
- Sesión cookie `HttpOnly`, `SameSite=Lax`, HMAC; bloqueo tras cinco fallos.

## Diferencias frente al objetivo

La regla menciona `/server/store/*` y `/channels/*` como objetivo. Hoy: `engine/persistencia/*`, `engine/store.js`. `workspaceId` transversal = E3. Forja Training no implementado.
