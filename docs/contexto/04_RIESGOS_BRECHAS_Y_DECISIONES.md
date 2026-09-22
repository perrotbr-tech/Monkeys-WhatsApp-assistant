# Riesgos, brechas y decisiones

## Prioridad alta

### Posible cruce de tenant en pagos demo

Las rutas públicas de pago pueden buscar la referencia en todos los tenants. Fuera de alcance E3A; pendiente post-E3.

### Webhook de pagos

Sin verificación de firma, replay ni idempotencia. No listo para producción.

### Persistencia demo (E1B/E2)

Contrato V2 con migración y rechazo de corruptos. Sigue siendo demo: sin concurrencia multi-proceso, auditoría inmutable ni recuperación productiva. Postgres/Supabase fuera de alcance. AuditSink existe en Core (E3A) solo en memoria de prueba; no persiste en snapshots.

## Prioridad media

- Usuarios demo estáticos; `userId` estable por correo (no por workspace); sin tablas productivas de memberships.
- RBAC contractual listo; no aplicado aún a todas las rutas (E3C).
- Sin adaptador WhatsApp Cloud API aunque la salida respeta límites.
- Mercado Pago con contrato/adaptador, sin integración productiva segura.
- Escritura JSON de proceso único.
- Sin observabilidad, colas ni política de respaldo formal.
- UI (`app.js`) aún puede usar reloj de pared en timestamps visibles.
- Acciones históricas seed en demo pueden carecer de metadatos E3A hasta regeneración/ciclo; acciones nuevas de agentes y `crearAccion` sí los llevan.

## Cerrado en E0–E3A (parcial)

- E0–E2 en `main` (PR #12–#15).
- E3A en PR #16: `core/` + adaptadores; revisión B1–B4 (coherencia IDs, catálogo inyectable, `userId` global). E3A no declarada cerrada hasta aceptación de revisión.

## Decisiones confirmadas

- Nombre paraguas: FORKZA IA; módulos Forkza Gestión y Forja Training.
- Multi-tenant desde el núcleo; coach conserva control.
- MONKEYS/SOMA son configuración, no identidad global.
- Snapshots: V1 histórico; V2 actual. E3A no altera V1/V2 ni crea V3.
- Durante E3: `workspaceId` = espacio de trabajo; puente E3A exige `workspaceId === tenantId` si ambos llegan; `tenantId` alias hasta E3B.
- Catálogo de workspaces inyectable desde config activa (`registrarTenant` alimenta IDs); Core sin marcas hardcodeadas.
- `userId` identifica al usuario; workspace/rol/permisos son contexto de pertenencia.
- Features: `gestion: true`, `forja: false`. Feature desconocido = deshabilitado.
- Acciones: `origenDominio: gestion`; mensaje → `socio`; tarea → `equipo`. Sin reparación silenciosa.
- Demo solo en vacío, reset explícito o migración documentada.

## Decisiones aún abiertas / pendientes E3

- E3B: migración masiva / Snapshot V3 con `workspaceId` en entidades persistidas.
- E3C: RBAC en todas las rutas servidor.
- Base de datos y proveedor de despliegue.
- Contrato Gestión ↔ Training; WhatsApp/pagos/archivos productivos.
- Alcance del primer MVP de Forja Training.

## Regla de interpretación

“Implementado” exige evidencia en código y prueba reproducible. “Diseñado” indica especificación sin implementación. “Objetivo” indica dirección aún no materializada.
