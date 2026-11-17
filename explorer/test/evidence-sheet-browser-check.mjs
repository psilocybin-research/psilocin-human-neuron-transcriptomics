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
  await sheet.getByRole('button',{name:'Done',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen==='false');
  assert.equal(await page.locator('.research-views').evaluate(n=>n.inert),false);
  await page.goto(base+'#view=comparison');const input=page.getByRole('combobox',{name:'Search comparison genes',exact:true});await input.fill('GPX4');await page.getByRole('option',{name:/GPX4/}).click();await sheet.locator('.gene-symbol').waitFor();assert.equal(await sheet.locator('.gene-symbol').innerText(),'GPX4');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.modalOpen==='false');assert.equal(await page.locator('.comparison-evidence .gene-symbol').innerText(),'GPX4');assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Native push evidence, Done/Escape, restored panels and one expanded navigation group passed on mobile/desktop.');
}finally{await browser.close();}
