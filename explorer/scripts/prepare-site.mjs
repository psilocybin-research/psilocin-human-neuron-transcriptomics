import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';

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
