import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SCIENTIFIC_SCENE_SCHEMA, validateSceneSpec, sceneCoordinates, sceneCSV} from '../src/components/scientific-scene-spec.js';
const fixture = () => ({schema:SCIENTIFIC_SCENE_SCHEMA,kind:'scatter3d',classification:'user-exploratory',title:'Exact effects',source:{label:'Test fixture'},axes:{x:'Day 1 log2FC',y:'Day 3 log2FC',z:'Standard error'},data:[{id:'ENSG1',x:0.123456789012345,y:-2,z:1,color:-4},{id:'ENSG2',x:2,y:3,z:1,color:4}]});
test('scene schema preserves exact numerical records separately from Float32 display coordinates',()=>{
 const spec=validateSceneSpec(fixture());
 assert.equal(spec.data[0].x,0.123456789012345);
 const {positions,domains}=sceneCoordinates(spec);
 assert.deepEqual([...positions],[-1,-1,0,1,1,0]);
 assert.deepEqual(domains.x,[0.123456789012345,2]);
 assert.match(sceneCSV(spec),/0.123456789012345/);
});
test('scene validation rejects missingness, duplicate identity, ambiguous provenance and invalid cameras',()=>{
 for(const modify of [s=>delete s.classification,s=>delete s.source,s=>s.data[0].x=NaN,s=>s.data[0].x='1',s=>s.data[1].id='ENSG1',s=>delete s.data[1].color,s=>s.camera={position:[0,0,0],target:[0,0,0],up:[0,1,0],fov:45},s=>s.data=Array(50001).fill(s.data[0])]) {
  const s=fixture();modify(s);assert.throws(()=>validateSceneSpec(s));
 }
});
test('finite extreme coordinates normalize without overflow',()=>{
 const s=fixture();s.data[0].x=-Number.MAX_VALUE;s.data[1].x=Number.MAX_VALUE;
 assert.deepEqual([...sceneCoordinates(s).positions].filter((_,i)=>i%3===0),[-1,1]);
 s.data[0].x=0;s.data[1].x=Number.MIN_VALUE;
 assert.deepEqual([...sceneCoordinates(s).positions].filter((_,i)=>i%3===0),[-1,1]);
});
test('network and structure contracts request existing evidence and never infer interactions or geometry',()=>{
 const base={schema:SCIENTIFIC_SCENE_SCHEMA,classification:'user-exploratory',source:{label:'R output'},title:'Context'};
 assert.deepEqual(validateSceneSpec({...base,kind:'membership-overlay',value_label:'estimate',data:[{id:'ENSG1',value:1.25}]}).data,[{id:'ENSG1',value:1.25}]);
 assert.equal(validateSceneSpec({...base,kind:'structure-reference',gene:'GPX4'}).gene,'GPX4');
 assert.throws(()=>validateSceneSpec({...base,kind:'mitochondrion'}));
});
