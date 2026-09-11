'use strict';

const { INTENTS, INTENT_VALUES, ALLOWED_ENTITIES } = require('./intents');

/**
 * Safety net for any AIIntentService implementation (demo or future LLM).
 * Drops prices, cupos, horarios inventados, and confirmation flags.
 */
function sanitizeInterpretation(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const intent = INTENT_VALUES.has(source.intent) ? source.intent : INTENTS.UNKNOWN;

  let confidence = Number(source.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(1, Math.max(0, confidence));

  const incoming = source.entities && typeof source.entities === 'object' ? source.entities : {};
  const entities = {};
  for (const key of ALLOWED_ENTITIES) {
    if (typeof incoming[key] === 'string' && incoming[key].trim()) {
      entities[key] = incoming[key].trim();
    }
  }

  return {
    intent,
    confidence,
    entities,
    provider: typeof source.provider === 'string' ? source.provider : 'unknown',
  };
}

module.exports = { sanitizeInterpretation };
