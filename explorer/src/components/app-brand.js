// Shared vector geometry for the sidebar, installed app icons and initial loader.
export const brandGlyph =
  '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 5v22M6 7c1 1 1 3 1 6v2c0 8 18 8 18 0v-2c0-3 0-5 1-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function brandIcon(maskable = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="${maskable ? 0 : 12}" fill="#235780"/><g color="white" transform="${maskable ? "translate(8 8) scale(.75)" : "translate(4 4)"}">${brandGlyph.replace("<svg ", '<svg width="32" height="32" ')}</g></svg>`;
}
