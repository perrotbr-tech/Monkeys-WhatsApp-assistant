# FORJA TRAINING — Comando maestro funcional para Cursor

**Versión:** 0.3  
**Fecha de corte:** 19 de septiembre de 2026  
**Estado:** Base funcional consolidada. Documento vivo, todavía no definitivo.  
**Idioma funcional principal:** español.

---

## 0. Instrucción maestra para Cursor

Actúa como arquitecto de software, desarrollador senior y analista de producto responsable de construir **Forja Training**, el módulo deportivo del ecosistema **Forkza IA** para gimnasios, entrenadores y alumnos.

Este documento es la fuente de verdad funcional del producto en su estado actual. Debes respetar sus decisiones, límites y terminología. No conviertas sugerencias de Forja Training en reglas deportivas oficiales ni inventes requisitos en los apartados marcados como pendientes.

### Forma obligatoria de trabajo

1. Antes de modificar código, inspecciona la estructura, tecnologías, convenciones, modelos y migraciones del repositorio.
2. Explica brevemente qué parte de este documento vas a implementar y qué componentes existentes se verán afectados.
3. Divide cada implementación en entregas pequeñas, comprobables y reversibles.
4. Conserva compatibilidad con lo existente, salvo que la tarea autorice expresamente una migración o ruptura.
5. Implementa la autorización y el aislamiento multi-tenant en servidor y base de datos; nunca solamente en la interfaz.
6. Incluye validaciones, estados vacíos, errores controlados, pruebas relevantes y migraciones cuando correspondan.
7. Mantén separados los datos planificados de los datos realmente ejecutados.
8. Mantén trazabilidad de fuentes, versiones, cambios, aprobaciones e importaciones.
9. No publiques planes, modifiques planificaciones activas ni elimines datos por iniciativa de la inteligencia artificial.
10. Cuando falte una decisión funcional, registra la duda como pendiente y consulta antes de fijar una regla difícil de revertir.
11. No construyas todo el producto en una sola ejecución salvo instrucción expresa. Trabaja únicamente sobre el módulo solicitado.
12. Al cerrar una tarea, informa:
    - qué se implementó;
    - qué archivos o modelos cambiaron;
    - qué pruebas se ejecutaron;
    - qué supuestos se utilizaron;
    - qué sigue pendiente.

### Principios de implementación

- Modularidad.
- Seguridad por defecto.
- Aislamiento estricto entre gimnasios, entrenadores y alumnos.
- Configuración antes que reglas rígidas.
- Trazabilidad antes que automatización opaca.
- Sugerencias de IA explicables y siempre revisables.
- Experiencia rápida para el entrenador.
- Registro simple para el alumno.
- Escalabilidad para nuevas modalidades.
- Accesibilidad y uso móvil como requisitos de primera clase.

---

# A. Definición del producto

## A.1. Nombre

**Forja Training**

Nombre corto autorizado: **Forja**.

No utilizar como nombre global:

- Forkza;
- Forkza AI;
- MONKEYS;
- Monkeys WhatsApp Assistant.

**Forkza IA** es la plataforma matriz. **Forja Training** puede comercializarse de forma independiente, pero utiliza Forkza Core para identidad, organizaciones, permisos, comunicaciones, auditoría y suscripciones.

## A.2. Propósito

Forja Training es un módulo multi-gimnasio, multi-entrenador, multi-alumno y multi-modalidad destinado a:

- administrar entrenadores, alumnos y grupos;
- construir y mantener bancos de ejercicios;
- importar ejercicios y planificaciones externas;
- crear planificaciones deportivas;
- asignar planes por modalidad a grupos o alumnos;
- registrar la ejecución real de los entrenamientos;
- monitorear bienestar, cumplimiento y rendimiento;
- acelerar el trabajo del entrenador mediante un agente de inteligencia artificial;
- aprender la metodología de cada entrenador dentro de límites privados y autorizados.

Forja Training debe adaptarse al método del entrenador. No debe obligarlo a utilizar una planificación generada por IA ni a reemplazar sus ejercicios por el banco global de la plataforma.

## A.3. Relación con Forkza IA y MONKEYS

- **Forkza IA** es la plataforma matriz.
- **Forkza Core** aporta identidad, workspaces, roles, permisos, auditoría, notificaciones y servicios compartidos.
- **Forkza Gestión** concentra CRM, reservas, clases de prueba, membresías, pagos, asistencia y retención comercial.
- **Forja Training** concentra planificación, ejecución y análisis deportivo.
- **MONKEYS Fitness Community** es el primer tenant demostrativo y conserva su configuración y marca.
- El repositorio histórico `Monkeys-WhatsApp-assistant` es el origen técnico de Forkza Gestión; no contiene actualmente el dominio Forja.
- Forja no debe duplicar autenticación, pagos, mensajería ni datos organizacionales ya resueltos por Forkza Core.
- La integración se realizará mediante contratos internos y límites de dominio; ningún módulo deportivo debe importar directamente datos demo de MONKEYS.

## A.4. Principio central de producto

El entrenador mantiene el control profesional.

La inteligencia artificial puede:

- organizar;
- reconocer;
- calcular;
- resumir;
- advertir;
- proponer;
- crear borradores.

La inteligencia artificial no puede:

- publicar por sí sola;
- cambiar un plan activo sin aprobación;
- diagnosticar;
- decidir una baja médica;
- borrar ejercicios o registros;
- compartir metodologías entre organizaciones;
- presentar una plantilla de Forja Training como regla oficial de una federación.

---

# B. Fundamento transversal: arquitectura multi-tenant y permisos

Este fundamento aplica a todos los puntos del documento.

## B.1. Espacios de trabajo

Forkza Core proveerá a Forja Training dos tipos iniciales de espacio de trabajo:

1. **Gimnasio**
2. **Entrenador independiente**

Un entrenador puede:

- pertenecer a uno o más gimnasios;
- trabajar de manera independiente;
- cambiar de contexto activo;
- mantener los datos de cada contexto totalmente separados.

La selección visual de un espacio no reemplaza la autorización del servidor.

## B.2. Roles iniciales

- Administrador de plataforma Forja Training.
- Propietario o administrador de gimnasio.
- Entrenador.
- Alumno.

Los roles pueden complementarse con permisos específicos. No asumir que un nombre de rol concede acceso ilimitado.

## B.3. Alcance de visibilidad

| Rol | Puede ver | No puede ver por defecto |
|---|---|---|
| Administrador de Forja Training | Operación necesaria de plataforma según política interna | Datos privados fuera de un proceso autorizado y auditado |
| Administrador de gimnasio | Entrenadores, alumnos, grupos, biblioteca, planes, asignaciones e indicadores de su gimnasio | Datos de otros gimnasios o espacios independientes |
| Entrenador | Sus bibliotecas, planes y alumnos o grupos asignados dentro del contexto activo | Alumnos de otros entrenadores sin relación autorizada |
| Alumno | Su perfil, evaluaciones autorizadas, planes asignados, sesiones, resultados y progreso | Otros alumnos, notas internas, metodología privada y planes no asignados |

