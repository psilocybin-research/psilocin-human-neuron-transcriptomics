import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { selectMethodResults } from '../src/components/method-comparison-data.js';
const atlas = JSON.parse(await readFile(new URL('../src/data/atlas.json', import.meta.url)));
const { parseExploratoryCSV } = await import('../src/components/exploratory-result-data.js');
const parsed = parseExploratoryCSV(await readFile(new URL('../../tables/camera_sensitivity/all_tests.csv', import.meta.url), 'utf8'));
const snapshot = { camera: parsed.rows.map(values => Object.fromEntries(parsed.headers.map((key, i) => [key, values[i]]))),
  bayesian: JSON.parse(await readFile(new URL('../src/data/bayesian.json', import.meta.url))) };

test('OXPHOS methods retain exact archived values and all ten posterior settings', () => {
  const rows = selectMethodResults(atlas, snapshot, 'HALLMARK_OXIDATIVE_PHOSPHORYLATION', 'day1_vs_control');
  assert.equal(rows.enrichment.length, 1);
  assert.equal(rows.camera.length, 2);
  assert.equal(rows.bayesian.length, 10);
  assert.equal(rows.specifications.length, 10);
  assert.equal(rows.enrichment[0], atlas.pathways[0]);
  assert.equal(rows.camera.find(r => r.mode === 'estimated').family_fdr, '0.587168975061856');
  assert.equal(new Set(rows.bayesian.map(r => r.parameter)).size, 1);
  assert.equal(rows.bayesian[0].parameter, 'mu_day1_vs_control');
});
test('unavailable models stay absent; treated-day contrast maps only to its actual posterior', () => {
  assert.equal(selectMethodResults(atlas, snapshot, 'HALLMARK_GLYCOLYSIS', 'day1_vs_control').bayesian.length, 0);
  const d = selectMethodResults(atlas, snapshot, 'HALLMARK_OXIDATIVE_PHOSPHORYLATION', 'day3_vs_day1');
  assert.ok(d.bayesian.every(r => r.parameter === 'treated_day_difference'));
  assert.ok(d.camera.every(r => r.contrast === 'day3_vs_day1'));
});
