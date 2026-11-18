// Filters use archived per-gene BH FDR; no correction is recomputed in this selected union.
export function retainedGene(gene, mode = "all") {
  if (mode === "all") return true;
  const effects = gene.effects?.slice(0, 2) || [];
  const estimable =
    effects.length === 2 &&
    effects.every(
      (e) =>
        Number.isFinite(e?.log2FoldChange) &&
        Number.isFinite(e?.lfcSE) &&
        e.lfcSE >= 0,
    );
  if (!estimable) return false;
  if (mode === "estimable") return true;
  const threshold = mode === "fdr01" ? 0.01 : 0.05;
  const passing = (e) =>
    Number.isFinite(e?.padj) && e.padj >= 0 && e.padj <= threshold;
  return mode === "both05" ? effects.every(passing) : effects.some(passing);
}
export const uncertaintyLabels = {
  all: "All archived genes",
  estimable: "Estimable on both days",
  fdr05: "Gene FDR ≤ 0.05 on either day",
  fdr01: "Gene FDR ≤ 0.01 on either day",
  both05: "Gene FDR ≤ 0.05 on both days",
};
export function crossDayRows(genes) {
  return genes
    .filter(
      (g) =>
        g.effects?.slice(0, 2).length === 2 &&
        g.effects.slice(0, 2).every((e) => Number.isFinite(e?.log2FoldChange)),
    )
    .map((g) => ({
      gene: g,
      x: g.effects[0].log2FoldChange,
      y: g.effects[1].log2FoldChange,
    }));
}
