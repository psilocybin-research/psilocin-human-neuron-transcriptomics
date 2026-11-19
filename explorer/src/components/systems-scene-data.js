import {SCIENTIFIC_SCENE_SCHEMA,validateSceneSpec} from './scientific-scene-spec.js';
export const SYSTEM_SCENES = [
  {id:'systems',label:'OXPHOS functional systems'},
  {id:'complexes',label:'Respiratory complex membership'},
  {id:'multilayer',label:'Gene–pathway–complex layers'},
  {id:'collection',label:'My selected gene network'},
  {id:'neuron',label:'Illustrative neuron navigation'}
];
const contrastIds=['day1_vs_control','day3_vs_control','day3_vs_day1'];
const complexCaption='Complex membership comes from frozen reviewed UniProt mappings. Missing complex V membership means no selected cohort gene was assigned; it does not establish absence of complex V biology.';
function circle(index,count,radius=1){const angle=2*Math.PI*index/Math.max(1,count);return {x:radius*Math.cos(angle),y:radius*Math.sin(angle)};}
export function systemsSceneData(snapshot,{mode='systems',contrast='day1_vs_control',geneIds=[],sourceSha256}={}) {
  if(!SYSTEM_SCENES.some(row=>row.id===mode))throw Error('Unknown systems view.');
  if(!contrastIds.includes(contrast))throw Error('Unknown archived contrast.');
  if(!/^[a-f0-9]{64}$/.test(sourceSha256||''))throw Error('An exact source snapshot hash is required.');
  const genes=snapshot.nodes.filter(row=>row.type==='gene'),lookup=new Map(genes.map(g=>[g.id,g]));
  const bySymbol=new Map(genes.map(g=>[g.symbol,g]));
  const requested=[...new Set(geneIds)],selected=requested.map(id=>lookup.get(id)||bySymbol.get(id)).filter(Boolean);
  const seen=new Set();const uniqueSelected=selected.filter(g=>!seen.has(g.id)&&seen.add(g.id));
  const omitted=requested.filter(id=>!lookup.has(id)&&!bySymbol.has(id));
  const spec={schema:SCIENTIFIC_SCENE_SCHEMA,kind:'schematic',classification:mode==='collection'?'user-exploratory':'illustrative',title:SYSTEM_SCENES.find(row=>row.id===mode).label,
    source:{label:'Frozen atlas membership and curated complex mapping; illustrative coordinates',file:'explorer/src/assets/vendor/oxphos-network-data.js',sha256:sourceSha256,archive_doi:'10.5281/zenodo.23283595'},
    axes:{x:'Illustrative layout X',y:'Illustrative layout Y',z:'Illustrative category layer'},layout_semantics:'illustrative-not-spatial-evidence',
    caption:'Positions are illustrative, not measured anatomy, subcellular localization or biological distance. Links represent only the stated memberships; they do not imply interaction, correlation, electron flow or causation.',data:[],edges:[]};
  if(mode==='neuron') {
    spec.source.label='Illustrative application navigation; no measured cell anatomy or gene localization';
    spec.caption='Illustrative neuron-compartment navigation, not a reconstruction or simulation. No gene is assigned to a cellular compartment. Lines are navigation links, not anatomy, transport, synapses or experimental evidence.';
    const nodes=[['nav:soma','Cell body',0,0,0],['nav:dendrites','Dendritic context',-1,0.8,0.2],['nav:axon','Axonal context',1,-0.7,0.2],['nav:mitochondria','Mitochondrial systems',0.45,0.3,0.6]];
    spec.data=nodes.map(([id,label,x,y,z])=>({id,label,x,y,z,node_type:'compartment',evidence:'Illustrative navigation landmark; not measured cell geometry.'}));
    spec.edges=nodes.slice(1).map(([id])=>({source:'nav:soma',target:id,relation:'navigation',evidence:'Application navigation only; no biological edge asserted.'}));
    return {spec:validateSceneSpec(spec),genes:[],omitted:[],availableGenes:genes.length,complexCounts:{}};
  }
  let chosen=mode==='collection'?uniqueSelected:mode==='complexes'?genes.filter(g=>g.complex):genes;
  if(!chosen.length)throw Error(mode==='collection'?'Select at least one gene with an exact match in the archived OXPHOS cohort.':'No archived genes match this view.');
  const chosenIds=new Set(chosen.map(g=>g.id)),day=contrastIds.indexOf(contrast);
  // All contrasts share this fixed domain: changing day never rescales the colour meaning.
  const maximum=genes.reduce((max,g)=>Math.max(max,...g.effects.map(e=>Number.isFinite(e?.log2FoldChange)?Math.abs(e.log2FoldChange):0)),1);
  spec.color_limit=Math.ceil(maximum*2)/2;spec.color_label=`${contrast} · archived log2 fold change`;
  function geneNode(g,position){const effect=g.effects[day]?.log2FoldChange;return {id:g.id,label:g.symbol,node_type:'gene',...position,...(Number.isFinite(effect)?{color:effect}:{}),evidence:'Archived selected OXPHOS leading-edge cohort; original transcriptome-wide inference unchanged.'};}
  const complexCounts=Object.fromEntries(['I','II','III','IV','V'].map(key=>[key,chosen.filter(g=>g.complex===key).length]));
  if(mode==='systems'||mode==='complexes') {
    const groupKeys=[...new Set(chosen.map(g=>mode==='complexes'?g.complex:g.displayGroup||'Unclassified'))].sort();
    groupKeys.forEach((key,index)=>{
      const center=circle(index,groupKeys.length,2),members=chosen.filter(g=>(mode==='complexes'?g.complex:g.displayGroup||'Unclassified')===key),hub=`${mode==='complexes'?'complex':'category'}:${key}`;
      spec.data.push({id:hub,label:mode==='complexes'?`Complex ${key}`:key,node_type:mode==='complexes'?'complex':'category',...center,z:0,evidence:mode==='complexes'?'Curated UniProt exact-ID complex assignment.':'Archived display category; not a new pathway test or measured localization.'});
      members.forEach((g,i)=>{const offset=circle(i,members.length,0.5);spec.data.push(geneNode(g,{x:center.x+offset.x,y:center.y+offset.y,z:0.5+(i%3)*0.1}));spec.edges.push({source:g.id,target:hub,relation:mode==='complexes'?'curated-complex':'membership',evidence:mode==='complexes'?g.basis:'Archived functional display annotation; classification only.'});});
    });
    spec.caption += ' '+(mode==='complexes'?complexCaption:'The OXPHOS gene set includes broader metabolic/redox members; set membership does not prove mitochondrial localization.');
  } else {
    chosen.forEach((g,i)=>spec.data.push(geneNode(g,{...circle(i,chosen.length,1.4),z:0})));
    const edges=snapshot.links.filter(edge=>chosenIds.has(edge.source)),pathways=snapshot.nodes.filter(node=>node.type==='pathway'&&edges.some(edge=>edge.target===node.id));
    pathways.forEach((p,i)=>spec.data.push({id:p.id,label:p.pathway.replace(/^HALLMARK_/,'').replaceAll('_',' '),node_type:'pathway',...circle(i,pathways.length,1.8),z:-1,evidence:'Archived gene-set membership; enrichment is not inferred from node placement.'}));
    spec.edges.push(...edges.map(edge=>({source:edge.source,target:edge.target,relation:'membership',evidence:edge.relation})));
    if(mode==='multilayer') {
      const complexes=['I','II','III','IV','V'].filter(key=>complexCounts[key]);
      complexes.forEach((key,i)=>{
        spec.data.push({id:`complex:${key}`,label:`Complex ${key}`,node_type:'complex',...circle(i,complexes.length,1.2),z:1,evidence:'Curated UniProt exact-ID complex assignment.'});
        chosen.filter(g=>g.complex===key).forEach(g=>spec.edges.push({source:g.id,target:`complex:${key}`,relation:'curated-complex',evidence:g.basis}));
      });
      spec.caption += ' '+complexCaption;
    }
  }
  return {spec:validateSceneSpec(spec),genes:chosen.map(g=>({id:g.id,symbol:g.symbol,complex:g.complex??null})),omitted,availableGenes:genes.length,complexCounts};
}
