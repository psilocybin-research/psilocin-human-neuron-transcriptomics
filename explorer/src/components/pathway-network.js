import {uiIcon} from './icons.js';
import {plotPalette,themeScientificSVG} from './plot-theme.js';
import {ribbon} from 'npm:d3-chord@3.0.1';
import {arc} from 'npm:d3-shape@3.2.0';
import {forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY} from 'npm:d3-force@3.0.0';
import {overlapGraph, overlapRows} from './pathway-overlap.js';
import {label, fmt, sci, color, csvText, contrasts} from './format.js';
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, cls, text) => {const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n;};
const svgEl = (tag, attrs = {}, text) => {const n = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v); if (text !== undefined) n.textContent = text; return n;};
const button = (text, fn, cls = 'secondary') => {const b = el('button', cls, text); b.type = 'button'; b.onclick = fn;if(text==='+'||text==='−'){b.textContent='';b.append(uiIcon(text==='+'?'plus':'minus'));}return b;};
function save(name, text, type) {const url = URL.createObjectURL(new Blob([text], {type})); const a = el('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
const tierLetters = {primary:'P', secondary:'S', exploratory:'E'};

export function createPathwayNetwork({data, provenance, genes, state, contrast, tier, selectedPathway, onPathway, onEdge, onState}) {
 const root = el('section', 'overlap-network'); root.setAttribute('aria-label', 'Pathway overlap network');
 const graph = overlapGraph(data, contrast, {tier, members: state.networkMembers});
 const threshold = state.threshold;
 const connections = graph.pairs.filter(p => p.shared > 0 && p.jaccard >= threshold);
 const title = el('h3', '', 'Gene-set overlap');
 const description = el('p', 'note', 'Connections indicate shared gene-set membership. Thickness represents Jaccard similarity: shared genes ÷ unique genes in the two sets. Position and distance have no biological meaning. All gene sets are included irrespective of statistical significance.');
 const count = el('p', 'network-summary'); count.setAttribute('role', 'status');
 count.textContent = `${graph.nodes.length} sets · ${connections.length} shown connections · ${graph.pairs.filter(p=>p.shared>0).length} pairs with shared genes · ${graph.pairs.filter(p=>!p.available).length} unavailable pairs.`;
 const options = el('div', 'network-options');
 const thresholdLabel = el('label', 'control'); thresholdLabel.append(el('span', '', 'Minimum Jaccard (display only)'));
 const thresholdSelect = el('select'); thresholdSelect.setAttribute('aria-label', 'Minimum Jaccard');
 for (const v of [0, .05, .1, .2]) {const option = el('option', '', v === 0 ? '0 · show every nonzero overlap' : String(v)); option.value = String(v); thresholdSelect.append(option);}
 thresholdSelect.value = String(threshold); thresholdSelect.onchange = () => {state.threshold = +thresholdSelect.value; onState(true,'[aria-label="Minimum Jaccard"]');}; thresholdLabel.append(thresholdSelect);
 const views = el('div', 'network-view-toggle'); views.setAttribute('aria-label', 'Overlap display');
 for (const [value, name] of [['graph','Network'],['pairs','Overlap table'],['matrix','Matrix'],['chord','Chord']]) {
  const b = button(name, () => {state.networkView = value; onState(true,`[data-overlap-view="${value}"]`);}); b.dataset.overlapView=value;b.setAttribute('aria-pressed', String(state.networkView === value)); views.append(b);
 }
 options.append(thresholdLabel, views);
 const searchInfo = el('p', 'network-search-status'); searchInfo.setAttribute('role', 'status');
 const q = state.query.trim().toUpperCase();
 const aliases = new Set(data.aliases.filter(a=>[a.source_symbol,a.current_symbol,a.selected_gene_id].some(v=>v?.toUpperCase().includes(q))).flatMap(a=>[a.source_symbol,a.current_symbol]));
 const matchedSymbols = new Set(genes.filter(g=>g.id.toUpperCase().includes(q)||g.symbol.toUpperCase().includes(q)).map(g=>g.symbol));
 const matches = new Set(graph.nodes.filter(n=>q&&(n.id.includes(q)||n.label.toUpperCase().includes(q)||n.symbols?.some(s=>s.toUpperCase().includes(q)||aliases.has(s)||matchedSymbols.has(s)))).map(n=>n.id));
 searchInfo.textContent = q ? `${matches.size} sets match this search. Search highlights membership; it never changes overlap values or removes sets.` : 'Search highlights matching sets while preserving the complete comparison.';
 root.append(title, description, count, options, searchInfo);
 const legend = el('p','network-legend','Node fill: NES, blue negative / rust positive / grey untestable (scale −3.6 to +3.6). Equal node sizes. P = primary, S = secondary, E = exploratory. Select a gene set to inspect archived evidence or a connection to inspect the shared gene membership.'); root.append(legend);
 const empty = graph.pairs.filter(p=>p.shared>0).length - connections.length;
 if (empty || graph.nodes.some(n=>!n.available)) root.append(el('p','note',`${empty} nonzero overlaps are hidden by the display threshold. Isolated nodes remain visible. Missing connections do not imply biological independence; unavailable leading edges are not measured zero overlap.`));
 const pairLabel=el('label','control network-pair-picker');pairLabel.append(el('span','','Inspect a gene-set pair'));
 const pairSelect=el('select');pairSelect.setAttribute('aria-label','Inspect a gene-set pair');
 const placeholder=el('option','','Choose a pair to inspect shared genes');placeholder.value='';pairSelect.append(placeholder);
 for(const p of [...graph.pairs].sort((a,b)=>(b.jaccard??-1)-(a.jaccard??-1)||a.key.localeCompare(b.key))){const o=el('option','',`${graph.nodes.find(n=>n.id===p.source).short} ↔ ${graph.nodes.find(n=>n.id===p.target).short} · ${p.shared??'unavailable'} shared`);o.value=p.key;pairSelect.append(o);}
 pairSelect.value=state.edge;pairSelect.onchange=()=>{const p=graph.pairs.find(p=>p.key===pairSelect.value);if(p)chooseEdge(p);};pairLabel.append(pairSelect);root.append(pairLabel);
 const content = el('div', 'network-content'); root.append(content);
 const exports = el('div','tree-actions network-downloads');
 if (state.networkView === 'pairs') drawPairs();
 else if (state.networkView === 'matrix') drawMatrix();
 else if (state.networkView === 'chord') drawChord();
 else drawGraph();
 exports.append(button('Download overlap CSV',()=>save('pathway-overlap.csv',csvText(overlapRows(graph,contrast,state.networkMembers,threshold)),'text/csv')),
  button('Download network provenance',()=>save('pathway-overlap-provenance.json',JSON.stringify({
   view_url:location.href, contrast, membership:state.networkMembers, tier, minimum_jaccard:threshold, search:state.query,
   chord_sets:state.chordSets||null,selected_pair:state.edge||null, selected_gene:state.gene||null, nodes:graph.nodes.map(n=>({id:n.id,tier:n.row.tier,members:n.size,available:n.available})),
   pairs:graph.pairs.length, shown_connections:state.networkView==='chord'?connections.filter(p=>state.chordSets?.includes(p.source)&&state.chordSets?.includes(p.target)).length:connections.length,node_inventory_scope:'all sets in selected analysis tier; chord subset listed separately', data_sha256:provenance.outputs,
   archived_release:'https://doi.org/10.5281/zenodo.23283595',
   definition:'Jaccard = |A intersection B| / |A union B|; literal frozen symbols, no alias expansion. All pairs exported including zero and unavailable overlaps. Search does not change denominators. The display threshold does not alter the exported inventory.',
   interpretation:'Descriptive annotation overlap, not gene interaction, co-expression, independent confirmation or causal evidence. Force-layout distances are arbitrary. No new statistical tests.'
  },null,2),'application/json')));
 root.append(exports);
 function revealEvidence(fn){const current=document.fullscreenElement||document.webkitFullscreenElement;if(current&&(root.contains(current)||current.contains(root))){const exit=document.exitFullscreen||document.webkitExitFullscreen;exit.call(document).then(fn);}else fn();}
 function chooseEdge(pair) {state.edge=pair.key; state.gene=''; revealEvidence(()=>onEdge(pair)); highlight();}
 function chooseNode(id) {state.edge=''; state.gene=''; selectedPathway=id; revealEvidence(()=>onPathway(id)); highlight();}
 function highlight() {
  pairSelect.value=state.edge;
  root.querySelectorAll('[data-network-node]').forEach(n=>{n.setAttribute('aria-pressed',String(n.dataset.networkNode===selectedPathway));});
  root.querySelectorAll('[data-network-pair]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.networkPair===state.edge)));
 }
 function edgeButton(p, text) {
  const b=button(text,()=>chooseEdge(p),'network-pair-button');b.dataset.networkPair=p.key;
  b.setAttribute('aria-label',`Inspect overlap: ${label(p.source)} and ${label(p.target)}`);return b;
 }
 function drawPairs() {
  content.dataset.fullscreenHost='';content.dataset.fullscreenTitle='Pairwise gene-set overlap table';content.dataset.fullscreenInfo='Shared membership and Jaccard overlap for the selected annotation scope.';
  const scroll=el('div','network-table-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','All pairwise overlaps');
  const table=el('table','overlap-table'),head=el('thead'),tr=el('tr');
  for(const name of ['Gene-set pair','Members A / B','Shared','Jaccard','Connection shown'])tr.append(el('th','',name));head.append(tr);table.append(head);
  const body=el('tbody');
  for(const p of [...graph.pairs].sort((a,b)=>(b.jaccard??-1)-(a.jaccard??-1)||a.key.localeCompare(b.key))){
   const row=el('tr');const name=el('td');name.append(edgeButton(p,`${label(p.source)} ↔ ${label(p.target)}`));row.append(name);
   for(const value of [`${p.source_size??'Unavailable'} / ${p.target_size??'Unavailable'}`,p.shared??'Unavailable',p.jaccard===null?'Unavailable':fmt(p.jaccard,4),p.shared>0&&p.jaccard>=threshold?'Yes':!p.available?'Unavailable':p.shared===0?'Zero overlap':'Below threshold'])row.append(el('td','numeric',value));
   body.append(row);
  }
  table.append(body);scroll.append(table);content.append(scroll);
 }
 function drawMatrix() {
  const scroll=el('div','network-table-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','Jaccard overlap matrix');scroll.dataset.fullscreenTitle='Jaccard gene-set overlap matrix';scroll.dataset.fullscreenInfo='All frozen gene sets; NA denotes unavailable membership and diagonal self-comparisons are omitted.';
  const table=el('table','overlap-matrix'),head=el('thead'),hr=el('tr');hr.append(el('th','','Gene set'));
  graph.nodes.forEach((n,i)=>{const h=el('th','',String(i+1));h.title=n.label;hr.append(h);});head.append(hr);table.append(head);
  const body=el('tbody');
  graph.nodes.forEach((a,i)=>{
   const tr=el('tr');const h=el('th','',`${i+1}. ${a.short}`);h.scope='row';tr.append(h);
   graph.nodes.forEach(b=>{
    const td=el('td');if(a.id===b.id){td.textContent='—';td.title='Self-comparison omitted';}
    else{const p=graph.pairs.find(p=>p.source===a.id&&p.target===b.id||p.source===b.id&&p.target===a.id);const btt=edgeButton(p,p.jaccard===null?'NA':p.jaccard>0&&p.jaccard<.01?'<0.01':fmt(p.jaccard,2));btt.style.background=p.jaccard===null?'#e3e6e8':`rgba(35,87,128,${p.jaccard*.75})`;btt.title=`${a.label} / ${b.label}: ${p.shared??'unavailable'} shared; Jaccard ${p.jaccard===null?'unavailable':fmt(p.jaccard,4)}`;td.append(btt);}tr.append(td);
   });body.append(tr);
  });table.append(body);scroll.append(table);content.append(el('p','note','All pairwise values, including zero, remain visible regardless of the graph threshold. NA = unavailable; diagonal self-comparisons are omitted.'),scroll);
 }
 function drawChord(){
  const preferred=['HALLMARK_OXIDATIVE_PHOSPHORYLATION','REACTOME_RESPIRATORY_ELECTRON_TRANSPORT','HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY','HALLMARK_GLYCOLYSIS','HALLMARK_DNA_REPAIR','REACTOME_TELOMERE_MAINTENANCE'];
  let ids=(state.chordSets?.length?state.chordSets:preferred).filter(id=>graph.nodes.some(n=>n.id===id)).slice(0,6);
  if(!ids.length)ids=graph.nodes.slice(0,6).map(n=>n.id);
  state.chordSets=ids;
  const picker=el('fieldset','chord-set-picker');picker.append(el('legend','','Gene sets in chord view · maximum six'));
  for(const n of graph.nodes){const l=el('label');const input=el('input');input.type='checkbox';input.checked=ids.includes(n.id);input.disabled=!input.checked&&ids.length>=6;input.dataset.chordSet=n.id;input.setAttribute('aria-label',`Chord gene set: ${n.label}`);input.onchange=()=>{state.chordSets=input.checked?[...ids,n.id]:ids.filter(id=>id!==n.id);onState(true,`[data-chord-set="${n.id}"]`);};l.append(input,document.createTextNode(n.short));picker.append(l);}content.append(picker);
  content.append(el('p','note','Undirected ribbons encode pairwise shared-symbol counts. Equal angular sectors identify gene sets; ribbon endpoint widths use one common count scale. Unused sector space is not the number of unshared genes. A gene shared by more than two sets contributes to multiple ribbons.'));
  if(ids.length<2){content.append(el('p','note','Select at least two gene sets for the chord view.'));return;}
  const chosen=graph.nodes.filter(n=>ids.includes(n.id)),pairs=graph.pairs.filter(p=>ids.includes(p.source)&&ids.includes(p.target));
  count.textContent=`${graph.nodes.length} available sets · ${chosen.length} selected sectors · ${pairs.filter(p=>p.shared>0&&p.jaccard>=threshold).length} displayed ribbons · ${pairs.filter(p=>!p.available).length} unavailable selected pairs.`;legend.textContent='Sector fill: archived NES, blue negative / rust positive / grey untestable (scale −3.6 to +3.6). Equal angular sectors. Ribbons show shared annotated symbols; select a ribbon for exact counts and gene-level evidence.';
  const totals=new Map(chosen.map(n=>[n.id,pairs.filter(p=>p.source===n.id||p.target===n.id).reduce((sum,p)=>sum+(p.shared||0),0)]));
  const span=Math.PI*2/chosen.length,padding=.12,maxTotal=Math.max(1,...totals.values()),unit=(span-padding)/maxTotal;
  const starts=new Map(chosen.map((n,i)=>[n.id,i*span+padding/2])),sectors=new Map(chosen.map((n,i)=>[n.id,{startAngle:i*span+padding/2,endAngle:(i+1)*span-padding/2}]));
  const scroll=el('div','network-map chord-map plot-viewport');scroll.style.setProperty('--plot-width','820px');scroll.tabIndex=0;scroll.dataset.fullscreenHost='';scroll.dataset.fullscreenTitle='Pairwise gene-set overlap chord diagram';scroll.dataset.fullscreenInfo='Undirected ribbons show pairwise shared-symbol counts. Equal sectors identify gene sets; overlap is descriptive, not biological flux.';scroll.setAttribute('aria-label','Scrollable chord diagram');
  const s=svgEl('svg',{viewBox:'0 0 820 780',role:'group','aria-label':'Pairwise gene-set overlap chord diagram',xmlns:NS});const g=svgEl('g',{transform:'translate(410,370)'});s.append(g);
  for(const p of pairs){if(!p.shared)continue;const a=starts.get(p.source),b=starts.get(p.target),width=p.shared*unit;starts.set(p.source,a+width);starts.set(p.target,b+width);
   if(p.jaccard<threshold)continue;
   const path=svgEl('path',{d:ribbon().radius(245)({source:{startAngle:a,endAngle:a+width},target:{startAngle:b,endAngle:b+width}}),fill:'#688aa3','fill-opacity':.42,stroke:'#fff','stroke-width':1,role:'button',tabindex:0,'class':'chord-ribbon','data-network-pair':p.key,'aria-label':`Inspect overlap: ${label(p.source)} and ${label(p.target)}, ${p.shared} shared genes`});path.append(svgEl('title',{},`${p.shared} shared symbols; Jaccard ${fmt(p.jaccard,4)}`));path.addEventListener('click',()=>chooseEdge(p));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseEdge(p);}});g.append(path);
  }
  chosen.forEach((n,i)=>{const sector=sectors.get(n.id),angle=(sector.startAngle+sector.endAngle)/2;const path=svgEl('path',{d:arc().innerRadius(250).outerRadius(268)(sector),fill:color(n.row.NES,3.6),stroke:'#425e73','stroke-width':1.5,role:'button',tabindex:0,'class':'chord-sector','data-network-node':n.id,'aria-label':`Inspect pathway: ${n.label}`});path.append(svgEl('title',{},`${n.label}: ${n.size??'unavailable'} members; NES ${fmt(n.row.NES)}, q ${sci(n.row.family_fdr)}`));path.addEventListener('click',()=>chooseNode(n.id));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseNode(n.id);}});g.append(path);
   const x=Math.sin(angle)*310,y=-Math.cos(angle)*310;const text=svgEl('text',{x,y,'text-anchor':'middle','class':'chord-label','font-size':13,fill:'#203d50'});const lines=[''];for(const word of n.short.split(' ')){if((lines.at(-1)+' '+word).trim().length>17)lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}lines.forEach((line,index)=>text.append(svgEl('tspan',{x,dy:index?16:0},line)));g.append(text);
  });
  s.append(svgEl('text',{x:16,y:745,'font-size':12,fill:'#203d50'},`${state.networkMembers==='all'?'Full frozen annotations':'Contrast-specific leading edges'} · ${contrasts[contrast]}`),svgEl('text',{x:16,y:767,'font-size':11,fill:'#203d50'},`Pairwise annotation overlap; no biological flux or temporal transitions. Jaccard display threshold ${threshold}.`));scroll.append(s);content.append(scroll);
  exports.append(button('Download chord SVG',()=>downloadChord()));
  function downloadChord(){const copy=s.cloneNode(true);copy.setAttribute('width','820');copy.setAttribute('height','780');copy.querySelectorAll('[role="button"]').forEach(n=>{n.removeAttribute('role');n.removeAttribute('tabindex');});themeScientificSVG(copy,plotPalette(root));save('pathway-overlap-chord.svg',new XMLSerializer().serializeToString(copy),'image/svg+xml');}
 }
 function drawGraph() {
  const controls=el('div','network-map-controls');const scroll=el('div','network-map plot-viewport');scroll.style.setProperty('--plot-width','820px');scroll.tabIndex=0;scroll.setAttribute('aria-label','Scrollable pathway network');
  content.dataset.fullscreenHost='';content.dataset.fullscreenTitle='Pathway membership overlap network';content.dataset.fullscreenInfo='Connections encode shared annotated membership; positions and distances have no biological meaning.';
  const svg=svgEl('svg',{viewBox:'0 0 820 780',role:'group','aria-labelledby':'overlap-map-title','aria-describedby':'overlap-map-description',xmlns:NS});
  svg.append(svgEl('title',{id:'overlap-map-title'},'Pathway membership overlap network'),svgEl('desc',{id:'overlap-map-description'},'Undirected connections show shared annotated genes. Node colour is the archived NES. Distances have no scientific meaning. Equivalent exact values are in the overlap table and matrix.'));
  const width=820,height=780;
  // Work only on copies: d3-force mutates its simulation nodes and links.
  const nodes=graph.nodes.map(n=>({...n}));const links=overlapGraph(data,data.contrasts[0],{tier,members:'all'}).pairs.filter(p=>p.shared>0).map(p=>({...p}));
  const simulation=forceSimulation(nodes).stop().force('charge',forceManyBody().strength(-450))
   .force('link',forceLink(links).id(n=>n.id).distance(p=>200-180*p.jaccard).strength(.06))
   .force('collide',forceCollide(76).iterations(3)).force('x',forceX(width/2).strength(.035)).force('y',forceY(height/2).strength(.035));
  simulation.tick(360);simulation.stop();
  // Keep label extents separated around circular nodes; deterministic and bounded.
  for(let tick=0;tick<160;tick++){
   for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],dx=b.x-a.x,dy=b.y-a.y,ox=174-Math.abs(dx),oy=106-Math.abs(dy);
    if(ox>0&&oy>0){if(ox<oy){const push=(ox+.2)/2*(dx>=0?1:-1);a.x-=push;b.x+=push;}else{const push=(oy+.2)/2*(dy>=0?1:-1);a.y-=push;b.y+=push;}}
   }
   for(const n of nodes){n.x=Math.max(85,Math.min(width-85,n.x));n.y=Math.max(38,Math.min(height-90,n.y));}
  }
  const original=new Map(nodes.map(n=>[n.id,{x:n.x,y:n.y}]));const byId=new Map(nodes.map(n=>[n.id,n]));
  const edgesLayer=svgEl('g',{'class':'network-edges'}),nodeLayer=svgEl('g',{'class':'network-nodes'});svg.append(edgesLayer,nodeLayer);
  const edgeElements=[];
  for(const p of connections){
   const g=svgEl('g',{'class':'network-edge',role:'button',tabindex:0,'aria-label':`Inspect overlap: ${label(p.source)} and ${label(p.target)}, ${p.shared} shared genes, Jaccard ${fmt(p.jaccard,4)}`,'data-network-pair':p.key});
   const visible=svgEl('line',{stroke:'#7791a5','stroke-width':1+18*p.jaccard,'class':'network-link'}),hit=svgEl('line',{stroke:'transparent','stroke-width':18,'class':'network-link-hit'});
   g.append(visible,hit,svgEl('title',{},`${label(p.source)} ↔ ${label(p.target)}: ${p.shared} shared, Jaccard ${fmt(p.jaccard,4)}`));
   g.addEventListener('click',()=>chooseEdge(p));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseEdge(p);}});
   edgesLayer.append(g);edgeElements.push({p,visible,hit});
  }
  const nodeElements=[];let moving=false,drag=null;
  nodes.forEach((n,i)=>{
   const g=svgEl('g',{'class':`network-node${matches.has(n.id)?' search-match':''}`,role:'button',tabindex:0,'data-network-node':n.id,'aria-label':`Inspect pathway: ${n.label}, ${n.row.tier}, NES ${fmt(n.row.NES)}, family q ${n.row.NES===null?'not tested':sci(n.row.family_fdr)}, ${n.size??'unavailable'} members`});
   g.append(svgEl('rect',{x:-80,y:-27,width:160,height:89,rx:8,'class':'network-node-hit'}),svgEl('circle',{r:20,fill:color(n.row.NES,3.6),stroke:'#425e73','stroke-width':1.5,'stroke-dasharray':n.row.tier==='secondary'?'5 2':n.row.tier==='exploratory'?'1 3':'none'}),svgEl('text',{x:0,y:5,'text-anchor':'middle','class':'network-tier'},tierLetters[n.row.tier]));
   const words=n.short.split(' ');const lines=[''];for(const word of words){if((lines.at(-1)+' '+word).trim().length>17&&lines.length<2)lines.push(word);else lines[lines.length-1]=(lines.at(-1)+' '+word).trim();}
   lines.forEach((value,j)=>g.append(svgEl('text',{x:0,y:38+j*17,'text-anchor':'middle','class':'network-node-label'},value)));
   g.append(svgEl('title',{},`${n.label} · ${n.row.tier} · ${n.size??'unavailable'} members · NES ${fmt(n.row.NES)} · q ${n.row.NES===null?'not tested':sci(n.row.family_fdr)}`));
   g.addEventListener('click',()=>{if(!moving)chooseNode(n.id);});
   g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseNode(n.id);}else if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?nodes.length-1:(i+(e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length;nodeElements[next].g.focus();}});
   g.addEventListener('pointerdown',e=>{if(!moving)return;e.preventDefault();drag={n,g,pointer:e.pointerId};g.setPointerCapture(e.pointerId);});
   g.addEventListener('pointermove',e=>{if(drag?.n!==n)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());n.x=Math.max(85,Math.min(width-85,point.x));n.y=Math.max(38,Math.min(height-90,point.y));position();});
   const end=e=>{if(drag?.n===n){if(g.hasPointerCapture(e.pointerId))g.releasePointerCapture(e.pointerId);drag=null;}};g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
   nodeLayer.append(g);nodeElements.push({n,g});
  });
  function position(){for(const{n,g}of nodeElements)g.setAttribute('transform',`translate(${n.x},${n.y})`);for(const{p,visible,hit}of edgeElements){const a=byId.get(p.source),b=byId.get(p.target);for(const l of [visible,hit]){l.setAttribute('x1',a.x);l.setAttribute('y1',a.y);l.setAttribute('x2',b.x);l.setAttribute('y2',b.y);}}}
  position();let zoom=1;const zoomLabel=el('span','network-zoom-label','100%');zoomLabel.setAttribute('role','status');
  function setZoom(value){zoom=Math.max(.5,Math.min(2,value));scroll.style.setProperty('--network-zoom',String(zoom));svg.style.removeProperty('width');svg.style.removeProperty('min-width');zoomLabel.textContent=`${Math.round(zoom*100)}%`;}
  const move=button('Move nodes',()=>{moving=!moving;move.setAttribute('aria-pressed',String(moving));scroll.classList.toggle('move-nodes',moving);});move.setAttribute('aria-pressed','false');
  controls.append(button('−',()=>setZoom(zoom-.25)),zoomLabel,button('+',()=>setZoom(zoom+.25)),button('Reset layout',()=>{for(const n of nodes)Object.assign(n,original.get(n.id));position();setZoom(1);}),move);
  controls.children[0].setAttribute('aria-label','Zoom out network');controls.children[2].setAttribute('aria-label','Zoom in network');

  exports.append(button('Download network SVG',()=>{
   const copy=svg.cloneNode(true);copy.removeAttribute('style');copy.setAttribute('width','820');copy.setAttribute('height','880');copy.setAttribute('viewBox','0 0 820 880');
   copy.querySelectorAll('.network-link-hit').forEach(n=>n.remove());copy.querySelectorAll('[tabindex], [role="button"]').forEach(n=>{n.removeAttribute('tabindex');n.removeAttribute('role');});
   const style=svgEl('style',{},'.network-node-label,.network-tier{font:14px system-ui,sans-serif;fill:#203d50}.network-node-label{paint-order:stroke;stroke:white;stroke-width:4px}.network-node-hit{fill:transparent;stroke:none;pointer-events:all}.network-edge[aria-pressed=true] .network-link{stroke:#183e5b;stroke-width:8}.search-match circle{stroke:#946c20;stroke-width:4}');copy.prepend(style);
   const caption=[`${contrasts[contrast]} · ${state.networkMembers==='all'?'Full frozen annotations':'Contrast-specific leading edges'}`,
    `Jaccard ≥ ${threshold}; ${connections.length} shown connections. P primary / S secondary / E exploratory.`,
    'NES fill: blue negative / rust positive / grey untestable; fixed scale ±3.6. Equal node sizes.',
    'Annotation overlap only. Distances are arbitrary. DOI: 10.5281/zenodo.23283595'];
   caption.forEach((text,i)=>copy.append(svgEl('text',{x:16,y:794+i*22,'font-size':13,'font-family':'system-ui, sans-serif',fill:'#203d50'},text)));
   themeScientificSVG(copy,plotPalette(root));save('pathway-overlap.svg',new XMLSerializer().serializeToString(copy),'image/svg+xml');
  }));
  content.append(controls,el('p','note','The deterministic layout is static. Scroll to pan and use +/− to zoom. Node repositioning is optional; disable it to restore selection. Outlined nodes indicate search matches.'),scroll);scroll.append(svg);setZoom(1);
 }
 root.refreshSelection=id=>{if(id)selectedPathway=id;highlight();};root.focusSelection=()=>{const selected=[...root.querySelectorAll('[data-network-pair],[data-network-node]')].find(n=>n.dataset.networkPair===state.edge||!state.edge&&n.dataset.networkNode===selectedPathway);selected?.focus();};
 highlight();return root;
}
