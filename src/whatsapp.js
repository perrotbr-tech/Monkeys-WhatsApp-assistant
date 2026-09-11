'use strict';

/**
 * Minimal WhatsApp Cloud API client (future channel).
 * Dev mode logs outbound replies instead of calling Meta.
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

  return { sendText, _sent: sent };
}

module.exports = { createWhatsAppClient };
