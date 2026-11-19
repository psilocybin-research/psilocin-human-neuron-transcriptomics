import {chromium,firefox,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const engine=process.env.ATLAS_BROWSER||'chromium',base=process.env.ATLAS_URL||'http://127.0.0.1:4173/',output=process.env.QA_OUTPUT||'/tmp/atlas-icon-ui';await mkdir(output,{recursive:true});
const browser=await ({chromium,firefox,webkit}[engine]).launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('atlas-motion','reduced'));
try{
 await page.goto(base);await page.locator('[data-framework7]').waitFor();const menu=page.getByRole('button',{name:'Open section menu',exact:true}),controls=page.getByRole('button',{name:'Analysis controls',exact:true}),search=page.locator('.desktop-gene-finder');
 assert.equal(await controls.count(),0,'Overview has no analysis control');assert.equal(await page.locator('.sidebar-footer').innerText().then(t=>t.includes('Christopher B. Germann')),false);assert.doesNotMatch(await page.locator('.research-sidebar').innerText(),/Gene expression and enrichment support/);
 assert.equal(await page.locator('.research-nav svg').count(),8);assert.equal(await page.locator('.research-nav [data-f7-icon]').count(),7);assert.equal(await page.locator('.research-nav [data-icon-source=scientific-extension]').count(),1);assert.equal(await page.locator('.shell-icon svg:not([data-f7-icon]):not([data-icon-source])').count(),0);assert.match(await page.locator('.ui-license').getAttribute('href'),/NOTICES/);
 for(const [view,available]of [['Methods & sources',false],['Gene explorer',false],['OXPHOS landscape',true],['Pathways',true],['Comparative views',true],['Robustness',true],['DNA maintenance',true],['Overview',false]]){
  if(await menu.getAttribute('aria-expanded')!=='true')await menu.click();await page.getByRole('button',{name:view,exact:true}).click();if(available){await controls.waitFor();assert.equal(await controls.evaluate((n)=>n.getBoundingClientRect().right<=document.querySelector('.desktop-gene-finder').getBoundingClientRect().left),true,'controls precedes Search');}else await controls.waitFor({state:'hidden'});
 }
 for(const mode of ['light','dark']){
  await page.evaluate(mode=>document.querySelector('#psilocin-app').f7.setDarkMode(mode==='dark'),mode);
  assert.equal(await page.locator('.scroll-top').count(),0);
  await page.locator('.research-scroll').evaluate(n=>n.scrollTop=n.scrollHeight);
  await page.waitForFunction(()=>Number(document.querySelector('.app-reading-progress').getAttribute('aria-valuenow'))>=99);
  await page.screenshot({path:`${output}/${engine}-scroll-${mode}.png`});

 }
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.appearance-toggle:visible').count(),1);assert.equal(await controls.count(),0);await menu.click();await page.getByRole('button',{name:'Pathways',exact:true}).click();await controls.waitFor();await controls.click();await page.locator('.analysis-morph-panel.modal-in').waitFor();await page.keyboard.press('Escape');await page.locator('.analysis-morph-panel').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 assert.deepEqual(errors,[]);await writeFile(`${output}/${engine}-icon-ui.json`,JSON.stringify({passed:true,engine,officialSvgIcons:true,matchedDnaIcon:true,contextualControls:true,controlsBeforeSearch:true,readingProgress:true,sidebarRemoved:true},null,2));console.log(`F7 icons, contextual controls and reading progress passed (${engine}).`);
}finally{await browser.close();}
