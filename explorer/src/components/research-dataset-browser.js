import {createElement as el} from './interface-utils.js';
import {downloadFile} from './file-download.js';
import {researchTableCSV} from './research-datasets.js';

/** Browse frozen input metadata without initializing a computational runtime. */
export async function openResearchDatasets({root,getTables,onInsert,onImport}) {
 const sheet=el('div','sheet-modal studio-pane-sheet workspace-datasets-sheet'),body=el('div','sheet-modal-inner'),stage=el('div');
 let modal;body.append(el('h3','','Datasets'),el('p','note','Frozen input tables · archive DOI 10.5281/zenodo.23283595. These are fitted estimates and pooled profiles, not raw counts.'),stage);sheet.append(body);root.append(sheet);
 stage.textContent='Loading dataset metadata…';modal=root.f7.sheet.create({el:sheet,backdrop:true,closeOnEscape:true,swipeToClose:true,on:{closed(){sheet.remove();setTimeout(()=>modal.destroy(),0);}}});modal.open();
 function button(text,fn){const b=el('button','button button-tonal',text);b.type='button';b.onclick=fn;return b;}
 try{const tables=await getTables();if(!sheet.isConnected)return;stage.replaceChildren();const list=el('div','list list-outline'),ul=el('ul');list.append(ul);for(const [name,rows]of Object.entries(tables)){const li=el('li'),row=el('div','item-content'),inner=el('div','item-inner'),label=el('div','item-title',name),after=el('div','item-after',`${rows.length.toLocaleString()} rows`);inner.append(label,after);row.append(inner);const details=el('details'),summary=el('summary','','Columns & actions');details.append(summary,el('p','note',Object.keys(rows[0]||{}).join(' · ')),button('Download CSV',()=>downloadFile(`${name}.csv`,researchTableCSV(rows),'text/csv')),button('Inspect in R',()=>{onInsert(`results <- head(${name}, 50)\nprint(results)`);modal.close();}));li.append(row,details);ul.append(li);}stage.append(list,button('Import dataset',()=>{modal.close(false);setTimeout(onImport,0);}));}catch(error){stage.textContent=error.message;}
 body.append(button('Done',()=>modal.close()));
 return modal;
}
