import { FECHA_DEMO } from './engine/dates.js';
import { TENANT_DEFAULT, tenantActivo, varsMarca, USUARIOS_DEMO, CLAVE_DEMO } from './data/tenants.js';
import { crearStoreLocal } from './engine/store-local.js';

const TENANT_KEY = 'forkza_tenant';

const logEl = document.getElementById('chat-log');
const inputEl = document.getElementById('chat-input');
const sendEl = document.getElementById('chat-send');
const viewChat = document.getElementById('view-asistente');
const viewDash = document.getElementById('view-dashboard');
const viewAuto = document.getElementById('view-auto');
const viewLogin = document.getElementById('view-login');
const viewMissing = document.getElementById('view-missing');
const navA = document.getElementById('nav-asistente');
const navD = document.getElementById('nav-dashboard');
const navAuto = document.getElementById('nav-auto');
const headerTenant = document.getElementById('header-tenant');
const headerForkza = document.getElementById('header-forkza');

let tenant = null;
let store;
let convId = null;
let dashTimer = null;
let sedeFiltro = 'Todas';
let autoFiltro = { agente: '', sede: '', estado: '' };
let session = null;
let standalone = false;

function apiUrl(path) {
  return new URL(path, import.meta.url).href;
}

function timeoutFetch(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function slugFromLocation() {
  const q = new URLSearchParams(location.search).get('t');
  if (q) return q.trim().toLowerCase();
  try {
    return localStorage.getItem(TENANT_KEY) || TENANT_DEFAULT;
  } catch {
    return TENANT_DEFAULT;
  }
}

function persistTenant(slug) {
  try { localStorage.setItem(TENANT_KEY, slug); } catch { /* standalone privado */ }
}

function applyTheme(marca) {
  const vars = varsMarca(marca);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    if (v) root.style.setProperty(k, v);
  }
  document.body.classList.toggle('wordmark-italic', Boolean(marca.wordmarkItalic));
}

function paintTenant(t) {
  const name = t.marca.wordmark || t.nombre;
  const bajada = t.marca.bajada || '';
  document.title = `${name} · Forkza AI`;
  document.getElementById('brand-mini-title').textContent = name;
  document.getElementById('brand-mini-sub').textContent = bajada;
  document.getElementById('hero-wordmark').textContent = name;
  document.getElementById('hero-bajada').textContent = bajada;
  document.getElementById('chat-name').textContent = name;
  document.getElementById('chat-sub').textContent = bajada;
  document.getElementById('forkza-tenant-name').textContent = t.nombre;
  document.getElementById('dash-title').textContent = `${name} · PANEL DE GESTIÓN`;
  document.getElementById('auto-title').textContent = `${name} · AUTOMATIZACIONES`;
  document.getElementById('banner-demo').textContent = t.textosBot.disclaimer || 'Prototipo demostrativo · datos ficticios';
  const sw = document.getElementById('tenant-switch');
  sw.replaceChildren();
  if (t.demo) {
    sw.appendChild(document.createTextNode('Ver como: '));
    const a1 = document.createElement('a');
    a1.href = '?t=monkeys';
    a1.textContent = 'MONKEYS';
    const a2 = document.createElement('a');
    a2.href = '?t=soma';
    a2.textContent = 'SOMA';
    sw.appendChild(a1);
    sw.appendChild(document.createTextNode(' · '));
    sw.appendChild(a2);
  }
}

function headers(extra = {}) {
  return { 'X-Tenant': tenant.id, ...extra };
}

