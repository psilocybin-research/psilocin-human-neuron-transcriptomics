// Shared activity state follows real promises and rendering, never invented percentages.
const pending = new Map();
const listeners = new Set();
function notify() {
  const state = {
    busy: pending.size > 0,
    label: [...pending.values()].at(-1) || "",
  };
  for (const listener of listeners) listener(state);
}
export function beginActivity(label = "Updating research view") {
  const token = Symbol(label);
  pending.set(token, label);
  notify();
  return () => {
    if (pending.delete(token)) notify();
  };
}
export function afterPaint(callback) {
  requestAnimationFrame(() => requestAnimationFrame(callback));
}
export function trackActivity(promise, label) {
  const finish = beginActivity(label);
  return Promise.resolve(promise).finally(() => afterPaint(finish));
}
export function observeActivity(listener) {
  listeners.add(listener);
  listener({
    busy: pending.size > 0,
    label: [...pending.values()].at(-1) || "",
  });
  return () => listeners.delete(listener);
}
