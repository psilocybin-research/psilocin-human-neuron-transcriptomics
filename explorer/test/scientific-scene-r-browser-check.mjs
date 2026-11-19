import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.ATLAS_URL||'http://127.0.0.1:4173/')+'#view=custom-r');
 const editor=page.getByLabel('R code cell 1',{exact:true});
 await editor.waitFor();
 await editor.fill('d <- data.frame(id=c("ENSG1","ENSG2"), a=c(0.123456789012345,-2), b=c(2,4), c=c(1,1))\natlas_scatter3d(d, "a", "b", "c", color="a", title="R scene integration")');
 await page.getByRole('button',{name:'Run R cell 1',exact:true}).click();
 await page.locator('.scientific-scene').waitFor({timeout:180000});
 await page.locator('.scientific-scene-viewport').scrollIntoViewIfNeeded();
 await page.waitForTimeout(250);
 const openScene=page.locator('.scientific-scene').getByRole('button',{name:'Open 3D scene',exact:true});
 if(await openScene.isEnabled())await openScene.click();
 await page.getByText(/2 points · Three/).waitFor({timeout:45000});
 const scene=await page.locator('.scientific-scene').evaluate(n=>n.getSceneSpec());
 assert.equal(scene.classification,'user-exploratory');assert.equal(scene.data[0].x,.123456789012345);
 assert.match(scene.source.code_sha256,/^[a-f0-9]{64}$/);assert.match(scene.source.sha256,/^[a-f0-9]{64}$/);
 assert.ok(scene.camera);assert.match(scene.source.run_utc,/T/);
 async function download(label){
  const pending=page.waitForEvent('download');
  await page.locator('.scientific-scene').getByRole('button',{name:label,exact:true}).click();
  await page.locator('.download-confirmation').getByRole('button',{name:'Download',exact:true}).click();
  const item=await pending,stream=await item.createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  return Buffer.concat(chunks);
 }
 const png=await download('Download scene PNG');assert.equal(png.subarray(1,4).toString(),'PNG');
 const json=JSON.parse((await download('Download scene JSON')).toString());assert.equal(json.data[0].x,.123456789012345);assert.ok(json.camera);
 const csv=(await download('Download scene CSV')).toString();assert.match(csv,/0.123456789012345/);
 await page.getByText("Saved locally",{exact:true}).waitFor();
 await page.waitForTimeout(250);
 await page.reload();
 await page.locator('.scientific-scene').waitFor();
 const restored=await page.locator('.scientific-scene').evaluate(n=>n.getSceneSpec());
 assert.equal(restored.data[0].x,.123456789012345);
 assert.equal(restored.source.code_sha256,scene.source.code_sha256);
 assert.notEqual(await page.locator('#psilocin-app').getAttribute('data-r-busy'),'true');
 assert.equal(await page.getByRole('button',{name:'Run R cell 1',exact:true}).isEnabled(),true);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,rGeneratedScene:true,exactPrecision:true,hashes:true,persistedScene:true,exports:["PNG","JSON with camera","CSV exact values"],noAutomaticExecution:true,errors}));
}finally{await browser.close();}
