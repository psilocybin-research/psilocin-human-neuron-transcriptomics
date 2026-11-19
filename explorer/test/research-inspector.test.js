import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectorGeneEvidence } from "../src/components/research-inspector.js";
const genes = [
  { id: "ENSG1.1", symbol: "A", selected: true, effects: [{ log2FoldChange: 1, padj: 0.01 }, { log2FoldChange: -2, padj: null }, { log2FoldChange: -3 }] },
  { id: "ENSG2.2", symbol: "A", selected: false, effects: [{ log2FoldChange: 7 }] },
];
const data = { contrasts: ["day1_vs_control", "day3_vs_control", "day3_vs_day1"],
  aliases: [{ selected_gene_id: "ENSG1.1", source_symbol: "A", current_symbol: "NEW" }],
  membership: { FIRST: ["A"], SECOND: ["B"] } };
test("inspector preserves exact archived IDs, three-contrast values and missingness", () => {
  const result = inspectorGeneEvidence(genes, data, "ENSG1.1");
  assert.equal(result.gene, genes[0]);
  assert.deepEqual(result.effects.map(row => row.log2FoldChange), [1, -2, -3]);
  assert.equal(result.effects[1].padj, null);
  assert.equal(result.effects[2].padj, undefined);
  assert.deepEqual(result.memberships, ["FIRST"]);
});
test("inspector does not transfer selected-symbol membership to another exact gene", () => {
  const result = inspectorGeneEvidence(genes, data, "ENSG2.2");
  assert.equal(result.gene, genes[1]);
  assert.deepEqual(result.memberships, []);
  assert.equal(result.membershipMapped, false);
  assert.equal(inspectorGeneEvidence(genes, data, "NEW").gene, genes[0]);
  assert.equal(inspectorGeneEvidence(genes, data, "A").gene, genes[0]);
  assert.equal(inspectorGeneEvidence(genes, data, "ENSG1"), null);
});
test("inspector refuses ambiguous symbols and aliases without inventing a mapping", () => {
  assert.equal(inspectorGeneEvidence(genes.map(g => ({ ...g, selected: true })), data, "A"), null);
  const ambiguous = { ...data, aliases: [...data.aliases, { selected_gene_id: "ENSG2.2", current_symbol: "NEW" }] };
  assert.equal(inspectorGeneEvidence(genes, ambiguous, "NEW"), null);
  assert.equal(inspectorGeneEvidence(genes, data, "missing"), null);
});

test("inspector reports exact normal intervals and refuses missing or negative SE", async () => {
  const {inspectorInterval} = await import("../src/components/research-inspector.js");
  assert.deepEqual(inspectorInterval({log2FoldChange: 2, lfcSE: 0.5}), [2 - 1.959963984540054 * 0.5, 2 + 1.959963984540054 * 0.5]);
  assert.equal(inspectorInterval({log2FoldChange: null, lfcSE: 0}), null);
  assert.equal(inspectorInterval({log2FoldChange: 2, lfcSE: -1}), null);
  assert.deepEqual(inspectorInterval({log2FoldChange: 2, lfcSE: 0}), [2, 2]);
});
test("archived inspector scene retains exact numerical values, identifiers, classification and missingness count", async () => {
  const {inspectorArchivedScene} = await import("../src/components/research-inspector.js");
  const {validateSceneSpec} = await import("../src/components/scientific-scene-spec.js");
  const rows = [
    {...genes[0], effects: [{log2FoldChange: -1.2345678912345, lfcSE: 0.12345678912345, padj: 1.1e-15}]},
    {...genes[1], selected: true, symbol: "B", effects: [{log2FoldChange: 3, lfcSE: null, padj: 0.01}]},
    {...genes[1], id: "ENSG3", selected: false, effects: [{log2FoldChange: 3, lfcSE: 1, padj: 0.01}]},
  ];
  const scene = inspectorArchivedScene(rows, {...data,membership:{FIRST:["A","B"]}}, {pathway:"FIRST",contrast:"day1_vs_control"});
  assert.equal(scene.omitted, 1); assert.equal(scene.candidates, 2);
  const spec = validateSceneSpec(scene.spec);
  assert.equal(spec.classification,"archived");
  assert.deepEqual(spec.data,[{id:"ENSG1.1",label:"A",x:-1.2345678912345,y:0.12345678912345,z:1.1e-15,color:-1.2345678912345}]);
  assert.throws(()=>inspectorArchivedScene(rows,data,{pathway:"missing",contrast:"day1_vs_control"}));
});
