import { Plot, scientificPlot, interactiveMark } from "./scientific-plot.js";
import { createElement as el, createAccordion } from "./interface-utils.js";
import { leadingEdgeColors, fmt } from "./format.js";
const NS = "http://www.w3.org/2000/svg";
const sn = (tag, a = {}, t) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(a)) n.setAttribute(k, v);
  if (t !== undefined) n.textContent = t;
  return n;
};
function frame(title, w, h) {
  const host = el("div", "plot-viewport synopsis-viewport");
  host.tabIndex = 0;
  host.style.setProperty("--plot-width", `${w}px`);
  host.dataset.fullscreenTitle = title;
  const svg = sn("svg", {
    viewBox: `0 0 ${w} ${h}`,
    role: "img",
    "aria-label": title,
    style: "font:11px system-ui,sans-serif",
  });
  svg.append(sn("title", {}, title));
  host.append(svg);
  return { host, svg };
}
export function mirroredBeeswarm(data, genes, onInspect) {
  const reps = new Map(
      genes.filter((g) => g.selected).map((g) => [g.symbol, g]),
    ),
    groups = [...new Set(data.landscape.map((g) => g.functional_group))],
    width = Math.max(320, Math.min(900, innerWidth - 100));
  const rows = data.landscape.map((g) => ({
    ...g,
    estimate: reps.get(g.gene),
  }));
  const extent = Math.max(
      1,
      Math.ceil(
        Math.max(
          ...rows.flatMap(
            (g) =>
              g.estimate?.effects
                .slice(0, 2)
                .map((e) => Math.abs(e.log2FoldChange || 0)) || [],
          ),
        ) * 2,
      ) / 2,
    ),
    left = 40,
    right = width - 20,
    x = (v) => left + ((v + extent) / (2 * extent)) * (right - left);
  let cursor = 22,
    missing = 0;
  const plans = [],
    exported = [];
  for (const group of groups) {
    const subset = rows.filter((g) => g.functional_group === group),
      series = [];
    let largestLane = 0;
    for (let j = 0; j < 2; j++) {
      const occupied = [],
        points = [];
      for (const g of subset
        .slice()
        .sort(
          (a, b) =>
            (a.estimate?.effects[j].log2FoldChange || 0) -
              (b.estimate?.effects[j].log2FoldChange || 0) ||
            a.gene.localeCompare(b.gene),
        )) {
        const value = g.estimate?.effects[j].log2FoldChange;
        if (!Number.isFinite(value)) {
          missing++;
          continue;
        }
        const px = x(value);
        let lane = 0;
        while (occupied.some((p) => Math.abs(p.x - px) < 7 && p.lane === lane))
          lane++;
        occupied.push({ x: px, lane });
        largestLane = Math.max(largestLane, lane);
        points.push({ gene: g.estimate, symbol: g.gene, value, px, lane });
        exported.push({
          symbol: g.gene,
          gene_id: g.estimate.id,
          functional_group: group,
          contrast: data.contrasts[j],
          log2FoldChange: value,
        });
      }
      series.push(points);
    }
    const half = 12 + largestLane * 7,
      center = cursor + 30 + half;
    plans.push({ group, n: subset.length, top: cursor, center, series });
    cursor = center + half + 22;
  }
  const height = cursor + 70,
    { host, svg } = frame(
      "Mirrored OXPHOS gene-effect beeswarm",
      width,
      height,
    );
  host.dataset.fullscreenInfo =
    "All OXPHOS leading-edge-union genes, grouped descriptively by function. Day 1 coefficients above each baseline; Day 3 below. Horizontal position encodes archived log2 fold change; vertical offsets only separate genes. Shared common controls and genes are dependent.";
  const dots = plans.flatMap((plan) =>
    plan.series.flatMap((points, j) =>
      points.map((p) => ({
        ...p,
        y: plan.center + (j === 0 ? -1 : 1) * (7 + p.lane * 7),
        day: j === 0 ? 1 : 3,
        color: leadingEdgeColors[j === 0 ? "Day 1 only" : "Day 3 only"],
      })),
    ),
  );
  const describe = (p) =>
    `${p.symbol}, Day ${p.day}, log₂ fold change ${fmt(p.value, 3)}. Inspect gene.`;
  const chart = scientificPlot({
    title: "Mirrored OXPHOS gene-effect beeswarm",
    width,
    height,
    marginLeft: left,
    marginRight: 20,
    marginTop: 20,
    marginBottom: 55,
    x: {
      domain: [-extent, extent],
      grid: true,
      label: "Archived gene-level log₂ fold change",
    },
    y: { domain: [height - 55, 20], axis: null },
    marks: [
      Plot.ruleX([0], { stroke: "#7b92a4", strokeDasharray: "3 4" }),
      Plot.ruleY(
        plans.map((p) => p.center),
        { stroke: "#d7dedf" },
      ),
      Plot.text(plans, {
        x: -extent,
        y: "top",
        text: (p) => `${p.group} · ${p.n} genes`,
        textAnchor: "start",
        fontWeight: 650,
        fontSize: 10,
      }),
      Plot.dot(dots, {
        x: "value",
        y: "y",
        r: 3.2,
        fill: "color",
        title: describe,
        render: interactiveMark(dots, (p) => onInspect(p.gene), describe),
      }),
    ],
  });
  host.replaceChildren(chart);
  const root = el("section");
  root.append(
    el(
      "p",
      "note",
      "Blue above each baseline: Day 1/common control. Rust below: Day 3/common control. Each dot is one archived coefficient; vertical separation has no statistical meaning.",
    ),
    host,
    el(
      "p",
      "note",
      `${exported.length} gene–contrast estimates displayed · ${missing} unavailable. All 113 genes in the OXPHOS leading-edge union are retained, including genes outside one day’s leading edge. This selected union is descriptive; genes are not biological replicates.`,
    ),
  );
  return { element: root, svg: chart, rows: exported };
}
export function expressionMatrix(data, genes, state, onSelect) {
  const samples = [
      ...new Map(
        data.profiles.map((p) => [
          p.profile_id,
          { id: p.profile_id, block: p.block, condition: p.condition },
        ]),
      ).values(),
    ],
    symbols = [...new Set(data.landscape.map((g) => g.gene))],
    values = new Map(
      symbols.map((g) => [
        g,
        new Map(
          data.profiles
            .filter((p) => p.gene === g)
            .map((p) => [p.profile_id, p.vst]),
        ),
      ]),
    ),
    bySymbol = new Map(
      genes.filter((g) => g.selected).map((g) => [g.symbol, g]),
    );
  const all = [...values.values()].flatMap((m) =>
      [...m.values()].filter(Number.isFinite),
    ),
    lo = Math.floor(Math.min(...all)),
    hi = Math.ceil(Math.max(...all)),
    cell = 110,
    margin = 40,
    size = margin + samples.length * cell + 10;
  const { host, svg } = frame(
    "Nine archived block-by-condition expression profiles · OXPHOS union",
    size,
    size,
  );
  host.dataset.fullscreenInfo =
    "VST expression for the 113 OXPHOS leading-edge-union genes across nine aggregated block-by-condition profiles. Every cell compares two profiles across these genes. This selected-gene diagnostic is not a transcriptome-wide QC check, biological replication or treatment-effect estimate.";
  const marks = [],
    coord = (v, offset) => offset + 9 + ((v - lo) / (hi - lo)) * (cell - 18);
  for (let row = 0; row < samples.length; row++)
    for (let col = 0; col < samples.length; col++) {
      const xx = margin + col * cell,
        yy = margin + row * cell;
      svg.append(
        sn("rect", {
          x: xx,
          y: yy,
          width: cell,
          height: cell,
          fill: "none",
          stroke: "#d7dedf",
        }),
      );
      if (row === col) {
        svg.append(
          sn(
            "text",
            {
              x: xx + cell / 2,
              y: yy + 42,
              "text-anchor": "middle",
              "font-weight": 650,
            },
            String(row + 1),
          ),
          sn(
            "text",
            {
              x: xx + cell / 2,
              y: yy + 62,
              "text-anchor": "middle",
              "font-size": 10,
            },
            samples[row].condition,
          ),
          sn(
            "text",
            {
              x: xx + cell / 2,
              y: yy + 80,
              "text-anchor": "middle",
              "font-size": 9,
            },
            samples[row].block,
          ),
        );
        continue;
      }
      for (const symbol of symbols) {
        const m = values.get(symbol),
          a = m.get(samples[col].id),
          b = m.get(samples[row].id);
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
        const gene = bySymbol.get(symbol);
        marks.push({
          x: coord(a, xx),
          y: yy + cell - coord(b, 0),
          id: gene?.id,
        });
      }
    }
  samples.forEach((s, i) => {
    svg.append(
      sn(
        "text",
        { x: margin + i * cell + cell / 2, y: 27, "text-anchor": "middle" },
        String(i + 1),
      ),
      sn(
        "text",
        { x: 22, y: margin + i * cell + cell / 2, "text-anchor": "middle" },
        String(i + 1),
      ),
    );
  });
  const brush = sn("rect", {
    fill: "#235780",
    "fill-opacity": 0.14,
    stroke: "#235780",
    visibility: "hidden",
  });
  svg.append(brush);
  let start;
  const local = (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.getScreenCTM().inverse(),
    );
    return { x: p.x, y: p.y };
  };
  svg.onpointerdown = (e) => {
    const p = local(e),
      col = Math.floor((p.x - margin) / cell),
      row = Math.floor((p.y - margin) / cell);
    if (
      col < 0 ||
      row < 0 ||
      col >= samples.length ||
      row >= samples.length ||
      col === row
    )
      return;
    e.preventDefault();
    start = { ...p, col, row };
    svg.setPointerCapture(e.pointerId);
    brush.setAttribute("visibility", "visible");
  };
  svg.onpointermove = (e) => {
    if (!start) return;
    const p = local(e);
    for (const [k, v] of Object.entries({
      x: Math.min(p.x, start.x),
      y: Math.min(p.y, start.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    }))
      brush.setAttribute(k, v);
  };
  svg.onpointerup = (e) => {
    if (!start) return;
    const p = local(e),
      xx = margin + start.col * cell,
      yy = margin + start.row * cell;
    const chosen = symbols
      .filter((symbol) => {
        const m = values.get(symbol),
          a = coord(m.get(samples[start.col].id), xx),
          b = yy + cell - coord(m.get(samples[start.row].id), 0);
        return (
          a >= Math.min(start.x, p.x) &&
          a <= Math.max(start.x, p.x) &&
          b >= Math.min(start.y, p.y) &&
          b <= Math.max(start.y, p.y)
        );
      })
      .map((s) => bySymbol.get(s))
      .filter(Boolean);
    start = null;
    brush.setAttribute("visibility", "hidden");
    onSelect(chosen);
    update();
    if (svg.hasPointerCapture(e.pointerId))
      svg.releasePointerCapture(e.pointerId);
  };
  svg.onpointercancel = () => {
    start = null;
    brush.setAttribute("visibility", "hidden");
  };
  const ordinary = sn("path", {
      fill: "#235780",
      "fill-opacity": 0.3,
      "data-profile-points": "unselected",
    }),
    selectedPath = sn("path", {
      fill: "var(--plot-highlight, #a07321)",
      "data-profile-points": "selected",
    });
  svg.insertBefore(ordinary, brush);
  svg.insertBefore(selectedPath, brush);
  function update() {
    const paths = [[], []];
    for (const mark of marks) {
      const selected = state.selection.has(mark.id),
        r = selected ? 3 : 1.7;
      paths[selected ? 1 : 0].push(
        `M${mark.x - r},${mark.y}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 ${-r * 2},0`,
      );
    }
    ordinary.setAttribute("d", paths[0].join(""));
    selectedPath.setAttribute("d", paths[1].join(""));
  }
  const root = el("section", "expression-matrix");
  const bounds = createAccordion('Keyboard-accessible profile region selection','comparison-bounds');
  const tools = bounds.element;
  const fields = el("div", "comparison-bound-fields");
  const selects = [];
  for (const name of ["Horizontal profile", "Vertical profile"]) {
    const l = el("label", "control");
    l.append(el("span", "", name));
    const select = el("select");
    select.setAttribute("aria-label", name);
    samples.forEach((s, i) => {
      const o = el("option", "", `${i + 1}: ${s.block} · ${s.condition}`);
      o.value = s.id;
      select.append(o);
    });
    l.append(select);
    fields.append(l);
    selects.push(select);
  }
  selects[1].selectedIndex = 1;
  const limits = [];
  for (const name of [
    "Minimum VST x",
    "Maximum VST x",
    "Minimum VST y",
    "Maximum VST y",
  ]) {
    const l = el("label", "control");
    l.append(el("span", "", name));
    const input = el("input");
    input.type = "number";
    input.step = "any";
    input.value = name.startsWith("Minimum") ? lo : hi;
    input.setAttribute("aria-label", name);
    l.append(input);
    fields.append(l);
    limits.push(input);
  }
  const feedback = el("p", "note");
  feedback.setAttribute("role", "status");
  const apply = el("button", "button button-tonal", "Select expression region");
  apply.onclick = () => {
    const [a, b, c, d] = limits.map((n) => Number(n.value));
    if (
      limits.some((n) => n.value === "") ||
      ![a, b, c, d].every(Number.isFinite) ||
      a > b ||
      c > d
    ) {
      feedback.textContent = "Enter finite bounds with minimum ≤ maximum.";
      return;
    }
    const chosen = symbols
      .filter((s) => {
        const m = values.get(s),
          x = m.get(selects[0].value),
          y = m.get(selects[1].value);
        return x >= a && x <= b && y >= c && y <= d;
      })
      .map((s) => bySymbol.get(s))
      .filter(Boolean);
    onSelect(chosen);
    update();
    feedback.textContent = `${chosen.length} genes selected.`;
  };
  fields.append(apply, feedback);
  bounds.body.append(fields);
  const sampleList = el("ol", "profile-legend");
  for (const s of samples)
    sampleList.append(el("li", "", `${s.block} · ${s.condition}`));
  root.append(
    el(
      "p",
      "note",
      `Axes: archived VST, ${lo} to ${hi} in every panel. Columns are x profiles; rows are y profiles. Drag a rectangle in any off-diagonal panel to select genes across the matrix, or use the numerical controls. Diagonals identify profiles.`,
    ),
    host,
    tools,
    sampleList,
    el(
      "p",
      "note",
      "Scope: 113 OXPHOS leading-edge-union genes only, not all expressed genes. These profiles aggregate distinct cultures within three differentiation blocks and are not longitudinal samples. The selected gene set cannot establish global sample quality or treatment causality.",
    ),
  );
  update();
  return {
    element: root,
    svg,
    rows: data.profiles,
    updateHighlights: update,
    metadata: {
      scope: "113 OXPHOS leading-edge-union genes",
      profiles: samples,
      scale: "archived VST; shared axes",
      range: [lo, hi],
    },
  };
}
