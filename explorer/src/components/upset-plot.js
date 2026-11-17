import { downloadFile } from "./file-download.js";
import { exclusiveIntersections } from "./intersection-data.js";
import { createElement as el } from "./interface-utils.js";
import { csvText } from "./format.js";
const NS = "http://www.w3.org/2000/svg";
const sn = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
export function createUpSet({ nodes, genes }) {
  const chosen = nodes.slice(0, 6),
    groups = exclusiveIntersections(chosen),
    width = Math.max(600, 220 + groups.length * 34),
    height = 460,
    max = Math.max(1, ...groups.map((g) => g.genes.length));
  const root = el("section", "upset-summary"),
    host = el("div", "plot-viewport synopsis-viewport");
  host.style.setProperty("--plot-width", `${width}px`);
  host.tabIndex = 0;
  host.dataset.fullscreenTitle = "Exclusive gene-set intersections";
  host.dataset.fullscreenInfo =
    "Each column is an exact membership pattern among the selected available sets. Filled dots indicate membership; empty dots indicate exclusion. Bars count unique frozen symbols in that exact intersection, including single-set-only groups. The universe is the union of selected sets.";
  const svg = sn("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Exclusive intersections of selected gene sets",
    style: "font:12px system-ui,sans-serif",
  });
  svg.append(sn("title", {}, "Exclusive gene-set intersection counts"));
  const output = el("section", "upset-members"),
    picker = el("label", "control");
  picker.append(el("span", "", "Inspect an exact intersection"));
  const select = el("select");
  select.setAttribute("aria-label", "Exact intersection");
  const blank = el("option", "", "Choose a membership pattern");
  blank.value = "";
  select.append(blank);
  picker.append(select);
  const bySymbol = new Map(
    genes.filter((g) => g.selected).map((g) => [g.symbol, g]),
  );
  function inspect(i) {
    const group = groups[i];
    select.value = String(i);
    output.replaceChildren(
      el(
        "h4",
        "",
        `${group.genes.length} unique symbols · ${chosen
          .filter((n, j) => group.signature[j])
          .map((n) => n.short)
          .join(" ∩ ")}`,
      ),
      el(
        "p",
        "note",
        "These symbols occur in every indicated set and no other selected set. Membership in unselected annotations is not constrained.",
      ),
    );
    const list = el("div", "intersection-gene-list");
    for (const symbol of group.genes) {
      const gene = bySymbol.get(symbol);
      if (gene) {
        const link = el("a", "external", symbol);
        link.href = `#view=genes&gene=${encodeURIComponent(gene.id)}`;
        list.append(link);
      } else list.append(el("span", "", `${symbol} · no rank representative`));
    }
    output.append(list);
    root
      .querySelectorAll("[data-intersection]")
      .forEach((n) =>
        n.setAttribute("aria-pressed", String(+n.dataset.intersection === i)),
      );
  }
  chosen.forEach((node, j) => {
    svg.append(
      sn(
        "text",
        { x: 190, y: 270 + j * 25, "text-anchor": "end" },
        `${node.short} (${node.size})`,
      ),
    );
  });
  groups.forEach((group, i) => {
    const x = 220 + i * 34,
      title =
        `${group.genes.length} genes: ` +
        chosen
          .filter((n, j) => group.signature[j])
          .map((n) => n.short)
          .join(" ∩ ");
    const column = sn("g", {
      role: "button",
      tabindex: 0,
      "data-intersection": i,
      "aria-label": title,
      "aria-pressed": "false",
    });
    column.append(
      sn("rect", {
        x: x - 12,
        y: 45,
        width: 25,
        height: 365,
        fill: "transparent",
      }),
      sn("rect", {
        x: x - 10,
        y: 225 - (group.genes.length / max) * 165,
        width: 21,
        height: (group.genes.length / max) * 165,
        fill: "#235780",
      }),
      sn(
        "text",
        {
          x,
          y: 215 - (group.genes.length / max) * 165,
          "text-anchor": "middle",
          "font-size": 10,
        },
        String(group.genes.length),
      ),
    );
    const hits = group.signature
      .map((v, j) => (v ? j : -1))
      .filter((j) => j >= 0);
    if (hits.length > 1)
      column.append(
        sn("line", {
          x1: x,
          x2: x,
          y1: 266 + hits[0] * 25,
          y2: 266 + hits.at(-1) * 25,
          stroke: "#235780",
          "stroke-width": 2,
        }),
      );
    group.signature.forEach((included, j) =>
      column.append(
        sn("circle", {
          cx: x,
          cy: 266 + j * 25,
          r: 5,
          fill: included ? "#235780" : "none",
          stroke: included ? "#235780" : "#7b92a4",
        }),
      ),
    );
    column.onclick = () => inspect(i);
    column.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inspect(i);
      }
    };
    column.append(sn("title", {}, title));
    svg.append(column);
    const option = el("option", "", title);
    option.value = String(i);
    select.append(option);
  });
  select.onchange = () => {
    if (select.value !== "") inspect(+select.value);
  };
  svg.append(
    sn(
      "text",
      { x: 220, y: 25, "font-weight": 650 },
      "Exact intersection size · unique symbols",
    ),
    sn(
      "text",
      { x: 220, y: height - 12, "font-size": 10 },
      "Columns sorted by size; dots define exclusive membership within the selected union.",
    ),
  );
  const rows = groups.map((g) => ({
    pattern: g.key,
    sets: chosen
      .filter((n, j) => g.signature[j])
      .map((n) => n.id)
      .join(";"),
    unique_symbols: g.genes.length,
    symbols: g.genes.join(";"),
  }));
  const download = el(
    "button",
    "button button-tonal",
    "Download exact intersections CSV",
  );
  download.onclick = () =>
    downloadFile("exclusive-gene-set-intersections.csv", csvText(rows));
  host.append(svg);
  root.append(
    picker,
    host,
    el(
      "p",
      "note",
      `${groups.reduce((n, g) => n + g.genes.length, 0)} unique symbols in the selected union · ${groups.length} nonempty exclusive patterns. Set-size labels overlap; intersection bars partition this union. Unavailable leading-edge sets cannot define measured intersections.`,
    ),
    output,
    download,
  );
  return root;
}
