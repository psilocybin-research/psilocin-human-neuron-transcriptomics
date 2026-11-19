import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {unzipSync, zipSync} from 'fflate';
import {createSessionArchive, createSessionJSON, readSessionArchive, inspectSessionZip} from '../src/components/scientific-session.js';
const hash = text => createHash('sha256').update(text).digest('hex');
const csv = 'value\n1.125\n2.25\n';
const rCode = "user_data <- read.csv('/home/web_user/user_data.csv'); results <- data.frame(total=sum(user_data$value))";
const pythonCode = 'results = [{"total": sum(float(row["value"]) for row in data)}]';
function fixture() {
  const r = {schema: 'psilocin-research-notebooks/1', active: 'r1', notebooks: [{id: 'r1', title: 'R fixture', created: '2026-11-19T00:00:00Z', cells: [{id: 'c1', kind: 'code', source: rCode, runs: [{run_utc: '2026-11-19T00:00:01Z', code: rCode, inputs: {user_data: {sha256: hash(csv), rows: 2}}, results_csv: '"total"\n3.375\n', console: '', vector_svgs: []}]}]}]};
  const pyRun = {language: 'python', classification: 'user-exploratory', code: pythonCode, code_sha256: hash(pythonCode), csv: 'total\n3.375\n', csv_sha256: hash('total\n3.375\n'), run_utc: '2026-11-19T00:00:02Z', rows: 1, columns: ['total'], console: [], inputs: [{name: 'user_data', sha256: hash(csv)}], selected_dataset: 'user_data', runtime: {version: '314.0.8'}, namespace: 'fresh-per-run', seed: 20261119};
  return {r: {notebooks: r}, python_notebooks: [{id: 'p1', name: 'Python fixture', code: pythonCode, runs: [pyRun]}], datasets: [{name: 'user_data', csv, provenance: {classification: 'synthetic-test'}}], selection: {gene: 'ENSG000001', collections: []}, projects: [], transferred_datasets: []};
}

test('Session ZIP and JSON round trips preserve code, exact inputs and run reconstruction without execution', async () => {
  for (const make of [createSessionArchive, createSessionJSON]) {
    const restored = await readSessionArchive(await make(fixture()));
    assert.equal(restored.schema, 'psilocin-research-session/2');
    assert.equal(restored.r.notebooks.notebooks[0].cells[0].source, rCode);
    assert.equal(restored.datasets[0].csv, csv);
    assert.equal(restored.python_notebooks[0].runs[0].csv, 'total\n3.375\n');
    assert.equal(restored.reconstruction.runs.length, 2);
    assert.ok(restored.reconstruction.runs.every(run => run.reconstructable));
  }
});
test('Session refuses checksum tampering, unlisted files and path traversal', async () => {
  const archive = await createSessionArchive(fixture());
  const files = unzipSync(archive);
  files['inputs/table-0001.csv'] = new TextEncoder().encode('value\n99\n');
  await assert.rejects(readSessionArchive(zipSync(files)), /Checksum mismatch/);
  const extras = unzipSync(archive); extras['unlisted.txt'] = new Uint8Array([1]);
  await assert.rejects(readSessionArchive(zipSync(extras)), /Unlisted/);
  assert.throws(() => inspectSessionZip(zipSync({'../escape.txt': new Uint8Array([1])})), /Unsafe/);
  const envelope = JSON.parse(await createSessionJSON(fixture())); envelope.files['session.json'] += ' ';
  await assert.rejects(readSessionArchive(JSON.stringify(envelope)), /Checksum mismatch/);
});
test('Session rejects oversized expanded ZIP data before decompression', async () => {
  const bytes = await createSessionArchive(fixture());
  const copy = bytes.slice(), view = new DataView(copy.buffer);
  for (let i = 0; i < copy.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 40_000_000, true); break; }
  assert.throws(() => inspectSessionZip(copy), /size limit/);
});
test('Missing historical input is explicitly nonreconstructable and fails native replay', async () => {
  const payload = fixture(); payload.datasets = [];
  const archive = await createSessionArchive(payload), restored = await readSessionArchive(archive);
  assert.ok(restored.reconstruction.runs.every(run => !run.reconstructable));
  const files = unzipSync(archive);
  assert.match(new TextDecoder().decode(files['replay/r-0001/analysis.R']), /Required recorded inputs are missing/);
});
test('Session validates recorded code hashes and preserves no silently discarded outputs', async () => {
  const payload = fixture(); payload.python_notebooks[0].runs[0].code += '\nprint("changed")';
  await assert.rejects(createSessionArchive(payload), /source checksum/);
  const invalid = fixture(); invalid.python_notebooks[0].runs.push({code: 'bad'});
  await assert.rejects(createSessionArchive(invalid), /Invalid or oversized/);
});
test('Exported R and Python scripts reconstruct recorded totals from exact archived CSV bytes', {skip:spawnSync('Rscript',['--version']).error ? 'Native R is unavailable in this environment' : false}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-session-test-'));
  try {
    const files = unzipSync(await createSessionArchive(fixture()));
    for (const [path, bytes] of Object.entries(files)) { const full = join(directory, path); await mkdir(dirname(full), {recursive: true}); await writeFile(full, bytes); }
    execFileSync('Rscript', ['analysis.R'], {cwd: join(directory, 'replay/r-0001'), timeout: 30000});
    execFileSync('python3', ['analysis.py'], {cwd: join(directory, 'replay/python-0002'), timeout: 30000});
    assert.equal(await readFile(join(directory, 'replay/r-0001/replayed-results.csv'), 'utf8'), '"total"\n3.375\n');
    assert.equal(await readFile(join(directory, 'replay/python-0002/replayed-results.csv'), 'utf8'), 'total\n3.375\n');
  } finally { await rm(directory, {recursive: true, force: true}); }
});
