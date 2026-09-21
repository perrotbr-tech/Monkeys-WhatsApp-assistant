/** Contrato de persistencia: snapshots V1/V2, migraciones y adaptadores. */

export {
  CARGA, PersistenciaError, CODIGOS,
} from './estados.js';

export {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  CAMPOS_SLICE,
  crearWorldSnapshotV1,
  crearTenantSnapshotV1,
  crearWorldSnapshotV2,
  crearTenantSnapshotV2,
  crearWorldSnapshot,
  crearTenantSnapshot,
  normalizarSlice,
  validarSliceV1,
  validarSliceV2,
  validarSedesSliceV2,
  validarSedeIdEstable,
  idsSedeConfigurados,
  coherenciaTenantIds,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  esWorldSnapshotV2,
  esTenantSnapshotV2,
  sliceDe,
  camposMinimosPresentes,
} from './snapshots.js';

export {
  migrateV0toV1,
  migrateV1toV2,
  migrateToCurrent,
  migrarCuposMes,
  migrarMembresiasFaltantes,
  migrarSliceV0,
  migrarSedesSliceV1aV2,
  claveEstadoV1,
  claveEstado,
  resolverClaveLocal,
  clavesLegacyLocal,
  CLAVE_LOCAL_PREFIX,
  CLAVE_LOCAL_LEGACY_MONKEYS,
} from './migraciones.js';

export {
  parsearJsonSeguro,
  clasificarDocumento,
  resolverCarga,
  bootstrapMundo,
  bootstrapTenant,
  componerMundo,
} from './cargar.js';

export { crearAdaptadorJson } from './json.js';
export { crearAdaptadorLocal } from './local.js';
export {
  assertMundoEscritura,
  assertTenantEscritura,
  prepararMundoParaEscritura,
  envelopeTenantEscritura,
} from './escritura.js';
