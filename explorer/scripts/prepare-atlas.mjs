import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import { overlapGraph } from "../src/components/pathway-overlap.js";

// Presentation coordinates only. No statistical estimates or set memberships change.
const source = await readFile(
  new URL("../src/data/atlas.json", import.meta.url),
);
const data = JSON.parse(source);
const layouts = {};
const started = performance.now();
for (const tier of ["all", ...new Set(data.pathways.map((row) => row.tier))]) {
  const graph = overlapGraph(data, data.contrasts[0], { tier, members: "all" });
  const nodes = graph.nodes.map((node) => ({ ...node }));
  const links = graph.pairs
    .filter((pair) => pair.shared > 0)
    .map((pair) => ({ ...pair }));
  const width = 820,
    height = 780;
  const simulation = forceSimulation(nodes)
    .stop()
    .force("charge", forceManyBody().strength(-450))
    .force(
      "link",
      forceLink(links)
        .id((n) => n.id)
        .distance((p) => 200 - 180 * p.jaccard)
        .strength(0.06),
    )
    .force("collide", forceCollide(76).iterations(3))
    .force("x", forceX(width / 2).strength(0.035))
    .force("y", forceY(height / 2).strength(0.035));
  simulation.tick(360);
  simulation.stop();
  // Keep label extents separated around circular nodes; deterministic and bounded.
  for (let tick = 0; tick < 160; tick++) {
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          ox = 174 - Math.abs(dx),
          oy = 106 - Math.abs(dy);
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const push = ((ox + 0.2) / 2) * (dx >= 0 ? 1 : -1);
            a.x -= push;
            b.x += push;
          } else {
            const push = ((oy + 0.2) / 2) * (dy >= 0 ? 1 : -1);
            a.y -= push;
            b.y += push;
          }
        }
      }
    for (const n of nodes) {
      n.x = Math.max(85, Math.min(width - 85, n.x));
      n.y = Math.max(38, Math.min(height - 90, n.y));
    }
  }

  layouts[tier] = Object.fromEntries(
    nodes.map(({ id, x, y }) => {
      if (!Number.isFinite(x) || !Number.isFinite(y))
        throw new Error(`Invalid coordinate: ${id}`);
      return [id, { x, y }];
    }),
  );
}
const output = {
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  description:
    "Deterministic display coordinates; distances have no biological meaning.",
  layouts,
};
const destination = new URL(
  "../src/assets/vendor/atlas-layouts.js",
  import.meta.url,
);
await mkdir(new URL(".", destination), { recursive: true });
await writeFile(
  destination,
  `// Generated from archived atlas.json before build.\nexport default ${JSON.stringify(output)};\n`,
);
console.log(
  `Precomputed ${Object.keys(layouts).length} pathway layouts in ${(performance.now() - started).toFixed(1)} ms; browser force simulation removed.`,
);
