/**
 * Clasificación de carga y resolución segura (vacío / V0 / V1 / V2 / V3 / corrupto).
 */

import { clonar, clonarMundo, clonarDemo } from '../../data/demo.js';
import { listarTenants, catalogoWorkspaces } from '../../data/tenants.js';
import { fechaHoy } from '../dates.js';
import { relojActivo } from '../clock.js';
import { CARGA, PersistenciaError, CODIGOS } from './estados.js';
import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  crearWorldSnapshotV3,
  crearWorkspaceSnapshotV3,
  esWorldSnapshotV1,
  esTenantSnapshotV1,
  esWorldSnapshotV2,
  esTenantSnapshotV2,
  esWorldSnapshotV3,
  esWorkspaceSnapshotV3,
  sliceDe,
  validarSliceV3,
  coherenciaWorkspaceIds,
  mundoRuntimeDesdeSnapshot,
} from './snapshots.js';
import { migrateV1toV2, migrateV2toV3, migrateToCurrent } from './migraciones.js';

/**
 * Parsea texto JSON. Fallo de parse → corrupto (no demo).
 * @param {string|null|undefined} text
 * @returns {{ status: string, value?: object, error?: PersistenciaError }}
 */
export function parsearJsonSeguro(text) {
  if (text == null || text === '') {
    return { status: CARGA.VACIO };
  }
  if (typeof text !== 'string') {
    return {
      status: CARGA.CORRUPTO,
      error: new PersistenciaError(CODIGOS.CORRUPTO, 'contenido no textual'),
    };
  }
  try {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object') {
      return {
        status: CARGA.CORRUPTO,
        error: new PersistenciaError(CODIGOS.CORRUPTO, 'JSON raíz no es objeto'),
      };
    }
    return { status: 'parsed', value };
  } catch (err) {
    return {
      status: CARGA.CORRUPTO,
      error: new PersistenciaError(CODIGOS.CORRUPTO, 'JSON inválido', { cause: err }),
    };
  }
}

/**
 * @param {unknown} value
 * @param {'world'|'tenant'} kind
 * @param {{ expectedTenantId?: string, catalogo?: object }} [opts]
 * @returns {typeof CARGA[keyof typeof CARGA]}
 */
export function clasificarDocumento(value, kind, opts = {}) {
  if (value == null) return CARGA.VACIO;
  if (typeof value !== 'object' || Array.isArray(value)) return CARGA.CORRUPTO;

  const catalogo = opts.catalogo || catalogoWorkspaces();
  const version = value.schemaVersion;
  if (version != null
    && version !== SCHEMA_VERSION
    && version !== SCHEMA_VERSION_V2
    && version !== SCHEMA_VERSION_V1) {
    return CARGA.CORRUPTO;
  }

  if (kind === 'world') {
    if (version === SCHEMA_VERSION) {
      if (Object.prototype.hasOwnProperty.call(value, 'data')) return CARGA.CORRUPTO;
      if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
      return esWorldSnapshotV3(value, catalogo) ? CARGA.V3_VALIDO : CARGA.CORRUPTO;
    }
    if (version === SCHEMA_VERSION_V2) {
      if (Object.prototype.hasOwnProperty.call(value, 'data')) return CARGA.CORRUPTO;
      return esWorldSnapshotV2(value) ? CARGA.V2_MIGABLE : CARGA.CORRUPTO;
    }
    if (version === SCHEMA_VERSION_V1) {
      if (Object.prototype.hasOwnProperty.call(value, 'data')) return CARGA.CORRUPTO;
      return esWorldSnapshotV1(value) ? CARGA.V1_MIGABLE : CARGA.CORRUPTO;
    }
    if (value.byTenant && typeof value.byTenant === 'object' && !Array.isArray(value.byTenant)) {
      if (Object.prototype.hasOwnProperty.call(value, 'data') && value.data != null) {
        return CARGA.CORRUPTO;
      }
      return CARGA.V0_MIGABLE;
    }
    return CARGA.CORRUPTO;
  }

  // tenant / workspace
  const expected = opts.expectedTenantId;
  if (version === SCHEMA_VERSION) {
    if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
    if (Object.prototype.hasOwnProperty.call(value, 'byWorkspace')) return CARGA.CORRUPTO;
    return esWorkspaceSnapshotV3(value, expected, catalogo) ? CARGA.V3_VALIDO : CARGA.CORRUPTO;
  }
  if (version === SCHEMA_VERSION_V2) {
    if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
    return esTenantSnapshotV2(value, expected) ? CARGA.V2_MIGABLE : CARGA.CORRUPTO;
  }
  if (version === SCHEMA_VERSION_V1) {
    if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
    return esTenantSnapshotV1(value, expected) ? CARGA.V1_MIGABLE : CARGA.CORRUPTO;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'byTenant')) return CARGA.CORRUPTO;
  return CARGA.V0_MIGABLE;
}

/**
 * Resuelve un documento ya parseado a snapshot actual (V3), bootstrap o error.
 * Nunca reemplaza datos corruptos con demo.
 *
 * @param {object|null|undefined} value
 * @param {{ kind: 'world'|'tenant', tenantId?: string, workspaceId?: string, fechaRef?: string, clock?: object, catalogo?: object }} opts
 */
