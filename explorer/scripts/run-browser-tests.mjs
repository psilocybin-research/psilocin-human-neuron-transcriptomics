import {spawn} from 'node:child_process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {scripts} from './browser-suite.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const group=process.argv[2]||'ui',tests=scripts(group);
const output=resolve(process.env.QA_OUTPUT||join(root,'../artifacts/browser',group));
await mkdir(output,{recursive:true});
let server,base=process.env.ATLAS_URL||process.env.BASE_URL;
if(!base){
 server=spawn('python3',['-u','-c','import http.server, functools; s=http.server.ThreadingHTTPServer(("127.0.0.1",0),functools.partial(http.server.SimpleHTTPRequestHandler,directory="dist")); print(s.server_address[1],flush=True); s.serve_forever()'],{cwd:root});
 server.stderr.pipe(createWriteStream(join(output,'server.log')));
 const port=await new Promise((accept,reject)=>{server.once('error',reject);server.stdout.once('data',data=>accept(Number(String(data).trim())));server.once('exit',code=>reject(Error(`Server exited ${code}`)));});
 base=`http://127.0.0.1:${port}/`;
}
const results=[];
try{
 for(const test of tests){
  const name=test.split('/').pop().replace('.mjs',''),diagnostics=join(output,name),started=performance.now();
  await mkdir(diagnostics,{recursive:true});
  const log=createWriteStream(join(output,`${name}.log`));
  console.log(`::group::${test}`);
  const child=spawn(process.execPath,['--import',fileURLToPath(new URL('browser-diagnostics.mjs',import.meta.url)),test],{cwd:root,env:{...process.env,ATLAS_URL:base,BASE_URL:base,QA_OUTPUT:diagnostics,ATLAS_DIAGNOSTICS:diagnostics}});
  child.stdout.on('data',data=>{process.stdout.write(data);log.write(data);});child.stderr.on('data',data=>{process.stderr.write(data);log.write(data);});
  let timedOut=false,forceStop;
  const timeout=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');forceStop=setTimeout(()=>child.kill('SIGKILL'),10000);},Number(process.env.BROWSER_TEST_TIMEOUT_MS||240000));
  const code=await new Promise(accept=>{child.once('error',()=>accept(1));child.once('exit',code=>accept(code??1));});clearTimeout(timeout);clearTimeout(forceStop);log.end();
  const result={test,seconds:Number(((performance.now()-started)/1000).toFixed(2)),code,timedOut};results.push(result);
  if(code===0)await rm(diagnostics,{recursive:true,force:true});
  console.log(`${code===0?'PASS':'FAIL'} ${test} ${result.seconds}s\n::endgroup::`);
 }
}finally{
 server?.kill('SIGTERM');
 await writeFile(join(output,'timings.json'),JSON.stringify(results,null,2)+'\n');
 const summary=['| Browser check | Seconds | Result |','| --- | ---: | --- |',...results.map(r=>`| ${r.test} | ${r.seconds} | ${r.code===0?'PASS':'FAIL'} |`)].join('\n')+'\n';
 await writeFile(join(output,'summary.md'),summary);
 if(process.env.GITHUB_STEP_SUMMARY){const {appendFile}=await import('node:fs/promises');await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);}
}
if(results.some(r=>r.code!==0)||results.length!==tests.length)process.exitCode=1;
