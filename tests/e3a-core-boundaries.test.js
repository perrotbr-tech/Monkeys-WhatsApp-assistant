/**
 * E3A — Contratos iniciales de Forkza Core y fronteras internas.
 */

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  workspaceIdDesdeTenantId,
  esWorkspaceConocido,
  contextoCoincideConSesion,
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
import { USUARIOS_DEMO, listarTenants, featuresTenant } from '../data/tenants.js';
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
after(() => new Promise((r) => server.close(r)));

test('E3A: puente tenantId → workspaceId (monkeys/soma)', () => {
  assert.equal(workspaceIdDesdeTenantId('monkeys'), 'monkeys');
  assert.equal(workspaceIdDesdeTenantId('soma'), 'soma');
  assert.equal(workspaceIdDesdeTenantId('MONKEYS'), 'monkeys');
  assert.equal(esWorkspaceConocido('monkeys'), true);
  assert.equal(esWorkspaceConocido('soma'), true);
});

test('E3A: workspace desconocido se rechaza', () => {
  assert.throws(() => workspaceIdDesdeTenantId('ghost'), (e) => e.code === 'workspace_desconocido');
  assert.equal(esWorkspaceConocido('ghost'), false);
  assert.equal(
    contextoCoincideConSesion({ tenantId: 'monkeys' }, { tenantId: 'soma', workspaceId: 'soma' }),
    false,
  );
  assert.equal(
    contextoCoincideConSesion({ workspaceId: 'monkeys' }, { workspaceId: 'monkeys', tenantId: 'monkeys' }),
    true,
  );
  assert.equal(
    contextoCoincideConSesion({ tenantId: 'monkeys' }, null),
    false,
  );
});

test('E3A: identidad demo con userId estable', () => {
  const ids = new Set();
  for (const u of USUARIOS_DEMO) {
    const a = userIdEstable({ tenantId: u.tenantId, email: u.email });
    const b = userIdEstable({ tenantId: u.tenantId, email: u.email });
    assert.equal(a, b);
    assert.match(a, /^usr_/);
    ids.add(a);
    const ctx = crearContextoAcceso(u);
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
  assert.equal(u.userId, userIdEstable({ tenantId: 'monkeys', email: 'dueno@monkeys.demo' }));

  const cookie = (login.cookie || '').split(';')[0];
  const me = await req(port, { path: '/api/me', headers: { 'X-Tenant': 'monkeys' }, cookie });
  assert.equal(me.res.status, 200);
  assert.equal(me.json.usuario.tenantId, 'monkeys');
  assert.equal(me.json.usuario.workspaceId, 'monkeys');
  assert.equal(me.json.usuario.userId, u.userId);
  assert.equal(me.json.usuario.rol, 'dueño');

  const vista = vistaSesion(crearContextoAcceso(USUARIOS_DEMO[0]));
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
  const sink = crearAuditSinkMemoria();
  sink.record({
    workspaceId: 'monkeys',
    actorId: 'usr_monkeys_a',
    action: 'login',
    targetType: 'session',
    targetId: null,
    sourceDomain: 'core',
    timestamp: '2026-09-14T15:00:00.000Z',
    metadata: { ok: true },
  });
  sink.record({
    workspaceId: 'soma',
    actorId: 'usr_soma_a',
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
  assert.equal(m[0].actorId, 'usr_monkeys_a');
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
    () => aplicarContratoAccion({ tipo: 'mensaje', estado: 'pendiente' }),
    (e) => e.code === 'accion_sin_workspace' || e.code === 'accion_sin_origen' || e.code === 'accion_sin_fecha',
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
    }),
    (e) => e.code === 'mensaje_debe_ir_a_socio',
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
    if (s.includes('data/demo')) return 'data/demo.js';
    if (/(^|\/)engine(\/|$)/.test(s) || s.startsWith('engine')) return 'engine/';
    if (/(^|\/)server(\/|$)/.test(s) || s.startsWith('server')) return 'server/';
    if (/(^|\/)gestion(\/|$)/.test(s)) return 'gestion/';
    if (/(^|\/)forja(\/|$)/.test(s)) return 'forja/';
    if (s.startsWith('.')) {
      const abs = join(dirname(fromFile), s);
      const norm = relative(ROOT, abs).replace(/\\/g, '/');
      if (norm === 'app.js' || norm.endsWith('/app.js')) return 'app.js';
      if (norm.includes('data/demo')) return 'data/demo.js';
      if (norm.startsWith('engine/') || norm.includes('/engine/')) return 'engine/';
      if (norm.startsWith('server/') || norm.includes('/server/')) return 'server/';
      if (norm.startsWith('gestion/') || norm.includes('/gestion/')) return 'gestion/';
      if (norm.startsWith('forja/') || norm.includes('/forja/')) return 'forja/';
      // Fuera de core/ hacia arriba más allá de core
      if (!norm.startsWith('core/') && !norm.startsWith('node:')) {
        // imports relativos solo dentro de core/
        if (norm.startsWith('..') || (!norm.startsWith('core') && !s.startsWith('.'))) {
          // allow only core-internal; relative resolved outside core is forbidden
          if (!norm.startsWith('core/')) return `fuera-de-core:${norm}`;
        }
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
