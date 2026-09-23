/** Estados de carga del contrato de persistencia (E1B–E3B). */

export const CARGA = Object.freeze({
  VACIO: 'empty',
  V0_MIGABLE: 'v0_migratable',
  /** Snapshot V1 (E1B) válido; requiere migrateV1toV2→V3. */
  V1_MIGABLE: 'v1_migratable',
  /** Snapshot V2 (E2) válido; requiere migrateV2toV3. */
  V2_MIGABLE: 'v2_migratable',
  /**
   * Alias E2: históricamente significaba “snapshot actual válido” (entonces V2).
   * En E3B el actual es V3; V2_VALIDO pasa a significar V2 migrable.
   */
  V2_VALIDO: 'v2_migratable',
  /** Snapshot de la versión actual (V3) válido. */
  V3_VALIDO: 'v3_valid',
  /**
   * Alias histórico E1B/E2: “snapshot actual válido”.
   * En E3B apunta a V3.
   */
  V1_VALIDO: 'v3_valid',
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
