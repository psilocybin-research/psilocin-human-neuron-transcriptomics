import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('src/assets/vendor/',root);
await mkdir(out,{recursive:true});
const result=await build({entryPoints:[fileURLToPath(new URL('scripts/framework7-entry.js',root))],outfile:fileURLToPath(new URL('framework7.js',out)),bundle:true,format:'esm',minify:true,target:['es2022'],legalComments:'inline',metafile:true});
await copyFile(new URL('node_modules/framework7/framework7-bundle.css',root),new URL('framework7.css',out));
const packages=[...new Set(Object.keys(result.metafile.inputs).map(p=>p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1]).filter(Boolean))].sort();
let notices='Framework7 research interface: bundled runtime notices\n\n';
for(const name of packages){const directory=new URL(`node_modules/${name}/`,root),pkg=JSON.parse(await readFile(new URL('package.json',directory),'utf8'));let license;for(const candidate of ['LICENSE','LICENSE.md','license','license.md']){try{license=await readFile(new URL(candidate,directory),'utf8');break;}catch{}}if(!license)throw new Error(`Missing runtime license for ${name}`);notices+=`${name} ${pkg.version}\n${license}\n\n`;}
await writeFile(new URL('framework7.NOTICES.txt',out),notices);
const runtime=new URL('framework7.js',out);await writeFile(runtime,`/*!\n${notices}*/\n${await readFile(runtime,'utf8')}`);
console.log(`Prepared Framework7 9.3.0 and ${packages.length} licensed runtime packages.`);
