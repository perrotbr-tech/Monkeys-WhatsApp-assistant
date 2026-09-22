/**
 * E3A — Contratos iniciales de Forkza Core y fronteras internas.
 * Incluye correcciones de revisión B1–B4.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  crearCatalogoWorkspaces,
  workspaceIdDesdeTenantId,
  esWorkspaceConocido,
  contextoCoincideConSesion,
  resolverParTenantWorkspace,
} from '../core/organizations/workspace.js';
import {
  userIdEstable,
  crearContextoAcceso,
  vistaSesion,
} from '../core/identity/usuario.js';
import {
  normalizarRol,
  tienePermiso,
  permisosDeRol,
} from '../core/authorization/rbac.js';
import {
  featuresDe,
  featureHabilitado,
  FEATURES_DEFAULT,
} from '../core/features/flags.js';
import {
  aplicarContratoAccion,
  destinatarioPorTipo,
  DESTINATARIO_SOCIO,
  DESTINATARIO_EQUIPO,
} from '../core/contracts/accion.js';
import { crearAuditSinkMemoria } from '../core/audit/sink.js';
import {
  USUARIOS_DEMO,
  listarTenants,
  featuresTenant,
  catalogoWorkspaces,
  registrarTenant,
  resetCatalogoTenants,
} from '../data/tenants.js';
import { crearApp } from '../server/index.js';
import { clonarMundo } from '../data/demo.js';
import { resetLocks } from '../engine/auth.js';
import { crearMemoria } from '../engine/store.js';
import { crearAutomation } from '../engine/automation.js';
import { crearRelojFijo } from '../engine/clock.js';
import { base as baseAccion } from '../engine/agents/accion.js';

const FECHA = '2026-09-14';
const CLOCK = crearRelojFijo('2026-09-14T15:00:00.000Z');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE_DIR = join(ROOT, 'core');
const CAT = catalogoWorkspaces();

function start() {
  const { app } = crearApp({ mundo: clonarMundo(), persist: false, sessionSecret: 'test-secret', clock: CLOCK });
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
after(() => {
  resetCatalogoTenants();
  return new Promise((r) => server.close(r));
});

test('E3A: puente tenantId → workspaceId (monkeys/soma)', () => {
  assert.equal(workspaceIdDesdeTenantId('monkeys', CAT), 'monkeys');
  assert.equal(workspaceIdDesdeTenantId('soma', CAT), 'soma');
  assert.equal(workspaceIdDesdeTenantId('MONKEYS', CAT), 'monkeys');
  assert.equal(esWorkspaceConocido('monkeys', CAT), true);
  assert.equal(esWorkspaceConocido('soma', CAT), true);
});

test('E3A: workspace desconocido se rechaza', () => {
  assert.throws(() => workspaceIdDesdeTenantId('ghost', CAT), (e) => e.code === 'workspace_desconocido');
  assert.equal(esWorkspaceConocido('ghost', CAT), false);
  assert.equal(
    contextoCoincideConSesion({ tenantId: 'monkeys' }, { tenantId: 'soma', workspaceId: 'soma' }, CAT),
    false,
  );
  assert.equal(
    contextoCoincideConSesion({ workspaceId: 'monkeys' }, { workspaceId: 'monkeys', tenantId: 'monkeys' }, CAT),
    true,
  );
  assert.equal(
    contextoCoincideConSesion({ tenantId: 'monkeys' }, null, CAT),
    false,
  );
});

test('E3A: identidad demo con userId estable', () => {
  const ids = new Set();
  for (const u of USUARIOS_DEMO) {
    const a = userIdEstable({ email: u.email });
    const b = userIdEstable({ email: u.email });
    assert.equal(a, b);
    assert.match(a, /^usr_/);
    assert.ok(!a.startsWith(`usr_${u.tenantId}_`), 'userId no debe prefijarse con workspace');
    ids.add(a);
    const ctx = crearContextoAcceso(u, CAT);
    assert.equal(ctx.userId, a);
    assert.equal(ctx.workspaceId, u.tenantId);
    assert.equal(ctx.tenantId, u.tenantId);
    assert.equal(ctx.email, u.email);
    assert.equal(ctx.nombre, u.nombre);
    assert.equal(ctx.rol, u.rol);
  }
  assert.equal(ids.size, USUARIOS_DEMO.length);
});

test('E3A: sesión conserva compatibilidad y agrega workspaceId', async () => {
  resetLocks();
  const login = await req(port, {
    method: 'POST',
    path: '/api/login',
    headers: { 'X-Tenant': 'monkeys' },
    body: { email: 'dueno@monkeys.demo', password: 'demo1234' },
  });
  assert.equal(login.res.status, 200);
  const u = login.json.usuario;
  assert.equal(u.tenantId, 'monkeys');
  assert.equal(u.email, 'dueno@monkeys.demo');
  assert.equal(u.nombre, 'Dueña demo');
  assert.equal(u.rol, 'dueño');
  assert.equal(u.workspaceId, 'monkeys');
  assert.equal(u.userId, userIdEstable({ email: 'dueno@monkeys.demo' }));

  const cookie = (login.cookie || '').split(';')[0];
  const me = await req(port, { path: '/api/me', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(me.res.status, 200);
  assert.equal(me.json.usuario.tenantId, 'monkeys');
  assert.equal(me.json.usuario.workspaceId, 'monkeys');
  assert.equal(me.json.usuario.userId, u.userId);
  assert.equal(me.json.usuario.rol, 'dueño');

  const vista = vistaSesion(crearContextoAcceso(USUARIOS_DEMO[0], CAT));
  assert.deepEqual(Object.keys(vista).sort(), ['email', 'nombre', 'rol', 'tenantId', 'userId', 'workspaceId'].sort());
});

test('E3A: rol o permiso desconocido denegado', () => {
  assert.equal(normalizarRol('superadmin'), null);
  assert.equal(tienePermiso({ rol: 'superadmin' }, 'gestion:acceso'), false);
  assert.equal(tienePermiso({ rol: 'dueño' }, 'permiso:fantasma'), false);
  assert.equal(tienePermiso({ rol: 'coach' }, 'forja:acceso'), true);
  assert.equal(tienePermiso({ rol: 'dueño' }, 'gestion:panel'), true);
});

test('E3A: permisos explícitos evaluados correctamente', () => {
  assert.equal(
    tienePermiso({ rol: 'dueño', permisos: ['gestion:socios:leer'] }, 'gestion:panel'),
    false,
  );
  assert.equal(
    tienePermiso({ rol: 'dueño', permisos: ['gestion:socios:leer'] }, 'gestion:socios:leer'),
    true,
  );
  assert.equal(
    tienePermiso({ permisos: ['gestion:acceso'] }, 'gestion:acceso'),
    true,
  );
  assert.ok(permisosDeRol('propietario').includes('gestion:acceso'));
  assert.equal(normalizarRol('dueño'), 'propietario');
  assert.equal(normalizarRol('coach'), 'entrenador');
});

test('E3A: feature gestion habilitado', () => {
  for (const t of listarTenants()) {
    const f = featuresDe(t);
    assert.equal(featureHabilitado(f, 'gestion'), true);
    assert.equal(featuresTenant(t).gestion, true);
  }
  assert.equal(featureHabilitado(FEATURES_DEFAULT, 'gestion'), true);
});

test('E3A: feature forja deshabilitado', () => {
  for (const t of listarTenants()) {
    const f = featuresDe(t);
    assert.equal(featureHabilitado(f, 'forja'), false);
    assert.equal(featuresTenant(t).forja, false);
  }
});

test('E3A: feature desconocido deshabilitado', () => {
  const f = featuresDe({ gestion: true, forja: false });
  assert.equal(featureHabilitado(f, 'billing'), false);
  assert.equal(featureHabilitado(f, ''), false);
  assert.equal(featureHabilitado(null, 'gestion'), false);
});

test('E3A: acciones incluyen destinatario y origen', () => {
  const socio = { id: 's01', tenantId: 'monkeys', sedeId: 'felix-garcia', nombre: 'Ana' };
  const msg = baseAccion('referidos', socio, FECHA, 'mensaje', 'baja', 'referidos', 'Hola Ana');
  assert.equal(msg.workspaceId, 'monkeys');
  assert.equal(msg.tenantId, 'monkeys');
  assert.equal(msg.destinatarioRol, DESTINATARIO_SOCIO);
  assert.equal(msg.origenDominio, 'gestion');
  assert.equal(msg.origenTipo, 'agente');
  assert.equal(msg.origenId, 'referidos');
  assert.equal(msg.texto, 'Hola Ana');
  assert.equal(msg.motivo, 'referidos');
  assert.equal(msg.estado, 'pendiente');

  const mem = crearMemoria(clonarMundo(), { clock: CLOCK });
  const creada = mem.crearAccion('soma', {
    agente: 'recordatorio',
    tipo: 'tarea_equipo',
    socioId: 'sm01',
    motivo: 'demo',
    sedeId: 'soma-antofagasta',
  });
  assert.equal(creada.workspaceId, 'soma');
  assert.equal(creada.destinatarioRol, DESTINATARIO_EQUIPO);
  assert.equal(creada.origenDominio, 'gestion');
  assert.equal(creada.origenTipo, 'agente');
  assert.equal(creada.origenId, 'recordatorio');
});

test('E3A: mensajes apuntan a socio', () => {
  assert.equal(destinatarioPorTipo('mensaje'), DESTINATARIO_SOCIO);
  const socio = { id: 's01', tenantId: 'monkeys', sedeId: 'felix-garcia', nombre: 'Ana' };
  const msg = baseAccion('cobranza', socio, FECHA, 'mensaje', 'media', 'cobranza', 'Paga');
  assert.equal(msg.destinatarioRol, 'socio');
});

test('E3A: tareas internas apuntan a equipo', () => {
  assert.equal(destinatarioPorTipo('tarea_equipo'), DESTINATARIO_EQUIPO);
  const socio = { id: 's01', tenantId: 'monkeys', sedeId: 'felix-garcia', nombre: 'Ana' };
  const tarea = baseAccion('reactivacion', socio, FECHA, 'tarea_equipo', 'alta', 'silencioso', null);
  assert.equal(tarea.destinatarioRol, 'equipo');
  assert.equal(tarea.texto, null);
});

test('E3A: AuditSink filtra por workspace sin cruces', () => {
  const sink = crearAuditSinkMemoria(CAT);
  sink.record({
    workspaceId: 'monkeys',
    actorId: 'usr_a',
    action: 'login',
    targetType: 'session',
    targetId: null,
    sourceDomain: 'core',
    timestamp: '2026-09-14T15:00:00.000Z',
    metadata: { ok: true },
  });
  sink.record({
    workspaceId: 'soma',
    actorId: 'usr_b',
    action: 'login',
    targetType: 'session',
    targetId: 'x',
    sourceDomain: 'core',
    timestamp: '2026-09-14T15:01:00.000Z',
    metadata: { ok: true },
  });
  const m = sink.listarPorWorkspace('monkeys');
  const s = sink.listarPorWorkspace('soma');
  assert.equal(m.length, 1);
  assert.equal(s.length, 1);
  assert.equal(m[0].workspaceId, 'monkeys');
  assert.equal(s[0].workspaceId, 'soma');
  assert.equal(m[0].actorId, 'usr_a');
  assert.equal(sink.todos().length, 2);
});

test('E3A: agentes conservan textos y agregan metadatos de contrato', () => {
  const mundo = clonarMundo();
  const mem = crearMemoria(mundo, { clock: CLOCK });
  const auto = crearAutomation(mem.sliceExport('soma'), 'soma', { clock: CLOCK });
  const campania = auto.ejecutarCiclo('2026-09-14');
  assert.ok(campania.acciones.length > 0);
  for (const a of campania.acciones) {
    assert.equal(a.workspaceId, 'soma');
    assert.equal(a.tenantId, 'soma');
    assert.equal(a.origenDominio, 'gestion');
    assert.ok(a.origenTipo);
    assert.ok(a.origenId);
    assert.ok(a.destinatarioRol === 'socio' || a.destinatarioRol === 'equipo');
    if (a.tipo === 'mensaje') assert.equal(a.destinatarioRol, 'socio');
    if (a.tipo === 'tarea_equipo') assert.equal(a.destinatarioRol, 'equipo');
  }
});

test('E3A: contrato no repara silenciosamente acciones inválidas', () => {
  assert.throws(
    () => aplicarContratoAccion({ tipo: 'mensaje', estado: 'pendiente' }, { catalogo: CAT }),
    (e) => e.code === 'workspace_requerido' || e.code === 'accion_sin_origen' || e.code === 'accion_sin_fecha' || e.code === 'catalogo_requerido',
  );
  assert.throws(
    () => aplicarContratoAccion({
      tenantId: 'monkeys',
      tipo: 'mensaje',
      estado: 'pendiente',
      fechaISO: '2026-09-14T00:00:00.000Z',
      origenTipo: 'agente',
      origenId: 'x',
      destinatarioRol: 'equipo',
    }, { catalogo: CAT }),
    (e) => e.code === 'mensaje_debe_ir_a_socio',
  );
});

/* ---- Revisión B1–B4 ---- */

