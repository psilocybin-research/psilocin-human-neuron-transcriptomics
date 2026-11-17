import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cohortGenes,comparisonPoints,geneRows,oxphosMembership} from '../src/components/comparison-data.js';
const load=name=>JSON.parse(readFileSync(new URL(`../src/data/${name}.json`,import.meta.url)));
const data=load('atlas'),genes=load('genes');
test('comparison cohorts retain original rank representatives and literal annotation identity',()=>{
 const all=cohortGenes(data,genes,'all'),ox=cohortGenes(data,genes);assert.equal(all.length,21098);assert.equal(ox.length,113);assert.ok(all.every(g=>g.selected));assert.equal(new Set(ox.map(g=>g.id)).size,113);
 const group=cohortGenes(data,genes,'oxphos','Respiratory complex II');assert.equal(group.length,3);assert.ok(group.every(g=>ox.includes(g)));
 const literal=cohortGenes(data,genes,'HALLMARK_OXIDATIVE_PHOSPHORYLATION');assert.ok(!literal.some(g=>g.symbol==='ATP5A1'));assert.ok(literal.every(g=>data.membership.HALLMARK_OXIDATIVE_PHOSPHORYLATION.includes(g.symbol)));
});
test('comparative coordinates and uncertainty exports are the archived estimates',()=>{
 const ox=cohortGenes(data,genes),scatter=comparisonPoints(ox,'scatter');assert.equal(scatter.length,113);
 for(const p of scatter){assert.equal(p.x,p.gene.effects[0].log2FoldChange);assert.equal(p.y,p.gene.effects[1].log2FoldChange);}
 const rows=geneRows(ox,data.contrasts);assert.equal(rows.length,339);
 const gp=ox.find(g=>g.symbol==='GPX4');const row=rows.find(r=>r.gene_id===gp.id&&r.contrast===data.contrasts[0]);assert.equal(row.gene_fdr,gp.effects[0].padj);assert.equal(row.lower_wald_95,gp.effects[0].log2FoldChange-1.96*gp.effects[0].lfcSE);
});
test('volcano distinguishes missing, numerical-zero and ordinary FDR values without inventing significance',()=>{
 const make=(id,fc,padj)=>({id,symbol:id,selected:true,effects:[{log2FoldChange:fc,padj}]});
 const points=comparisonPoints([make('zero',2,0),make('ordinary',-1,.01),make('missing',0,null),make('invalid',0,-1),make('missingfc',null,.1)],'volcano');
 assert.equal(points.length,2);assert.equal(points[0].zeroFdr,true);assert.equal(points[0].y,50);assert.equal(points[0].gene.effects[0].padj,0);assert.equal(points[1].y,2);
});
test('OXPHOS membership categories partition the union without implying transitions',()=>{
 const categories=oxphosMembership(data);assert.deepEqual(categories.map(c=>c.genes.length),[6,89,18]);const symbols=categories.flatMap(c=>c.genes);assert.equal(symbols.length,113);assert.equal(new Set(symbols).size,113);assert.equal(categories[0].genes.length+categories[1].genes.length,95);assert.equal(categories[1].genes.length+categories[2].genes.length,107);
});
