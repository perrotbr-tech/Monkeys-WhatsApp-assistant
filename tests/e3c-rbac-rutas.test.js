/**
 * E3C — RBAC de rutas, aislamiento operativo y auditoría.
 */
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearApp } from '../server/index.js';
import { clonarMundo } from '../data/demo.js';
import { resetLocks, firmarSesion, cookieSesion } from '../engine/auth.js';
import { crearAuditSinkMemoria } from '../core/audit/sink.js';
import { catalogoWorkspaces, buscarTenant, USUARIOS_DEMO } from '../data/tenants.js';
import { crearRelojFijo } from '../engine/clock.js';
import { crearContextoAcceso } from '../core/identity/usuario.js';
import { tienePermiso, permisosDeRol, normalizarRol } from '../core/authorization/rbac.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SECRET = 'e3c-test-secret';
const CLOCK = crearRelojFijo('2026-09-13T15:00:00.000Z');
const FECHA = '2026-09-13';

const auditSink = crearAuditSinkMemoria(catalogoWorkspaces());
const { app, memoria, auditSink: audit } = crearApp({
  mundo: clonarMundo(FECHA),
  persist: false,
  sessionSecret: SECRET,
  clock: CLOCK,
  auditSink,
});

let server;
let port;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });
});

after(() => new Promise((r) => server.close(r)));

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

test('E3C-1: ruta protegida sin sesión → 401', async () => {
  const r = await req({ path: '/api/bookings', headers: { 'X-Tenant': 'monkeys' } });
  assert.equal(r.res.status, 401);
});

test('E3C-2: cookie de MONKEYS usada en SOMA → 401', async () => {
  const cookie = await login('monkeys', 'dueno@monkeys.demo');
  const r = await req({ path: '/api/bookings', headers: { 'X-Tenant': 'soma' }, cookie });
  assert.equal(r.res.status, 401);
});

test('E3C-3: rol desconocido → 403', async () => {
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'ghost@monkeys.demo',
    rol: 'superadmin',
  });
  const r = await req({ path: '/api/bookings', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(r.res.status, 403);
});

