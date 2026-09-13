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
  CUPOS: 'cupos',
  MI_MEMBRESIA: 'mi_membresia',
  PAGAR: 'pagar',
  MENU: 'menu',
  AYUDA: 'ayuda',
  DESCONOCIDA: 'desconocida',
});

const CLASES = [
  { id: 'Spinning', aliases: ['spinning', 'spin'] },
  { id: 'Funcional', aliases: ['funcional'] },
  { id: 'Yoga', aliases: ['yoga'] },
  { id: 'Cross Training', aliases: ['cross training'] },
  { id: 'Crosstraining', aliases: ['crosstraining'] },
  { id: 'Hyrox', aliases: ['hyrox'] },
  { id: 'Pilates', aliases: ['pilates'] },
  { id: 'Functional Kids', aliases: ['functional kids', 'kids'] },
  { id: 'Musculación', aliases: ['musculacion', 'musculación'] },
  { id: 'Kinesiología', aliases: ['kinesiologia', 'kinesiología', 'kine'] },
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
      const hora = extraerHora(t);
      if (hora) entidades.hora = hora;
      const dia = extraerDia(t);
      if (dia) entidades.dia = dia;

      if (!t) return pack(INTENCIONES.DESCONOCIDA, entidades, 0);

      if (esHumano(t)) return pack(INTENCIONES.HUMANO, entidades, 0.93);
      if (esTrial(t)) return pack(INTENCIONES.TRIAL, entidades, 0.92);
      if (esLookup(t)) return pack(INTENCIONES.LOOKUP, entidades, 0.9);
      if (esMiMembresia(t)) return pack(INTENCIONES.MI_MEMBRESIA, entidades, 0.92);
      if (esPagar(t)) return pack(INTENCIONES.PAGAR, entidades, 0.92);
      if (esCupos(t)) return pack(INTENCIONES.CUPOS, entidades, 0.9);
      if (esReserva(t)) return pack(INTENCIONES.RESERVA, entidades, 0.92);
      if (esPlanes(t)) return pack(INTENCIONES.PLANES, entidades, 0.9);
      if (esClases(t) || (clase && dia)) return pack(INTENCIONES.CLASES, entidades, 0.88);
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
    'codigo soma',
    'soma-2026',
  ]);
}

function esCupos(t) {
  return tiene(t, [
    'cuantos cupos',
    'cuántos cupos',
    'cupos me quedan',
    'cupos del plan',
    'mis cupos',
  ]);
}

function esReserva(t) {
  return tiene(t, ['reservar', 'reserva', 'reservar mi cupo', 'quiero un cupo']);
}

function esMiMembresia(t) {
  return tiene(t, [
    'mi membresia',
    'mi plan',
    'estado de mi plan',
    'vigencia',
    'como va mi plan',
  ]);
}

function esPagar(t) {
  return t === 'pagar' || tiene(t, [
    'quiero pagar',
    'pagar membresia',
    'link de pago',
    'datos de transferencia',
    'hacer una transferencia',
  ]);
}

function esPlanes(t) {
  return tiene(t, [
    'cuanto cuesta',
    'que planes',
    'planes',
    'precio',
    'precios',
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

function extraerHora(t) {
  const s = String(t || '');
  const m = s.match(/\b(\d{1,2}):(\d{2})\b/) || s.match(/\b(\d{1,2})\s+(\d{2})\b/);
  if (!m) return undefined;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return undefined;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function extraerDia(t) {
  if (/(^|\s)hoy(\s|$)/.test(t)) return 'hoy';
  if (t.includes('manana')) return 'mañana';
  for (const d of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']) {
    if (t.includes(d)) return d;
  }
  return undefined;
}
