# Registro de actualizaciones del contexto

## 2026-09-19 — Auditoría inicial

- Repositorio: `perrotbr-tech/Monkeys-WhatsApp-assistant`.
- Rama auditada: `cursor/socios-pagos-7236`.
- Commit: `b03fd73db94589431209cf9a68f95e08f58a631d`.
- Fuentes: árbol completo, historial y diferencias con `main`; código, configuración, reglas Cursor, pruebas y seis documentos de PR #6.
- Verificación: `npm ci` completado; `npm test` = 67 aprobadas, 1 fallida, 68 totales.
- Cambio de comprensión: autenticación ya no falla; permanece un único test dependiente de fecha. Las cifras 61/63 y 63/63 de los documentos son históricas.
- Conclusión: PR #5 es la base funcional más avanzada. PR #6 es documentación paralela basada en `main` y debe integrarse/actualizarse sobre la base funcional antes de ejecutar etapas.

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

## 2026-09-19 — Consolidación del maestro v2

- Rama y PR: `docs/maestro-forkza-v2`, PR #8, basada en PR #7.
- Fuentes: seis documentos maestros de PR #6 y contexto auditado de PR #7.
- Cambios: cifras actualizadas a 67/68; autenticación confirmada en verde; E0 exige 68/68; Forja Training etiquetado como diseño no implementado.
- Decisión: PR #6 se cerró sin fusión por quedar sustituido. La cadena vigente es PR #5 → PR #7 → PR #8.
- Impacto: Cursor debe leer primero `docs/contexto/`, después `docs/forkza/`, y ejecutar únicamente la etapa expresamente autorizada.

## 2026-09-20 — Corrección de base para E0

- Fuente: revisión cruzada del prompt E0 con la cadena PR #5 → PR #7 → PR #8.
- Hallazgo: crear E0 directamente desde PR #5 excluiría el contexto vivo y el maestro actualizado.
- Corrección: E0 debe partir del HEAD de `docs/maestro-forkza-v2` y crear desde allí `integration/forkza-core-baseline`.
- Alcance: solo documentación; ninguna funcionalidad fue modificada.

## 2026-09-20 — E0 cerrada: línea base 68/68

- Rama y commit origen: `docs/maestro-forkza-v2` @ `062b0f0`.
- Rama de integración: `integration/forkza-core-baseline`.
- Ancestros verificados: PR #4 (`f721818`) ⊂ PR #5 (`b03fd73`) ⊂ `docs/maestro-forkza-v2`.
- Archivo modificado: `tests/tenant-isolation.test.js` (inyección de `fechaRef`).
- Pruebas: `npm test` → 68/68; `tests/auth.test.js` → 6/6.
- Hechos: la falla de “crosstraining mañana” era dependencia del reloj, no defecto del motor.
- Decisión: E0 lista para revisión humana; no ejecutar E1 sin aprobación.

## 2026-09-20 — Limpieza documental posterior a E0

- Rama: `integration/forkza-core-baseline` (PR #9).
- Archivos: `01_ESTADO_REPOSITORIO.md`, `04_RIESGOS_BRECHAS_Y_DECISIONES.md`, `05_REGISTRO_ACTUALIZACIONES.md`.
- Hechos: se actualizaron referencias de PR (incluye #9 abierto con cierre E0 y 68/68); PR #6 marcado como cerrado sin fusión y sustituido por #8; decisión pendiente de consolidación actualizada a PR #4, #5, #7, #8 y #9.
- Alcance: solo documentación; ningún cambio funcional.

## 2026-09-20 — E1A: Clock determinístico

- Rama base: `integration/forkza-core-baseline` @ `ffc52fdd2dd64930090be9f0017220f5e4406608`.
- Rama de trabajo: `cursor/e1a-clock-deterministico-fb93` (PR #10).
- Archivos: `engine/clock.js` (nuevo); cableado en `dates`, `auth`, `conversation`, `automation`, `store`, `store-local`, `whatsapp-out`, `server/index.js`; pruebas en `tests/clock.test.js` y fixtures fijos en automation/dates/tenant-isolation/store-local.
- Pruebas: `npm test` → 75/75 (68 previas + 7 nuevas); `git diff --check` limpio.
- Hechos: producción usa reloj sistema por defecto; tests inyectan fijo/simulado; bloqueos auth sin `Date.now` real; zona tenant conservada.
- Decisión: E1A lista para revisión; E1B (Store) no iniciada; sin merge.

## 2026-09-21 — E1B: Contrato Store, snapshots y persistencia

- Rama base: `cursor/e1a-clock-deterministico-fb93` @ `a30643859c888e4dfdae8bb9fbde54b71b3e8034` (81/81).
- Rama de trabajo: `cursor/e1b-store-persistencia-f516` (PR #11) → base E1A.
- Archivos: `engine/persistencia/*` (contrato, snapshots V1, migraciones, adaptadores JSON/localStorage); cableado en `store-local.js`, `server/index.js`, `automation.js`, `store.js`, `conversation.js`; suite `tests/store-conformidad.test.js` (C01–C17); docs `01`, `02`, `04`, `05`.
- Pruebas: `npm ci` + `npm test` → 111/111; `git diff --check` limpio.
- Hechos: vacío→bootstrap V1; V0→migrateV0toV1; V1→carga; corrupto→error sin sobrescribir; sin heurísticas destructivas; Clock E1A en conformidad.
- Decisión: E1B implementada y pendiente de revisión; E1 no completa; sin merge ni E2.

## 2026-09-21 — E1B fix: integridad V1 y coherencia de tenant

- Rama: `cursor/e1b-store-persistencia-f516` (PR #11).
- Brechas: B1 (envelope/clave/slice con tenant cruzado aceptado); B2 (V1 incompleto aceptado y rellenado por `normalizarSlice`).
- Archivos: `engine/persistencia/snapshots.js` (`validarSliceV1`, `coherenciaTenantIds`); `cargar.js`; `local.js` (`assertTenantEscritura`); pruebas de regresión en `tests/store-conformidad.test.js`.
- Pruebas: `npm ci` + `npm test` → 120/120; `git diff --check` limpio.
- Hechos: V1 inválido → `corrupt` sin escritura; `socios: []` válido; V0 sigue migrando; `guardarTenant` rechaza cruce.
- Decisión: E1B corregida en el mismo PR; E1 no completa; sin merge ni E2.

## 2026-09-21 — E1B fix: escritura sin sanitizar (B3/B4)

- Rama: `cursor/e1b-store-persistencia-f516` (PR #11).
- Brechas: B3 (`guardar(world)` normalizaba `tenantId` cruzado); B4 (`guardarTenant` trataba V1 sin `data` como slice plano).
- Archivos: `engine/persistencia/escritura.js`; `json.js`; `local.js`; regresión en `tests/store-conformidad.test.js`.
- Pruebas: `npm ci` + `npm test` → 129/129; `git diff --check` limpio.
- Hechos: validar original antes de persistir; V1 inválido no se completa; storage/archivo intactos ante error.
- Decisión: E1B escritura alineada con carga; E1 no completa; sin merge ni E2.
