/**
 * Regresión: escala de bienestar Forja Demo (5 = mejor, 1 = peor).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ESCALA_DIR,
  DIMENSIONES,
  descripcionDimension,
  evaluarAlertaWellness,
  requiereAlertaWellness,
} from '../forja-demo/js/wellness-scale.js';
import { PANEL_SEED, SUGERENCIAS_IA_SEED, estadoInicial } from '../forja-demo/js/data.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function wellnessBase(overrides = {}) {
  return {
    fatiga: 5,
    sueno: 5,
    dolorMuscular: 5,
    estres: 5,
    animo: 5,
    dolorActual: 'no',
    ...overrides,
  };
}

test('escala: contrato 5=mejor / 1=peor y descripciones', () => {
  assert.match(ESCALA_DIR, /1 = peor estado/);
  assert.match(ESCALA_DIR, /5 = mejor estado/);
  assert.equal(descripcionDimension('fatiga', 5), 'Muy fresco');
  assert.equal(descripcionDimension('fatiga', 1), 'Siempre cansado');
  assert.equal(descripcionDimension('sueno', 5), 'Muy reparador');
  assert.equal(descripcionDimension('sueno', 1), 'Insomnio');
  assert.equal(descripcionDimension('dolorMuscular', 5), 'Se siente muy bien');
  assert.equal(descripcionDimension('dolorMuscular', 1), 'Muy adolorido');
  assert.equal(descripcionDimension('estres', 5), 'Muy relajado');
  assert.equal(descripcionDimension('estres', 1), 'Muy estresado');
  assert.equal(descripcionDimension('animo', 5), 'Muy positivo');
  assert.equal(descripcionDimension('animo', 1), 'Muy irritable o decaído');
  assert.ok(DIMENSIONES.fatiga && DIMENSIONES.estres && DIMENSIONES.animo);
});

test('alerta: todas las dimensiones en 5 no generan alerta', () => {
  const r = evaluarAlertaWellness(wellnessBase());
  assert.equal(r.alerta, false);
  assert.deepEqual(r.motivos, []);
  assert.equal(requiereAlertaWellness(wellnessBase()), false);
});

test('alerta: una dimensión en 1 genera alerta', () => {
  assert.equal(requiereAlertaWellness(wellnessBase({ fatiga: 1 })), true);
  assert.equal(requiereAlertaWellness(wellnessBase({ sueno: 1 })), true);
  assert.equal(requiereAlertaWellness(wellnessBase({ estres: 1 })), true);
  assert.equal(requiereAlertaWellness(wellnessBase({ animo: 1 })), true);
  assert.equal(requiereAlertaWellness(wellnessBase({ dolorMuscular: 1 })), true);
});

test('alerta: dos dimensiones en 2 generan alerta', () => {
  assert.equal(
    requiereAlertaWellness(wellnessBase({ fatiga: 2, sueno: 2 })),
    true,
  );
  assert.equal(
    requiereAlertaWellness(wellnessBase({ estres: 2, animo: 2 })),
    true,
  );
});

test('alerta: una sola dimensión en 2 (resto 5) no genera alerta', () => {
  assert.equal(requiereAlertaWellness(wellnessBase({ fatiga: 2 })), false);
  assert.equal(requiereAlertaWellness(wellnessBase({ estres: 2 })), false);
});

test('alerta: dolor alto genera alerta independientemente de puntuaciones', () => {
  assert.equal(
    requiereAlertaWellness(wellnessBase({ dolorActual: 'alto' })),
    true,
  );
  const r = evaluarAlertaWellness(wellnessBase({ dolorActual: 'alto' }));
  assert.ok(r.motivos.some((m) => m === 'dolor_alto'));
});

test('alerta: 4 o 5 no son tratados como estados negativos', () => {
  assert.equal(requiereAlertaWellness(wellnessBase({ fatiga: 4 })), false);
  assert.equal(requiereAlertaWellness(wellnessBase({ fatiga: 5 })), false);
  assert.equal(requiereAlertaWellness(wellnessBase({ estres: 4 })), false);
  assert.equal(requiereAlertaWellness(wellnessBase({ estres: 5 })), false);
  assert.equal(
    requiereAlertaWellness(
      wellnessBase({ fatiga: 5, sueno: 5, dolorMuscular: 4, estres: 5, animo: 4 }),
    ),
    false,
  );
});

test('semilla e IA: no contienen escala invertida (fatiga/estrés altos como malos)', () => {
  const seed = JSON.stringify(estadoInicial());
  const panel = JSON.stringify(PANEL_SEED);
  const sug = JSON.stringify(SUGERENCIAS_IA_SEED);
  const blob = `${seed}\n${panel}\n${sug}`;

  // Patrones de la escala invertida antigua
  assert.doesNotMatch(blob, /Fatiga 5\/5/);
  assert.doesNotMatch(blob, /Estrés 4\/5/);
  assert.doesNotMatch(blob, /fatiga\s*≥\s*4/i);
  assert.doesNotMatch(blob, /fatiga\s*>=\s*4/i);
  assert.doesNotMatch(blob, /fatiga alta/i);

  // Semilla corregida usa dirección correcta
  assert.match(PANEL_SEED.alertasBienestar[0].detalle, /Fatiga 1\/5/);
  assert.match(PANEL_SEED.alertasBienestar[1].detalle, /Estrés 2\/5/);
  const sugBienestar = SUGERENCIAS_IA_SEED.find((s) => s.id === 'sug-3');
  assert.match(sugBienestar.evidencia, /fatiga\s*≤\s*2/);
  assert.match(sugBienestar.evidencia, /1=peor/);
});

test('wellness.js usa wellness-scale y leyenda de dirección', () => {
  const code = readFileSync(join(ROOT, 'forja-demo/js/views/wellness.js'), 'utf8');
  assert.match(code, /wellness-scale\.js/);
  assert.match(code, /requiereAlertaWellness/);
  assert.match(code, /ESCALA_DIR/);
  assert.doesNotMatch(code, /w\.fatiga\s*===\s*5/);
  assert.doesNotMatch(code, /w\.estres\s*===\s*5/);
});
