/** Snapshots versionados: V1 (histórico) y V2 (identidad estable de sedes). */

import { clonar } from '../../data/demo.js';
import { listarTenants } from '../../data/tenants.js';

/** Versión actual del contrato persistido. */
export const SCHEMA_VERSION = 2;
/** Versión histórica E1B; solo lectura/migración. */
export const SCHEMA_VERSION_V1 = 1;

/** Campos mínimos obligatorios de un Slice (V1 y V2). */
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

const CAMPOS_ARRAY = Object.freeze(CAMPOS_SLICE.filter((k) => k !== 'automation'));

/**
 * Validación estructural estricta de Slice (carga).
 * Arrays vacíos son válidos; campo ausente o tipo incorrecto no lo es.
 *
 * @param {unknown} slice
 * @param {string} [expectedTenantId]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validarSliceV1(slice, expectedTenantId) {
  if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
    return { ok: false, reason: 'slice_not_object' };
  }
  if (typeof slice.tenantId !== 'string' || !slice.tenantId) {
    return { ok: false, reason: 'tenantId_ausente' };
  }
  if (expectedTenantId != null && slice.tenantId !== expectedTenantId) {
    return { ok: false, reason: 'tenantId_slice_incoherente' };
  }
  for (const k of CAMPOS_ARRAY) {
    if (!Object.prototype.hasOwnProperty.call(slice, k)) {
      return { ok: false, reason: `campo_ausente:${k}` };
    }
    if (!Array.isArray(slice[k])) {
      return { ok: false, reason: `tipo_invalido:${k}` };
    }
  }
  if (!Object.prototype.hasOwnProperty.call(slice, 'automation')) {
    return { ok: false, reason: 'campo_ausente:automation' };
  }
  const auto = slice.automation;
  if (!auto || typeof auto !== 'object' || Array.isArray(auto)) {
    return { ok: false, reason: 'tipo_invalido:automation' };
  }
  if (!Object.prototype.hasOwnProperty.call(auto, 'campanias') || !Array.isArray(auto.campanias)) {
    return { ok: false, reason: 'tipo_invalido:automation.campanias' };
  }
  if (!Object.prototype.hasOwnProperty.call(auto, 'acciones') || !Array.isArray(auto.acciones)) {
    return { ok: false, reason: 'tipo_invalido:automation.acciones' };
  }
  if (!Object.prototype.hasOwnProperty.call(auto, 'agentesActivos')
    || !auto.agentesActivos
    || typeof auto.agentesActivos !== 'object'
    || Array.isArray(auto.agentesActivos)) {
    return { ok: false, reason: 'tipo_invalido:automation.agentesActivos' };
  }
  if (!Object.prototype.hasOwnProperty.call(auto, 'nextActionSeq')
    || !Number.isInteger(auto.nextActionSeq)
    || auto.nextActionSeq < 0) {
    return { ok: false, reason: 'tipo_invalido:automation.nextActionSeq' };
  }
  return { ok: true };
}

export const validarSliceV2 = validarSliceV1;

/**
 * Coherencia de identidad tenant (solicitado / envelope / slice).
 * @param {{ solicitado?: string, envelope?: string, slice?: string }} ids
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function coherenciaTenantIds(ids) {
  const vals = [ids.solicitado, ids.envelope, ids.slice].filter((v) => v != null && v !== '');
  if (vals.length === 0) return { ok: false, reason: 'tenantId_ausente' };
  const first = vals[0];
  for (const v of vals) {
    if (v !== first) return { ok: false, reason: 'tenantId_incoherente' };
  }
  return { ok: true };
}

/**
 * Normalización solo para bootstrap / migración.
 * No usar al clasificar ni al cargar un documento ya versionado válido.
 * @param {object|null|undefined} slice
 * @param {string} tenantId
 * @returns {object}
 */
