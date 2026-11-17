// Search identifiers without inventing aliases or merging distinct source IDs.
export function geneSuggestions(genes, aliases, query, preferred = []) {
  const q = query.trim().toUpperCase();
  const verified = new Map();
  for (const a of aliases) {
    const names = verified.get(a.selected_gene_id) || [];
    names.push(a.current_symbol, a.source_symbol);
    verified.set(a.selected_gene_id, names.filter(Boolean));
  }
  const priority = new Map(preferred.map((id, i) => [id, i]));
  return genes
    .flatMap((g) => {
      const names = [...new Set(verified.get(g.id) || [])];
      const symbol = g.symbol.toUpperCase(),
        id = g.id.toUpperCase();
      if (
        q &&
        ![symbol, id, ...names.map((n) => n.toUpperCase())].some((n) =>
          n.includes(q),
        )
      )
        return [];
      const score = !q
        ? (priority.get(g.id) ?? 1000)
        : symbol === q || id === q
          ? 0
          : names.some((n) => n.toUpperCase() === q)
            ? 1
            : symbol.startsWith(q)
              ? 2
              : id.startsWith(q)
                ? 3
                : 4;
      return [{ ...g, aliases: names.filter((n) => n !== g.symbol), score }];
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        Number(b.selected) - Number(a.selected) ||
        a.symbol.localeCompare(b.symbol) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 20);
}
