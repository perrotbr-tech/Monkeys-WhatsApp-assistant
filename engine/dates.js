/** Utilidades de fecha UTC (sin DOM). */

export const FECHA_DEMO = '2026-09-11';

export function parseFecha(ref) {
  if (ref instanceof Date) {
    return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 12, 0, 0));
  }
  const s = String(ref || FECHA_DEMO).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDays(ref, n) {
  const d = parseFecha(ref);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

export function dayKey(ref) {
  return parseFecha(ref).toISOString().slice(0, 10);
}

export function daysAgo(visitISO, fechaRef) {
  const v = parseFecha(visitISO);
  const e = parseFecha(fechaRef);
  return Math.round((e - v) / 86400000);
}

/** Ventana (fechaRef - days, fechaRef], en días calendario. */
export function enVentana(visitISO, fechaRef, days) {
  const ago = daysAgo(visitISO, fechaRef);
  return ago >= 0 && ago < days;
}
