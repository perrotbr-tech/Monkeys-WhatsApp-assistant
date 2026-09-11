'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createConversationEngine } = require('../src/conversation/ConversationEngine');

function fakeWhatsApp() {
  const sent = [];
  return {
    sent,
    async sendText(to, body) {
      sent.push({ to, body });
      return { delivered: false, devMode: true };
    },
  };
}

function build() {
  const now = () => new Date(2026, 8, 11, 12, 0, 0);
  const engine = createConversationEngine({ now });
  const whatsapp = fakeWhatsApp();
  const app = createApp(
    { verifyToken: 'test-token', liveMode: false, aiProvider: 'demo' },
    { whatsapp, engine },
  );
  return { app, whatsapp, engine };
}

test('GET /health reports demo AI provider and no LLM', async () => {
  const { app } = build();
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.aiProvider, 'demo');
  assert.equal(res.body.llmEnabled, false);
});

test('GET /webhook verifies with the configured token', async () => {
  const { app } = build();
  const ok = await request(app).get('/webhook').query({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'test-token',
    'hub.challenge': '12345',
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.text, '12345');

  const bad = await request(app).get('/webhook').query({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'wrong',
    'hub.challenge': '12345',
  });
  assert.equal(bad.status, 403);
});

test('POST /chat routes natural language through the hybrid engine', async () => {
  const { app } = build();
  const res = await request(app)
    .post('/chat')
    .send({ userId: 'ana', text: 'quiero reservar spinning' });
  assert.equal(res.status, 200);
  assert.equal(res.body.intent, 'reserve');
  assert.equal(res.body.source, 'ai');
  assert.match(res.body.reply, /Spinning/);
  assert.equal(res.body.booking, null);
});

test('POST /webhook future WhatsApp channel uses the same engine', async () => {
  const { app, whatsapp } = build();
  const res = await request(app)
    .post('/webhook')
    .send({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '0',
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: '15551234567',
                    id: 'wamid.1',
                    type: 'text',
                    text: { body: 'cuánto cuesta' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

  assert.equal(res.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(whatsapp.sent.length, 1);
  assert.equal(whatsapp.sent[0].to, '15551234567');
  assert.match(whatsapp.sent[0].body, /\$45\.000/);
});
