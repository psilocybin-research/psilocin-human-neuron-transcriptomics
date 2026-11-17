import { Plot, scientificPlot } from "./scientific-plot.js";
import { downloadFile } from "./file-download.js";
import { createElement as el } from "./interface-utils.js";
import { contrasts, fmt, csvText } from "./format.js";
function frame(title) {
  const width = Math.max(300, Math.min(760, innerWidth - 80)),
    host = el("div", "plot-viewport synopsis-viewport");
  host.tabIndex = 0;
  host.style.setProperty("--plot-width", `${width}px`);
  host.dataset.fullscreenTitle = title;
  return { host, width };
}
function save(name, rows) {
  return downloadFile(name, csvText(rows));
}
export function geneDiagnostics(data, genes, initial) {
  const root = el("section", "gene-diagnostics");
  let contrast = initial;
  const controls = el("div", "controls");
  const label = el("label", "control");
  label.append(el("span", "", "Diagnostic contrast"));
  const select = el("select");
  select.setAttribute("aria-label", "Diagnostic contrast");
  for (const [c, name] of Object.entries(contrasts)) {
    const o = el("option", "", name);
    o.value = c;
    select.append(o);
  }
  select.value = contrast;
  label.append(select);
  controls.append(label);
  root.append(controls);
  const content = el("div");
  root.append(content);
  function draw() {
    content.replaceChildren();
    const index = data.contrasts.indexOf(contrast),
      cohort = genes.filter((g) => g.selected),
      values = cohort
        .map((g) => g.effects[index].log2FoldChange)
        .filter(Number.isFinite),
      pvalues = cohort
        .filter(
          (g) =>
            Number.isFinite(g.effects[index].pvalue) &&
            g.effects[index].pvalue >= 0 &&
            g.effects[index].pvalue <= 1,
        )
        .sort(
          (a, b) =>
            a.effects[index].pvalue - b.effects[index].pvalue ||
            a.id.localeCompare(b.id),
        );
    const h = frame("Archived gene-effect histogram"),
      lo = Math.min(0, ...values),
      hi = Math.max(1, ...values),
      count = 40,
      step = (hi - lo) / count,
      bins = Array.from({ length: count }, (_, i) => ({
        lower: lo + i * step,
        upper: lo + (i + 1) * step,
        count: 0,
      }));
    for (const v of values)
      bins[Math.min(count - 1, Math.floor((v - lo) / step))].count++;
    h.host.dataset.fullscreenInfo =
      "Forty equal-width bins of archived unshrunken coefficients among original symbol-ranking representatives. Full coefficient range; no significance selection. Genes are not biological samples.";
    const histogram = scientificPlot({
      title: "Archived gene-effect histogram",
      width: h.width,
      height: 420,
      x: { domain: [lo, hi], label: "Archived log₂ fold change" },
      y: { grid: true, label: "Gene count" },
      marks: [
        Plot.rectY(bins, {
          x1: "lower",
          x2: "upper",
          y: "count",
          fill: "#235780",
          insetLeft: 0.5,
          insetRight: 0.5,
          title: (b) =>
            `${fmt(b.lower, 3)} to ${fmt(b.upper, 3)}: ${b.count} genes`,
        }),
        Plot.ruleY([0]),
      ],
    });
    h.host.replaceChildren(histogram);
    const q = frame("Nominal gene p-value Q–Q diagnostic"),
      extent = Math.max(
        1,
        Math.ceil(-Math.log10(0.5 / Math.max(1, pvalues.length))),
      );
    q.host.dataset.fullscreenInfo =
      "Expected −log10 uniform plotting positions versus observed −log10 nominal DESeq2 Wald p-values. A mixture of null and non-null genes and gene dependence is expected. This plot does not validate calibration, independence, model fit or causal attribution. Observed display caps at 50, including numerical zero.";
    const ranks = [
      ...new Set([
        ...Array.from({ length: Math.min(512, pvalues.length) }, (_, i) =>
          Math.floor(
            (i / Math.max(1, Math.min(512, pvalues.length) - 1)) *
              (pvalues.length - 1),
          ),
        ),
        ...Array.from({ length: Math.min(64, pvalues.length) }, (_, i) => i),
      ]),
    ].sort((a, b) => a - b);
    const exported = pvalues.map((g, i) => ({
      gene_id: g.id,
      symbol: g.symbol,
      contrast,
      rank: i + 1,
      nominal_pvalue: g.effects[index].pvalue,
      expected_neglog10: -Math.log10((i + 0.5) / pvalues.length),
      observed_neglog10:
        g.effects[index].pvalue === 0
          ? null
          : -Math.log10(g.effects[index].pvalue),
      numerical_zero: g.effects[index].pvalue === 0,
    }));
    const displayed = ranks.map((rank) => ({
      ...exported[rank],
      display_y:
        exported[rank].observed_neglog10 === null
          ? 50
          : Math.min(50, exported[rank].observed_neglog10),
    }));
    q.host.replaceChildren(
      scientificPlot({
        title: "Nominal gene p-value Q–Q diagnostic",
        width: q.width,
        height: 420,
        x: {
          domain: [0, extent],
          label: "Expected −log₁₀ uniform plotting position",
        },
        y: { domain: [0, 50], grid: true, label: "Observed −log₁₀ nominal p" },
        marks: [
          Plot.line(
            [
              { x: 0, y: 0 },
              { x: extent, y: extent },
            ],
            { x: "x", y: "y", stroke: "#7b92a4", strokeDasharray: "4 4" },
          ),
          Plot.dot(displayed, {
            x: "expected_neglog10",
            y: "display_y",
            r: 2,
            fill: "#235780",
            symbol: (r) =>
              r.numerical_zero || r.observed_neglog10 > 50
                ? "triangle"
                : "circle",
            title: (r) =>
              `${r.symbol} · p ${r.nominal_pvalue} · rank ${r.rank}`,
          }),
        ],
      }),
    );
    const exports = el("div", "tree-actions");
    for (const [name, rows] of [
      ["Histogram bins", bins],
      ["Complete Q–Q ranks", exported],
    ]) {
      const b = el("button", "button button-tonal", `Download ${name} CSV`);
      b.onclick = () =>
        save(
          `gene-${name.startsWith("Histogram") ? "histogram" : "qq"}-${contrast}.csv`,
          rows,
        );
      exports.append(b);
    }
    content.append(
      el("h3", "", "Gene-level distribution diagnostics"),
      el(
        "p",
        "note",
        `${contrasts[contrast]} · all original symbol-ranking representatives. These descriptive diagnostics do not refit the model or change FDR.`,
      ),
      h.host,
      q.host,
      el(
        "p",
        "note",
        `Q–Q uses nominal p-values, not adjusted q-values. The diagonal is the uniform-null reference, not an expectation that all genes are null. Correlated genes, genuine effects and model/design limitations can all produce departures; this display cannot distinguish them. All ${pvalues.filter((g) => g.effects[index].pvalue === 0 || -Math.log10(g.effects[index].pvalue) > 50).length} numerical-zero or >50 values are capped at 50. Up to 512 evenly spaced ranks plus the first 64 tail ranks are drawn; exports retain every rank.`,
      ),
      exports,
    );
  }
  select.onchange = () => {
    contrast = select.value;
    draw();
  };
  draw();
  return root;
}
