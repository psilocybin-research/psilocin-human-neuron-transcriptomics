// Select frozen rows without recomputing statistics or mixing correction families.
export function selectMethodResults(atlas, snapshot, pathway, contrast) {
  const parameter = {
    day1_vs_control: 'mu_day1_vs_control',
    day3_vs_control: 'mu_day3_vs_control',
    day3_vs_day1: 'treated_day_difference',
  }[contrast];
  return {
    pathway,
    contrast,
    enrichment: atlas.pathways.filter(r => r.pathway === pathway && r.contrast === contrast),
    specifications: atlas.sensitivities.filter(r => r.pathway === pathway && r.contrast === contrast),
    camera: snapshot.camera.filter(r => r.pathway === pathway && r.contrast === contrast),
    bayesian: pathway === 'HALLMARK_OXIDATIVE_PHOSPHORYLATION'
      ? snapshot.bayesian.archived.filter(r => r.parameter === parameter) : [],
    sources: snapshot.sources,
    archive: snapshot.archive,
  };
}
