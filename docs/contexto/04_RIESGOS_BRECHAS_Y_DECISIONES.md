# Riesgos, brechas y decisiones

## Prioridad alta

### Pruebas no deterministas

El caso “Crosstraining mañana” quedó determinista en E0 mediante `fechaRef` inyectado en el test. Persisten usos directos de reloj en salida de WhatsApp, creación de acciones y algunos códigos/fechas; E1 debe introducir `Clock` inyectable de forma sistemática.

### Posible cruce de tenant en pagos demo

Las rutas públicas de pago buscan primero en el tenant indicado y luego pueden buscar la referencia en todos los tenants. La acción de pagar también opera por referencia global. Si una referencia se conoce, esto podría permitir consultar o marcar un pago de otro tenant. Debe exigirse pertenencia al tenant o utilizar un token público opaco, firmado, de un solo ámbito.

### Webhook de pagos

La ruta de webhook no demuestra verificación de firma, protección contra repetición ni idempotencia. No debe considerarse lista para producción.

### Persistencia

El JSON local y `localStorage` sirven para demo, no para concurrencia, auditoría, recuperación ni aislamiento robusto de producción. La migración a almacenamiento transaccional requiere repositorios y migraciones.

## Prioridad media

- Los motores y usuarios demo se inicializan de manera estática para dos tenants; no hay aprovisionamiento real.
- La interfaz aún no deriva navegación y acciones de un RBAC granular.
- No existe adaptador WhatsApp Cloud API implementado aunque la salida respeta sus límites.
- No existe capa de canales declarada por la arquitectura objetivo.
- Mercado Pago tiene contrato/adaptador, pero falta integración productiva segura.
- La escritura JSON es síncrona y de proceso único.
- No hay observabilidad, auditoría inmutable, colas ni política de respaldo.
- PR #6 quedó cerrado sin fusión y sustituido por PR #8; sus cifras de pruebas obsoletas ya no son una brecha vigente.

## Decisiones confirmadas

- Nombre paraguas: FORKZA IA.
- Módulo operativo: Forkza Gestión.
- Módulo deportivo: Forja Training.
- Arquitectura multi-tenant desde el núcleo.
- Un usuario puede tener roles y vínculos distintos por organización/modalidad.
- El coach conserva control; la IA asiste, acelera y aprende patrones autorizados.
- El test de bienestar aplica a todas las modalidades.
- La planificación y el registro admiten campos comunes y específicos por modalidad.
- La implementación debe hacerse por etapas verificables, sin reemplazo total del prototipo.

## Decisiones aún abiertas

- Base de datos y proveedor de despliegue.
- Modelo final de RBAC y alcance por sede/equipo.
- Contrato de integración entre Gestión y Training.
- Política de consentimiento, retención y eliminación de datos sensibles.
- Estrategia real de WhatsApp, pagos y almacenamiento de archivos.
- Alcance exacto del primer MVP de Forja Training.
- Orden de consolidación o cierre de PR #4, #5, #7, #8 y #9.

## Regla de interpretación

“Implementado” exige evidencia en código y prueba reproducible. “Diseñado” indica especificación sin implementación. “Objetivo” indica dirección arquitectónica aún no materializada. Estas etiquetas no deben intercambiarse en instrucciones futuras.

