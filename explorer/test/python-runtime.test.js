import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {pythonWorkerSource} from '../src/components/python-worker.js';
import {SCIENTIFIC_PYTHON_HELPERS} from '../src/components/scientific-scene-helpers.js';
import {validateSceneSpec} from '../src/components/scientific-scene-spec.js';
import {sha256Text} from '../src/components/python-runtime.js';

// Exercise exactly the worker's messages and Python program against the pinned
// installed runtime, without substituting native Python for WebAssembly Python.
const replies = [];
const scope = {postMessage(value) { replies.push(value); }};
new Function('self', pythonWorkerSource)(scope);
let id = 0;
async function message(type, args = {}) {
  await scope.onmessage({data: {id: ++id, type, ...args}});
  return replies.at(-1);
}
const datasets = [{name: 'fixture', csv: 'gene_id,value\nENSG000001,1.125\nENSG000002,2.25\n'}];
async function run(code) { return message('run', {payload: {code, selected: 'fixture', datasets, helpers: SCIENTIFIC_PYTHON_HELPERS}}); }

test('Python worker runs real pinned Pyodide and returns a named-dataset calculation', async () => {
  const moduleURL = import.meta.resolve('pyodide');
  const initialized = await message('init', {moduleURL, indexURL: fileURLToPath(new URL('./', moduleURL))});
  assert.equal(initialized.value.version, '314.0.8');
  assert.match(initialized.value.python, /^3\.14\./);
  const output = await run('import statistics\nresults = [{"name": dataset_name, "mean": statistics.mean(float(x["value"]) for x in data)}]\nprint("completed")');
  assert.equal(output.value.csv, 'name,mean\nfixture,1.6875\n');
  assert.equal(output.value.rows, 1);
  assert.deepEqual(output.value.output, [{stream: 'stdout', text: 'completed'}]);
});

test('Python variables and results do not leak to the next run', async () => {
  assert.equal((await run('answer = 42\nresults = [{"value": answer}]')).value.rows, 1);
  const clean = await run('print("answer" in globals())');
  assert.equal(clean.value.csv, '');
  assert.equal(clean.value.rows, 0);
  assert.equal(clean.value.output[0].text, 'False');
});

test('Python CSV preserves identity, commas and missing values', async () => {
  const output = await run('results = [{"gene_id": data[0]["gene_id"], "label": "a,b", "value": None}]');
  assert.equal(output.value.csv, 'gene_id,label,value\nENSG000001,"a,b",\n');
});

test('Python errors, invalid results and nonfinite output fail explicitly', async () => {
  assert.match((await run('raise ValueError("test failure")')).error, /test failure/);
  assert.match((await run('results = {"x": 1}')).error, /list of dictionaries/);
  assert.match((await run('results = [{"x": float("nan")}]')).error, /nonfinite/);
  assert.match((await run('results = [{"x": 1}] * 1001')).error, /1,000 rows/);
});

test('Python random seed is reproducible and console output is bounded', async () => {
  const script = 'import random\nresults = [{"value": random.random()}]';
  assert.equal((await run(script)).value.csv, (await run(script)).value.csv);
  const output = await run('print("x" * 100001)');
  assert.equal(output.value.outputTruncated, true);
  assert.equal(output.value.output[0].text.length, 100000);
});

test('Python provenance uses SHA-256 of exact UTF-8 text', async () => {
  assert.equal(await sha256Text('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});


test('Python scientific scene helpers transfer a strict scene and remove stale scenes', async () => {
  const output = await run('atlas_scatter3d([{ "id": "a", "x": 1, "y": 2, "z": 3}], "x", "y", "z")');
  assert.equal(output.value.scene_specs.length, 1);
  const spec = validateSceneSpec(output.value.scene_specs[0]);
  assert.equal(spec.kind, 'scatter3d');
  assert.deepEqual(spec.data, [{id: 'a', x: 1, y: 2, z: 3}]);
  assert.deepEqual((await run('print("next")')).value.scene_specs, []);
});
