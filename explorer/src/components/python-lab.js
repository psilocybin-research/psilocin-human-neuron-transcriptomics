import {parsePythonNotebooks, retainPythonRun} from './python-notebooks.js';
import {createElement as el} from './interface-utils.js';
import {createREditor} from '../assets/vendor/r-editor.js';
import {createPythonRuntime, sha256Text} from './python-runtime.js';
import {downloadFile} from './file-download.js';
import {studioMenu} from './studio-ui.js';
import {validateSceneSpec} from './scientific-scene-spec.js';
import {validateResearchCSV} from './research-import.js';

const storageKey = 'atlas-python-notebooks-v1';
const example = `# Python exploratory analysis; archived findings remain unchanged.
# data: selected CSV as a list of dictionaries; values are strings.
# datasets: all named input tables. Standard-library modules are available.
import statistics
print(f"Dataset: {dataset_name}; rows: {len(data)}")
results = []
if data:
    for column in data[0]:
        values = []
        for row in data:
            try:
                value = float(row[column])
                if __import__('math').isfinite(value):
                    values.append(value)
            except (ValueError, TypeError):
                pass
        if values:
            results.append({"column": column, "n": len(values),
                            "mean": statistics.mean(values),
                            "minimum": min(values), "maximum": max(values)})
print(f"Numeric columns summarized: {len(results)}")
`;
function newBook() { return {id: crypto.randomUUID(), name: 'Python analysis', code: example, runs: []}; }
function readBooks() {
  try { return parsePythonNotebooks(localStorage.getItem(storageKey)); } catch {}
  return [newBook()];
}

