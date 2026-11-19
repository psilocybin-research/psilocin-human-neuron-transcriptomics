import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {openWorkspaceNavigation,selectWorkspace} from './workspace-browser-helpers.mjs';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium'});
try{
 const page=await browser.newPage({viewport:{width:390,height:900},hasTouch:true}),errors=[];page.on('pageerror',e=>(errors.push(e.message),console.error(e.stack)));
 await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:4173/')+'#view=custom-r');await page.locator('.studio-inline-cell').waitFor();
 const sidebar=()=>page.locator('.studio-sidebar:visible');
 await page.getByLabel('R code cell 1',{exact:true}).fill('# preserve this source; never run\nvalue <- 1.125');
 await openWorkspaceNavigation(page);
 await sidebar().getByRole('button',{name:'Actions for analysis Exploratory analysis',exact:true}).click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();
 await openWorkspaceNavigation(page);assert.equal(await sidebar().locator('.studio-book-entry').count(),2);
 await sidebar().getByRole('button',{name:'Reorder',exact:true}).click();const handle=sidebar().getByRole('button',{name:'Reorder Exploratory analysis (copy); use arrow keys',exact:true});await handle.focus();await page.keyboard.press('ArrowUp');
 assert.match(await sidebar().locator('.studio-book-entry').first().innerText(),/copy/);await sidebar().getByRole('button',{name:'Done',exact:true}).click();
 await sidebar().getByRole('searchbox',{name:'Find analyses'}).fill('unmatched title');await sidebar().getByText('No matching analyses.',{exact:true}).waitFor();await sidebar().getByRole('searchbox',{name:'Find analyses'}).fill('');
 const row=sidebar().locator('.studio-book-entry').first(),box=await row.boundingBox(),cdp=await page.context().newCDPSession(page);
 const y=box.y+box.height/2,start=box.x+box.width-35,end=box.x+25;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start,y}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start+(end-start)*i/8,y}]});await new Promise(r=>setTimeout(r,20));}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await row.locator('.swipeout-actions-right').getByRole('button',{name:'Move Exploratory analysis (copy) to Trash',exact:true}).tap();await page.locator('.toast').getByText('Undo',{exact:true}).click();
 assert.equal(await sidebar().locator('.studio-book-entry').count(),2);
 // Trash survives reload; restoring returns the original editable source.
 await sidebar().getByRole('button',{name:'Actions for analysis Exploratory analysis (copy)',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();
 await page.reload();await page.locator('.studio-inline-cell').waitFor();await openWorkspaceNavigation(page);await sidebar().getByRole('button',{name:'Trash (1)',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Restore',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Done',exact:true}).click();assert.match(await page.getByLabel('R code cell 1',{exact:true}).innerText(),/1.125/);
 await selectWorkspace(page,'Python Lab');await page.locator('.python-lab').waitFor();await openWorkspaceNavigation(page);assert.equal(await page.locator('.studio-sidebar:visible').count(),1);await sidebar().getByRole('button',{name:'Actions for analysis Python analysis',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();await page.locator('.toast').getByText('Undo',{exact:true}).click();assert.equal(await sidebar().locator('.studio-book-entry').count(),1);
 await sidebar().getByRole('button',{name:'Actions for analysis Python analysis',exact:true}).click();await page.getByRole('button',{name:'Move to Trash',exact:true}).click();await sidebar().getByRole('button',{name:'Trash (1)',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Restore',exact:true}).click();await page.locator('.analysis-trash-sheet').getByRole('button',{name:'Done',exact:true}).click();
 assert.match(await page.locator('.python-inspector').textContent(),/Runtime not initialized/);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 console.log('PASS focused mobile: shallow navigation, search, duplicate, keyboard reorder, native swipe, Undo, persistent Trash/reload/restore, Python parity; no scientific runtime initialized.');
}finally{await browser.close();}
