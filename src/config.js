'use strict';

function loadConfig(env = process.env) {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID || '';
  const aiProvider = (env.AI_PROVIDER || 'demo').toLowerCase();

  return {
    port: Number.parseInt(env.PORT || '3000', 10),
    aiProvider,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN || 'dev-verify-token',
    accessToken,
    phoneNumberId,
    apiVersion: env.WHATSAPP_API_VERSION || 'v21.0',
    liveMode: Boolean(accessToken && phoneNumberId),
  };
}

module.exports = { loadConfig };
