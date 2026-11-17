import { downloadFile } from "./file-download.js";
import { createElement as el } from "./interface-utils.js";
import { contrasts, fmt, csvText } from "./format.js";
const NS = "http://www.w3.org/2000/svg";
const sn = (tag, a = {}, t) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) n.setAttribute(k, v);
  if (t !== undefined) n.textContent = t;
  return n;
};
function frame(title) {
  const width = Math.max(320, Math.min(680, innerWidth - 100)),
    height = 420,
    host = el("div", "plot-viewport synopsis-viewport");
  host.tabIndex = 0;
  host.style.setProperty("--plot-width", `${width}px`);
  host.dataset.fullscreenTitle = title;
  const svg = sn("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": title,
    style: "font:11px system-ui,sans-serif",
  });
  svg.append(sn("title", {}, title));
  host.append(svg);
  return { host, svg, width, height };
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
      left = 52,
      right = h.width - 20,
      top = 35,
      bottom = 330,
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
    const peak = Math.max(1, ...bins.map((b) => b.count));
    h.host.dataset.fullscreenInfo =
      "Forty equal-width bins of archived unshrunken gene log2 fold changes among original symbol-ranking representatives. Full coefficient range; no significance selection. Genes are dependent observations, not biological samples.";
    bins.forEach((b, i) => {
      const x = left + (i / count) * (right - left),
        height = (b.count / peak) * (bottom - top),
        r = sn("rect", {
          x,
          y: bottom - height,
          width: (right - left) / count - 1,
          height,
          fill: "#235780",
        });
      r.append(
        sn(
          "title",
          {},
          `${fmt(b.lower, 3)} to ${fmt(b.upper, 3)}: ${b.count} genes`,
        ),
      );
      h.svg.append(r);
    });
    for (let i = 0; i <= 4; i++) {
      const v = lo + ((hi - lo) * i) / 4;
      h.svg.append(
        sn(
          "text",
          {
            x: left + (i / 4) * (right - left),
            y: 350,
            "text-anchor": "middle",
          },
          fmt(v, 1),
        ),
        sn(
          "text",
          {
            x: left - 8,
            y: bottom - (i / 4) * (bottom - top) + 4,
            "text-anchor": "end",
          },
          String(Math.round((peak * i) / 4)),
        ),
      );
    }
    h.svg.append(
      sn(
        "text",
        { x: (left + right) / 2, y: 380, "text-anchor": "middle" },
        "Archived log₂ fold change",
      ),
      sn(
        "text",
        { x: left, y: 407, "font-size": 10 },
        `${values.length.toLocaleString()} estimated · ${cohort.length - values.length} unavailable`,
      ),
    );
    const q = frame("Nominal gene p-value Q–Q diagnostic"),
      extent = Math.max(
        1,
        Math.ceil(-Math.log10(0.5 / Math.max(1, pvalues.length))),
      ),
      x = (v) => left + (v / extent) * (q.width - 20 - left),
      y = (v) => bottom - (v / 50) * (bottom - top);
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
    q.svg.append(
      sn("line", {
        x1: x(0),
        y1: y(0),
        x2: x(extent),
        y2: y(extent),
        stroke: "#7b92a4",
        "stroke-dasharray": "4 4",
      }),
    );
    for (const rank of ranks) {
      const row = exported[rank],
        observed =
          row.observed_neglog10 === null
            ? 50
            : Math.min(50, row.observed_neglog10),
        point = sn("circle", {
          cx: x(row.expected_neglog10),
          cy: y(observed),
          r: 2,
          fill: "#235780",
        });
      point.append(
        sn(
          "title",
          {},
          `${row.symbol} · p ${row.nominal_pvalue} · rank ${row.rank}`,
        ),
      );
      q.svg.append(point);
    }
    for (let i = 0; i <= 4; i++) {
      q.svg.append(
        sn(
          "text",
          { x: x((extent * i) / 4), y: 350, "text-anchor": "middle" },
          fmt((extent * i) / 4, 1),
        ),
        sn(
          "text",
          { x: left - 8, y: y((50 * i) / 4) + 4, "text-anchor": "end" },
          fmt((50 * i) / 4, 0),
        ),
      );
    }
    q.svg.append(
      sn(
        "text",
        { x: q.width / 2, y: 380, "text-anchor": "middle" },
        "Expected −log₁₀ uniform plotting position",
      ),
      sn(
        "text",
        { transform: "translate(13,185) rotate(-90)", "text-anchor": "middle" },
        "Observed −log₁₀ nominal p",
      ),
      sn(
        "text",
        { x: left, y: 407, "font-size": 10 },
        `${pvalues.length.toLocaleString()} p-values · ${ranks.length} representative ranks shown`,
      ),
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
