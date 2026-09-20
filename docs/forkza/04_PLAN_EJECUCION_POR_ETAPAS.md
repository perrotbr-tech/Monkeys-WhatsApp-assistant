# Plan de ejecución por etapas — Forkza IA / Forja Training

**Versión:** 1.1  
**Regla:** una etapa por tarea de Cursor. Cada etapa requiere revisión humana antes de continuar.

## Resumen

| Etapa | Objetivo | Puerta de salida |
|---|---|---|
| E0 | Consolidar rama base | 68/68 pruebas y sin cambios funcionales no autorizados |
| E1 | Contratos de tiempo y persistencia | Tests determinísticos y Store con conformidad |
| E2 | Identidad estable y tenant config | MONKEYS funciona como configuración, no hardcode global |
| E3 | Forkza Core y límites | Pruebas de dependencias y aislamiento |
| E4 | Extraer Forkza Gestión | Flujos actuales conservados bajo módulo propio |
| E5 | Plataforma y adaptadores | HTTP, Store, canales, pagos y NLU desacoplados |
| E6 | Esqueleto de Forja | Feature flag, permisos y modelos mínimos |
| E7 | Modalidades y ejercicios | Banco y bibliotecas con aislamiento |
| E8 | Programación deportiva | Macro, meso, programas y asignaciones |
| E9 | Ejecución y wellness | Planificado vs. ejecutado, RPE y bienestar |
| E10 | Agentes e integraciones | Propuestas auditables; integraciones reales controladas |

## E0 — Consolidación y línea base

### Objetivo

Crear una rama de integración desde `docs/maestro-forkza-v2`, confirmar que su historia contiene PR #5 y PR #4, y corregir exclusivamente la única prueba fallida reproducida.

### Alcance

- verificar commits y ancestros;
- crear `integration/forkza-core-baseline` desde el HEAD verificado de `docs/maestro-forkza-v2`;
- reproducir 68 pruebas;
- corregir dependencia del día real mediante control de fecha o fixture;
- confirmar que `tests/auth.test.js` permanece en verde;
- actualizar documentación técnica mínima de la línea base.

### Fuera de alcance

- renombre de repositorio o marca;
- movimientos masivos de carpetas;
- implementación de Forja;
- cambio de persistencia;
- merge a `main`.

### Aceptación

- 68/68 pruebas;
- cero mensajes o pagos reales;
- demo MONKEYS operativa;
- informe exacto de causas y correcciones;
- no se modificaron expectativas para esconder fallos.

## E1 — Reloj y contrato de Store

### Objetivo

Eliminar dependencias no determinísticas y definir persistencia intercambiable.

### Trabajo

- introducir `Clock` inyectable;
- centralizar serialización;
- contrato `Store` y test de conformidad para JSON/localStorage;
- eliminar reconstrucción del catálogo desde datos demo en automatizaciones;
- conservar compatibilidad de snapshots con migración explícita.

### Aceptación

- pruebas independientes del día de ejecución;
- catálogo persistido como fuente de verdad;
- adaptadores pasan la misma suite de conformidad.

## E2 — Identidad estable y configuración de tenant

### Objetivo

Separar marca y datos MONKEYS del producto global.

### Trabajo

- IDs estables para workspace, sede, clase y plan comercial;
- configuración de marca, idioma, sedes, clases y mensajes;
- migración versionada de claves históricas de localStorage;
- conservar URLs y demo actual;
- documentar futuro renombre del repositorio, sin ejecutarlo todavía.

### Aceptación

- MONKEYS y SOMA pueden configurarse sin condicionales por nombre;
- renombrar una sede no rompe historial;
- los datos de un tenant no aparecen en el otro.

## E3 — Forkza Core y fronteras

### Objetivo

Crear límites internos sin reescribir el producto.

### Trabajo

