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
export function researchTableCSV(rows) {
  return csvText(rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value==null?'':typeof value==='boolean'?(value?'TRUE':'FALSE'):value]))));
}
