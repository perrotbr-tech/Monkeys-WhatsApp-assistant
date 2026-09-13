import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearDatosRetencion } from '../data/socios.js';
import { crearAutomation, fechaHoy } from '../engine/automation.js';
import { clonarDemo } from '../data/demo.js';
import { textoValido } from '../data/templates.js';

function ciclo(fecha = fechaHoy()) {
  const auto = crearAutomation(crearDatosRetencion(fecha));
  auto.ejecutarCiclo(fecha);
  return auto;
}

test('clasifica 6 constantes, 28 regulares, 4 riesgo y 2 silenciosos', () => {
  const auto = crearAutomation(crearDatosRetencion());
  const c = auto.clasificarSocios();
  const n = (s) => c.filter((x) => x.segmento === s).length;
  assert.equal(n('constante'), 6);
  assert.equal(n('regular'), 28);
  assert.equal(n('riesgo'), 4);
  assert.equal(n('silencioso'), 2);
});

test('exactamente 8 visitas es constante', () => {
  const auto = crearAutomation(crearDatosRetencion());
  const s06 = auto.clasificarSocios().find((s) => s.socioId === 's06');
  assert.equal(s06.visitas30d, 8);
  assert.equal(s06.segmento, 'constante');
});

test('exactamente 3 visitas es riesgo', () => {
  const auto = crearAutomation(crearDatosRetencion());
  const s15 = auto.clasificarSocios().find((s) => s.socioId === 's15');
  assert.equal(s15.visitas30d, 3);
  assert.equal(s15.segmento, 'riesgo');
});

test('caida exactamente 50% es riesgo', () => {
  const auto = crearAutomation(crearDatosRetencion());
  const s17 = auto.clasificarSocios().find((s) => s.socioId === 's17');
  assert.equal(s17.visitas30d, 4);
  assert.equal(s17.visitasMesAnterior, 8);
  assert.equal(s17.variacionPct, -50);
  assert.equal(s17.segmento, 'riesgo');
});

test('antiguedad menor a 30 dias no usa caida intermensual', () => {
  const auto = crearAutomation(crearDatosRetencion());
  const s12 = auto.clasificarSocios().find((s) => s.socioId === 's12');
  assert.equal(s12.antiguedadDias < 30, true);
  assert.equal(s12.segmento, 'regular');
});

test('silencioso genera tarea_equipo y no mensaje', () => {
  const auto = ciclo();
  const silenciosos = auto.clasificarSocios().filter((s) => s.segmento === 'silencioso');
  const acciones = auto.listarAcciones({ agente: 'retencion' });
  for (const s of silenciosos) {
    const deSocio = acciones.filter((a) => a.socioId === s.socioId && a.fechaISO.slice(0, 10) === fechaHoy());
    assert.equal(deSocio.length, 1);
    assert.equal(deSocio[0].tipo, 'tarea_equipo');
    assert.equal(deSocio[0].prioridad, 'alta');
    assert.equal(Boolean(deSocio[0].texto), false);
  }
});

test('textos de retencion no contienen llaves ni la palabra promo', () => {
  const auto = ciclo();
  for (const a of auto.listarAcciones({ agente: 'retencion' })) {
    if (a.texto) {
      assert.equal(textoValido(a.texto, { allowDollar: false }), true, a.texto);
      assert.equal(/\{|\}/.test(a.texto), false);
      assert.equal(/\bpromo\b/i.test(a.texto), false);
      assert.equal(/\$/.test(a.texto), false);
    }
  }
});

test('dos ejecuciones el mismo dia no duplican campana', () => {
  const fecha = fechaHoy();
  const auto = crearAutomation(crearDatosRetencion(fecha));
  const r1 = auto.ejecutarCiclo(fecha);
  const r2 = auto.ejecutarCiclo(fecha);
  assert.equal(r1.replaced, false);
  assert.equal(r2.replaced, true);
  const delDia = auto.listarAcciones().filter((a) => a.fechaISO.slice(0, 10) === fecha);
  const deRetencion = delDia.filter((a) => a.agente === 'retencion');
  const ids = new Set(deRetencion.map((a) => a.socioId));
  assert.equal(deRetencion.length, ids.size);
});

test('reset restaura socios, asistencias y campana inicial', () => {
  const fecha = fechaHoy();
  const auto = crearAutomation(crearDatosRetencion(fecha));
  auto.ejecutarCiclo(fecha);
  auto.setEstado(auto.listarAcciones()[0].id, 'hecho');
  auto.reset();
  const seed = crearDatosRetencion(fecha);
  const st = auto.exportar();
  assert.equal(st.socios.length, seed.socios.length);
  assert.equal(st.asistencias.length, seed.asistencias.length);
  assert.equal(st.automation.campanias.length, seed.automation.campanias.length);
  assert.match(st.automation.campanias[0].id, /^camp-monkeys-\d{4}-\d{2}-\d{2}$/);
  const hechos = st.automation.acciones.filter((a) => a.estado === 'hecho');
  assert.equal(hechos.length, 0);
});

test('planes demo tienen los tres valores oficiales', () => {
  const planes = clonarDemo().plans;
  const precio = (id) => planes.find((p) => p.id === id).precio;
  assert.equal(precio('mensual'), '$69.990 CLP');
  assert.equal(precio('trimestral'), '$189.990 CLP');
  assert.equal(precio('anual'), '$649.990 CLP');
});

test('recuperados este mes no es cero en el estado inicial', () => {
  const auto = crearAutomation(crearDatosRetencion());
  const ret = auto.resumen().agentes.find((a) => a.id === 'retencion');
  assert.equal(ret.kpis.find((k) => k.label === 'Recuperados este mes').valor > 0, true);
});

test('constante genera mensaje y regular no genera accion', () => {
  const auto = ciclo();
  const c = auto.clasificarSocios();
  const acciones = auto.listarAcciones({ agente: 'retencion' }).filter((a) => a.fechaISO.slice(0, 10) === fechaHoy());
  for (const s of c.filter((x) => x.segmento === 'constante')) {
    const a = acciones.find((x) => x.socioId === s.socioId);
    assert.equal(a.tipo, 'mensaje');
  }
  for (const s of c.filter((x) => x.segmento === 'regular')) {
    assert.equal(acciones.some((x) => x.socioId === s.socioId), false);
  }
});
