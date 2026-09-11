# MONKEYS AI WhatsApp Assistant — MVP demo

Prototipo comercial de **MONKEYS FITNESS COMMUNITY** (Antofagasta, Chile).
Datos, horarios y precios son **demostrativos**. No hay integración oficial activa.

> LA IA ENTIENDE. EL BOT EJECUTA. WHATSAPP CONECTA. MONKEYS CONTROLA.

## Arquitectura híbrida

- **IA demo** (`engine/intent.js`): interpreta lenguaje natural en local, sin LLM ni API keys.
- **Bot determinístico** (`engine/conversation.js` + `engine/store.js`): clases, cupos, reservas, leads.
- **WhatsApp**: canal futuro. Solo queda la interfaz `MessageChannel` documentada en el engine.
- **Humano**: derivación a `waiting_human`, visible en el dashboard.

La IA no inventa cupos, horarios ni precios, y no confirma reservas.

## Stack

Node 20 + Express. JavaScript ES modules. Sin bundler. Frontend estático: `index.html`, `app.js`, `styles.css`.

## Modo standalone (GitHub Pages)

Si `GET ./api/health` no responde en 1,5 s, el mismo engine corre en el navegador con `localStorage` (`monkeys_demo_state`). Rutas relativas `./`. Incluye `.nojekyll`.

## Uso

```bash
npm install
npm test
npm start
```

Abre http://localhost:3000

- Chat: `#asistente`
- Dashboard: `#dashboard`

## Recorridos

- **A** Félix García → Reservar → Spinning → confirmar → código GYM-2026-XXXX
- **B** Alta Vista → Clase de prueba GRATIS → lead en dashboard
- **C** "Hola, quiero probar el gimnasio" → flujo trial (badge IA)
- **D** "quiero hablar con alguien" → atención pendiente
- **E** Abrir `index.html` sin backend (`npx serve .`) → mismos flujos en localStorage
