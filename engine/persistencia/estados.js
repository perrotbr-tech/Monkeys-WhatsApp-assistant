/** Estados de carga del contrato de persistencia E1B. */

export const CARGA = Object.freeze({
  VACIO: 'empty',
  V0_MIGABLE: 'v0_migratable',
  V1_VALIDO: 'v1_valid',
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
