import test from "node:test";
import assert from "node:assert/strict";
import {
  createNotebook,
  validateWorkspace,
  notebookSchema,
} from "../src/components/r-notebooks.js";

test("notebook recovery preserves explicit code without executing it", () => {
  const book = createNotebook(
    "Research notes",
    "stop('must not execute while restoring')",
  );
  const restored = validateWorkspace({
    schema: notebookSchema,
    active: book.id,
    notebooks: [book],
  });
  assert.equal(
    restored.notebooks[0].cells[0].source,
    "stop('must not execute while restoring')",
  );
  assert.equal(restored.active, book.id);
  assert.notEqual(restored.notebooks, [book]);
});
test("notebook imports reject unsupported cells, excessive code and duplicate identity", () => {
  const book = createNotebook();
  const wrap = (notebooks) => ({ schema: notebookSchema, notebooks });
  assert.throws(() =>
    validateWorkspace(
      wrap([{ ...book, cells: [{ kind: "html", source: "<script>" }] }]),
    ),
  );
  assert.throws(() =>
    validateWorkspace(
      wrap([{ ...book, cells: [{ kind: "code", source: "x".repeat(65537) }] }]),
    ),
  );
  assert.throws(() => validateWorkspace(wrap([book, book])), /unique/);
  assert.throws(
    () =>
      validateWorkspace(
        wrap([{ ...book, cells: [book.cells[0], book.cells[0]] }]),
      ),
    /unique/,
  );
});
test("history is bounded and missing active book recovers safely", () => {
  const book = createNotebook();
  book.cells[0].runs = Array.from({ length: 25 }, (_, index) => ({ index }));
  const restored = validateWorkspace({
    schema: notebookSchema,
    active: "missing",
    notebooks: [book],
  });
  assert.equal(restored.active, book.id);
  assert.equal(restored.notebooks[0].cells[0].runs.length, 20);
  assert.equal(restored.notebooks[0].cells[0].runs[0].index, 5);
});

import { buildResearchRecipe } from "../src/components/r-recipe-builder.js";
test("recipe builder retains archive contrast and escapes source identifiers", () => {
  const code = buildResearchRecipe({
    recipe: "gene",
    gene: 'ABC"; stop("injection") #',
  });
  assert.ok(code.includes('gene_symbol <- "ABC\\"; stop(\\"injection\\") #"'));
  const volcano = buildResearchRecipe({
    recipe: "volcano",
    contrast: "day3_vs_control",
    alpha: 0.1,
  });
  assert.ok(volcano.includes('contrast_id <- "day3_vs_control"'));
  assert.ok(volcano.includes("fdr_threshold <- 0.1"));
  assert.throws(() => buildResearchRecipe({ recipe: "volcano", alpha: -1 }));
  assert.throws(() =>
    buildResearchRecipe({ recipe: "gene", contrast: "synthetic" }),
  );
});
test("power recipe states its hypothetical independent-unit assumptions", () => {
  const code = buildResearchRecipe({
    recipe: "power",
    effect: 0.8,
    alpha: 0.05,
  });
  assert.match(code, /Hypothetical design/);
  assert.match(code, /ignores donor\/block dependence/);
  assert.match(code, /standardized_effect <- 0.8/);
  assert.throws(() => buildResearchRecipe({ recipe: "power", effect: 0 }));
});
