# Riesgos, brechas y decisiones

## Prioridad alta

### Pruebas no deterministas (cerrado en E1A; E1B usa Clock fijo)

E1A introdujo `engine/clock.js` y lo cableó en dominio/auth/server. E1B usa exclusivamente ese Clock en adaptadores y en la suite de conformidad. Persisten `new Date(...)` justificados en parseo de calendario y restas ISO. Timestamps de UI en `app.js` siguen fuera de alcance.

### Posible cruce de tenant en pagos demo

Las rutas públicas de pago pueden buscar la referencia en todos los tenants. Si una referencia se conoce, podría consultarse o marcarse un pago de otro tenant. Fuera de alcance E1; pendiente post-consolidación.

### Webhook de pagos

Sin verificación de firma, replay ni idempotencia. No listo para producción.

### Persistencia (E1B implementada; todavía no productiva)

Contrato versionado JSON/localStorage con migración V0→V1, escritura atómica y rechazo de corruptos. Sigue siendo demo: sin concurrencia multi-proceso, auditoría inmutable ni recuperación productiva. Postgres/Supabase fuera de alcance.

## Prioridad media

- Motores y usuarios demo estáticos para dos tenants; sin aprovisionamiento real.
- Interfaz sin RBAC granular.
- Sin adaptador WhatsApp Cloud API aunque la salida respeta límites.
- Mercado Pago con contrato/adaptador, sin integración productiva segura.
- Escritura JSON de proceso único.
- Sin observabilidad, colas ni política de respaldo formal.

## Decisiones confirmadas

- Nombre paraguas: FORKZA IA; módulos Forkza Gestión y Forja Training.
- Multi-tenant desde el núcleo; coach conserva control.
- Implementación por etapas verificables.
- E1A Clock y E1B Store aprobadas; E1 técnicamente completa en `integration/forkza-e1-complete` (129/129); consolidación pendiente de revisión y merge hacia `main`.
- Snapshots estrictos: `WorldSnapshotV1` (`schemaVersion`, `tenants`, `byTenant`) y `TenantSnapshotV1` (`schemaVersion`, `tenantId`, `data`); sin opcionales ambiguos.
- Demo solo en vacío, reset explícito o migración de campo documentada.
- SliceV1 estricto en carga y escritura simétrica: V1 incompleto o con identidad cruzada → error/corrupto sin sanitizar ni sobrescribir.
- Consolidación E0–E1 en PR #12 (`integration/forkza-e1-complete` → `main`, draft) desde el tip E1B; no fusionar PR apilados (#4–#11) por separado. E2 y Forja Training no iniciados.

## Decisiones aún abiertas

- Base de datos y proveedor de despliegue.
- Modelo final de RBAC y alcance por sede/equipo.
- Contrato Gestión ↔ Training; WhatsApp/pagos/archivos productivos.
- Alcance del primer MVP de Forja Training.
- Momento de cierre/sustitución formal de los PR apilados tras merge del consolidado.

## Regla de interpretación

“Implementado” exige evidencia en código y prueba reproducible. “Diseñado” indica especificación sin implementación. “Objetivo” indica dirección aún no materializada.
