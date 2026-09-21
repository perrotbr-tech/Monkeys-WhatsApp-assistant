/**
 * Clasificación de carga y resolución segura (vacío / V0 / V1 / V2 / corrupto).
 */

import { clonar, clonarMundo, clonarDemo } from '../../data/demo.js';
import { listarTenants } from '../../data/tenants.js';
import { fechaHoy } from '../dates.js';
import { relojActivo } from '../clock.js';
import { CARGA, PersistenciaError, CODIGOS } from './estados.js';
import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  crearWorldSnapshotV2,
  crearTenantSnapshotV2,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  esWorldSnapshotV2,
  esTenantSnapshotV2,
  sliceDe,
  validarSliceV2,
  coherenciaTenantIds,
} from './snapshots.js';
import { migrateV0toV1, migrateV1toV2, migrateToCurrent } from './migraciones.js';

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
 * @param {{ expectedTenantId?: string }} [opts]
 * @returns {typeof CARGA[keyof typeof CARGA]}
 */
export function clasificarDocumento(value, kind, opts = {}) {
  if (value == null) return CARGA.VACIO;
  if (typeof value !== 'object' || Array.isArray(value)) return CARGA.CORRUPTO;

  const version = value.schemaVersion;
  if (version != null
    && version !== SCHEMA_VERSION
    && version !== SCHEMA_VERSION_V1) {
    return CARGA.CORRUPTO;
  }

  if (kind === 'world') {
    if (version === SCHEMA_VERSION) {
      if (Object.prototype.hasOwnProperty.call(value, 'data')) return CARGA.CORRUPTO;
      return esWorldSnapshotV2(value) ? CARGA.V2_VALIDO : CARGA.CORRUPTO;
    }
    if (version === SCHEMA_VERSION_V1) {
      if (Object.prototype.hasOwnProperty.call(value, 'data')) return CARGA.CORRUPTO;
      return esWorldSnapshotV1(value) ? CARGA.V1_MIGABLE : CARGA.CORRUPTO;
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
    return esTenantSnapshotV2(value, opts.expectedTenantId) ? CARGA.V2_VALIDO : CARGA.CORRUPTO;
  }
  if (version === SCHEMA_VERSION_V1) {
    if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
    return esTenantSnapshotV1(value, opts.expectedTenantId) ? CARGA.V1_MIGABLE : CARGA.CORRUPTO;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
  return CARGA.V0_MIGABLE;
}

/**
 * Resuelve un documento ya parseado a snapshot actual (V2), bootstrap o error.
 * Nunca reemplaza datos corruptos con demo.
 *
 * @param {object|null|undefined} value
 * @param {{ kind: 'world'|'tenant', tenantId?: string, fechaRef?: string, clock?: object }} opts
 */
export function resolverCarga(value, opts) {
  const kind = opts.kind;
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const status = clasificarDocumento(value, kind, { expectedTenantId: opts.tenantId });

  if (status === CARGA.VACIO) {
    if (kind === 'world') {
      const world = crearWorldSnapshotV2(clonarMundo(fechaRef));
      return { status, snapshot: world, world, bootstrapped: true };
    }
    const tenantId = opts.tenantId;
    if (!tenantId) {
      return {
        status: CARGA.CORRUPTO,
        error: new PersistenciaError(CODIGOS.CORRUPTO, 'tenant vacío sin tenantId'),
      };
    }
    const snap = crearTenantSnapshotV2(tenantId, clonarDemo(tenantId, fechaRef));
    return {
      status,
      snapshot: snap,
      slice: clonar(snap.data),
      bootstrapped: true,
    };
  }

  if (status === CARGA.CORRUPTO) {
    return {
      status,
      error: new PersistenciaError(
        value && value.schemaVersion != null
          && value.schemaVersion !== SCHEMA_VERSION
          && value.schemaVersion !== SCHEMA_VERSION_V1
          ? CODIGOS.INCOMPATIBLE
          : CODIGOS.CORRUPTO,
        'snapshot corrupto o incompatible',
      ),
    };
  }

  if (status === CARGA.V2_VALIDO || status === CARGA.V1_VALIDO) {
    if (kind === 'world') {
      const world = clonar(value);
      return { status: CARGA.V2_VALIDO, snapshot: world, world, migrated: false, bootstrapped: false };
    }
    const snap = clonar(value);
    const coh = coherenciaTenantIds({
      solicitado: opts.tenantId,
      envelope: snap.tenantId,
      slice: snap.data && snap.data.tenantId,
    });
    if (!coh.ok || !validarSliceV2(snap.data, snap.tenantId).ok) {
      return {
        status: CARGA.CORRUPTO,
        error: new PersistenciaError(CODIGOS.CORRUPTO, 'TenantSnapshotV2 incoherente o incompleto'),
      };
    }
    return {
      status: CARGA.V2_VALIDO,
      snapshot: snap,
      slice: clonar(snap.data),
      migrated: false,
      bootstrapped: false,
    };
  }

  // V0_MIGABLE o V1_MIGABLE
  try {
    let snapshot;
    if (status === CARGA.V1_MIGABLE) {
      snapshot = migrateV1toV2(value, {
        kind,
        tenantId: opts.tenantId,
        fechaRef,
        clock,
      });
    } else {
      snapshot = migrateToCurrent(value, {
        kind,
        tenantId: opts.tenantId,
        fechaRef,
        clock,
      });
    }
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
    const code = err && err.code === CODIGOS.AMBIGUO ? CODIGOS.AMBIGUO : CODIGOS.CORRUPTO;
    return {
      status: CARGA.CORRUPTO,
      error: new PersistenciaError(code, 'migración a V2 fallida', { cause: err }),
    };
  }
}

/**
 * Bootstrap explícito de mundo demo (reset).
 */
export function bootstrapMundo(opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  return crearWorldSnapshotV2(clonarMundo(fechaRef));
}

/**
 * Bootstrap explícito de tenant demo (reset).
 */
export function bootstrapTenant(tenantId, opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  return crearTenantSnapshotV2(tenantId, clonarDemo(tenantId, fechaRef));
}

/**
 * Compone un WorldSnapshotV2 a partir de slices por tenant.
 */
export function componerMundo(byTenantSlices, tenants) {
  return crearWorldSnapshotV2({
    tenants: tenants || listarTenants(),
    byTenant: byTenantSlices,
  });
}

export { CARGA, PersistenciaError, CODIGOS, migrateV0toV1, migrateV1toV2 };
