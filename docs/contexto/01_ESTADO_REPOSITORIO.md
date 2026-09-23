# Estado verificado del repositorio

Fecha de corte: 2026-09-23.

## Repositorio y base

- Repositorio: `perrotbr-tech/Monkeys-WhatsApp-assistant`.
- `main` @ `85475bf` (Finanzas demo PR #21 fusionada; incluye Demo Forja PR #19 `a428313`, hotfix Pages PR #18 `2629fdc` y E3 `9fb3414`).
- E3 fusionada: PR #16 → `main` @ `9fb3414`; docs cierre PR #17 @ `f90ef2c`.
- E3A/E3B/E3C + B1–B10 aceptadas. **E4 y E5 no iniciados.**
- **Forja Training productivo no iniciado.** Existe solo demo estática de validación en `forja-demo/`.

## Pull requests

| PR | Estado | Notas |
|---|---|---|
| #12–#15 | Fusionados | E0–E2 en `main` |
| #16 | Fusionado | E3A + E3B + E3C + B1–B10 |
| #17 | Fusionado | Docs cierre E3 |
| #18 | Fusionado | Hotfix Pages: auth browser-safe |
| #19 | Fusionado | Demo Forja Training (coach Powerlifting) |
| #20 | Cerrado sin merge | Duplicado, sustituido por #21 |
| #21 | Fusionado | Demo Forja: módulo Finanzas para validación coach |

## Demo Forja Training (validación)

- Ubicación aislada: `forja-demo/` (entrada `forja-demo/index.html`).
- Persona: coach Matías Rojas, Powerlifting, workspace FORJA DEMO.
- Módulo **Finanzas** (demo): KPIs CLP, cargos/pagos, ficha, alertas, asistente con aprobación humana. Sin bancos ni pagos reales.
- No conectada a la navegación de Forkza Gestión.
- No altera Snapshot V3 ni MONKEYS/SOMA.
- Suite Node de la entrega Finanzas: 283/283; `git diff --check` limpio antes de fusionar.

## Documentos maestros

Vigentes. Persistencia Gestión = Snapshot V3. RBAC deny-by-default. Feature `forja: false` en producto.

## Restricción operativa

E3 cerrada. Demo Forja (incl. Finanzas) ≠ E4/E5 ni Forja productivo. E4 solo desde `main` actualizado, rama y PR propios.
