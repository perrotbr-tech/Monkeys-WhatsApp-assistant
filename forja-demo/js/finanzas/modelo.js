/**
 * Modelo financiero puro de la demo FORJA TRAINING.
 * Browser-safe: sin document, window, fetch, fs, localStorage.
 * No procesa pagos reales ni integra bancos / Mercado Pago.
 */

export const ESTADO_CARGO = Object.freeze({
  pending: 'pending',
  paid: 'paid',
  overdue: 'overdue',
  exempt: 'exempt',
});

export const ESTADO_CARGO_ES = Object.freeze({
  pending: 'pendiente',
  paid: 'pagado',
  overdue: 'vencido',
  exempt: 'exento/becado',
});

export const MEDIOS_PAGO = Object.freeze({
  transferencia: 'transferencia',
  tarjeta: 'tarjeta',
  efectivo: 'efectivo',
  link: 'link de pago demo',
});

/** Formato chileno CLP: $69.990 */
export function formatearClp(monto) {
  const n = Number(monto);
  if (!Number.isFinite(n)) return '$0';
  const entero = Math.round(n);
  const abs = Math.abs(entero);
  const conPuntos = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return entero < 0 ? `-$${conPuntos}` : `$${conPuntos}`;
}

export function diasEntre(fechaIso, refIso) {
  const a = Date.parse(`${fechaIso}T12:00:00`);
  const b = Date.parse(`${refIso}T12:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((a - b) / 86400000);
}

/**
 * Recalcula estado visible del cargo según pagos y fecha de referencia.
 * exempt permanece; paid si hay pago válido; overdue si vencido y sin pago; else pending.
 */
export function resolverEstadoCargo(cargo, pagos, fechaRef) {
  if (!cargo) return null;
  if (cargo.estado === ESTADO_CARGO.exempt) return ESTADO_CARGO.exempt;
  const pagosCargo = (pagos || []).filter((p) => p.cargoId === cargo.id);
  if (pagosCargo.length > 0 || cargo.estado === ESTADO_CARGO.paid) {
    return ESTADO_CARGO.paid;
  }
  const dias = diasEntre(cargo.vencimiento, fechaRef);
  if (dias != null && dias < 0) return ESTADO_CARGO.overdue;
  return ESTADO_CARGO.pending;
}

export function sincronizarEstadosCargos(finanzas, fechaRef) {
  const out = {
    ...finanzas,
    cargos: (finanzas.cargos || []).map((c) => ({
      ...c,
      estado: resolverEstadoCargo(c, finanzas.pagos, fechaRef),
    })),
  };
  return out;
}

function mismoWorkspace(entidad, workspaceId) {
  return entidad && entidad.workspaceId === workspaceId;
}

function mismoCoach(entidad, coachId) {
  return entidad && entidad.coachId === coachId;
}

/**
 * Filtra entidades financieras visibles para un actor.
 * actor: { rol: 'coach'|'alumno'|'admin_demo', workspaceId, coachId?, alumnoId? }
 */
export function filtrarPorActor(finanzas, actor) {
  if (!finanzas || !actor?.workspaceId) {
    return { planes: [], cargos: [], pagos: [], asignaciones: [], auditoria: [], linksPago: [] };
  }
  const ws = actor.workspaceId;
  const planes = (finanzas.planes || []).filter((p) => mismoWorkspace(p, ws));
  let cargos = (finanzas.cargos || []).filter((c) => mismoWorkspace(c, ws));
  let pagos = (finanzas.pagos || []).filter((p) => mismoWorkspace(p, ws));
  let asignaciones = (finanzas.asignaciones || []).filter((a) => mismoWorkspace(a, ws));
  let auditoria = (finanzas.auditoria || []).filter((a) => mismoWorkspace(a, ws));
  let linksPago = (finanzas.linksPago || []).filter((l) => mismoWorkspace(l, ws));

  if (actor.rol === 'coach') {
    const cid = actor.coachId;
    cargos = cargos.filter((c) => mismoCoach(c, cid));
    pagos = pagos.filter((p) => mismoCoach(p, cid));
    asignaciones = asignaciones.filter((a) => mismoCoach(a, cid));
    auditoria = auditoria.filter((a) => !a.coachId || mismoCoach(a, cid));
    linksPago = linksPago.filter((l) => mismoCoach(l, cid));
  } else if (actor.rol === 'alumno') {
    const aid = actor.alumnoId;
    cargos = cargos.filter((c) => c.alumnoId === aid);
    pagos = pagos.filter((p) => p.alumnoId === aid);
    asignaciones = asignaciones.filter((a) => a.alumnoId === aid);
    auditoria = auditoria.filter((a) => a.alumnoId === aid);
    linksPago = linksPago.filter((l) => l.alumnoId === aid);
  }

  return { planes, cargos, pagos, asignaciones, auditoria, linksPago };
}

/**
 * Rechaza referencias cruzadas o desconocidas al intentar una mutación.
 * Retorna { ok: true } o { ok: false, error: string }.
 */
export function validarReferencias(finanzas, refs) {
  const {
    workspaceId,
    coachId,
    alumnoId,
    planId,
    cargoId,
    modalidadId,
    alumnoIdsConocidos,
    coachesConocidos,
    workspacesConocidos,
  } = refs || {};

  if (workspaceId && workspacesConocidos && !workspacesConocidos.includes(workspaceId)) {
    return { ok: false, error: 'workspace_desconocido' };
  }
  if (coachId && coachesConocidos && !coachesConocidos.includes(coachId)) {
    return { ok: false, error: 'coach_desconocido' };
  }
  if (alumnoId && alumnoIdsConocidos && !alumnoIdsConocidos.includes(alumnoId)) {
    return { ok: false, error: 'alumno_desconocido' };
  }

  if (planId) {
    const plan = (finanzas.planes || []).find((p) => p.id === planId);
    if (!plan) return { ok: false, error: 'plan_desconocido' };
    if (workspaceId && plan.workspaceId !== workspaceId) {
      return { ok: false, error: 'plan_workspace_cruzado' };
    }
  }

  if (cargoId) {
    const cargo = (finanzas.cargos || []).find((c) => c.id === cargoId);
    if (!cargo) return { ok: false, error: 'cargo_desconocido' };
    if (workspaceId && cargo.workspaceId !== workspaceId) {
      return { ok: false, error: 'cargo_workspace_cruzado' };
    }
    if (coachId && cargo.coachId !== coachId) {
      return { ok: false, error: 'cargo_coach_cruzado' };
    }
    if (alumnoId && cargo.alumnoId !== alumnoId) {
      return { ok: false, error: 'cargo_alumno_cruzado' };
    }
  }

  if (modalidadId) {
    const mods = finanzas.modalidades || [];
    if (mods.length && !mods.some((m) => m.id === modalidadId)) {
      return { ok: false, error: 'modalidad_desconocida' };
    }
  }

  return { ok: true };
}

/**
 * Indicadores del período (solo cargos del período filtrados).
 * Ingresos proyectados = suma de todos los cargos del período (excepto exempt).
 * Cobrado = suma montos de cargos paid.
 * Pendiente / vencido según estado.
 * % recaudación = cobrado / proyectado * 100 (0 si proyectado=0).
 */
export function calcularIndicadores(cargos, asignaciones, fechaRef) {
  const lista = cargos || [];
  const activos = lista.filter((c) => c.estado !== ESTADO_CARGO.exempt);
  const proyectados = activos.reduce((s, c) => s + Number(c.monto || 0), 0);
  const cobrado = activos
    .filter((c) => c.estado === ESTADO_CARGO.paid)
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const pendiente = activos
    .filter((c) => c.estado === ESTADO_CARGO.pending)
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const vencido = activos
    .filter((c) => c.estado === ESTADO_CARGO.overdue)
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const pct =
    proyectados > 0 ? Math.round((cobrado / proyectados) * 1000) / 10 : 0;

  const alumnosConPlan = new Set(
    (asignaciones || []).filter((a) => a.planId).map((a) => a.alumnoId),
  ).size;

  const proximos = [...lista]
    .filter(
      (c) =>
        c.estado === ESTADO_CARGO.pending || c.estado === ESTADO_CARGO.overdue,
    )
    .sort((a, b) => String(a.vencimiento).localeCompare(String(b.vencimiento)))
    .slice(0, 5)
    .map((c) => ({
      cargoId: c.id,
      alumnoId: c.alumnoId,
      vencimiento: c.vencimiento,
      monto: c.monto,
      estado: c.estado,
      dias: diasEntre(c.vencimiento, fechaRef),
    }));

  return {
    ingresosProyectados: proyectados,
    totalCobrado: cobrado,
    totalPendiente: pendiente,
    totalVencido: vencido,
    porcentajeRecaudacion: pct,
    alumnosConPlanActivo: alumnosConPlan,
    proximosVencimientos: proximos,
  };
}

/**
 * Compara recaudación del período actual vs período previo (si hay cargos previos).
 * Retorna null si no hay datos suficientes.
 */
export function variacionRecaudacion(cargosActuales, cargosPrevios) {
  if (!cargosPrevios || cargosPrevios.length === 0) return null;
  const cobrado = (lista) =>
    (lista || [])
      .filter((c) => c.estado === ESTADO_CARGO.paid)
      .reduce((s, c) => s + Number(c.monto || 0), 0);
  const actual = cobrado(cargosActuales);
  const previo = cobrado(cargosPrevios);
  if (previo <= 0) return null;
  const deltaPct = Math.round(((actual - previo) / previo) * 1000) / 10;
  return { actual, previo, deltaPct, disminuye: deltaPct < 0 };
}

export function alertasFinancieras({
  cargos,
  asignaciones,
  alumnos,
  fechaRef,
  cargosPrevios,
}) {
  const alertas = [];
  for (const c of cargos || []) {
    if (c.estado === ESTADO_CARGO.overdue) {
      alertas.push({
        tipo: 'vencido',
        cargoId: c.id,
        alumnoId: c.alumnoId,
        mensaje: 'Pago vencido',
      });
    } else if (c.estado === ESTADO_CARGO.pending) {
      const d = diasEntre(c.vencimiento, fechaRef);
      if (d != null && d >= 0 && d <= 7) {
        alertas.push({
          tipo: 'vence_7d',
          cargoId: c.id,
          alumnoId: c.alumnoId,
          mensaje: 'Vencimiento en los próximos 7 días',
          dias: d,
        });
      }
    }
  }

  const conPlan = new Set((asignaciones || []).map((a) => a.alumnoId));
  for (const a of alumnos || []) {
    if (!conPlan.has(a.id)) {
      alertas.push({
        tipo: 'sin_plan',
        alumnoId: a.id,
        mensaje: 'Alumno sin plan asociado',
      });
    }
  }

  const varR = variacionRecaudacion(cargos, cargosPrevios);
  if (varR && varR.disminuye) {
    alertas.push({
      tipo: 'recaudacion_baja',
      mensaje: `Disminución de recaudación (${varR.deltaPct}%)`,
      deltaPct: varR.deltaPct,
    });
  }

  return alertas;
}

function nuevoId(prefijo, existentes) {
  let n = (existentes || []).length + 1;
  let id = `${prefijo}-${String(n).padStart(3, '0')}`;
  const ids = new Set((existentes || []).map((x) => x.id));
  while (ids.has(id)) {
    n += 1;
    id = `${prefijo}-${String(n).padStart(3, '0')}`;
  }
  return id;
}

function appendAuditoria(finanzas, evento) {
  const auditoria = [...(finanzas.auditoria || [])];
  auditoria.push({
    id: nuevoId('aud', auditoria),
    ts: evento.ts || new Date().toISOString(),
    ...evento,
  });
  return { ...finanzas, auditoria };
}

/**
 * Registra un pago demo sobre un cargo.
 * Reglas: no montos negativos; monto = cargo; no pagar dos veces; no exempt.
 */
export function registrarPago(finanzas, {
  cargoId,
  medio,
  actor,
  fechaIso,
  montoOverride,
  refs,
}) {
  const v = validarReferencias(finanzas, {
    ...(refs || {}),
    workspaceId: actor?.workspaceId,
    coachId: actor?.coachId,
    cargoId,
  });
  if (!v.ok) return { ok: false, error: v.error, finanzas };

  const cargo = (finanzas.cargos || []).find((c) => c.id === cargoId);
  if (!cargo) return { ok: false, error: 'cargo_desconocido', finanzas };

  if (actor?.rol === 'coach' && cargo.coachId !== actor.coachId) {
    return { ok: false, error: 'cargo_coach_cruzado', finanzas };
  }
  if (actor?.workspaceId && cargo.workspaceId !== actor.workspaceId) {
    return { ok: false, error: 'cargo_workspace_cruzado', finanzas };
  }

  if (cargo.estado === ESTADO_CARGO.exempt) {
    return { ok: false, error: 'cargo_exento', finanzas };
  }

  const yaPagado =
    cargo.estado === ESTADO_CARGO.paid ||
    (finanzas.pagos || []).some((p) => p.cargoId === cargoId);
  if (yaPagado) {
    return { ok: false, error: 'cargo_ya_pagado', finanzas };
  }

  const monto =
    montoOverride != null ? Number(montoOverride) : Number(cargo.monto);
  if (!Number.isFinite(monto) || monto < 0) {
    return { ok: false, error: 'monto_negativo_o_invalido', finanzas };
  }
  if (monto !== Number(cargo.monto)) {
    return { ok: false, error: 'monto_no_coincide_plan', finanzas };
  }

  const medioOk = MEDIOS_PAGO[medio] || Object.values(MEDIOS_PAGO).includes(medio);
  if (!medioOk && !MEDIOS_PAGO[medio]) {
    return { ok: false, error: 'medio_invalido', finanzas };
  }
  const medioKey = MEDIOS_PAGO[medio] ? medio : Object.keys(MEDIOS_PAGO).find(
    (k) => MEDIOS_PAGO[k] === medio,
  ) || medio;

  const pagos = [...(finanzas.pagos || [])];
  const pago = {
    id: nuevoId('pago', pagos),
    cargoId,
    workspaceId: cargo.workspaceId,
    coachId: cargo.coachId,
    alumnoId: cargo.alumnoId,
    planId: cargo.planId,
    monto,
    moneda: cargo.moneda || 'CLP',
    medio: medioKey,
    fecha: fechaIso || cargo.vencimiento,
    comprobanteId: `comp-${Date.now().toString(36)}`,
  };
  pagos.push(pago);

  const cargos = (finanzas.cargos || []).map((c) =>
    c.id === cargoId ? { ...c, estado: ESTADO_CARGO.paid } : c,
  );

  let next = { ...finanzas, cargos, pagos };
  next = appendAuditoria(next, {
    workspaceId: cargo.workspaceId,
    coachId: cargo.coachId,
    alumnoId: cargo.alumnoId,
    accion: 'registrar_pago',
    cargoId,
    pagoId: pago.id,
    monto,
    medio: medioKey,
  });

  return { ok: true, pago, finanzas: next };
}

/** Marca transferencia pendiente como recibida (= registrar pago transferencia). */
export function marcarTransferenciaRecibida(finanzas, opts) {
  return registrarPago(finanzas, { ...opts, medio: 'transferencia' });
}

/** Genera link de pago ficticio (sin integración real). */
export function generarLinkPago(finanzas, { cargoId, actor, refs }) {
  const v = validarReferencias(finanzas, {
    ...(refs || {}),
    workspaceId: actor?.workspaceId,
    coachId: actor?.coachId,
    cargoId,
  });
  if (!v.ok) return { ok: false, error: v.error, finanzas };

  const cargo = (finanzas.cargos || []).find((c) => c.id === cargoId);
  if (!cargo) return { ok: false, error: 'cargo_desconocido', finanzas };
  if (actor?.rol === 'coach' && cargo.coachId !== actor.coachId) {
    return { ok: false, error: 'cargo_coach_cruzado', finanzas };
  }
  if (cargo.estado === ESTADO_CARGO.paid || cargo.estado === ESTADO_CARGO.exempt) {
    return { ok: false, error: 'cargo_no_linkeable', finanzas };
  }

  const linksPago = [...(finanzas.linksPago || [])];
  const link = {
    id: nuevoId('link', linksPago),
    cargoId,
    workspaceId: cargo.workspaceId,
    coachId: cargo.coachId,
    alumnoId: cargo.alumnoId,
    monto: cargo.monto,
    moneda: cargo.moneda || 'CLP',
    url: `https://pago.demo.forja.local/l/${cargo.id}/${Date.now().toString(36)}`,
    creadoEn: new Date().toISOString(),
    ficticio: true,
  };
  linksPago.push(link);

  let next = { ...finanzas, linksPago };
  next = appendAuditoria(next, {
    workspaceId: cargo.workspaceId,
    coachId: cargo.coachId,
    alumnoId: cargo.alumnoId,
    accion: 'generar_link_pago',
    cargoId,
    linkId: link.id,
  });

  return { ok: true, link, finanzas: next };
}

