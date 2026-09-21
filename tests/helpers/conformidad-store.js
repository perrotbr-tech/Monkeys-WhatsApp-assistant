/**
 * Harness compartido de conformidad Store (JSON + localStorage).
 * Cada factory expone la misma superficie de sesión de dominio + persistencia.
 */

import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { crearRelojFijo } from '../../engine/clock.js';
import { crearMemoria, combinarPersistencia } from '../../engine/store.js';
import { crearEngine } from '../../engine/conversation.js';
import { crearAutomation } from '../../engine/automation.js';
import { crearStorageMemoria } from '../../engine/store-local.js';
import {
  crearAdaptadorJson,
  crearAdaptadorLocal,
  CARGA,
  claveEstadoV1,
  CLAVE_LOCAL_LEGACY_MONKEYS,
  crearTenantSnapshotV1,
  crearTenantSnapshotV2,
  crearWorldSnapshotV1,
  crearWorldSnapshotV2,
  camposMinimosPresentes,
  esWorldSnapshotV1,
  esWorldSnapshotV2,
  esTenantSnapshotV1,
  esTenantSnapshotV2,
} from '../../engine/persistencia/index.js';
import { clonarDemo, clonarMundo } from '../../data/demo.js';

export const FECHA_FIJA = '2026-09-14';
export const INSTANTE_FIJO = '2026-09-14T15:00:00.000Z';

function abrirSesion(world, clock, fechaRef) {
  const memoria = crearMemoria(world, { clock });
  const engines = Object.create(null);
  const autos = Object.create(null);
  for (const id of Object.keys(world.byTenant || {})) {
    engines[id] = crearEngine({ memoria }, id, { fechaRef, clock });
    autos[id] = crearAutomation(memoria.sliceExport(id), id, { clock });
  }
  for (const id of ['monkeys', 'soma']) {
    if (!engines[id]) {
      engines[id] = crearEngine({ memoria }, id, { fechaRef, clock });
      autos[id] = crearAutomation(memoria.sliceExport(id), id, { clock });
    }
  }
  return { memoria, engines, autos };
}

function mergeYGuardar(session, adapter) {
  const snap = session.memoria.snapshot();
  for (const id of Object.keys(session.autos)) {
    if (!snap.byTenant[id]) continue;
    const merged = combinarPersistencia(snap.byTenant[id], session.autos[id].exportar());
    snap.byTenant[id] = merged;
    session.autos[id].hidratar(merged);
  }
  adapter.guardar(snap);
  return snap;
}

/**
 * @param {'json'|'localStorage'} kind
 */
export function crearFactory(kind) {
  return {
    kind,
    /**
     * @param {{ seedText?: string|null, seedWorld?: object|null, seedLocal?: Record<string,string>|null }} [opts]
     */
    create(opts = {}) {
      const clock = crearRelojFijo(INSTANTE_FIJO);
      const fechaRef = FECHA_FIJA;
      let cleanup = () => {};
      let adapter;
      let getRawWorldText;
      let setRawCorrupt;
      let getTenantRaw;
      let setTenantRaw;

      if (kind === 'json') {
        const dir = mkdtempSync(join(tmpdir(), 'forkza-e1b-'));
        const filePath = join(dir, 'data.json');
        cleanup = () => { try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } };
        if (opts.seedText != null) writeFileSync(filePath, opts.seedText, 'utf8');
        else if (opts.seedWorld) writeFileSync(filePath, JSON.stringify(opts.seedWorld), 'utf8');
        // seedText === null → archivo ausente (vacío)
        adapter = crearAdaptadorJson({ filePath, clock, fechaRef });
        getRawWorldText = () => (existsSync(filePath) ? readFileSync(filePath, 'utf8') : null);
        setRawCorrupt = (text) => writeFileSync(filePath, text, 'utf8');
        getTenantRaw = () => null;
        setTenantRaw = () => {};
      } else {
        const storage = crearStorageMemoria();
        if (opts.seedLocal) {
          for (const [k, v] of Object.entries(opts.seedLocal)) storage.setItem(k, v);
        } else if (opts.seedWorld) {
          const world = opts.seedWorld.byTenant
            ? opts.seedWorld
            : crearWorldSnapshotV2(opts.seedWorld);
          for (const [id, slice] of Object.entries(world.byTenant || {})) {
            let snap;
            if (world.schemaVersion === 2) snap = crearTenantSnapshotV2(id, slice);
            else if (world.schemaVersion === 1) snap = crearTenantSnapshotV1(id, slice);
            else snap = slice;
            storage.setItem(claveEstadoV1(id), JSON.stringify(snap));
            if (!world.schemaVersion) {
              storage.setItem(claveEstadoV1(id), JSON.stringify(slice));
            }
          }
        } else if (opts.seedText != null) {
          // seedText applied to monkeys key for corrupt tests
          storage.setItem(claveEstadoV1('monkeys'), opts.seedText);
        }
        adapter = crearAdaptadorLocal({ storage, clock, fechaRef });
        getRawWorldText = () => {
          const parts = {};
          for (const id of ['monkeys', 'soma']) {
            const t = storage.getItem(claveEstadoV1(id));
            if (t) parts[id] = t;
          }
          return Object.keys(parts).length ? JSON.stringify(parts) : null;
        };
        setRawCorrupt = (text) => {
          storage.setItem(claveEstadoV1('monkeys'), text);
        };
        getTenantRaw = (tenantId) => storage.getItem(claveEstadoV1(tenantId))
          || (tenantId === 'monkeys' ? storage.getItem(CLAVE_LOCAL_LEGACY_MONKEYS) : null);
        setTenantRaw = (tenantId, text, { legacy = false } = {}) => {
          if (legacy && tenantId === 'monkeys') storage.setItem(CLAVE_LOCAL_LEGACY_MONKEYS, text);
          else storage.setItem(claveEstadoV1(tenantId), text);
        };
      }

      let session = null;

      function loadOrThrow() {
        const carga = adapter.cargar();
        if (carga.status === CARGA.CORRUPTO) {
          return { ok: false, carga, error: carga.error };
        }
        session = abrirSesion(carga.world, clock, fechaRef);
        return { ok: true, carga, session };
      }

      function persist() {
        return mergeYGuardar(session, adapter);
      }

      function reload() {
        const carga = adapter.cargar();
        if (carga.status === CARGA.CORRUPTO) throw carga.error;
        session = abrirSesion(carga.world, clock, fechaRef);
        return session;
      }

      return {
        kind,
        clock,
        fechaRef,
        adapter,
        cleanup,
        loadOrThrow,
        persist,
        reload,
        get session() { return session; },
        getRawWorldText,
        setRawCorrupt,
        getTenantRaw,
        setTenantRaw,
        engine(tenantId) { return session.engines[tenantId]; },
        auto(tenantId) { return session.autos[tenantId]; },
        memoria() { return session.memoria; },
      };
    },
  };
}

export {
  clonarDemo,
  clonarMundo,
  crearTenantSnapshotV1,
  crearTenantSnapshotV2,
  crearWorldSnapshotV1,
  crearWorldSnapshotV2,
  camposMinimosPresentes,
  esWorldSnapshotV1,
  esWorldSnapshotV2,
  esTenantSnapshotV1,
  esTenantSnapshotV2,
  CARGA,
  claveEstadoV1,
  CLAVE_LOCAL_LEGACY_MONKEYS,
  combinarPersistencia,
};
