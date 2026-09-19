# Contexto vivo de FORKZA IA

Estado de referencia: 2026-09-19  
Repositorio: `perrotbr-tech/Monkeys-WhatsApp-assistant`  
Base funcional auditada: `cursor/socios-pagos-7236` @ `b03fd73db94589431209cf9a68f95e08f58a631d`

## Propósito

Este directorio es la memoria técnica y funcional verificable del proyecto. Debe leerse antes de recomendar, planificar o pedirle una ejecución a Cursor. La conversación sirve como antecedente, pero nunca reemplaza el estado vigente del repositorio, los PR, las pruebas y la plataforma implicada.

## Orden obligatorio de lectura

1. `00_INDICE_CONTEXTO_VIVO.md`: protocolo y fuente de verdad.
2. `01_ESTADO_REPOSITORIO.md`: ramas, PR y línea base comprobada.
3. `02_ARQUITECTURA_ACTUAL.md`: lo que existe realmente.
4. `03_DOMINIOS_Y_FLUJOS.md`: alcance funcional implementado y proyectado.
5. `04_RIESGOS_BRECHAS_Y_DECISIONES.md`: hallazgos y decisiones pendientes.
6. Los documentos maestros de `docs/forkza/`, cuando estén incorporados a la rama de trabajo.
7. Los archivos fuente y pruebas directamente afectados por la tarea.

## Regla de 7.000 caracteres

- Cada archivo de contexto debe tener como máximo 7.000 caracteres, contando espacios y Markdown.
- Si un bloque alcanza el límite, se crea el siguiente archivo numerado; no se comprime información crítica ni se mezcla todo en un documento único.
- Una actualización material modifica el bloque afectado y agrega una entrada a `05_REGISTRO_ACTUALIZACIONES.md`.
- Cada entrada debe indicar fecha, rama, commit, evidencia revisada y conclusión. No se registra como hecho una intención futura.

## Protocolo previo a orientar

Antes de dar instrucciones:

1. Confirmar repositorio y plataforma involucrada.
2. Consultar ramas y PR abiertos; identificar la rama funcional más avanzada y su base.
3. Leer este contexto y los documentos vinculados.
4. Comparar documentación contra código, datos, configuración y pruebas actuales.
5. Ejecutar verificaciones pertinentes cuando sea posible.
6. Actualizar el contexto si cambió la realidad comprobada.
7. Recién entonces formular la recomendación o el prompt de ejecución por etapa.

Si no se puede acceder a una fuente necesaria, se declara la limitación y no se presenta una suposición como certeza.

## Jerarquía de fuentes

1. Código y configuración de la rama objetivo.
2. Resultado reproducible de pruebas y ejecución.
3. Contratos/datos vigentes y reglas de Cursor.
4. Documentación versionada coherente con esa rama.
5. PR, comentarios y conversación, como contexto histórico.

## Alcance de la auditoría inicial

Se inventarió el árbol completo de la rama base. Se leyeron el código fuente, las pruebas, las reglas de Cursor, la configuración y los seis documentos maestros de PR #6. Los binarios e imágenes de marca se inventariaron como activos; `package-lock.json` se validó mediante `npm ci`. No se interpretaron los píxeles ni se revisó manualmente cada línea generada del lockfile.

