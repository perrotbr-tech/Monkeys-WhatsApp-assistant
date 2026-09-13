import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoria } from '../engine/store.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation, FECHA_DEMO } from '../engine/automation.js';
import { clonarDemo, clonarMundo } from '../data/demo.js';
import { textoValido } from '../data/templates.js';
import { varsMarca, tenantActivo, buscarTenant } from '../data/tenants.js';

function textosDe(obj, acc = []) {
  if (typeof obj === 'string') acc.push(obj);
  else if (Array.isArray(obj)) obj.forEach((x) => textosDe(x, acc));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((x) => textosDe(x, acc));
  return acc;
}

test('aislamiento: listados, reservas, leads, acciones, campañas y conversaciones no cruzan', () => {
  const mem = crearMemoria(clonarMundo());
  mem.crearLead('soma', { nombre: 'Lead SOMA', telefono: '+56970000001', objetivo: 'Fuerza', clase: 'Hyrox', dia: 'Lunes', sede: 'SOMA Antofagasta' });
  mem.crearLead('monkeys', { nombre: 'Lead Gym', telefono: '+56970000002', objetivo: 'Yoga', clase: 'Yoga', dia: 'Miércoles', sede: 'Alta Vista' });
  mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-18',
    nombre: 'Reserva Soma',
    telefono: '+56970000003',
    sede: 'SOMA Antofagasta',
  });
  mem.crearConversacion('soma', { sede: 'SOMA Antofagasta', paso: 'menu' });
  mem.crearAccion('soma', { tipo: 'tarea_equipo', agente: 'retencion', socioId: 'sm01', motivo: 'demo', sedeId: 'SOMA Antofagasta' });

  for (const row of mem.listarClases('monkeys')) assert.equal(row.tenantId, 'monkeys');
  for (const row of mem.listarClases('soma')) assert.equal(row.tenantId, 'soma');
  for (const row of mem.listarReservas('monkeys')) assert.equal(row.tenantId, 'monkeys');
  for (const row of mem.listarReservas('soma')) assert.equal(row.tenantId, 'soma');
  for (const row of mem.listarLeads('monkeys')) assert.equal(row.tenantId, 'monkeys');
  for (const row of mem.listarLeads('soma')) assert.equal(row.tenantId, 'soma');
  for (const row of mem.listarConversaciones('monkeys')) assert.equal(row.tenantId, 'monkeys');
  for (const row of mem.listarConversaciones('soma')) assert.equal(row.tenantId, 'soma');
  for (const row of mem.listarAcciones('monkeys')) assert.equal(row.tenantId, 'monkeys');
  for (const row of mem.listarAcciones('soma')) assert.equal(row.tenantId, 'soma');
  for (const row of mem.listarCampanias('monkeys')) assert.equal(row.tenantId, 'monkeys');
  for (const row of mem.listarCampanias('soma')) assert.equal(row.tenantId, 'soma');

  assert.equal(mem.listarLeads('monkeys').some((l) => /SOMA/i.test(l.nombre)), false);
  assert.equal(mem.listarLeads('soma').some((l) => /Lead Gym/.test(l.nombre)), false);
  assert.equal(mem.listarReservas('monkeys').some((b) => b.codigo.startsWith('SOMA-')), false);
  assert.equal(mem.listarReservas('soma').some((b) => b.codigo.startsWith('GYM-')), false);
});

test('tema por tenant devuelve los colores correctos', () => {
  const monkeys = tenantActivo('monkeys');
  const soma = tenantActivo('soma');
  const vm = varsMarca(monkeys.marca);
  const vs = varsMarca(soma.marca);
  assert.equal(vm['--color-acento'], '#F5B400');
  assert.equal(vm['--color-fondo'], '#0B0B0B');
  assert.equal(vs['--color-acento'], '#8C8672');
  assert.equal(vs['--color-acento-2'], '#C9A96E');
  assert.equal(vs['--color-fondo'], '#0E0E0E');
  assert.equal(vs['--color-texto'], '#F2EFE9');
  assert.equal(buscarTenant('no-existe'), null);
});

