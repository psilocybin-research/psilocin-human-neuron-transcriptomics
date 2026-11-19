import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium'});
try {
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:4173/')+'#view=custom-r');
await page.getByLabel('Research notebook',{exact:true}).waitFor({state:'attached'});
await page.getByLabel('Share R session between cells',{exact:true}).check();
async function run(code){
 await page.getByLabel('R code',{exact:true}).fill(code);
 await page.getByRole('button',{name:'Run analysis',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.dataset.rBusy==='false',null,{timeout:180000});
 console.log('Completed:',code.slice(0,55));
 return page.getByLabel('R console output',{exact:true}).innerText();
}
const began=Date.now();
assert.match(await run('shared_value <- 41; results <- data.frame(value=shared_value); print(shared_value)'),/41/);
const cold=Date.now()-began;
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'ready');
await page.getByRole('button',{name:'Add R cell',exact:true}).click();
const warmBegan=Date.now();
assert.match(await run('results <- data.frame(value=shared_value+1); print(results$value)'),/42/);
const warm=Date.now()-warmBegan;
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'ready');
// A cell without results must not inherit the previous cell's exported table.
assert.match(await run('cat("no stale result:", !exists("results"))'),/no stale result: TRUE/);
assert.equal(await page.getByRole('button',{name:'Download results CSV',exact:true}).isDisabled(),true);
const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download run record',exact:true}).click();
await page.locator('.download-confirmation').getByRole('button',{name:'Download',exact:true}).click();
const download=await downloadEvent;const stream=await download.createReadStream();let json='';for await(const chunk of stream)json+=chunk;
const record=JSON.parse(json);assert.equal(record.prior_cells.length,2);assert.match(record.code,/shared_value <- 41/);assert.equal(record.execution_mode,'shared-notebook-session');
await page.getByRole('button',{name:'Reset R session',exact:true}).click();
assert.match(await run('cat("reset:", !exists("shared_value"))'),/reset: TRUE/);
// Switching notebooks closes the retained worker and preserves the explicit mode.
await page.getByRole('button',{name:'New notebook',exact:true}).click();
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'closed');
assert.match(await run('cat("notebook isolated:", !exists("shared_value"))'),/notebook isolated: TRUE/);
// Error closes the partially mutated session; an explicit next run recovers.
assert.match(await run('bad_state <- 1; stop("intentional recovery check")'),/intentional recovery check/);
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'closed');
assert.match(await run('cat("error reset:", !exists("bad_state"))'),/error reset: TRUE/);
await page.getByLabel('R code',{exact:true}).fill('Sys.sleep(120)');
await page.getByRole('button',{name:'Run analysis',exact:true}).click();
await page.getByRole('button',{name:'Stop',exact:true}).click();
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'closed');
assert.match(await run('cat("recovered")'),/recovered/);
assert.deepEqual(errors,[]);
console.log(JSON.stringify({passed:true,cold_ms:cold,warm_ms:warm,checks:['cross-cell values','replay provenance','no stale results','reset','notebook isolation','error recovery','stop/restart']}));
}finally{await browser.close();}
