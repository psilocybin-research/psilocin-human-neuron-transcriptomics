// Independent bounded persistence for optional Python scripts and recorded outputs.
export const PYTHON_NOTEBOOK_LIMITS = Object.freeze({books: 20, code: 100000, runs: 3, runBytes: 750000, storageBytes: 3000000});
const size = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
export function validPythonRun(record) {
  return record && record.language === 'python' && record.classification === 'user-exploratory' &&
    typeof record.code === 'string' && record.code.length <= PYTHON_NOTEBOOK_LIMITS.code &&
    typeof record.csv === 'string' && typeof record.run_utc === 'string' &&
    Number.isInteger(record.rows) && record.rows >= 0 && record.rows <= 1000 &&
    Array.isArray(record.columns) && record.columns.every(column => typeof column === 'string') &&
    Array.isArray(record.console) && record.console.every(item => typeof item.text === 'string') &&
    /^[a-f0-9]{64}$/.test(record.code_sha256) && /^[a-f0-9]{64}$/.test(record.csv_sha256) &&
    record.runtime && typeof record.runtime.version === 'string' &&
    size(record) <= PYTHON_NOTEBOOK_LIMITS.runBytes;
}
export function parsePythonNotebooks(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > PYTHON_NOTEBOOK_LIMITS.storageBytes) throw Error('Python notebook storage exceeds its size limit.');
  const books = JSON.parse(text);
  if (!Array.isArray(books) || books.length > PYTHON_NOTEBOOK_LIMITS.books) throw Error('Invalid Python notebook collection.');
  const ids = new Set();
  return books.map(book => {
    if (!book || typeof book.id !== 'string' || !book.id || ids.has(book.id) || typeof book.name !== 'string' || !book.name.trim() ||
        book.name.length > 120 || typeof book.code !== 'string' || book.code.length > PYTHON_NOTEBOOK_LIMITS.code) throw Error('Invalid Python notebook.');
    ids.add(book.id);
    return {id: book.id, name: book.name, code: book.code, runs: (Array.isArray(book.runs) ? book.runs : []).filter(validPythonRun).slice(-PYTHON_NOTEBOOK_LIMITS.runs)};
  });
}
export function retainPythonRun(books, notebook, record) {
  notebook.runs ||= [];
  if (!validPythonRun(record)) return {saved: false, evicted: 0};
  notebook.runs.push(record);
  let evicted = Math.max(0, notebook.runs.length - PYTHON_NOTEBOOK_LIMITS.runs);
  notebook.runs = notebook.runs.slice(-PYTHON_NOTEBOOK_LIMITS.runs);
  while (size(books) > PYTHON_NOTEBOOK_LIMITS.storageBytes) {
    const candidates = books.filter(book => book.runs?.length);
    if (!candidates.length) return {saved: false, evicted};
    candidates.sort((a, b) => a.runs[0].run_utc.localeCompare(b.runs[0].run_utc));
    candidates[0].runs.shift(); evicted++;
  }
  return {saved: notebook.runs.includes(record), evicted};
}

export function parsePythonWorkspace(value) {
  if (!value || !Array.isArray(value.trash || []) || (value.trash || []).length > 100 || size(value) > 6000000) throw Error('Invalid or oversized Python workspace.');
  const notebooks = parsePythonNotebooks(JSON.stringify(value.notebooks));
  const trash = (value.trash || []).map(item => {
    if (!item || !Number.isInteger(item.index) || item.index < 0 || typeof item.deleted !== 'string' || !Number.isFinite(Date.parse(item.deleted))) throw Error('Invalid Python Trash record.');
    const book = parsePythonNotebooks(JSON.stringify([item.book]))[0];
    if ((item.book.runs || []).length !== book.runs.length) throw Error('Invalid recorded Python output in Trash.');
    return {book, index: item.index, deleted: item.deleted};
  });
  const ids = [...notebooks, ...trash.map(item => item.book)].map(book => book.id);
  if (new Set(ids).size !== ids.length) throw Error('Active and trashed Python identifiers must be unique.');
  return {notebooks, trash, active: notebooks.some(book => book.id === value.active) ? value.active : notebooks[0]?.id ?? null};
}