test('reserva en soma genera código correlativo independiente SOMA-2026-0001', () => {
  const engine = crearEngine(clonarDemo('soma'), 'soma');
  const start = engine.iniciar();
  const id = start.conversacion.id;
  assert.equal(start.conversacion.sede, 'SOMA Antofagasta');
  engine.procesar(id, '2');
  engine.procesar(id, 'Crosstraining Lunes 18:00');
  engine.procesar(id, 'Ana Soma');
  engine.procesar(id, '912345678');
  engine.procesar(id, 'omitir');
  const done = engine.procesar(id, 'confirmar');
  assert.match(done.mensajes[0].texto, /SOMA-2026-0001/);
  assert.equal(engine.listarReservas().length, 1);
  assert.equal(engine.listarReservas()[0].codigo, 'SOMA-2026-0001');
});

test('los 5 agentes producen acciones para soma sin placeholders sin resolver', () => {
  const auto = crearAutomation(clonarDemo('soma'), 'soma');
  auto.ejecutarCiclo(FECHA_DEMO);
  const acciones = auto.listarAcciones().filter((a) => a.fechaISO.slice(0, 10) === FECHA_DEMO);
  const ids = new Set(acciones.map((a) => a.agente));
  for (const ag of ['retencion', 'cobranza', 'reactivacion', 'recordatorio', 'referidos']) {
    assert.equal(ids.has(ag), true, ag);
  }
  for (const a of acciones) {
    if (a.texto) assert.equal(textoValido(a.texto, { allowDollar: a.agente === 'cobranza' }), true, a.texto);
    if (a.motivo) assert.equal(textoValido(a.motivo), true, a.motivo);
    const blob = `${a.texto || ''} ${a.motivo || ''} ${a.socioNombre || ''} ${a.sedeId || ''}`;
    assert.equal(/MONKEYS/i.test(blob), false, blob);
    assert.match(`${a.sedeId || ''} ${a.socioNombre || ''}`, /SOMA|Emilia|Joaquin|Magdalena|Paloma|Humberto|Constanza|Cristobal|Florencia|Amanda|Gabriel|Trinidad|Agustin|Maximiliano|Josefa|Alonso|Renata|Luciano|Maite|Esteban|Sebastian|Matias/);
  }
});

test('ningún texto de soma contiene MONKEYS ni ningún texto de monkeys contiene SOMA', () => {
  const soma = textosDe(clonarDemo('soma')).join('\n');
  const monkeys = textosDe(clonarDemo('monkeys')).join('\n');
  assert.equal(/MONKEYS/i.test(soma), false);
  assert.equal(/\bSOMA\b/.test(monkeys), false);
});

test('kinesiología deriva al equipo y musculación informa acceso libre', () => {
  const engine = crearEngine(clonarDemo('soma'), 'soma');
  const { conversacion } = engine.iniciar();
  const k = engine.procesar(conversacion.id, 'kinesiología');
  assert.match(k.mensajes[0].texto, /con hora/i);
  assert.equal(k.conversacion.status, 'waiting_human');
  const engine2 = crearEngine(clonarDemo('soma'), 'soma');
  const s2 = engine2.iniciar();
  const m = engine2.procesar(s2.conversacion.id, 'musculación');
  assert.match(m.mensajes[0].texto, /acceso libre/i);
  assert.equal(m.conversacion.status, 'active');
});

test('chat soma responde horarios y planes', () => {
  const engine = crearEngine(clonarDemo('soma'), 'soma');
  const { conversacion } = engine.iniciar();
  const clases = engine.procesar(conversacion.id, '1');
  assert.match(clases.mensajes[0].texto, /Crosstraining/);
  const planes = engine.procesar(conversacion.id, '4');
  assert.match(planes.mensajes[0].texto, /69\.990/);
  assert.match(planes.mensajes[0].texto, /Functional Kids/);
  assert.match(planes.mensajes[0].texto, /Valores demostrativos/);
});
