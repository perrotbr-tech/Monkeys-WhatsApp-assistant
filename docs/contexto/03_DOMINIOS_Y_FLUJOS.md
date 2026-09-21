# Dominios y flujos

## Producto unificado acordado

FORKZA IA es una plataforma modular con identidad compartida y dos dominios:

- **Forkza Gestión**: operación del gimnasio, CRM, WhatsApp, prospectos, reservas, clases de prueba, cupos, socios, membresías, pagos, asistencia, automatización y retención.
- **Forja Training**: entrenamiento para gimnasios, coaches y alumnos; modalidades, ejercicios, planificación, ciclos, sesiones, wellness, RPE, cargas, progreso y asistencia inteligente.

No son dos repositorios obligatorios ni dos productos inconexos. Deben compartir autenticación, organización/tenant, usuarios, sedes, permisos y datos maestros; sus módulos deben evolucionar sin acoplar reglas incompatibles.

## Forkza Gestión implementado

- Dos tenants demo y tema visual por tenant.
- Asistente para clases, planes, reservas, cupos, prueba, membresía y pago.
- Login demo y sesión para vistas internas.
- Paneles de reservas, leads y conversaciones.
- Cinco agentes deterministas de automatización.
- Alta, edición, baja, reactivación e importación CSV de socios.
- Membresías, pagos manuales/demo, conciliación y exportación.
- Adaptador opcional de Mercado Pago preparado, no desplegado de extremo a extremo.
- Persistencia JSON en servidor o `localStorage` en standalone.

## Forja Training diseñado, no implementado

Modalidades iniciales:

1. CrossFit, basado en fuentes oficiales de CrossFit.
2. HYROX, con base oficial HYROX y HYROX 365.
3. Musculación, con IFBB Academy como referencia formativa.
4. Halterofilia, con IWF como referencia reglamentaria.
5. Powerlifting, con IPF como referencia reglamentaria.

La plataforma debe ser multi-entrenador y multi-alumno. Cada gimnasio/coach ve exclusivamente su ámbito; cada alumno ve el suyo. La relación alumno-coach se asigna por una o más modalidades.

El banco de ejercicios debe combinar catálogo canónico, biblioteca privada por organización/coach, creación manual e importación por plantilla. La asistencia inteligente debe aprender preferencias operativas del coach sin convertir inferencias en hechos ni mezclar datos entre tenants.

Toda modalidad debe incorporar test breve de bienestar previo: fatiga, sueño, dolor muscular, estrés y ánimo. La ejecución del alumno debe registrarse principalmente con opciones contextuales: series/repeticiones/carga realizadas, cumplimiento de porcentaje, RPE o sensación, incidencias y observación libre final.

La planificación proyectada contempla macrociclo, mesociclo, microciclo, sesión y prescripción/resultado. Las métricas específicas varían por modalidad; no se debe imponer un único modelo de carga a las cinco.

## Entidades compartidas objetivo

- Organización/tenant.
- Sede.
- Usuario e identidad.
- Rol y permiso.
- Coach.
- Alumno/socio.
- Asignación coach-alumno-modalidad.

Las entidades comerciales y deportivas deben referenciar estas identidades compartidas, manteniendo datos sensibles y reglas especializadas dentro de su dominio.
