import {test} from 'node:test';import assert from 'node:assert/strict';
import * as api from 'three';import {createSceneBackbone} from '../src/components/network-molecule.js';
const atom=(resi,x,chain='A')=>({atom:'CA',resi,x,y:0,z:0,chain,resn:'ALA',b:95});
test('molecular context keeps supplied Cα geometry and does not bridge chain or sequence gaps',()=>{
 const model=createSceneBackbone(api,[atom(1,0),atom(2,3.8),atom(5,7.6),atom(6,11.4,'B')],{predicted:true,mapping:[{position:10,chain:'A',resi:2,icode:''}]});
 const [trace,beads]=model.group.children[0].children;
 assert.equal(model.count,4);assert.equal(trace.count,1);assert.equal(beads.count,4);
 assert.equal(model.highlight(10,10),1);assert.equal(model.highlight(11,12),0);
 model.setBeads(false);assert.equal(beads.visible,false);model.dispose();
});
test('empty coordinates are explicit and duplicate alternate Cα entries are not doubled',()=>{
 assert.throws(()=>createSceneBackbone(api,[]),/No Cα/);
 const model=createSceneBackbone(api,[atom(1,0),atom(1,.1),{...atom(2,3.8),x:NaN}]);assert.equal(model.count,1);model.dispose();
});
