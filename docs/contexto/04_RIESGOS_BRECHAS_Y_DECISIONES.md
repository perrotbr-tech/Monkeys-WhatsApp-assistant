# Riesgos, brechas y decisiones

## Prioridad alta

### Posible cruce de tenant en pagos demo

Las rutas públicas de pago pueden buscar la referencia en todos los tenants. Fuera de alcance E3B; pendiente post-E3 / E3C.

### Webhook de pagos

Sin verificación de firma, replay ni idempotencia. No listo para producción.

### Persistencia demo (E1B–E3B)

Contrato V3 con migración V0–V2→V3 y rechazo de corruptos/cruzados. Sigue siendo demo: sin concurrencia multi-proceso, auditoría inmutable ni recuperación productiva. Postgres/Supabase fuera de alcance. AuditSink en Core solo en memoria de prueba; no persiste en snapshots.

## Prioridad media

- Usuarios demo estáticos; `userId` estable por correo; sin tablas productivas de memberships.
- RBAC contractual listo; no aplicado aún a todas las rutas (E3C).
- Runtime aún proyecta `byTenant` desde `byWorkspace`; consumidores legacy no renombrados de golpe.
- Sin adaptador WhatsApp Cloud API aunque la salida respeta límites.
- Mercado Pago con contrato/adaptador, sin integración productiva segura.
- Escritura JSON de proceso único.
- Sin observabilidad, colas ni política de respaldo formal.
- UI (`app.js`) aún puede usar reloj de pared en timestamps visibles.
- Acciones históricas seed: tras V3 llevan `workspaceId`; no se inventan actor/destinatario/origen ausentes. Acciones nuevas cumplen E3A completo.

## Cerrado en E0–E3B (parcial)

- E0–E2 en `main` (PR #12–#15).
- E3A cerrada en `14d24ba` (PR #16): `core/` + adaptadores; B1–B4.
- E3B implementada en PR #16 (pendiente revisión): Snapshot V3, `workspaceId` canónico, `migrateV2toV3`, validadores estrictos, adaptadores JSON/localStorage.

## Decisiones confirmadas

- Nombre paraguas: FORKZA IA; módulos Forkza Gestión y Forja Training.
- Multi-tenant desde el núcleo; coach conserva control.
- MONKEYS/SOMA son configuración, no identidad global; `workspaceId === tenantId` en esta migración.
- Snapshots: V1/V2 históricos; **V3 actual** (`byWorkspace`). `tenantId` alias compatible; si ambos existen deben coincidir.
- Catálogo de workspaces inyectable; Core sin marcas hardcodeadas; `acme` vía registro dinámico.
- `userId` identifica al usuario; workspace/rol/permisos son contexto de pertenencia.
- Features: `gestion: true`, `forja: false`. Feature desconocido = deshabilitado.
- Acciones nuevas: `origenDominio: gestion`; mensaje → `socio`; tarea → `equipo`.
- Demo solo en vacío, reset explícito o migración documentada. V3 declarado incompleto no se rellena en silencio.

## Decisiones aún abiertas / pendientes

- E3C: RBAC en todas las rutas servidor.
- Renombre masivo de APIs/params `tenantId` → `workspaceId` (solo aliases en E3B).
- Base de datos y proveedor de despliegue.
- Contrato Gestión ↔ Training; WhatsApp/pagos/archivos productivos.
- Alcance del primer MVP de Forja Training.

## Regla de interpretación

“Implementado” exige evidencia en código y prueba reproducible. “Diseñado” indica especificación sin implementación. “Objetivo” indica dirección aún no materializada.