Un entrenador solamente podrá acceder a alumnos de otro entrenador cuando exista, como mínimo, una de estas condiciones:

- grupo compartido;
- rol de apoyo;
- reemplazo temporal;
- permiso explícito;
- función de evaluación autorizada.

## B.4. Relación entrenador–alumno por modalidad

La relación principal no será solamente entrenador–alumno. Debe estar vinculada a una modalidad.

Entidad conceptual: **coach_student_modality_assignment**

Campos mínimos:

- id;
- workspace_id;
- coach_id;
- student_id;
- modality_id;
- group_id opcional;
- coach_role;
- status;
- start_date;
- end_date opcional;
- can_view_assessments;
- can_create_plans;
- can_edit_plans;
- can_view_results;
- created_by;
- created_at;
- updated_at.

Roles posibles en la relación:

- entrenador principal;
- entrenador de apoyo;
- evaluador;
- reemplazo temporal;
- solo lectura.

Esto permite que un mismo alumno tenga distintos entrenadores según modalidad.

## B.5. Grupos

Cada grupo:

- pertenece a un workspace;
- puede trabajar una o más modalidades;
- tiene un entrenador responsable por modalidad;
- puede tener entrenadores de apoyo;
- contiene alumnos;
- puede registrar nivel, objetivo, horario, capacidad y estado.

Un grupo multi-modalidad no debe guardar “CrossFit + HYROX” como una modalidad nueva. Debe mantener relaciones independientes con CrossFit y HYROX.

Cuando un alumno ingresa a un grupo, hereda las relaciones autorizadas del grupo, pero puede recibir adaptaciones individuales.

## B.6. Propiedad y visibilidad de los recursos

Propietarios posibles:

- sistema;
- gimnasio;
- entrenador;
- alumno, cuando corresponda.

Alcances posibles:

- global;
- gimnasio;
- grupo;
- entrenador;
- alumno;
- privado.

Reglas:

- La biblioteca global de Forja Training es de solo lectura para gimnasios y entrenadores.
- Una planificación creada en el contexto de un gimnasio para sus alumnos pertenece operacionalmente al gimnasio.
- La biblioteca personal de un entrenador permanece privada hasta que el entrenador la comparta o copie expresamente.
- Copiar no debe alterar el elemento original.

## B.7. Aislamiento obligatorio

- Todo registro operativo debe incluir workspace_id o una relación inequívoca con un workspace.
- La autorización se debe comprobar en cada lectura y escritura.
- Los archivos y rutas de almacenamiento deben estar segmentados por workspace.
- La búsqueda semántica y la recuperación de contexto del agente deben respetar el mismo alcance.
- La revocación de una relación debe retirar el acceso inmediatamente.
- Todo acceso administrativo excepcional debe quedar auditado.
- Ningún dato de un gimnasio puede utilizarse para beneficiar a otro sin consentimiento explícito y una política aprobada.

## B.8. Flujo de publicación

1. Crear borrador.
2. Seleccionar modalidad principal y modalidades complementarias.
3. Seleccionar grupo o alumnos.
4. Crear adaptaciones individuales cuando corresponda.
5. Revisar.
6. Aprobar.
7. Publicar.
8. Permitir acceso únicamente a los alumnos asignados.

---

# 1. Modalidades

## 1.1. Modalidades iniciales aprobadas

1. CrossFit.
2. HYROX.
3. Musculación.
4. Halterofilia.
5. Powerlifting.

La arquitectura debe permitir agregar otras modalidades en el futuro sin reconstruir el modelo de ejercicios, planificación o permisos.

## 1.2. Bases fundamentales

| Modalidad | Base fundamental | Naturaleza de la referencia | Aplicación en Forja Training |
|---|---|---|---|
| CrossFit | CrossFit Training, CrossFit Education y estándares oficiales aplicables | Metodológica, educativa, competitiva y de marca | Clasificación, estímulo, movimientos, escalado y estándares |
| HYROX | Reglamento oficial HYROX, HYROX365 y HYROX Academy | Competitiva, educativa y de marca | Estructura deportiva, estaciones, divisiones, preparación y estándares |
| Musculación | IFBB Academy | Educativa | Referencia formativa para entrenamiento de musculación e hipertrofia |
| Halterofilia | IWF | Normativa y educativa | Arranque, envión, técnica, intentos, estándares y preparación |
| Powerlifting | IPF | Normativa y educativa | Sentadilla, press banca, peso muerto, estándares y preparación |

## 1.3. Diferencia entre fuentes

Cada referencia deberá clasificarse como:

- **Normativa:** reglamento de competición, comandos, validez, equipamiento o categorías.
- **Educativa:** técnica, progresiones, enseñanza o planificación.
- **Marca:** nombres, licencias, afiliaciones, logotipos y uso comercial.

Forja Training no debe declarar que una pauta educativa es una obligación competitiva.

Forja Training no debe declarar afiliación, certificación, patrocinio o aprobación de CrossFit, HYROX, IFBB, IWF o IPF sin autorización contractual.

## 1.4. Criterios por modalidad

### 1.4.1. CrossFit

La clasificación debe respetar:

- movimientos funcionales constantemente variados;
- intensidad relativa a la capacidad de la persona;
- mecánica antes de consistencia e intensidad;
- preservación del estímulo al escalar;
- categorías de movimiento:
  - monoestructural;
  - levantamiento de peso;
  - gimnasia.

En Forja Training, la gimnasia forma parte de la clasificación interna de CrossFit. No será una modalidad principal independiente en esta primera versión. La arquitectura deberá permitir agregar gimnasia deportiva como modalidad futura si se decide.

AMRAP, EMOM y For Time son formatos de entrenamiento, no ejercicios.

### 1.4.2. HYROX

Debe distinguir:

- estructura oficial de competición;
- carrera;
- estaciones;
- transición;
- preparación física general;
- preparación específica;
- trabajo de carrera comprometida bajo fatiga;
- divisiones y estándares versionados.

HYROX365 y HYROX Academy se utilizarán como referencias educativas. El reglamento oficial vigente será la referencia normativa para competición.

### 1.4.3. Musculación

IFBB Academy será una referencia educativa para:

- técnica;
- hipertrofia;
- entrenamiento de fuerza orientado a musculación;
- organización de volumen;
- selección de ejercicios;
- especialización muscular.

No debe presentarse a IFBB Academy como regulador universal de toda la musculación, la fuerza o la hipertrofia.

