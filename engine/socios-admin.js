/** Alta, edición, baja, reactivación e importación CSV de socios. */

import { dayKey } from './dates.js';
import { normalizarTelefono, nombreValido } from './identidad.js';

export const PLANTILLA_CSV_SOCIOS = 'nombre,telefono,email,plan,fechaInicio,sede\n';

export function parseCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => String(h || '').trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] == null ? '' : String(cols[idx]).trim(); });
    obj._fila = i + 1;
    rows.push(obj);
  }
  return { headers, rows };
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i += 1; }
      else q = !q;
    } else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function matchPlan(plans, raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  return (plans || []).find((p) => p.id.toLowerCase() === key || String(p.nombre || '').toLowerCase() === key) || null;
}

export function matchSede(sedes, raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  const hit = (sedes || []).find((s) => String(s.nombre || s).toLowerCase() === key || String(s.id || '').toLowerCase() === key);
  return hit ? (hit.nombre || hit) : null;
}

export function validarFilaSocio(row, { plans, sedes, telefonos }) {
  const errores = [];
  if (!nombreValido(row.nombre)) errores.push('nombre inválido');
  const tel = normalizarTelefono(row.telefono);
  if (!tel) errores.push('teléfono inválido');
  else if (telefonos && telefonos.has(tel)) errores.push('teléfono duplicado');
  const plan = matchPlan(plans, row.plan);
  if (!plan) errores.push('plan inexistente');
  const sede = matchSede(sedes, row.sede);
  if (!sede) errores.push('sede inexistente');
  const fecha = String(row.fechainicio || row.fechaInicio || '').trim();
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errores.push('fechaInicio inválida');
  const email = String(row.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push('email inválido');
  return {
    ok: errores.length === 0,
    errores,
    datos: {
      nombre: String(row.nombre || '').trim(),
      telefono: tel,
      email: email || null,
      planId: plan ? plan.id : null,
      fechaInicio: fecha || null,
      sedeId: sede,
    },
  };
}

export function prepararSocio(tenantId, id, datos, fechaRef) {
  return {
    tenantId,
    id,
    nombre: datos.nombre,
    telefono: datos.telefono,
    email: datos.email || null,
    sedeId: datos.sedeId,
    planId: datos.planId,
    claseFavorita: datos.claseFavorita || null,
    fechaIngreso: datos.fechaInicio || dayKey(fechaRef),
    estado: 'activo',
    fechaBaja: null,
    motivoBaja: null,
    cuposUsadosMes: datos.cuposUsadosMes || 0,
  };
}
