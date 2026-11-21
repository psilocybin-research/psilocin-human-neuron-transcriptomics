import {showToast} from "./app-toast.js";
import {createAnalysisNavigation} from './analysis-navigation.js';
import {moveAnalysisToTrash, restoreAnalysis, reorderAnalysis} from './analysis-lifecycle.js';
import {parsePythonNotebooks, parsePythonWorkspace, retainPythonRun} from './python-notebooks.js';
import {createElement as el, escapeHTML, createAccordion} from './interface-utils.js';
import {createREditor} from '../assets/vendor/r-editor.js';
import {createPythonRuntime, sha256Text} from './python-runtime.js';
import {downloadFile} from './file-download.js';
import {studioMenu,confirmPermanentDeletion} from './studio-ui.js';
import {validateSceneSpec} from './scientific-scene-spec.js';
import {validateResearchCSV} from './research-import.js';

const storageKey = 'atlas-python-notebooks-v1';
const workspaceKey = 'atlas-python-workspace-v2';
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

const starterCode = {
  summary: { title: 'Numeric summary', code: example },
  preview: { title: 'Preview selected rows', code: `# Inspect the selected archived or transferred table.
print(f"Dataset: {dataset_name}; rows: {len(data)}")
results = data[:25]
` },
  missingness: { title: 'Missingness audit', code: `# Exploratory missing-value count for the selected table.
results = []
if data:
    for column in data[0]:
        missing = sum(row.get(column) in (None, "") for row in data)
        results.append({"column": column, "missing": missing, "rows": len(data)})
print(f"Audited {len(results)} columns in {dataset_name}")
` },
};
function newBook() { return {id: crypto.randomUUID(), name: 'Python analysis', code: example, runs: []}; }
function readBooks() {
  try { return parsePythonNotebooks(localStorage.getItem(storageKey)); } catch {}
  return [newBook()];
}

