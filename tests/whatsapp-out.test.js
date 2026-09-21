import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEngine } from '../engine/conversation.js';
import { clonarDemo } from '../data/demo.js';
import { INTENCIONES } from '../engine/intent.js';
import { validarMensaje } from '../engine/whatsapp-out.js';

const FECHA = '2026-09-14';

function engineDe(tenantId) {
  return crearEngine(clonarDemo(tenantId, FECHA), tenantId, { fechaRef: FECHA });
}

function assertWa(mensajes, legal = false) {
  for (const m of mensajes || []) {
    if (m.autor && m.autor !== 'bot') continue;
    const v = validarMensaje(m, { legal: legal || m.legal });
    assert.equal(v.ok, true, `${v.error}: ${m.texto}`);
    assert.equal((m.opciones || []).length <= 10, true, 'opciones');
    if (m.tipoOpciones === 'botones') {
      assert.equal((m.opciones || []).length <= 3, true, 'botones');
    }
    assert.equal(/^\s*\d+\.\s/m.test(m.texto || ''), false, m.texto);
  }
}

function recorrer(engine, textos) {
  const start = engine.iniciar();
  assertWa(start.mensajes);
  const id = start.conversacion.id;
  let last = start;
  for (const t of textos) {
    last = engine.procesar(id, t);
    assertWa(last.mensajes);
  }
  return { id, last };
}

test('reserva sin día ni disciplina pregunta disciplina y nunca lista más de 10', () => {
  const engine = engineDe('soma');
  const start = engine.iniciar();
  const id = start.conversacion.id;
  const r1 = engine.procesar(id, 'reservar mi cupo');
  assertWa(r1.mensajes);
  assert.match(r1.mensajes[0].texto, /disciplina/i);
  assert.equal(r1.mensajes[0].opciones.length <= 10, true);
  assert.equal(r1.mensajes[0].opciones.length > 1, true);
  const r2 = engine.procesar(id, 'Crosstraining');
  assertWa(r2.mensajes);
  assert.match(r2.mensajes[0].texto, /día|Hoy/i);
  assert.equal(r2.mensajes[0].opciones.length <= 3, true);
  const r3 = engine.procesar(id, 'mañana');
  assertWa(r3.mensajes);
  assert.equal(r3.mensajes[0].opciones.length <= 10, true);
  assert.equal(r3.mensajes[0].opciones.some((o) => o.etiqueta.includes('completa') || /\d{2}:\d{2}/.test(o.etiqueta)), true);
});

test('reservar crosstraining mañana salta a la lista de horas', () => {
  const engine = engineDe('soma');
  const { conversacion } = engine.iniciar();
  const r = engine.procesar(conversacion.id, 'reservar crosstraining mañana');
  assertWa(r.mensajes);
  assert.equal(/disciplina/i.test(r.mensajes[0].texto), false);
  assert.equal(/Para qué día/i.test(r.mensajes[0].texto), false);
  assert.match(r.mensajes[0].texto, /Horarios|Crosstraining/i);
  assert.equal(r.mensajes[0].opciones.length <= 10, true);
  assert.equal(r.mensajes[0].opciones.length >= 1, true);
});

test('todas las intenciones de soma y monkeys respetan WhatsApp', () => {
  const frases = [
    ['ver clases', 'hoy', 'Crosstraining'],
    ['reservar mi cupo', 'Crosstraining', 'hoy'],
    ['probar una clase'],
    ['ver planes', 'ver mas planes'],
    ['consultar'],
    ['hablar con el equipo', 'horarios'],
    ['¿Cuántos cupos me quedan?'],
    ['menu'],
    ['ayuda'],
  ];
  const soma = engineDe('soma');
  const s = soma.iniciar();
  assertWa(s.mensajes);
  const sid = s.conversacion.id;
  for (const cadena of frases) {
    for (const t of cadena) {
      const r = soma.procesar(sid, t);
      assertWa(r.mensajes);
    }
    soma.procesar(sid, 'menu');
  }

  const monkeys = engineDe('monkeys');
  const m = monkeys.iniciar();
  assertWa(m.mensajes);
  const mid = m.conversacion.id;
  monkeys.procesar(mid, 'Félix García');
  for (const cadena of [
    ['ver clases', 'hoy'],
    ['reservar mi cupo', 'Spinning', 'Lunes'],
    ['probar una clase'],
    ['ver planes'],
    ['consultar'],
    ['hablar con el equipo', 'horarios'],
    ['menu'],
  ]) {
    for (const t of cadena) {
      const r = monkeys.procesar(mid, t);
      assertWa(r.mensajes);
    }
    monkeys.procesar(mid, 'menu');
  }
});

test('INTENCIONES cubiertas en el recorrido de chat', () => {
  assert.equal(Boolean(INTENCIONES.RESERVA), true);
  const engine = engineDe('monkeys');
  recorrer(engine, ['Félix García', 'reservar mi cupo', 'Funcional', 'mañana']);
});
