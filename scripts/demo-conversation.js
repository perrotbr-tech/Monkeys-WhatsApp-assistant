'use strict';

const { createConversationEngine } = require('../src/conversation/ConversationEngine');

async function main() {
  const now = () => new Date(2026, 8, 11, 12, 0, 0);
  const engine = createConversationEngine({ now });
  const userId = 'demo';
  const turns = [
    'hola',
    'quiero entrenar mañana',
    'cuánto cuesta',
    'quiero probar el gimnasio',
    'spinning',
    '1',
    'sí',
    'quiero hablar con alguien',
  ];

  for (const text of turns) {
    const result = await engine.handleMessage({ userId, channel: 'http', text });
    console.log(`\n> ${text}`);
    console.log(`  intent=${result.intent || '-'} source=${result.source} flow=${result.flow || '-'}`);
    console.log(result.reply.replace(/^/gm, '  '));
    if (result.booking) console.log(`  booking=${result.booking.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
