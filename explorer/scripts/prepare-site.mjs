import {networkPreviewSizes, networkPreviewCandidates, networkPreviewName} from "../src/components/network-preview-asset.js";
import { brandIcon } from "../src/components/app-brand.js";
import { transform } from "esbuild";
import { minify as minifyHTML } from "html-minifier-terser";
import {copyFile, mkdir, readFile, writeFile, readdir, cp, rm} from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
const assets = new URL('../src/assets/app/', import.meta.url);
await copyFile(new URL('../../docs/images/social-preview.png', import.meta.url), new URL('social-preview.png', output));
await mkdir(new URL('icons/', output), {recursive: true});
for (const name of ['favicon.ico', 'icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']) {
  await copyFile(new URL(name, assets), new URL(`icons/${name}`, output));
}
await copyFile(new URL('site.webmanifest', assets), new URL('site.webmanifest', output));

// Framework defaults restrict zoom. Publish one accessible viewport declaration.
const index = new URL('index.html', output);
let html = await readFile(index, 'utf8');
if ((html.match(/<meta name="viewport"[^>]*>/g) ?? []).length !== 1) {
  throw new Error('Expected exactly one viewport declaration');
}
html = html.replace(/<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
  .replace('<html>', '<html lang="en">')
  .replace(/href="https:\/\/psilocybin-research\.github\.io\/psilocin-human-neuron-transcriptomics\/(icons\/[^"]+|site\.webmanifest)"/g, 'href="./$1"');
// Start the required F7 stylesheet alongside the entry modules, rather than
// discovering it only after the Observable initialization block executes.
const runtimeStyles = (await readdir(new URL('_file/assets/vendor/', output))).filter(name => /^framework7\.[a-f0-9]+\.css$/.test(name));
if (runtimeStyles.length !== 1) throw new Error('Expected one content-hashed F7 stylesheet');
html = html.replace('<head>', `<head>\n<link rel="preload" as="style" href="./_file/assets/vendor/${runtimeStyles[0]}" fetchpriority="high">`);
// Discover the LCP image before the app's module graph initializes it.
const previewSrcset = networkPreviewCandidates.map(width => `./${networkPreviewName(width)} ${width}w`).join(', ');
html = html.replace('<head>', `<head>\n<link rel="preload" as="image" href="./oxphos-network-preview.webp" imagesrcset="${previewSrcset}" imagesizes="${networkPreviewSizes}" fetchpriority="high">`);
// Inline, dependency-free first paint: no request or runtime is needed to show the mark.
html = html.replace('</head>', `<style>
#atlas-boot{position:fixed;inset:0;z-index:2147483000;display:grid;place-content:center;justify-items:center;gap:18px;background:#f7f9fc;color:#235780;font:500 15px system-ui;text-align:center;padding:24px}
#atlas-boot > svg{width:76px;height:76px;filter:drop-shadow(0 8px 16px #23578020)}
#atlas-boot .boot-progress{height:3px;width:112px;overflow:hidden;background:#23578020;border-radius:3px}
#atlas-boot .boot-progress:after{content:"";display:block;width:40%;height:100%;background:#235780;animation:atlas-boot-slide 1.1s ease-in-out infinite alternate}
@keyframes atlas-boot-slide{to{transform:translateX(150%)}}
.dark #atlas-boot{background:#0e1923;color:#d8eaf7}
@media(prefers-reduced-motion:reduce){#atlas-boot .boot-progress:after{animation:none;width:100%}}
</style><script>try{var a=localStorage.getItem('atlas-appearance');document.documentElement.classList.toggle('dark',a?a==='dark':matchMedia('(prefers-color-scheme:dark)').matches)}catch(e){}setTimeout(()=>{const b=document.getElementById('atlas-boot');if(!b)return;const n=b.querySelector('span:last-child');if(n)n.textContent='Loading is taking longer than usual. Check your connection, or reload to try again.';const r=document.createElement('button');r.textContent='Reload';r.onclick=()=>location.reload();b.append(r)},15000)</script></head>`);
html = html.replace(/<body([^>]*)>/, `<body$1><div id="atlas-boot" role="status" aria-live="polite" aria-label="Loading Psilocin Transcriptome Atlas">${brandIcon()}<span>Psilocin Transcriptome Atlas</span><span class="boot-progress" aria-hidden="true"></span><span>Loading the research workspace…</span></div><noscript><style>#atlas-boot{display:none}</style></noscript>`);
const cellMarkers = html.match(/<!--:[^>]*-->/g) || [];
const compactHTML = await minifyHTML(html, {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  // Observable mounts reactive cells at these functional comment anchors.
  ignoreCustomComments: [/^:/],
  removeRedundantAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: false,
});
if (cellMarkers.some(marker => !compactHTML.includes(marker))) throw new Error('HTML minification removed an Observable mount marker');
await writeFile(index, compactHTML);

