import { FECHA_DEMO, addDays, weekdayEs, dayNum, parseFecha } from './dates.js';
import { normalizar } from './intent.js';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function etiquetaDia(rel, fechaRef = FECHA_DEMO) {
  const fecha = fechaDeRel(rel, fechaRef);
  const wd = weekdayEs(fecha).toLowerCase();
  const n = dayNum(fecha);
  if (rel === 'hoy') return `hoy ${wd} ${n}`;
  if (rel === 'mañana' || rel === 'manana') return `mañana ${wd} ${n}`;
  return `${wd} ${n}`;
}

export function fechaDeRel(rel, fechaRef = FECHA_DEMO) {
  if (rel === 'hoy') return parseFecha(fechaRef);
  if (rel === 'mañana' || rel === 'manana') return addDays(fechaRef, 1);
  const idx = DIAS.findIndex((d) => normalizar(d) === normalizar(rel));
  if (idx < 0) return parseFecha(fechaRef);
  const start = parseFecha(fechaRef);
  const today = start.getUTCDay(); // 0 sun
  const want = idx + 1; // Lunes=1
  let delta = (want - today + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(fechaRef, delta);
}

export function diaSemanaDeRel(rel, fechaRef = FECHA_DEMO) {
  if (rel === 'hoy') return weekdayEs(fechaRef);
  if (rel === 'mañana' || rel === 'manana') return weekdayEs(addDays(fechaRef, 1));
  const hit = DIAS.find((d) => normalizar(d) === normalizar(rel));
  return hit || null;
}

export function extraerRelDia(texto) {
  const t = normalizar(texto);
  if (!t) return null;
  if (/(^|\s)hoy(\s|$)/.test(t) || t === 'hoy') return 'hoy';
  if (t.includes('manana') || t.includes('mañana')) return 'mañana';
  if (t.includes('otro dia') || t === 'otro') return 'otro';
  for (const d of DIAS) {
    if (t.includes(normalizar(d))) return d;
  }
  return null;
}

export function disciplinasDe(clases) {
  const seen = [];
  for (const c of clases || []) {
    if (c.accesoLibre || c.conHora) continue;
    if (!seen.includes(c.nombre)) seen.push(c.nombre);
  }
  return seen.slice(0, 6);
}

export function extraerDisciplina(texto, clases) {
  const t = normalizar(texto);
  const nombres = [...new Set((clases || []).map((c) => c.nombre))];
  const ordered = nombres.sort((a, b) => b.length - a.length);
  for (const n of ordered) {
    if (t.includes(normalizar(n))) return n;
  }
  return null;
}

export function filtrarClases(clases, { sede, dia, disciplina } = {}) {
  return (clases || []).filter((c) => {
    if (sede && c.sede !== sede) return false;
    if (dia && c.dia !== dia) return false;
    if (disciplina && c.nombre !== disciplina) return false;
    return true;
  });
}

export function lineaHorario(c) {
  if (c.accesoLibre) return `${c.hora} · acceso libre, sin reserva`;
  if (c.conHora) return 'Se atiende con hora. El equipo coordina.';
  const libres = Math.max(0, (c.capacity || 0) - (c.reserved || 0));
  const cupo = c.agotada || libres === 0 ? 'completa' : `${libres} cupos libres`;
  return `${c.hora} · ${c.entrenador} · ${cupo}`;
}

export function paginar(items, offset = 0, size = 6) {
  const slice = items.slice(offset, offset + size);
  return { slice, hayMas: offset + size < items.length, next: offset + size };
}

export function agruparPlanes(planes) {
  const fam = (p) => {
    const id = String(p.id || p.nombre || '').toLowerCase();
    if (id.includes('kid')) return 'Kids';
    return 'Planes';
  };
  const groups = [];
  const map = new Map();
  for (const p of planes || []) {
    const k = fam(p);
    if (!map.has(k)) {
      const g = { familia: k, items: [] };
      map.set(k, g);
      groups.push(g);
    }
    map.get(k).items.push(p);
  }
  return groups;
}
