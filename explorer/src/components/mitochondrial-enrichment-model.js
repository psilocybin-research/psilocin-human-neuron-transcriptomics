import { sci } from './format.js';
// Biological overview chosen by function, never by observed significance.
export const mitochondrialOverview = [
  'OXPHOS', 'CI_subunits', 'CII_subunits', 'CIII_subunits', 'CIV_subunits', 'CV_subunits',
  'CI_assembly_factors', 'CII_assembly_factors', 'CIII_assembly_factors', 'CIV_assembly_factors', 'CV_assembly_factors',
  'Translation', 'Mitochondrial_ribosome', 'Protein_import_and_sorting', 'TCA_cycle',
];
export function mitochondrialPathwayName(id) {
  const match = /^(CI|CII|CIII|CIV|CV)_(subunits|assembly_factors)$/.exec(id);
  if (match) return `Complex ${match[1].slice(1)} · ${match[2] === 'subunits' ? 'subunits' : 'assembly factors'}`;
  return ({OXPHOS:'OXPHOS · all members',Translation:'Mitochondrial translation',Mitochondrial_ribosome:'Mitochondrial ribosome',Protein_import_and_sorting:'Protein import and sorting',TCA_cycle:'TCA cycle'})[id] || id.replaceAll('_', ' ');
}
export function enrichmentPlotModel(data, mode = 'overview', group = 'all') {
  const ids = mode === 'all'
    ? [...new Set(data.results.filter(r => r.status === 'tested').map(r => r.pathway))].sort((a,b) => mitochondrialPathwayName(a).localeCompare(mitochondrialPathwayName(b),'en'))
    : mitochondrialOverview;
  const available = new Set(data.results.map(r => r.pathway));
  const domain = ids.filter(id => available.has(id) && (mode !== 'all' || group === 'all' || data.results.find(r => r.pathway === id)?.hierarchy.split('.')[0] === group));
  const extent = Math.max(1, Math.ceil(Math.max(...data.results.filter(r => Number.isFinite(r.NES)).map(r => Math.abs(r.NES)))));
  return {
    domain, extent,
    rows: domain.flatMap(pathway => data.results.filter(r => r.pathway === pathway).map(r => ({
      ...r, day:r.contrast === 'day1_vs_control' ? 1 : 3,
      significant:r.status === 'tested' && typeof r.qvalue === 'number' && r.qvalue < .05,
    }))),
  };
}
export function pathwayComplex(pathway) {
  const match = /^(CI|CII|CIII|CIV|CV)_(subunits|assembly_factors)$/.exec(pathway);
  return match ? {complex:match[1].slice(1),role:match[2] === 'subunits' ? 'Structural subunit' : 'Assembly factor'} : null;
}

export function complexPathway(complex, role = 'Structural subunit') {
  return `C${complex}_${role === 'Assembly factor' ? 'assembly_factors' : 'subunits'}`;
}

export const complexVContext = 'The original 113-gene leading-edge display contains no complex V structural subunits. Literal symbol matching missed ATP5 genes recorded under older names; the separate post-freeze alias sensitivity recovered 15 ATP5 genes, including 12 and 14 in the Day 1 and Day 3 leading edges. MitoCarta uses stable Ensembl identifiers and tests all 21 curated complex V structural genes. This extends the earlier sensitivity result; it is not an independent discovery.';

export const mitochondrialGroups = {
 OXPHOS: 'OXPHOS',
 Mitochondrial_central_dogma: 'Genome maintenance and expression',
 Protein_import_sorting_and_homeostasis: 'Protein import and homeostasis',
 Metabolism: 'Metabolism',
 Small_molecule_transport: 'Small-molecule transport',
 Signaling: 'Signaling',
 Mitochondrial_dynamics_and_surveillance: 'Dynamics and surveillance',
};
export function enrichmentQLabel(row, metadata) {
 if (row.status !== 'tested') return row.status;
 return `${sci(row.qvalue)}${row.pvalue <= metadata.eps ? ' †' : ''}`;
}
export const precisionNote = '† Nominal p reached the fixed numerical floor (1e-10); the displayed BH q inherits this numerical limitation. Values below the floor are not resolved.';
