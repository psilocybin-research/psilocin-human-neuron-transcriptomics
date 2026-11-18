import {chromium,firefox,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const engine=process.env.ATLAS_BROWSER||'chromium',url=process.env.ATLAS_URL||'http://127.0.0.1:4173/',output=process.env.QA_OUTPUT||'/tmp/atlas-tour-qa';
await mkdir(output,{recursive:true});
const browser=await ({chromium,firefox,webkit}[engine]).launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const errors=[],results=[];
try {
 for(const width of [320,390,768,1440])for(const appearance of ['light','dark']){
  const touch=width<=390,context=await browser.newContext({viewport:{width,height:width===320?568:900},hasTouch:touch});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(value=>localStorage.setItem('atlas-appearance',value),appearance);
  await page.goto(url+'#view=genes&gene=GPX4');await page.locator('[data-framework7]').waitFor();await page.locator('.gene-symbol').filter({hasText:'GPX4'}).waitFor();
  const location=page.url();assert.equal(await page.locator('.atlas-tour.modal-in').count(),0);
  async function open(){if(width>=1180)await page.locator('.research-sidebar').getByRole('button',{name:'Atlas tour',exact:true}).click();else{await page.getByRole('button',{name:'Open section menu',exact:true}).click();await page.locator('.research-sidebar.panel-in').getByRole('button',{name:'Atlas tour',exact:true}).click();}await page.getByRole('dialog',{name:'Atlas tour',exact:true}).waitFor();await page.locator('.atlas-tour[data-shell-modal-ready=true]').waitFor();}
  await open();const tour=page.getByRole('dialog',{name:'Atlas tour',exact:true});
  assert.equal(await tour.getByRole('button',{name:'Back',exact:true}).isDisabled(),true);
  const headings=['A transcriptomic research atlas','Connect pathways, genes and profiles','Interpret contrasts with the study design','Explore the archived data with R','Inspect, export and verify'];
  for(let step=0;step<headings.length;step++){
   assert.equal(await tour.locator('h3').innerText(),headings[step]);assert.equal(await tour.locator('[aria-current=step]').count(),1);assert.equal(await tour.locator('.tour-counter').innerText(),`${step+1} of 5`);
   assert.equal(await tour.evaluate(n=>n.scrollWidth<=n.clientWidth+1),true);
   assert.equal(await tour.locator('.tour-footer').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}),true);
   if(step===0)assert.match(await tour.innerText(),/three differentiation blocks and two genetic backgrounds/);
   if(step===2)assert.match(await tour.innerText(),/inter-gene correlation/);
   if(step===1){await tour.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await tour.locator('h3').innerText(),headings[0]);await tour.getByRole('button',{name:'Next',exact:true}).click();}
   if((width===1440&&appearance==='light'&&step===1)||(width===390&&appearance==='dark'&&step===2))await page.screenshot({path:`${output}/${engine}-${width}-${appearance}.png`});
   const next=tour.getByRole('button',{name:step===4?'Finish tour':'Next',exact:true});if(touch)await next.tap();else await next.click();
  }
  await page.locator('.atlas-tour').waitFor({state:'hidden'});assert.equal(page.url(),location);assert.equal(await page.locator('.gene-symbol').innerText(),'GPX4');
  await open();assert.equal(await tour.locator('.tour-counter').innerText(),'1 of 5');await tour.getByRole('button',{name:'Next',exact:true}).click();await page.keyboard.press('Escape');await page.locator('.atlas-tour').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent),width>=1180?'Atlas tour':'Open section menu');
  await open();await tour.getByRole('button',{name:'Next',exact:true}).focus();await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.textContent),'Close');if(width===1440)await page.mouse.click(5,5);else await tour.getByRole('button',{name:'Close',exact:true}).click();await page.locator('.atlas-tour').waitFor({state:'hidden'});
  results.push({width,appearance,steps:5,touch,preserves_selection:true,escape:true,restart:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(`${output}/${engine}-tour-result.json`,JSON.stringify({passed:true,engine,results},null,2));console.log(`Atlas tour passed (${engine}): all steps, 4 widths, light/dark, touch, focus return and unchanged selection.`);
}finally{await browser.close();}
