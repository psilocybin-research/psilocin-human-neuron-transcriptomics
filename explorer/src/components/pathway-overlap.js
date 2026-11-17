import {edgeGenes, label} from './format.js';

export const shortNames = {
 HALLMARK_OXIDATIVE_PHOSPHORYLATION: 'OXPHOS', HALLMARK_GLYCOLYSIS: 'Glycolysis',
 HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY: 'ROS transcription', HALLMARK_MTORC1_SIGNALING: 'mTORC1',
 HALLMARK_PI3K_AKT_MTOR_SIGNALING: 'PI3K–AKT–mTOR', REACTOME_RESPIRATORY_ELECTRON_TRANSPORT: 'Electron transport',
 REACTOME_AUTOPHAGY: 'Autophagy', REACTOME_MITOPHAGY: 'Mitophagy',
 REACTOME_ATF4_ACTIVATES_GENES_IN_RESPONSE_TO_ENDOPLASMIC_RETICULUM_STRESS: 'ATF4 / ER stress',
 REACTOME_SIGNALING_BY_NTRK2_TRKB: 'NTRK2 / TrkB', HALLMARK_FATTY_ACID_METABOLISM: 'Fatty acid metabolism',
 HALLMARK_DNA_REPAIR: 'DNA repair', REACTOME_TELOMERE_MAINTENANCE: 'Telomere maintenance',
 REACTOME_GLUTATHIONE_SYNTHESIS_AND_RECYCLING: 'Glutathione synthesis'
};
export const pairKey = (a, b) => [a, b].sort().join('|');

// Descriptive overlap of literal frozen symbols, not interaction/co-expression inference.
export function overlapGraph(data, contrast, {members = 'all', tier = 'all'} = {}) {
 if (!data.contrasts.includes(contrast)) throw new Error('Unknown overlap contrast');
 if (!['all', 'leading'].includes(members)) throw new Error('Unknown overlap membership');
 const nodes = data.pathways.filter(r => r.contrast === contrast && (tier === 'all' || r.tier === tier)).map(row => {
  const available = members === 'all' || row.NES !== null;
  const symbols = available ? [...new Set(members === 'all' ? data.membership[row.pathway] || [] : edgeGenes(row))].sort() : null;
  return {id: row.pathway, label: label(row.pathway), short: shortNames[row.pathway] || label(row.pathway), row, symbols, size: symbols?.length ?? null, available};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 const pairs = [];
 for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
  const a = nodes[i], b = nodes[j], available = a.available && b.available;
  const other = new Set(b.symbols || []);
  const shared = available ? a.symbols.filter(g => other.has(g)) : null;
  const union = available ? new Set([...a.symbols, ...b.symbols]).size : null;
  pairs.push({key: pairKey(a.id, b.id), source: a.id, target: b.id, source_label: a.label, target_label: b.label,
   source_size: a.size, target_size: b.size, available, genes: shared, shared: shared?.length ?? null, union,
   jaccard: union ? shared.length / union : null});
 }
 return {nodes, pairs};
}

export function overlapRows(graph, contrast, members, threshold = 0) {
 return graph.pairs.map(p => ({source: p.source, target: p.target, contrast, membership: members,
  source_size: p.source_size, target_size: p.target_size, shared_genes: p.shared, union_genes: p.union,
  jaccard: p.jaccard, availability: p.available ? 'available' : 'leading edge unavailable for at least one set',
  shown_connection: p.shared > 0 && p.jaccard >= threshold, minimum_jaccard: threshold,
  shared_symbols: p.genes?.join(';') ?? null}));
}
