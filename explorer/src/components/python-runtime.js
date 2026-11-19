import {SCIENTIFIC_PYTHON_HELPERS} from './scientific-scene-helpers.js';
import {pythonWorkerSource} from './python-worker.js';

export const PYTHON_RESULT_LIMITS = Object.freeze({rows: 1000, columns: 100, bytes: 2_000_000});
export async function sha256Text(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export function createPythonRuntime({baseURL = new URL('python/', document.baseURI)} = {}) {
  const indexURL = new URL('./', baseURL).href;
  const blobURL = URL.createObjectURL(new Blob([pythonWorkerSource], {type: 'text/javascript'}));
  const worker = new Worker(blobURL, {type: 'module', name: 'atlas-python-lab'});
  URL.revokeObjectURL(blobURL);
  const pending = new Map();
  let sequence = 0, closed = false, initialization;
  function request(type, args) {
    if (closed) return Promise.reject(Error('Python worker was stopped.'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, {resolve, reject}); worker.postMessage({id, type, ...args});
    });
  }
  worker.onmessage = ({data}) => {
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error) {
      const error = Error(data.error); error.output = data.output || []; entry.reject(error);
    } else entry.resolve(data.value);
  };
  worker.onerror = event => {
    for (const item of pending.values()) item.reject(Error(event.message || 'Python worker failed.'));
    pending.clear();
  };
  return {
    init() { return initialization ||= request('init', {moduleURL: new URL('pyodide.mjs', indexURL).href, indexURL}); },
    run(payload) { return request('run', {payload: {...payload, helpers: SCIENTIFIC_PYTHON_HELPERS}}); },
    close() {
      if (closed) return;
      closed = true; worker.terminate();
      for (const item of pending.values()) item.reject(Error('Python worker was stopped.'));
      pending.clear();
    },
  };
}
