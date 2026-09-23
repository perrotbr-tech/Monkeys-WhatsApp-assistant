# Registro histórico de actualizaciones (bloque 06)

Entradas anteriores a E3A. Continuación vigente en `05_REGISTRO_ACTUALIZACIONES.md`.

## 2026-09-19 — Auditoría inicial

- Repositorio: `perrotbr-tech/Monkeys-WhatsApp-assistant`.
- Rama auditada: `cursor/socios-pagos-7236` @ `b03fd73`.
- Verificación: `npm test` = 67/68 (falla dependiente de fecha).
- Conclusión: PR #5 base funcional más avanzada; PR #6 docs paralelas.

## 2026-09-19 — Consolidación del maestro v2

- Rama/PR: `docs/maestro-forkza-v2`, PR #8.
- PR #6 cerrado sin fusión (sustituido). Cadena: PR #5 → #7 → #8.

## 2026-09-20 — Corrección de base para E0

- E0 parte del HEAD de `docs/maestro-forkza-v2` → `integration/forkza-core-baseline`.

## 2026-09-20 — E0 cerrada: línea base 68/68

- Fix: `tests/tenant-isolation.test.js` (inyección `fechaRef`).
- `npm test` → 68/68.

## 2026-09-20 — Limpieza documental posterior a E0

- PR #9; solo docs (`01`, `04`, `05`).

## 2026-09-20 — E1A: Clock determinístico

- Rama: `cursor/e1a-clock-deterministico-fb93` (PR #10).
- `engine/clock.js`; `npm test` → 75/75.

## 2026-09-21 — E1B: Store y persistencia

- Rama: `cursor/e1b-store-persistencia-f516` (PR #11).
- Snapshots V1, migración V0→V1, adaptadores; 111→120→129/129 tras fixes B1–B4.

## 2026-09-21 — Consolidación E0+E1

- Rama: `integration/forkza-e1-complete` desde E1B `5eaf8e2`.
- Pruebas: 129/129. E1 completa; consolidación PR #12.

## 2026-09-21 — PR #12 fusionado; base E2

- `main` @ `cf24445` = merge PR #12. E0 y E1 terminadas. 129/129.

## 2026-09-21 — E2: Identidad estable y tenant config

- Rama: `cursor/e2-identidad-tenant-config`. Snapshot V2; sedes estables; 139/139.

## 2026-09-21 — E2 revisiones B1–B5 y cierre

- B1–B4: `sedeId` semántico; B5: catálogo persistido manda. PR #13 squash → `main` @ `0e20df0` (152/152).
- PR #14/#15 docs; `main` @ `4504c9b`.

## Entradas E3A–E3B (movidas desde 05 por límite 7.000)

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
