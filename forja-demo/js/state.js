import { STORAGE_KEY, estadoInicial } from './data.js';

let estado = null;
const listeners = new Set();

export function cargarEstado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) {
        estado = parsed;
        return estado;
      }
    }
  } catch {
    /* demo: ignorar corrupción y resetear */
  }
  estado = estadoInicial();
  guardarEstado();
  return estado;
}

export function obtenerEstado() {
  if (!estado) return cargarEstado();
  return estado;
}

export function guardarEstado() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  for (const fn of listeners) fn(estado);
}

export function mutar(fn) {
  const e = obtenerEstado();
  fn(e);
  guardarEstado();
  return e;
}

export function suscribir(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function restablecerDemo() {
  estado = estadoInicial();
  guardarEstado();
  return estado;
}

export function alumnoPorId(id) {
  return obtenerEstado().alumnos.find((a) => a.id === id) || null;
}

export function grupoPorId(id) {
  return obtenerEstado().grupos.find((g) => g.id === id) || null;
}

export function ejercicioPorId(id) {
  return obtenerEstado().ejercicios.find((e) => e.id === id) || null;
}
