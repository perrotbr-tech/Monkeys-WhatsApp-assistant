import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEngine } from '../engine/conversation.js';
import { crearMemoria } from '../engine/store.js';
import { clonarDemo } from '../data/demo.js';
import { crearIntentService, INTENCIONES } from '../engine/intent.js';

const FECHA = '2026-09-14';

function demoSoma() {
  return clonarDemo('soma', FECHA);
}

function engineSoma(datos = demoSoma()) {
  return crearEngine(datos, 'soma', { fechaRef: FECHA });
}

function socioPorId(datos, id) {
  return datos.socios.find((s) => s.id === id);
}

function reservarChat(engine, claseValor, nombre, tel) {
  const start = engine.iniciar();
  const id = start.conversacion.id;
  engine.procesar(id, 'reservar mi cupo');
  engine.procesar(id, claseValor);
  engine.procesar(id, nombre);
  engine.procesar(id, tel);
  engine.procesar(id, 'omitir');
  return { id, done: engine.procesar(id, 'confirmar') };
}

function textosBot(engine, conversacionId) {
  const conv = engine.memoria.getConversacion(engine.tenantId, conversacionId);
  return (conv.messages || []).filter((m) => m.autor === 'bot').map((m) => m.texto);
}

test('cupos agotados rechaza, no reserva y crea tarea_equipo', () => {
  const datos = demoSoma();
  const socio = socioPorId(datos, 'sm01');
  const plan = datos.plans.find((p) => p.id === socio.planId);
  socio.cuposUsadosMes = plan.cuposMes;
  const engine = engineSoma(datos);
  const { done } = reservarChat(engine, 'Crosstraining Lunes 18:00', socio.nombre, socio.telefono);
  assert.match(done.mensajes[0].texto, new RegExp(`Ya usaste los ${plan.cuposMes} cupos de tu plan este mes`));
  assert.match(done.mensajes[0].texto, /equipo te cuente cómo ampliarlo/);
  assert.equal(/upgrade/i.test(done.mensajes[0].texto), false);
  assert.equal(/\$\d/.test(done.mensajes[0].texto), false);
  assert.equal(engine.listarReservas().length, 0);
  const tareas = engine.memoria.listarAcciones('soma').filter((a) => a.motivo === 'cupos agotados');
  assert.equal(tareas.length, 1);
  assert.equal(tareas[0].tipo, 'tarea_equipo');
  assert.equal(tareas[0].prioridad, 'media');
  assert.equal(tareas[0].socioId, socio.id);
});

test('disciplina no incluida rechaza y deriva al equipo', () => {
  const datos = demoSoma();
  const socio = socioPorId(datos, 'sm03');
  const plan = datos.plans.find((p) => p.id === socio.planId);
  assert.equal(plan.disciplinasIncluidas.includes('Pilates'), true);
  assert.equal(plan.disciplinasIncluidas.includes('Crosstraining'), false);
  const engine = engineSoma(datos);
  const { done } = reservarChat(engine, 'Crosstraining Lunes 07:00', socio.nombre, socio.telefono);
  assert.match(done.mensajes[0].texto, /no incluye Crosstraining/i);
  assert.match(done.mensajes[0].texto, /equipo/);
  assert.equal(engine.listarReservas().length, 0);
  const tareas = engine.memoria.listarAcciones('soma').filter((a) => String(a.motivo).includes('disciplina no incluida'));
  assert.equal(tareas.length, 1);
  assert.equal(tareas[0].tipo, 'tarea_equipo');
});

test('tercera reserva del mismo día rechaza con máximo 2', () => {
  const datos = demoSoma();
  const socio = socioPorId(datos, 'sm01');
  socio.cuposUsadosMes = 0;
  const mem = crearMemoria(datos);
  const tel = socio.telefono;
  const r1 = mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-07', nombre: socio.nombre, telefono: tel, sede: 'SOMA Antofagasta',
  });
  const r2 = mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-18', nombre: socio.nombre, telefono: tel, sede: 'SOMA Antofagasta',
  });
  const r3 = mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-19', nombre: socio.nombre, telefono: tel, sede: 'SOMA Antofagasta',
  });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r3.ok, false);
  assert.equal(r3.codigo, 'MAX_DIA');
  assert.match(r3.error, /máximo 2/);
  assert.equal(mem.listarReservas('soma').length, 2);
});

test('cancelar reserva devuelve el cupo del plan', () => {
  const datos = demoSoma();
  const socio = socioPorId(datos, 'sm01');
  socio.cuposUsadosMes = 3;
  const mem = crearMemoria(datos);
  const r = mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-18', nombre: socio.nombre, telefono: socio.telefono, sede: 'SOMA Antofagasta',
  });
  assert.equal(r.ok, true);
  assert.equal(r.cuposRestantes, 4);
  const vivo = mem.buscarSocioPorTelefono('soma', socio.telefono);
  assert.equal(vivo.cuposUsadosMes, 4);
  const cancel = mem.cancelarReserva('soma', r.booking.codigo);
  assert.equal(cancel.ok, true);
  assert.equal(mem.buscarSocioPorTelefono('soma', socio.telefono).cuposUsadosMes, 3);
});

