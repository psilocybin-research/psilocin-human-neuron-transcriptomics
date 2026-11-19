import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const bundle = await build({entryPoints: [fileURLToPath(new URL('../src/components/python-lab.js', import.meta.url))],
  bundle: true, write: false, format: 'iife', globalName: 'AtlasPythonLab', target: 'es2022'});
const browser = await chromium.launch({executablePath: process.env.BROWSER_PATH || '/usr/bin/chromium', headless: true});
try {
  const page = await browser.newPage();
  await page.goto(base);
  await page.waitForFunction(() => document.querySelector('#psilocin-app')?.f7);
  await page.addScriptTag({content: bundle.outputFiles[0].text});
  await page.evaluate(() => {
    const root = document.querySelector('#psilocin-app');
    window.pythonRecords = []; window.pythonTransfers = [];
    window.pythonLab = AtlasPythonLab.createPythonLab({root,
      getDatasets: async () => [{name: 'fixture', csv: 'gene_id,value\nENSG000001,1.125\nENSG000002,2.25\n', provenance: {classification: 'synthetic-test'}}],
      onResults: record => pythonRecords.push(record), onTransferToR: record => pythonTransfers.push(record)});
    pythonLab.id = 'python-test-fixture'; document.body.append(pythonLab);
  });
  const fixture = page.locator('#python-test-fixture');
  const code = fixture.getByRole('textbox', {name: 'Python code'});
  await code.fill('results = [{"total": sum(float(row["value"]) for row in data)}]\natlas_structure("GPX4")\nprint("calculated")');
  await fixture.getByRole('button', {name: 'Run Python', exact: true}).click();
  await fixture.getByRole('status').filter({hasText: 'Python completed'}).waitFor({timeout: 90000});
  assert.match(await fixture.getByLabel('Python results preview').innerText(), /3.375/);
  await fixture.getByRole('button', {name: 'Send Python results to R'}).click();
  const metadata = await page.evaluate(() => ({record: pythonRecords[0], transferred: pythonTransfers[0], saved: JSON.parse(localStorage.getItem('atlas-python-notebooks-v1'))}));
  assert.equal(metadata.record.csv, 'total\n3.375\n');
  assert.equal(metadata.record.scene_specs[0].gene, 'GPX4');
  assert.equal(metadata.record.classification, 'user-exploratory');
  assert.match(metadata.record.code_sha256, /^[a-f0-9]{64}$/);
  assert.match(metadata.record.inputs[0].sha256, /^[a-f0-9]{64}$/);
  assert.equal(metadata.transferred.name, 'python_results');
  assert.equal(metadata.transferred.csv, metadata.record.csv);
  assert.equal(metadata.saved[0].code, metadata.record.code);
  await code.fill('while True: pass');
  await fixture.getByRole('button', {name: 'Run Python', exact: true}).click();
  await fixture.getByRole('button', {name: 'Stop Python', exact: true}).click();
  await fixture.getByRole('status').filter({hasText: 'Python stopped'}).waitFor();
  await code.fill('results = [{"value": 42}]');
  await fixture.getByRole('button', {name: 'Run Python', exact: true}).click();
  await fixture.getByRole('status').filter({hasText: 'Python completed'}).waitFor({timeout: 90000});
  assert.match(await fixture.getByLabel('Python results preview').innerText(), /42/);
  await page.evaluate(() => { pythonLab.destroy(); pythonLab.remove(); });
  console.log(JSON.stringify({status: 'pass', component_fixture: true, result: 3.375,
    runtime: metadata.record.runtime, elapsed_ms: metadata.record.elapsed_ms,
    notebook_persistence: true, provenance_hashes: true, transfer_to_r_callback: true, scene: 'GPX4', stop_and_recovery: true}));
} finally { await browser.close(); }
