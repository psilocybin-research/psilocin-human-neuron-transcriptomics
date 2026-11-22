import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium'});
const page = await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const apiRequests=[];
const fixtureReadme = '<h1>Repository</h1>\n\n**Formatted** [relative](docs/guide.md)\n\n<img src="javascript:bad" onerror="window.injected=true"><script>window.injected=true</script>' + '\n\nLong-form scientific documentation and source context.'.repeat(90);
await page.route('https://api.github.com/repos/psilocybin-research/psilocin-human-neuron-transcriptomics/contents/**',async route=>{
 const request=route.request(),url=new URL(request.url());apiRequests.push(url.href);
 const raw=request.headers().accept?.includes('raw');
 const path=url.pathname.split('/contents/')[1];
 await route.fulfill({status:200,contentType:raw?'text/plain':'application/json',body:raw?fixtureReadme:JSON.stringify(path?[{name:'example.py',path:'src/example.py',type:'file',size:12}]:[{name:'src',path:'src',type:'dir'}])});
});
await page.route('**/compare/*', route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'ahead',ahead_by:2,commits:[{sha:'abc',commit:{message:'A new change'}}]})}));
await page.goto(process.env.ATLAS_URL || 'http://127.0.0.1:4173/');
await page.locator('[data-framework7="9.3.0"]').waitFor();
await page.getByRole('button',{name:'GitHub source',exact:true}).click();
const popup=page.locator('.source-browser');await popup.locator('.source-readme').waitFor();
const structure = await popup.evaluate(node => {
  const navbar = node.querySelector('.navbar');
  const background = node.querySelector('.navbar-bg');
  const toolbar = node.querySelector('.source-browser-tabs');
  const overview = node.querySelector('#source-overview');
  return {
    navbarBg: getComputedStyle(background).backgroundImage,
    tabs: toolbar.querySelectorAll('.tab-link').length,
    scrollHeight: overview.scrollHeight,
    clientHeight: overview.clientHeight,
    navbarY: navbar.getBoundingClientRect().top,
    toolbarY: toolbar.getBoundingClientRect().top,
  };
});
assert.match(structure.navbarBg,/gradient/);
assert.equal(structure.tabs,4);
assert(structure.scrollHeight>structure.clientHeight+100);
const scrolled = await popup.locator('#source-overview').evaluate(node => { node.scrollTop=240; return node.scrollTop; });
assert(scrolled>50);
const fixed = await popup.evaluate(node => ({
  navbarY: node.querySelector('.navbar').getBoundingClientRect().top,
  toolbarY: node.querySelector('.source-browser-tabs').getBoundingClientRect().top,
}));
assert(Math.abs(fixed.navbarY-structure.navbarY)<2);
assert(Math.abs(fixed.toolbarY-structure.toolbarY)<2);
assert.equal(await page.evaluate(()=>window.injected),undefined);
assert.equal(await popup.locator('.source-readme h1').innerText(),'Repository');
assert.equal(await popup.locator('.source-readme strong').innerText(),'Formatted');
assert.match(await popup.locator('.source-readme a').getAttribute('href'),/blob\/[a-f0-9]{40}\/docs\/guide.md$/);
assert.equal(await popup.locator('.source-readme [onerror],.source-readme script').count(),0);
await popup.getByText('Live',{exact:true}).click();await popup.getByRole('button',{name:'Check GitHub now'}).click();
await popup.getByText('GitHub main is 2 commits ahead of this build.',{exact:true}).waitFor();
await popup.getByText('A new change',{exact:true}).waitFor();
await popup.getByText('Files',{exact:true}).click();await popup.locator('#source-files button.item-content').first().click();
await popup.locator('#source-files .item-title').filter({hasText:'example.py'}).waitFor();
assert(apiRequests.every(url=>/ref=[a-f0-9]{40}/.test(url)));
await popup.getByText('Reproducibility',{exact:true}).click();
assert.match(await popup.locator('.tab-active').innerText(),/Frozen publication archive/);
await page.setViewportSize({width:390,height:844});
const tabScroll = await popup.locator('.source-browser-tabs .toolbar-inner').evaluate(node => {
  const scrollable = node.scrollWidth>node.clientWidth+1;
  node.scrollLeft = node.scrollWidth;
  return { scrollable, scrolled: node.scrollLeft };
});
assert(tabScroll.scrollable && tabScroll.scrolled>0, 'Mobile source tabs should scroll horizontally');
assert(await popup.evaluate(n=>n.scrollWidth<=n.clientWidth+1));
await popup.getByRole('button',{name:'Close',exact:true}).click();await popup.waitFor({state:'hidden'});
assert.deepEqual(errors,[]);await browser.close();console.log('Pinned source browser: F7 navigation, safe text, commit pinning, mobile width and close passed.');
