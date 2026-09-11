'use strict';

function loadConfig(env = process.env) {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || '';

  return {
    port: Number.parseInt(env.PORT || '3000', 10),
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || 'dev-verify-token',
    accessToken,
    phoneNumberId,
    apiVersion: env.WHATSAPP_API_VERSION || 'v21.0',
    // Live mode requires both an access token and a phone number id.
    // Otherwise we run in dev mode: outgoing messages are logged, not sent.
    liveMode: Boolean(accessToken && phoneNumberId),
  };
}

module.exports = { loadConfig };