### 1.4.4. Halterofilia

La IWF será la referencia normativa principal.

Levantamientos competitivos:

- arranque o snatch;
- envión o clean and jerk.

Las variantes, tirones, sentadillas, complejos y ejercicios técnicos se clasificarán como derivados, accesorios o preparación, no como levantamientos competitivos independientes.

### 1.4.5. Powerlifting

La IPF será la referencia normativa principal.

Levantamientos competitivos:

- sentadilla;
- press banca;
- peso muerto.

Las variantes y accesorios se relacionarán con uno o más levantamientos competitivos, pero no se presentarán como pruebas competitivas oficiales.

## 1.5. Reglas de modalidad

- Un ejercicio puede pertenecer a varias modalidades.
- La relación ejercicio–modalidad debe indicar el papel del ejercicio en cada una.
- Un ejercicio puede no tener modalidad principal.
- Una planificación sí debe tener una modalidad principal.
- Una planificación puede tener modalidades complementarias.
- Usar un ejercicio originado en otra disciplina no convierte automáticamente la planificación en híbrida.
- La modalidad del plan se determina por el objetivo, la estructura y el método, no solamente por los ejercicios presentes.

Ejemplos:

- Un snatch dentro de un WOD no convierte automáticamente un plan CrossFit en una planificación conjunta CrossFit–halterofilia.
- Una carrera utilizada como acondicionamiento en powerlifting no transforma el plan en HYROX.
- Una planificación será híbrida cuando existan objetivos, dosis y seguimiento deliberados de más de una modalidad.

---

# 2. Banco de datos de ejercicios por modalidad

## 2.1. Decisión estructural

Forja Training tendrá **un único banco canónico de ejercicios**, no cinco bancos aislados.

Cada ejercicio se vinculará con una o más modalidades mediante relaciones muchos-a-muchos.

Esto debe evitar:

- duplicados;
- nombres contradictorios;
- pérdida de equivalencias;
- separación artificial de ejercicios compartidos;
- dificultad para crear planes híbridos.

## 2.2. Tipos de entidad

El sistema deberá distinguir:

- ejercicio canónico;
- variante;
- alias;
- progresión;
- regresión;
- drill técnico;
- complejo;
- actividad monoestructural;
- estación competitiva.

No se almacenarán como ejercicios:

- AMRAP;
- EMOM;
- For Time;
- Tabata;
- WOD completo;
- test completo;
- sesión completa;
- programa completo.

Estos elementos deberán vivir en entidades diferenciadas de formatos, evaluaciones, workouts o planificaciones.

## 2.3. Papel del ejercicio en una modalidad

Valores iniciales:

- competición;
- fundamental;
- compatible;
- accesorio;
- técnico;
- preparación general.

Ejemplo:

| Ejercicio | Powerlifting | Halterofilia | CrossFit | Musculación | HYROX |
|---|---|---|---|---|---|
| Back squat | Competición | Accesorio | Fundamental o compatible | Compatible | Preparación general |
| Snatch | Accesorio o técnico | Competición | Fundamental o compatible | Compatible, si aplica | Preparación general, si aplica |
| Sled push | Preparación general | Preparación general | Compatible | Compatible | Competición |

La relación debe ser editable y versionada. No se debe inferir una única clasificación universal.

## 2.4. Esquema maestro del ejercicio

### Identidad

- id inmutable;
- slug único;
- nombre canónico en español;
- nombre original o inglés;
- aliases;
- tipo de entidad;
- descripción propia de Forja Training.

### Ciclo de vida

- borrador;
- pendiente de validación;
- validado;
- publicado;
- deprecado.

Guardar:

- created_at;
- updated_at;
- created_by;
- validated_at;
- validated_by;
- version.

### Clasificación biomecánica y deportiva

- patrón o patrones de movimiento;
- familia deportiva;
- objetivos;
- grupos musculares principales;
- grupos musculares secundarios;
- articulaciones;
- plano de movimiento;
- bilateral o unilateral;
- cadena abierta o cerrada;
- compuesto o aislamiento;
- cíclico o acíclico;
- carga externa o peso corporal;
- nivel de impacto;
- complejidad técnica;
- nivel recomendado.

### Recursos y entorno

- equipamiento obligatorio;
- equipamiento alternativo;
- entorno;
- espacio;
- plataforma;
- rack;
- rig;
- pared;
- pista;
- necesidad de spotter;
- capacidad o cantidad de personas;
- restricciones logísticas.

### Métricas de prescripción permitidas

El ejercicio debe indicar qué métricas acepta:

- series;
- repeticiones;
- carga;
- porcentaje de 1RM;
- RPE;
- RIR;
- tiempo;
- distancia;
- calorías;
- ritmo;
- velocidad;
- cadencia;
- zona de frecuencia cardiaca;
- tiempo bajo tensión;
- descanso;
- lado;
- altura;
- inclinación;
- peso del implemento.

No mostrar al entrenador o al alumno métricas incompatibles con el ejercicio.

### Técnica

- preparación;
- ejecución;
- finalización;
- respiración;
- cues;
- errores comunes.

### Estándares por modalidad

- organización;
- contexto;
- repetición válida;
- repetición no válida;
- comandos;
- equipamiento;
- división o categoría;
- versión;
- fecha;
- enlace oficial.

Un mismo ejercicio puede tener estándares distintos según modalidad, organización, división o versión.

### Relaciones

- variante de;
- progresión de;
- regresión de;
- prepara para;
- sustituto de;
- prerrequisito de;
- mismo patrón;
- alternativa de equipamiento;
- alternativa por limitación;
- parte de un complejo.

Se deben impedir relaciones circulares inválidas.

### Seguridad y adaptación

- nivel técnico requerido;
- necesidades de movilidad;
- necesidades de estabilidad;
- impacto;
- supervisión recomendada;
- precauciones;
- criterios para detener;
- escalado por carga;
- escalado por volumen;
- escalado por rango de movimiento;
- escalado por habilidad.

Forja Training no debe diagnosticar ni presentar una advertencia general como indicación médica individual.

### Fuente y trazabilidad

- organización;
- documento, curso o recurso;
- URL oficial;
- tipo de fuente;
- fecha de publicación;
- versión;
- fecha de consulta;
- campos respaldados por la fuente;
- notas de validación.

Si un dato no está disponible, utilizar “no informado” o “no aplica”. No inventar.

## 2.5. Controles de calidad

No publicar un ejercicio sin los campos obligatorios definidos para su tipo.

El sistema debe detectar:

- posibles duplicados;
- alias ya existentes;
- contradicciones de métricas;
- relaciones circulares;
- fuentes vencidas;
- estándares sin versión;
- nombres excesivamente similares;
- variantes guardadas incorrectamente como ejercicios independientes.

