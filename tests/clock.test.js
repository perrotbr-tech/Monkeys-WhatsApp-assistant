import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  crearRelojSistema,
  crearRelojFijo,
  crearRelojSimulado,
  usarReloj,
  conReloj,
  relojActivo,
} from '../engine/clock.js';
import { fechaHoy, ZONA_DEFAULT } from '../engine/dates.js';
import {
  intentarLogin,
  resetLocks,
  LOCK_MS,
  MAX_FALLOS,
  usuariosConHash,
  hashClave,
} from '../engine/auth.js';
import { formatearRespuesta } from '../engine/whatsapp-out.js';
import { crearEngine } from '../engine/conversation.js';
import { clonarDemo } from '../data/demo.js';
import { crearStoreLocal, crearStorageMemoria } from '../engine/store-local.js';
import { CLAVE_DEMO } from '../data/tenants.js';
import { crearApp } from '../server/index.js';
import { clonarMundo } from '../data/demo.js';

afterEach(() => {
  usarReloj(null);
  resetLocks();
});

test('reloj del sistema es el activo por defecto', () => {
  usarReloj(null);
  const sys = crearRelojSistema();
  assert.equal(typeof sys.now(), 'number');
  assert.ok(sys.date() instanceof Date);
  assert.match(sys.iso(), /^\d{4}-\d{2}-\d{2}T/);
  const before = relojActivo().now();
  const after = sys.now();
  assert.ok(Math.abs(after - before) < 100);
});

test('fechaHoy con reloj fijo no depende del día de ejecución', () => {
  const clock = crearRelojFijo('2026-03-15T15:00:00.000Z');
  conReloj(clock, () => {
    assert.equal(fechaHoy('UTC'), '2026-03-15');
    assert.equal(fechaHoy('America/Santiago'), '2026-03-15');
    assert.equal(fechaHoy(ZONA_DEFAULT, clock), '2026-03-15');
  });
});

test('fechaHoy respeta la zona del tenant cerca de medianoche', () => {
  // 02:30 UTC del 15 = 14 de enero 23:30 en America/Santiago.
  const clock = crearRelojFijo('2026-01-15T02:30:00.000Z');
  assert.equal(fechaHoy('UTC', clock), '2026-01-15');
  assert.equal(fechaHoy('America/Santiago', clock), '2026-01-14');
});

test('timestamps de WhatsApp y conversación usan el Clock inyectado', () => {
  const iso = '2026-09-14T12:00:00.000Z';
  const clock = crearRelojFijo(iso);
  conReloj(clock, () => {
    const msg = formatearRespuesta({ texto: 'Hola' });
    assert.equal(msg.hora, iso);
  });
  const engine = crearEngine(clonarDemo('soma', '2026-09-14'), 'soma', {
    fechaRef: '2026-09-14',
    clock,
  });
  const { mensajes } = engine.iniciar();
  assert.equal(mensajes[0].hora, iso);
});

