/** Contrato de persistencia E1B: snapshots, migraciones y adaptadores. */

export {
  CARGA, PersistenciaError, CODIGOS,
} from './estados.js';

export {
  SCHEMA_VERSION,
  CAMPOS_SLICE,
  crearWorldSnapshotV1,
  crearTenantSnapshotV1,
  normalizarSlice,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  sliceDe,
  camposMinimosPresentes,
} from './snapshots.js';

export {
  migrateV0toV1,
  migrarCuposMes,
  migrarMembresiasFaltantes,
  migrarSliceV0,
  claveEstadoV1,
  resolverClaveLocal,
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
