import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEngine } from '../engine/conversation.js';
import { crearIntentService, INTENCIONES } from '../engine/intent.js';
import { clonarDemo } from '../data/demo.js';

function limpio() {
  const d = clonarDemo();
  d.bookings = [];
  d.leads = [];
  d.conversations = [];
  d.nextBookingSeq = 1;
  d.nextLeadSeq = 1;
  d.nextConvSeq = 1;
  return crearEngine(d);
}

test('inicio y selección de sede', () => {
  const engine = limpio();
  const start = engine.iniciar();
  assert.match(start.mensajes[0].texto, /sede/i);
  const r = engine.procesar(start.conversacion.id, 'Félix García');
  assert.equal(r.conversacion.sede, 'Félix García');
  assert.match(r.mensajes[0].texto, /Qué quieres hacer/i);
});

test('detección de intención (12 ejemplos)', () => {
  const ai = crearIntentService();
  const cases = [
    ['quiero entrenar', INTENCIONES.CLASES],
    ['qué clases tienen', INTENCIONES.CLASES],
    ['quiero reservar', INTENCIONES.RESERVA],
    ['quiero reservar spinning', INTENCIONES.RESERVA],
    ['quiero probar el gimnasio', INTENCIONES.TRIAL],
    ['quiero una clase gratis', INTENCIONES.TRIAL],
    ['cuánto cuesta', INTENCIONES.PLANES],
    ['qué planes tienen', INTENCIONES.PLANES],
    ['quiero hablar con alguien', INTENCIONES.HUMANO],
    ['necesito ayuda', INTENCIONES.HUMANO],
    ['tengo una reserva', INTENCIONES.LOOKUP],
    ['hola, quiero probar el gimnasio', INTENCIONES.TRIAL],
  ];
  for (const [text, intent] of cases) {
    const r = ai.detectar(text);
    assert.equal(r.intencion, intent, text);
  }
  const spin = ai.detectar('quiero reservar spinning');
  assert.equal(spin.entidades.clase, 'Spinning');
});

test('reserva disponible genera GYM-2026-0001', () => {
  const engine = limpio();
  const { conversacion } = engine.iniciar();
  const id = conversacion.id;
  engine.procesar(id, 'Félix García');
  engine.procesar(id, '2');
  engine.procesar(id, 'Spinning Lunes 19:00');
  engine.procesar(id, 'Ana Demo');
  engine.procesar(id, '912345678');
  engine.procesar(id, 'omitir');
  const done = engine.procesar(id, 'confirmar');
  assert.match(done.mensajes[0].texto, /GYM-2026-0001/);
  assert.equal(engine.listarReservas().length, 1);
  const spinning = engine.listarClases('Félix García').find((c) => c.nombre === 'Spinning');
  assert.equal(spinning.reserved, 9);
});

test('clase agotada rechazada', () => {
  const engine = limpio();
  const { conversacion } = engine.iniciar();
  const id = conversacion.id;
  engine.procesar(id, 'Alta Vista');
  engine.procesar(id, '2');
  const r = engine.procesar(id, 'Cross Training Jueves 19:30');
  const blob = `${r.mensajes[0].texto} ${(r.mensajes[0].opciones || []).map((o) => o.etiqueta).join(' ')}`;
  assert.match(blob, /completa|espera/i);
  assert.equal(engine.listarReservas().length, 0);
});

test('reserva duplicada rechazada', () => {
  const engine = limpio();
  const { conversacion } = engine.iniciar();
  const id = conversacion.id;
  engine.procesar(id, 'Félix García');
  engine.procesar(id, '2');
  engine.procesar(id, 'Spinning Lunes 19:00');
  engine.procesar(id, 'Ana Demo');
  engine.procesar(id, '912345678');
  engine.procesar(id, 'omitir');
  engine.procesar(id, 'confirmar');
  engine.procesar(id, '2');
  engine.procesar(id, 'Spinning Lunes 19:00');
  engine.procesar(id, 'Ana Demo');
  engine.procesar(id, '912345678');
  engine.procesar(id, 'omitir');
  const dup = engine.procesar(id, 'confirmar');
  assert.match(dup.mensajes[0].texto, /Ya tienes una reserva/);
  assert.equal(engine.listarReservas().length, 1);
});

test('trial crea lead', () => {
  const engine = limpio();
  const { conversacion } = engine.iniciar();
  const id = conversacion.id;
  engine.procesar(id, 'Alta Vista');
  engine.procesar(id, '3');
  engine.procesar(id, 'Bruno Trial');
  engine.procesar(id, '+56 9 8765 4321');
  engine.procesar(id, 'Bajar de peso');
  engine.procesar(id, 'Yoga');
  const r = engine.procesar(id, 'Miércoles');
  assert.match(r.mensajes[0].texto, /clase de prueba/);
  assert.equal(engine.listarLeads().length, 1);
  assert.equal(engine.listarLeads()[0].objetivo, 'Bajar de peso');
});

test('humano deja waiting_human', () => {
  const engine = limpio();
  const { conversacion } = engine.iniciar();
  const id = conversacion.id;
  engine.procesar(id, 'Félix García');
  engine.procesar(id, 'quiero hablar con alguien');
  const r = engine.procesar(id, 'Necesito horarios de la mañana');
  assert.equal(r.conversacion.status, 'waiting_human');
  assert.match(r.mensajes[0].texto, /ejecutivo/);
});

test('reset restaura datos', () => {
  const engine = crearEngine(clonarDemo());
  const start = engine.iniciar();
  engine.procesar(start.conversacion.id, 'Félix García');
  const before = engine.listarReservas().length;
  assert.equal(before, 2);
  const d = engine.exportar();
  d.bookings = [];
  engine.hidratar(d);
  assert.equal(engine.listarReservas().length, 0);
  engine.reset();
  assert.equal(engine.listarReservas().length, 2);
  assert.equal(engine.listarReservas()[0].codigo, 'GYM-2026-0001');
});

test('ver planes muestra los tres valores oficiales', () => {
  const engine = limpio();
  const { conversacion } = engine.iniciar();
  engine.procesar(conversacion.id, 'Félix García');
  const r = engine.procesar(conversacion.id, '4');
  assert.match(r.mensajes[0].texto, /\$69\.990 CLP/);
  assert.match(r.mensajes[0].texto, /\$189\.990 CLP/);
  assert.match(r.mensajes[0].texto, /\$649\.990 CLP/);
  assert.match(r.mensajes[0].texto, /Valores demostrativos para este prototipo/);
});
