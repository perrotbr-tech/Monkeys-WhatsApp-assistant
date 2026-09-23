/** Reglas de membresía: crear, extender, vencer. Sin DOM ni I/O. */

import { addDays, dayKey, diffDays } from './dates.js';

export const ESTADOS_MEMBRESIA = Object.freeze(['vigente', 'vencida', 'pausada']);

export function diasPeriodo(plan) {
  const p = (plan && plan.periodo) || 'mensual';
  if (p === 'trimestral') return 90;
  if (p === 'pase') return 1;
  if (p === 'anual') return 365;
  return 30;
}

export function montoDelPlan(plan) {
  if (!plan) return 0;
  if (Number.isFinite(plan.monto)) return plan.monto;
  const digits = String(plan.precio || '').replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

export function estadoMembresia(mem, fechaRef) {
  if (!mem) return null;
  if (mem.estado === 'pausada') return 'pausada';
  if (diffDays(mem.fin, fechaRef) < 0) return 'vencida';
  return 'vigente';
}

export function refrescarMembresia(mem, fechaRef) {
  const estado = estadoMembresia(mem, fechaRef);
  return { ...mem, estado };
}

export function venceEnDias(mem, fechaRef, max = 7) {
  if (!mem || mem.estado === 'pausada') return false;
  const d = diffDays(mem.fin, fechaRef);
  return d >= 0 && d <= max;
}

export function vencidaMasDe(mem, fechaRef, dias = 15) {
  if (!mem || mem.estado === 'pausada') return false;
  const d = diffDays(fechaRef, mem.fin);
  return d > dias;
}

export function crearMembresia({ tenantId, workspaceId, id, socioId, planId, inicio, plan, fechaRef }) {
  const start = dayKey(inicio || fechaRef);
  const fin = dayKey(addDays(start, diasPeriodo(plan)));
  const ws = workspaceId || tenantId;
  return {
    workspaceId: ws,
    tenantId: ws,
    id,
    socioId,
    planId: planId || (plan && plan.id),
    inicio: start,
    fin,
    estado: 'vigente',
  };
}

export function extenderMembresia(mem, plan, fechaRef) {
  const base = diffDays(mem.fin, fechaRef) >= 0 ? mem.fin : dayKey(fechaRef);
  const fin = dayKey(addDays(base, diasPeriodo(plan)));
  const inicio = mem.inicio || dayKey(fechaRef);
  return {
    ...mem,
    fin,
    inicio,
    estado: 'vigente',
    planId: (plan && plan.id) || mem.planId,
  };
}

export function membresiaVigenteDe(membresias, socioId, fechaRef) {
  const rows = (membresias || []).filter((m) => m.socioId === socioId);
  const vigentes = rows
    .map((m) => refrescarMembresia(m, fechaRef))
    .filter((m) => m.estado === 'vigente');
  if (vigentes.length) return vigentes.sort((a, b) => (a.fin < b.fin ? 1 : -1))[0];
  const otras = rows.map((m) => refrescarMembresia(m, fechaRef));
  return otras.sort((a, b) => (a.fin < b.fin ? 1 : -1))[0] || null;
}
