import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../server/index.js';
import { clonarMundo } from '../data/demo.js';
import { resetLocks } from '../engine/auth.js';

function start() {
  const { app } = crearApp({ mundo: clonarMundo(), persist: false, sessionSecret: 'test-secret' });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function req(port, { method = 'GET', path, headers = {}, body, cookie }) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      ...headers,
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { res, json, cookie: res.headers.get('set-cookie') };
}

const { server, port } = await start();
after(() => new Promise((r) => server.close(r)));

test('slug desconocido → 400', async () => {
  const { res, json } = await req(port, { path: '/api/tenants/no-existe/theme' });
  assert.equal(res.status, 400);
  assert.equal(json.error, 'tenant_not_found');
  const bad = await req(port, { path: '/api/classes', headers: { 'X-Tenant': 'ghost' } });
  assert.equal(bad.res.status, 400);
});

test('tema API devuelve colores de cada tenant', async () => {
  const m = await req(port, { path: '/api/tenants/monkeys/theme' });
  const s = await req(port, { path: '/api/tenants/soma/theme' });
  assert.equal(m.res.status, 200);
  assert.equal(m.json.marca.colorAcento, '#F5B400');
  assert.equal(s.json.marca.colorAcento, '#8C8672');
  assert.equal(s.json.marca.colorAcentoSecundario, '#C9A96E');
});

test('login correcto, incorrecto y bloqueo tras 5', async () => {
  resetLocks();
  const ok = await req(port, {
    method: 'POST',
    path: '/api/login',
    headers: { 'X-Tenant': 'soma' },
    body: { email: 'dueno@soma.demo', password: 'demo1234' },
  });
  assert.equal(ok.res.status, 200);
  assert.equal(ok.json.usuario.email, 'dueno@soma.demo');
  assert.match(ok.cookie || '', /forkza_session=/);

  resetLocks();
  for (let i = 0; i < 5; i += 1) {
    const bad = await req(port, {
      method: 'POST',
      path: '/api/login',
      headers: { 'X-Tenant': 'soma' },
      body: { email: 'dueno@soma.demo', password: 'mala' },
    });
    assert.equal(bad.res.status, i === 4 ? 429 : 401);
  }
  const locked = await req(port, {
    method: 'POST',
    path: '/api/login',
    headers: { 'X-Tenant': 'soma' },
    body: { email: 'dueno@soma.demo', password: 'demo1234' },
  });
  assert.equal(locked.res.status, 429);
});

test('rutas protegidas sin sesión → 401', async () => {
  resetLocks();
  const r = await req(port, { path: '/api/bookings', headers: { 'X-Tenant': 'soma' } });
  assert.equal(r.res.status, 401);
  const me = await req(port, { path: '/api/me', headers: { 'X-Tenant': 'soma' } });
  assert.equal(me.res.status, 401);
  const auto = await req(port, { path: '/api/automation/summary', headers: { 'X-Tenant': 'monkeys' } });
  assert.equal(auto.res.status, 401);
});

test('GET /api/me con sesión', async () => {
  resetLocks();
  const login = await req(port, {
    method: 'POST',
    path: '/api/login',
    headers: { 'X-Tenant': 'monkeys' },
    body: { email: 'dueno@monkeys.demo', password: 'demo1234' },
  });
  const cookie = (login.cookie || '').split(';')[0];
  const me = await req(port, { path: '/api/me', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(me.res.status, 200);
  assert.equal(me.json.usuario.rol, 'dueño');
});
