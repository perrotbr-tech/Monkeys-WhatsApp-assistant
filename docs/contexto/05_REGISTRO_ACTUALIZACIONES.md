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
- Rama de trabajo: `cursor/e1a-clock-deterministico-fb93`.
- Archivos: `engine/clock.js` (nuevo); cableado en `dates`, `auth`, `conversation`, `automation`, `store`, `store-local`, `whatsapp-out`, `server/index.js`; pruebas en `tests/clock.test.js` y fixtures fijos en automation/dates/tenant-isolation/store-local.
- Pruebas: `npm test` → 75/75 (68 previas + 7 nuevas); `git diff --check` limpio.
- Hechos: producción usa reloj sistema por defecto; tests inyectan fijo/simulado; bloqueos auth sin `Date.now` real; zona tenant conservada.
- Decisión: E1A lista para revisión; E1B (Store) no iniciada; sin merge.
