/**
 * Suite de conformidad E1B (C01–C17) ejecutada contra JSON y localStorage.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearFactory,
  FECHA_FIJA,
  clonarDemo,
  clonarMundo,
  crearTenantSnapshotV1,
  crearWorldSnapshotV1,
  camposMinimosPresentes,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  CARGA,
  claveEstadoV1,
  CLAVE_LOCAL_LEGACY_MONKEYS,
} from './helpers/conformidad-store.js';

const FABRICAS = [crearFactory('json'), crearFactory('localStorage')];

for (const factory of FABRICAS) {
  const tag = `[${factory.kind}]`;

  test(`${tag} C01 aislamiento entre tenants`, async () => {
    const h = factory.create();
    try {
      const { ok } = h.loadOrThrow();
      assert.equal(ok, true);
      const soma = h.engine('soma');
      const start = soma.iniciar();
      const id = start.conversacion.id;
      soma.procesar(id, '2');
      soma.procesar(id, 'Crosstraining Lunes 18:00');
      soma.procesar(id, 'Ana Aislada');
      soma.procesar(id, '911111111');
      soma.procesar(id, 'omitir');
      const done = soma.procesar(id, 'confirmar');
      assert.match(done.mensajes[0].texto, /SOMA-2026-0001/);
      h.persist();
      h.reload();
      const somaBooks = h.engine('soma').listarReservas();
      const monBooks = h.engine('monkeys').listarReservas();
      assert.equal(somaBooks.some((b) => b.codigo === 'SOMA-2026-0001'), true);
      assert.equal(monBooks.some((b) => String(b.codigo).startsWith('SOMA-')), false);
      assert.equal(somaBooks.some((b) => String(b.codigo).startsWith('GYM-')), false);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C02 round-trip de reserva`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      const eng = h.engine('soma');
      const start = eng.iniciar();
      const id = start.conversacion.id;
      eng.procesar(id, '2');
      eng.procesar(id, 'Crosstraining Lunes 18:00');
      eng.procesar(id, 'Rita Round');
      eng.procesar(id, '922222222');
      eng.procesar(id, 'omitir');
      eng.procesar(id, 'confirmar');
      h.persist();
      h.reload();
      const books = h.engine('soma').listarReservas();
      assert.equal(books.some((b) => b.codigo === 'SOMA-2026-0001' && b.cliente === 'Rita Round'), true);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C03 round-trip socio, membresía y pago`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      const mem = h.memoria();
      const alta = mem.altaSocio('soma', {
        nombre: 'Socio Nuevo',
        telefono: '+56970000001',
        sedeId: 'SOMA Antofagasta',
        planId: 'ct-2',
      }, FECHA_FIJA);
      assert.equal(alta.ok, true);
      const pagoId = mem.listarPagos('soma').find((p) => p.socioId === alta.socio.id).id;
      const pagado = mem.marcarPagado('soma', pagoId, 'TR-C03', FECHA_FIJA);
      assert.equal(pagado.ok, true);
      h.persist();
      h.reload();
      const socio = h.memoria().buscarSocioPorTelefono('soma', '+56970000001');
      assert.equal(socio.nombre, 'Socio Nuevo');
      const ficha = h.memoria().fichaSocio('soma', socio.id, FECHA_FIJA);
      assert.ok(ficha.membresia);
      assert.equal(ficha.pagos.some((p) => p.estado === 'pagada' && p.referencia === 'TR-C03'), true);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C04 persistencia de acciones creadas por el motor`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      const socio = h.memoria().buscarSocioPorTelefono('soma', '+56962000001');
      const plan = h.engine('soma').listarPlanes().find((p) => p.id === socio.planId);
      socio.cuposUsadosMes = plan.cuposMes;
      const eng = h.engine('soma');
      const start = eng.iniciar();
      const id = start.conversacion.id;
      eng.procesar(id, 'reservar mi cupo');
      eng.procesar(id, 'Crosstraining Lunes 18:00');
      eng.procesar(id, socio.nombre);
      eng.procesar(id, '962000001');
      eng.procesar(id, 'omitir');
      eng.procesar(id, 'confirmar');
      assert.equal(
        h.memoria().listarAcciones('soma').some((a) => a.motivo === 'cupos agotados'),
        true,
      );
      h.persist();
      h.reload();
      assert.equal(
        h.memoria().listarAcciones('soma').some((a) => a.motivo === 'cupos agotados'),
        true,
      );
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C05 persistencia del ciclo de automatización y agentes activos`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      h.auto('monkeys').setAgenteActivo('referidos', false);
      h.auto('monkeys').ejecutarCiclo(FECHA_FIJA);
      const antes = h.auto('monkeys').summary(FECHA_FIJA);
      assert.equal(antes.agentesActivos.referidos, false);
      assert.ok(antes.campanias >= 1);
      h.persist();
      h.reload();
      const despues = h.auto('monkeys').summary(FECHA_FIJA);
      assert.equal(despues.agentesActivos.referidos, false);
      assert.ok((h.auto('monkeys').listarAcciones() || []).length >= 1);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C06 convivencia acciones motor y automatización sin duplicar`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      h.memoria().crearAccion('soma', {
        agente: 'recordatorio',
        tipo: 'tarea_equipo',
        socioId: 'sm01',
        texto: null,
        motivo: 'motor-c06',
        prioridad: 'media',
        sedeId: 'SOMA Antofagasta',
      });
      h.auto('soma').ejecutarCiclo(FECHA_FIJA);
      h.persist();
      h.reload();
      const acciones = h.memoria().listarAcciones('soma');
      const ids = acciones.map((a) => a.id);
      assert.equal(ids.length, new Set(ids).size);
      assert.equal(acciones.some((a) => a.motivo === 'motor-c06'), true);
      assert.ok(acciones.some((a) => a.agente === 'retencion' || a.agente === 'cobranza' || a.agente === 'recordatorio'));
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C07 snapshot parcial no rellena socios desde demo`, async () => {
    const parcial = crearTenantSnapshotV1('soma', {
      tenantId: 'soma',
      socios: [],
      plans: clonarDemo('soma', FECHA_FIJA).plans,
      classes: clonarDemo('soma', FECHA_FIJA).classes,
      bookings: [],
      leads: [],
      conversations: [],
      asistencias: [],
      membresias: [],
      pagos: [],
      automation: { nextActionSeq: 0, agentesActivos: {}, campanias: [], acciones: [] },
    });
    let h;
    if (factory.kind === 'json') {
      const world = crearWorldSnapshotV1({
        byTenant: {
          monkeys: clonarDemo('monkeys', FECHA_FIJA),
          soma: parcial.data,
        },
      });
      // Forzar socios vacíos en soma tras normalización del snapshot
      world.byTenant.soma.socios = [];
      h = factory.create({ seedWorld: world });
    } else {
      h = factory.create({
        seedLocal: {
          [claveEstadoV1('monkeys')]: JSON.stringify(crearTenantSnapshotV1('monkeys', clonarDemo('monkeys', FECHA_FIJA))),
          [claveEstadoV1('soma')]: JSON.stringify(parcial),
        },
      });
    }
    try {
      assert.equal(h.loadOrThrow().ok, true);
      assert.equal(h.memoria().listarSocios('soma').length, 0);
      assert.ok(h.memoria().listarSocios('monkeys').length > 0);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C08 storage vacío hace bootstrap una sola vez`, async () => {
    const h = factory.create({ seedText: null });
    try {
      const first = h.loadOrThrow();
      assert.equal(first.ok, true);
      assert.equal(first.carga.bootstrapped, true);
      const nMonkeys = h.memoria().listarSocios('monkeys').length;
      h.memoria().altaSocio('monkeys', {
        nombre: 'Bootstrap Unico',
        telefono: '+56971111111',
        sedeId: 'Félix García',
        planId: 'mensual',
      }, FECHA_FIJA);
      h.persist();
      h.reload();
      const second = h.adapter.cargar();
      assert.equal(second.bootstrapped, false);
      assert.equal(second.status === CARGA.V1_VALIDO || second.migrated === false, true);
      h.reload();
      assert.equal(h.memoria().listarSocios('monkeys').some((s) => s.nombre === 'Bootstrap Unico'), true);
      assert.equal(h.memoria().listarSocios('monkeys').length, nMonkeys + 1);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C09 migración V0→V1 conserva datos existentes`, async () => {
    const v0slice = clonarDemo('soma', FECHA_FIJA);
    v0slice.socios = [{
      id: 'sm-v0',
      tenantId: 'soma',
      nombre: 'V0 Conservado',
      telefono: '+56973333333',
      sedeId: 'SOMA Antofagasta',
      planId: 'ct-2',
      estado: 'activo',
      fechaIngreso: FECHA_FIJA,
      cuposUsadosMes: 0,
    }];
    // V0 sin schemaVersion; quitar membresias para forzar migración de campo
    delete v0slice.membresias;
    // planes sin cuposMes
    v0slice.plans = v0slice.plans.map(({ cuposMes, ...rest }) => rest);

    let h;
    if (factory.kind === 'json') {
      const v0world = {
        tenants: clonarMundo(FECHA_FIJA).tenants,
        byTenant: {
          monkeys: clonarDemo('monkeys', FECHA_FIJA),
          soma: v0slice,
        },
      };
      h = factory.create({ seedWorld: v0world });
    } else {
      h = factory.create({
        seedLocal: {
          [claveEstadoV1('monkeys')]: JSON.stringify(clonarDemo('monkeys', FECHA_FIJA)),
          [claveEstadoV1('soma')]: JSON.stringify(v0slice),
        },
      });
    }
    try {
      const r = h.loadOrThrow();
      assert.equal(r.ok, true);
      assert.equal(r.carga.migrated, true);
      const socios = h.memoria().listarSocios('soma');
      assert.equal(socios.length, 1);
      assert.equal(socios[0].nombre, 'V0 Conservado');
      const planes = h.engine('soma').listarPlanes();
      assert.equal('cuposMes' in planes.find((p) => p.id === 'ct-2'), true);
      assert.ok(h.memoria().listarMembresias('soma', FECHA_FIJA).length >= 1);
      const raw = h.getRawWorldText();
      assert.ok(raw);
      if (factory.kind === 'json') {
        const parsed = JSON.parse(raw);
        assert.equal(parsed.schemaVersion, 1);
        assert.equal(esWorldSnapshotV1(parsed), true);
      } else {
        const somaRaw = JSON.parse(h.getTenantRaw('soma'));
        assert.equal(esTenantSnapshotV1(somaRaw), true);
      }
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C10 reset explícito restaura demo`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      h.memoria().hidratarTenant('soma', {
        ...clonarDemo('soma', FECHA_FIJA),
        socios: [],
        bookings: [],
      });
      assert.equal(h.memoria().listarSocios('soma').length, 0);
      h.adapter.reset();
      h.reload();
      assert.ok(h.memoria().listarSocios('soma').length > 5);
      assert.ok(h.memoria().listarSocios('monkeys').length >= 40);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C12 snapshot/export contienen campos mínimos`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      h.persist();
      if (factory.kind === 'json') {
        const world = JSON.parse(h.getRawWorldText());
        const campos = camposMinimosPresentes(world);
        assert.deepEqual(campos.sort(), ['byTenant', 'schemaVersion', 'tenants'].sort());
        assert.equal(esWorldSnapshotV1(world), true);
      } else {
        const soma = JSON.parse(h.getTenantRaw('soma'));
        assert.deepEqual(camposMinimosPresentes(soma).sort(), ['data', 'schemaVersion', 'tenantId'].sort());
        assert.equal(esTenantSnapshotV1(soma), true);
      }
      const exported = h.engine('soma').exportar();
      for (const k of ['classes', 'plans', 'bookings', 'socios', 'membresias', 'pagos', 'automation']) {
        assert.ok(k in exported, k);
      }
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C15 hidratación de un tenant no elimina otro`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      const nMonkeys = h.memoria().listarSocios('monkeys').length;
      h.memoria().hidratarTenant('soma', {
        ...clonarDemo('soma', FECHA_FIJA),
        socios: [{
          id: 'sm-only',
          tenantId: 'soma',
          nombre: 'Solo Soma',
          telefono: '+56974444444',
          sedeId: 'SOMA Antofagasta',
          planId: 'ct-2',
          estado: 'activo',
          fechaIngreso: FECHA_FIJA,
          cuposUsadosMes: 0,
        }],
      });
      assert.equal(h.memoria().listarSocios('soma').length, 1);
      assert.equal(h.memoria().listarSocios('monkeys').length, nMonkeys);
      h.persist();
      h.reload();
      assert.equal(h.memoria().listarSocios('soma')[0].nombre, 'Solo Soma');
      assert.equal(h.memoria().listarSocios('monkeys').length, nMonkeys);
    } finally {
      h.cleanup();
    }
  });

  test(`${tag} C17 timestamps y códigos determinísticos con Clock fijo`, async () => {
    const h = factory.create();
    try {
      assert.equal(h.loadOrThrow().ok, true);
      const accion = h.memoria().crearAccion('soma', {
        agente: 'cobranza',
        tipo: 'tarea_equipo',
        socioId: 'sm01',
        texto: null,
        motivo: 'c17',
        prioridad: 'baja',
        sedeId: 'SOMA Antofagasta',
      });
      assert.equal(accion.fechaISO, '2026-09-14T15:00:00.000Z');
      const eng = h.engine('soma');
      const start = eng.iniciar();
      const id = start.conversacion.id;
      eng.procesar(id, '2');
      eng.procesar(id, 'Crosstraining Lunes 18:00');
      eng.procesar(id, 'Clock User');
      eng.procesar(id, '955555555');
      eng.procesar(id, 'omitir');
      const done = eng.procesar(id, 'confirmar');
      assert.match(done.mensajes[0].texto, /SOMA-2026-0001/);
      h.persist();
      h.reload();
      const books = h.engine('soma').listarReservas();
      assert.equal(books.find((b) => b.codigo === 'SOMA-2026-0001').codigo, 'SOMA-2026-0001');
    } finally {
      h.cleanup();
    }
  });
}

test('[localStorage] C11 migración de clave legacy monkeys_demo_state', async () => {
  const factory = crearFactory('localStorage');
  const v0 = clonarDemo('monkeys', FECHA_FIJA);
  v0.socios = v0.socios.slice(0, 3);
  const h = factory.create({
    seedLocal: {
      [CLAVE_LOCAL_LEGACY_MONKEYS]: JSON.stringify(v0),
    },
  });
  try {
    const r = h.loadOrThrow();
    assert.equal(r.ok, true);
    assert.equal(h.memoria().listarSocios('monkeys').length, 3);
    assert.ok(h.getTenantRaw('monkeys'));
    const stored = JSON.parse(h.getTenantRaw('monkeys'));
    assert.equal(esTenantSnapshotV1(stored), true);
    // la clave legacy debe eliminarse tras migrar
    assert.equal(h.adapter.storage.getItem(CLAVE_LOCAL_LEGACY_MONKEYS), null);
  } finally {
    h.cleanup();
  }
});

test('[json] C13 JSON corrupto produce error y no sobrescribe el archivo', async () => {
  const factory = crearFactory('json');
  const corrupt = '{ esto no es json';
  const h = factory.create({ seedText: corrupt });
  try {
    const before = h.getRawWorldText();
    assert.equal(before, corrupt);
    const r = h.loadOrThrow();
    assert.equal(r.ok, false);
    assert.equal(r.carga.status, CARGA.CORRUPTO);
    assert.equal(h.getRawWorldText(), corrupt);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] C14 localStorage corrupto produce error y no sobrescribe la clave', async () => {
  const factory = crearFactory('localStorage');
  const corrupt = '{no-json';
  const h = factory.create({
    seedLocal: {
      [claveEstadoV1('monkeys')]: corrupt,
      [claveEstadoV1('soma')]: JSON.stringify(crearTenantSnapshotV1('soma', clonarDemo('soma', FECHA_FIJA))),
    },
  });
  try {
    const r = h.loadOrThrow();
    assert.equal(r.ok, false);
    assert.equal(r.carga.status, CARGA.CORRUPTO);
    assert.equal(h.getTenantRaw('monkeys'), corrupt);
  } finally {
    h.cleanup();
  }
});

test('[json] C16 escritura JSON deja documento válido tras reemplazo', async () => {
  const factory = crearFactory('json');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    h.persist();
    const text = h.getRawWorldText();
    const parsed = JSON.parse(text);
    assert.equal(esWorldSnapshotV1(parsed), true);
    assert.ok(parsed.byTenant.monkeys);
    assert.ok(parsed.byTenant.soma);
    // segunda escritura también válida
    h.memoria().crearAccion('soma', {
      agente: 'retencion',
      tipo: 'tarea_equipo',
      socioId: 'sm01',
      motivo: 'c16',
      prioridad: 'baja',
      sedeId: 'SOMA Antofagasta',
    });
    h.persist();
    const again = JSON.parse(h.getRawWorldText());
    assert.equal(esWorldSnapshotV1(again), true);
    assert.equal(
      again.byTenant.soma.automation.acciones.some((a) => a.motivo === 'c16'),
      true,
    );
  } finally {
    h.cleanup();
  }
});

// --- Regresión B1/B2: coherencia de tenant e integridad estructural V1 ---

function sliceCompleto(tenantId) {
  return crearTenantSnapshotV1(tenantId, clonarDemo(tenantId, FECHA_FIJA));
}

test('[localStorage] B1a clave SOMA con envelope tenantId monkeys → corrupto sin cambios', () => {
  const factory = crearFactory('localStorage');
  const wrong = sliceCompleto('monkeys');
  const raw = JSON.stringify(wrong);
  const h = factory.create({
    seedLocal: { [claveEstadoV1('soma')]: raw },
  });
  try {
    const r = h.adapter.cargarTenant('soma');
    assert.equal(r.status, CARGA.CORRUPTO);
    assert.equal(h.getTenantRaw('soma'), raw);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] B1b envelope SOMA con data.tenantId monkeys → corrupto sin cambios', () => {
  const factory = crearFactory('localStorage');
  const snap = sliceCompleto('soma');
  snap.data.tenantId = 'monkeys';
  const raw = JSON.stringify(snap);
  const h = factory.create({
    seedLocal: { [claveEstadoV1('soma')]: raw },
  });
  try {
    const r = h.adapter.cargarTenant('soma');
    assert.equal(r.status, CARGA.CORRUPTO);
    assert.equal(h.getTenantRaw('soma'), raw);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] B2a V1 sin socios → corrupto sin cambios', () => {
  const factory = crearFactory('localStorage');
  const snap = sliceCompleto('soma');
  delete snap.data.socios;
  const raw = JSON.stringify(snap);
  const h = factory.create({
    seedLocal: { [claveEstadoV1('soma')]: raw },
  });
  try {
    const r = h.adapter.cargarTenant('soma');
    assert.equal(r.status, CARGA.CORRUPTO);
    assert.equal(h.getTenantRaw('soma'), raw);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] B2b V1 con socios de tipo incorrecto → corrupto', () => {
  const factory = crearFactory('localStorage');
  const snap = sliceCompleto('soma');
  snap.data.socios = { no: 'array' };
  const raw = JSON.stringify(snap);
  const h = factory.create({
    seedLocal: { [claveEstadoV1('soma')]: raw },
  });
  try {
    const r = h.adapter.cargarTenant('soma');
    assert.equal(r.status, CARGA.CORRUPTO);
    assert.equal(h.getTenantRaw('soma'), raw);
  } finally {
    h.cleanup();
  }
});

test('[json] B2c world V1 con slice sin campo obligatorio → corrupto sin cambios', () => {
  const factory = crearFactory('json');
  const world = crearWorldSnapshotV1(clonarMundo(FECHA_FIJA));
  delete world.byTenant.soma.socios;
  const raw = `${JSON.stringify(world, null, 2)}\n`;
  const h = factory.create({ seedText: raw });
  try {
    const r = h.loadOrThrow();
    assert.equal(r.ok, false);
    assert.equal(r.carga.status, CARGA.CORRUPTO);
    assert.equal(h.getRawWorldText(), raw);
  } finally {
    h.cleanup();
  }
});

test('[json] B1c byTenant.soma.tenantId === monkeys → corrupto sin cambios', () => {
  const factory = crearFactory('json');
  const world = crearWorldSnapshotV1(clonarMundo(FECHA_FIJA));
  world.byTenant.soma.tenantId = 'monkeys';
  const raw = `${JSON.stringify(world, null, 2)}\n`;
  const h = factory.create({ seedText: raw });
  try {
    const r = h.loadOrThrow();
    assert.equal(r.ok, false);
    assert.equal(r.carga.status, CARGA.CORRUPTO);
    assert.equal(h.getRawWorldText(), raw);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] V1 válido con socios: [] sigue siendo válido', () => {
  const factory = crearFactory('localStorage');
  const snap = sliceCompleto('soma');
  snap.data.socios = [];
  const h = factory.create({
    seedLocal: {
      [claveEstadoV1('soma')]: JSON.stringify(snap),
      [claveEstadoV1('monkeys')]: JSON.stringify(sliceCompleto('monkeys')),
    },
  });
  try {
    const r = h.loadOrThrow();
    assert.equal(r.ok, true);
    assert.equal(h.memoria().listarSocios('soma').length, 0);
    assert.ok(h.memoria().listarSocios('monkeys').length > 0);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] V0 migrable sigue migrándose correctamente', () => {
  const factory = crearFactory('localStorage');
  const v0 = clonarDemo('soma', FECHA_FIJA);
  v0.socios = [{
    id: 'sm-v0b',
    tenantId: 'soma',
    nombre: 'V0 Ok',
    telefono: '+56975555555',
    sedeId: 'SOMA Antofagasta',
    planId: 'ct-2',
    estado: 'activo',
    fechaIngreso: FECHA_FIJA,
    cuposUsadosMes: 0,
  }];
  delete v0.membresias;
  v0.plans = v0.plans.map(({ cuposMes, ...rest }) => rest);
  const h = factory.create({
    seedLocal: {
      [claveEstadoV1('soma')]: JSON.stringify(v0),
      [claveEstadoV1('monkeys')]: JSON.stringify(clonarDemo('monkeys', FECHA_FIJA)),
    },
  });
  try {
    const r = h.loadOrThrow();
    assert.equal(r.ok, true);
    assert.equal(r.carga.migrated, true);
    assert.equal(h.memoria().listarSocios('soma')[0].nombre, 'V0 Ok');
    const stored = JSON.parse(h.getTenantRaw('soma'));
    assert.equal(esTenantSnapshotV1(stored, 'soma'), true);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] guardarTenant(soma, snapshotMonkeys) → error sin escritura cruzada', () => {
  const factory = crearFactory('localStorage');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const beforeSoma = h.getTenantRaw('soma');
    const beforeMonkeys = h.getTenantRaw('monkeys');
    const monkeysSnap = sliceCompleto('monkeys');
    assert.throws(
      () => h.adapter.guardarTenant('soma', monkeysSnap),
      (err) => err && err.code === 'PERSISTENCIA_AMBIGUA',
    );
    assert.equal(h.getTenantRaw('soma'), beforeSoma);
    assert.equal(h.getTenantRaw('monkeys'), beforeMonkeys);
  } finally {
    h.cleanup();
  }
});

// --- Regresión B3/B4: validación de escritura sin sanitizar ---

test('[localStorage] B3 guardar(world) clave SOMA / slice MONKEYS → error y storage intacto', () => {
  const factory = crearFactory('localStorage');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const beforeSoma = h.getTenantRaw('soma');
    const beforeMonkeys = h.getTenantRaw('monkeys');
    const world = crearWorldSnapshotV1(clonarMundo(FECHA_FIJA));
    world.byTenant.soma.tenantId = 'monkeys';
    assert.throws(() => h.adapter.guardar(world));
    assert.equal(h.getTenantRaw('soma'), beforeSoma);
    assert.equal(h.getTenantRaw('monkeys'), beforeMonkeys);
  } finally {
    h.cleanup();
  }
});

test('[json] B3 guardar(world) clave SOMA / slice MONKEYS → error y archivo intacto', () => {
  const factory = crearFactory('json');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const before = h.getRawWorldText();
    const world = crearWorldSnapshotV1(clonarMundo(FECHA_FIJA));
    world.byTenant.soma.tenantId = 'monkeys';
    assert.throws(() => h.adapter.guardar(world));
    assert.equal(h.getRawWorldText(), before);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] B4 guardarTenant V1 sin data → error y clave intacta', () => {
  const factory = crearFactory('localStorage');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const before = h.getTenantRaw('soma');
    assert.throws(
      () => h.adapter.guardarTenant('soma', { schemaVersion: 1, tenantId: 'soma' }),
      (err) => err && err.code === 'PERSISTENCIA_CORRUPTA',
    );
    assert.equal(h.getTenantRaw('soma'), before);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] B4 guardarTenant V1 con data incompleta → error y clave intacta', () => {
  const factory = crearFactory('localStorage');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const before = h.getTenantRaw('soma');
    const incomplete = {
      schemaVersion: 1,
      tenantId: 'soma',
      data: { tenantId: 'soma', socios: [] },
    };
    assert.throws(
      () => h.adapter.guardarTenant('soma', incomplete),
      (err) => err && err.code === 'PERSISTENCIA_CORRUPTA',
    );
    assert.equal(h.getTenantRaw('soma'), before);
  } finally {
    h.cleanup();
  }
});

test('[json] B3 WorldSnapshotV1 incompleto al guardar → error sin escritura', () => {
  const factory = crearFactory('json');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const before = h.getRawWorldText();
    const world = crearWorldSnapshotV1(clonarMundo(FECHA_FIJA));
    delete world.byTenant.soma.socios;
    assert.throws(() => h.adapter.guardar(world));
    assert.equal(h.getRawWorldText(), before);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] B3 WorldSnapshotV1 incompleto al guardar → error sin escritura', () => {
  const factory = crearFactory('localStorage');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const beforeSoma = h.getTenantRaw('soma');
    const world = crearWorldSnapshotV1(clonarMundo(FECHA_FIJA));
    delete world.byTenant.soma.membresias;
    assert.throws(() => h.adapter.guardar(world));
    assert.equal(h.getTenantRaw('soma'), beforeSoma);
  } finally {
    h.cleanup();
  }
});

test('[json] WorldSnapshotV1 válido continúa guardándose', () => {
  const factory = crearFactory('json');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const world = crearWorldSnapshotV1(clonarMundo(FECHA_FIJA));
    world.byTenant.soma.socios = [];
    const snap = h.adapter.guardar(world);
    assert.equal(snap.schemaVersion, 1);
    assert.equal(snap.byTenant.soma.socios.length, 0);
    const reloaded = JSON.parse(h.getRawWorldText());
    assert.equal(esWorldSnapshotV1(reloaded), true);
    assert.equal(reloaded.byTenant.soma.socios.length, 0);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] TenantSnapshotV1 válido continúa guardándose', () => {
  const factory = crearFactory('localStorage');
  const h = factory.create();
  try {
    assert.equal(h.loadOrThrow().ok, true);
    const snap = sliceCompleto('soma');
    snap.data.socios = [];
    h.adapter.guardarTenant('soma', snap);
    const stored = JSON.parse(h.getTenantRaw('soma'));
    assert.equal(esTenantSnapshotV1(stored, 'soma'), true);
    assert.equal(stored.data.socios.length, 0);
  } finally {
    h.cleanup();
  }
});

test('[localStorage] Bootstrap y migración V0→V1 continúan funcionando', () => {
  const factory = crearFactory('localStorage');
  // bootstrap vacío
  const hEmpty = factory.create({ seedText: null });
  try {
    const r = hEmpty.loadOrThrow();
    assert.equal(r.ok, true);
    assert.equal(r.carga.bootstrapped, true);
    assert.ok(hEmpty.memoria().listarSocios('soma').length > 0);
  } finally {
    hEmpty.cleanup();
  }
  // V0 → V1
  const v0 = clonarDemo('soma', FECHA_FIJA);
  v0.socios = [{
    id: 'sm-b34',
    tenantId: 'soma',
    nombre: 'Migrate B34',
    telefono: '+56976666666',
    sedeId: 'SOMA Antofagasta',
    planId: 'ct-2',
    estado: 'activo',
    fechaIngreso: FECHA_FIJA,
    cuposUsadosMes: 0,
  }];
  delete v0.membresias;
  const h = factory.create({
    seedLocal: {
      [claveEstadoV1('soma')]: JSON.stringify(v0),
      [claveEstadoV1('monkeys')]: JSON.stringify(clonarDemo('monkeys', FECHA_FIJA)),
    },
  });
  try {
    const r = h.loadOrThrow();
    assert.equal(r.ok, true);
    assert.equal(r.carga.migrated, true);
    assert.equal(h.memoria().listarSocios('soma')[0].nombre, 'Migrate B34');
    assert.equal(esTenantSnapshotV1(JSON.parse(h.getTenantRaw('soma')), 'soma'), true);
  } finally {
    h.cleanup();
  }
});
