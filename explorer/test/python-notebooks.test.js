import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePythonNotebooks, retainPythonRun} from '../src/components/python-notebooks.js';
const book = () => ({id: 'a', name: 'Analysis', code: 'print(1)', runs: []});
const run = n => ({language: 'python', classification: 'user-exploratory', code: 'print(1)', csv: 'a\n1\n', run_utc: `2026-11-19T12:00:0${n}Z`, rows: 1, columns: ['a'], console: [{text: '1'}], code_sha256: 'a'.repeat(64), csv_sha256: 'b'.repeat(64), runtime: {version: '314.0.8'}});
test('Python notebook history retains three full outputs and migrates script-only saves', () => {
  const b = book(); const books = [b];
  for (let i = 0; i < 4; i++) retainPythonRun(books, b, run(i));
  assert.equal(b.runs.length, 3); assert.match(b.runs[0].run_utc, /01Z$/);
  assert.deepEqual(parsePythonNotebooks(JSON.stringify(books)), books);
  const legacy = book(); delete legacy.runs;
  assert.deepEqual(parsePythonNotebooks(JSON.stringify([legacy]))[0].runs, []);
});
test('Python history rejects oversized runs and invalid saved records', () => {
  const b = book(); const large = {...run(1), csv: 'x'.repeat(750001)};
  assert.equal(retainPythonRun([b], b, large).saved, false);
  b.runs = [{...run(1), code_sha256: 'invalid'}];
  assert.deepEqual(parsePythonNotebooks(JSON.stringify([b]))[0].runs, []);
  assert.throws(() => parsePythonNotebooks(JSON.stringify([b, b])), /Invalid/);
});
test('Python history evicts oldest outputs across notebooks at the global limit', () => {
  const first = book(), second = {...book(), id: 'b'}; const books = [first, second];
  for (let n = 0; n < 6; n++) retainPythonRun(books, n < 3 ? first : second, {...run(n), csv: 'x'.repeat(600000)});
  assert.ok(new TextEncoder().encode(JSON.stringify(books)).byteLength <= 3000000);
  assert.equal(books.flatMap(item => item.runs).length, 4);
  assert.match(first.runs[0].run_utc, /02Z$/);
});

test('Python workspace preserves Trash, empty state and identity across reloads', async () => {
 const {parsePythonWorkspace}=await import('../src/components/python-notebooks.js');
 const original=book();original.runs=[run(1)];
 const workspace=parsePythonWorkspace({notebooks:[],trash:[{book:original,index:0,deleted:'2026-11-19T12:00:00Z'}],active:original.id});
 assert.equal(workspace.active,null);assert.deepEqual(workspace.trash[0].book,original);
 assert.deepEqual(parsePythonNotebooks('[]'),[]);
 assert.throws(()=>parsePythonWorkspace({...workspace,notebooks:[original]}),/unique/);
 assert.throws(()=>parsePythonWorkspace({...workspace,trash:[{...workspace.trash[0],book:{...original,runs:[{}]}}]}),/Invalid recorded/);
});
