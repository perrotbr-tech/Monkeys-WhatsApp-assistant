import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearStoreLocal, crearStorageMemoria, claveEstado } from '../engine/store-local.js';
import { CLAVE_DEMO } from '../data/tenants.js';

test('StoreLocal con localStorage simulado no cruza datos entre tenants', async () => {
  const storage = crearStorageMemoria();
  const fechaRef = '2026-09-14';
  const soma = crearStoreLocal('soma', storage, { fechaRef });
  const monkeys = crearStoreLocal('monkeys', storage, { fechaRef });

  const start = await soma.iniciarConversacion();
  const id = start.conversacion.id;
  await soma.enviarMensaje(id, '2');
  await soma.enviarMensaje(id, 'Crosstraining Lunes 18:00');
  await soma.enviarMensaje(id, 'Ana Soma');
  await soma.enviarMensaje(id, '912345678');
  await soma.enviarMensaje(id, 'omitir');
  const done = await soma.enviarMensaje(id, 'confirmar');
  assert.match(done.mensajes[0].texto, /SOMA-2026-0001/);

  const somaBooks = await soma.listarReservas();
  const monBooks = await monkeys.listarReservas();
  assert.equal(somaBooks.every((b) => b.codigo.startsWith('SOMA-')), true);
  assert.equal(monBooks.some((b) => String(b.codigo).startsWith('SOMA-')), false);
  assert.equal(somaBooks.some((b) => String(b.codigo).startsWith('GYM-')), false);

  const somaRaw = JSON.parse(storage.getItem(claveEstado('soma')));
  const monRaw = JSON.parse(storage.getItem(claveEstado('monkeys')));
  const somaData = somaRaw.data || somaRaw;
  const monData = monRaw.data || monRaw;
  assert.equal((somaData.bookings || []).some((b) => b.codigo === 'SOMA-2026-0001'), true);
  assert.equal((monData.bookings || []).some((b) => String(b.codigo).startsWith('SOMA-')), false);
});

test('StoreLocal conserva cuposUsadosMes y la tarea de cupos agotados al persistir', async () => {
  const storage = crearStorageMemoria();
  const store = crearStoreLocal('soma', storage, { fechaRef: '2026-09-14' });
  const socio = store.engine.memoria.buscarSocioPorTelefono('soma', '+56962000001');
  const plan = store.engine.listarPlanes().find((p) => p.id === socio.planId);
  socio.cuposUsadosMes = plan.cuposMes;
  const start = await store.iniciarConversacion();
  const id = start.conversacion.id;
  await store.enviarMensaje(id, 'reservar mi cupo');
  await store.enviarMensaje(id, 'Crosstraining Lunes 18:00');
  await store.enviarMensaje(id, socio.nombre);
  await store.enviarMensaje(id, '962000001');
  await store.enviarMensaje(id, 'omitir');
  const done = await store.enviarMensaje(id, 'confirmar');
  assert.match(done.mensajes[0].texto, /Ya usaste los/);
  const raw = JSON.parse(storage.getItem(claveEstado('soma')));
  const data = raw.data || raw;
  const guardado = data.socios.find((s) => s.id === socio.id);
  assert.equal(guardado.cuposUsadosMes, plan.cuposMes);
  assert.equal((data.automation.acciones || []).some((a) => a.motivo === 'cupos agotados'), true);

  const reloaded = crearStoreLocal('soma', storage, { fechaRef: '2026-09-14' });
  const otra = reloaded.engine.memoria.buscarSocioPorTelefono('soma', '+56962000001');
  assert.equal(otra.cuposUsadosMes, plan.cuposMes);
  assert.equal(reloaded.engine.memoria.listarAcciones('soma').some((a) => a.motivo === 'cupos agotados'), true);
});

test('StoreLocal bloquea login tras 5 fallos aunque el 6º sea correcto', async () => {
  const storage = crearStorageMemoria();
  const store = crearStoreLocal('soma', storage);
  for (let i = 0; i < 5; i += 1) {
    const bad = await store.login('dueno@soma.demo', 'mala');
    assert.equal(bad.ok, false);
    assert.equal(bad.status, i === 4 ? 429 : 401);
  }
  const locked = await store.login('dueno@soma.demo', CLAVE_DEMO);
  assert.equal(locked.ok, false);
  assert.equal(locked.status, 429);
  assert.equal(locked.error, 'bloqueado');
});
