import { test } from "node:test";
import assert from "node:assert/strict";
import { fuzzyGeneSuggestions, geneSuggestions } from "../src/components/gene-search-data.js";
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
test("fuzzy matching is opt-in, conservative and keeps verified aliases", () => {
  assert.deepEqual(fuzzyGeneSuggestions(genes, aliases, "AT").map((g) => g.id), []);
  const matches = fuzzyGeneSuggestions(genes, aliases, "ATP5F1B");
  assert.equal(matches[0].id, "E1.1");
  assert.equal(matches[0].fuzzy, true);
  assert.ok(matches[0].aliases.includes("ATP5F1A"));
});
test("cached searches retain the top twenty and isolate datasets and returned aliases", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({
    id: `ID${i}`,
    symbol: `GENE${String(i).padStart(2, "0")}`,
    selected: i % 2 === 0,
  }));
  const preferred = ["ID79", "ID33"];
  const initial = geneSuggestions(many, aliases, "", preferred);
  assert.equal(initial.length, 20);
  assert.deepEqual(
    initial.slice(0, 2).map((g) => g.id),
    preferred,
  );
  assert.equal(geneSuggestions(many, aliases, "GENE79")[0].id, "ID79");
  const aliasResult = geneSuggestions(genes, aliases, "ATP5F1A");
  aliasResult[0].aliases.push("FAKE");
  assert.equal(
    geneSuggestions(genes, aliases, "ATP5F1A")[0].aliases.includes("FAKE"),
    false,
  );
  assert.deepEqual(geneSuggestions(genes, [], "ATP5F1A"), []);
});
