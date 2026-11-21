// Identity and coverage rules shared by the annotation card, schematic and pilot.
export const stableGeneId = (id) => String(id).replace(/\.\d+$/, "");
export function mitochondrialEntries(snapshot, gene) {
  const id = stableGeneId(gene.id);
  return snapshot.entries.filter((entry) => entry.ensembl.includes(id));
}
export function complexMembers(snapshot, complex, role) {
  return snapshot.entries.filter((entry) => entry.roles.some((r) =>
    r.complex === complex && (!role || r.role === role),
  ));
}
export function archivedGene(entry, genes) {
  if (entry.archivedIds.length !== 1) return null;
  return genes.find((gene) => gene.id === entry.archivedIds[0]) || null;
}
export function hasEstimate(effect) {
  return typeof effect?.log2FoldChange === "number" && Number.isFinite(effect.log2FoldChange);
}
export function coverage(entries, genes, contrast = 0) {
  const result = { curated: entries.length, estimated: 0, nonestimable: 0, absent: 0, ambiguous: 0 };
  for (const entry of entries) {
    if (entry.archivedIds.length > 1) result.ambiguous++;
    else {
      const gene = archivedGene(entry, genes);
      if (!gene) result.absent++;
      else if (hasEstimate(gene.effects[contrast])) result.estimated++;
      else result.nonestimable++;
    }
  }
  return result;
}
