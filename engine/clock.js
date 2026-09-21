/**
 * Contrato Clock: instante inyectable para eliminar no-determinismo del reloj real.
 * Producción usa el reloj del sistema por defecto; las pruebas fijan o simulan el instante.
 */

function toMs(instant) {
  if (typeof instant === 'number' && Number.isFinite(instant)) return instant;
  if (instant instanceof Date) {
    const ms = instant.getTime();
    if (!Number.isFinite(ms)) throw new Error('clock_invalid_instant');
    return ms;
  }
  const ms = new Date(instant).getTime();
  if (!Number.isFinite(ms)) throw new Error('clock_invalid_instant');
  return ms;
}

/** Reloj de producción: delega en Date/Date.now del entorno. */
export function crearRelojSistema() {
  return Object.freeze({
    now: () => Date.now(),
    date: () => new Date(),
    iso: () => new Date().toISOString(),
  });
}

/** Reloj fijo: siempre el mismo instante (pruebas determinísticas). */
export function crearRelojFijo(instant) {
  const ms = toMs(instant);
  return Object.freeze({
    now: () => ms,
    date: () => new Date(ms),
    iso: () => new Date(ms).toISOString(),
  });
}

/**
 * Reloj simulado: parte de un instante y puede avanzar (bloqueos, caducidad).
 * @returns {{ now: Function, date: Function, iso: Function, avanzar: Function, fijar: Function }}
 */
export function crearRelojSimulado(instant = 0) {
  let ms = toMs(instant);
  return {
    now: () => ms,
    date: () => new Date(ms),
    iso: () => new Date(ms).toISOString(),
    avanzar(deltaMs) {
      ms += Number(deltaMs) || 0;
      return ms;
    },
    fijar(next) {
      ms = toMs(next);
      return ms;
    },
  };
}

const SISTEMA = crearRelojSistema();
let activo = SISTEMA;

/** Reloj actualmente usado por fechaHoy, auth y timestamps por defecto. */
export function relojActivo() {
  return activo;
}

/**
 * Sustituye el reloj por defecto. Pasa null/undefined para restaurar el sistema.
 * @returns {object} reloj anterior
 */
export function usarReloj(clock) {
  const prev = activo;
  activo = clock || SISTEMA;
  return prev;
}

function esThenable(value) {
  return value != null
    && (typeof value === 'object' || typeof value === 'function')
    && typeof value.then === 'function';
}

/**
 * Ejecuta fn con un reloj temporal y restaura el anterior.
 * Si fn devuelve una Promise, el reloj se conserva hasta que termine (resolve o reject).
 * Soporta llamadas anidadas: cada nivel restaura el reloj que encontró al entrar.
 */
export function conReloj(clock, fn) {
  const prev = usarReloj(clock);
  try {
    const result = fn();
    if (esThenable(result)) {
      return Promise.resolve(result).finally(() => {
        usarReloj(prev);
      });
    }
    usarReloj(prev);
    return result;
  } catch (err) {
    usarReloj(prev);
    throw err;
  }
}
