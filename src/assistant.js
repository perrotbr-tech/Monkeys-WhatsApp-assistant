'use strict';

const HELP_TEXT = [
  'Monkeys WhatsApp Assistant',
  '',
  'Commands:',
  '  help          Show this message',
  '  ping          Health check',
  '  time          Current server time (UTC)',
  '  echo <text>   Repeat your text back',
].join('\n');

/**
 * Pure function that turns an inbound text message into a reply.
 * Kept free of I/O so it is trivial to unit test.
 *
 * @param {string} text - The inbound message body.
 * @param {{ now?: () => Date }} [opts]
 * @returns {string} The assistant reply text.
 */
function generateReply(text, opts = {}) {
  const now = opts.now || (() => new Date());
  const raw = (text || '').trim();

  if (!raw) {
    return "I didn't catch that. Send `help` to see what I can do.";
  }

  const lower = raw.toLowerCase();

  if (lower === 'help' || lower === 'menu' || lower === '?') {
    return HELP_TEXT;
  }

  if (lower === 'ping') {
    return 'pong';
  }

  if (lower === 'time') {
    return `Server time: ${now().toISOString()}`;
  }

  if (lower === 'hi' || lower === 'hello' || lower === 'hey') {
    return 'Hey there! I am the Monkeys assistant. Send `help` to get started.';
  }

  if (lower.startsWith('echo ')) {
    return raw.slice(5);
  }

  return `You said: "${raw}". Send \`help\` to see available commands.`;
}

module.exports = { generateReply, HELP_TEXT };
