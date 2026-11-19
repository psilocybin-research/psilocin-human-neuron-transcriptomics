import { test } from "node:test";
import assert from "node:assert/strict";
import { createResearchStore, RESEARCH_DATASET } from "../src/components/research-store.js";

function memoryStorage() {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}

test("coordinated updates are immutable, allowlisted and notify once", () => {
  const store = createResearchStore({ storage: null });
  const seen = [];
  const unsubscribe = store.subscribe((state) => seen.push(state));
  const collection = { id: "selection", name: "OXPHOS", genes: ["CS", "CS"] };
  store.update({ gene: " CS ", pathway: "OXPHOS", contrast: "day1_vs_control", view: "pathways", collections: [collection], code: "stop('never run')" });
  assert.equal(seen.length, 1);
  assert.equal(store.getState().gene, "CS");
  assert.equal(store.getState().code, undefined);
  assert.deepEqual(store.getState().collections[0].genes, ["CS"]);
  collection.genes.push("ATP5F1A");
  assert.deepEqual(store.getState().collections[0].genes, ["CS"]);
  assert.throws(() => { store.getState().gene = "OTHER"; }, TypeError);
  assert.throws(() => { store.getState().collections[0].genes.push("OTHER"); }, TypeError);
  store.update({ gene: "CS" });
  assert.equal(seen.length, 1, "no notification or history entry for unchanged state");
  unsubscribe();
  store.update({ gene: "ATP5F1A" });
  assert.equal(seen.length, 1);
});

test("undo/redo restore whole coordinated selections and a new branch clears redo", () => {
  const store = createResearchStore({ initial: { gene: "CS" }, storage: null });
  assert.equal(store.canUndo(), false, "initial selection establishes the history baseline");
  store.update({ gene: "ATP5F1A", pathway: "complex_v" });
  store.undo();
  assert.equal(store.getState().gene, "CS");
  assert.equal(store.getState().pathway, null);
  assert.ok(store.canRedo());
  store.redo();
  assert.equal(store.getState().pathway, "complex_v");
  store.undo();
  store.update({ contrast: "day3_vs_control" });
  assert.equal(store.canRedo(), false);
  assert.equal(store.redo().gene, "CS");
});

test("session restoration preserves selection history and explicit URL selection wins", () => {
  const storage = memoryStorage();
  const first = createResearchStore({ storage });
  first.update({ gene: "CS", contrast: "day1_vs_control" });
  first.update({ gene: "ATP5F1A" });
  first.undo();
  const restored = createResearchStore({ storage });
  assert.equal(restored.getState().gene, "CS");
  assert.ok(restored.canRedo());
  restored.redo();
  assert.equal(restored.getState().gene, "ATP5F1A");
  const withUrl = createResearchStore({ storage, initial: { gene: "NDUFB7" } });
  assert.equal(withUrl.getState().gene, "NDUFB7");
  assert.equal(withUrl.getState().contrast, "day1_vs_control");
  const exported = withUrl.exportSession();
  assert.deepEqual(exported.dataset, RESEARCH_DATASET);
  exported.state.gene = "OTHER";
  assert.equal(withUrl.getState().gene, "NDUFB7");
});

test("corrupt, mismatched or inaccessible storage cannot break research selections", () => {
  for (const raw of ["{bad json", JSON.stringify({ schemaVersion: 1, dataset: { doi: "wrong" }, state: { gene: "untrusted" } })]) {
    const store = createResearchStore({ storage: { getItem: () => raw, setItem() {} } });
    assert.equal(store.getState().gene, null);
  }
  const store = createResearchStore({ storage: { getItem() { throw Error("blocked"); }, setItem() { throw Error("quota"); } } });
  store.update({ gene: "CS" });
  assert.equal(store.getState().gene, "CS");
});

test("invalid values cannot erase valid selection; history remains bounded", () => {
  const store = createResearchStore({ storage: null, initial: { gene: "CS" } });
  store.update({ gene: "x".repeat(201), pathway: "bad\nvalue", collections: [{ id: "bad", name: "Bad", genes: [null] }] });
  assert.equal(store.getState().gene, "CS");
  assert.equal(store.getState().pathway, null);
  assert.deepEqual(store.getState().collections, []);
  for (let i = 0; i < 80; i++) store.update({ gene: `gene-${i}` });
  assert.equal(store.exportSession().history.past.length, 50);
  for (let i = 0; i < 50; i++) store.undo();
  assert.equal(store.canUndo(), false);
  assert.equal(store.getState().gene, "gene-29");
});


test("defaults establish a complete baseline without an empty undo step; saved and URL selections override it", () => {
  const storage = memoryStorage();
  const defaults = { gene: "CS", pathway: "OXPHOS", contrast: "day1_vs_control", view: "overview" };
  const fresh = createResearchStore({ defaults, storage });
  assert.equal(fresh.canUndo(), false);
  assert.equal(fresh.getState().pathway, "OXPHOS");
  fresh.update({ gene: "ATP5F1A" });
  fresh.undo();
  assert.deepEqual(fresh.getState(), { ...defaults, collections: [] });
  assert.equal(fresh.canUndo(), false);
  assert.equal(fresh.canRedo(), true);
  fresh.redo();
  const restored = createResearchStore({ defaults: { ...defaults, gene: "OTHER", contrast: "day3_vs_control" }, storage });
  assert.equal(restored.getState().gene, "ATP5F1A");
  assert.equal(restored.getState().contrast, "day1_vs_control");
  const withURL = createResearchStore({ defaults, initial: { gene: "NDUFB7" }, storage });
  assert.equal(withURL.getState().gene, "NDUFB7");
  assert.equal(withURL.getState().contrast, "day1_vs_control");
  const freshURL = createResearchStore({ defaults, initial: { gene: "NDUFB7" }, storage: null });
  assert.equal(freshURL.canUndo(), false);
  assert.equal(freshURL.getState().pathway, "OXPHOS");
});
