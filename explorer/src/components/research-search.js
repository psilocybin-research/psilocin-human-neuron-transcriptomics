import { geneSuggestions } from "./gene-search-data.js";

// Exact source IDs remain distinct, including genes sharing a symbol. No remote
// queries or inferred aliases are used. Searches never execute analysis code.
export function researchSuggestions({ genes = [], aliases = [], pathways = [], tabs = [], actions = [], query = "" }) {
  const q = query.trim().toLowerCase();
  const matches = text => !q || q.split(/\s+/).every(word => text.toLowerCase().includes(word));
  const result = [];
  for (const [id, title] of tabs) {
    if (matches(`${title} ${id}`)) result.push({ id: `view:${id}`, text: `${title} · Workspace`, kind: "view", target: id });
  }
  for (const action of actions) {
    if (matches(action.title)) result.push({ id: `action:${action.id}`, text: `${action.title} · Action`, kind: "action", target: action.id });
  }
  const seen = new Set();
  for (const row of pathways) {
    if (!row.pathway || seen.has(row.pathway)) continue;
    seen.add(row.pathway);
    const title = row.pathway.replace(/_/g, " ");
    if (q && matches(title)) result.push({ id: `pathway:${row.pathway}`, text: `${title} · Pathway`, kind: "pathway", target: row.pathway });
  }
  const geneMatches = q ? geneSuggestions(genes, aliases, query).map(g => ({
    id: `gene:${g.id}`, text: `${g.symbol} · ${g.id}${g.aliases.length ? ` · ${g.aliases.join(", ")}` : ""}`,
    kind: "gene", target: g.id,
  })) : [];
  // Gene exact matches remain first; grouping is stable and results are bounded.
  return [...geneMatches, ...result].slice(0, 60);
}
