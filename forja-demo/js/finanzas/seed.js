/**
 * Semilla financiera ficticia (demo Forja).
 * Incluye un segundo workspace y coach solo para pruebas de aislamiento.
 */

export const WS_FORJA = 'ws-forja-demo';
export const WS_OTRO = 'ws-otro-demo';
export const COACH_MATIAS = 'coach-matias';
export const COACH_OTRO = 'coach-laura';
export const PERIODO_ACTUAL = '2026-09';
export const FECHA_REF_DEMO = '2026-09-23';

export const PLANES_SEED = [
  {
    id: 'plan-inicial',
    workspaceId: WS_FORJA,
    nombre: 'Plan Powerlifting Inicial',
    valorMensual: 69990,
    moneda: 'CLP',
    modalidades: ['Powerlifting'],
  },
  {
    id: 'plan-comp',
    workspaceId: WS_FORJA,
    nombre: 'Plan Powerlifting Competencia',
    valorMensual: 120000,
    moneda: 'CLP',
    modalidades: ['Powerlifting'],
  },
  {
    id: 'plan-becado',
    workspaceId: WS_FORJA,
    nombre: 'Beca deportiva',
    valorMensual: 0,
    moneda: 'CLP',
    modalidades: ['Powerlifting'],
  },
  {
    id: 'plan-otro-ws',
    workspaceId: WS_OTRO,
    nombre: 'Plan ajeno (aislamiento)',
    valorMensual: 50000,
    moneda: 'CLP',
    modalidades: ['Powerlifting'],
  },
];

export const MEDIOS_PAGO_SEED = [
  { id: 'medio-transferencia', codigo: 'transferencia', etiqueta: 'Transferencia' },
  { id: 'medio-tarjeta', codigo: 'tarjeta', etiqueta: 'Tarjeta' },
  { id: 'medio-efectivo', codigo: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'medio-link', codigo: 'link_pago', etiqueta: 'Link de pago demo' },
  { id: 'medio-exento', codigo: 'exento', etiqueta: 'Exento' },
];

/** Asignaciones plan / coach / observación financiera por alumno visible. */
export const ASIGNACION_ALUMNOS = {
  'alu-01': {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    planId: 'plan-inicial',
    observacionFinanciera: 'Paga por transferencia el día 5.',
  },
  'alu-02': {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    planId: 'plan-inicial',
    observacionFinanciera: '',
  },
  'alu-03': {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    planId: 'plan-inicial',
    observacionFinanciera: 'Pendiente de regularizar septiembre.',
  },
  'alu-04': {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    planId: 'plan-comp',
    observacionFinanciera: '',
  },
  'alu-05': {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    planId: 'plan-comp',
    observacionFinanciera: 'Vencido: contactar antes de peaking.',
  },
  'alu-06': {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    planId: 'plan-comp',
    observacionFinanciera: '',
  },
  'alu-07': {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    planId: 'plan-becado',
    observacionFinanciera: 'Becada por convenio federación (ficticio).',
  },
};

/** Alumno ficticio de otro coach/workspace (no visible en UI del coach Matías). */
export const ALUMNO_AISLAMIENTO = {
  id: 'alu-x-laura',
  nombre: 'Pedro Aislamiento',
  grupoId: 'grp-inicial',
  modalidades: ['Powerlifting'],
  edad: 30,
  pesoCorporal: 80,
  oneRm: { squat: 100, bench: 70, deadlift: 130 },
  estadoHoy: 'pendiente',
  adherencia: 50,
  workspaceId: WS_OTRO,
  coachId: COACH_OTRO,
  planId: 'plan-otro-ws',
  observacionFinanciera: 'Fuera del workspace demo visible.',
  observacionDeportiva: '',
};

