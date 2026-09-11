'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { extractTextMessages } = require('../src/webhook');

function payloadWith(messages) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '0', changes: [{ field: 'messages', value: { messages } }] }],
  };
}

test('extracts a text message', () => {
  const out = extractTextMessages(
    payloadWith([{ from: '15551234567', id: 'wamid.1', type: 'text', text: { body: 'ping' } }]),
  );
  assert.deepEqual(out, [{ from: '15551234567', id: 'wamid.1', text: 'ping' }]);
});

test('ignores non-text messages', () => {
  const out = extractTextMessages(
    payloadWith([{ from: '1', id: 'wamid.2', type: 'image', image: { id: 'x' } }]),
  );
  assert.deepEqual(out, []);
});

test('handles malformed payloads gracefully', () => {
  assert.deepEqual(extractTextMessages(undefined), []);
  assert.deepEqual(extractTextMessages({}), []);
  assert.deepEqual(extractTextMessages({ entry: 'nope' }), []);
});
