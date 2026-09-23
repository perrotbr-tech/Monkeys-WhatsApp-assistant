/**
 * E2 — Identidad estable y configuración de tenant.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  listarTenants,
  buscarTenant,
  registrarTenant,
  resetCatalogoTenants,
  nombreSede,
  resolverSedeId,
  capacidadesDe,
  menuDe,
} from '../data/tenants.js';
import { clonarDemo, clonarMundo, registrarBuilderDemo, resetBuildersDemo } from '../data/demo.js';
import { crearApp } from '../server/index.js';
import { crearMemoria } from '../engine/store.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation } from '../engine/automation.js';
import { crearRelojFijo } from '../engine/clock.js';
import {
  crearAdaptadorJson,
  crearAdaptadorLocal,
  crearWorldSnapshotV1,
  crearTenantSnapshotV1,
  crearWorldSnapshotV2,
  migrateV1toV2,
  esWorldSnapshotV2,
  esTenantSnapshotV2,
  esWorldSnapshotV3,
  esWorkspaceSnapshotV3,
  SCHEMA_VERSION,
  CARGA,
  claveEstadoV1,
  CLAVE_LOCAL_LEGACY_MONKEYS,
} from '../engine/persistencia/index.js';
import { crearStorageMemoria } from '../engine/store-local.js';

const FECHA = '2026-09-14';
const CLOCK = crearRelojFijo('2026-09-14T15:00:00.000Z');

after(() => {
  resetCatalogoTenants();
  resetBuildersDemo();
});

test('E2: renombrar sede visible no altera reservas, socios ni historial', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const bookingsBefore = mem.listarReservas('monkeys').map((b) => ({
    codigo: b.codigo, sedeId: b.sedeId || resolverSedeId(buscarTenant('monkeys'), b.sede),
  }));
  const sociosBefore = mem.listarSocios('monkeys').map((s) => ({ id: s.id, sedeId: s.sedeId }));
  assert.ok(bookingsBefore.every((b) => b.sedeId === 'felix-garcia' || b.sedeId === 'alta-vista'));
  assert.ok(sociosBefore.every((s) => s.sedeId === 'felix-garcia' || s.sedeId === 'alta-vista'));

  const tenant = buscarTenant('monkeys');
  const sede = tenant.sedes.find((s) => s.id === 'felix-garcia');
  const nombreOriginal = sede.nombre;
  sede.nombre = 'Sede Norte Renombrada';
  registrarTenant(tenant);

  assert.equal(resolverSedeId(buscarTenant('monkeys'), 'felix-garcia'), 'felix-garcia');
  assert.equal(nombreSede(buscarTenant('monkeys'), 'felix-garcia'), 'Sede Norte Renombrada');
  assert.equal(nombreSede(buscarTenant('monkeys'), 'Félix García'), 'Sede Norte Renombrada');

  const bookingsAfter = mem.listarReservas('monkeys');
  const sociosAfter = mem.listarSocios('monkeys');
  assert.deepEqual(
    bookingsAfter.map((b) => ({ codigo: b.codigo, sedeId: b.sedeId || resolverSedeId(buscarTenant('monkeys'), b.sede) })),
    bookingsBefore,
  );
  assert.deepEqual(
    sociosAfter.map((s) => ({ id: s.id, sedeId: s.sedeId })),
    sociosBefore,
  );

  // Restaurar nombre
  sede.nombre = nombreOriginal;
  registrarTenant({ ...buscarTenant('monkeys'), sedes: tenant.sedes });
  resetCatalogoTenants();
});

test('E2: renombrar marca visible no altera tenantId, storage ni URLs', () => {
  const t = buscarTenant('monkeys');
  const id = t.id;
  const slug = t.slug;
  t.nombre = 'MONKEYS Fitness Renombrado';
  t.marca = { ...t.marca, wordmark: 'MONKEYS X' };
  registrarTenant(t);

  const again = buscarTenant('monkeys');
  assert.equal(again.id, id);
  assert.equal(again.slug, slug);
  assert.equal(again.nombre, 'MONKEYS Fitness Renombrado');
  assert.equal(claveEstadoV1(again.id), 'forkza_demo_state_monkeys');
  assert.equal(`?t=${again.slug}`, '?t=monkeys');

  resetCatalogoTenants();
});

test('E2: MONKEYS y SOMA se inicializan recorriendo configuración', () => {
  const ids = listarTenants().filter((t) => t.activo).map((t) => t.id);
  assert.deepEqual(ids.sort(), ['monkeys', 'soma'].sort());

  const engines = Object.create(null);
  const autos = Object.create(null);
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  for (const id of ids) {
    engines[id] = crearEngine({ memoria: mem }, id, { clock: CLOCK, fechaRef: FECHA });
    autos[id] = crearAutomation(mem.sliceExport(id), id, { clock: CLOCK });
  }
  assert.equal(Object.keys(engines).sort().join(','), 'monkeys,soma');
  assert.equal(Object.keys(autos).sort().join(','), 'monkeys,soma');
  assert.equal(Object.getPrototypeOf(engines), null);
});

test('E2: el servidor no necesita propiedades manuales .monkeys o .soma', () => {
  const { engines, autos, app } = crearApp({
    mundo: clonarMundo(FECHA),
    persist: false,
    clock: CLOCK,
  });
  // Registro dinámico: claves existen, pero no son literales hardcodeadas en el fuente
  for (const id of listarTenants().map((t) => t.id)) {
    assert.equal(typeof engines[id].iniciar, 'function');
    assert.equal(typeof autos[id].ejecutarCiclo, 'function');
  }
  assert.equal(Object.getOwnPropertyNames(engines).sort().join(','), 'monkeys,soma');
  // CrearApp debe aceptar tenants del catálogo sin código específico
  const src = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.equal(/engines\.monkeys\s*=/.test(src), false);
  assert.equal(/engines\.soma\s*=/.test(src), false);
  assert.equal(/autos\.monkeys\s*=/.test(src), false);
  assert.equal(/autos\.soma\s*=/.test(src), false);
  assert.ok(app);
});

test('E2: no existe cruce de tenant', () => {
  const mem = crearMemoria(clonarMundo(FECHA), { clock: CLOCK });
  const r = mem.confirmarReserva('soma', {
    claseId: 'so-ct-lun-18',
    nombre: 'Cruz Test',
    telefono: '+56971112233',
    sede: 'soma-antofagasta',
  });
  assert.equal(r.ok, true);
  assert.equal(mem.listarReservas('monkeys').some((b) => b.codigo === r.booking.codigo), false);
  assert.equal(mem.listarReservas('soma').some((b) => b.codigo === r.booking.codigo), true);
  assert.equal(mem.listarSocios('monkeys').some((s) => s.tenantId === 'soma'), false);
});

test('E2: tenant de prueba adicional sin modificar motor ni servidor', () => {
  registrarTenant({
    id: 'acme',
    slug: 'acme',
    nombre: 'ACME Gym',
    codigoPrefix: 'ACME',
    demo: true,
    activo: true,
    sedes: [{ id: 'acme-centro', nombre: 'ACME Centro' }],
    menu: menuDe(buscarTenant('monkeys')),
    capacidades: {
      cuposPorPlan: false,
      clasePruebaGratis: true,
      emojiReserva: false,
      etiquetaReservar: 'Reservar',
      textoTrialNombre: 'Clase de prueba ACME. ¿Cuál es tu nombre?',
      prefijoSocioId: 'ac',
      servicios: ['clases', 'reservas'],
    },
    textosBot: { bienvenida: 'Hola ACME', disclaimer: 'demo' },
    marca: { wordmark: 'ACME', colorAcento: '#00AA88' },
    aliasHistoricos: { localStorageKeys: [], sedes: { 'ACME Centro': 'acme-centro' } },
  });
  registrarBuilderDemo('acme', () => ({
    tenantId: 'acme',
    nextBookingSeq: 1,
    nextLeadSeq: 1,
    nextConvSeq: 1,
    classes: [{
      id: 'ac-yoga', tenantId: 'acme', sedeId: 'acme-centro', sede: 'ACME Centro',
      nombre: 'Yoga', dia: 'Lunes', hora: '10:00', entrenador: 'Ada', capacity: 10, reserved: 0, reservable: true,
    }],
    plans: [{ id: 'mensual', tenantId: 'acme', nombre: 'Mensual', precio: '$1', monto: 1, periodo: 'mensual' }],
    bookings: [],
    leads: [],
    conversations: [],
    referidos: [],
    socios: [],
    asistencias: [],
    membresias: [],
    pagos: [],
    automation: { nextActionSeq: 0, agentesActivos: {}, campanias: [], acciones: [] },
  }));

  const ids = listarTenants().map((t) => t.id);
  assert.ok(ids.includes('acme'));

  const { engines, autos } = crearApp({
    mundo: clonarMundo(FECHA),
    persist: false,
    clock: CLOCK,
  });
  assert.equal(typeof engines.acme.iniciar, 'function');
  assert.equal(typeof autos.acme.exportar, 'function');
  const start = engines.acme.iniciar();
  assert.equal(start.conversacion.sede, 'ACME Centro');
  assert.match(start.mensajes[0].texto, /ACME/);

  // Sin tocar conversation.js / server: capacidades desde config
  assert.equal(capacidadesDe(buscarTenant('acme')).textoTrialNombre.includes('ACME'), true);

  resetCatalogoTenants();
  resetBuildersDemo();
});

test('E2: migración histórica V1→V2 conserva todos los datos', () => {
  const v1world = crearWorldSnapshotV1(clonarMundo(FECHA));
  // Forzar nombres históricos en sedes (como V1 pre-E2)
  v1world.byTenant.monkeys.bookings = v1world.byTenant.monkeys.bookings.map((b) => ({
    ...b,
    sede: b.sede === 'felix-garcia' || b.sedeId === 'felix-garcia' ? 'Félix García' : 'Alta Vista',
    sedeId: b.sede === 'felix-garcia' || b.sedeId === 'felix-garcia' ? 'Félix García' : 'Alta Vista',
  }));
  v1world.byTenant.monkeys.socios = v1world.byTenant.monkeys.socios.map((s) => ({
    ...s,
    sedeId: s.sedeId === 'felix-garcia' ? 'Félix García'
      : s.sedeId === 'alta-vista' ? 'Alta Vista' : s.sedeId,
  }));
  const nSocios = v1world.byTenant.monkeys.socios.length;
  const nBooks = v1world.byTenant.monkeys.bookings.length;
  const nPagos = v1world.byTenant.monkeys.pagos.length;
  const nMem = v1world.byTenant.monkeys.membresias.length;
  const nConv = v1world.byTenant.monkeys.conversations.length;
  const nAcc = (v1world.byTenant.monkeys.automation.acciones || []).length;

  const v2 = migrateV1toV2(v1world, { kind: 'world' });
  assert.equal(v2.schemaVersion, 2);
  assert.equal(esWorldSnapshotV2(v2), true);
  assert.equal(v2.byTenant.monkeys.socios.length, nSocios);
  assert.equal(v2.byTenant.monkeys.bookings.length, nBooks);
  assert.equal(v2.byTenant.monkeys.pagos.length, nPagos);
  assert.equal(v2.byTenant.monkeys.membresias.length, nMem);
  assert.equal(v2.byTenant.monkeys.conversations.length, nConv);
  assert.equal((v2.byTenant.monkeys.automation.acciones || []).length, nAcc);
  assert.ok(v2.byTenant.monkeys.bookings.every((b) => b.sedeId === 'felix-garcia' || b.sedeId === 'alta-vista'));
  assert.ok(v2.byTenant.monkeys.socios.every((s) => s.sedeId === 'felix-garcia' || s.sedeId === 'alta-vista'));
  // Idempotente
  const again = migrateV1toV2(v2, { kind: 'world' });
  assert.equal(again.schemaVersion, 2);
  assert.equal(again.byTenant.monkeys.socios.length, nSocios);
});

test('E2: datos ambiguos o corruptos se rechazan sin sobrescritura', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forkza-e2-'));
  const file = join(dir, 'data.json');
  const corrupt = '{no-json';
  writeFileSync(file, corrupt, 'utf8');
  const adapter = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const r = adapter.cargar();
  assert.equal(r.status, CARGA.CORRUPTO);
  assert.equal(readFileSync(file, 'utf8'), corrupt);

  // Ambiguo: sede desconocida en migración V1
  const v1 = crearTenantSnapshotV1('monkeys', {
    ...clonarDemo('monkeys', FECHA),
    socios: [{
      id: 's-bad', tenantId: 'monkeys', nombre: 'X', telefono: '+56910000000',
      sedeId: 'Sede Fantasma', planId: 'mensual', estado: 'activo', fechaIngreso: FECHA, cuposUsadosMes: 0,
    }],
  });
  assert.throws(
    () => migrateV1toV2(v1, { kind: 'tenant', tenantId: 'monkeys' }),
    (err) => err && (err.code === 'PERSISTENCIA_AMBIGUA' || /sede irresoluble/.test(String(err.message))),
  );
  rmSync(dir, { recursive: true, force: true });
});

test('E2: JSON y localStorage mantienen conformidad (actual V3 tras E3B)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forkza-e2j-'));
  const file = join(dir, 'data.json');
  const json = crearAdaptadorJson({ filePath: file, clock: CLOCK, fechaRef: FECHA });
  const boot = json.cargar();
  assert.equal(boot.bootstrapped, true);
  assert.equal(boot.snapshot.schemaVersion, SCHEMA_VERSION);
  json.guardar(boot.world);
  const re = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(esWorldSnapshotV3(re), true);

  const storage = crearStorageMemoria();
  storage.setItem(CLAVE_LOCAL_LEGACY_MONKEYS, JSON.stringify(clonarDemo('monkeys', FECHA)));
  const local = crearAdaptadorLocal({ storage, clock: CLOCK, fechaRef: FECHA });
  const lc = local.cargarTenant('monkeys');
  assert.ok(lc.status !== CARGA.CORRUPTO);
  assert.equal(esWorkspaceSnapshotV3(JSON.parse(storage.getItem(claveEstadoV1('monkeys'))), 'monkeys'), true);
  assert.equal(storage.getItem(CLAVE_LOCAL_LEGACY_MONKEYS), null);
  rmSync(dir, { recursive: true, force: true });
});

test('E2: menús y capacidades salen de configuración, no de tid === soma/monkeys', () => {
  const src = readFileSync(new URL('../engine/conversation.js', import.meta.url), 'utf8');
  assert.equal(/tid === ['"]soma['"]/.test(src), false);
  assert.equal(/tid === ['"]monkeys['"]/.test(src), false);
  assert.equal(/tenantId === ['"]soma['"]/.test(src), false);
  assert.equal(menuDe(buscarTenant('soma')).length > 0, true);
  assert.equal(capacidadesDe(buscarTenant('soma')).cuposPorPlan, true);
  assert.equal(capacidadesDe(buscarTenant('monkeys')).cuposPorPlan, false);
});
