import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overlapGraph, overlapRows, pairKey} from '../src/components/pathway-overlap.js';
const data=JSON.parse(readFileSync(new URL('../src/data/atlas.json',import.meta.url)));
const ox='HALLMARK_OXIDATIVE_PHOSPHORYLATION',et='REACTOME_RESPIRATORY_ELECTRON_TRANSPORT';
test('full annotations preserve every set and all unordered pairs without significance filtering',()=>{
 const graph=overlapGraph(data,'day1_vs_control');assert.equal(graph.nodes.length,14);assert.equal(graph.pairs.length,91);assert.equal(new Set(graph.pairs.map(p=>p.key)).size,91);assert.equal(graph.pairs.filter(p=>p.shared>0).length,46);
 const p=graph.pairs.find(p=>p.key===pairKey(ox,et));assert.equal(p.shared,71);assert.equal(p.union,288);assert.equal(p.jaccard,71/288);
 assert.deepEqual(overlapGraph(data,'day3_vs_control').pairs,graph.pairs);
 assert.equal(graph.pairs.find(p=>p.key===pairKey('HALLMARK_DNA_REPAIR','REACTOME_TELOMERE_MAINTENANCE')).shared,25);
});
test('leading edges update by contrast, with untestable sets unavailable rather than zero',()=>{
 for(const contrast of data.contrasts){const graph=overlapGraph(data,contrast,{members:'leading'});const missing=graph.nodes.find(n=>n.id==='REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING');assert.equal(missing.symbols,null);assert.equal(graph.pairs.filter(p=>!p.available).length,13);assert.ok(graph.pairs.filter(p=>!p.available).every(p=>p.shared===null&&p.jaccard===null));}
 const one=overlapGraph(data,'day1_vs_control',{members:'leading'}).nodes.find(n=>n.id===ox);const three=overlapGraph(data,'day3_vs_control',{members:'leading'}).nodes.find(n=>n.id===ox);assert.equal(one.size,95);assert.equal(three.size,107);
});
test('pairwise coefficients are exact, symmetric, bounded and derived only from literal membership',()=>{
 for(const members of ['all','leading'])for(const contrast of data.contrasts){const g=overlapGraph(data,contrast,{members});for(const p of g.pairs){if(!p.available)continue;const a=g.nodes.find(n=>n.id===p.source).symbols,b=g.nodes.find(n=>n.id===p.target).symbols;assert.deepEqual(p.genes,a.filter(s=>b.includes(s)));assert.equal(p.union,new Set([...a,...b]).size);assert.ok(p.jaccard>=0&&p.jaccard<=1);assert.equal(p.key,pairKey(p.target,p.source));}}
 const g=overlapGraph(data,'day1_vs_control');const oxphos=g.nodes.find(n=>n.id===ox);assert.ok(oxphos.symbols.includes('ATP5F1A'));assert.ok(!oxphos.symbols.includes('ATP5A1'));
});
test('thresholded exports retain zero and unavailable pairs and exact denominators',()=>{
 const g=overlapGraph(data,'day1_vs_control');const rows=overlapRows(g,'day1_vs_control','all',.2);assert.equal(rows.length,91);assert.equal(rows.filter(p=>p.shown_connection).length,2);assert.ok(rows.some(r=>r.shared_genes===0));
 assert.equal(overlapGraph(data,'day1_vs_control',{tier:'primary'}).pairs.length,10);
 assert.throws(()=>overlapGraph(data,'unknown'),/Unknown overlap contrast/);assert.throws(()=>overlapGraph(data,'day1_vs_control',{members:'invalid'}),/Unknown overlap membership/);
});
