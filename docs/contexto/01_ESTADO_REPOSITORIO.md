# Estado verificado del repositorio

Fecha de corte: 2026-09-23.

## Repositorio y base

- Repositorio: `perrotbr-tech/Monkeys-WhatsApp-assistant`.
- `main` @ `2629fdc` (hotfix GitHub Pages PR #18 fusionado; tip sobre cierre E3).
- E3 fusionada: PR #16 → `main` @ `9fb3414`; docs cierre PR #17 @ `f90ef2c`.
- E3A/E3B/E3C + B1–B10 aceptadas. **E4 y E5 no iniciados.**
- **Forja Training productivo no iniciado.** Existe solo demo estática de validación.

## Pull requests

| PR | Estado | Notas |
|---|---|---|
| #12–#15 | Fusionados | E0–E2 en `main` |
| #16 | Fusionado | E3A + E3B + E3C + B1–B10 |
| #17 | Fusionado | Docs cierre E3 |
| #18 | Fusionado | Hotfix Pages: auth browser-safe |
| demo Forja | Draft | `cursor/demo-coach-powerlifting` → `main` |

## Demo Forja Training (validación)

- Ubicación aislada: `forja-demo/` (entrada `forja-demo/index.html`).
- Persona: coach Matías Rojas, Powerlifting, workspace FORJA DEMO.
- No conectada a la navegación de Forkza Gestión.
- No altera Snapshot V3 ni MONKEYS/SOMA.
- Suite Node base `main`: 252/252; la rama demo agrega pruebas de grafo browser-safe.

## Documentos maestros

Vigentes. Persistencia Gestión = Snapshot V3. RBAC deny-by-default. Feature `forja: false` en producto.

## Restricción operativa

E3 cerrada. Demo Forja ≠ E4/E5 ni Forja productivo. E4 solo desde `main` actualizado, rama y PR propios.
