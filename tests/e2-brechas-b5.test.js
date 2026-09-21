/**
 * Regresión E2 B5: catálogo `tenants` del WorldSnapshotV2 es fuente de verdad
 * para validar sedeId (no el catálogo global en memoria).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clonarDemo, clonarMundo } from '../data/demo.js';
import { crearRelojFijo } from '../engine/clock.js';
import {
  crearAdaptadorJson,
  crearTenantSnapshotV2,
  crearWorldSnapshotV2,
  esTenantSnapshotV2,
  esWorldSnapshotV2,
  idsSedeConfigurados,
  CARGA,
} from '../engine/persistencia/index.js';

const FECHA = '2026-09-14';
const CLOCK = crearRelojFijo('2026-09-14T15:00:00.000Z');

test('B5.1: sede agregada al catálogo persistido valida WorldSnapshotV2', () => {
  const world = crearWorldSnapshotV2(clonarMundo(FECHA));
  const monkeys = world.tenants.find((t) => t.id === 'monkeys');
  assert.ok(monkeys);
  monkeys.sedes.push({ id: 'sede-nueva', nombre: 'Sede Nueva' });
  assert.ok(world.byTenant.monkeys.socios.length > 0);
  world.byTenant.monkeys.socios[0].sedeId = 'sede-nueva';

  // Catálogo global no tiene sede-nueva; el persistido sí.
  const idsGlobal = idsSedeConfigurados('monkeys');
  assert.equal(idsGlobal.has('sede-nueva'), false);
  const idsSnap = idsSedeConfigurados('monkeys', world.tenants);
  assert.equal(idsSnap.has('sede-nueva'), true);

  assert.equal(esWorldSnapshotV2(world), true);
});

test('B5.2: sede eliminada del catálogo persistido invalida y deja fuente intacta', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2-b5-'));
  const file = join(dir, 'data.json');
  const world = crearWorldSnapshotV2(clonarMundo(FECHA));
  const monkeys = world.tenants.find((t) => t.id === 'monkeys');
  assert.ok(monkeys);
  monkeys.sedes = monkeys.sedes.filter((s) => s.id !== 'alta-vista');

  let entidad = world.byTenant.monkeys.socios.find((s) => s.sedeId === 'alta-vista');
  if (!entidad) {
    entidad = world.byTenant.monkeys.socios[0];
    entidad.sedeId = 'alta-vista';
  }
  assert.equal(entidad.sedeId, 'alta-vista');

  // Global aún tiene alta-vista; el persistido no.
  const idsGlobal = idsSedeConfigurados('monkeys');
  assert.equal(idsGlobal.has('alta-vista'), true);
  const idsSnap = idsSedeConfigurados('monkeys', world.tenants);
  assert.equal(idsSnap.has('alta-vista'), false);

  assert.equal(esWorldSnapshotV2(world), false);

  const raw = JSON.stringify(world);
  writeFileSync(file, raw, 'utf8');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const r = adapter.cargar();
  assert.equal(r.status, CARGA.CORRUPTO);
  assert.equal(readFileSync(file, 'utf8'), raw);
  rmSync(dir, { recursive: true, force: true });
});

test('B5.3: TenantSnapshotV2 usa catálogo registrado y rechaza sedeId desconocido', () => {
  const snap = crearTenantSnapshotV2('soma', clonarDemo('soma', FECHA));
  assert.equal(esTenantSnapshotV2(snap, 'soma'), true);
  snap.data.socios[0].sedeId = 'sede-desconocida';
  assert.equal(esTenantSnapshotV2(snap, 'soma'), false);
  // Sin tenantsExtra, ids vienen del registro global
  const ids = idsSedeConfigurados('soma');
  assert.equal(ids.has('soma-antofagasta'), true);
  assert.equal(ids.has('sede-desconocida'), false);
});
