import { createElement as el, readPreference, writePreference } from './interface-utils.js';

// Presentation only: never modifies scientific colours, data or workspace state.
export function createAppearanceControls({ root, getApp, trigger, toggleDark, reduced }) {
  const transparency = matchMedia('(prefers-reduced-transparency: reduce)');
  let enabled = readPreference('atlas-glass-effects', 'true') !== 'false', modal;
  const surface = el('section', 'popover appearance-popover');
  surface.setAttribute('aria-label', 'Appearance');
  const inner = el('div', 'popover-inner');
  inner.append(el('h3', '', 'Appearance'));
  function switchRow(label, onChange) {
    const row = el('div', 'appearance-option'), text = el('label', '', label);
    const toggle = el('label', 'toggle'), input = el('input'), icon = el('span', 'toggle-icon');
    input.type = 'checkbox'; input.setAttribute('role', 'switch');
    input.id = `atlas-${label.toLowerCase().replaceAll(' ', '-')}`;
    text.htmlFor = input.id; input.setAttribute('aria-label', label);
    input.onchange = onChange; toggle.append(input, icon); row.append(text, toggle); inner.append(row);
    return input;
  }
  const dark = switchRow('Dark mode', () => toggleDark());
  const glass = switchRow('Glass effects', () => {
    enabled = glass.checked;
    writePreference('atlas-glass-effects', String(enabled));
    sync();
  });
  const note = el('p', 'note appearance-note'); note.id = 'atlas-glass-description';
  glass.setAttribute('aria-describedby', note.id);
  const done = el('button', 'button button-tonal', 'Done'); done.type = 'button';
  done.onclick = () => modal?.close(!reduced());
  inner.append(note, done); surface.append(inner); root.append(surface);
  function sync() {
    root.dataset.glassEffects = enabled && !transparency.matches ? 'true' : 'false';
    dark.checked = Boolean(getApp()?.darkMode);
    glass.checked = enabled && !transparency.matches;
    glass.disabled = transparency.matches;
    note.textContent = transparency.matches
      ? 'Your device’s reduced-transparency preference is active.'
      : 'Subtle glass on navigation and controls. Scientific outputs keep their own colours.';
    const app = getApp();
    if (app) app.params.touch.touchHighlight = root.dataset.glassEffects === 'true' && !reduced();
  }
  trigger.setAttribute('aria-label', 'Appearance'); trigger.title = 'Appearance';
  trigger.removeAttribute('role'); trigger.removeAttribute('aria-checked');
  trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-expanded', 'false');
  trigger.onclick = () => {
    if (!getApp()) return;
    sync();
    modal ||= getApp().popover.create({ el: surface, closeOnEscape: false,
      on: { open: () => trigger.setAttribute('aria-expanded', 'true'),
        closed: () => trigger.setAttribute('aria-expanded', 'false') } });
    modal.open(trigger, !reduced());
  };
  transparency.addEventListener('change', sync);
  sync();
  return { sync, destroy() { transparency.removeEventListener('change', sync); modal?.destroy(); surface.remove(); } };
}
