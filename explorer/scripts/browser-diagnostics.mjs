// Loaded only by the test runner. Successful diagnostic captures are discarded.
import {chromium,firefox,webkit} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const output=process.env.ATLAS_DIAGNOSTICS;
if(output){
 mkdirSync(output,{recursive:true});
 const events=[],seen=new WeakSet(),openBrowsers=new Set();let number=0;
 process.on('exit',()=>writeFileSync(join(output,'browser-events.json'),JSON.stringify(events,null,2)));
 const shutdown=async(code,error)=>{
  if(error)console.error(error.stack||error);
  for(const browser of openBrowsers)try{await browser.close();}catch{}
  process.exit(code);
 };
 process.once('uncaughtException',error=>shutdown(1,error));
 process.once('SIGTERM',()=>shutdown(143));
 for(const type of [chromium,firefox,webkit]){
  const launch=type.launch.bind(type);
  type.launch=async options=>{
   const browser=await launch(options),active=new Set();openBrowsers.add(browser);
   async function instrument(context){
    if(seen.has(context))return;seen.add(context);active.add(context);
    const id=++number;let ended=false;
    // DOM/action traces plus a final failure PNG avoid continuous WebGL screencasts.
    await context.tracing.start({screenshots:false,snapshots:true,sources:true});
    const watch=page=>{
     page.on('console',message=>{if(['error','warning'].includes(message.type()))events.push({type:message.type(),text:message.text(),url:page.url()});});
     page.on('pageerror',error=>events.push({type:'pageerror',text:error.stack,url:page.url()}));
    };
    context.on('page',watch);for(const page of context.pages())watch(page);
    const finish=async()=>{
     if(ended)return;ended=true;active.delete(context);
     for(const [index,page] of context.pages().entries())try{await page.screenshot({path:join(output,`context-${id}-page-${index}.png`),timeout:2000});}catch(error){events.push({type:'screenshot-error',text:error.message});}
     try{await context.tracing.stop({path:join(output,`trace-${id}.zip`)});}catch{}
    };
    const close=context.close.bind(context);context.close=async(...args)=>{await finish();return close(...args);};
    context.captureDiagnostics=finish;
   }
   const newContext=browser.newContext.bind(browser);browser.newContext=async(...args)=>{const context=await newContext(...args);await instrument(context);return context;};
   const newPage=browser.newPage.bind(browser);browser.newPage=async(...args)=>{const page=await newPage(...args);await instrument(page.context());return page;};
   const close=browser.close.bind(browser);browser.close=async(...args)=>{for(const context of active)await context.captureDiagnostics();openBrowsers.delete(browser);return close(...args);};
   return browser;
  };
 }
}
