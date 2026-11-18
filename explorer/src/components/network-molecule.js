import { confidenceColor } from "./protein-data.js";
// Render only supplied Cα coordinates. Lines are a trace, not inferred chemical bonds.
export function createSceneBackbone(
  api,
  atoms,
  { predicted = false, mapping = [] } = {},
) {
  const seen = new Set();
  const residues = atoms.filter((a) => {
    const key = `${a.chain}:${a.resi}:${a.icode || ""}`;
    if (
      a.atom !== "CA" ||
      a.hetflag ||
      ![a.x, a.y, a.z].every(Number.isFinite) ||
      seen.has(key)
    )
      return false;
    seen.add(key);
    return true;
  });
  if (!residues.length)
    throw new Error("No Cα coordinates are available for this model.");
  const group = new api.Group(),
    resources = [];
  const minimum = { x: Infinity, y: Infinity, z: Infinity },
    maximum = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const a of residues)
    for (const k of ["x", "y", "z"]) {
      minimum[k] = Math.min(minimum[k], a[k]);
      maximum[k] = Math.max(maximum[k], a[k]);
    }
  const centre = new api.Vector3(
    ...["x", "y", "z"].map((k) => (minimum[k] + maximum[k]) / 2),
  );
  const span = Math.max(
      ...["x", "y", "z"].map((k) => maximum[k] - minimum[k]),
      1,
    ),
    scale = 220 / span;
  const positions = [],
    colours = [];
  const colors = residues.map(
    (a, i) =>
      new api.Color(
        predicted
          ? confidenceColor(a.b)
          : `hsl(${Math.round(220 - (i * 180) / Math.max(1, residues.length - 1))},65%,55%)`,
      ),
  );
  for (let i = 1; i < residues.length; i++) {
    const a = residues[i - 1],
      b = residues[i],
      distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    const consecutive =
      b.resi === a.resi + 1 || (b.resi === a.resi && a.icode !== b.icode);
    if (a.chain !== b.chain || !consecutive || distance > 4.5 || distance < 2.5)
      continue;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    colours.push(...colors[i - 1].toArray(), ...colors[i].toArray());
  }
  const segmentCount = positions.length / 6;
  const tubeGeometry = new api.CylinderGeometry(1, 1, 1, 8),
    tubeMaterial = new api.MeshStandardMaterial({
      roughness: 0.4,
      metalness: 0.05,
    });
  const trace = new api.InstancedMesh(tubeGeometry, tubeMaterial, segmentCount);
  const up = new api.Vector3(0, 1, 0),
    transform = new api.Matrix4();
  for (let i = 0; i < segmentCount; i++) {
    const offset = i * 6,
      a = new api.Vector3(...positions.slice(offset, offset + 3)),
      b = new api.Vector3(...positions.slice(offset + 3, offset + 6));
    const direction = b.clone().sub(a),
      length = direction.length(),
      mid = a.clone().add(b).multiplyScalar(0.5);
    const rotation = new api.Quaternion().setFromUnitVectors(
      up,
      direction.normalize(),
    );
    transform.compose(mid, rotation, new api.Vector3(0.18, length, 0.18));
    trace.setMatrixAt(i, transform);
    trace.setColorAt(i, new api.Color().fromArray(colours, i * 6));
  }
  resources.push(tubeGeometry, tubeMaterial);
  const sphere = new api.SphereGeometry(0.8, 12, 8),
    surface = new api.MeshStandardMaterial({
      roughness: 0.35,
      metalness: 0.05,
    });
  const beads = new api.InstancedMesh(sphere, surface, residues.length),
    matrix = new api.Matrix4();
  residues.forEach((a, i) => {
    matrix.makeTranslation(a.x, a.y, a.z);
    beads.setMatrixAt(i, matrix);
    beads.setColorAt(i, colors[i]);
  });
  const model = new api.Group();
  model.position.copy(centre).multiplyScalar(-scale);
  model.scale.setScalar(scale);
  model.add(trace, beads);
  group.add(model);
  group.add(new api.AmbientLight(0xffffff, 1.2));
  const light = new api.DirectionalLight(0xffffff, 2.2);
  light.position.set(100, 150, 250);
  group.add(light);
  resources.push(sphere, surface);
  const index = new Map(
    residues.map((a, i) => [`${a.chain}:${a.resi}:${a.icode || ""}`, i]),
  );
  return {
    group,
    count: residues.length,
    setBeads(visible) {
      beads.visible = visible;
    },
    highlight(start, end) {
      residues.forEach((a, i) => beads.setColorAt(i, colors[i]));
      let count = 0;
      for (const r of mapping.filter(
        (r) => r.position >= start && r.position <= end,
      )) {
        const i = index.get(`${r.chain}:${r.resi}:${r.icode || ""}`);
        if (i !== undefined) {
          beads.setColorAt(i, new api.Color("#f0ba47"));
          count++;
        }
      }
      beads.instanceColor.needsUpdate = true;
      return count;
    },
    dispose() {
      resources.forEach((r) => r.dispose());
      group.clear();
    },
  };
}
