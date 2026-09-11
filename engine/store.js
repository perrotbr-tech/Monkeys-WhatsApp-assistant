import { clonarDemo } from '../data/demo.js';

export function clonar(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function crearMemoria(datosIniciales) {
  let state = clonar(datosIniciales || clonarDemo());

  function snapshot() {
    return clonar(state);
  }

  function hidratar(datos) {
    state = clonar(datos);
  }

  function listarClases(sede) {
    const rows = state.classes.map((c) => ({
      ...c,
      disponibles: Math.max(0, c.capacity - c.reserved),
      agotada: c.reserved >= c.capacity,
    }));
    return sede ? rows.filter((c) => c.sede === sede) : rows;
  }

  function getClase(id) {
    return state.classes.find((c) => c.id === id) || null;
  }

  function buscarClase(sede, nombre) {
    const n = String(nombre || '').toLowerCase();
    return (
      listarClases(sede).find(
        (c) => c.nombre.toLowerCase() === n || c.id === nombre,
      ) || null
    );
  }

  function listarPlanes() {
    return clonar(state.plans);
  }

  function listarReservas() {
    return clonar(state.bookings);
  }

  function listarLeads() {
    return clonar(state.leads);
  }

  function listarConversaciones() {
    return clonar(state.conversations);
  }

  function siguienteCodigo() {
    const seq = state.nextBookingSeq || 1;
    state.nextBookingSeq = seq + 1;
    return `GYM-2026-${String(seq).padStart(4, '0')}`;
  }

  function confirmarReserva({ claseId, nombre, telefono, email, sede }) {
    const clase = getClase(claseId);
    if (!clase) return { ok: false, error: 'Clase no encontrada.' };
    if (clase.reserved >= clase.capacity) {
      return { ok: false, error: 'Esa clase está AGOTADA.' };
    }
    const dup = state.bookings.find(
      (b) => b.telefono === telefono && b.claseId === claseId && b.estado === 'confirmada',
    );
    if (dup) {
      return { ok: false, error: `Ya tienes una reserva en ${clase.nombre} (${dup.codigo}).` };
    }
    clase.reserved += 1;
    const booking = {
      codigo: siguienteCodigo(),
      cliente: nombre,
      telefono,
      email: email || null,
      claseId: clase.id,
      clase: clase.nombre,
      sede: sede || clase.sede,
      dia: clase.dia,
      hora: clase.hora,
      estado: 'confirmada',
    };
    state.bookings.push(booking);
    return { ok: true, booking, clase: { ...clase } };
  }

  function buscarReserva(codigo) {
    const c = String(codigo || '').trim().toUpperCase();
    return state.bookings.find((b) => b.codigo === c) || null;
  }

  function crearLead(lead) {
    const id = `lead-${state.nextLeadSeq || 1}`;
    state.nextLeadSeq = (state.nextLeadSeq || 1) + 1;
    const row = { id, estado: 'nuevo', ...lead };
    state.leads.push(row);
    return clonar(row);
  }

  function crearConversacion(base = {}) {
    const id = `conv-${state.nextConvSeq || 1}`;
    state.nextConvSeq = (state.nextConvSeq || 1) + 1;
    const conv = {
      id,
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
    state.conversations.push(conv);
    return conv;
  }

  function getConversacion(id) {
    return state.conversations.find((c) => c.id === id) || null;
  }

  return {
    snapshot,
    hidratar,
    listarClases,
    getClase,
    buscarClase,
    listarPlanes,
    listarReservas,
    listarLeads,
    listarConversaciones,
    confirmarReserva,
    buscarReserva,
    crearLead,
    crearConversacion,
    getConversacion,
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
