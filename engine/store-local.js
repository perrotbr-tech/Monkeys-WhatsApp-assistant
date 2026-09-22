import { crearEngine } from './conversation.js';
import { crearAutomation } from './automation.js';
import { fechaHoy } from './dates.js';
import { relojActivo } from './clock.js';
import { USUARIOS_DEMO, CLAVE_DEMO, catalogoWorkspaces, featuresTenant, tenantActivo } from '../data/tenants.js';
import { enriquecerUsuarioSesion, LOCK_MS, MAX_FALLOS } from './auth.js';
import { crearContextoAcceso } from '../core/identity/usuario.js';
import { combinarPersistencia } from './store.js';
import {
  crearAdaptadorLocal,
  claveEstadoV1,
  CARGA,
  PersistenciaError,
} from './persistencia/index.js';

/** @deprecated usar claveEstadoV1; se mantiene como alias público. */
export function claveEstado(tenantId) {
  return claveEstadoV1(tenantId);
}

export function crearStoreLocal(tenantId, storage, opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const adapter = crearAdaptadorLocal({ storage, clock, fechaRef, tenantIds: [tenantId] });
  const carga = adapter.cargarTenant(tenantId);
  if (carga.status === CARGA.CORRUPTO) {
    throw carga.error || new PersistenciaError('PERSISTENCIA_CORRUPTA', 'localStorage corrupto');
  }
  const datos = carga.slice;
  const engine = crearEngine(datos, tenantId, { fechaRef, clock });
  const auto = crearAutomation(datos, tenantId, { clock });

  function persist() {
    const merged = combinarPersistencia(engine.exportar(), auto.exportar());
    adapter.guardarTenant(tenantId, merged);
    auto.hidratar(merged);
  }

  persist();

  return {
    engine,
    auto,
    persist,
    adapter,
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
    async listarSocios(filtro = {}) { return engine.filtrarSocios(filtro, fechaRef); },
    async fichaSocio(id) { return engine.fichaSocio(id, fechaRef); },
    async altaSocio(datosSocio) {
      const r = engine.altaSocio(datosSocio, fechaRef);
      persist();
      return r;
    },
    async editarSocio(id, datosSocio) {
      const r = engine.editarSocio(id, datosSocio);
      persist();
      return r;
    },
    async bajaSocio(id, motivo) {
      const r = engine.bajaSocio(id, motivo, fechaRef);
      persist();
      return r;
    },
    async reactivarSocio(id) {
      const r = engine.reactivarSocio(id);
      persist();
      return r;
    },
    async importarSociosCsv(csv) {
      const r = engine.importarSociosCsv(csv, fechaRef);
      persist();
      return r;
    },
    async listarPagos(estado) {
      let pagos = engine.listarPagos();
      if (estado) pagos = pagos.filter((p) => p.estado === estado);
      return { pagos, conciliacion: engine.conciliacionMes(fechaRef) };
    },
    async marcarPagado(id, referencia) {
      const r = engine.marcarPagado(id, referencia, fechaRef);
      persist();
      return r;
    },
    async enviarLinkPago(id) {
      const r = engine.enviarLinkPago(id, {});
      persist();
      return r;
    },
    async pagarDemo(ref) {
      const r = engine.pagarDemo(ref, fechaRef);
      persist();
      return r;
    },
    async conciliacionMes() { return engine.conciliacionMes(fechaRef); },
    async exportarPagosCsv() { return engine.exportarPagosCsv(fechaRef); },
    async pagosConfig() {
      return { modo: 'demo', pasarela: 'Pasarela en modo demostración', datosBancarios: engine.datosBancarios() };
    },
    async getPagoDemo(ref) {
      const pago = engine.memoria.pagoPorReferencia(engine.tenantId, ref);
      return pago || null;
    },
    async plantillaCsv() {
      return 'nombre,telefono,email,plan,fechaInicio,sede\n';
    },
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
      const now = clock.now();
      if (row.lockedUntil && row.lockedUntil > now) return { ok: false, error: 'bloqueado', status: 429 };
      const user = USUARIOS_DEMO.find((u) => u.tenantId === tenantId && u.email.toLowerCase() === String(email || '').trim().toLowerCase());
      if (!user || password !== CLAVE_DEMO) {
        row.fallos += 1;
        if (row.fallos >= MAX_FALLOS) row.lockedUntil = now + LOCK_MS;
        lock[k] = row;
        storage.setItem(lockKey, JSON.stringify(lock));
        return { ok: false, error: row.fallos >= MAX_FALLOS ? 'bloqueado' : 'credenciales', status: row.fallos >= MAX_FALLOS ? 429 : 401 };
      }
      delete lock[k];
      storage.setItem(lockKey, JSON.stringify(lock));
      const usuario = enriquecerUsuarioSesion(user);
      storage.setItem('forkza_session', JSON.stringify(usuario));
      return { ok: true, usuario };
    },
    async me() {
      try {
        const raw = storage.getItem('forkza_session');
        if (!raw) return null;
        const u = JSON.parse(raw);
        if (u.tenantId !== tenantId) return null;
        const ctx = crearContextoAcceso(u, catalogoWorkspaces());
        const t = tenantActivo(tenantId);
        return {
          usuario: {
            email: ctx.email,
            nombre: ctx.nombre,
            rol: ctx.rol,
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            workspaceId: ctx.workspaceId,
          },
          permisos: [...(ctx.permisos || [])],
          features: featuresTenant(t),
        };
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