test('E3A-B1: sesión con tenantId/workspaceId cruzados → rechazada', () => {
  assert.throws(
    () => crearContextoAcceso({
      tenantId: 'monkeys',
      workspaceId: 'soma',
      email: 'x@example.com',
      nombre: 'X',
      rol: 'dueño',
    }, CAT),
    (e) => e.code === 'workspace_tenant_incoherente',
  );
  assert.throws(
    () => resolverParTenantWorkspace({ tenantId: 'monkeys', workspaceId: 'soma' }, CAT),
    (e) => e.code === 'workspace_tenant_incoherente',
  );
});

test('E3A-B1: contextoCoincideConSesion no acepta objetos internamente incoherentes', () => {
  assert.equal(
    contextoCoincideConSesion(
      { tenantId: 'monkeys', workspaceId: 'soma' },
      { tenantId: 'monkeys', workspaceId: 'monkeys' },
      CAT,
    ),
    false,
  );
  assert.equal(
    contextoCoincideConSesion(
      { tenantId: 'monkeys', workspaceId: 'monkeys' },
      { tenantId: 'soma', workspaceId: 'monkeys' },
      CAT,
    ),
    false,
  );
});

test('E3A-B2: acción con identificadores cruzados → rechazada e intacta (mensaje)', () => {
  const entrada = Object.freeze({
    tenantId: 'soma',
    workspaceId: 'monkeys',
    tipo: 'mensaje',
    estado: 'pendiente',
    fechaISO: '2026-09-14T00:00:00.000Z',
    origenTipo: 'agente',
    origenId: 'cobranza',
    texto: 'Hola',
    motivo: 'demo',
  });
  const antes = { ...entrada };
  assert.throws(
    () => aplicarContratoAccion(entrada, { catalogo: CAT }),
    (e) => e.code === 'workspace_tenant_incoherente',
  );
  assert.deepEqual({ ...entrada }, antes);
});

