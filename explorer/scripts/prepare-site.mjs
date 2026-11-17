import {copyFile, mkdir, readFile, writeFile, readdir} from 'node:fs/promises';

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
await writeFile(index, html);

// Retain original ISC notices alongside redistributed D3 runtime code.
for (const name of ['d3-force@3.0.0', 'd3-quadtree@3.0.2', 'd3-dispatch@3.0.2', 'd3-timer@3.0.2']) {
  const directory = new URL(`_npm/${name}/`, output);
  const notice = await readFile(new URL(`../../third_party_licenses/${name.replace('@', '-')}.txt`, import.meta.url), 'utf8');
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.js')) continue;
    const target = new URL(file, directory);
    const code = await readFile(target, 'utf8');
    if (!code.startsWith('/*!')) await writeFile(target, `/*!\n${notice}*/\n${code}`);
  }
}
