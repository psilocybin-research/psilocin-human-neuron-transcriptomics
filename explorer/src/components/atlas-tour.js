// Optional orientation to the archived evidence; no analysis state is changed.
const steps = [
 {label:'Study', title:'A transcriptomic research atlas', text:'An independent secondary analysis of Schmidt et al. (2026): human iPSC-derived cortical neurons sampled one and three days after a 10-minute psilocin exposure and washout.', items:[['Experimental units','Nine aggregated profiles from three differentiation blocks and two genetic backgrounds.'],['Scope','Archived gene estimates, pathway enrichment and sensitivity analyses.']]},
 {label:'Evidence', title:'Connect pathways, genes and profiles', text:'Begin with the primary metabolic and redox pathway results in Overview, then inspect the underlying evidence.', items:[['Pathways','Expand the annotation tree to inspect gene-set membership and gene estimates. Overlap views describe shared annotations, not biological interactions.'],['OXPHOS landscape & Gene explorer','Select a gene to inspect expression profiles, effect estimates, uncertainty and the original gene-level FDR.']]},
 {label:'Interpretation', title:'Interpret contrasts with the study design', text:'Day 1 and Day 3 comparisons share the available controls. Unresolved control-harvest timing limits temporal attribution.', items:[['Transcriptional evidence','Enrichment does not establish respiratory function, cellular mechanism or neuroplasticity.'],['Sensitivity','Consult Robustness for model and block sensitivity, including the effect of inter-gene correlation.']]},
 {label:'Custom R', title:'Explore the archived data with R', text:'Open Custom R analysis from the sidebar to edit examples in the themed code editor, then choose Run analysis. Your code runs on your device in a separate R worker, only when you ask.', items:[['Editable examples','Explore pathway estimates, gene uncertainty, paired expression profiles, significance thresholds and Bayesian prior sensitivity. Custom results remain separate from the archived findings; the Bayesian example approximates the normal model rather than rerunning the original sampler.'],['Results and offline use','Inspect console output, plots and tables; download code, CSV and a reproducibility record. Install app offers a separate optional offline R download. New packages may still require a connection.']]},
 {label:'Reproducibility', title:'Inspect, export and verify', text:'Filters and linked selections explore fixed results; they do not refit models or recalculate multiple-testing families.', items:[['Figure controls','Use full screen or Read labels to inspect dense figures. Analysis controls provide the current contrast and filters.'],['Methods & provenance','Download numerical values and figures, and consult provenance, analysis definitions and source-study citations.']]}
];

export function createAtlasTour({node,action,onClose,onRender}) {
 const element=node('div','popup atlas-tour');element.setAttribute('aria-label','Atlas tour');
 const header=node('header','tour-header');header.append(node('h2','','Atlas tour'),action('Close',onClose,'button button-tonal tour-close'));
 const progress=node('ol','tour-progress');progress.setAttribute('aria-label','Tour progress');
 for(const [i,step] of steps.entries()){
  const item=node('li'),button=node('button','tour-step f7-press',step.label);
  button.type='button';button.setAttribute('aria-label',step.label);
  button.onclick=()=>render(i,true);
  item.append(button);progress.append(item);
 }
 const content=node('section','tour-content');content.tabIndex=-1;content.setAttribute('aria-labelledby','atlas-tour-title');content.setAttribute('aria-describedby','atlas-tour-description');
 const counter=node('p','tour-counter');
 let index=0;
 const previous=action('Back',()=>render(index-1,true),'button button-tonal');
 const next=action('Next',()=>index===steps.length-1?onClose():render(index+1,true),'button button-fill');
 const footer=node('footer','tour-footer');footer.append(previous,counter,next);element.append(header,progress,content,footer);
 function render(value=0,focus=false){
  index=Math.max(0,Math.min(steps.length-1,value));const step=steps[index];
  const title=node('h3','',step.title);title.id='atlas-tour-title';const description=node('p','tour-description',step.text);description.id='atlas-tour-description';
  const list=node('dl','tour-details');for(const [term,definition]of step.items){const item=node('div');item.append(node('dt','',term),node('dd','',definition));list.append(item);}
  content.replaceChildren(node('p','tour-kicker','ATLAS ORIENTATION · ABOUT 1 MINUTE'),title,description,list);content.scrollTop=0;
  [...progress.children].forEach((li,i)=>{li.classList.toggle('tour-completed',i<index);if(i===index)li.setAttribute('aria-current','step');else li.removeAttribute('aria-current');li.firstElementChild.setAttribute('aria-pressed',String(i===index));});
  previous.disabled=index===0;next.textContent=index===steps.length-1?'Finish tour':'Next';counter.textContent=`${index+1} of ${steps.length}`;
  if(focus)content.focus({preventScroll:true});onRender?.();
 }
 render();return {element,reset:()=>render()};
}
