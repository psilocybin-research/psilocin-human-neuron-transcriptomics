import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCollectionInput, resolveCollectionIdentifiers, collectionDocument, collectionGMT } from "../src/components/research-collection-data.js";

const genes = [
  { id: "ENSG000001.1", symbol: "ATP5A1" },
  { id: "ENSG000002.2", symbol: "CS" },
  { id: "ENSG000003.1", symbol: "DUP" },
  { id: "ENSG000004.1", symbol: "DUP", selected: true },
  { id: "ENSG000005.1", symbol: "VERSION1" },
  { id: "ENSG000005.2", symbol: "VERSION2" },
];
const aliases = [{ selected_gene_id: "ENSG000001.1", current_symbol: "ATP5F1A", source_symbol: "ATP5A1" }, { selected_gene_id: "missing", current_symbol: "INVALID" }];

test("gene imports accept pasted lists and quoted CSV/TSV identifier columns", () => {
  assert.deepEqual(parseCollectionInput("CS, ATP5F1A; ENSG000002.2\nCS"), ["CS", "ATP5F1A", "ENSG000002.2", "CS"]);
  assert.deepEqual(parseCollectionInput('\uFEFFdescription,symbol\r\n"comma, and \"\"quote\"\"",CS\r\n"two\nlines",ATP5F1A', { filename: "genes.csv" }), ["CS", "ATP5F1A"]);
  assert.deepEqual(parseCollectionInput("symbol,effect\nCS,1.2\nATP5F1A,0.5"), ["CS", "ATP5F1A"]);
  assert.deepEqual(parseCollectionInput("effect\tgene_id\n1.2\tENSG000002.2\n", { filename: "genes.tsv" }), ["ENSG000002.2"]);
  assert.deepEqual(parseCollectionInput("CS,1\nATP5F1A,2", { filename: "genes.csv" }), ["CS", "ATP5F1A"]);
  assert.throws(() => parseCollectionInput('symbol\n"CS', { filename: "genes.csv" }), /unclosed/);
  assert.throws(() => parseCollectionInput("x".repeat(1_000_001)), /1 MB/);
});

test("only exact archived symbols, IDs and verified aliases resolve; canonical versions retained", () => {
  const result = resolveCollectionIdentifiers(["cs", "ATP5F1A", "ENSG000002.2", "ensg000001", "atp5", "INVALID"], genes, aliases);
  assert.deepEqual(result.ids, ["ENSG000002.2", "ENSG000001.1"]);
  assert.equal(result.duplicates, 2);
  assert.deepEqual(result.unresolved, ["atp5", "INVALID"]);
});

test("duplicate source symbols, alias collisions and versionless ambiguities are reported without guessing", () => {
  const result = resolveCollectionIdentifiers(["DUP", "ENSG000005", "CS", "ENSG000003.1"], genes, [...aliases, { selected_gene_id: "ENSG000001.1", current_symbol: "CS" }]);
  assert.deepEqual(result.ambiguous.map((row) => row.input), ["DUP", "ENSG000005", "CS"]);
  assert.deepEqual(result.ids, ["ENSG000003.1"]);
  assert.equal(result.ambiguous[0].candidates.length, 2);
});

test("collection exports preserve exact IDs and dataset provenance without synthetic enrichment", () => {
  const collection = { id: "local", name: "Selected\tgenes", genes: ["ENSG000001.1", "ENSG000002.2"] };
  const doc = collectionDocument(collection);
  assert.equal(doc.dataset.doi, "10.5281/zenodo.23283595");
  assert.deepEqual(doc.collection.genes, collection.genes);
  doc.collection.genes.push("OTHER");
  assert.equal(collection.genes.length, 2);
  assert.equal(collectionGMT(collection), "Selected genes\thttps://doi.org/10.5281/zenodo.23283595\tENSG000001.1\tENSG000002.2\n");
});