No copiar de manera masiva material propietario. Guardar datos estructurados, referencias y redacción propia.

## 2.6. Capas de biblioteca

1. **Biblioteca global de Forja Training**
   - curada;
   - versionada;
   - solo lectura para usuarios;
   - común a todas las organizaciones.

2. **Biblioteca del gimnasio**
   - visible dentro del workspace;
   - administrada según permisos del gimnasio;
   - puede basarse en ejercicios globales.

3. **Biblioteca personal del entrenador**
   - privada por defecto;
   - puede acompañar al entrenador entre contextos según política;
   - no se comparte sin acción explícita.

4. **Ejercicio en borrador**
   - incompleto;
   - todavía no disponible para publicación general;
   - editable por su propietario.

## 2.7. Creación autónoma por el entrenador

El entrenador podrá:

- crear un ejercicio mediante formulario guiado;
- duplicar y personalizar un ejercicio global sin alterarlo;
- crear una variante;
- crear una progresión o regresión;
- guardar nombres propios;
- agregar cues;
- definir métricas;
- clasificarlo por modalidad;
- guardarlo en su biblioteca personal o en la del gimnasio, según permisos.

### Alias frente a variante

- Si solamente cambia el nombre utilizado por el entrenador, guardar un alias u overlay personal.
- Si cambia la ejecución, el estímulo, el rango, el implemento de manera relevante o la forma de prescripción, crear una variante.

## 2.8. Importación de ejercicios y planificaciones

Formatos iniciales:

- XLSX;
- CSV;
- JSON para integraciones.

### Plantilla simple

- nombre;
- modalidad;
- equipamiento;
- descripción;
- series;
- repeticiones o métrica;
- notas.

### Plantilla avanzada

Debe permitir mapear el esquema maestro completo.

### Flujo de importación

1. Cargar archivo.
2. Analizar estructura.
3. Mapear columnas.
4. Identificar ejercicios.
5. Detectar posibles duplicados.
6. Proponer normalización.
7. Mostrar vista previa.
8. Permitir correcciones.
9. Solicitar aprobación.
10. Añadir a la biblioteca correspondiente.
11. Emitir informe de importación.

Reglas:

- Conservar el archivo o referencia original.
- No eliminar ni modificar contenido automáticamente.
- No publicar ejercicios importados sin confirmación.
- Mantener trazabilidad entre fila original, resultado normalizado y decisión del usuario.

Cuando un elemento importado coincida con un ejercicio canónico, el entrenador elegirá:

- vincular al canónico;
- guardar como alias personal;
- crear una variante;
- mantenerlo independiente.

## 2.9. Agente de planificación y metodología del entrenador

### Modos de autonomía

1. **Manual asistido**
   - El entrenador planifica.
   - La IA solamente acelera tareas.

2. **Copiloto**
   - La IA propone partes del plan.
   - El entrenador decide qué aceptar.

3. **Generación de borrador**
   - La IA crea una propuesta completa.
   - El entrenador revisa, edita y publica.

### Ayudas del modo manual

- búsqueda y autocompletado;
- reconocimiento de abreviaturas;
- inserción de ejercicios frecuentes;
- copia de semanas y bloques;
- cálculo de cargas y porcentajes;
- orden y formato;
- aplicación de descansos habituales;
- detección de repeticiones o solapamientos;
- estimación de volumen por grupo muscular cuando el modelo esté definido;
- advertencias de interferencia;
- alternativas por equipamiento;
- transformación de una planilla importada al formato visual de Forja Training.

### Aprendizaje permitido

El agente podrá aprender patrones a partir de:

- ejercicios creados por el entrenador;
- planillas históricas autorizadas;
- planes creados en Forja Training;
- plantillas;
- ediciones hechas a propuestas;
- aceptaciones y rechazos;
- instrucciones explícitas.

No afirmar que esto implica reentrenar un modelo fundacional.

Guardar un perfil estructurado de metodología:

- preferencia explícita;
- patrón inferido;
- nivel de confianza;
- evidencia;
- última actualización;
- modalidad;
- población o nivel;
- estado confirmado, rechazado o pendiente.

El entrenador debe poder:

- confirmar;
- editar;
- rechazar;
- eliminar.

Mantener perfiles separados por modalidad y población.

Una práctica frecuente no se vuelve automáticamente segura o recomendable. Cuando una planificación se declara competitiva, el estándar oficial vigente tiene prioridad sobre una costumbre incompatible.

### Contexto autorizado del agente

El agente podrá consultar, en este orden y siempre dentro del alcance permitido:

1. base global Forja Training;
2. biblioteca del workspace activo;
3. biblioteca personal del entrenador;
4. metodología del entrenador para la modalidad;
5. alumno o grupo asignado;
6. historial autorizado.

La memoria debe segmentarse por:

- workspace;
- entrenador;
- modalidad;
- población o alumno.

## 2.10. Ecosistema inicial de agentes

Forja contempla siete capacidades agénticas. Son responsabilidades lógicas; no obligan a ejecutar siete procesos técnicos separados.

| Agente | Usuario principal | Responsabilidad | Dominio propietario |
|---|---|---|---|
| Retención | Entrenador | Detectar caída de adherencia y preparar acciones | Compartido: Forja aporta señales deportivas; Forkza gestiona comunicaciones comerciales |
| Acompañamiento | Alumno | Recordatorios y mensajes aprobados por el entrenador | Forja + servicio compartido de mensajería |
| Planificador | Entrenador | Crear borradores de ciclos y sesiones desde su metodología | Forja |
| Preparación | Alumno | Informar sesión, materiales y preparación general | Forja |
| Progreso | Entrenador | Comparar planificado, ejecutado, bienestar y evolución | Forja |
| Finanzas | Entrenador | Avisos de renovación y cobranza | Forkza Gestión; Forja solo muestra estado autorizado |
| Energía | Alumno y entrenador | Estimar gasto y contrastar una pauta profesional cargada | Forja, con límites clínicos y profesionales |

Reglas obligatorias:

- los agentes proponen y el entrenador aprueba cuando la acción afecta al alumno o al plan;
- ninguna salida puede presentarse como diagnóstico, tratamiento o prescripción nutricional;
- usar “gasto energético estimado”, nunca “gasto real”, salvo medición validada e integrada;
- la pauta alimentaria debe provenir del alumno o de un profesional autorizado;
- toda acción debe registrar agente, motivo, evidencia, destinatario, aprobación y resultado;
- debe existir `destinatarioRol` o equivalente antes de sumar agentes deportivos;
- no compartir metodología ni datos sensibles entre workspaces.

---

# C. Requisito transversal: test de bienestar previo

El test de bienestar aplica a todas las modalidades.

## C.1. Momento

