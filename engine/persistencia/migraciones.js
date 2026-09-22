/**
 * Migraciones: V0 → V1 (E1B), V1 → V2 (E2), V2 → V3 (E3B workspaceId).
 *
 * Excepciones MONKEYS/SOMA aquí: solo compatibilidad histórica (claves localStorage
 * y mapas de sedes). No son bifurcaciones de producto.
 * Demo solo para campos faltantes documentados en V0; nunca reconstruye datos existentes.
 */

import { clonar } from '../../data/demo.js';
import { listarTenants, buscarTenant, resolverSedeId, nombreSede, catalogoWorkspaces } from '../../data/tenants.js';
import { PLANES_SOMA } from '../../data/planes-soma.js';
import { crearMembresiasYPagos } from '../../data/membresias-demo.js';
import { fechaHoy } from '../dates.js';
import { relojActivo } from '../clock.js';
import { PersistenciaError, CODIGOS } from './estados.js';
import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  crearWorldSnapshotV1,
  crearTenantSnapshotV1,
  crearWorldSnapshotV2,
  crearTenantSnapshotV2,
  crearWorldSnapshotV3,
  crearWorkspaceSnapshotV3,
  normalizarSlice,
  sellarWorkspaceEnSlice,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  esWorldSnapshotV2,
  esTenantSnapshotV2,
  esWorldSnapshotV3,
  esWorkspaceSnapshotV3,
} from './snapshots.js';

export const CLAVE_LOCAL_PREFIX = 'forkza_demo_state_';
/** @deprecated historico E1B — usar aliasHistoricos del tenant monkeys. */
export const CLAVE_LOCAL_LEGACY_MONKEYS = 'monkeys_demo_state';

/**
 * @param {string} tenantId
 * @returns {string}
 */
export function claveEstadoV1(tenantId) {
  return `${CLAVE_LOCAL_PREFIX}${tenantId}`;
}

export const claveEstado = claveEstadoV1;

/**
 * Claves históricas de localStorage para un tenant (compatibilidad).
 * @param {string} tenantId
 * @returns {string[]}
 */
export function clavesLegacyLocal(tenantId) {
  const t = buscarTenant(tenantId);
  const fromConfig = (t && t.aliasHistoricos && t.aliasHistoricos.localStorageKeys) || [];
  // Compatibilidad histórica E1B: monkeys_demo_state solo para tenant monkeys.
  if (tenantId === 'monkeys' && !fromConfig.includes(CLAVE_LOCAL_LEGACY_MONKEYS)) {
    return [...fromConfig, CLAVE_LOCAL_LEGACY_MONKEYS];
  }
  return [...fromConfig];
}

/**
 * Resuelve la clave a leer (V1/V2 primero; legacy como respaldo).
 * @param {Storage} storage
 * @param {string} tenantId
 * @returns {{ key: string, legacy: boolean, raw: string|null }}
 */
export function resolverClaveLocal(storage, tenantId) {
  const primary = claveEstadoV1(tenantId);
  const rawPrimary = storage.getItem(primary);
  if (rawPrimary != null && rawPrimary !== '') {
    return { key: primary, legacy: false, raw: rawPrimary };
  }
  for (const legacyKey of clavesLegacyLocal(tenantId)) {
    const rawLegacy = storage.getItem(legacyKey);
    if (rawLegacy != null && rawLegacy !== '') {
      return { key: legacyKey, legacy: true, raw: rawLegacy };
    }
  }
  return { key: primary, legacy: false, raw: null };
}

/**
 * Completa cuposMes faltantes en planes SOMA sin reemplazar socios/reservas.
 * Compatibilidad histórica: detecta planes del catálogo SOMA por id, no por marca global.
 * @param {object} slice
 * @returns {{ slice: object, aplicado: boolean }}
 */
