import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fechaHoy, fechaDesdeQuery, weekdayEs } from '../engine/dates.js';
import { crearEngine } from '../engine/conversation.js';
import { clonarDemo } from '../data/demo.js';

test('fechaHoy es YYYY-MM-DD de ahora y ?fecha= la sobreescribe', () => {
  assert.match(fechaHoy(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(fechaDesdeQuery('?fecha=2026-09-11'), '2026-09-11');
  assert.equal(fechaDesdeQuery('t=soma&fecha=2026-09-14'), '2026-09-14');
  assert.equal(fechaDesdeQuery(''), null);
  assert.equal(fechaDesdeQuery('?fecha=13-09-2026'), null);
});

test('hoy y mañana del chat usan la fecha inyectada', () => {
  const fechaRef = '2026-09-14';
  assert.equal(weekdayEs(fechaRef), 'Lunes');
  const engine = crearEngine(clonarDemo('soma', fechaRef), 'soma', { fechaRef });
  const { conversacion } = engine.iniciar();
  const r = engine.procesar(conversacion.id, 'crosstraining hoy');
  assert.match(r.mensajes[0].texto, /hoy lunes 14/i);
  assert.match(r.mensajes[0].texto, /Crosstraining|07:00|18:00/);
});
