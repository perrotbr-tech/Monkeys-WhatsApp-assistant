/** Membresías y pagos demo coherentes con planes y fecha de referencia. */

import { addDays, dayKey } from '../engine/dates.js';
import { montoDelPlan, diasPeriodo } from '../engine/membresias.js';

function planDe(plans, socio) {
  return (plans || []).find((p) => p.id === socio.planId) || plans[0];
}

function pago({ tenantId, id, socio, mem, plan, estado, medio, fechaRef, offset }) {
  return {
    tenantId,
    id,
    socioId: socio.id,
    membresiaId: mem.id,
    planId: plan.id,
    monto: montoDelPlan(plan),
    estado,
    referencia: estado === 'pagada' ? `TR-DEMO-${id}` : null,
    medio: medio || (estado === 'pagada' ? 'transferencia' : 'transferencia'),
    periodoInicio: mem.inicio,
    periodoFin: mem.fin,
    fechaISO: addDays(fechaRef, offset || 0).toISOString(),
    linkUrl: null,
    linkReferencia: null,
    concepto: plan.nombre,
  };
}

/**
 * Distribución:
 * monkeys (40 activos): vigentes, por vencer (≤7), vencidas (>15), pausadas.
 * soma (20): 4 por vencer esta semana, 3 vencidas >15, resto vigente.
 */
export function crearMembresiasYPagos(socios, plans, fechaRef, tenantId) {
  const membresias = [];
  const pagos = [];
  let mSeq = 1;
  let pSeq = 1;
  const lista = socios || [];

  for (let i = 0; i < lista.length; i += 1) {
    const socio = lista[i];
    const plan = planDe(plans, socio);
    const periodo = diasPeriodo(plan);
    let offsetFin;
    let estado = 'vigente';
    let pagoEstado = 'pagada';
    if (socio.estado === 'baja') {
      offsetFin = -40;
      estado = 'vencida';
      pagoEstado = 'vencida';
    } else if (tenantId === 'soma') {
      if (i >= 13 && i <= 16) {
        offsetFin = [1, 3, 5, 7][i - 13];
        pagoEstado = 'pendiente';
      } else if (i >= 17 && i <= 19) {
        offsetFin = -20 - (i - 17) * 5;
        estado = 'vencida';
        pagoEstado = 'vencida';
      } else {
        offsetFin = Math.max(12, periodo - 10);
      }
    } else {
      const idx = lista.filter((s) => s.estado !== 'baja').indexOf(socio);
      if (idx >= 0 && idx <= 27) offsetFin = Math.max(12, periodo - 8);
      else if (idx >= 28 && idx <= 31) {
        offsetFin = [2, 4, 6, 7][idx - 28];
        pagoEstado = 'pendiente';
      } else if (idx >= 32 && idx <= 35) {
        offsetFin = -18 - (idx - 32) * 4;
        estado = 'vencida';
        pagoEstado = 'vencida';
      } else if (idx >= 36) {
        offsetFin = Math.max(20, periodo - 5);
        estado = 'pausada';
        pagoEstado = 'pagada';
      } else {
        offsetFin = 20;
      }
    }
    const fin = dayKey(addDays(fechaRef, offsetFin));
    const inicio = dayKey(addDays(fin, -periodo));
    const mem = {
      tenantId,
      id: `mem-${tenantId}-${mSeq}`,
      socioId: socio.id,
      planId: plan.id,
      inicio,
      fin,
      estado,
    };
    mSeq += 1;
    membresias.push(mem);
    const p = pago({
      tenantId,
      id: `pago-${tenantId}-${pSeq}`,
      socio,
      mem,
      plan,
      estado: pagoEstado,
      fechaRef,
      offset: Math.min(0, offsetFin),
    });
    if (idxRechazo(tenantId, i)) {
      p.estado = 'rechazada';
      p.referencia = null;
    }
    pSeq += 1;
    pagos.push(p);
  }

  return {
    membresias,
    pagos,
    nextMembresiaSeq: mSeq,
    nextPagoSeq: pSeq,
  };
}

function idxRechazo(tenantId, i) {
  return tenantId === 'monkeys' && i === 10;
}
