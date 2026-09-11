# Monkeys WhatsApp assistant

Asistente híbrido para un gimnasio: **bot determinístico** para operaciones críticas + **capa de intención** para lenguaje natural. WhatsApp queda cableado como canal futuro; esta demo no requiere API keys ni un LLM externo.

## Arquitectura híbrida

```
mensaje
  → ConversationEngine
       ├─ menú / sí-no / números     → flujos determinísticos
       └─ lenguaje natural           → AIIntentService.interpret()
                                         └─ DemoAIIntentService (local)
       → flujo determinístico (clases, reserva, prueba, planes, humano)
            → gym services (grilla, cupos, precios, tickets)
```

| Capa | Puede | No puede |
| --- | --- | --- |
| `AIIntentService` | Interpretar lenguaje, identificar intención, extraer entidades, orientar preguntas generales | Inventar cupos, horarios o precios; confirmar reservas; cambiar reglas |
| `ConversationEngine` + gym services | Mostrar grilla real, cotizar planes del catálogo, confirmar cupos, abrir handoff | Delegar esas operaciones al modelo |

Sustitución futura: implementar `LlmAIIntentService` con el mismo contrato y apuntar `AI_PROVIDER=llm`. `sanitizeInterpretation` descarta precios, cupos y confirmaciones si un proveedor las devolviera. En este MVP `interpret()` del stub LLM **lanza error** y no hay llamadas externas.

## Intenciones reconocidas (demo local)

- consultar clases — _"quiero entrenar mañana"_
- reservar — _"quiero reservar spinning"_
- clase de prueba — _"quiero probar el gimnasio"_
- planes — _"cuánto cuesta"_
- hablar con humano — _"quiero hablar con alguien"_

## Requisitos

- Node.js >= 20

## Uso

```bash
npm ci
npm test
npm start          # http://localhost:3000
npm run demo       # diálogo de ejemplo en consola
```

### Canal demo (HTTP)

```bash
curl -s -X POST http://localhost:3000/chat \
  -H 'Content-Type: application/json' \
  -d '{"userId":"ana","text":"quiero entrenar mañana"}'
```

### WhatsApp (canal futuro)

`GET/POST /webhook` usa el mismo `ConversationEngine`. Sin `WHATSAPP_ACCESS_TOKEN` el servidor queda en **dev mode**: procesa el inbound y registra el reply en logs, no llama a Meta.

## Endpoints

| Método | Path | Propósito |
| --- | --- | --- |
| GET | `/health` | Liveness; `aiProvider`, `llmEnabled: false` |
| POST | `/chat` | Canal de demo |
| GET | `/webhook` | Handshake Meta |
| POST | `/webhook` | Inbound WhatsApp |

## Tests

```bash
npm test
```