export function fichaFinancieraAlumno(finanzas, alumnoId, fechaRef) {
  const asignacion = (finanzas.asignaciones || []).find(
    (a) => a.alumnoId === alumnoId,
  );
  const plan = asignacion
    ? (finanzas.planes || []).find((p) => p.id === asignacion.planId)
    : null;
  const cargosAlu = (finanzas.cargos || [])
    .filter((c) => c.alumnoId === alumnoId)
    .map((c) => ({
      ...c,
      estado: resolverEstadoCargo(c, finanzas.pagos, fechaRef),
    }))
    .sort((a, b) => String(b.vencimiento).localeCompare(String(a.vencimiento)));
  const cargoActual = cargosAlu[0] || null;
  const pagosAlu = (finanzas.pagos || [])
    .filter((p) => p.alumnoId === alumnoId)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const ultimoPago = pagosAlu[0] || null;

  return {
    alumnoId,
    plan,
    asignacion,
    valorMensual: plan?.valorMensual ?? null,
    ultimoPago,
    proximoVencimiento: cargoActual?.vencimiento || null,
    estado: cargoActual?.estado || null,
    cargoActual,
    historialPagos: pagosAlu,
    historialCargos: cargosAlu,
    observacionFinanciera: asignacion?.observacionFinanciera || '',
    coachId: asignacion?.coachId || cargoActual?.coachId || null,
    modalidadIds: asignacion?.modalidadIds || plan?.modalidadIds || [],
  };
}

