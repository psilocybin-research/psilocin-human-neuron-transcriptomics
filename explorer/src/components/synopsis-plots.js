import { createElement as el } from "./interface-utils.js";
import { contrasts, label, fmt, sci, leadingEdgeColors } from "./format.js";
import {
  primaryDistributions,
  gaussianDensity,
  densityBandwidth,
} from "./synopsis-data.js";
const NS = "http://www.w3.org/2000/svg";
const sn = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
const text = (svg, x, y, t, attrs = {}) =>
  svg.append(sn("text", { x, y, ...attrs }, t));
const line = (svg, x1, y1, x2, y2, attrs = {}) =>
  svg.append(sn("line", { x1, y1, x2, y2, stroke: "#d7dedf", ...attrs }));
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
  const svg = sn("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": title,
    style: "font:12px system-ui,sans-serif",
  });
  svg.append(sn("title", {}, title));
  host.append(svg);
  return { host, svg };
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
  const rows = data.pathways.filter((r) => r.tier === "primary"),
    ids = [...new Set(rows.map((r) => r.pathway))];
  const width = Math.max(300, Math.min(760, globalThis.innerWidth - 84)),
    right = width - 88;
  const { host, svg } = frame(
    "Primary pathway enrichment synopsis",
    width,
    650,
  );
  host.dataset.fullscreenInfo =
    "All five prespecified pathways and three contrasts. Position: archived NES; filled dots: 15-test family q < 0.05, open dots: q ≥ 0.05. NES is not a biological-sample effect size. No uncertainty intervals are inferred.";
  const extent = Math.ceil(
    Math.max(
      1,
      ...rows.filter((r) => Number.isFinite(r.NES)).map((r) => Math.abs(r.NES)),
    ),
  );
  const x = (v) => 28 + ((v + extent) / (2 * extent)) * (right - 28);
  for (let t = -extent; t <= extent; t++) {
    line(svg, x(t), 20, x(t), 590, {
      stroke: t === 0 ? "#7b92a4" : "#d7dedf",
      "stroke-dasharray": t === 0 ? "4 4" : "2 5",
    });
    text(svg, x(t), 612, String(t), { "text-anchor": "middle" });
  }
  ids.forEach((id, i) => {
    const y = 36 + i * 111;
    text(svg, 12, y, label(id), { "font-weight": 650 });
    data.contrasts.forEach((contrast, j) => {
      const row = rows.find((r) => r.pathway === id && r.contrast === contrast);
      if (!row) return;
      const yy = y + 21 + j * 23;
      const group = sn("g", {
        role: "button",
        tabindex: 0,
        "aria-label": `${label(id)}, ${contrasts[contrast]}, NES ${fmt(row.NES)}, 15-test q ${sci(row.family_fdr)}. Inspect pathway evidence.`,
      });
      const activate = () => onInspect?.(id, contrast);
      group.onclick = activate;
      group.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      };
      group.append(
        sn("rect", {
          x: 0,
          y: yy - 11,
          width: width - 2,
          height: 23,
          fill: "transparent",
        }),
      );
      if (Number.isFinite(row.NES)) {
        group.append(
          sn("circle", {
            cx: x(row.NES),
            cy: yy,
            r: 6,
            fill:
              row.family_fdr !== null && row.family_fdr < 0.05
                ? colors[j]
                : "none",
            stroke: colors[j],
            "stroke-width": 2,
          }),
        );
      }
      text(group, width - 6, yy + 4, `q ${sci(row.family_fdr)}`, {
        "text-anchor": "end",
        "font-size": 10,
      });
      group.append(
        sn(
          "title",
          {},
          `${contrasts[contrast]} · NES ${fmt(row.NES, 4)} · 15-test q ${sci(row.family_fdr)} · ${row.robustness}`,
        ),
      );
      svg.append(group);
    });
  });
  text(svg, width / 2, 642, "Normalized enrichment score (NES)", {
    "text-anchor": "middle",
  });
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
  const width = Math.max(300, Math.min(760, globalThis.innerWidth - 100)),
    right = width - 20;
  const { host, svg } = frame(
    "Gene-effect distributions across primary pathways",
    width,
    800,
  );
  host.dataset.fullscreenInfo = `Full frozen pathway annotations, original symbol-ranking representatives, Day 1/common control and Day 3/common control. Gaussian KDE bandwidth ${densityBandwidth} log2 fold-change units; unit-area density per pathway and contrast; one common height scale. Missing coefficients excluded and counted. Genes and overlapping memberships are not independent biological replicates.`;
  const x = (v) => 28 + ((v + extent) / (2 * extent)) * (right - 28);
  const step = extent > 4 ? 2 : 1;
  for (let v = -Math.floor(extent / step) * step; v <= extent; v += step) {
    line(svg, x(v), 30, x(v), 728, {
      stroke: v === 0 ? "#7b92a4" : "#d7dedf",
      "stroke-dasharray": "3 5",
    });
    text(svg, x(v), 750, fmt(v, 0), { "text-anchor": "middle" });
  }
  curves.forEach((d, i) => {
    const top = 32 + i * 142,
      base = top + 119;
    text(svg, 12, top, label(d.pathway), { "font-weight": 650 });
    text(
      svg,
      12,
      top + 18,
      `${d.members} annotated · Day 1: ${d.series[0].values.length} estimated / ${d.series[0].missing} absent`,
      { "font-size": 10 },
    );
    text(
      svg,
      12,
      top + 33,
      `Day 3: ${d.series[1].values.length} estimated / ${d.series[1].missing} absent`,
      { "font-size": 10 },
    );
    line(svg, 28, base, right, base);
    d.series.forEach((s, j) => {
      if (!s.values.length) return;
      const path = sn("path", {
        d:
          `M${x(-extent)},${base} ` +
          s.density
            .map(([v, y]) => `L${x(v)},${base - (y / maximum) * 72}`)
            .join(" ") +
          ` L${x(extent)},${base} Z`,
        fill: colors[j],
        "fill-opacity": 0.22,
        stroke: colors[j],
        "stroke-width": 1.8,
      });
      path.append(
        sn(
          "title",
          {},
          `${label(d.pathway)} · ${contrasts[s.contrast]} · ${s.values.length} coefficients · ${s.missing} absent · Gaussian bandwidth ${densityBandwidth}`,
        ),
      );
      svg.append(path);
    });
  });
  text(svg, width / 2, 786, "Archived gene-level log₂ fold change", {
    "text-anchor": "middle",
  });
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
    svg,
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
