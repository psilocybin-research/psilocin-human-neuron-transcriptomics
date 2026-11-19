import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium'});
try {
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:4173/')+'#view=custom-r');
await page.locator('.studio-inline-cell').first().waitFor();
async function tools(){await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Research tools',exact:true}).click();await page.locator('.studio-pane-sheet.modal-in').waitFor();if(await page.locator('.studio-runtime-settings').getAttribute('open')===null)await page.locator('.studio-runtime-settings summary').click();}
async function closeTools(){await page.locator('.studio-pane-sheet').getByRole('button',{name:'Done',exact:true}).click();await page.locator('.studio-pane-sheet').waitFor({state:'detached'});}
await tools();
await page.getByLabel('Notebook session',{exact:true}).check();await closeTools();
async function run(code){
 await page.locator('.studio-inline-cell.is-active .cm-content').fill(code);
 await page.waitForFunction(code=>document.querySelector('.studio-inline-cell.is-active .custom-r-editor')?.value===code,code);
 await page.getByRole('button',{name:'Run cell',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#psilocin-app')?.dataset.rBusy==='false',null,{timeout:180000});
 console.log('Completed:',code.slice(0,55));
 return page.getByLabel('R console output',{exact:true}).textContent();
}
const began=Date.now();
assert.match(await run('shared_value <- 41; results <- data.frame(value=shared_value); print(shared_value)'),/41/);
const cold=Date.now()-began;
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'ready');
await page.getByRole('button',{name:'Add cell',exact:true}).click();await page.getByRole('button',{name:'+ R cell',exact:true}).click();await page.getByLabel('R code cell 2',{exact:true}).waitFor();
const warmBegan=Date.now();
assert.match(await run('results <- data.frame(value=shared_value+1); print(results$value)'),/42/);
const warm=Date.now()-warmBegan;
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'ready');
// Ordinary results remains available across cells; exported tables are session snapshots.
assert.match(await run('cat("preserved result:", exists("results"))'),/preserved result: TRUE/);
assert.equal(await page.locator('.studio-inline-cell.is-active table').count(),1);
await page.getByRole('button',{name:'Export',exact:true}).click();await page.getByRole('button',{name:'Run metadata (.json)',exact:true}).click();const downloadEvent=page.waitForEvent('download');
await page.locator('.download-confirmation').getByRole('button',{name:'Download',exact:true}).click();
const download=await downloadEvent;const stream=await download.createReadStream();let json='';for await(const chunk of stream)json+=chunk;
const record=JSON.parse(json);assert.equal(record.prior_cells.length,2);assert.match(record.code,/shared_value <- 41/);assert.equal(record.execution_mode,'shared-notebook-session');
await tools();await page.getByRole('button',{name:'Restart R session',exact:true}).click();await closeTools();
assert.match(await run('cat("reset:", !exists("shared_value"))'),/reset: TRUE/);
// Switching notebooks closes the retained worker and preserves the explicit mode.
await page.getByRole('button',{name:'New notebook',exact:true}).click();
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'closed');
assert.match(await run('cat("notebook isolated:", !exists("shared_value"))'),/notebook isolated: TRUE/);
// Error closes the partially mutated session; an explicit next run recovers.
assert.match(await run('bad_state <- 1; stop("intentional recovery check")'),/intentional recovery check/);
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'closed');
assert.match(await run('cat("error reset:", !exists("bad_state"))'),/error reset: TRUE/);
await page.locator('.studio-inline-cell.is-active .cm-content').fill('Sys.sleep(120)');
await page.getByRole('button',{name:'Run cell',exact:true}).click();
await page.getByRole('button',{name:'Interrupt',exact:true}).click();
assert.equal(await page.locator('#psilocin-app').getAttribute('data-r-session'),'closed');
assert.match(await run('cat("recovered")'),/recovered/);
assert.match(await run('results <- data.frame(value=42); set.seed(123); first_random <- runif(1); genes$symbol[1] <- "USER_EDIT"; cat("initialized")'),/initialized/);
assert.match(await run('stopifnot(exists("results")); stopifnot(genes$symbol[1]=="USER_EDIT"); stopifnot(atlas_archive$genes$symbol[1]!="USER_EDIT"); observed <- runif(1); set.seed(123); expected <- runif(2)[2]; stopifnot(identical(observed,expected)); cat("persistent RNG and immutable archive verified")'),/persistent RNG and immutable archive verified/);
assert.deepEqual(errors,[]);
console.log(JSON.stringify({passed:true,cold_ms:cold,warm_ms:warm,checks:['cross-cell values','replay provenance','no stale results','reset','notebook isolation','error recovery','stop/restart']}));
}finally{await browser.close();}
