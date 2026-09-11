'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createWhatsAppClient } = require('../src/whatsapp');

const silentLogger = { log() {}, error() {} };

test('dev mode records without calling fetch', async () => {
  let fetchCalls = 0;
  const client = createWhatsAppClient(
    { liveMode: false },
    { logger: silentLogger, fetch: async () => { fetchCalls += 1; } },
  );

  const result = await client.sendText('15551234567', 'hello');
  assert.equal(result.devMode, true);
  assert.equal(result.delivered, false);
  assert.equal(fetchCalls, 0);
  assert.equal(client._sent.length, 1);
});

test('live mode posts to the Graph API', async () => {
  const calls = [];
  const client = createWhatsAppClient(
    {
      liveMode: true,
      apiVersion: 'v21.0',
      phoneNumberId: '999',
      accessToken: 'tok',
    },
    {
      logger: silentLogger,
      fetch: async (url, opts) => {
        calls.push({ url, opts });
        return { ok: true, status: 200, async text() { return ''; } };
      },
    },
  );

  const result = await client.sendText('15551234567', 'hi');
  assert.equal(result.delivered, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /graph\.facebook\.com\/v21\.0\/999\/messages/);
  const body = JSON.parse(calls[0].opts.body);
  assert.equal(body.text.body, 'hi');
  assert.equal(body.to, '15551234567');
});

test('live mode throws on API error', async () => {
  const client = createWhatsAppClient(
    { liveMode: true, apiVersion: 'v21.0', phoneNumberId: '1', accessToken: 't' },
    {
      logger: silentLogger,
      fetch: async () => ({ ok: false, status: 400, async text() { return 'bad'; } }),
    },
  );

  await assert.rejects(() => client.sendText('1', 'x'), /WhatsApp API error 400/);
});
