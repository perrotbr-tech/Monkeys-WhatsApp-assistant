'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DemoAIIntentService } = require('../src/ai/DemoAIIntentService');
const { INTENTS } = require('../src/ai/intents');
const { createAIIntentService } = require('../src/ai/createAIIntentService');
const { LlmAIIntentService } = require('../src/ai/LlmAIIntentService');
const { sanitizeInterpretation } = require('../src/ai/sanitizeInterpretation');

const EXAMPLES = [
  { text: 'quiero entrenar mañana', intent: INTENTS.CONSULT_CLASSES, activity: undefined, dateHint: 'tomorrow' },
  { text: 'quiero probar el gimnasio', intent: INTENTS.TRIAL_CLASS },
  { text: 'cuánto cuesta', intent: INTENTS.PLANS },
  { text: 'quiero reservar spinning', intent: INTENTS.RESERVE, activity: 'spinning' },
  { text: 'quiero hablar con alguien', intent: INTENTS.HUMAN_HANDOFF },
];

test('DemoAIIntentService maps the MVP natural-language examples', async () => {
  const ai = new DemoAIIntentService();
  for (const example of EXAMPLES) {
    const result = await ai.interpret(example.text);
    assert.equal(result.intent, example.intent, example.text);
    assert.equal(result.provider, 'demo');
    assert.ok(result.confidence >= 0.8, example.text);
    if (example.activity) assert.equal(result.entities.activity, example.activity);
    if (example.dateHint) assert.equal(result.entities.dateHint, example.dateHint);
  }
});

test('DemoAIIntentService never returns prices, slots, or confirmations', async () => {
  const ai = new DemoAIIntentService();
  const result = await ai.interpret('cuánto cuesta el plan mensual de spinning mañana');
  assert.equal(result.intent, INTENTS.PLANS);
  assert.equal(result.entities.price, undefined);
  assert.equal(result.entities.prices, undefined);
  assert.equal(result.entities.slots, undefined);
  assert.equal(result.entities.confirmed, undefined);
  assert.equal(result.entities.availability, undefined);
  assert.deepEqual(Object.keys(result.entities).sort(), ['activity', 'dateHint'].sort());
});

test('DemoAIIntentService does not call fetch / any external AI', async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = async () => {
    called += 1;
    throw new Error('network should not be used');
  };
  try {
    const ai = new DemoAIIntentService();
    await ai.interpret('quiero reservar yoga el martes a las 19');
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('createAIIntentService defaults to demo and can point at the LLM stub', async () => {
  const demo = createAIIntentService({ aiProvider: 'demo' });
  assert.equal(demo.constructor.name, 'DemoAIIntentService');

  const llm = createAIIntentService({ aiProvider: 'llm' });
  assert.ok(llm instanceof LlmAIIntentService);
  await assert.rejects(
    () => llm.interpret('hola'),
    /not enabled in this MVP/,
  );

  assert.throws(() => createAIIntentService({ aiProvider: 'openai' }), /Unknown AI_PROVIDER/);
});

test('sanitizeInterpretation drops hallucinated business data', () => {
  const clean = sanitizeInterpretation({
    intent: INTENTS.RESERVE,
    confidence: 1.4,
    provider: 'llm',
    entities: {
      activity: 'spinning',
      price: '$99',
      slots: 'plenty',
      confirmed: true,
      availability: 12,
      dateHint: 'tomorrow',
    },
    bookingId: 'FAKE',
  });
  assert.equal(clean.intent, INTENTS.RESERVE);
  assert.equal(clean.confidence, 1);
  assert.deepEqual(clean.entities, { activity: 'spinning', dateHint: 'tomorrow' });
  assert.equal(clean.bookingId, undefined);
});

test('unknown phrases stay unknown', async () => {
  const ai = new DemoAIIntentService();
  const result = await ai.interpret('asdf qwerty');
  assert.equal(result.intent, INTENTS.UNKNOWN);
});
