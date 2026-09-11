'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');

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

const baseConfig = {
  verifyToken: 'test-token',
  liveMode: false,
  apiVersion: 'v21.0',
};

test('GET /health reports status', async () => {
  const app = createApp(baseConfig, { whatsapp: fakeWhatsApp() });
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('GET /webhook verifies with correct token', async () => {
  const app = createApp(baseConfig, { whatsapp: fakeWhatsApp() });
  const res = await request(app).get('/webhook').query({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'test-token',
    'hub.challenge': '12345',
  });
  assert.equal(res.status, 200);
  assert.equal(res.text, '12345');
});

test('GET /webhook rejects a wrong token', async () => {
  const app = createApp(baseConfig, { whatsapp: fakeWhatsApp() });
  const res = await request(app).get('/webhook').query({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'wrong',
    'hub.challenge': '12345',
  });
  assert.equal(res.status, 403);
});

test('POST /webhook generates and sends a reply', async () => {
  const wa = fakeWhatsApp();
  const app = createApp(baseConfig, { whatsapp: wa });

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
                  { from: '15551234567', id: 'wamid.1', type: 'text', text: { body: 'ping' } },
                ],
              },
            },
          ],
        },
      ],
    });

  assert.equal(res.status, 200);

  // The POST handler acks immediately then processes asynchronously; wait a tick.
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(wa.sent.length, 1);
  assert.equal(wa.sent[0].to, '15551234567');
  assert.equal(wa.sent[0].body, 'pong');
});
