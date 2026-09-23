/**
 * Adaptador localStorage: TenantSnapshotV1 por clave, con migración de clave legacy.
 */

import { fechaHoy } from '../dates.js';
import { relojActivo } from '../clock.js';
import { listarTenants } from '../../data/tenants.js';
import { CARGA, PersistenciaError, CODIGOS } from './estados.js';
import { sliceDe, SCHEMA_VERSION, mundoRuntimeDesdeSnapshot } from './snapshots.js';
import {
  claveEstadoV1, resolverClaveLocal, clavesLegacyLocal,
} from './migraciones.js';
import {
  parsearJsonSeguro, resolverCarga, bootstrapTenant, bootstrapMundo, componerMundo,
} from './cargar.js';
import {
  assertTenantEscritura,
  envelopeTenantEscritura,
  prepararMundoParaEscritura,
} from './escritura.js';

export { assertTenantEscritura };

/**
 * @param {{ storage: Storage, clock?: object, fechaRef?: string, tenantIds?: string[] }} opts
 */
export function crearAdaptadorLocal(opts) {
  if (!opts || !opts.storage) {
    throw new PersistenciaError(CODIGOS.ESCRITURA, 'storage requerido');
  }
  const storage = opts.storage;
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const tenantIds = opts.tenantIds || listarTenants().map((t) => t.id);
  let ultimoError = null;
  let cargaActual = null;

  function escribirTenant(tenantId, sliceOrSnap) {
    const snap = envelopeTenantEscritura(tenantId, sliceOrSnap);
    let serialized;
    try {
      serialized = JSON.stringify(snap);
      JSON.parse(serialized);
    } catch (err) {
      throw new PersistenciaError(CODIGOS.ESCRITURA, 'serialización local inválida', { cause: err });
    }
    const key = claveEstadoV1(tenantId);
    storage.setItem(key, serialized);
    for (const legacyKey of clavesLegacyLocal(tenantId)) {
      if (storage.getItem(legacyKey) != null) storage.removeItem(legacyKey);
    }
    return snap;
  }

  /**
   * Carga un tenant. Vacío → bootstrap; V0 → migra; V1 → usa; corrupto → error sin sobrescribir.
   * @param {string} tenantId
   */
  function cargarTenant(tenantId) {
    ultimoError = null;
    const { raw, legacy } = resolverClaveLocal(storage, tenantId);
    const parsed = parsearJsonSeguro(raw);
    if (parsed.status === CARGA.CORRUPTO) {
      ultimoError = parsed.error;
      const result = { status: CARGA.CORRUPTO, error: parsed.error, tenantId };
      cargaActual = result;
      return result;
    }
    const value = parsed.status === CARGA.VACIO ? null : parsed.value;
    const resolved = resolverCarga(value, { kind: 'tenant', tenantId, fechaRef, clock });
    if (resolved.status === CARGA.CORRUPTO) {
      ultimoError = resolved.error;
      cargaActual = { ...resolved, tenantId };
      return cargaActual;
    }
    if (resolved.bootstrapped || resolved.migrated || legacy) {
      try {
        escribirTenant(tenantId, resolved.snapshot);
      } catch (err) {
        ultimoError = err;
        cargaActual = {
          status: CARGA.CORRUPTO,
          tenantId,
          error: err instanceof PersistenciaError
            ? err
            : new PersistenciaError(CODIGOS.ESCRITURA, 'no se pudo persistir tenant', { cause: err }),
        };
        return cargaActual;
      }
    }
    cargaActual = { ...resolved, tenantId, legacyMigrated: Boolean(legacy) };
    return cargaActual;
  }

  function guardarTenant(tenantId, slice) {
    const snap = escribirTenant(tenantId, slice);
    cargaActual = {
      status: CARGA.V3_VALIDO,
      tenantId,
      snapshot: snap,
      slice: sliceDe(snap, tenantId),
      migrated: false,
      bootstrapped: false,
    };
    return snap;
  }

  /** Carga el mundo componiendo workspaces; bootstrap por workspace vacío. */
  function cargar() {
    ultimoError = null;
    const byTenant = {};
    let bootstrapped = false;
    let migrated = false;
    for (const id of tenantIds) {
      const r = cargarTenant(id);
      if (r.status === CARGA.CORRUPTO) {
        cargaActual = r;
        return r;
      }
      byTenant[id] = r.slice;
      if (r.bootstrapped) bootstrapped = true;
      if (r.migrated || r.legacyMigrated) migrated = true;
    }
    const worldSnap = componerMundo(byTenant);
    cargaActual = {
      status: bootstrapped ? CARGA.VACIO : (migrated ? CARGA.V0_MIGABLE : CARGA.V3_VALIDO),
      world: mundoRuntimeDesdeSnapshot(worldSnap),
      snapshot: worldSnap,
      bootstrapped,
      migrated,
    };
    return cargaActual;
  }

  function guardar(world) {
    // Validar original antes de cualquier normalización; V3 inválido no se sanitiza
    const snap = prepararMundoParaEscritura(world);
    const map = snap.byWorkspace || {};
    for (const [id, slice] of Object.entries(map)) {
      escribirTenant(id, {
        schemaVersion: SCHEMA_VERSION,
        workspaceId: id,
        tenantId: id,
        data: slice,
      });
    }
    cargaActual = {
      status: CARGA.V3_VALIDO,
      world: mundoRuntimeDesdeSnapshot(snap),
      snapshot: snap,
      migrated: false,
      bootstrapped: false,
    };
    return snap;
  }

  function reset(tenantId) {
    if (tenantId) {
      const snap = bootstrapTenant(tenantId, { fechaRef, clock });
      return guardarTenant(tenantId, snap);
    }
    const world = bootstrapMundo({ fechaRef, clock });
    return guardar(world);
  }

  function leerTextoTenant(tenantId) {
    const primary = storage.getItem(claveEstadoV1(tenantId));
    if (primary != null) return primary;
    for (const legacyKey of clavesLegacyLocal(tenantId)) {
      const raw = storage.getItem(legacyKey);
      if (raw != null) return raw;
    }
    return null;
  }

  return {
    kind: 'localStorage',
    storage,
    cargar,
    guardar,
    reset,
    cargarTenant,
    guardarTenant,
    leerTextoTenant,
    claveDe: claveEstadoV1,
    ultimoError: () => ultimoError,
    cargaActual: () => cargaActual,
  };
}

export { claveEstadoV1 };
