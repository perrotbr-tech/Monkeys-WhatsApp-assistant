# Instrucciones raíz para Cursor — Forkza IA / Forja Training

**Versión:** 1.1  
**Fecha:** 19 de septiembre de 2026

## 1. Orden de lectura obligatorio

Antes de ejecutar cambios, leer completamente y en este orden:

1. `../contexto/00_INDICE_CONTEXTO_VIVO.md` y sus bloques numerados.
2. `00_INSTRUCCIONES_CURSOR_FORKZA_FORJA.md`.
3. `01_ARQUITECTURA_COMPARTIDA_FORKZA_FORJA.md`.
4. El comando maestro del dominio afectado.
5. `04_PLAN_EJECUCION_POR_ETAPAS.md`.
6. El prompt específico de la etapa autorizada.
7. Los archivos fuente y pruebas afectados.

Si existe contradicción:

1. manda el código y el resultado reproducible para describir el estado implementado;
2. manda el prompt autorizado para delimitar la etapa;
3. luego estas instrucciones raíz;
4. luego la arquitectura compartida;
5. luego el comando maestro del dominio afectado.

No resolver contradicciones mediante supuestos. Informarlas antes de escribir código.

## 2. Definiciones no negociables

- **Forkza IA** es la plataforma matriz.
- **Forkza Core** es el núcleo compartido.
- **Forkza Gestión** es el dominio comercial y operativo.
- **Forja Training** es el dominio deportivo.
- **MONKEYS Fitness Community** es el primer tenant demostrativo.
- El repositorio `Monkeys-WhatsApp-assistant` es el origen histórico, no la marca global.
- Arquitectura inicial: monolito modular.
- Los módulos se activan por plan, permisos y feature flags.

## 3. Estado real verificado

- `main` (`73dec396`): 21/21 pruebas en verde.
- `cursor/multi-gimnasio-soma-dd14` (`f721818`): está contenida en la rama siguiente.
- `cursor/socios-pagos-7236` (`b03fd73`): 67/68 pruebas en verde al 19-09-2026; contiene la rama multi-gimnasio.
- La autenticación pasa. La única falla reproducida es el caso `crosstraining mañana`, dependiente del día real de ejecución.
- No fusionar PR #4 y PR #5 por separado.
- Forja Training no está implementado todavía.

Cursor debe volver a verificar commits y pruebas al comenzar, porque el repositorio puede haber cambiado.

## 4. Forma obligatoria de trabajo

1. Ejecutar únicamente una etapa autorizada por conversación.
2. Antes de editar, informar alcance, archivos previstos, riesgos y pruebas.
3. No mezclar estabilización, renombre, modularización y nuevas funciones en una sola etapa.
4. Crear rama específica; nunca trabajar directamente sobre `main`.
5. Mantener cambios pequeños, reversibles y revisables.
6. Usar evidencia del repositorio; no afirmar que una función existe sin archivo y prueba.
7. No eliminar código funcional durante una extracción hasta demostrar equivalencia.
8. Toda etapa debe incluir pruebas de regresión.
9. Si una prueba falla, detener la etapa y explicar la causa; no cambiar expectativas para ocultar defectos.
10. No avanzar automáticamente a la etapa siguiente.

## 5. Política de ramas

- Etapa 0 parte desde `cursor/socios-pagos-7236` hacia una rama nueva de integración.
- Nombre sugerido: `integration/forkza-core-baseline`.
- `cursor/multi-gimnasio-soma-dd14` no se fusiona por separado porque ya es ancestro.
- `main` se mantiene intacta hasta revisión y aprobación humana.
- Cada etapa posterior usa una rama nueva desde la última base aprobada.

## 6. Política de pruebas

Antes y después de cada etapa:

- registrar Node y npm;
- ejecutar la suite completa;
- registrar total, aprobadas, fallidas, omitidas y duración;
- ejecutar pruebas específicas del módulo modificado;
- no aceptar disminución del número de pruebas sin explicación aprobada;
- no depender de fecha, hora, red o proveedor real en pruebas unitarias.

La primera puerta de calidad es 68/68 pruebas en la rama de integración, sin ocultar ni excluir el caso dependiente de fecha.

## 7. Seguridad y multi-tenant

- autorización en servidor, no solo en la interfaz;
- `workspaceId` o vínculo inequívoco en todas las entidades de negocio;
- identificadores estables;
- pruebas negativas de acceso cruzado;
- secretos solo mediante configuración segura;
- no registrar datos sensibles innecesarios;
- auditoría para cambios de rol, pagos, publicaciones y acciones de agentes.

## 8. Inteligencia artificial

- IA como propuesta, no autoridad profesional;
- publicación o modificación activa requiere aprobación humana;
- metodología del coach aislada por workspace, entrenador y modalidad;
- toda recomendación debe indicar motivo y evidencia;
- no diagnosticar ni prescribir dietas;
- usar “gasto energético estimado”;
- no enviar mensajes reales durante pruebas.

## 9. Formato de respuesta por etapa

### Antes de implementar

1. rama y commit de origen;
2. alcance exacto;
3. archivos previstos;
4. decisiones aplicadas;
5. preguntas bloqueantes;
6. plan y pruebas.

### Después de implementar

1. resumen del resultado;
2. archivos modificados;
3. migraciones y compatibilidad;
4. pruebas ejecutadas y resultado exacto;
5. criterios de aceptación verificados;
6. riesgos pendientes;
7. instrucciones de reversión;
8. detenerse y esperar aprobación.

## 10. Prohibiciones

- No renombrar masivamente MONKEYS.
- No renombrar el repositorio en Etapa 0.
- No fusionar a `main` sin aprobación.
- No comenzar Forja antes de cumplir sus precondiciones.
- No crear microservicios en esta fase.
- No utilizar nombres visibles como claves de negocio.
- No mezclar plan comercial y programa deportivo.
- No reemplazar persistencia demo y estructura de dominios en la misma etapa.
- No ejecutar una etapa posterior porque “parece lógica”.
