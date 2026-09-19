import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fmt,sci,color,csvText} from '../src/components/format.js';
const load=n=>JSON.parse(readFileSync(new URL('../src/data/'+n,import.meta.url)));
const atlas=load('atlas.json'),genes=load('genes.json'),provenance=load('provenance.json');
test('all gene identities and contrasts survive export',()=>{
 assert.equal(genes.length,21154);assert.equal(new Set(genes.map(g=>g.id)).size,21154);
 assert.equal(genes.filter(g=>g.selected).length,21098);
 genes.forEach(g=>assert.equal(g.effects.filter(Boolean).length,3));
});
test('Figure 3 cells have correct keys, scaling and selected gene estimates',()=>{
 assert.equal(atlas.landscape.length,113);assert.equal(atlas.landscape.filter(g=>g.leading_edge==='Shared').length,89);
 assert.equal(atlas.profiles.length,1017);
 const selected=new Map(genes.filter(g=>g.selected).map(g=>[g.symbol,g]));
 for(const row of atlas.landscape){
  const profiles=atlas.profiles.filter(p=>p.gene===row.gene);assert.equal(new Set(profiles.map(p=>p.profile_id)).size,9);
  assert.deepEqual(profiles.map(p=>p.condition),Array(3).fill(['Control','Day 1','Day 3']).flat());
  const mean=profiles.reduce((a,p)=>a+p.vst,0)/9,sd=Math.sqrt(profiles.reduce((a,p)=>a+(p.vst-mean)**2,0)/8);
  profiles.forEach(p=>assert.ok(Math.abs(p.row_z-(p.vst-mean)/sd)<1e-9));
  ['day1_log2fc','day3_log2fc','day3_minus_day1_log2fc'].forEach((k,i)=>assert.ok(Math.abs(row[k]-selected.get(row.gene).effects[i].log2FoldChange)<1e-10));
 }
});
test('complete primary family and null/untestable distinctions',()=>{
 const p=atlas.pathways.filter(p=>p.tier==='primary');assert.equal(p.length,15);
 assert.equal(p.filter(p=>p.contrast==='day3_vs_day1'&&p.robustness==='robust').length,0);
 const glut=atlas.pathways.filter(p=>p.pathway==='REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING');
 assert.ok(glut.every(p=>p.NES===null));assert.equal(atlas.targeted.length,8);
});
test('display exports match provenance checksums',()=>{
 for(const [name,hash]of Object.entries(provenance.outputs))assert.equal(createHash('sha256').update(readFileSync(new URL('../src/data/'+name,import.meta.url))).digest('hex'),hash);
});
test('missing values cannot silently become zero',()=>{
 assert.equal(fmt(null),'Not estimable');assert.equal(sci(null),'Not estimable');assert.equal(color(null),'#dedede');
 assert.equal(fmt(0),'0.00');assert.match(csvText([{gene:'A"B',effect:null}]),/A""B/);
});
test('DNA follow-up retains complete families, selected genes and unmapped panel symbols',()=>{
 assert.equal(atlas.pathways.filter(p=>p.tier==='exploratory').length,6);
 assert.equal(atlas.dna.tests.length,24);assert.equal(atlas.dna.sensitivities.length,240);
 assert.equal(new Set(atlas.dna.sensitivities.map(r=>[r.module,r.variant,r.contrast].join('|'))).size,240);
 assert.equal(atlas.dna.decomposition.length,30);
 assert.equal(atlas.dna.decomposition.filter(r=>r.day1_le&&r.day3_le).length,22);
 const reps=new Map(genes.filter(g=>g.selected).map(g=>[g.symbol,g]));
 for(const g of atlas.dna.decomposition){assert.equal(g.gene_id,reps.get(g.gene).id);assert.equal(g.day1_log2fc,reps.get(g.gene).effects[0].log2FoldChange);}
 assert.ok(atlas.dna.panel.filter(g=>g.gene==='TERT').every(g=>g.log2FoldChange===null));
 assert.ok(atlas.dna.sensitivities.filter(r=>r.variant.startsWith('block_')).every(r=>r.family_fdr===null));
 const t=atlas.dna.tests.find(r=>r.module==='TELOMERE_MINUS_DNA_REPAIR'&&r.contrast==='day3_vs_control');
 assert.ok(t.NES>0&&t.family_fdr>.05);assert.notEqual(t.robustness,'robust');
});
