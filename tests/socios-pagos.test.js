import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearMemoria } from '../engine/store.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation } from '../engine/automation.js';
import { clonarDemo, clonarMundo } from '../data/demo.js';
import { crearIntentService, INTENCIONES } from '../engine/intent.js';
import {
  crearLinkPagoDemo, crearTransferenciaManual, crearMercadoPagoProvider, proveedorDe, modoPasarela,
} from '../engine/services/pagos.js';
import { diasPeriodo, extenderMembresia, crearMembresia, estadoMembresia, montoDelPlan } from '../engine/membresias.js';
import { addDays, dayKey } from '../engine/dates.js';

const FECHA = '2026-09-13';

function memTenant(tid) {
  return crearMemoria(clonarMundo(FECHA));
}

test('alta edición baja y reactivación de socio', () => {
  const mem = memTenant();
  const alta = mem.altaSocio('monkeys', {
    nombre: 'Nora Demo',
    telefono: '961000099',
    email: 'nora@demo.cl',
    planId: 'mensual',
    sedeId: 'Félix García',
    fechaInicio: FECHA,
  }, FECHA);
  assert.equal(alta.ok, true);
  assert.equal(alta.socio.telefono, '+56961000099');
  const id = alta.socio.id;
  const ed = mem.editarSocio('monkeys', id, { nombre: 'Nora Editada' });
  assert.equal(ed.socio.nombre, 'Nora Editada');
  const baja = mem.bajaSocio('monkeys', id, 'se muda', FECHA);
  assert.equal(baja.socio.estado, 'baja');
  assert.equal(baja.socio.motivoBaja, 'se muda');
  const re = mem.reactivarSocio('monkeys', id);
  assert.equal(re.socio.estado, 'activo');
});

test('import CSV valida filas, no duplica teléfono E.164', () => {
  const mem = memTenant();
  const csv = [
    'nombre,telefono,email,plan,fechaInicio,sede',
    'Ana Ok,+56961000801,ana@ok.cl,mensual,2026-09-01,Félix García',
    'Ana Dup,961000001,dup@ok.cl,mensual,2026-09-01,Félix García',
    'Tel Malo,123,a@b.cl,mensual,2026-09-01,Félix García',
    'Plan Malo,+56961000802,p@b.cl,no-existe,2026-09-01,Félix García',
    'Otra Ok,961000803,o@ok.cl,trimestral,2026-09-01,Alta Vista',
  ].join('\n');
  const r = mem.importarSociosCsv('monkeys', csv, FECHA);
  assert.equal(r.creados.length, 2);
  assert.equal(r.errores.some((e) => /duplicado/.test(e.error)), true);
  assert.equal(r.errores.some((e) => /teléfono inválido/.test(e.error)), true);
  assert.equal(r.errores.some((e) => /plan inexistente/.test(e.error)), true);
});