// Retain original ISC notices alongside redistributed D3 runtime code.
for (const name of ['d3-force@3.0.0', 'd3-quadtree@3.0.2', 'd3-dispatch@3.0.2', 'd3-timer@3.0.2', 'd3-chord@3.0.1', 'd3-shape@3.2.0', 'd3-path@3.1.1', 'd3-hexbin@0.2.2', 'd3-hierarchy@3.1.2']) {
  const directory = new URL(`_npm/${name}/`, output);
  const notice = await readFile(new URL(`../../third_party_licenses/${name.replace('@', '-')}.txt`, import.meta.url), 'utf8');
  let files;
  try { files = await readdir(directory); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const target = new URL(file, directory);
    const code = await readFile(target, 'utf8');
    if (!code.startsWith('/*!')) await writeFile(target, `/*!\n${notice}*/\n${code}`);
  }
}

// Keep source modules readable in the repository; publish compact ESM with the
// same exports and content-versioned URLs generated by Observable Framework.
const componentDirectory = new URL('_import/components/', output);
await Promise.all((await readdir(componentDirectory)).filter(name => name.endsWith('.js')).map(async name => {
  const file = new URL(name, componentDirectory);
  const source = await readFile(file, 'utf8');
  const result = await transform(source, { loader: 'js', format: 'esm', target: ['es2022'], minify: true, legalComments: 'inline' });
  await writeFile(file, result.code);
}));

// Dated public context is separate from the immutable study archive.
await rm(new URL('public-context/', output), {recursive:true,force:true});
await cp(new URL('../src/assets/public-context/', import.meta.url), new URL('public-context/', output), {recursive:true});

// Optional R runtime is served locally but excluded from the core PWA package.
await rm(new URL('webr/', output), {recursive:true, force:true});
await cp(new URL('../vendor/webr/', import.meta.url), new URL('webr/', output), {recursive:true});
await rm(new URL('webr-source/', output), {recursive:true, force:true});
await cp(new URL('../vendor/webr-source/', import.meta.url), new URL('webr-source/', output), {recursive:true});
// Optional locally hosted TeX engine, excluded from the core offline package.
await rm(new URL('latex/', output), {recursive:true, force:true});
await cp(new URL('../vendor/latex/', import.meta.url), new URL('latex/', output), {recursive:true});

for (const width of networkPreviewCandidates) {
  const name = networkPreviewName(width);
  await copyFile(new URL(`../src/assets/${name}`, import.meta.url), new URL(name, output));
}

// Python is separately requested; never included in the core offline runtime.
await rm(new URL('python/', output), {recursive:true, force:true});
await mkdir(new URL('python/', output), {recursive:true});
for (const name of ['pyodide.mjs','pyodide.asm.mjs','pyodide.asm.wasm','python_stdlib.zip','pyodide-lock.json']) {
  await copyFile(new URL(`../node_modules/pyodide/${name}`, import.meta.url), new URL(`python/${name}`, output));
}
await copyFile(new URL('../vendor/python/NOTICES.txt', import.meta.url), new URL('python/NOTICES.txt', output));
await copyFile(new URL('../vendor/python/PROVENANCE.json', import.meta.url), new URL('python/PROVENANCE.json', output));
