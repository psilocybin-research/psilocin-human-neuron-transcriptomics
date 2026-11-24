import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {openWorkspaceNavigation,selectWorkspace} from './workspace-browser-helpers.mjs';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium'});
try{
 const page=await browser.newPage({viewport:{width:390,height:900},hasTouch:true}),errors=[];page.on('pageerror',e=>(errors.push(e.message),console.error(e.stack)));
 await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:4173/')+'#view=custom-r');await page.locator('.studio-inline-cell').waitFor();
 const sidebar=()=>page.locator('.studio-sidebar:visible');
 const openPersonal=async()=>{const toggle=sidebar().getByRole('button',{name:/My analyses/});if(await toggle.getAttribute('aria-expanded')==='false')await toggle.click();};
 if(!await page.locator('.studio-inline-cell').first().locator('.studio-cell-code').evaluate(n=>n.open))await page.locator('.studio-inline-cell').first().locator('.studio-cell-code summary').click();
 await page.getByLabel('R code cell 1',{exact:true}).fill('# preserve this source; never run\nvalue <- 1.125');
 await openWorkspaceNavigation(page);
 assert.equal(await sidebar().getByRole('button',{name:/My analyses/}).getAttribute('aria-expanded'),'false','Analysis group must start collapsed');
 await openPersonal();
 await sidebar().getByRole('button',{name:'Actions for analysis Exploratory analysis',exact:true}).click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();
 await openWorkspaceNavigation(page);await openPersonal();await expect(sidebar().locator('.studio-book-entry')).toHaveCount(2);
 await sidebar().getByRole('button',{name:'Reorder',exact:true}).click();const handle=sidebar().getByRole('button',{name:'Reorder Exploratory analysis (copy); use arrow keys',exact:true});await handle.focus();await page.keyboard.press('ArrowUp');
 await expect(sidebar().locator('.studio-book-entry').first()).toContainText('copy');await sidebar().getByRole('button',{name:'Done',exact:true}).click();
 await sidebar().getByRole('button',{name:'Find analyses',exact:true}).click();await sidebar().getByRole('searchbox',{name:'Find analyses'}).fill('unmatched title');await sidebar().getByText('No matching analyses.',{exact:true}).waitFor();await sidebar().getByRole('button',{name:'Close analysis search',exact:true}).click();await openPersonal();
 const row=sidebar().locator('.studio-book-entry').first();await expect(row).toHaveClass(/swipeout/);await expect(row).toContainText('copy');
 const face=row.locator('.swipeout-content > .button').first();await face.scrollIntoViewIfNeeded();await expect(face).toBeVisible();
 // Start on the document row, not its trailing action button. Wait for the
 // search/accordion layout to settle before sending genuine touch input.
 await page.waitForFunction(()=>{const e=document.querySelector('.studio-sidebar:not([hidden]) .studio-book-entry .swipeout-content > .button');return e&&e.getBoundingClientRect().height>=44&&!document.querySelector('.studio-sidebar:not([hidden]) .analysis-search-open');});
 await face.click({trial:true});const box=await face.boundingBox(),cdp=await page.context().newCDPSession(page);
 assert.ok(box&&box.width>80&&box.height>=44,'Swipe start must be on a visible document row');
 const y=box.y+box.height/2,start=box.x+box.width-12,end=box.x+8;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*i/10,y}]});await new Promise(r=>setTimeout(r,16));}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(row,'Real horizontal swipe must reveal native actions').toHaveClass(/swipeout-opened/).catch(async error=>{console.error('Swipe diagnostics',await row.evaluate(e=>({className:e.className,rect:e.getBoundingClientRect().toJSON(),contentTransform:getComputedStyle(e.querySelector('.swipeout-content')).transform,panel:e.closest('.panel')?.className,hit:document.elementFromPoint(e.getBoundingClientRect().x+10,e.getBoundingClientRect().y+10)?.outerHTML.slice(0,250)})));throw error;});
 await row.locator('.swipeout-actions-right').getByRole('button',{name:'Move Exploratory analysis (copy) to Trash',exact:true}).tap();await expect(sidebar().locator('.studio-book-entry')).toHaveCount(1);await page.getByRole('region',{name:'Status update'}).getByRole('button',{name:'Undo',exact:true}).click();
 await expect(sidebar().locator('.studio-book-entry')).toHaveCount(2);
 // Trash survives reload; restoring returns the original editable source.
 await sidebar().getByRole('button',{name:'Actions for analysis Exploratory analysis (copy)',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();
 await page.reload();await page.locator('.studio-inline-cell').waitFor();await openWorkspaceNavigation(page);await openPersonal();await sidebar().getByRole('button',{name:'Trash (1)',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Restore',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Done',exact:true}).click();await page.locator('.analysis-trash-sheet').waitFor({state:'detached'});assert.match(await page.getByLabel('R code cell 1',{exact:true}).textContent(),/1.125/);
 await selectWorkspace(page,'Python Lab');await page.locator('.python-lab').waitFor();await openWorkspaceNavigation(page);await openPersonal();assert.equal(await page.locator('.studio-sidebar:visible').count(),1);await sidebar().getByRole('button',{name:'Actions for analysis Python analysis',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();await page.getByRole('region',{name:'Status update'}).getByRole('button',{name:'Undo',exact:true}).click();await expect(sidebar().locator('.studio-book-entry')).toHaveCount(1);
 await sidebar().getByRole('button',{name:'Actions for analysis Python analysis',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();await sidebar().getByRole('button',{name:'Trash (1)',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Restore',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Done',exact:true}).click();await page.locator('.analysis-trash-sheet').waitFor({state:'detached'});
 assert.match(await page.locator('.python-inspector').textContent(),/Runtime not initialized/);
 await selectWorkspace(page,'R Studio');await openWorkspaceNavigation(page);if(await sidebar().getByRole('button',{name:/Study result scripts/}).getAttribute('aria-expanded')==='false')await sidebar().getByRole('button',{name:/Study result scripts/}).click();await sidebar().locator('.studio-archived-analyses>.button').first().click();await openWorkspaceNavigation(page);await expect(sidebar().locator('.studio-book-entry [aria-current=true]')).toBeVisible();
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 console.log('PASS focused mobile: shallow navigation, search, duplicate, keyboard reorder, native swipe, Undo, persistent Trash/reload/restore, Python parity; no scientific runtime initialized.');
}finally{await browser.close();}
