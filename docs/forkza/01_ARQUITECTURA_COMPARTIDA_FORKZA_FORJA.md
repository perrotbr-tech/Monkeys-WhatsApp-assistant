# Arquitectura compartida — Forkza IA y Forja Training

**Versión:** 1.0  
**Fecha:** 19 de septiembre de 2026  
**Decisión:** una plataforma tecnológica, dos dominios comerciales activables por separado.

## 1. Identidad del ecosistema

| Elemento | Definición |
|---|---|
| Forkza IA | Plataforma matriz y marca tecnológica |
| Forkza Core | Núcleo compartido de identidad, organizaciones, permisos, auditoría e integraciones |
| Forkza Gestión | Dominio comercial y operativo del gimnasio |
| Forja Training | Dominio deportivo para planificación, ejecución y rendimiento |
| MONKEYS Fitness Community | Primer tenant y marca demostrativa |
| Perrot Tech | Responsable del producto |

MONKEYS no debe eliminarse como tenant. Debe dejar de funcionar como identidad global escrita directamente en el código.

## 2. Evidencia del repositorio

Estado verificado el 19 de septiembre de 2026:

- `main`, commit `73dec396`: 21 pruebas aprobadas, 0 fallidas.
- PR/rama `cursor/multi-gimnasio-soma-dd14`, commit `f721818`: 51 pruebas, 49 aprobadas y 2 fallidas.
- PR/rama `cursor/socios-pagos-7236`, commit `b03fd73`: 63 pruebas, 61 aprobadas y 2 fallidas.
- La rama de socios y pagos contiene completamente la rama multi-gimnasio; no se deben integrar ambas por separado.
- La rama más avanzada modifica 62 archivos y agrega aproximadamente 6.337 líneas respecto de `main`.
- Forkza Gestión existe parcialmente.
- Forja Training no existe todavía en el repositorio.
- El motor actual conserva acoplamientos con `data/demo.js`, nombres legibles como identificadores y persistencia demostrativa.

## 3. Decisiones arquitectónicas

1. Evolucionar como **monolito modular** en esta fase.
2. No crear microservicios antes de estabilizar límites, contratos y modelo de datos.
3. Utilizar la rama `cursor/socios-pagos-7236` como base de una rama de integración, no fusionarla directamente a `main`.
4. Corregir primero las dos pruebas fallidas y lograr 63/63.
5. No implementar Forja sobre `main` ni directamente sobre datos demo.
6. No renombrar el repositorio o la URL pública durante la estabilización inicial.
7. Mantener compatibilidad con la demostración MONKEYS mediante configuración de tenant.
8. Activar Forkza Gestión y Forja Training mediante permisos, plan y feature flags.

## 4. Dominios y propiedad

### 4.1. Forkza Core

Propietario exclusivo de:

- usuarios e identidad;
- organizaciones, gimnasios y sedes;
- membresías de usuario al workspace;
- roles y permisos;
- feature flags y módulos contratados;
- auditoría;
- archivos compartidos;
- configuración de marca;
- contratos de notificación, pagos y persistencia;
- identificadores estables y contexto temporal.

### 4.2. Forkza Gestión

Propietario de:

- prospectos y CRM;
- clases de prueba;
- catálogo comercial de clases;
- horarios, cupos y reservas;
- socios y membresías comerciales;
- asistencia operativa;
- cobranza, pagos y conciliación;
- automatización comercial;
- retención y reactivación comercial.

### 4.3. Forja Training

Propietario de:

- modalidades deportivas;
- banco canónico de ejercicios;
- bibliotecas de gimnasio y entrenador;
- importación de ejercicios y planificaciones;
- metodología privada del entrenador;
- macro, meso y futuros microciclos;
- programas, sesiones, bloques y prescripciones;
- asignaciones entrenador–alumno por modalidad;
- test de bienestar;
- ejecución y feedback del entrenamiento;
- cargas, RPE, RIR, progreso y marcas;
- agentes deportivos y propuestas de ajuste.

## 5. Fronteras semánticas obligatorias

