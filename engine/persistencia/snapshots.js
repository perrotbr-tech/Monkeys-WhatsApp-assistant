/** Snapshots versionados: WorldSnapshotV1 y TenantSnapshotV1. Sin byTenant/data opcionales en el mismo formato. */

import { clonar } from '../../data/demo.js';
import { listarTenants } from '../../data/tenants.js';

export const SCHEMA_VERSION = 1;

/** Campos mínimos esperados en un Slice de tenant. */
export const CAMPOS_SLICE = Object.freeze([
  'classes',
  'plans',
  'bookings',
  'leads',
  'conversations',
  'socios',
  'asistencias',
  'membresias',
  'pagos',
  'automation',
]);

/**
 * @typedef {object} Slice
 * @property {string} [tenantId]
 * @property {object[]} [classes]
 * @property {object[]} [plans]
 * @property {object[]} [bookings]
 * @property {object[]} [leads]
 * @property {object[]} [conversations]
 * @property {object[]} [socios]
 * @property {object[]} [asistencias]
 * @property {object[]} [membresias]
 * @property {object[]} [pagos]
 * @property {object} [automation]
 */

/**
 * @typedef {object} WorldSnapshotV1
 * @property {1} schemaVersion
 * @property {object[]} tenants
 * @property {Record<string, Slice>} byTenant
 */

/**
 * @typedef {object} TenantSnapshotV1
 * @property {1} schemaVersion
 * @property {string} tenantId
 * @property {Slice} data
 */

/**
 * @param {object} world
 * @returns {WorldSnapshotV1}
 */
export function crearWorldSnapshotV1(world) {
  const byTenant = {};
  const src = (world && world.byTenant) || {};
  for (const [id, slice] of Object.entries(src)) {
    byTenant[id] = normalizarSlice(slice, id);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    tenants: clonar((world && world.tenants) || listarTenants()),
    byTenant,
  };
}

/**
 * @param {string} tenantId
 * @param {Slice} slice
 * @returns {TenantSnapshotV1}
 */
export function crearTenantSnapshotV1(tenantId, slice) {
  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId,
    data: normalizarSlice(slice, tenantId),
  };
}

/**
 * @param {Slice|null|undefined} slice
 * @param {string} tenantId
 * @returns {Slice}
 */
export function normalizarSlice(slice, tenantId) {
  const s = slice && typeof slice === 'object' ? clonar(slice) : {};
  delete s.schemaVersion;
  delete s.byTenant;
  delete s.data;
  s.tenantId = tenantId || s.tenantId;
  for (const k of CAMPOS_SLICE) {
    if (k === 'automation') {
      if (!s.automation || typeof s.automation !== 'object') {
        s.automation = { nextActionSeq: 0, agentesActivos: {}, campanias: [], acciones: [] };
      } else {
        s.automation = {
          nextActionSeq: s.automation.nextActionSeq || 0,
          agentesActivos: s.automation.agentesActivos || {},
          campanias: Array.isArray(s.automation.campanias) ? s.automation.campanias : [],
          acciones: Array.isArray(s.automation.acciones) ? s.automation.acciones : [],
        };
      }
      continue;
    }
    if (!Array.isArray(s[k])) s[k] = [];
  }
  return s;
}

/**
 * @param {unknown} obj
 * @returns {obj is WorldSnapshotV1}
 */
export function esWorldSnapshotV1(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schemaVersion !== SCHEMA_VERSION) return false;
  if (!Array.isArray(obj.tenants)) return false;
  if (!obj.byTenant || typeof obj.byTenant !== 'object' || Array.isArray(obj.byTenant)) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'data')) return false;
  return true;
}

/**
 * @param {unknown} obj
 * @returns {obj is TenantSnapshotV1}
 */
export function esTenantSnapshotV1(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof obj.tenantId !== 'string' || !obj.tenantId) return false;
  if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'byTenant')) return false;
  return true;
}

/**
 * Extrae el Slice de un TenantSnapshotV1 o de un slice plano.
 * @param {TenantSnapshotV1|Slice} snap
 * @param {string} [tenantId]
 * @returns {Slice}
 */
export function sliceDe(snap, tenantId) {
  if (esTenantSnapshotV1(snap)) {
    return normalizarSlice(snap.data, snap.tenantId || tenantId);
  }
  return normalizarSlice(snap, tenantId || (snap && snap.tenantId));
}

/**
 * Campos mínimos presentes en export/snapshot (para C12).
 * @param {WorldSnapshotV1|TenantSnapshotV1|Slice} snap
 * @returns {string[]}
 */
export function camposMinimosPresentes(snap) {
  if (esWorldSnapshotV1(snap)) {
    return ['schemaVersion', 'tenants', 'byTenant'].filter((k) => k in snap);
  }
  if (esTenantSnapshotV1(snap)) {
    return ['schemaVersion', 'tenantId', 'data'].filter((k) => k in snap);
  }
  return CAMPOS_SLICE.filter((k) => k in (snap || {}));
}
