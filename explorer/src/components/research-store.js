// Research selections only: this store never contains or executes analysis code.
export const RESEARCH_DATASET = Object.freeze({
  version: "v1.2.0",
  doi: "10.5281/zenodo.23283595",
});
const SCHEMA_VERSION = 1;
const HISTORY_LIMIT = 50;
const SELECTION_KEYS = ["gene", "pathway", "contrast", "view"];
const DEFAULT_STATE = { gene: null, pathway: null, contrast: null, view: null, collections: [] };

function identifier(value, limit = 200) {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value.trim() || null;
}

function collections(value) {
  if (!Array.isArray(value) || value.length > 20) return undefined;
  const ids = new Set();
  const result = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return undefined;
    const id = identifier(item.id, 80);
    const name = identifier(item.name, 120);
    if (!id || !name || ids.has(id) || !Array.isArray(item.genes) || item.genes.length > 500) return undefined;
    const genes = item.genes.map((gene) => identifier(gene));
    if (genes.some((gene) => !gene)) return undefined;
    ids.add(id);
    result.push(Object.freeze({ id, name, genes: Object.freeze([...new Set(genes)]) }));
  }
  return Object.freeze(result);
}

function normalize(patch, base = DEFAULT_STATE) {
  const next = { ...base };
  if (patch && typeof patch === "object" && !Array.isArray(patch)) {
    for (const key of SELECTION_KEYS) {
      if (!Object.hasOwn(patch, key)) continue;
      const value = identifier(patch[key]);
      if (value !== undefined) next[key] = value;
    }
    if (Object.hasOwn(patch, "collections")) {
      const value = collections(patch.collections);
      if (value !== undefined) next.collections = value;
    }
  }
  if (!Object.isFrozen(next.collections)) next.collections = Object.freeze([]);
  return Object.freeze(next);
}

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Small synchronous shared selection store. All snapshots are deeply immutable.
 * Storage is optional; unavailable/quota-limited storage never blocks selection.
 * At most 50 undo steps, 20 collections and 500 genes per collection are retained.
 * Defaults establish the baseline; restored values override defaults, and initial
 * values override restored values, allowing explicit URL state to take precedence.
 */
export function createResearchStore({ defaults, initial, persistenceKey = "psilocin-research-session-v1", storage } = {}) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  let state = normalize(defaults);
  let past = [];
  let future = [];
  let restored = false;
  const listeners = new Set();
  try {
    const raw = storage?.getItem(persistenceKey);
    // Bound parsing work, including manually altered browser storage.
    const saved = typeof raw === "string" && raw.length <= 2_000_000 ? JSON.parse(raw) : null;
    if (saved?.schemaVersion === SCHEMA_VERSION && saved.dataset?.doi === RESEARCH_DATASET.doi && saved.dataset?.version === RESEARCH_DATASET.version) {
      restored = true;
      state = normalize(saved.state, state);
      if (Array.isArray(saved.history?.past)) past = saved.history.past.slice(-HISTORY_LIMIT).map((entry) => normalize(entry));
      if (Array.isArray(saved.history?.future)) future = saved.history.future.slice(-HISTORY_LIMIT).map((entry) => normalize(entry));
    }
  } catch { /* A corrupt or inaccessible optional session must not prevent startup. */ }
  if (initial !== undefined) {
    const next = normalize(initial, state);
    if (!equal(next, state)) {
      if (restored) past = [...past, state].slice(-HISTORY_LIMIT);
      future = [];
      state = next;
    }
  }

  function exportSession() {
    // Return an independent, JSON-compatible document, with no private runtime state.
    return JSON.parse(JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      dataset: RESEARCH_DATASET,
      state,
      history: { past, future },
    }));
  }
  function persist() {
    try {
      // Collections are shared in memory but repeated in JSON. Bound history
      // before cloning it, prioritizing the current state over older snapshots.
      let bytes = JSON.stringify(state).length + 200;
      const bounded = entries => {
        const retained = [];
        for (let i = entries.length - 1; i >= 0; i--) {
          const size = JSON.stringify(entries[i]).length;
          if (bytes + size > 1_800_000) break;
          bytes += size; retained.unshift(entries[i]);
        }
        return retained;
      };
      const saved = { schemaVersion: SCHEMA_VERSION, dataset: RESEARCH_DATASET,
        state, history: { past: bounded(past), future: bounded(future) } };
      const serialized = JSON.stringify(saved);
      if (serialized.length <= 2_000_000) storage?.setItem(persistenceKey, serialized);
    } catch { /* Optional storage must never prevent exploration. */ }
  }
  function notify() {
    persist();
    for (const listener of [...listeners]) listener(state);
    return state;
  }
  persist();
  return Object.freeze({
    getState: () => state,
    subscribe(listener, { emitCurrent = false } = {}) {
      if (typeof listener !== "function") throw new TypeError("A research-store listener must be a function.");
      listeners.add(listener);
      if (emitCurrent) listener(state);
      return () => listeners.delete(listener);
    },
    update(patch) {
      const next = normalize(patch, state);
      if (equal(next, state)) return state;
      past = [...past, state].slice(-HISTORY_LIMIT);
      future = [];
      state = next;
      return notify();
    },
    undo() {
      if (!past.length) return state;
      future = [...future, state].slice(-HISTORY_LIMIT);
      state = past.pop();
      return notify();
    },
    redo() {
      if (!future.length) return state;
      past = [...past, state].slice(-HISTORY_LIMIT);
      state = future.pop();
      return notify();
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    exportSession,
  });
}