- Se solicita antes del entrenamiento.
- Puede configurarse como obligatorio, recomendado o solamente para sesiones seleccionadas.
- Si el alumno realiza otra sesión relevante el mismo día, el test puede repetirse.

## C.2. Dimensiones

Cada dimensión se responde de 1 a 5. Un valor más alto representa una percepción más favorable.

| Dimensión | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|
| Fatiga | Muy fresco | Fresco | Normal | Más cansado de lo normal | Siempre cansado |
| Calidad del sueño | Muy reparador | Bueno | Dificultad para conciliar el sueño | Sueño inquieto | Insomnio |
| Dolor muscular general | Se siente excelente | Se siente bien | Normal | Mayor dolor o tensión | Muy dolorido |
| Estrés | Muy relajado | Relajado | Normal | Estresado | Muy estresado |
| Estado de ánimo | Muy positivo | Generalmente bueno | Menor interés de lo habitual | Irritable con otras personas | Muy molesto, irritable o decaído |

Puntaje total posible: 5 a 25.

## C.3. Datos mínimos

- id;
- workspace_id;
- student_id;
- coach_id;
- group_id opcional;
- modality_id;
- session_id;
- timestamp;
- fatigue_score;
- sleep_quality_score;
- muscle_soreness_score;
- stress_score;
- mood_score;
- total_score;
- student_comment opcional;
- coach_response opcional;
- status.

Estados:

- pendiente;
- completado;
- omitido.

Una respuesta faltante es ausencia de dato. Nunca debe guardarse como cero.

## C.4. Uso del bienestar

La IA podrá:

- comparar el resultado con la línea base personal;
- observar tendencias;
- señalar cambios relevantes;
- informar qué dimensiones influyen;
- sugerir al entrenador revisar volumen, intensidad, complejidad o recuperación.

La IA no podrá:

- diagnosticar;
- cancelar una sesión automáticamente;
- modificar una planificación sin aprobación;
- imponer un punto de corte clínico universal;
- comparar alumnos sin contexto;
- normalizar como saludable un historial crónicamente desfavorable.

El test es una herramienta de monitoreo, no un instrumento diagnóstico.

---

# 3. Macro-ciclos y mesociclos

## 3.1. Jerarquía general

Planificación:

1. Macro-ciclo.
2. Mesociclo.
3. Microciclo.
4. Sesión.
5. Bloque.
6. Ejercicio o actividad.

En esta versión están definidos el macro-ciclo y el mesociclo. El detalle funcional de microciclos, sesiones y bloques permanece pendiente.

## 3.2. Regla sobre la periodización

Las organizaciones de referencia no imponen una única duración ni una secuencia universal de macro-ciclos y mesociclos aplicable a todas las personas.

Por lo tanto:

- las fases descritas a continuación son plantillas sugeridas por Forja Training;
- nunca se etiquetarán como secuencia oficial;
- el entrenador podrá cambiar nombres, orden, duración y contenido;
- no se impondrán duraciones rígidas;
- cada bloque debe tener un objetivo medible;
- se mantendrán separados planificado y ejecutado.

## 3.3. Macro-ciclo

### Tipos iniciales

- competición o evento;
- objetivo físico;
- anual o temporada;
- iniciación;
- continuo o rolling;
- híbrido.

### Campos mínimos

- id;
- workspace_id;
- responsible_coach_id;
- collaborating_coaches por modalidad;
- student_id o group_id;
- primary_modality_id;
- complementary_modality_ids;
- type;
- primary_goal;
- secondary_goals;
- start_date;
- end_date;
- target_event opcional;
- event_priority opcional;
- status;
- mesocycles;
- target_kpis;
- version;
- origin;
- notes;
- audit data.

Estados:

- borrador;
- pendiente de aprobación;
- activo;
- pausado;
- completado;
- archivado.

Orígenes:

- Forja Training;
- gimnasio;
- entrenador;
- importado;
- IA.

## 3.4. Mesociclo

Un mesociclo es un bloque dentro del macro-ciclo orientado a una adaptación o prioridad.

La duración es configurable. Forja Training puede sugerirla, pero no imponerla.

### Campos mínimos

- id;
- macrocycle_id;
- name;
- order;
- start_date;
- end_date;
- weeks;
- primary_adaptation;
- secondary_adaptations;
- modality_ids;
- specificity_level;
- weekly_frequency;
- priority_exercises_or_skills;
- planned_volume;
- planned_intensity;
- planned_density;
- progression_model;
- initial_assessments;
- final_assessments;
- deload_marker;
- taper_marker;
- advance_criteria;
- adjustment_criteria;
- planned_metrics;
- actual_metrics;
- status;
- version;
- coach_approval;

### Modelos de progresión permitidos

- lineal;
- ondulante;
- por bloques;
- escalonado;
- autorregulado;
- basado en porcentaje;
- basado en RPE o RIR;
- basado en rendimiento;
- definido por el entrenador.

## 3.5. Plantillas sugeridas por modalidad

### 3.5.1. CrossFit

Tipos de macro-ciclo:

- preparación física general continua;
- iniciación;
- énfasis en capacidad;
- competición;
- retorno;
- híbrido.

Mesociclos sugeridos:

- adaptación y calidad de movimiento;
- capacidad general de trabajo;
- fuerza;
- halterofilia y potencia;
- gimnasia;
- base aeróbica;
- capacidad anaeróbica;
- trabajo de debilidades;
- preparación específica de competición;
- simulación y estrategia;
- descarga;
- transición.

Métricas:

- exposición monoestructural;
- exposición a levantamiento de peso;
- exposición a gimnasia;
- dominios temporales;
- patrones de movimiento;
- cargas;
- habilidades;
- resultados de benchmarks;
- distribución entre sesiones exigentes y recuperación.

Un énfasis temporal no debe eliminar la variación estructurada ni reclasificar automáticamente la modalidad.

### 3.5.2. HYROX

Tipos de macro-ciclo:

- primera carrera;
- mejora de marca;
- individual;
- dobles;
- relevo;
- preparación general HYROX365;
- retorno.

Mesociclos sugeridos:

- evaluación y adaptación;
- base aeróbica y técnica de carrera;
- fuerza general;
- desarrollo de estaciones;
- capacidad híbrida;
- carrera comprometida;
- especificidad de carrera;
- simulaciones y pacing;
- taper;
- recuperación.

Métricas:

- kilómetros o tiempo de carrera;
- ritmo;
- zonas;
- volumen de estaciones;
- cargas de trineo;
- distancia de carry;
- distancia de lunges;
- wall balls;
- SkiErg;
- remo;
- transiciones;
- carrera comprometida;
- simulaciones.

### 3.5.3. Musculación

Tipos de macro-ciclo:

- hipertrofia general;
- especialización;
- fuerza e hipertrofia;
- recomposición corporal;
- mantenimiento;
- retorno;
- preparación estética o competitiva.