test('bloqueo de auth se puede probar sin Date.now real', () => {
  const clock = crearRelojSimulado('2026-09-14T10:00:00.000Z');
  const usuarios = usuariosConHash(hashClave('demo1234'));
  resetLocks();
  for (let i = 0; i < MAX_FALLOS; i += 1) {
    const bad = intentarLogin({
      tenantId: 'soma',
      email: 'dueno@soma.demo',
      password: 'mala',
      usuarios,
      now: clock.now(),
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.status, i === MAX_FALLOS - 1 ? 429 : 401);
  }
  const stillLocked = intentarLogin({
    tenantId: 'soma',
    email: 'dueno@soma.demo',
    password: 'demo1234',
    usuarios,
    now: clock.now(),
  });
  assert.equal(stillLocked.status, 429);

  clock.avanzar(LOCK_MS + 1);
  const unlocked = intentarLogin({
    tenantId: 'soma',
    email: 'dueno@soma.demo',
    password: 'demo1234',
    usuarios,
    now: clock.now(),
  });
  assert.equal(unlocked.ok, true);
  assert.equal(unlocked.usuario.email, 'dueno@soma.demo');
});

test('StoreLocal libera bloqueo al avanzar el reloj simulado', async () => {
  const clock = crearRelojSimulado('2026-09-14T10:00:00.000Z');
  const store = crearStoreLocal('soma', crearStorageMemoria(), {
    fechaRef: '2026-09-14',
    clock,
  });
  for (let i = 0; i < 5; i += 1) {
    const bad = await store.login('dueno@soma.demo', 'mala');
    assert.equal(bad.status, i === 4 ? 429 : 401);
  }
  assert.equal((await store.login('dueno@soma.demo', CLAVE_DEMO)).status, 429);
  clock.avanzar(LOCK_MS + 1);
  const ok = await store.login('dueno@soma.demo', CLAVE_DEMO);
  assert.equal(ok.ok, true);
});

test('conReloj conserva el reloj en callback síncrono', () => {
  const fixed = 1_111_111_111_111;
  const outer = relojActivo();
  const observed = conReloj(crearRelojFijo(fixed), () => relojActivo().now());
  assert.equal(observed, fixed);
  assert.equal(relojActivo(), outer);
});

test('conReloj conserva el reloj después de await', async () => {
  const fixed = 1_234_567_890;
  const outer = relojActivo();
  const observed = await conReloj(crearRelojFijo(fixed), async () => {
    await Promise.resolve();
    return relojActivo().now();
  });
  assert.equal(observed, fixed);
  assert.equal(relojActivo(), outer);
});

test('conReloj restaura tras excepción síncrona', () => {
  const outer = relojActivo();
  const fixed = crearRelojFijo(2_222_222_222_222);
  assert.throws(
    () => conReloj(fixed, () => {
      throw new Error('boom-sync');
    }),
    /boom-sync/,
  );
  assert.equal(relojActivo(), outer);
  assert.notEqual(relojActivo().now(), fixed.now());
});

test('conReloj restaura tras rechazo async', async () => {
  const outer = relojActivo();
  const fixed = crearRelojFijo(3_333_333_333_333);
  await assert.rejects(
    () => conReloj(fixed, async () => {
      await Promise.resolve();
      throw new Error('boom-async');
    }),
    /boom-async/,
  );
  assert.equal(relojActivo(), outer);
  assert.notEqual(relojActivo().now(), fixed.now());
});

test('conReloj restaura el reloj anterior tras éxito', () => {
  const base = crearRelojFijo(4_000_000_000_000);
  usarReloj(base);
  const nested = crearRelojFijo(4_000_000_000_001);
  const seen = conReloj(nested, () => relojActivo().now());
  assert.equal(seen, 4_000_000_000_001);
  assert.equal(relojActivo().now(), 4_000_000_000_000);
});

test('conReloj anidado conserva y restaura cada nivel', async () => {
  const outer = crearRelojFijo(5_000_000_000_000);
  const mid = crearRelojFijo(5_000_000_000_100);
  const inner = crearRelojFijo(5_000_000_000_200);
  usarReloj(outer);

  const result = await conReloj(mid, async () => {
    assert.equal(relojActivo().now(), mid.now());
    const innerSeen = await conReloj(inner, async () => {
      await Promise.resolve();
      assert.equal(relojActivo().now(), inner.now());
      return relojActivo().now();
    });
    assert.equal(innerSeen, inner.now());
    assert.equal(relojActivo().now(), mid.now());
    await Promise.resolve();
    return relojActivo().now();
  });

  assert.equal(result, mid.now());
  assert.equal(relojActivo().now(), outer.now());
});

test('crearApp con Clock fijo firma iat determinístico', async () => {
  const fixed = 1_725_000_000_000;
  const clock = crearRelojFijo(fixed);
  const { app } = crearApp({
    mundo: clonarMundo('2026-09-14'),
    persist: false,
    sessionSecret: 'clock-test',
    clock,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    const port = server.address().port;
    resetLocks();
    const res = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant': 'monkeys' },
      body: JSON.stringify({ email: 'dueno@monkeys.demo', password: 'demo1234' }),
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie') || '';
    assert.match(cookie, /forkza_session=/);
    const token = cookie.split(';')[0].split('=')[1];
    const body = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    assert.equal(body.iat, fixed);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