test('E3A-B2: acción con identificadores cruzados → rechazada e intacta (tarea)', () => {
  const entrada = {
    tenantId: 'monkeys',
    workspaceId: 'soma',
    tipo: 'tarea_equipo',
    estado: 'pendiente',
    fechaISO: '2026-09-14T00:00:00.000Z',
    origenTipo: 'agente',
    origenId: 'retencion',
    texto: null,
    motivo: 'silencioso',
  };
  const snapshot = JSON.stringify(entrada);
  assert.throws(
    () => aplicarContratoAccion(entrada, { catalogo: CAT }),
    (e) => e.code === 'workspace_tenant_incoherente',
  );
  assert.equal(JSON.stringify(entrada), snapshot);
});

test('E3A-B3: tenant adicional registrado → admitido vía catálogo inyectado', () => {
  resetCatalogoTenants();
  registrarTenant({
    id: 'acme',
    slug: 'acme',
    nombre: 'ACME Gym',
    features: { gestion: true, forja: false },
  });
  const cat = catalogoWorkspaces();
  assert.equal(esWorkspaceConocido('acme', cat), true);
  assert.equal(workspaceIdDesdeTenantId('acme', cat), 'acme');

  const ctx = crearContextoAcceso({
    tenantId: 'acme',
    email: 'owner@acme.demo',
    nombre: 'Owner',
    rol: 'dueño',
  }, cat);
  assert.equal(ctx.workspaceId, 'acme');
  assert.equal(ctx.tenantId, 'acme');

  const accion = aplicarContratoAccion({
    tenantId: 'acme',
    tipo: 'mensaje',
    estado: 'pendiente',
    fechaISO: '2026-09-14T00:00:00.000Z',
    origenTipo: 'agente',
    origenId: 'demo',
    texto: 'hola',
    motivo: 'demo',
  }, { catalogo: cat });
  assert.equal(accion.workspaceId, 'acme');
  assert.equal(accion.destinatarioRol, 'socio');

  const sink = crearAuditSinkMemoria(cat);
  sink.record({
    workspaceId: 'acme',
    actorId: ctx.userId,
    action: 'login',
    targetType: 'session',
    targetId: null,
    sourceDomain: 'core',
    timestamp: '2026-09-14T15:00:00.000Z',
    metadata: { ok: true },
  });
  assert.equal(sink.listarPorWorkspace('acme').length, 1);
  assert.equal(sink.listarPorWorkspace('monkeys').length, 0);

  assert.throws(() => workspaceIdDesdeTenantId('ghost', cat), (e) => e.code === 'workspace_desconocido');
  resetCatalogoTenants();
});