export function migrarCuposMes(slice) {
  const s = clonar(slice);
  let aplicado = false;
  if (!Array.isArray(s.plans)) return { slice: s, aplicado };
  const porId = new Map(PLANES_SOMA.map((p) => [p.id, p]));
  const tieneCanon = s.plans.some((p) => p && porId.has(p.id));
  // Historico E1B: solo completa cuposMes en planes del catálogo SOMA (por id de plan).
  if (!tieneCanon) return { slice: s, aplicado };
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
 * @param {object} slice
 * @param {string} [fechaRef]
 * @returns {{ slice: object, aplicado: boolean }}
 */
export function migrarMembresiasFaltantes(slice, fechaRef) {
  const s = clonar(slice);
  let aplicado = false;
  if (Array.isArray(s.membresias)) return { slice: s, aplicado };
  const tenantId = s.tenantId;
  if (!tenantId) return { slice: s, aplicado };
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

const CAMPOS_CON_SEDE = Object.freeze([
  'classes', 'bookings', 'leads', 'conversations', 'socios', 'asistencias',
]);

/**
 * Transforma nombres históricos de sede a sedeId estable en un slice.
 * Idempotente. Rechaza valores ambiguos/irresolubles.
 *
 * @param {object} slice
 * @param {string} tenantId
 * @returns {object}
 */
export function migrarSedesSliceV1aV2(slice, tenantId) {
  const tenant = buscarTenant(tenantId);
  if (!tenant) {
    throw new PersistenciaError(CODIGOS.AMBIGUO, `tenant desconocido en migración: ${tenantId}`);
  }
  const s = clonar(slice);
  s.tenantId = tenantId;

  function fijarSede(row) {
    if (!row || typeof row !== 'object') return row;
    const crudo = row.sedeId != null && row.sedeId !== '' ? row.sedeId : row.sede;
    if (crudo == null || crudo === '') {
      // Sin sede: válido (p.ej. conversación sin asignar)
      return row;
    }
    const id = resolverSedeId(tenant, crudo);
    if (!id) {
      throw new PersistenciaError(
        CODIGOS.AMBIGUO,
        `sede irresoluble en migración: tenant=${tenantId} valor=${crudo}`,
      );
    }
    return {
      ...row,
      sedeId: id,
      sede: nombreSede(tenant, id),
    };
  }

  for (const campo of CAMPOS_CON_SEDE) {
    if (!Array.isArray(s[campo])) continue;
    s[campo] = s[campo].map(fijarSede);
  }

  if (s.automation && typeof s.automation === 'object') {
    if (Array.isArray(s.automation.acciones)) {
      s.automation.acciones = s.automation.acciones.map(fijarSede);
    }
    if (Array.isArray(s.automation.campanias)) {
      s.automation.campanias = s.automation.campanias.map((camp) => {
        if (!camp || typeof camp !== 'object') return camp;
        const out = { ...camp };
        if (Array.isArray(out.acciones)) out.acciones = out.acciones.map(fijarSede);
        return out;
      });
    }
  }

  return normalizarSlice(s, tenantId);
}

/**
 * Migra Snapshot V1 → V2 (identidad estable de sedes).
 * Idempotente si ya es V2. No reconstruye desde demo.
 *
 * @param {object} raw
 * @param {{ kind: 'world'|'tenant', tenantId?: string }} opts
 */
export function migrateV1toV2(raw, opts) {
  const kind = opts.kind;
  if (kind === 'world') {
    if (esWorldSnapshotV2(raw)) return clonar(raw);
    if (!esWorldSnapshotV1(raw) && !(raw && raw.schemaVersion === SCHEMA_VERSION_V1)) {
      // Permitir world V1 estructural si schemaVersion es 1
      if (!(raw && raw.schemaVersion === SCHEMA_VERSION_V1 && raw.byTenant)) {
        throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'migrateV1toV2 requiere WorldSnapshotV1');
      }
    }
    const tenants = Array.isArray(raw.tenants) ? clonar(raw.tenants) : listarTenants();
    const byTenant = {};
    for (const [id, slice] of Object.entries(raw.byTenant || {})) {
      byTenant[id] = migrarSedesSliceV1aV2(slice, id);
    }
    return crearWorldSnapshotV2({ tenants, byTenant });
  }
  if (kind === 'tenant') {
    if (esTenantSnapshotV2(raw, opts.tenantId)) return clonar(raw);
    const tenantId = opts.tenantId || raw.tenantId;
    if (!tenantId) {
      throw new Error('migrateV1toV2_tenant_requires_tenantId');
    }
    const sliceSrc = raw.data && !raw.byTenant ? raw.data : raw;
    const slice = migrarSedesSliceV1aV2(sliceSrc, tenantId);
    return crearTenantSnapshotV2(tenantId, slice);
  }
  throw new Error(`migrateV1toV2_kind_unknown:${kind}`);
}

/**
 * Migra Snapshot V2 → V3 (workspaceId canónico en slice y entidades).
 * Idempotente si ya es V3. No reconstruye desde demo.
 * Usa catálogo de workspaces inyectado (o el activo).
 *
 * @param {object} raw
 * @param {{
 *   kind: 'world'|'tenant'|'workspace',
 *   tenantId?: string,
 *   workspaceId?: string,
 *   catalogo?: object,
 * }} opts
 */
export function migrateV2toV3(raw, opts) {
  const kind = opts.kind === 'workspace' ? 'tenant' : opts.kind;
  const catalogo = opts.catalogo || catalogoWorkspaces();
  const workspaceId = opts.workspaceId || opts.tenantId || (raw && (raw.workspaceId || raw.tenantId));

  if (kind === 'world') {
    if (esWorldSnapshotV3(raw, catalogo)) return clonar(raw);
    if (!esWorldSnapshotV2(raw) && !(raw && raw.schemaVersion === SCHEMA_VERSION_V2 && raw.byTenant)) {
      throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'migrateV2toV3 requiere WorldSnapshotV2');
    }
    const tenants = Array.isArray(raw.tenants) ? clonar(raw.tenants) : listarTenants();
    const byWorkspace = {};
    for (const [id, slice] of Object.entries(raw.byTenant || {})) {
      if (!catalogo.conoce(id)) {
        throw new PersistenciaError(CODIGOS.AMBIGUO, `workspace desconocido en migración V2→V3: ${id}`);
      }
      byWorkspace[id] = sellarWorkspaceEnSlice(slice, id);
    }
    return crearWorldSnapshotV3({ tenants, byWorkspace }, catalogo);
  }

  if (kind === 'tenant') {
    if (esWorkspaceSnapshotV3(raw, workspaceId, catalogo)) return clonar(raw);
    const id = workspaceId;
    if (!id) {
      throw new Error('migrateV2toV3_tenant_requires_workspaceId');
    }
    if (!catalogo.conoce(id)) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, `workspace desconocido en migración V2→V3: ${id}`);
    }
    if (!esTenantSnapshotV2(raw, id) && !(raw && raw.schemaVersion === SCHEMA_VERSION_V2 && raw.data)) {
      // Permitir slice V2 estructural con schemaVersion 2
      if (!(raw && raw.schemaVersion === SCHEMA_VERSION_V2 && raw.tenantId && raw.data)) {
        throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'migrateV2toV3 requiere TenantSnapshotV2');
      }
    }
    if (raw.tenantId && raw.tenantId !== id) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId incoherente en migrateV2toV3');
    }
    const sliceSrc = raw.data && !raw.byTenant ? raw.data : raw;
    const slice = sellarWorkspaceEnSlice(sliceSrc, id);
    return crearWorkspaceSnapshotV3(id, slice, catalogo);
  }

  throw new Error(`migrateV2toV3_kind_unknown:${opts.kind}`);
}

