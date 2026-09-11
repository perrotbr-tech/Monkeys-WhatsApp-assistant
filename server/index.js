import express from 'express';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clonarDemo } from '../data/demo.js';
import { crearEngine } from '../engine/conversation.js';
import { crearAutomation } from '../engine/automation.js';
import { FECHA_DEMO } from '../engine/dates.js';

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

function saveState() {
  writeFileSync(DATA_FILE, JSON.stringify({ ...engine.exportar(), ...auto.exportar() }, null, 2));
}

const initial = loadState();
const engine = crearEngine(initial);
const auto = crearAutomation(initial);
const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mode: 'api' });
});

app.post('/api/conversations', (_req, res) => {
  const result = engine.iniciar();
  saveState();
  res.json(result);
});

app.post('/api/conversations/:id/messages', (req, res) => {
  const text = req.body && req.body.text;
  const result = engine.procesar(req.params.id, text);
  saveState();
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
  auto.hidratar(seed);
  res.json({ ok: true, state: { ...engine.exportar(), ...auto.exportar() } });
});

app.post('/api/automation/run', (req, res) => {
  const fecha = (req.body && req.body.fecha) || FECHA_DEMO;
  const campania = auto.ejecutarCiclo(fecha);
  saveState();
  res.json({ ok: true, campania, summary: auto.summary(fecha) });
});

app.get('/api/automation/summary', (_req, res) => {
  res.json(auto.summary(FECHA_DEMO));
});

app.get('/api/automation/actions', (req, res) => {
  res.json({
    actions: auto.listarAcciones({
      agente: req.query.agente,
      sede: req.query.sede,
      estado: req.query.estado,
    }),
  });
});

app.post('/api/automation/actions/:id/estado', (req, res) => {
  const acc = auto.setEstado(req.params.id, req.body && req.body.estado);
  if (!acc) return res.status(404).json({ error: 'not found' });
  saveState();
  res.json({ action: acc });
});

app.post('/api/automation/agentes/:id/activo', (req, res) => {
  const activos = auto.setAgenteActivo(req.params.id, req.body && req.body.activo);
  saveState();
  res.json({ agentesActivos: activos });
});

app.use(express.static(ROOT));

const port = Number.parseInt(process.env.PORT || '3000', 10);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(port, () => {
    console.log(`MONKEYS demo listening on http://localhost:${port}`);
  });
}

export { app, engine, auto };