| Término ambiguo | Uso aprobado |
|---|---|
| Plan comercial | Producto o membresía que compra el cliente |
| Programa de entrenamiento | Planificación deportiva asignada |
| Clase | Actividad grupal reservable de Forkza Gestión |
| Sesión de entrenamiento | Unidad planificada y ejecutada de Forja |
| Socio | Relación comercial con un gimnasio |
| Alumno/atleta | Persona entrenada dentro de Forja |
| Asistencia | Presencia operativa o control de acceso |
| Ejecución | Registro deportivo detallado de una sesión |

Una persona puede ser socio y atleta, pero esas condiciones no son equivalentes.

## 6. Dependencias permitidas

```text
Forkza Gestión ─┐
                ├──> Forkza Core ───> Platform/Adapters
Forja Training ─┘
```

- Los dominios pueden depender de contratos públicos de Core.
- Core no puede depender de Forkza Gestión ni de Forja.
- Gestión y Forja no pueden importar internamente archivos del otro dominio.
- La integración entre dominios se realiza mediante servicios públicos, eventos internos o consultas autorizadas.
- Ningún módulo debe importar `data/demo.js` como fuente de verdad productiva.

## 7. Aislamiento y autorización

Toda entidad de negocio debe incluir o derivar de forma inequívoca:

- `workspaceId`;
- identificador estable;
- creador y timestamps;
- estado y versión cuando corresponda.

Reglas:

- la autorización se valida en servidor;
- un entrenador solo consulta alumnos, grupos y modalidades asignados;
- un alumno solo consulta sus asignaciones y ejecuciones;
- un usuario con varios workspaces selecciona contexto explícito;
- revocar acceso no elimina el historial;
- las consultas y escrituras deben probar aislamiento entre tenants.

## 8. Estructura objetivo progresiva

```text
src/
├── core/
│   ├── identity/
│   ├── organizations/
│   ├── authorization/
│   ├── audit/
│   └── contracts/
├── gestion/
│   ├── crm/
│   ├── bookings/
│   ├── memberships/
│   ├── payments/
│   └── automations/
├── forja/
│   ├── modalities/
│   ├── exercises/
│   ├── programming/
│   ├── execution/
│   ├── wellness/
│   └── agents/
└── platform/
    ├── http/
    ├── stores/
    ├── channels/
    ├── payments/
    └── nlu/
```

La estructura actual puede coexistir durante la migración. `engine/` se vacía progresivamente; no se elimina en una sola tarea.

## 9. Contratos técnicos prioritarios

- `Clock`: elimina dependencia directa del reloj del sistema.
- `Store`: persistencia intercambiable y test de conformidad.
- `MessageChannel`: demo y WhatsApp oficial.
- `AttendanceSource`: control de acceso o carga manual.
- `PaymentProvider`: proveedores de pago.
- `IntentService`: intención determinística y futura IA.
- `AuditSink`: registro de decisiones y acciones.

## 10. Reglas de integración entre productos

- Forkza puede convertir un socio autorizado en alumno de Forja sin duplicar la persona.
- Una reserva grupal no crea automáticamente una ejecución deportiva.
- Forja puede exponer adherencia agregada para retención, pero no compartir bienestar o notas sensibles sin finalidad y permiso.
- Finanzas pertenece a Gestión; Forja puede mostrar estado autorizado y solicitar una acción mediante contrato.
- Mensajería pertenece a infraestructura compartida; cada dominio es responsable del contenido y su aprobación.
- Cada agente debe registrar `destinatarioRol` o equivalente.

## 11. Condiciones para comenzar Forja

Forja solo puede iniciar cuando:

1. la rama de integración tiene todas las pruebas en verde;
2. existe `Clock` inyectable;
3. el Store posee contrato y aislamiento por workspace;
4. existen identificadores estables de sede y modalidad;
5. los nombres MONKEYS son configuración de tenant;
6. está definida la diferencia `planComercial` / `programaEntrenamiento`;
7. existen pruebas de frontera entre dominios.

## 12. Prohibiciones

- No fusionar PR #4 y PR #5 por separado.
- No hacer reemplazo masivo de MONKEYS por Forkza.
- No migrar y renombrar simultáneamente.
- No implementar todo Forja en una sola ejecución.
- No aceptar una etapa con pruebas rojas.
- No exponer datos entre workspaces por filtros de interfaz.
- No convertir JSON o localStorage en solución productiva definitiva.
- No conectar agentes a WhatsApp real sin aprobación, auditoría y control de idempotencia.

