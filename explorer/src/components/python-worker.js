// A dedicated worker isolates Python execution from the interface thread.
// This source is embedded so the built application does not depend on source paths.
export const pythonWorkerSource = String.raw`
let pyodide;
let output = [];
let outputBytes = 0;
const limit = 100000;
function append(stream, value) {
  if (outputBytes >= limit) return;
  const text = String(value).slice(0, limit - outputBytes);
  outputBytes += text.length;
  output.push({stream, text});
}
self.onmessage = async ({data}) => {
  const {id, type} = data;
  try {
    if (type === 'init') {
      const {loadPyodide} = await import(data.moduleURL);
      pyodide = await loadPyodide({indexURL: data.indexURL,
        stdout: text => append('stdout', text), stderr: text => append('stderr', text)});
      self.postMessage({id, value: {version: pyodide.version, python: pyodide.runPython('import sys; sys.version'),
        standard_library: JSON.parse(pyodide.runPython('import json, importlib; json.dumps([name for name in ["csv", "json", "math", "statistics", "random", "itertools", "collections", "decimal", "fractions", "datetime", "pathlib"] if importlib.import_module(name)])'))}});
      return;
    }
    if (type !== 'run' || !pyodide) throw Error('Initialize Python first.');
    output = []; outputBytes = 0;
    pyodide.globals.set('_atlas_payload', JSON.stringify(data.payload));
    const result = await pyodide.runPythonAsync(\`
import csv as _csv, io as _io, json as _json, random as _random, math as _math
from pathlib import Path as _AtlasPath
_atlas_input = _json.loads(_atlas_payload)
_atlas_datasets = {}
for _item in _atlas_input['datasets']:
    _atlas_datasets[_item['name']] = list(_csv.DictReader(_io.StringIO(_item['csv'])))
_random.seed(20261119)
_atlas_scope = {'__name__': '__main__', 'datasets': _atlas_datasets,
                'data': _atlas_datasets.get(_atlas_input['selected'], []),
                'dataset_name': _atlas_input['selected']}
_atlas_scene_path = _AtlasPath('/home/pyodide/atlas_scene.json')
_atlas_scene_path.unlink(missing_ok=True)
exec(_atlas_input.get('helpers', ''), _atlas_scope)
exec(compile(_atlas_input['code'], '<python-notebook>', 'exec'), _atlas_scope)
_atlas_scenes = []
if _atlas_scene_path.exists():
    if _atlas_scene_path.stat().st_size > 20000000:
        raise ValueError('Scene output exceeds 20 MB.')
    _atlas_scenes.append(_json.loads(_atlas_scene_path.read_text(encoding='utf-8')))
_atlas_rows = _atlas_scope.get('results', [])
if not isinstance(_atlas_rows, list):
    raise TypeError('Assign results to a list of dictionaries to export a table.')
if len(_atlas_rows) > 1000:
    raise ValueError('Results exceed 1,000 rows; reduce the output before exporting.')
_atlas_headers = []
for _row in _atlas_rows:
    if not isinstance(_row, dict):
        raise TypeError('Each results row must be a dictionary.')
    for _key, _value in _row.items():
        if not isinstance(_key, str) or not _key.strip():
            raise TypeError('Results column names must be nonempty strings.')
        if _key not in _atlas_headers:
            _atlas_headers.append(_key)
        if _value is not None and not isinstance(_value, (str, int, float, bool)):
            raise TypeError('Results values must be strings, numbers, booleans or None.')
        if isinstance(_value, float) and not _math.isfinite(_value):
            raise ValueError('Results contain nonfinite numbers; use None for missing values.')
if len(_atlas_headers) > 100:
    raise ValueError('Results exceed 100 columns.')
_atlas_buffer = _io.StringIO(newline='')
if _atlas_headers:
    _atlas_writer = _csv.DictWriter(_atlas_buffer, fieldnames=_atlas_headers, lineterminator='\\n')
    _atlas_writer.writeheader()
    _atlas_writer.writerows(_atlas_rows)
_atlas_csv = _atlas_buffer.getvalue()
if len(_atlas_csv.encode('utf-8')) > 2000000:
    raise ValueError('Results exceed 2 MB; reduce the output before exporting.')
_json.dumps({'csv': _atlas_csv, 'rows': len(_atlas_rows), 'columns': _atlas_headers, 'scene_specs': _atlas_scenes})
\`);
    self.postMessage({id, value: {...JSON.parse(result), output, outputTruncated: outputBytes >= limit}});
  } catch (error) {
    self.postMessage({id, error: String(error.message || error), output});
  }
};
`.replaceAll('\\`', '`');
