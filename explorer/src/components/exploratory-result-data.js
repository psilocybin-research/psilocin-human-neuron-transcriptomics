const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const ENSEMBL_GENE = /^ENSG\d{11}(?:\.\d+)?$/;
const GENE_COLUMNS = new Set(["gene_id", "id", "ensembl", "ensembl_gene_id"]);
export const EXPLORATORY_PREVIEW_LIMITS = Object.freeze({ rows: 1000, characters: 2_000_000, columns: 100 });

export function numericCSVValue(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!NUMBER.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** RFC4180 fields; bounded previews discard a partial last record, never repair it. */
export function parseExploratoryCSV(csv) {
  if (typeof csv !== "string" || !csv.trim())
    return { headers: [], rows: [], truncated: false, error: null };
  const source = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const text = source.slice(0, EXPLORATORY_PREVIEW_LIMITS.characters);
  let field = "", record = [], quoted = false, afterQuote = false, started = false;
  let headers = null, error = null, truncated = source.length > text.length;
  const rows = [];
  function finishRecord() {
    record.push(field);
    if (record.length > EXPLORATORY_PREVIEW_LIMITS.columns) {
      error = `Preview supports at most ${EXPLORATORY_PREVIEW_LIMITS.columns} columns.`;
      return false;
    }
    if (!headers) headers = record;
    else if (record.length === headers.length) rows.push(record);
    else if (record.length !== 1 || record[0] !== "") {
      error = "A CSV record has a different number of fields from its header.";
      return false;
    }
    record = []; field = ""; started = false; afterQuote = false;
    return true;
  }
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index++; }
        else { quoted = false; afterQuote = true; }
      } else field += char;
      continue;
    }
    if (char === ",") {
      record.push(field); field = ""; afterQuote = false; started = true;
      if (record.length >= EXPLORATORY_PREVIEW_LIMITS.columns) {
        error = `Preview supports at most ${EXPLORATORY_PREVIEW_LIMITS.columns} columns.`;
        break;
      }
    } else if (char === "\n" || char === "\r") {
      if (!finishRecord()) break;
      if (char === "\r" && text[index + 1] === "\n") index++;
      if (rows.length >= EXPLORATORY_PREVIEW_LIMITS.rows) {
        truncated ||= text.slice(index + 1).trim().length > 0;
        break;
      }
    } else if (char === '"' && field === "" && !afterQuote) {
      quoted = true; started = true;
    } else if (afterQuote || char === '"') {
      error = "CSV quotation is malformed; no preview was generated.";
      break;
    } else { field += char; started = true; }
  }
  if (!error && rows.length < EXPLORATORY_PREVIEW_LIMITS.rows && !truncated) {
    if (quoted) error = "CSV ends inside a quoted field; no preview was generated.";
    else if (started || record.length) finishRecord();
  }
  return { headers: headers || [], rows: error ? [] : rows, truncated, error };
}

export function exploratoryColumns(parsed) {
  return parsed.headers.flatMap((name, index) => parsed.rows.some((row) => numericCSVValue(row[index]) !== null)
    ? [{ index, name: name || `Column ${index + 1}` }]
    : []);
}

export function exactGeneIdentifier(parsed, row) {
  for (let index = 0; index < parsed.headers.length; index++) {
    if (!GENE_COLUMNS.has(parsed.headers[index].trim().toLowerCase())) continue;
    // Preserve exact archived identifier/version; symbols never establish identity.
    if (ENSEMBL_GENE.test(row[index])) return row[index];
  }
  return null;
}

export function exploratoryPoints(parsed, xIndex, yIndex) {
  return parsed.rows.flatMap((row, rowIndex) => {
    const x = numericCSVValue(row[xIndex]), y = numericCSVValue(row[yIndex]);
    return x !== null && y !== null ? [{ x, y, rowIndex, geneId: exactGeneIdentifier(parsed, row) }] : [];
  });
}

/** Explicit one-value-per-exact-ID contract for a user-generated 3D overlay. */
export function exploratoryNetworkValues(parsed, valueIndex) {
  if (parsed.error || parsed.truncated) throw Error('Use a complete, valid result table of at most 1,000 rows for a network overlay.');
  if (!Number.isInteger(valueIndex) || valueIndex < 0 || valueIndex >= parsed.headers.length) throw Error('Choose a numerical value column.');
  const seen = new Set(), values = [];
  let omitted = 0;
  for (const row of parsed.rows) {
    const id = exactGeneIdentifier(parsed, row), value = numericCSVValue(row[valueIndex]);
    if (!id || value === null) { omitted++; continue; }
    if (seen.has(id)) throw Error('Each exact gene ID must occur once. Filter to one contrast or explicitly aggregate in R before mapping.');
    seen.add(id); values.push({id, value});
  }
  if (!values.length) throw Error('No finite values with exact Ensembl gene IDs were found.');
  return {schema: 'psilocin-atlas/exploratory-overlay/v1', classification: 'user-exploratory', column: parsed.headers[valueIndex], values, omitted};
}