/**
 * Cadena completa hasta la versión actual: V0→…→V3, V1→…→V3, V2→V3, V3 idempotente.
 */
export function migrateToCurrent(raw, opts) {
  const kind = opts.kind === 'workspace' ? 'tenant' : opts.kind;
  const catalogo = opts.catalogo || catalogoWorkspaces();
  const workspaceId = opts.workspaceId || opts.tenantId;
  const optsNorm = {
    ...opts,
    kind,
    catalogo,
    workspaceId,
    tenantId: workspaceId || opts.tenantId,
  };

  if (kind === 'world' && esWorldSnapshotV3(raw, catalogo)) return clonar(raw);
  if (kind === 'tenant' && esWorkspaceSnapshotV3(raw, workspaceId, catalogo)) return clonar(raw);

  const ver = raw && raw.schemaVersion;

  if (ver === SCHEMA_VERSION) {
    return clonar(raw);
  }

  if (ver === SCHEMA_VERSION_V2) {
    return migrateV2toV3(raw, optsNorm);
  }

  if (ver === SCHEMA_VERSION_V1) {
    if (kind === 'world' && !esWorldSnapshotV1(raw)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'WorldSnapshotV1 corrupto');
    }
    if (kind === 'tenant' && !esTenantSnapshotV1(raw, workspaceId)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'TenantSnapshotV1 corrupto');
    }
    const v2 = migrateV1toV2(raw, optsNorm);
    return migrateV2toV3(v2, optsNorm);
  }

  const v1 = migrateV0toV1(raw, optsNorm);
  const v2 = migrateV1toV2(v1, optsNorm);
  return migrateV2toV3(v2, optsNorm);
}

export { SCHEMA_VERSION, SCHEMA_VERSION_V1, SCHEMA_VERSION_V2 };