test('lead sin plan reserva sin regla de cupos y confirma cupos restantes en socio', () => {
  const datos = demoSoma();
  const socio = socioPorId(datos, 'sm01');
  const plan = datos.plans.find((p) => p.id === socio.planId);
  const usados = socio.cuposUsadosMes;
  const engine = engineSoma(datos);
  const lead = reservarChat(engine, 'Crosstraining Lunes 18:00', 'Ana Soma', '912345678');
  assert.match(lead.done.mensajes[0].texto, /SOMA-2026-0001/);
  assert.equal(/Te quedan/.test(lead.done.mensajes[0].texto), false);
  const socioChat = reservarChat(engine, 'Crosstraining Lunes 19:00', socio.nombre, socio.telefono);
  assert.match(socioChat.done.mensajes[0].texto, /Te quedan \d+ cupos este mes/);
  const quedan = plan.cuposMes - (usados + 1);
  assert.match(socioChat.done.mensajes[0].texto, new RegExp(`Te quedan ${quedan} cupos este mes`));
});

test('consulta de cupos responde restantes y renovación', () => {
  const ai = crearIntentService();
  assert.equal(ai.detectar('¿Cuántos cupos me quedan?').intencion, INTENCIONES.CUPOS);
  const datos = demoSoma();
  const socio = socioPorId(datos, 'sm01');
  const plan = datos.plans.find((p) => p.id === socio.planId);
  const engine = engineSoma(datos);
  const start = engine.iniciar();
  const id = start.conversacion.id;
  engine.procesar(id, '¿Cuántos cupos me quedan?');
  const r = engine.procesar(id, socio.telefono);
  const quedan = plan.cuposMes - socio.cuposUsadosMes;
  assert.match(r.mensajes[0].texto, new RegExp(`Te quedan ${quedan} de ${plan.cuposMes} cupos este mes`));
  assert.match(r.mensajes[0].texto, /se renuevan el 1 de cada mes/i);
});

test('ver planes agrupa por familia, de a 4, y ningún texto sugiere upgrade', () => {
  const engine = engineSoma();
  const start = engine.iniciar();
  const id = start.conversacion.id;
  const first = engine.procesar(id, 'ver planes');
  assert.equal(first.mensajes[0].texto.split('\n').filter((l) => l.startsWith('•')).length <= 4, true);
  assert.match(first.mensajes[0].texto, /CrossTraining/);
  assert.match(first.mensajes[0].texto, /59\.000/);
  assert.match(first.mensajes[0].texto, /Valores según planes publicados/);
  assert.equal(first.mensajes[0].opciones.some((o) => /ver más/i.test(o.etiqueta)), true);
  engine.procesar(id, 'ver mas planes');
  engine.procesar(id, 'ver mas planes');
  engine.procesar(id, 'ver mas planes');
  const blob = textosBot(engine, id).join('\n');
  assert.match(blob, /Small Group/);
  assert.match(blob, /HappyFLEX/);
  assert.match(blob, /Kids|Funcional Kids/);
  assert.match(blob, /Pases|Pase Diario/);
  assert.equal(/\bupgrade\b/i.test(blob), false);
  assert.equal(/plan más caro|plan mas caro/i.test(blob), false);
});

test('monkeys sigue sin cupos por plan y con precios demo', () => {
  const d = clonarDemo('monkeys', FECHA);
  d.bookings = [];
  d.nextBookingSeq = 1;
  assert.equal(d.plans.every((p) => p.cuposMes == null), true);
  const engine = crearEngine(d, 'monkeys', { fechaRef: FECHA });
  const start = engine.iniciar();
  const id = start.conversacion.id;
  engine.procesar(id, 'Félix García');
  engine.procesar(id, 'reservar mi cupo');
  engine.procesar(id, 'Spinning');
  engine.procesar(id, 'Ana Demo');
  engine.procesar(id, '912345678');
  engine.procesar(id, 'omitir');
  const done = engine.procesar(id, 'confirmar');
  assert.match(done.mensajes[0].texto, /GYM-2026-0001/);
  assert.equal(/Te quedan/.test(done.mensajes[0].texto), false);
  engine.procesar(id, 'ver planes');
  const planes = engine.procesar(id, 'ver planes');
  assert.match(planes.mensajes[0].texto, /\$69\.990 CLP/);
  assert.match(planes.mensajes[0].texto, /Valores demostrativos para este prototipo/);
  assert.equal(/\bupgrade\b/i.test(planes.mensajes[0].texto), false);
});
