/**
 * Contrato de escala de bienestar (demo Forja).
 * Dirección única: 5 = mejor estado, 1 = peor estado.
 */

export const ESCALA_DIR =
  '1 = peor estado / 5 = mejor estado';

export const DIMENSIONES = {
  fatiga: {
    nombre: 'Fatiga',
    descripciones: {
      5: 'Muy fresco',
      4: 'Fresco',
      3: 'Normal',
      2: 'Más cansado de lo normal',
      1: 'Siempre cansado',
    },
  },
  sueno: {
    nombre: 'Calidad del sueño',
    descripciones: {
      5: 'Muy reparador',
      4: 'Bueno',
      3: 'Dificultad para dormir',
      2: 'Sueño inquieto',
      1: 'Insomnio',
    },
  },
  dolorMuscular: {
    nombre: 'Dolor o rigidez muscular',
    descripciones: {
      5: 'Se siente muy bien',
      4: 'Se siente bien',
      3: 'Normal',
      2: 'Mayor dolor o rigidez',
      1: 'Muy adolorido',
    },
  },
  estres: {
    nombre: 'Estrés',
    descripciones: {
      5: 'Muy relajado',
      4: 'Relajado',
      3: 'Normal',
      2: 'Estresado',
      1: 'Muy estresado',
    },
  },
  animo: {
    nombre: 'Ánimo',
    descripciones: {
      5: 'Muy positivo',
      4: 'Bueno',
      3: 'Menor interés',
      2: 'Irritable o tenso',
      1: 'Muy irritable o decaído',
    },
  },
};

export const CLAVES_DIMENSION = Object.keys(DIMENSIONES);

/** Descripción del valor seleccionado (1–5). */
export function descripcionDimension(clave, valor) {
  const dim = DIMENSIONES[clave];
  if (!dim || valor == null) return '';
  return dim.descripciones[valor] || '';
}

/**
 * Evalúa si el wellness debe generar alerta para el coach.
 * No modifica planificación: solo informa.
 *
 * Reglas:
 * - dolorActual === "alto" → alerta
 * - cualquier dimensión === 1 → alerta
 * - dos o más dimensiones <= 2 → alerta
 * - 4 o 5 nunca generan alerta por sí solos
 */
export function evaluarAlertaWellness(wellness) {
  const w = wellness || {};
  const motivos = [];

  if (w.dolorActual === 'alto') {
    motivos.push('dolor_alto');
  }

  const enUno = CLAVES_DIMENSION.filter((k) => w[k] === 1);
  if (enUno.length) {
    motivos.push(`dimension_en_1:${enUno.join(',')}`);
  }

  const enBajo = CLAVES_DIMENSION.filter((k) => typeof w[k] === 'number' && w[k] <= 2);
  if (enBajo.length >= 2) {
    motivos.push(`dos_o_mas_lte_2:${enBajo.join(',')}`);
  }

  return { alerta: motivos.length > 0, motivos };
}

export function requiereAlertaWellness(wellness) {
  return evaluarAlertaWellness(wellness).alerta;
}
