import { fechaHoy, fechaDesdeQuery } from './engine/dates.js';
import { TENANT_DEFAULT, tenantActivo, varsMarca, USUARIOS_DEMO, CLAVE_DEMO } from './data/tenants.js';
import { crearStoreLocal } from './engine/store-local.js';
import { i18n } from './data/i18n.js';

const TENANT_KEY = 'forkza_tenant';

const logEl = document.getElementById('chat-log');
const inputEl = document.getElementById('chat-input');
const sendEl = document.getElementById('chat-send');
const viewChat = document.getElementById('view-asistente');
const viewDash = document.getElementById('view-dashboard');
const viewAuto = document.getElementById('view-auto');
const viewLogin = document.getElementById('view-login');
const viewMissing = document.getElementById('view-missing');
const viewSocios = document.getElementById('view-socios');
const viewPagos = document.getElementById('view-pagos');
const viewPago = document.getElementById('view-pago');
const navA = document.getElementById('nav-asistente');
const navD = document.getElementById('nav-dashboard');
const navAuto = document.getElementById('nav-auto');
const navSocios = document.getElementById('nav-socios');
const navPagos = document.getElementById('nav-pagos');
const headerTenant = document.getElementById('header-tenant');
const headerForkza = document.getElementById('header-forkza');

let tenant = null;
let store;
let convId = null;
let dashTimer = null;
let sedeFiltro = 'Todas';
let autoFiltro = { agente: '', sede: '', estado: '' };
let sociosFiltro = { q: '', sede: '', plan: '', estado: '', vence7: false };
let pagosFiltro = { estado: '' };
let socioSel = null;
let pagoMarcarId = null;
let session = null;
let standalone = false;

function apiUrl(path) {
  const u = new URL(path, import.meta.url);
  const f = fechaDesdeQuery(location.search);
  if (f) u.searchParams.set('fecha', f);
  return u.href;
}

function fechaActiva() {
  return fechaDesdeQuery(location.search) || fechaHoy(tenant && tenant.zonaHoraria);
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
  document.getElementById('socios-title').textContent = `${name} · SOCIOS`;
  document.getElementById('pagos-title').textContent = `${name} · PAGOS`;
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
  async listarSocios(filtro = {}) {
    const p = new URLSearchParams();
    if (filtro.q) p.set('q', filtro.q);
    if (filtro.sede) p.set('sede', filtro.sede);
    if (filtro.plan) p.set('plan', filtro.plan);
    if (filtro.estado) p.set('estado', filtro.estado);
    if (filtro.vence7) p.set('vence7', '1');
    const res = await fetch(apiUrl(`./api/socios?${p.toString()}`), { headers: headers() });
    if (res.status === 401) throw new Error('unauthorized');
    return (await res.json()).socios;
  }
  async fichaSocio(id) {
    const res = await fetch(apiUrl(`./api/socios/${id}`), { headers: headers() });
    if (res.status === 401) throw new Error('unauthorized');
    if (!res.ok) return null;
    return res.json();
  }
  async altaSocio(datos) {
    const res = await fetch(apiUrl('./api/socios'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    return res.json();
  }
  async editarSocio(id, datos) {
    const res = await fetch(apiUrl(`./api/socios/${id}`), {
      method: 'PUT',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(datos),
    });
    return res.json();
  }
  async bajaSocio(id, motivo) {
    const res = await fetch(apiUrl(`./api/socios/${id}/baja`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ motivo }),
    });
    return res.json();
  }
  async reactivarSocio(id) {
    const res = await fetch(apiUrl(`./api/socios/${id}/reactivar`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
    });
    return res.json();
  }
  async importarSociosCsv(csv) {
    const res = await fetch(apiUrl('./api/socios/import'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ csv }),
    });
    return res.json();
  }
  async plantillaCsv() {
    const res = await fetch(apiUrl('./api/socios/plantilla.csv'), { headers: headers() });
    return res.text();
  }
  async listarPagos(estado) {
    const p = new URLSearchParams();
    if (estado) p.set('estado', estado);
    const res = await fetch(apiUrl(`./api/pagos?${p.toString()}`), { headers: headers() });
    if (res.status === 401) throw new Error('unauthorized');
    return res.json();
  }
  async marcarPagado(id, referencia) {
    const res = await fetch(apiUrl(`./api/pagos/${id}/marcar`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ referencia }),
    });
    return res.json();
  }
  async enviarLinkPago(id) {
    const res = await fetch(apiUrl(`./api/pagos/${id}/enviar-link`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
    });
    return res.json();
  }
  async exportarPagosCsv() {
    const res = await fetch(apiUrl('./api/pagos/export.csv'), { headers: headers() });
    return res.text();
  }
  async pagosConfig() {
    const res = await fetch(apiUrl('./api/pagos/config'), { headers: headers() });
    return res.json();
  }
  async getPagoDemo(ref) {
    const res = await fetch(apiUrl(`./api/pagos/demo/${encodeURIComponent(ref)}`), { headers: headers() });
    if (!res.ok) return null;
    return (await res.json()).pago;
  }
  async pagarDemo(ref) {
    const res = await fetch(apiUrl(`./api/pagos/demo/${encodeURIComponent(ref)}/pagar`), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
    });
    return res.json();
  }
  async reset() {
    const res = await fetch(apiUrl('./api/demo/reset'), { method: 'POST', headers: headers() });
    return res.json();
  }
  async runAutomation() {
    const res = await fetch(apiUrl('./api/automation/run'), {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ fecha: fechaActiva() }),
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
    const tipo = msg.tipoOpciones || (msg.opciones.length <= 3 ? 'botones' : 'lista');
    const ops = msg.opciones.slice(0, 10);
    if (tipo === 'botones') {
      const chips = document.createElement('div');
      chips.className = 'chips wa-buttons';
      for (const op of ops.slice(0, 3)) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = op.etiqueta;
        b.addEventListener('click', () => send(op.valor));
        chips.appendChild(b);
      }
      wrap.appendChild(chips);
    } else {
      const sheet = document.createElement('div');
      sheet.className = 'wa-list';
      const title = document.createElement('div');
      title.className = 'wa-list-title';
      title.textContent = i18n.verOpciones || 'Ver opciones';
      sheet.appendChild(title);
      for (const op of ops) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'wa-row';
        const t = document.createElement('span');
        t.className = 'wa-row-title';
        t.textContent = op.etiqueta;
        b.appendChild(t);
        if (op.descripcion) {
          const d = document.createElement('span');
          d.className = 'wa-row-desc';
          d.textContent = op.descripcion;
          b.appendChild(d);
        }
        b.addEventListener('click', () => send(op.valor));
        sheet.appendChild(b);
      }
      wrap.appendChild(sheet);
    }
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

