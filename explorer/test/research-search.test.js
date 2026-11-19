import {test} from 'node:test';
import assert from 'node:assert/strict';
import {researchSuggestions} from '../src/components/research-search.js';
const genes=[{id:'ENSG1',symbol:'CS',selected:true},{id:'ENSG2',symbol:'CS',selected:false}];
test('universal search preserves exact gene identities and verified aliases',()=>{
 const options={genes,aliases:[{selected_gene_id:'ENSG1',current_symbol:'CITRATE',source_symbol:'CS'}]};
 assert.deepEqual(researchSuggestions({...options,query:'CS'}).map(x=>x.target),['ENSG1','ENSG2']);
 assert.equal(researchSuggestions({...options,query:'CITRATE'})[0].target,'ENSG1');
 assert.equal(researchSuggestions({...options,query:'MADE_UP'}).length,0);
});
test('pathway contrasts deduplicate without losing targets; commands work without gene data',()=>{
 const options={pathways:[{pathway:'HALLMARK_OXPHOS'},{pathway:'HALLMARK_OXPHOS'}],tabs:[['custom-r','Workspace']],actions:[{id:'undo',title:'Undo research selection'}]};
 assert.equal(researchSuggestions({...options,query:'hallmark oxphos'}).length,1);
 assert.equal(researchSuggestions({...options,query:'workspace'})[0].target,'custom-r');
 assert.equal(researchSuggestions({...options,query:'undo'})[0].kind,'action');
 assert.equal(researchSuggestions({...options,query:''}).length,2);
});
