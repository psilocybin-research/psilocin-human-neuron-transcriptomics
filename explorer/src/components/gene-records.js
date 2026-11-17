// Exact archived identifiers take precedence over source symbols and verified aliases.
export function createGeneRecords(genes, aliases) {
  const byId = new Map(genes.map((gene) => [gene.id, gene]));
  const bySymbol = new Map();
  for (const gene of genes) {
    if (!bySymbol.has(gene.symbol) || gene.selected)
      bySymbol.set(gene.symbol, gene);
  }
  const byAlias = new Map();
  const aliasById = new Map();
  for (const alias of aliases) {
    const gene = byId.get(alias.selected_gene_id);
    if (!gene) continue;
    aliasById.set(gene.id, alias);
    for (const name of [alias.current_symbol, alias.source_symbol]) {
      if (name) byAlias.set(name, gene);
    }
  }
  return {
    resolve(identifier) {
      return (
        byId.get(identifier) ||
        bySymbol.get(identifier) ||
        byAlias.get(identifier)
      );
    },
    aliasFor(gene) {
      return aliasById.get(gene.id);
    },
  };
}
