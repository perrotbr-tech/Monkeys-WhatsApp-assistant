/** Contrato de persistencia: snapshots V1/V2/V3, migraciones y adaptadores. */

export {
  CARGA, PersistenciaError, CODIGOS,
} from './estados.js';

export {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  CAMPOS_SLICE,
  CAMPOS_ENTIDAD_V3,
  crearWorldSnapshotV1,
  crearTenantSnapshotV1,
  crearWorldSnapshotV2,
  crearTenantSnapshotV2,
  crearWorldSnapshotV3,
  crearWorkspaceSnapshotV3,
  crearTenantSnapshotV3,
  crearWorldSnapshot,
  crearTenantSnapshot,
  crearWorkspaceSnapshot,
  normalizarSlice,
  sellarWorkspaceEnSlice,
  validarSliceV1,
  validarSliceV2,
  validarSliceV3,
  validarSedesSliceV2,
  validarSedeIdEstable,
  validarWorkspaceEnEntidades,
  idsSedeConfigurados,
  coherenciaTenantIds,
  coherenciaWorkspaceIds,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  esWorldSnapshotV2,
  esTenantSnapshotV2,
  esWorldSnapshotV3,
  esWorkspaceSnapshotV3,
  esTenantSnapshotV3,
  sliceDe,
  camposMinimosPresentes,
  mundoRuntimeDesdeSnapshot,
} from './snapshots.js';

export {
  migrateV0toV1,
  migrateV1toV2,
  migrateV2toV3,
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
  bootstrapWorkspace,
  componerMundo,
} from './cargar.js';

export { crearAdaptadorJson } from './json.js';
export { crearAdaptadorLocal } from './local.js';
export {
  assertMundoEscritura,
  assertTenantEscritura,
  assertWorkspaceEscritura,
  prepararMundoParaEscritura,
  proyectarRuntimeAWorldV3,
  envelopeTenantEscritura,
  envelopeWorkspaceEscritura,
} from './escritura.js';
