export const finite = v => typeof v === 'number' && Number.isFinite(v);
export function cohortGenes(data, genes, cohort = 'oxphos', group = 'all') {
 const landscape = new Map(data.landscape.map(g=>[g.gene,g]));
 const membership = cohort === 'all' ? null : new Set(cohort === 'oxphos' ? data.landscape.map(g=>g.gene) : data.membership[cohort] || []);
 return genes.filter(g=>g.selected && (!membership || membership.has(g.symbol)) && (group === 'all' || landscape.get(g.symbol)?.functional_group === group));
}
export function comparisonPoints(genes, mode, contrastIndex = 0) {
 return genes.flatMap(g=>{
  const effect=g.effects[contrastIndex];
  const x=mode==='scatter'?g.effects[0].log2FoldChange:effect.log2FoldChange;
  const p=effect.padj;
  const y=mode==='scatter'?g.effects[1].log2FoldChange:finite(p)&&p>=0&&p<=1?(p===0?50:-Math.log10(p)):null;
  return finite(x)&&finite(y)?[{gene:g,x,y,zeroFdr:mode!=='scatter'&&p===0}]:[];
 });
}
export function geneRows(genes, contrasts) {
 return genes.flatMap(g=>g.effects.map((e,i)=>({gene_id:g.id,symbol:g.symbol,rank_representative:g.selected,contrast:contrasts[i],log2FoldChange:e.log2FoldChange,lfcSE:e.lfcSE,gene_fdr:e.padj,lower_wald_95:finite(e.log2FoldChange)&&finite(e.lfcSE)?e.log2FoldChange-1.96*e.lfcSE:null,upper_wald_95:finite(e.log2FoldChange)&&finite(e.lfcSE)?e.log2FoldChange+1.96*e.lfcSE:null})));
}
export function oxphosMembership(data) {
 const categories=['Day 1 only','Shared','Day 3 only'];
 return categories.map(category=>({category,genes:data.landscape.filter(g=>g.leading_edge===category).map(g=>g.gene).sort()}));
}
