# Registro de actualizaciones del contexto (bloque vigente)

Continuación de `06_REGISTRO_ACTUALIZACIONES_HISTORICO.md` (entradas hasta E3B inclusive).

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

## 2026-09-22 — E3C: RBAC de rutas, aislamiento y auditoría (mismo PR #16)

- Rama: `cursor/e3-forkza-core-boundaries-ac33` desde base `894ad47`; tip previo `07336a5`.
- `server/acceso.js` + cableado deny-by-default; catálogo permisos ampliado; `pagarDemo(tenantId, ref, fecha)` sin fallback global; `AuditSink` inyectable; `/api/me` con permisos/features; UI oculta según permisos; store-local dinámico en standalone.
- Pruebas: `tests/e3c-rbac-rutas.test.js`; suite 242/242 en ese tip.

## 2026-09-23 — E3C revisión B9–B10 (mismo PR #16)

- B9: `POST /api/demo/reset` usa `hidratarTenant` + `clonarDemo(tid)`; no `adapter.reset()`/`clonarMundo()`; SOMA intacto al resetear MONKEYS (y viceversa); persistencia JSON OK.
- B10: `tienePermiso` deniega rol desconocido antes de permisos explícitos; `/api/me` no expone permisos desconocidos ni efectivos de rol inválido.
- Pruebas: `tests/e3c-brechas-b9-b10.test.js`; suite 250/250 @ `beecdcd`. Sin E4/E5/Forja/merge.

## 2026-09-23 — Cierre y fusión de E3

- Revisión independiente del tip `eeb3e658fc47440929ba4de5fd824add6a29f31d`: B9 reproducida con SOMA intacto tras reset MONKEYS; B10 reproducida con rol desconocido + permiso explícito → 403 y sin mutación.
- PR #16 marcado listo y fusionado por squash en `main` @ `9fb34147e75449aaef69a94d232b1f4ea2afee38`.
- Verificación posterior sobre `main`: `npm test` 250/250; `git diff --check` limpio; todos los archivos de contexto < 7.000 caracteres.
- E3 queda cerrada. E4, E5 y Forja Training no iniciados.

## 2026-09-23 — Hotfix: grafo browser-safe en demo Pages

- Rama: `cursor/hotfix-pages-standalone-auth` desde `main` @ `f90ef2c` (250/250 Node).
- Causa: Pages cargaba `store-local.js` → `auth.js` (`node:crypto`/`bcryptjs`) y barrel `persistencia/index.js` → `json.js`; `main()` abortaba antes del chat/login.
- Fix: `engine/auth-shared.js` (LOCK_MS, MAX_FALLOS, enriquecerUsuarioSesion); `store-local` importa solo shared + `persistencia/local|estados|migraciones`; `auth.js` reexporta shared y conserva crypto/bcrypt/sesión servidor.
- Prueba: `tests/browser-safe-imports.test.js` (grafo transitivo desde `app.js`/`store-local.js`). Suite 252/252.
- Fusionado: PR #18 → `main` @ `2629fdc`. Sin E4/E5/Forja productivo.

## 2026-09-23 — Demo web Forja Training (coach Powerlifting)

- Rama: `cursor/demo-coach-powerlifting` desde `main` @ `2629fdc` (252/252).
- Módulo estático aislado `forja-demo/` (HTML/CSS/JS modular, localStorage, sin backend/CDN/Node en navegador).
- Persona demo: Matías Rojas · Powerlifting · workspace FORJA DEMO; grupos Inicial/Competencia; alumnos ficticios.
- Pantallas: Inicio, Planificación, Sesión, Alumnos, Banco, Wellness, Registro, Seguimiento, Asistente FORJA.
- Prueba nueva: `tests/forja-demo-browser-safe.test.js` (grafo + no cruce con Gestión).
- Hechos: es demo de validación; no es Forja productivo; no inicia E4/E5; no cambia Snapshot V3; Gestión MONKEYS/SOMA intacta.
- Docs: `01`, `04`, `05`. Sin merge.

## 2026-09-23 — Corrección escala Test de Bienestar (demo Forja)

- Rama: `cursor/demo-coach-powerlifting` (PR #19). Contrato: **5 = mejor / 1 = peor** en fatiga, sueño, dolor muscular, estrés y ánimo.
- Alertas: dolor alto; cualquier dimensión = 1; dos o más ≤ 2. Valores 4–5 no alertan solos. Solo informa al coach.
- Semilla/IA: eliminada escala invertida (`fatiga 5/5`, `estrés 4/5`, `fatiga ≥4`).
- Pruebas: `tests/forja-demo-wellness-scale.test.js`. Sin E4/E5/Forja productivo/merge.

## 2026-09-23 — Demo Forja: módulo Finanzas (validación)

- Rama: `cursor/demo-forja-finanzas-cb40` desde `main` @ `a428313` (PR #19; base 265/265).
- Alcance solo `forja-demo/`: panel KPI CLP, tabla alumnos/pagos, ficha financiera, acciones demo (pago, link ficticio, comprobante), alertas, asistente con aprobación humana.
- Modelo: Plan → Cargo → Pago (+ medios, auditoría); IDs workspace/coach/alumno; aislamiento en tests con workspace/coach ALT.
- Persistencia: migración explícita estado v1→v2; corrupto sin auto-reset; clave `forja-demo-v1` (no Gestión).
- Pruebas: `tests/forja-demo-finanzas.test.js`. Sin pagos reales, sin bancos, sin E4/E5, sin Forja productivo, sin merge.
