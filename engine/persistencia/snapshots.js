/** Snapshots versionados: V1/V2 históricos; V3 actual (workspaceId canónico). */

import { clonar } from '../../data/demo.js';
import { listarTenants, buscarTenant, catalogoWorkspaces } from '../../data/tenants.js';
import { crearCatalogoWorkspaces } from '../../core/organizations/workspace.js';

/** Versión actual del contrato persistido (E3B). */
export const SCHEMA_VERSION = 3;
/** Versión histórica E2 (sedeId estable). */
export const SCHEMA_VERSION_V2 = 2;
/** Versión histórica E1B; solo lectura/migración. */
export const SCHEMA_VERSION_V1 = 1;

/** Campos mínimos obligatorios de un Slice (V1–V3). */
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

/** Entidades de negocio que llevan workspaceId en V3. */
export const CAMPOS_ENTIDAD_V3 = Object.freeze([
  'classes',
  'plans',
  'bookings',
  'leads',
  'conversations',
  'socios',
  'asistencias',
  'membresias',
  'pagos',
  'referidos',
  'usuariosEquipo',
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

const CAMPOS_CON_SEDE_V2 = Object.freeze([
  'classes', 'bookings', 'leads', 'conversations', 'socios', 'asistencias',
]);

/**
 * IDs de sede estables configurados para un tenant.
 * En WorldSnapshotV2, `tenantsExtra` (catálogo persistido) es la fuente de verdad.
 * El catálogo global solo se usa cuando no se proporciona catálogo persistido
 * (p. ej. TenantSnapshotV2).
 * @param {string} tenantId
 * @param {object[]} [tenantsExtra] catálogo `tenants` del WorldSnapshot
 * @returns {Set<string>|null} null si el tenant no está configurado
 */
export function idsSedeConfigurados(tenantId, tenantsExtra) {
  let t = null;
  if (Array.isArray(tenantsExtra)) {
    t = tenantsExtra.find((x) => x && (x.id === tenantId || x.slug === tenantId)) || null;
  } else {
    t = buscarTenant(tenantId);
  }
  if (!t) return null;
  return new Set((t.sedes || []).map((s) => s && s.id).filter(Boolean));
}

/**
 * Si existe sedeId, debe ser exactamente un ID estable del tenant.
 * No resuelve aliases: eso solo ocurre en migración V1→V2.
 * @param {object} row
 * @param {Set<string>|null} ids
 * @param {string} path
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validarSedeIdEstable(row, ids, path) {
  if (!row || typeof row !== 'object') return { ok: true };
  if (row.sedeId == null || row.sedeId === '') return { ok: true };
  if (typeof row.sedeId !== 'string') {
    return { ok: false, reason: `sedeId_tipo_invalido:${path}` };
  }
  if (!ids) {
    return { ok: false, reason: `sede_tenant_desconocido:${path}` };
  }
  if (!ids.has(row.sedeId)) {
    return { ok: false, reason: `sedeId_invalido:${path}:${row.sedeId}` };
  }
  return { ok: true };
}

/**
 * Validación semántica V2 de sedes en un slice.
 * @param {object} slice
 * @param {string} tenantId
 * @param {object[]} [tenantsExtra]
 */
export function validarSedesSliceV2(slice, tenantId, tenantsExtra) {
  const ids = idsSedeConfigurados(tenantId, tenantsExtra);
  for (const campo of CAMPOS_CON_SEDE_V2) {
    const rows = slice[campo];
    if (!Array.isArray(rows)) continue;
    for (let i = 0; i < rows.length; i += 1) {
      const v = validarSedeIdEstable(rows[i], ids, `${campo}[${i}]`);
      if (!v.ok) return v;
    }
  }
  const auto = slice.automation;
  if (auto && typeof auto === 'object') {
    if (Array.isArray(auto.acciones)) {
      for (let i = 0; i < auto.acciones.length; i += 1) {
        const v = validarSedeIdEstable(auto.acciones[i], ids, `automation.acciones[${i}]`);
        if (!v.ok) return v;
      }
    }
    if (Array.isArray(auto.campanias)) {
      for (let c = 0; c < auto.campanias.length; c += 1) {
        const camp = auto.campanias[c];
        if (!camp || typeof camp !== 'object') continue;
        if (!Array.isArray(camp.acciones)) continue;
        for (let i = 0; i < camp.acciones.length; i += 1) {
          const v = validarSedeIdEstable(camp.acciones[i], ids, `automation.campanias[${c}].acciones[${i}]`);
          if (!v.ok) return v;
        }
      }
    }
  }
  return { ok: true };
}

/**
 * Slice V2: estructura V1 + sedeId semántico (solo IDs estables).
 * @param {unknown} slice
 * @param {string} [expectedTenantId]
 * @param {object[]} [tenantsExtra]
 */
export function validarSliceV2(slice, expectedTenantId, tenantsExtra) {
  const base = validarSliceV1(slice, expectedTenantId);
  if (!base.ok) return base;
  const tenantId = expectedTenantId || slice.tenantId;
  return validarSedesSliceV2(slice, tenantId, tenantsExtra);
}

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
 * Snapshot V2 (histórico E2).
 * @param {object} world
 */
export function crearWorldSnapshotV2(world) {
  const byTenant = {};
  const src = (world && world.byTenant) || (world && world.byWorkspace) || {};
  for (const [id, slice] of Object.entries(src)) {
    byTenant[id] = normalizarSlice(slice, id);
  }
  return {
    schemaVersion: SCHEMA_VERSION_V2,
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
    schemaVersion: SCHEMA_VERSION_V2,
    tenantId,
    data: normalizarSlice(slice, tenantId),
  };
}

function esWorldDeVersion(obj, version, validarSlice) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schemaVersion !== version) return false;
  if (!Array.isArray(obj.tenants)) return false;
  if (!obj.byTenant || typeof obj.byTenant !== 'object' || Array.isArray(obj.byTenant)) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'data')) return false;
  for (const [id, slice] of Object.entries(obj.byTenant)) {
    const v = validarSlice(slice, id, obj.tenants);
    if (!v.ok) return false;
  }
  return true;
}

