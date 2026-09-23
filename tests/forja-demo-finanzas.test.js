/**
 * Finanzas demo FORJA TRAINING: KPIs, pagos, aislamiento, migración.
 * No integra bancos ni pagos reales.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  formatearClp,
  calcularIndicadores,
  filtrarPorActor,
  validarReferencias,
  registrarPago,
  sincronizarEstadosCargos,
  ESTADO_CARGO,
} from '../forja-demo/js/finanzas/modelo.js';
import {
  finanzasInicial,
  WORKSPACE_DEMO,
  WORKSPACE_ALT,
  COACH_DEMO,
  COACH_ALT,
  FECHA_REF_FINANZAS,
} from '../forja-demo/js/finanzas/seed.js';
import {
  STORAGE_KEY,
  STATE_VERSION,
  estadoInicial,
  migrarEstadoV1aV2,
  ALUMNOS_SEED,
} from '../forja-demo/js/data.js';
import { CLAVES_GESTION_PROHIBIDAS } from '../forja-demo/js/state.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function actorMatias() {
  return {
    rol: 'coach',
    workspaceId: WORKSPACE_DEMO.id,
    coachId: COACH_DEMO.id,
  };
}

function finanzasCoachVisible() {
  const fin = sincronizarEstadosCargos(finanzasInicial(), FECHA_REF_FINANZAS);
  return filtrarPorActor(fin, actorMatias());
}

function cargosPeriodo(visible, periodo = '2026-09') {
  return visible.cargos.filter((c) => c.periodo === periodo);
}

test('CLP: formato chileno con puntos de mil', () => {
  assert.equal(formatearClp(69990), '$69.990');
  assert.equal(formatearClp(120000), '$120.000');
  assert.equal(formatearClp(1250000), '$1.250.000');
  assert.equal(formatearClp(0), '$0');
});

test('KPI: proyectado = suma de cargos del período (sin exentos)', () => {
  const vis = finanzasCoachVisible();
  const cargos = cargosPeriodo(vis);
  const ind = calcularIndicadores(cargos, vis.asignaciones, FECHA_REF_FINANZAS);
  const esperado = cargos
    .filter((c) => c.estado !== ESTADO_CARGO.exempt)
    .reduce((s, c) => s + c.monto, 0);
  assert.equal(ind.ingresosProyectados, esperado);
  // 69990*2 + 89990 + 120000*3 = 139980 + 89990 + 360000 = 589970
  assert.equal(ind.ingresosProyectados, 589970);
});

test('KPI: cobrado = suma de cargos pagados del período', () => {
  const vis = finanzasCoachVisible();
  const cargos = cargosPeriodo(vis);
  const ind = calcularIndicadores(cargos, vis.asignaciones, FECHA_REF_FINANZAS);
  const esperado = cargos
    .filter((c) => c.estado === ESTADO_CARGO.paid)
    .reduce((s, c) => s + c.monto, 0);
  assert.equal(ind.totalCobrado, esperado);
  assert.equal(ind.totalCobrado, 69990 + 120000);
});

test('KPI: pendiente y vencido se calculan correctamente', () => {
  const vis = finanzasCoachVisible();
  const cargos = cargosPeriodo(vis);
  const ind = calcularIndicadores(cargos, vis.asignaciones, FECHA_REF_FINANZAS);
  assert.equal(
    ind.totalPendiente,
    cargos.filter((c) => c.estado === ESTADO_CARGO.pending).reduce((s, c) => s + c.monto, 0),
  );
  assert.equal(
    ind.totalVencido,
    cargos.filter((c) => c.estado === ESTADO_CARGO.overdue).reduce((s, c) => s + c.monto, 0),
  );
  assert.equal(ind.totalPendiente, 89990 + 120000);
  assert.equal(ind.totalVencido, 69990 + 120000);
});

test('KPI: porcentaje de recaudación = cobrado/proyectado', () => {
  const vis = finanzasCoachVisible();
  const cargos = cargosPeriodo(vis);
  const ind = calcularIndicadores(cargos, vis.asignaciones, FECHA_REF_FINANZAS);
  const esperado =
    Math.round((ind.totalCobrado / ind.ingresosProyectados) * 1000) / 10;
  assert.equal(ind.porcentajeRecaudacion, esperado);
});

test('pago: registrar actualiza cargo, historial e indicadores', () => {
  let fin = sincronizarEstadosCargos(finanzasInicial(), FECHA_REF_FINANZAS);
  const antes = calcularIndicadores(
    filtrarPorActor(fin, actorMatias()).cargos.filter((c) => c.periodo === '2026-09'),
    filtrarPorActor(fin, actorMatias()).asignaciones,
    FECHA_REF_FINANZAS,
  );
  const res = registrarPago(fin, {
    cargoId: 'cargo-01',
    medio: 'transferencia',
    actor: actorMatias(),
    fechaIso: FECHA_REF_FINANZAS,
  });
  assert.equal(res.ok, true);
  fin = res.finanzas;
  const cargo = fin.cargos.find((c) => c.id === 'cargo-01');
  assert.equal(cargo.estado, ESTADO_CARGO.paid);
  assert.ok(fin.pagos.some((p) => p.cargoId === 'cargo-01'));
  assert.ok(fin.auditoria.some((a) => a.accion === 'registrar_pago' && a.cargoId === 'cargo-01'));
  const despues = calcularIndicadores(
    filtrarPorActor(fin, actorMatias()).cargos.filter((c) => c.periodo === '2026-09'),
    filtrarPorActor(fin, actorMatias()).asignaciones,
    FECHA_REF_FINANZAS,
  );
  assert.equal(despues.totalCobrado, antes.totalCobrado + 69990);
  assert.equal(despues.totalVencido, antes.totalVencido - 69990);
});

test('pago: una deuda no puede pagarse dos veces (idempotencia)', () => {
  let fin = sincronizarEstadosCargos(finanzasInicial(), FECHA_REF_FINANZAS);
  const r1 = registrarPago(fin, {
    cargoId: 'cargo-03',
    medio: 'link',
    actor: actorMatias(),
    fechaIso: FECHA_REF_FINANZAS,
  });
  assert.equal(r1.ok, true);
  const r2 = registrarPago(r1.finanzas, {
    cargoId: 'cargo-03',
    medio: 'link',
    actor: actorMatias(),
    fechaIso: FECHA_REF_FINANZAS,
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.error, 'cargo_ya_pagado');
  const pagos = r2.finanzas.pagos.filter((p) => p.cargoId === 'cargo-03');
  assert.equal(pagos.length, 1);
});

test('pago: no se aceptan montos negativos', () => {
  const fin = sincronizarEstadosCargos(finanzasInicial(), FECHA_REF_FINANZAS);
  const res = registrarPago(fin, {
    cargoId: 'cargo-06',
    medio: 'efectivo',
    actor: actorMatias(),
    fechaIso: FECHA_REF_FINANZAS,
    montoOverride: -1000,
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'monto_negativo_o_invalido');
});

test('pago: el monto debe corresponder al plan/cargo', () => {
  const fin = sincronizarEstadosCargos(finanzasInicial(), FECHA_REF_FINANZAS);
  const res = registrarPago(fin, {
    cargoId: 'cargo-06',
    medio: 'efectivo',
    actor: actorMatias(),
    fechaIso: FECHA_REF_FINANZAS,
    montoOverride: 1,
  });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'monto_no_coincide_plan');
});

test('aislamiento: coach A no ve pagos del coach B', () => {
  const fin = finanzasInicial();
  const a = filtrarPorActor(fin, actorMatias());
  const b = filtrarPorActor(fin, {
    rol: 'coach',
    workspaceId: WORKSPACE_ALT.id,
    coachId: COACH_ALT.id,
  });
  assert.equal(a.pagos.some((p) => p.coachId === COACH_ALT.id), false);
  assert.equal(b.pagos.some((p) => p.coachId === COACH_DEMO.id), false);
  assert.ok(b.pagos.some((p) => p.id === 'pago-alt-01'));
  assert.equal(a.pagos.some((p) => p.id === 'pago-alt-01'), false);
});

test('aislamiento: workspace A no ve datos del workspace B', () => {
  const fin = finanzasInicial();
  const a = filtrarPorActor(fin, {
    rol: 'coach',
    workspaceId: WORKSPACE_DEMO.id,
    coachId: COACH_DEMO.id,
  });
  assert.equal(a.cargos.some((c) => c.workspaceId === WORKSPACE_ALT.id), false);
  assert.equal(a.planes.some((p) => p.workspaceId === WORKSPACE_ALT.id), false);
  assert.equal(a.pagos.some((p) => p.workspaceId === WORKSPACE_ALT.id), false);
});

test('aislamiento: alumno solo ve su información financiera', () => {
  const fin = finanzasInicial();
  const vista = filtrarPorActor(fin, {
    rol: 'alumno',
    workspaceId: WORKSPACE_DEMO.id,
    alumnoId: 'alu-02',
  });
  assert.ok(vista.cargos.every((c) => c.alumnoId === 'alu-02'));
  assert.ok(vista.pagos.every((p) => p.alumnoId === 'alu-02'));
  assert.equal(vista.cargos.some((c) => c.alumnoId === 'alu-04'), false);
});

test('referencias cruzadas o desconocidas se rechazan', () => {
  const fin = finanzasInicial();
  const refs = {
    workspacesConocidos: [WORKSPACE_DEMO.id, WORKSPACE_ALT.id],
    coachesConocidos: [COACH_DEMO.id, COACH_ALT.id],
    alumnoIdsConocidos: ALUMNOS_SEED.map((a) => a.id),
  };
  assert.equal(
    validarReferencias(fin, { ...refs, workspaceId: 'ws-fantasma' }).ok,
    false,
  );
  assert.equal(
    validarReferencias(fin, {
      ...refs,
      workspaceId: WORKSPACE_DEMO.id,
      cargoId: 'cargo-alt-01',
    }).error,
    'cargo_workspace_cruzado',
  );
  const pagoCruzado = registrarPago(fin, {
    cargoId: 'cargo-alt-01',
    medio: 'transferencia',
    actor: actorMatias(),
    fechaIso: FECHA_REF_FINANZAS,
    refs,
  });
  assert.equal(pagoCruzado.ok, false);
  assert.ok(
    pagoCruzado.error === 'cargo_workspace_cruzado' ||
      pagoCruzado.error === 'cargo_coach_cruzado',
  );
});

test('migración v1→v2 conserva datos deportivos y agrega finanzas', () => {
  const v1 = {
    version: 1,
    coach: { id: 'coach-matias', nombre: 'Matías Rojas' },
    grupos: [{ id: 'grp-inicial', nombre: 'Powerlifting Inicial' }],
    alumnos: [{ id: 'alu-01', nombre: 'Camila Torres', grupoId: 'grp-inicial', modalidades: ['Powerlifting'], oneRm: { squat: 95, bench: 55, deadlift: 120 }, estadoHoy: 'pendiente', adherencia: 86, edad: 28, pesoCorporal: 63 }],
    ejercicios: [{ id: 'ex-squat', nombre: 'Competition Squat', fuente: 'sistema' }],
    macro: { id: 'macro-01', nombre: 'Ciclo custom' },
    micro: { semana: 2 },
    sesion: { id: 'ses-lunes', alumnoId: 'alu-01' },
    panel: { adherenciaSemanal: 77 },
    seguimiento: { adherencia: 77 },
    sugerencias: [{ id: 'sug-1', titulo: 'X', estado: 'pendiente' }],
    wellness: { fatiga: 4 },
    registroSesion: { rpe: 8 },
    ui: { vista: 'alumnos', alumnoId: 'alu-01' },
  };
  const v2 = migrarEstadoV1aV2(v1);
  assert.equal(v2.version, STATE_VERSION);
  assert.equal(v2.alumnos[0].nombre, 'Camila Torres');
  assert.equal(v2.ejercicios[0].id, 'ex-squat');
  assert.equal(v2.macro.nombre, 'Ciclo custom');
  assert.equal(v2.wellness.fatiga, 4);
  assert.equal(v2.registroSesion.rpe, 8);
  assert.equal(v2.panel.adherenciaSemanal, 77);
  assert.ok(v2.finanzas);
  assert.ok(v2.finanzas.planes.length >= 1);
  assert.ok(v2.finanzas.cargos.length >= 1);
  assert.equal(v2.ui.vista, 'alumnos');
});

test('reset: clave forja-demo distinta de claves de Gestión', () => {
  assert.equal(STORAGE_KEY, 'forja-demo-v1');
  assert.equal(CLAVES_GESTION_PROHIBIDAS.includes(STORAGE_KEY), false);
  assert.ok(CLAVES_GESTION_PROHIBIDAS.includes('monkeys_demo_state'));
  const ini = estadoInicial();
  assert.equal(ini.version, 2);
  assert.ok(ini.finanzas.workspaceActivoId === WORKSPACE_DEMO.id);
});

test('estado inicial: grafo Alumno→Plan→Cargo→Pago explícito', () => {
  const fin = finanzasInicial();
  const cargo = fin.cargos.find((c) => c.id === 'cargo-02');
  const plan = fin.planes.find((p) => p.id === cargo.planId);
  const asig = fin.asignaciones.find((a) => a.alumnoId === cargo.alumnoId);
  const pago = fin.pagos.find((p) => p.cargoId === cargo.id);
  assert.ok(plan);
  assert.ok(asig);
  assert.equal(asig.planId, plan.id);
  assert.ok(pago);
  assert.equal(pago.monto, plan.valorMensual);
  assert.equal(pago.monto, cargo.monto);
  assert.ok(!('pagado' in (ALUMNOS_SEED[0] || {})));
});

test('MONKEYS/SOMA/Gestión: forja-demo no importa app.js ni store-local', () => {
  const app = readFileSync(join(ROOT, 'forja-demo/js/app.js'), 'utf8');
  assert.doesNotMatch(app, /store-local|engine\/auth|from ['\"]\.\.\/app/);
  assert.equal(existsSync(join(ROOT, 'forja-demo/js/finanzas/modelo.js')), true);
  assert.equal(existsSync(join(ROOT, 'forja-demo/js/views/finanzas.js')), true);
  const html = readFileSync(join(ROOT, 'forja-demo/index.html'), 'utf8');
  assert.match(html, /FORJA TRAINING/);
});

test('UI: navegación declara sección Finanzas', () => {
  const app = readFileSync(join(ROOT, 'forja-demo/js/app.js'), 'utf8');
  assert.match(app, /finanzas/);
  assert.match(app, /Finanzas/);
  const css = readFileSync(join(ROOT, 'forja-demo/styles.css'), 'utf8');
  assert.match(css, /fin-disclaimer/);
  assert.match(css, /fin-cards-mobile/);
});
