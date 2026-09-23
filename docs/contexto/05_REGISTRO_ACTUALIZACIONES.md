# Registro de actualizaciones del contexto (bloque vigente)

Continuación de `06_REGISTRO_ACTUALIZACIONES_HISTORICO.md` (entradas hasta E3C B9–B10).

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

## 2026-09-23 — Cierre y fusión de E3

- Revisión tip `eeb3e658`: B9 SOMA intacto tras reset MONKEYS; B10 rol desconocido → 403.
- PR #16 fusionado squash → `main` @ `9fb3414`. Suite 250/250. E4/E5/Forja no iniciados.

## 2026-09-23 — Hotfix: grafo browser-safe en demo Pages

- Rama: `cursor/hotfix-pages-standalone-auth` desde `main` @ `f90ef2c`.
- Fix: `engine/auth-shared.js`; store-local sin `node:crypto`/`bcryptjs`/barrel JSON.
- Suite 252/252. Fusionado PR #18 → `main` @ `2629fdc`.

## 2026-09-23 — Demo web Forja Training (coach Powerlifting)

- Rama: `cursor/demo-coach-powerlifting` desde `main` @ `2629fdc`.
- Módulo `forja-demo/` aislado; Matías Rojas · Powerlifting · FORJA DEMO.
- Prueba: `tests/forja-demo-browser-safe.test.js`. Fusionado PR #19 → `main` @ `a428313`.

## 2026-09-23 — Corrección escala Test de Bienestar (demo Forja)

- Incluido en PR #19. Contrato: **5 = mejor / 1 = peor**.
- Pruebas: `tests/forja-demo-wellness-scale.test.js`. Suite base `main`: 265/265.

## 2026-09-23 — Demo Forja: módulo Finanzas (ficticio)

- Rama: `cursor/demo-forja-finanzas-ee6e` desde `main` @ `a428313` (265/265).
- Alcance solo `forja-demo/`: planes → cargos → pagos, KPI CLP, filtros, ficha, alertas, auditoría, migración v1→v2, aislamiento workspace/coach/alumno.
- No es integración bancaria ni Mercado Pago; no procesa pagos reales; no es Forja productivo; no inicia E4/E5; Gestión/MONKEYS/SOMA sin cambios funcionales.
- Pruebas: `tests/forja-demo-finanzas.test.js`. Docs: `00`, `01`, `04`, `05`. Sin merge.
