import {createREditor} from "../assets/vendor/r-editor.js";
import {studioMenu, studioResizer} from "./studio-ui.js";
import {parseExploratoryCSV} from "./exploratory-result-data.js";
import {notebookPublication} from "./notebook-publication.js";
// Local notebooks contain researcher-authored material only. They never execute on load.
import { createElement as el } from "./interface-utils.js";
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
export function validateWorkspace(value) {
  if (
    value?.schema !== notebookSchema ||
    !Array.isArray(value.notebooks) ||
    !value.notebooks.length ||
    value.notebooks.length > 30
  )
    throw Error(
      "Choose a Research Studio notebook export with 1–30 notebooks.",
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
  return {
    schema: notebookSchema,
    notebooks,
    active: notebooks.some((book) => book.id === value.active)
      ? value.active
      : notebooks[0].id,
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
export function createRNotebooks({editor, action, root, initialCode, getSources, onCellChange, onNotebookChange, onStatus, onRun, onStop, getExports = () => [], onScene,onOpenSystems}) {
  const store = openNotebookStore();
  const first = createNotebook("Exploratory analysis", initialCode);
  let workspace = {schema: notebookSchema, notebooks: [first], active: first.id};
  let activeCell = first.cells[0].id, busy = false, ready = false, saveTimer, destroyed = false, revision = 0, runAllCancelled = false;
  const pendingSelections = [], editors = new Map(), sceneViews = new Set();
  const host = el('section', 'research-studio-notebooks studio-grid');
  const sidebar = el('aside', 'studio-sidebar'); sidebar.setAttribute('aria-label','Notebooks');
  const sidebarHead = el('div','studio-sidebar-head'); sidebarHead.append(el('h3','','Notebooks'));
  const books = el('div','studio-book-list');
  const status = el('span','studio-save-status','Opening local storage…'); status.setAttribute('role','status');
  const toolbar = el('div','studio-main-toolbar'); toolbar.setAttribute('aria-label','Notebook controls');
  const title = el('h3','studio-notebook-title');
  const center = el('main','studio-notebook-main'), list = el('div','studio-inline-cells');
  const inspector = el('aside','studio-inspector'); inspector.setAttribute('aria-label','R workspace inspector');
  const consolePanel = el('details','studio-console'); consolePanel.append(el('summary','','Console'));
  const consoleBody = el('div','studio-console-body'); consolePanel.append(consoleBody);
  const mode = el('p','note','Cells use isolated R sessions unless sharing is enabled. Code runs only on request.');
  const tools = el('div','studio-research-tools');
  const notebook = () => workspace.notebooks.find(book=>book.id===workspace.active);
  const cell = () => notebook().cells.find(item=>item.id===activeCell);
  Object.defineProperty(editor,'value',{configurable:true,get:()=>cell()?.source||'',set(value){const current=cell();if(!current)return;current.source=String(value);const cm=editors.get(current.id);if(cm&&cm.value!==value)cm.value=value;changed();}});
  const capture=()=>{};
  async function save(){if(!ready||destroyed)return;try{await store.write(structuredClone(workspace));status.textContent='Saved locally';}catch(error){status.textContent='Not saved · export a copy';onStatus?.(error.message);}}
  function changed(){revision++;status.textContent='Saving…';clearTimeout(saveTimer);saveTimer=setTimeout(save,400);}
  function cleanup(){for(const cm of editors.values())cm.destroy();editors.clear();for(const view of sceneViews)view.destroy?.();sceneViews.clear();}
  function activate(item){if(item.id===activeCell || (busy&&item.id!==activeCell))return;activeCell=item.id;for(const row of list.children)row.classList.toggle('is-active',row.dataset.cellId===item.id);onCellChange?.(item);}
  function chooseBook(book){if(busy)return;onNotebookChange?.();workspace.active=book.id;activeCell=book.cells[0].id;render();changed();}
  function renderOutput(item, container){
    for(const view of container.querySelectorAll(".scientific-scene")){view.destroy?.();sceneViews.delete(view);}
    container.replaceChildren();const run=item.runs?.at(-1);if(!run){container.append(el('p','note','Results appear here after execution.'));return;}
    const stamp=el('p','studio-output-status',`${run.error?'Error':'Complete'}${run.execution_order ? ` · In [${run.execution_order}]` : ''} · ${run.run_utc||''}`);stamp.dataset.state=run.error?'error':'success';container.append(stamp);
    if((run.cell_code??run.code)!==item.source)container.append(el('p','studio-stale-output','Code changed since this output was recorded.'));
    if(run.console||run.message)container.append(el('pre','studio-cell-console',run.console||run.message));
    if(run.results_csv){const parsed=parseExploratoryCSV(run.results_csv);if(!parsed.error){const wrap=el('div','studio-inline-table'),table=el('table');const tr=el('tr');parsed.headers.slice(0,12).forEach(h=>tr.append(el('th','',h)));const head=el('thead');head.append(tr);table.append(head);const body=el('tbody');for(const row of parsed.rows.slice(0,20)){const tr=el('tr');row.slice(0,12).forEach(value=>tr.append(el('td','',value)));body.append(tr);}table.append(body);wrap.append(table);container.append(wrap,el('small','note',`Preview: ${Math.min(20,parsed.rows.length)} rows; export retains the recorded CSV.`));}}
    for(const svg of run.vector_svgs||[]){const image=el('img','studio-inline-figure');image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;image.alt='Recorded exploratory R figure';container.append(image);}
    for(const [sceneIndex,spec] of (run.scene_specs||[]).entries()) {const target=el('div','studio-scene-output');container.append(target);Promise.resolve(onScene?.(spec,target,sceneSpec=>{run.scene_specs[sceneIndex]=sceneSpec;changed();})).then(view=>{if(view&&target.isConnected)sceneViews.add(view);else view?.destroy?.();}).catch(error=>target.append(el('p','note',error.message)));}
    if((item.runs?.length||0)>1){const history=el('details');history.append(el('summary','',`${item.runs.length} recorded runs`));for(const previous of [...item.runs].reverse())history.append(action(`${previous.run_utc} · ${previous.error?'Error':'Complete'}`,'download',()=>downloadFile('cell-run.json',JSON.stringify(previous,null,2),'application/json')));container.append(history);}
  }
  function cellMenu(item,anchor){activate(item);studioMenu(root,anchor,'Cell actions',[
    {label:'Duplicate cell',run(){appendCell(item.kind,item.source);}},
    {label:'Move up',available:notebook().cells.indexOf(item)>0,run:()=>move(item,-1)},
    {label:'Move down',available:notebook().cells.indexOf(item)<notebook().cells.length-1,run:()=>move(item,1)},
    {label:'Clear output',run(){item.runs=[];render();changed();}},
    {label:'Delete cell',destructive:true,run:()=>root.f7.dialog.confirm('Delete this cell and its recorded outputs?','Delete cell',()=>{notebook().cells=notebook().cells.filter(x=>x.id!==item.id);if(!notebook().cells.length)notebook().cells.push({id:id(),kind:'code',source:'',runs:[]});activeCell=notebook().cells[0].id;render();changed();})}
  ]);}
  function render(){
    cleanup();books.replaceChildren();title.textContent=notebook().title;
    for(const book of workspace.notebooks){const button=action(book.title,'custom-r',()=>chooseBook(book));button.setAttribute('aria-current',String(book.id===workspace.active));button.disabled=busy;books.append(button);}
    list.replaceChildren();
    notebook().cells.forEach((item,index)=>{
      const row=el('article','studio-inline-cell');row.dataset.cellId=item.id;row.classList.toggle('is-active',item.id===activeCell);
      const bar=el('div','studio-cell-header'),select=action(`${item.kind==='code'?'R':'Markdown'} ${index+1}`,'custom-r',()=>activate(item));select.setAttribute('aria-label',`Select ${item.kind==='code'?'R':'Markdown'} cell ${index+1}`);
      bar.append(select);
      if(item.kind==='code'){const run=action('Run','play',async()=>{activate(item);await onRun?.();});run.setAttribute('aria-label',`Run R cell ${index+1}`);bar.append(run);}
      const menu=action('Cell actions','controls',()=>cellMenu(item,menu));menu.setAttribute('aria-label',`Actions for cell ${index+1}`);bar.append(menu);
      const codeBlock=el('details','studio-cell-code');codeBlock.open=true;codeBlock.append(el('summary','',item.kind==='code'?'Code':'Markdown'));
      if(item.kind==='code'){
        const cm=createREditor(item.source,{label:`R code cell ${index+1}`});editors.set(item.id,cm);
        cm.addEventListener('focusin',()=>activate(item));cm.addEventListener('input',()=>{item.source=cm.value;changed();});
        cm.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();activate(item);onRun?.();}});
        codeBlock.append(cm);
      }else{
        const notes=el('textarea','studio-markdown-editor');notes.setAttribute('aria-label',`Markdown cell ${index+1}`);notes.value=item.source;notes.rows=4;
        const preview=el('div','research-studio-markdown-preview');preview.append(renderNotebookMarkdown(item.source));
        notes.onfocus=()=>activate(item);notes.oninput=()=>{item.source=notes.value;preview.replaceChildren(renderNotebookMarkdown(item.source));changed();};codeBlock.append(notes);row.append(bar,codeBlock,preview);
      }
      if(item.kind==='code'){const output=el('details','studio-cell-output');output.open=true;output.append(el('summary','','Output'));const content=el('div','studio-inline-output');renderOutput(item,content);output.append(content);row.append(bar,codeBlock,output);}
      list.append(row);
    });
    onCellChange?.(cell());
  }
  function appendCell(kind,source=''){if(busy||notebook().cells.length>=200)return;const item={id:id(),kind,source,runs:[]};notebook().cells.push(item);activeCell=item.id;render();changed();save();list.lastElementChild?.scrollIntoView({block:'nearest'});}
  function move(item,offset){const a=notebook().cells,from=a.indexOf(item),to=from+offset;if(to<0||to>=a.length)return;[a[from],a[to]]=[a[to],a[from]];render();changed();}
  function newNotebook(){if(busy||workspace.notebooks.length>=30)return;const book=createNotebook();workspace.notebooks.push(book);chooseBook(book);}
  async function exportArchive(){const payload={...structuredClone(workspace),exported_utc:new Date().toISOString(),provenance:getSources(),execution:'Explicit runs only; execution_mode and prior_cells record isolated/shared sessions.',classification:'user-exploratory'};const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))].map(x=>x.toString(16).padStart(2,'0')).join('');downloadFile('psilocin-research-notebooks.json',JSON.stringify({...payload,integrity:{algorithm:'SHA-256',sha256:hash}},null,2),'application/json');}
  const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;file.setAttribute('aria-label','Import notebooks file');
  file.onchange=async()=>{try{const input=file.files[0];if(!input)return;if(input.size>20*1024*1024)throw Error('Notebook import is limited to 20 MB.');const imported=await verifyNotebookArchive(JSON.parse(await input.text()));root.f7.dialog.confirm('Replace local notebooks with this verified archive? Export your current notebooks first.','Import notebooks',()=>{onNotebookChange?.();workspace=imported;activeCell=notebook().cells[0].id;render();changed();});}catch(error){onStatus?.(error.message);}file.value='';};
  const newBook=action('New notebook','plus',newNotebook),importBook=action('Import','top',()=>file.click());
  const bookSettings=action('Notebook settings','controls',()=>studioMenu(root,bookSettings,'Notebook settings',[
    {label:'Rename notebook',run:()=>root.f7.dialog.prompt('Notebook title','Rename notebook',value=>{notebook().title=value.trim().slice(0,120)||'Untitled notebook';render();changed();},undefined,notebook().title)},
    {label:'Delete notebook',destructive:true,available:workspace.notebooks.length>1,run:()=>root.f7.dialog.confirm('Delete this notebook and its local history?','Delete notebook',()=>{workspace.notebooks=workspace.notebooks.filter(book=>book.id!==workspace.active);chooseBook(workspace.notebooks[0]);})}
  ]));
  sidebarHead.append(newBook,importBook,bookSettings);sidebar.append(sidebarHead,books,file);
  const runCell=action('Run cell','play',()=>onRun?.()),runAll=action('Run all','play',async()=>{runAllCancelled=false;for(const item of [...notebook().cells]){if(runAllCancelled||destroyed)break;if(item.kind!=='code')continue;activate(item);await onRun?.();if(item.runs?.at(-1)?.error)break;}}),interrupt=action('Interrupt','close',()=>{runAllCancelled=true;onStop?.();});interrupt.disabled=true;
  const add=action('Add cell','plus',()=>studioMenu(root,add,'Add cell',[{label:'+ R cell',run:()=>appendCell('code')},{label:'+ Markdown',run:()=>appendCell('markdown','## Notes\n')},{label:'3D scatter scene',run:()=>appendCell('code','results <- data.frame(id=landscape$gene, x=landscape$day1_log2fc, y=landscape$day3_log2fc, z=seq_len(nrow(landscape)))\n# z is display order, not spatial position.\natlas_scatter3d(results, "x", "y", "z", title="Archived effects and display order")')},{label:'Network overlay',run:()=>appendCell('code','results <- subset(genes, selected & contrast == "day1_vs_control")\natlas_network(results, "log2FoldChange")')},{label:'Molecular structure',run:()=>appendCell('code','atlas_structure("GPX4")')},{label:'Research note',run:()=>appendCell('markdown','## Hypothesis\nObservation:\nAlternative explanation:\nContradictory evidence:\nProposed test:\n')},{label:'Reference',run:()=>appendCell('markdown','## Reference\nTitle:\nDOI or URL:\nRole in this analysis:\n')} ]));
  const exportButton=action('Export','download',()=>studioMenu(root,exportButton,'Export notebook',[
    {label:'Notebook archive (.json)',run:exportArchive},
    ...[['html','HTML (.html)'],['qmd','Quarto (.qmd)'],['Rmd','R Markdown (.Rmd)']].map(([format,label])=>({label,run:()=>downloadFile(`research-notebook.${format}`,notebookPublication(notebook(),format),format==='html'?'text/html':'text/plain')})),
    {label:'R script (.R)',run:()=>downloadFile('research-notebook.R',notebook().cells.filter(x=>x.kind==='code').map(x=>x.source).join('\n\n'),'text/plain')},...getExports()
  ]));
  runAll.classList.add('studio-run-all');interrupt.classList.add('studio-interrupt');
  const more=action('More','controls',()=>studioMenu(root,more,'Research tools',[{label:'Run all cells',run:()=>runAll.click()},{label:'Recipes, data & settings',run:()=>openTools()},{label:'Molecular systems',available:!!onOpenSystems,run:onOpenSystems},{label:'Toggle inspector',run:()=>{host.classList.toggle('studio-inspector-hidden');}},{label:'Toggle console',run:()=>{consolePanel.open=!consolePanel.open;}}]));
  const openBooks=action('Notebooks','menu',()=>openPane(sidebar,'Notebooks'));
  toolbar.append(openBooks,runCell,runAll,interrupt,add,exportButton,more);
  const builder=createRRecipeBuilder({action,onGenerate:source=>appendCell('code',source),onStatus});tools.append(builder,mode);
  function openPane(content,label){const slot=el('span');content.before(slot);const sheet=el('div','sheet-modal studio-pane-sheet'),inner=el('div','sheet-modal-inner');inner.append(el('h3','',label));const close=action('Done','close',()=>modal.close());inner.append(close,content);sheet.append(inner);root.append(sheet);const modal=root.f7.sheet.create({el:sheet,backdrop:true,closeOnEscape:true,on:{closed(){slot.replaceWith(content);sheet.remove();setTimeout(()=>modal.destroy(),0);}}});modal.open();}
  function openTools(){openPane(tools,'R tools');}
  inspector.append(el('h3','','Workspace'),tools);
  center.append(title,el('span','studio-classification','Exploratory analysis'),status,list);
  host.append(toolbar,sidebar,studioResizer(host,'--studio-sidebar',{label:'Notebook sidebar width',initial:240,min:180,max:320}),center,studioResizer(host,'--studio-inspector',{label:'Inspector width',initial:300,min:240,max:420,reverse:true}),inspector,consolePanel);
  consoleBody.prepend(studioResizer(host,'--studio-console-height',{label:'Console height',initial:180,min:90,max:450,reverse:true,horizontal:true}));
  render();
  const initialRevision=revision;
  store.read().then(saved=>{if(destroyed)return;if(saved&&revision===initialRevision){workspace=validateWorkspace(saved);activeCell=notebook().cells[0].id;render();}ready=true;for(const selection of pendingSelections.splice(0))api.appendSelection(selection);save();}).catch(error=>{ready=true;status.textContent='Local storage unavailable';onStatus?.(error.message);});
  const api={element:host,sidebar,inspector,tools,consoleBody,toolbar,restoreWorkspace:async value=>{if(busy)throw Error("Interrupt R before restoring a session.");onNotebookChange?.();workspace=validateWorkspace(value);activeCell=notebook().cells[0].id;render();await save();},notebookId:()=>workspace.active,snapshot:()=>structuredClone(workspace),
    setSessionMode(shared){mode.textContent=shared?'Shared R session; reset, stop, errors, notebook changes or navigation discard objects. Archived inputs and seed refresh each run.':'Isolated R cells. Enable session sharing to retain objects between cells.';},
    current:()=>cell(),
    setBusy(value){busy=value;runCell.disabled=runAll.disabled=add.disabled=newBook.disabled=importBook.disabled=bookSettings.disabled=value;interrupt.disabled=!value;books.inert=value;list.querySelectorAll('.studio-cell-header button').forEach(b=>b.disabled=value);for(const cm of editors.values())cm.inert=value;},save,
    async recordRun(run){const current=cell();if(!current||current.kind!=='code')return;const execution_order=Math.max(0,...notebook().cells.flatMap(x=>x.runs||[]).map(x=>x.execution_order||0))+1;current.runs=[...current.runs,{...structuredClone(run),execution_order}].slice(-20);const target=list.querySelector(`[data-cell-id="${current.id}"] .studio-inline-output`);if(target)renderOutput(current,target);await save();},
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
        ? "results <- subset(genes, id %in% selected_ids | symbol %in% selected_ids)"
        : "pathway_columns <- intersect(c('key', 'id', 'pathway', 'name'), names(pathways))\nresults <- pathways[apply(pathways[, pathway_columns, drop=FALSE], 1, function(row) any(row == atlas_pathway, na.rm=TRUE)), , drop=FALSE]";
      appendCell(
        "code",
        `# Research selection copied from the atlas; exploratory analysis.\nselected_ids <- c(${literals})\natlas_pathway <- ${literal(selection?.pathway)}\natlas_contrast <- ${literal(selection?.contrast)}\natlas_collections <- ${collectionCode}\n${query}\nprint(results)\n# These are archived fitted estimates; selecting a subset does not redefine its FDR family.`,
      );
    },
    addCode:source=>appendCell('code',source),
    addRecipe(recipeId){const recipe=rExamples.find(item=>item.id===recipeId);if(recipe)appendCell('code',recipe.code);},
    async destroy(){clearTimeout(saveTimer);runAllCancelled=true;cleanup();clearTimeout(saveTimer);if(ready)await store.write(structuredClone(workspace)).catch(()=>{});destroyed=true;await store.close().catch(()=>{});}
  };
  return api;
}
