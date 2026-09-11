# Monkeys-WhatsApp-assistant

A small WhatsApp assistant built on the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) webhook model, using Node.js and Express.

It receives inbound messages via a webhook, generates a reply with a simple
rule-based assistant, and sends the reply back through the Graph API.

## Dev mode (no credentials required)

When `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are **not** set, the
server runs in **dev mode**: incoming webhooks are processed normally and the
outgoing reply is logged instead of being sent to Meta. This makes the whole
flow runnable and testable locally without real WhatsApp credentials.

## Requirements

- Node.js >= 20

## Getting started

```bash
npm ci          # or: npm install
npm start       # starts the server on PORT (default 3000)
```

For live WhatsApp Cloud API usage, copy `.env.example` to `.env`, fill in your
Meta app credentials, and export them before running.

## Endpoints

| Method | Path        | Purpose                                             |
| ------ | ----------- | --------------------------------------------------- |
| GET    | `/health`   | Liveness check; reports `liveMode`                  |
| GET    | `/webhook`  | Meta webhook verification handshake                 |
| POST   | `/webhook`  | Inbound message delivery                            |

## Assistant commands

Send any of these to the assistant:

- `help` – list commands
- `ping` – replies `pong`
- `time` – current server time (UTC)
- `echo <text>` – repeats your text
- anything else – echoed back with a hint

## Try it locally

Start the server, then simulate an inbound WhatsApp message:

```bash
curl -s -X POST http://localhost:3000/webhook \
  -H 'Content-Type: application/json' \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "0",
      "changes": [{
        "field": "messages",
        "value": {
          "messages": [
            { "from": "15551234567", "id": "wamid.1", "type": "text", "text": { "body": "ping" } }
          ]
        }
      }]
    }]
  }'
```

The server logs the generated reply (`pong`) in dev mode.

## Tests

```bash
npm test
```

Uses the built-in Node.js test runner plus `supertest` for HTTP-level tests.