class StoreApi {
  async iniciarConversacion() {
    const res = await fetch(apiUrl('./api/conversations'), { method: 'POST', headers: headers() });
    return res.json();
  }
  async enviarMensaje(id, text) {
    const res = await fetch(apiUrl(`./api/conversations/${id}/messages`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ text }),
    });
    return res.json();
  }
  async listarClases() {
    const res = await fetch(apiUrl('./api/classes'), { headers: headers() });
    return (await res.json()).classes;
  }
  async listarPlanes() {
    const res = await fetch(apiUrl('./api/plans'), { headers: headers() });
    return (await res.json()).plans;
  }
  async listarReservas() {
    const res = await fetch(apiUrl('./api/bookings'), { headers: headers() });
    if (res.status === 401) throw new Error('unauthorized');
    return (await res.json()).bookings;
  }
  async listarLeads() {
    const res = await fetch(apiUrl('./api/leads'), { headers: headers() });
    if (res.status === 401) throw new Error('unauthorized');
    return (await res.json()).leads;
  }
  async listarConversaciones() {
    const res = await fetch(apiUrl('./api/conversations'), { headers: headers() });
    if (res.status === 401) throw new Error('unauthorized');
    return (await res.json()).conversations;
  }
  async reset() {
    const res = await fetch(apiUrl('./api/demo/reset'), { method: 'POST', headers: headers() });
    return res.json();
  }
  async runAutomation() {
    const res = await fetch(apiUrl('./api/automation/run'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ fecha: FECHA_DEMO }),
    });
    return res.json();
  }
  async automationSummary() {
    const res = await fetch(apiUrl('./api/automation/summary'), { headers: headers() });
    return res.json();
  }
  async automationActions(q = {}) {
    const p = new URLSearchParams();
    if (q.agente) p.set('agente', q.agente);
    if (q.sede) p.set('sede', q.sede);
    if (q.estado) p.set('estado', q.estado);
    const res = await fetch(apiUrl(`./api/automation/actions?${p.toString()}`), { headers: headers() });
    return (await res.json()).actions;
  }
  async setActionEstado(id, estado) {
    const res = await fetch(apiUrl(`./api/automation/actions/${id}/estado`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ estado }),
    });
    return res.json();
  }
  async setAgenteActivo(id, activo) {
    const res = await fetch(apiUrl(`./api/automation/agentes/${id}/activo`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ activo }),
    });
    return res.json();
  }
  async login(email, password) {
    const res = await fetch(apiUrl('./api/login'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error || 'credenciales', status: res.status };
    return data;
  }
  async me() {
    const res = await fetch(apiUrl('./api/me'), { headers: headers() });
    if (!res.ok) return null;
    return (await res.json()).usuario;
  }
}

function horaCorta(iso) {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function appendBubble(msg) {
  const wrap = document.createElement('div');
  wrap.className = `bubble ${msg.autor === 'user' ? 'user' : 'bot'}`;
  if (msg.ia) {
    const badge = document.createElement('div');
    badge.className = 'ia-badge';
    badge.textContent = 'IA';
    wrap.appendChild(badge);
  }
  const p = document.createElement('div');
  p.textContent = msg.texto;
  wrap.appendChild(p);
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = horaCorta(msg.hora);
  wrap.appendChild(meta);
  if (msg.autor === 'bot' && msg.opciones && msg.opciones.length) {
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const op of msg.opciones) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = op.etiqueta;
      b.addEventListener('click', () => send(op.valor));
      chips.appendChild(b);
    }
    wrap.appendChild(chips);
  }
  logEl.appendChild(wrap);
  logEl.scrollTop = logEl.scrollHeight;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.id = 'typing';
  el.textContent = 'escribiendo…';
  logEl.appendChild(el);
  logEl.scrollTop = logEl.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typing');
  if (el) el.remove();
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function bootChat() {
  logEl.replaceChildren();
  const r = await store.iniciarConversacion();
  convId = r.conversacion && r.conversacion.id;
  for (const m of r.mensajes || []) appendBubble(m);
}

async function send(text) {
  const value = String(text || '').trim();
  if (!value || !convId) return;
  inputEl.value = '';
  appendBubble({ autor: 'user', texto: value, hora: new Date().toISOString(), opciones: [] });
  showTyping();
  const wait = 400 + Math.floor(Math.random() * 300);
  const [r] = await Promise.all([store.enviarMensaje(convId, value), delay(wait)]);
  hideTyping();
  for (const m of r.mensajes || []) appendBubble(m);
}

function hashName() {
  return (location.hash || '#asistente').replace('#', '') || 'asistente';
}

