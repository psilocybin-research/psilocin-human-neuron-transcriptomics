import {test} from 'node:test';
import assert from 'node:assert/strict';
import {overviewPose,gentleFocusPose} from '../src/components/network-framing.js';
const nodes=[{x:-225,y:-170,z:-120},{x:225,y:170,z:80}];
test('overview fits all nodes with reserved annotation margins on desktop and narrow phones',()=>{
 for(const aspect of [.35,1.5]){
  const {position,target}=overviewPose(nodes,aspect,50);
  const tangent=Math.tan(50*Math.PI/360);
  for(const n of nodes){
   const depth=position.z-n.z;
   assert.ok(Math.abs(n.x-target.x)<depth*tangent*aspect);
   assert.ok(Math.abs(n.y-target.y)<depth*tangent);
  }
 }
 assert.ok(overviewPose(nodes,.35,50).position.z>overviewPose(nodes,1.5,50).position.z);
});
test('focus preserves the viewing direction and uses only a gentle ten-percent zoom',()=>{
 const pose={position:{x:0,y:0,z:1000},target:{x:0,y:0,z:0}};
 const next=gentleFocusPose(pose,{x:200,y:100,z:0});
 assert.deepEqual(next.target,{x:40,y:20,z:0});
 assert.deepEqual(next.position,{x:40,y:20,z:900});
 assert.deepEqual(pose.position,{x:0,y:0,z:1000});
});
