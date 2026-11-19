import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium'});
try {
 const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.ATLAS_URL||'http://127.0.0.1:4173/';
 async function download(button){
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await button.click();const pending=page.waitForEvent('download');await page.locator('.download-confirmation').getByRole('button',{name:'Download',exact:true}).click();
  const d=await pending;await page.locator('.download-confirmation').waitFor({state:'detached'});return readFile(await d.path(),'utf8');
 }
 await page.goto(base+'#view=comparison');await page.locator('.research-figure-accordion .gene-annotation-toggle').click();
 await page.locator('.research-figure-stage svg[role=img]').waitFor();
 for(const mode of ['scatter','intervals','profiles']){
  await page.locator('.research-figure-builder select[aria-label=Figure]').selectOption(mode,{force:true});
  await page.waitForTimeout(250);
  const source=await download(page.getByRole('button',{name:'Download Plot code',exact:true}));
  const validation=await page.evaluate(async source=>{
   const plotURL=performance.getEntriesByType('resource').map(e=>e.name).find(name=>/observable-plot\..*\.js/.test(name));
   if(!plotURL)throw Error('Plot runtime not found');
   const moduleURL=URL.createObjectURL(new Blob([source.replace('from "@observablehq/plot"',`from ${JSON.stringify(plotURL)}`)],{type:'text/javascript'}));
   try {const m=await import(moduleURL);return {rows:m.spec.rows.length,svg:!!m.figure.querySelector('svg')||m.figure.tagName.toLowerCase()==='svg',marks:m.figure.querySelectorAll('circle,path,line').length,version:m.spec.renderer.version};}
   finally {URL.revokeObjectURL(moduleURL);}
  },source);
  assert.ok(validation.rows>0);assert.ok(validation.svg);assert.ok(validation.marks>0);assert.equal(validation.version,'0.6.19');
 }
 await page.goto(base+'#view=custom-r');await page.getByLabel('Research notebook',{exact:true}).waitFor({state:'attached'});
 await page.getByRole('button',{name:'Add Markdown',exact:true}).click();
 await page.getByLabel('Markdown cell',{exact:true}).fill('## Exploratory notes\n<script>throw Error("must not run")</script>');
 await page.locator('.research-studio-notebook-actions > summary').click();
 const html=await download(page.getByRole('button',{name:'Download notebook HTML',exact:true}));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes("default-src 'none'"));
 const qmd=await download(page.getByRole('button',{name:'Download Quarto source',exact:true}));assert.match(qmd,/enabled: false/);
 const rmd=await download(page.getByRole('button',{name:'Download R Markdown',exact:true}));assert.match(rmd,/eval=FALSE/);
 assert.deepEqual(errors,[]);console.log('PASS three exported Plot modules execute with exact rows; HTML/Quarto/Rmd notebook exports preserve notes without execution.');
}finally {await browser.close();}