function route() {
  if (!tenant) {
    viewMissing.classList.remove('hidden');
    viewChat.classList.add('hidden');
    viewDash.classList.add('hidden');
    viewAuto.classList.add('hidden');
    viewLogin.classList.add('hidden');
    headerTenant.classList.add('hidden');
    headerForkza.classList.add('hidden');
    return;
  }
  viewMissing.classList.add('hidden');
  const hash = hashName();
  const needsAuth = hash === 'dashboard' || hash === 'automatizaciones' || hash === 'login';
  headerTenant.classList.toggle('hidden', needsAuth);
  headerForkza.classList.toggle('hidden', !needsAuth);

  if ((hash === 'dashboard' || hash === 'automatizaciones') && !session) {
    if (location.hash !== '#login') location.hash = 'login';
    showLogin();
    return;
  }

  const dash = hash === 'dashboard';
  const auto = hash === 'automatizaciones';
  const login = hash === 'login';
  viewChat.classList.toggle('hidden', dash || auto || login);
  viewDash.classList.toggle('hidden', !dash);
  viewAuto.classList.toggle('hidden', !auto);
  viewLogin.classList.toggle('hidden', !login);
  navA.classList.toggle('is-active', !dash && !auto && !login);
  navD.classList.toggle('is-active', dash);
  navAuto.classList.toggle('is-active', auto);
  if (login) showLogin();
  if (dash) renderDashboard();
  if (auto) renderAutomations();
}

function showLogin() {
  const help = document.getElementById('login-demo-help');
  const list = document.getElementById('login-demo-list');
  list.replaceChildren();
  if (tenant.demo) {
    help.classList.remove('hidden');
    const users = USUARIOS_DEMO.filter((u) => u.tenantId === tenant.id);
    for (const u of users) {
      const li = document.createElement('li');
      li.textContent = `${u.email} · ${CLAVE_DEMO}${standalone ? ' · modo demostración' : ''}`;
      list.appendChild(li);
    }
  } else help.classList.add('hidden');
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function card(num, lbl) {
  const c = el('div', 'card');
  c.appendChild(el('div', 'num', String(num)));
  c.appendChild(el('div', 'lbl', lbl));
  return c;
}

function table(title, headers, rows) {
  const wrap = el('div', 'table-wrap');
  wrap.appendChild(el('h3', null, title));
  const t = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const h of headers) trh.appendChild(el('th', null, h));
  thead.appendChild(trh);
  t.appendChild(thead);
  const tb = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    for (const cell of row) tr.appendChild(el('td', null, cell));
    tb.appendChild(tr);
  }
  t.appendChild(tb);
  wrap.appendChild(t);
  return wrap;
}

function sedesFiltro() {
  return ['Todas', ...(tenant.sedes || []).map((s) => s.nombre)];
}

async function renderDashboard() {
  let bookings; let leads; let convs; let classes;
  try {
    [bookings, leads, convs, classes] = await Promise.all([
      store.listarReservas(),
      store.listarLeads(),
      store.listarConversaciones(),
      store.listarClases(),
    ]);
  } catch {
    location.hash = 'login';
    return;
  }
  const sede = sedeFiltro;
  const match = (s) => sede === 'Todas' || s === sede;
  const b = bookings.filter((x) => match(x.sede));
  const l = leads.filter((x) => match(x.sede));
  const c = convs.filter((x) => match(x.sede) && x.status === 'waiting_human');
  const k = classes.filter((x) => match(x.sede));

  const cards = document.getElementById('dash-cards');
  cards.replaceChildren();
  cards.appendChild(card(b.filter((x) => x.estado === 'confirmada').length, 'RESERVAS CONFIRMADAS'));
  cards.appendChild(card(l.length, 'PROSPECTOS'));
  cards.appendChild(card(c.length, 'ATENCIÓN PENDIENTE'));
  cards.appendChild(card(k.length, 'CLASES ACTIVAS'));

  const filters = document.getElementById('dash-filters');
  filters.replaceChildren();
  for (const name of sedesFiltro()) {
    const btn = el('button', 'chip', name);
    if (name === sedeFiltro) btn.style.borderColor = 'var(--color-acento)';
    btn.addEventListener('click', () => {
      sedeFiltro = name;
      renderDashboard();
    });
    filters.appendChild(btn);
  }

  const tables = document.getElementById('dash-tables');
  tables.replaceChildren();
  tables.appendChild(table('RESERVAS', ['Código', 'Cliente', 'Clase', 'Sede', 'Estado'], b.map((x) => [x.codigo, x.cliente, x.clase, x.sede, x.estado])));
  tables.appendChild(table('PROSPECTOS', ['Nombre', 'Teléfono', 'Objetivo', 'Clase', 'Estado'], l.map((x) => [x.nombre, x.telefono, x.objetivo, x.clase, x.estado])));
  tables.appendChild(table('ATENCIÓN', ['Usuario', 'Teléfono', 'Motivo', 'Estado'], c.map((x) => [x.usuario || '—', x.telefono || '—', x.motivo || '—', x.status])));
  tables.appendChild(table('CLASES', ['Clase', 'Sede', 'Entrenador', 'Horario', 'Cupos', 'Estado'], k.map((x) => [
    x.nombre, x.sede, x.entrenador, `${x.dia} ${x.hora}`,
    x.reservable === false ? (x.nota || 'sin cupo') : `${x.reserved}/${x.capacity}`,
    x.reservable === false ? (x.nota || 'info') : (x.agotada ? 'AGOTADA' : 'disponible'),
  ])));
}

