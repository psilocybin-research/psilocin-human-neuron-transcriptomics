import {parseExploratoryCSV} from './exploratory-result-data.js';
export const RESEARCH_IMPORT_MAX_BYTES = 2_000_000;
export function validateResearchCSV(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > RESEARCH_IMPORT_MAX_BYTES)
    throw Error('Choose a UTF-8 CSV no larger than 2 MB. Use native R for larger files.');
  if (text.includes('\u0000') || text.includes('\ufffd')) throw Error('The file must be valid UTF-8 text without null bytes.');
  const parsed = parseExploratoryCSV(text);
  if (parsed.error) throw Error(parsed.error);
  if (parsed.truncated) throw Error('Import supports at most 1,000 rows and 100 columns; no rows were imported.');
  if (!parsed.headers.length || !parsed.rows.length) throw Error('Include a header and at least one data row.');
  if (parsed.headers.some(name => !name.trim()) || new Set(parsed.headers).size !== parsed.headers.length)
    throw Error('Column names must be nonempty and unique.');
  return {columns: parsed.headers, rows: parsed.rows.length};
}
