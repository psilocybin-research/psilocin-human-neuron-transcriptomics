import {createElement as el, readPreference, writePreference, destroySheet} from './interface-utils.js';
import {studioMenu} from './studio-ui.js';
import {rExamples} from './r-examples.js';
import {uiIcon} from './icons.js';

// Navigation changes never rebuild the editor or execute a notebook.
export function createAnalysisNavigation({root, sidebar, action, newBook, getWorkspace, isBusy, onChoose, onRename, onDuplicate, onTrash, onRestore, onReorder, onExport, onPermanentDelete, onArchived, onTools, onOpenSystems, examples=rExamples, language='r', maxActive=30}) {
  let query='', searchOpen=false, reordering=false, trashModal, disposed=false, searchCloseTimer;
  const openedGroups = new Set();
  const container=el('div','analysis-navigation page'),content=el('div','page-content');container.append(content);
  const head=el('div','studio-sidebar-head'),searchToggle=el('button','button button-round analysis-search-toggle');searchToggle.type='button';searchToggle.setAttribute('aria-label','Find analyses');searchToggle.setAttribute('aria-expanded','false');searchToggle.append(uiIcon('search'));
  newBook.classList.add('analysis-new-button');newBook.replaceChildren(uiIcon('plus'),el('span','','New'));newBook.setAttribute('aria-label','New analysis');newBook.title='New analysis';head.append(el('h3','','Analyses'),searchToggle,newBook);
  const search=el('form','searchbar searchbar-expandable analysis-search');search.inert=true;search.setAttribute('aria-hidden','true');search.setAttribute('role','search');search.onsubmit=e=>e.preventDefault();
  const searchInner=el('div','searchbar-inner'),inputWrap=el('div','searchbar-input-wrap'),input=el('input');input.type='search';input.placeholder='Find analyses';input.setAttribute('aria-label','Find analyses');
  const searchIcon=el('i','searchbar-icon'),clear=el('button','input-clear-button'),closeSearch=el('button','searchbar-disable-button');clear.type=closeSearch.type='button';clear.setAttribute('aria-label','Clear analysis search');closeSearch.setAttribute('aria-label','Close analysis search');closeSearch.append(uiIcon('close'));clear.hidden=true;searchIcon.setAttribute('aria-hidden','true');inputWrap.append(input,searchIcon,clear);searchInner.append(inputWrap);search.append(searchInner,closeSearch);head.append(search);
  const suggestions=el('div','list analysis-search-suggestions'),suggestionList=el('ul');suggestions.append(suggestionList);
  const groups=el('div','list analysis-groups'),groupList=el('ul');groups.append(groupList);
  function group(name,key,initial){
    const row=el('li','accordion-item'),toggle=el('a','item-link item-content');toggle.href='#';toggle.setAttribute('role','button');
    const label=el('div','item-inner'),text=el('span','item-title',name),count=el('span','item-after');label.append(text,count);toggle.append(label);
    const body=el('div','accordion-item-content');body.id=`analysis-group-${language}-${key}`;toggle.setAttribute('aria-controls',body.id);
    const expanded=false;row.classList.toggle('accordion-item-opened',expanded);toggle.setAttribute('aria-expanded',String(expanded));
    for(const [event,open] of [['accordion:open',true],['accordion:close',false]])row.addEventListener(event,()=>{toggle.setAttribute('aria-expanded',String(open));if(!query){if(open)openedGroups.add(key);else openedGroups.delete(key);}});
    toggle.onkeydown=e=>{if(e.key===' '){e.preventDefault();toggle.click();}};row.append(toggle,body);groupList.append(row);return {row,toggle,body,count,key,initial};
  }
  const archive=group('Study result scripts','study',true),personal=group('My analyses','personal',true),extensions=group('Exploratory extensions','extensions',false);
  const orderBar=el('div','analysis-order-bar'),orderToggle=action('Reorder','controls',()=>{reordering=!reordering;render();}),orderHelp=el('span','note','Drag a handle or use its arrow keys.');orderBar.append(orderToggle,orderHelp);
  const books=el('div','list sortable studio-book-list'),bookList=el('ul');books.append(bookList);personal.body.append(orderBar,books);
  const archived=el('div','studio-archived-analyses'),advanced=el('div','studio-archived-analyses');
  archived.append(el('p','note','Inspect archived results from our re-analysis of Schmidt et al. Choose a script to create an editable copy.'));
  const provenance=el('details','study-script-provenance');provenance.append(el('summary','','What these scripts reproduce'),el('p','note','These scripts reconstruct summaries and plots from archived estimates. They do not refit the original RNA-seq models or rerun enrichment. Changing parameters creates an exploratory analysis; the archived results stay unchanged.'));
  archived.append(provenance);
  advanced.append(el('p','note','Optional diagnostics and model exploration. These are not additional confirmatory results. The Bayesian script uses browser quadrature, not the archived PyMC sampler.'));
  const scriptEntries=[];
  for(const example of examples){
    const optional=['threshold','bayesian'].includes(example.id),button=action(example.title,'custom-r',()=>onArchived(example));
    button.dataset.title=example.title;button.title='Create editable copy; code runs only when you choose Run';
    (optional?advanced:archived).append(button);scriptEntries.push({button,optional});
  }
  archive.body.append(archived);extensions.body.append(advanced);
  const resources=el('div','studio-sidebar-resources'),trash=action('Trash','close',openTrash);if(onOpenSystems)resources.append(action('Molecular systems','plus',onOpenSystems));if(onTools)resources.append(action('Data & settings','controls',onTools));resources.append(trash);
  const empty=el('p','note analysis-search-empty','No matching analyses.');empty.setAttribute('role','status');content.append(head,suggestions,groups,empty,resources);sidebar.append(container);
  function setSearchOpen(open,{focus=false}={}){clearTimeout(searchCloseTimer);searchOpen=open;search.inert=!open;search.setAttribute('aria-hidden',String(!open));container.classList.toggle('analysis-search-open',open);search.classList.toggle('searchbar-enabled',open);searchToggle.setAttribute('aria-expanded',String(open));clear.hidden=!query;if(open){render();if(focus)requestAnimationFrame(()=>input.focus());}else if(!query)render();}
  searchToggle.onclick=()=>setSearchOpen(!searchOpen,{focus:!searchOpen});
  closeSearch.onclick=()=>{input.value='';query='';setSearchOpen(false);searchToggle.focus();};
  clear.onclick=()=>{input.value='';query='';clear.hidden=true;render();input.focus();};
  input.onfocus=()=>{clearTimeout(searchCloseTimer);setSearchOpen(true);};
  input.onblur=()=>{clearTimeout(searchCloseTimer);if(!searchOpen)return;searchCloseTimer=setTimeout(()=>{if(searchOpen&&!query)setSearchOpen(false);},140);};
  input.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();input.value='';query='';setSearchOpen(false);searchToggle.focus();}else if(e.key==='ArrowDown'&&suggestionList.firstElementChild){e.preventDefault();suggestionList.querySelector('button')?.focus();}};
  input.oninput=()=>{query=input.value.trim().toLocaleLowerCase();clear.hidden=!query;reordering=false;render();};
  function matches(title){return title.toLocaleLowerCase().includes(query);}
  function menuItems(book){const workspace=getWorkspace(),index=workspace.notebooks.indexOf(book);return [
    {label:'Rename',run:()=>onRename(book)},{label:'Duplicate',disabled:workspace.notebooks.length>=maxActive,run:()=>onDuplicate(book)},
    {label:language==='python'?'Export Python script':'Export HTML',run:()=>onExport(book)},
    {label:'Move up',available:reordering,disabled:index===0,run:()=>onReorder(book.id,index-1)},
    {label:'Move down',available:reordering,disabled:index===workspace.notebooks.length-1,run:()=>onReorder(book.id,index+1)},
    {label:'Move to Trash',destructive:true,run:()=>onTrash(book)}];}
  function render(){
    if(disposed)return;const workspace=getWorkspace(),scroll=content.scrollTop,focusId=document.activeElement?.closest('[data-book-id]')?.dataset.bookId,focusedHandle=document.activeElement?.classList.contains('sortable-handler');
    bookList.replaceChildren();books.classList.toggle('sortable-opened',reordering);orderToggle.textContent=reordering?'Done':'Reorder';orderToggle.setAttribute('aria-pressed',String(reordering));orderHelp.hidden=!reordering;orderBar.hidden=!!query||workspace.notebooks.length<2;
    let shown=0;
    for(const book of workspace.notebooks){if(!matches(book.title))continue;shown++;
      const row=el('li',`studio-book-entry${reordering?'':' swipeout'}`);row.dataset.bookId=book.id;
      const face=el('div','swipeout-content'),open=action(book.title,'custom-r',()=>onChoose(book));open.setAttribute('aria-current',String(book.id===workspace.active));open.title=book.title;
      const menu=action('⋯','controls',()=>studioMenu(root,menu,book.title,menuItems(book)));menu.setAttribute('aria-label',`Actions for analysis ${book.title}`);face.append(open,menu);row.append(face);
      if(reordering){const handle=el('button','sortable-handler');handle.type='button';handle.setAttribute('aria-label',`Reorder ${book.title}; use arrow keys`);handle.onkeydown=e=>{if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const index=workspace.notebooks.indexOf(book),to=e.key==='Home'?0:e.key==='End'?workspace.notebooks.length-1:index+(e.key==='ArrowDown'?1:-1);onReorder(book.id,to);}};row.append(handle);}
      else{const actions=el('div','swipeout-actions-right'),more=el('a','','More'),remove=el('a','color-red','Trash');more.href=remove.href='#';more.setAttribute('role','button');remove.setAttribute('role','button');more.setAttribute('aria-label',`More actions for ${book.title}`);remove.setAttribute('aria-label',`Move ${book.title} to Trash`);more.onclick=e=>{e.preventDefault();root.f7.swipeout.close(row,()=>studioMenu(root,menu,book.title,menuItems(book)));};remove.onclick=e=>{e.preventDefault();if(!isBusy())onTrash(book);};actions.append(more,remove);row.append(actions);}
      bookList.append(row);
    }
    personal.count.textContent=String(workspace.notebooks.length);
    archive.count.textContent=String(scriptEntries.filter(x=>!x.optional).length);
    extensions.count.textContent=String(scriptEntries.filter(x=>x.optional).length);
    let archivedShown=0,advancedShown=0;
    for(const {button,optional} of scriptEntries){button.hidden=!matches(button.dataset.title);if(!button.hidden){if(optional)advancedShown++;else archivedShown++;}}
    suggestionList.replaceChildren();
    if(searchOpen){
      const candidates=[...workspace.notebooks.filter(book=>matches(book.title)).map(book=>({title:book.title,detail:'My analysis',run:()=>onChoose(book)})),...scriptEntries.filter(({button})=>matches(button.dataset.title)).map(({button,optional})=>({title:button.dataset.title,detail:optional?'Exploratory extension':'Study result script',run:()=>onArchived(examples.find(example=>example.title===button.dataset.title))}))].slice(0,6);
      for(const candidate of candidates){const row=el('li'),choice=el('button','item-content analysis-search-suggestion');choice.type='button';choice.append(el('div','item-inner',candidate.title),el('div','item-after',candidate.detail));choice.onclick=()=>{candidate.run();input.value='';query='';setSearchOpen(false);};row.append(choice);suggestionList.append(row);}
      suggestions.hidden=!candidates.length;
    }else suggestions.hidden=true;
    empty.hidden=shown+archivedShown+advancedShown>0||!query;
    personal.row.hidden=!!query&&!shown;
    archive.row.hidden=!scriptEntries.some(x=>!x.optional)||(!!query&&!archivedShown);
    extensions.row.hidden=!scriptEntries.some(x=>x.optional)||(!!query&&!advancedShown);
    for(const section of [archive,personal,extensions]){const expanded=query?true:openedGroups.has(section.key);section.row.classList.toggle('accordion-item-opened',expanded);section.toggle.setAttribute('aria-expanded',String(expanded));section.body.style.height='';}
    if(!workspace.notebooks.length&&!query)bookList.append(el('li','analysis-list-empty','No personal analyses. Create one or open a study result script.'));
    trash.textContent=`Trash${workspace.trash?.length?` (${workspace.trash.length})`:''}`;
    content.scrollTop=scroll;
    if(focusId){const row=[...bookList.children].find(item=>item.dataset.bookId===focusId);row?.querySelector(focusedHandle?'.sortable-handler':'.swipeout-content > button')?.focus({preventScroll:true});}
    setBusy(isBusy());renderTrash();
  }
  const onSort=event=>{if(isBusy()||!reordering)return;const row=event.target.closest('[data-book-id]');if(row)setTimeout(()=>{if(!disposed&&!isBusy())onReorder(row.dataset.bookId,event.detail.to);},0);};books.addEventListener('sortable:sort',onSort);
  function setBusy(value){for(const button of content.querySelectorAll('button,input'))button.disabled=value;groups.inert=value;if(trashModal)trashModal.el.inert=value;}
  function renderTrash(){if(!trashModal)return;const body=trashModal.el.querySelector('.analysis-trash-items');body.replaceChildren();const items=getWorkspace().trash||[];if(!items.length)body.append(el('p','note','Trash is empty.'));
    for(const item of [...items].reverse()){const row=el('div','analysis-trash-row');row.append(el('strong','',item.book.title),el('small','note',`Moved to Trash ${new Date(item.deleted).toLocaleDateString()}`),action('Restore','top',()=>onRestore(item.book.id)),action('Delete permanently…','close',()=>onPermanentDelete(item.book.id)));body.append(row);}}
  async function openTrash(){if(isBusy())return;await root.workspaceShell?.closeNavigation();if(trashModal){trashModal.open();return;}
    const sheet=el('div','sheet-modal studio-pane-sheet analysis-trash-sheet'),inner=el('div','sheet-modal-inner'),handle=el('div','workspace-sheet-handle');handle.append(el('span'));
    const header=el('div','analysis-trash-header');header.append(el('h3','','Trash'),action('Done','close',()=>trashModal.close()));inner.append(handle,header,el('p','note','Restore analyses with their recorded outputs. Permanent deletion cannot be undone.'),el('div','analysis-trash-items'));sheet.append(inner);root.append(sheet);
    trashModal=root.f7.sheet.create({el:sheet,backdrop:true,closeOnEscape:true,swipeToClose:true,swipeHandler:handle,on:{closed(instance){trashModal=undefined;destroySheet(instance);sheet.remove();trash.focus();}}});renderTrash();trashModal.open();
  }
  return {render,setBusy,openTrash,reveal(){query='';input.value='';setSearchOpen(false);openedGroups.add('personal');render();},destroy(){disposed=true;clearTimeout(searchCloseTimer);books.removeEventListener('sortable:sort',onSort);if(trashModal){const instance=trashModal;trashModal=undefined;instance.close(false);}}};
}
