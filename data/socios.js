import { fechaHoy, addDays, dayKey } from '../engine/dates.js';
import { planIdDeSocioSoma, planSomaPorId } from './planes-soma.js';

function socio(partial) {
  return {
    estado: 'activo',
    fechaBaja: null,
    planId: 'mensual',
    tenantId: 'monkeys',
    ...partial,
  };
}

function visits(socioId, daysAgoList, fechaRef = fechaHoy()) {
  return daysAgoList.map((ago) => ({
    socioId,
    fechaISO: addDays(fechaRef, -ago).toISOString(),
  }));
}

const VISITAS = [
  [0, 2, 5, 7, 9, 12, 14, 18, 21, 25],
  [1, 3, 6, 8, 11, 13, 16, 20, 23],
  [0, 4, 6, 9, 11, 15, 17, 19, 22],
  [1, 2, 5, 8, 10, 14, 16, 19, 24],
  [0, 3, 7, 10, 12, 15, 18, 21, 26],
  [1, 4, 8, 11, 14, 18, 22, 27],
  [2, 8, 14, 20, 26],
  [3, 9, 15, 21, 28],
  [1, 7, 13, 19, 25],
  [4, 10, 16, 22, 27],
  [5, 11, 17, 23, 29],
  [1, 4, 7, 9, 11],
  [2, 6, 12, 18, 24],
  [3, 8, 13, 19, 25],
  [4, 12, 20],
  [6, 18],
  [2, 9, 16, 24, 32, 35, 38, 41, 44, 47, 50, 53],
  [10],
  [25, 40, 55],
  [45, 58],
];

