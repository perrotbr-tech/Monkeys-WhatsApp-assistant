/** Planes publicados de SOMA (tienda pública). Solo tenant soma. */

const CT = ['Crosstraining', 'Hyrox'];
const SG = ['Crosstraining', 'Hyrox', 'Gymnastics', 'Weightlifting'];
const HF = ['Pilates'];
const KIDS = ['Functional Kids'];

function plan(partial) {
  const row = {
    tenantId: 'soma',
    maxSesionesDia: 2,
    cuposMes: null,
    disciplinasIncluidas: CT,
    periodo: 'mensual',
    destacado: false,
    ...partial,
  };
  if (row.monto == null) {
    row.monto = Number(String(row.precio || '').replace(/\D/g, '')) || 0;
  }
  return row;
}

export const PLANES_SOMA = [
  plan({
    id: 'ct-2', familia: 'CrossTraining', nombre: 'CrossTraining 2 sesiones/semana',
    precio: '$59.000', cuposMes: 8, disciplinasIncluidas: CT,
  }),
  plan({
    id: 'ct-3', familia: 'CrossTraining', nombre: 'CrossTraining 3 sesiones/semana',
    precio: '$70.000', cuposMes: 12, disciplinasIncluidas: CT,
  }),
  plan({
    id: 'ct-4', familia: 'CrossTraining', nombre: 'CrossTraining 4 sesiones/semana',
    precio: '$87.000', cuposMes: 16, disciplinasIncluidas: CT,
  }),
  plan({
    id: 'ct-5', familia: 'CrossTraining', nombre: 'CrossTraining 5 sesiones/semana',
    precio: '$99.000', cuposMes: 20, disciplinasIncluidas: CT,
  }),
  plan({
    id: 'sg-2', familia: 'Small Group', nombre: 'Small Group 2 veces/semana',
    precio: '$90.000', cuposMes: 8, disciplinasIncluidas: SG,
  }),
  plan({
    id: 'sg-3', familia: 'Small Group', nombre: 'Small Group 3 veces/semana',
    precio: '$115.000', cuposMes: 12, disciplinasIncluidas: SG, destacado: true,
  }),
  plan({
    id: 'sg-4', familia: 'Small Group', nombre: 'Small Group 4 veces/semana',
    precio: '$140.000', cuposMes: 16, disciplinasIncluidas: SG, destacado: true,
  }),
  plan({
    id: 'sg-5', familia: 'Small Group', nombre: 'Small Group 5 veces/semana',
    precio: '$167.000', cuposMes: 20, disciplinasIncluidas: SG,
  }),
  plan({
    id: 'hf-2', familia: 'HappyFLEX', nombre: 'HappyFLEX 2',
    precio: '$64.000', cuposMes: 8, disciplinasIncluidas: HF,
  }),
  plan({
    id: 'hf-3', familia: 'HappyFLEX', nombre: 'HappyFLEX 3',
    precio: '$82.000', cuposMes: 12, disciplinasIncluidas: HF,
  }),
  plan({
    id: 'hf-4', familia: 'HappyFLEX', nombre: 'HappyFLEX 4',
    precio: '$98.000', cuposMes: 16, disciplinasIncluidas: HF,
  }),
  plan({
    id: 'hf-5', familia: 'HappyFLEX', nombre: 'HappyFLEX 5',
    precio: '$115.000', cuposMes: 20, disciplinasIncluidas: HF,
  }),
  plan({
    id: 'kids', familia: 'Kids', nombre: 'Funcional Kids',
    precio: '$35.000', cuposMes: null, disciplinasIncluidas: KIDS, periodo: 'mensual',
  }),
  plan({
    id: 'sg-tri-2', familia: 'Small Group', nombre: 'Small Group Trimestral 2 veces/semana',
    precio: '$261.900', cuposMes: 8, disciplinasIncluidas: SG, periodo: 'trimestral',
  }),
  plan({
    id: 'sg-tri-3', familia: 'Small Group', nombre: 'Small Group Trimestral 3 veces/semana',
    precio: '$334.650', cuposMes: 12, disciplinasIncluidas: SG, periodo: 'trimestral',
  }),
  plan({
    id: 'pase-sg', familia: 'Pases', nombre: 'Pase Diario (Small Group)',
    precio: '$20.000', cuposMes: 1, maxSesionesDia: 1, disciplinasIncluidas: SG, periodo: 'pase',
  }),
  plan({
    id: 'pase-ct', familia: 'Pases', nombre: 'Pase Diario Open/CrossTraining',
    precio: '$10.000', cuposMes: 1, maxSesionesDia: 1, disciplinasIncluidas: CT, periodo: 'pase',
  }),
];

export function planSomaPorId(id) {
  return PLANES_SOMA.find((p) => p.id === id) || null;
}

const PLAN_POR_FAVORITA = {
  Crosstraining: ['ct-2', 'ct-3', 'ct-4', 'ct-5'],
  Hyrox: ['sg-2', 'sg-3', 'sg-4', 'sg-5'],
  Pilates: ['hf-2', 'hf-3', 'hf-4', 'hf-5'],
};

export function planIdDeSocioSoma(socio, indice) {
  if (indice === 11) return 'kids';
  const pool = PLAN_POR_FAVORITA[socio.claseFavorita] || ['ct-3'];
  return pool[indice % pool.length];
}