test('membresía se crea y extiende al pagar según periodo y vence al cumplir', () => {
  const mem = memTenant();
  const alta = mem.altaSocio('soma', {
    nombre: 'Pase Demo',
    telefono: '962000088',
    planId: 'pase-ct',
    sedeId: 'SOMA Antofagasta',
    fechaInicio: FECHA,
  }, FECHA);
  assert.equal(alta.ok, true);
  const plan = mem.listarPlanes('soma').find((p) => p.id === 'pase-ct');
  assert.equal(diasPeriodo(plan), 1);
  assert.equal(alta.membresia.fin, dayKey(addDays(FECHA, 1)));
  const pago = mem.listarPagos('soma').find((p) => p.socioId === alta.socio.id);
  assert.equal(pago.monto, montoDelPlan(plan));
  const pagado = mem.marcarPagado('soma', pago.id, 'TR-PASE', FECHA);
  assert.equal(pagado.ok, true);
  assert.equal(pagado.membresia.estado, 'vigente');

  const s = mem.requireSlice('soma');
  const row = s.membresias.find((m) => m.id === alta.membresia.id);
  row.fin = dayKey(addDays(FECHA, -1));
  const extra = {
    tenantId: 'soma',
    id: 'pago-ext-1',
    socioId: alta.socio.id,
    membresiaId: row.id,
    planId: 'pase-ct',
    monto: montoDelPlan(plan),
    estado: 'pendiente',
    periodoInicio: '2026-01-01',
    periodoFin: '2026-01-02',
    fechaISO: `${FECHA}T12:00:00.000Z`,
  };
  s.pagos.push(extra);
  const ext = mem.marcarPagado('soma', extra.id, 'TR-EXT', FECHA);
  assert.equal(ext.ok, true);
  assert.equal(ext.membresia.fin, dayKey(addDays(FECHA, 1)));

  const mensual = crearMembresia({
    tenantId: 'monkeys', id: 'm1', socioId: 'x', planId: 'mensual', inicio: FECHA,
    plan: { periodo: 'mensual' }, fechaRef: FECHA,
  });
  assert.equal(mensual.fin, dayKey(addDays(FECHA, 30)));
  const tri = extenderMembresia(mensual, { periodo: 'trimestral', id: 'trimestral' }, FECHA);
  assert.equal(tri.fin, dayKey(addDays(mensual.fin, 90)));
  assert.equal(estadoMembresia({ ...mensual, fin: dayKey(addDays(FECHA, -1)) }, FECHA), 'vencida');
});

test('monto del pago proviene del plan, un pago por período', () => {
  const mem = memTenant();
  const alta = mem.altaSocio('monkeys', {
    nombre: 'Monto Plan',
    telefono: '961000077',
    planId: 'trimestral',
    sedeId: 'Alta Vista',
  }, FECHA);
  const pago = mem.listarPagos('monkeys').find((p) => p.socioId === alta.socio.id);
  assert.equal(pago.monto, 189990);
  const r1 = mem.marcarPagado('monkeys', pago.id, 'TR-1', FECHA);
  assert.equal(r1.ok, true);
  const r2 = mem.marcarPagado('monkeys', pago.id, 'TR-2', FECHA);
  assert.equal(r2.ok, false);
});

test('conciliación del mes cuadra esperado = pagado + pendiente + vencido', () => {
  const mem = memTenant();
  const c = mem.conciliacionMes('monkeys', FECHA);
  assert.equal(c.esperado, c.pagado + c.pendiente + c.vencido);
  assert.equal(c.cuadra, true);
  const c2 = mem.conciliacionMes('soma', FECHA);
  assert.equal(c2.cuadra, true);
});

