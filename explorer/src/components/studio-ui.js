import {createElement as el, readPreference, writePreference} from './interface-utils.js';

export function studioMenu(root, anchor, title, items) {
  const entries = items.filter(item => item && item.available !== false);
  let modal;
  const choose = item => {
    modal.once('closed', () => setTimeout(() => item.run?.(), 0));
    modal.close();
  };
  const on = {open(instance) {
    for(const target of instance.el.querySelectorAll('.actions-button:not(.actions-label)')) {
      target.setAttribute('role','button');target.tabIndex=0;
      target.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();target.click();}};
    }
  },closed() { setTimeout(() => modal?.destroy(), 0); }};
  if (matchMedia('(max-width: 700px)').matches) {
    modal = root.f7.actions.create({buttons: [[{text: title, label: true}, ...entries.map(item => ({text: item.label, close: false, color: item.destructive ? 'red' : undefined, onClick: () => choose(item)}))], [{text: 'Cancel', color: 'gray'}]], on});
    modal.open();
  } else {
    const content = el('div', 'popover studio-menu');
    const inner = el('div', 'popover-inner');
    inner.append(el('h3', '', title));
    for (const item of entries) {
      const button = el('button', `button ${item.destructive ? 'text-color-red' : ''}`, item.label);
      button.type = 'button'; button.onclick = () => choose(item); inner.append(button);
    }
    content.append(inner); root.append(content);
    modal = root.f7.popover.create({el: content, targetEl: anchor, closeOnEscape: true, on: {closed() { on.closed(); content.remove(); }}});
    modal.open();
  }
  return modal;
}

export function studioResizer(host, property, {label, initial, min, max, reverse = false, horizontal = false}) {
  const key = `atlas-studio-${property}`;
  let value = Math.max(min, Math.min(max, Number(readPreference(key, initial)) || initial));
  const handle = el('div', 'studio-resizer');
  handle.tabIndex = 0; handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-label', label); handle.setAttribute('aria-orientation', horizontal ? 'horizontal' : 'vertical');
  handle.setAttribute('aria-valuemin', min); handle.setAttribute('aria-valuemax', max);
  function set(next) {
    value = Math.max(min, Math.min(max, next)); host.style.setProperty(property, `${value}px`);
    handle.setAttribute('aria-valuenow', Math.round(value));
  }
  set(value);
  handle.onkeydown = event => {
    const directions = horizontal ? ['ArrowUp', 'ArrowDown'] : ['ArrowLeft', 'ArrowRight'];
    if (![...directions, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    set(event.key === 'Home' ? min : event.key === 'End' ? max : value + (event.key === directions[1] ? 16 : -16) * (reverse ? -1 : 1));
    writePreference(key, value);
  };
  let drag;
  handle.onpointerdown = event => {
    if (event.button !== 0) return;
    drag = {at: horizontal ? event.clientY : event.clientX, value};
    handle.setPointerCapture(event.pointerId); event.preventDefault();
  };
  handle.onpointermove = event => {
    if (drag) set(drag.value + ((horizontal ? event.clientY : event.clientX) - drag.at) * (reverse ? -1 : 1));
  };
  handle.onpointerup = handle.onpointercancel = () => { if (drag) writePreference(key, value); drag = null; };
  return handle;
}
