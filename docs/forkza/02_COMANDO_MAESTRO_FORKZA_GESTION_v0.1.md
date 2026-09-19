# Forkza Gestión — Comando maestro funcional

**Versión:** 0.1  
**Fecha:** 19 de septiembre de 2026  
**Estado:** alcance inicial basado en el repositorio verificado.

## 1. Propósito

Forkza Gestión es el dominio comercial y operativo de Forkza IA. Permite a gimnasios administrar la relación con prospectos y socios, automatizar conversaciones, operar reservas y membresías y controlar acciones de retención.

No contiene la planificación deportiva detallada; esa responsabilidad pertenece a Forja Training.

## 2. Usuarios

- propietario o administrador del gimnasio;
- personal de recepción y ventas;
- entrenador con permisos operativos;
- socio o prospecto mediante canales autorizados;
- administrador de plataforma con acceso auditado.

Los roles no se muestran como pestañas genéricas al usuario. La navegación y las acciones se derivan de sus permisos.

## 3. Capacidades del dominio

### 3.1. Asistente conversacional

- menú e intención determinística;
- información de sedes, clases y planes comerciales;
- reserva y cancelación;
- clase de prueba y captura de lead;
- derivación a atención humana;
- historial y estado conversacional;
- salida por canal demo o WhatsApp mediante contrato.

### 3.2. Clases, horarios y cupos

- catálogo configurable por workspace y sede;
- identificadores estables, no nombres como clave;
- horarios, capacidad, disponibilidad y lista de espera futura;
- prevención de duplicados e idempotencia;
- conservación de compatibilidad con el flujo MONKEYS.

### 3.3. CRM y prospectos

- origen del lead;
- datos de contacto normalizados;
- consentimiento y canal preferido;
- estado, responsable y próxima acción;
- conversión a socio sin duplicar identidad;
- trazabilidad de mensajes y cambios.

### 3.4. Socios y membresías

- relación de una persona con un workspace;
- plan comercial, vigencia y estado;
- pausas, cortesía, renovación y vencimiento;
- multi-sede según reglas del plan;
- historial inmutable de cambios relevantes.

### 3.5. Pagos

- proveedor detrás de `PaymentProvider`;
- link, verificación, webhook y conciliación;
- montos en unidad mínima y moneda separada, nunca strings con símbolo;
- idempotencia y firma de webhook;
- ningún estado pagado se determina solamente en frontend.

### 3.6. Asistencia

- fuente manual o adaptador `AttendanceSource`;
- separación entre asistencia operativa y ejecución deportiva;
- sede, fecha, origen y evidencia;
- eventos disponibles para automatizaciones autorizadas.

### 3.7. Automatizaciones y agentes comerciales

- retención;
- cobranza;
- reactivación;
- recordatorios;
- referidos;
- acciones propuestas o automáticas según política explícita;
- destinatario, motivo, plantilla, aprobación, estado e idempotencia.

## 4. Multi-tenant

- Todo dato pertenece a un `workspaceId`.
- MONKEYS y SOMA son tenants de demostración, no configuraciones globales.
- Un usuario puede pertenecer a varias organizaciones con permisos diferentes.
- Las sedes tienen identificadores estables.
- Marca, idioma, planes, clases y mensajes se configuran por workspace.
- Deben existir pruebas negativas de acceso cruzado.

## 5. Integración con Forja

- Comparte persona, workspace, sede, rol y notificaciones mediante Forkza Core.
- Expone estado comercial autorizado del alumno.
- Recibe solicitudes de mensaje o renovación desde Forja, pero conserva la propiedad financiera.
- Puede consumir señales agregadas de adherencia; no accede automáticamente a wellness, observaciones privadas o metodología del coach.

## 6. Estado técnico conocido

| Área | Estado verificado |
|---|---|
| Conversación y reservas | Existe en `main` |
| Automatización de retención | Existe en `main` |
| Multi-gimnasio y autenticación demo | Rama avanzada |
| Socios, membresías y pagos | Rama avanzada |
| Cinco agentes comerciales | Rama avanzada |
| WhatsApp oficial | Contrato/preparación; integración real pendiente |
| Persistencia productiva | Pendiente |
| Aislamiento productivo | Parcial; requiere endurecimiento |
| Forja Training | Ausente |

## 7. Reglas que Cursor no debe romper

1. Conservar los flujos demostrables existentes.
2. No reemplazar MONKEYS dentro de su tenant.
3. No usar `data/demo.js` como fuente de verdad productiva.
4. No mezclar plan comercial con programa de entrenamiento.
5. No identificar sedes o clases por nombre legible.
6. No procesar pagos sin idempotencia y verificación del proveedor.
7. No enviar mensajes reales durante pruebas.
8. No ocultar fallos de integración con fallback silencioso.
9. No fusionar ramas con pruebas fallidas.
10. No duplicar lógica de horarios, identidad o acciones entre agentes.

## 8. Criterios de aceptación iniciales

- Todas las pruebas de la rama base están en verde.
- Dos tenants pueden operar sin ver datos cruzados.
- MONKEYS conserva su identidad y flujos.
- SOMA u otro tenant puede configurar marca, sedes, clases y planes.
- Reservas respetan cupo e idempotencia.
- Membresías y pagos usan tipos monetarios correctos.
- Agentes registran destinatario y no duplican acciones.
- Los canales e integraciones se sustituyen mediante contratos.

## 9. Pendientes

- proveedor de base de datos y despliegue;
- proveedor real de WhatsApp;
- proveedores de pago productivos;
- política legal, consentimiento y retención;
- lista de espera y cancelaciones finales;
- facturación tributaria;
- reglas comerciales por país;
- observabilidad y soporte operacional.

