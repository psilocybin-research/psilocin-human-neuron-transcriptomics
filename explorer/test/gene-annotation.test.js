import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createAnnotationClient,
  ensemblIdentity,
  validateAnnotation,
} from "../src/components/gene-annotation-data.js";
import { createGeneRecords } from "../src/components/gene-records.js";
const id = "ENSG00000167468.12";
const record = {
  id: "ENSG00000167468",
  species: "homo_sapiens",
  object_type: "Gene",
  version: 18,
  display_name: "GPX4",
  description: "Glutathione peroxidase 4",
  start: 1106616,
  end: 1109490,
  seq_region_name: "19",
  strand: 1,
  assembly_name: "GRCh38",
  biotype: "protein_coding",
};
test("gene annotation validates human stable ID independently of archived version", () => {
  assert.deepEqual(ensemblIdentity(id), {
    stableId: record.id,
    archivedVersion: 12,
  });
  assert.throws(() => ensemblIdentity("GPX4"));
  for (const change of [
    { id: "ENSG00000123456" },
    { species: "mus_musculus" },
    { object_type: "Transcript" },
  ])
    assert.throws(() =>
      validateAnnotation({ ...record, ...change }, ensemblIdentity(id)),
    );
  assert.equal(validateAnnotation(record, ensemblIdentity(id)).version, 18);
});
test("annotation client deduplicates session requests, omits credentials and preserves provenance", async () => {
  let calls = 0;
  const client = createAnnotationClient({
    fetcher: async (url, options) => {
      calls++;
      assert.ok(url.includes(record.id));
      assert.equal(options.credentials, "omit");
      return { ok: true, json: async () => record };
    },
    now: () => new Date("2026-11-17T12:00:00Z"),
  });
  const [a, b] = await Promise.all([
    client.lookup(id),
    client.lookup(record.id),
  ]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(a.retrievedAt, "2026-11-17T12:00:00.000Z");
  assert.equal(
    a.source,
    `https://rest.ensembl.org/lookup/id/${record.id}?content-type=application/json`,
  );
});
test("provider mismatch and unavailable IDs remain retryable", async () => {
  let calls = 0;
  const client = createAnnotationClient({
    fetcher: async () =>
      ++calls === 1
        ? { ok: false, status: 404 }
        : { ok: true, json: async () => record },
  });
  await assert.rejects(client.lookup(id), /not available/);
  assert.equal((await client.lookup(id)).id, record.id);
  assert.equal(calls, 2);
});
test("annotation requests time out and can be retried", async () => {
  const client = createAnnotationClient({
    timeout: 5,
    fetcher: async (url, { signal }) =>
      new Promise((resolve, reject) =>
        signal.addEventListener("abort", () =>
          reject(Object.assign(new Error(), { name: "AbortError" })),
        ),
      ),
  });
  await assert.rejects(client.lookup(id), /in time/);
});
test("gene resolution keeps exact IDs and source-symbol representatives ahead of aliases", () => {
  const genes = [
    { id: "E1.1", symbol: "OLD", selected: false },
    { id: "E1.2", symbol: "OLD", selected: true },
    { id: "E2", symbol: "NEW", selected: true },
  ];
  const records = createGeneRecords(genes, [
    { current_symbol: "NEW", source_symbol: "OLD", selected_gene_id: "E1.2" },
  ]);
  assert.equal(records.resolve("E1.1"), genes[0]);
  assert.equal(records.resolve("OLD"), genes[1]);
  assert.equal(records.resolve("NEW"), genes[2]);
  assert.equal(records.aliasFor(genes[0]), undefined);
  assert.equal(records.aliasFor(genes[1]).selected_gene_id, "E1.2");
  assert.equal(records.resolve("missing"), undefined);
});