export function normalizarSlice(slice, tenantId) {
  const s = slice && typeof slice === 'object' ? clonar(slice) : {};
  delete s.schemaVersion;
  delete s.byTenant;
  delete s.data;
  s.tenantId = tenantId || s.tenantId;
  for (const k of CAMPOS_SLICE) {
    if (k === 'automation') {
      if (!s.automation || typeof s.automation !== 'object' || Array.isArray(s.automation)) {
        s.automation = { nextActionSeq: 0, agentesActivos: {}, campanias: [], acciones: [] };
      } else {
        s.automation = {
          nextActionSeq: Number.isInteger(s.automation.nextActionSeq) && s.automation.nextActionSeq >= 0
            ? s.automation.nextActionSeq
            : 0,
          agentesActivos: (s.automation.agentesActivos && typeof s.automation.agentesActivos === 'object'
            && !Array.isArray(s.automation.agentesActivos))
            ? s.automation.agentesActivos
            : {},
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
 * @param {object} world
 * @returns {object} WorldSnapshotV1 (histórico)
 */
export function crearWorldSnapshotV1(world) {
  const byTenant = {};
  const src = (world && world.byTenant) || {};
  for (const [id, slice] of Object.entries(src)) {
    byTenant[id] = normalizarSlice(slice, id);
  }
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    tenants: clonar((world && world.tenants) || listarTenants()),
    byTenant,
  };
}

/**
 * @param {string} tenantId
 * @param {object} slice
 * @returns {object} TenantSnapshotV1
 */
export function crearTenantSnapshotV1(tenantId, slice) {
  return {
    schemaVersion: SCHEMA_VERSION_V1,
    tenantId,
    data: normalizarSlice(slice, tenantId),
  };
}

/**
 * Snapshot actual (V2).
 * @param {object} world
 */
export function crearWorldSnapshotV2(world) {
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
 * @param {object} slice
 */
export function crearTenantSnapshotV2(tenantId, slice) {
  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId,
    data: normalizarSlice(slice, tenantId),
  };
}

/** Alias: creación del snapshot actual. */
export const crearWorldSnapshot = crearWorldSnapshotV2;
export const crearTenantSnapshot = crearTenantSnapshotV2;

function esWorldDeVersion(obj, version) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schemaVersion !== version) return false;
  if (!Array.isArray(obj.tenants)) return false;
  if (!obj.byTenant || typeof obj.byTenant !== 'object' || Array.isArray(obj.byTenant)) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'data')) return false;
  for (const [id, slice] of Object.entries(obj.byTenant)) {
    const v = validarSliceV1(slice, id);
    if (!v.ok) return false;
  }
  return true;
}

function esTenantDeVersion(obj, version, expectedTenantId) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schemaVersion !== version) return false;
  if (typeof obj.tenantId !== 'string' || !obj.tenantId) return false;
  if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'byTenant')) return false;
  const coh = coherenciaTenantIds({
    solicitado: expectedTenantId,
    envelope: obj.tenantId,
    slice: obj.data && obj.data.tenantId,
  });
  if (!coh.ok) return false;
  return validarSliceV1(obj.data, obj.tenantId).ok;
}

/** Valida WorldSnapshotV1 (schemaVersion === 1). */
export function esWorldSnapshotV1(obj) {
  return esWorldDeVersion(obj, SCHEMA_VERSION_V1);
}

/** Valida TenantSnapshotV1. */
export function esTenantSnapshotV1(obj, expectedTenantId) {
  return esTenantDeVersion(obj, SCHEMA_VERSION_V1, expectedTenantId);
}

/** Valida WorldSnapshotV2 (schemaVersion === 2). */
export function esWorldSnapshotV2(obj) {
  return esWorldDeVersion(obj, SCHEMA_VERSION);
}

/** Valida TenantSnapshotV2. */
export function esTenantSnapshotV2(obj, expectedTenantId) {
  return esTenantDeVersion(obj, SCHEMA_VERSION, expectedTenantId);
}

/**
 * Extrae Slice; normaliza solo si no es un TenantSnapshot ya validado.
 * @param {object} snap
 * @param {string} [tenantId]
 */
export function sliceDe(snap, tenantId) {
  if (snap && (snap.schemaVersion === SCHEMA_VERSION || snap.schemaVersion === SCHEMA_VERSION_V1) && snap.data) {
    return clonar(snap.data);
  }
  return normalizarSlice(snap, tenantId || (snap && snap.tenantId));
}

/**
 * Campos mínimos presentes en export/snapshot.
 * @param {object} snap
 * @returns {string[]}
 */
export function camposMinimosPresentes(snap) {
  if (snap && (snap.schemaVersion === SCHEMA_VERSION || snap.schemaVersion === SCHEMA_VERSION_V1)
    && snap.byTenant && !snap.data) {
    return ['schemaVersion', 'tenants', 'byTenant'].filter((k) => k in snap);
  }
  if (snap && (snap.schemaVersion === SCHEMA_VERSION || snap.schemaVersion === SCHEMA_VERSION_V1)
    && snap.data && snap.tenantId) {
    return ['schemaVersion', 'tenantId', 'data'].filter((k) => k in snap);
  }
  return CAMPOS_SLICE.filter((k) => k in (snap || {}));
}
