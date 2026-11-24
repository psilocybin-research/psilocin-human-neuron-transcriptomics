import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/#view=overview');
  await page.getByRole('button',{name:'Explore 3D gene–pathway membership',exact:true}).click();
  const root=page.locator('.oxphos-network-3d');
  await page.waitForFunction(()=>document.querySelector('.oxphos-network-3d')?.dataset.layoutIntroduction==='running');
  assert.equal(await root.getAttribute('data-layout'),'layers');
  // A continuous introduction should move promptly into the final complex layout.
  const introductionStart=Date.now();
  await page.waitForFunction(()=>document.querySelector('.oxphos-network-3d')?.dataset.layout==='complex');
  await page.waitForFunction(()=>document.querySelector('.oxphos-network-3d')?.dataset.layoutReady==='true');
  assert(Date.now()-introductionStart<4500,'Introduction must not pause for five seconds');
  assert.equal(await root.getAttribute('data-layout-introduction'),'complete');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: first OXPHOS entry flows from layered to complex without a long pause on mobile and desktop.');
} finally {await browser.close();}
