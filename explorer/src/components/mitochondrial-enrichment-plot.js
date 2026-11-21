import { createElement as el } from './interface-utils.js';
import { Plot, scientificPlot, interactiveMark } from './scientific-plot.js';
import { fmt, sci, leadingEdgeColors } from './format.js';
import { mitochondrialGeneRow } from './mitochondrial-gene-row.js';
import { archivedGene, stableGeneId } from './mitochondrial-mapping.js';
import { enrichmentPlotModel, mitochondrialPathwayName } from './mitochondrial-enrichment-model.js';

const dayColor = day => leadingEdgeColors[day === 1 ? 'Day 1 only' : 'Day 3 only'];
function button(text,callback){const node=el('button','button button-tonal',text);node.type='button';node.onclick=callback;return node;}
function smallTable(headers,rows){const wrap=el('div','table-scroll data-table'),table=el('table'),head=el('thead'),body=el('tbody'),tr=el('tr');for(const name of headers){const cell=el('th','',name);cell.scope='col';tr.append(cell);}head.append(tr);rows.forEach(values=>{const row=el('tr');values.forEach(value=>row.append(el('td','',value)));body.append(row);});table.append(head,body);wrap.append(table);return wrap;}
export function createMitochondrialEnrichmentPlot({data,snapshot,genes,onGene,onSendGene,evidenceHost,onInspect}){
 const root=el('section','mitochondrial-paired-enrichment');
 root.append(el('h2','','Mitochondrial gene-set enrichment'),el('p','note','Compare Day 1 and Day 3 against the common control. NES describes enrichment in ranked differential-expression statistics; it is not fold change, mitochondrial activity or a direct comparison between days.'));
 const controls=el('div','segmented segmented-strong mito-plot-scope');controls.setAttribute('role','group');controls.setAttribute('aria-label','Enrichment plot pathway scope');
 let mode='overview',selected,memberScope='leading';
 const overview=button('Biological overview',()=>{mode='overview';render();}),all=button('All tested pathways',()=>{mode='all';render();});controls.append(overview,all);
 const legend=el('div','mito-dot-legend');
 for(const [day,name] of [[1,'Day 1'],[3,'Day 3']]){const item=el('span'),dot=el('i');dot.style.background=dayColor(day);item.append(dot,document.createTextNode(name));legend.append(item);}
 legend.append(el('span','','Filled: joint BH q < 0.05 · hollow: q ≥ 0.05'));
 const viewport=el('div','mito-dot-viewport'),chart=el('div','mito-dot-chart'),detail=el('section','mito-pathway-detail');detail.setAttribute('aria-label','Selected mitochondrial pathway evidence');detail.setAttribute('aria-live','polite');
 viewport.append(chart);
 const selectionLabel=el('label','mito-pathway-picker'),picker=el('select');picker.setAttribute('aria-label','Inspect mitochondrial pathway');selectionLabel.append(el('span','','Inspect pathway'),picker);
 for(const path of snapshot.pathways){const option=el('option','',mitochondrialPathwayName(path.id));option.value=path.id;picker.append(option);}
 picker.onchange=()=>inspect(picker.value,selected?.day||1);
 root.append(controls,el('p','note','The biological overview is selected by function, not significance. All tested pathways and all 149 pathway details remain available. Select a dot or use the pathway selector for exact results and genes. Untested sets have no NES and are labelled explicitly.'),legend,viewport,selectionLabel);
 (evidenceHost || root).append(detail);
 let width=0,frame=0;
 const observer=new ResizeObserver(entries=>{
  const next=Math.round(entries[0].contentRect.width);if(next<1||next===width)return;width=next;
  cancelAnimationFrame(frame);frame=requestAnimationFrame(render);
 });observer.observe(viewport);
 function describe(row){return `${mitochondrialPathwayName(row.pathway)}, Day ${row.day}, NES ${fmt(row.NES)}, joint BH q ${sci(row.qvalue)}. Inspect pathway evidence.`;}
 function render(){
  if(!root.isConnected)return;
  const model=enrichmentPlotModel(data,mode),narrow=width<600,plotWidth=Math.max(280,Math.min(width||760,1100));
  const labels=model.domain.map(pathway=>({pathway,key:`${pathway}|1`,name:mitochondrialPathwayName(pathway)}));
  const points=model.rows.filter(r=>r.status==='tested'&&Number.isFinite(r.NES)).map(r=>({...r,key:`${r.pathway}|${r.day}`}));
  const missing=model.rows.filter(r=>r.status!=='tested').map(r=>({...r,key:`${r.pathway}|${r.day}`}));
  const keys=model.domain.flatMap(id=>[`${id}|1`,`${id}|3`]);
  const marginLeft=narrow?14:252, marginRight=14;
  const marks=[Plot.ruleX([0],{stroke:'#7b92a4',strokeDasharray:'4 4'})];
  if(narrow)marks.push(Plot.text(labels,{x:-model.extent,y:'key',text:'name',textAnchor:'start',dy:-17,fontWeight:600,fontSize:11}));
  marks.push(Plot.dot(points,{x:'NES',y:'key',r:5.5,stroke:r=>dayColor(r.day),strokeWidth:2,fill:r=>r.significant?dayColor(r.day):'none'}));
  marks.push(Plot.dot(points,{x:'NES',y:'key',r:12,fill:'transparent',stroke:'none',title:describe,render:interactiveMark(points,r=>inspect(r.pathway,r.day),describe)}));
  marks.push(Plot.text(missing,{x:0,y:'key',text:r=>`Day ${r.day}: not tested · ${r.matchedSize} genes`,textAnchor:'middle',fontSize:narrow?10:11,fill:'#526575'}));
  const svg=scientificPlot({title:'Exploratory MitoCarta enrichment · paired Day 1 and Day 3',description:'Fixed symmetric NES axis. Two dots per tested pathway, Day 1 first and Day 3 second. Filled dots meet joint BH q < 0.05. No temporal difference test or uncertainty interval is implied.',width:plotWidth,height:model.domain.length*(narrow?76:52)+95,marginLeft,marginRight,marginTop:58,marginBottom:18,
   x:{domain:[-model.extent,model.extent],axis:'top',label:'Normalized enrichment score (NES)',grid:true,ticks:7},
   y:{domain:keys,padding:narrow?.9:.6,axis:narrow?null:'left',tickSize:0,tickFormat:key=>key.endsWith('|1')?mitochondrialPathwayName(key.slice(0,-2)):'',label:null},marks});
  svg.dataset.mitoEnrichmentPlot=mode;chart.replaceChildren(svg);
  overview.classList.toggle('button-active',mode==='overview');overview.setAttribute('aria-pressed',String(mode==='overview'));
  all.classList.toggle('button-active',mode==='all');all.setAttribute('aria-pressed',String(mode==='all'));
 }
 function inspect(pathway,day,{notify=true,scope='leading'}={}){
  selected={pathway,day};picker.value=pathway;memberScope=scope;renderDetails();
  if(notify)onInspect?.({...selected});
 }
 function renderDetails(){
  const {pathway,day}=selected,rows=data.results.filter(r=>r.pathway===pathway),path=snapshot.pathways.find(p=>p.id===pathway);
  const result=rows.find(r=>(r.contrast==='day1_vs_control'?1:3)===day);
  detail.replaceChildren(el('h3','',mitochondrialPathwayName(pathway)));
  const pvalue=row=>row.pvalue===null?'Not tested':row.pvalue<=data.metadata.eps?`≤ ${data.metadata.eps}`:sci(row.pvalue);
  detail.append(smallTable(['Contrast','NES','Nominal p','Joint BH q','Curated / ranked'],rows.map(r=>[`Day ${r.contrast==='day1_vs_control'?1:3} / common control`,fmt(r.NES),pvalue(r),r.status==='tested'?sci(r.qvalue):r.status,`${r.curatedSize} / ${r.matchedSize}`])));
  detail.append(el('p','note',`Original MitoCarta hierarchy: ${path.hierarchy.replaceAll('_',' ')}. ${result.status==='tested'?'Both days use the same joint 152-test correction; significance differences do not establish a change between days.':`Day ${day}: ${result.status}. No zero effect or null result is assigned.`}`));
  const days=el('div','segmented segmented-strong mito-detail-controls');days.setAttribute('role','group');days.setAttribute('aria-label','Leading-edge contrast');
  [1,3].forEach(value=>{const b=button(`Day ${value} genes`,()=>inspect(pathway,value,{scope:memberScope}));b.classList.toggle('button-active',value===day);b.setAttribute('aria-pressed',String(value===day));days.append(b);});
  const scopes=el('div','segmented segmented-strong mito-detail-controls');scopes.setAttribute('role','group');scopes.setAttribute('aria-label','Pathway gene scope');
  for(const [key,name] of [['leading','Leading edge'],['all','All curated members']]){const b=button(name,()=>{memberScope=key;renderDetails();});b.classList.toggle('button-active',memberScope===key);b.setAttribute('aria-pressed',String(memberScope===key));scopes.append(b);}
  const keys=new Set(path.members),members=snapshot.entries.filter(e=>keys.has(e.key)),leading=new Set(Array.isArray(result.leadingEdge)?result.leadingEdge:result.leadingEdge?[result.leadingEdge]:[]);
  const retained=members.filter(entry=>{const gene=archivedGene(entry,genes);return memberScope==='all'||(gene&&leading.has(stableGeneId(gene.id)));});
  const list=el('ul','mito-pathway-genes');
  for(const entry of retained){const item=el('li'),gene=archivedGene(entry,genes);if(gene){item.append(mitochondrialGeneRow(gene,{onGene,onSendGene}));}else item.append(el('strong','',entry.symbol),el('span','note',entry.mappingStatus));list.append(item);}
  detail.append(days,scopes,el('p','note',`${retained.length} / ${members.length} curated members shown. Day ${day} leading edges are selected by this enrichment result and are not an independent validation set. Source identity mappings and absent records are retained under All curated members.`),list);
  if(!retained.length)list.append(el('li','note',result.status==='tested'?'No leading-edge genes are available.':'No leading edge: this pathway was not tested. Choose All curated members to inspect its genes.'));
 }
 inspect('OXPHOS',1,{notify:false});
 return {element:root,select:inspect,getSelection:()=>({...selected}),dispose(){observer.disconnect();cancelAnimationFrame(frame);}};
}
