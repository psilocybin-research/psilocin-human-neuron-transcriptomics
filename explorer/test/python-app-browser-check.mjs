import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({executablePath: process.env.BROWSER_PATH || '/usr/bin/chromium', headless: true});
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({viewport: {width, height: 960}});
    const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '#view=custom-r');
    await page.waitForFunction(() => document.querySelector('#psilocin-app')?.f7);
    await page.getByRole('tab', {name: 'Python Lab', exact: true}).click();
    const lab = page.locator('.python-lab');
    const editor = lab.getByRole('textbox', {name: 'Python code'});
    await editor.fill('import statistics\nprint(dataset_name)\nresults = [{"gene_id": "ENSG00000167468", "value": statistics.mean([1.125, 2.25])}]');
    await lab.getByRole('button', {name: 'Run Python', exact: true}).click();
    await lab.getByRole('status').filter({hasText: 'Python completed'}).waitFor({timeout: 90000});
    assert.match(await lab.getByLabel('Python results preview').innerText(), /1.6875/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('atlas-python-notebooks-v1')));
    assert.equal(stored[0].runs.at(-1).csv, 'gene_id,value\nENSG00000167468,1.6875\n');
    assert.equal(stored[0].runs.at(-1).runtime.standard_library.length, 11);
    await lab.getByRole('button', {name: 'Send Python results to R'}).click();
    await page.getByRole('tab', {name: 'R Studio', exact: true}).waitFor();
    assert.equal(await page.getByRole('tab', {name: 'R Studio', exact: true}).getAttribute('aria-selected'), 'true');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#psilocin-app')?.f7);
    await page.getByRole('tab', {name: 'Python Lab', exact: true}).click();
    await lab.getByRole('status').filter({hasText: 'Restored recorded Python output'}).waitFor();
    assert.match(await lab.getByLabel('Python results preview').innerText(), /1.6875/);
    assert.match(await lab.locator('.python-inspector').textContent(), /Runtime not initialized/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({width, status: 'pass', python_result: 1.6875, restored_output: true, standard_library: 11, transfer_to_r: true}));
    await context.close();
  }
} finally { await browser.close(); }
