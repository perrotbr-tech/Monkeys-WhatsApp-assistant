'use strict';

const express = require('express');
const { generateReply } = require('./assistant');
const { extractTextMessages } = require('./webhook');

/**
 * Build the Express app. Dependencies are injected so tests can supply a
 * fake WhatsApp client and deterministic clock.
 */
function createApp(config, deps = {}) {
  const whatsapp = deps.whatsapp;
  const logger = deps.logger || console;
  const now = deps.now;

  if (!whatsapp) {
    throw new Error('createApp requires a whatsapp client dependency');
  }

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', liveMode: config.liveMode });
  });

  // Webhook verification handshake (Meta calls this once on setup).
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.verifyToken) {
      logger.log('Webhook verified');
      return res.status(200).send(String(challenge ?? ''));
    }
    return res.sendStatus(403);
  });

  // Inbound messages.
  app.post('/webhook', async (req, res) => {
    // Acknowledge immediately so Meta does not retry.
    res.sendStatus(200);

    const messages = extractTextMessages(req.body);
    for (const msg of messages) {
      try {
        const reply = generateReply(msg.text, { now });
        await whatsapp.sendText(msg.from, reply);
        logger.log(`Replied to ${msg.from}`);
      } catch (err) {
        logger.error(`Failed to handle message ${msg.id}: ${err.message}`);
      }
    }
  });

  return app;
}

module.exports = { createApp };
