/**
 * Grafo browser-safe del módulo estático forja-demo/ (GitHub Pages).
 * Aislado de la demo Forkza Gestión (app.js / store-local).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = 'forja-demo';

const SERVIDOR_EXCLUSIVO = new Set([
  'engine/auth.js',
  'engine/persistencia/json.js',
  'engine/persistencia/index.js',
]);

const PREFIJOS_SERVIDOR = ['server/', 'channels/'];

const RE_IMPORT =
  /(?:import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?|export\s+(?:[^'";]+?\s+from\s+)|import\s*\(\s*)['"]([^'"]+)['"]/g;

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

function listarJs(dirRel) {
  const abs = join(ROOT, dirRel);
  const out = [];
  for (const name of readdirSync(abs, { withFileTypes: true })) {
    const rel = join(dirRel, name.name).replace(/\\/g, '/');
    if (name.isDirectory()) out.push(...listarJs(rel));
    else if (name.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

test('forja-demo: entrada index.html y estilos relativos existen', () => {
  assert.ok(existsSync(join(ROOT, DEMO, 'index.html')));
  assert.ok(existsSync(join(ROOT, DEMO, 'styles.css')));
  assert.ok(existsSync(join(ROOT, DEMO, 'js', 'app.js')));
  const html = readFileSync(join(ROOT, DEMO, 'index.html'), 'utf8');
  assert.match(html, /href="\.\/styles\.css"/);
  assert.match(html, /src="\.\/js\/app\.js"/);
  assert.match(html, /Prototipo demostrativo/);
  assert.match(html, /FORJA TRAINING/);
  assert.doesNotMatch(html, /cdn\.|unpkg|jsdelivr|googleapis/i);
});

test('forja-demo: grafo browser-safe desde js/app.js', () => {
  const { visitados, hallazgos } = recorrerGrafo([`${DEMO}/js/app.js`]);

  assert.ok(visitados.includes(`${DEMO}/js/app.js`));
  assert.ok(visitados.includes(`${DEMO}/js/state.js`));
  assert.ok(visitados.includes(`${DEMO}/js/data.js`));
  assert.ok(visitados.some((v) => v.startsWith(`${DEMO}/js/views/`)));

  assert.equal(visitados.includes('engine/auth.js'), false);
  assert.equal(visitados.includes('engine/persistencia/json.js'), false);
  assert.equal(visitados.includes('app.js'), false);
  assert.equal(visitados.includes('engine/store-local.js'), false);

  for (const v of visitados) {
    assert.ok(
      v.startsWith(`${DEMO}/`),
      `forja-demo no debe importar fuera del módulo: ${v}`,
    );
  }

  assert.deepEqual(
    hallazgos,
    [],
    `grafo forja-demo no browser-safe:\n${hallazgos.map((h) => JSON.stringify(h)).join('\n')}`,
  );
});

test('forja-demo: ningún .js del módulo usa node: ni bare packages', () => {
  const files = listarJs(DEMO);
  assert.ok(files.length >= 8, 'debe haber varios módulos JS');
  const problemas = [];
  for (const rel of files) {
    const codigo = readFileSync(join(ROOT, rel), 'utf8');
    for (const spec of extraerSpecs(codigo)) {
      if (spec.startsWith('node:')) problemas.push({ rel, spec, tipo: 'node' });
      else if (esBare(spec)) problemas.push({ rel, spec, tipo: 'bare' });
    }
  }
  assert.deepEqual(problemas, []);
});

test('standalone Gestión: grafo app.js sigue browser-safe (sin cruce forja-demo)', () => {
  const { visitados, hallazgos } = recorrerGrafo(['app.js', 'engine/store-local.js']);
  assert.ok(visitados.includes('app.js'));
  assert.equal(
    visitados.some((v) => v.startsWith(`${DEMO}/`)),
    false,
    'Gestión no debe importar forja-demo',
  );
  assert.deepEqual(hallazgos, []);
});
