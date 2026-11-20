import Fuse from "fuse.js";

// Archived arrays are immutable. Weak keys let replaced datasets be collected.
const indexes = new WeakMap();
const fuzzyIndexes = new WeakMap();
const limit = 20;
function searchIndex(genes, aliases) {
  let byAliases = indexes.get(genes);
  if (!byAliases) indexes.set(genes, (byAliases = new WeakMap()));
  if (byAliases.has(aliases)) return byAliases.get(aliases);
  const verified = new Map();
  for (const alias of aliases) {
    const names = verified.get(alias.selected_gene_id) || [];
    names.push(alias.current_symbol, alias.source_symbol);
    verified.set(alias.selected_gene_id, names.filter(Boolean));
  }
  const entries = genes.map((gene) => {
    const names = [...new Set(verified.get(gene.id) || [])];
    return {
      gene,
      symbol: gene.symbol.toUpperCase(),
      id: gene.id.toUpperCase(),
      names: names.map((name) => name.toUpperCase()),
      aliases: names.filter((name) => name !== gene.symbol),
    };
  });
  entries.sort(
    (a, b) =>
      Number(b.gene.selected) - Number(a.gene.selected) ||
      a.gene.symbol.localeCompare(b.gene.symbol) ||
      a.gene.id.localeCompare(b.gene.id),
  );
  byAliases.set(aliases, entries);
  return entries;
}

// Search identifiers without inventing aliases or merging distinct source IDs.
export function geneSuggestions(genes, aliases, query, preferred = []) {
  const q = query.trim().toUpperCase();
  const priority = new Map(preferred.map((id, i) => [id, i]));
  const buckets = new Map();
  for (const entry of searchIndex(genes, aliases)) {
    const { gene, symbol, id, names } = entry;
    if (
      q &&
      !symbol.includes(q) &&
      !id.includes(q) &&
      !names.some((name) => name.includes(q))
    )
      continue;
    const score = !q
      ? (priority.get(gene.id) ?? 1000)
      : symbol === q || id === q
        ? 0
        : names.includes(q)
          ? 1
          : symbol.startsWith(q)
            ? 2
            : id.startsWith(q)
              ? 3
              : 4;
    let bucket = buckets.get(score);
    if (!bucket) buckets.set(score, (bucket = []));
    // Entries already have the stable tie order; retain only visible candidates.
    if (bucket.length < limit) bucket.push(entry);
  }
  const results = [];
  for (const score of [...buckets.keys()].sort((a, b) => a - b)) {
    for (const entry of buckets.get(score)) {
      results.push({ ...entry.gene, aliases: [...entry.aliases], score });
      if (results.length === limit) return results;
    }
  }
  return results;
}

// This is deliberately separate from deterministic identifier search. Callers
// opt in, then append only non-exact results after exact matches.
export function fuzzyGeneSuggestions(genes, aliases, query) {
  const q = query.trim();
  if (q.length < 3) return [];
  let byAliases = fuzzyIndexes.get(genes);
  if (!byAliases) fuzzyIndexes.set(genes, (byAliases = new WeakMap()));
  let fuse = byAliases.get(aliases);
  if (!fuse) {
    const verified = new Map();
    for (const alias of aliases) {
      const names = verified.get(alias.selected_gene_id) || [];
      names.push(alias.current_symbol, alias.source_symbol);
      verified.set(alias.selected_gene_id, [...new Set(names.filter(Boolean))]);
    }
    fuse = new Fuse(
      genes.map((gene) => ({ gene, aliases: verified.get(gene.id) || [] })),
      {
        keys: ["gene.symbol", "gene.id", "aliases"],
        includeScore: true,
        threshold: 0.32,
        ignoreLocation: true,
        minMatchCharLength: 3,
        fieldNormWeight: 0.2,
      },
    );
    byAliases.set(aliases, fuse);
  }
  return fuse.search(q, { limit }).map(({ item }) => ({
    ...item.gene,
    aliases: [...item.aliases.filter((name) => name !== item.gene.symbol)],
    fuzzy: true,
  }));
}
