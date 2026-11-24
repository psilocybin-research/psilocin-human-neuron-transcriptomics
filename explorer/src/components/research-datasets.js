import {csvText} from './format.js';

// One numerical contract for both runtimes and export/reconstruction. Source IDs
// and archived contrast order are retained; missing values stay empty in CSV.
export function archivedResearchTables(data, genes, bayesian) {
  return {
    genes: genes.flatMap(gene=>gene.effects.map((effect,index)=>({id:gene.id,symbol:gene.symbol,selected:gene.selected,contrast:data.contrasts[index],...effect}))),
    pathways:data.pathways,landscape:data.landscape,profiles:data.profiles,
    bayesian_scores:bayesian.scores,bayesian_archive:bayesian.archived,
  };
}
// Catalogue metadata avoids materializing the expanded gene table.
export function archivedResearchMetadata(data, genes, bayesian) {
  const first=genes.find(g=>g.effects.length);
  const sample=first?{id:first.id,symbol:first.symbol,selected:first.selected,contrast:data.contrasts[0],...first.effects[0]}:{};
  const describe=rows=>({count:rows.length,columns:Object.keys(rows[0]||{})});
  return {
    genes:{count:genes.reduce((n,g)=>n+g.effects.length,0),columns:Object.keys(sample)},
    pathways:describe(data.pathways),landscape:describe(data.landscape),profiles:describe(data.profiles),
    bayesian_scores:describe(bayesian.scores),bayesian_archive:describe(bayesian.archived),
  };
}
export function researchTableCSV(rows) {
  return csvText(rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value==null?'':typeof value==='boolean'?(value?'TRUE':'FALSE'):value]))));
}
