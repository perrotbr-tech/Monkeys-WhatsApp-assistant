/**
 * Migraciones mínimas V0 → V1.
 * Demo solo se usa para campos faltantes documentados; nunca reemplaza arrays existentes.
 */

import { clonar } from '../../data/demo.js';
import { listarTenants } from '../../data/tenants.js';
import { PLANES_SOMA } from '../../data/planes-soma.js';
import { crearMembresiasYPagos } from '../../data/membresias-demo.js';
import { fechaHoy } from '../dates.js';
import { relojActivo } from '../clock.js';
import {
  SCHEMA_VERSION,
  crearWorldSnapshotV1,
  crearTenantSnapshotV1,
  normalizarSlice,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
} from './snapshots.js';

export const CLAVE_LOCAL_PREFIX = 'forkza_demo_state_';
export const CLAVE_LOCAL_LEGACY_MONKEYS = 'monkeys_demo_state';

/**
 * @param {string} tenantId
 * @returns {string}
 */
export function claveEstadoV1(tenantId) {
  return `${CLAVE_LOCAL_PREFIX}${tenantId}`;
}

/**
 * Resuelve la clave a leer (V1 primero; legacy monkeys_demo_state como respaldo).
 * @param {Storage} storage
 * @param {string} tenantId
 * @returns {{ key: string, legacy: boolean, raw: string|null }}
 */
export function resolverClaveLocal(storage, tenantId) {
  const v1 = claveEstadoV1(tenantId);
  const rawV1 = storage.getItem(v1);
  if (rawV1 != null && rawV1 !== '') {
    return { key: v1, legacy: false, raw: rawV1 };
  }
  if (tenantId === 'monkeys') {
    const rawLegacy = storage.getItem(CLAVE_LOCAL_LEGACY_MONKEYS);
    if (rawLegacy != null && rawLegacy !== '') {
      return { key: CLAVE_LOCAL_LEGACY_MONKEYS, legacy: true, raw: rawLegacy };
    }
  }
  return { key: v1, legacy: false, raw: null };
}

/**
 * Completa cuposMes faltantes en planes SOMA sin reemplazar socios/reservas ni el array de planes.
 * @param {object} slice
 * @returns {{ slice: object, aplicado: boolean }}
 */
export function migrarCuposMes(slice) {
  const s = clonar(slice);
  let aplicado = false;
  if (s.tenantId !== 'soma' && !(s.plans || []).some((p) => p && p.tenantId === 'soma')) {
    return { slice: s, aplicado };
  }
  if (!Array.isArray(s.plans)) return { slice: s, aplicado };
  const porId = new Map(PLANES_SOMA.map((p) => [p.id, p]));
  s.plans = s.plans.map((plan) => {
    if (!plan || typeof plan !== 'object') return plan;
    if ('cuposMes' in plan) return plan;
    const canon = porId.get(plan.id);
    if (!canon) return plan;
    aplicado = true;
    return { ...plan, cuposMes: canon.cuposMes, disciplinasIncluidas: plan.disciplinasIncluidas || canon.disciplinasIncluidas };
  });
  return { slice: s, aplicado };
}

/**
 * Si faltan membresías, las genera de forma explícita a partir de socios/planes existentes.
 * No reemplaza socios, reservas ni pagos ya presentes.
 * @param {object} slice
 * @param {string} [fechaRef]
 * @returns {{ slice: object, aplicado: boolean }}
 */
export function migrarMembresiasFaltantes(slice, fechaRef) {
  const s = clonar(slice);
  let aplicado = false;
  if (Array.isArray(s.membresias)) return { slice: s, aplicado };
  const tenantId = s.tenantId || 'monkeys';
  const socios = Array.isArray(s.socios) ? s.socios : [];
  const plans = Array.isArray(s.plans) ? s.plans : [];
  const finanzas = crearMembresiasYPagos(socios, plans, fechaRef || fechaHoy(undefined, relojActivo()), tenantId);
  s.membresias = finanzas.membresias || [];
  if (!Array.isArray(s.pagos)) s.pagos = finanzas.pagos || [];
  aplicado = true;
  return { slice: s, aplicado };
}

/**
 * Aplica migraciones de campo documentadas sobre un slice V0.
 * @param {object} slice
 * @param {string} tenantId
 * @param {{ fechaRef?: string, clock?: object }} [opts]
 */
export function migrarSliceV0(slice, tenantId, opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const src = slice && typeof slice === 'object' ? clonar(slice) : {};
  const membresiasAusentes = !Object.prototype.hasOwnProperty.call(src, 'membresias')
    || src.membresias == null;
  src.tenantId = src.tenantId || tenantId;
  let s = src;
  const cupos = migrarCuposMes(s);
  s = cupos.slice;
  if (membresiasAusentes) {
    delete s.membresias;
    const mem = migrarMembresiasFaltantes(s, fechaRef);
    s = mem.slice;
  }
  return normalizarSlice(s, tenantId);
}

/**
 * Migra un documento V0 (mundo o tenant) a V1.
 * @param {object} raw
 * @param {{ kind: 'world'|'tenant', tenantId?: string, fechaRef?: string, clock?: object }} opts
 * @returns {import('./snapshots.js').WorldSnapshotV1|import('./snapshots.js').TenantSnapshotV1}
 */
export function migrateV0toV1(raw, opts) {
  const kind = opts.kind;
  if (kind === 'world') {
    if (esWorldSnapshotV1(raw)) return clonar(raw);
    const tenants = Array.isArray(raw.tenants) ? clonar(raw.tenants) : listarTenants();
    const byTenant = {};
    const src = (raw && raw.byTenant) || {};
    for (const [id, slice] of Object.entries(src)) {
      byTenant[id] = migrarSliceV0(slice, id, opts);
    }
    return crearWorldSnapshotV1({ tenants, byTenant });
  }
  if (kind === 'tenant') {
    if (esTenantSnapshotV1(raw)) return clonar(raw);
    const tenantId = opts.tenantId || raw.tenantId;
    if (!tenantId) {
      throw new Error('migrateV0toV1_tenant_requires_tenantId');
    }
    const sliceSrc = raw.data && !raw.byTenant ? raw.data : raw;
    const slice = migrarSliceV0(sliceSrc, tenantId, opts);
    return crearTenantSnapshotV1(tenantId, slice);
  }
  throw new Error(`migrateV0toV1_kind_unknown:${kind}`);
}

export { SCHEMA_VERSION };
