import { clonarDemo, clonarMundo, clonar } from '../data/demo.js';
import { buscarTenant, listarTenants, TENANT_DEFAULT } from '../data/tenants.js';
import { anioDe, fechaHoy } from './dates.js';
import { planSomaPorId } from '../data/planes-soma.js';

export { clonar };

function anioCodigo(fechaRef) {
  return anioDe(fechaRef || fechaHoy());
}

function toWorld(datosIniciales) {
  if (!datosIniciales) return clonarMundo();
  if (datosIniciales.byTenant) {
    return clonar(datosIniciales);
  }
  const tenantId = datosIniciales.tenantId
    || (datosIniciales.classes && datosIniciales.classes[0] && datosIniciales.classes[0].tenantId)
    || TENANT_DEFAULT;
  const slice = clonar(datosIniciales);
  slice.tenantId = tenantId;
  stampSlice(slice, tenantId);
  return {
    tenants: listarTenants(),
    byTenant: { [tenantId]: slice },
  };
}

function stampSlice(slice, tenantId) {
  const keys = ['classes', 'plans', 'bookings', 'leads', 'conversations', 'socios', 'asistencias', 'referidos', 'usuariosEquipo'];
  for (const k of keys) {
    if (!Array.isArray(slice[k])) continue;
    slice[k] = slice[k].map((row) => ({ tenantId, ...row }));
  }
  if (slice.automation) {
    slice.automation.campanias = (slice.automation.campanias || []).map((c) => ({ tenantId, ...c }));
    slice.automation.acciones = (slice.automation.acciones || []).map((a) => ({ tenantId, ...a }));
  }
  return slice;
}

