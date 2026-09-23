import express from 'express';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clonarMundo, clonar } from '../data/demo.js';
import { TENANT_DEFAULT, tenantActivo, varsMarca, USUARIOS_DEMO, idsTenantsActivos, catalogoWorkspaces } from '../data/tenants.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation } from '../engine/automation.js';
import { crearMemoria, combinarPersistencia } from '../engine/store.js';
import { fechaHoy, fechaDesdeQuery } from '../engine/dates.js';
import { relojActivo } from '../engine/clock.js';
import {
  firmarSesion, cookieSesion, cookieLogout,
  intentarLogin, usuariosConHash, hashClave, resetLocks,
} from '../engine/auth.js';
import {
  crearAdaptadorJson, CARGA, PersistenciaError, mundoRuntimeDesdeSnapshot,
} from '../engine/persistencia/index.js';
import { crearAuditSinkMemoria } from '../core/audit/sink.js';
import { featuresDe } from '../core/features/flags.js';
import { crearMiddlewareAcceso } from './acceso.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'data.json');

const SESSION_SECRET = process.env.SESSION_SECRET || 'forkza-demo-hmac';
const HASH_DEMO = hashClave('demo1234');

export function crearApp({
  mundo = null,
  persist = true,
  sessionSecret = SESSION_SECRET,
  pagosOpts = null,
  clock = null,
  dataFile = DATA_FILE,
  auditSink = null,
} = {}) {
  const reloj = clock || relojActivo();
  let adapter = null;
  let state;

  if (mundo) {
    state = clonar(mundo);
  } else if (persist) {
    mkdirSync(dirname(dataFile), { recursive: true });
    adapter = crearAdaptadorJson({ filePath: dataFile, clock: reloj });
    const carga = adapter.cargar();
    if (carga.status === CARGA.CORRUPTO) {
      throw carga.error || new PersistenciaError('PERSISTENCIA_CORRUPTA', 'data.json corrupto');
    }
    state = carga.world;
  } else {
    state = clonarMundo();
  }

  const memoria = crearMemoria(state, { clock: reloj });
  /** Engines y automatizaciones: un registro por tenant del catálogo (sin hardcode). */
  const engines = Object.create(null);
  const autos = Object.create(null);

  function reiniciarMotores() {
    for (const key of Object.keys(engines)) delete engines[key];
    for (const key of Object.keys(autos)) delete autos[key];
    for (const id of idsTenantsActivos()) {
      engines[id] = crearEngine({ memoria }, id, { clock: reloj });
      autos[id] = crearAutomation(memoria.sliceExport(id), id, { clock: reloj });
    }
  }

  reiniciarMotores();
  const usuarios = usuariosConHash(HASH_DEMO);
  const secret = sessionSecret;
  const audit = auditSink || crearAuditSinkMemoria(catalogoWorkspaces());
  const {
    requireAuth,
    requireFeature,
    requirePermission,
    resolverContexto,
  } = crearMiddlewareAcceso({ sessionSecret: secret });

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
      if (!adapter) adapter = crearAdaptadorJson({ filePath: dataFile, clock: reloj });
      adapter.guardar(snap);
    }
  }

  function tenantOf(req) {
    const slug = req.get('X-Tenant') || TENANT_DEFAULT;
    return tenantActivo(slug);
  }

  function fechaDeReq(req) {
    const q = (req.query && req.query.fecha) || (req.body && req.body.fecha);
    return fechaDesdeQuery(`fecha=${q || ''}`) || fechaHoy(req.tenant && req.tenant.zonaHoraria, reloj);
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

  function auditar(req, { action, targetType, targetId = null, metadata = {} }) {
    const actor = req.usuario || req.accessContext;
    audit.record({
      workspaceId: req.tenant.id,
      actorId: actor && actor.userId ? actor.userId : null,
      action,
      targetType,
      targetId,
      sourceDomain: 'gestion',
      timestamp: reloj.iso(),
      metadata,
    });
  }

  const featGestion = requireFeature('gestion');

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

  app.post('/api/login', requireTenant, featGestion, (req, res) => {
    const email = req.body && req.body.email;
    const password = req.body && req.body.password;
    const r = intentarLogin({
      tenantId: req.tenant.id,
      email,
      password,
      usuarios,
      now: reloj.now(),
    });
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    const token = firmarSesion({ ...r.usuario, iat: reloj.now() }, secret);
    res.setHeader('Set-Cookie', cookieSesion(token));
    req.usuario = r.usuario;
    auditar(req, {
      action: 'login',
      targetType: 'usuario',
      targetId: r.usuario.userId || r.usuario.email,
      metadata: { email: r.usuario.email, rol: r.usuario.rol },
    });
    res.json({ ok: true, usuario: r.usuario });
  });

  app.post('/api/logout', requireTenant, (_req, res) => {
    res.setHeader('Set-Cookie', cookieLogout());
    res.json({ ok: true });
  });

  app.get('/api/me', requireTenant, requireAuth, (req, res) => {
    const ctx = req.accessContext;
    const features = featuresDe(req.tenant);
    res.json({
      usuario: {
        email: ctx.email,
        nombre: ctx.nombre,
        rol: ctx.rol,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
      },
      permisos: [...(ctx.permisos || [])],
      features: { ...features },
    });
  });

  app.post('/api/conversations', requireTenant, featGestion, (req, res) => {
    const result = req.engine.iniciar();
    saveState();
    res.json(result);
  });

  app.post('/api/conversations/:id/messages', requireTenant, featGestion, (req, res) => {
    const text = req.body && req.body.text;
    const result = req.engine.procesar(req.params.id, text);
    saveState();
    res.json(result);
  });

  app.get('/api/classes', requireTenant, featGestion, (req, res) => {
    res.json({ classes: req.engine.listarClases(req.query.sede) });
  });

  app.get('/api/plans', requireTenant, featGestion, (req, res) => {
    res.json({ plans: req.engine.listarPlanes() });
  });

  app.get('/api/bookings', requireTenant, featGestion, requireAuth, requirePermission('gestion:reservas:leer'), (req, res) => {
    res.json({ bookings: req.engine.listarReservas() });
  });

  app.get('/api/leads', requireTenant, featGestion, requireAuth, requirePermission('gestion:leads:leer'), (req, res) => {
    res.json({ leads: req.engine.listarLeads() });
  });

  app.get('/api/conversations', requireTenant, featGestion, requireAuth, requirePermission('gestion:conversaciones:leer'), (req, res) => {
    res.json({ conversations: req.engine.listarConversaciones() });
  });

  app.post('/api/demo/reset', requireTenant, featGestion, requireAuth, requirePermission('gestion:configurar'), (req, res) => {
    let seed;
    if (adapter) {
      const snap = adapter.reset();
      seed = mundoRuntimeDesdeSnapshot(snap);
    } else {
      seed = clonarMundo();
    }
    memoria.hidratar(seed);
    reiniciarMotores();
    if (persist && !adapter) saveState();
    auditar(req, { action: 'demo.reset', targetType: 'workspace', targetId: req.tenant.id });
    res.json({ ok: true });
  });

  app.post('/api/automation/run', requireTenant, featGestion, requireAuth, requirePermission('gestion:automatizacion'), (req, res) => {
    const fecha = fechaDeReq(req);
    const campania = req.auto.ejecutarCiclo(fecha);
    saveState();
    auditar(req, {
      action: 'automation.run',
      targetType: 'campania',
      targetId: campania && campania.id ? campania.id : null,
      metadata: { fecha },
    });
    res.json({ ok: true, campania, summary: req.auto.summary(fecha) });
  });

  app.get('/api/automation/summary', requireTenant, featGestion, requireAuth, requirePermission('gestion:automatizacion'), (req, res) => {
    res.json(req.auto.summary(fechaDeReq(req)));
  });

  app.get('/api/automation/actions', requireTenant, featGestion, requireAuth, requirePermission('gestion:automatizacion'), (req, res) => {
    res.json({
      actions: req.auto.listarAcciones({
        agente: req.query.agente,
        sede: req.query.sede,
        estado: req.query.estado,
      }),
    });
  });

  app.post('/api/automation/actions/:id/estado', requireTenant, featGestion, requireAuth, requirePermission('gestion:automatizacion'), (req, res) => {
    const acc = req.auto.setEstado(req.params.id, req.body && req.body.estado);
    if (!acc) return res.status(404).json({ error: 'not found' });
    saveState();
    auditar(req, {
      action: 'automation.action.estado',
      targetType: 'accion',
      targetId: req.params.id,
      metadata: { estado: req.body && req.body.estado },
    });
    res.json({ action: acc });
  });

  app.post('/api/automation/agentes/:id/activo', requireTenant, featGestion, requireAuth, requirePermission('gestion:automatizacion'), (req, res) => {
    const activos = req.auto.setAgenteActivo(req.params.id, req.body && req.body.activo);
    saveState();
    auditar(req, {
      action: 'automation.agente.activo',
      targetType: 'agente',
      targetId: req.params.id,
      metadata: { activo: Boolean(req.body && req.body.activo) },
    });
    res.json({ agentesActivos: activos });
  });

  app.get('/api/pagos/config', requireTenant, featGestion, requireAuth, requirePermission('gestion:pagos:leer'), (req, res) => {
    const optsPagos = pasarela();
    res.json({
      modo: optsPagos.accessToken ? 'mercadopago' : 'demo',
      pasarela: optsPagos.accessToken ? 'Mercado Pago' : 'Pasarela en modo demostración',
      datosBancarios: memoria.datosBancarios(req.tenant.id),
    });
  });

  app.get('/api/socios/plantilla.csv', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:leer'), (_req, res) => {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send('nombre,telefono,email,plan,fechaInicio,sede\n');
  });

  app.get('/api/socios', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:leer'), (req, res) => {
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

  app.get('/api/socios/:id', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:leer'), (req, res) => {
    const ficha = memoria.fichaSocio(req.tenant.id, req.params.id, fechaDeReq(req));
    if (!ficha) return res.status(404).json({ error: 'not found' });
    res.json(ficha);
  });

  app.post('/api/socios', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:escribir'), (req, res) => {
    const r = memoria.altaSocio(req.tenant.id, req.body || {}, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    auditar(req, {
      action: 'socio.alta',
      targetType: 'socio',
      targetId: r.socio && r.socio.id ? r.socio.id : null,
    });
    res.json(r);
  });

  app.put('/api/socios/:id', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:escribir'), (req, res) => {
    const r = memoria.editarSocio(req.tenant.id, req.params.id, req.body || {});
    if (!r.ok) return res.status(400).json(r);
    saveState();
    auditar(req, {
      action: 'socio.editar',
      targetType: 'socio',
      targetId: req.params.id,
    });
    res.json(r);
  });

  app.post('/api/socios/:id/baja', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:escribir'), (req, res) => {
    const r = memoria.bajaSocio(req.tenant.id, req.params.id, req.body && req.body.motivo, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    auditar(req, {
      action: 'socio.baja',
      targetType: 'socio',
      targetId: req.params.id,
    });
    res.json(r);
  });

  app.post('/api/socios/:id/reactivar', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:escribir'), (req, res) => {
    const r = memoria.reactivarSocio(req.tenant.id, req.params.id);
    if (!r.ok) return res.status(400).json(r);
    saveState();
    auditar(req, {
      action: 'socio.reactivar',
      targetType: 'socio',
      targetId: req.params.id,
    });
    res.json(r);
  });

  app.post('/api/socios/import', requireTenant, featGestion, requireAuth, requirePermission('gestion:socios:escribir'), (req, res) => {
    const r = memoria.importarSociosCsv(req.tenant.id, (req.body && req.body.csv) || '', fechaDeReq(req));
    saveState();
    auditar(req, {
      action: 'socio.importar',
      targetType: 'socio',
      targetId: null,
      metadata: { ok: r.ok, creados: Array.isArray(r.creados) ? r.creados.length : 0, errores: Array.isArray(r.errores) ? r.errores.length : 0 },
    });
    res.json(r);
  });

  app.get('/api/pagos', requireTenant, featGestion, requireAuth, requirePermission('gestion:pagos:leer'), (req, res) => {
    const estado = req.query.estado;
    let pagos = memoria.listarPagos(req.tenant.id);
    if (estado) pagos = pagos.filter((p) => p.estado === estado);
    res.json({ pagos, conciliacion: memoria.conciliacionMes(req.tenant.id, fechaDeReq(req)) });
  });

  app.post('/api/pagos/:id/marcar', requireTenant, featGestion, requireAuth, requirePermission('gestion:pagos:escribir'), (req, res) => {
    const r = memoria.marcarPagado(req.tenant.id, req.params.id, req.body && req.body.referencia, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    auditar(req, {
      action: 'pago.marcar',
      targetType: 'pago',
      targetId: req.params.id,
    });
    res.json(r);
  });

  app.post('/api/pagos/:id/enviar-link', requireTenant, featGestion, requireAuth, requirePermission('gestion:pagos:escribir'), async (req, res) => {
    const r = await memoria.enviarLinkPago(req.tenant.id, req.params.id, pasarela());
    if (!r.ok) return res.status(400).json(r);
    saveState();
    auditar(req, {
      action: 'pago.enviar_link',
      targetType: 'pago',
      targetId: req.params.id,
      metadata: { modo: r.modo || 'demo' },
    });
    res.json(r);
  });

  app.get('/api/pagos/export.csv', requireTenant, featGestion, requireAuth, requirePermission('gestion:pagos:leer'), (req, res) => {
    const r = memoria.exportarPagosCsv(req.tenant.id, fechaDeReq(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(r.csv);
  });

  app.get('/api/pagos/conciliacion', requireTenant, featGestion, requireAuth, requirePermission('gestion:pagos:leer'), (req, res) => {
    res.json(memoria.conciliacionMes(req.tenant.id, fechaDeReq(req)));
  });

  app.get('/api/pagos/demo/:ref', requireTenant, featGestion, (req, res) => {
    const pago = memoria.pagoPorReferencia(req.tenant.id, req.params.ref);
    if (!pago) return res.status(404).json({ error: 'not found' });
    res.json({ pago });
  });

  app.post('/api/pagos/demo/:ref/pagar', requireTenant, featGestion, (req, res) => {
    const r = memoria.pagarDemo(req.tenant.id, req.params.ref, fechaDeReq(req));
    if (!r.ok) return res.status(400).json(r);
    saveState();
    auditar(req, {
      action: 'pago.demo',
      targetType: 'pago',
      targetId: r.pago && r.pago.id ? r.pago.id : null,
      metadata: { referencia: req.params.ref },
    });
    res.json(r);
  });

  app.post('/api/pagos/webhook', requireTenant, featGestion, (req, res) => {
    const before = memoria.listarPagos(req.tenant.id).map((p) => `${p.id}:${p.estado}`);
    const r = memoria.webhookPago(req.tenant.id, req.body || {}, pasarela());
    if (r.ok) {
      saveState();
      const after = memoria.listarPagos(req.tenant.id).map((p) => `${p.id}:${p.estado}`);
      const cambio = before.join('|') !== after.join('|');
      if (cambio || (r.pago && r.pago.id)) {
        auditar(req, {
          action: 'pago.webhook',
          targetType: 'pago',
          targetId: r.pago && r.pago.id ? r.pago.id : null,
          metadata: { estado: r.evento && r.evento.estado ? r.evento.estado : undefined },
        });
      }
    }
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
    adapter,
    dataFile,
    auditSink: audit,
    resolverContexto,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { app } = crearApp();
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  app.listen(port, () => {
    console.log(`FORKZA demo listening on http://localhost:${port}`);
  });
}
