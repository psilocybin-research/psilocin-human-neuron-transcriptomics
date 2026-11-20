import {zip, unzip} from '../assets/vendor/r-editor.js';
import {validateWorkspace, notebookSchema} from './r-notebooks.js';
import {parsePythonWorkspace,parsePythonNotebooks} from './python-notebooks.js';
import {validateSceneSpec} from './scientific-scene-spec.js';
import {SCIENTIFIC_PYTHON_HELPERS} from './scientific-scene-helpers.js';

export const SCIENTIFIC_SESSION_SCHEMA = 'psilocin-research-session/2';
export const SESSION_LIMITS = Object.freeze({archive: 128_000_000, expanded: 256_000_000, file: 32_000_000, entries: 4000, runs: 1000});
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const hex = bytes => [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
const digest = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const bytesOf = value => value instanceof Uint8Array ? value : encoder.encode(value);
const json = value => JSON.stringify(value, null, 2) + '\n';
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const safePath = path => typeof path === 'string' && path.length < 200 && /^[A-Za-z0-9_.\/-]+$/.test(path) && !path.startsWith('/') && !path.split('/').some(part => !part || part === '.' || part === '..');
function requireValue(condition, message) { if (!condition) throw Error(message); }
function text(value, label, max = 200) {
  requireValue(typeof value === 'string' && value.length <= max && !/[\u0000-\u0008]/.test(value), `Invalid ${label}.`); return value;
}
function selection(value = {}) {
  requireValue(plain(value), 'Invalid research selection.');
  const result = {};
  for (const name of ['gene', 'pathway', 'contrast', 'view']) result[name] = value[name] == null ? null : text(value[name], `selection ${name}`);
  requireValue(Array.isArray(value.collections || []) && (value.collections || []).length <= 20, 'Invalid gene collections.');
  const ids = new Set();
  result.collections = (value.collections || []).map(item => {
    requireValue(plain(item) && Array.isArray(item.genes) && item.genes.length <= 500, 'Invalid gene collection.');
    const id = text(item.id, 'collection id', 80); requireValue(id && !ids.has(id), 'Duplicate or empty collection identifier.'); ids.add(id);
    return {id, name: text(item.name, 'collection name', 120), genes: item.genes.map(gene => text(gene, 'gene identifier'))};
  });
  return result;
}
function normalizeWorkspace(value) {
  requireValue(value?.schema === notebookSchema && Array.isArray(value.notebooks), 'An R notebook workspace is required.');
  requireValue(Array.isArray(value.trash || []) && (value.trash || []).length<=100, 'Invalid R Trash.');
  for (const book of [...value.notebooks,...(value.trash||[]).map(item=>item.book)]) {
    text(book.id, 'R notebook id'); text(book.title, 'R notebook title', 120); text(book.created, 'R notebook date');
    requireValue(Array.isArray(book.cells), 'R notebook cells are required.');
    for (const cell of book.cells) {
      text(cell.id, 'R cell id');
      requireValue(Array.isArray(cell.runs || []) && (cell.runs || []).length <= 20, 'Too many recorded R runs.');
      for (const run of cell.runs || []) {
        requireValue(plain(run), 'Invalid recorded R run.');
        text(run.code || '', 'recorded R code', 2_000_000);
        if (run.console !== undefined) text(run.console, 'R console', 200000);
        if (run.results_csv !== undefined) text(run.results_csv, 'R results', 16_000_000);
        requireValue((run.vector_svgs || []).length <= 4, 'Too many R vector plots.');
        for (const spec of run.scene_specs || []) validateSceneSpec(spec);
      }
    }
  }
  return validateWorkspace(value);
}
function normalizePayload(input) {
  requireValue(plain(input), 'Invalid research session.');
  const r = {notebooks: normalizeWorkspace(input.r?.notebooks)};
  if (input.r?.input) {
    const imported = input.r.input;
    r.input = {name: text(imported.name, 'R import name'), csv: text(imported.csv, 'R import CSV', 2_000_000)};
    if (imported.sha256) r.input.sha256 = text(imported.sha256, 'R import hash', 64);
  } else r.input = null;
  const python = input.python_notebooks || [];
  requireValue(Array.isArray(python), 'Invalid Python notebooks.');
  const normalizedPython = python.length ? parsePythonNotebooks(JSON.stringify(python)) : [];
  // The notebook reader accepts legacy scripts, but a session must not silently drop a recorded output.
  requireValue(python.every((book, i) => (book.runs || []).length === normalizedPython[i].runs.length), 'Invalid or oversized recorded Python output.');
  const pythonWorkspace = parsePythonWorkspace({notebooks: normalizedPython, trash: input.python_trash || []});
  for (const book of [...normalizedPython,...pythonWorkspace.trash.map(item=>item.book)]) for (const run of book.runs) for (const spec of run.scene_specs || []) validateSceneSpec(spec);
  requireValue(Array.isArray(input.projects || []) && (input.projects || []).length <= 30, 'Invalid research projects.');
  const projects = (input.projects || []).map(project => {
    requireValue(plain(project) && project.schema === 'psilocin-research-project/1', 'Unsupported research project.');
    requireValue(Array.isArray(project.scenes || []) && (project.scenes || []).length <= 20, 'Invalid project scenes.');
    return {...project, id: text(project.id, 'project id'), title: text(project.title, 'project title', 120),
      created: text(project.created, 'project date'), selection: selection(project.selection), scenes: (project.scenes || []).map(validateSceneSpec)};
  });
  requireValue(Array.isArray(input.transferred_datasets || []) && (input.transferred_datasets || []).length <= 10, 'Invalid transferred tables.');
  const transferred = (input.transferred_datasets || []).map(item => ({name: text(item.name, 'transferred table name'),
    csv: text(item.csv, 'transferred CSV', 2_000_000), provenance: plain(item.provenance) ? item.provenance : {}}));
  const sourceURL = input.source_url === undefined ? undefined : text(input.source_url, 'source URL', 4096);
  if (sourceURL !== undefined) { try { new URL(sourceURL); } catch { throw Error('Invalid source URL.'); } }
  return {schema: SCIENTIFIC_SESSION_SCHEMA, exported_utc: input.exported_utc || new Date().toISOString(),
    ...(sourceURL === undefined ? {} : {source_url: sourceURL}),
    archive_doi: '10.5281/zenodo.23283595', classification: 'user-exploratory',
    selection: selection(input.selection), r, python_notebooks: normalizedPython, python_trash: pythonWorkspace.trash, projects, transferred_datasets: transferred};
}
function zipAsync(files) { return new Promise((resolve, reject) => zip(files, {level: 6}, (error, data) => error ? reject(error) : resolve(data))); }
function unzipAsync(bytes) { return new Promise((resolve, reject) => unzip(bytes, (error, files) => error ? reject(error) : resolve(files))); }

// Reject oversized/ambiguous archives using the central directory before allocation.
export function inspectSessionZip(bytes) {
  requireValue(bytes instanceof Uint8Array && bytes.byteLength <= SESSION_LIMITS.archive, 'Research archive exceeds 128 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  requireValue(end >= 0 && view.getUint16(end + 4, true) === 0 && view.getUint16(end + 6, true) === 0, 'Invalid or multipart research archive.');
  const count = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true), total = 0;
  requireValue(count > 0 && count <= SESSION_LIMITS.entries && count === view.getUint16(end + 8, true) && offset + directorySize === end, 'Invalid research archive directory.');
  const names = new Set(), records = [];
  for (let i = 0; i < count; i++) {
    requireValue(offset + 46 <= end && view.getUint32(offset, true) === 0x02014b50, 'Invalid ZIP entry.');
    const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
    const packed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true);
    requireValue(offset + 46 + nameLength + extra + comment <= end && !(flags & 1) && [0, 8].includes(method), 'Encrypted or unsupported ZIP entry.');
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    requireValue(safePath(name) && !names.has(name), 'Unsafe or duplicate archive path.'); names.add(name);
    const local = view.getUint32(offset + 42, true);
    requireValue(local + 30 <= bytes.length && view.getUint32(local, true) === 0x04034b50, 'Invalid local ZIP entry.');
    const localNameLength = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
    requireValue(local + 30 + localNameLength + localExtra + packed <= view.getUint32(end + 16, true), 'Invalid ZIP data length.');
    requireValue(decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) === name, 'ZIP entry names do not match.');
    total += size;
    requireValue(size <= SESSION_LIMITS.file && total <= SESSION_LIMITS.expanded, 'Expanded research archive exceeds its size limit.');
    records.push({path: name, bytes: size}); offset += 46 + nameLength + extra + comment;
  }
  requireValue(offset === end, 'Unexpected ZIP directory bytes.');
  return records;
}