Mesociclos sugeridos:

- adaptación anatómica y técnica;
- acumulación de volumen;
- hipertrofia;
- intensificación;
- especialización de grupo rezagado;
- fuerza orientada a hipertrofia;
- descarga;
- resensibilización;
- mantenimiento;
- transición.

Métricas:

- series duras por grupo muscular;
- frecuencia muscular;
- repeticiones;
- carga;
- RIR;
- RPE;
- volumen por patrón;
- distribución;
- progresión;
- relación entre compuestos y aislamientos;
- recuperación.

El tonelaje no debe presentarse automáticamente como equivalente al estímulo hipertrófico.

### 3.5.4. Halterofilia

Tipos de macro-ciclo:

- técnica;
- desarrollo general;
- competición;
- corrección de debilidades;
- retorno;
- temporada con múltiples eventos.

Mesociclos sugeridos:

- preparación general;
- desarrollo técnico;
- acumulación de fuerza;
- potencia;
- preparación específica;
- intensificación de arranque y envión;
- precompetencia;
- taper;
- transición.

Métricas:

- número de levantamientos;
- tonelaje;
- intensidad media;
- porcentaje de 1RM;
- volumen de arranque;
- volumen de envión;
- derivados;
- tirones;
- sentadillas;
- aciertos;
- fallos;
- calidad técnica;
- exposiciones a cargas altas;
- controles.

El sistema podrá mostrar tonelaje combinado y separado para:

- levantamientos competitivos;
- derivados;
- tirones;
- sentadillas.

### 3.5.5. Powerlifting

Tipos de macro-ciclo:

- iniciación;
- desarrollo general;
- fuera de temporada;
- preparación competitiva;
- especialización de levantamiento;
- retorno;
- múltiples competiciones.

Mesociclos sugeridos:

- preparación física general;
- hipertrofia o trabajo estructural;
- volumen y técnica;
- fuerza;
- intensificación;
- especificidad competitiva;
- peak;
- taper;
- transición.

Métricas:

- volumen de sentadilla;
- volumen de press banca;
- volumen de peso muerto;
- tonelaje por levantamiento;
- repeticiones;
- intensidad media;
- porcentaje de 1RM;
- RPE;
- RIR;
- frecuencia;
- exposiciones a cargas altas;
- variantes frente a levantamientos competitivos;
- singles o controles;
- resultados de competición.

Fórmula base de tonelaje:

**Tonelaje = suma de repeticiones realizadas × carga real utilizada**

Debe poder consultarse por:

- ejercicio;
- sesión;
- levantamiento;
- microciclo;
- mesociclo;
- macro-ciclo.

Separar siempre:

- carga sugerida;
- carga ejecutada.

## 3.6. Gráficos

Permitir:

- volumen planificado frente a volumen realizado;
- intensidad planificada frente a intensidad realizada;
- visualización de descarga;
- visualización de taper;
- tests;
- eventos;
- superposición del bienestar.

No sumar unidades incompatibles. No mezclar, por ejemplo, kilómetros y kilogramos en un único total.

Cada modalidad debe conservar sus gráficos y unidades pertinentes.

## 3.7. Macro-ciclo híbrido

Debe contener:

- modalidad principal;
- modalidades complementarias;
- prioridad;
- entrenador responsable por modalidad;
- objetivos compartidos;
- riesgos de interferencia;
- calendario integrado.

Las métricas de las modalidades se mantienen separadas salvo que exista un modelo validado para combinarlas.

## 3.8. Autonomía del entrenador

El entrenador podrá:

- crear desde cero;
- usar una plantilla de Forja Training;
- copiar un ciclo anterior;
- importar una planilla;
- cambiar fases;
- cambiar nombres;
- cambiar orden;
- cambiar duración;
- guardar como plantilla;
- compartir según permisos;
- aplicar a un grupo;
- crear adaptaciones individuales.

El archivo importado y su correspondencia deben conservarse.

## 3.9. IA en macro-ciclos y mesociclos

La IA podrá:

- proponer estructuras;
- utilizar la fecha de un evento;
- aprender las fases habituales del entrenador;
- comparar planificado y ejecutado;
- advertir cambios abruptos;
- advertir posibles interferencias;
- sugerir una revisión de descarga;
- utilizar bienestar como una señal adicional;
- crear un borrador.

La IA no podrá:

- editar un macro-ciclo activo sin aprobación;
- cambiar una sesión por una única respuesta de bienestar;
- llamar “oficial” a una plantilla de Forja Training;
- transferir el método de un entrenador a otro;
- acceder a alumnos no autorizados.

---

# 4. Ejecución y registro del entrenamiento por el alumno

## 4.1. Objetivo

El alumno no debe llenar un formulario genérico desconectado del entrenamiento.

El registro ocurre dentro del flujo de la sesión. Forja Training pregunta solamente lo necesario según:

- ejercicio;
- bloque;
- modalidad;
- prescripción;
- configuración del entrenador.

El texto libre se reserva principalmente para la observación final.

## 4.2. Momentos

### Antes

- test de bienestar;
- confirmación de inicio;
- objetivo de la sesión.

### Durante

- registro por serie, ejercicio o bloque;
- preguntas dinámicas;
- valores planificados precargados;
- controles rápidos.

### Después

- RPE global;
- dificultad percibida frente a la esperada;
- observación escrita;
- confirmación;
- envío al entrenador.

## 4.3. Estados rápidos

Para cada unidad registrable:

- realizado según lo indicado;
- realizado con modificación;
- realizado parcialmente;
- no realizado.

Cuando el alumno confirma “según lo indicado”, guardar los valores prescritos como ejecutados, dejando registro de que fueron confirmados por el alumno.

Cuando el alumno modifica, mostrar solamente los controles pertinentes.

## 4.4. Modificaciones

- peso;
- repeticiones;
- series;
- distancia;
- tiempo;
- variante;
- escalado;
- descanso;
- otro ajuste autorizado.

Motivos seleccionables:

- indicación del entrenador;
- fatiga;
- dificultad técnica;
- dolor o molestia;
- falta de equipamiento;
- falta de tiempo;
- no alcanzó el objetivo;
- otro.

Si se selecciona dolor o molestia:

- solicitar zona corporal mediante opciones;
- solicitar nivel de molestia mediante opciones;
- informar al entrenador;
- no realizar diagnósticos.

## 4.5. Registro según prescripción

