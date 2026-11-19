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
