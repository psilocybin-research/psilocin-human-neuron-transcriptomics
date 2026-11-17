import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const base=process.env.ATLAS_URL||'http://127.0.0.1:4173/';
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:960}});page.setDefaultTimeout(12000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#view=pathways&display=network');await page.locator('.network-node').first().waitFor();
  assert.equal(await page.locator('.research-nav .accordion-item-opened').count(),1);
  assert.equal(await page.locator('.research-nav .accordion-item-opened .accordion-item-content').getAttribute('id'),'nav-group-molecular');
  await page.locator('.network-node').first().click();
  const sheet=page.locator('.research-evidence-sheet');await page.waitForFunction(()=>document.querySelector('.research-evidence-sheet').dataset.shellModalReady==='true');
  assert.ok(await sheet.locator('#pathway-selected-evidence').count());
  assert.ok(Math.abs((await sheet.boundingBox()).y)<2,'evidence sheet reaches viewport top');
  await sheet.getByRole('button',{name:'Done',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen==='false');
  assert.equal(await page.locator('.research-views').evaluate(n=>n.inert),false);
  await page.goto(base+'#view=comparison');const input=page.getByRole('combobox',{name:'Search comparison genes',exact:true});await input.fill('GPX4');await page.getByRole('option',{name:/GPX4/}).click();await sheet.locator('.gene-symbol').waitFor();assert.equal(await sheet.locator('.gene-symbol').innerText(),'GPX4');
  await sheet.locator('.gene-detail .figure-toolbar').first().waitFor();
  for (const toolbar of await sheet.locator('.gene-detail .figure-toolbar').all()) {
   const buttons=toolbar.locator('button');
   assert.ok(await buttons.count()>=2);
   assert.equal(await buttons.evaluateAll(nodes=>nodes.every(n=>n.classList.contains('button')&&n.classList.contains('button-tonal'))),true,'async evidence plots receive shared F7 controls');
   assert.equal(await buttons.last().evaluate(n=>n.classList.contains('figure-fullscreen')),true,'fullscreen stays outermost right');
  }
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen==='false');assert.equal(await page.locator('.comparison-evidence .gene-symbol').innerText(),'GPX4');assert.deepEqual(errors,[]);
  await page.goto(base+'#view=landscape&gene=NDUFA1');
  await page.locator('.landscape-layout .gene-detail svg[role=img]').first().waitFor();
  await page.locator('.landscape-layout .gene-detail').evaluate(panel=>{window.evidencePlot=panel.querySelector('svg[role=img]');});
  await page.getByRole('button',{name:/^Inspect NDUFA1,/}).click();
  if(width<=850) {
  await page.waitForFunction(()=>document.querySelector('.research-evidence-sheet').dataset.shellModalReady==='true');
  assert.equal(await sheet.evaluate(panel=>panel.querySelector('svg[role=img]')===window.evidencePlot),true,'opening selected landscape gene preserves the rendered plot');
  assert.equal(await sheet.locator('.figure-shell').count(),2,'both landscape evidence plots have shared controls before opening');
  assert.ok(Math.abs((await sheet.boundingBox()).y)<2);
  await sheet.getByRole('button',{name:'Done',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen==='false');
  assert.equal(await page.locator('.landscape-layout .gene-detail').evaluate(panel=>panel.querySelector('svg[role=img]')===window.evidencePlot),true,'closing restores the original evidence');
  } else {
   assert.equal(await sheet.isVisible(),false,'desktop OXPHOS selection stays beside the heatmap');
   await page.getByRole('button',{name:/^Inspect NDUFA2,/}).click();
   await page.waitForFunction(()=>document.querySelector('.landscape-layout .gene-symbol')?.textContent==='NDUFA2');
   assert.equal(await sheet.isVisible(),false);
  }
  await page.goto(base+'#view=dna&gene=ACD');
  await page.locator('.dna-map .dna-row').first().waitFor();
  const dnaRow=page.locator('.dna-map .dna-row').first();
  const dnaSymbol=(await dnaRow.getAttribute('aria-label')).replace('Inspect DNA-maintenance gene ','');
  await dnaRow.click();
  if(width<=850) {
   await page.waitForFunction(()=>document.querySelector('.research-evidence-sheet').dataset.shellModalReady==='true');
   await page.waitForFunction(symbol=>document.querySelector('.research-evidence-sheet .gene-symbol')?.textContent===symbol,dnaSymbol);
   await sheet.getByRole('button',{name:'Done',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen==='false');
  } else {
   await page.waitForFunction(symbol=>document.querySelector('.landscape-layout .gene-symbol')?.textContent===symbol,dnaSymbol);
   assert.equal(await sheet.isVisible(),false,'desktop DNA maintenance keeps evidence beside the heatmap');
  }
  await page.goto(base+'#view=genes&gene=ENSG00000184752.8');
  await page.locator('.gene-explorer-layout .gene-detail .figure-toolbar').first().waitFor();
  await page.getByRole('button',{name:/View evidence/}).click();
  if(width<=850) {
   await page.waitForFunction(()=>document.querySelector('.research-evidence-sheet').dataset.shellModalReady==='true');
   assert.ok(await sheet.locator('.gene-detail .figure-toolbar').count());
   await sheet.getByRole('button',{name:'Done',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen==='false');
  } else {
   assert.equal(await sheet.isVisible(),false,'desktop Gene explorer keeps evidence inline');
  }
  await page.locator('#gene-search-input').fill('GPX4');
  await page.getByRole('option',{name:/GPX4/}).first().click();
  if(width<=850) {
   await sheet.locator('.gene-symbol').waitFor();
   assert.equal(await sheet.locator('.gene-symbol').innerText(),'GPX4');
  } else {
   await page.waitForFunction(()=>document.querySelector('.gene-explorer-layout .gene-symbol')?.textContent==='GPX4');
   assert.equal(await sheet.isVisible(),false,'desktop gene selection stays inline');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Native push evidence, Done/Escape, restored panels and one expanded navigation group passed on mobile/desktop.');
}finally{await browser.close();}
