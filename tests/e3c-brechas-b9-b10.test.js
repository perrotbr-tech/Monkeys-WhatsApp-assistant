/**
 * E3C revisión B9–B10: reset por workspace y rol desconocido deny-by-default.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearApp } from '../server/index.js';
import { clonarMundo } from '../data/demo.js';
import { resetLocks, firmarSesion, cookieSesion } from '../engine/auth.js';
import { crearAuditSinkMemoria } from '../core/audit/sink.js';
import { catalogoWorkspaces } from '../data/tenants.js';
import { crearRelojFijo } from '../engine/clock.js';
import { crearContextoAcceso } from '../core/identity/usuario.js';
import { tienePermiso, normalizarRol, esPermisoConocido } from '../core/authorization/rbac.js';
import { crearAdaptadorJson, CARGA } from '../engine/persistencia/index.js';

const SECRET = 'e3c-b9b10-secret';
const CLOCK = crearRelojFijo('2026-09-13T15:00:00.000Z');
const FECHA = '2026-09-13';

function cookieFor({ tenantId, email, nombre, rol, permisos }) {
  const ctx = crearContextoAcceso({
    tenantId,
    email,
    nombre: nombre || email,
    rol,
    permisos,
  }, catalogoWorkspaces());
  const payload = {
    ...ctx,
    ...(Array.isArray(permisos) ? { permisos } : {}),
    iat: CLOCK.now(),
  };
  return cookieSesion(firmarSesion(payload, SECRET)).split(';')[0];
}

async function startApp(opts = {}) {
  const auditSink = crearAuditSinkMemoria(catalogoWorkspaces());
  const created = crearApp({
    mundo: opts.mundo || clonarMundo(FECHA),
    persist: opts.persist === true,
    dataFile: opts.dataFile,
    sessionSecret: SECRET,
    clock: CLOCK,
    auditSink,
  });
  const server = await new Promise((resolve) => {
    const s = created.app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  async function req({ method = 'GET', path, headers = {}, body, cookie }) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        ...headers,
        ...(cookie ? { cookie } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { res, json, text, cookie: res.headers.get('set-cookie') };
  }
  async function login(tenant, email, password = 'demo1234') {
    resetLocks();
    const r = await req({
      method: 'POST',
      path: '/api/login',
      headers: { 'X-Tenant': tenant },
      body: { email, password },
    });
    assert.equal(r.res.status, 200, `login ${email}@${tenant}`);
    return (r.cookie || '').split(';')[0];
  }
  return { ...created, server, port, req, login, auditSink };
}

function fingerprintTenant(memoria, tenantId) {
  const snap = memoria.snapshot();
  return JSON.stringify(snap.byTenant[tenantId]);
}

async function runResetIsolation({ persist, label }) {
  const dir = persist ? mkdtempSync(join(tmpdir(), 'e3c-b9-')) : null;
  const dataFile = persist ? join(dir, 'data.json') : undefined;
  const ctx = await startApp({ persist: Boolean(persist), dataFile });
  after(() => new Promise((r) => ctx.server.close(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    r();
  })));

  const cookieSoma = await ctx.login('soma', 'dueno@soma.demo');
  const alta = await ctx.req({
    method: 'POST',
    path: '/api/socios',
    headers: { 'X-Tenant': 'soma' },
    cookie: cookieSoma,
    body: {
      nombre: 'Socio B9 SOMA',
      telefono: '961110001',
      planId: 'ct-2',
      sedeId: 'soma-antofagasta',
      fechaInicio: FECHA,
    },
  });
  assert.equal(alta.res.status, 200, `${label} alta soma`);
  assert.equal(alta.json.ok, true);
  const somaId = alta.json.socio.id;
  // Forzar persistencia ordinaria antes de capturar huella (combinar auto + slice).
  if (persist) ctx.saveState();
  const somaAntes = fingerprintTenant(ctx.memoria, 'soma');
  const monkeysAntes = fingerprintTenant(ctx.memoria, 'monkeys');
  assert.ok(ctx.memoria.listarSocios('soma').some((s) => s.id === somaId));

  const cookieMonkeys = await ctx.login('monkeys', 'dueno@monkeys.demo');
  const nAudit = ctx.auditSink.todos().length;
  const reset = await ctx.req({
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Tenant': 'monkeys' },
    cookie: cookieMonkeys,
  });
  assert.equal(reset.res.status, 200, `${label} reset monkeys`);
  assert.equal(fingerprintTenant(ctx.memoria, 'soma'), somaAntes, `${label} SOMA intacto tras reset MONKEYS`);
  assert.notEqual(fingerprintTenant(ctx.memoria, 'monkeys'), monkeysAntes, `${label} MONKEYS cambió`);
  assert.ok(ctx.memoria.listarSocios('soma').some((s) => s.id === somaId));
  assert.equal(
    ctx.memoria.listarSocios('monkeys').some((s) => s.nombre === 'Socio B9 SOMA'),
    false,
  );
  const ev = ctx.auditSink.todos().slice(nAudit).find((e) => e.action === 'demo.reset');
  assert.ok(ev, `${label} audit reset`);
  assert.equal(ev.workspaceId, 'monkeys');
  assert.equal(ev.targetId, 'monkeys');

  if (persist) {
    const reload = crearAdaptadorJson({ filePath: dataFile, clock: CLOCK }).cargar();
    assert.equal(reload.status, CARGA.V3_VALIDO);
    assert.ok(reload.world && reload.world.byTenant);
    assert.deepEqual(
      reload.world.byTenant.soma,
      ctx.memoria.snapshot().byTenant.soma,
      `${label} SOMA equivalente tras recarga`,
    );
    assert.deepEqual(
      reload.world.byTenant.monkeys,
      ctx.memoria.snapshot().byTenant.monkeys,
      `${label} MONKEYS seed persistido`,
    );
    assert.ok(
      (reload.world.byTenant.soma.socios || []).some((s) => s.id === somaId),
      `${label} socio SOMA sobrevive en disco`,
    );
  }

  // Sentido inverso: mutar MONKEYS, reset SOMA
  const cookieM2 = await ctx.login('monkeys', 'dueno@monkeys.demo');
  const altaM = await ctx.req({
    method: 'POST',
    path: '/api/socios',
    headers: { 'X-Tenant': 'monkeys' },
    cookie: cookieM2,
    body: {
      nombre: 'Socio B9 MONKEYS',
      telefono: '961110002',
      planId: 'mensual',
      sedeId: 'felix-garcia',
      fechaInicio: FECHA,
    },
  });
  assert.equal(altaM.res.status, 200, `${label} alta monkeys`);
  if (persist) ctx.saveState();
  const monkeysAntes2 = fingerprintTenant(ctx.memoria, 'monkeys');
  const somaAntes2 = fingerprintTenant(ctx.memoria, 'soma');

  const cookieS2 = await ctx.login('soma', 'dueno@soma.demo');
  const resetS = await ctx.req({
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Tenant': 'soma' },
    cookie: cookieS2,
  });
  assert.equal(resetS.res.status, 200, `${label} reset soma`);
  assert.equal(fingerprintTenant(ctx.memoria, 'monkeys'), monkeysAntes2, `${label} MONKEYS intacto tras reset SOMA`);
  assert.notEqual(fingerprintTenant(ctx.memoria, 'soma'), somaAntes2, `${label} SOMA cambió`);
  assert.ok(ctx.memoria.listarSocios('monkeys').some((s) => s.nombre === 'Socio B9 MONKEYS'));
  assert.equal(ctx.memoria.listarSocios('soma').some((s) => s.id === somaId), false);

  if (persist) {
    const reload2 = crearAdaptadorJson({ filePath: dataFile, clock: CLOCK }).cargar();
    assert.deepEqual(
      reload2.world.byTenant.monkeys,
      ctx.memoria.snapshot().byTenant.monkeys,
      `${label} MONKEYS equivalente tras reset SOMA + recarga`,
    );
    assert.ok(
      (reload2.world.byTenant.monkeys.socios || []).some((s) => s.nombre === 'Socio B9 MONKEYS'),
      `${label} socio MONKEYS sobrevive en disco`,
    );
  }
}

test('B9: reset MONKEYS no modifica SOMA (persist:false)', async () => {
  await runResetIsolation({ persist: false, label: 'mem' });
});

test('B9: reset MONKEYS no modifica SOMA (adaptador JSON) y persiste', async () => {
  await runResetIsolation({ persist: true, label: 'json' });
});

test('B10.1: rol desconocido sin permisos → 403', async () => {
  const ctx = await startApp();
  after(() => new Promise((r) => ctx.server.close(r)));
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'ghost@monkeys.demo',
    rol: 'superadmin',
  });
  const r = await ctx.req({
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
  });
  assert.equal(r.res.status, 403);
});

test('B10.2: rol desconocido con permiso conocido → 403', async () => {
  const ctx = await startApp();
  after(() => new Promise((r) => ctx.server.close(r)));
  const antes = fingerprintTenant(ctx.memoria, 'monkeys');
  const nAudit = ctx.auditSink.todos().length;
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'ghost@monkeys.demo',
    rol: 'superadmin',
    permisos: ['gestion:configurar'],
  });
  const r = await ctx.req({
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
  });
  assert.equal(r.res.status, 403);
  assert.equal(fingerprintTenant(ctx.memoria, 'monkeys'), antes);
  assert.equal(ctx.auditSink.todos().slice(nAudit).some((e) => e.action === 'demo.reset'), false);
});

test('B10.3: rol desconocido con todos los permisos → 403', async () => {
  assert.equal(normalizarRol('superadmin'), null);
  assert.equal(
    tienePermiso({
      rol: 'superadmin',
      permisos: [
        'gestion:configurar',
        'gestion:panel',
        'gestion:socios:escribir',
        'gestion:pagos:escribir',
        'gestion:automatizacion',
      ],
    }, 'gestion:configurar'),
    false,
  );
  const ctx = await startApp();
  after(() => new Promise((r) => ctx.server.close(r)));
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'ghost@monkeys.demo',
    rol: 'root',
    permisos: [
      'gestion:acceso',
      'gestion:panel',
      'gestion:reservas:leer',
      'gestion:leads:leer',
      'gestion:conversaciones:leer',
      'gestion:socios:leer',
      'gestion:socios:escribir',
      'gestion:pagos:leer',
      'gestion:pagos:escribir',
      'gestion:automatizacion',
      'gestion:configurar',
      'gestion:auditoria:leer',
    ],
  });
  const r = await ctx.req({
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
  });
  assert.equal(r.res.status, 403);
});

test('B10.4: rol canónico con lista explícita restrictiva conserva solo esa autorización', async () => {
  assert.equal(
    tienePermiso({ rol: 'dueño', permisos: ['gestion:panel'] }, 'gestion:panel'),
    true,
  );
  assert.equal(
    tienePermiso({ rol: 'dueño', permisos: ['gestion:panel'] }, 'gestion:configurar'),
    false,
  );
  const ctx = await startApp();
  after(() => new Promise((r) => ctx.server.close(r)));
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'dueno@monkeys.demo',
    rol: 'dueño',
    permisos: ['gestion:panel'],
  });
  const me = await ctx.req({ path: '/api/me', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(me.res.status, 200);
  assert.deepEqual(me.json.permisos, ['gestion:panel']);
  const reset = await ctx.req({
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
  });
  assert.equal(reset.res.status, 403);
  const bookings = await ctx.req({ path: '/api/bookings', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(bookings.res.status, 403);
});

test('B10.5: permiso desconocido no autoriza y no aparece como efectivo', async () => {
  assert.equal(esPermisoConocido('permiso:fantasma'), false);
  assert.equal(
    tienePermiso({ rol: 'dueño', permisos: ['permiso:fantasma', 'gestion:panel'] }, 'permiso:fantasma'),
    false,
  );
  const ctxAcc = crearContextoAcceso({
    tenantId: 'monkeys',
    email: 'dueno@monkeys.demo',
    rol: 'dueño',
    permisos: ['permiso:fantasma', 'gestion:panel'],
  }, catalogoWorkspaces());
  assert.equal(ctxAcc.permisos.includes('permiso:fantasma'), false);
  assert.deepEqual(ctxAcc.permisos, ['gestion:panel']);

  const ctx = await startApp();
  after(() => new Promise((r) => ctx.server.close(r)));
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'dueno@monkeys.demo',
    rol: 'dueño',
    permisos: ['permiso:fantasma', 'gestion:panel'],
  });
  const me = await ctx.req({ path: '/api/me', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(me.res.status, 200);
  assert.equal(me.json.permisos.includes('permiso:fantasma'), false);
  assert.deepEqual(me.json.permisos, ['gestion:panel']);
});

test('B10.6: operación denegada no muta ni genera evento de éxito', async () => {
  const ctx = await startApp();
  after(() => new Promise((r) => ctx.server.close(r)));
  const cookieSoma = await ctx.login('soma', 'dueno@soma.demo');
  await ctx.req({
    method: 'POST',
    path: '/api/socios',
    headers: { 'X-Tenant': 'soma' },
    cookie: cookieSoma,
    body: {
      nombre: 'Antes Denegado',
      telefono: '961110099',
      planId: 'ct-2',
      sedeId: 'soma-antofagasta',
      fechaInicio: FECHA,
    },
  });
  const somaFp = fingerprintTenant(ctx.memoria, 'soma');
  const monkeysFp = fingerprintTenant(ctx.memoria, 'monkeys');
  const nAudit = ctx.auditSink.todos().length;
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'ghost@monkeys.demo',
    rol: 'superadmin',
    permisos: ['gestion:configurar'],
  });
  const r = await ctx.req({
    method: 'POST',
    path: '/api/demo/reset',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
  });
  assert.equal(r.res.status, 403);
  assert.equal(fingerprintTenant(ctx.memoria, 'soma'), somaFp);
  assert.equal(fingerprintTenant(ctx.memoria, 'monkeys'), monkeysFp);
  assert.equal(ctx.auditSink.todos().slice(nAudit).some((e) => e.action === 'demo.reset'), false);
});
