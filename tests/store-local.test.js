import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearStoreLocal, crearStorageMemoria, claveEstado } from '../engine/store-local.js';
import { CLAVE_DEMO } from '../data/tenants.js';

test('StoreLocal con localStorage simulado no cruza datos entre tenants', async () => {
  const storage = crearStorageMemoria();
  const soma = crearStoreLocal('soma', storage);
  const monkeys = crearStoreLocal('monkeys', storage);

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
  assert.equal((somaRaw.bookings || []).some((b) => b.codigo === 'SOMA-2026-0001'), true);
  assert.equal((monRaw.bookings || []).some((b) => String(b.codigo).startsWith('SOMA-')), false);
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
