/**
 * Capa de comprensión de lenguaje natural (demo local, sin LLM ni API keys).
 * Misma firma para sustituir por LLMIntentService sin tocar reservas.
 *
 * @typedef {{ intencion: string, entidades: Record<string, string>, confianza: number }} Interpretacion
 */

export const INTENCIONES = Object.freeze({
  CLASES: 'clases',
  RESERVA: 'reserva',
  TRIAL: 'trial',
  PLANES: 'planes',
  HUMANO: 'humano',
  LOOKUP: 'lookup',
  MENU: 'menu',
  AYUDA: 'ayuda',
  DESCONOCIDA: 'desconocida',
});

const CLASES = [
  { id: 'Spinning', aliases: ['spinning', 'spin'] },
  { id: 'Funcional', aliases: ['funcional'] },
  { id: 'Yoga', aliases: ['yoga'] },
  { id: 'Cross Training', aliases: ['cross training', 'cross', 'crosstraining'] },
];

export function crearIntentService() {
  return {
    /**
     * @param {string} texto
     * @returns {Interpretacion}
     */
    detectar(texto) {
      const t = normalizar(texto);
      const entidades = {};
      const clase = extraerClase(t);
      if (clase) entidades.clase = clase;

      if (!t) return pack(INTENCIONES.DESCONOCIDA, entidades, 0);

      if (esHumano(t)) return pack(INTENCIONES.HUMANO, entidades, 0.93);
      if (esTrial(t)) return pack(INTENCIONES.TRIAL, entidades, 0.92);
      if (esLookup(t)) return pack(INTENCIONES.LOOKUP, entidades, 0.9);
      if (esReserva(t)) return pack(INTENCIONES.RESERVA, entidades, 0.92);
      if (esPlanes(t)) return pack(INTENCIONES.PLANES, entidades, 0.9);
      if (esClases(t)) return pack(INTENCIONES.CLASES, entidades, 0.88);
      if (t === 'menu' || t === 'menú' || t === 'inicio') return pack(INTENCIONES.MENU, entidades, 1);
      if (t === 'ayuda' || t === 'help') return pack(INTENCIONES.AYUDA, entidades, 0.8);

      return pack(INTENCIONES.DESCONOCIDA, entidades, 0.2);
    },
  };
}

function pack(intencion, entidades, confianza) {
  return { intencion, entidades, confianza };
}

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[¿?¡!.,;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tiene(t, frases) {
  return frases.some((f) => t.includes(f));
}

function esHumano(t) {
  return tiene(t, [
    'hablar con alguien',
    'hablar con el equipo',
    'hablar con un humano',
    'hablar con una persona',
    'necesito ayuda',
    'ejecutivo',
    'operador',
  ]) || t === 'humano';
}

function esTrial(t) {
  return tiene(t, [
    'probar el gimnasio',
    'probar el gym',
    'clase de prueba',
    'clase gratis',
    'una clase gratis',
    'probar una clase',
    'dia de prueba',
  ]);
}

function esLookup(t) {
  return tiene(t, [
    'tengo una reserva',
    'consultar mi reserva',
    'consultar reserva',
    'mi reserva',
    'codigo gym',
    'gym-2026',
  ]);
}

function esReserva(t) {
  return tiene(t, ['reservar', 'reserva', 'reservar mi cupo', 'quiero un cupo']);
}

function esPlanes(t) {
  return tiene(t, [
    'cuanto cuesta',
    'que planes',
    'planes',
    'precio',
    'precios',
    'membresia',
    'plan mensual',
  ]);
}

function esClases(t) {
  return tiene(t, [
    'entrenar',
    'que clases',
    'ver clases',
    'clases tienen',
    'horarios',
    'grilla',
  ]) || t === 'clases';
}

function extraerClase(t) {
  for (const c of CLASES) {
    for (const a of c.aliases) {
      if (t.includes(a)) return c.id;
    }
  }
  return undefined;
}