export function createPythonLab({root, getDatasets = async () => [], onTransferToR, onResults, onClearResults}) {
  const host = el('section', 'python-lab custom-r-workspace');
  const books = readBooks();
  let current = books[0], runtime, runtimeInfo, busy = false, generation = 0, destroyed = false, record;
  const heading = el('h2', '', 'Python Lab');
  const intro = el('p', 'note', 'Optional Python workspace for exploratory table analysis. R remains the primary research environment.');
  const toolbar = el('div', 'custom-r-toolbar');
  const notebooks = el('select'); notebooks.setAttribute('aria-label', 'Python notebook');
  const datasets = el('select'); datasets.setAttribute('aria-label', 'Python dataset');
  const editor = createREditor(current.code, {label: 'Python code', language: 'python'});
  const status = el('p', 'note python-lab-status', 'Python is not loaded. Choose Run Python or Initialize Python when ready.');
  status.setAttribute('role', 'status');
  const consoleOutput = el('pre', 'custom-r-console'); consoleOutput.setAttribute('aria-label', 'Python console');
  const result = el('div', 'python-lab-result');
  const history = el('select'); history.setAttribute('aria-label', 'Python run history');
  const inspector = el('details', 'python-inspector'); inspector.append(el('summary', '', 'Python environment'));
  const environment = el('p', 'note', 'Runtime not initialized.');
  const packages = el('pre', 'custom-r-console'); packages.setAttribute('aria-label', 'Python standard library');
  inspector.append(environment, packages, el('p', 'note', 'These standard-library modules are verified in the installed runtime. No third-party package installation is offered. Use native Python for additional packages.'));
  const limits = el('p', 'note', 'Each run uses a new variable namespace and a fixed random seed. Imports may remain in the worker until Reset. CSV values are strings; convert types explicitly. Outputs are exploratory and do not update the archive.');
  function button(text, action) {
    const node = el('button', 'button button-tonal', text); node.type = 'button'; node.onclick = action; return node;
  }
  const run = button('Run Python', execute);
  const stop = button('Stop Python', () => reset('Python stopped. The worker was reset.'));
  const initialize = button('Initialize Python', initializePython);
  const more = button('Python actions', () => studioMenu(root, more, 'Python notebook', [
    {label: 'New Python notebook', run() {
      if (books.length >= 20) { status.textContent = 'The limit is 20 Python notebooks.'; return; }
      save(); reset(); current = newBook(); books.push(current); editor.value = current.code; refreshBooks(); refreshHistory(); save();
    }},
    {label: 'Rename Python notebook', run() { root.f7.dialog.prompt('Notebook name', 'Rename Python notebook', name => {
      if (name.trim()) { current.name = name.trim().slice(0, 120); save(); refreshBooks(); }
    }, undefined, current.name); }},
    {label: 'Download Python script', run: () => downloadFile('atlas-analysis.py', editor.value, 'text/x-python')},
    {label: 'Download Python notebooks', run: () => { save(); return downloadFile('atlas-python-notebooks.json', JSON.stringify({schema: 1, language: 'python', notebooks: books}, null, 2), 'application/json'); }},
    {label: 'Delete Python notebook', available: books.length > 1, destructive: true, run() { root.f7.dialog.confirm('Delete this Python notebook and its recorded outputs?', 'Delete Python notebook', () => { reset(); books.splice(books.indexOf(current), 1); current = books[0]; editor.value = current.code; refreshBooks(); restoreLatest(); save(); }); }},
    {label: 'Reset Python worker', run: () => reset()},
  ]));
  const csv = button('Download Python CSV', () => downloadFile('python-results.csv', record.csv));
  const provenance = button('Download Python provenance', () => downloadFile('python-provenance.json', JSON.stringify(record, null, 2), 'application/json'));
  const transfer = button('Send Python results to R', async () => {
    if (!record) return;
    try { await onTransferToR?.({name: 'python_results', csv: record.csv, provenance: record}); status.textContent = 'Python results are available as an exploratory table in R.'; }
    catch (error) { status.textContent = `Transfer failed: ${error.message}`; }
  });
  const exports = el('div', 'custom-r-toolbar'); exports.append(csv, provenance); if (onTransferToR) exports.append(transfer);
  toolbar.append(notebooks, datasets, run, stop, initialize, more);
  host.append(heading, intro, toolbar, editor, status, history, consoleOutput, result, exports, inspector, limits);
  function setBusy(value) {
    busy = value; history.disabled = value || !current.runs?.length; run.disabled = initialize.disabled = notebooks.disabled = datasets.disabled = more.disabled = value;
    stop.disabled = !value; csv.disabled = transfer.disabled = value || !record?.csv; provenance.disabled = value || !record;
    host.setAttribute('aria-busy', String(value));
  }
  function refreshBooks() {
    notebooks.replaceChildren(...books.map(book => { const option = el('option', '', book.name); option.value = book.id; return option; }));
    notebooks.value = current.id;
  }
  function save() {
    current.code = editor.value;
    if (current.code.length > 100000) { status.textContent = 'This script exceeds the 100,000-character local save limit. Download it to preserve the full source.'; return false; }
    try { localStorage.setItem(storageKey, JSON.stringify(books)); return true; }
    catch { status.textContent = 'Browser storage is unavailable or full. Download your Python notebook to preserve it.'; return false; }
  }
  function reset(message = 'Python worker reset. Run Python to start a new session.') {
    generation++; runtime?.close(); runtime = undefined; runtimeInfo = undefined; record = undefined;
    onClearResults?.(); result.replaceChildren(); consoleOutput.textContent = ''; environment.textContent = 'Runtime not initialized.'; packages.textContent = ''; setBusy(false); status.textContent = message;
  }
  async function ensureRuntime() {
    runtime ||= createPythonRuntime();
    runtimeInfo ||= await runtime.init();
    environment.textContent = `Pyodide ${runtimeInfo.version} · ${runtimeInfo.python}`;
    packages.textContent = (runtimeInfo.standard_library || []).join(' · ');
    return runtime;
  }
  async function initializePython() {
    if (busy) return;
    const token = generation; setBusy(true); status.textContent = 'Loading the local Python runtime…';
    try { await ensureRuntime(); if (token === generation) status.textContent = `Python ready · Pyodide ${runtimeInfo.version}`; }
    catch (error) { if (token === generation) reset(`Python could not start: ${error.message}`); }
    finally { if (token === generation) setBusy(false); }
  }
  async function loadDatasets() {
    const items = await getDatasets();
    if (!Array.isArray(items)) throw Error('Dataset provider must return an array.');
    const names = new Set();
    for (const item of items) {
      if (!item || typeof item.name !== 'string' || !item.name.trim() || typeof item.csv !== 'string' || names.has(item.name))
        throw Error('Python inputs require unique names and CSV text.');
      names.add(item.name);
    }
    const selected = datasets.value;
    datasets.replaceChildren(...items.map(item => { const option = el('option', '', item.name); option.value = item.name; return option; }));
    if (names.has(selected)) datasets.value = selected;
    if (!items.length) { const option = el('option', '', 'No selected table'); option.value = ''; datasets.append(option); }
    return items;
  }
  async function execute() {
    if (busy) return;
    const token = generation; save(); setBusy(true); record = undefined; onClearResults?.(); result.replaceChildren(); consoleOutput.textContent = '';
    status.textContent = 'Preparing Python inputs…'; const code = editor.value, started = performance.now();
    try {
      const inputs = await loadDatasets();
      if (token !== generation) return;
      const selected = datasets.value;
      status.textContent = 'Loading and running Python…';
      const kernel = await ensureRuntime();
      if (token !== generation) return;
      const output = await kernel.run({code, selected, datasets: inputs.map(({name, csv}) => ({name, csv}))});
      if (token !== generation) return;
      consoleOutput.textContent = output.output.map(item => item.text).join('\n') + (output.outputTruncated ? '\n[Console truncated at 100,000 characters]' : '');
      if (output.csv) validateResearchCSV(output.csv);
      const nextRecord = {schema: 1, classification: 'user-exploratory', language: 'python', runtime: runtimeInfo, seed: 20261119,
        namespace: 'fresh-per-run', run_utc: new Date().toISOString(), notebook_id: current.id, notebook_name: current.name,
        code, code_sha256: await sha256Text(code), selected_dataset: selected,
        inputs: await Promise.all(inputs.map(async item => ({name: item.name, bytes: new TextEncoder().encode(item.csv).byteLength,
          sha256: await sha256Text(item.csv), provenance: item.provenance ?? null}))),
        csv: output.csv, csv_sha256: await sha256Text(output.csv), rows: output.rows, columns: output.columns,
        console: output.output, elapsed_ms: Math.round(performance.now() - started)};
      if (token !== generation) return;
      nextRecord.scene_specs = (output.scene_specs || []).map(spec => validateSceneSpec({...spec, classification: 'user-exploratory',
        source: {...spec.source, code_sha256: nextRecord.code_sha256, run_utc: nextRecord.run_utc}}));
      const retention = retainPythonRun(books, current, nextRecord);
      record = nextRecord; const persisted = save(); refreshHistory(); displayRecord(record);
      status.textContent = `Python completed · ${record.elapsed_ms.toLocaleString()} ms · Pyodide ${runtimeInfo.version}` +
        (!persisted ? ' · Browser storage is unavailable or full; download your output to preserve it.' : !retention.saved ? ' · Output is too large for saved history; download it to preserve it.' : retention.evicted ? ' · Oldest saved outputs removed to respect storage limits.' : ' · Output saved on this device.');
      onResults?.(record);
    } catch (error) {
      if (token === generation) {
        runtime?.close(); runtime = undefined; runtimeInfo = undefined;
        consoleOutput.textContent = (error.output || []).map(item => item.text).join('\n');
        status.textContent = `Python failed; worker reset. ${error.message}`;
      }
    } finally { if (token === generation) setBusy(false); }
  }
  function refreshHistory() {
    history.replaceChildren(el('option', '', 'Recorded Python runs'));
    history.firstChild.value = '';
    for (const [index, saved] of (current.runs || []).entries()) {
      const option = el('option', '', `${saved.run_utc} · ${saved.rows} rows`); option.value = String(index); history.append(option);
    }
    history.disabled = busy || !current.runs?.length;
  }
  function displayRecord(saved) {
    record = saved; result.replaceChildren();
    consoleOutput.textContent = saved.console.map(item => item.text).join('\n');
    result.append(el('p', 'note', `${saved.rows.toLocaleString()} exploratory result rows · ${saved.columns.length} columns`));
    if (saved.csv) {
      const preview = el('pre', 'custom-r-console', saved.csv.slice(0, 12000) + (saved.csv.length > 12000 ? '\n[Preview truncated; download the complete CSV.]' : ''));
      preview.setAttribute('aria-label', 'Python results preview'); result.append(preview);
    }
    setBusy(false);
  }
  function restoreLatest() {
    refreshHistory();
    const latest = current.runs?.at(-1);
    if (latest) { displayRecord(latest); status.textContent = 'Restored recorded Python output. No code was executed.'; }
  }
  history.onchange = () => {
    const saved = current.runs?.[Number(history.value)];
    if (history.value !== '' && saved) { onClearResults?.(); displayRecord(saved); status.textContent = 'Viewing recorded Python output. The editor has not changed; no code was executed.'; }
  };
  notebooks.onchange = () => { save(); reset(); current = books.find(book => book.id === notebooks.value); editor.value = current.code; restoreLatest(); };
  editor.addEventListener('input', () => { save(); if (record) status.textContent = 'Script changed. Results belong to the last completed Python run.'; });
  editor.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); execute(); } });
  refreshBooks(); setBusy(false); restoreLatest();
  loadDatasets().catch(error => { if (!destroyed) status.textContent = `Input tables unavailable: ${error.message}`; });
  host.refreshDatasets = loadDatasets;
  host.destroy = () => { destroyed = true; save(); reset(); editor.destroy(); };
  return host;
}
