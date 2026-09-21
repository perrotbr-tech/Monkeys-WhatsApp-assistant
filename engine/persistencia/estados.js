/** Estados de carga del contrato de persistencia E1B. */

export const CARGA = Object.freeze({
  VACIO: 'empty',
  V0_MIGABLE: 'v0_migratable',
  /** Snapshot V1 (E1B) válido; requiere migrateV1toV2. */
  V1_MIGABLE: 'v1_migratable',
  /** Snapshot de la versión actual (V2) válido. */
  V2_VALIDO: 'v2_valid',
  /**
   * Alias histórico E1B: en E2 significa “snapshot actual válido” (V2).
   * Conservado para no romper harnesses que aún importan el nombre.
   */
  V1_VALIDO: 'v2_valid',
  CORRUPTO: 'corrupt',
});

export class PersistenciaError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ cause?: unknown }} [opts]
   */
  constructor(code, message, opts = {}) {
    super(message, opts.cause ? { cause: opts.cause } : undefined);
    this.name = 'PersistenciaError';
    this.code = code;
  }
}

export const CODIGOS = Object.freeze({
  CORRUPTO: 'PERSISTENCIA_CORRUPTA',
  INCOMPATIBLE: 'PERSISTENCIA_INCOMPATIBLE',
  AMBIGUO: 'PERSISTENCIA_AMBIGUA',
  ESCRITURA: 'PERSISTENCIA_ESCRITURA',
});
