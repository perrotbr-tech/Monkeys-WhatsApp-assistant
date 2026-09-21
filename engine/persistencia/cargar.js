/**
 * Clasificación de carga y resolución segura (vacío / V0 / V1 / corrupto).
 */

import { clonar, clonarMundo, clonarDemo } from '../../data/demo.js';
import { listarTenants } from '../../data/tenants.js';
import { fechaHoy } from '../dates.js';
import { relojActivo } from '../clock.js';
import { CARGA, PersistenciaError, CODIGOS } from './estados.js';
import {
  SCHEMA_VERSION,
  crearWorldSnapshotV1,
  crearTenantSnapshotV1,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  sliceDe,
} from './snapshots.js';
import { migrateV0toV1 } from './migraciones.js';

/**
 * Parsea texto JSON. Fallo de parse → corrupto (no demo).
 * @param {string|null|undefined} text
 * @returns {{ status: string, value?: object, error?: PersistenciaError }}
 */
export function parsearJsonSeguro(text) {
  if (text == null || text === '') {
    return { status: CARGA.VACIO };
  }
  if (typeof text !== 'string') {
    return {
      status: CARGA.CORRUPTO,
      error: new PersistenciaError(CODIGOS.CORRUPTO, 'contenido no textual'),
    };
  }
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object') {
      return {
        status: CARGA.CORRUPTO,
        error: new PersistenciaError(CODIGOS.CORRUPTO, 'JSON raíz no es objeto'),
      };
    }
    return { status: 'parsed', value };
  } catch (err) {
    return {
      status: CARGA.CORRUPTO,
      error: new PersistenciaError(CODIGOS.CORRUPTO, 'JSON inválido', { cause: err }),
    };
  }
}

/**
 * @param {unknown} value
 * @param {'world'|'tenant'} kind
 * @returns {typeof CARGA[keyof typeof CARGA]}
 */
export function clasificarDocumento(value, kind) {
  if (value == null) return CARGA.VACIO;
  if (typeof value !== 'object' || Array.isArray(value)) return CARGA.CORRUPTO;

  const version = value.schemaVersion;
  if (version != null && version !== SCHEMA_VERSION) {
    return CARGA.CORRUPTO;
  }

  if (kind === 'world') {
    if (version === SCHEMA_VERSION) {
      if (Object.prototype.hasOwnProperty.call(value, 'data')) return CARGA.CORRUPTO;
      return esWorldSnapshotV1(value) ? CARGA.V1_VALIDO : CARGA.CORRUPTO;
    }
    if (value.byTenant && typeof value.byTenant === 'object' && !Array.isArray(value.byTenant)) {
      if (Object.prototype.hasOwnProperty.call(value, 'data') && value.data != null) {
        return CARGA.CORRUPTO;
      }
      return CARGA.V0_MIGABLE;
    }
    return CARGA.CORRUPTO;
  }

  // tenant
  if (version === SCHEMA_VERSION) {
    if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
    return esTenantSnapshotV1(value) ? CARGA.V1_VALIDO : CARGA.CORRUPTO;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
  // V0 tenant = slice plano (sin schemaVersion)
  return CARGA.V0_MIGABLE;
}

/**
 * Resuelve un documento ya parseado a snapshot V1, bootstrap o error.
 * Nunca reemplaza datos corruptos con demo.
 *
 * @param {object|null|undefined} value
 * @param {{ kind: 'world'|'tenant', tenantId?: string, fechaRef?: string, clock?: object }} opts
 * @returns {{
 *   status: string,
 *   snapshot?: object,
 *   world?: object,
 *   slice?: object,
 *   migrated?: boolean,
 *   bootstrapped?: boolean,
 *   error?: PersistenciaError,
 * }}
 */
export function resolverCarga(value, opts) {
  const kind = opts.kind;
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const status = clasificarDocumento(value, kind);

  if (status === CARGA.VACIO) {
    if (kind === 'world') {
      const world = crearWorldSnapshotV1(clonarMundo(fechaRef));
      return { status, snapshot: world, world, bootstrapped: true };
    }
    const tenantId = opts.tenantId;
    if (!tenantId) {
      return {
        status: CARGA.CORRUPTO,
        error: new PersistenciaError(CODIGOS.CORRUPTO, 'tenant vacío sin tenantId'),
      };
    }
    const snap = crearTenantSnapshotV1(tenantId, clonarDemo(tenantId, fechaRef));
    return {
      status,
      snapshot: snap,
      slice: sliceDe(snap, tenantId),
      bootstrapped: true,
    };
  }

  if (status === CARGA.CORRUPTO) {
    return {
      status,
      error: new PersistenciaError(
        value && value.schemaVersion != null && value.schemaVersion !== SCHEMA_VERSION
          ? CODIGOS.INCOMPATIBLE
          : CODIGOS.CORRUPTO,
        'snapshot corrupto o incompatible',
      ),
    };
  }

  if (status === CARGA.V1_VALIDO) {
    if (kind === 'world') {
      const world = clonar(value);
      return { status, snapshot: world, world, migrated: false, bootstrapped: false };
    }
    const snap = clonar(value);
    return {
      status,
      snapshot: snap,
      slice: sliceDe(snap, opts.tenantId || snap.tenantId),
      migrated: false,
      bootstrapped: false,
    };
  }

  // V0_MIGABLE
  try {
    const snapshot = migrateV0toV1(value, {
      kind,
      tenantId: opts.tenantId,
      fechaRef,
      clock,
    });
    if (kind === 'world') {
      return {
        status,
        snapshot,
        world: snapshot,
        migrated: true,
        bootstrapped: false,
      };
    }
    return {
      status,
      snapshot,
      slice: sliceDe(snapshot, opts.tenantId || snapshot.tenantId),
      migrated: true,
      bootstrapped: false,
    };
  } catch (err) {
    return {
      status: CARGA.CORRUPTO,
      error: new PersistenciaError(CODIGOS.CORRUPTO, 'migración V0→V1 fallida', { cause: err }),
    };
  }
}

/**
 * Bootstrap explícito de mundo demo (reset).
 * @param {{ fechaRef?: string, clock?: object }} [opts]
 */
export function bootstrapMundo(opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  return crearWorldSnapshotV1(clonarMundo(fechaRef));
}

/**
 * Bootstrap explícito de tenant demo (reset).
 * @param {string} tenantId
 * @param {{ fechaRef?: string, clock?: object }} [opts]
 */
export function bootstrapTenant(tenantId, opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  return crearTenantSnapshotV1(tenantId, clonarDemo(tenantId, fechaRef));
}

/**
 * Compone un WorldSnapshotV1 a partir de slices por tenant.
 * @param {Record<string, object>} byTenantSlices
 * @param {object[]} [tenants]
 */
export function componerMundo(byTenantSlices, tenants) {
  return crearWorldSnapshotV1({
    tenants: tenants || listarTenants(),
    byTenant: byTenantSlices,
  });
}

export { CARGA, PersistenciaError, CODIGOS };
