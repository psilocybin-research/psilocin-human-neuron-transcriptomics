import {createElement as el} from './interface-utils.js';
import {createScientificScene} from './scientific-scene.js';
import {SYSTEM_SCENES,systemsSceneData} from './systems-scene-data.js';

export function createSystemsExplorer({data,getGenes=()=>[],onSelect,onSendToR,onStructure,onNavigate}) {
  const host=el('section','systems-explorer');
  const controls=el('div','custom-r-toolbar systems-controls'),mode=el('select'),contrast=el('select'),stage=el('div','systems-stage'),status=el('p','note systems-status');
  mode.setAttribute('aria-label','Scientific systems view');contrast.setAttribute('aria-label','Systems contrast');
  for(const item of SYSTEM_SCENES){const option=el('option','',item.label);option.value=item.id;mode.append(option);}
  for(const [id,label] of [['day1_vs_control','Day 1 / common control'],['day3_vs_control','Day 3 / common control'],['day3_vs_day1','Day 3 / Day 1, treated']]){const option=el('option','',label);option.value=id;contrast.append(option);}
  let scene,destroyed=false,epoch=0,hash;
  const send=el('button','button button-tonal','Send displayed genes to R');send.type='button';
  const modeField=el('div','systems-field'),contrastField=el('div','systems-field');modeField.append(el('span','systems-field-label','System'),mode);contrastField.append(el('span','systems-field-label','Contrast'),contrast);controls.append(modeField,contrastField,send);host.append(el('p','note','Archived memberships and curated complex assignments in explicitly illustrative layouts. Neuron compartments are navigation landmarks, without inferred gene localization.'),controls,status,stage);
  async function render(){const current=++epoch;try{
    hash ||= [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data))))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const selected=await getGenes();if(destroyed||current!==epoch)return;
    const result=systemsSceneData(data,{mode:mode.value,contrast:contrast.value,geneIds:selected,sourceSha256:hash});
    scene?.destroy();scene=createScientificScene(result.spec,{onSelect:({id})=>{if(id.startsWith('nav:'))onNavigate?.(id.slice(4));else if(id.startsWith('ENSG'))onSelect?.(id);},onStructure});stage.replaceChildren(scene);
    status.textContent=`${result.genes.length} exact archived genes · ${result.omitted.length} requested identifiers unavailable · source hash covers the full displayed snapshot. Day views retain a common archived colour domain.`;
    send.disabled=!result.genes.length;send.onclick=()=>onSendToR?.({genes:result.genes.map(g=>g.id),contrast:contrast.value,pathway:'HALLMARK_OXIDATIVE_PHOSPHORYLATION'});
  }catch(error){status.textContent=error.message;}}
  mode.onchange=contrast.onchange=render;render();host.setSelection=id=>scene?.setSelection(id);host.setMode=value=>{mode.value=value;mode.dispatchEvent(new Event('change',{bubbles:true}));};host.destroy=()=>{destroyed=true;++epoch;scene?.destroy();};return host;
}
