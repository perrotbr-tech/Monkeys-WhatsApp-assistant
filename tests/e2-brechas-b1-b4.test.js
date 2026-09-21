/**
 * Regresión E2 revisión: B1 validación V2, B2 editarSocio, B3 agentes, B4 filtros.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clonarDemo, clonarMundo } from '../data/demo.js';
import { crearMemoria } from '../engine/store.js';
import { crearAutomation } from '../engine/automation.js';
import { crearRelojFijo } from '../engine/clock.js';
import {
  crearAdaptadorJson,
  crearAdaptadorLocal,
  crearTenantSnapshotV2,
  crearWorldSnapshotV2,
  esTenantSnapshotV2,
  esWorldSnapshotV2,
  validarSliceV2,
  CARGA,
  claveEstadoV1,
} from '../engine/persistencia/index.js';
import { crearStorageMemoria } from '../engine/store-local.js';

const FECHA = '2026-09-14';
const CLOCK = crearRelojFijo('2026-09-14T15:00:00.000Z');
const IDS_PROHIBIDOS = /felix-garcia|alta-vista|soma-antofagasta/;

test('B1: V2 con sedeId nombre visible → corrupto y fuente intacta (JSON)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2-b1a-'));
  const file = join(dir, 'data.json');
  const world = crearWorldSnapshotV2(clonarMundo(FECHA));
  world.byTenant.monkeys.socios[0].sedeId = 'Félix García';
  const raw = JSON.stringify(world);
  writeFileSync(file, raw, 'utf8');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const r = adapter.cargar();
  assert.equal(r.status, CARGA.CORRUPTO);
  assert.equal(readFileSync(file, 'utf8'), raw);
  assert.equal(esWorldSnapshotV2(world), false);
  rmSync(dir, { recursive: true, force: true });
});

test('B1: V2 con sedeId desconocido → corrupto y fuente intacta (localStorage)', () => {
  const storage = crearStorageMemoria();
  const snap = crearTenantSnapshotV2('soma', clonarDemo('soma', FECHA));
  snap.data.bookings.push({
    codigo: 'SOMA-2026-9999',
    tenantId: 'soma',
    cliente: 'X',
    telefono: '+56910000000',
    claseId: 'so-ct-lun-07',
    clase: 'Crosstraining',
    sedeId: 'Sede Fantasma',
    sede: 'Sede Fantasma',
    dia: 'Lunes',
    hora: '07:00',
    estado: 'confirmada',
  });
  const key = claveEstadoV1('soma');
  const raw = JSON.stringify(snap);
  storage.setItem(key, raw);
  const adapter = crearAdaptadorLocal({ storage, clock: CLOCK, fechaRef: FECHA });
  const r = adapter.cargarTenant('soma');
  assert.equal(r.status, CARGA.CORRUPTO);
  assert.equal(storage.getItem(key), raw);
  assert.equal(esTenantSnapshotV2(snap, 'soma'), false);
  assert.equal(validarSliceV2(snap.data, 'soma').ok, false);
});

test('B1: escritura V2 con sedeId inválido → error sin sobrescribir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2-b1w-'));
  const file = join(dir, 'data.json');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const boot = adapter.cargar();
  assert.ok(boot.world);
  adapter.guardar(boot.world);
  const before = readFileSync(file, 'utf8');
  const bad = JSON.parse(before);
  bad.byTenant.monkeys.leads[0].sedeId = 'Félix García';
  assert.throws(() => adapter.guardar(bad));
  assert.equal(readFileSync(file, 'utf8'), before);
  rmSync(dir, { recursive: true, force: true });
});

test('B2: editarSocio alias histórico → ID estable', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const socio = mem.listarSocios('monkeys').find((s) => s.sedeId === 'alta-vista');
  assert.ok(socio);
  const r = mem.editarSocio('monkeys', socio.id, { sedeId: 'Félix García' });
  assert.equal(r.ok, true);
  assert.equal(r.socio.sedeId, 'felix-garcia');
  assert.equal(mem.getSocio('monkeys', socio.id).sedeId, 'felix-garcia');
});

test('B2: editarSocio sede desconocida → error sin mutación', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const socio = mem.listarSocios('monkeys')[0];
  const antes = socio.sedeId;
  const r = mem.editarSocio('monkeys', socio.id, { sedeId: 'Sede Fantasma', nombre: 'No Debe Cambiar' });
  assert.equal(r.ok, false);
  assert.match(r.error, /sede/);
  const after = mem.getSocio('monkeys', socio.id);
  assert.equal(after.sedeId, antes);
  assert.equal(after.nombre, socio.nombre);
});

test('B3: mensajes automáticos usan nombres visibles, no IDs', () => {
  const slice = clonarDemo('monkeys', FECHA);
  const auto = crearAutomation(slice, 'monkeys', { clock: CLOCK });
  auto.ejecutarCiclo(FECHA);
  const acciones = auto.listarAcciones();
  assert.ok(acciones.length > 0);
  for (const a of acciones) {
    assert.ok(!IDS_PROHIBIDOS.test(a.texto || ''), `texto: ${a.texto}`);
    assert.ok(!IDS_PROHIBIDOS.test(a.motivo || ''), `motivo: ${a.motivo}`);
    assert.ok(['felix-garcia', 'alta-vista'].includes(a.sedeId), `sedeId estable: ${a.sedeId}`);
    if (a.texto) {
      assert.match(a.texto, /Félix García|Alta Vista/);
    }
  }
});

test('B3: Recordatorio usa horario real de la clase', () => {
  const slice = clonarDemo('monkeys', FECHA);
  const auto = crearAutomation(slice, 'monkeys', { clock: CLOCK });
  auto.ejecutarCiclo(FECHA);
  const rec = auto.listarAcciones({ agente: 'recordatorio' });
  assert.ok(rec.length >= 1);
  const texto = rec[0].texto || '';
  // s02 tiene claseFavorita Funcional en felix-garcia → Martes 18:00
  assert.match(texto, /Martes 18:00/);
  assert.ok(!IDS_PROHIBIDOS.test(texto));
  assert.equal(rec[0].sedeId, 'felix-garcia');
});

test('B3: SOMA mensajes visibles y sedeId estable', () => {
  const slice = clonarDemo('soma', FECHA);
  const auto = crearAutomation(slice, 'soma', { clock: CLOCK });
  auto.ejecutarCiclo(FECHA);
  for (const a of auto.listarAcciones()) {
    assert.ok(!IDS_PROHIBIDOS.test(a.texto || ''));
    assert.ok(!IDS_PROHIBIDOS.test(a.motivo || ''));
    assert.equal(a.sedeId, 'soma-antofagasta');
    if (a.texto || a.motivo) {
      const blob = `${a.texto || ''} ${a.motivo || ''}`;
      assert.match(blob, /SOMA Antofagasta/);
    }
  }
});

test('B4: filtro por sedeId estable devuelve acciones correctas', () => {
  const slice = clonarDemo('monkeys', FECHA);
  const auto = crearAutomation(slice, 'monkeys', { clock: CLOCK });
  auto.ejecutarCiclo(FECHA);
  const fg = auto.listarAcciones({ sede: 'felix-garcia' });
  const av = auto.listarAcciones({ sede: 'alta-vista' });
  assert.ok(fg.length > 0);
  assert.ok(av.length > 0);
  assert.ok(fg.every((a) => a.sedeId === 'felix-garcia'));
  assert.ok(av.every((a) => a.sedeId === 'alta-vista'));
  assert.ok(fg.every((a) => a.sedeNombre === 'Félix García'));
  assert.ok(av.every((a) => a.sedeNombre === 'Alta Vista'));
});

test('B4: acciones por cupos/disciplina guardan sedeId estable', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const socio = mem.buscarSocioPorTelefono('soma', '+56962000001');
  assert.ok(socio);
  const plan = mem.planDe('soma', socio.planId);
  socio.cuposUsadosMes = plan.cuposMes;
  const r = mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-18',
    nombre: socio.nombre,
    telefono: socio.telefono,
    sede: 'SOMA Antofagasta',
  });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'CUPOS_AGOTADOS');
  const acciones = mem.listarAcciones('soma', { agente: 'recordatorio' });
  const cupos = acciones.find((a) => a.motivo === 'cupos agotados');
  assert.ok(cupos);
  assert.equal(cupos.sedeId, 'soma-antofagasta');

  const socioDisc = mem.buscarSocioPorTelefono('soma', '+56962000003');
  assert.ok(socioDisc);
  const r2 = mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-07',
    nombre: socioDisc.nombre,
    telefono: socioDisc.telefono,
    sede: 'SOMA Antofagasta',
  });
  assert.equal(r2.ok, false);
  assert.equal(r2.codigo, 'DISCIPLINA');
  const disc = mem.listarAcciones('soma').find((a) => String(a.motivo).includes('disciplina no incluida'));
  assert.ok(disc);
  assert.equal(disc.sedeId, 'soma-antofagasta');
});
