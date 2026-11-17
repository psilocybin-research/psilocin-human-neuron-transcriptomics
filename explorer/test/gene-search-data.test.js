import { test } from "node:test";
import assert from "node:assert/strict";
import { geneSuggestions } from "../src/components/gene-search-data.js";
const genes = [
  { id: "E1.1", symbol: "ATP5A1", selected: true },
  { id: "E1.2", symbol: "ATP5A1", selected: false },
  { id: "E2", symbol: "GPX4", selected: true },
  { id: "E3", symbol: "GPX4L", selected: true },
];
const aliases = [
  {
    source_symbol: "ATP5A1",
    current_symbol: "ATP5F1A",
    selected_gene_id: "E1.1",
  },
];
test("verified aliases select their original gene ID without merging duplicate IDs", () => {
  const matches = geneSuggestions(genes, aliases, "ATP5F1A");
  assert.deepEqual(
    matches.map((g) => g.id),
    ["E1.1"],
  );
  assert.deepEqual(
    geneSuggestions(genes, aliases, "E1.2").map((g) => g.id),
    ["E1.2"],
  );
  assert.equal(geneSuggestions(genes, aliases, "ATP5A1").length, 2);
});
test("exact symbols precede prefixes and initial suggestions honor the selected cohort", () => {
  assert.deepEqual(
    geneSuggestions(genes, aliases, "gpx4").map((g) => g.symbol),
    ["GPX4", "GPX4L"],
  );
  assert.equal(geneSuggestions(genes, aliases, "", ["E3"])[0].id, "E3");
  assert.deepEqual(
    geneSuggestions(genes.slice(0, 1), aliases, "").map((g) => g.id),
    ["E1.1"],
  );
});
test("unknown identifiers return no fabricated matches", () => {
  assert.deepEqual(geneSuggestions(genes, aliases, "not-a-gene"), []);
});
