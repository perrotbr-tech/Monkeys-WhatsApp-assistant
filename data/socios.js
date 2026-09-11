import { FECHA_DEMO, addDays, dayKey } from '../engine/dates.js';

function socio(partial) {
  return {
    estado: 'activo',
    fechaBaja: null,
    planId: 'mensual',
    ...partial,
  };
}

function visits(socioId, daysAgoList, fechaRef = FECHA_DEMO) {
  return daysAgoList.map((ago) => ({
    socioId,
    fechaISO: addDays(fechaRef, -ago).toISOString(),
  }));
}

/**
 * 20 socios demo + asistencias 60 días respecto a FECHA_DEMO.
 * 6 constantes, 8 regulares (2 recuperados), 4 riesgo, 2 silenciosos.
 */
export function crearDatosRetencion(fechaRef = FECHA_DEMO) {
  const socios = [
    socio({ id: 's01', nombre: 'Camila Torres', telefono: '+56961000001', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-01-10' }),
    socio({ id: 's02', nombre: 'Diego Nunez', telefono: '+56961000002', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-02-01' }),
    socio({ id: 's03', nombre: 'Valentina Rojas', telefono: '+56961000003', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-03-12' }),
    socio({ id: 's04', nombre: 'Felipe Soto', telefono: '+56961000004', sedeId: 'Alta Vista', claseFavorita: 'Cross Training', fechaIngreso: '2024-11-20' }),
    socio({ id: 's05', nombre: 'Javiera Munoz', telefono: '+56961000005', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-04-04' }),
    socio({ id: 's06', nombre: 'Andres Pino', telefono: '+56961000006', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-05-15' }),
    socio({ id: 's07', nombre: 'Paula Vidal', telefono: '+56961000007', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-06-01' }),
    socio({ id: 's08', nombre: 'Tomas Bravo', telefono: '+56961000008', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-01-22' }),
    socio({ id: 's09', nombre: 'Isidora Lagos', telefono: '+56961000009', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-07-07' }),
    socio({ id: 's10', nombre: 'Nicolas Reyes', telefono: '+56961000010', sedeId: 'Alta Vista', claseFavorita: 'Cross Training', fechaIngreso: '2025-02-14' }),
    socio({ id: 's11', nombre: 'Fernanda Silva', telefono: '+56961000011', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2024-12-01' }),
    socio({ id: 's12', nombre: 'Benjamin Castro', telefono: '+56961000012', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: dayKey(addDays(fechaRef, -12)) }),
    socio({ id: 's13', nombre: 'Antonia Leon', telefono: '+56961000013', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-03-03' }),
    socio({ id: 's14', nombre: 'Martin Araya', telefono: '+56961000014', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-04-18' }),
    socio({ id: 's15', nombre: 'Catalina Vega', telefono: '+56961000015', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-01-08' }),
    socio({ id: 's16', nombre: 'Rodrigo Fuentes', telefono: '+56961000016', sedeId: 'Alta Vista', claseFavorita: 'Cross Training', fechaIngreso: '2025-05-21' }),
    socio({ id: 's17', nombre: 'Daniela Morales', telefono: '+56961000017', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2024-10-10' }),
    socio({ id: 's18', nombre: 'Ignacio Parra', telefono: '+56961000018', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-06-11' }),
    socio({ id: 's19', nombre: 'Francisca Ortiz', telefono: '+56961000019', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-02-02' }),
    socio({ id: 's20', nombre: 'Vicente Salas', telefono: '+56961000020', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-03-30' }),
  ];

  const asistencias = [
    ...visits('s01', [0, 2, 5, 7, 9, 12, 14, 18, 21, 25]),
    ...visits('s02', [1, 3, 6, 8, 11, 13, 16, 20, 23]),
    ...visits('s03', [0, 4, 6, 9, 11, 15, 17, 19, 22]),
    ...visits('s04', [1, 2, 5, 8, 10, 14, 16, 19, 24]),
    ...visits('s05', [0, 3, 7, 10, 12, 15, 18, 21, 26]),
    ...visits('s06', [1, 4, 8, 11, 14, 18, 22, 27]),
    ...visits('s07', [2, 8, 14, 20, 26]),
    ...visits('s08', [3, 9, 15, 21, 28]),
    ...visits('s09', [1, 7, 13, 19, 25]),
    ...visits('s10', [4, 10, 16, 22, 27]),
    ...visits('s11', [5, 11, 17, 23, 29]),
    ...visits('s12', [1, 4, 7, 9, 11]),
    ...visits('s13', [2, 6, 12, 18, 24]),
    ...visits('s14', [3, 8, 13, 19, 25]),
    ...visits('s15', [4, 12, 20]),
    ...visits('s16', [6, 18]),
    ...visits('s17', [2, 9, 16, 24, 32, 35, 38, 41, 44, 47, 50, 53]),
    ...visits('s18', [10]),
    ...visits('s19', [25, 40, 55]),
    ...visits('s20', [45, 58]),
  ];

  const campaniaAnterior = {
    id: 'camp-2026-09-01',
    fecha: '2026-09-01',
    fechaISO: '2026-09-01T12:00:00.000Z',
    clasificacion: [
      { socioId: 's13', segmento: 'riesgo' },
      { socioId: 's14', segmento: 'riesgo' },
      { socioId: 's15', segmento: 'riesgo' },
    ],
    acciones: [
      {
        id: 'act-prev-s13',
        agente: 'retencion',
        tipo: 'mensaje',
        socioId: 's13',
        canal: 'simulado',
        texto: 'Hola Antonia Leon, te esperamos de nuevo en Funcional. El proximo horario en Félix García es Martes 18:00.',
        motivo: 'riesgo',
        prioridad: 'media',
        estado: 'enviado',
        fechaISO: '2026-09-01T12:00:00.000Z',
        sedeId: 'Félix García',
      },
    ],
  };

  return {
    socios,
    asistencias,
    automation: {
      nextActionSeq: 2,
      agentesActivos: { retencion: true, cobranza: true, reactivacion: true, recordatorio: true, referidos: true },
      campanias: [campaniaAnterior],
      acciones: [...campaniaAnterior.acciones],
    },
  };
}
