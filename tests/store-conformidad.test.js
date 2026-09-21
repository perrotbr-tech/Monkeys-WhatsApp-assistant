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