test('E3A-B3: workspace no registrado → rechazado (sin fallback abierto)', () => {
  const cat = crearCatalogoWorkspaces(['monkeys', 'soma']);
  assert.throws(() => workspaceIdDesdeTenantId('acme', cat), (e) => e.code === 'workspace_desconocido');
  assert.equal(esWorkspaceConocido('acme', cat), false);
  assert.throws(
    () => crearContextoAcceso({ tenantId: 'acme', email: 'a@b.com', nombre: 'A', rol: 'dueño' }, cat),
    (e) => e.code === 'workspace_desconocido',
  );
  assert.throws(
    () => crearAuditSinkMemoria(cat).record({
      workspaceId: 'acme',
      actorId: 'u',
      action: 'x',
      targetType: 't',
      targetId: null,
      sourceDomain: 'core',
      timestamp: '2026-09-14T15:00:00.000Z',
      metadata: {},
    }),
    (e) => e.code === 'workspace_desconocido',
  );
});

test('E3A-B3: AuditSink admite tenant adicional y mantiene aislamiento', () => {
  const cat = crearCatalogoWorkspaces(['monkeys', 'soma', 'acme']);
  const sink = crearAuditSinkMemoria(cat);
  sink.record({
    workspaceId: 'acme',
    actorId: 'usr_owner_acme_demo',
    action: 'login',
    targetType: 'session',
    targetId: null,
    sourceDomain: 'core',
    timestamp: '2026-09-14T15:00:00.000Z',
    metadata: { ok: true },
  });
  sink.record({
    workspaceId: 'monkeys',
    actorId: 'usr_a',
    action: 'login',
    targetType: 'session',
    targetId: null,
    sourceDomain: 'core',
    timestamp: '2026-09-14T15:01:00.000Z',
    metadata: { ok: true },
  });
  assert.equal(sink.listarPorWorkspace('acme').length, 1);
  assert.equal(sink.listarPorWorkspace('monkeys').length, 1);
  assert.equal(sink.listarPorWorkspace('soma').length, 0);
  assert.equal(sink.listarPorWorkspace('acme')[0].workspaceId, 'acme');
});