function esTenantDeVersion(obj, version, expectedTenantId, validarSlice) {
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
  return validarSlice(obj.data, obj.tenantId).ok;
}

/** Valida WorldSnapshotV1 (schemaVersion === 1). */
export function esWorldSnapshotV1(obj) {
  return esWorldDeVersion(obj, SCHEMA_VERSION_V1, validarSliceV1);
}

/** Valida TenantSnapshotV1. */
export function esTenantSnapshotV1(obj, expectedTenantId) {
  return esTenantDeVersion(obj, SCHEMA_VERSION_V1, expectedTenantId, validarSliceV1);
}

/** Valida WorldSnapshotV2 (schemaVersion === 2) con sedeId semántico. */
export function esWorldSnapshotV2(obj) {
  return esWorldDeVersion(obj, SCHEMA_VERSION_V2, validarSliceV2);
}

/** Valida TenantSnapshotV2 con sedeId semántico. */
export function esTenantSnapshotV2(obj, expectedTenantId) {
  return esTenantDeVersion(obj, SCHEMA_VERSION_V2, expectedTenantId, validarSliceV2);
}

/**
 * Extrae Slice; normaliza solo si no es un Tenant/WorkspaceSnapshot ya validado.
 * @param {object} snap
 * @param {string} [tenantId]
 */
export function sliceDe(snap, tenantId) {
  if (snap && snap.data && (
    snap.schemaVersion === SCHEMA_VERSION
    || snap.schemaVersion === SCHEMA_VERSION_V2
    || snap.schemaVersion === SCHEMA_VERSION_V1
  )) {
    return clonar(snap.data);
  }
  return normalizarSlice(snap, tenantId || (snap && (snap.workspaceId || snap.tenantId)));
}

/**
 * Campos mínimos presentes en export/snapshot.
 * @param {object} snap
 * @returns {string[]}
 */
