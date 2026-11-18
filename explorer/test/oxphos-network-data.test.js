import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOxphosNetwork } from "../src/components/oxphos-network-data.js";
const read = (path) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const atlas = read("../src/data/atlas.json"),
  genes = read("../src/data/genes.json"),
  annotations = read("../../config/oxphos_complex_membership.json");
const graph = buildOxphosNetwork(atlas, genes, annotations),
  geneNodes = graph.nodes.filter((n) => n.type === "gene");
test("3D cohort is exactly the archived 113-gene union with original identity and estimates", () => {
  assert.equal(geneNodes.length, 113);
  assert.deepEqual(
    new Set(geneNodes.map((n) => n.symbol)),
    new Set(atlas.landscape.map((n) => n.gene)),
  );
  for (const node of geneNodes) {
    const original = genes.find((g) => g.id === node.id);
    assert.ok(original.selected);
    assert.deepEqual(node.effects, original.effects);
  }
});
test("curated complex mapping separates V-type ATPases and assembly factors from structural subunits", () => {
  assert.deepEqual(
    Object.fromEntries(
      ["I", "II", "III", "IV", "V"].map((c) => [
        c,
        geneNodes.filter((n) => n.complex === c).length,
      ]),
    ),
    { I: 20, II: 3, III: 8, IV: 10, V: 0 },
  );
  for (const symbol of ["COX10", "COX17", "COX7A2L", "ATP6V0C", "ATP6AP1"])
    assert.equal(geneNodes.find((n) => n.symbol === symbol).complex, null);
  assert.equal(geneNodes.find((n) => n.symbol === "NDUFAB1").complex, "I");
});
test("every edge is literal frozen pathway membership and no gene–gene edges exist", () => {
  assert.equal(graph.links.length, 202);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const edge of graph.links) {
    const a = nodeMap.get(edge.source),
      b = nodeMap.get(edge.target);
    assert.equal(a.type, "gene");
    assert.equal(b.type, "pathway");
    assert.ok(atlas.membership[b.pathway].includes(a.symbol));
  }
  for (const gene of geneNodes)
    assert.equal(
      graph.links.filter((l) => l.source === gene.id).length,
      Object.values(atlas.membership).filter((s) => s.includes(gene.symbol))
        .length,
    );
});
test("fixed colour extent covers both days symmetrically without clipping or treating missing values as zero", () => {
  const max = Math.max(
    ...geneNodes
      .flatMap((n) =>
        n.effects.slice(0, 2).map((e) => Math.abs(e.log2FoldChange)),
      )
      .filter(Number.isFinite),
  );
  assert.ok(graph.limit >= max);
  assert.ok(graph.limit - max < 0.5);
  assert.ok(
    !graph.nodes.some(
      (n) => n.type === "pathway" && !atlas.membership[n.pathway],
    ),
  );
  assert.ok(!graph.groups.some((g) => g.key === "V"));
});
test("unknown or ambiguous archive identities fail closed", () => {
  assert.throws(
    () =>
      buildOxphosNetwork(atlas, genes, {
        ...annotations,
        genes: annotations.genes.filter((g) => g.symbol !== "NDUFA1"),
      }),
    /Unresolved/,
  );
});
