import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const base = process.env.ATLAS_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ executablePath:'/usr/bin/chromium',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
try {
 for (const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
  await context.addInitScript(()=> {Element.prototype.requestFullscreen=undefined; Element.prototype.webkitRequestFullscreen=undefined;localStorage.setItem('atlas-appearance','light');});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#view=pathways');
  await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.f7);
  await page.locator('.pathway-method-comparison .gene-annotation-toggle').click();
  await page.locator('.method-comparison').waitFor();
  assert.match(await page.locator('.method-comparison').innerText(), /0\.587/);
  await page.getByRole('tab',{name:'Bayesian',exact:true}).click();
  await page.locator('.method-posterior-chart svg[role="img"]').waitFor();
  await page.getByRole('tab',{name:'Specifications',exact:true}).click();
  await page.getByLabel('Archived specification category',{exact:true}).selectOption('block');
  assert.match(await page.locator('.method-comparison').innerText(),/3 archived specifications/);
  await page.waitForFunction(()=>document.querySelector('.pathway-method-comparison .accordion-item-content').clientHeight>300);
  await page.locator('.method-comparison h3').scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/atlas-methods-${width}.png`});
  // Editing a contrast keeps method comparison open and selects only its exact rows.
  await page.locator('select[aria-label="Contrast"]').selectOption('day3_vs_control',{force:true});
  await page.locator('.method-comparison[data-contrast="day3_vs_control"]').waitFor();
  await page.getByRole('tab',{name:'Summary',exact:true}).click();
  assert.match(await page.locator('.method-comparison').innerText(),/All ten archived Day 3/);
  await page.goto(base+'#view=comparison');
  await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.f7);
  await page.locator('.research-figure-accordion .gene-annotation-toggle').click();
  await page.locator('.research-figure-stage svg[role="img"]').waitFor();
  await page.locator('.research-figure-builder').screenshot({path:`/tmp/atlas-figure-${width}.png`});
  await page.goto(base+'#view=overview');
  await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.f7);
  await page.locator('.oxphos-network-preview').click();
  const network=page.locator('.oxphos-network-3d');
  await network.locator('[data-renderer-ready="true"]').count();
  await page.waitForFunction(()=>document.querySelector('.oxphos-network-3d')?.dataset.rendererReady==='true');
  if(width<700) {
   assert.equal(await page.locator('.oxphos-mobile-fab').count(),0);
   await page.locator('.oxphos-mobile-toolbar').getByRole('button',{name:'View',exact:true}).click();
   const geometry=await page.evaluate(()=> {
    const canvas=document.querySelector('.oxphos-3d-stage').getBoundingClientRect();
    const panel=document.querySelector('.oxphos-mobile-inspector').getBoundingClientRect();
    return {canvasBottom:canvas.bottom,panelTop:panel.top,panelHeight:panel.height,viewport:innerHeight};
   });
   assert.ok(geometry.canvasBottom<=geometry.panelTop+1,JSON.stringify(geometry));
   assert.ok(geometry.panelHeight<=geometry.viewport*.4);
   await network.screenshot({path:'/tmp/atlas-mobile-controls.png'});
   await page.locator('.oxphos-mobile-inspector .oxphos-3d-layout-direct').first().click();
   assert.equal(await page.getByRole('switch',{name:'Layered network layout'}).isChecked(),true);
   await page.getByRole('button',{name:'Close controls',exact:true}).click();
   await page.locator('.oxphos-mobile-toolbar').getByRole('button',{name:'Find',exact:true}).click();
   await page.getByRole('searchbox',{name:'Search 3D OXPHOS genes'}).fill('GPX4');
   await page.locator('.oxphos-3d-gene-list').getByRole('button',{name:'GPX4',exact:true}).click();
   assert.equal(await page.locator('.oxphos-mobile-inspector').isVisible(),false);
   await page.locator('.oxphos-mobile-toolbar').getByRole('button',{name:'Evidence',exact:true}).click();
   await page.locator('.oxphos-mobile-inspector .research-panel-body svg[role="img"]').first().waitFor();
   await page.getByRole('button',{name:'Day 3',exact:true}).click();
   await page.locator('.oxphos-mobile-inspector').screenshot({path:`/tmp/atlas-mobile-inspector.png`});
  }
  await network.screenshot({path:`/tmp/atlas-network-studio-${width}.png`});
  assert.deepEqual(errors,[]);
  console.log(`PASS ${width}: archived comparisons, specifications, figure builder, network/mobile inspector`);
  await context.close();
 }
} finally { await browser.close(); }