const MONKEYS_SOCIOS = [
  { id: 's01', nombre: 'Camila Torres', telefono: '+56961000001', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-01-10' },
  { id: 's02', nombre: 'Diego Nunez', telefono: '+56961000002', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-02-01' },
  { id: 's03', nombre: 'Valentina Rojas', telefono: '+56961000003', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-03-12' },
  { id: 's04', nombre: 'Felipe Soto', telefono: '+56961000004', sedeId: 'Alta Vista', claseFavorita: 'Cross Training', fechaIngreso: '2024-11-20' },
  { id: 's05', nombre: 'Javiera Munoz', telefono: '+56961000005', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-04-04' },
  { id: 's06', nombre: 'Andres Pino', telefono: '+56961000006', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-05-15' },
  { id: 's07', nombre: 'Paula Vidal', telefono: '+56961000007', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-06-01' },
  { id: 's08', nombre: 'Tomas Bravo', telefono: '+56961000008', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-01-22' },
  { id: 's09', nombre: 'Isidora Lagos', telefono: '+56961000009', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-07-07' },
  { id: 's10', nombre: 'Nicolas Reyes', telefono: '+56961000010', sedeId: 'Alta Vista', claseFavorita: 'Cross Training', fechaIngreso: '2025-02-14' },
  { id: 's11', nombre: 'Fernanda Silva', telefono: '+56961000011', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2024-12-01' },
  { id: 's12', nombre: 'Benjamin Castro', telefono: '+56961000012', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: null },
  { id: 's13', nombre: 'Antonia Leon', telefono: '+56961000013', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2025-03-03' },
  { id: 's14', nombre: 'Martin Araya', telefono: '+56961000014', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-04-18' },
  { id: 's15', nombre: 'Catalina Vega', telefono: '+56961000015', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-01-08' },
  { id: 's16', nombre: 'Rodrigo Fuentes', telefono: '+56961000016', sedeId: 'Alta Vista', claseFavorita: 'Cross Training', fechaIngreso: '2025-05-21' },
  { id: 's17', nombre: 'Daniela Morales', telefono: '+56961000017', sedeId: 'Félix García', claseFavorita: 'Funcional', fechaIngreso: '2024-10-10' },
  { id: 's18', nombre: 'Ignacio Parra', telefono: '+56961000018', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-06-11' },
  { id: 's19', nombre: 'Francisca Ortiz', telefono: '+56961000019', sedeId: 'Félix García', claseFavorita: 'Spinning', fechaIngreso: '2025-02-02' },
  { id: 's20', nombre: 'Vicente Salas', telefono: '+56961000020', sedeId: 'Alta Vista', claseFavorita: 'Yoga', fechaIngreso: '2025-03-30' },
];

const SOMA_SOCIOS = [
  { id: 'sm01', nombre: 'Emilia Contreras', telefono: '+56962000001', sedeId: 'SOMA Antofagasta', claseFavorita: 'Crosstraining', fechaIngreso: '2025-01-10' },
  { id: 'sm02', nombre: 'Joaquin Herrera', telefono: '+56962000002', sedeId: 'SOMA Antofagasta', claseFavorita: 'Hyrox', fechaIngreso: '2025-02-01' },
  { id: 'sm03', nombre: 'Magdalena Pinto', telefono: '+56962000003', sedeId: 'SOMA Antofagasta', claseFavorita: 'Pilates', fechaIngreso: '2025-03-12' },
  { id: 'sm04', nombre: 'Cristobal Saavedra', telefono: '+56962000004', sedeId: 'SOMA Antofagasta', claseFavorita: 'Crosstraining', fechaIngreso: '2024-11-20' },
  { id: 'sm05', nombre: 'Constanza Ibarra', telefono: '+56962000005', sedeId: 'SOMA Antofagasta', claseFavorita: 'Hyrox', fechaIngreso: '2025-04-04' },
  { id: 'sm06', nombre: 'Matias Godoy', telefono: '+56962000006', sedeId: 'SOMA Antofagasta', claseFavorita: 'Pilates', fechaIngreso: '2025-05-15' },
  { id: 'sm07', nombre: 'Florencia Campos', telefono: '+56962000007', sedeId: 'SOMA Antofagasta', claseFavorita: 'Crosstraining', fechaIngreso: '2025-06-01' },
  { id: 'sm08', nombre: 'Sebastian Molina', telefono: '+56962000008', sedeId: 'SOMA Antofagasta', claseFavorita: 'Hyrox', fechaIngreso: '2025-01-22' },
  { id: 'sm09', nombre: 'Amanda Figueroa', telefono: '+56962000009', sedeId: 'SOMA Antofagasta', claseFavorita: 'Pilates', fechaIngreso: '2025-07-07' },
  { id: 'sm10', nombre: 'Gabriel Cardenas', telefono: '+56962000010', sedeId: 'SOMA Antofagasta', claseFavorita: 'Crosstraining', fechaIngreso: '2025-02-14' },
  { id: 'sm11', nombre: 'Trinidad Espinoza', telefono: '+56962000011', sedeId: 'SOMA Antofagasta', claseFavorita: 'Hyrox', fechaIngreso: '2024-12-01' },
  { id: 'sm12', nombre: 'Agustin Navarro', telefono: '+56962000012', sedeId: 'SOMA Antofagasta', claseFavorita: 'Pilates', fechaIngreso: null },
  { id: 'sm13', nombre: 'Paloma Henriquez', telefono: '+56962000013', sedeId: 'SOMA Antofagasta', claseFavorita: 'Crosstraining', fechaIngreso: '2025-03-03' },
  { id: 'sm14', nombre: 'Maximiliano Correa', telefono: '+56962000014', sedeId: 'SOMA Antofagasta', claseFavorita: 'Hyrox', fechaIngreso: '2025-04-18' },
  { id: 'sm15', nombre: 'Josefa Valdes', telefono: '+56962000015', sedeId: 'SOMA Antofagasta', claseFavorita: 'Pilates', fechaIngreso: '2025-01-08' },
  { id: 'sm16', nombre: 'Alonso Tapia', telefono: '+56962000016', sedeId: 'SOMA Antofagasta', claseFavorita: 'Crosstraining', fechaIngreso: '2025-05-21' },
  { id: 'sm17', nombre: 'Renata Orellana', telefono: '+56962000017', sedeId: 'SOMA Antofagasta', claseFavorita: 'Hyrox', fechaIngreso: '2024-10-10' },
  { id: 'sm18', nombre: 'Luciano Vargas', telefono: '+56962000018', sedeId: 'SOMA Antofagasta', claseFavorita: 'Pilates', fechaIngreso: '2025-06-11' },
  { id: 'sm19', nombre: 'Maite Caceres', telefono: '+56962000019', sedeId: 'SOMA Antofagasta', claseFavorita: 'Crosstraining', fechaIngreso: '2025-02-02' },
  { id: 'sm20', nombre: 'Esteban Riquelme', telefono: '+56962000020', sedeId: 'SOMA Antofagasta', claseFavorita: 'Hyrox', fechaIngreso: '2025-03-30' },
];

function cuposUsadosMesDe(asistencias, socioId, fechaRef, cuposMes) {
  const ym = dayKey(fechaRef).slice(0, 7);
  const n = asistencias.filter((a) => a.socioId === socioId && dayKey(a.fechaISO).startsWith(ym)).length;
  if (cuposMes == null) return n;
  return Math.min(n, cuposMes);
}

/**
 * 20 socios demo + asistencias 60 días respecto a la fecha de referencia.
 * 6 constantes, 8 regulares (2 recuperados), 4 riesgo, 2 silenciosos.
 */
export function crearDatosRetencion(fechaRef = fechaHoy(), opts = {}) {
  const tenantId = opts.tenantId || 'monkeys';
  const catalogo = tenantId === 'soma' ? SOMA_SOCIOS : MONKEYS_SOCIOS;
  const asistencias = catalogo.flatMap((row, i) => (
    visits(row.id, VISITAS[i], fechaRef).map((a) => ({ ...a, tenantId }))
  ));
  const socios = catalogo.map((row, i) => {
    const planId = tenantId === 'soma' ? planIdDeSocioSoma(row, i) : 'mensual';
    const plan = tenantId === 'soma' ? planSomaPorId(planId) : null;
    return socio({
      tenantId,
      ...row,
      fechaIngreso: row.fechaIngreso || dayKey(addDays(fechaRef, -12)),
      planId,
      cuposUsadosMes: tenantId === 'soma'
        ? cuposUsadosMesDe(asistencias, row.id, fechaRef, plan && plan.cuposMes)
        : 0,
    });
  });

  const sRiesgoPrev = [catalogo[12], catalogo[13], catalogo[14]];
  const prev = dayKey(addDays(fechaRef, -10));
  const campaniaAnterior = {
    id: `camp-${tenantId}-${prev}`,
    tenantId,
    fecha: prev,
    fechaISO: `${prev}T12:00:00.000Z`,
    clasificacion: sRiesgoPrev.map((s) => ({ socioId: s.id, segmento: 'riesgo' })),
    acciones: [
      {
        id: tenantId === 'soma' ? 'act-prev-sm13' : 'act-prev-s13',
        tenantId,
        agente: 'retencion',
        tipo: 'mensaje',
        socioId: catalogo[12].id,
        canal: 'simulado',
        texto: tenantId === 'soma'
          ? 'Hola Paloma Henriquez, te esperamos de nuevo en Crosstraining. El proximo horario en SOMA Antofagasta es Lunes 18:00.'
          : 'Hola Antonia Leon, te esperamos de nuevo en Funcional. El proximo horario en Félix García es Martes 18:00.',
        motivo: 'riesgo',
        prioridad: 'media',
        estado: 'enviado',
        fechaISO: `${prev}T12:00:00.000Z`,
        sedeId: catalogo[12].sedeId,
      },
    ],
  };

  const baja = socio({
    tenantId,
    id: tenantId === 'soma' ? 'sm-baja' : 's-baja',
    nombre: tenantId === 'soma' ? 'Humberto Lagos' : 'Hector Lagos',
    telefono: tenantId === 'soma' ? '+56962000999' : '+56961000999',
    sedeId: catalogo[0].sedeId,
    claseFavorita: catalogo[0].claseFavorita,
    fechaIngreso: '2024-01-10',
    estado: 'baja',
    fechaBaja: dayKey(addDays(fechaRef, -70)),
    planId: tenantId === 'soma' ? 'ct-2' : 'mensual',
    cuposUsadosMes: 0,
  });

  return {
    socios: [...socios, baja],
    asistencias,
    automation: {
      nextActionSeq: 2,
      agentesActivos: { retencion: true, cobranza: true, reactivacion: true, recordatorio: true, referidos: true },
      campanias: [campaniaAnterior],
      acciones: [...campaniaAnterior.acciones],
    },
  };
}
