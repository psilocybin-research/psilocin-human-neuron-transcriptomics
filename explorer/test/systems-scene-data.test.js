import test from 'node:test';
import assert from 'node:assert/strict';
import snapshot from '../src/assets/vendor/oxphos-network-data.js';
import {systemsSceneData,SYSTEM_SCENES} from '../src/components/systems-scene-data.js';
test('Systems scenes retain exact archived identities, values and typed memberships',()=>{
 const genes=snapshot.nodes.filter(n=>n.type==='gene');
 for(const {id:mode}of SYSTEM_SCENES){
  const result=systemsSceneData(snapshot,{mode,contrast:'day1_vs_control',geneIds:[genes[0].id],sourceSha256:'a'.repeat(64)});
  assert.equal(result.spec.layout_semantics,'illustrative-not-spatial-evidence');
  assert.ok(result.spec.edges.every(edge=>['membership','curated-complex','navigation'].includes(edge.relation)));
  if(mode==='neuron')assert.equal(result.genes.length,0);
  else for(const node of result.spec.data.filter(n=>n.node_type==='gene'))assert.equal(node.color,genes.find(g=>g.id===node.id).effects[0].log2FoldChange);
 }
 const one=systemsSceneData(snapshot,{contrast:'day1_vs_control',sourceSha256:'a'.repeat(64)}),three=systemsSceneData(snapshot,{contrast:'day3_vs_control',sourceSha256:'a'.repeat(64)});
 assert.equal(one.spec.color_limit,three.spec.color_limit);assert.equal(one.genes.length,113);
 assert.equal(one.complexCounts.V,0);
});
