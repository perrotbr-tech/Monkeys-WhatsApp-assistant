# Riesgos, brechas y decisiones

## Prioridad alta

### Posible cruce de tenant en pagos demo

Las rutas públicas de pago pueden buscar la referencia en todos los tenants. Fuera de alcance E2; pendiente post-E2.

### Webhook de pagos

Sin verificación de firma, replay ni idempotencia. No listo para producción.

### Persistencia demo (E1B/E2)

Contrato V2 con migración y rechazo de corruptos. Sigue siendo demo: sin concurrencia multi-proceso, auditoría inmutable ni recuperación productiva. Postgres/Supabase fuera de alcance.

## Prioridad media

- Usuarios demo estáticos; sin aprovisionamiento real (E2 registra tenants por config, no usuarios productivos).
- Interfaz sin RBAC granular.
- Sin adaptador WhatsApp Cloud API aunque la salida respeta límites.
- Mercado Pago con contrato/adaptador, sin integración productiva segura.
- Escritura JSON de proceso único.
- Sin observabilidad, colas ni política de respaldo formal.
- UI (`app.js`) aún puede usar reloj de pared en timestamps visibles.

## Cerrado en E0–E2

- E0: línea base 68/68 (dependencia de fecha en chat).
- E1A: Clock determinístico.
- E1B: Store, snapshots V1, conformidad JSON/localStorage.
- PR #12 fusionado en `main` @ `cf24445`.
- E2: contrato de tenant, IDs estables de sede, registro dinámico, Snapshot V2, migración V1→V2.
- E2 B1–B4: validación semántica V2 de `sedeId`; edición de socios con resolución/rechazo; agentes con nombres visibles; filtros panel por ID estable.
- E2 B5: `WorldSnapshotV2.tenants` es fuente de verdad para validar `sedeId` (no el catálogo global).

## Decisiones confirmadas

- Nombre paraguas: FORKZA IA; módulos Forkza Gestión y Forja Training.
- Multi-tenant desde el núcleo; coach conserva control.
- MONKEYS/SOMA son configuración de tenant, no identidad global del producto.
- Snapshots: V1 histórico; V2 actual con `sedeId` estable. No se altera el significado de V1.
- En `WorldSnapshotV2`, el catálogo `tenants` persistido es la fuente de verdad para validar `sedeId`; el catálogo global solo respalda cuando no hay catálogo persistido (`TenantSnapshotV2`).
- Demo solo en vacío, reset explícito o migración de campo documentada.
- Motor y servidor no bifurcan por marca (`monkeys`/`soma`). Siguen existiendo literales en fixtures demo (`data/socios.js`, `data/membresias-demo.js`). La excepción de migración histórica es la clave legacy `monkeys_demo_state`.

## Decisiones aún abiertas

- Base de datos y proveedor de despliegue.
- Modelo final de RBAC y alcance por sede/equipo.
- `workspaceId` transversal (E3).
- Contrato Gestión ↔ Training; WhatsApp/pagos/archivos productivos.
- Alcance del primer MVP de Forja Training.

## Regla de interpretación

“Implementado” exige evidencia en código y prueba reproducible. “Diseñado” indica especificación sin implementación. “Objetivo” indica dirección aún no materializada.
