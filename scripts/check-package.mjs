// Teste les artefacts distribués sans aucun DOM ni dépendance de développement.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from '../dist/index.js';

const require = createRequire(import.meta.url);
const cjs = require('../dist/index.cjs');
for (const engine of [esm, cjs]) {
  assert.match(engine.renderToString('\\frac{a}{b}'), /<mfrac>/);
  const result = engine.renderAll(['\\eqref{a}', 'x\\label{a}'], { throwOnError: true });
  assert.equal(result.references.a, '1');
  assert.deepEqual(result.errors, [[], []]);
  assert.ok(!engine.renderToString('\\url{javascript:alert(1)}', { trustLinks: true }).includes('<a '));
}
console.log('ESM et CommonJS : rendu SSR et références validés.');