const AGENT_LABEL = {
  retencion: 'RETENCIÓN',
  cobranza: 'COBRANZA',
  reactivacion: 'REACTIVACIÓN',
  recordatorio: 'RECORDATORIO',
  referidos: 'REFERIDOS',
};

const AGENT_CARDS = [
  { id: 'retencion', title: 'RETENCIÓN', kind: 'retencion' },
  { id: 'cobranza', title: 'COBRANZA', kind: 'ciclo' },
  { id: 'reactivacion', title: 'REACTIVACIÓN', kind: 'ciclo' },
  { id: 'recordatorio', title: 'RECORDATORIO + LISTA DE ESPERA', kind: 'ciclo' },
  { id: 'referidos', title: 'REFERIDOS', kind: 'ciclo' },
];

function pill(agente) {
  return el('span', `pill pill-${agente}`, AGENT_LABEL[agente] || agente);
}

async function renderAutomations() {
  let summary;
  try {
    summary = await store.automationSummary();
  } catch {
    location.hash = 'login';
    return;
  }
  const cards = document.getElementById('auto-cards');
  cards.replaceChildren();
  for (const spec of AGENT_CARDS) {
    const ind = (summary.indicadores && summary.indicadores[spec.id]) || {};
    const cardEl = el('div', 'agent-card');
    cardEl.appendChild(el('h2', null, spec.title));
    if (spec.kind === 'retencion') {
      cardEl.appendChild(el('div', 'kpi', String(ind.sociosEnRiesgo || 0)));
      cardEl.appendChild(el('div', 'kpi-lbl', 'Socios en riesgo'));
      cardEl.appendChild(el('div', 'kpi', String(ind.recuperadosEsteMes || 0)));
      cardEl.appendChild(el('div', 'kpi-lbl', 'Recuperados este mes'));
    } else {
      cardEl.appendChild(el('div', 'kpi', String(ind.accionesUltimoCiclo || 0)));
      cardEl.appendChild(el('div', 'kpi-lbl', 'Acciones último ciclo'));
      cardEl.appendChild(el('p', 'kpi-aviso', ind.aviso || 'Sin avisos en el último ciclo'));
    }
    const on = summary.agentesActivos && summary.agentesActivos[spec.id] !== false;
    const tog = el('button', `toggle${on ? ' is-on' : ''}`, on ? 'Activo' : 'Pausado');
    tog.addEventListener('click', async () => {
      await store.setAgenteActivo(spec.id, !on);
      renderAutomations();
    });
    cardEl.appendChild(tog);
    cards.appendChild(cardEl);
  }

  const filters = document.getElementById('auto-filters');
  filters.replaceChildren();
  const makeFilter = (label, key, values) => {
    for (const v of values) {
      const b = el('button', 'chip', v || `Todos ${label}`);
      const val = v === `Todos ${label}` ? '' : v;
      if (autoFiltro[key] === val) b.style.borderColor = 'var(--color-acento)';
      b.addEventListener('click', () => {
        autoFiltro[key] = val;
        renderAutomations();
      });
      filters.appendChild(b);
    }
  };
  makeFilter('agente', 'agente', ['Todos agente', 'retencion', 'cobranza', 'reactivacion', 'recordatorio', 'referidos']);
  makeFilter('sede', 'sede', ['Todos sede', ...sedesFiltro().filter((s) => s !== 'Todas')]);
  makeFilter('estado', 'estado', ['Todos estado', 'pendiente', 'enviado', 'hecho']);

  const actions = await store.automationActions(autoFiltro);
  const tb = document.getElementById('auto-table');
  tb.replaceChildren();
  for (const a of actions) {
    const tr = document.createElement('tr');
    const tdA = document.createElement('td');
    tdA.appendChild(pill(a.agente));
    tr.appendChild(tdA);
    tr.appendChild(el('td', null, a.socioNombre || a.socioId || '—'));
    tr.appendChild(el('td', null, a.sedeId));
    tr.appendChild(el('td', null, a.tipo));
    tr.appendChild(el('td', null, a.prioridad));
    tr.appendChild(el('td', null, a.estado));
    const tdAct = document.createElement('td');
    if (a.tipo === 'mensaje' && a.texto) {
      const ver = el('button', 'linkish', 'Ver mensaje');
      ver.addEventListener('click', () => openMsg(a));
      tdAct.appendChild(ver);
    }
    if (a.estado !== 'hecho') {
      const done = el('button', 'linkish', 'Marcar hecho');
      done.addEventListener('click', async () => {
        await store.setActionEstado(a.id, 'hecho');
        renderAutomations();
      });
      tdAct.appendChild(done);
    }
    tr.appendChild(tdAct);
    tb.appendChild(tr);
  }
}