export function cargosSeed() {
  return [
    {
      id: 'cargo-01',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-01',
      planId: 'plan-inicial',
      modalidadIds: ['mod-pl'],
      periodo: PERIODO_ACTUAL,
      monto: 69990,
      vencimiento: '2026-09-05',
      estado: 'paid',
      medioPreferido: 'transferencia',
    },
    {
      id: 'cargo-02',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-02',
      planId: 'plan-inicial',
      modalidadIds: ['mod-pl'],
      periodo: PERIODO_ACTUAL,
      monto: 69990,
      vencimiento: '2026-09-28',
      estado: 'pending',
      medioPreferido: 'tarjeta',
    },
    {
      id: 'cargo-03',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-03',
      planId: 'plan-inicial',
      modalidadIds: ['mod-pl', 'mod-fg'],
      periodo: PERIODO_ACTUAL,
      monto: 69990,
      vencimiento: '2026-09-10',
      estado: 'overdue',
      medioPreferido: 'transferencia',
    },
    {
      id: 'cargo-04',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-04',
      planId: 'plan-comp',
      modalidadIds: ['mod-pl'],
      periodo: PERIODO_ACTUAL,
      monto: 120000,
      vencimiento: '2026-09-05',
      estado: 'paid',
      medioPreferido: 'efectivo',
    },
    {
      id: 'cargo-05',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-05',
      planId: 'plan-comp',
      modalidadIds: ['mod-pl'],
      periodo: PERIODO_ACTUAL,
      monto: 120000,
      vencimiento: '2026-09-08',
      estado: 'overdue',
      medioPreferido: 'link_pago',
    },
    {
      id: 'cargo-06',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-06',
      planId: 'plan-comp',
      modalidadIds: ['mod-pl'],
      periodo: PERIODO_ACTUAL,
      monto: 120000,
      vencimiento: '2026-09-30',
      estado: 'pending',
      medioPreferido: 'transferencia',
    },
    {
      id: 'cargo-07',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-07',
      planId: 'plan-becado',
      modalidadIds: ['mod-pl'],
      periodo: PERIODO_ACTUAL,
      monto: 0,
      vencimiento: '2026-09-30',
      estado: 'exempt',
      medioPreferido: 'exento',
    },
    {
      id: 'cargo-x',
      workspaceId: WS_OTRO,
      coachId: COACH_OTRO,
      alumnoId: 'alu-x-laura',
      planId: 'plan-otro-ws',
      modalidadIds: ['mod-pl'],
      periodo: PERIODO_ACTUAL,
      monto: 50000,
      vencimiento: '2026-09-15',
      estado: 'paid',
      medioPreferido: 'transferencia',
    },
  ];
}

export function pagosSeed() {
  return [
    {
      id: 'pago-01',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-01',
      cargoId: 'cargo-01',
      monto: 69990,
      medio: 'transferencia',
      fecha: '2026-09-04',
      comprobanteDemo: 'COMP-DEMO-1001',
    },
    {
      id: 'pago-04',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      alumnoId: 'alu-04',
      cargoId: 'cargo-04',
      monto: 120000,
      medio: 'efectivo',
      fecha: '2026-09-03',
      comprobanteDemo: 'COMP-DEMO-1004',
    },
    {
      id: 'pago-x',
      workspaceId: WS_OTRO,
      coachId: COACH_OTRO,
      alumnoId: 'alu-x-laura',
      cargoId: 'cargo-x',
      monto: 50000,
      medio: 'transferencia',
      fecha: '2026-09-14',
      comprobanteDemo: 'COMP-OTRO-0001',
    },
  ];
}

export function auditoriaSeed() {
  return [
    {
      id: 'aud-01',
      workspaceId: WS_FORJA,
      coachId: COACH_MATIAS,
      actorId: COACH_MATIAS,
      accion: 'seed',
      detalle: 'Carga inicial de finanzas demo',
      fecha: '2026-09-01T10:00:00.000Z',
    },
  ];
}

export function recaudacionAnteriorSeed() {
  return {
    [WS_FORJA]: {
      '2026-08': { proyectado: 639960, cobrado: 520000 },
    },
  };
}

export function finanzasSeedCompleto() {
  return {
    planes: PLANES_SEED.map((p) => ({ ...p, modalidades: [...p.modalidades] })),
    mediosPago: MEDIOS_PAGO_SEED.map((m) => ({ ...m })),
    cargos: cargosSeed(),
    pagos: pagosSeed(),
    auditoria: auditoriaSeed(),
    recaudacionAnterior: structuredClone(recaudacionAnteriorSeed()),
    linksPagoDemo: [],
    periodoActual: PERIODO_ACTUAL,
    fechaRef: FECHA_REF_DEMO,
  };
}

export function enriquecerAlumnosConFinanzas(alumnos) {
  return alumnos.map((a) => {
    const asig = ASIGNACION_ALUMNOS[a.id];
    if (!asig) {
      return {
        ...a,
        workspaceId: a.workspaceId || WS_FORJA,
        coachId: a.coachId || COACH_MATIAS,
        planId: a.planId || null,
        observacionFinanciera: a.observacionFinanciera || '',
        observacionDeportiva: a.observacionDeportiva || '',
      };
    }
    return {
      ...a,
      workspaceId: asig.workspaceId,
      coachId: asig.coachId,
      planId: asig.planId,
      observacionFinanciera: asig.observacionFinanciera,
      observacionDeportiva: a.observacionDeportiva || '',
    };
  });
}

export function coachVisibleSeed() {
  return {
    id: COACH_MATIAS,
    nombre: 'Matías Rojas',
    modalidad: 'Powerlifting',
    rol: 'Entrenador',
    workspace: 'FORJA DEMO',
    workspaceId: WS_FORJA,
  };
}

export function sesionDemoSeed() {
  return {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    rol: 'coach',
    alumnoId: null,
  };
}
