'use strict';

const { AIIntentService } = require('./AIIntentService');
const { INTENTS } = require('./intents');

const ACTIVITIES = [
  { id: 'spinning', aliases: ['spinning', 'spin', 'ciclo', 'bici'] },
  { id: 'yoga', aliases: ['yoga'] },
  { id: 'funcional', aliases: ['funcional', 'functional', 'hiit'] },
  { id: 'box', aliases: ['box', 'boxing', 'boxeo'] },
  { id: 'pilates', aliases: ['pilates'] },
  { id: 'zumba', aliases: ['zumba'] },
];

const WEEKDAYS = [
  { id: 'monday', aliases: ['lunes'] },
  { id: 'tuesday', aliases: ['martes'] },
  { id: 'wednesday', aliases: ['miercoles'] },
  { id: 'thursday', aliases: ['jueves'] },
  { id: 'friday', aliases: ['viernes'] },
  { id: 'saturday', aliases: ['sabado'] },
  { id: 'sunday', aliases: ['domingo'] },
];

/**
 * Local, offline NLU. No network, no API keys, no LLM.
 * Recognizes a handful of natural-language intents for the gym MVP.
 */
class DemoAIIntentService extends AIIntentService {
  /**
   * @param {string} text
   * @returns {Promise<import('./AIIntentService').IntentInterpretation>}
   */
  async interpret(text) {
    const normalized = normalize(text);
    const entities = extractEntities(normalized);

    if (!normalized) {
      return pack(INTENTS.UNKNOWN, 0, entities);
    }

    if (matchesHandoff(normalized)) {
      return pack(INTENTS.HUMAN_HANDOFF, 0.93, entities);
    }
    if (matchesTrial(normalized)) {
      return pack(INTENTS.TRIAL_CLASS, 0.92, entities);
    }
    if (matchesReserve(normalized)) {
      return pack(INTENTS.RESERVE, 0.92, entities);
    }
    if (matchesPlans(normalized)) {
      return pack(INTENTS.PLANS, 0.9, entities);
    }
    if (matchesConsult(normalized, entities)) {
      return pack(INTENTS.CONSULT_CLASSES, 0.88, entities);
    }
    if (matchesGeneral(normalized, entities)) {
      return pack(INTENTS.GENERAL_QUESTION, 0.8, entities);
    }

    return pack(INTENTS.UNKNOWN, 0.25, entities);
  }
}

function pack(intent, confidence, entities) {
  return { intent, confidence, entities, provider: 'demo' };
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[¿?¡!.,;:()"'“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text, phrases) {
  return phrases.some((p) => text.includes(p));
}

function matchesHandoff(t) {
  return hasAny(t, [
    'hablar con alguien',
    'hablar con una persona',
    'hablar con un humano',
    'hablar con una humana',
    'hablar con una asesora',
    'hablar con un asesor',
    'atencion humana',
    'operador',
    'operadora',
    'recepcion',
    'recepcionista',
    'persona real',
    'ser humano',
    'derivame',
    'pasame con alguien',
    'quiero un humano',
    'no quiero el bot',
  ]);
}

function matchesTrial(t) {
  return hasAny(t, [
    'clase de prueba',
    'clase prueba',
    'clase gratis',
    'probar el gimnasio',
    'probar el gym',
    'probar gym',
    'dia de prueba',
    'primera clase',
    'prueba gratis',
    'trial',
    'conocer el gimnasio',
    'conocer el gym',
  ]) || /\bprobar\b/.test(t);
}

function matchesReserve(t) {
  return hasAny(t, [
    'reservar',
    'reserva',
    'anotame',
    'anotarme',
    'inscribirme',
    'inscribime',
    'quiero un cupo',
    'dame un lugar',
    'sacar turno',
    'agendarme',
  ]);
}

function matchesPlans(t) {
  return hasAny(t, [
    'cuanto cuesta',
    'cuanto sale',
    'cuanto vale',
    'que precio',
    'precios',
    'precio',
    'planes',
    'plan mensual',
    'membresia',
    'cuota',
    'abono',
    'tarifa',
    'tarifas',
  ]);
}

function matchesConsult(t, entities) {
  if (hasAny(t, ['horario de atencion', 'horarios de atencion'])) return false;
  if (hasAny(t, [
    'clases',
    'clase',
    'horarios',
    'horario',
    'entrenar',
    'entreno',
    'grilla',
    'agenda',
    'actividades',
    'que hay',
    'que dan',
    'ver clases',
  ])) {
    return true;
  }
  // "spinning mañana" / "yoga el martes" without a verb still means consult.
  return Boolean(entities.activity && (entities.dateHint || entities.timeHint));
}

function matchesGeneral(t, entities) {
  if (entities.topic) return true;
  return hasAny(t, [
    'donde queda',
    'donde estan',
    'direccion',
    'ubicacion',
    'estacionamiento',
    'parking',
    'a que hora abren',
    'a que hora cierran',
    'cuando abren',
    'cuando cierran',
    'horario de atencion',
    'que es monkeys',
    'quienes son',
    'contacto',
    'telefono',
    'instagram',
  ]);
}

function extractEntities(t) {
  const entities = {};
  const activity = extractActivity(t);
  if (activity) entities.activity = activity;

  const dateHint = extractDateHint(t);
  if (dateHint) entities.dateHint = dateHint;

  const timeHint = extractTimeHint(t);
  if (timeHint) entities.timeHint = timeHint;

  const topic = extractTopic(t);
  if (topic) entities.topic = topic;

  return entities;
}

function extractActivity(t) {
  for (const activity of ACTIVITIES) {
    for (const alias of activity.aliases) {
      const re = new RegExp(`\\b${alias}\\b`, 'i');
      if (re.test(t)) return activity.id;
    }
  }
  return null;
}

function extractDateHint(t) {
  if (/\bhoy\b/.test(t)) return 'today';
  if (/\bpasado manana\b/.test(t)) return 'day_after_tomorrow';
  if (/\bmanana\b/.test(t)) return 'tomorrow';
  for (const day of WEEKDAYS) {
    if (t.includes(day.aliases[0])) return day.id;
  }
  return null;
}

function extractTimeHint(t) {
  const explicit = t.match(/\ba las (\d{1,2})(?::(\d{2}))?\b/);
  if (explicit) {
    const hh = String(explicit[1]).padStart(2, '0');
    const mm = explicit[2] || '00';
    return `${hh}:${mm}`;
  }
  const compact = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(?:hs|hrs|h)\b/);
  if (compact) {
    const hh = String(compact[1]).padStart(2, '0');
    const mm = compact[2] || '00';
    return `${hh}:${mm}`;
  }
  return null;
}

function extractTopic(t) {
  if (hasAny(t, ['donde', 'direccion', 'ubicacion', 'queda'])) return 'location';
  if (hasAny(t, ['estacionamiento', 'parking'])) return 'parking';
  if (hasAny(t, ['abren', 'cierran', 'horario de atencion'])) return 'hours';
  if (hasAny(t, ['que es monkeys', 'quienes son'])) return 'about';
  if (hasAny(t, ['contacto', 'telefono', 'instagram'])) return 'contact';
  return null;
}

module.exports = { DemoAIIntentService, normalize };