export function camposMinimosPresentes(snap) {
  if (snap && snap.schemaVersion === SCHEMA_VERSION && snap.byWorkspace && !snap.data) {
    return ['schemaVersion', 'tenants', 'byWorkspace'].filter((k) => k in snap);
  }
  if (snap && (snap.schemaVersion === SCHEMA_VERSION_V2 || snap.schemaVersion === SCHEMA_VERSION_V1)
    && snap.byTenant && !snap.data) {
    return ['schemaVersion', 'tenants', 'byTenant'].filter((k) => k in snap);
  }
  if (snap && snap.schemaVersion === SCHEMA_VERSION && snap.data && snap.workspaceId) {
    return ['schemaVersion', 'workspaceId', 'tenantId', 'data'].filter((k) => k in snap);
  }
  if (snap && (snap.schemaVersion === SCHEMA_VERSION_V2 || snap.schemaVersion === SCHEMA_VERSION_V1)
    && snap.data && snap.tenantId) {
    return ['schemaVersion', 'tenantId', 'data'].filter((k) => k in snap);
  }
  return CAMPOS_SLICE.filter((k) => k in (snap || {}));
}

/**
 * Coherencia workspace/tenant (E3B).
 * @param {{ solicitado?: string, envelope?: string, slice?: string, workspace?: string }} ids
 */
export function coherenciaWorkspaceIds(ids) {
  const vals = [ids.solicitado, ids.envelope, ids.slice, ids.workspace]
    .filter((v) => v != null && v !== '');
  if (vals.length === 0) return { ok: false, reason: 'workspaceId_ausente' };
  const first = vals[0];
  for (const v of vals) {
    if (v !== first) return { ok: false, reason: 'workspace_tenant_incoherente' };
  }
  return { ok: true };
}

/**
 * Sella workspaceId (+ tenantId alias) en entidades de un slice.
 * Solo bootstrap / migración documentada.
 * @param {object} slice
 * @param {string} workspaceId
 * @returns {object}
 */
export function sellarWorkspaceEnSlice(slice, workspaceId) {
  const s = normalizarSlice(slice, workspaceId);
  s.workspaceId = workspaceId;
  s.tenantId = workspaceId;

  function sellarRow(row) {
    if (!row || typeof row !== 'object') return row;
    return {
      ...row,
      workspaceId,
      tenantId: workspaceId,
    };
  }

  for (const campo of CAMPOS_ENTIDAD_V3) {
    if (!Array.isArray(s[campo])) continue;
    s[campo] = s[campo].map(sellarRow);
  }

  if (s.automation && typeof s.automation === 'object') {
    if (Array.isArray(s.automation.acciones)) {
      s.automation.acciones = s.automation.acciones.map(sellarRow);
    }
    if (Array.isArray(s.automation.campanias)) {
      s.automation.campanias = s.automation.campanias.map((camp) => {
        if (!camp || typeof camp !== 'object') return camp;
        const out = sellarRow(camp);
        if (Array.isArray(camp.acciones)) {
          out.acciones = camp.acciones.map(sellarRow);
        }
        return out;
      });
    }
  }
  return s;
}

/**
 * Valida workspaceId en entidades V3 (obligatorio y coherente).
 * clasificacion anidada en campañas no exige workspaceId propio (deriva del padre).
 * @param {object} slice
 * @param {string} workspaceId
 */
