// Exercise the real browser iframe lifecycle without opening an OS print dialog.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{})});
try{
 const page=await browser.newPage();
 await page.addInitScript(()=>{
  if(window===window.top)window.__printCalls=[];
  window.print=()=>window.top.__printCalls.push({
   title:document.title,text:document.body?.innerText||'',
   figures:document.querySelectorAll('.figure-shell').length,
   toolbars:document.querySelectorAll('.figure-toolbar').length,
   ready:document.readyState,
  });
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ATLAS_URL||'http://127.0.0.1:4173',{waitUntil:'networkidle'});
 let count=0;
 for(const tab of ['Overview','OXPHOS landscape','Gene explorer','Pathways','Robustness','DNA maintenance']){
  await page.getByRole('button',{name:tab,exact:true}).click();
  const buttons=page.locator('.figure-print');assert.ok(await buttons.count()>0,tab);
  // Test every plot, including HTML matrices and SVG plots with selected details.
  for(let i=0;i<await buttons.count();i++){
   const button=buttons.nth(i),title=(await button.getAttribute('aria-label')).replace(/^Print /,'');
   await button.click();count++;
   await page.waitForFunction(n=>window.__printCalls.length>=n,count);
   const calls=await page.evaluate(()=>window.__printCalls);
   assert.equal(calls.length,count,`${tab}: one populated print per click`);
   const call=calls.at(-1);assert.equal(call.title,title);assert.equal(call.figures,1);assert.equal(call.toolbars,0);assert.ok(call.text.includes(title));assert.notEqual(call.ready,'loading');
   // An extra iframe load event must not re-open print for the same document.
   await page.locator('.figure-print-frame').evaluate(f=>f.dispatchEvent(new Event('load')));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await page.evaluate(()=>window.__printCalls.length),count);
   // Simulate closing print preview; the frame is cleaned up and the next click works.
   await page.locator('.figure-print-frame').evaluate(f=>f.contentWindow.dispatchEvent(new Event('afterprint')));
   assert.equal(await page.locator('.figure-print-frame').count(),0);
  }
 }
 assert.deepEqual(errors,[]);
 console.log(`Print checks passed: ${count} chart actions across six views; one populated print each, duplicate-load guard and close/cleanup verified.`);
}finally{await browser.close();}
