import { hexbin } from "npm:d3-hexbin@0.2.2";
import { createElement as el } from "./interface-utils.js";
import { comparisonPoints } from "./comparison-data.js";
import { fmt } from "./format.js";
const NS = "http://www.w3.org/2000/svg";
const sn = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
export function createHexbinPlot({ genes, state, onSelect, matchGene }) {
  const width = Math.max(300, Math.min(900, innerWidth - 100)),
    height = 590,
    left = 52,
    right = width - 22,
    top = 40,
    bottom = 490;
  const points = comparisonPoints(genes, "scatter"),
    max = Math.max(1, ...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)])),
    extent = state.range === "all" ? max * 1.03 : +state.range;
  const x = (v) => left + ((v + extent) / (2 * extent)) * (right - left),
    y = (v) => bottom - ((v + extent) / (2 * extent)) * (bottom - top);
  const valid = points
    .filter((p) => Math.abs(p.x) <= extent && Math.abs(p.y) <= extent)
    .map((p) => ({ ...p, px: x(p.x), py: y(p.y) }));
  const radius = 12,
    generator = hexbin()
      .x((p) => p.px)
      .y((p) => p.py)
      .radius(radius),
    bins = generator(valid).sort(
      (a, b) => b.length - a.length || a.x - b.x || a.y - b.y,
    ),
    peak = Math.max(1, ...bins.map((b) => b.length));
  const root = el("section", "hexbin-summary"),
    host = el("div", "plot-viewport synopsis-viewport");
  host.style.setProperty("--plot-width", `${width}px`);
  host.tabIndex = 0;
  host.dataset.fullscreenTitle = "Cross-contrast gene-effect density";
  host.dataset.fullscreenInfo =
    "Hexagonal bins count original gene ranking representatives. Day 1/common-control coefficient on x, Day 3/common-control coefficient on y. Colour encodes log(1 + gene count), not significance. Same common controls; no treatment-by-time interaction.";
  const svg = sn("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Cross-contrast gene-effect hexbin density",
    style: "font:11px system-ui,sans-serif",
  });
  svg.append(
    sn(
      "title",
      {},
      "Cross-contrast gene-effect density; select a bin to inspect its genes",
    ),
  );
  const defs = sn("defs"),
    clip = sn("clipPath", { id: "hexbin-plot-clip" });
  clip.append(
    sn("rect", { x: left, y: top, width: right - left, height: bottom - top }),
  );
  defs.append(clip);
  svg.append(defs);
  for (let i = 0; i <= 4; i++) {
    const v = -extent + (2 * extent * i) / 4;
    svg.append(
      sn("line", {
        x1: x(v),
        y1: top,
        x2: x(v),
        y2: bottom,
        stroke: "#d7dedf",
      }),
      sn("line", {
        x1: left,
        y1: y(v),
        x2: right,
        y2: y(v),
        stroke: "#d7dedf",
      }),
      sn(
        "text",
        { x: x(v), y: bottom + 22, "text-anchor": "middle" },
        fmt(v, 1),
      ),
      sn("text", { x: left - 8, y: y(v) + 4, "text-anchor": "end" }, fmt(v, 1)),
    );
  }
  svg.append(
    sn("line", {
      x1: left,
      y1: bottom,
      x2: right,
      y2: top,
      stroke: "#7b92a4",
      "stroke-dasharray": "4 4",
    }),
  );
  const marks = sn("g", { "clip-path": "url(#hexbin-plot-clip)" }),
    highlight = sn("g", { "clip-path": "url(#hexbin-plot-clip)" });
  svg.append(marks, highlight);
  function updateHighlights() {
    highlight.replaceChildren();
    for (const p of valid.filter(
      (p) => state.selection.has(p.gene.id) || matchGene(p.gene),
    )) {
      const circle = sn("circle", {
        cx: p.px,
        cy: p.py,
        r: 3.5,
        fill: "none",
        stroke: "var(--plot-highlight, #a07321)",
        "stroke-width": 1.6,
      });
      circle.append(
        sn(
          "title",
          {},
          `${p.gene.symbol} · Day 1 ${fmt(p.x, 3)} · Day 3 ${fmt(p.y, 3)}`,
        ),
      );
      highlight.append(circle);
    }
  }
  const picker = el("label", "control hexbin-picker");
  picker.append(el("span", "", "Inspect a density bin"));
  const select = el("select");
  select.setAttribute("aria-label", "Density bin");
  const blank = el("option", "", "Choose a bin by gene count");
  blank.value = "";
  select.append(blank);
  function inspectBin(value) {
    select.value = value;
    marks.querySelectorAll("[data-density-bin]").forEach((path) => {
      const selected = path.dataset.densityBin === value;
      path.setAttribute("aria-pressed", String(selected));
      path.setAttribute(
        "stroke",
        selected
          ? "var(--plot-highlight, #a07321)"
          : "var(--plot-background, #fff)",
      );
      path.setAttribute("stroke-width", selected ? 2.5 : 0.5);
    });
    onSelect(value === "" ? [] : bins[+value].map((p) => p.gene));
    updateHighlights();
  }
  bins.forEach((bin, i) => {
    const a = ((bin.x - left) / (right - left)) * 2 * extent - extent,
      b = ((bottom - bin.y) / (bottom - top)) * 2 * extent - extent;
    const title = `Bin ${i + 1}: ${bin.length} genes · centre Day 1 ${fmt(a, 2)}, Day 3 ${fmt(b, 2)}`;
    const activate = () => {
      inspectBin(String(i));
    };
    const t = Math.log1p(bin.length) / Math.log1p(peak),
      fill = `rgb(${Math.round(226 - 195 * t)},${Math.round(241 - 157 * t)},${Math.round(251 - 111 * t)})`;
    const path = sn("path", {
      d: generator.hexagon(),
      transform: `translate(${bin.x},${bin.y})`,
      fill,
      stroke: "var(--plot-background, #fff)",
      "stroke-width": 0.5,
      role: "button",
      tabindex: -1,
      "aria-label": title,
      "data-density-bin": i,
      "aria-pressed": "false",
    });
    path.append(sn("title", {}, title));
    path.onclick = activate;
    marks.append(path);
    const option = el("option", "", title);
    option.value = String(i);
    select.append(option);
  });
  select.onchange = () => inspectBin(select.value);
  picker.append(select);
  svg.append(
    sn(
      "text",
      { x: (left + right) / 2, y: 545, "text-anchor": "middle" },
      "Day 1 / common control · log₂ fold change",
    ),
    sn(
      "text",
      {
        transform: `translate(14,${(top + bottom) / 2}) rotate(-90)`,
        "text-anchor": "middle",
      },
      "Day 3 / common control · log₂ fold change",
    ),
  );
  svg.append(
    sn(
      "text",
      { x: left, y: 568, "font-size": 10 },
      `Count scale: 1 → ${peak} genes/bin · log(1 + count)`,
    ),
  );
  host.append(svg);
  root.append(
    picker,
    host,
    el(
      "p",
      "note",
      `${genes.length.toLocaleString()} cohort genes · ${points.length.toLocaleString()} estimable pairs · ${(points.length - valid.length).toLocaleString()} outside the axis window · ${bins.length} occupied bins. Bin radius: ${radius} display pixels. Bin membership changes with plot dimensions or axis extent. Select a bin to list its exact genes below; selected/search-matched genes are outlined. Counts describe genes, not biological replication or statistical support.`,
    ),
  );
  updateHighlights();
  return {
    element: root,
    svg,
    updateHighlights,
    rows: bins.flatMap((bin, i) =>
      bin.map((p) => ({
        bin: i + 1,
        bin_count: bin.length,
        gene_id: p.gene.id,
        symbol: p.gene.symbol,
        day1_log2FoldChange: p.x,
        day3_log2FoldChange: p.y,
      })),
    ),
    metadata: {
      radius,
      units: "display pixels",
      extent: [-extent, extent],
      width,
      height,
      count_scale: "log1p",
      estimable: points.length,
      excluded: points.length - valid.length,
      occupied_bins: bins.length,
    },
  };
}