test('E3A-B4: mismo correo en dos workspaces → mismo userId', () => {
  const email = 'same@example.com';
  const a = userIdEstable({ email });
  const b = userIdEstable({ email });
  assert.equal(a, b);
  assert.equal(a, 'usr_same_example_com');

  const ctxM = crearContextoAcceso({
    tenantId: 'monkeys',
    email,
    nombre: 'Same',
    rol: 'dueño',
  }, CAT);
  const ctxS = crearContextoAcceso({
    tenantId: 'soma',
    email,
    nombre: 'Same',
    rol: 'coach',
  }, CAT);
  assert.equal(ctxM.userId, ctxS.userId);
  assert.equal(ctxM.userId, a);
  assert.equal(ctxM.workspaceId, 'monkeys');
  assert.equal(ctxS.workspaceId, 'soma');
  assert.notEqual(ctxM.rol, ctxS.rol);
});

test('E3A-B4: mismo userId puede tener dos contextos separados; userId explícito se respeta', () => {
  const email = 'multi@example.com';
  const fijo = 'usr_explicit_fixed';
  const ctx1 = crearContextoAcceso({
    tenantId: 'monkeys',
    email,
    nombre: 'Multi',
    rol: 'dueño',
    userId: fijo,
  }, CAT);
  const ctx2 = crearContextoAcceso({
    tenantId: 'soma',
    email,
    nombre: 'Multi',
    rol: 'coach',
    userId: fijo,
  }, CAT);
  assert.equal(ctx1.userId, fijo);
  assert.equal(ctx2.userId, fijo);
  assert.equal(ctx1.workspaceId, 'monkeys');
  assert.equal(ctx2.workspaceId, 'soma');
  assert.notDeepEqual(
    { workspaceId: ctx1.workspaceId, rol: ctx1.rol },
    { workspaceId: ctx2.workspaceId, rol: ctx2.rol },
  );
});

