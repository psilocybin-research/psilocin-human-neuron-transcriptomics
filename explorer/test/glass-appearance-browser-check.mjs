import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const output=process.env.QA_OUTPUT || '/tmp/atlas-glass-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {})});
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try {
 await page.goto(process.env.ATLAS_URL || 'http://127.0.0.1:4191/');
 await page.locator('[data-framework7]').waitFor();
 const root=page.locator('#psilocin-app'),darkMode=page.getByRole('switch',{name:'Dark mode',exact:true});
 assert.equal(await root.getAttribute('data-glass-effects'),'true');
 const tab=page.locator('[data-quick=genes]');
 await tab.tap();
 await page.waitForFunction(()=>new URLSearchParams(location.hash.slice(1)).get('view')==='genes');
 assert.equal(await tab.evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
 async function assertRestingLens(destination) {
  await page.waitForFunction(destination=>{
   const bar=document.querySelector('.research-tabbar'),lens=bar.querySelector('.tab-link-highlight'),active=bar.querySelector('.tab-link-active');
   if(bar.dataset.activeDestination!==destination||!active||!lens||lens.classList.contains('tab-link-highlight-pressed'))return false;
   const l=lens.getBoundingClientRect(),a=active.getBoundingClientRect();
   return Math.abs(l.x+l.width/2-a.x-a.width/2)<8 && getComputedStyle(lens,'::after').opacity==='1';
  },destination);
  assert.equal(await page.locator('.research-tabbar .tab-link-highlight').evaluate(n=>getComputedStyle(n,'::before').opacity),'0');
 }
 await assertRestingLens('genes');
 await page.locator('.research-tabbar').screenshot({path:`${output}/bottom-bar-active-glass.png`,animations:'disabled'});
 const target=await tab.boundingBox(),cdp=await context.newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x+target.width/2,y:target.y+target.height/2}]});
 await page.locator('.tab-link-highlight-pressed').waitFor();
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.tab-link-highlight-pressed'),'::after').scale==='1.16');
 const geometry=await page.locator('.tab-link-highlight').evaluate(n=>{
  const style=getComputedStyle(n,'::after'),r=n.getBoundingClientRect(),pane=n.closest('.toolbar-pane').getBoundingClientRect();
  const inset=parseFloat(style.left),width=(r.width-2*inset)*Number(style.scale);
  return {scale:style.scale,left:r.x+(r.width-width)/2,right:r.x+(r.width+width)/2,paneLeft:pane.x,paneRight:pane.right};
 });
 assert.equal(geometry.scale,'1.16');
 assert.ok(geometry.left>=geometry.paneLeft && geometry.right<=geometry.paneRight,'Glass stays inside toolbar');
 await page.screenshot({path:`${output}/mobile-glass-pressed.png`});
 await page.locator('.research-tabbar').screenshot({path:`${output}/bottom-bar-pressed-glass.png`,animations:'disabled'});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForTimeout(350); // Allow the touch-generated click to finish before opening another surface.
 await assertRestingLens('genes');
 // Non-tab navigation must move the native capsule too.
 await page.getByRole('button',{name:'Open section menu',exact:true}).tap();
 const pathwaysGroup=page.locator('.research-sidebar [aria-controls=nav-group-pathways]');
 if(await pathwaysGroup.getAttribute('aria-expanded')==='false')await pathwaysGroup.tap();
 await page.waitForFunction(()=>!document.querySelector('#nav-group-pathways').inert);
 await page.locator('.research-sidebar').locator('[data-section=comparison]').tap();
 await page.locator('.research-sidebar').waitFor({state:'hidden'});
 await assertRestingLens('comparison');
 await page.locator('[data-quick=sources]').tap();await assertRestingLens('sources');
 await page.getByRole('button',{name:'Back from references',exact:true}).tap();
 await assertRestingLens('comparison');
 await page.getByRole('button',{name:'Open section menu',exact:true}).tap();
 await page.locator('.research-sidebar [data-section=overview]').tap();
 await page.waitForFunction(()=>{const bar=document.querySelector('.research-tabbar');return bar.dataset.activeDestination===''&&getComputedStyle(bar.querySelector('.tab-link-highlight')).opacity==='0';});
 assert.equal(await page.locator('.research-tabbar .tab-link-active').count(),0);
 assert.equal(await page.locator('.research-tabbar .tab-link-highlight').evaluate(n=>getComputedStyle(n).opacity),'0');
 await tab.tap();await assertRestingLens('genes');
 await darkMode.tap();
 await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
 assert.equal(await darkMode.getAttribute('aria-checked'),'true');
 await page.reload();await page.locator('[data-framework7]').waitFor();
 assert.equal(await root.getAttribute('data-glass-effects'),'true','Glass is always enabled');
 await assertRestingLens('genes');
 await page.screenshot({path:`${output}/mobile-dark-glass.png`});
 await page.locator('.research-tabbar').screenshot({path:`${output}/bottom-bar-dark-active-glass.png`,animations:'disabled'});
 await page.setViewportSize({width:1440,height:960});
 await darkMode.tap();await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));
 await page.locator('.desktop-gene-finder').click();
 const finder=page.locator('.autocomplete-popup.modal-in');await finder.waitFor();
 await finder.locator('input[type=search]').fill('appearance settings');
 const appearanceSetting=finder.getByRole('radio',{name:/Appearance settings.*Switch to dark mode/i});
 await appearanceSetting.waitFor();await appearanceSetting.click();
 await finder.waitFor({state:'detached'});
 await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
 await page.screenshot({path:`${output}/desktop-glass.png`});
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('#psilocin-app').dataset.reducedMotion==='true');
 assert.equal(await page.evaluate(()=>document.querySelector('#psilocin-app').f7.params.touch.touchHighlight),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({checks:'persistent active/released glass, sidebar and Sources synchronization, no false active destination, press containment, transparent tab, always-on glass, direct dark mode, Gene Finder appearance setting, reduced motion, no runtime errors',geometry,screenshots:output}));
} finally {await browser.close();}
