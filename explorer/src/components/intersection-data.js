// Exclusive intersections within the selected union: every symbol occurs exactly once.
export function exclusiveIntersections(nodes) {
  const available = nodes.filter((n) => n.available),
    all = [...new Set(available.flatMap((n) => n.symbols))].sort(),
    members = available.map((n) => new Set(n.symbols)),
    groups = new Map();
  for (const symbol of all) {
    const signature = members.map((set) => set.has(symbol));
    const key = signature.map((v) => (v ? "1" : "0")).join("");
    if (!groups.has(key)) groups.set(key, { key, signature, genes: [] });
    groups.get(key).genes.push(symbol);
  }
  return [...groups.values()].sort(
    (a, b) => b.genes.length - a.genes.length || a.key.localeCompare(b.key),
  );
}