function openMsg(a) {
  document.getElementById('msg-meta').textContent = `${a.socioNombre || ''} · ${a.claseFavorita || ''} · ${a.sedeId}`;
  document.getElementById('msg-body').textContent = a.texto || a.motivo || '';
  document.getElementById('msg-panel').classList.remove('hidden');
}

async function resolveTheme(slug) {
  try {
    const res = await timeoutFetch(apiUrl(`./api/tenants/${slug}/theme`), 1500);
    if (res.ok) return res.json();
    if (res.status === 400) return null;
  } catch { /* standalone */ }
  const t = tenantActivo(slug);
  if (!t) return null;
  return { ...t, vars: varsMarca(t.marca) };
}

async function main() {
  const slug = slugFromLocation();
  const theme = await resolveTheme(slug);
  if (!theme) {
    tenant = null;
    route();
    return;
  }
  tenant = tenantActivo(theme.slug) || theme;
  persistTenant(tenant.slug);
  applyTheme(theme.marca || tenant.marca);
  paintTenant(tenant);

  try {
    const health = await timeoutFetch(apiUrl('./api/health'), 1500);
    if (health.ok) {
      store = new StoreApi();
      standalone = false;
    } else {
      store = crearStoreLocal(tenant.id, localStorage);
      standalone = true;
    }
  } catch {
    store = crearStoreLocal(tenant.id, localStorage);
    standalone = true;
  }

  session = await store.me();

  sendEl.addEventListener('click', () => send(inputEl.value));
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') send(inputEl.value);
  });
  window.addEventListener('hashchange', route);
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('reset-confirm').classList.remove('hidden');
  });
  document.getElementById('btn-reset-no').addEventListener('click', () => {
    document.getElementById('reset-confirm').classList.add('hidden');
  });
  document.getElementById('btn-reset-yes').addEventListener('click', async () => {
    await store.reset();
    document.getElementById('reset-confirm').classList.add('hidden');
    await bootChat();
    if (session) renderDashboard();
    if (!viewAuto.classList.contains('hidden')) renderAutomations();
  });

  document.getElementById('btn-run-cycle').addEventListener('click', async () => {
    await store.runAutomation();
    renderAutomations();
  });
  document.getElementById('msg-close').addEventListener('click', () => {
    document.getElementById('msg-panel').classList.add('hidden');
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('login-error');
    err.hidden = true;
    const r = await store.login(
      document.getElementById('login-email').value,
      document.getElementById('login-pass').value,
    );
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.error === 'bloqueado'
        ? 'Demasiados intentos. Espera 10 minutos.'
        : 'Correo o clave incorrectos.';
      return;
    }
    session = r.usuario;
    location.hash = 'dashboard';
    route();
  });

  route();
  await bootChat();
  dashTimer = setInterval(() => {
    if (!(viewDash.classList.contains('hidden')) && session) renderDashboard();
  }, 3000);
}

main();
