/**
 * Semilla financiera demo FORJA TRAINING.
 * Incluye workspace/coach visibles + entidades ficticias de aislamiento (no visibles en UI).
 */

export const FECHA_REF_FINANZAS = '2026-09-23';

export const WORKSPACE_DEMO = Object.freeze({
  id: 'ws-forja-demo',
  nombre: 'FORJA DEMO',
});

/** Segundo workspace solo para pruebas de aislamiento (no se muestra en UI). */
export const WORKSPACE_ALT = Object.freeze({
  id: 'ws-forja-alt',
  nombre: 'FORJA ALT (aislamiento)',
});

export const COACH_DEMO = Object.freeze({
  id: 'coach-matias',
  nombre: 'Matías Rojas',
  workspaceId: WORKSPACE_DEMO.id,
  modalidad: 'Powerlifting',
  rol: 'Entrenador',
});

/** Segundo coach ficticio (mismo o distinto workspace) para aislamiento. */
export const COACH_ALT = Object.freeze({
  id: 'coach-alt',
  nombre: 'Coach Alterno',
  workspaceId: WORKSPACE_ALT.id,
  modalidad: 'Powerlifting',
  rol: 'Entrenador',
});

export const MODALIDADES_FIN = [
  { id: 'mod-powerlifting', nombre: 'Powerlifting', workspaceId: WORKSPACE_DEMO.id },
  { id: 'mod-fuerza', nombre: 'Fuerza general', workspaceId: WORKSPACE_DEMO.id },
  { id: 'mod-alt', nombre: 'Modalidad ALT', workspaceId: WORKSPACE_ALT.id },
];

export const PLANES_SEED = [
  {
    id: 'plan-inicial',
    workspaceId: WORKSPACE_DEMO.id,
    nombre: 'Plan mensual Inicial',
    valorMensual: 69990,
    moneda: 'CLP',
    modalidadIds: ['mod-powerlifting'],
  },
  {
    id: 'plan-comp',
    workspaceId: WORKSPACE_DEMO.id,
    nombre: 'Plan mensual Competencia',
    valorMensual: 120000,
    moneda: 'CLP',
    modalidadIds: ['mod-powerlifting'],
  },
  {
    id: 'plan-mixto',
    workspaceId: WORKSPACE_DEMO.id,
    nombre: 'Plan Inicial + Fuerza',
    valorMensual: 89990,
    moneda: 'CLP',
    modalidadIds: ['mod-powerlifting', 'mod-fuerza'],
  },
  {
    id: 'plan-beca',
    workspaceId: WORKSPACE_DEMO.id,
    nombre: 'Beca / exento demo',
    valorMensual: 0,
    moneda: 'CLP',
    modalidadIds: ['mod-powerlifting'],
  },
  {
    id: 'plan-alt',
    workspaceId: WORKSPACE_ALT.id,
    nombre: 'Plan ALT (no visible)',
    valorMensual: 50000,
    moneda: 'CLP',
    modalidadIds: ['mod-alt'],
  },
];

/**
 * Asignaciones alumno→plan del coach visible + una del coach alt (aislamiento).
 */
export const ASIGNACIONES_SEED = [
  {
    alumnoId: 'alu-01',
    planId: 'plan-inicial',
    coachId: COACH_DEMO.id,
    workspaceId: WORKSPACE_DEMO.id,
    modalidadIds: ['mod-powerlifting'],
    medioPreferido: 'transferencia',
    observacionFinanciera: 'Prefiere transferencia el día 5.',
  },
  {
    alumnoId: 'alu-02',
    planId: 'plan-inicial',
    coachId: COACH_DEMO.id,
    workspaceId: WORKSPACE_DEMO.id,
    modalidadIds: ['mod-powerlifting'],
    medioPreferido: 'tarjeta',
    observacionFinanciera: '',
  },
  {
    alumnoId: 'alu-03',
    planId: 'plan-mixto',
    coachId: COACH_DEMO.id,
    workspaceId: WORKSPACE_DEMO.id,
    modalidadIds: ['mod-powerlifting', 'mod-fuerza'],
    medioPreferido: 'link',
    observacionFinanciera: 'Pago vía link demo.',
  },
  {
    alumnoId: 'alu-04',
    planId: 'plan-comp',
    coachId: COACH_DEMO.id,
    workspaceId: WORKSPACE_DEMO.id,
    modalidadIds: ['mod-powerlifting'],
    medioPreferido: 'transferencia',
    observacionFinanciera: '',
  },
  {
    alumnoId: 'alu-05',
    planId: 'plan-comp',
    coachId: COACH_DEMO.id,
    workspaceId: WORKSPACE_DEMO.id,
    modalidadIds: ['mod-powerlifting'],
    medioPreferido: 'efectivo',
    observacionFinanciera: 'Seguimiento de mora suave.',
  },
  {
    alumnoId: 'alu-06',
    planId: 'plan-comp',
    coachId: COACH_DEMO.id,
    workspaceId: WORKSPACE_DEMO.id,
    modalidadIds: ['mod-powerlifting'],
    medioPreferido: 'transferencia',
    observacionFinanciera: '',
  },
  {
    alumnoId: 'alu-07',
    planId: 'plan-beca',
    coachId: COACH_DEMO.id,
    workspaceId: WORKSPACE_DEMO.id,
    modalidadIds: ['mod-powerlifting'],
    medioPreferido: 'efectivo',
    observacionFinanciera: 'Beca parcial demo — cargo exento.',
  },
  {
    alumnoId: 'alu-alt-01',
    planId: 'plan-alt',
    coachId: COACH_ALT.id,
    workspaceId: WORKSPACE_ALT.id,
    modalidadIds: ['mod-alt'],
    medioPreferido: 'transferencia',
    observacionFinanciera: 'Solo aislamiento.',
  },
];

