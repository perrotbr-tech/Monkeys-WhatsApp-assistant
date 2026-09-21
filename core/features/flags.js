/**
 * Feature flags de módulos (E3A).
 * Gestión habilitada; Forja deshabilitada. Feature desconocido → deshabilitado.
 */

export const FEATURES_DEFAULT = Object.freeze({
  gestion: true,
  forja: false,
});

/**
 * Normaliza el mapa de features de un workspace/config.
 * @param {{ features?: Record<string, boolean> }|Record<string, boolean>|null|undefined} fuente
 * @returns {Record<string, boolean>}
 */
export function featuresDe(fuente) {
  let raw = {};
  if (fuente && typeof fuente === 'object') {
    if (fuente.features && typeof fuente.features === 'object') {
      raw = fuente.features;
    } else if (!('id' in fuente) && !('slug' in fuente)) {
      raw = fuente;
    }
  }
  /** @type {Record<string, boolean>} */
  const out = {
    gestion: raw.gestion !== false,
    forja: raw.forja === true,
  };
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'gestion' || k === 'forja') continue;
    out[k] = v === true;
  }
  return out;
}

/**
 * Consulta si un módulo está habilitado.
 * Desconocido o distinto de true → false.
 * @param {Record<string, boolean>|null|undefined} features
 * @param {string} nombre
 * @returns {boolean}
 */
export function featureHabilitado(features, nombre) {
  const key = String(nombre || '');
  if (!key || !features || typeof features !== 'object') return false;
  return features[key] === true;
}

export function gestionHabilitada(features) {
  return featureHabilitado(features, 'gestion');
}

export function forjaHabilitada(features) {
  return featureHabilitado(features, 'forja');
}
