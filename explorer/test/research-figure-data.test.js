import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { figureRows, figureSpecification, figureAxisLimit, validateFigureOptions } from "../src/components/research-figure-data.js";
const load = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url)));
const data = load("atlas"), genes = load("genes"), provenance = load("provenance");

test("figure scatter retains the exact archived 113-gene union with shared symmetric limits", () => {
  const rows = figureRows(data, genes);
  assert.equal(rows.length, 113);
  assert.equal(new Set(rows.map((row) => row.gene)).size, 113);
  for (const row of rows) {
    const source = data.landscape.find((gene) => gene.gene === row.gene);
    assert.equal(row.day1_log2fc, source.day1_log2fc);
    assert.equal(row.day3_log2fc, source.day3_log2fc);
    assert.ok(Math.abs(row.day1_log2fc) < figureAxisLimit(data));
    assert.ok(Math.abs(row.day3_log2fc) < figureAxisLimit(data));
  }
});

test("interval exports preserve archived FDR and use only the exact 1.96 SE transformation", () => {
  const source = genes.find((row) => row.symbol === "GPX4" && row.selected);
  const spec = figureSpecification(data, genes, provenance, { mode: "intervals", gene: "GPX4" });
  assert.equal(spec.rows.length, 3);
  spec.rows.forEach((row, index) => {
    const effect = source.effects[index];
    assert.equal(row.log2FoldChange, effect.log2FoldChange);
    assert.equal(row.gene_fdr, effect.padj);
    assert.equal(row.lower_wald_95, effect.log2FoldChange - 1.96 * effect.lfcSE);
    assert.equal(row.upper_wald_95, effect.log2FoldChange + 1.96 * effect.lfcSE);
  });
  assert.ok(spec.sources.every((source) => /^[a-f0-9]{64}$/.test(source.sha256)));
  assert.match(spec.caveat, /prevent a treatment-by-time/);
});

test("expression figures retain block identifiers and aggregated library counts", () => {
  const rows = figureRows(data, genes, { mode: "profiles", gene: "NDUFB7" });
  assert.deepEqual(rows, data.profiles.filter((row) => row.gene === "NDUFB7"));
  assert.equal(rows.length, 9);
  assert.equal(new Set(rows.map((row) => row.block)).size, 3);
  assert.throws(() => figureRows(data, genes, { mode: "profiles", gene: "NOT_IN_THE_UNION" }));
});

test("figure specifications are declarative, bounded and retain rows through JSON serialization", () => {
  assert.throws(() => validateFigureOptions({ mode: "arbitrary-code" }));
  assert.equal(validateFigureOptions({ width: Infinity }).width, 760);
  assert.equal(validateFigureOptions({ width: 100000 }).width, 1600);
  const spec = figureSpecification(data, genes, provenance, { mode: "scatter" });
  assert.deepEqual(JSON.parse(JSON.stringify(spec)), spec);
  assert.equal(spec.encodings.axis_domain[0], -spec.encodings.axis_domain[1]);
});

test('portable Plot source carries full numerical data, pinned renderer and qualifications', async () => {
 const {figurePlotModule} = await import('../src/components/research-figure-data.js');
 for (const mode of ['scatter','intervals','profiles']) {
   const spec=figureSpecification(data,genes,provenance,{mode,gene:'GPX4'});
   const source=figurePlotModule(spec);
   const embedded=JSON.parse(source.split('export const spec = ')[1].split(';\nexport const figure')[0]);
   assert.deepEqual(embedded.rows,spec.rows);
   assert.deepEqual(embedded.sources,spec.sources);
   assert.equal(embedded.renderer.version,'0.6.19');
   assert.match(embedded.caveat,/not nine independent/);
 }
});
