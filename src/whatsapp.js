'use strict';

/**
 * Minimal WhatsApp Cloud API client.
 *
 * In live mode it POSTs to the Meta Graph API. In dev mode (no credentials)
 * it records and logs the outgoing message instead, so the whole flow is
 * runnable and testable without real WhatsApp credentials.
 */
function createWhatsAppClient(config, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const logger = deps.logger || console;
  const sent = [];

  async function sendText(to, body) {
    const message = { to, body };

    if (!config.liveMode) {
      sent.push(message);
      logger.log(`[dev-mode] would send to ${to}: ${body.replace(/\n/g, ' \\n ')}`);
      return { delivered: false, devMode: true, message };
    }

    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
    }

    sent.push(message);
    return { delivered: true, devMode: false, message };
  }

  return {
    sendText,
    // Exposed for tests / debugging in dev mode.
    _sent: sent,
  };
}

module.exports = { createWhatsAppClient };
