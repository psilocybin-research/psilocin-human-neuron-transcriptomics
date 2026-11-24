import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.ATLAS_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const output=process.env.QA_OUTPUT||'/tmp/atlas-workstation-qa';await mkdir(output,{recursive:true});
try{for(const width of [390,820,1440])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width<900,isMobile:width===390});
 await context.addInitScript(theme=>localStorage.setItem('atlas-appearance',theme),theme);
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(base+'#view=custom-r');await page.locator('.studio-save-status').filter({hasText:'Saved locally'}).waitFor();
 await page.evaluate(async()=>{
  const request=indexedDB.open('psilocin-research-studio-v1',1);
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const tx=db.transaction('workspaces','readwrite');tx.objectStore('workspaces').put({schema:'psilocin-research-notebooks/1',active:'original-notebook',notebooks:[{id:'original-notebook',title:'Existing notebook',created:'2026-11-18T00:00:00Z',cells:[{id:'old-cell-1',kind:'code',source:'results <- data.frame(value=41)\nprint(results)',runs:[]},{id:'old-cell-2',kind:'markdown',source:'## Existing notes\nPreserve prior research.',runs:[]}]}]},'active');await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 });
 await page.reload();await page.getByRole('heading',{name:'Existing notebook',exact:true}).waitFor();await page.getByLabel('R code cell 1',{exact:true}).waitFor({state:'attached'});
 assert.match(await page.locator('.studio-notebook-title').innerText(),/Existing notebook/);
 assert.equal(await page.locator('.studio-inline-cell').count(),2);assert.equal(await page.locator('.studio-inline-cell.is-active .studio-cell-code').evaluate(n=>n.open),true,'Active R editor opens initially');assert.match(await page.locator('.research-studio-markdown-preview').innerText(),/Preserve prior research/);
 assert.equal(requests.some(u=>u.includes('/python/')),false,'R does not initialize Python');
 assert.notEqual(await page.locator('#psilocin-app').getAttribute('data-r-busy'),'true');
 await page.getByRole('button',{name:'Run R cell 1',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.dataset.rBusy==='false',null,{timeout:180000});
 assert.match(await page.locator('.studio-inline-output').innerText(),/41/);
 await page.getByRole('button',{name:'Actions for cell 1',exact:true}).click();await page.getByRole('button',{name:'Duplicate cell',exact:true}).click();
 await page.getByLabel('R code cell 3',{exact:true}).waitFor({state:'attached'});
 if(!await page.locator('.studio-inline-cell').nth(2).locator('.studio-cell-code').evaluate(n=>n.open))await page.locator('.studio-inline-cell').nth(2).locator('.studio-cell-code summary').click();
 await page.getByLabel('R code cell 3',{exact:true}).fill('results <- data.frame(value=42)\nprint(results)');
 await page.getByRole('button',{name:'Run R cell 3',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.dataset.rBusy==='false',null,{timeout:180000});
 assert.match(await page.locator('.studio-inline-cell').first().textContent(),/41/);assert.match(await page.locator('.studio-inline-cell').last().textContent(),/42/);
 await page.getByRole('button',{name:'Actions for cell 3',exact:true}).click();await page.getByRole('button',{name:'Move up',exact:true}).click();
 await page.getByLabel('R code cell 2',{exact:true}).waitFor({state:'attached'});
 assert.equal(await page.locator('.studio-inline-cell').nth(2).locator('textarea').count(),1,'movement retains Markdown');
 await page.locator('.studio-save-status').filter({hasText:'Saved locally'}).waitFor();
 await page.waitForTimeout(450);await page.reload();await page.getByLabel('R code cell 2',{exact:true}).waitFor({state:'attached'});
 assert.match(await page.locator('.studio-inline-cell').nth(1).textContent(),/42/);assert.notEqual(await page.locator('#psilocin-app').getAttribute('data-r-busy'),'true');
 const overflow=await page.evaluate(()=>({document:document.documentElement.scrollWidth>innerWidth+1,studio:document.querySelector('.workspace-editor-view').scrollWidth>document.querySelector('.workspace-editor-view').clientWidth+1}));
 assert.deepEqual(overflow,{document:false,studio:false},`${width}/${theme} overflow`);
 await page.screenshot({path:`${output}/notebook-${width}-${theme}.png`});
 if(width===1440){const resizer=page.getByRole('separator',{name:'Navigation width',exact:true});const before=await resizer.getAttribute('aria-valuenow');await resizer.focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await resizer.getAttribute('aria-valuenow')),Number(before)+16);}
 assert.deepEqual(errors,[]);console.log(`PASS ${width}/${theme}: original notebook recovery, no autoexecute/lazy Python, inline execution, duplicate/move, simultaneous outputs, persistence, no overflow`);await context.close();
}}finally{await browser.close();}
