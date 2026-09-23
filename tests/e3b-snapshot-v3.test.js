/**
 * E3B — Snapshot V3 y persistencia canónica por workspaceId.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readdirSync, statSync } from 'node:fs';
import { relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clonarDemo, clonarMundo } from '../data/demo.js';
import {
  registrarTenant,
  resetCatalogoTenants,
  catalogoWorkspaces,
} from '../data/tenants.js';
import { crearRelojFijo } from '../engine/clock.js';
import { crearStorageMemoria } from '../engine/store-local.js';
import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  CARGA,
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
  esWorldSnapshotV1,
  esWorldSnapshotV2,
  esWorldSnapshotV3,
  esTenantSnapshotV2,
  esWorkspaceSnapshotV3,
  claveEstadoV1,
  clasificarDocumento,
  bootstrapMundo,
  mundoRuntimeDesdeSnapshot,
} from '../engine/persistencia/index.js';
import { crearCatalogoWorkspaces } from '../core/organizations/workspace.js';

const FECHA = '2026-09-14';
const CLOCK = crearRelojFijo('2026-09-14T15:00:00.000Z');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_DIR = join(ROOT, 'core');

after(() => {
  resetCatalogoTenants();
});

function contarSocios(worldLike) {
  const map = worldLike.byWorkspace || worldLike.byTenant || {};
  return Object.fromEntries(
    Object.entries(map).map(([id, s]) => [id, (s.socios || []).length]),
  );
}

test('E3B: WorldSnapshotV2 válido → V3 sin pérdida', () => {
  const v2 = crearWorldSnapshotV2(clonarMundo(FECHA));
  assert.equal(esWorldSnapshotV2(v2), true);
  const before = contarSocios(v2);
  const nPagos = v2.byTenant.soma.pagos.length;
  const nBooks = v2.byTenant.monkeys.bookings.length;
  const v3 = migrateV2toV3(v2, { kind: 'world' });
  assert.equal(v3.schemaVersion, 3);
  assert.equal(esWorldSnapshotV3(v3), true);
  assert.equal(Object.prototype.hasOwnProperty.call(v3, 'byTenant'), false);
  assert.deepEqual(contarSocios(v3), before);
  assert.equal(v3.byWorkspace.soma.pagos.length, nPagos);
  assert.equal(v3.byWorkspace.monkeys.bookings.length, nBooks);
  assert.ok(v3.byWorkspace.soma.socios.every((s) => s.workspaceId === 'soma' && s.tenantId === 'soma'));
  assert.ok(v3.byWorkspace.monkeys.automation.acciones.every((a) => a.workspaceId === 'monkeys'));
});

test('E3B: TenantSnapshotV2 válido → WorkspaceSnapshotV3 sin pérdida', () => {
  const v2 = crearTenantSnapshotV2('soma', clonarDemo('soma', FECHA));
  const n = v2.data.socios.length;
  const v3 = migrateV2toV3(v2, { kind: 'tenant', workspaceId: 'soma' });
  assert.equal(esWorkspaceSnapshotV3(v3, 'soma'), true);
  assert.equal(v3.workspaceId, 'soma');
  assert.equal(v3.tenantId, 'soma');
  assert.equal(v3.data.socios.length, n);
  assert.ok(v3.data.socios.every((s) => s.workspaceId === 'soma'));
});

test('E3B: V0 → V3', () => {
  const v0 = clonarMundo(FECHA);
  delete v0.schemaVersion;
  const v3 = migrateToCurrent(v0, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(v3), true);
  assert.ok(Object.keys(v3.byWorkspace).includes('monkeys'));
  assert.ok(Object.keys(v3.byWorkspace).includes('soma'));
});

test('E3B: V1 → V3', () => {
  const v1 = crearWorldSnapshotV1(clonarMundo(FECHA));
  assert.equal(esWorldSnapshotV1(v1), true);
  const before = contarSocios(v1);
  const v3 = migrateToCurrent(v1, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(v3), true);
  assert.deepEqual(contarSocios(v3), before);
});

test('E3B: V3 → V3 idempotente', () => {
  const v3 = crearWorldSnapshotV3(clonarMundo(FECHA));
  const again = migrateV2toV3(v3, { kind: 'world' });
  const third = migrateToCurrent(again, { kind: 'world' });
  assert.equal(esWorldSnapshotV3(again), true);
  assert.equal(esWorldSnapshotV3(third), true);
  assert.deepEqual(contarSocios(again), contarSocios(v3));
});

test('E3B: bootstrap vacío genera V3', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e3b-boot-'));
  const file = join(dir, 'data.json');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const r = adapter.cargar();
  assert.equal(r.bootstrapped, true);
  assert.equal(r.snapshot.schemaVersion, SCHEMA_VERSION);
  assert.equal(esWorldSnapshotV3(r.snapshot), true);
  const disk = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(disk.schemaVersion, 3);
  assert.ok(disk.byWorkspace.monkeys);
  rmSync(dir, { recursive: true, force: true });
});

test('E3B: JSON round-trip V3', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e3b-json-'));
  const file = join(dir, 'data.json');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  adapter.cargar();
  const world = crearWorldSnapshotV3(clonarMundo(FECHA));
  world.byWorkspace.soma.socios = world.byWorkspace.soma.socios.slice(0, 2);
  adapter.guardar(world);
  const re = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(esWorldSnapshotV3(re), true);
  assert.equal(re.byWorkspace.soma.socios.length, 2);
  const r2 = adapter.cargar();
  assert.equal(r2.migrated, false);
  assert.equal(r2.world.byTenant.soma.socios.length, 2);
  rmSync(dir, { recursive: true, force: true });
});

test('E3B: localStorage round-trip V3', () => {
  const storage = crearStorageMemoria();
  const adapter = crearAdaptadorLocal({ storage, clock: CLOCK, fechaRef: FECHA });
  adapter.cargar();
  const snap = crearWorkspaceSnapshotV3('soma', clonarDemo('soma', FECHA));
  snap.data.socios = snap.data.socios.slice(0, 1);
  adapter.guardarTenant('soma', snap);
  const stored = JSON.parse(storage.getItem(claveEstadoV1('soma')));
  assert.equal(esWorkspaceSnapshotV3(stored, 'soma'), true);
  assert.equal(stored.data.socios.length, 1);
  assert.equal(stored.data.socios[0].workspaceId, 'soma');
});

test('E3B: MONKEYS y SOMA permanecen aislados tras V3', () => {
  const v3 = crearWorldSnapshotV3(clonarMundo(FECHA));
  const runtime = mundoRuntimeDesdeSnapshot(v3);
  assert.ok(runtime.byTenant.monkeys.socios.every((s) => s.tenantId === 'monkeys'));
  assert.ok(runtime.byTenant.soma.socios.every((s) => s.workspaceId === 'soma'));
  assert.equal(
    runtime.byTenant.monkeys.socios.some((s) => s.workspaceId === 'soma'),
    false,
  );
});

test('E3B: tenant dinámico acme migra y persiste', () => {
  resetCatalogoTenants();
  registrarTenant({
    id: 'acme',
    slug: 'acme',
    nombre: 'ACME',
    features: { gestion: true, forja: false },
    sedes: [{ id: 'acme-1', nombre: 'ACME Central' }],
  });
  const cat = catalogoWorkspaces();
  const slice = {
    tenantId: 'acme',
    classes: [],
    plans: [],
    bookings: [],
    leads: [],
    conversations: [],
    socios: [{ id: 'a1', tenantId: 'acme', nombre: 'Ada', telefono: '+56911111111', sedeId: 'acme-1', estado: 'activo' }],
    asistencias: [],
    membresias: [],
    pagos: [],
    automation: { nextActionSeq: 0, agentesActivos: {}, campanias: [], acciones: [] },
  };
  const v2 = {
    schemaVersion: 2,
    tenantId: 'acme',
    data: slice,
  };
  assert.equal(esTenantSnapshotV2(v2, 'acme'), true);
  const v3 = migrateV2toV3(v2, { kind: 'tenant', workspaceId: 'acme', catalogo: cat });
  assert.equal(esWorkspaceSnapshotV3(v3, 'acme', cat), true);
  assert.equal(v3.data.socios[0].workspaceId, 'acme');

  const storage = crearStorageMemoria();
  const adapter = crearAdaptadorLocal({
    storage,
    clock: CLOCK,
    fechaRef: FECHA,
    tenantIds: ['monkeys', 'soma', 'acme'],
  });
  adapter.guardarTenant('acme', v3);
  const loaded = adapter.cargarTenant('acme');
  assert.equal(loaded.status === CARGA.V3_VALIDO || loaded.migrated === false, true);
  assert.equal(loaded.slice.socios[0].nombre, 'Ada');
  assert.equal(loaded.slice.workspaceId, 'acme');
  resetCatalogoTenants();
});

test('E3B: clave/envelope/slice cruzados → corrupto', () => {
  const cat = catalogoWorkspaces();
  const good = crearWorkspaceSnapshotV3('soma', clonarDemo('soma', FECHA), cat);
  const crossed = {
    ...good,
    workspaceId: 'soma',
    tenantId: 'soma',
    data: { ...good.data, workspaceId: 'monkeys', tenantId: 'monkeys' },
  };
  assert.equal(clasificarDocumento(crossed, 'tenant', { expectedTenantId: 'soma', catalogo: cat }), CARGA.CORRUPTO);

  const world = crearWorldSnapshotV3(clonarMundo(FECHA), cat);
  const badWorld = {
    ...world,
    byWorkspace: {
      ...world.byWorkspace,
      soma: { ...world.byWorkspace.soma, workspaceId: 'monkeys' },
    },
  };
  assert.equal(clasificarDocumento(badWorld, 'world', { catalogo: cat }), CARGA.CORRUPTO);
});

test('E3B: entidad individual con workspaceId cruzado → corrupto', () => {
  const world = crearWorldSnapshotV3(clonarMundo(FECHA));
  world.byWorkspace.soma.socios[0].workspaceId = 'monkeys';
  assert.equal(esWorldSnapshotV3(world), false);
  assert.equal(clasificarDocumento(world, 'world'), CARGA.CORRUPTO);
});

test('E3B: acción o campaña cruzada → corrupto', () => {
  const world = crearWorldSnapshotV3(clonarMundo(FECHA));
  if (!world.byWorkspace.soma.automation.acciones.length) {
    world.byWorkspace.soma.automation.acciones.push({
      id: 'act-x',
      workspaceId: 'soma',
      tenantId: 'soma',
      tipo: 'tarea_equipo',
      estado: 'pendiente',
    });
  }
  world.byWorkspace.soma.automation.acciones[0].workspaceId = 'monkeys';
  assert.equal(esWorldSnapshotV3(world), false);

  const camp = world.byWorkspace.monkeys.automation.campanias[0]
    || {
      id: 'camp-x',
      workspaceId: 'monkeys',
      tenantId: 'monkeys',
      fecha: FECHA,
      acciones: [],
    };
  camp.acciones = [{ id: 'a1', workspaceId: 'soma', tenantId: 'soma', tipo: 'mensaje', estado: 'pendiente' }];
  world.byWorkspace.monkeys.automation.campanias = [camp];
  assert.equal(esWorldSnapshotV3(world), false);
});

test('E3B: V3 sin campo obligatorio → corrupto', () => {
  const world = crearWorldSnapshotV3(clonarMundo(FECHA));
  delete world.byWorkspace.soma.membresias;
  assert.equal(esWorldSnapshotV3(world), false);
  assert.equal(clasificarDocumento(world, 'world'), CARGA.CORRUPTO);
});

test('E3B: documento corrupto no se sobrescribe', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e3b-corrupt-'));
  const file = join(dir, 'data.json');
  const corrupt = '{no-json';
  writeFileSync(file, corrupt, 'utf8');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const r = adapter.cargar();
  assert.equal(r.status, CARGA.CORRUPTO);
  assert.equal(readFileSync(file, 'utf8'), corrupt);
  rmSync(dir, { recursive: true, force: true });
});

test('E3B: escritura inválida no modifica archivo ni localStorage', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e3b-write-'));
  const file = join(dir, 'data.json');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  adapter.cargar();
  const before = readFileSync(file, 'utf8');
  const bad = JSON.parse(before);
  bad.byWorkspace.soma.socios[0].workspaceId = 'monkeys';
  assert.throws(() => adapter.guardar(bad));
  assert.equal(readFileSync(file, 'utf8'), before);

  const storage = crearStorageMemoria();
  const local = crearAdaptadorLocal({ storage, clock: CLOCK, fechaRef: FECHA });
  local.cargar();
  const beforeSoma = storage.getItem(claveEstadoV1('soma'));
  assert.throws(() => local.guardarTenant('soma', {
    schemaVersion: 3,
    workspaceId: 'soma',
    tenantId: 'soma',
    data: { tenantId: 'soma', workspaceId: 'soma' },
  }));
  assert.equal(storage.getItem(claveEstadoV1('soma')), beforeSoma);
  rmSync(dir, { recursive: true, force: true });
});

test('E3B: datos V2 se preservan exactamente salvo campos V3 aditivos', () => {
  const demo = clonarDemo('soma', FECHA);
  const v2 = crearTenantSnapshotV2('soma', demo);
  const socio = v2.data.socios[0];
  const v3 = migrateV2toV3(v2, { kind: 'tenant', workspaceId: 'soma' });
  const s3 = v3.data.socios.find((x) => x.id === socio.id);
  assert.equal(s3.nombre, socio.nombre);
  assert.equal(s3.telefono, socio.telefono);
  assert.equal(s3.sedeId, socio.sedeId);
  assert.equal(s3.planId, socio.planId);
  assert.equal(s3.estado, socio.estado);
  assert.equal(s3.workspaceId, 'soma');
  assert.equal(s3.tenantId, 'soma');
  assert.equal(v3.data.pagos.length, v2.data.pagos.length);
  assert.equal(v3.data.membresias.length, v2.data.membresias.length);
});

test('E3B: smoke V2 world en disco migra a V3 y aísla', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e3b-smoke-'));
  const file = join(dir, 'data.json');
  writeFileSync(file, `${JSON.stringify(crearWorldSnapshotV2(clonarMundo(FECHA)), null, 2)}\n`, 'utf8');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const r = adapter.cargar();
  assert.equal(r.migrated, true);
  assert.equal(esWorldSnapshotV3(r.snapshot), true);
  const disk = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(disk.schemaVersion, 3);
  assert.ok(disk.byWorkspace.monkeys.socios.every((s) => s.workspaceId === 'monkeys'));
  assert.ok(disk.byWorkspace.soma.socios.every((s) => s.workspaceId === 'soma'));
  rmSync(dir, { recursive: true, force: true });
});

test('E3B: bootstrapMundo helper produce V3', () => {
  const snap = bootstrapMundo({ clock: CLOCK, fechaRef: FECHA });
  assert.equal(snap.schemaVersion, 3);
  assert.equal(esWorldSnapshotV3(snap), true);
});

test('E3B: Core sigue sin importar capas prohibidas ni IO', () => {
  function listarJs(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) out.push(...listarJs(p));
      else if (name.endsWith('.js')) out.push(p);
    }
    return out;
  }
  function extraerImports(codigo) {
    const re = /(?:import\s+[^'";]+from\s+|export\s+[^'";]+from\s+)['"]([^'"]+)['"]/g;
    const hits = [];
    let m;
    while ((m = re.exec(codigo))) hits.push(m[1]);
    return hits;
  }
  for (const file of listarJs(CORE_DIR)) {
    const codigo = readFileSync(file, 'utf8');
    for (const spec of extraerImports(codigo)) {
      if (spec.startsWith('.')) {
        const norm = relative(ROOT, join(dirname(file), spec)).replace(/\\/g, '/');
        assert.ok(norm.startsWith('core/'), `${file} → ${norm}`);
      } else {
        assert.ok(!spec.startsWith('engine') && !spec.startsWith('data') && !spec.startsWith('server'));
      }
    }
    assert.equal(/\bDate\.now\s*\(/.test(codigo), false);
    assert.equal(/\bfetch\s*\(/.test(codigo), false);
    assert.equal(/from\s+['"]node:fs['"]/.test(codigo), false);
  }
});
