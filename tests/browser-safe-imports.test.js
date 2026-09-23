/**
 * Regresión: grafo de imports del modo standalone (GitHub Pages) debe ser browser-safe.
 * Recorre transitivamente desde app.js y engine/store-local.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Módulos exclusivos del servidor: no pueden aparecer en el grafo standalone. */
const SERVIDOR_EXCLUSIVO = new Set([
  'engine/auth.js',
  'engine/persistencia/json.js',
  'engine/persistencia/index.js',
]);

const PREFIJOS_SERVIDOR = [
  'server/',
  'channels/',
];

const RE_IMPORT = /(?:import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?|export\s+(?:[^'";]+?\s+from\s+)|import\s*\(\s*)['"]([^'"]+)['"]/g;

function extraerSpecs(codigo) {
  const hits = [];
  let m;
  const re = new RegExp(RE_IMPORT.source, 'g');
  while ((m = re.exec(codigo))) hits.push(m[1]);
  return hits;
}

function esBare(spec) {
  if (!spec) return false;
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:')) return false;
  return true;
}

function resolverRelativo(fromFile, spec) {
  let abs = resolve(dirname(fromFile), spec);
  if (existsSync(abs) && abs.endsWith('.js')) return abs;
  if (existsSync(`${abs}.js`)) return `${abs}.js`;
  if (existsSync(join(abs, 'index.js'))) return join(abs, 'index.js');
  return null;
}

function recorrerGrafo(entradas) {
  const visitados = new Set();
  const cola = [];
  const hallazgos = [];

  for (const rel of entradas) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) {
      hallazgos.push({ tipo: 'entrada_inexistente', archivo: rel });
      continue;
    }
    cola.push(abs);
  }

  while (cola.length) {
    const file = cola.shift();
    const norm = relative(ROOT, file).replace(/\\/g, '/');
    if (visitados.has(norm)) continue;
    visitados.add(norm);

    if (SERVIDOR_EXCLUSIVO.has(norm)) {
      hallazgos.push({ tipo: 'modulo_servidor', archivo: norm });
    }
    for (const pref of PREFIJOS_SERVIDOR) {
      if (norm.startsWith(pref)) {
        hallazgos.push({ tipo: 'modulo_servidor', archivo: norm });
      }
    }

    const codigo = readFileSync(file, 'utf8');
    for (const spec of extraerSpecs(codigo)) {
      if (spec.startsWith('node:')) {
        hallazgos.push({ tipo: 'node_builtin', archivo: norm, spec });
        continue;
      }
      if (esBare(spec)) {
        hallazgos.push({ tipo: 'bare_package', archivo: norm, spec });
        continue;
      }
      if (spec.startsWith('.')) {
        const dest = resolverRelativo(file, spec);
        if (!dest) {
          hallazgos.push({ tipo: 'ruta_inexistente', archivo: norm, spec });
          continue;
        }
        const destNorm = relative(ROOT, dest).replace(/\\/g, '/');
        if (!visitados.has(destNorm)) cola.push(dest);
      }
    }
  }

  return { visitados: [...visitados].sort(), hallazgos };
}

test('standalone: grafo browser-safe desde app.js y store-local.js', () => {
  const { visitados, hallazgos } = recorrerGrafo([
    'app.js',
    'engine/store-local.js',
  ]);

  assert.ok(visitados.includes('app.js'), 'debe incluir app.js');
  assert.ok(visitados.includes('engine/store-local.js'), 'debe incluir store-local');
  assert.ok(visitados.includes('engine/auth-shared.js'), 'debe incluir auth-shared');
  assert.equal(
    visitados.includes('engine/auth.js'),
    false,
    'auth.js (Node) no debe estar en el grafo standalone',
  );
  assert.equal(
    visitados.includes('engine/persistencia/json.js'),
    false,
    'json.js (node:fs) no debe estar en el grafo standalone',
  );
  assert.equal(
    visitados.includes('engine/persistencia/index.js'),
    false,
    'barrel persistencia/index.js no debe estar (reexporta json.js)',
  );

  assert.deepEqual(
    hallazgos,
    [],
    `grafo standalone no browser-safe:\n${hallazgos.map((h) => JSON.stringify(h)).join('\n')}`,
  );
});

test('standalone: auth-shared no arrastra dependencias Node', () => {
  const { visitados, hallazgos } = recorrerGrafo(['engine/auth-shared.js']);
  assert.ok(visitados.includes('engine/auth-shared.js'));
  assert.equal(visitados.includes('engine/auth.js'), false);
  assert.deepEqual(hallazgos, []);
});