function rReplay(code, references) {
  const missing = references.filter(item => !item.path).map(item => item.name);
  const setup = references.filter(item => item.path).map(item => `file.copy(${JSON.stringify('../../' + item.path)}, ${JSON.stringify('data/' + item.name + '.csv')}, overwrite=TRUE)`).join('\n');
  return `# Explicit native replay. Run Rscript analysis.R from this directory.\n# Recorded code is researcher-authored; inspect it before execution.\ndir.create('data', showWarnings=FALSE)\n${missing.length ? `stop(${JSON.stringify('Required recorded inputs are missing: ' + missing.join(', '))})\n` : ''}${setup}\n${code.replaceAll('/home/web_user/', 'data/')}\nif (exists('results') && is.data.frame(results)) write.csv(results, 'replayed-results.csv', row.names=FALSE)\n`;
}
function pythonReplay(run, references) {
  const missing = references.filter(item => !item.path).map(item => item.name);
  const mappings = Object.fromEntries(references.filter(item => item.path).map(item => [item.name, '../../' + item.path]));
  return `# Explicit native replay. Run python3 analysis.py from this directory.\n# Recorded code is researcher-authored; inspect it before execution.\nimport csv, json, random\nfrom pathlib import Path\n${missing.length ? `raise RuntimeError(${JSON.stringify('Required recorded inputs are missing: ' + missing.join(', '))})\n` : ''}paths = json.loads(${JSON.stringify(JSON.stringify(mappings))})\ndatasets = {name: list(csv.DictReader(Path(path).open(encoding='utf-8', newline=''))) for name, path in paths.items()}\ndata = datasets.get(${JSON.stringify(run.selected_dataset || '')}, [])\ndataset_name = ${JSON.stringify(run.selected_dataset || '')}\nrandom.seed(${Number.isInteger(run.seed) ? run.seed : 20261119})\nATLAS_SCENE_FILE = 'replayed-scene.json'\n${SCIENTIFIC_PYTHON_HELPERS}\n${run.code}\nif isinstance(globals().get('results'), list) and results:\n    fields = list(dict.fromkeys(key for row in results for key in row))\n    with open('replayed-results.csv', 'w', encoding='utf-8', newline='') as output:\n        writer = csv.DictWriter(output, fieldnames=fields, lineterminator='\\n')\n        writer.writeheader()\n        writer.writerows(results)\n`;
}
async function prepareArchive(input) {
  const payload = normalizePayload(input), files = {}, datasets = [], seen = new Map();
  const candidates = [...(input.datasets || []), ...payload.transferred_datasets];
  if (payload.r.input) candidates.push({...payload.r.input, name: 'user_data', provenance: {classification: 'user-imported'}});
  for (const [path, data] of Object.entries(input.r?.inputs || {})) candidates.push({name: path.replace(/^data\//, '').replace(/\.csv$/, ''), csv: decoder.decode(bytesOf(data)), provenance: {label: 'Exact R run input'}});
  requireValue(candidates.length <= 100, 'Too many session inputs.');
  for (const item of candidates) {
    text(item.name, 'dataset name'); text(item.csv, 'dataset CSV', SESSION_LIMITS.file);
    const bytes = encoder.encode(item.csv), sha256 = await digest(bytes);
    let path = seen.get(sha256);
    if (!path) { path = `inputs/table-${String(seen.size + 1).padStart(4, '0')}.csv`; seen.set(sha256, path); files[path] = bytes; }
    datasets.push({name: item.name, path, bytes: bytes.byteLength, sha256, provenance: plain(item.provenance) ? item.provenance : {}});
  }
  const inventory = [], scenes = [];
  async function addRun(run, language, notebookId, cellId) {
    requireValue(inventory.length < SESSION_LIMITS.runs, 'Too many recorded runs in this session.');
    const code = text(run.code || '', 'recorded run code', 2_000_000), codeHash = await digest(encoder.encode(code));
    if (run.code_sha256) requireValue(run.code_sha256 === codeHash, 'Recorded source checksum mismatch.');
    const inputs = language === 'r' ? Object.entries(run.inputs || {}).map(([name, value]) => ({name, ...value})) : run.inputs || [];
    requireValue(Array.isArray(inputs) && inputs.length <= 100, 'Invalid recorded input list.');
    const references = inputs.map(item => {
      const name = text(item.name, 'run dataset name'); requireValue(/^[A-Za-z0-9_-]+$/.test(name), 'Run input name is not portable.');
      requireValue(/^[a-f0-9]{64}$/.test(item.sha256), 'Invalid recorded input checksum.');
      const match = datasets.find(dataset => dataset.sha256 === item.sha256);
      return {name, sha256: item.sha256, path: match?.path || null};
    });
    const folder = `replay/${language}-${String(inventory.length + 1).padStart(4, '0')}`;
    files[`${folder}/analysis.${language === 'r' ? 'R' : 'py'}`] = encoder.encode(language === 'r' ? rReplay(code, references) : pythonReplay(run, references));
    const results = language === 'r' ? run.results_csv || '' : run.csv || '';
    files[`${folder}/recorded-results.csv`] = encoder.encode(results);
    const resultHash = await digest(encoder.encode(results));
    if (run.csv_sha256) requireValue(run.csv_sha256 === resultHash, 'Recorded result checksum mismatch.');
    for (const spec of run.scene_specs || []) {
      const path = `scenes/scene-${String(scenes.length + 1).padStart(4, '0')}.json`;
      files[path] = encoder.encode(json(validateSceneSpec(spec))); scenes.push({path, run: inventory.length});
    }
    inventory.push({language, notebook_id: notebookId, cell_id: cellId || null, run_utc: run.run_utc || null, code_sha256: codeHash,
      result_sha256: resultHash, folder, inputs: references, reconstructable: references.every(item => item.path),
      source_execution_mode: run.execution_mode || run.namespace || null, recorded_runtime: run.session_info || run.runtime || null});
  }
  for (const book of [...payload.r.notebooks.notebooks,...payload.r.notebooks.trash.map(item=>item.book)]) for (const cell of book.cells) for (const run of cell.runs || []) await addRun(run, 'r', book.id, cell.id);
  for (const book of [...payload.python_notebooks,...payload.python_trash.map(item=>item.book)]) for (const run of book.runs || []) await addRun(run, 'python', book.id);
  payload.datasets = datasets; payload.reconstruction = {runs: inventory, scenes};
  files['session.json'] = encoder.encode(json(payload));
  files['README.txt'] = encoder.encode('Research session archive v2. Nothing executes on import. Inspect researcher-authored scripts before native execution. Run each analysis script from its own replay directory. Inputs resolve by their recorded SHA-256 hashes; missing older inputs are listed explicitly and their scripts stop. Native runtimes/packages are not embedded: install compatible R/Python versions before replay. Exact numerical equality across platforms is not guaranteed. Scene specifications and recorded outputs remain exploratory, separate from archived findings. Source archive DOI: 10.5281/zenodo.23283595.\n');
  const manifest = {schema: 'psilocin-research-session-manifest/1', session_schema: SCIENTIFIC_SESSION_SCHEMA, algorithm: 'SHA-256',
    files: await Promise.all(Object.entries(files).map(async ([path, bytes]) => ({path, bytes: bytes.byteLength, sha256: await digest(bytes)})))};
  files['manifest.json'] = encoder.encode(json(manifest));
  checkFiles(files);
  return {files, manifest};
}
function checkFiles(files) {
  const entries = Object.entries(files);
  requireValue(entries.length <= SESSION_LIMITS.entries, 'Too many archive files.');
  let total = 0;
  for (const [path, bytes] of entries) {
    requireValue(safePath(path) && bytes.byteLength <= SESSION_LIMITS.file, 'Invalid or oversized archive file.'); total += bytes.byteLength;
  }
  requireValue(total <= SESSION_LIMITS.expanded, 'Expanded research session exceeds 256 MB.');
}
export async function createSessionArchive(payload) {
  const {files} = await prepareArchive(payload), bytes = await zipAsync(files);
  requireValue(bytes.byteLength <= SESSION_LIMITS.archive, 'Research archive exceeds 128 MB.'); return bytes;
}
export async function createSessionJSON(payload) {
  const {files} = await prepareArchive(payload);
  const content = json({schema: 'psilocin-research-session-json/1', files: Object.fromEntries(Object.entries(files).map(([path, bytes]) => [path, decoder.decode(bytes)]))});
  requireValue(encoder.encode(content).byteLength <= SESSION_LIMITS.archive, 'JSON research session exceeds 128 MB.'); return content;
}
export async function readSessionArchive(input) {
  const bytes = bytesOf(input); requireValue(bytes.byteLength <= SESSION_LIMITS.archive, 'Research session exceeds 128 MB.');
  let files;
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const expected = inspectSessionZip(bytes); files = await unzipAsync(bytes);
    requireValue(Object.keys(files).length === expected.length && expected.every(item => files[item.path]?.byteLength === item.bytes), 'ZIP contents do not match declared sizes.');
  } else {
    const envelope = JSON.parse(decoder.decode(bytes));
    requireValue(envelope?.schema === 'psilocin-research-session-json/1' && plain(envelope.files), 'Unsupported JSON research archive.');
    files = Object.fromEntries(Object.entries(envelope.files).map(([path, content]) => [path, encoder.encode(text(content, 'archive content', SESSION_LIMITS.file))]));
  }
  checkFiles(files);
  requireValue(files['manifest.json'] && files['session.json'], 'Research archive manifest is missing.');
  const manifest = JSON.parse(decoder.decode(files['manifest.json']));
  requireValue(manifest?.schema === 'psilocin-research-session-manifest/1' && manifest.session_schema === SCIENTIFIC_SESSION_SCHEMA && manifest.algorithm === 'SHA-256' && Array.isArray(manifest.files), 'Unsupported research session manifest.');
  const paths = new Set();
  for (const entry of manifest.files) {
    requireValue(safePath(entry.path) && entry.path !== 'manifest.json' && !paths.has(entry.path), 'Invalid manifest path.'); paths.add(entry.path);
    const file = files[entry.path];
    requireValue(file && file.byteLength === entry.bytes && await digest(file) === entry.sha256, `Checksum mismatch: ${entry.path}. Nothing was imported.`);
  }
  requireValue(paths.size === Object.keys(files).length - 1, 'Unlisted research archive files.');
  const raw = JSON.parse(decoder.decode(files['session.json']));
  requireValue(raw.schema === SCIENTIFIC_SESSION_SCHEMA, 'Unsupported research session version.');
  const payload = normalizePayload(raw);
  requireValue(Array.isArray(raw.datasets) && raw.datasets.length <= 100, 'Invalid session input inventory.');
  payload.datasets = await Promise.all(raw.datasets.map(async item => {
    const data = files[item.path]; requireValue(data && await digest(data) === item.sha256 && data.byteLength === item.bytes, 'Dataset checksum does not match its inventory.');
    return {...item, name: text(item.name, 'dataset name'), csv: decoder.decode(data)};
  }));
  // Rebuild portable source and run references independently; never trust imported scripts as code to execute.
  const rebuilt = await prepareArchive({...payload, datasets: payload.datasets});
  const restored = JSON.parse(decoder.decode(rebuilt.files['session.json']));
  requireValue(JSON.stringify(restored.reconstruction) === JSON.stringify(raw.reconstruction), 'Recorded run reconstruction inventory is inconsistent.');
  payload.reconstruction = restored.reconstruction;
  return payload;
}
