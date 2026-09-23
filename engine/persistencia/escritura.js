/**
 * Validación de escritura: nunca normalizar un snapshot inválido ni completar campos ausentes.
 * sellarWorkspaceEnSlice / normalizarSlice NO se usan en escrituras runtime normales.
 */

import { clonar } from '../../data/demo.js';
import { catalogoWorkspaces, listarTenants } from '../../data/tenants.js';
import { PersistenciaError, CODIGOS } from './estados.js';
import {
  SCHEMA_VERSION,
  esWorldSnapshotV3,
  esWorkspaceSnapshotV3,
  validarSliceV3,
  coherenciaWorkspaceIds,
} from './snapshots.js';

/**
 * Proyecta un mundo runtime `{ byTenant|byWorkspace }` a WorldSnapshotV3.
 * Solo cambia el contenedor; no sella, no completa arrays ni corrige IDs.
 * @param {object} world
 * @param {object} [catalogo]
 */
export function proyectarRuntimeAWorldV3(world, catalogo) {
  const cat = catalogo || catalogoWorkspaces();
  if (!world || typeof world !== 'object' || Array.isArray(world)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'mundo de escritura inválido');
  }
  const src = world.byWorkspace || world.byTenant;
  if (!src || typeof src !== 'object' || Array.isArray(src)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'mundo interno sin byWorkspace/byTenant');
  }
  const byWorkspace = {};
  for (const [id, slice] of Object.entries(src)) {
    if (!cat.conoce(id)) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, `workspace desconocido al proyectar: ${id}`);
    }
    const data = clonar(slice);
    const v = validarSliceV3(data, id, world.tenants, cat);
    if (!v.ok) {
      throw new PersistenciaError(
        CODIGOS.CORRUPTO,
        `slice inválido al proyectar ${id}: ${v.reason}`,
      );
    }
    byWorkspace[id] = data;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    tenants: clonar(world.tenants || listarTenants()),
    byWorkspace,
  };
}

/**
 * Valida un mundo antes de persistirlo.
 * - schemaVersion actual → debe pasar esWorldSnapshotV3 íntegramente (sin normalizar).
 * - sin versión → cada slice debe pasar validarSliceV3 (sin sellar ni completar).
 *
 * @param {unknown} world
 * @param {object} [catalogo]
 * @returns {'v3'|'internal'}
 */
export function assertMundoEscritura(world, catalogo) {
  const cat = catalogo || catalogoWorkspaces();
  if (!world || typeof world !== 'object' || Array.isArray(world)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'mundo de escritura inválido');
  }
  if (Object.prototype.hasOwnProperty.call(world, 'schemaVersion')) {
    if (world.schemaVersion !== SCHEMA_VERSION) {
      throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'schemaVersion incompatible al guardar mundo');
    }
    if (!esWorldSnapshotV3(world, cat)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'WorldSnapshotV3 inválido al guardar');
    }
    return 'v3';
  }
  const map = world.byWorkspace || world.byTenant;
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'mundo interno sin byWorkspace/byTenant');
  }
  for (const [id, slice] of Object.entries(map)) {
    if (!slice || typeof slice !== 'object' || Array.isArray(slice)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, `slice inválido en ${id}`);
    }
    if (slice.tenantId != null && slice.tenantId !== id) {
      throw new PersistenciaError(
        CODIGOS.AMBIGUO,
        `tenantId incoherente en mapa.${id} (slice.tenantId=${slice.tenantId})`,
      );
    }
    if (slice.workspaceId != null && slice.workspaceId !== id) {
      throw new PersistenciaError(
        CODIGOS.AMBIGUO,
        `workspaceId incoherente en mapa.${id} (slice.workspaceId=${slice.workspaceId})`,
      );
    }
    if (!cat.conoce(id)) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, `workspace desconocido: ${id}`);
    }
    const v = validarSliceV3(slice, id, world.tenants, cat);
    if (!v.ok) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, `slice inválido en ${id}: ${v.reason}`);
    }
  }
  return 'internal';
}

