'use strict';

/**
 * Extract inbound text messages from a WhatsApp Cloud API webhook payload.
 * WhatsApp is a future production channel; the payload shape is already wired.
 */
function extractTextMessages(payload) {
  const results = [];
  const entries = Array.isArray(payload && payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry && entry.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = (change && change.value) || {};
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        if (msg && msg.type === 'text' && msg.text && typeof msg.text.body === 'string') {
          results.push({ from: msg.from, id: msg.id, text: msg.text.body });
        }
      }
    }
  }

  return results;
}

module.exports = { extractTextMessages };
