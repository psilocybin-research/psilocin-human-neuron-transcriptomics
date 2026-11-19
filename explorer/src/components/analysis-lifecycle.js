// Document operations preserve identity, recorded outputs and provenance. No code runs here.
export function moveAnalysisToTrash(workspace, bookId, now = new Date().toISOString()) {
  const index = workspace.notebooks.findIndex(book => book.id === bookId);
  if (index < 0) return false;
  workspace.trash ||= [];
  if (workspace.trash.length >= 100) throw Error('Trash contains 100 analyses. Restore or permanently delete an item first.');
  const [book] = workspace.notebooks.splice(index, 1);
  workspace.trash.push({book, index, deleted: now});
  if (workspace.active === bookId) workspace.active = workspace.notebooks[Math.min(index, workspace.notebooks.length - 1)]?.id ?? null;
  return true;
}
export function restoreAnalysis(workspace, bookId) {
  const index = (workspace.trash || []).findIndex(item => item.book.id === bookId);
  if (index < 0) return false;
  if (workspace.notebooks.length >= 30) throw Error('The limit is 30 active analyses. Move an analysis to Trash before restoring another.');
  if (workspace.notebooks.some(book => book.id === bookId)) throw Error('An analysis with this identifier already exists.');
  const [item] = workspace.trash.splice(index, 1);
  workspace.notebooks.splice(Math.min(Math.max(0, item.index), workspace.notebooks.length), 0, item.book);
  workspace.active = item.book.id;
  return true;
}
export function reorderAnalysis(workspace, bookId, to) {
  const from = workspace.notebooks.findIndex(book => book.id === bookId);
  if (from < 0 || !Number.isInteger(to) || to < 0 || to >= workspace.notebooks.length || to === from) return false;
  const [book] = workspace.notebooks.splice(from, 1);
  workspace.notebooks.splice(to, 0, book);
  return true;
}