export function createPythonLab({root, getDatasets = async () => [], onTransferToR, onResults, onClearResults}) {
  const host = el('section', 'python-lab custom-r-workspace');
  let persisted;
  try{const stored=localStorage.getItem(workspaceKey);if(stored)persisted=parsePythonWorkspace(JSON.parse(stored));}catch{}
  const books = persisted?.notebooks || readBooks(), trash = persisted?.trash || [];
  let current = books.find(book=>book.id===persisted?.active)||books[0], navigation, undoToast, runtime, runtimeInfo, busy = false, generation = 0, destroyed = false, record;
  const heading = el('h2', '', 'Python Lab');
  const emptyState=el('div','python-empty-state');emptyState.append(el('p','note','No personal Python analyses. Create an analysis or restore one from Trash.'),button('New analysis',createAnalysis));
  const intro = el('p', 'note', 'Optional Python Lab for exploratory table analysis. R remains the primary research environment.');
  const toolbar = el('div', 'custom-r-toolbar');
  // Analyses live in the workspace sidebar. The top selector is reserved for
  // working code starters, so it always changes what appears in the editor.
  const notebooks = el('select'); notebooks.setAttribute('aria-label', 'Python notebook'); notebooks.hidden=true;
  const starter = el('select'); starter.setAttribute('aria-label', 'Python code starter');
  for (const [id, value] of Object.entries(starterCode)) { const option=el('option','',value.title); option.value=id; starter.append(option); }
  const datasets = el('select'); datasets.setAttribute('aria-label', 'Python dataset');
  const datasetGuide = createAccordion('Python inputs & variables', 'python-data-guide');
  const datasetGuideItem = datasetGuide.element.querySelector('.accordion-item');
  datasetGuideItem.classList.add('accordion-item-opened');
  const datasetGuideBody = datasetGuide.body;
  datasetGuideBody.append(el('p','note','Choose an archived or transferred table above. Each run receives a fresh namespace: data is the selected table as a list of row dictionaries; dataset_name is its name; datasets maps every available table name to its rows. CSV values are strings, so convert numerical columns explicitly.'));
  const datasetGuideList = el('div','python-dataset-list'); datasetGuideBody.append(datasetGuideList);

  const editor = createREditor(current?.code||'', {label: 'Python code', language: 'python'});
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
  run.classList.add('studio-primary-run','primary','button-fill');
  const stop = button('Stop Python', () => reset('Python stopped. The worker was reset.'));
  const initialize = button('Initialize Python', initializePython);
  const loadStarter = button('Load starter', () => {
    const source = starterCode[starter.value]; if (!source || editor.value === source.code) return;
    const apply = () => { editor.value = source.code; save(); status.textContent = `Loaded ${source.title} starter. It has not run.`; };
    if (editor.value.trim()) root.f7.dialog.confirm('Replace the editor with this Python starter? Your current script remains available in browser history only if saved or downloaded.', 'Load Python starter', apply);
    else apply();
  });
  const more = button('Python actions', () => studioMenu(root, more, 'Python notebook', [
    {label: 'New analysis', run: createAnalysis},
    {label: 'Rename', available:!!current, run:()=>renameAnalysis(current)},
    {label: 'Duplicate', available:!!current, run:()=>duplicateAnalysis(current)},
    {label: 'Download Python script', available:!!current, run: () => downloadFile('atlas-analysis.py', editor.value, 'text/x-python')},
    {label: 'Download Python notebooks', run: () => { save(); return downloadFile('atlas-python-notebooks.json', JSON.stringify({schema: 1, language: 'python', notebooks: books, trash}, null, 2), 'application/json'); }},
    {label: 'Move to Trash', available:!!current, destructive:true, run:()=>trashAnalysis(current)},
    {label: 'Trash', run:()=>navigation.openTrash()},
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
  toolbar.append(starter, loadStarter, datasets, run, stop, initialize, more);
  host.append(heading, intro, datasetGuide.element, toolbar, emptyState, editor, status, history, consoleOutput, result, exports, inspector, limits);
  function setBusy(value) {
    busy = value; history.disabled = value || !current?.runs?.length; initialize.disabled = datasets.disabled = starter.disabled = loadStarter.disabled = more.disabled = value;run.disabled=notebooks.disabled=value||!current;editor.inert=value||!current;navigation?.setBusy(value);
    host.classList.toggle('python-empty',!current);emptyState.hidden=!!current;
    stop.disabled = !value; csv.disabled = transfer.disabled = value || !record?.csv; provenance.disabled = value || !record;
    host.setAttribute('aria-busy', String(value));
  }
  function refreshBooks() {
    notebooks.replaceChildren(...books.map(book => { const option = el('option', '', book.name); option.value = book.id; return option; }));
    notebooks.value = current?.id||'';
    for(const book of [...books,...trash.map(item=>item.book)])book.title=book.name;
    navigation?.render();
  }
  function save() {
    if(current)current.code = editor.value;
    if (current?.code.length > 100000) { status.textContent = 'This script exceeds the 100,000-character local save limit. Download it to preserve the full source.'; return false; }
    try { const value={notebooks:books,trash,active:current?.id??null};if(new TextEncoder().encode(JSON.stringify(value)).byteLength>6000000)throw Error('Storage limit');localStorage.setItem(workspaceKey,JSON.stringify(value));localStorage.setItem(storageKey, JSON.stringify(books)); return true; }
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
    datasetGuideList.replaceChildren();
    for (const item of items) {
      const row = el('article', 'python-dataset-row');
      const columns = String(item.csv).split(/\r?\n/, 1)[0].split(',').filter(Boolean);
      row.append(el('strong','',item.name), el('span','note', `${item.provenance?.classification === 'archived' ? 'Archived input' : 'Transferred exploratory input'} · ${item.provenance?.rows ?? 'unknown'} rows · ${columns.length} columns`), el('span','note', columns.slice(0, 8).join(' · ') + (columns.length > 8 ? ' …' : '')));
      datasetGuideList.append(row);
    }
    if (!items.length) datasetGuideList.append(el('p','note','No datasets are available in this workspace.'));
    return items;
  }
  async function execute() {
    if (!current)return;
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
    for (const [index, saved] of (current?.runs || []).entries()) {
      const option = el('option', '', `${saved.run_utc} · ${saved.rows} rows`); option.value = String(index); history.append(option);
    }
    history.disabled = busy || !current?.runs?.length;
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
    const latest = current?.runs?.at(-1);
    if (latest) { displayRecord(latest); status.textContent = 'Restored recorded Python output. No code was executed.'; }
  }
  history.onchange = () => {
    const saved = current?.runs?.[Number(history.value)];
    if (history.value !== '' && saved) { onClearResults?.(); displayRecord(saved); status.textContent = 'Viewing recorded Python output. The editor has not changed; no code was executed.'; }
  };
  notebooks.onchange = () => chooseAnalysis(books.find(book=>book.id===notebooks.value));
  editor.addEventListener('input', () => { save(); if (record) status.textContent = 'Script changed. Results belong to the last completed Python run.'; });
  editor.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); execute(); } });
  const sidebar=el('aside','studio-sidebar');sidebar.setAttribute('aria-label','Python analyses');
  function workspace(){return {notebooks:books,trash,active:current?.id??null};}
  function chooseAnalysis(book){if(busy||!book)return;save();reset();current=book;editor.value=book.code;navigation?.reveal();refreshBooks();restoreLatest();setBusy(false);save();root.workspaceShell?.closeNavigation();}
  function createAnalysis(){if(busy||books.length>=20)return;save();const book=newBook();books.push(book);chooseAnalysis(book);}
  function renameAnalysis(book){if(busy||!book)return;root.f7.dialog.prompt('Analysis name','Rename analysis',name=>{if(name.trim()){book.name=name.trim().slice(0,120);save();refreshBooks();}},undefined,book.name);}
  function duplicateAnalysis(book){if(busy||books.length>=20)return;save();const copy=structuredClone(book);copy.id=crypto.randomUUID();copy.name=`${book.name} (copy)`.slice(0,120);books.push(copy);chooseAnalysis(copy);}
  function restoreAnalysisById(bookId){if(busy)return;if(books.length>=20){status.textContent='The limit is 20 active Python analyses.';return;}try{const state=workspace();if(!restoreAnalysis(state,bookId))return;reset();current=books.find(book=>book.id===state.active);editor.value=current.code;navigation?.reveal();refreshBooks();restoreLatest();setBusy(false);save();}catch(error){status.textContent=error.message;}}
  function trashAnalysis(book){if(busy||!book)return;save();try{const state=workspace();if(!moveAnalysisToTrash(state,book.id))return;reset();current=books.find(book=>book.id===state.active);editor.value=current?.code||'';refreshBooks();restoreLatest();setBusy(false);save();undoToast?.close(false);undoToast=showToast(`Moved “${book.name}” to Trash.`,{duration:8000,actionLabel:'Undo',onAction:()=>restoreAnalysisById(book.id)});}catch(error){status.textContent=error.message;}}
  navigation=createAnalysisNavigation({root,sidebar,action:(label,icon,fn)=>button(label,fn),newBook:button('New analysis',createAnalysis),getWorkspace:workspace,isBusy:()=>busy,language:'python',examples:[],maxActive:20,onChoose:chooseAnalysis,onRename:renameAnalysis,onDuplicate:duplicateAnalysis,onTrash:trashAnalysis,onRestore:restoreAnalysisById,onExport:book=>downloadFile('atlas-analysis.py',book.code,'text/x-python'),onReorder:(id,to)=>{if(!busy&&reorderAnalysis(workspace(),id,to)){save();refreshBooks();}},onPermanentDelete:id=>confirmPermanentDeletion(root,()=>{if(busy)return;const index=trash.findIndex(item=>item.book.id===id);if(index>=0)trash.splice(index,1);save();navigation.render();})});
  host.workspaceNavigation=sidebar;
  refreshBooks(); setBusy(false); restoreLatest();
  loadDatasets().catch(error => { if (!destroyed) status.textContent = `Input tables unavailable: ${error.message}`; });
  host.refreshDatasets = loadDatasets;
  host.destroy = () => { navigation.destroy();undoToast?.close(false);sidebar.remove();destroyed = true; save(); reset(); editor.destroy(); };
  return host;
}
