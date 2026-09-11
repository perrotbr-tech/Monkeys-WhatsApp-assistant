'use strict';

/**
 * Canonical intents the ConversationEngine knows how to route.
 * An AI provider may only *identify* these; it never executes them.
 */
const INTENTS = Object.freeze({
  CONSULT_CLASSES: 'consult_classes',
  RESERVE: 'reserve',
  TRIAL_CLASS: 'trial_class',
  PLANS: 'plans',
  HUMAN_HANDOFF: 'human_handoff',
  GENERAL_QUESTION: 'general_question',
  UNKNOWN: 'unknown',
});

const INTENT_VALUES = new Set(Object.values(INTENTS));

/** Entity keys an AI layer is allowed to extract. Everything else is dropped. */
const ALLOWED_ENTITIES = Object.freeze(['activity', 'dateHint', 'timeHint', 'topic']);

module.exports = { INTENTS, INTENT_VALUES, ALLOWED_ENTITIES };