function hashParts() {
  return hashName().split('/');
}

function hideAllViews() {
  for (const v of [viewChat, viewDash, viewAuto, viewLogin, viewSocios, viewPagos, viewPago, viewMissing]) {
    v.classList.add('hidden');
  }
}

function route() {
  if (!tenant) {
    hideAllViews();
    viewMissing.classList.remove('hidden');
    headerTenant.classList.add('hidden');
    headerForkza.classList.add('hidden');
    return;
  }
  viewMissing.classList.add('hidden');
  const [hash, param] = hashParts();
  const staff = hash === 'dashboard' || hash === 'automatizaciones' || hash === 'socios' || hash === 'pagos' || hash === 'login';
  headerTenant.classList.toggle('hidden', staff);
  headerForkza.classList.toggle('hidden', !staff);

  if ((hash === 'dashboard' || hash === 'automatizaciones' || hash === 'socios' || hash === 'pagos') && !session) {
    if (location.hash !== '#login') location.hash = 'login';
    hideAllViews();
    viewLogin.classList.remove('hidden');
    showLogin();
    return;
  }

  hideAllViews();
  navA.classList.toggle('is-active', hash === 'asistente' || hash === '');
  navD.classList.toggle('is-active', hash === 'dashboard');
  navAuto.classList.toggle('is-active', hash === 'automatizaciones');
  navSocios.classList.toggle('is-active', hash === 'socios');
  navPagos.classList.toggle('is-active', hash === 'pagos' || hash === 'pago');

  if (hash === 'login') {
    viewLogin.classList.remove('hidden');
    showLogin();
    return;
  }
  if (hash === 'dashboard') {
    viewDash.classList.remove('hidden');
    renderDashboard();
    return;
  }
  if (hash === 'automatizaciones') {
    viewAuto.classList.remove('hidden');
    renderAutomations();
    return;
  }
  if (hash === 'socios') {
    viewSocios.classList.remove('hidden');
    if (param) socioSel = param;
    renderSocios();
    return;
  }
  if (hash === 'pagos') {
    viewPagos.classList.remove('hidden');
    renderPagos();
    return;
  }
  if (hash === 'pago') {
    viewPago.classList.remove('hidden');
    renderPagoDemo(param);
    return;
  }
  viewChat.classList.remove('hidden');
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

async function fillPasarela(elId) {
  try {
    const cfg = await store.pagosConfig();
    const n = document.getElementById(elId);
    if (n) n.textContent = cfg.pasarela || i18n.pasarelaDemo;
  } catch { /* ignore */ }
}

async function renderSocios() {
  let socios;
  try {
    socios = await store.listarSocios(sociosFiltro);
  } catch {
    location.hash = 'login';
    return;
  }
  document.getElementById('socios-title').textContent = `${tenant.marca.wordmark || tenant.nombre} · SOCIOS`;
  await fillPasarela('socios-pasarela');
  const filters = document.getElementById('socios-filters');
  filters.replaceChildren();
  const addChip = (label, on, click) => {
    const b = el('button', 'chip', label);
    if (on) b.style.borderColor = 'var(--color-acento)';
    b.addEventListener('click', click);
    filters.appendChild(b);
  };
  for (const s of ['Todas', ...(tenant.sedes || []).map((x) => x.nombre)]) {
    addChip(s, (sociosFiltro.sede || 'Todas') === s, () => {
      sociosFiltro.sede = s === 'Todas' ? '' : s;
      renderSocios();
    });
  }
  addChip('Vence en 7 días', sociosFiltro.vence7, () => {
    sociosFiltro.vence7 = !sociosFiltro.vence7;
    renderSocios();
  });
  for (const est of ['', 'vigente', 'vencida', 'pausada']) {
    addChip(est || 'Todos estado', sociosFiltro.estado === est, () => {
      sociosFiltro.estado = est;
      renderSocios();
    });
  }
  const tb = document.getElementById('socios-table');
  tb.replaceChildren();
  for (const s of socios) {
    const tr = document.createElement('tr');
    const mem = s.membresia || {};
    for (const cell of [s.nombre, s.telefono, s.sedeId, s.planNombre || s.planId, s.estado, mem.fin || '—']) {
      tr.appendChild(el('td', null, cell));
    }
    tr.addEventListener('click', () => {
      socioSel = s.id;
      location.hash = `socios/${s.id}`;
      pintarFicha(s.id);
    });
    tb.appendChild(tr);
  }
  if (socioSel) pintarFicha(socioSel);
}

async function pintarFicha(id) {
  const box = document.getElementById('socio-ficha');
  const ficha = await store.fichaSocio(id);
  if (!ficha) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  box.replaceChildren();
  const s = ficha.socio;
  box.appendChild(el('h2', null, s.nombre));
  box.appendChild(el('p', null, `${s.telefono} · ${s.sedeId}`));
  box.appendChild(el('p', null, `Estado socio: ${s.estado}`));
  if (ficha.plan) box.appendChild(el('p', null, `Plan: ${ficha.plan.nombre}`));
  if (ficha.membresia) {
    box.appendChild(el('p', null, `Membresía ${ficha.membresia.estado}: ${ficha.membresia.inicio} a ${ficha.membresia.fin}`));
  }
  if (tenant.id === 'soma' && ficha.cuposRestantes != null) {
    box.appendChild(el('p', null, `Cupos del mes: ${ficha.cuposRestantes} de ${ficha.cuposMes}`));
  }
  box.appendChild(el('h3', null, 'Pagos'));
  for (const p of (ficha.pagos || []).slice(0, 8)) {
    box.appendChild(el('p', null, `${p.estado} · ${p.monto} CLP · ${p.referencia || 'sin ref'}`));
  }
  box.appendChild(el('h3', null, 'Asistencias'));
  box.appendChild(el('p', null, `${(ficha.asistencias || []).length} registros`));
  box.appendChild(el('h3', null, 'Reservas'));
  for (const b of (ficha.reservas || []).slice(0, 6)) {
    box.appendChild(el('p', null, `${b.codigo} · ${b.clase} · ${b.estado}`));
  }
  const actions = el('div', 'form-row');
  if (s.estado !== 'baja') {
    const ed = el('button', null, 'Editar');
    ed.addEventListener('click', () => abrirFormSocio(s));
    const baja = el('button', 'ghost', 'Dar de baja');
    baja.addEventListener('click', () => abrirBaja(s.id));
    actions.appendChild(ed);
    actions.appendChild(baja);
  } else {
    const re = el('button', null, 'Reactivar');
    re.addEventListener('click', async () => {
      await store.reactivarSocio(s.id);
      renderSocios();
    });
    actions.appendChild(re);
  }
  box.appendChild(actions);
}

function abrirBaja(id) {
  const box = document.getElementById('socio-ficha');
  const form = el('form', null);
  form.appendChild(el('p', null, 'Motivo de baja'));
  const inp = document.createElement('input');
  inp.required = true;
  inp.maxLength = 200;
  form.appendChild(inp);
  const ok = el('button', null, 'Confirmar baja');
  form.appendChild(ok);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await store.bajaSocio(id, inp.value);
    renderSocios();
  });
  box.appendChild(form);
}

