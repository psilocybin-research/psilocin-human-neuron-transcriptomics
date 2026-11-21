import test from "node:test";
import assert from "node:assert/strict";
import {
  molecularRNAExport,
  molecularCSV,
} from "../src/components/molecular-export.js";

test("molecular RNA exports deduplicate repeated chains and retain missing estimates", () => {
  const gene = {
    id: "ENSG1",
    symbol: "GENE1",
    effects: [
      { log2FoldChange: 1, lfcSE: 0.5, padj: 0.02 },
      { log2FoldChange: null, lfcSE: NaN, padj: undefined },
    ],
  };
  const rows = molecularRNAExport(
    [{ author: "A" }, { author: "B" }, { author: "unmapped" }],
    (chain) => (chain.author === "unmapped" ? null : gene),
    "https://example.org/#view=mitocarta",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].author_chains, "A;B");
  assert.equal(rows[0].approximate_95_wald_lower, 1 - 1.96 * 0.5);
  assert.equal(rows[1].rna_log2_fold_change, null);
  assert.equal(rows[1].approximate_95_wald_lower, null);
  assert.equal(rows[1].gene_fdr, null);
  assert.equal(rows[0].source_url, "https://example.org/#view=mitocarta");
});
test("molecular CSV escapes identifiers and rejects empty datasets", () => {
  assert.equal(
    molecularCSV([{ symbol: 'A"B', missing: null }]),
    '"symbol","missing"\r\n"A""B",\r\n',
  );
  assert.throws(() => molecularCSV([]), /No mapped RNA/);
});
