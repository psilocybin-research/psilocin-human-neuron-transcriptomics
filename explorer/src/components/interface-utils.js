// Small shared interface primitives; preferences are optional when browser storage is unavailable.
export function createElement(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
export function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
export function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

export function showResearchEvidence(target, title) {
  target.dispatchEvent(
    new CustomEvent("atlas:inspect", {
      bubbles: true,
      detail: { target, title },
    }),
  );
}
