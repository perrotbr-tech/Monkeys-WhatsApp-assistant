'use strict';

const { loadConfig } = require('./config');
const { createWhatsAppClient } = require('./whatsapp');
const { createApp } = require('./app');
const { createAIIntentService } = require('./ai/createAIIntentService');
const { createConversationEngine } = require('./conversation/ConversationEngine');

function main() {
  const config = loadConfig();
  const intentService = createAIIntentService({ aiProvider: config.aiProvider });
  const engine = createConversationEngine({ intentService });
  const whatsapp = createWhatsAppClient(config);
  const app = createApp(config, { whatsapp, engine });

  app.listen(config.port, () => {
    const mode = config.liveMode ? 'LIVE (Graph API)' : 'DEV (WhatsApp replies logged, not sent)';
    console.log(`Monkeys assistant listening on port ${config.port} [${mode}] ai=${config.aiProvider}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { main };
