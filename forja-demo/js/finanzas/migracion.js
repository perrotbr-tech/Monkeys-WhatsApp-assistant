/**
 * Migración explícita forja-demo v1 → v2 (agrega Finanzas sin borrar deportivo).
 * Documento corrupto: no se reescribe; el caller decide.
 */

import {
  ALUMNO_AISLAMIENTO,
  enriquecerAlumnosConFinanzas,
  finanzasSeedCompleto,
  coachVisibleSeed,
  sesionDemoSeed,
  WS_FORJA,
  COACH_MATIAS,
} from './seed.js';

export const VERSION_ACTUAL = 2;

export function esEstadoV1(doc) {
  return Boolean(doc && doc.version === 1 && Array.isArray(doc.alumnos));
}

export function esEstadoV2(doc) {
  return Boolean(
    doc &&
      doc.version === 2 &&
      doc.finanzas &&
      Array.isArray(doc.finanzas.planes) &&
      Array.isArray(doc.finanzas.cargos) &&
      Array.isArray(doc.finanzas.pagos),
  );
}

export function esEstadoCorroto(doc) {
  if (!doc || typeof doc !== 'object') return true;
  if (doc.version !== 1 && doc.version !== 2) return true;
  if (!Array.isArray(doc.alumnos) || !Array.isArray(doc.grupos)) return true;
  if (doc.version === 2) {
    if (!doc.finanzas || typeof doc.finanzas !== 'object') return true;
    if (!Array.isArray(doc.finanzas.cargos)) return true;
  }
  return false;
}

/**
 * Migra v1 → v2 preservando planificación, alumnos, wellness, ejercicios, registros.
 */
export function migrarV1aV2(docV1) {
  if (!esEstadoV1(docV1)) {
    throw new Error('MIGRA_REQUIERE_V1');
  }

  const base = structuredClone(docV1);
  const alumnosEnriquecidos = enriquecerAlumnosConFinanzas(base.alumnos || []);
  const tieneAislamiento = alumnosEnriquecidos.some(
    (a) => a.id === ALUMNO_AISLAMIENTO.id,
  );
  if (!tieneAislamiento) {
    alumnosEnriquecidos.push({ ...ALUMNO_AISLAMIENTO });
  }

  const coach = {
    ...coachVisibleSeed(),
    ...(base.coach || {}),
    id: base.coach?.id || COACH_MATIAS,
    workspaceId: base.coach?.workspaceId || WS_FORJA,
  };

  return {
    ...base,
    version: VERSION_ACTUAL,
    coach,
    alumnos: alumnosEnriquecidos,
    finanzas: finanzasSeedCompleto(),
    sesionDemo: base.sesionDemo || sesionDemoSeed(),
    ui: {
      ...(base.ui || {}),
      vista: base.ui?.vista || 'inicio',
      filtrosFinanzas: base.ui?.filtrosFinanzas || {
        texto: '',
        estado: '',
        grupoId: '',
        modalidad: '',
        coachId: '',
      },
      fichaFinancieraAlumnoId: base.ui?.fichaFinancieraAlumnoId || null,
      mensajeUi: null,
    },
  };
}

export function asegurarV2(doc) {
  if (esEstadoCorroto(doc)) {
    return { ok: false, error: 'corrupto', doc: null };
  }
  if (esEstadoV2(doc)) {
    return { ok: true, doc, migrado: false };
  }
  if (esEstadoV1(doc)) {
    return { ok: true, doc: migrarV1aV2(doc), migrado: true };
  }
  return { ok: false, error: 'version_desconocida', doc: null };
}

/** Claves de persistencia: solo forja-demo; nunca las de Gestión. */
export const CLAVE_FORJA_DEMO = 'forja-demo-v1';
export const CLAVES_GESTION_PROHIBIDAS = [
  'forkza-demo',
  'forkza-mundo',
  'monkeys-whatsapp-assistant',
  'store-local',
];
