import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=createServer(async(req,res)=>{
 try {
  if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:12px;font:15px Arial"></body></html>');return;}
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(root+sep) && !path.startsWith(root)) throw Error('Invalid path');
  if(!(await stat(path)).isFile()) throw Error('Not a file');
  res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':'application/octet-stream');
  res.end(await readFile(path));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
 for(const width of [390,1440]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  await page.evaluate(async()=>{
   const {createScientificScene,scientificSceneContextCount}=await import('/src/components/scientific-scene.js');
   window.contextCount=scientificSceneContextCount;
   window.makeScene=()=>createScientificScene({schema:'psilocin-atlas/scientific-scene/1',kind:'scatter3d',classification:'user-exploratory',title:'Numerical scene verification',source:{label:'Synthetic software test'},axes:{x:'a',y:'b',z:'c'},color_label:'estimate',data:[{id:'ENSG1',x:.123456789012345,y:2,z:1,color:-2},{id:'ENSG2',x:2,y:3,z:1,color:2}]},{onSelect:value=>window.selection=value,onChange:spec=>window.changedScene=spec});
   window.scene=window.makeScene();document.body.append(window.scene);
  });
  await page.getByText(/2 points · Three/).waitFor();
  assert.equal(await page.locator('canvas').count(),1);
  assert.equal(await page.evaluate(()=>window.contextCount()),1);
  await page.getByText('Underlying data · 2 rows').click();
  await page.getByRole('button',{name:'ENSG1',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.selection.row.x),.123456789012345);
  const spec=await page.evaluate(()=>window.scene.getSceneSpec());
  assert.equal(spec.camera.position.length,3);
  assert.equal(spec.data[0].x,.123456789012345);
  const canvasBox=await page.locator('canvas').boundingBox();
  await page.mouse.move(canvasBox.x+canvasBox.width/2,canvasBox.y+canvasBox.height/2);
  await page.mouse.down();await page.mouse.move(canvasBox.x+canvasBox.width/2+40,canvasBox.y+canvasBox.height/2+20,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>window.changedScene?.camera);
  const changed=await page.evaluate(()=>window.changedScene);
  assert.notDeepEqual(changed.camera.position,spec.camera.position);assert.equal(changed.data[0].x,.123456789012345);
  await page.evaluate(()=>{window.second=window.makeScene();document.body.prepend(window.second);});
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(()=>window.contextCount()),1);
  assert.equal(await page.locator('canvas').count(),1);
  await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByText(/graphics context was lost/).waitFor();
  assert.equal(await page.evaluate(()=>window.contextCount()),0);
  await page.locator('.scientific-scene').first().getByRole('button',{name:'Explore in 3D',exact:true}).click();
  await page.locator('.scientific-scene').first().getByText(/2 points · Three/).waitFor();
  assert.equal(await page.evaluate(()=>window.contextCount()),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>{window.scene.destroy();window.second.destroy();});
  assert.equal(await page.evaluate(()=>window.contextCount()),0);
  assert.equal(await page.locator('canvas').count(),0);
  assert.deepEqual(errors,[]);
  let benchmark;
  if(width===1440) {
   const began=Date.now();
   await page.evaluate(async()=>{
    const {createScientificScene}=await import('/src/components/scientific-scene.js');
    document.body.replaceChildren();
    window.largeScene=createScientificScene({schema:'psilocin-atlas/scientific-scene/1',kind:'scatter3d',classification:'user-exploratory',title:'Synthetic 50000 point performance check',source:{label:'Synthetic software fixture; not scientific evidence'},axes:{x:'Synthetic x',y:'Synthetic y',z:'Synthetic z'},data:Array.from({length:50000},(_,i)=>({id:`test-${i}`,x:i,y:Math.sin(i),z:Math.cos(i),color:Math.sin(i/2)}))});
    document.body.append(window.largeScene);
   });
   await page.getByText(/50000 points · Three/).waitFor();
   benchmark={synthetic_points:50000,create_to_first_render_ms:Date.now()-began};
   assert.equal(await page.evaluate(()=>window.largeScene.getSceneSpec().data.length),50000);
   await page.evaluate(()=>window.largeScene.destroy());
   assert.equal(await page.evaluate(()=>window.contextCount()),0);
  }
  console.log(JSON.stringify({width,points:2,exactPrecision:true,camera:true,contextBudget:1,contextLossRecovery:true,cameraChangeCallback:true,disposed:true,benchmark,errors}));
  await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
