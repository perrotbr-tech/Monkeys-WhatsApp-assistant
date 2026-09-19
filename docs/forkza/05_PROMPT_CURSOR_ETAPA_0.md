# Prompt para Cursor — Ejecutar solamente Etapa 0

Lee completamente los archivos numerados `00` a `04` ubicados en la documentación del repositorio.

Ejecuta exclusivamente la **Etapa E0 — Consolidación y línea base** definida en `04_PLAN_EJECUCION_POR_ETAPAS.md`.

## Objetivo

Preparar una rama de integración segura desde `cursor/socios-pagos-7236`, comprobar que contiene `cursor/multi-gimnasio-soma-dd14` y dejar la suite completa en verde antes de cualquier migración, renombre o implementación de Forja.

## Instrucciones obligatorias

1. Verifica el estado remoto y registra commits exactos de `main`, PR #4 y PR #5.
2. Comprueba mediante Git que la rama de PR #4 es ancestro de PR #5.
3. No fusiones PR #4 por separado.
4. Crea una rama nueva desde PR #5 con nombre `integration/forkza-core-baseline` o informa antes si ya existe.
5. Ejecuta la suite completa sin modificar código y registra el resultado inicial.
6. Investiga las dos fallas conocidas:
   - `tests/auth.test.js`;
   - `crosstraining mañana no repregunta día ni disciplina`.
7. Corrige sus causas con el cambio mínimo y técnicamente correcto.
8. Para tiempo y fechas, usa inyección o fixture determinístico; no reemplaces la falla con otra fecha escrita manualmente.
9. No reduzcas validaciones de autenticación.
10. No cambies expectativas únicamente para obtener verde.
11. Ejecuta nuevamente todas las pruebas.
12. No cambies marca, repositorio, carpetas, persistencia ni funcionalidades.
13. No implementes Forja Training.
14. No hagas merge a `main`.

## Entregables

- rama de integración creada;
- causas raíz de ambas fallas;
- cambios mínimos aplicados;
- suite completa 63/63 o explicación precisa del bloqueo;
- lista de archivos modificados;
- evidencia de que MONKEYS demo conserva sus flujos;
- instrucciones de reversión;
- recomendación para E1, sin ejecutarla.

## Punto de detención

Cuando E0 termine, detente y espera aprobación humana. No continúes con E1 aunque todas las pruebas estén en verde.