function listarJs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listarJs(p));
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

function extraerImports(codigo) {
  const re = /(?:import\s+[^'";]+from\s+|import\s+|export\s+[^'";]+from\s+)['"]([^'"]+)['"]/g;
  const hits = [];
  let m;
  while ((m = re.exec(codigo))) hits.push(m[1]);
  return hits;
}

test('E3A: Core no importa capas prohibidas ni IO directo', () => {
  const ioProhibido = [
    /from\s+['"]node:fs['"]/,
    /from\s+['"]fs['"]/,
    /from\s+['"]node:http['"]/,
    /\bfetch\s*\(/,
    /\bDate\.now\s*\(/,
    /\bnew\s+Date\s*\(/,
    /\bprocess\.env\b/,
    /\blocalStorage\b/,
    /\bwindow\b/,
    /\bdocument\b/,
  ];

  function esProhibido(spec, fromFile) {
    const s = spec.replace(/\\/g, '/');
    if (s === 'app.js' || s.endsWith('/app.js') || s === '../app.js' || s === '../../app.js') return 'app.js';
    if (/(^|\/)data(\/|$)/.test(s) || s.startsWith('data')) return 'data/';
    if (/(^|\/)engine(\/|$)/.test(s) || s.startsWith('engine')) return 'engine/';
    if (/(^|\/)server(\/|$)/.test(s) || s.startsWith('server')) return 'server/';
    if (/(^|\/)gestion(\/|$)/.test(s)) return 'gestion/';
    if (/(^|\/)forja(\/|$)/.test(s)) return 'forja/';
    if (s.startsWith('.')) {
      const abs = join(dirname(fromFile), s);
      const norm = relative(ROOT, abs).replace(/\\/g, '/');
      if (norm === 'app.js' || norm.endsWith('/app.js')) return 'app.js';
      if (norm.startsWith('data/') || norm.includes('/data/')) return 'data/';
      if (norm.startsWith('engine/') || norm.includes('/engine/')) return 'engine/';
      if (norm.startsWith('server/') || norm.includes('/server/')) return 'server/';
      if (norm.startsWith('gestion/') || norm.includes('/gestion/')) return 'gestion/';
      if (norm.startsWith('forja/') || norm.includes('/forja/')) return 'forja/';
      if (!norm.startsWith('core/') && !norm.startsWith('node:')) {
        if (!norm.startsWith('core/')) return `fuera-de-core:${norm}`;
      }
    }
    return null;
  }

  const archivos = listarJs(CORE_DIR);
  assert.ok(archivos.length >= 6, 'debe existir estructura core/');

  for (const file of archivos) {
    const rel = relative(ROOT, file);
    const codigo = readFileSync(file, 'utf8');
    for (const spec of extraerImports(codigo)) {
      const hit = esProhibido(spec, file);
      assert.equal(hit, null, `${rel} importa prohibido (${hit}): ${spec}`);
    }
    for (const re of ioProhibido) {
      assert.equal(re.test(codigo), false, `${rel} usa IO/global prohibido: ${re}`);
    }
  }
});
