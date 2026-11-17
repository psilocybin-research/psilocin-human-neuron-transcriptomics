import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mappedProteins,
  verifiedModels,
  confidenceColor,
} from "../src/components/protein-data.js";
const stable = "ENSG00000167468";
const record = {
  primaryAccession: "P36969",
  entryType: "UniProtKB reviewed (Swiss-Prot)",
  organism: { taxonId: 9606 },
  sequence: { value: "MAGU", length: 4 },
  entryAudit: { entryVersion: 1, sequenceVersion: 1 },
  uniProtKBCrossReferences: [
    {
      database: "Ensembl",
      id: "ENST00000000001.1",
      properties: [{ key: "GeneId", value: stable + ".20" }],
    },
    {
      database: "PDB",
      id: "2OBI",
      properties: [{ key: "Method", value: "X-ray" }],
    },
  ],
  features: [
    {
      type: "Active site",
      location: {
        start: { value: 4, modifier: "EXACT" },
        end: { value: 4, modifier: "EXACT" },
      },
      evidences: [{ evidenceCode: "ECO:0000250" }],
    },
    {
      type: "Domain",
      location: {
        start: { value: 1, modifier: "EXACT" },
        end: { value: null, modifier: "UNKNOWN" },
      },
    },
  ],
};
test("protein matches require exact human Ensembl cross-reference, not a symbol", () => {
  assert.equal(mappedProteins({ results: [record] }, stable).length, 1);
  assert.equal(
    mappedProteins(
      { results: [{ ...record, organism: { taxonId: 10090 } }] },
      stable,
    ).length,
    0,
  );
  assert.equal(
    mappedProteins({ results: [record] }, "ENSG00000111111").length,
    0,
  );
  assert.equal(
    mappedProteins(
      { results: [{ ...record, uniProtKBCrossReferences: [] }] },
      stable,
    ).length,
    0,
  );
});
test("features preserve exact residue coordinates and evidence; unknown bounds are omitted", () => {
  const [p] = mappedProteins({ results: [record] }, stable);
  assert.equal(p.features.length, 1);
  assert.equal(p.features[0].start, 4);
  assert.equal(p.features[0].end, 4);
  assert.match(p.features[0].evidence, /ECO:0000250/);
  assert.equal(p.pdb[0].id, "2OBI");
  assert.deepEqual(p.geneIds, [stable + ".20"]);
});
test("predicted models require accession, exact full sequence, human taxonomy and provider coordinate URL", () => {
  const p = { accession: "P36969", sequence: "MAGU" };
  const model = {
    uniprotAccession: "P36969",
    taxId: 9606,
    sequence: "MAGU",
    sequenceStart: 1,
    sequenceEnd: 4,
    cifUrl: "https://alphafold.ebi.ac.uk/files/AF-P36969-F1-model_v6.cif",
  };
  assert.equal(verifiedModels([model], p).length, 1);
  for (const change of [
    { uniprotAccession: "P69905" },
    { taxId: 10090 },
    { sequence: "MAGC" },
    { sequenceStart: 2 },
    { sequenceEnd: 3 },
    { isComplex: true },
    { cifUrl: "https://example.com/model.cif" },
  ])
    assert.equal(verifiedModels([{ ...model, ...change }], p).length, 0);
  assert.deepEqual(verifiedModels({}, p), []);
});
test("pLDDT colour thresholds distinguish prediction confidence from absent data", () => {
  assert.equal(confidenceColor(90), "#0053d6");
  assert.equal(confidenceColor(70), "#65cbf3");
  assert.equal(confidenceColor(50), "#ffdb13");
  assert.equal(confidenceColor(49), "#ff7d45");
  assert.equal(confidenceColor(undefined), "#9aa7b1");
  assert.equal(confidenceColor(101), "#9aa7b1");
});
