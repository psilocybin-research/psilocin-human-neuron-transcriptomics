import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {complexMembers,mitochondrialEntries,archivedGene,coverage} from '../src/components/mitochondrial-mapping.js';
import {backboneSegments} from '../src/components/assembly-geometry.js';
const read = (path) => JSON.parse(readFileSync(new URL(path,import.meta.url)));
const snapshot = read('../src/assets/mitochondria/annotations.json');
const genes = read('../src/data/genes.json');
const pilot = read('../src/assets/mitochondria/complex-i.json');
const enrichment = read('../src/assets/mitochondria/enrichment.json');
const plan = read('../../config/mitocarta_followup_v1.json');
const sha = (path) => createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
test('complete source inventory includes complex V and separates structural and assembly memberships',()=>{
 assert.equal(snapshot.entries.length,1136);assert.equal(snapshot.pathways.length,149);
 assert.equal(complexMembers(snapshot,'II','Structural subunit').length,4);
 assert.equal(complexMembers(snapshot,'V','Structural subunit').length,21);
 assert.equal(complexMembers(snapshot,'V','Assembly factor').length,5);
 const ndufa9=genes.find(g=>g.symbol==='NDUFA9');
 assert.equal(mitochondrialEntries(snapshot,ndufa9)[0].symbol,'NDUFA9');
 assert.ok(mitochondrialEntries(snapshot,ndufa9)[0].roles.some(r=>r.complex==='I'&&r.role==='Structural subunit'));
 assert.equal(snapshot.metadata.license,'CC-BY-NC-4.0');
});
test('ambiguous, absent and non-estimable mappings remain distinct',()=>{
 const records=[{id:'x.1',effects:[{log2FoldChange:0}]},{id:'y.1',effects:[{log2FoldChange:null}]}];
 const entries=[{archivedIds:['x.1']},{archivedIds:['y.1']},{archivedIds:[]},{archivedIds:['x.1','y.1']}];
 assert.equal(archivedGene(entries[3],records),null);
 assert.deepEqual(coverage(entries,records),{curated:4,estimated:1,nonestimable:1,absent:1,ambiguous:1});
});
test('pilot retains 45 physical chains, audited identities and one gene estimate for repeated subunit copies',()=>{
 assert.equal(pilot.chains.length,45);
 assert.equal(new Set(pilot.chains.map(c=>c.label)).size,45);
 const ids=[];
 for(const chain of pilot.chains){
  assert.equal(chain.mappings.length,1);assert.equal(chain.mappings[0].archivedIds.length,1);
  assert.ok(chain.mappings[0].identity>=.99);
  const id=chain.mappings[0].archivedIds[0];assert.ok(genes.some(g=>g.id===id));ids.push(id);
  assert.ok(chain.residues.every(r=>r.slice(2).every(Number.isFinite)));
 }
 assert.equal(new Set(ids).size,44);
 assert.equal(pilot.metadata.annotationSha256,sha('../src/assets/mitochondria/annotations.json'));
});
test('backbone traces never bridge unresolved residues or spatial gaps',()=>{
 assert.equal(backboneSegments([[1,'',0,0,0],[2,'',3.8,0,0],[5,'',7.6,0,0],[6,'',30,0,0]]).length,1);
});
test('exploratory outputs match the frozen inputs and joint BH family, including excluded pathways',()=>{
 assert.equal(plan.annotation_sha256,sha('../src/assets/mitochondria/annotations.json'));
 assert.equal(enrichment.metadata.planSha256,sha('../../config/mitocarta_followup_v1.json'));
 assert.equal(enrichment.results.length,298);
 for(const input of plan.inputs)assert.equal(input.sha256,sha('../../'+input.file));
 const tested=enrichment.results.filter(r=>r.status==='tested').sort((a,b)=>a.pvalue-b.pvalue);
 assert.equal(tested.length,enrichment.metadata.familySize);
 let previous=1;
 for(let i=tested.length-1;i>=0;i--){previous=Math.min(previous,tested[i].pvalue*tested.length/(i+1));assert.ok(Math.abs(previous-tested[i].qvalue)<1e-12);}
 for(const row of enrichment.results){
  if(row.status==='tested') assert.ok(row.matchedSize>=plan.minSize&&row.matchedSize<=plan.maxSize);
  else {assert.equal(row.pvalue,null);assert.equal(row.qvalue,null);}
 }
});

test('paired overview is function-selected, keeps untested complex II and shares the full-universe NES axis', async()=>{
 const {enrichmentPlotModel,mitochondrialOverview,pathwayComplex}=await import('../src/components/mitochondrial-enrichment-model.js');
 const overview=enrichmentPlotModel(enrichment),all=enrichmentPlotModel(enrichment,'all');
 assert.deepEqual(overview.domain,mitochondrialOverview);
 assert.equal(overview.rows.length,mitochondrialOverview.length*2);
 assert.equal(all.domain.length,76);
 assert.equal(all.rows.length,152);
 assert.equal(overview.extent,all.extent);
 assert.ok(overview.rows.filter(r=>r.pathway==='CII_subunits').every(r=>r.NES===null&&!r.significant));
 assert.equal(overview.rows.find(r=>r.pathway==='CIV_subunits'&&r.day===1).significant,false);
 assert.equal(overview.rows.find(r=>r.pathway==='CIV_subunits'&&r.day===3).significant,true);
 assert.deepEqual(pathwayComplex('CV_assembly_factors'),{complex:'V',role:'Assembly factor'});
 assert.equal(pathwayComplex('Translation'),null);
 const modified={...enrichment,results:enrichment.results.map(row=>({...row,qvalue:1}))};
 assert.deepEqual(enrichmentPlotModel(modified).domain,overview.domain);
});
