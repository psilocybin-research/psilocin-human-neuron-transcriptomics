import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
const base=process.env.ATLAS_URL||'http://127.0.0.1:4173';
const output=new URL('../../artifacts/fullscreen-check/',import.meta.url);
await mkdir(output,{recursive:true});
const results=[];
try{
 for(const screen of [
  {name:'desktop',width:1920,height:1080,touch:false},
  {name:'small-desktop',width:1024,height:640,touch:false},
  {name:'portrait',width:390,height:844,touch:true},
  {name:'landscape',width:844,height:390,touch:true},
  {name:'tablet',width:768,height:1024,touch:true}
 ]){
  const context=await browser.newContext({viewport:{width:screen.width,height:screen.height},isMobile:screen.touch,hasTouch:screen.touch});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.atlas-navigation').waitFor();
  for(const tab of ['Overview','OXPHOS landscape','Gene explorer','Pathways','Robustness','DNA maintenance']){
   const menu=page.getByRole('button',{name:'Open section menu',exact:true});if(await menu.isVisible())await menu.click();
   await page.getByRole('button',{name:tab,exact:true}).click();
   const buttons=page.locator('.figure-fullscreen');await buttons.first().waitFor({state:'visible'});
   const count=await buttons.count();assert.ok(count>0,`${screen.name}: ${tab} has fullscreen controls`);
   for(let i=0;i<count;i++){
    await buttons.nth(i).click();await page.waitForFunction(()=>Boolean(document.fullscreenElement||document.webkitFullscreenElement));
    const shell=page.locator('.figure-shell:fullscreen');
    const box=await shell.evaluate(f=>({width:f.clientWidth,height:f.clientHeight,scrollWidth:f.scrollWidth,scrollHeight:f.scrollHeight,title:f.getAttribute('aria-label'),panes:[...f.children].map(n=>({height:n.clientHeight,bottom:n.getBoundingClientRect().bottom})),bottom:f.getBoundingClientRect().bottom}));
    assert.ok(box.scrollWidth<=box.width+1&&box.scrollHeight<=box.height+1,`${screen.name}: ${tab} outer overflow`);
    assert.ok(box.panes.at(-1).height>100,`${screen.name}: ${tab} collapsed plot`);
    assert.ok(box.panes.every(n=>n.bottom<=box.bottom+1),`${screen.name}: ${tab} clipped pane`);
    const map=shell.locator('.heatmap-scroll,.dna-map-scroll');
    if(await map.count()){
     const dimensions=await map.evaluate(n=>({h:n.clientHeight,w:n.clientWidth,sh:n.scrollHeight,sw:n.scrollWidth}));
     assert.ok(dimensions.h>100,`${screen.name}: ${tab} map collapsed`);
     const detail=shell.locator('.gene-detail');assert.ok(await detail.evaluate(n=>n.clientHeight)>80,`${screen.name}: detail collapsed`);
     if(dimensions.sh>dimensions.h+1){
      await map.hover();await page.mouse.wheel(0,350);
      await page.waitForFunction(()=>document.fullscreenElement.querySelector('.heatmap-scroll,.dna-map-scroll').scrollTop>0);
      await map.evaluate(n=>n.scrollTop=n.scrollHeight);
     }
     const rows=map.locator('.gene-row,.dna-row'),last=rows.last();
     const lastVisible=await last.evaluate(n=>{const p=n.closest('.heatmap-scroll,.dna-map-scroll').getBoundingClientRect(),r=n.getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1;});
     assert.ok(lastVisible,`${screen.name}: ${tab} last row unreachable`);
     await map.evaluate(n=>n.scrollLeft=0);
     const label=await last.getAttribute('aria-label'),gene=label.replace(/^Inspect (?:DNA-maintenance gene )?/,'').split(',')[0];
     await last.click({position:{x:40,y:8}});
     await page.waitForFunction(g=>document.fullscreenElement.querySelector('.gene-symbol')?.textContent===g,gene);
     if(dimensions.sw>dimensions.w+1){await map.evaluate(n=>n.scrollLeft=n.scrollWidth);assert.ok(await map.evaluate(n=>n.scrollLeft)>0,`${screen.name}: horizontal map scroll`);}
     if(await detail.evaluate(n=>n.scrollHeight>n.clientHeight+1)){await detail.evaluate(n=>n.scrollTop=n.scrollHeight);assert.ok(await detail.evaluate(n=>n.scrollTop)>0,`${screen.name}: detail scroll`);}
     if(tab==='OXPHOS landscape'||tab==='DNA maintenance')await page.screenshot({path:fileURLToPath(new URL(`${screen.name}-${tab==='DNA maintenance'?'dna':'oxphos'}.png`,output))});
    }
    const viewport=shell.locator('.plot-viewport');
    if(await viewport.count()){
     const dimensions=await viewport.evaluate(n=>({w:n.clientWidth,sw:n.scrollWidth,h:n.clientHeight,sh:n.scrollHeight}));
     if(dimensions.sw>dimensions.w+1){await viewport.evaluate(n=>n.scrollLeft=n.scrollWidth);assert.ok(await viewport.evaluate(n=>n.scrollLeft)>0);}
     if(dimensions.sh>dimensions.h+1){await viewport.evaluate(n=>n.scrollTop=n.scrollHeight);assert.ok(await viewport.evaluate(n=>n.scrollTop)>0);}
    }
    results.push({screen:screen.name,tab,title:box.title});
    await shell.getByRole('button',{name:'Exit full screen',exact:true}).click();
    await page.waitForFunction(()=>!document.fullscreenElement&&!document.webkitFullscreenElement);
   }
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(new URL('results.json',output),JSON.stringify(results,null,2));
 console.log(`Fullscreen checks passed: ${results.length} plots across desktop, portrait, landscape and tablet layouts; map ends, selection and pane scrolling verified.`);
}finally{await browser.close();}
