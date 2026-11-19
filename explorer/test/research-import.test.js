import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateResearchCSV} from '../src/components/research-import.js';
test('research import validates entire input, quoting and unique headers',()=>{
 assert.deepEqual(validateResearchCSV('id,value\n"a,b",0.123456789012345\n'),{columns:['id','value'],rows:1});
 for(const text of ['a,a\n1,2','a,\n1,2','a,b\n1','a\n"unfinished','a\n\u0000','a\n\ufffd','a']) assert.throws(()=>validateResearchCSV(text));
});
test('research import rejects truncation instead of silently importing a subset',()=>{
 assert.equal(validateResearchCSV('x\n'+Array(1000).fill('1').join('\n')).rows,1000);
 assert.throws(()=>validateResearchCSV('x\n'+Array(1001).fill('1').join('\n')),/no rows were imported/);
 assert.throws(()=>validateResearchCSV('x\n'+ 'é'.repeat(1_000_001)),/2 MB/);
});
