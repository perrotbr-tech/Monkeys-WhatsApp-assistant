import { crearEngine } from './conversation.js';
import { crearAutomation } from './automation.js';
import { clonarDemo } from '../data/demo.js';
import { fechaHoy } from './dates.js';
import { USUARIOS_DEMO, CLAVE_DEMO } from '../data/tenants.js';
import { combinarPersistencia } from './store.js';

export function claveEstado(tenantId) {
  return `forkza_demo_state_${tenantId}`;
}

export function crearStoreLocal(tenantId, storage, opts = {}) {
  const fechaRef = opts.fechaRef || fechaHoy();
  const KEY = claveEstado(tenantId);
  const LEGACY = tenantId === 'monkeys' ? 'monkeys_demo_state' : null;
  let datos = clonarDemo(tenantId, fechaRef);
  try {
    const raw = storage.getItem(KEY) || (LEGACY ? storage.getItem(LEGACY) : null);
    if (raw) datos = JSON.parse(raw);
    if (tenantId === 'soma' && datos.plans && datos.plans[0] && !('cuposMes' in datos.plans[0])) {
      datos = clonarDemo('soma', fechaRef);
    }
  } catch {
    datos = clonarDemo(tenantId, fechaRef);
  }
  const engine = crearEngine(datos, tenantId, { fechaRef });
  const auto = crearAutomation(datos, tenantId);

  function persist() {
    const merged = combinarPersistencia(engine.exportar(), auto.exportar());
    storage.setItem(KEY, JSON.stringify(merged));
    auto.hidratar(merged);
  }

  persist();

  return {
    engine,
    auto,
    persist,
    async iniciarConversacion() {
      const r = engine.iniciar();
      persist();
      return r;
    },
    async enviarMensaje(id, text) {
      const r = engine.procesar(id, text);
      persist();
      return r;
    },
    async listarClases() { return engine.listarClases(); },
    async listarPlanes() { return engine.listarPlanes(); },
    async listarReservas() { return engine.listarReservas(); },
    async listarLeads() { return engine.listarLeads(); },
    async listarConversaciones() { return engine.listarConversaciones(); },
    async reset() {
      engine.reset();
      auto.reset();
      persist();
      return { ok: true };
    },
    async runAutomation() {
      const campania = auto.ejecutarCiclo(fechaRef);
      persist();
      return { ok: true, campania, summary: auto.summary(fechaRef) };
    },
    async automationSummary() { return auto.summary(fechaRef); },
    async automationActions(q = {}) { return auto.listarAcciones(q); },
    async setActionEstado(id, estado) {
      const action = auto.setEstado(id, estado);
      persist();
      return { action };
    },
    async setAgenteActivo(id, activo) {
      const agentesActivos = auto.setAgenteActivo(id, activo);
      persist();
      return { agentesActivos };
    },
    async login(email, password) {
      const lockKey = 'forkza_login_lock';
      let lock = {};
      try { lock = JSON.parse(storage.getItem(lockKey) || '{}'); } catch { lock = {}; }
      const k = `${tenantId}:${String(email || '').trim().toLowerCase()}`;
      const row = lock[k] || { fallos: 0, lockedUntil: 0 };
      if (row.lockedUntil && row.lockedUntil > Date.now()) return { ok: false, error: 'bloqueado', status: 429 };
      const user = USUARIOS_DEMO.find((u) => u.tenantId === tenantId && u.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user || password !== CLAVE_DEMO) {
        row.fallos += 1;
        if (row.fallos >= 5) row.lockedUntil = Date.now() + 10 * 60 * 1000;
        lock[k] = row;
        storage.setItem(lockKey, JSON.stringify(lock));
        return { ok: false, error: row.fallos >= 5 ? 'bloqueado' : 'credenciales', status: row.fallos >= 5 ? 429 : 401 };
      }
      delete lock[k];
      storage.setItem(lockKey, JSON.stringify(lock));
      const usuario = { email: user.email, nombre: user.nombre, rol: user.rol, tenantId: user.tenantId };
      storage.setItem('forkza_session', JSON.stringify(usuario));
      return { ok: true, usuario };
    },
    async me() {
      try {
        const raw = storage.getItem('forkza_session');
        if (!raw) return null;
        const u = JSON.parse(raw);
        return u.tenantId === tenantId ? u : null;
      } catch {
        return null;
      }
    },
  };
}

export function crearStorageMemoria() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(k); },
  };
}
