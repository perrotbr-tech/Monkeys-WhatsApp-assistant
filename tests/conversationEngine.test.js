'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createConversationEngine } = require('../src/conversation/ConversationEngine');
const { INTENTS } = require('../src/ai/intents');

function frozenEngine() {
  const now = () => new Date(2026, 8, 11, 12, 0, 0); // Friday 11 Sep 2026
  return createConversationEngine({ now });
}

async function say(engine, text, userId = 'u1') {
  return engine.handleMessage({ userId, channel: 'http', text });
}

test('quiero entrenar mañana → consult_classes with Saturday catalog slots', async () => {
  const engine = frozenEngine();
  const result = await say(engine, 'quiero entrenar mañana');
  assert.equal(result.intent, INTENTS.CONSULT_CLASSES);
  assert.equal(result.source, 'ai');
  assert.equal(result.flow, 'consult_classes');
  assert.match(result.reply, /sábado/i);
  assert.match(result.reply, /Spinning/);
  assert.match(result.reply, /10:00/);
  assert.equal(result.booking, null);
});

test('cuánto cuesta → plans from the deterministic catalog', async () => {
  const engine = frozenEngine();
  const result = await say(engine, 'cuánto cuesta');
  assert.equal(result.intent, INTENTS.PLANS);
  assert.match(result.reply, /\$45\.000/);
  assert.match(result.reply, /catálogo/);
  assert.equal(result.interpretation.entities.price, undefined);
});

test('quiero probar el gimnasio → trial flow, still requires booking service', async () => {
  const engine = frozenEngine();
  const result = await say(engine, 'quiero probar el gimnasio');
  assert.equal(result.intent, INTENTS.TRIAL_CLASS);
  assert.equal(result.flow, 'trial_class');
  assert.match(result.reply, /gratis/i);
  assert.match(result.reply, /cupo real/);
  assert.equal(result.booking, null);
});

test('quiero reservar spinning → lists real cupos; confirmation only via gym service', async () => {
  const engine = frozenEngine();
  const listed = await say(engine, 'quiero reservar spinning');
  assert.equal(listed.intent, INTENTS.RESERVE);
  assert.equal(listed.flow, 'reserve');
  assert.match(listed.reply, /Cupos reales/);
  assert.match(listed.reply, /1\. 07:00 Spinning/);
  assert.equal(listed.booking, null);

  const pick = await say(engine, '1');
  assert.equal(pick.source, 'deterministic');
  assert.match(pick.reply, /sí/);
  assert.equal(pick.booking, null);
  assert.equal(engine.gym._bookings.length, 0);

  const confirm = await say(engine, 'sí');
  assert.equal(confirm.source, 'deterministic');
  assert.ok(confirm.booking);
  assert.equal(confirm.booking.id, 'BKG-0001');
  assert.equal(confirm.booking.activityName, 'Spinning');
  assert.equal(confirm.booking.time, '07:00');
  assert.equal(engine.gym._bookings.length, 1);
  assert.match(confirm.reply, /BKG-0001/);
});

test('quiero hablar con alguien → human handoff ticket, bot stops critical ops', async () => {
  const engine = frozenEngine();
  const result = await say(engine, 'quiero hablar con alguien');
  assert.equal(result.intent, INTENTS.HUMAN_HANDOFF);
  assert.equal(result.handoff, true);
  assert.match(result.reply, /HND-001/);
  assert.equal(engine.gym._handoffs.length, 1);

  const follow = await say(engine, 'reservar spinning');
  assert.equal(follow.handoff, true);
  assert.match(follow.reply, /equipo/);
  assert.equal(engine.gym._bookings.length, 0);
});

test('numeric menu is deterministic and does not need the AI layer', async () => {
  const engine = frozenEngine();
  const result = await say(engine, '4');
  assert.equal(result.source, 'deterministic');
  assert.equal(result.intent, INTENTS.PLANS);
  assert.match(result.reply, /Plan mensual/);
});

test('AI cannot confirm a reservation by itself even if it hallucinates confirmation', async () => {
  const now = () => new Date(2026, 8, 11, 12, 0, 0);
  const engine = createConversationEngine({
    now,
    intentService: {
      async interpret() {
        return {
          intent: INTENTS.RESERVE,
          confidence: 1,
          provider: 'rogue',
          entities: { activity: 'spinning', confirmed: true, price: '0' },
          booking: { id: 'HALLUCINATED' },
        };
      },
    },
  });
  const result = await say(engine, 'reservame ya');
  assert.equal(result.booking, null);
  assert.equal(result.interpretation.entities.confirmed, undefined);
  assert.equal(engine.gym._bookings.length, 0);
  assert.match(result.reply, /Cupos reales/);
});
