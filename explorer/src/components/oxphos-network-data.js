// Literal bipartite membership only. Spatial coordinates are display assignments.
export function buildOxphosNetwork(data, genes, annotations) {
  if (
    data.landscape.length !== 113 ||
    new Set(data.landscape.map((r) => r.gene)).size !== 113
  )
    throw Error("Expected the archived 113-gene OXPHOS union.");
  const mapping = new Map(annotations.genes.map((row) => [row.symbol, row]));
  const buckets = new Map();
  const nodes = data.landscape.map((row) => {
    const annotation = mapping.get(row.gene);
    const matches = genes.filter((g) => g.symbol === row.gene && g.selected);
    if (
      !annotation ||
      matches.length !== 1 ||
      matches[0].id !== annotation.gene_id
    )
      throw Error(`Unresolved archived identity: ${row.gene}`);
    const g = matches[0],
      group = annotation.complex || "other";
    if (!buckets.has(group)) buckets.set(group, []);
    const node = {
      id: g.id,
      type: "gene",
      symbol: g.symbol,
      complex: annotation.complex,
      displayGroup: row.functional_group,
      leadingEdge: row.leading_edge,
      effects: g.effects,
      proteins: annotation.proteins,
      basis: annotation.basis,
    };
    buckets.get(group).push(node);
    return node;
  });
  const groups = [];
  for (const [i, key] of ["I", "II", "III", "IV", "V", "other"].entries()) {
    const members = (buckets.get(key) || []).sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    );
    if (!members.length) continue; // Never invent a complex V node or missing genes.
    const angle = (i * 2 * Math.PI) / 6,
      cx = 165 * Math.cos(angle),
      cy = 125 * Math.sin(angle);
    groups.push({ key, x: cx, y: cy, z: 65, count: members.length });
    members.forEach((n, j) => {
      const a = j * Math.PI * (3 - Math.sqrt(5)),
        radius = 12 + 46 * Math.sqrt((j + 0.5) / members.length);
      const position = {
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
        z: 45 + (j % 5) * 9,
      };
      Object.assign(n, position, {
        fx: position.x,
        fy: position.y,
        fz: position.z,
      });
    });
  }
  const links = [];
  const rows = data.pathways.filter((r) => r.contrast === data.contrasts[0]);
  const pathways = [];
  for (const row of rows) {
    const symbols = new Set(data.membership[row.pathway] || []);
    const members = nodes.filter((n) => symbols.has(n.symbol));
    if (!members.length) continue;
    const id = `pathway:${row.pathway}`;
    pathways.push({
      id,
      type: "pathway",
      pathway: row.pathway,
      tier: row.tier,
      members: members.length,
    });
    for (const n of members)
      links.push({
        source: n.id,
        target: id,
        relation: "archived annotated gene-set membership",
      });
  }
  pathways
    .sort((a, b) => a.pathway.localeCompare(b.pathway))
    .forEach((n, i) => {
      const a = (i * 2 * Math.PI) / pathways.length,
        p = { x: 225 * Math.cos(a), y: 175 * Math.sin(a), z: -120 };
      Object.assign(n, p, { fx: p.x, fy: p.y, fz: p.z });
    });
  const effects = nodes
    .flatMap((n) => n.effects.slice(0, 2).map((e) => e?.log2FoldChange))
    .filter(Number.isFinite);
  const limit = Math.max(
    1,
    Math.ceil(Math.max(...effects.map(Math.abs)) * 2) / 2,
  );
  return { nodes: [...nodes, ...pathways], links, groups, limit, annotations };
}
