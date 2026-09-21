# Registro de actualizaciones del contexto (bloque vigente)

Continuación de `06_REGISTRO_ACTUALIZACIONES_HISTORICO.md` (entradas 2026-09-19 a E1B).

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

## 2026-09-21 — Consolidación E0+E1

- Rama: `integration/forkza-e1-complete` desde E1B `5eaf8e2` (52 ahead / 0 behind de `main` `73dec39`).
- Incluye históricamente PR #4, #5, #7, #8, #9, #10 y #11; E0 `ffc52fd`, E1A `a306438`, E1B `5eaf8e2`.
- Pruebas: `npm ci` + `npm test` → 129/129; smoke API/tenants/persistencia/migración/Clock OK.
- Docs: `01`, `04`, `05`. Sin cambio funcional. E1 técnicamente completa; consolidación PR #12 (draft) pendiente de revisión/merge. E2 y Forja Training no iniciados; PR previos abiertos.

## 2026-09-21 — PR #12 fusionado; base E2

- `main` @ `cf24445bf738870ac8365207927a51dc2f0ccfa9` = merge PR #12.
- PR #4 fusionado por consolidación; #5 y #7–#11 cerrados como sustituidos; #6 cerrado previamente.
- E0 y E1 terminadas. Verificación: `npm ci` + `npm test` → 129/129.

## 2026-09-21 — E2: Identidad estable y tenant config

- Rama: `cursor/e2-identidad-tenant-config` desde `cf24445`.
- Contrato en `data/tenants.js` (menu, capacidades, sedes con id estable, aliasHistoricos, `registrarTenant`).
- Servidor/UI/conversación sin hardcode `.monkeys`/`.soma` ni `tid ===`; builders demo por registro.
- Persistencia: Snapshot V2 (`schemaVersion: 2`); `migrateV1toV2` (sedes → sedeId); V1 intacto como histórico.
- Pruebas: 129 previas + 10 E2 → 139/139.
- Literales: motor/servidor sin condicionales por marca; fixtures demo (`data/socios.js`, `data/membresias-demo.js`) aún bifurcan; excepción migración `clavesLegacyLocal` / `monkeys_demo_state`.
- E3 y Forja Training no iniciados.

## 2026-09-21 — E2 revisión B1–B4 (misma rama/PR #13)

- B1: `validarSliceV2` valida `sedeId` semántico (solo IDs estables) en clases, reservas, leads, conversaciones, socios, asistencias, acciones y acciones en campañas. V2 con nombre/desconocido → `CORRUPTO`, fuente intacta.
- B2: `editarSocio` resuelve alias histórico → ID; rechaza sede desconocida sin mutar.
- B3: agentes usan `nombreSede`/`etiquetaSedeSocio` para textos; match de clase por `sedeId`; Recordatorio recupera horario real.
- B4: filtro panel usa valor = ID estable / etiqueta = nombre; cupos/disciplina guardan `sedeId` estable; `hidratarTenant` normaliza sedes en escritura in-memory.
- Pruebas: `tests/e2-brechas-b1-b4.test.js`; suite 149/149.
- Sin merge; E3/Forja no iniciados.

## 2026-09-21 — E2 revisión B5 (misma rama/PR #13)

- `idsSedeConfigurados`: si hay `tenantsExtra` (WorldSnapshotV2), ese catálogo persistido manda; el global solo respalda sin catálogo persistido (TenantSnapshotV2).
- Corrige: sede nueva en snapshot aceptada; sede borrada del snapshot rechazada aunque siga en el global.
- Pruebas: `tests/e2-brechas-b5.test.js` (B5.1–B5.3); B5.4 = suite completa en verde.
- Precisión docs: motor/servidor sin bifurcar por marca; literales demo en `data/socios.js` y `data/membresias-demo.js`; legacy `monkeys_demo_state` en migración.
- Sin merge; E3/Forja no iniciados.

## 2026-09-21 — PR #13 fusionado; E2 cerrada

- PR #13 marcado listo y fusionado mediante squash en `main`.
- `main` @ `0e20df0e7382ed373c65a2f506540a2e3f7a24d7` contiene E2 y revisiones B1–B5.
- Verificación previa al merge: `npm ci` + `npm test` → 152/152; `git diff --check` limpio; contexto bajo 7.000 caracteres.
- E0, E1 y E2 terminadas. E3 y Forja Training no iniciados.

## 2026-09-21 — PR #14/#15 docs post-E2

- #14: cierre documental E2 tras merge. #15: precisa base funcional E2.
- `main` @ `4504c9b99eca9614f241f29276e806604a607f2e`. Sin PR abiertos. 152/152.

## 2026-09-21 — E3A: contratos Forkza Core y fronteras

- Rama: `cursor/e3-forkza-core-boundaries-ac33` desde `main` @ `4504c9b`.
- Nuevo `core/` ESM: identity, organizations (puente tenantId→workspaceId), authorization (RBAC deny-by-default), features (`gestion:true`/`forja:false`), contracts/acción, audit (AuditSink memoria).
- Adaptadores: sesión/`GET /api/me` aditivos (`userId`,`workspaceId`); `baseAccion`/`crearAccion` con metadatos; features en tenants.
- Sin Snapshot V3, sin migración masiva, sin RBAC en todas las rutas, sin Forja UI.
- Pruebas: 152 previas + E3A (`tests/e3a-core-boundaries.test.js`, incl. dependencias Core) → suite en verde.
- E3 iniciada; E3A lista en PR draft de E3. E3B/E3C/Forja no iniciados. Sin merge.
