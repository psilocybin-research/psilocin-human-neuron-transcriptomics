import {moveAnalysisToTrash, restoreAnalysis, reorderAnalysis} from "./analysis-lifecycle.js";
import {createAnalysisNavigation} from "./analysis-navigation.js";
import {createWorkspaceLayout} from "./workspace-layout.js";
import {createREditor} from "../assets/vendor/r-editor.js";
import {studioMenu, studioResizer, confirmPermanentDeletion} from "./studio-ui.js";
import {parseExploratoryCSV} from "./exploratory-result-data.js";
import {notebookPublication} from "./notebook-publication.js";
// Local notebooks contain researcher-authored material only. They never execute on load.
import { createElement as el, escapeHTML, destroySheet } from "./interface-utils.js";
import { downloadFile } from "./file-download.js";
import { rExamples } from "./r-examples.js";
import { createRRecipeBuilder } from "./r-recipe-builder.js";

const databaseName = "psilocin-research-studio-v1";
export const notebookSchema = "psilocin-research-notebooks/1";
const id = () => crypto.randomUUID();
export function createNotebook(title = "Untitled notebook", code = "") {
  return {
    id: id(),
    title: title.slice(0, 120),
    created: new Date().toISOString(),
    cells: [{ id: id(), kind: "code", source: code, runs: [] }],
  };
}
export function validateWorkspace(value, includeTrash = true) {
  if (
    value?.schema !== notebookSchema ||
    !Array.isArray(value.notebooks) ||
    value.notebooks.length > 30
  )
    throw Error(
      "Choose a Workspace notebook export with 0–30 analyses.",
    );
  const notebooks = value.notebooks.map((book) => {
    if (
      !book ||
      !Array.isArray(book.cells) ||
      !book.cells.length ||
      book.cells.length > 200
    )
      throw Error("A notebook may contain at most 200 cells.");
    return {
      id: String(book.id || id()),
      title: String(book.title || "Untitled notebook").slice(0, 120),
      created: String(book.created || new Date().toISOString()),
      cells: book.cells.map((cell) => {
        if (
          !cell ||
          !["code", "markdown"].includes(cell.kind) ||
          typeof cell.source !== "string" ||
          cell.source.length > 65536
        )
          throw Error(
            "Invalid notebook cell or code exceeds 65,536 characters.",
          );
        return {
          id: String(cell.id || id()),
          kind: cell.kind,
          source: cell.source,
          runs: Array.isArray(cell.runs)
            ? cell.runs
                .slice(-20)
                .filter(
                  (run) =>
                    run && typeof run === "object" && !Array.isArray(run),
                )
                .map((run) => ({
                  ...run,
                  console:
                    typeof run.console === "string"
                      ? run.console.slice(0, 200000)
                      : "",
                  results_csv:
                    typeof run.results_csv === "string" ? run.results_csv : "",
                  vector_svgs: Array.isArray(run.vector_svgs)
                    ? run.vector_svgs
                        .filter((svg) => typeof svg === "string")
                        .slice(0, 4)
                    : [],
                }))
            : [],
        };
      }),
    };
  });
  if (
    new Set(notebooks.map((book) => book.id)).size !== notebooks.length ||
    notebooks.some(
      (book) =>
        new Set(book.cells.map((cell) => cell.id)).size !== book.cells.length,
    )
  )
    throw Error("Notebook and cell identifiers must be unique.");
  const trash = includeTrash && value.trash !== undefined ? value.trash : [];
  if (!Array.isArray(trash) || trash.length > 100) throw Error("Trash may contain at most 100 analyses.");
  const deleted = trash.map(item => {
    if (!item || !Number.isInteger(item.index) || item.index < 0 || typeof item.deleted !== 'string' || !Number.isFinite(Date.parse(item.deleted))) throw Error("Invalid trashed analysis record.");
    return {book: validateWorkspace({schema: notebookSchema, notebooks: [item.book]}, false).notebooks[0], index: item.index, deleted: item.deleted};
  });
  const identities = [...notebooks, ...deleted.map(item => item.book)].map(book => book.id);
  if (new Set(identities).size !== identities.length) throw Error("Active and trashed analysis identifiers must be unique.");
  return {
    schema: notebookSchema,
    notebooks,
    trash: deleted,
    active: notebooks.some((book) => book.id === value.active)
      ? value.active
      : notebooks[0]?.id ?? null,
  };
}
export async function verifyNotebookArchive(value, cryptoAPI = globalThis.crypto) {
  const {integrity, ...payload} = value || {};
  if (integrity?.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/.test(integrity.sha256 || ""))
    throw Error("Choose a notebook export with a SHA-256 integrity record.");
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = [...new Uint8Array(await cryptoAPI.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
  if (hash !== integrity.sha256) throw Error("Notebook checksum mismatch. The file is altered or incomplete; nothing was imported.");
  return validateWorkspace(payload);
}
export function openNotebookStore(indexedDB = globalThis.indexedDB) {
  let connection;
  const open = () =>
    (connection ||= new Promise((resolve, reject) => {
      if (!indexedDB)
        return reject(Error("IndexedDB is unavailable in this browser."));
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("workspaces");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  return {
    async read() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db
          .transaction("workspaces")
          .objectStore("workspaces")
          .get("active");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    async write(value) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("workspaces", "readwrite");
        tx.objectStore("workspaces").put(value, "active");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error || Error("Notebook save was interrupted."));
      });
    },
    async close() {
      if (connection) (await connection).close();
    },
  };
}

// Markdown is deliberately rendered as text, with safe headings and lists; HTML is never evaluated.
export function renderNotebookMarkdown(source, document = globalThis.document) {
  const fragment = document.createDocumentFragment();
  for (const line of source.split("\n")) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const node = document.createElement(
      heading ? `h${heading[1].length + 1}` : /^[-*]\s+/.test(line) ? "p" : "p",
    );
    node.textContent = heading ? heading[2] : line;
    fragment.append(node);
  }
  return fragment;
}
export function createRNotebooks({editor, action, root, initialCode, getSources, onCellChange, onNotebookChange, onStatus, onRun, onStop, onRestart, getExports = () => [], onScene,onOpenSystems,onInspectSelection}) {
  const store = openNotebookStore();
  const first = createNotebook("Exploratory analysis", initialCode);
  let workspace = {schema: notebookSchema, notebooks: [first], active: first.id};
  let navigation;
  let activeCell = first.cells[0].id, busy = false, ready = false, saveTimer, destroyed = false, revision = 0, runAllCancelled = false;
  const pendingSelections = [], editors = new Map(), sceneViews = new Set();
  const host = el('section', 'research-studio-notebooks studio-grid');
  const sidebar = el('aside', 'studio-sidebar'); sidebar.setAttribute('aria-label','Notebooks');

  const status = el('span','studio-save-status','Opening local storage…'); status.setAttribute('role','status');
  const toolbar = el('div','studio-main-toolbar'); toolbar.setAttribute('aria-label','Notebook controls');
  const title = el('h3','studio-notebook-title');
  const center = el('main','studio-notebook-main'), list = el('div','studio-inline-cells');
  const inspector = el('aside','studio-inspector'); inspector.setAttribute('aria-label','R Studio inspector');
  const consolePanel = el('details','studio-console'); consolePanel.append(el('summary','','Console'));
  const consoleBody = el('div','studio-console-body'); consolePanel.append(consoleBody);
  const mode = el('p','note','Cells use isolated R sessions unless sharing is enabled. Code runs only on request.');
  const tools = el('div','studio-research-tools');
  let layout;
  const notebook = () => workspace.notebooks.find(book=>book.id===workspace.active);
  const cell = () => notebook()?.cells.find(item=>item.id===activeCell);
  Object.defineProperty(editor,'value',{configurable:true,get:()=>cell()?.source||'',set(value){const current=cell();if(!current)return;current.source=String(value);const cm=editors.get(current.id);if(cm&&cm.value!==value)cm.value=value;changed();}});
  async function save(){if(!ready||destroyed)return;try{await store.write(structuredClone(workspace));status.textContent='Saved locally';}catch(error){status.textContent='Not saved · export a copy';onStatus?.(error.message);}}
  function changed(){revision++;status.textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(save,400);}
  function cleanup(){for(const cm of editors.values())cm.destroy();editors.clear();for(const view of sceneViews)view.destroy?.();sceneViews.clear();}
  function activate(item){if(item.id===activeCell || (busy&&item.id!==activeCell))return;activeCell=item.id;for(const row of list.children)row.classList.toggle('is-active',row.dataset.cellId===item.id);onCellChange?.(item);}
  function chooseBook(book){if(busy)return;onNotebookChange?.();workspace.active=book.id;activeCell=book.cells[0].id;navigation?.reveal();render();changed();root.workspaceShell?.closeNavigation();}
  function renderOutput(item, container){
    for(const view of container.querySelectorAll(".scientific-scene")){view.destroy?.();sceneViews.delete(view);}
    container.replaceChildren();const run=item.runs?.at(-1);if(!run){container.append(el('p','note','Results appear here after execution.'));return;}
    const stamp=el('p','studio-output-status',`${run.error?'Error':'Completed'}${run.execution_order ? ` · [${run.execution_order}]` : ''}${run.elapsed_ms ? ` · ${(run.elapsed_ms/1000).toFixed(1)} s` : ''}`);stamp.dataset.state=run.error?'error':'success';container.append(stamp);
    if(run.upstream_outdated||(run.cell_code??run.code)!==item.source)container.append(el('p','studio-stale-output','Output is outdated. Rerun cell.'));
    if(run.console||run.message)container.append(el('pre','studio-cell-console',run.console||run.message));
    if(run.results_csv){const parsed=parseExploratoryCSV(run.results_csv);if(!parsed.error){const wrap=el('div','studio-inline-table'),table=el('table');const tr=el('tr');parsed.headers.slice(0,12).forEach(h=>tr.append(el('th','',h)));const head=el('thead');head.append(tr);table.append(head);const body=el('tbody');for(const row of parsed.rows.slice(0,20)){const tr=el('tr');row.slice(0,12).forEach(value=>tr.append(el('td','',value)));body.append(tr);}table.append(body);wrap.append(table);container.append(wrap,el('small','note',`Preview: ${Math.min(20,parsed.rows.length)} rows; export retains the recorded CSV.`));}}
    for(const svg of run.vector_svgs||[]){const image=el('img','studio-inline-figure');image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;image.alt='Recorded exploratory R figure';container.append(image);}
    for(const [sceneIndex,spec] of (run.scene_specs||[]).entries()) {const target=el('div','studio-scene-output');container.append(target);Promise.resolve(onScene?.(spec,target,sceneSpec=>{run.scene_specs[sceneIndex]=sceneSpec;changed();})).then(view=>{if(view&&target.isConnected)sceneViews.add(view);else view?.destroy?.();}).catch(error=>target.append(el('p','note',error.message)));}
    if((item.runs?.length||0)>1){const history=el('details');history.append(el('summary','',`${item.runs.length} recorded runs`));for(const previous of [...item.runs].reverse())history.append(action(`${previous.run_utc} · ${previous.error?'Error':'Complete'}`,'download',()=>downloadFile('cell-run.json',JSON.stringify(previous,null,2),'application/json')));container.append(history);}
  }
  function cellMenu(item,anchor){activate(item);studioMenu(root,anchor,'Cell actions',[
    {label:'Edit source',run(){const row=list.querySelector(`[data-cell-id="${item.id}"]`);row.querySelector('.studio-cell-code').open=true;row.querySelector('textarea,.cm-content')?.focus();}},{label:'Duplicate cell',run(){appendCell(item.kind,item.source);}},
    {label:'Move up',available:notebook().cells.indexOf(item)>0,run:()=>move(item,-1)},
    {label:'Move down',available:notebook().cells.indexOf(item)<notebook().cells.length-1,run:()=>move(item,1)},
    {label:'Clear output',run(){item.runs=[];render();changed();}},
    {label:'Delete cell',destructive:true,run(){if(busy)return;const book=notebook(),index=book.cells.indexOf(item);book.cells.splice(index,1);const placeholder=!book.cells.length?{id:id(),kind:'code',source:'',runs:[]}:null;if(placeholder)book.cells.push(placeholder);activeCell=book.cells[0].id;render();changed();save();undoMessage('Cell deleted.',()=>{if(!workspace.notebooks.includes(book))return;if(book.cells.length>=200){onStatus?.('The limit is 200 cells. Remove a cell before undoing.');return;}if(placeholder && book.cells.length===1 && book.cells[0]===placeholder && !placeholder.source && !placeholder.runs.length)book.cells=[];book.cells.splice(Math.min(index,book.cells.length),0,item);if(workspace.active===book.id){activeCell=item.id;render();}changed();save();});}}

  ]);}
  let undoToast;
  function undoMessage(text, undo) {
    undoToast?.close(false);
    undoToast = root.f7.toast.create({text, closeButton: true, closeButtonText: 'Undo', closeTimeout: 8000, destroyOnClose: true,
      on: {closeButtonClick(){if(!busy)undo();else onStatus?.('Interrupt execution before undoing. The analysis remains in Trash.');}}});
    undoToast.open();
  }
  function selectCurrent() { activeCell=notebook()?.cells[0]?.id; }
  function deleteAnalysis(book) {
    if(busy || !book)return;
    try { const wasActive=workspace.active===book.id;if(!moveAnalysisToTrash(workspace,book.id))return;
      if(wasActive){onNotebookChange?.();selectCurrent();render();}else navigation.render();changed();save();
      undoMessage(`Moved “${escapeHTML(book.title)}” to Trash.`,()=>restoreBook(book.id));
    } catch(error){onStatus?.(error.message);}
  }
  function restoreBook(bookId) {
    if(busy)return;
    try{if(!restoreAnalysis(workspace,bookId))return;onNotebookChange?.();selectCurrent();navigation.reveal();render();changed();save();}catch(error){onStatus?.(error.message);}
  }
  function duplicateBook(book) {
    if(busy||workspace.notebooks.length>=30)return;
    const copy=structuredClone(book);copy.id=id();copy.title=`${book.title} (copy)`.slice(0,120);copy.created=new Date().toISOString();
    copy.cells.forEach(item=>{item.id=id();});workspace.notebooks.push(copy);chooseBook(copy);
  }
  function renameBook(book){if(busy)return;root.f7.dialog.prompt('Analysis name','Rename analysis',value=>{book.title=value.trim().slice(0,120)||'Untitled analysis';title.textContent=notebook()?.title||'R Studio';navigation.render();changed();},undefined,book.title);}
  function reorderBook(bookId,to){if(busy)return;if(reorderAnalysis(workspace,bookId,to)){navigation.render();changed();}}
  function render(){
    cleanup();navigation?.render();title.textContent=notebook()?.title||'R Studio';
    list.replaceChildren();
    const empty = !notebook();
    runCell.disabled=runAll.disabled=exportButton.disabled=empty||busy;
    if(empty){const message=el('div','studio-empty-state');message.append(el('h3','','No personal analyses'),el('p','note','Create an analysis, open a study result script, or restore an analysis from Trash.'),action('New analysis','plus',newNotebook));list.append(message);insert.hidden=true;onCellChange?.(undefined);layout?.refreshFigures();return;}
    insert.hidden=false;
    notebook().cells.forEach((item,index)=>{
      const row=el('article','studio-inline-cell');row.dataset.cellId=item.id;row.classList.toggle('is-active',item.id===activeCell);
      const bar=el('div','studio-cell-header'),select=action(`${item.kind==='code'?'R':'Markdown'} ${index+1}`,'custom-r',()=>activate(item));select.setAttribute('aria-label',`Select ${item.kind==='code'?'R':'Markdown'} cell ${index+1}`);
      bar.append(select);
      if(item.kind==='code'){const run=action('Run','play',async()=>{activate(item);await onRun?.();});run.setAttribute('aria-label',`Run R cell ${index+1}`);bar.append(run);}
      const menu=action('Cell actions','controls',()=>cellMenu(item,menu));menu.setAttribute('aria-label',`Actions for cell ${index+1}`);bar.append(menu);
      const codeBlock=el('details','studio-cell-code');codeBlock.open=item.kind==='code';codeBlock.append(el('summary','',item.kind==='code'?'Code':'Markdown'));
      if(item.kind==='code'){
        const cm=createREditor(item.source,{label:`R code cell ${index+1}`});editors.set(item.id,cm);
        cm.addEventListener('focusin',()=>activate(item));cm.addEventListener('input',()=>{item.source=cm.value;for(const dependent of notebook().cells.slice(index+1)){for(const run of dependent.runs||[])run.upstream_outdated=true;const output=list.querySelector(`[data-cell-id="${dependent.id}"] .studio-inline-output`);if(output)renderOutput(dependent,output);}changed();});
        cm.addEventListener('keydown',async event=>{if((event.ctrlKey||event.metaKey||event.shiftKey)&&event.key==='Enter'){event.preventDefault();activate(item);await onRun?.();if(event.shiftKey){const next=notebook().cells[index+1];if(next){activate(next);editors.get(next.id)?.querySelector('.cm-content')?.focus();}else appendCell('code');}}});
        codeBlock.append(cm);
      }else{
        const notes=el('textarea','studio-markdown-editor');notes.setAttribute('aria-label',`Markdown cell ${index+1}`);notes.value=item.source;notes.rows=4;
        const preview=el('div','research-studio-markdown-preview');preview.append(renderNotebookMarkdown(item.source));
        preview.tabIndex=0;preview.setAttribute('aria-label','Markdown preview; Enter to edit');const edit=()=>{codeBlock.open=true;notes.focus();};preview.ondblclick=edit;preview.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();edit();}};notes.onkeydown=e=>{if(e.key==='Escape'){codeBlock.open=false;preview.focus();}};notes.onfocus=()=>activate(item);notes.oninput=()=>{item.source=notes.value;preview.replaceChildren(renderNotebookMarkdown(item.source));changed();};codeBlock.append(notes);row.append(bar,codeBlock,preview);
      }
      if(item.kind==='code'){const output=el('details','studio-cell-output');output.open=true;output.append(el('summary','','Output'));const content=el('div','studio-inline-output');renderOutput(item,content);output.append(content);row.append(bar,codeBlock,output);}
      list.append(row);
    });
    onCellChange?.(cell());layout?.refreshFigures();
  }
  function appendCell(kind,source=''){if(busy)return;if(!notebook()){const book=createNotebook('Untitled analysis');book.cells=[];workspace.notebooks.push(book);workspace.active=book.id;onNotebookChange?.();}if(notebook().cells.length>=200)return;const item={id:id(),kind,source,runs:[]};notebook().cells.push(item);activeCell=item.id;render();changed();save();list.lastElementChild?.scrollIntoView({block:'nearest'});}
  function move(item,offset){const a=notebook().cells,from=a.indexOf(item),to=from+offset;if(to<0||to>=a.length)return;[a[from],a[to]]=[a[to],a[from]];render();changed();}
  function newNotebook(){if(busy||workspace.notebooks.length>=30)return;const book=createNotebook('Untitled analysis');workspace.notebooks.push(book);chooseBook(book);}
  async function exportArchive(){const payload={...structuredClone(workspace),exported_utc:new Date().toISOString(),provenance:getSources(),execution:'Explicit runs only; execution_mode and prior_cells record isolated/shared sessions.',classification:'user-exploratory'};const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))].map(x=>x.toString(16).padStart(2,'0')).join('');downloadFile('psilocin-research-notebooks.json',JSON.stringify({...payload,integrity:{algorithm:'SHA-256',sha256:hash}},null,2),'application/json');}
  const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Import notebooks file');
  file.onchange=async()=>{try{const input=file.files[0];if(!input)return;if(input.size>20*1024*1024)throw Error('Notebook import is limited to 20 MB.');const imported=await verifyNotebookArchive(JSON.parse(await input.text()));root.f7.dialog.confirm('Replace local notebooks with this verified archive? Export your current notebooks first.','Import notebooks',()=>{onNotebookChange?.();workspace=imported;selectCurrent();render();changed();});}catch(error){onStatus?.(error.message);}file.value='';};
  const newBook=action('New analysis','plus',newNotebook),importBook=action('Import','top',()=>file.click());
  sidebar.append(file);
  const runCell=action('Run cell','play',()=>onRun?.()),runAll=action('Run all','play',async()=>{runAllCancelled=false;for(const item of [...(notebook()?.cells||[])]){if(runAllCancelled||destroyed)break;if(item.kind!=='code')continue;activate(item);const result=await onRun?.();if(!result||result.error)break;}}),interrupt=action('Interrupt','close',()=>{runAllCancelled=true;onStop?.();});interrupt.disabled=true;
  const add=action('Add cell','plus',()=>studioMenu(root,add,'Add cell',[{label:'+ R cell',run:()=>appendCell('code')},{label:'+ Markdown',run:()=>appendCell('markdown','## Notes\n')},{label:'3D scatter scene',run:()=>appendCell('code','results <- subset(genes, selected & contrast == "day1_vs_control")\natlas_scatter3d(results, "log2FoldChange", "lfcSE", "baseMean", color="log2FoldChange", title="Archived effects, uncertainty and expression")')},{label:'Network overlay',run:()=>appendCell('code','results <- subset(genes, selected & contrast == "day1_vs_control")\natlas_network(results, "log2FoldChange")')},{label:'Molecular structure',run:()=>appendCell('code','atlas_structure("GPX4")')},{label:'Research note',run:()=>appendCell('markdown','## Hypothesis\nObservation:\nAlternative explanation:\nContradictory evidence:\nProposed test:\n')},{label:'Reference',run:()=>appendCell('markdown','## Reference\nTitle:\nDOI or URL:\nRole in this analysis:\n')} ]));
  const exportButton=action('Export','download',()=>studioMenu(root,exportButton,'Export notebook',[
    {label:'Notebook archive (.json)',run:exportArchive},
    ...[['html','HTML (.html)'],['qmd','Quarto (.qmd)'],['Rmd','R Markdown (.Rmd)']].map(([format,label])=>({label,run:()=>downloadFile(`research-notebook.${format}`,notebookPublication(notebook(),format),format==='html'?'text/html':'text/plain')})),
    {label:'R script (.R)',run:()=>downloadFile('research-notebook.R',notebook().cells.filter(x=>x.kind==='code').map(x=>x.source).join('\n\n'),'text/plain')},...getExports()
  ]));
  runCell.classList.add('studio-primary-run','primary','button-fill');
  runAll.classList.add('studio-run-all');interrupt.classList.add('studio-interrupt');
  const more=action('More','controls',()=>studioMenu(root,more,'Research tools',[{label:'Run all cells',run:()=>runAll.click()},{label:'Import analyses',run:()=>importBook.click()},{label:'Restart & run all',run:()=>{onRestart?.();runAll.click();}},{label:'Research tools',run:()=>openTools()},{label:'Molecular systems',available:!!onOpenSystems,run:onOpenSystems},{label:'Focus mode',run:()=>focus.click()},{label:'Toggle inspector',run:()=>{layout?.toggleInspector();}},{label:'Toggle console',run:()=>{layout?.openConsole();}}]));
  const openBooks=action('Notebooks','menu',()=>root.workspaceShell?.openNavigation());
  const focus=action('Focus mode','fullscreen',()=>{const active=host.classList.toggle('studio-focus-mode');focus.setAttribute('aria-pressed',String(active));layout?.setFocus(active);});
  focus.classList.add('studio-focus-toggle');focus.setAttribute('aria-pressed','false');
  toolbar.append(openBooks,runCell,runAll,interrupt,add,exportButton,focus,more);
  const builder=createRRecipeBuilder({action,onGenerate:source=>appendCell('code',source),onStatus});tools.append(builder,mode);
  function openPane(content,label){const slot=el('span');content.before(slot);const sheet=el('div','sheet-modal studio-pane-sheet'),inner=el('div','sheet-modal-inner'),handle=el('div','workspace-sheet-handle');handle.append(el('span'));inner.append(handle,el('h3','',label));const close=action('Done','close',()=>modal.close());inner.append(close,content);sheet.append(inner);root.append(sheet);const modal=root.f7.sheet.create({el:sheet,backdrop:true,closeOnEscape:true,swipeToClose:true,swipeHandler:handle,on:{closed(){slot.replaceWith(content);sheet.remove();setTimeout(()=>destroySheet(modal),0);}}});modal.open();}
  function openTools(){openPane(tools,'R tools');}
  navigation=createAnalysisNavigation({root,sidebar,action,newBook,getWorkspace:()=>workspace,isBusy:()=>busy,
    onChoose:chooseBook,onRename:renameBook,onDuplicate:duplicateBook,onTrash:deleteAnalysis,onRestore:restoreBook,onReorder:reorderBook,
    onExport:book=>downloadFile('research-analysis.html',notebookPublication(book,'html'),'text/html'),
    onPermanentDelete:bookId=>{if(busy)return;confirmPermanentDeletion(root,()=>{if(busy)return;workspace.trash=workspace.trash.filter(item=>item.book.id!==bookId);navigation.render();changed();save();});},
    onArchived:example=>{if(busy||workspace.notebooks.length>=30)return;const book=createNotebook(example.title,example.code);workspace.notebooks.push(book);chooseBook(book);},
    onTools:openTools,onOpenSystems});
  inspector.append(el('h3','','Workspace'));
  const insert=el('div','studio-insert-cell');insert.append(action('Insert R cell','plus',()=>appendCell('code')),action('Insert Markdown','plus',()=>appendCell('markdown','## Notes\n')));
  const analysisHeader=el('header','studio-analysis-header');analysisHeader.append(title,status);center.append(analysisHeader,list,insert);
  host.append(toolbar,sidebar,studioResizer(host,'--studio-sidebar',{label:'Notebook sidebar width',initial:210,min:180,max:320}),center,studioResizer(host,'--studio-inspector',{label:'Inspector width',initial:260,min:240,max:420,reverse:true}),inspector,consolePanel);
  consoleBody.prepend(studioResizer(host,'--studio-console-height',{label:'Console height',initial:180,min:90,max:450,reverse:true,horizontal:true}));
  layout=createWorkspaceLayout({root,host,sidebar,inspector,toolbar,center,consolePanel,consoleBody,action,onSelection:onInspectSelection});
  render();
  const initialRevision=revision;
  store.read().then(saved=>{if(destroyed)return;if(saved&&revision===initialRevision){workspace=validateWorkspace(saved);selectCurrent();render();}ready=true;for(const selection of pendingSelections.splice(0))api.appendSelection(selection);save();}).catch(error=>{ready=true;status.textContent='Local storage unavailable';onStatus?.(error.message);});
  const api={element:host,sidebar,inspector,tools,consoleBody,toolbar,layout,openTools,restoreWorkspace:async value=>{if(busy)throw Error("Interrupt R before restoring a session.");onNotebookChange?.();workspace=validateWorkspace(value);selectCurrent();render();await save();},notebookId:()=>workspace.active,snapshot:()=>structuredClone(workspace),
    setSessionMode(shared){mode.textContent=shared?'Notebook session · variables persist. Archived inputs and seed initialize once. Restart, interrupt, errors or notebook changes discard the runtime.':'Independent cell execution · every cell starts with fresh inputs and seed.';},
    current:()=>cell(),
    setBusy(value){busy=value;runCell.disabled=runAll.disabled=value||!notebook();add.disabled=newBook.disabled=importBook.disabled=value;exportButton.disabled=value||!notebook();navigation.setBusy(value);interrupt.disabled=!value;list.querySelectorAll('.studio-cell-header button').forEach(b=>b.disabled=value);for(const cm of editors.values())cm.inert=value;},save,
    async recordRun(run){const current=cell();if(!current||current.kind!=='code')return;const execution_order=Math.max(0,...notebook().cells.flatMap(x=>x.runs||[]).map(x=>x.execution_order||0))+1;current.runs=[...current.runs,{...structuredClone(run),execution_order}].slice(-20);const target=list.querySelector(`[data-cell-id="${current.id}"] .studio-inline-output`);if(target)renderOutput(current,target);await save();layout.refreshFigures();},
    appendSelection(selection) {
      if (!ready) {
        pendingSelections.push(structuredClone(selection));
        return;
      }
      const values = Array.isArray(selection?.genes)
        ? selection.genes
        : selection?.gene
          ? [selection.gene]
          : [];
      const identifiers = values
        .map((item) =>
          typeof item === "string" ? item : item?.id || item?.symbol,
        )
        .filter((item) => typeof item === "string")
        .slice(0, 5000);
      // JSON string syntax is a safe R character literal for identifiers except uncommon controls.
      const literals = identifiers
        .map((value) => JSON.stringify(value.replace(/[\u0000-\u001f]/g, "")))
        .join(", ");
      const literal = (value) =>
        JSON.stringify(String(value || "").replace(/[\u0000-\u001f]/g, ""));
      const collections = (selection?.collections || []).slice(0, 20);
      const collectionCode = `setNames(list(${collections.map((collection) => `c(${(collection.genes || []).slice(0, 500).map(literal).join(", ")})`).join(", ")}), c(${collections.map((collection) => literal(collection.name)).join(", ")}))`;
      const query = identifiers.length
        ? "results <- subset(genes, (id %in% selected_ids | symbol %in% selected_ids) & contrast == atlas_contrast)"
        : "pathway_columns <- intersect(c('key', 'id', 'pathway', 'name'), names(pathways))\nresults <- pathways[apply(pathways[, pathway_columns, drop=FALSE], 1, function(row) any(row == atlas_pathway, na.rm=TRUE)), , drop=FALSE]";
      appendCell(
        "code",
        `# Research selection copied from the atlas; exploratory analysis.\nselected_ids <- c(${literals})\natlas_pathway <- ${literal(selection?.pathway)}\natlas_contrast <- ${literal(selection?.contrast)}\natlas_collections <- ${collectionCode}\n${query}\nprint(results)\n# These are archived fitted estimates; selecting a subset does not redefine its FDR family.`,
      );
    },
    addCode:source=>appendCell('code',source),
    insertSelectionReference(selection) {
      const values = Array.isArray(selection?.genes) ? selection.genes : selection?.gene ? [selection.gene] : [];
      const identifiers = values.map(item => typeof item === "string" ? item : item?.id || item?.symbol).filter(item => typeof item === "string").slice(0, 5000);
      if (!identifiers.length) return;
      const literal = value => JSON.stringify(String(value).replace(/[\u0000-\u001f]/g, ""));
      appendCell("code", `# Active Atlas selection; inserted explicitly. No code has run.\nselected_ids <- c(${identifiers.map(literal).join(", ")})\n# Use: subset(genes, id %in% selected_ids | symbol %in% selected_ids)`);
    },
    addRecipe(recipeId){const recipe=rExamples.find(item=>item.id===recipeId);if(recipe)appendCell('code',recipe.code);},
    async destroy(){navigation.destroy();undoToast?.close(false);layout.destroy();clearTimeout(saveTimer);runAllCancelled=true;cleanup();clearTimeout(saveTimer);if(ready)await store.write(structuredClone(workspace)).catch(()=>{});destroyed=true;await store.close().catch(()=>{});}
  };
  return api;
}
