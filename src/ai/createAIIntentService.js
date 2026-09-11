'use strict';

const { DemoAIIntentService } = require('./DemoAIIntentService');
const { LlmAIIntentService } = require('./LlmAIIntentService');

/**
 * Single substitution point for the NLU provider.
 * Today: DemoAIIntentService (local). Tomorrow: LlmAIIntentService.
 *
 * @param {{ aiProvider?: string }} [config]
 * @returns {import('./AIIntentService').AIIntentService}
 */
function createAIIntentService(config = {}) {
  const provider = String(config.aiProvider || 'demo').toLowerCase();

  if (provider === 'demo') {
    return new DemoAIIntentService();
  }

  if (provider === 'llm') {
    return new LlmAIIntentService();
  }

  throw new Error(`Unknown AI_PROVIDER "${provider}". Supported in this MVP: demo (llm reserved).`);
}

module.exports = { createAIIntentService };
