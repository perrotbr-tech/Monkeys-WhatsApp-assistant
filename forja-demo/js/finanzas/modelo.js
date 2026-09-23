/**
 * Motor financiero puro de la demo Forja (sin document/window/fetch).
 * Relación: Alumno → Plan → Cargo → Pago
 */

import { fmtClp, etiquetaEstadoCargo, etiquetaMedioPago } from './formato.js';
import { FECHA_REF_DEMO, PERIODO_ACTUAL, WS_FORJA } from './seed.js';

export { fmtClp, etiquetaEstadoCargo, etiquetaMedioPago };

const MEDIOS = new Set(['transferencia', 'tarjeta', 'efectivo', 'link_pago', 'exento']);

function parseDia(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function diasEntre(aIso, bIso) {
  const a = parseDia(aIso);
  const b = parseDia(bIso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function nuevoId(prefijo, lista) {
  let n = (lista?.length || 0) + 1;
  let id = `${prefijo}-${String(n).padStart(3, '0')}`;
  const ids = new Set((lista || []).map((x) => x.id));
  while (ids.has(id)) {
    n += 1;
    id = `${prefijo}-${String(n).padStart(3, '0')}`;
  }
  return id;
}

function auditar(estado, entrada) {
  if (!estado.finanzas) return;
  if (!Array.isArray(estado.finanzas.auditoria)) estado.finanzas.auditoria = [];
  estado.finanzas.auditoria.push({
    id: nuevoId('aud', estado.finanzas.auditoria),
    workspaceId: entrada.workspaceId,
    coachId: entrada.coachId || null,
    actorId: entrada.actorId,
    accion: entrada.accion,
    detalle: entrada.detalle,
    fecha: entrada.fecha || new Date().toISOString(),
  });
}

/**
 * Actor de sesión demo: { workspaceId, coachId?, rol, alumnoId? }
 */
export function validarReferencias(estado, refs = {}) {
  const fin = estado.finanzas;
  if (!fin) return { ok: false, error: 'finanzas_ausentes' };

  if (refs.workspaceId) {
    const conocido =
      refs.workspaceId === WS_FORJA ||
      fin.planes.some((p) => p.workspaceId === refs.workspaceId) ||
      (estado.alumnos || []).some((a) => a.workspaceId === refs.workspaceId);
    if (!conocido) return { ok: false, error: 'workspace_desconocido' };
  }

  if (refs.coachId) {
    const coaches = new Set(
      (estado.alumnos || []).map((a) => a.coachId).filter(Boolean),
    );
    if (estado.coach?.id) coaches.add(estado.coach.id);
    if (!coaches.has(refs.coachId)) return { ok: false, error: 'coach_desconocido' };
  }

  if (refs.alumnoId) {
    const alu = (estado.alumnos || []).find((a) => a.id === refs.alumnoId);
    if (!alu) return { ok: false, error: 'alumno_desconocido' };
    if (refs.workspaceId && alu.workspaceId && alu.workspaceId !== refs.workspaceId) {
      return { ok: false, error: 'cruce_workspace_alumno' };
    }
    if (refs.coachId && alu.coachId && alu.coachId !== refs.coachId) {
      return { ok: false, error: 'cruce_coach_alumno' };
    }
  }

  if (refs.planId) {
    const plan = fin.planes.find((p) => p.id === refs.planId);
    if (!plan) return { ok: false, error: 'plan_desconocido' };
    if (refs.workspaceId && plan.workspaceId !== refs.workspaceId) {
      return { ok: false, error: 'cruce_workspace_plan' };
    }
  }

  if (refs.cargoId) {
    const cargo = fin.cargos.find((c) => c.id === refs.cargoId);
    if (!cargo) return { ok: false, error: 'cargo_desconocido' };
    if (refs.workspaceId && cargo.workspaceId !== refs.workspaceId) {
      return { ok: false, error: 'cruce_workspace_cargo' };
    }
    if (refs.coachId && cargo.coachId !== refs.coachId) {
      return { ok: false, error: 'cruce_coach_cargo' };
    }
    if (refs.alumnoId && cargo.alumnoId !== refs.alumnoId) {
      return { ok: false, error: 'cruce_alumno_cargo' };
    }
  }

  if (refs.pagoId) {
    const pago = fin.pagos.find((p) => p.id === refs.pagoId);
    if (!pago) return { ok: false, error: 'pago_desconocido' };
    if (refs.workspaceId && pago.workspaceId !== refs.workspaceId) {
      return { ok: false, error: 'cruce_workspace_pago' };
    }
    if (refs.coachId && pago.coachId !== refs.coachId) {
      return { ok: false, error: 'cruce_coach_pago' };
    }
  }

  return { ok: true };
}

export function puedeVerCargo(actor, cargo) {
  if (!actor || !cargo) return false;
  if (actor.workspaceId !== cargo.workspaceId) return false;
  if (actor.rol === 'alumno') {
    return actor.alumnoId === cargo.alumnoId;
  }
  if (actor.rol === 'coach') {
    return actor.coachId === cargo.coachId;
  }
  return false;
}

export function puedeVerPago(actor, pago) {
  if (!actor || !pago) return false;
  if (actor.workspaceId !== pago.workspaceId) return false;
  if (actor.rol === 'alumno') return actor.alumnoId === pago.alumnoId;
  if (actor.rol === 'coach') return actor.coachId === pago.coachId;
  return false;
}

export function puedeVerAlumno(actor, alumno) {
  if (!actor || !alumno) return false;
  if (actor.workspaceId !== alumno.workspaceId) return false;
  if (actor.rol === 'alumno') return actor.alumnoId === alumno.id;
  if (actor.rol === 'coach') return actor.coachId === alumno.coachId;
  return false;
}

export function cargosVisibles(estado, actor) {
  return (estado.finanzas?.cargos || []).filter((c) => puedeVerCargo(actor, c));
}

export function pagosVisibles(estado, actor) {
  return (estado.finanzas?.pagos || []).filter((p) => puedeVerPago(actor, p));
}

export function alumnosVisibles(estado, actor) {
  return (estado.alumnos || []).filter((a) => puedeVerAlumno(actor, a));
}

export function sincronizarEstadosCargo(estado, fechaRef) {
  const ref = fechaRef || estado.finanzas?.fechaRef || FECHA_REF_DEMO;
  for (const cargo of estado.finanzas?.cargos || []) {
    if (cargo.estado === 'paid' || cargo.estado === 'exempt') continue;
    const dias = diasEntre(cargo.vencimiento, ref);
    if (dias != null && dias > 0) cargo.estado = 'overdue';
    else if (cargo.estado === 'overdue') {
      const d2 = diasEntre(cargo.vencimiento, ref);
      if (d2 != null && d2 <= 0) cargo.estado = 'pending';
    }
  }
}

/**
 * Indicadores del período para el actor (solo cargos visibles).
 * Exentos no suman a proyectado ni a cobrado.
 */
export function calcularIndicadores(estado, actor, opts = {}) {
  const periodo = opts.periodo || estado.finanzas?.periodoActual || PERIODO_ACTUAL;
  const fechaRef = opts.fechaRef || estado.finanzas?.fechaRef || FECHA_REF_DEMO;
  sincronizarEstadosCargo(estado, fechaRef);

  const cargos = cargosVisibles(estado, actor).filter((c) => c.periodo === periodo);
  const cobrables = cargos.filter((c) => c.estado !== 'exempt');

  const proyectado = cobrables.reduce((s, c) => s + Number(c.monto || 0), 0);
  const cobrado = cobrables
    .filter((c) => c.estado === 'paid')
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const pendiente = cobrables
    .filter((c) => c.estado === 'pending')
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const vencido = cobrables
    .filter((c) => c.estado === 'overdue')
    .reduce((s, c) => s + Number(c.monto || 0), 0);
  const pctRecaudacion =
    proyectado > 0 ? Math.round((cobrado / proyectado) * 1000) / 10 : 0;

  const alumnosActivos = new Set(
    cobrables.map((c) => c.alumnoId).concat(
      cargos.filter((c) => c.estado === 'exempt').map((c) => c.alumnoId),
    ),
  ).size;

  const proximos = cobrables
    .filter((c) => c.estado === 'pending' || c.estado === 'overdue')
    .map((c) => {
      const dias = diasEntre(fechaRef, c.vencimiento);
      return { ...c, diasHastaVencimiento: dias };
    })
    .filter((c) => c.diasHastaVencimiento != null)
    .sort((a, b) => String(a.vencimiento).localeCompare(String(b.vencimiento)));

  return {
    periodo,
    fechaRef,
    proyectado,
    cobrado,
    pendiente,
    vencido,
    pctRecaudacion,
    alumnosConPlanActivo: alumnosActivos,
    proximosVencimientos: proximos,
  };
}

export function calcularAlertas(estado, actor, opts = {}) {
  const fechaRef = opts.fechaRef || estado.finanzas?.fechaRef || FECHA_REF_DEMO;
  const ind = calcularIndicadores(estado, actor, opts);
  const alertas = [];

  for (const c of cargosVisibles(estado, actor)) {
    if (c.estado === 'overdue') {
      const alu = (estado.alumnos || []).find((a) => a.id === c.alumnoId);
      alertas.push({
        tipo: 'pago_vencido',
        cargoId: c.id,
        alumnoId: c.alumnoId,
        mensaje: `Pago vencido: ${alu?.nombre || c.alumnoId} (${fmtClp(c.monto)})`,
      });
    } else if (c.estado === 'pending') {
      const dias = diasEntre(fechaRef, c.vencimiento);
      if (dias != null && dias >= 0 && dias <= 7) {
        const alu = (estado.alumnos || []).find((a) => a.id === c.alumnoId);
        alertas.push({
          tipo: 'vence_7_dias',
          cargoId: c.id,
          alumnoId: c.alumnoId,
          mensaje: `Vence en ${dias} día(s): ${alu?.nombre || c.alumnoId}`,
        });
      }
    }
  }

  for (const a of alumnosVisibles(estado, actor)) {
    if (!a.planId) {
      alertas.push({
        tipo: 'sin_plan',
        alumnoId: a.id,
        mensaje: `Alumno sin plan asociado: ${a.nombre}`,
      });
    }
  }

  const ant =
    estado.finanzas?.recaudacionAnterior?.[actor.workspaceId]?.['2026-08'];
  if (ant && ant.proyectado > 0) {
    const pctAnt = (ant.cobrado / ant.proyectado) * 100;
    if (ind.pctRecaudacion < pctAnt) {
      alertas.push({
        tipo: 'caida_recaudacion',
        mensaje: `Recaudación ${ind.pctRecaudacion}% vs ${Math.round(pctAnt * 10) / 10}% del mes anterior (demo)`,
      });
    }
  }

  return alertas;
}

export function planPorId(estado, planId) {
  return (estado.finanzas?.planes || []).find((p) => p.id === planId) || null;
}

export function cargoActualAlumno(estado, alumnoId, periodo) {
  const per = periodo || estado.finanzas?.periodoActual || PERIODO_ACTUAL;
  return (
    (estado.finanzas?.cargos || []).find(
      (c) => c.alumnoId === alumnoId && c.periodo === per,
    ) || null
  );
}

export function pagosDeCargo(estado, cargoId) {
  return (estado.finanzas?.pagos || []).filter((p) => p.cargoId === cargoId);
}

export function fichaFinancieraAlumno(estado, actor, alumnoId) {
  const refs = validarReferencias(estado, {
    workspaceId: actor.workspaceId,
    alumnoId,
    coachId: actor.rol === 'coach' ? actor.coachId : undefined,
  });
  if (!refs.ok) return { ok: false, error: refs.error };

  const alumno = (estado.alumnos || []).find((a) => a.id === alumnoId);
  if (!alumno || !puedeVerAlumno(actor, alumno)) {
    return { ok: false, error: 'sin_permiso' };
  }

  const plan = planPorId(estado, alumno.planId);
  const cargo = cargoActualAlumno(estado, alumnoId);
  if (cargo && !puedeVerCargo(actor, cargo)) {
    return { ok: false, error: 'sin_permiso' };
  }

  const historial = (estado.finanzas?.pagos || [])
    .filter((p) => p.alumnoId === alumnoId && puedeVerPago(actor, p))
    .slice()
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  const ultimo = historial[0] || null;

  return {
    ok: true,
    alumno,
    plan,
    cargo,
    ultimoPago: ultimo,
    proximoVencimiento: cargo?.vencimiento || null,
    estado: cargo?.estado || null,
    historial,
    observacionFinanciera: alumno.observacionFinanciera || '',
    entrenadorId: alumno.coachId,
    modalidades: alumno.modalidades || [],
  };
}

/**
 * Registra un pago demo sobre un cargo.
 * Idempotente: rechaza si el cargo ya está paid/exempt o ya tiene pago.
 */
export function registrarPago(estado, actor, input) {
  if (!estado.finanzas) return { ok: false, error: 'finanzas_ausentes' };
  if (actor.rol !== 'coach') return { ok: false, error: 'solo_coach' };

  const cargoId = input.cargoId;
  const refs = validarReferencias(estado, {
    workspaceId: actor.workspaceId,
    coachId: actor.coachId,
    cargoId,
  });
  if (!refs.ok) return { ok: false, error: refs.error };

  const cargo = estado.finanzas.cargos.find((c) => c.id === cargoId);
  if (!cargo || !puedeVerCargo(actor, cargo)) {
    return { ok: false, error: 'sin_permiso' };
  }

  if (cargo.estado === 'paid') {
    return { ok: false, error: 'ya_pagado' };
  }
  if (cargo.estado === 'exempt') {
    return { ok: false, error: 'exento' };
  }

  const existentes = pagosDeCargo(estado, cargoId);
  if (existentes.length > 0) {
    return { ok: false, error: 'ya_pagado' };
  }

  const monto =
    input.monto == null ? Number(cargo.monto) : Number(input.monto);
  if (!Number.isFinite(monto) || monto < 0) {
    return { ok: false, error: 'monto_invalido' };
  }
  if (monto !== Number(cargo.monto)) {
    return { ok: false, error: 'monto_no_coincide' };
  }

  const medio = input.medio || cargo.medioPreferido || 'transferencia';
  if (!MEDIOS.has(medio) || medio === 'exento') {
    return { ok: false, error: 'medio_invalido' };
  }

  const fecha =
    input.fecha || estado.finanzas.fechaRef || FECHA_REF_DEMO;
  const pago = {
    id: nuevoId('pago', estado.finanzas.pagos),
    workspaceId: cargo.workspaceId,
    coachId: cargo.coachId,
    alumnoId: cargo.alumnoId,
    cargoId: cargo.id,
    monto,
    medio,
    fecha,
    comprobanteDemo:
      input.comprobanteDemo ||
      `COMP-DEMO-${String(estado.finanzas.pagos.length + 1).padStart(4, '0')}`,
  };

  estado.finanzas.pagos.push(pago);
  cargo.estado = 'paid';

  auditar(estado, {
    workspaceId: actor.workspaceId,
    coachId: actor.coachId,
    actorId: actor.coachId,
    accion: 'registrar_pago',
    detalle: `Pago ${pago.id} sobre ${cargo.id} · ${fmtClp(monto)} · ${medio}`,
    fecha: new Date(`${fecha}T12:00:00.000Z`).toISOString(),
  });

  return { ok: true, pago, cargo };
}

export function marcarTransferenciaRecibida(estado, actor, cargoId) {
  return registrarPago(estado, actor, {
    cargoId,
    medio: 'transferencia',
  });
}

export function cambiarPendienteAPagado(estado, actor, cargoId) {
  return registrarPago(estado, actor, { cargoId });
}

export function generarLinkPagoDemo(estado, actor, cargoId) {
  if (!estado.finanzas) return { ok: false, error: 'finanzas_ausentes' };
  if (actor.rol !== 'coach') return { ok: false, error: 'solo_coach' };

  const refs = validarReferencias(estado, {
    workspaceId: actor.workspaceId,
    coachId: actor.coachId,
    cargoId,
  });
  if (!refs.ok) return { ok: false, error: refs.error };

  const cargo = estado.finanzas.cargos.find((c) => c.id === cargoId);
  if (!cargo || !puedeVerCargo(actor, cargo)) {
    return { ok: false, error: 'sin_permiso' };
  }
  if (cargo.estado === 'paid' || cargo.estado === 'exempt') {
    return { ok: false, error: 'no_requerido' };
  }

  if (!Array.isArray(estado.finanzas.linksPagoDemo)) {
    estado.finanzas.linksPagoDemo = [];
  }
  const link = {
    id: nuevoId('link', estado.finanzas.linksPagoDemo),
    workspaceId: cargo.workspaceId,
    coachId: cargo.coachId,
    alumnoId: cargo.alumnoId,
    cargoId: cargo.id,
    url: `https://pago.demo.forja.local/${cargo.id}`,
    monto: cargo.monto,
    creadoEn: estado.finanzas.fechaRef || FECHA_REF_DEMO,
  };
  estado.finanzas.linksPagoDemo.push(link);
  cargo.medioPreferido = 'link_pago';

  auditar(estado, {
    workspaceId: actor.workspaceId,
    coachId: actor.coachId,
    actorId: actor.coachId,
    accion: 'generar_link_pago',
    detalle: `Link ficticio ${link.id} para ${cargo.id}`,
  });

  return { ok: true, link };
}

export function comprobanteDemo(estado, actor, pagoId) {
  const refs = validarReferencias(estado, {
    workspaceId: actor.workspaceId,
    pagoId,
    coachId: actor.rol === 'coach' ? actor.coachId : undefined,
  });
  if (!refs.ok) return { ok: false, error: refs.error };
  const pago = estado.finanzas.pagos.find((p) => p.id === pagoId);
  if (!pago || !puedeVerPago(actor, pago)) {
    return { ok: false, error: 'sin_permiso' };
  }
  return {
    ok: true,
    comprobante: {
      codigo: pago.comprobanteDemo,
      pagoId: pago.id,
      monto: pago.monto,
      montoFmt: fmtClp(pago.monto),
      medio: etiquetaMedioPago(pago.medio),
      fecha: pago.fecha,
      nota: 'Comprobante ficticio · no es un pago real',
    },
  };
}

export function sugerenciasFinancieras(estado, actor) {
  const alertas = calcularAlertas(estado, actor);
  const ind = calcularIndicadores(estado, actor);
  const out = [];

  out.push({
    id: 'fin-resumen',
    titulo: 'Resumen financiero del mes',
    detalle: `Proyectado ${fmtClp(ind.proyectado)} · Cobrado ${fmtClp(ind.cobrado)} · Pendiente ${fmtClp(ind.pendiente)} · Vencido ${fmtClp(ind.vencido)} · Recaudación ${ind.pctRecaudacion}%.`,
    evidencia: `Período ${ind.periodo} · solo cargos del coach en el workspace`,
    tipo: 'finanzas',
    estado: 'pendiente',
    requiereAprobacion: true,
  });

  const vencidos = alertas.filter((a) => a.tipo === 'pago_vencido');
  if (vencidos.length) {
    out.push({
      id: 'fin-vencidos',
      titulo: 'Listar pagos vencidos',
      detalle: vencidos.map((v) => v.mensaje).join(' · '),
      evidencia: `${vencidos.length} cargo(s) overdue`,
      tipo: 'finanzas',
      estado: 'pendiente',
      requiereAprobacion: true,
    });
    out.push({
      id: 'fin-contactar',
      titulo: 'Sugerir contactar alumnos con deuda',
      detalle:
        'Preparar contacto con alumnos en overdue. La IA no envía mensajes reales ni marca pagos.',
      evidencia: vencidos.map((v) => v.alumnoId).join(', '),
      tipo: 'finanzas',
      estado: 'pendiente',
      requiereAprobacion: true,
      borradorMensaje:
        'Hola, te escribo por el saldo pendiente de tu plan de este mes. ¿Podemos coordinar el pago esta semana?',
    });
  }

  const proximos = alertas.filter((a) => a.tipo === 'vence_7_dias');
  if (proximos.length) {
    out.push({
      id: 'fin-proximos',
      titulo: 'Próximos vencimientos (7 días)',
      detalle: proximos.map((v) => v.mensaje).join(' · '),
      evidencia: `${proximos.length} vencimiento(s) cercanos`,
      tipo: 'finanzas',
      estado: 'pendiente',
      requiereAprobacion: true,
    });
  }

  return out;
}

export function actorDesdeEstado(estado) {
  const s = estado.sesionDemo || {
    workspaceId: WS_FORJA,
    coachId: estado.coach?.id,
    rol: 'coach',
    alumnoId: null,
  };
  return {
    workspaceId: s.workspaceId,
    coachId: s.coachId,
    rol: s.rol || 'coach',
    alumnoId: s.alumnoId || null,
  };
}

export function filasTablaFinanzas(estado, actor, filtros = {}) {
  const grupos = new Map((estado.grupos || []).map((g) => [g.id, g]));
  const coaches = new Map();
  if (estado.coach) coaches.set(estado.coach.id, estado.coach.nombre);
  coaches.set('coach-laura', 'Laura Demo (aislamiento)');

  const filas = [];
  for (const alumno of alumnosVisibles(estado, actor)) {
    const cargo = cargoActualAlumno(estado, alumno.id);
    const plan = planPorId(estado, alumno.planId);
    const grupo = grupos.get(alumno.grupoId);
    const pagos = cargo
      ? pagosDeCargo(estado, cargo.id).filter((p) => puedeVerPago(actor, p))
      : [];
    const ultimo = pagos.sort((a, b) =>
      String(b.fecha).localeCompare(String(a.fecha)),
    )[0];

    const fila = {
      alumnoId: alumno.id,
      nombre: alumno.nombre,
      grupoId: alumno.grupoId,
      grupoNombre: grupo?.nombre || '—',
      modalidades: alumno.modalidades || [],
      planId: alumno.planId,
      planNombre: plan?.nombre || 'Sin plan',
      valorPlan: plan ? plan.valorMensual : null,
      vencimiento: cargo?.vencimiento || null,
      estado: cargo?.estado || (alumno.planId ? 'pending' : 'sin_plan'),
      medio: ultimo?.medio || cargo?.medioPreferido || null,
      coachId: alumno.coachId,
      coachNombre: coaches.get(alumno.coachId) || alumno.coachId,
      cargoId: cargo?.id || null,
    };

    if (filtros.estado && fila.estado !== filtros.estado) continue;
    if (filtros.grupoId && fila.grupoId !== filtros.grupoId) continue;
    if (filtros.modalidad) {
      if (!(fila.modalidades || []).includes(filtros.modalidad)) continue;
    }
    if (filtros.coachId && fila.coachId !== filtros.coachId) continue;
    if (filtros.texto) {
      const t = String(filtros.texto).trim().toLowerCase();
      if (t && !fila.nombre.toLowerCase().includes(t)) continue;
    }
    filas.push(fila);
  }
  return filas;
}
