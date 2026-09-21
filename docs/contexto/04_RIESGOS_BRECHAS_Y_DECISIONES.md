# Riesgos, brechas y decisiones

## Prioridad alta

### Posible cruce de tenant en pagos demo

Las rutas públicas de pago pueden buscar la referencia en todos los tenants. Fuera de alcance E3A; pendiente post-E3.

### Webhook de pagos

Sin verificación de firma, replay ni idempotencia. No listo para producción.

### Persistencia demo (E1B/E2)

Contrato V2 con migración y rechazo de corruptos. Sigue siendo demo: sin concurrencia multi-proceso, auditoría inmutable ni recuperación productiva. Postgres/Supabase fuera de alcance. AuditSink existe en Core (E3A) solo en memoria de prueba; no persiste en snapshots.

## Prioridad media

- Usuarios demo estáticos; `userId` estable en E3A, sin aprovisionamiento real.
- RBAC contractual listo; no aplicado aún a todas las rutas (E3C).
- Sin adaptador WhatsApp Cloud API aunque la salida respeta límites.
- Mercado Pago con contrato/adaptador, sin integración productiva segura.
- Escritura JSON de proceso único.
- Sin observabilidad, colas ni política de respaldo formal.
- UI (`app.js`) aún puede usar reloj de pared en timestamps visibles.
- Acciones históricas seed en demo pueden carecer de metadatos E3A hasta regeneración/ciclo; acciones nuevas de agentes y `crearAccion` sí los llevan.

## Cerrado en E0–E3A

- E0–E2: Clock, Store, Snapshot V2, identidad de tenant/sede, PR #12–#15 en `main`.
- E3A: `core/` (identidad, workspace, RBAC, features, contrato de acciones, AuditSink memoria); puente `tenantId→workspaceId`; sesión aditiva; prueba de dependencias de Core.

## Decisiones confirmadas

- Nombre paraguas: FORKZA IA; módulos Forkza Gestión y Forja Training.
- Multi-tenant desde el núcleo; coach conserva control.
- MONKEYS/SOMA son configuración, no identidad global.
- Snapshots: V1 histórico; V2 actual. E3A no altera V1/V2 ni crea V3.
- Durante E3: `workspaceId` = espacio de trabajo; para MONKEYS/SOMA `workspaceId === tenantId`; `tenantId` alias compatible hasta E3B. Sin reemplazo masivo de referencias.
- Features: `gestion: true`, `forja: false` en ambos workspaces demo. Feature desconocido = deshabilitado.
- Acciones: `origenDominio: gestion`; mensaje → `destinatarioRol: socio`; tarea → `equipo`. Sin reparación silenciosa de inválidas.
- Demo solo en vacío, reset explícito o migración documentada.
- Motor/servidor no bifurcan por marca; literales demo en fixtures; legacy `monkeys_demo_state`.

## Decisiones aún abiertas / pendientes E3

- E3B: migración masiva / Snapshot V3 con `workspaceId` en entidades persistidas.
- E3C: RBAC en todas las rutas servidor.
- Base de datos y proveedor de despliegue.
- Contrato Gestión ↔ Training; WhatsApp/pagos/archivos productivos.
- Alcance del primer MVP de Forja Training.

## Regla de interpretación

“Implementado” exige evidencia en código y prueba reproducible. “Diseñado” indica especificación sin implementación. “Objetivo” indica dirección aún no materializada.
