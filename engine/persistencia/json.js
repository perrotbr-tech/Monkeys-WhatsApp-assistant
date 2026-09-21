/**
 * Adaptador JSON: escritura atómica (temp → rename) y ruta inyectable.
 */

import {
  existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fechaHoy } from '../dates.js';
import { relojActivo } from '../clock.js';
import { CARGA, PersistenciaError, CODIGOS } from './estados.js';
import { crearWorldSnapshotV1 } from './snapshots.js';
import { parsearJsonSeguro, resolverCarga, bootstrapMundo } from './cargar.js';

/**
 * @param {{ filePath: string, clock?: object, fechaRef?: string }} opts
 */
export function crearAdaptadorJson(opts) {
  if (!opts || !opts.filePath) {
    throw new PersistenciaError(CODIGOS.ESCRITURA, 'filePath requerido');
  }
  const filePath = opts.filePath;
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  let ultimoError = null;
  let cargaActual = null;

  function leerTexto() {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, 'utf8');
  }

  /**
   * Escritura segura: serializa completo a temporal del mismo directorio
   * y solo entonces reemplaza el archivo definitivo.
   * @param {object} world
   */
  function escribirAtomico(world) {
    const snap = crearWorldSnapshotV1(world);
    let serialized;
    try {
      serialized = `${JSON.stringify(snap, null, 2)}\n`;
      JSON.parse(serialized);
    } catch (err) {
      throw new PersistenciaError(CODIGOS.ESCRITURA, 'serialización inválida', { cause: err });
    }
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });
    const tmpPath = join(dir, `.${basename(filePath)}.${process.pid}.${clock.now()}.tmp`);
    try {
      writeFileSync(tmpPath, serialized, 'utf8');
      renameSync(tmpPath, filePath);
    } catch (err) {
      try { if (existsSync(tmpPath)) unlinkSync(tmpPath); } catch { /* ignore cleanup */ }
      throw new PersistenciaError(CODIGOS.ESCRITURA, 'fallo escritura atómica', { cause: err });
    }
    return snap;
  }

  function cargar() {
    ultimoError = null;
    const text = leerTexto();
    const parsed = parsearJsonSeguro(text);
    if (parsed.status === CARGA.CORRUPTO) {
      ultimoError = parsed.error;
      cargaActual = { status: CARGA.CORRUPTO, error: parsed.error };
      return cargaActual;
    }
    const value = parsed.status === CARGA.VACIO ? null : parsed.value;
    const resolved = resolverCarga(value, { kind: 'world', fechaRef, clock });
    if (resolved.status === CARGA.CORRUPTO) {
      ultimoError = resolved.error;
      cargaActual = resolved;
      return resolved;
    }
    if (resolved.bootstrapped || resolved.migrated) {
      try {
        escribirAtomico(resolved.world);
      } catch (err) {
        ultimoError = err;
        cargaActual = {
          status: CARGA.CORRUPTO,
          error: err instanceof PersistenciaError
            ? err
            : new PersistenciaError(CODIGOS.ESCRITURA, 'no se pudo persistir bootstrap/migración', { cause: err }),
        };
        return cargaActual;
      }
    }
    cargaActual = resolved;
    return resolved;
  }

  function guardar(world) {
    const snap = escribirAtomico(world);
    cargaActual = {
      status: CARGA.V1_VALIDO,
      snapshot: snap,
      world: snap,
      migrated: false,
      bootstrapped: false,
    };
    return snap;
  }

  /** Reset explícito: reemplaza con demo V1. */
  function reset() {
    const world = bootstrapMundo({ fechaRef, clock });
    return guardar(world);
  }

  return {
    kind: 'json',
    filePath,
    cargar,
    guardar,
    reset,
    leerTexto,
    existe: () => existsSync(filePath),
    ultimoError: () => ultimoError,
    cargaActual: () => cargaActual,
    _escribirAtomico: escribirAtomico,
  };
}