export function validarWorkspaceEnEntidades(slice, workspaceId) {
  function checkRow(row, path) {
    if (!row || typeof row !== 'object') {
      return { ok: false, reason: `fila_invalida:${path}` };
    }
    if (row.workspaceId == null || row.workspaceId === '') {
      return { ok: false, reason: `workspaceId_ausente:${path}` };
    }
    if (typeof row.workspaceId !== 'string') {
      return { ok: false, reason: `workspaceId_tipo:${path}` };
    }
    if (row.workspaceId !== workspaceId) {
      return { ok: false, reason: `workspaceId_cruzado:${path}` };
    }
    if (row.tenantId != null && row.tenantId !== '' && row.tenantId !== workspaceId) {
      return { ok: false, reason: `tenantId_cruzado:${path}` };
    }
    return { ok: true };
  }

  for (const campo of CAMPOS_ENTIDAD_V3) {
    if (!Object.prototype.hasOwnProperty.call(slice, campo)) continue;
    if (!Array.isArray(slice[campo])) {
      return { ok: false, reason: `tipo_invalido:${campo}` };
    }
    for (let i = 0; i < slice[campo].length; i += 1) {
      const v = checkRow(slice[campo][i], `${campo}[${i}]`);
      if (!v.ok) return v;
    }
  }

  const auto = slice.automation;
  if (auto && typeof auto === 'object') {
    if (Array.isArray(auto.acciones)) {
      for (let i = 0; i < auto.acciones.length; i += 1) {
        const v = checkRow(auto.acciones[i], `automation.acciones[${i}]`);
        if (!v.ok) return v;
      }
    }
    if (Array.isArray(auto.campanias)) {
      for (let c = 0; c < auto.campanias.length; c += 1) {
        const camp = auto.campanias[c];
        const vCamp = checkRow(camp, `automation.campanias[${c}]`);
        if (!vCamp.ok) return vCamp;
        if (Array.isArray(camp.acciones)) {
          for (let i = 0; i < camp.acciones.length; i += 1) {
            const v = checkRow(camp.acciones[i], `automation.campanias[${c}].acciones[${i}]`);
            if (!v.ok) return v;
          }
        }
      }
    }
  }
  return { ok: true };
}

/**
 * Slice V3: estructura V2 + workspaceId canónico en slice y entidades.
 * @param {unknown} slice
 * @param {string} [expectedWorkspaceId]
 * @param {object[]} [tenantsExtra]
 * @param {import('../../core/organizations/workspace.js').CatalogoWorkspaces} [catalogo]
 */
export function validarSliceV3(slice, expectedWorkspaceId, tenantsExtra, catalogo) {
  const base = validarSliceV2(slice, expectedWorkspaceId || (slice && slice.tenantId), tenantsExtra);
  if (!base.ok) return base;
  if (!slice.workspaceId || typeof slice.workspaceId !== 'string') {
    return { ok: false, reason: 'workspaceId_ausente' };
  }
  if (slice.tenantId && slice.tenantId !== slice.workspaceId) {
    return { ok: false, reason: 'workspace_tenant_incoherente' };
  }
  if (expectedWorkspaceId != null && slice.workspaceId !== expectedWorkspaceId) {
    return { ok: false, reason: 'workspaceId_slice_incoherente' };
  }
  const cat = catalogo || (Array.isArray(tenantsExtra)
    ? crearCatalogoWorkspaces(tenantsExtra.map((t) => t && t.id).filter(Boolean))
    : catalogoWorkspaces());
  if (!cat.conoce(slice.workspaceId)) {
    return { ok: false, reason: 'workspace_desconocido' };
  }
  return validarWorkspaceEnEntidades(slice, slice.workspaceId);
}

/**
 * @param {object} world
 * @param {import('../../core/organizations/workspace.js').CatalogoWorkspaces} [catalogo]
 */
export function crearWorldSnapshotV3(world, catalogo) {
  const cat = catalogo || catalogoWorkspaces();
  const byWorkspace = {};
  const src = (world && world.byWorkspace) || (world && world.byTenant) || {};
  for (const [id, slice] of Object.entries(src)) {
    if (!cat.conoce(id)) {
      const err = new Error('workspace_desconocido');
      err.code = 'workspace_desconocido';
      throw err;
    }
    byWorkspace[id] = sellarWorkspaceEnSlice(slice, id);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    tenants: clonar((world && world.tenants) || listarTenants()),
    byWorkspace,
  };
}

/**
 * Alias legacy del nombre TenantSnapshot → WorkspaceSnapshotV3.
 * @param {string} workspaceId
 * @param {object} slice
 * @param {import('../../core/organizations/workspace.js').CatalogoWorkspaces} [catalogo]
 */
