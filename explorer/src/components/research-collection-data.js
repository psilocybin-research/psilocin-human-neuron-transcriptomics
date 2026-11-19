import { RESEARCH_DATASET } from "./research-store.js";

const HEADER = /^(gene|genes|gene[ _-]?id|ensembl([ _-]?gene)?([ _-]?id)?|symbol|gene[ _-]?symbol|source[ _-]?symbol|id)$/i;
const normalize = (value) => String(value ?? "").trim().toUpperCase();

// RFC 4180-style quoted fields, including embedded delimiters/newlines.
function delimitedRows(text, separator) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (quoted || !field) quoted = !quoted;
      else field += c;
    } else if (!quoted && (c === separator || c === "\n" || c === "\r")) {
      row.push(field.trim()); field = "";
      if (c !== separator) {
        rows.push(row); row = [];
        if (c === "\r" && text[i + 1] === "\n") i++;
      }
    } else field += c;
  }
  if (quoted) throw new Error("The imported table contains an unclosed quoted field.");
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** CSV/TSV import selects a labelled identifier column, otherwise the first column. */
export function parseCollectionInput(text, { filename = "" } = {}) {
  if (typeof text !== "string" || text.length > 1_000_000)
    throw new Error("Use a text file smaller than 1 MB.");
  const source = text.replace(/^\uFEFF/, "").trim();
  if (!source) return [];
  const commaHeader = source.includes(",") && delimitedRows(source, ",")[0].some((value) => HEADER.test(value));
  const table = /\.(csv|tsv)$/i.test(filename) || source.includes("\t") || commaHeader;
  let values;
  if (table) {
    const separator = /\.csv$/i.test(filename) ? "," : /\.tsv$/i.test(filename) || source.includes("\t") ? "\t" : ",";
    const rows = delimitedRows(source, separator).filter((row) => row.some(Boolean));
    const column = rows[0]?.findIndex((value) => HEADER.test(value)) ?? -1;
    values = rows.slice(column >= 0 ? 1 : 0).map((row) => row[column >= 0 ? column : 0]);
  } else {
    values = source.split(/[\s,;]+/);
    if (HEADER.test(values[0])) values.shift();
  }
  const result = values.filter(Boolean);
  if (result.length > 5000) throw new Error("Import at most 5,000 identifiers to prepare a collection of up to 500 unique genes.");
  return result;
}

/** Exact matches only. Ambiguous source symbols and verified aliases are never guessed. */
export function resolveCollectionIdentifiers(identifiers, genes, aliases = []) {
  const byId = new Map(), byName = new Map(), byUnversionedId = new Map();
  function add(map, key, gene) {
    const normalized = normalize(key);
    if (!normalized) return;
    if (!map.has(normalized)) map.set(normalized, new Map());
    map.get(normalized).set(gene.id, gene);
  }
  for (const gene of genes) {
    byId.set(normalize(gene.id), gene);
    add(byName, gene.symbol, gene);
    if (/^ENSG\d+(\.\d+)?$/i.test(gene.id)) add(byUnversionedId, gene.id.replace(/\.\d+$/, ""), gene);
  }
  for (const alias of aliases) {
    const gene = byId.get(normalize(alias.selected_gene_id));
    if (!gene) continue;
    for (const name of [alias.current_symbol, alias.source_symbol]) add(byName, name, gene);
  }
  const ids = [], matched = [], unresolved = [], ambiguous = [], seen = new Set(), inputs = new Set();
  let duplicates = 0;
  for (const raw of identifiers) {
    const input = String(raw).trim(), key = normalize(input);
    if (!key) continue;
    if (inputs.has(key)) { duplicates++; continue; }
    inputs.add(key);
    const exact = byId.get(key);
    const candidates = exact ? [exact] : [...(byName.get(key) || byUnversionedId.get(key) || new Map()).values()];
    if (!candidates.length) unresolved.push(input);
    else if (candidates.length > 1) ambiguous.push({ input, candidates: candidates.map(({ id, symbol }) => ({ id, symbol })) });
    else {
      const gene = candidates[0];
      matched.push({ input, id: gene.id, symbol: gene.symbol });
      if (seen.has(gene.id)) duplicates++;
      else { seen.add(gene.id); ids.push(gene.id); }
    }
  }
  return { ids, matched, unresolved, ambiguous, duplicates };
}

export function collectionDocument(collection) {
  return {
    schemaVersion: 1,
    dataset: { ...RESEARCH_DATASET },
    identifierType: "Exact archived gene IDs; Ensembl version suffixes retained where present",
    interpretation: "User-selected collection; no enrichment analysis or biological interaction is implied.",
    collection: { id: collection.id, name: collection.name, genes: [...collection.genes] },
  };
}

export function collectionGMT(collection) {
  const field = (value) => String(value).replace(/[\t\r\n]/g, " ");
  return [field(collection.name), `https://doi.org/${RESEARCH_DATASET.doi}`, ...collection.genes.map(field)].join("\t") + "\n";
}
