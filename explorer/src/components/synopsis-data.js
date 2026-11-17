import { finite } from "./comparison-data.js";
export const densityBandwidth = 0.2;
// Descriptive Gaussian KDE across archived gene coefficients, not biological samples.
export function gaussianDensity(values, grid, bandwidth = densityBandwidth) {
  if (!finite(bandwidth) || bandwidth <= 0)
    throw new RangeError("Bandwidth must be positive");
  const valid = values.filter(finite),
    scale = valid.length * bandwidth * Math.sqrt(2 * Math.PI);
  return grid.map((x) => [
    x,
    valid.length
      ? valid.reduce(
          (sum, v) => sum + Math.exp(-0.5 * ((x - v) / bandwidth) ** 2),
          0,
        ) / scale
      : 0,
  ]);
}
export function primaryDistributions(data, genes) {
  const representatives = new Map(
    genes.filter((g) => g.selected).map((g) => [g.symbol, g]),
  );
  return [
    ...new Set(
      data.pathways.filter((p) => p.tier === "primary").map((p) => p.pathway),
    ),
  ].map((pathway) => {
    const members = [...new Set(data.membership[pathway] || [])];
    return {
      pathway,
      members: members.length,
      series: data.contrasts.slice(0, 2).map((contrast, i) => {
        const rows = members.map((symbol) => ({
          symbol,
          gene: representatives.get(symbol),
        }));
        const values = rows
          .filter((r) => r.gene && finite(r.gene.effects[i].log2FoldChange))
          .map((r) => ({
            symbol: r.symbol,
            id: r.gene.id,
            value: r.gene.effects[i].log2FoldChange,
          }));
        return { contrast, values, missing: members.length - values.length };
      }),
    };
  });
}
