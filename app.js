import { crearEngine } from './engine/conversation.js';
import { crearAutomation } from './engine/automation.js';
import { clonarDemo } from './data/demo.js';
import { FECHA_DEMO } from './engine/dates.js';

const KEY = 'monkeys_demo_state';
const logEl = document.getElementById('chat-log');
const inputEl = document.getElementById('chat-input');
const sendEl = document.getElementById('chat-send');
const viewChat = document.getElementById('view-asistente');
const viewDash = document.getElementById('view-dashboard');
const viewAuto = document.getElementById('view-auto');
const navA = document.getElementById('nav-asistente');
const navD = document.getElementById('nav-dashboard');
const navAuto = document.getElementById('nav-auto');

let store;
let convId = null;
let dashTimer = null;
let sedeFiltro = 'Todas';
let autoFiltro = { agente: '', sede: '', estado: '' };

function timeoutFetch(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

class StoreApi {
  async iniciarConversacion() {
    const res = await fetch('./api/conversations', { method: 'POST' });
    return res.json();
  }
  async enviarMensaje(id, text) {
    const res = await fetch(`./api/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  }
  async listarClases() {
    const res = await fetch('./api/classes');
    return (await res.json()).classes;
  }
  async listarPlanes() {
    const res = await fetch('./api/plans');
    return (await res.json()).plans;
  }
  async listarReservas() {
    const res = await fetch('./api/bookings');
    return (await res.json()).bookings;
  }
  async listarLeads() {
    const res = await fetch('./api/leads');
    return (await res.json()).leads;
  }
  async listarConversaciones() {
    const res = await fetch('./api/conversations');
    return (await res.json()).conversations;
  }
  async reset() {
    const res = await fetch('./api/demo/reset', { method: 'POST' });
    return res.json();
  }
  async runAutomation() {
    const res = await fetch('./api/automation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fecha: FECHA_DEMO }),
    });
    return res.json();
  }
  async automationSummary() {
    const res = await fetch('./api/automation/summary');
    return res.json();
  }
  async automationActions(q = {}) {
    const p = new URLSearchParams();
    if (q.agente) p.set('agente', q.agente);
    if (q.sede) p.set('sede', q.sede);
    if (q.estado) p.set('estado', q.estado);
    const res = await fetch(`./api/automation/actions?${p.toString()}`);
    return (await res.json()).actions;
  }
  async setActionEstado(id, estado) {
    const res = await fetch(`./api/automation/actions/${id}/estado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    return res.json();
  }
  async setAgenteActivo(id, activo) {
    const res = await fetch(`./api/automation/agentes/${id}/activo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    });
    return res.json();
  }
}

class StoreLocal {
  constructor() {
    let datos = clonarDemo();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) datos = JSON.parse(raw);
    } catch {
      datos = clonarDemo();
    }
    this.engine = crearEngine(datos);
    this.auto = crearAutomation(datos);
  }
  persist() {
    localStorage.setItem(KEY, JSON.stringify({ ...this.engine.exportar(), ...this.auto.exportar() }));
  }
  async iniciarConversacion() {
    const r = this.engine.iniciar();
    this.persist();
    return r;
  }
  async enviarMensaje(id, text) {
    const r = this.engine.procesar(id, text);
    this.persist();
    return r;
  }
  async listarClases() { return this.engine.listarClases(); }
  async listarPlanes() { return this.engine.listarPlanes(); }
  async listarReservas() { return this.engine.listarReservas(); }
  async listarLeads() { return this.engine.listarLeads(); }
  async listarConversaciones() { return this.engine.listarConversaciones(); }
  async reset() {
    this.engine.reset();
    this.auto.reset();
    this.persist();
    return { ok: true };
  }
  async runAutomation() {
    const campania = this.auto.ejecutarCiclo(FECHA_DEMO);
    this.persist();
    return { ok: true, campania, summary: this.auto.summary(FECHA_DEMO) };
  }
  async automationSummary() { return this.auto.summary(FECHA_DEMO); }
  async automationActions(q = {}) { return this.auto.listarAcciones(q); }
  async setActionEstado(id, estado) {
    const action = this.auto.setEstado(id, estado);
    this.persist();
    return { action };
  }
  async setAgenteActivo(id, activo) {
    const agentesActivos = this.auto.setAgenteActivo(id, activo);
    this.persist();
    return { agentesActivos };
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

function route() {
  const hash = (location.hash || '#asistente').replace('#', '') || 'asistente';
  const dash = hash === 'dashboard';
  const auto = hash === 'automatizaciones';
  viewChat.classList.toggle('hidden', dash || auto);
  viewDash.classList.toggle('hidden', !dash);
  viewAuto.classList.toggle('hidden', !auto);
  navA.classList.toggle('is-active', !dash && !auto);
  navD.classList.toggle('is-active', dash);
  navAuto.classList.toggle('is-active', auto);
  if (dash) renderDashboard();
  if (auto) renderAutomations();
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

async function renderDashboard() {
  const [bookings, leads, convs, classes] = await Promise.all([
    store.listarReservas(),
    store.listarLeads(),
    store.listarConversaciones(),
    store.listarClases(),
  ]);
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
  for (const name of ['Todas', 'Félix García', 'Alta Vista']) {
    const btn = el('button', 'chip', name);
    if (name === sedeFiltro) btn.style.borderColor = 'var(--amarillo)';
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
  tables.appendChild(table('CLASES', ['Clase', 'Sede', 'Entrenador', 'Horario', 'Cupos', 'Estado'], k.map((x) => [x.nombre, x.sede, x.entrenador, `${x.dia} ${x.hora}`, `${x.reserved}/${x.capacity}`, x.agotada ? 'AGOTADA' : 'disponible'])));
}

const AGENT_LABEL = { retencion: 'RETENCIÓN' };

function pill(agente) {
  const s = el('span', `pill pill-${agente}`, AGENT_LABEL[agente] || agente);
  return s;
}

async function renderAutomations() {
  const summary = await store.automationSummary();
  const cards = document.getElementById('auto-cards');
  cards.replaceChildren();
  const ind = (summary.indicadores && summary.indicadores.retencion) || {};
  const cardEl = el('div', 'agent-card');
  cardEl.appendChild(el('h2', null, 'RETENCIÓN'));
  cardEl.appendChild(el('div', 'kpi', String(ind.sociosEnRiesgo || 0)));
  cardEl.appendChild(el('div', 'kpi-lbl', 'Socios en riesgo'));
  cardEl.appendChild(el('div', 'kpi', String(ind.recuperadosEsteMes || 0)));
  cardEl.appendChild(el('div', 'kpi-lbl', 'Recuperados este mes'));
  const on = summary.agentesActivos && summary.agentesActivos.retencion !== false;
  const tog = el('button', `toggle${on ? ' is-on' : ''}`, on ? 'Activo' : 'Pausado');
  tog.addEventListener('click', async () => {
    await store.setAgenteActivo('retencion', !on);
    renderAutomations();
  });
  cardEl.appendChild(tog);
  cards.appendChild(cardEl);

  const filters = document.getElementById('auto-filters');
  filters.replaceChildren();
  const makeFilter = (label, key, values) => {
    for (const v of values) {
      const b = el('button', 'chip', v || `Todos ${label}`);
      const val = v === `Todos ${label}` ? '' : v;
      if (autoFiltro[key] === val) b.style.borderColor = 'var(--amarillo)';
      b.addEventListener('click', () => {
        autoFiltro[key] = val;
        renderAutomations();
      });
      filters.appendChild(b);
    }
  };
  makeFilter('agente', 'agente', ['Todos agente', 'retencion']);
  makeFilter('sede', 'sede', ['Todos sede', 'Félix García', 'Alta Vista']);
  makeFilter('estado', 'estado', ['Todos estado', 'pendiente', 'enviado', 'hecho']);

  const actions = await store.automationActions(autoFiltro);
  const tb = document.getElementById('auto-table');
  tb.replaceChildren();
  for (const a of actions) {
    const tr = document.createElement('tr');
    const tdA = document.createElement('td');
    tdA.appendChild(pill(a.agente));
    tr.appendChild(tdA);
    tr.appendChild(el('td', null, a.socioNombre || a.socioId));
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
  document.getElementById('msg-meta').textContent = `${a.socioNombre} · ${a.claseFavorita || ''} · ${a.sedeId}`;
  document.getElementById('msg-body').textContent = a.texto || a.motivo || '';
  document.getElementById('msg-panel').classList.remove('hidden');
}

async function main() {
  try {
    const health = await timeoutFetch('./api/health', 1500);
    if (health.ok) store = new StoreApi();
    else store = new StoreLocal();
  } catch {
    store = new StoreLocal();
  }

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
    renderDashboard();
    if (!viewAuto.classList.contains('hidden')) renderAutomations();
  });

  document.getElementById('btn-run-cycle').addEventListener('click', async () => {
    await store.runAutomation();
    renderAutomations();
  });
  document.getElementById('msg-close').addEventListener('click', () => {
    document.getElementById('msg-panel').classList.add('hidden');
  });

  route();
  await bootChat();
  dashTimer = setInterval(() => {
    if (!(viewDash.classList.contains('hidden'))) renderDashboard();
    if (!(viewAuto.classList.contains('hidden'))) renderAutomations();
  }, 3000);
}

main();
