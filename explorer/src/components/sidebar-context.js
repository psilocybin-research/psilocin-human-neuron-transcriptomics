import {createElement as el} from './interface-utils.js';

// Native F7 animated tabs inside the existing left panel. Switching navigation
// preserves both DOM trees, scroll positions, editors and computational sessions.
export function createSidebarContext({panel, nav, getApp, openWorkspace, reduced}) {
  const controls=el('div','segmented segmented-strong sidebar-context-switch');
  controls.setAttribute('role','tablist');controls.setAttribute('aria-label','Sidebar navigation');
  const wrap=el('div','tabs-animated-wrap sidebar-context-wrap'),tabs=el('div','tabs');
  const atlas=el('div','tab tab-active sidebar-atlas-pane'),workspace=el('div','tab sidebar-workspace-pane');
  atlas.id='sidebar-atlas';workspace.id='sidebar-workspace';
  const buttons=new Map();
  for(const [name,pane] of [['Atlas',atlas],['Workspace',workspace]]) {
    const button=el('button','button',name);button.type='button';button.id=`${pane.id}-tab`;
    button.setAttribute('role','tab');button.setAttribute('aria-controls',pane.id);
    pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby',button.id);
    button.onclick=()=>{if(pane===workspace&&!workspace.firstElementChild){openWorkspace();return;}show(pane);};
    button.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();
      const next=event.key==='Home'?atlas:event.key==='End'?workspace:pane===atlas?workspace:atlas;
      buttons.get(next).focus();buttons.get(next).click();
    };
    controls.append(button);buttons.set(pane,button);
  }
  controls.append(el('span','segmented-highlight'));
  atlas.append(nav);tabs.append(atlas,workspace);wrap.append(tabs);panel.append(controls,wrap);
  function show(pane,animate=!reduced()) {
    if(getApp())getApp().tab.show(pane,buttons.get(pane),animate);
    for(const [target,button] of buttons){
      const selected=target===pane;
      target.inert=!selected;target.setAttribute('aria-hidden',String(!selected));
      button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
      button.classList.toggle('button-active',selected);
    }
  }
  nav.addEventListener('click',event=>{
    if(event.target.closest('[data-section=custom-r]')&&workspace.firstElementChild)show(workspace);
  });
  show(atlas,false);
  return {atlas:()=>show(atlas),mount(element){workspace.replaceChildren(element);show(workspace);},
    unmount(){show(atlas);workspace.replaceChildren();}};
}
