# Riesgos, brechas y decisiones

## Prioridad alta

### Demo GitHub Pages (hotfix fusionado)

PR #18 fusionado en `main` @ `2629fdc`: `auth-shared.js` (browser) separado de `auth.js` (servidor); standalone no arrastra `node:crypto`/`bcryptjs` ni el barrel `persistencia/index.js`. Suite Node 252/252 en esa base. Despliegue público de Pages depende del hosting.

### Demo Forja Training (solo validación)

`forja-demo/` es un prototipo estático para entrevistar a un coach de Powerlifting. **No es Forja Training productivo**, no inicia E4/E5, no cambia Snapshot V3 ni el feature flag `forja`. Riesgo: confundir la demo con implementación completa; documentar siempre como validación con datos ficticios. Escala de bienestar: **5 = mejor / 1 = peor** (corregida en PR #19).

### Webhook de pagos

Sin verificación de firma, replay ni idempotencia. No listo para producción (E5).

### Persistencia demo (E1B–E3B)

Contrato V3 con migración V0–V2→V3 y rechazo de corruptos/cruzados. Sigue siendo demo: sin concurrencia multi-proceso, auditoría inmutable ni recuperación productiva. Postgres/Supabase fuera de alcance. AuditSink E3C en memoria inyectable; no persiste en snapshots (Snapshot V4 fuera de alcance).

## Prioridad media

- Usuarios demo estáticos ampliados (dueño, recepción, ventas, coach, alumno en MONKEYS); sin tablas productivas de memberships.
- Runtime aún proyecta `byTenant` desde `byWorkspace`; consumidores legacy no renombrados de golpe.
- Sin adaptador WhatsApp Cloud API aunque la salida respeta límites.
- Mercado Pago con contrato/adaptador, sin integración productiva segura.
- Escritura JSON de proceso único.
- Sin observabilidad, colas ni política de respaldo formal.
- UI (`app.js`) aún puede usar reloj de pared en timestamps visibles.
- Acciones históricas seed: tras V3 llevan `workspaceId`; no se inventan actor/destinatario/origen ausentes.

## Cerrado en E0–E3C

- E0–E2 en `main` (PR #12–#15).
- E3A cerrada en `14d24ba` (PR #16): `core/` + adaptadores; B1–B4.
- E3B aceptada tras B5–B8: Snapshot V3 + escritura sin sellar/normalizar.
- E3C (PR #16): RBAC deny-by-default; pagos demo/webhook sin cruce; auditoría; `/api/me` permisos/features; UI oculta.
- E3C B9–B10: reset solo del workspace solicitado; rol desconocido → 403 aunque traiga permisos explícitos.
- Brecha pagos cross-tenant demo: cerrada en E3C (sin fallback global).
- Brecha reset cross-tenant: cerrada en B9.
- E3 verificada con 250/250 pruebas y fusionada por PR #16 en `main` @ `9fb3414`.

## Decisiones confirmadas

- Nombre paraguas: FORKZA IA; módulos Forkza Gestión y Forja Training.
- Multi-tenant desde el núcleo; coach conserva control.
- MONKEYS/SOMA son configuración, no identidad global; `workspaceId === tenantId` en esta migración.
- Snapshots: V1/V2 históricos; **V3 actual** (`byWorkspace`). `tenantId` alias compatible; si ambos existen deben coincidir.
- `sellarWorkspaceEnSlice` / `normalizarSlice` solo en bootstrap y migraciones documentadas; nunca en escritura runtime.
- Catálogo de workspaces inyectable; Core sin marcas hardcodeadas; `acme` vía registro dinámico.
- `userId` identifica al usuario; workspace/rol/permisos son contexto de pertenencia.
- Features: `gestion: true`, `forja: false`. Feature desconocido = deshabilitado.
- Acciones nuevas: `origenDominio: gestion`; mensaje → `socio`; tarea → `equipo`.
- Demo solo en vacío, reset explícito o migración documentada. V3/V2/V1 declarados incompletos no se rellenan en silencio.
- RBAC: propietario/admin = Gestión completa; recepción sin config/automatización/pagos escribir; ventas lee pagos; entrenador lee reservas/socios; alumno sin Gestión interna.

## Decisiones aún abiertas / pendientes

- Renombre masivo de APIs/params `tenantId` → `workspaceId`.
- Base de datos y proveedor de despliegue.
- Contrato Gestión ↔ Training; WhatsApp/pagos/archivos productivos.
- Alcance del primer MVP de Forja Training (la demo `forja-demo/` no cierra ese alcance).
- Si la demo de validación se acepta, cuándo y cómo iniciar el esqueleto productivo (E6 del plan), sin mezclarlo con E4/E5 de Gestión.
- Firma real Mercado Pago, idempotencia y Snapshot V4 (E5 / fuera de E3).

## Regla de interpretación

“Implementado” exige evidencia en código y prueba reproducible. “Diseñado” indica especificación sin implementación. “Objetivo” indica dirección aún no materializada.
