import { test } from "node:test";
import assert from "node:assert/strict";
import {
  retainedGene,
  crossDayRows,
} from "../src/components/network-statistics.js";
const gene = (a, b) => ({
  effects: [
    { log2FoldChange: 1, lfcSE: 0.2, padj: a },
    { log2FoldChange: 2, lfcSE: 0.3, padj: b },
  ],
});
test("filters use explicit either/both criteria and include exact threshold", () => {
  assert.ok(retainedGene(gene(0.05, 0.2), "fdr05"));
  assert.ok(!retainedGene(gene(0.05, 0.2), "both05"));
  assert.ok(retainedGene(gene(0.01, 0.04), "both05"));
  assert.ok(retainedGene(gene(0.01, null), "fdr01"));
  assert.ok(!retainedGene(gene(null, null), "fdr05"));
});
test("missing estimates stay in all, are excluded from estimable and scatter; missing SE not treated as certainty", () => {
  const g = gene(0.01, 0.01);
  g.effects[1].log2FoldChange = null;
  assert.ok(retainedGene(g));
  assert.ok(!retainedGene(g, "estimable"));
  assert.equal(crossDayRows([g]).length, 0);
  g.effects[1].log2FoldChange = 2;
  g.effects[1].lfcSE = null;
  assert.ok(!retainedGene(g, "estimable"));
  assert.equal(crossDayRows([g]).length, 1);
});
