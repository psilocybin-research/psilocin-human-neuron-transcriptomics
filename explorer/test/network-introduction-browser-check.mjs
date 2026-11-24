import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 for(const width of [390,1440]) {
  const page=await browser.newPage({viewport:{width,height:950}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.ATLAS_URL||process.env.BASE_URL||'http://127.0.0.1:4173/')+'#view=overview');
  await page.getByRole('button',{name:'Explore 3D gene–pathway membership',exact:true}).click();
  const root=page.locator('.oxphos-network-3d');
  await page.waitForFunction(()=>document.querySelector('.oxphos-network-3d')?.dataset.rendererReady==='true');
  const started=Date.now();
  await page.waitForFunction(()=>document.querySelector('.oxphos-network-3d')?.dataset.layout==='complex',null,{timeout:5000});
  await page.waitForFunction(()=>document.querySelector('.oxphos-network-3d')?.dataset.layoutReady==='true',null,{timeout:5000});
  assert.equal(await root.getAttribute('data-layout-introduction'),'complete');
  assert(Date.now()-started<5000,'First-run network should settle without the old 5-second hold after renderer startup');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: first OXPHOS appearance settles directly into complex layout without a 5-second hold on mobile and desktop.');
} finally {await browser.close();}