export function crearWorkspaceSnapshotV3(workspaceId, slice, catalogo) {
  const cat = catalogo || catalogoWorkspaces();
  if (!cat.conoce(workspaceId)) {
    const err = new Error('workspace_desconocido');
    err.code = 'workspace_desconocido';
    throw err;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    workspaceId,
    tenantId: workspaceId,
    data: sellarWorkspaceEnSlice(slice, workspaceId),
  };
}

/** Alias de compatibilidad: nombre histórico TenantSnapshot. */
export const crearTenantSnapshotV3 = crearWorkspaceSnapshotV3;

function validarSliceV3Bound(slice, expectedId, tenantsExtra) {
  return validarSliceV3(slice, expectedId, tenantsExtra);
}

function esWorldDeVersionV3(obj, catalogo) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schemaVersion !== SCHEMA_VERSION) return false;
  if (!Array.isArray(obj.tenants)) return false;
  if (!obj.byWorkspace || typeof obj.byWorkspace !== 'object' || Array.isArray(obj.byWorkspace)) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'byTenant')) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'data')) return false;
  const cat = catalogo || crearCatalogoWorkspaces(
    (obj.tenants || []).map((t) => t && t.id).filter(Boolean),
  );
  for (const [id, slice] of Object.entries(obj.byWorkspace)) {
    if (id !== (slice && slice.workspaceId)) return false;
    const v = validarSliceV3(slice, id, obj.tenants, cat);
    if (!v.ok) return false;
  }
  return true;
}

/** Valida WorldSnapshotV3. */
export function esWorldSnapshotV3(obj, catalogo) {
  return esWorldDeVersionV3(obj, catalogo);
}

/**
 * Valida WorkspaceSnapshotV3 (alias TenantSnapshotV3).
 * @param {object} obj
 * @param {string} [expectedWorkspaceId]
 * @param {import('../../core/organizations/workspace.js').CatalogoWorkspaces} [catalogo]
 */
export function esWorkspaceSnapshotV3(obj, expectedWorkspaceId, catalogo) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof obj.workspaceId !== 'string' || !obj.workspaceId) return false;
  if (typeof obj.tenantId === 'string' && obj.tenantId !== obj.workspaceId) return false;
  if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'byWorkspace')) return false;
  if (Object.prototype.hasOwnProperty.call(obj, 'byTenant')) return false;
  const coh = coherenciaWorkspaceIds({
    solicitado: expectedWorkspaceId,
    envelope: obj.workspaceId,
    slice: obj.data && obj.data.workspaceId,
    workspace: obj.tenantId,
  });
  if (!coh.ok) return false;
  const cat = catalogo || catalogoWorkspaces();
  return validarSliceV3(obj.data, obj.workspaceId, null, cat).ok;
}

/** Alias legacy. */
export const esTenantSnapshotV3 = esWorkspaceSnapshotV3;

/**
 * Convierte un WorldSnapshotV3 (u V2) a forma runtime `{ tenants, byTenant }`.
 * Una sola fuente de verdad en disco (byWorkspace); byTenant es vista runtime.
 * @param {object} snap
 */
export function mundoRuntimeDesdeSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return { tenants: listarTenants(), byTenant: {} };
  if (snap.schemaVersion === SCHEMA_VERSION && snap.byWorkspace) {
    return {
      tenants: clonar(snap.tenants || listarTenants()),
      byTenant: clonar(snap.byWorkspace),
    };
  }
  if (snap.byTenant) {
    return {
      tenants: clonar(snap.tenants || listarTenants()),
      byTenant: clonar(snap.byTenant),
    };
  }
  return { tenants: clonar(snap.tenants || listarTenants()), byTenant: {} };
}

/** Alias: creación del snapshot actual (V3). */
export const crearWorldSnapshot = crearWorldSnapshotV3;
export const crearTenantSnapshot = crearWorkspaceSnapshotV3;
export const crearWorkspaceSnapshot = crearWorkspaceSnapshotV3;
