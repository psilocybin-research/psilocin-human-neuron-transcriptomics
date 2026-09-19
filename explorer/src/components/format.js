export const contrasts = {day1_vs_control:"Day 1 / common control", day3_vs_control:"Day 3 / common control", day3_vs_day1:"Treated Day 3 / Day 1"};
export const names = {HALLMARK_OXIDATIVE_PHOSPHORYLATION:"Oxidative phosphorylation",HALLMARK_GLYCOLYSIS:"Glycolysis",HALLMARK_REACTIVE_OXYGEN_SPECIES_PATHWAY:"ROS-associated transcription",HALLMARK_MTORC1_SIGNALING:"mTORC1 signaling",HALLMARK_PI3K_AKT_MTOR_SIGNALING:"PI3K–AKT–mTOR signaling"};
export const label = s => names[s] || s.replace(/^(REACTOME_|HALLMARK_)/," ").replaceAll("_"," ").trim().toLowerCase();
export const fmt = (v,n=2) => v===null || v===undefined || !Number.isFinite(+v) ? "Not estimable" : (+v).toFixed(n);
export const sci = v => v===null || v===undefined || !Number.isFinite(+v) ? "Not estimable" : +v===0 ? "0" : +v<.001 ? (+v).toExponential(2) : (+v).toFixed(3);
export function color(value,limit=2.5){
  if(value===null || value===undefined || !Number.isFinite(+value))return "#dedede";
  const v=Math.min(1,Math.abs(value)/limit),end=value<0?[59,111,182]:[213,94,0];
  return `rgb(${end.map(x=>Math.round(255+(x-255)*v)).join(",")})`;
}
export const edgeGenes = row => row?.leadingEdge ? row.leadingEdge.split(";") : [];
export function csvText(rows){
  if(!rows.length)return "";
  const fields=Object.keys(rows[0]);const quote=v=>'"'+String(v??"").replaceAll('"','""')+'"';
  return [fields,...rows.map(r=>fields.map(k=>typeof r[k]==="object"?JSON.stringify(r[k]):r[k]))].map(r=>r.map(quote).join(",")).join("\n");
}
