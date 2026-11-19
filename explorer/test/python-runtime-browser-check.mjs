import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const bundle = await build({entryPoints: [fileURLToPath(new URL('../src/components/python-runtime.js', import.meta.url))],
  bundle: true, write: false, format: 'iife', globalName: 'AtlasPython', target: 'es2022'});
const browser = await chromium.launch({executablePath: process.env.BROWSER_PATH || '/usr/bin/chromium', headless: true});
try {
  const page = await browser.newPage();
  const requests = [];
  page.on('request', request => { if (new URL(request.url()).pathname.includes('/python/')) requests.push(request.url()); });
  await page.goto(base);
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  await page.evaluate(() => { window.pythonRuntime = AtlasPython.createPythonRuntime(); });
  assert.equal(requests.length, 0, 'Creating an optional Python worker must not load Python before explicit initialization.');
  const initialized = await page.evaluate(async () => {
    const start = performance.now(); const info = await pythonRuntime.init(); return {...info, elapsed_ms: Math.round(performance.now() - start)};
  });
  assert.equal(initialized.version, '314.0.8');
  const output = await page.evaluate(async () => pythonRuntime.run({code: 'results = [{"total": sum(float(row["value"]) for row in data)}]\natlas_structure("GPX4")',
    selected: 'fixture', datasets: [{name: 'fixture', csv: 'value\n1.125\n2.25\n'}]}));
  assert.equal(output.csv, 'total\n3.375\n');
  assert.equal(output.scene_specs[0].gene, 'GPX4');
  const stopped = await page.evaluate(async () => {
    const pending = pythonRuntime.run({code: 'while True: pass', selected: '', datasets: []}).then(() => 'unexpected', error => error.message);
    setTimeout(() => pythonRuntime.close(), 150);
    return pending;
  });
  assert.match(stopped, /stopped/);
  const restarted = await page.evaluate(async () => {
    window.pythonRuntime = AtlasPython.createPythonRuntime(); await pythonRuntime.init();
    const output = await pythonRuntime.run({code: 'results = [{"value": 42}]', selected: '', datasets: []});
    pythonRuntime.close(); return output;
  });
  assert.equal(restarted.csv, 'value\n42\n');
  console.log(JSON.stringify({status: 'pass', runtime: initialized, result: 3.375,
    lazy_loading: true, explicit_scene: 'GPX4', worker_stop_and_restart: true, runtime_requests: requests.length}));
} finally { await browser.close(); }
