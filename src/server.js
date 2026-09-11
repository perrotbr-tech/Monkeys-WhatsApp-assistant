'use strict';

const { loadConfig } = require('./config');
const { createWhatsAppClient } = require('./whatsapp');
const { createApp } = require('./app');

function main() {
  const config = loadConfig();
  const whatsapp = createWhatsAppClient(config);
  const app = createApp(config, { whatsapp });

  app.listen(config.port, () => {
    const mode = config.liveMode ? 'LIVE (Graph API)' : 'DEV (messages logged, not sent)';
    console.log(`Monkeys WhatsApp assistant listening on port ${config.port} [${mode}]`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { main };
