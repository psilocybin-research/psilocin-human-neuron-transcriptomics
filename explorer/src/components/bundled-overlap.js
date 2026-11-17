import { hierarchy, cluster } from "npm:d3-hierarchy@3.1.2";
import { lineRadial, curveBundle } from "npm:d3-shape@3.2.0";
import { color, fmt } from "./format.js";
const NS = "http://www.w3.org/2000/svg";
const sn = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
export function bundledOverlapSVG({
  graph,
  connections,
  selectedPathway,
  selectedPair,
  matches,
  onNode,
  onEdge,
}) {
  const size = 920,
    radius = 280,
    tiers = ["primary", "secondary", "exploratory"];
  const root = hierarchy({
    id: "analysis",
    children: tiers
      .map((tier) => ({
        id: tier,
        children: graph.nodes
          .filter((n) => n.row.tier === tier)
          .map((n) => ({ ...n })),
      }))
      .filter((g) => g.children.length),
  });
  cluster().size([2 * Math.PI, radius])(root);
  const leaves = new Map(root.leaves().map((n) => [n.data.id, n]));
  const svg = sn("svg", {
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-label": "Hierarchical edge bundling of gene-set annotation overlap",
    style: "font:12px system-ui,sans-serif",
  });
  svg.append(
    sn(
      "title",
      {},
      "Gene-set overlap bundled by analysis family; not a molecular interaction network",
    ),
  );
  const centre = sn("g", { transform: `translate(${size / 2},${size / 2})` });
  svg.append(centre);
  const curve = lineRadial()
    .curve(curveBundle.beta(0.82))
    .radius((d) => d.y)
    .angle((d) => d.x);
  const links = [];
  for (const pair of connections) {
    const a = leaves.get(pair.source),
      b = leaves.get(pair.target);
    if (!a || !b) continue;
    const group = sn("g", {
      "data-network-pair": pair.key,
      "aria-pressed": String(pair.key === selectedPair),
      class: "bundle-edge",
    });
    const path = sn("path", {
      d: curve(a.path(b)),
      fill: "none",
      stroke: "var(--plot-axis, #8093a2)",
      "stroke-opacity": 0.4,
      "stroke-width": 1 + 5 * pair.jaccard,
    });
    const hit = sn("path", {
      d: curve(a.path(b)),
      fill: "none",
      stroke: "transparent",
      "stroke-width": 12,
      role: "button",
      tabindex: 0,
      "aria-label": `${pair.source_label} and ${pair.target_label}: ${pair.shared} shared genes; Jaccard ${fmt(pair.jaccard, 4)}. Inspect shared genes.`,
    });
    hit.onclick = () => onEdge(pair);
    hit.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onEdge(pair);
      }
    };
    hit.append(
      sn(
        "title",
        {},
        `${pair.shared} shared genes · union ${pair.union} · Jaccard ${fmt(pair.jaccard, 4)}`,
      ),
    );
    group.append(path, hit);
    centre.append(group);
    links.push({ pair, group, path });
  }
  function emphasize(id) {
    for (const link of links) {
      const active = !id || link.pair.source === id || link.pair.target === id;
      link.path.setAttribute(
        "stroke-opacity",
        active ? (id ? ".9" : ".4") : ".06",
      );
    }
  }
  for (const leaf of root.leaves()) {
    const n = leaf.data,
      angle = (leaf.x * 180) / Math.PI - 90,
      flip = leaf.x >= Math.PI;
    const group = sn("g", {
      transform: `rotate(${angle}) translate(${leaf.y},0)`,
      role: "button",
      tabindex: 0,
      "data-network-node": n.id,
      "aria-pressed": String(n.id === selectedPathway),
      "aria-label": `${n.label}; ${n.row.tier} family; ${n.size ?? "unavailable"} members. Inspect evidence.`,
      class: `bundle-node${matches.has(n.id) ? " search-match" : ""}`,
    });
    group.append(
      sn("circle", {
        r: 7,
        fill: color(n.row.NES, 3.6),
        stroke: "var(--plot-axis, #8093a2)",
        "stroke-width": matches.has(n.id) ? 3 : 1,
      }),
    );
    const label = sn(
      "text",
      {
        x: flip ? -13 : 13,
        dy: ".32em",
        "text-anchor": flip ? "end" : "start",
        transform: flip ? "rotate(180)" : "",
      },
      n.short,
    );
    group.append(
      label,
      sn(
        "title",
        {},
        `${n.label} · ${n.row.tier} · NES ${fmt(n.row.NES)} · ${n.size ?? "unavailable"} members`,
      ),
    );
    group.onclick = () => onNode(n.id);
    group.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onNode(n.id);
      }
    };
    group.onpointerenter = () => emphasize(n.id);
    group.onpointerleave = () => emphasize(null);
    group.onfocus = () => emphasize(n.id);
    group.onblur = () => emphasize(null);
    centre.append(group);
  }
  const familyNames = {
    primary: "Primary",
    secondary: "Secondary",
    exploratory: "Exploratory",
  };
  for (const group of root.children || []) {
    const pos = group.x - Math.PI / 2;
    centre.append(
      sn(
        "text",
        {
          x: Math.cos(pos) * 190,
          y: Math.sin(pos) * 190,
          "text-anchor": "middle",
          "font-weight": 650,
          "font-size": 12,
        },
        familyNames[group.data.id],
      ),
    );
  }
  return svg;
}
