import { STORAGE_KEY, estadoInicial } from './data.js';
import {
  asegurarV2,
  esEstadoCorroto,
  CLAVE_FORJA_DEMO,
  CLAVES_GESTION_PROHIBIDAS,
} from './finanzas/migracion.js';

let estado = null;
let documentoCorrupto = false;
const listeners = new Set();

export function hayDocumentoCorrupto() {
  return documentoCorrupto;
}

export function cargarEstado() {
  documentoCorrupto = false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (esEstadoCorroto(parsed)) {
        documentoCorrupto = true;
        estado = null;
        return null;
      }
      const res = asegurarV2(parsed);
      if (!res.ok) {
        documentoCorrupto = true;
        estado = null;
        return null;
      }
      estado = res.doc;
      if (res.migrado) guardarEstado();
      return estado;
    }
  } catch {
    documentoCorrupto = true;
    estado = null;
    return null;
  }
  estado = estadoInicial();
  guardarEstado();
  return estado;
}

export function obtenerEstado() {
  if (!estado) {
    if (documentoCorrupto) return null;
    return cargarEstado();
  }
  return estado;
}

export function guardarEstado() {
  if (!estado) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  for (const fn of listeners) fn(estado);
}

export function mutar(fn) {
  const e = obtenerEstado();
  if (!e) return null;
  fn(e);
  guardarEstado();
  return e;
}

export function suscribir(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Restablece solamente la clave de forja-demo.
 * No toca claves de Forkza Gestión.
 */
export function restablecerDemo() {
  for (const k of CLAVES_GESTION_PROHIBIDAS) {
    /* no borrar — aislamiento explícito */
    void k;
  }
  localStorage.removeItem(CLAVE_FORJA_DEMO);
  if (STORAGE_KEY !== CLAVE_FORJA_DEMO) {
    localStorage.removeItem(STORAGE_KEY);
  }
  documentoCorrupto = false;
  estado = estadoInicial();
  guardarEstado();
  return estado;
}

export function alumnoPorId(id) {
  const e = obtenerEstado();
  if (!e) return null;
  return e.alumnos.find((a) => a.id === id) || null;
}

export function grupoPorId(id) {
  const e = obtenerEstado();
  if (!e) return null;
  return e.grupos.find((g) => g.id === id) || null;
}

export function ejercicioPorId(id) {
  const e = obtenerEstado();
  if (!e) return null;
  return e.ejercicios.find((eje) => eje.id === id) || null;
}