/**
 * Prepara un WorldSnapshotV3 para escritura tras validar el original.
 * No sella ni normaliza: proyección de contenedor + validación estricta.
 * @param {object} world
 * @param {object} [catalogo]
 */
export function prepararMundoParaEscritura(world, catalogo) {
  const cat = catalogo || catalogoWorkspaces();
  const kind = assertMundoEscritura(world, cat);
  if (kind === 'v3') return clonar(world);
  return proyectarRuntimeAWorldV3(world, cat);
}

/**
 * Valida payload de guardarTenant / escribirWorkspace.
 * @param {string} workspaceId
 * @param {unknown} sliceOrSnap
 * @param {object} [catalogo]
 * @returns {'v3'|'plain'}
 */
export function assertTenantEscritura(workspaceId, sliceOrSnap, catalogo) {
  const cat = catalogo || catalogoWorkspaces();
  if (!sliceOrSnap || typeof sliceOrSnap !== 'object' || Array.isArray(sliceOrSnap)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'payload de escritura inválido');
  }

  if (Object.prototype.hasOwnProperty.call(sliceOrSnap, 'schemaVersion')) {
    if (sliceOrSnap.schemaVersion !== SCHEMA_VERSION) {
      throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'schemaVersion incompatible al guardar workspace');
    }
    const envWs = sliceOrSnap.workspaceId || sliceOrSnap.tenantId;
    if (typeof envWs === 'string' && envWs !== workspaceId) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, 'workspaceId del envelope contradice el solicitado');
    }
    if (sliceOrSnap.tenantId && sliceOrSnap.workspaceId
      && sliceOrSnap.tenantId !== sliceOrSnap.workspaceId) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, 'workspace_tenant_incoherente en envelope');
    }
    if (sliceOrSnap.data && typeof sliceOrSnap.data === 'object') {
      const dataWs = sliceOrSnap.data.workspaceId || sliceOrSnap.data.tenantId;
      if (typeof dataWs === 'string' && dataWs !== workspaceId) {
        throw new PersistenciaError(CODIGOS.AMBIGUO, 'workspaceId del slice contradice el solicitado');
      }
    }
    if (!esWorkspaceSnapshotV3(sliceOrSnap, workspaceId, cat)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'WorkspaceSnapshotV3 incompleto o inválido al guardar');
    }
    return 'v3';
  }

  if (sliceOrSnap.tenantId != null && sliceOrSnap.tenantId !== workspaceId) {
    throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId del slice contradice el solicitado');
  }
  if (sliceOrSnap.workspaceId != null && sliceOrSnap.workspaceId !== workspaceId) {
    throw new PersistenciaError(CODIGOS.AMBIGUO, 'workspaceId del slice contradice el solicitado');
  }
  if (!cat.conoce(workspaceId)) {
    throw new PersistenciaError(CODIGOS.AMBIGUO, `workspace desconocido: ${workspaceId}`);
  }
  const v = validarSliceV3(sliceOrSnap, workspaceId, null, cat);
  if (!v.ok) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, `slice incompleto o inválido al guardar (${v.reason})`);
  }
  return 'plain';
}

/** Alias E3B. */
export const assertWorkspaceEscritura = assertTenantEscritura;

/**
 * Envuelve un payload en WorkspaceSnapshotV3.
 * - Documento con schemaVersion: debe ser V3 completo (sin rellenar).
 * - Slice plano: debe ya ser V3 coherente; no se sella ni normaliza.
 * @param {string} workspaceId
 * @param {object} sliceOrSnap
 * @param {object} [catalogo]
 */
export function envelopeTenantEscritura(workspaceId, sliceOrSnap, catalogo) {
  const cat = catalogo || catalogoWorkspaces();
  const kind = assertTenantEscritura(workspaceId, sliceOrSnap, cat);
  if (kind === 'v3') return clonar(sliceOrSnap);
  const data = clonar(sliceOrSnap);
  return {
    schemaVersion: SCHEMA_VERSION,
    workspaceId,
    tenantId: workspaceId,
    data,
  };
}

/** Alias E3B. */
export const envelopeWorkspaceEscritura = envelopeTenantEscritura;

export { coherenciaWorkspaceIds };