function abrirFormSocio(socio) {
  const form = document.getElementById('socio-form');
  form.classList.remove('hidden');
  document.getElementById('socio-form-title').textContent = socio ? 'Editar socio' : 'Alta de socio';
  document.getElementById('sf-nombre').value = socio ? socio.nombre : '';
  document.getElementById('sf-tel').value = socio ? socio.telefono : '';
  document.getElementById('sf-email').value = socio && socio.email ? socio.email : '';
  document.getElementById('sf-inicio').value = socio && socio.fechaIngreso ? socio.fechaIngreso : '';
  form.dataset.id = socio ? socio.id : '';
  fillSelectsSocio(socio);
}

async function fillSelectsSocio(socio) {
  const sedeSel = document.getElementById('sf-sede');
  const planSel = document.getElementById('sf-plan');
  sedeSel.replaceChildren();
  for (const s of tenant.sedes || []) {
    const o = document.createElement('option');
    o.value = s.nombre;
    o.textContent = s.nombre;
    if (socio && socio.sedeId === s.nombre) o.selected = true;
    sedeSel.appendChild(o);
  }
  const plans = await store.listarPlanes();
  planSel.replaceChildren();
  for (const p of plans) {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = p.nombre;
    if (socio && socio.planId === p.id) o.selected = true;
    planSel.appendChild(o);
  }
}

