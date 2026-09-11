'use strict';

/**
 * Minimal contract for natural-language understanding.
 *
 * Implementations MUST:
 *  - interpret language
 *  - identify an intent from `INTENTS`
 *  - extract allowed entities (activity, dateHint, timeHint, topic)
 *  - optionally hint a general-question topic
 *
 * Implementations MUST NOT:
 *  - invent cupos, horarios, or precios
 *  - confirm reservations
 *  - mutate business rules or catalogs
 *  - call deterministic services
 *
 * Critical operations always run in ConversationEngine via gym services.
 *
 * To swap DemoAIIntentService for a real LLM later:
 *  1. Implement this class (see LlmAIIntentService).
 *  2. Return the same `IntentInterpretation` shape.
 *  3. Point `AI_PROVIDER` at that implementation in `createAIIntentService`.
 *  4. Do not let the model return prices, slots, or confirmations —
 *     `sanitizeInterpretation` strips unknown fields as a safety net.
 *
 * @typedef {Object} IntentInterpretation
 * @property {string} intent
 * @property {number} confidence  0..1
 * @property {Record<string, string>} entities
 * @property {string} provider    e.g. "demo" | "llm"
 */

class AIIntentService {
  /**
   * @param {string} _text
   * @param {object} [_context]
   * @returns {Promise<IntentInterpretation>}
   */
  async interpret(_text, _context) {
    throw new Error('AIIntentService.interpret() must be implemented by a subclass');
  }
}

module.exports = { AIIntentService };
