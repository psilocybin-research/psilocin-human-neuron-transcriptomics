import { Plot, scientificPlot, interactiveMark } from "./scientific-plot.js";
import { createElement as el } from "./interface-utils.js";
import { contrasts, label, fmt, sci, leadingEdgeColors } from "./format.js";
import {
  primaryDistributions,
  gaussianDensity,
  densityBandwidth,
} from "./synopsis-data.js";
const colors = [
  leadingEdgeColors["Day 1 only"],
  leadingEdgeColors["Day 3 only"],
  "#8471ad",
];
function frame(title, width, height) {
  const host = el("div", "plot-viewport synopsis-viewport");
  host.tabIndex = 0;
  host.style.setProperty("--plot-width", `${width}px`);
  host.dataset.fullscreenTitle = title;
  return { host };
}
function legend(parent, items) {
  const row = el("div", "synopsis-legend");
  for (const [name, color] of items) {
    const item = el("span");
    const dot = el("i");
    dot.style.background = color;
    item.append(dot, document.createTextNode(name));
    row.append(item);
  }
  parent.append(row);
}
export function createNESDotPlot(data, onInspect) {
  const rows = data.pathways.filter((r) => r.tier === "primary");
  const width = Math.max(300, Math.min(760, globalThis.innerWidth - 84));
  const { host } = frame("Primary pathway enrichment synopsis", width, 650);
  host.dataset.fullscreenInfo =
    "All five prespecified pathways and three contrasts. Position: archived NES; filled dots: 15-test family q < 0.05, open dots: q ≥ 0.05. NES is not a biological-sample effect size. No uncertainty intervals are inferred.";
  const extent = Math.ceil(
    Math.max(
      1,
      ...rows.filter((r) => Number.isFinite(r.NES)).map((r) => Math.abs(r.NES)),
    ),
  );
  const rendered = rows.map((row) => ({
    ...row,
    key: `${row.pathway}|${row.contrast}`,
    color: colors[data.contrasts.indexOf(row.contrast)],
  }));
  const describe = (row) =>
    `${label(row.pathway)}, ${contrasts[row.contrast]}, NES ${fmt(row.NES)}, 15-test q ${sci(row.family_fdr)}. Inspect pathway evidence.`;
  const chart = scientificPlot({
    title: "Primary pathway enrichment synopsis",
    width,
    height: 650,
    marginLeft: 14,
    marginRight: 86,
    marginTop: 30,
    marginBottom: 50,
    x: {
      domain: [-extent, extent],
      grid: true,
      label: "Normalized enrichment score (NES)",
    },
    y: { domain: rendered.map((r) => r.key), axis: null, padding: 0.8 },
    marks: [
      Plot.ruleX([0], { stroke: "#7b92a4", strokeDasharray: "4 4" }),
      Plot.text(
        rendered.filter((r, i) => i % 3 === 0),
        {
          x: -extent,
          y: "key",
          text: (r) => label(r.pathway),
          textAnchor: "start",
          dy: -24,
          fontWeight: 650,
        },
      ),
      Plot.dot(rendered, {
        x: "NES",
        y: "key",
        r: 5,
        stroke: "color",
        fill: (r) => (r.family_fdr < 0.05 ? r.color : "none"),
        title: describe,
        render: interactiveMark(
          rendered,
          (r) => onInspect?.(r.pathway, r.contrast),
          describe,
        ),
      }),
      Plot.text(rendered, {
        x: extent,
        y: "key",
        text: (r) => `q ${sci(r.family_fdr)}`,
        textAnchor: "start",
        dx: 12,
        fontSize: 10,
      }),
    ],
  });
  host.replaceChildren(chart);
  const wrapper = el("section", "synopsis-dotplot");
  legend(
    wrapper,
    data.contrasts.map((c, i) => [contrasts[c], colors[i]]),
  );
  wrapper.append(
    host,
    el(
      "p",
      "note",
      "Filled dots: primary family q < 0.05; open dots: q ≥ 0.05. Select a result to inspect evidence. All 15 tests are retained; shared controls preclude independent temporal inference.",
    ),
  );
  return wrapper;
}
export function createRidgeline(data, genes) {
  const distributions = primaryDistributions(data, genes),
    values = distributions.flatMap((d) =>
      d.series.flatMap((s) => s.values.map((v) => v.value)),
    );
  const extent = Math.max(
      1,
      Math.ceil(
        (Math.max(0, ...values.map(Math.abs)) + 3 * densityBandwidth) * 2,
      ) / 2,
    ),
    grid = Array.from(
      { length: 241 },
      (_, i) => -extent + (2 * extent * i) / 240,
    );
  const curves = distributions.map((d) => ({
    ...d,
    series: d.series.map((s) => ({
      ...s,
      density: gaussianDensity(
        s.values.map((v) => v.value),
        grid,
      ),
    })),
  }));
  const maximum = Math.max(
    1e-10,
    ...curves.flatMap((d) =>
      d.series.flatMap((s) => s.density.map((p) => p[1])),
    ),
  );
  const width = Math.max(300, Math.min(760, globalThis.innerWidth - 100));
  const { host } = frame(
    "Gene-effect distributions across primary pathways",
    width,
    800,
  );
  host.dataset.fullscreenInfo = `Full frozen pathway annotations, original symbol-ranking representatives, Day 1/common control and Day 3/common control. Gaussian KDE bandwidth ${densityBandwidth} log2 fold-change units; unit-area density per pathway and contrast; one common height scale. Missing coefficients excluded and counted. Genes and overlapping memberships are not independent biological replicates.`;
  const densityRows = curves.flatMap((d, i) =>
    d.series.flatMap((series, j) =>
      series.density.map(([effect, density]) => ({
        pathway: d.pathway,
        contrast: series.contrast,
        effect,
        density,
        baseline: i * 1.8,
        value: i * 1.8 - density / maximum,
        color: colors[j],
      })),
    ),
  );
  const chart = scientificPlot({
    title: "Gene-effect distributions across primary pathways",
    width,
    height: 800,
    marginLeft: 28,
    marginRight: 20,
    marginTop: 70,
    marginBottom: 60,
    x: {
      domain: [-extent, extent],
      grid: true,
      label: "Archived gene-level log₂ fold change",
    },
    y: { domain: [curves.length * 1.8 - 0.5, -0.8], axis: null },
    marks: [
      Plot.ruleX([0], { stroke: "#7b92a4", strokeDasharray: "4 4" }),
      Plot.ruleY(
        curves.map((d, i) => i * 1.8),
        { stroke: "#d7dedf" },
      ),
      Plot.areaY(densityRows, {
        x: "effect",
        y1: "baseline",
        y2: "value",
        z: (r) => `${r.pathway}|${r.contrast}`,
        fill: "color",
        fillOpacity: 0.22,
        stroke: "color",
        strokeWidth: 1.8,
        title: (r) =>
          `${label(r.pathway)} · ${contrasts[r.contrast]} · Gaussian bandwidth ${densityBandwidth}`,
      }),
      Plot.text(
        curves.map((d, i) => ({
          text: `${label(d.pathway)} · ${d.members} annotated`,
          y: i * 1.8 - 1.25,
        })),
        {
          x: -extent,
          y: "y",
          text: "text",
          textAnchor: "start",
          fontWeight: 650,
        },
      ),
      Plot.text(
        curves.map((d, i) => ({
          text: d.series
            .map(
              (r, j) =>
                `Day ${j === 0 ? 1 : 3}: ${r.values.length} estimated / ${r.missing} absent`,
            )
            .join(" · "),
          y: i * 1.8 - 1.0,
        })),
        { x: -extent, y: "y", text: "text", textAnchor: "start", fontSize: 10 },
      ),
    ],
  });
  host.replaceChildren(chart);
  const wrapper = el("section", "ridgeline-summary");
  legend(
    wrapper,
    data.contrasts.slice(0, 2).map((c, i) => [contrasts[c], colors[i]]),
  );
  wrapper.append(
    host,
    el(
      "p",
      "note",
      `Descriptive distributions across genes, not biological replicates or uncertainty intervals. Gaussian bandwidth: ${densityBandwidth} log₂ fold-change units, fixed for every curve. Each density has unit area and uses the same height scale; ridge height does not encode pathway size. The axis covers every included coefficient plus three bandwidths. Shared annotations and common controls create dependencies.`,
    ),
  );
  const rows = distributions.flatMap((d) =>
    d.series.flatMap((s) =>
      s.values.map((v) => ({
        pathway: d.pathway,
        contrast: s.contrast,
        gene_id: v.id,
        symbol: v.symbol,
        log2FoldChange: v.value,
        annotated_members: d.members,
        estimated_members: s.values.length,
        absent_members: s.missing,
        bandwidth: densityBandwidth,
      })),
    ),
  );
  return {
    element: wrapper,
    svg: chart,
    rows,
    metadata: {
      kernel: "Gaussian",
      bandwidth: densityBandwidth,
      normalization:
        "unit area per pathway and contrast; common density-height scale",
      membership:
        "full frozen primary pathway annotations; original symbol-ranking representatives",
      axis: [-extent, extent],
      grid_points: grid.length,
    },
  };
}
