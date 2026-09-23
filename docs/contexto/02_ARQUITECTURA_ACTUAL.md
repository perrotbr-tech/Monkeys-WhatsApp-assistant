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
No importa `engine/`, `data/`, `server/`, `app.js`, ni futuros `gestion/`/`forja/`.
Catálogo: `crearCatalogoWorkspaces(ids)` inyectado; adaptador `catalogoWorkspaces()` en `data/tenants.js`.
`userId` global por correo; `workspaceId`/rol = pertenencia. IDs cruzados → `workspace_tenant_incoherente`.
Prueba negativa: `tests/e3a-core-boundaries.test.js`.

### Datos

`data/` — tenants (features `gestion`/`forja`), planes, clases, socios, membresías, pagos, plantillas, i18n y demo. MONKEYS y SOMA; `acme` vía `registrarTenant`.

### Dominio

`engine/` — conversación, intención, catálogo, fechas, socios, membresías, pagos, auth, automatización, WhatsApp-out. Clock inyectable. Acciones nuevas cumplen contrato E3A; históricas migradas llevan al menos `workspaceId`.
Entidades nuevas (reserva, lead, conversación, socio, membresía, pago, campaña, acciones) nacen con `{ workspaceId, tenantId: workspaceId }` en el dominio; no dependen del sellado de persistencia.

### Persistencia (E3B — actual)

Contrato en `engine/persistencia/`. Versión actual: **Snapshot V3** (`SCHEMA_VERSION = 3`).

**WorldSnapshotV3:** `{ schemaVersion: 3, tenants: TenantConfig[], byWorkspace: { [workspaceId]: WorkspaceSliceV3 } }`. Sin `byTenant` ni `data` en disco.

**WorkspaceSnapshotV3:** `{ schemaVersion: 3, workspaceId, tenantId (= workspaceId), data: WorkspaceSliceV3 }`.

**WorkspaceSliceV3:** slice V2 + `workspaceId` canónico (= `tenantId` alias) en el slice y en entidades: classes, plans, bookings, leads, conversations, socios, asistencias, membresias, pagos, referidos, usuariosEquipo; más `automation.acciones` y `automation.campanias` (y acciones anidadas en campañas). Elementos estrictamente anidados sin evidencia propia no inventan actor/origen; campañas/acciones sí exigen `workspaceId` coherente.

Migraciones: `V0→V1→V2→V3`, `V1→V2→V3`, `V2→V3`, `V3` idempotente (`migrateV2toV3` / `migrateToCurrent`). V1/V2/V3 declarados incompletos → `PERSISTENCIA_CORRUPTA` (no se reparan). Catálogo inyectado; desconocidos/ambiguos se rechazan. Corruptos no se sobrescriben.

Escritura runtime: `proyectarRuntimeAWorldV3` / `prepararMundoParaEscritura` / `envelopeTenantEscritura` validan con `validarSliceV3` sin `sellarWorkspaceEnSlice` ni `normalizarSlice`. Solo bootstrap y migraciones documentadas sellan/completan. Cruzados o campos ausentes → error; entrada y destino intactos.

Runtime: `mundoRuntimeDesdeSnapshot` proyecta `byWorkspace` → vista `byTenant` (una fuente en disco).

Aliases documentados: `crearTenantSnapshot`/`crearTenantSnapshotV3` → Workspace V3; `CARGA.V1_VALIDO` → `v3_valid`; `CARGA.V2_VALIDO` → `v2_migratable`; `claveEstado` → `claveEstadoV1`; parámetros `tenantId` coexisten con `workspaceId`.

### API / Interfaz / Seguridad (E3C)

Sesión con `userId`/`workspaceId` aditivos. Middleware en `server/acceso.js`: `requireAuth`, `requireFeature`, `requirePermission` reutilizan Core (`crearContextoAcceso`, `contextoCoincideConSesion`, `tienePermiso`, `featureHabilitado`). Deny-by-default: sin sesión → 401; sin permiso/feature/rol desconocido → 403; tenant incoherente → 401. Rol desconocido deniega aunque traiga permisos explícitos; permisos explícitos solo restringen roles canónicos. `tenantId`/`workspaceId` del body/query no autorizan. `GET /api/me` expone permisos y features efectivos (sin permisos desconocidos). UI (`app.js`) oculta navegación/acciones no autorizadas; el servidor es autoridad final. `pagarDemo(tenantId, ref, fecha)` y rutas demo/webhook acotados al `X-Tenant`. `POST /api/demo/reset` restaura solo `req.tenant.id` vía `hidratarTenant` + seed `clonarDemo` (no el mundo completo). `AuditSink` inyectable en `crearApp` (default memoria). SPA hash; marca por tenant.

## Diferencias frente al objetivo

Regla menciona `/server/store/*` y `/channels/*`. Hoy: `engine/persistencia/*`, `engine/store.js`. Forja Training no implementado.