export function resolverCarga(value, opts) {
  const kind = opts.kind;
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const catalogo = opts.catalogo || catalogoWorkspaces();
  const workspaceId = opts.workspaceId || opts.tenantId;
  const status = clasificarDocumento(value, kind, {
    expectedTenantId: workspaceId,
    catalogo,
  });

  if (status === CARGA.VACIO) {
    if (kind === 'world') {
      const snap = crearWorldSnapshotV3(clonarMundo(fechaRef), catalogo);
      return {
        status,
        snapshot: snap,
        world: mundoRuntimeDesdeSnapshot(snap),
        bootstrapped: true,
      };
    }
    const id = workspaceId;
    if (!id) {
      return {
        status: CARGA.CORRUPTO,
        error: new PersistenciaError(CODIGOS.CORRUPTO, 'tenant vacío sin workspaceId'),
      };
    }
    const snap = crearWorkspaceSnapshotV3(id, clonarDemo(id, fechaRef), catalogo);
    return {
      status,
      snapshot: snap,
      slice: clonar(snap.data),
      bootstrapped: true,
    };
  }

  if (status === CARGA.CORRUPTO) {
    return {
      status,
      error: new PersistenciaError(
        value && value.schemaVersion != null
          && value.schemaVersion !== SCHEMA_VERSION
          && value.schemaVersion !== SCHEMA_VERSION_V2
          && value.schemaVersion !== SCHEMA_VERSION_V1
          ? CODIGOS.INCOMPATIBLE
          : CODIGOS.CORRUPTO,
        'snapshot corrupto o incompatible',
      ),
    };
  }

  if (status === CARGA.V3_VALIDO || status === CARGA.V1_VALIDO) {
    if (kind === 'world') {
      const snap = clonar(value);
      return {
        status: CARGA.V3_VALIDO,
        snapshot: snap,
        world: mundoRuntimeDesdeSnapshot(snap),
        migrated: false,
        bootstrapped: false,
      };
    }
    const snap = clonar(value);
    const coh = coherenciaWorkspaceIds({
      solicitado: workspaceId,
      envelope: snap.workspaceId || snap.tenantId,
      slice: snap.data && (snap.data.workspaceId || snap.data.tenantId),
    });
    if (!coh.ok || !validarSliceV3(snap.data, snap.workspaceId || snap.tenantId, null, catalogo).ok) {
      return {
        status: CARGA.CORRUPTO,
        error: new PersistenciaError(CODIGOS.CORRUPTO, 'WorkspaceSnapshotV3 incoherente o incompleto'),
      };
    }
    return {
      status: CARGA.V3_VALIDO,
      snapshot: snap,
      slice: clonar(snap.data),
      migrated: false,
      bootstrapped: false,
    };
  }

  // V0_MIGABLE, V1_MIGABLE o V2_MIGABLE
  try {
    let snapshot;
    if (status === CARGA.V2_MIGABLE || status === CARGA.V2_VALIDO) {
      snapshot = migrateV2toV3(value, {
        kind,
        tenantId: workspaceId,
        workspaceId,
        catalogo,
        fechaRef,
        clock,
      });
    } else if (status === CARGA.V1_MIGABLE) {
      const v2 = migrateV1toV2(value, {
        kind,
        tenantId: workspaceId,
        fechaRef,
        clock,
      });
      snapshot = migrateV2toV3(v2, {
        kind,
        tenantId: workspaceId,
        workspaceId,
        catalogo,
        fechaRef,
        clock,
      });
    } else {
      snapshot = migrateToCurrent(value, {
        kind,
        tenantId: workspaceId,
        workspaceId,
        catalogo,
        fechaRef,
        clock,
      });
    }
    if (kind === 'world') {
      return {
        status,
        snapshot,
        world: mundoRuntimeDesdeSnapshot(snapshot),
        migrated: true,
        bootstrapped: false,
      };
    }
    return {
      status,
      snapshot,
      slice: sliceDe(snapshot, workspaceId || snapshot.workspaceId || snapshot.tenantId),
      migrated: true,
      bootstrapped: false,
    };
  } catch (err) {
    const code = err && err.code === CODIGOS.AMBIGUO ? CODIGOS.AMBIGUO : CODIGOS.CORRUPTO;
    return {
      status: CARGA.CORRUPTO,
      error: new PersistenciaError(code, 'migración a V3 fallida', { cause: err }),
    };
  }
}

/**
 * Bootstrap explícito de mundo demo (reset) → V3.
 */
export function bootstrapMundo(opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const catalogo = opts.catalogo || catalogoWorkspaces();
  return crearWorldSnapshotV3(clonarMundo(fechaRef), catalogo);
}

/**
 * Bootstrap explícito de workspace/tenant demo (reset) → V3.
 */
export function bootstrapTenant(tenantId, opts = {}) {
  const clock = opts.clock || relojActivo();
  const fechaRef = opts.fechaRef || fechaHoy(undefined, clock);
  const catalogo = opts.catalogo || catalogoWorkspaces();
  return crearWorkspaceSnapshotV3(tenantId, clonarDemo(tenantId, fechaRef), catalogo);
}

/** Alias E3B. */
export const bootstrapWorkspace = bootstrapTenant;

/**
 * Compone un WorldSnapshotV3 a partir de slices por workspace.
 */
export function componerMundo(byTenantSlices, tenants, catalogo) {
  return crearWorldSnapshotV3({
    tenants: tenants || listarTenants(),
    byWorkspace: byTenantSlices,
    byTenant: byTenantSlices,
  }, catalogo || catalogoWorkspaces());
}

export { CARGA, PersistenciaError, CODIGOS, migrateToCurrent, migrateV2toV3 };