export function crearMemoria(datosIniciales) {
  let state = toWorld(datosIniciales);

  function ensure(tenantId) {
    const id = tenantId || TENANT_DEFAULT;
    if (!state.byTenant[id]) {
      const t = buscarTenant(id);
      if (!t || !t.activo) return null;
      state.byTenant[id] = clonarDemo(id);
    }
    return state.byTenant[id];
  }

  function requireSlice(tenantId) {
    const s = ensure(tenantId);
    if (!s) {
      const err = new Error('tenant_not_found');
      err.code = 'TENANT_NOT_FOUND';
      throw err;
    }
    return s;
  }

  function snapshot() {
    return clonar(state);
  }

  function hidratar(datos) {
    state = toWorld(datos);
  }

  function getTenant(tenantId) {
    return buscarTenant(tenantId) || (state.tenants || []).find((t) => t.id === tenantId || t.slug === tenantId) || null;
  }

  function listarTenantsMem() {
    return clonar(state.tenants || listarTenants());
  }

  function listarSedes(tenantId) {
    const t = getTenant(tenantId);
    return clonar((t && t.sedes) || []);
  }

  function listarClases(tenantId, sede) {
    const s = requireSlice(tenantId);
    const rows = s.classes.map((c) => ({
      ...c,
      tenantId,
      disponibles: c.reservable === false ? null : Math.max(0, c.capacity - c.reserved),
      agotada: c.reservable !== false && c.capacity > 0 && c.reserved >= c.capacity,
    }));
    return sede ? rows.filter((c) => c.sede === sede) : rows;
  }

  function getClase(tenantId, id) {
    const s = requireSlice(tenantId);
    return s.classes.find((c) => c.id === id) || null;
  }

  function buscarClase(tenantId, sede, nombre) {
    const n = String(nombre || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const hora = n.match(/(\d{1,2}:\d{2})/);
    const clases = listarClases(tenantId, sede);
    const byHora = hora
      ? clases.filter((c) => String(c.hora).includes(hora[1]) && n.includes(c.nombre.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')))
      : [];
    if (byHora.length) return byHora[0];
    return (
      clases.find((c) => c.nombre.toLowerCase() === n || c.id === nombre)
      || clases.find((c) => n.includes(c.nombre.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')))
      || null
    );
  }

  function listarPlanes(tenantId) {
    return clonar(requireSlice(tenantId).plans);
  }

  function listarReservas(tenantId) {
    return clonar(requireSlice(tenantId).bookings);
  }

  function listarLeads(tenantId) {
    return clonar(requireSlice(tenantId).leads);
  }

  function listarConversaciones(tenantId) {
    return clonar(requireSlice(tenantId).conversations);
  }

  function listarSocios(tenantId) {
    return clonar(requireSlice(tenantId).socios || []);
  }

  function listarAsistencias(tenantId) {
    return clonar(requireSlice(tenantId).asistencias || []);
  }

  function listarAcciones(tenantId, filtro = {}) {
    const s = requireSlice(tenantId);
    const rows = (s.automation && s.automation.acciones) || [];
    return rows
      .filter((a) => a.tenantId === tenantId || !a.tenantId)
      .filter((a) => !filtro.agente || a.agente === filtro.agente)
      .filter((a) => !filtro.sede || a.sedeId === filtro.sede)
      .filter((a) => !filtro.estado || a.estado === filtro.estado)
      .map((a) => clonar(a));
  }

  function listarCampanias(tenantId) {
    const s = requireSlice(tenantId);
    return clonar((s.automation && s.automation.campanias) || []);
  }

  function siguienteCodigo(tenantId) {
    const s = requireSlice(tenantId);
    const tenant = getTenant(tenantId);
    const prefix = (tenant && tenant.codigoPrefix) || String(tenantId).toUpperCase();
    const seq = s.nextBookingSeq || 1;
    s.nextBookingSeq = seq + 1;
    return `${prefix}-${anioCodigo()}-${String(seq).padStart(4, '0')}`;
  }

  function buscarSocioPorTelefono(tenantId, telefono) {
    const s = requireSlice(tenantId);
    const tel = normalizarTelefono(telefono) || telefono;
    return (s.socios || []).find((row) => (normalizarTelefono(row.telefono) || row.telefono) === tel) || null;
  }

  function planDe(tenantId, socio) {
    if (!socio || tenantId !== 'soma') return null;
    const fromSlice = (requireSlice(tenantId).plans || []).find((p) => p.id === socio.planId);
    return fromSlice || planSomaPorId(socio.planId);
  }

  function confirmarReserva(tenantId, { claseId, nombre, telefono, email, sede }) {
    const s = requireSlice(tenantId);
    const clase = getClase(tenantId, claseId);
    if (!clase) return { ok: false, error: 'Clase no encontrada.' };
    if (clase.reservable === false) {
      if (clase.accesoLibre) return { ok: false, error: 'Musculación es acceso libre. No se reserva cupo.' };
      if (clase.conHora) return { ok: false, error: 'Kinesiología se atiende con hora. El equipo te contacta.' };
      return { ok: false, error: 'Esa actividad no se reserva por el asistente.' };
    }
    if (clase.reserved >= clase.capacity) {
      return { ok: false, error: 'Esa clase está AGOTADA.' };
    }
    const tel = normalizarTelefono(telefono) || telefono;
    const dup = s.bookings.find(
      (b) => b.tenantId === tenantId && b.telefono === tel && b.claseId === claseId && b.estado === 'confirmada',
    );
    if (dup) {
      return { ok: false, error: `Ya tienes una reserva en ${clase.nombre} (${dup.codigo}).` };
    }

    const socio = buscarSocioPorTelefono(tenantId, tel);
    const plan = planDe(tenantId, socio);
    if (socio && socio.estado !== 'baja' && plan) {
      const usados = socio.cuposUsadosMes || 0;
      if (plan.cuposMes != null && usados >= plan.cuposMes) {
        crearAccion(tenantId, {
          agente: 'recordatorio',
          tipo: 'tarea_equipo',
          socioId: socio.id,
          texto: null,
          motivo: 'cupos agotados',
          prioridad: 'media',
          sedeId: sede || clase.sede,
        });
        return {
          ok: false,
          error: `Ya usaste los ${plan.cuposMes} cupos de tu plan este mes. ¿Quieres que el equipo te cuente cómo ampliarlo?`,
          codigo: 'CUPOS_AGOTADOS',
        };
      }
      const incluidas = plan.disciplinasIncluidas || [];
      if (incluidas.length && !incluidas.includes(clase.nombre)) {
        crearAccion(tenantId, {
          agente: 'recordatorio',
          tipo: 'tarea_equipo',
          socioId: socio.id,
          texto: null,
          motivo: `disciplina no incluida: ${clase.nombre}`,
          prioridad: 'media',
          sedeId: sede || clase.sede,
        });
        return {
          ok: false,
          error: `Tu plan no incluye ${clase.nombre}. Dejamos la consulta al equipo.`,
          codigo: 'DISCIPLINA',
        };
      }
      const maxDia = plan.maxSesionesDia == null ? 2 : plan.maxSesionesDia;
      const delDia = s.bookings.filter(
        (b) => b.telefono === tel && b.dia === clase.dia && b.estado === 'confirmada',
      ).length;
      if (delDia >= maxDia) {
        return {
          ok: false,
          error: `Ya tienes ${maxDia} reservas este día. El plan permite máximo ${maxDia}.`,
          codigo: 'MAX_DIA',
        };
      }
    }

    clase.reserved += 1;
    const booking = {
      tenantId,
      codigo: siguienteCodigo(tenantId),
      cliente: nombre,
      telefono: tel,
      email: email || null,
      claseId: clase.id,
      clase: clase.nombre,
      sede: sede || clase.sede,
      dia: clase.dia,
      hora: clase.hora,
      estado: 'confirmada',
    };
    s.bookings.push(booking);
    let cuposRestantes = null;
    if (socio && plan && plan.cuposMes != null) {
      socio.cuposUsadosMes = (socio.cuposUsadosMes || 0) + 1;
      cuposRestantes = Math.max(0, plan.cuposMes - socio.cuposUsadosMes);
    }
    return { ok: true, booking, clase: { ...clase }, cuposRestantes };
  }

  function cancelarReserva(tenantId, codigo) {
    const s = requireSlice(tenantId);
    const b = s.bookings.find((row) => row.codigo === String(codigo || '').trim().toUpperCase());
    if (!b || b.estado !== 'confirmada') return { ok: false, error: 'No encontramos esa reserva activa.' };
    b.estado = 'cancelada';
    const clase = getClase(tenantId, b.claseId);
    if (clase && clase.reserved > 0) clase.reserved -= 1;
    const socio = buscarSocioPorTelefono(tenantId, b.telefono);
    if (socio && socio.cuposUsadosMes > 0) socio.cuposUsadosMes -= 1;
    return { ok: true, booking: clonar(b), socio: socio ? clonar(socio) : null };
  }

  function buscarReserva(tenantId, codigo) {
    const s = requireSlice(tenantId);
    const c = String(codigo || '').trim().toUpperCase();
    return s.bookings.find((b) => b.codigo === c && (b.tenantId === tenantId || !b.tenantId)) || null;
  }

  function crearLead(tenantId, lead) {
    const s = requireSlice(tenantId);
    const id = `lead-${tenantId}-${s.nextLeadSeq || 1}`;
    s.nextLeadSeq = (s.nextLeadSeq || 1) + 1;
    const row = { id, estado: 'nuevo', tenantId, ...lead };
    s.leads.push(row);
    return clonar(row);
  }

  function crearConversacion(tenantId, base = {}) {
    const s = requireSlice(tenantId);
    const id = `conv-${tenantId}-${s.nextConvSeq || 1}`;
    s.nextConvSeq = (s.nextConvSeq || 1) + 1;
    const conv = {
      id,
      tenantId,
      sede: null,
      status: 'active',
      paso: 'pick_sede',
      data: {},
      usuario: null,
      telefono: null,
      motivo: null,
      messages: [],
      ...base,
    };
    s.conversations.push(conv);
    return conv;
  }

  function getConversacion(tenantId, id) {
    const s = requireSlice(tenantId);
    return s.conversations.find((c) => c.id === id) || null;
  }

  function crearAccion(tenantId, accion) {
    const s = requireSlice(tenantId);
    if (!s.automation) {
      s.automation = { nextActionSeq: 1, agentesActivos: {}, campanias: [], acciones: [] };
    }
    s.automation.nextActionSeq = (s.automation.nextActionSeq || 0) + 1;
    const row = {
      id: `act-${s.automation.nextActionSeq}`,
      tenantId,
      canal: 'simulado',
      estado: accion.tipo === 'mensaje' ? 'enviado' : 'pendiente',
      fechaISO: new Date().toISOString(),
      ...accion,
    };
    s.automation.acciones.push(row);
    return clonar(row);
  }

  function sliceExport(tenantId) {
    return clonar(requireSlice(tenantId));
  }

  return {
    snapshot,
    hidratar,
    getTenant,
    listarTenants: listarTenantsMem,
    listarSedes,
    listarClases,
    getClase,
    buscarClase,
    listarPlanes,
    listarReservas,
    listarLeads,
    listarConversaciones,
    listarSocios,
    listarAsistencias,
    listarAcciones,
    listarCampanias,
    confirmarReserva,
    cancelarReserva,
    buscarReserva,
    buscarSocioPorTelefono,
    crearLead,
    crearConversacion,
    getConversacion,
    crearAccion,
    siguienteCodigo,
    sliceExport,
    hidratarTenant(tenantId, slice) {
      const s = clonar(slice);
      s.tenantId = tenantId;
      stampSlice(s, tenantId);
      if (!state.byTenant) state.byTenant = {};
      state.byTenant[tenantId] = s;
    },
    requireSlice,
  };
}

export function normalizarTelefono(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('569')) return `+${digits}`;
  if (digits.length === 9 && digits.startsWith('9')) return `+56${digits}`;
  return null;
}

export function nombreValido(raw) {
  const n = String(raw || '').trim();
  return n.length >= 2 && n.length <= 60;
}
