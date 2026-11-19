// Versioned interchange contract. Coordinates retain their input units; no biological layout is inferred.
export const SCIENTIFIC_SCENE_SCHEMA = "psilocin-atlas/scientific-scene/1";
export const MAX_SCENE_POINTS = 50000;
const classifications = new Set(["user-exploratory", "user-imported", "archived", "illustrative"]);
const plain = (value) => value && typeof value === "object" && !Array.isArray(value);
const short = (value, name, limit = 240) => {
  if (typeof value !== "string" || !value.trim() || value.length > limit || /[\u0000-\u001f]/.test(value)) throw new Error(`${name} must be a nonempty, bounded text value.`);
  return value;
};
const numeric = (value, name) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${name} must contain finite numbers; missing or nonnumeric values are not silently removed.`);
  return value;
};
export function validateSceneSpec(input) {
  if (!plain(input) || input.schema !== SCIENTIFIC_SCENE_SCHEMA) throw new Error("Unsupported scientific scene schema.");
  if (!classifications.has(input.classification)) throw new Error("Scene classification is required.");
  if (!plain(input.source)) throw new Error("Scene source metadata is required.");
  const source = { label: short(input.source.label, "Source label") };
  for (const name of ["sha256", "code_sha256"]) if (input.source[name] !== undefined) {
    if (!/^[a-f0-9]{64}$/.test(input.source[name])) throw new Error(`Invalid ${name}.`);
    source[name] = input.source[name];
  }
  for (const name of ["run_utc", "archive_doi", "file"]) if (input.source[name] !== undefined) source[name] = short(input.source[name], name);
  const spec = {schema: SCIENTIFIC_SCENE_SCHEMA, kind: input.kind, classification: input.classification, title: short(input.title, "Scene title"), source};
  if (input.kind === "structure-reference") {
    spec.gene = short(input.gene, "Gene identifier", 100);
    return spec;
  }
  if (!["scatter3d", "schematic", "membership-overlay"].includes(input.kind)) throw new Error("Unsupported scene kind; geometry must be explicitly supplied.");
  if (!Array.isArray(input.data) || !input.data.length || input.data.length > MAX_SCENE_POINTS) throw new Error(`Scene requires 1–${MAX_SCENE_POINTS} rows.`);
  const ids = new Set();
  spec.data = input.data.map((row) => {
    if (!plain(row)) throw new Error("Each scene row must be an object.");
    const id = short(row.id, "Row identifier", 200);
    if (ids.has(id)) throw new Error(`Duplicate scene identifier: ${id}`);
    ids.add(id);
    const out = {id};
    if (row.label !== undefined) out.label = short(row.label, "Row label");
    for (const key of ["scatter3d", "schematic"].includes(input.kind) ? ["x", "y", "z"] : ["value"]) out[key] = numeric(row[key], key);
    if (input.kind === "schematic") {
      out.node_type = short(row.node_type, "Node type", 80);
      if (row.evidence !== undefined) out.evidence = short(row.evidence, "Node evidence", 500);
    }
    if (row.color !== undefined) out.color = numeric(row.color, "color");
    return out;
  });
  if (["scatter3d", "schematic"].includes(input.kind)) {
    if (!plain(input.axes)) throw new Error("Scatter scenes require axis names and units.");
    spec.axes = Object.fromEntries(["x", "y", "z"].map((key) => [key, short(input.axes[key], `${key} axis`)]));
    if (input.color_label !== undefined) spec.color_label = short(input.color_label, "Colour label");
    if (input.kind === "scatter3d" && spec.data.some((r) => r.color !== undefined) && spec.data.some((r) => r.color === undefined)) throw new Error("Colour values must be present for every row or omitted for every row.");
  } else spec.value_label = short(input.value_label, "Overlay value label");
  if (input.kind === "schematic") {
    if (input.layout_semantics !== "illustrative-not-spatial-evidence") throw new Error("Schematics require explicit illustrative layout semantics.");
    spec.layout_semantics = input.layout_semantics;
    spec.caption = short(input.caption, "Schematic interpretation", 1200);
    if (!Array.isArray(input.edges) || input.edges.length > 100000) throw new Error("Schematic requires at most 100000 typed edges.");
    const keys = new Set();
    spec.edges = input.edges.map(edge => {
      if (!plain(edge) || !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) throw new Error("Schematic edge endpoints must identify two existing nodes.");
      if (!["membership", "curated-complex", "navigation"].includes(edge.relation)) throw new Error("Unsupported schematic relation; interactions are not inferred.");
      const key = JSON.stringify([edge.source, edge.target, edge.relation]);
      if (keys.has(key)) throw new Error("Duplicate schematic edge.");
      keys.add(key);
      return {source: edge.source, target: edge.target, relation: edge.relation, evidence: short(edge.evidence, "Edge evidence", 500)};
    });
    if (input.color_limit !== undefined) {
      spec.color_limit = numeric(input.color_limit, "Colour scale limit");
      if (spec.color_limit <= 0 || spec.data.some(row => Math.abs(row.color ?? 0) > spec.color_limit)) throw new Error("Colour scale must include all supplied values.");
    }
  }
  if (input.camera !== undefined) {
    if (!plain(input.camera)) throw new Error("Invalid scene camera.");
    spec.camera = {};
    for (const name of ["position", "target", "up"]) {
      const vector = input.camera[name];
      if (!Array.isArray(vector) || vector.length !== 3) throw new Error(`Invalid camera ${name}.`);
      spec.camera[name] = vector.map((v) => numeric(v, `camera ${name}`));
    }
    spec.camera.fov = numeric(input.camera.fov, "camera fov");
    if (spec.camera.fov < 5 || spec.camera.fov > 120) throw new Error("Camera field of view must be 5–120 degrees.");
    if (Math.hypot(...spec.camera.up) === 0 || spec.camera.position.every((n, i) => n === spec.camera.target[i])) throw new Error("Degenerate camera orientation.");
  }
  return spec;
}
export function sceneCoordinates(input) {
  const spec = validateSceneSpec(input);
  if (!["scatter3d", "schematic"].includes(spec.kind)) throw new Error("Scatter coordinates required.");
  const domains = Object.fromEntries(["x", "y", "z"].map((key) => {
    let lo = Infinity, hi = -Infinity;
    for (const row of spec.data) {lo = Math.min(lo, row[key]); hi = Math.max(hi, row[key]);}
    return [key, [lo, hi]];
  }));
  // Independent linear axes. Use half-scaled endpoints to avoid overflow for finite extremes.
  const positions = new Float32Array(spec.data.length * 3);
  spec.data.forEach((row, i) => ["x", "y", "z"].forEach((key, j) => {
    const [lo, hi] = domains[key];
    positions[i * 3 + j] = hi === lo ? 0 : (Number.isFinite(hi - lo) ? (row[key] - lo) / (hi - lo) : (row[key] / 2 - lo / 2) / (hi / 2 - lo / 2)) * 2 - 1;
  }));
  return {positions, domains};
}
export function sceneCSV(input) {
  const spec = validateSceneSpec(input);
  if (!spec.data) throw new Error("This scene has no numerical table.");
  const columns = ["scatter3d", "schematic"].includes(spec.kind) ? ["id", "label", ...(spec.kind === "schematic" ? ["node_type", "evidence"] : []), "x", "y", "z", ...(spec.data.some(row => row.color !== undefined) ? ["color"] : [])] : ["id", "label", "value"];
  const quote = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [columns.map(quote).join(","), ...spec.data.map((r) => columns.map((c) => quote(r[c])).join(","))].join("\n") + "\n";
}

export function sceneEdgesCSV(input) {
  const spec = validateSceneSpec(input);
  if (spec.kind !== "schematic") throw new Error("Typed schematic edges required.");
  const columns = ["source", "target", "relation", "evidence"], quote = value => `"${String(value).replaceAll('"', '""')}"`;
  return [columns.map(quote).join(","), ...spec.edges.map(edge => columns.map(key => quote(edge[key])).join(","))].join("\n") + "\n";
}
