import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {SCIENTIFIC_R_HELPERS,SCIENTIFIC_PYTHON_HELPERS} from '../src/components/scientific-scene-helpers.js';
import {validateSceneSpec} from '../src/components/scientific-scene-spec.js';
const rAvailable=!spawnSync('Rscript',['--version']).error;
const pythonAvailable=!spawnSync('python3',['--version']).error;
for(const language of ['R','Python']) test(`${language} helper serializes Unicode, escaped strings and exact doubles; aliases retain exploratory classification`,{skip:language==='R'?!rAvailable:!pythonAvailable},()=>{
 const dir=mkdtempSync(join(tmpdir(),'atlas-scene-'));
 try {
  const output=join(dir,'scene.json'),source=join(dir,language==='R'?'script.R':'script.py');
  const tail=language==='R'?`
options(atlas.scene.file=${JSON.stringify(output)})
d <- data.frame(id=c('ENSG1','ENSG2'), a=c(.123456789012345,-2), b=c(2,3), c=c(1,1))
s <- atlas_scatter3d(d, 'a','b','c',color='a',title='Δ \\"quote\\" \\\\ path')
stopifnot(inherits(try(atlas_scatter3d(transform(d,a=c(NA,1)), 'a','b','c'),silent=TRUE),'try-error'))
s$classification <- 'archived'
atlas_scene(s)
`: `
ATLAS_SCENE_FILE=${JSON.stringify(output)}
d=[dict(id='ENSG1',a=.123456789012345,b=2,c=1),dict(id='ENSG2',a=-2,b=3,c=1)]
s=atlas_scatter3d(d,'a','b','c',color='a',title='Δ "quote" \\\\ path')
try:
    atlas_scatter3d([dict(id='bad',a=float('nan'),b=1,c=1)],'a','b','c')
    raise AssertionError('Nonfinite values accepted')
except ValueError:
    pass
s['classification']='archived'
atlas_scene(s)
`;
  writeFileSync(source,(language==='R'?SCIENTIFIC_R_HELPERS:SCIENTIFIC_PYTHON_HELPERS)+tail);
  const result=spawnSync(language==='R'?'Rscript':'python3',[source],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const spec=validateSceneSpec(JSON.parse(readFileSync(output,'utf8')));
  assert.equal(spec.classification,'user-exploratory');assert.equal(spec.data[0].x,.123456789012345);
  assert.equal(spec.title,'Δ "quote" \\ path');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