/** Sugerencias del asistente FORJA (solo lectura / borradores; requieren aprobación). */
export function sugerenciasFinancierasAsistente(finanzas, alumnos, fechaRef) {
  const cargos = finanzas.cargos || [];
  const vencidos = cargos.filter((c) => c.estado === ESTADO_CARGO.overdue);
  const proximos = cargos.filter((c) => {
    if (c.estado !== ESTADO_CARGO.pending) return false;
    const d = diasEntre(c.vencimiento, fechaRef);
    return d != null && d >= 0 && d <= 7;
  });
  const nombre = (id) => alumnos.find((a) => a.id === id)?.nombre || id;

  const sugerencias = [];
  if (vencidos.length) {
    sugerencias.push({
      id: 'fin-sug-vencidos',
      titulo: 'Listar pagos vencidos',
      detalle: `Hay ${vencidos.length} cargo(s) vencido(s): ${vencidos
        .map((c) => nombre(c.alumnoId))
        .join(', ')}.`,
      evidencia: vencidos.map((c) => `${c.id}:${c.vencimiento}`).join(' · '),
      tipo: 'finanzas',
      estado: 'pendiente',
      borradorMensaje: vencidos[0]
        ? `Hola ${nombre(vencidos[0].alumnoId)}, te escribo por la mensualidad vencida el ${vencidos[0].vencimiento}. ¿Puedes confirmar el pago?`
        : '',
      requiereAprobacion: true,
      prohibido: [
        'cobrar_automaticamente',
        'cambiar_precios',
        'bloquear_alumnos',
        'cancelar_planes',
        'enviar_mensajes_reales',
        'marcar_pagos_sin_aprobacion',
      ],
    });
  }
  if (proximos.length) {
    sugerencias.push({
      id: 'fin-sug-proximos',
      titulo: 'Próximos vencimientos (7 días)',
      detalle: proximos.map((c) => `${nombre(c.alumnoId)} · ${c.vencimiento}`).join('; '),
      evidencia: proximos.map((c) => c.id).join(' · '),
      tipo: 'finanzas',
      estado: 'pendiente',
      borradorMensaje: proximos[0]
        ? `Hola ${nombre(proximos[0].alumnoId)}, te recuerdo que tu plan vence el ${proximos[0].vencimiento}.`
        : '',
      requiereAprobacion: true,
      prohibido: [
        'cobrar_automaticamente',
        'enviar_mensajes_reales',
        'marcar_pagos_sin_aprobacion',
      ],
    });
  }

  const ind = calcularIndicadores(cargos, finanzas.asignaciones, fechaRef);
  sugerencias.push({
    id: 'fin-sug-resumen',
    titulo: 'Resumen financiero del mes',
    detalle: `Proyectado ${formatearClp(ind.ingresosProyectados)} · Cobrado ${formatearClp(ind.totalCobrado)} · Pendiente ${formatearClp(ind.totalPendiente)} · Vencido ${formatearClp(ind.totalVencido)} · Recaudación ${ind.porcentajeRecaudacion}%.`,
    evidencia: 'Indicadores calculados desde cargos del período demo',
    tipo: 'finanzas',
    estado: 'pendiente',
    requiereAprobacion: true,
    prohibido: [
      'cobrar_automaticamente',
      'cambiar_precios',
      'bloquear_alumnos',
      'cancelar_planes',
    ],
  });

  return sugerencias;
}