| Prescripción | Registro |
|---|---|
| Series, repeticiones y kilos | Series, repeticiones y carga real |
| Porcentaje de 1RM | Cumplido, ajustado o no alcanzado; carga real |
| RPE objetivo | RPE percibido |
| RIR objetivo | RIR percibido |
| Tiempo | Tiempo alcanzado o bloque incompleto |
| Distancia y ritmo | Distancia, tiempo y ritmo real |
| Rondas y repeticiones | Rondas completas y repeticiones adicionales |
| Calorías | Calorías completadas |
| Intentos técnicos | Logrado, fallado o modificado |
| CrossFit | Resultado, Rx, escalado o adaptado, tiempo o repeticiones |
| HYROX | Tiempo, distancia, carga, ritmo y estación |
| Halterofilia | Peso, intento logrado o fallado y percepción técnica |
| Powerlifting | Peso, repeticiones, RPE o RIR y cumplimiento |
| Musculación | Peso, repeticiones, RPE o RIR y series efectivas cuando se defina |

No pedir una métrica que no corresponda.

## 4.6. Porcentajes y referencias

Ejemplo:

**Sentadilla: 3 × 5 al 80 % = 120 kg**

Opciones por serie:

- 5 repeticiones con 120 kg, cumplido;
- ajustar resultado;
- serie no realizada.

Si selecciona ajustar, utilizar:

- botones;
- selector;
- stepper;
- teclado numérico controlado.

No utilizar texto libre para números.

Guardar:

- porcentaje objetivo;
- carga objetivo;
- carga real;
- porcentaje real calculado;
- repeticiones objetivo;
- repeticiones reales;
- estado de cumplimiento;
- referencia utilizada;
- fecha y versión de la referencia.

Referencias posibles:

- 1RM;
- e1RM;
- training max.

Una prescripción no se considera cumplida solo por alcanzar la carga si también exigía repeticiones, rango de RPE, técnica u otra condición.

## 4.7. RPE

Distinguir:

- RPE de serie;
- RPE de ejercicio;
- RPE de sesión.

El entrenador configura qué nivel registrar.

Para reducir interrupciones:

- pedir RPE por serie cuando la prescripción lo requiera;
- en otros casos, pedirlo al terminar el ejercicio;
- solicitar RPE global al terminar la sesión cuando esté configurado.

La escala de sesión será visual, de 1 a 10.

Pregunta complementaria:

- más fácil de lo esperado;
- según lo esperado;
- más difícil de lo esperado.

No inferir RPE solamente desde la carga.

## 4.8. Observación final

Pregunta:

**¿Quieres dejar alguna observación para tu entrenador?**

Será el campo de texto libre habitual.

Puede ser obligatorio cuando:

- se seleccionó “otro motivo”;
- la política del gimnasio lo exige;
- el entrenador lo configuró para esa sesión.

## 4.9. Experiencia de uso

- Mostrar un ejercicio o bloque por vez.
- Precargar los valores planificados.
- Confirmar con un toque cuando sea posible.
- Mostrar controles adicionales solo ante una desviación.
- Guardar progreso automáticamente.
- Permitir pausar y continuar.
- Mostrar avance de la sesión.
- Optimizar para móvil.
- Evitar registrar cada repetición de un WOD, circuito o simulación continua.
- En trabajos continuos, registrar el resultado del bloque.
- Mantener un snapshot de la prescripción para que una edición posterior del plan no cambie el historial.

## 4.10. Datos de ejecución

Entidades conceptuales:

- session_execution;
- block_execution;
- exercise_execution;
- set_execution o attempt_execution;
- session_feedback.

Cada registro debe vincularse con:

- workspace;
- alumno;
- asignación;
- sesión;
- bloque;
- ejercicio;
- prescripción original;
- modalidad;
- fecha y hora.

Campos generales:

- status;
- started_at;
- completed_at;
- planned_value;
- actual_value;
- completion_state;
- modification_reason;
- RPE;
- RIR;
- observation cuando corresponda;
- created_at;
- updated_at.

## 4.11. Vista del entrenador

Mostrar:

- planificado frente a ejecutado;
- porcentaje de cumplimiento;
- cargas;
- repeticiones;
- resultados;
- modificaciones;
- motivos;
- RPE;
- RIR;
- molestias reportadas;
- observación final;
- tendencias;
- adherencia.

La IA puede resumir y detectar patrones repetidos, pero cualquier ajuste al plan será una propuesta para el entrenador.

---

# D. Modelo conceptual mínimo

Esta lista orienta el diseño. No obliga a utilizar nombres exactos si el repositorio ya tiene convenciones equivalentes.

- User.
- Workspace.
- WorkspaceMembership.
- Role.
- Permission.
- Modality.
- Group.
- GroupMembership.
- GroupModalityCoach.
- CoachStudentModalityAssignment.
- Exercise.
- ExerciseAlias.
- ExerciseVariant.
- ExerciseModality.
- ExerciseRelation.
- ExerciseStandard.
- ExerciseSource.
- ExerciseLibraryItem.
- ImportJob.
- ImportRow.
- MethodologyProfile.
- TrainingPlan.
- Macrocycle.
- Mesocycle.
- Microcycle, reservado.
- TrainingSession, reservado.
- SessionBlock, reservado.
- ExercisePrescription.
- PlanAssignment.
- WellnessEntry.
- SessionExecution.
- BlockExecution.
- ExerciseExecution.
- SetExecution o AttemptExecution.
- SessionFeedback.
- AuditEvent.

Requisitos transversales:

- claves estables;
- timestamps;
- versionado donde corresponda;
- soft delete o deprecación cuando el historial dependa del registro;
- auditoría;
- restricciones de integridad;
- aislamiento por workspace;
- índices para autorización y consultas frecuentes.

---

# E. Criterios de aceptación funcional del corte actual

## E.1. Multi-tenant

- Un gimnasio no puede consultar registros de otro.
- Un entrenador ve solamente alumnos o grupos autorizados.
- Un alumno ve solamente sus datos y planes asignados.
- Un entrenador con varias organizaciones mantiene contextos separados.
- La revocación elimina el acceso sin borrar el historial.

## E.2. Modalidades

- Existen las cinco modalidades iniciales.
- Se pueden agregar nuevas modalidades sin duplicar el modelo.
- Un ejercicio puede relacionarse con varias modalidades.
- Un plan tiene una modalidad principal y modalidades complementarias opcionales.

## E.3. Banco de ejercicios

- La base global es canónica.
- Un entrenador puede crear contenido propio.
- Un ejercicio global puede personalizarse sin modificar el original.
- Alias y variantes se guardan de forma distinta.
- Se detectan posibles duplicados.
- Las fuentes y estándares quedan versionados.

## E.4. Importación

- Se puede cargar una plantilla.
- Existe mapeo de columnas.
- Se muestra una vista previa.
- Los duplicados se resuelven con decisión del usuario.
- Se conserva el origen.
- La IA no publica ni elimina automáticamente.

## E.5. Planificación

