import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 for(const width of [390,1440]) {
  const context = await browser.newContext({viewport:{width,height:1000},hasTouch:width<700,isMobile:width<700});
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto((process.env.ATLAS_URL || 'http://127.0.0.1:4173/')+'#view=custom-r');
  await page.locator('.studio-inline-cell').first().waitFor();
  await page.getByLabel('R code cell 1',{exact:true}).fill('cat("INSPECTOR_OUTPUT_PRESERVED")');
  await page.getByRole('button',{name:'Run cell',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.dataset.rBusy==='false',null,{timeout:180000});
  assert.match(await page.getByLabel('R console output',{exact:true}).textContent(),/INSPECTOR_OUTPUT_PRESERVED/);
  await page.getByRole('button',{name:'Evidence inspector',exact:true}).click();
  const panel = page.locator('.research-inspector');
  await panel.getByRole('tab',{name:'Gene-set context',exact:true}).click();
  await panel.getByRole('button',{name:'Inspect gene-set estimates in 3D',exact:true}).click();
  const scene = panel.locator('.scientific-scene');
  await scene.waitFor();
  assert.match(await scene.locator('.scene-status').first().textContent(),/ARCHIVED/);
  await scene.getByRole('button',{name:'Open 3D scene',exact:true}).click();
  await scene.locator('canvas').waitFor({timeout:45000});
  await scene.locator('summary').filter({hasText:'Exact data table'}).click();
  const point = scene.locator('button[data-id]').first(), geneId = await point.getAttribute('data-id');
  await point.click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('psilocin-research-session-v1'))?.state?.gene===id,geneId);
  assert.match(page.url(),/view=custom-r/);
  assert.match(await page.getByLabel('R console output',{exact:true}).textContent(),/INSPECTOR_OUTPUT_PRESERVED/);
  assert.equal(await scene.locator(`button[data-id="${geneId}"]`).getAttribute('aria-pressed'),'true');
  await panel.getByRole('tab',{name:'Gene evidence',exact:true}).click();
  await panel.locator('.research-inspector-id').filter({hasText:geneId}).waitFor();
  assert.equal(await scene.count(),1,'scene persists across linked gene selection/tab changes');
  await panel.locator('.research-inspector-intervals summary').click();
  assert.match(await panel.locator('.research-inspector-intervals').textContent(),/1.959963984540054/);
  await panel.getByRole('button',{name:'Close evidence inspector',exact:true}).click();
  await scene.waitFor({state:'detached'});
  assert.match(await page.getByLabel('R console output',{exact:true}).textContent(),/INSPECTOR_OUTPUT_PRESERVED/);
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}: actual R output retained, archived scene, exact-ID bidirectional selection without navigation, precise intervals, scene disposal`);
  await context.close();
 }
}finally {await browser.close();}
