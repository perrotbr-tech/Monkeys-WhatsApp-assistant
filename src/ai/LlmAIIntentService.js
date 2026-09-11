'use strict';

const { AIIntentService } = require('./AIIntentService');

/**
 * Placeholder for a future LLM provider (OpenAI, Anthropic, etc.).
 *
 * Substitution path:
 *   createAIIntentService({ aiProvider: 'llm' }) → this class
 *
 * When implemented, `interpret()` must return the same shape as
 * DemoAIIntentService and must not invent cupos, horarios, precios,
 * nor confirm reservations. ConversationEngine + gym services remain
 * the only path for those operations.
 *
 * This MVP does not perform any external AI call and does not require
 * API keys. Instantiating the provider is allowed so the swap interface
 * exists; `interpret()` refuses to run.
 */
class LlmAIIntentService extends AIIntentService {
  constructor(options = {}) {
    super();
    this.providerName = options.providerName || 'llm';
  }

  async interpret(_text, _context) {
    throw new Error(
      'LlmAIIntentService is not enabled in this MVP: no external LLM and no API keys. Use AI_PROVIDER=demo.',
    );
  }
}

module.exports = { LlmAIIntentService };