test('E3C-4: alumno no accede a Gestión → 403', async () => {
  const cookie = await login('monkeys', 'alumno@monkeys.demo');
  const bookings = await req({ path: '/api/bookings', headers: { 'X-Tenant': 'monkeys' }, cookie });
  const socios = await req({ path: '/api/socios', headers: { 'X-Tenant': 'monkeys' }, cookie });
  const pagos = await req({ path: '/api/pagos', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(bookings.res.status, 403);
  assert.equal(socios.res.status, 403);
  assert.equal(pagos.res.status, 403);
});

test('E3C-5: coach puede leer reservas/socios permitidos', async () => {
  const cookie = await login('monkeys', 'coach@monkeys.demo');
  const bookings = await req({ path: '/api/bookings', headers: { 'X-Tenant': 'monkeys' }, cookie });
  const socios = await req({ path: '/api/socios', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(bookings.res.status, 200);
  assert.equal(socios.res.status, 200);
  assert.ok(Array.isArray(bookings.json.bookings));
  assert.ok(Array.isArray(socios.json.socios));
});

test('E3C-6: coach no puede modificar socios', async () => {
  const cookie = await login('monkeys', 'coach@monkeys.demo');
  const r = await req({
    method: 'POST',
    path: '/api/socios',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
    body: {
      nombre: 'Intruso Coach',
      telefono: '961119999',
      planId: 'mensual',
      sedeId: 'felix-garcia',
      fechaInicio: FECHA,
    },
  });
  assert.equal(r.res.status, 403);
});

test('E3C-7: coach no puede leer ni modificar pagos', async () => {
  const cookie = await login('monkeys', 'coach@monkeys.demo');
  const leer = await req({ path: '/api/pagos', headers: { 'X-Tenant': 'monkeys' }, cookie });
  const marcar = await req({
    method: 'POST',
    path: '/api/pagos/pago-monkeys-29/marcar',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
    body: { referencia: 'TR-HACK' },
  });
  assert.equal(leer.res.status, 403);
  assert.equal(marcar.res.status, 403);
  const pago = memoria.pagoPorReferencia('monkeys', 'pago-monkeys-29')
    || memoria.listarPagos('monkeys').find((p) => p.id === 'pago-monkeys-29');
  assert.equal(pago.estado, 'pendiente');
});

test('E3C-8: recepción puede gestionar socios', async () => {
  const cookie = await login('monkeys', 'recepcion@monkeys.demo');
  const list = await req({ path: '/api/socios', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(list.res.status, 200);
  const alta = await req({
    method: 'POST',
    path: '/api/socios',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
    body: {
      nombre: 'Socio Recepción',
      telefono: '961118888',
      planId: 'mensual',
      sedeId: 'felix-garcia',
      fechaInicio: FECHA,
    },
  });
  assert.equal(alta.res.status, 200);
  assert.equal(alta.json.ok, true);
});

test('E3C-9: ventas puede leer pagos pero no marcarlos', async () => {
  const cookie = await login('monkeys', 'ventas@monkeys.demo');
  const leer = await req({ path: '/api/pagos', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(leer.res.status, 200);
  const marcar = await req({
    method: 'POST',
    path: '/api/pagos/pago-monkeys-30/marcar',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
    body: { referencia: 'TR-VENTAS' },
  });
  assert.equal(marcar.res.status, 403);
  const pago = memoria.listarPagos('monkeys').find((p) => p.id === 'pago-monkeys-30');
  assert.equal(pago.estado, 'pendiente');
});

test('E3C-10: solo propietario/administrador puede resetear demo', async () => {
  const coach = await login('monkeys', 'coach@monkeys.demo');
  const bad = await req({ method: 'POST', path: '/api/demo/reset', headers: { 'X-Tenant': 'monkeys' }, cookie: coach });
  assert.equal(bad.res.status, 403);

  const recepcion = await login('monkeys', 'recepcion@monkeys.demo');
  const bad2 = await req({ method: 'POST', path: '/api/demo/reset', headers: { 'X-Tenant': 'monkeys' }, cookie: recepcion });
  assert.equal(bad2.res.status, 403);

  const dueno = await login('monkeys', 'dueno@monkeys.demo');
  const ok = await req({ method: 'POST', path: '/api/demo/reset', headers: { 'X-Tenant': 'monkeys' }, cookie: dueno });
  assert.equal(ok.res.status, 200);
  assert.equal(ok.json.ok, true);
});

test('E3C-11: permiso explícito restrictivo prevalece sobre el rol', async () => {
  const cookie = cookieFor({
    tenantId: 'monkeys',
    email: 'dueno@monkeys.demo',
    rol: 'dueño',
    permisos: ['gestion:panel'],
  });
  const panel = await req({ path: '/api/bookings', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(panel.res.status, 403);
  const me = await req({ path: '/api/me', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(me.res.status, 200);
  assert.deepEqual(me.json.permisos, ['gestion:panel']);
  assert.equal(tienePermiso({ rol: 'dueño', permisos: ['gestion:panel'] }, 'gestion:socios:leer'), false);
});

test('E3C-12: feature gestion deshabilitado → 403', async () => {
  const t = buscarTenant('monkeys');
  const prev = t.features.gestion;
  t.features.gestion = false;
  try {
    const loginFail = await req({
      method: 'POST',
      path: '/api/login',
      headers: { 'X-Tenant': 'monkeys' },
      body: { email: 'dueno@monkeys.demo', password: 'demo1234' },
    });
    assert.equal(loginFail.res.status, 403);
    const pubs = await req({ path: '/api/classes', headers: { 'X-Tenant': 'monkeys' } });
    assert.equal(pubs.res.status, 403);
  } finally {
    t.features.gestion = prev;
  }
});

test('E3C-13: rutas públicas autorizadas siguen funcionando', async () => {
  const health = await req({ path: '/api/health' });
  assert.equal(health.res.status, 200);
  const theme = await req({ path: '/api/tenants/monkeys/theme' });
  assert.equal(theme.res.status, 200);
  const classes = await req({ path: '/api/classes', headers: { 'X-Tenant': 'monkeys' } });
  assert.equal(classes.res.status, 200);
  const plans = await req({ path: '/api/plans', headers: { 'X-Tenant': 'monkeys' } });
  assert.equal(plans.res.status, 200);
  const conv = await req({ method: 'POST', path: '/api/conversations', headers: { 'X-Tenant': 'soma' } });
  assert.equal(conv.res.status, 200);
});

test('E3C-14: referencia de pago de SOMA bajo MONKEYS → 404', async () => {
  const somaPago = memoria.listarPagos('soma').find((p) => p.estado === 'pendiente');
  assert.ok(somaPago);
  const link = await memoria.enviarLinkPago('soma', somaPago.id, {});
  assert.equal(link.ok, true);
  const ref = link.referencia;
  const r = await req({ path: `/api/pagos/demo/${encodeURIComponent(ref)}`, headers: { 'X-Tenant': 'monkeys' } });
  assert.equal(r.res.status, 404);
});

test('E3C-15: intento cross-tenant no modifica ningún pago', async () => {
  const somaPago = memoria.listarPagos('soma').find((p) => p.estado === 'pendiente' && p.linkReferencia);
  assert.ok(somaPago);
  const ref = somaPago.linkReferencia;
  const antesSoma = JSON.stringify(memoria.listarPagos('soma').map((p) => ({ id: p.id, estado: p.estado })));
  const antesMonkeys = JSON.stringify(memoria.listarPagos('monkeys').map((p) => ({ id: p.id, estado: p.estado })));
  const r = await req({
    method: 'POST',
    path: `/api/pagos/demo/${encodeURIComponent(ref)}/pagar`,
    headers: { 'X-Tenant': 'monkeys' },
    body: {},
  });
  assert.ok(r.res.status === 400 || r.res.status === 404);
  assert.equal(
    JSON.stringify(memoria.listarPagos('soma').map((p) => ({ id: p.id, estado: p.estado }))),
    antesSoma,
  );
  assert.equal(
    JSON.stringify(memoria.listarPagos('monkeys').map((p) => ({ id: p.id, estado: p.estado }))),
    antesMonkeys,
  );
});

test('E3C-16: webhook no busca pagos en otros workspaces', async () => {
  const somaPago = memoria.listarPagos('soma').find((p) => p.estado === 'pendiente' && p.linkReferencia);
  assert.ok(somaPago);
  const antes = { ...somaPago };
  const r = await req({
    method: 'POST',
    path: '/api/pagos/webhook',
    headers: { 'X-Tenant': 'monkeys' },
    body: { referencia: somaPago.linkReferencia, estado: 'pagada', pagoId: somaPago.id },
  });
  assert.equal(r.json.ok, false);
  const after = memoria.listarPagos('soma').find((p) => p.id === somaPago.id);
  assert.equal(after.estado, antes.estado);
});

test('E3C-17: mutación exitosa crea evento de auditoría correcto', async () => {
  audit.limpiar();
  const cookie = await login('monkeys', 'dueno@monkeys.demo');
  const r = await req({
    method: 'POST',
    path: '/api/socios',
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
    body: {
      nombre: 'Audit Socio',
      telefono: '961117777',
      planId: 'mensual',
      sedeId: 'felix-garcia',
      fechaInicio: FECHA,
    },
  });
  assert.equal(r.res.status, 200);
  const eventos = audit.listarPorWorkspace('monkeys');
  const ev = eventos.find((e) => e.action === 'socio.alta');
  assert.ok(ev);
  assert.equal(ev.workspaceId, 'monkeys');
  assert.ok(ev.actorId);
  assert.equal(ev.targetType, 'socio');
  assert.equal(ev.sourceDomain, 'gestion');
  assert.equal(ev.timestamp, CLOCK.iso());
});

test('E3C-18: evento auditado no contiene secretos', async () => {
  const eventos = audit.todos();
  const blob = JSON.stringify(eventos);
  assert.equal(blob.includes('demo1234'), false);
  assert.equal(blob.includes(SECRET), false);
  assert.equal(/password|clave|token|secret/i.test(blob.replace(/"action":"[^"]+"/g, '')), false);
  for (const e of eventos) {
    for (const k of Object.keys(e.metadata || {})) {
      assert.equal(/password|clave|token|secret/i.test(k), false);
    }
  }
});

test('E3C-19: operación denegada no ejecuta la mutación', async () => {
  const cookie = await login('monkeys', 'ventas@monkeys.demo');
  const pago = memoria.listarPagos('monkeys').find((p) => p.estado === 'pendiente');
  const estadoAntes = pago.estado;
  const nAntes = audit.todos().length;
  const r = await req({
    method: 'POST',
    path: `/api/pagos/${pago.id}/marcar`,
    headers: { 'X-Tenant': 'monkeys' },
    cookie,
    body: { referencia: 'TR-DENEGADO' },
  });
  assert.equal(r.res.status, 403);
  const after = memoria.listarPagos('monkeys').find((p) => p.id === pago.id);
  assert.equal(after.estado, estadoAntes);
  assert.equal(after.referencia || null, pago.referencia || null);
  const marcados = audit.todos().slice(nAntes).filter((e) => e.action === 'pago.marcar');
  assert.equal(marcados.length, 0);
});

test('E3C-20: /api/me devuelve permisos/features efectivos', async () => {
  const cookie = await login('monkeys', 'ventas@monkeys.demo');
  const me = await req({ path: '/api/me', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(me.res.status, 200);
  assert.ok(me.json.usuario.email);
  assert.ok(me.json.usuario.rol);
  assert.ok(Array.isArray(me.json.permisos));
  assert.ok(me.json.permisos.includes('gestion:pagos:leer'));
  assert.equal(me.json.permisos.includes('gestion:pagos:escribir'), false);
  assert.equal(me.json.features.gestion, true);
  assert.equal(me.json.features.forja, false);
});

test('E3C-21: la navegación respeta permisos sin reemplazar el control del backend', async () => {
  const appJs = readFileSync(join(ROOT, 'app.js'), 'utf8');
  assert.match(appJs, /gestion:pagos:leer/);
  assert.match(appJs, /gestion:automatizacion/);
  assert.match(appJs, /gestion:socios:escribir/);
  assert.match(appJs, /aplicarVisibilidadNav/);
  const cookie = await login('monkeys', 'coach@monkeys.demo');
  const pagos = await req({ path: '/api/pagos', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(pagos.res.status, 403);
});

test('E3C-22: Core continúa sin importar server/, engine/, data/, app.js ni IO', async () => {
  const coreFiles = [
    'core/index.js',
    'core/authorization/rbac.js',
    'core/identity/usuario.js',
    'core/organizations/workspace.js',
    'core/audit/sink.js',
    'core/features/flags.js',
  ];
  for (const rel of coreFiles) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    assert.equal(/\bfrom ['"]\.\.\/\.\.\/(server|engine|data)\//.test(src), false, rel);
    assert.equal(/\bfrom ['"].*app\.js['"]/.test(src), false, rel);
    assert.equal(/\b(fs|localStorage|fetch|document|window)\b/.test(src.replace(/\/\/.*/g, '')), false, rel);
  }
});

test('E3C: matriz de roles conserva alias dueño/coach', () => {
  assert.equal(normalizarRol('dueño'), 'propietario');
  assert.equal(normalizarRol('coach'), 'entrenador');
  assert.ok(permisosDeRol('propietario').includes('gestion:configurar'));
  assert.ok(permisosDeRol('recepcion').includes('gestion:socios:escribir'));
  assert.equal(permisosDeRol('recepcion').includes('gestion:automatizacion'), false);
  assert.ok(permisosDeRol('ventas').includes('gestion:pagos:leer'));
  assert.equal(permisosDeRol('ventas').includes('gestion:pagos:escribir'), false);
  assert.ok(permisosDeRol('entrenador').includes('gestion:reservas:leer'));
  assert.equal(permisosDeRol('entrenador').includes('gestion:pagos:leer'), false);
  assert.equal(permisosDeRol('alumno').includes('gestion:panel'), false);
  assert.ok(USUARIOS_DEMO.some((u) => u.rol === 'recepcion'));
});
