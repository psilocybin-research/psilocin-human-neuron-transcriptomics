import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  gaussianDensity,
  primaryDistributions,
  densityBandwidth,
} from "../src/components/synopsis-data.js";
const load = (name) =>
  JSON.parse(
    readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)),
  );
test("Gaussian density integrates to one and excludes absent estimates", () => {
  const grid = Array.from({ length: 2001 }, (_, i) => -10 + i * 0.01),
    density = gaussianDensity([-1, 0, 1, null, NaN], grid);
  const area = density
    .slice(1)
    .reduce((sum, p, i) => sum + (p[1] + density[i][1]) * 0.005, 0);
  assert.ok(Math.abs(area - 1) < 1e-8);
  assert.equal(densityBandwidth, 0.2);
  assert.deepEqual(gaussianDensity([], [-1, 0, 1]), [
    [-1, 0],
    [0, 0],
    [1, 0],
  ]);
  assert.throws(() => gaussianDensity([0], [0], 0));
});
test("ridgelines retain full literal frozen memberships and exact archived coefficients", () => {
  const data = load("atlas"),
    genes = load("genes"),
    rows = primaryDistributions(data, genes);
  assert.equal(rows.length, 5);
  const reps = new Map(genes.filter((g) => g.selected).map((g) => [g.id, g]));
  for (const row of rows) {
    assert.equal(row.members, new Set(data.membership[row.pathway]).size);
    for (const [i, series] of row.series.entries()) {
      assert.equal(series.values.length + series.missing, row.members);
      for (const value of series.values) {
        assert.ok(data.membership[row.pathway].includes(value.symbol));
        assert.equal(value.value, reps.get(value.id).effects[i].log2FoldChange);
      }
    }
  }
  assert.equal(
    rows.find((r) => r.pathway === "HALLMARK_OXIDATIVE_PHOSPHORYLATION")
      .members,
    200,
  );
});

test("exclusive intersections partition a selected annotation union once", async () => {
  const { exclusiveIntersections } = await import(
    "../src/components/intersection-data.js"
  );
  const nodes = [
    { id: "A", available: true, symbols: ["X", "Y", "Z"] },
    { id: "B", available: true, symbols: ["Y", "Z", "W"] },
    { id: "C", available: true, symbols: ["Z"] },
  ];
  const groups = exclusiveIntersections(nodes);
  assert.equal(
    groups.reduce((n, g) => n + g.genes.length, 0),
    4,
  );
  assert.equal(new Set(groups.flatMap((g) => g.genes)).size, 4);
  assert.deepEqual(groups.find((g) => g.key === "111").genes, ["Z"]);
  assert.deepEqual(groups.find((g) => g.key === "110").genes, ["Y"]);
  assert.equal(
    exclusiveIntersections([{ available: false, symbols: null }]).length,
    0,
  );
});
test("hexagonal binning conserves unique input observations", async () => {
  const { hexbin } = await import("d3-hexbin");
  const points = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      x: (i * 17) % 311,
      y: (i * 29) % 487,
    })),
    bins = hexbin()
      .x((p) => p.x)
      .y((p) => p.y)
      .radius(12)(points);
  assert.equal(bins.flat().length, 500);
  assert.equal(new Set(bins.flat().map((p) => p.id)).size, 500);
});
