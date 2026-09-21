/**
 * Validación de escritura: nunca normalizar un snapshot inválido ni completar campos ausentes.
 */

import { clonar } from '../../data/demo.js';
import { PersistenciaError, CODIGOS } from './estados.js';
import {
  SCHEMA_VERSION,
  crearWorldSnapshotV2,
  esWorldSnapshotV2,
  esTenantSnapshotV2,
  validarSliceV2,
  coherenciaTenantIds,
} from './snapshots.js';

/**
 * Valida un mundo antes de persistirlo.
 * - schemaVersion actual → debe pasar esWorldSnapshotV2 íntegramente (sin normalizar).
 * - sin versión → valida tenantId existentes vs clave; luego se puede construir snapshot.
 *
 * @param {unknown} world
 * @returns {'v2'|'internal'}
 */
export function assertMundoEscritura(world) {
  if (!world || typeof world !== 'object' || Array.isArray(world)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'mundo de escritura inválido');
  }
  if (Object.prototype.hasOwnProperty.call(world, 'schemaVersion')) {
    if (world.schemaVersion !== SCHEMA_VERSION) {
      throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'schemaVersion incompatible al guardar mundo');
    }
    if (!esWorldSnapshotV2(world)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'WorldSnapshotV2 inválido al guardar');
    }
    return 'v2';
  }
  if (!world.byTenant || typeof world.byTenant !== 'object' || Array.isArray(world.byTenant)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'mundo interno sin byTenant');
  }
  for (const [id, slice] of Object.entries(world.byTenant)) {
    if (slice && typeof slice === 'object' && slice.tenantId != null && slice.tenantId !== id) {
      throw new PersistenciaError(
        CODIGOS.AMBIGUO,
        `tenantId incoherente en byTenant.${id} (slice.tenantId=${slice.tenantId})`,
      );
    }
  }
  return 'internal';
}

/**
 * Prepara un WorldSnapshotV2 para escritura tras validar el original.
 * No usa crearWorldSnapshotV2 como sanitizador de un V2 inválido.
 * @param {object} world
 */
export function prepararMundoParaEscritura(world) {
  const kind = assertMundoEscritura(world);
  if (kind === 'v2') return clonar(world);
  return crearWorldSnapshotV2(world);
}

/**
 * Valida payload de guardarTenant / escribirTenant.
 * Si declara schemaVersion: debe ser TenantSnapshotV2 completo (nunca slice plano).
 * Slice plano (sin schemaVersion): coherencia + Slice estricto sin rellenar.
 *
 * @param {string} tenantId
 * @param {unknown} sliceOrSnap
 * @returns {'v2'|'plain'}
 */
export function assertTenantEscritura(tenantId, sliceOrSnap) {
  if (!sliceOrSnap || typeof sliceOrSnap !== 'object' || Array.isArray(sliceOrSnap)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'payload de escritura inválido');
  }

  if (Object.prototype.hasOwnProperty.call(sliceOrSnap, 'schemaVersion')) {
    if (sliceOrSnap.schemaVersion !== SCHEMA_VERSION) {
      throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'schemaVersion incompatible al guardar tenant');
    }
    if (typeof sliceOrSnap.tenantId === 'string' && sliceOrSnap.tenantId !== tenantId) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId del envelope contradice el solicitado');
    }
    if (sliceOrSnap.data && typeof sliceOrSnap.data === 'object'
      && typeof sliceOrSnap.data.tenantId === 'string'
      && sliceOrSnap.data.tenantId !== tenantId) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId del slice contradice el solicitado');
    }
    if (!esTenantSnapshotV2(sliceOrSnap, tenantId)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'TenantSnapshotV2 incompleto o inválido al guardar');
    }
    return 'v2';
  }

  if (sliceOrSnap.tenantId != null && sliceOrSnap.tenantId !== tenantId) {
    throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId del slice contradice el solicitado');
  }
  const paraValidar = sliceOrSnap.tenantId
    ? sliceOrSnap
    : { ...sliceOrSnap, tenantId };
  const v = validarSliceV2(paraValidar, tenantId);
  if (!v.ok) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, `slice incompleto al guardar (${v.reason})`);
  }
  return 'plain';
}

/**
 * Envuelve un payload ya validado en TenantSnapshotV2 sin rellenar campos ausentes.
 * @param {string} tenantId
 * @param {object} sliceOrSnap
 */
export function envelopeTenantEscritura(tenantId, sliceOrSnap) {
  const kind = assertTenantEscritura(tenantId, sliceOrSnap);
  if (kind === 'v2') return clonar(sliceOrSnap);
  const data = clonar(sliceOrSnap);
  data.tenantId = tenantId;
  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId,
    data,
  };
}

export { coherenciaTenantIds };
