import { createElement as el } from './interface-utils.js';
const ns='http://www.w3.org/2000/svg';
function svgNode(tag,attrs={},text){const node=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);if(text!==undefined)node.textContent=text;return node;}
let sequence=0;
export function createRespiratorySchematic(onSelect){
 const host=el('div','respiratory-chain-scroll'),svg=svgNode('svg',{viewBox:'0 0 760 215',width:760,height:215,'aria-label':'Reference respiratory chain: complexes I and II feed ubiquinone, then III, cytochrome c and IV. Complex V uses the proton gradient.'});
 const markerId=`respiratory-arrow-${++sequence}`,defs=svgNode('defs'),marker=svgNode('marker',{id:markerId,viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'});
 marker.append(svgNode('path',{d:'M0 0 L10 5 L0 10 Z',fill:'currentColor'}));defs.append(marker);svg.append(defs);
 svg.append(svgNode('rect',{x:8,y:72,width:744,height:90,rx:20,class:'respiratory-membrane'}));
 svg.append(svgNode('text',{x:16,y:202,'font-size':12},'Inner mitochondrial membrane · reference organization, not measured activity'));
 for(const d of ['M102 85 L102 52 L231 52 L231 85','M255 111 L304 111','M396 111 L421 111','M461 111 L500 111'])svg.append(svgNode('path',{d,fill:'none',stroke:'currentColor','stroke-width':1.5,'marker-end':`url(#${markerId})`,class:'respiratory-transfer'}));
 svg.append(svgNode('text',{x:123,y:40,'font-size':12},'Electron transfer'));
 for(const [x,name] of [[235,'Q'],[441,'cyt c']]){svg.append(svgNode('circle',{cx:x,cy:111,r:20,class:'respiratory-carrier'}),svgNode('text',{x,y:115,'text-anchor':'middle','font-size':12},name));}
 svg.append(svgNode('path',{d:'M102 85 L102 22 L685 22 L685 85 M350 85 L350 22 M550 85 L550 22',fill:'none',stroke:'currentColor','stroke-width':1.5,'stroke-dasharray':'4 3','marker-end':`url(#${markerId})`}));
 svg.append(svgNode('text',{x:450,y:13,'font-size':11},'Proton gradient (I, III, IV)'));
 const buttons=new Map();
 for(const [id,x,name] of [['I',56,'NADH'],['II',106,'Succinate'],['III',304,'bc₁'],['IV',500,'O₂ → H₂O'],['V',637,'ATP synthase']]){
  // II is lower to distinguish its separate electron-entry branch.
  const y=id==='II'?140:85,w=92;
  const group=svgNode('g',{role:'button',tabindex:0,'aria-label':`Complex ${id} ${name==='bc₁'?'Cytochrome bc₁':name==='NADH'?'NADH entry':name==='Succinate'?'Succinate entry':name==='O₂ → H₂O'?'Oxygen reduction':name}`,'aria-pressed':'false',class:'respiratory-complex-node','data-complex':id});
  group.append(svgNode('rect',{x,y,width:w,height:46,rx:12}),svgNode('text',{x:x+w/2,y:y+19,'text-anchor':'middle','font-size':14,'font-weight':650},`Complex ${id}`),svgNode('text',{x:x+w/2,y:y+35,'text-anchor':'middle','font-size':11},name));
  const select=()=>onSelect(id);group.addEventListener('click',select);group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select();}});buttons.set(id,group);svg.append(group);
 }
 svg.append(svgNode('path',{d:'M198 163 L235 163 L235 132',fill:'none',stroke:'currentColor','stroke-width':1.5,'marker-end':`url(#${markerId})`}));
 host.append(svg);
 return {element:host,select(id){buttons.forEach((button,key)=>{button.classList.toggle('is-selected',key===id);button.setAttribute('aria-pressed',String(key===id));});}};
}
