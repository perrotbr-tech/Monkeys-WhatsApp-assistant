import { clonarDemo, clonarMundo, clonar } from '../data/demo.js';
import { buscarTenant, listarTenants, TENANT_DEFAULT } from '../data/tenants.js';
import { anioDe, fechaHoy, dayKey, ymKey } from './dates.js';
import { planSomaPorId } from '../data/planes-soma.js';
import { normalizarTelefono, nombreValido } from './identidad.js';
import {
  crearMembresia, extenderMembresia, refrescarMembresia, membresiaVigenteDe,
  montoDelPlan, estadoMembresia,
} from './membresias.js';
import { parseCsv, validarFilaSocio, prepararSocio, PLANTILLA_CSV_SOCIOS } from './socios-admin.js';
import { proveedorDe, modoPasarela } from './services/pagos.js';

export { normalizarTelefono, nombreValido, PLANTILLA_CSV_SOCIOS };

export { clonar };

/** Une slice del engine (cupos, tareas de reserva) con el de automatizaciones (ciclo). */
export function combinarPersistencia(eng, aut) {
  const e = eng || {};
  const a = aut || {};
  const accionesEng = (e.automation && e.automation.acciones) || [];
  const accionesAut = (a.automation && a.automation.acciones) || [];
  const byId = new Map();
  for (const row of accionesAut) byId.set(row.id, row);
  for (const row of accionesEng) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  const autoBlock = a.automation || {};
  const engBlock = e.automation || {};
  return {
    ...a,
    ...e,
    socios: e.socios || a.socios,
    asistencias: a.asistencias || e.asistencias,
    membresias: e.membresias || a.membresias || [],
    pagos: e.pagos || a.pagos || [],
    automation: {
      ...engBlock,
      ...autoBlock,
      acciones: [...byId.values()],
      campanias: autoBlock.campanias || engBlock.campanias || [],
      agentesActivos: autoBlock.agentesActivos || engBlock.agentesActivos || {},
      nextActionSeq: Math.max(autoBlock.nextActionSeq || 0, engBlock.nextActionSeq || 0),
    },
  };
}

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
  const keys = ['classes', 'plans', 'bookings', 'leads', 'conversations', 'socios', 'asistencias', 'referidos', 'usuariosEquipo', 'membresias', 'pagos'];
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
    const dia = diaDesdeTexto(n);
    let clases = listarClases(tenantId, sede);
    if (dia) clases = clases.filter((c) => c.dia === dia);
    const nom = (c) => c.nombre.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const byHora = hora
      ? clases.filter((c) => String(c.hora).includes(hora[1]) && n.includes(nom(c)))
      : [];
    if (byHora.length) return byHora[0];
    return (
      clases.find((c) => nom(c) === n || c.id === nombre)
      || clases.find((c) => n.includes(nom(c)))
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

  function planDe(tenantId, socioOPlanId) {
    const planId = socioOPlanId && typeof socioOPlanId === 'object' ? socioOPlanId.planId : socioOPlanId;
    if (!planId) return null;
    const fromSlice = (requireSlice(tenantId).plans || []).find((p) => p.id === planId);
    if (fromSlice) return fromSlice;
    if (tenantId === 'soma') return planSomaPorId(planId);
    return null;
  }

  function ensureArr(s, key) {
    if (!Array.isArray(s[key])) s[key] = [];
    return s[key];
  }

  function siguienteSocioId(tenantId) {
    const s = requireSlice(tenantId);
    const prefix = tenantId === 'soma' ? 'sm' : 's';
    s.nextSocioSeq = (s.nextSocioSeq || 100) + 1;
    return `${prefix}${s.nextSocioSeq}`;
  }

  function siguienteMembresiaId(tenantId) {
    const s = requireSlice(tenantId);
    s.nextMembresiaSeq = (s.nextMembresiaSeq || 0) + 1;
    return `mem-${tenantId}-${s.nextMembresiaSeq}`;
  }

  function siguientePagoId(tenantId) {
    const s = requireSlice(tenantId);
    s.nextPagoSeq = (s.nextPagoSeq || 0) + 1;
    return `pago-${tenantId}-${s.nextPagoSeq}`;
  }

  function refrescarMembresias(tenantId, fechaRef) {
    const s = requireSlice(tenantId);
    const fecha = fechaRef || fechaHoy();
    ensureArr(s, 'membresias');
    s.membresias = s.membresias.map((m) => refrescarMembresia(m, fecha));
    return s.membresias;
  }

  function listarMembresias(tenantId, fechaRef) {
    return clonar(refrescarMembresias(tenantId, fechaRef));
  }

  function listarPagos(tenantId) {
    const s = requireSlice(tenantId);
    return clonar(ensureArr(s, 'pagos'));
  }

  function getSocio(tenantId, id) {
    const s = requireSlice(tenantId);
    return (s.socios || []).find((row) => row.id === id) || null;
  }

  function pagoDelPeriodo(s, membresiaId, periodoInicio) {
    return (s.pagos || []).find(
      (p) => p.membresiaId === membresiaId
        && p.periodoInicio === periodoInicio
        && (p.estado === 'pendiente' || p.estado === 'pagada'),
    );
  }

  function crearPagoPendiente(tenantId, { socio, membresia, plan, fechaRef, medio }) {
    const s = requireSlice(tenantId);
    ensureArr(s, 'pagos');
    const dup = pagoDelPeriodo(s, membresia.id, membresia.inicio);
    if (dup) return { ok: false, error: 'Ya existe un pago para este período.', pago: clonar(dup) };
    const pago = {
      tenantId,
      id: siguientePagoId(tenantId),
      socioId: socio.id,
      membresiaId: membresia.id,
      planId: plan.id,
      monto: montoDelPlan(plan),
      estado: 'pendiente',
      referencia: null,
      medio: medio || 'transferencia',
      periodoInicio: membresia.inicio,
      periodoFin: membresia.fin,
      fechaISO: new Date().toISOString(),
      linkUrl: null,
      linkReferencia: null,
      concepto: plan.nombre,
    };
    s.pagos.push(pago);
    return { ok: true, pago: clonar(pago) };
  }

  function aplicarPagoAMembresia(tenantId, pago, fechaRef) {
    const s = requireSlice(tenantId);
    const plan = planDe(tenantId, pago.planId);
    ensureArr(s, 'membresias');
    let mem = s.membresias.find((m) => m.id === pago.membresiaId);
    if (!mem) {
      mem = crearMembresia({
        tenantId,
        id: siguienteMembresiaId(tenantId),
        socioId: pago.socioId,
        planId: pago.planId,
        inicio: dayKey(fechaRef),
        plan,
        fechaRef,
      });
      s.membresias.push(mem);
    } else if (!(estadoMembresia(mem, fechaRef) === 'vigente' && pago.periodoInicio === mem.inicio)) {
      const idx = s.membresias.findIndex((m) => m.id === mem.id);
      mem = extenderMembresia(mem, plan, fechaRef);
      s.membresias[idx] = mem;
    }
    pago.membresiaId = mem.id;
    pago.periodoInicio = mem.inicio;
    pago.periodoFin = mem.fin;
    const socio = getSocio(tenantId, pago.socioId);
    if (socio) socio.planId = plan.id;
    return mem;
  }

  function altaSocio(tenantId, datos, fechaRef = fechaHoy()) {
    const s = requireSlice(tenantId);
    const tel = normalizarTelefono(datos.telefono);
    if (!nombreValido(datos.nombre)) return { ok: false, error: 'nombre inválido' };
    if (!tel) return { ok: false, error: 'teléfono inválido' };
    if (buscarSocioPorTelefono(tenantId, tel)) return { ok: false, error: 'teléfono duplicado' };
    const plan = planDe(tenantId, datos.planId) || (s.plans || [])[0];
    if (!plan) return { ok: false, error: 'plan inexistente' };
    const tenant = getTenant(tenantId);
    const sedeOk = (tenant.sedes || []).some((x) => x.nombre === datos.sedeId);
    if (!sedeOk) return { ok: false, error: 'sede inexistente' };
    const socio = prepararSocio(tenantId, siguienteSocioId(tenantId), {
      ...datos,
      telefono: tel,
      planId: plan.id,
    }, fechaRef);
    s.socios.push(socio);
    const mem = crearMembresia({
      tenantId,
      id: siguienteMembresiaId(tenantId),
      socioId: socio.id,
      planId: plan.id,
      inicio: socio.fechaIngreso,
      plan,
      fechaRef,
    });
    ensureArr(s, 'membresias');
    s.membresias.push(mem);
    crearPagoPendiente(tenantId, { socio, membresia: mem, plan, fechaRef, medio: 'transferencia' });
    return { ok: true, socio: clonar(socio), membresia: clonar(mem) };
  }

  function editarSocio(tenantId, id, datos) {
    const socio = getSocio(tenantId, id);
    if (!socio) return { ok: false, error: 'socio no encontrado' };
    if (datos.nombre != null) {
      if (!nombreValido(datos.nombre)) return { ok: false, error: 'nombre inválido' };
      socio.nombre = String(datos.nombre).trim();
    }
    if (datos.telefono != null) {
      const tel = normalizarTelefono(datos.telefono);
      if (!tel) return { ok: false, error: 'teléfono inválido' };
      const otro = buscarSocioPorTelefono(tenantId, tel);
      if (otro && otro.id !== socio.id) return { ok: false, error: 'teléfono duplicado' };
      socio.telefono = tel;
    }
    if (datos.email != null) socio.email = datos.email || null;
    if (datos.sedeId != null) socio.sedeId = datos.sedeId;
    if (datos.planId != null) {
      const plan = planDe(tenantId, datos.planId);
      if (!plan) return { ok: false, error: 'plan inexistente' };
      socio.planId = plan.id;
    }
    if (datos.claseFavorita != null) socio.claseFavorita = datos.claseFavorita;
    return { ok: true, socio: clonar(socio) };
  }

  function bajaSocio(tenantId, id, motivo, fechaRef = fechaHoy()) {
    const socio = getSocio(tenantId, id);
    if (!socio) return { ok: false, error: 'socio no encontrado' };
    socio.estado = 'baja';
    socio.fechaBaja = dayKey(fechaRef);
    socio.motivoBaja = String(motivo || 'sin motivo').slice(0, 200);
    const s = requireSlice(tenantId);
    ensureArr(s, 'membresias');
    for (const m of s.membresias.filter((row) => row.socioId === id && row.estado === 'vigente')) {
      m.estado = 'pausada';
    }
    return { ok: true, socio: clonar(socio) };
  }

  function reactivarSocio(tenantId, id) {
    const socio = getSocio(tenantId, id);
    if (!socio) return { ok: false, error: 'socio no encontrado' };
    socio.estado = 'activo';
    socio.fechaBaja = null;
    socio.motivoBaja = null;
    return { ok: true, socio: clonar(socio) };
  }

  function importarSociosCsv(tenantId, csv, fechaRef = fechaHoy()) {
    const s = requireSlice(tenantId);
    const tenant = getTenant(tenantId);
    const { rows } = parseCsv(csv);
    const telefonos = new Set((s.socios || []).map((row) => normalizarTelefono(row.telefono) || row.telefono));
    const errores = [];
    const creados = [];
    for (const row of rows) {
      const v = validarFilaSocio(row, {
        plans: s.plans,
        sedes: tenant.sedes,
        telefonos,
      });
      if (!v.ok) {
        errores.push({ fila: row._fila, error: v.errores.join(', ') });
        continue;
      }
      const r = altaSocio(tenantId, v.datos, fechaRef);
      if (!r.ok) {
        errores.push({ fila: row._fila, error: r.error });
        continue;
      }
      telefonos.add(v.datos.telefono);
      creados.push(r.socio);
    }
    return { ok: errores.length === 0, creados, errores, total: rows.length };
  }

  function marcarPagado(tenantId, pagoId, referencia, fechaRef = fechaHoy()) {
    const s = requireSlice(tenantId);
    const pago = (s.pagos || []).find((p) => p.id === pagoId);
    if (!pago) return { ok: false, error: 'pago no encontrado' };
    if (pago.estado === 'pagada') return { ok: false, error: 'el pago ya está pagado' };
    const otro = (s.pagos || []).find(
      (p) => p.id !== pago.id && p.membresiaId === pago.membresiaId && p.periodoInicio === pago.periodoInicio && p.estado === 'pagada',
    );
    if (otro) return { ok: false, error: 'Ya existe un pago para este período.' };
    pago.estado = 'pagada';
    pago.referencia = String(referencia || `TR-${pago.id}`).slice(0, 80);
    pago.medio = pago.medio === 'link' || pago.linkUrl ? (pago.medio || 'link') : 'transferencia';
    pago.fechaPagoISO = new Date().toISOString();
    const mem = aplicarPagoAMembresia(tenantId, pago, fechaRef);
    return { ok: true, pago: clonar(pago), membresia: clonar(mem) };
  }

  function rechazarPago(tenantId, pagoId) {
    const s = requireSlice(tenantId);
    const pago = (s.pagos || []).find((p) => p.id === pagoId);
    if (!pago) return { ok: false, error: 'pago no encontrado' };
    pago.estado = 'rechazada';
    const socio = getSocio(tenantId, pago.socioId);
    crearAccion(tenantId, {
      agente: 'cobranza',
      tipo: 'mensaje',
      socioId: pago.socioId,
      texto: socio
        ? `Hola ${socio.nombre}, no pudimos confirmar tu pago del plan. El equipo lo revisará.`
        : 'Pago rechazado. El equipo lo revisará.',
      motivo: 'pago rechazado',
      prioridad: 'alta',
      sedeId: socio ? socio.sedeId : null,
    });
    return { ok: true, pago: clonar(pago) };
  }

  function enviarLinkPago(tenantId, pagoId, opts = {}) {
    const s = requireSlice(tenantId);
    const pago = (s.pagos || []).find((p) => p.id === pagoId);
    if (!pago) return { ok: false, error: 'pago no encontrado' };
    if (pago.estado === 'pagada') return { ok: false, error: 'el pago ya está pagado' };
    const prov = proveedorDe(opts);
    const r = prov.crearLink(pago);
    const done = (link) => {
      pago.linkUrl = link.url;
      pago.linkReferencia = link.referencia;
      pago.medio = 'link';
      pago.estado = 'pendiente';
      return { ok: true, pago: clonar(pago), url: link.url, referencia: link.referencia, modo: modoPasarela(opts) };
    };
    if (r && typeof r.then === 'function') {
      return r.then(done);
    }
    return done(r);
  }

  function pagoPorReferencia(tenantId, referencia) {
    const s = requireSlice(tenantId);
    const ref = String(referencia || '');
    return (s.pagos || []).find((p) => p.linkReferencia === ref || p.referencia === ref || p.id === ref) || null;
  }

  function buscarPagoEnTenants(referencia) {
    for (const id of Object.keys(state.byTenant || {})) {
      const pago = pagoPorReferencia(id, referencia);
      if (pago) return { tenantId: id, pago };
    }
    return null;
  }

  function pagarDemo(referencia, fechaRef = fechaHoy()) {
    const hit = buscarPagoEnTenants(referencia);
    if (!hit) return { ok: false, error: 'pago no encontrado' };
    return marcarPagado(hit.tenantId, hit.pago.id, referencia, fechaRef);
  }

  function webhookPago(tenantId, payload, opts = {}) {
    const prov = proveedorDe(opts);
    const ev = prov.webhook(payload);
    const pago = pagoPorReferencia(tenantId, ev.referencia) || (payload && payload.pagoId && (requireSlice(tenantId).pagos || []).find((p) => p.id === payload.pagoId));
    if (!pago) return { ok: false, error: 'pago no encontrado', evento: ev };
    if (ev.estado === 'pagada') return { ...marcarPagado(tenantId, pago.id, ev.referencia), evento: ev };
    if (ev.estado === 'rechazada') return { ...rechazarPago(tenantId, pago.id), evento: ev };
    pago.estado = ev.estado || pago.estado;
    return { ok: true, pago: clonar(pago), evento: ev };
  }

  function conciliacionMes(tenantId, fechaRef = fechaHoy()) {
    const ym = ymKey(fechaRef);
    const pagos = listarPagos(tenantId).filter((p) => String(p.fechaISO || '').slice(0, 7) === ym || String(p.periodoInicio || '').startsWith(ym));
    const sum = (estado) => pagos.filter((p) => p.estado === estado).reduce((n, p) => n + (p.monto || 0), 0);
    const pagado = sum('pagada');
    const pendiente = sum('pendiente');
    const vencido = sum('vencida');
    const rechazado = sum('rechazada');
    const esperado = pagado + pendiente + vencido;
    return {
      ym,
      esperado,
      pagado,
      pendiente,
      vencido,
      rechazado,
      cuadra: esperado === pagado + pendiente + vencido,
      n: pagos.length,
    };
  }

  function exportarPagosCsv(tenantId, fechaRef = fechaHoy()) {
    const ym = ymKey(fechaRef);
    const conc = conciliacionMes(tenantId, fechaRef);
    const pagos = listarPagos(tenantId).filter((p) => String(p.fechaISO || '').slice(0, 7) === ym || String(p.periodoInicio || '').startsWith(ym));
    const lines = ['id,socioId,planId,monto,estado,referencia,medio,periodoInicio,periodoFin'];
    for (const p of pagos) {
      lines.push([p.id, p.socioId, p.planId, p.monto, p.estado, p.referencia || '', p.medio || '', p.periodoInicio, p.periodoFin].join(','));
    }
    return { csv: `${lines.join('\n')}\n`, conciliacion: conc };
  }

  function fichaSocio(tenantId, id, fechaRef = fechaHoy()) {
    const socio = getSocio(tenantId, id);
    if (!socio) return null;
    refrescarMembresias(tenantId, fechaRef);
    const s = requireSlice(tenantId);
    const membresia = membresiaVigenteDe(s.membresias, id, fechaRef);
    const plan = planDe(tenantId, socio);
    const pagos = (s.pagos || []).filter((p) => p.socioId === id);
    const asistencias = (s.asistencias || []).filter((a) => a.socioId === id);
    const reservas = (s.bookings || []).filter((b) => b.telefono === socio.telefono);
    let cuposRestantes = null;
    if (plan && plan.cuposMes != null) {
      cuposRestantes = Math.max(0, plan.cuposMes - (socio.cuposUsadosMes || 0));
    }
    return clonar({
      socio,
      plan,
      membresia: membresia ? refrescarMembresia(membresia, fechaRef) : null,
      cuposRestantes,
      cuposMes: plan && plan.cuposMes,
      cuposUsadosMes: socio.cuposUsadosMes || 0,
      pagos,
      asistencias,
      reservas,
    });
  }

  function resumenMembresiaChat(tenantId, telefono, fechaRef = fechaHoy()) {
    const socio = buscarSocioPorTelefono(tenantId, telefono);
    if (!socio || socio.estado === 'baja') return { ok: false, error: 'No encontramos un plan asociado a ese teléfono.' };
    const ficha = fichaSocio(tenantId, socio.id, fechaRef);
    const mem = ficha.membresia;
    const plan = ficha.plan;
    const ultimo = (ficha.pagos || []).slice().sort((a, b) => String(b.fechaISO).localeCompare(String(a.fechaISO)))[0];
    const pagoEstado = ultimo ? ultimo.estado : 'sin registro';
    const lines = [
      `Hola ${socio.nombre}.`,
      `Plan: ${plan ? plan.nombre : 'sin plan'}.`,
      mem ? `Vigencia: ${mem.inicio} a ${mem.fin} (${mem.estado}).` : 'Sin membresía activa.',
      `Pago: ${pagoEstado === 'pagada' ? 'al día' : pagoEstado}.`,
    ];
    if (tenantId === 'soma' && ficha.cuposRestantes != null) {
      lines.push(`Cupos restantes este mes: ${ficha.cuposRestantes} de ${ficha.cuposMes}.`);
    }
    return { ok: true, texto: lines.join('\n'), ficha };
  }

  function datosBancarios(tenantId) {
    const t = getTenant(tenantId);
    return (t && t.datosBancarios) || 'Transferencia (ficticia, demo): Banco Estado · 00000000 · Prototipo demostrativo.';
  }

  function responderPagarChat(tenantId, telefono, fechaRef = fechaHoy()) {
    const socio = buscarSocioPorTelefono(tenantId, telefono);
    if (!socio || socio.estado === 'baja') return { ok: false, error: 'No encontramos un plan asociado a ese teléfono.' };
    const s = requireSlice(tenantId);
    const pendiente = (s.pagos || []).find((p) => p.socioId === socio.id && p.estado === 'pendiente');
    if (pendiente && pendiente.linkUrl) {
      return {
        ok: true,
        texto: `Puedes pagar aquí (demo):\n${pendiente.linkUrl}`,
        pago: clonar(pendiente),
      };
    }
    const banco = datosBancarios(tenantId);
    crearAccion(tenantId, {
      agente: 'cobranza',
      tipo: 'tarea_equipo',
      socioId: socio.id,
      texto: null,
      motivo: `Conciliar comprobante de ${socio.nombre}`,
      prioridad: 'media',
      sedeId: socio.sedeId,
    });
    const monto = pendiente ? pendiente.monto : montoDelPlan(planDe(tenantId, socio));
    return {
      ok: true,
      texto: `${banco}\nMonto del plan: ${monto} CLP.\nAvísanos con el comprobante para conciliarlo.`,
      pago: pendiente ? clonar(pendiente) : null,
    };
  }

  function filtrarSocios(tenantId, filtro = {}, fechaRef = fechaHoy()) {
    refrescarMembresias(tenantId, fechaRef);
    const s = requireSlice(tenantId);
    const q = String(filtro.q || '').trim().toLowerCase();
    return (s.socios || []).filter((socio) => {
      if (filtro.sede && socio.sedeId !== filtro.sede) return false;
      if (filtro.plan && socio.planId !== filtro.plan) return false;
      if (filtro.estadoSocio && socio.estado !== filtro.estadoSocio) return false;
      const mem = membresiaVigenteDe(s.membresias, socio.id, fechaRef);
      if (filtro.estado && (!mem || mem.estado !== filtro.estado)) return false;
      if (filtro.vence7) {
        if (!mem) return false;
        const d = (new Date(`${mem.fin}T12:00:00Z`) - new Date(`${dayKey(fechaRef)}T12:00:00Z`)) / 86400000;
        if (!(d >= 0 && d <= 7)) return false;
      }
      if (q) {
        const blob = `${socio.nombre} ${socio.telefono} ${socio.email || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    }).map((socio) => {
      const mem = membresiaVigenteDe(s.membresias, socio.id, fechaRef);
      const plan = planDe(tenantId, socio);
      return clonar({
        ...socio,
        planNombre: plan ? plan.nombre : socio.planId,
        membresia: mem,
      });
    });
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
    const plan = tenantId === 'soma' ? planDe(tenantId, socio) : null;
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
    listarMembresias,
    listarPagos,
    getSocio,
    altaSocio,
    editarSocio,
    bajaSocio,
    reactivarSocio,
    importarSociosCsv,
    marcarPagado,
    rechazarPago,
    enviarLinkPago,
    pagarDemo,
    webhookPago,
    conciliacionMes,
    exportarPagosCsv,
    fichaSocio,
    resumenMembresiaChat,
    responderPagarChat,
    filtrarSocios,
    datosBancarios,
    pagoPorReferencia,
    buscarPagoEnTenants,
    planDe,
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

function diaDesdeTexto(n) {
  const pares = [
    ['miercoles', 'Miércoles'],
    ['lunes', 'Lunes'],
    ['martes', 'Martes'],
    ['jueves', 'Jueves'],
    ['viernes', 'Viernes'],
    ['sabado', 'Sábado'],
  ];
  for (const [key, dia] of pares) {
    if (n.includes(key)) return dia;
  }
  return null;
}