async function renderPagos() {
  let data;
  try {
    data = await store.listarPagos(pagosFiltro.estado);
  } catch {
    location.hash = 'login';
    return;
  }
  await fillPasarela('pagos-pasarela');
  const conc = data.conciliacion || {};
  const cards = document.getElementById('pagos-conc');
  cards.replaceChildren();
  cards.appendChild(card(conc.esperado || 0, 'ESPERADO'));
  cards.appendChild(card(conc.pagado || 0, 'PAGADO'));
  cards.appendChild(card(conc.pendiente || 0, 'PENDIENTE'));
  cards.appendChild(card(conc.vencido || 0, 'VENCIDO'));
  const filters = document.getElementById('pagos-filters');
  filters.replaceChildren();
  for (const est of ['', 'pendiente', 'pagada', 'vencida', 'rechazada']) {
    const b = el('button', 'chip', est || 'Todos');
    if (pagosFiltro.estado === est) b.style.borderColor = 'var(--color-acento)';
    b.addEventListener('click', () => {
      pagosFiltro.estado = est;
      renderPagos();
    });
    filters.appendChild(b);
  }
  const socios = await store.listarSocios({});
  const byId = new Map(socios.map((s) => [s.id, s]));
  const plans = await store.listarPlanes();
  const planBy = new Map(plans.map((p) => [p.id, p]));
  const tb = document.getElementById('pagos-table');
  tb.replaceChildren();
  for (const p of data.pagos || []) {
    const tr = document.createElement('tr');
    const socio = byId.get(p.socioId);
    const plan = planBy.get(p.planId);
    tr.appendChild(el('td', null, socio ? socio.nombre : p.socioId));
    tr.appendChild(el('td', null, plan ? plan.nombre : p.planId));
    tr.appendChild(el('td', null, `${p.monto} CLP`));
    tr.appendChild(el('td', null, p.estado));
    tr.appendChild(el('td', null, p.referencia || p.linkReferencia || '—'));
    const td = document.createElement('td');
    if (p.estado === 'pendiente' || p.estado === 'vencida') {
      const m = el('button', 'linkish', 'Marcar pagado');
      m.addEventListener('click', () => {
        pagoMarcarId = p.id;
        document.getElementById('pago-ref-form').classList.remove('hidden');
        document.getElementById('pago-ref-input').value = '';
      });
      td.appendChild(m);
      const l = el('button', 'linkish', 'Enviar link');
      l.addEventListener('click', async () => {
        const r = await store.enviarLinkPago(p.id);
        if (r.ok && r.url) location.hash = r.url.replace('#', '');
        else renderPagos();
      });
      td.appendChild(l);
    }
    tr.appendChild(td);
    tb.appendChild(tr);
  }
}