- módulos de identidad, organizaciones, autorización, auditoría y contratos;
- `workspaceId` en entidades y consultas;
- `destinatarioRol` en acciones;
- reglas de dependencias verificadas por prueba o lint;
- feature flags de Gestión y Forja.

### Aceptación

- Core no depende de dominios;
- pruebas negativas multi-tenant;
- acciones identifican destinatario y origen;
- demo permanece funcional.

## E4 — Extracción de Forkza Gestión

### Objetivo

Clasificar y mover progresivamente CRM, reservas, socios, pagos y agentes comerciales.

### Trabajo

- módulos públicos internos;
- eliminar duplicaciones de horarios, identidad y acciones;
- términos `planComercial` y `programaEntrenamiento` fijados;
- pruebas equivalentes antes y después de cada movimiento.

### Aceptación

- ningún cambio observable no autorizado;
- rutas y contratos públicos documentados;
- `engine/` reducido, no eliminado abruptamente.

## E5 — Plataforma y adaptadores

### Objetivo

Desacoplar los dominios de transporte, almacenamiento y proveedores.

### Trabajo

- rutas HTTP agrupadas por dominio;
- `MessageChannel`, `AttendanceSource`, `IntentService` y `PaymentProvider` formales;
- variables de entorno alineadas con código real;
- idempotencia para webhooks y envíos;
- sustituir polling innecesario por actualización controlada cuando corresponda.

### Aceptación

- los dominios no importan proveedores concretos;
- adaptadores demo siguen disponibles;
- integraciones reales pueden sustituirse sin tocar reglas de negocio.

## E6 — Esqueleto de Forja

### Objetivo

Crear el módulo vacío y seguro de Forja, aún sin planificación completa.

### Trabajo

- feature flag;
- permisos de entrenador y alumno;
- relación entrenador–alumno–modalidad;
- contratos públicos con Core;
- navegación separada por permiso, no pestañas de rol visibles.

### Aceptación

- módulo desactivable;
- cero acceso cruzado;
- no depende de `gestion/` ni de datos demo.

## E7 — Modalidades, ejercicios y bibliotecas

Implementar según `03_COMANDO_MAESTRO_FORJA_TRAINING_v0.3.md`:

- cinco modalidades iniciales;
- banco canónico;
- relaciones ejercicio–modalidad;
- bibliotecas global, workspace y entrenador;
- alias, variantes, fuentes y versionado;
- importación por plantilla con vista previa y resolución de duplicados.

Puerta: aislamiento, trazabilidad y ningún ejercicio duplicado por modalidad.

## E8 — Programación deportiva

- programas de entrenamiento;
- macro y mesociclos;
- asignaciones individuales y grupales;
- prescripciones y referencias de carga;
- plantillas claramente identificadas como sugerencias;
- microciclo/sesión solo después de aprobar su modelo detallado.

Puerta: planificado separado de ejecutado y publicación con aprobación.

## E9 — Ejecución, feedback y bienestar

- flujo móvil simple del alumno;
- estados rápidos y modificaciones;
- cargas, porcentajes, RPE/RIR y observación final;
- wellness 1–5 en cinco dimensiones;
- alertas no clínicas;
- vista comparativa del entrenador.

Puerta: datos incompletos no se convierten en cero y una respuesta aislada no modifica el plan.

## E10 — Agentes e integraciones reales

- Planificador, Preparación, Progreso, Acompañamiento, Retención, Finanzas y Energía;
- propuestas explicables y auditables;
- aprobación humana;
- WhatsApp oficial, pagos o control de acceso solo mediante adaptadores;
- observabilidad, reintentos e idempotencia;
- privacidad entre dominios y tenants.

Puerta: ningún mensaje o ajuste sale sin la política aprobada; ninguna función nutricional prescribe dieta.

## Regla final de avance

Al cerrar cada etapa, Cursor debe detenerse. La siguiente etapa comienza solo con un prompt nuevo que cite explícitamente su número.
