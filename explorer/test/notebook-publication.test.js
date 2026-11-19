import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notebookPublication} from '../src/components/notebook-publication.js';
const book={title:'A "quoted" title <script>',cells:[{kind:'markdown',source:'<img src=x onerror=alert(1)>',runs:[]},{kind:'code',source:'cat("```")',runs:[{console:'</pre><script>alert(1)</script>',error:false,run_utc:'2026-11-19',cell_code:'old'}]}]};
test('standalone notebook HTML escapes authored markup and blocks execution',()=>{
 const html=notebookPublication(book);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img '));
 assert.match(html,/default-src 'none'/);assert.match(html,/source edited since this run/);
});
test('native notebook sources disable execution and cannot escape fences',()=>{
 for(const format of ['qmd','Rmd']) {
  const text=notebookPublication(book,format);
  assert.match(text,/````\{r/);assert.match(text,/cat\("```"\)/);
  assert.match(text,format==='qmd'?/enabled: false/:/eval=FALSE/);
 }
 assert.throws(()=>notebookPublication(book,'unsupported'));
});
test('publication retains all recorded scene definitions without executing markup or changing numerical values',()=>{
 const spec={schema:'psilocin-atlas/scientific-scene/1',kind:'scatter3d',title:'</pre><script>bad</script> ```',data:[{id:'ENSG1',x:.123456789012345}],camera:{position:[1,2,3]}};
 const sceneBook={title:'Scene record',cells:[{kind:'code',source:'atlas_scene(spec)',runs:[{run_utc:'first',scene_specs:[spec]},{run_utc:'second',scene_specs:[{...spec,title:'second'}]}]}]};
 const html=notebookPublication(sceneBook);
 assert.ok(!html.includes('<script>'));
 assert.match(html,/0.123456789012345/);
 assert.match(html,/recorded first/);assert.match(html,/recorded second/);
 assert.match(html,/&quot;camera&quot;/);
 for(const format of ['qmd','Rmd']) {
  const text=notebookPublication(sceneBook,format);
  assert.match(text,/````json/);assert.match(text,/0.123456789012345/);
  assert.equal((text.match(/### Scientific scene definition/g)||[]).length,2);
 }
});
