import {archivedResearchTables,researchTableCSV} from "./research-datasets.js";
import {createSessionArchive,readSessionArchive,SESSION_LIMITS} from './scientific-session.js';
import {createElement as el} from './interface-utils.js';
import {createCustomR} from './custom-r.js';
import {csvText} from './format.js';
import {downloadFile} from './file-download.js';
import {createScientificScene} from './scientific-scene.js';
import {validateResearchCSV} from './research-import.js';

export function createResearchStudio(options) {
  const {root,data,getGenes,getSelection}=options;
  const host=el('section','custom-r-workspace research-studio-workspace');
  const tabs=el('div','segmented studio-workspace-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Research workspace');tabs.setAttribute('aria-orientation','vertical');
  const navigation=el('div','workspace-sidebar-content');
  const panels=new Map(),buttons=new Map();let python,active='r',transferred=[];
  function button(label,fn){const b=el('button','button',label);b.type='button';b.onclick=fn;return b;}
  for(const [key,title] of [['r','R Studio'],['python','Python Lab'],['projects','Projects'],['reports','Reports']]){
    const panel=el('section',`studio-language-panel studio-${key}-panel`);panel.hidden=key!=='r';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-label',title);panel.id=`workspace-${key}-${crypto.randomUUID()}`;panels.set(key,panel);
    const b=button(title,()=>show(key));b.setAttribute('role','tab');b.id=`${panel.id}-tab`;b.setAttribute('aria-controls',panel.id);b.tabIndex=key==='r'?0:-1;panel.setAttribute('aria-labelledby',b.id);b.setAttribute('aria-selected',String(key==='r'));buttons.set(key,b);tabs.append(b);
  }
  tabs.onkeydown=event=>{const items=[...buttons.values()],index=items.indexOf(document.activeElement);if(index<0||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:items.length-1))%items.length;items[next].focus();};
  const r=createCustomR({...options,onOpenReports:()=>show("reports"),onTransferToPython:async dataset=>{await accept(dataset);await show('python');python.refreshDatasets();}});
  panels.get('r').append(r);
  async function accept(dataset){validateResearchCSV(dataset.csv);const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(dataset.csv)))].map(x=>x.toString(16).padStart(2,'0')).join('');transferred=[...transferred.filter(x=>x.name!==dataset.name),{...dataset,provenance:{...dataset.provenance,sha256:hash,classification:'user-exploratory'}}].slice(-10);}
  let archivedDatasetPromise;
  async function datasets(){
    const frozen=await (archivedDatasetPromise ||= getGenes().then(genes=>Object.entries(archivedResearchTables(data,genes,options.bayesian)).map(([name,rows])=>({name,csv:researchTableCSV(rows),provenance:{classification:"archived",archive_doi:"10.5281/zenodo.23283595",rows:rows.length}}))));
    return [...frozen,...transferred];
  }
  async function show(key){
    active=key;r.setWorkspaceActive(key==='r');r.workspaceNavigation.hidden=key!=='r';root.workspaceShell?.closeNavigation();root.workspaceTools={showR:()=>show('r'),items:()=>key==='r'?r.workspaceActions():[{label:'Datasets',run:()=>r.openDatasets()},{label:'R Studio',run:()=>show('r')},{label:'Python Lab',run:()=>show('python')},{label:'Reports',run:()=>show('reports')}]};root.workspaceShell?.syncTools();for(const [id,panel] of panels)panel.hidden=id!==key;for(const [id,b]of buttons){b.setAttribute('aria-selected',String(id===key));b.tabIndex=id===key?0:-1;}
    if(key==='python'&&!python){const target=panels.get('python');target.textContent='Opening Python Lab…';try{const {createPythonLab}=await import('./python-lab.js');if(!host.isConnected)return;python=createPythonLab({root,getDatasets:datasets,onTransferToR:async dataset=>{await accept(dataset);await r.importDataset(dataset);show('r');},onClearResults:()=>{for(const scene of target.querySelectorAll(".scientific-scene")){scene.destroy?.();scene.remove();}},onResults:record=>{for(const old of target.querySelectorAll('.scientific-scene'))old.destroy?.();for(const spec of record.scene_specs||[])target.append(createScientificScene(spec,{onSelect:({id})=>options.onSelectGene?.(id),onNetwork:options.onSceneNetwork,onStructure:options.onSceneStructure}));host.dispatchEvent(new CustomEvent('atlas:python-results',{bubbles:true,detail:record}));}});target.replaceChildren(python);}catch(error){target.textContent=error.message;}}
    if(key==='reports'){r.reportTools?.removeAttribute('hidden');panels.get('reports').append(r.reportTools);}
  }
  const projects=panels.get('projects');projects.append(el('h3','','Research projects'),el('p','note','Save named analytical context and gene collections. Notebooks and their outputs remain in their language workspace.'));
  const key='atlas-research-projects-v1';let saved=[];try{const value=JSON.parse(localStorage.getItem(key));if(Array.isArray(value))saved=value.slice(0,30);}catch{}
  const projectList=el('div','studio-project-list'),status=el('p','note');
  function renderProjects(){projectList.replaceChildren();for(const project of saved){const row=el('article','studio-project-row');row.append(el('h4','',project.title),el('p','note',`${project.created} · ${(project.selection?.collections||[]).length} collections`),button('Open context',()=>{options.onRestoreProject?.(project.selection);status.textContent=`Opened ${project.title}. Saved code has not run.`;for(const old of projects.querySelectorAll('.scientific-scene'))old.destroy?.();for(const spec of project.scenes||[])projects.append(createScientificScene(spec,{onSelect:({id})=>options.onSelectGene?.(id),onNetwork:options.onSceneNetwork,onStructure:options.onSceneStructure}));}),button('Export project',()=>downloadFile('research-project.json',JSON.stringify(project,null,2),'application/json')));projectList.append(row);}}
  projects.append(button('Save current project',()=>root.f7.dialog.prompt('Project name','Save project',title=>{if(!title.trim())return;const project={schema:'psilocin-research-project/1',id:crypto.randomUUID(),title:title.trim().slice(0,120),created:new Date().toISOString(),selection:getSelection(),scenes:r.snapshot().notebooks.notebooks.flatMap(book=>book.cells.flatMap(cell=>(cell.runs||[]).flatMap(run=>run.scene_specs||[]))).slice(-20),archive_doi:'10.5281/zenodo.23283595',classification:'user-authored-context'};saved=[...saved,project].slice(-30);try{localStorage.setItem(key,JSON.stringify(saved));status.textContent='Project saved locally';renderProjects();}catch(error){status.textContent=`Not saved: ${error.message}`;}})),projectList,status);renderProjects();
  const reports=panels.get('reports');reports.append(el('h3','','Reports'),el('p','note','Create a report from the latest successful R run. Notebook HTML, Quarto and R Markdown sources are in the notebook Export menu. Reports retain recorded outputs and do not rerun code.'));if(r.reportTools)reports.append(r.reportTools);
  const sessionStatus=el('p','note');sessionStatus.setAttribute('role','status');
  const exportSession=button('Export research session (.zip)',async()=>{
    exportSession.disabled=true;sessionStatus.textContent='Preparing exact inputs, recorded outputs and replay scripts…';
    try{const bytes=await createSessionArchive({r:r.snapshot(),datasets:await datasets(),selection:getSelection(),python_notebooks:JSON.parse(localStorage.getItem('atlas-python-notebooks-v1')||'[]'),projects:saved,transferred_datasets:transferred});downloadFile('research-session.zip',bytes,'application/zip');sessionStatus.textContent='Session archive prepared with input hashes and native replay scripts.';}catch(error){sessionStatus.textContent=`Export failed: ${error.message}`;}finally{exportSession.disabled=false;}
  });
  const importFile=el('input');importFile.type='file';importFile.accept='.zip,.json';importFile.hidden=true;importFile.setAttribute('aria-label','Import research session file');
  importFile.onchange=async()=>{try{const file=importFile.files[0];if(!file)return;if(file.size>SESSION_LIMITS.archive)throw Error('Session exceeds 128 MB.');sessionStatus.textContent='Verifying session checksums and recorded input references…';const restored=await readSessionArchive(new Uint8Array(await file.arrayBuffer()));root.f7.dialog.confirm('Replace local R and Python notebooks, projects and transferred inputs with this verified session? Code will not run.','Restore research session',async()=>{try{await r.restoreSnapshot(restored.r);python?.destroy();python=undefined;panels.get('python').replaceChildren();localStorage.setItem('atlas-python-notebooks-v1',JSON.stringify(restored.python_notebooks));saved=restored.projects;transferred=restored.transferred_datasets;localStorage.setItem(key,JSON.stringify(saved));renderProjects();options.onRestoreProject?.(restored.selection);sessionStatus.textContent=`Restored ${restored.reconstruction.runs.length} recorded runs. No code executed.`;show('r');}catch(error){sessionStatus.textContent=`Restore failed: ${error.message}`;}});}catch(error){sessionStatus.textContent=`Import rejected: ${error.message}`;}finally{importFile.value='';}};
  reports.append(exportSession,button('Import research session',()=>importFile.click()),importFile,sessionStatus);
  tabs.classList.add('workspace-sidebar-tabs');const sharedNavigation=el('div','workspace-shared-navigation');sharedNavigation.append(button('Datasets',async()=>{await root.workspaceShell?.closeNavigation();r.openDatasets();}));if(options.onOpenCollections)sharedNavigation.append(button('Collections',async()=>{await root.workspaceShell?.closeNavigation();options.onOpenCollections();}));navigation.append(tabs,sharedNavigation,r.workspaceNavigation);host.append(...panels.values());
  let releaseNavigation,disposed=false;const toolsOwner={showR:()=>show('r'),items:()=>r.workspaceActions()};
  const mount=()=>{if(disposed)return;if(!host.isConnected){requestAnimationFrame(mount);return;}releaseNavigation=root.workspaceShell?.mountNavigation(navigation);root.workspaceTools=toolsOwner;root.workspaceShell?.syncTools();};requestAnimationFrame(mount);
  host.setResearchSelection=selection=>{show('r');r.setResearchSelection(selection);};
  host.destroy=()=>{disposed=true;releaseNavigation?.();root.workspaceTools=undefined;root.workspaceShell?.syncTools();for(const scene of host.querySelectorAll('.scientific-scene'))scene.destroy?.();python?.destroy();r.destroy();};
  host.showWorkspace=show;
  return host;
}
