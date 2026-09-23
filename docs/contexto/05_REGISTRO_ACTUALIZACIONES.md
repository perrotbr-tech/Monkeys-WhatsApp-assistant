# Registro de actualizaciones del contexto (bloque vigente)

Continuación de `06_REGISTRO_ACTUALIZACIONES_HISTORICO.md` (entradas hasta E2 post-docs).

## Plantilla para próximas entradas

```text
AAAA-MM-DD — título
- Rama y commit:
- PR/plataforma:
- Archivos o fuentes revisadas:
- Pruebas ejecutadas y resultado:
- Hechos que cambiaron:
- Decisión o impacto:
```

No eliminar entradas anteriores. Si una conclusión queda obsoleta, agregar una nueva entrada que la reemplace y actualizar el bloque temático correspondiente.

## 2026-09-21 — E3A: contratos Forkza Core y fronteras

- Rama: `cursor/e3-forkza-core-boundaries-ac33` @ `fb1ab98` desde `main` @ `4504c9b`.
- PR draft E3: #16 → `main`.
- Nuevo `core/` ESM + adaptadores de sesión/acciones/features.
- Pruebas iniciales E3A: 168/168. E3B/E3C/Forja no iniciados. Sin merge.

## 2026-09-22 — E3A revisión B1–B4 (mismo PR #16)

- Commit: `f304106a86cc0987aac464685f0527bd7d106dd8` en `cursor/e3-forkza-core-boundaries-ac33`.
- B1/B2: `resolverParTenantWorkspace` rechaza `tenantId ≠ workspaceId` (`workspace_tenant_incoherente`) en identidad, sesión y acciones; entrada de acción intacta.
- B3: `crearCatalogoWorkspaces(ids)` inyectable; adaptador `catalogoWorkspaces()` desde `idsTenantsActivos`/`registrarTenant`; Core sin hardcode monkeys/soma; tenant `acme` admitido vía catálogo; desconocido rechazado.
- B4: `userIdEstable` solo por correo; mismo email → mismo `userId` en workspaces distintos; contextos separados por `workspaceId`/rol.
- Docs tip: `14d24baede77e5ffbd82866d551a8197d35419d1`. Suite 177/177. E3A cerrada en ese tip. Sin E3B aún en ese commit. Sin merge.

## 2026-09-22 — E3B: Snapshot V3 y persistencia por workspaceId (mismo PR #16)

- Rama: `cursor/e3-forkza-core-boundaries-ac33` desde tip E3A `14d24ba`.
- Contrato actual: `schemaVersion: 3`; `WorldSnapshotV3.byWorkspace`; `WorkspaceSnapshotV3` / `WorkspaceSliceV3` con `workspaceId` canónico (`tenantId` alias; deben coincidir).
- `migrateV2toV3` + cadena `migrateToCurrent` (V0/V1/V2→V3; V3 idempotente). Validadores estrictos; corruptos/cruzados no se escriben; sellado solo en bootstrap/migración.
- Adaptadores JSON/localStorage, carga, escritura, runtime (`mundoRuntimeDesdeSnapshot`).
- Pruebas: `tests/e3b-snapshot-v3.test.js`; suite 197/197. Smoke bootstrap/V2→V3/JSON/localStorage/aislamiento/acme/corrupto OK.
- Docs: `00`, `01`, `02`, `04`, `05`. E3B pendiente de revisión. Sin E3C, sin RBAC masivo, sin Forja Training, sin merge.

## 2026-09-22 — E3B revisión B5–B8 (mismo PR #16)

- Rama: `cursor/e3-forkza-core-boundaries-ac33` desde tip E3B `f33f229`.
- B5: fábricas de dominio nacen con `workspaceId` + `tenantId`.
- B6: escritura runtime sin sellar; cruces → rechazo; entrada/destino intactos.
- B7: mundo/slice incompleto rechazado; sin `normalizarSlice` en escritura ordinaria.
- B8: migraciones exigen V3/V2/V1 válidos; incompletos → `PERSISTENCIA_CORRUPTA`.
- Pruebas: `tests/e3b-brechas-b5-b8.test.js`; suite 219/219 @ `894ad47`.
- E3B aceptada tras B5–B8 como base de E3C. Sin merge.

## 2026-09-22 — E3C: RBAC de rutas, aislamiento y auditoría (mismo PR #16)

- Rama: `cursor/e3-forkza-core-boundaries-ac33` desde base `894ad47`; tip `6f41240c1a21baa33effedaab655425acd6830bc`.
- `server/acceso.js` + cableado deny-by-default; catálogo permisos ampliado; `pagarDemo(tenantId, ref, fecha)` sin fallback global; `AuditSink` inyectable; `/api/me` con permisos/features; UI oculta según permisos; reset V3→runtime; store-local dinámico en standalone.
- Pruebas: `tests/e3c-rbac-rutas.test.js`; suite 242/242.
- Docs: `00`, `01`, `02`, `04`, `05`. E3C pendiente de revisión independiente. E3 no completa. Sin E4/E5/Forja/merge.
