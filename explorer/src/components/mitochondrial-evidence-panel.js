import { createElement as el, destroySheet, closeSheet } from './interface-utils.js';
import { uiIcon } from './icons.js';

let evidenceSequence = 0;

// One evidence tree moves between a desktop aside and a native mobile sheet.
// Selection and gene-list state survive presentation changes.
export function createMitochondrialEvidencePanel() {
  const appRoot = document.querySelector('#psilocin-app');
  const app = appRoot?.f7;
  const media = matchMedia('(max-width: 1179px)');
  const aside = el('aside', 'mito-evidence-panel');
  aside.setAttribute('aria-label', 'MitoCarta evidence panel');
  const heading = el('h2', 'mito-evidence-heading', 'Pathway evidence');
  const content = el('div', 'mito-evidence-host');
  aside.append(heading, content);

  const launcher = el('button', 'button button-tonal mito-evidence-launch');
  launcher.type = 'button';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');
  const label = el('span', '', 'Pathway evidence');
  launcher.append(uiIcon('information'), label);
  launcher.onclick = () => present();
  let sheet, sheetElement, sheetBody, expanded = false, disposed = false;
  let previousFocus;

  function sync() {
    aside.hidden = media.matches;
    launcher.hidden = !media.matches;
    if (!media.matches && sheet) {
      sheet.close(false);
      content.remove();
      destroySheet(sheet);
      sheetElement.remove();
      sheet = sheetElement = sheetBody = undefined;
      aside.append(content);
      launcher.setAttribute('aria-expanded', 'false');
    }
  }
  function makeSheet() {
    if (sheet || !app) return sheet;
    sheetElement = el('section', 'sheet-modal research-evidence-sheet mito-evidence-sheet');
    sheetElement.setAttribute('aria-label', 'MitoCarta pathway evidence');
    sheetElement.id = `mitocarta-pathway-evidence-${++evidenceSequence}`;
    launcher.setAttribute('aria-controls', sheetElement.id);
    sheetElement.setAttribute('role', 'dialog');
    const handle = el('div', 'sheet-handle');
    const header = el('header', 'evidence-sheet-header');
    const title = el('h2', '', 'Pathway evidence');
    const expand = el('button', 'button button-tonal mito-evidence-expand');
    expand.type = 'button';
    expand.setAttribute('aria-label', 'Expand pathway evidence');
    expand.append(uiIcon('fullscreen'));
    expand.onclick = () => sheet.setBreakpoint(expanded ? .62 : 1);
    const done = el('button', 'button button-tonal', 'Done');
    done.type = 'button';
    done.onclick = () => closeSheet(sheet);
    header.append(title, expand, done);
    sheetBody = el('div', 'sheet-modal-inner evidence-sheet-content mito-evidence-sheet-content');
    sheetElement.append(handle, header, sheetBody);
    appRoot.append(sheetElement);
    sheet = app.sheet.create({
      el: sheetElement, backdrop: true, push: true,
      closeByBackdropClick: true, closeOnEscape: true,
      swipeToClose: true, swipeHandler: header,
      breakpoints: [.62],
      on: {
        breakpoint(_instance, ratio) {
          expanded = ratio === 1;
          sheetElement.style.setProperty('--mito-evidence-ratio', String(ratio || .62));
          expand.setAttribute('aria-label', expanded ? 'Collapse pathway evidence' : 'Expand pathway evidence');
          expand.replaceChildren(uiIcon(expanded ? 'fullscreenExit' : 'fullscreen'));
        },
        closed() {
          launcher.setAttribute('aria-expanded', 'false');
          if (!disposed && media.matches) previousFocus?.focus?.({ preventScroll: true });
        },
      },
    });
    return sheet;
  }
  function present() {
    if (disposed) return;
    if (!media.matches) return;
    const instance = makeSheet();
    if (!instance) return;
    if (!instance.opened) {
      previousFocus = document.activeElement;
      sheetBody.append(content);
      instance.open(!matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    launcher.setAttribute('aria-expanded', 'true');
  }
  function afterClose(callback) {
    if (sheet?.opened) {
      sheet.once('closed', callback);
      closeSheet(sheet);
    } else callback();
  }
  media.addEventListener('change', sync);
  sync();
  return {
    element: aside, content, launcher, present, afterClose,
    setSelection(name) {
      label.textContent = name;
      launcher.setAttribute('aria-label', `Inspect ${name} evidence`);
    },
    dispose() {
      disposed = true;
      media.removeEventListener('change', sync);
      if (sheet) {
        sheet.close(false);
        destroySheet(sheet);
        sheetElement.remove();
      }
      aside.remove();
      launcher.remove();
    },
  };
}
