/**
 * E3B revisión B5–B8: entidades nuevas con workspaceId; escritura sin sellar;
 * migraciones rechazan versionados corruptos.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clonarDemo, clonarMundo, clonar } from '../data/demo.js';
import { resetCatalogoTenants } from '../data/tenants.js';
import { crearRelojFijo } from '../engine/clock.js';
import { crearMemoria } from '../engine/store.js';
import { crearAutomation } from '../engine/automation.js';
import { crearStorageMemoria } from '../engine/store-local.js';
import {
  SCHEMA_VERSION,
  CARGA,
  PersistenciaError,
  CODIGOS,
  crearWorldSnapshotV1,
  crearWorldSnapshotV2,
  crearWorldSnapshotV3,
  crearTenantSnapshotV1,
  crearTenantSnapshotV2,
  crearWorkspaceSnapshotV3,
  crearAdaptadorJson,
  crearAdaptadorLocal,
  migrateV0toV1,
  migrateV1toV2,
  migrateV2toV3,
  migrateToCurrent,
  esWorldSnapshotV3,
  esWorkspaceSnapshotV3,
  claveEstadoV1,
  bootstrapMundo,
  prepararMundoParaEscritura,
  envelopeTenantEscritura,
  assertMundoEscritura,
} from '../engine/persistencia/index.js';

const FECHA = '2026-09-14';
const CLOCK = crearRelojFijo('2026-09-14T15:00:00.000Z');

after(() => {
  resetCatalogoTenants();
});

function claseReservable(mem, tenantId) {
  const clase = mem.listarClases(tenantId).find((c) => c.reservable !== false && c.disponibles > 0);
  assert.ok(clase, 'se espera una clase reservable');
  return clase;
}

test('B5: reserva nueva incluye workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const clase = claseReservable(mem, 'soma');
  const r = mem.confirmarReserva('soma', {
    claseId: clase.id,
    nombre: 'Ana Test',
    telefono: '+56920000001',
  });
  assert.equal(r.ok, true);
  assert.equal(r.booking.workspaceId, 'soma');
  assert.equal(r.booking.tenantId, 'soma');
});

test('B5: lead nuevo incluye workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const lead = mem.crearLead('soma', { nombre: 'Lead X', telefono: '+56920000002' });
  assert.equal(lead.workspaceId, 'soma');
  assert.equal(lead.tenantId, 'soma');
});

test('B5: conversación nueva incluye workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const conv = mem.crearConversacion('monkeys', { telefono: '+56920000003' });
  assert.equal(conv.workspaceId, 'monkeys');
  assert.equal(conv.tenantId, 'monkeys');
});

test('B5: socio nuevo incluye workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const tenant = mem.getTenant('soma');
  const plan = mem.listarPlanes('soma')[0];
  const r = mem.altaSocio('soma', {
    nombre: 'Socio Nuevo',
    telefono: '+56920000004',
    planId: plan.id,
    sedeId: tenant.sedes[0].id,
  }, FECHA);
  assert.equal(r.ok, true);
  assert.equal(r.socio.workspaceId, 'soma');
  assert.equal(r.socio.tenantId, 'soma');
});

test('B5: membresía nueva incluye workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const tenant = mem.getTenant('soma');
  const plan = mem.listarPlanes('soma')[0];
  const r = mem.altaSocio('soma', {
    nombre: 'Socio Mem',
    telefono: '+56920000005',
    planId: plan.id,
    sedeId: tenant.sedes[0].id,
  }, FECHA);
  assert.equal(r.ok, true);
  assert.equal(r.membresia.workspaceId, 'soma');
  assert.equal(r.membresia.tenantId, 'soma');
});

test('B5: pago nuevo incluye workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const tenant = mem.getTenant('soma');
  const plan = mem.listarPlanes('soma')[0];
  const antes = mem.listarPagos('soma').length;
  const r = mem.altaSocio('soma', {
    nombre: 'Socio Pago',
    telefono: '+56920000006',
    planId: plan.id,
    sedeId: tenant.sedes[0].id,
  }, FECHA);
  assert.equal(r.ok, true);
  const pagos = mem.listarPagos('soma');
  assert.ok(pagos.length > antes);
  const pago = pagos.find((p) => p.socioId === r.socio.id);
  assert.ok(pago);
  assert.equal(pago.workspaceId, 'soma');
  assert.equal(pago.tenantId, 'soma');
});

test('B5: campaña nueva incluye workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const auto = crearAutomation(mem.sliceExport('monkeys'), 'monkeys', { clock: CLOCK });
  const camp = auto.ejecutarCiclo(FECHA);
  assert.equal(camp.workspaceId, 'monkeys');
  assert.equal(camp.tenantId, 'monkeys');
});

test('B5: acciones nuevas y anidadas conservan workspaceId', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const auto = crearAutomation(mem.sliceExport('soma'), 'soma', { clock: CLOCK });
  const camp = auto.ejecutarCiclo(FECHA);
  assert.ok(camp.acciones.length > 0);
  assert.ok(camp.acciones.every((a) => a.workspaceId === 'soma' && a.tenantId === 'soma'));
  const flat = auto.listarAcciones();
  assert.ok(flat.every((a) => a.workspaceId === 'soma'));
  const act = mem.crearAccion('soma', {
    agente: 'recordatorio',
    tipo: 'tarea_equipo',
    socioId: mem.listarSocios('soma')[0].id,
    motivo: 'prueba',
    prioridad: 'baja',
  });
  assert.equal(act.workspaceId, 'soma');
});

test('B6: entidad cruzada en mundo runtime → rechazo, entrada intacta', () => {
  const world = clonar(crearWorldSnapshotV3(clonarMundo(FECHA)));
  const runtime = { tenants: world.tenants, byTenant: clonar(world.byWorkspace) };
  runtime.byTenant.soma.socios[0].workspaceId = 'monkeys';
  const before = clonar(runtime);
  assert.throws(
    () => prepararMundoParaEscritura(runtime),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
  assert.deepEqual(runtime, before);
});

test('B6: entidad cruzada → JSON intacto', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e3b-b6-json-'));
  const file = join(dir, 'data.json');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  adapter.cargar();
  const before = readFileSync(file, 'utf8');
  const world = clonar(JSON.parse(before));
  world.byWorkspace.soma.socios[0].workspaceId = 'monkeys';
  const beforeWorld = clonar(world);
  assert.throws(() => adapter.guardar(world));
  assert.equal(readFileSync(file, 'utf8'), before);
  assert.deepEqual(world, beforeWorld);
  rmSync(dir, { recursive: true, force: true });
});

test('B6: entidad cruzada → localStorage intacto', () => {
  const storage = crearStorageMemoria();
  const adapter = crearAdaptadorLocal({ storage, clock: CLOCK, fechaRef: FECHA });
  adapter.cargar();
  const before = storage.getItem(claveEstadoV1('soma'));
  const snap = JSON.parse(before);
  snap.data.socios[0].workspaceId = 'monkeys';
  const beforeSnap = clonar(snap);
  assert.throws(() => adapter.guardarTenant('soma', snap));
  assert.equal(storage.getItem(claveEstadoV1('soma')), before);
  assert.deepEqual(snap, beforeSnap);
});

test('B7: mundo runtime incompleto → rechazo sin completar campos', () => {
  const world = crearWorldSnapshotV3(clonarMundo(FECHA));
  const runtime = { tenants: world.tenants, byTenant: clonar(world.byWorkspace) };
  delete runtime.byTenant.soma.pagos;
  const before = clonar(runtime);
  assert.throws(
    () => prepararMundoParaEscritura(runtime),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
  assert.deepEqual(runtime, before);
  assert.equal(Object.prototype.hasOwnProperty.call(runtime.byTenant.soma, 'pagos'), false);
});

test('B7: slice plano incompleto → rechazo sin completar campos', () => {
  const slice = clonar(crearWorkspaceSnapshotV3('soma', clonarDemo('soma', FECHA)).data);
  delete slice.membresias;
  const before = clonar(slice);
  assert.throws(
    () => envelopeTenantEscritura('soma', slice),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
  assert.deepEqual(slice, before);
  assert.equal(Object.prototype.hasOwnProperty.call(slice, 'membresias'), false);
});

test('B8: V3 world inválido en migrateToCurrent → rechazo', () => {
  const bad = {
    schemaVersion: 3,
    tenants: [],
    byWorkspace: {
      soma: { workspaceId: 'soma', tenantId: 'soma' },
    },
  };
  const before = clonar(bad);
  assert.throws(
    () => migrateToCurrent(bad, { kind: 'world' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
  assert.deepEqual(bad, before);
  // Contenedor vacío no se acepta como atajo sin validar: byTenant prohibido en V3.
  const withByTenant = { schemaVersion: 3, tenants: [], byWorkspace: {}, byTenant: {} };
  assert.throws(
    () => migrateToCurrent(withByTenant, { kind: 'world' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
});

test('B8: WorkspaceSnapshotV3 inválido pasado directamente → rechazo', () => {
  const bad = {
    schemaVersion: 3,
    workspaceId: 'soma',
    tenantId: 'soma',
    data: { workspaceId: 'soma', tenantId: 'soma' },
  };
  assert.throws(
    () => migrateToCurrent(bad, { kind: 'tenant', workspaceId: 'soma' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
  assert.throws(
    () => migrateV2toV3(bad, { kind: 'tenant', workspaceId: 'soma' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
});

test('B8: WorldSnapshotV2 declarado incompleto → rechazo', () => {
  const v2 = crearWorldSnapshotV2(clonarMundo(FECHA));
  delete v2.byTenant.soma.socios;
  assert.equal(v2.schemaVersion, 2);
  assert.throws(
    () => migrateV2toV3(v2, { kind: 'world' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
});

test('B8: TenantSnapshotV2 declarado incompleto → rechazo', () => {
  const v2 = crearTenantSnapshotV2('soma', clonarDemo('soma', FECHA));
  delete v2.data.pagos;
  assert.throws(
    () => migrateV2toV3(v2, { kind: 'tenant', workspaceId: 'soma' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
});

test('B8: V1 declarado corrupto no se repara silenciosamente', () => {
  const v1 = crearWorldSnapshotV1(clonarMundo(FECHA));
  delete v1.byTenant.monkeys.bookings;
  assert.throws(
    () => migrateV1toV2(v1, { kind: 'world' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
  assert.throws(
    () => migrateToCurrent(v1, { kind: 'world' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
  const t1 = crearTenantSnapshotV1('soma', clonarDemo('soma', FECHA));
  delete t1.data.plans;
  assert.throws(
    () => migrateV1toV2(t1, { kind: 'tenant', tenantId: 'soma' }),
    (err) => err instanceof PersistenciaError && err.code === CODIGOS.CORRUPTO,
  );
});

test('B5–B8: bootstrap sigue sellando correctamente', () => {
  const snap = bootstrapMundo({ clock: CLOCK, fechaRef: FECHA });
  assert.equal(snap.schemaVersion, 3);
  assert.equal(esWorldSnapshotV3(snap), true);
  assert.ok(snap.byWorkspace.soma.socios.every((s) => s.workspaceId === 'soma'));
});

test('B5–B8: V0→V3, V1→V3 y V2→V3 válidos continúan', () => {
  const v0 = clonarMundo(FECHA);
  delete v0.schemaVersion;
  const fromV0 = migrateToCurrent(v0, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(fromV0), true);

  const v1 = crearWorldSnapshotV1(clonarMundo(FECHA));
  const fromV1 = migrateToCurrent(v1, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(fromV1), true);

  const v2 = crearWorldSnapshotV2(clonarMundo(FECHA));
  const fromV2 = migrateV2toV3(v2, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(fromV2), true);

  const again = migrateToCurrent(fromV2, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(again), true);
});

test('B6–B7: escritura runtime válida produce V3; incompleta no muta fuente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e3b-b67-ok-'));
  const file = join(dir, 'data.json');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const boot = adapter.cargar();
  assert.equal(boot.bootstrapped, true);
  const runtime = boot.world;
  assertMundoEscritura(runtime);
  const snap = adapter.guardar(runtime);
  assert.equal(esWorldSnapshotV3(snap), true);

  const incomplete = clonar(runtime);
  delete incomplete.byTenant.monkeys.leads;
  const before = clonar(incomplete);
  const diskBefore = readFileSync(file, 'utf8');
  assert.throws(() => adapter.guardar(incomplete));
  assert.deepEqual(incomplete, before);
  assert.equal(readFileSync(file, 'utf8'), diskBefore);
  rmSync(dir, { recursive: true, force: true });
});

test('B8: V3 idempotente válido; envelope WorkspaceSnapshotV3 válido', () => {
  const v3 = crearWorldSnapshotV3(clonarMundo(FECHA));
  const again = migrateToCurrent(v3, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(again), true);
  const ws = crearWorkspaceSnapshotV3('soma', clonarDemo('soma', FECHA));
  assert.equal(esWorkspaceSnapshotV3(migrateToCurrent(ws, { kind: 'tenant', workspaceId: 'soma' }), 'soma'), true);
});