/**
 * Cargos del período septiembre 2026 (+ previos parciales para variación).
 * Estados iniciales coherentes con FECHA_REF_FINANZAS = 2026-09-23.
 */
export function cargosSeed() {
  return [
    {
      id: 'cargo-01',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-01',
      planId: 'plan-inicial',
      modalidadIds: ['mod-powerlifting'],
      monto: 69990,
      moneda: 'CLP',
      vencimiento: '2026-09-05',
      estado: 'overdue',
      periodo: '2026-09',
    },
    {
      id: 'cargo-02',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-02',
      planId: 'plan-inicial',
      modalidadIds: ['mod-powerlifting'],
      monto: 69990,
      moneda: 'CLP',
      vencimiento: '2026-09-05',
      estado: 'paid',
      periodo: '2026-09',
    },
    {
      id: 'cargo-03',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-03',
      planId: 'plan-mixto',
      modalidadIds: ['mod-powerlifting', 'mod-fuerza'],
      monto: 89990,
      moneda: 'CLP',
      vencimiento: '2026-09-28',
      estado: 'pending',
      periodo: '2026-09',
    },
    {
      id: 'cargo-04',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-04',
      planId: 'plan-comp',
      modalidadIds: ['mod-powerlifting'],
      monto: 120000,
      moneda: 'CLP',
      vencimiento: '2026-09-10',
      estado: 'paid',
      periodo: '2026-09',
    },
    {
      id: 'cargo-05',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-05',
      planId: 'plan-comp',
      modalidadIds: ['mod-powerlifting'],
      monto: 120000,
      moneda: 'CLP',
      vencimiento: '2026-09-15',
      estado: 'overdue',
      periodo: '2026-09',
    },
    {
      id: 'cargo-06',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-06',
      planId: 'plan-comp',
      modalidadIds: ['mod-powerlifting'],
      monto: 120000,
      moneda: 'CLP',
      vencimiento: '2026-09-30',
      estado: 'pending',
      periodo: '2026-09',
    },
    {
      id: 'cargo-07',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-07',
      planId: 'plan-beca',
      modalidadIds: ['mod-powerlifting'],
      monto: 0,
      moneda: 'CLP',
      vencimiento: '2026-09-05',
      estado: 'exempt',
      periodo: '2026-09',
    },
    {
      id: 'cargo-alt-01',
      workspaceId: WORKSPACE_ALT.id,
      coachId: COACH_ALT.id,
      alumnoId: 'alu-alt-01',
      planId: 'plan-alt',
      modalidadIds: ['mod-alt'],
      monto: 50000,
      moneda: 'CLP',
      vencimiento: '2026-09-10',
      estado: 'paid',
      periodo: '2026-09',
    },
  ];
}

/** Cargos agosto (previos) — permiten alerta de variación si cobrado baja. */
export function cargosPreviosSeed() {
  return [
    {
      id: 'cargo-prev-01',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-01',
      planId: 'plan-inicial',
      modalidadIds: ['mod-powerlifting'],
      monto: 69990,
      moneda: 'CLP',
      vencimiento: '2026-08-05',
      estado: 'paid',
      periodo: '2026-08',
    },
    {
      id: 'cargo-prev-02',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-02',
      planId: 'plan-inicial',
      modalidadIds: ['mod-powerlifting'],
      monto: 69990,
      moneda: 'CLP',
      vencimiento: '2026-08-05',
      estado: 'paid',
      periodo: '2026-08',
    },
    {
      id: 'cargo-prev-04',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-04',
      planId: 'plan-comp',
      modalidadIds: ['mod-powerlifting'],
      monto: 120000,
      moneda: 'CLP',
      vencimiento: '2026-08-10',
      estado: 'paid',
      periodo: '2026-08',
    },
    {
      id: 'cargo-prev-05',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-05',
      planId: 'plan-comp',
      modalidadIds: ['mod-powerlifting'],
      monto: 120000,
      moneda: 'CLP',
      vencimiento: '2026-08-15',
      estado: 'paid',
      periodo: '2026-08',
    },
    {
      id: 'cargo-prev-06',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-06',
      planId: 'plan-comp',
      modalidadIds: ['mod-powerlifting'],
      monto: 120000,
      moneda: 'CLP',
      vencimiento: '2026-08-30',
      estado: 'paid',
      periodo: '2026-08',
    },
  ];
}

