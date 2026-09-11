import express from 'express';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clonarDemo } from '../data/demo.js';
import { crearEngine } from '../engine/conversation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'data.json');

mkdirSync(DATA_DIR, { recursive: true });

function loadState() {
  if (!existsSync(DATA_FILE)) {
    const seed = clonarDemo();
    writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
}

function saveState(engine) {
  writeFileSync(DATA_FILE, JSON.stringify(engine.exportar(), null, 2));
}

const engine = crearEngine(loadState());
const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'api' });
});

app.post('/api/conversations', (_req, res) => {
  const result = engine.iniciar();
  saveState(engine);
  res.json(result);
});

app.post('/api/conversations/:id/messages', (req, res) => {
  const text = req.body && req.body.text;
  const result = engine.procesar(req.params.id, text);
  saveState(engine);
  res.json(result);
});

app.get('/api/classes', (req, res) => {
  res.json({ classes: engine.listarClases(req.query.sede) });
});

app.get('/api/plans', (_req, res) => {
  res.json({ plans: engine.listarPlanes() });
});

app.get('/api/bookings', (_req, res) => {
  res.json({ bookings: engine.listarReservas() });
});

app.get('/api/leads', (_req, res) => {
  res.json({ leads: engine.listarLeads() });
});

app.get('/api/conversations', (_req, res) => {
  res.json({ conversations: engine.listarConversaciones() });
});

app.post('/api/demo/reset', (_req, res) => {
  const seed = clonarDemo();
  writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  engine.hidratar(seed);
  res.json({ ok: true, state: engine.exportar() });
});

app.use(express.static(ROOT));

const port = Number.parseInt(process.env.PORT || '3000', 10);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port, () => {
    console.log(`MONKEYS demo listening on http://localhost:${port}`);
  });
}

export { app, engine };
