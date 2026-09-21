/**
 * Validación de escritura: nunca normalizar un V1 inválido ni completar campos ausentes.
 */

import { clonar } from '../../data/demo.js';
import { PersistenciaError, CODIGOS } from './estados.js';
import {
  SCHEMA_VERSION,
  crearWorldSnapshotV1,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  validarSliceV1,
  coherenciaTenantIds,
} from './snapshots.js';

/**
 * Valida un mundo antes de persistirlo.
 * - schemaVersion: 1 → debe pasar esWorldSnapshotV1 íntegramente (sin normalizar).
 * - sin versión → valida tenantId existentes vs clave; luego se puede construir snapshot.
 *
 * @param {unknown} world
 * @returns {'v1'|'internal'}
 */
export function assertMundoEscritura(world) {
  if (!world || typeof world !== 'object' || Array.isArray(world)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'mundo de escritura inválido');
  }
  if (Object.prototype.hasOwnProperty.call(world, 'schemaVersion')) {
    if (world.schemaVersion !== SCHEMA_VERSION) {
      throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'schemaVersion incompatible al guardar mundo');
    }
    if (!esWorldSnapshotV1(world)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'WorldSnapshotV1 inválido al guardar');
    }
    return 'v1';
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
 * Prepara un WorldSnapshotV1 para escritura tras validar el original.
 * No usa crearWorldSnapshotV1 como sanitizador de un V1 inválido.
 * @param {object} world
 * @returns {import('./snapshots.js').WorldSnapshotV1}
 */
export function prepararMundoParaEscritura(world) {
  const kind = assertMundoEscritura(world);
  if (kind === 'v1') return clonar(world);
  return crearWorldSnapshotV1(world);
}

/**
 * Valida payload de guardarTenant / escribirTenant.
 * Si declara schemaVersion: debe ser TenantSnapshotV1 completo (nunca slice plano).
 * Slice plano (sin schemaVersion): coherencia + SliceV1 estricto sin rellenar.
 *
 * @param {string} tenantId
 * @param {unknown} sliceOrSnap
 * @returns {'v1'|'plain'}
 */
export function assertTenantEscritura(tenantId, sliceOrSnap) {
  if (!sliceOrSnap || typeof sliceOrSnap !== 'object' || Array.isArray(sliceOrSnap)) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, 'payload de escritura inválido');
  }

  if (Object.prototype.hasOwnProperty.call(sliceOrSnap, 'schemaVersion')) {
    if (sliceOrSnap.schemaVersion !== SCHEMA_VERSION) {
      throw new PersistenciaError(CODIGOS.INCOMPATIBLE, 'schemaVersion incompatible al guardar tenant');
    }
    // Identidad primero: contradicción de tenant ≠ incompleto estructural
    if (typeof sliceOrSnap.tenantId === 'string' && sliceOrSnap.tenantId !== tenantId) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId del envelope contradice el solicitado');
    }
    if (sliceOrSnap.data && typeof sliceOrSnap.data === 'object'
      && typeof sliceOrSnap.data.tenantId === 'string'
      && sliceOrSnap.data.tenantId !== tenantId) {
      throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId del slice contradice el solicitado');
    }
    // V1 incompleto (sin data, campos faltantes, etc.) → rechazar; nunca tratar como slice plano
    if (!esTenantSnapshotV1(sliceOrSnap, tenantId)) {
      throw new PersistenciaError(CODIGOS.CORRUPTO, 'TenantSnapshotV1 incompleto o inválido al guardar');
    }
    return 'v1';
  }

  // Slice plano: sin schemaVersion
  if (sliceOrSnap.tenantId != null && sliceOrSnap.tenantId !== tenantId) {
    throw new PersistenciaError(CODIGOS.AMBIGUO, 'tenantId del slice contradice el solicitado');
  }
  const paraValidar = sliceOrSnap.tenantId
    ? sliceOrSnap
    : { ...sliceOrSnap, tenantId };
  const v = validarSliceV1(paraValidar, tenantId);
  if (!v.ok) {
    throw new PersistenciaError(CODIGOS.CORRUPTO, `slice incompleto al guardar (${v.reason})`);
  }
  return 'plain';
}

/**
 * Envuelve un payload ya validado en TenantSnapshotV1 sin rellenar campos ausentes.
 * @param {string} tenantId
 * @param {object} sliceOrSnap
 */
export function envelopeTenantEscritura(tenantId, sliceOrSnap) {
  const kind = assertTenantEscritura(tenantId, sliceOrSnap);
  if (kind === 'v1') return clonar(sliceOrSnap);
  const data = clonar(sliceOrSnap);
  data.tenantId = tenantId;
  return {
    schemaVersion: SCHEMA_VERSION,
    tenantId,
    data,
  };
}

export { coherenciaTenantIds };
