/**
 * Finanzas demo Forja: cálculos, idempotencia, aislamiento, migración.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { estadoInicial, STORAGE_KEY, ALUMNOS_SEED, MACRO_SEED } from '../forja-demo/js/data.js';
import {
  COACH_MATIAS,
  COACH_OTRO,
  WS_FORJA,
  WS_OTRO,
  PERIODO_ACTUAL,
} from '../forja-demo/js/finanzas/seed.js';
import {
  migrarV1aV2,
  asegurarV2,
  esEstadoCorroto,
  CLAVE_FORJA_DEMO,
  CLAVES_GESTION_PROHIBIDAS,
  VERSION_ACTUAL,
} from '../forja-demo/js/finanzas/migracion.js';
import {
  calcularIndicadores,
  registrarPago,
  pagosVisibles,
  cargosVisibles,
  fichaFinancieraAlumno,
  validarReferencias,
  fmtClp,
  generarLinkPagoDemo,
} from '../forja-demo/js/finanzas/modelo.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function actorMatias() {
  return {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    rol: 'coach',
    alumnoId: null,
  };
}

function actorLaura() {
  return {
    workspaceId: WS_OTRO,
    coachId: COACH_OTRO,
    rol: 'coach',
    alumnoId: null,
  };
}

function actorAlumno(id) {
  return {
    workspaceId: WS_FORJA,
    coachId: null,
    rol: 'alumno',
    alumnoId: id,
  };
}

test('fmtClp: formato chileno con puntos', () => {
  assert.equal(fmtClp(69990), '$69.990');
  assert.equal(fmtClp(120000), '$120.000');
  assert.equal(fmtClp(1250000), '$1.250.000');
  assert.equal(fmtClp(0), '$0');
});

test('indicadores: proyectado = suma cargos del período (sin exentos)', () => {
  const st = estadoInicial();
  const ind = calcularIndicadores(st, actorMatias());
  const cargos = cargosVisibles(st, actorMatias()).filter(
    (c) => c.periodo === PERIODO_ACTUAL && c.estado !== 'exempt',
  );
  const suma = cargos.reduce((s, c) => s + c.monto, 0);
  assert.equal(ind.proyectado, suma);
  assert.equal(ind.proyectado, 569970);
});

test('indicadores: cobrado = suma cargos paid', () => {
  const st = estadoInicial();
  const ind = calcularIndicadores(st, actorMatias());
  assert.equal(ind.cobrado, 189990);
});

test('indicadores: pendiente y vencido', () => {
  const st = estadoInicial();
  const ind = calcularIndicadores(st, actorMatias());
  assert.equal(ind.pendiente, 189990);
  assert.equal(ind.vencido, 189990);
});

test('indicadores: porcentaje de recaudación', () => {
  const st = estadoInicial();
  const ind = calcularIndicadores(st, actorMatias());
  assert.equal(ind.pctRecaudacion, Math.round((189990 / 569970) * 1000) / 10);
});

test('registrar pago actualiza cargo, historial e indicadores', () => {
  const st = estadoInicial();
  const antes = calcularIndicadores(st, actorMatias());
  const r = registrarPago(st, actorMatias(), {
    cargoId: 'cargo-02',
    medio: 'tarjeta',
  });
  assert.equal(r.ok, true);
  assert.equal(r.cargo.estado, 'paid');
  assert.equal(r.pago.monto, 69990);
  assert.ok(st.finanzas.pagos.some((p) => p.cargoId === 'cargo-02'));
  assert.ok(
    st.finanzas.auditoria.some((a) => a.accion === 'registrar_pago'),
  );
  const despues = calcularIndicadores(st, actorMatias());
  assert.equal(despues.cobrado, antes.cobrado + 69990);
  assert.equal(despues.pendiente, antes.pendiente - 69990);
});

test('una deuda no puede pagarse dos veces', () => {
  const st = estadoInicial();
  const a = registrarPago(st, actorMatias(), { cargoId: 'cargo-02' });
  assert.equal(a.ok, true);
  const b = registrarPago(st, actorMatias(), { cargoId: 'cargo-02' });
  assert.equal(b.ok, false);
  assert.equal(b.error, 'ya_pagado');
  const yaPaid = registrarPago(st, actorMatias(), { cargoId: 'cargo-01' });
  assert.equal(yaPaid.ok, false);
  assert.equal(yaPaid.error, 'ya_pagado');
});

test('no se aceptan montos negativos', () => {
  const st = estadoInicial();
  const r = registrarPago(st, actorMatias(), {
    cargoId: 'cargo-02',
    monto: -1000,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'monto_invalido');
});

test('monto del pago debe coincidir con el cargo/plan', () => {
  const st = estadoInicial();
  const r = registrarPago(st, actorMatias(), {
    cargoId: 'cargo-02',
    monto: 1,
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'monto_no_coincide');
});

test('coach A no ve pagos del coach B', () => {
  const st = estadoInicial();
  const pagosMatias = pagosVisibles(st, actorMatias());
  const pagosLaura = pagosVisibles(st, actorLaura());
  assert.ok(pagosMatias.every((p) => p.coachId === COACH_MATIAS));
  assert.ok(pagosLaura.every((p) => p.coachId === COACH_OTRO));
  assert.equal(
    pagosMatias.some((p) => p.coachId === COACH_OTRO),
    false,
  );
  assert.equal(
    pagosLaura.some((p) => p.id === 'pago-01'),
    false,
  );
});

test('workspace A no ve datos del workspace B', () => {
  const st = estadoInicial();
  const cargosA = cargosVisibles(st, actorMatias());
  const cargosB = cargosVisibles(st, actorLaura());
  assert.ok(cargosA.every((c) => c.workspaceId === WS_FORJA));
  assert.ok(cargosB.every((c) => c.workspaceId === WS_OTRO));
  assert.equal(
    cargosA.some((c) => c.workspaceId === WS_OTRO),
    false,
  );
});

test('un alumno no ve información financiera ajena', () => {
  const st = estadoInicial();
  const fichaPropia = fichaFinancieraAlumno(st, actorAlumno('alu-01'), 'alu-01');
  assert.equal(fichaPropia.ok, true);
  const fichaAjena = fichaFinancieraAlumno(st, actorAlumno('alu-01'), 'alu-04');
  assert.equal(fichaAjena.ok, false);
  const pagos = pagosVisibles(st, actorAlumno('alu-01'));
  assert.ok(pagos.every((p) => p.alumnoId === 'alu-01'));
});

test('identificadores cruzados son rechazados', () => {
  const st = estadoInicial();
  const r1 = validarReferencias(st, {
    workspaceId: WS_FORJA,
    cargoId: 'cargo-x',
  });
  assert.equal(r1.ok, false);
  assert.match(r1.error, /cruce/);

  const r2 = validarReferencias(st, {
    workspaceId: WS_FORJA,
    coachId: COACH_MATIAS,
    alumnoId: 'alu-x-laura',
  });
  assert.equal(r2.ok, false);

  const r3 = registrarPago(st, actorMatias(), { cargoId: 'cargo-x' });
  assert.equal(r3.ok, false);
});

test('migración v1→v2 conserva datos deportivos', () => {
  const v1 = {
    version: 1,
    coach: { id: COACH_MATIAS, nombre: 'Matías Rojas' },
    grupos: [{ id: 'grp-inicial', nombre: 'Powerlifting Inicial' }],
    alumnos: ALUMNOS_SEED.map((a) => ({ ...a })),
    ejercicios: [{ id: 'ex-squat', nombre: 'Competition Squat' }],
    macro: structuredClone(MACRO_SEED),
    micro: { mesoId: 'meso-2', semana: 2 },
    sesion: { id: 'ses-lunes', alumnoId: 'alu-04' },
    panel: { adherenciaSemanal: 84 },
    seguimiento: { cumplimiento: 88 },
    sugerencias: [{ id: 'sug-1', estado: 'pendiente' }],
    wellness: { fatiga: 3 },
    registroSesion: { ok: true },
    ui: { vista: 'seguimiento', alumnoId: 'alu-04' },
  };
  const v2 = migrarV1aV2(v1);
  assert.equal(v2.version, VERSION_ACTUAL);
  assert.equal(v2.macro.nombre, MACRO_SEED.nombre);
  assert.equal(v2.wellness.fatiga, 3);
  assert.equal(v2.registroSesion.ok, true);
  assert.equal(v2.ui.vista, 'seguimiento');
  assert.equal(v2.sesion.alumnoId, 'alu-04');
  assert.ok(v2.finanzas.cargos.length >= 7);
  assert.ok(v2.alumnos.some((a) => a.planId));
  assert.ok(v2.alumnos.every((a) => 'observacionFinanciera' in a));
});

test('documento corrupto no se auto-migra', () => {
  assert.equal(esEstadoCorroto({ version: 99 }), true);
  assert.equal(esEstadoCorroto(null), true);
  const bad = asegurarV2({ version: 2, alumnos: [] });
  assert.equal(bad.ok, false);
});

test('reset afecta solo clave forja-demo (contrato)', () => {
  assert.equal(STORAGE_KEY, CLAVE_FORJA_DEMO);
  assert.equal(CLAVE_FORJA_DEMO, 'forja-demo-v1');
  assert.ok(CLAVES_GESTION_PROHIBIDAS.includes('forkza-demo'));
  const resetSrc = readFileSync(
    join(ROOT, 'forja-demo/js/state.js'),
    'utf8',
  );
  assert.match(resetSrc, /CLAVES_GESTION_PROHIBIDAS/);
  assert.match(resetSrc, /localStorage\.removeItem\(CLAVE_FORJA_DEMO\)/);
  assert.doesNotMatch(resetSrc, /localStorage\.clear\(/);
});

test('generar link de pago es ficticio y auditable', () => {
  const st = estadoInicial();
  const r = generarLinkPagoDemo(st, actorMatias(), 'cargo-06');
  assert.equal(r.ok, true);
  assert.match(r.link.url, /^https:\/\/pago\.demo\.forja\.local\//);
  assert.ok(st.finanzas.auditoria.some((a) => a.accion === 'generar_link_pago'));
});

test('nav Finanzas y disclaimer presentes en UI', () => {
  const app = readFileSync(join(ROOT, 'forja-demo/js/app.js'), 'utf8');
  assert.match(app, /finanzas/);
  assert.match(app, /Finanzas/);
  const view = readFileSync(
    join(ROOT, 'forja-demo/js/views/finanzas.js'),
    'utf8',
  );
  assert.match(
    view,
    /Datos financieros ficticios para validación del prototipo/,
  );
  assert.ok(existsSync(join(ROOT, 'forja-demo/js/finanzas/modelo.js')));
});

test('modelo financiero: grafo Alumno→Plan→Cargo→Pago en seed', () => {
  const st = estadoInicial();
  const cargo = st.finanzas.cargos.find((c) => c.id === 'cargo-01');
  const plan = st.finanzas.planes.find((p) => p.id === cargo.planId);
  const alumno = st.alumnos.find((a) => a.id === cargo.alumnoId);
  const pago = st.finanzas.pagos.find((p) => p.cargoId === cargo.id);
  assert.ok(plan);
  assert.ok(alumno);
  assert.equal(alumno.planId, plan.id);
  assert.equal(pago.monto, plan.valorMensual);
  assert.equal(pago.monto, cargo.monto);
  assert.ok(cargo.workspaceId && cargo.coachId && cargo.alumnoId);
});