- Se puede crear un macro-ciclo y dividirlo en mesociclos.
- Las duraciones son configurables.
- Las plantillas de Forja Training están identificadas como sugerencias.
- Se separan métricas planificadas y reales.
- Las unidades incompatibles no se suman.
- Los planes híbridos conservan métricas por modalidad.

## E.6. Bienestar

- El alumno responde cinco dimensiones.
- Cada respuesta acepta 1 a 5.
- El total acepta 5 a 25.
- Un valor faltante no se transforma en cero.
- La respuesta queda vinculada a alumno, modalidad y sesión.
- Las alertas no se presentan como diagnóstico.

## E.7. Ejecución

- El alumno confirma rápidamente lo realizado.
- Solamente aparecen métricas pertinentes.
- Los valores planificados están precargados.
- Las modificaciones quedan registradas.
- Los porcentajes conservan su referencia.
- RPE de serie, ejercicio y sesión no se mezclan.
- El texto libre se concentra en la observación final.
- El entrenador ve planificado frente a ejecutado.

## E.8. Inteligencia artificial

- Existen tres niveles de autonomía.
- Toda propuesta es editable.
- La publicación requiere aprobación.
- El agente explica el motivo de una recomendación.
- La metodología aprendida se puede revisar y eliminar.
- No existe aprendizaje cruzado entre organizaciones sin consentimiento.

---

# F. Reglas que Cursor no debe romper

1. No crear cinco copias independientes del mismo ejercicio por modalidad.
2. No permitir que la interfaz sea el único control de acceso.
3. No mezclar bibliotecas privadas entre entrenadores.
4. No convertir una costumbre del entrenador en regla oficial.
5. No llamar oficial a una plantilla creada por Forja Training.
6. No asumir afiliación con organizaciones deportivas.
7. No imponer duraciones universales a los ciclos.
8. No mezclar planificado y ejecutado.
9. No sumar métricas incompatibles.
10. No utilizar bienestar como diagnóstico.
11. No modificar planes activos por una sola respuesta de bienestar.
12. No publicar contenido generado por IA sin aprobación.
13. No borrar ejercicios que formen parte del historial.
14. No sobrescribir el ejercicio global cuando un usuario lo personaliza.
15. No solicitar al alumno campos que no correspondan a la prescripción.
16. No usar texto libre cuando una opción estructurada o control numérico sea suficiente.
17. No perder el archivo original de una importación.
18. No inferir que un plan es híbrido solamente por compartir ejercicios.

---

# G. Decisiones pendientes

Estos temas no están cerrados. Cursor no debe inventar una definición definitiva:

- modelo detallado de microciclos;
- constructor final de sesiones y bloques;
- formatos completos de WOD y circuitos;
- evaluaciones, tests, marcas personales y perfiles de rendimiento;
- fórmula y uso final de carga interna basada en session-RPE;
- dashboards e informes definitivos;
- notificaciones y mensajería;
- calendario completo;
- integraciones con wearables o plataformas externas;
- visualización en Forja de pagos y suscripciones administrados por Forkza Gestión;
- arquitectura técnica final y proveedor de infraestructura;
- proveedor, modelo y estrategia de IA;
- política jurídica y consentimientos según país;
- contenido completo del banco inicial de ejercicios;
- proceso editorial y responsables de validación;
- configuración final de umbrales y alertas;
- funcionamiento offline y estrategia de sincronización;
- reglas finales de portabilidad de la biblioteca personal;
- nueva modalidad de gimnasia deportiva independiente;
- idiomas adicionales;
- datos sensibles y tiempos de retención.

Cuando una tarea toque uno de estos puntos, presentar alternativas y solicitar decisión antes de fijar una regla difícil de revertir.

---

# H. Referencias base verificadas

Registrar siempre la versión y fecha de consulta de cada recurso utilizado.

## CrossFit

- Metodología CrossFit: https://www.crossfit.com/crossfit-methodology
- Recursos y movimientos oficiales deben consultarse desde dominios oficiales de CrossFit.

## HYROX

- HYROX365 Academy: https://www.hyrox365.com/academy
- Reglamento y estándares de competición: utilizar la versión vigente publicada por HYROX en sus canales oficiales.

## Musculación

- IFBB Academy: https://ifbb-academy.com/

## Halterofilia

- IWF, The Two Lifts: https://iwf.sport/weightlifting_/the-two-lifts/
- IWF Coaching: https://iwf.sport/coaching/
- Reglamento vigente: consultar la sección oficial de reglas IWF.

## Powerlifting

- IPF Technical Rules: https://www.powerlifting.sport/rules/codes/info/technical-rules
- IPF Coach License: https://www.powerlifting.sport/federation/coach-license

## Bienestar

- McLean et al. (2010), PubMed: https://pubmed.ncbi.nlm.nih.gov/20861526/
- Publicación: https://journals.humankinetics.com/view/journals/ijspp/5/3/article-p367.xml

La referencia de bienestar se utiliza como antecedente de monitoreo. No valida un punto de corte clínico universal ni autoriza diagnósticos.

---

# I. Formato de respuesta esperado de Cursor en cada implementación

Antes de programar:

1. Resumen de la tarea.
2. Módulos y archivos afectados.
3. Decisiones ya definidas por este documento.
4. Preguntas realmente bloqueantes.
5. Plan de implementación.

Después de programar:

1. Resultado implementado.
2. Modelos, endpoints, pantallas o servicios modificados.
3. Migraciones.
4. Pruebas ejecutadas y resultado.
5. Criterios de aceptación comprobados.
6. Riesgos o deudas pendientes.
7. Próximo paso recomendado.

---

# J. Estado del comando maestro

| Área | Estado actual |
|---|---|
| Propósito de Forja Training | Definido |
| Relación Forkza IA, Forkza Gestión, Forja y MONKEYS | Definida |
| Multi-gimnasio, multi-entrenador y multi-alumno | Definido |
| Permisos y asignación por modalidad | Estructurado |
| Modalidades iniciales | Cerrado |
| Bases deportivas fundamentales | Cerrado con versionado obligatorio |
| Banco canónico de ejercicios | Estructurado |
| Bibliotecas privadas y de gimnasio | Estructurado |
| Importación de plantillas | Estructurado |
| Agente y niveles de autonomía | Definido conceptualmente |
| Siete capacidades agénticas | Clasificadas por dominio |
| Aprendizaje de metodología | Definido conceptualmente |
| Test de bienestar | Incorporado |
| Macro-ciclos y mesociclos | Estructurado |
| Registro del entrenamiento por el alumno | Estructurado |
| Microciclos | Pendiente |
| Sesiones y bloques | Pendiente |
| Evaluaciones y marcas | Pendiente |
| Arquitectura técnica final | Pendiente |

---

**Fin del corte v0.3 del comando maestro de Forja Training.**
