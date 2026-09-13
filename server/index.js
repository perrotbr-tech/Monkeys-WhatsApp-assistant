import express from 'express';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clonarMundo, clonar } from '../data/demo.js';
import { TENANT_DEFAULT, tenantActivo, varsMarca, USUARIOS_DEMO } from '../data/tenants.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation } from '../engine/automation.js';
import { crearMemoria, combinarPersistencia } from '../engine/store.js';
import { fechaHoy, fechaDesdeQuery } from '../engine/dates.js';
import {
  COOKIE, parseCookies, firmarSesion, leerSesion, cookieSesion, cookieLogout,
  intentarLogin, usuariosConHash, hashClave, resetLocks,
} from '../engine/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'data.json');

const SESSION_SECRET = process.env.SESSION_SECRET || 'forkza-demo-hmac';
const HASH_DEMO = hashClave('demo1234');

function loadState() {
  mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) {
    const seed = clonarMundo();
    writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const parsed = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  if (!parsed.byTenant) {
    const seed = clonarMundo();
    writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const soma = parsed.byTenant.soma;
  const monkeys = parsed.byTenant.monkeys;
  if (soma && soma.plans && soma.plans[0] && !('cuposMes' in soma.plans[0])) {
    const seed = clonarMundo();
    parsed.byTenant.soma = seed.byTenant.soma;
    writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
  }
  if (!monkeys || !Array.isArray(monkeys.membresias) || (monkeys.socios || []).length < 40) {
    const seed = clonarMundo();
    parsed.byTenant.monkeys = seed.byTenant.monkeys;
    if (parsed.byTenant.soma && !Array.isArray(parsed.byTenant.soma.membresias)) {
      parsed.byTenant.soma = seed.byTenant.soma;
    }
    writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
  }
  return parsed;
}

export function crearApp({ mundo = null, persist = true, sessionSecret = SESSION_SECRET, pagosOpts = null } = {}) {
  let state = mundo ? clonar(mundo) : loadState();
  const memoria = crearMemoria(state);
  const engines = {
    monkeys: crearEngine({ memoria }, 'monkeys'),
    soma: crearEngine({ memoria }, 'soma'),
  };
  const autos = {
    monkeys: crearAutomation(memoria.sliceExport('monkeys'), 'monkeys'),
    soma: crearAutomation(memoria.sliceExport('soma'), 'soma'),
  };
  const usuarios = usuariosConHash(HASH_DEMO);
  const secret = sessionSecret;

  function pasarela() {
    if (pagosOpts) return pagosOpts;
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || '';
    if (!accessToken) return {};
    return {
      accessToken,
      httpClient: {
        async request({ method, url, headers, body }) {
          const res = await fetch(url, {
            method,
            headers,
            body: body != null ? JSON.stringify(body) : undefined,
          });
          return res.json();
        },
      },
    };
  }

  function saveState() {
    const snap = memoria.snapshot();
    for (const id of Object.keys(autos)) {
      if (!snap.byTenant[id]) continue;
      const merged = combinarPersistencia(snap.byTenant[id], autos[id].exportar());
      snap.byTenant[id] = merged;
      autos[id].hidratar(merged);
    }
    state = snap;
    if (persist) {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(snap, null, 2));
    }
  }

  function tenantOf(req) {
    const slug = req.get('X-Tenant') || TENANT_DEFAULT;
    return tenantActivo(slug);
  }

  function fechaDeReq(req) {
    const q = (req.query && req.query.fecha) || (req.body && req.body.fecha);
    return fechaDesdeQuery(`fecha=${q || ''}`) || fechaHoy(req.tenant && req.tenant.zonaHoraria);
  }

  function requireTenant(req, res, next) {
    const t = tenantOf(req);
    if (!t) return res.status(400).json({ error: 'tenant_not_found' });
    req.tenant = t;
    req.engine = engines[t.id];
    req.auto = autos[t.id];
    if (req.engine && req.engine.setFechaRef) req.engine.setFechaRef(fechaDeReq(req));
    next();
  }

  function sesionDe(req) {
    const cookies = parseCookies(req.headers.cookie);
    const payload = leerSesion(cookies[COOKIE], secret);
    if (!payload || !payload.email) return null;
    return payload;
  }

  function requireAuth(req, res, next) {
    const s = sesionDe(req);
    if (!s || s.tenantId !== req.tenant.id) return res.status(401).json({ error: 'unauthorized' });
    req.usuario = s;
    next();
  }

  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mode: 'api' });
  });

  app.get('/api/tenants/:slug/theme', (req, res) => {
    const t = tenantActivo(req.params.slug);
    if (!t) return res.status(400).json({ error: 'tenant_not_found' });
    res.json({
      slug: t.slug,
      nombre: t.nombre,
      marca: t.marca,
      textosBot: t.textosBot,
      demo: t.demo,
      vars: varsMarca(t.marca),
      sedes: t.sedes,
    });
  });

  app.post('/api/login', requireTenant, (req, res) => {
    const email = req.body && req.body.email;
    const password = req.body && req.body.password;
    const r = intentarLogin({
      tenantId: req.tenant.id,
      email,
      password,
      usuarios,
    });
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    const token = firmarSesion({ ...r.usuario, iat: Date.now() }, secret);
    res.setHeader('Set-Cookie', cookieSesion(token));
    res.json({ ok: true, usuario: r.usuario });
  });

  app.post('/api/logout', requireTenant, (_req, res) => {
    res.setHeader('Set-Cookie', cookieLogout());
    res.json({ ok: true });
  });

  app.get('/api/me', requireTenant, (req, res) => {
    const s = sesionDe(req);
    if (!s || s.tenantId !== req.tenant.id) return res.status(401).json({ error: 'unauthorized' });
    res.json({ usuario: { email: s.email, nombre: s.nombre, rol: s.rol, tenantId: s.tenantId } });
  });

  app.post('/api/conversations', requireTenant, (req, res) => {
    const result = req.engine.iniciar();
    saveState();
    res.json(result);
  });

  app.post('/api/conversations/:id/messages', requireTenant, (req, res) => {
    const text = req.body && req.body.text;
    const result = req.engine.procesar(req.params.id, text);
    saveState();
    res.json(result);
  });

  app.get('/api/classes', requireTenant, (req, res) => {
    res.json({ classes: req.engine.listarClases(req.query.sede) });
  });

  app.get('/api/plans', requireTenant, (req, res) => {
    res.json({ plans: req.engine.listarPlanes() });
  });

  app.get('/api/bookings', requireTenant, requireAuth, (req, res) => {
    res.json({ bookings: req.engine.listarReservas() });
  });

  app.get('/api/leads', requireTenant, requireAuth, (req, res) => {
    res.json({ leads: req.engine.listarLeads() });
  });

  app.get('/api/conversations', requireTenant, requireAuth, (req, res) => {
    res.json({ conversations: req.engine.listarConversaciones() });
  });

  app.post('/api/demo/reset', requireTenant, requireAuth, (req, res) => {
    const seed = clonarMundo();
    memoria.hidratar(seed);
    engines.monkeys = crearEngine({ memoria }, 'monkeys');
    engines.soma = crearEngine({ memoria }, 'soma');
    autos.monkeys = crearAutomation(memoria.sliceExport('monkeys'), 'monkeys');
    autos.soma = crearAutomation(memoria.sliceExport('soma'), 'soma');
    saveState();
    res.json({ ok: true });
  });

  app.post('/api/automation/run', requireTenant, requireAuth, (req, res) => {
    const fecha = fechaDeReq(req);
    const campania = req.auto.ejecutarCiclo(fecha);
    saveState();
    res.json({ ok: true, campania, summary: req.auto.summary(fecha) });
  });

  app.get('/api/automation/summary', requireTenant, requireAuth, (req, res) => {
    res.json(req.auto.summary(fechaDeReq(req)));
  });

  app.get('/api/automation/actions', requireTenant, requireAuth, (req, res) => {
    res.json({
      actions: req.auto.listarAcciones({
        agente: req.query.agente,
        sede: req.query.sede,
        estado: req.query.estado,
      }),
    });
  });

  app.post('/api/automation/actions/:id/estado', requireTenant, requireAuth, (req, res) => {
    const acc = req.auto.setEstado(req.params.id, req.body && req.body.estado);
    if (!acc) return res.status(404).json({ error: 'not found' });
    saveState();
    res.json({ action: acc });
  });

  app.post('/api/automation/agentes/:id/activo', requireTenant, requireAuth, (req, res) => {
    const activos = req.auto.setAgenteActivo(req.params.id, req.body && req.body.activo);
    saveState();
    res.json({ agentesActivos: activos });
  });

  app.get('/api/pagos/config', requireTenant, (req, res) => {
    const opts = pasarela();
    res.json({
      modo: opts.accessToken ? 'mercadopago' : 'demo',
      pasarela: opts.accessToken ? 'Mercado Pago' : 'Pasarela en modo demostración',
      datosBancarios: memoria.datosBancarios(req.tenant.id),
    });
  });

  app.get('/api/socios/plantilla.csv', requireTenant, requireAuth, (_req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('nombre,telefono,email,plan,fechaInicio,sede\n');
  });

  app.get('/api/socios', requireTenant, requireAuth, (req, res) => {
    res.json({
      socios: memoria.filtrarSocios(req.tenant.id, {
        q: req.query.q,
        sede: req.query.sede,
        plan: req.query.plan,
        estado: req.query.estado,
        estadoSocio: req.query.estadoSocio,
        vence7: req.query.vence7 === '1' || req.query.vence7 === 'true',
      }, fechaDeReq(req)),
    });
  });

  app.get('/api/socios/:id', requireTenant, requireAuth, (req, res) => {
    const ficha = memoria.fichaSocio(req.tenant.id, req.params.id, fechaDeReq(req));
    if (!ficha) return res.status(404).json({ error: 'not found' });
    res.json(ficha);
  });

  app.post('/api/socios', requireTenant, requireAuth, (req, res) => {
    const r = memoria.altaSocio(req.tenant.id, req.body || {}, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    res.json(r);
  });

  app.put('/api/socios/:id', requireTenant, requireAuth, (req, res) => {
    const r = memoria.editarSocio(req.tenant.id, req.params.id, req.body || {});
    if (!r.ok) return res.status(400).json(r);
    saveState();
    res.json(r);
  });

  app.post('/api/socios/:id/baja', requireTenant, requireAuth, (req, res) => {
    const r = memoria.bajaSocio(req.tenant.id, req.params.id, req.body && req.body.motivo, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    res.json(r);
  });

  app.post('/api/socios/:id/reactivar', requireTenant, requireAuth, (req, res) => {
    const r = memoria.reactivarSocio(req.tenant.id, req.params.id);
    if (!r.ok) return res.status(400).json(r);
    saveState();
    res.json(r);
  });

  app.post('/api/socios/import', requireTenant, requireAuth, (req, res) => {
    const r = memoria.importarSociosCsv(req.tenant.id, (req.body && req.body.csv) || '', fechaDeReq(req));
    saveState();
    res.json(r);
  });

  app.get('/api/pagos', requireTenant, requireAuth, (req, res) => {
    const estado = req.query.estado;
    let pagos = memoria.listarPagos(req.tenant.id);
    if (estado) pagos = pagos.filter((p) => p.estado === estado);
    res.json({ pagos, conciliacion: memoria.conciliacionMes(req.tenant.id, fechaDeReq(req)) });
  });

  app.post('/api/pagos/:id/marcar', requireTenant, requireAuth, (req, res) => {
    const r = memoria.marcarPagado(req.tenant.id, req.params.id, req.body && req.body.referencia, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    res.json(r);
  });

  app.post('/api/pagos/:id/enviar-link', requireTenant, requireAuth, async (req, res) => {
    const r = await memoria.enviarLinkPago(req.tenant.id, req.params.id, pasarela());
    if (!r.ok) return res.status(400).json(r);
    saveState();
    res.json(r);
  });

  app.get('/api/pagos/export.csv', requireTenant, requireAuth, (req, res) => {
    const r = memoria.exportarPagosCsv(req.tenant.id, fechaDeReq(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(r.csv);
  });

  app.get('/api/pagos/conciliacion', requireTenant, requireAuth, (req, res) => {
    res.json(memoria.conciliacionMes(req.tenant.id, fechaDeReq(req)));
  });

  app.get('/api/pagos/demo/:ref', requireTenant, (req, res) => {
    const pago = memoria.pagoPorReferencia(req.tenant.id, req.params.ref)
      || (memoria.buscarPagoEnTenants(req.params.ref) || {}).pago;
    if (!pago) return res.status(404).json({ error: 'not found' });
    res.json({ pago });
  });

  app.post('/api/pagos/demo/:ref/pagar', requireTenant, (req, res) => {
    const r = memoria.pagarDemo(req.params.ref, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    res.json(r);
  });

  app.post('/api/pagos/webhook', requireTenant, (req, res) => {
    const r = memoria.webhookPago(req.tenant.id, req.body || {}, pasarela());
    if (r.ok) saveState();
    res.json(r);
  });

  app.use(express.static(ROOT));

  return {
    app,
    memoria,
    engines,
    autos,
    saveState,
    resetLocks,
    usuarios,
    demoUsers: USUARIOS_DEMO,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app } = crearApp();
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  app.listen(port, () => {
    console.log(`FORKZA demo listening on http://localhost:${port}`);
  });
}
