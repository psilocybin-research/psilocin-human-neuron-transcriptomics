import { finite, geneRows } from "./comparison-data.js";

export const figureModes = Object.freeze({
  scatter: "OXPHOS Day 1 versus Day 3",
  intervals: "Selected-gene effect intervals",
  profiles: "Selected-gene expression profiles",
});

export const figureCaveat = "The 113 genes form a selected OXPHOS leading-edge union. Shared controls prevent a treatment-by-time interpretation. Nine expression profiles are block × condition aggregates, not nine independent biological replicates.";

export function validateFigureOptions(options = {}) {
  const mode = options.mode ?? "scatter";
  if (!Object.hasOwn(figureModes, mode)) throw new Error("Unsupported figure type");
  return {
    mode,
    gene: typeof options.gene === "string" ? options.gene : "",
    grid: options.grid !== false,
    labels: options.labels === true,
    width: Math.max(280, Math.min(1600, finite(options.width) ? Math.round(options.width) : 760)),
  };
}

export function figureRows(data, genes = [], options = {}) {
  const { mode, gene } = validateFigureOptions(options);
  if (mode === "scatter") {
    return data.landscape.map((row) => ({
      gene: row.gene,
      functional_group: row.functional_group,
      leading_edge: row.leading_edge,
      day1_log2fc: row.day1_log2fc,
      day3_log2fc: row.day3_log2fc,
    }));
  }
  if (!data.landscape.some((row) => row.gene === gene))
    throw new Error("Select a gene from the archived OXPHOS union");
  if (mode === "profiles") {
    return data.profiles.filter((row) => row.gene === gene).map((row) => ({ ...row }));
  }
  const match = genes.find((row) => row.selected && row.symbol === gene);
  return match ? geneRows([match], data.contrasts) : [];
}

export function figureAxisLimit(data) {
  const values = data.landscape.flatMap((row) => [row.day1_log2fc, row.day3_log2fc]).filter(finite);
  return Math.max(1, Math.ceil(Math.max(0, ...values.map(Math.abs)) * 1.1 * 2) / 2);
}

export function figureSpecification(data, genes, provenance, options) {
  const settings = validateFigureOptions(options);
  const sourceNames = ["tables/transcriptomics/oxphos_leading_edge_function_map.csv"];
  if (settings.mode === "profiles") sourceNames.push("tables/transcriptomics/oxphos_display_profiles.csv");
  if (settings.mode === "intervals")
    sourceNames.push(...data.contrasts.map((contrast) => `tables/transcriptomics/primary_${contrast}_genes.csv`));
  return {
    schema: "psilocin-atlas/research-figure/v1",
    title: figureModes[settings.mode],
    settings,
    encodings: settings.mode === "scatter"
      ? { mark: "dot", x: "day1_log2fc", y: "day3_log2fc", colour: "leading_edge", axis_domain: [-figureAxisLimit(data), figureAxisLimit(data)], reference: "identity" }
      : settings.mode === "intervals"
        ? { mark: "point-and-interval", x: "log2FoldChange", y: "contrast", lower: "lower_wald_95", upper: "upper_wald_95", interval: "Approximate 95% Wald: estimate ± 1.96 × archived SE" }
        : { mark: "point", x: "condition", y: "vst", colour: "block", facet: "block", condition_order: ["Control", "Day 1", "Day 3"] },
    caveat: figureCaveat,
    sources: sourceNames.map((path) => ({ path, sha256: provenance?.inputs?.[path] ?? null })),
    archive_doi: provenance?.archiveDOI ?? null,
    rows: figureRows(data, genes, settings),
  };
}