async function renderPagoDemo(ref) {
  document.getElementById('pago-demo-pasarela').textContent = i18n.pasarelaDemo;
  const det = document.getElementById('pago-demo-detalle');
  const err = document.getElementById('pago-demo-error');
  err.hidden = true;
  const pago = await store.getPagoDemo(ref);
  if (!pago) {
    det.textContent = 'No encontramos ese pago demo.';
    document.getElementById('btn-pagar-demo').disabled = true;
    return;
  }
  document.getElementById('btn-pagar-demo').disabled = pago.estado === 'pagada';
  det.textContent = pago.estado === 'pagada'
    ? `Pago ${pago.referencia || ref} ya está pagado. Monto ${pago.monto} CLP.`
    : `Pagar membresía · ${pago.monto} CLP · ref ${ref} (demo, datos ficticios).`;
  document.getElementById('btn-pagar-demo').dataset.ref = ref;
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
      store = crearStoreLocal(tenant.id, localStorage, { fechaRef: fechaActiva() });
      standalone = true;
    }
  } catch {
    store = crearStoreLocal(tenant.id, localStorage, { fechaRef: fechaActiva() });
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

  document.getElementById('socios-q').addEventListener('input', () => {
    sociosFiltro.q = document.getElementById('socios-q').value;
    renderSocios();
  });
  document.getElementById('btn-socio-alta').addEventListener('click', () => abrirFormSocio(null));
  document.getElementById('sf-cancel').addEventListener('click', () => {
    document.getElementById('socio-form').classList.add('hidden');
  });
  document.getElementById('socio-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('sf-error');
    err.hidden = true;
    const datos = {
      nombre: document.getElementById('sf-nombre').value,
      telefono: document.getElementById('sf-tel').value,
      email: document.getElementById('sf-email').value,
      sedeId: document.getElementById('sf-sede').value,
      planId: document.getElementById('sf-plan').value,
      fechaInicio: document.getElementById('sf-inicio').value,
    };
    const id = document.getElementById('socio-form').dataset.id;
    const r = id ? await store.editarSocio(id, datos) : await store.altaSocio(datos);
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.error || 'No se pudo guardar';
      return;
    }
    document.getElementById('socio-form').classList.add('hidden');
    socioSel = r.socio.id;
    renderSocios();
  });
  document.getElementById('btn-csv-plantilla').addEventListener('click', async () => {
    const csv = await store.plantillaCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'plantilla-socios.csv';
    a.click();
  });
  document.getElementById('socios-csv').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const csv = await file.text();
    const r = await store.importarSociosCsv(csv);
    const msg = document.getElementById('socios-import-msg');
    msg.textContent = r.ok
      ? `Importados ${r.creados.length} de ${r.total}.`
      : `Importados ${r.creados.length} de ${r.total}. Errores: ${r.errores.map((x) => `fila ${x.fila} (${x.error})`).join('; ')}`;
    e.target.value = '';
    renderSocios();
  });
  document.getElementById('btn-pagos-csv').addEventListener('click', async () => {
    const csv = await store.exportarPagosCsv();
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pagos-mes.csv';
    a.click();
  });
  document.getElementById('pago-ref-cancel').addEventListener('click', () => {
    document.getElementById('pago-ref-form').classList.add('hidden');
  });
  document.getElementById('pago-ref-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('pago-ref-error');
    err.hidden = true;
    const r = await store.marcarPagado(pagoMarcarId, document.getElementById('pago-ref-input').value);
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.error || 'No se pudo marcar';
      return;
    }
    document.getElementById('pago-ref-form').classList.add('hidden');
    renderPagos();
  });
  document.getElementById('btn-pagar-demo').addEventListener('click', async () => {
    const ref = document.getElementById('btn-pagar-demo').dataset.ref;
    const r = await store.pagarDemo(ref);
    const err = document.getElementById('pago-demo-error');
    if (!r.ok) {
      err.hidden = false;
      err.textContent = r.error || 'No se pudo pagar';
      return;
    }
    location.hash = 'pagos';
  });

  route();
  await bootChat();
  dashTimer = setInterval(() => {
    if (!(viewDash.classList.contains('hidden')) && session) renderDashboard();
  }, 3000);
}

main();
