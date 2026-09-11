'use strict';

const express = require('express');
const { extractTextMessages } = require('./webhook');

/**
 * HTTP surface:
 *  - POST /chat  demo channel (no WhatsApp required)
 *  - WhatsApp webhook is wired as the future production channel
 */
function createApp(config, deps = {}) {
  const whatsapp = deps.whatsapp;
  const engine = deps.engine;
  const logger = deps.logger || console;

  if (!whatsapp) {
    throw new Error('createApp requires a whatsapp client dependency');
  }
  if (!engine) {
    throw new Error('createApp requires a conversation engine dependency');
  }

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      liveMode: config.liveMode,
      aiProvider: config.aiProvider,
      llmEnabled: false,
    });
  });

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

  app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    const messages = extractTextMessages(req.body);
    for (const msg of messages) {
      try {
        const result = await engine.handleMessage({
          userId: msg.from,
          channel: 'whatsapp',
          text: msg.text,
        });
        await whatsapp.sendText(msg.from, result.reply);
        logger.log(`Replied to ${msg.from} intent=${result.intent || '-'} source=${result.source}`);
      } catch (err) {
        logger.error(`Failed to handle message ${msg.id}: ${err.message}`);
      }
    }
  });

  app.post('/chat', async (req, res) => {
    const userId = (req.body && req.body.userId) || 'demo-user';
    const text = req.body && req.body.text;
    try {
      const result = await engine.handleMessage({ userId, channel: 'http', text });
      res.json(result);
    } catch (err) {
      logger.error(`POST /chat failed: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

module.exports = { createApp };