test('providers cumplen la interfaz y sin credenciales se usa demo', async () => {
  const pago = { id: 'p1', monto: 1000, concepto: 'Plan' };
  const demo = crearLinkPagoDemo();
  const tr = crearTransferenciaManual({ datosBancarios: 'Banco demo' });
  const http = {
    async request() { return { id: 'pref-1', init_point: 'https://mp.example/init', status: 'approved' }; },
  };
  const mp = crearMercadoPagoProvider({ accessToken: 'TEST-TOKEN', httpClient: http });
  for (const p of [demo, tr, mp]) {
    assert.equal(typeof p.crearLink, 'function');
    assert.equal(typeof p.verificar, 'function');
    assert.equal(typeof p.webhook, 'function');
  }
  const link = demo.crearLink(pago);
  assert.match(link.url, /^#pago\//);
  const tlink = tr.crearLink(pago);
  assert.equal(tlink.url, null);
  const mplink = await mp.crearLink(pago);
  assert.equal(mplink.url, 'https://mp.example/init');
  assert.equal(proveedorDe({}).id, 'link_demo');
  assert.equal(modoPasarela({}), 'demo');
  assert.equal(proveedorDe({ accessToken: 'x', httpClient: http }).id, 'mercadopago');
});

test('Cobranza toma vencen en 7 días y Reactivación los vencidos > 15', () => {
  const datos = clonarDemo('soma', FECHA);
  const auto = crearAutomation(datos, 'soma');
  auto.ejecutarCiclo(FECHA);
  const cob = auto.listarAcciones({ agente: 'cobranza' }).filter((a) => a.fechaISO.slice(0, 10) === FECHA);
  const nombresCob = cob.map((a) => a.socioNombre);
  assert.equal(cob.length >= 4, true);
  for (const n of ['Maximiliano Correa', 'Josefa Valdes', 'Alonso Tapia', 'Renata Orellana']) {
    assert.equal(nombresCob.includes(n), true, n);
  }
  const rea = auto.listarAcciones({ agente: 'reactivacion' }).filter((a) => a.fechaISO.slice(0, 10) === FECHA);
  const nombresRea = rea.map((a) => a.socioNombre);
  assert.equal(nombresRea.includes('Luciano Vargas'), true);
  assert.equal(nombresRea.includes('Maite Caceres'), true);
  assert.equal(nombresRea.includes('Esteban Riquelme'), true);
});

test('aislamiento de socios, membresías y pagos entre tenants', () => {
  const mem = memTenant();
  mem.altaSocio('monkeys', {
    nombre: 'Solo Monkeys', telefono: '961000066', planId: 'mensual', sedeId: 'Félix García',
  }, FECHA);
  mem.altaSocio('soma', {
    nombre: 'Solo Soma', telefono: '962000066', planId: 'ct-2', sedeId: 'SOMA Antofagasta',
  }, FECHA);
  assert.equal(mem.listarSocios('monkeys').some((s) => s.nombre === 'Solo Soma'), false);
  assert.equal(mem.listarSocios('soma').some((s) => s.nombre === 'Solo Monkeys'), false);
  for (const m of mem.listarMembresias('monkeys', FECHA)) assert.equal(m.tenantId, 'monkeys');
  for (const m of mem.listarMembresias('soma', FECHA)) assert.equal(m.tenantId, 'soma');
  for (const p of mem.listarPagos('monkeys')) assert.equal(p.tenantId, 'monkeys');
  for (const p of mem.listarPagos('soma')) assert.equal(p.tenantId, 'soma');
});

test('chat mi_membresia en soma incluye cupos restantes', () => {
  const engine = crearEngine(clonarDemo('soma', FECHA), 'soma', { fechaRef: FECHA });
  const start = engine.iniciar();
  const id = start.conversacion.id;
  engine.procesar(id, 'mi membresía');
  const r = engine.procesar(id, '962000001');
  assert.match(r.mensajes[0].texto, /Emilia Contreras/);
  assert.match(r.mensajes[0].texto, /Cupos restantes este mes/);
  assert.equal(/\$/.test(r.mensajes[0].texto), false);
});

test('intenciones mi_membresia y pagar', () => {
  const ai = crearIntentService();
  assert.equal(ai.detectar('mi membresía').intencion, INTENCIONES.MI_MEMBRESIA);
  assert.equal(ai.detectar('quiero pagar').intencion, INTENCIONES.PAGAR);
});

test('demo monkeys tiene 40 socios activos con membresías', () => {
  const d = clonarDemo('monkeys', FECHA);
  assert.equal(d.socios.filter((s) => s.estado === 'activo').length, 40);
  assert.equal(d.membresias.length >= 40, true);
  assert.equal(d.pagos.length >= 40, true);
});

test('rechazado genera evento de cobranza', () => {
  const mem = memTenant();
  const alta = mem.altaSocio('monkeys', {
    nombre: 'Rechazo', telefono: '961000055', planId: 'mensual', sedeId: 'Félix García',
  }, FECHA);
  const pago = mem.listarPagos('monkeys').find((p) => p.socioId === alta.socio.id);
  const r = mem.rechazarPago('monkeys', pago.id);
  assert.equal(r.pago.estado, 'rechazada');
  assert.equal(mem.listarAcciones('monkeys').some((a) => a.motivo === 'pago rechazado'), true);
});
