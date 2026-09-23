import {
  STORAGE_KEY,
  STATE_VERSION,
  estadoInicial,
  migrarEstadoV1aV2,
} from './data.js';

let estado = null;
const listeners = new Set();

/**
 * Carga estado desde localStorage exclusivo de forja-demo.
 * - v2: usa directo.
 * - v1: migra a v2 preservando datos deportivos y agregando Finanzas.
 * - corrupto / versión desconocida: NO sobrescribe la clave; marca corrupto
 *   hasta acción explícita restablecerDemo().
 */
export function cargarEstado() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === STATE_VERSION && parsed.finanzas) {
        estado = parsed;
        return estado;
      }
      if (parsed && parsed.version === 1) {
        estado = migrarEstadoV1aV2(parsed);
        guardarEstado();
        return estado;
      }
      estado = { corrupto: true, version: parsed?.version ?? null };
      return estado;
    }
  } catch {
    estado = { corrupto: true, version: null };
    return estado;
  }
  estado = estadoInicial();
  guardarEstado();
  return estado;
}

export function obtenerEstado() {
  if (!estado) return cargarEstado();
  return estado;
}

export function esEstadoCorrupto() {
  const e = obtenerEstado();
  return Boolean(e && e.corrupto);
}

export function guardarEstado() {
  if (!estado || estado.corrupto) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  for (const fn of listeners) fn(estado);
}

export function mutar(fn) {
  const e = obtenerEstado();
  if (e.corrupto) return e;
  fn(e);
  guardarEstado();
  return e;
}

export function suscribir(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Restablece únicamente la clave forja-demo (no toca Forkza Gestión). */
export function restablecerDemo() {
  estado = estadoInicial();
  guardarEstado();
  return estado;
}

export function alumnoPorId(id) {
  return obtenerEstado().alumnos?.find((a) => a.id === id) || null;
}

export function grupoPorId(id) {
  return obtenerEstado().grupos?.find((g) => g.id === id) || null;
}

export function ejercicioPorId(id) {
  return obtenerEstado().ejercicios?.find((e) => e.id === id) || null;
}

/** Claves de Gestión que NO deben usarse ni borrarse desde forja-demo. */
export const CLAVES_GESTION_PROHIBIDAS = Object.freeze([
  'monkeys_demo_state',
  'forkza_demo_state',
  'soma_demo_state',
]);