export function pagosSeed() {
  return [
    {
      id: 'pago-01',
      cargoId: 'cargo-02',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-02',
      planId: 'plan-inicial',
      monto: 69990,
      moneda: 'CLP',
      medio: 'tarjeta',
      fecha: '2026-09-04',
      comprobanteId: 'comp-demo-02',
    },
    {
      id: 'pago-02',
      cargoId: 'cargo-04',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-04',
      planId: 'plan-comp',
      monto: 120000,
      moneda: 'CLP',
      medio: 'transferencia',
      fecha: '2026-09-09',
      comprobanteId: 'comp-demo-04',
    },
    {
      id: 'pago-alt-01',
      cargoId: 'cargo-alt-01',
      workspaceId: WORKSPACE_ALT.id,
      coachId: COACH_ALT.id,
      alumnoId: 'alu-alt-01',
      planId: 'plan-alt',
      monto: 50000,
      moneda: 'CLP',
      medio: 'transferencia',
      fecha: '2026-09-08',
      comprobanteId: 'comp-alt-01',
    },
    {
      id: 'pago-prev-01',
      cargoId: 'cargo-prev-01',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-01',
      planId: 'plan-inicial',
      monto: 69990,
      moneda: 'CLP',
      medio: 'transferencia',
      fecha: '2026-08-04',
      comprobanteId: 'comp-prev-01',
    },
    {
      id: 'pago-prev-02',
      cargoId: 'cargo-prev-02',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-02',
      planId: 'plan-inicial',
      monto: 69990,
      moneda: 'CLP',
      medio: 'tarjeta',
      fecha: '2026-08-03',
      comprobanteId: 'comp-prev-02',
    },
    {
      id: 'pago-prev-04',
      cargoId: 'cargo-prev-04',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-04',
      planId: 'plan-comp',
      monto: 120000,
      moneda: 'CLP',
      medio: 'transferencia',
      fecha: '2026-08-09',
      comprobanteId: 'comp-prev-04',
    },
    {
      id: 'pago-prev-05',
      cargoId: 'cargo-prev-05',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-05',
      planId: 'plan-comp',
      monto: 120000,
      moneda: 'CLP',
      medio: 'efectivo',
      fecha: '2026-08-14',
      comprobanteId: 'comp-prev-05',
    },
    {
      id: 'pago-prev-06',
      cargoId: 'cargo-prev-06',
      workspaceId: WORKSPACE_DEMO.id,
      coachId: COACH_DEMO.id,
      alumnoId: 'alu-06',
      planId: 'plan-comp',
      monto: 120000,
      moneda: 'CLP',
      medio: 'transferencia',
      fecha: '2026-08-28',
      comprobanteId: 'comp-prev-06',
    },
  ];
}

export const MEDIOS_SEED = [
  { id: 'medio-transferencia', clave: 'transferencia', etiqueta: 'transferencia' },
  { id: 'medio-tarjeta', clave: 'tarjeta', etiqueta: 'tarjeta' },
  { id: 'medio-efectivo', clave: 'efectivo', etiqueta: 'efectivo' },
  { id: 'medio-link', clave: 'link', etiqueta: 'link de pago demo' },
];

export function finanzasInicial() {
  const cargosPeriodo = cargosSeed();
  const cargosPrevios = cargosPreviosSeed();
  return {
    fechaRef: FECHA_REF_FINANZAS,
    periodo: '2026-09',
    workspaceActivoId: WORKSPACE_DEMO.id,
    coachActivoId: COACH_DEMO.id,
    workspaces: [
      { ...WORKSPACE_DEMO },
      { ...WORKSPACE_ALT },
    ],
    coaches: [
      { ...COACH_DEMO },
      { ...COACH_ALT },
    ],
    modalidades: MODALIDADES_FIN.map((m) => ({ ...m })),
    planes: PLANES_SEED.map((p) => ({ ...p, modalidadIds: [...p.modalidadIds] })),
    asignaciones: ASIGNACIONES_SEED.map((a) => ({
      ...a,
      modalidadIds: [...a.modalidadIds],
    })),
    cargos: [...cargosPeriodo, ...cargosPrevios],
    pagos: pagosSeed(),
    medios: MEDIOS_SEED.map((m) => ({ ...m })),
    linksPago: [],
    auditoria: [
      {
        id: 'aud-001',
        ts: '2026-09-01T12:00:00.000Z',
        workspaceId: WORKSPACE_DEMO.id,
        coachId: COACH_DEMO.id,
        accion: 'seed_finanzas',
        detalle: 'Datos financieros ficticios cargados',
      },
    ],
    asistenteEstados: {},
  };
}
