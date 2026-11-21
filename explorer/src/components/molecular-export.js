// Preserve one RNA record per gene/contrast even when a structure repeats subunits.
export function molecularRNAExport(chains, getGene, sourceURL) {
  const genes = new Map();
  for (const chain of chains) {
    const gene = getGene(chain);
    if (!gene) continue;
    if (!genes.has(gene.id)) genes.set(gene.id, { gene, chains: [] });
    genes.get(gene.id).chains.push(chain.author);
  }
  const contrasts = [
    "Day 1 / common control",
    "Day 3 / common control",
    "Treated Day 3 / Day 1",
  ];
  const finite = (value) => (Number.isFinite(value) ? value : null);
  return [...genes.values()].flatMap(({ gene, chains }) =>
    (gene.effects || []).map((effect, index) => {
      const estimate = finite(effect.log2FoldChange),
        se = finite(effect.lfcSE);
      return {
        gene_id: gene.id,
        gene_symbol: gene.symbol,
        pdb_id: "9TI4",
        author_chains: chains.join(";"),
        contrast: contrasts[index] || `Contrast ${index + 1}`,
        rna_log2_fold_change: estimate,
        standard_error: se,
        approximate_95_wald_lower:
          estimate !== null && se !== null ? estimate - 1.96 * se : null,
        approximate_95_wald_upper:
          estimate !== null && se !== null ? estimate + 1.96 * se : null,
        gene_fdr: finite(effect.padj),
        source_url: sourceURL,
        evidence:
          "Archived RNA estimate; reference structure does not measure protein change or respiratory activity",
      };
    }),
  );
}

export function molecularCSV(rows) {
  if (!rows.length)
    throw new Error(
      "No mapped RNA estimates are available for this selection.",
    );
  const columns = Object.keys(rows[0]);
  const cell = (value) =>
    value == null ? "" : `"${String(value).replaceAll('"', '""')}"`;
  return (
    [
      columns.map(cell).join(","),
      ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
    ].join("\r\n") + "\r\n"
  );
}
