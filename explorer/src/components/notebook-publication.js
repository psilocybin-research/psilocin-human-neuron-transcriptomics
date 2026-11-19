// Text-only publication exports never evaluate imported notebook code or markup.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fence = text => '`'.repeat(Math.max(3,...(String(text).match(/`+/g)||[]).map(x=>x.length+1)));
export function notebookPublication(book, format = 'html') {
  if (!['html','qmd','Rmd'].includes(format)) throw Error('Unsupported notebook publication format');
  const caution='User-authored exploratory notebook. Recorded outputs are snapshots, not newly executed findings. Notebook order can differ from execution order. Per-run exports retain execution provenance; report source archives supply input tables. No code executes when this document opens.';
  if(format==='html') return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeHTML(book.title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:80ch;margin:3rem auto;padding:0 1rem;color:#203837;background:#fff}pre{white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid #ccd5dc;padding:1rem}small{color:#465660}section{margin:2rem 0}</style><h1>${escapeHTML(book.title)}</h1><p>${escapeHTML(caution)}</p>${book.cells.map((cell,i)=>{
    const run=cell.runs?.at(-1);
    return `<section><h2>${cell.kind==='code'?'R':'Notes'} · ${i+1}</h2><pre>${escapeHTML(cell.source)}</pre>${run?`<small>Recorded ${escapeHTML(run.run_utc)} · ${run.error?'Error':'Complete'}${run.cell_code !== undefined && run.cell_code !== cell.source?' · source edited since this run':''}</small><pre>${escapeHTML(run.console||run.message||'No console output.')}</pre>`:''}</section>`;
  }).join('')}<p>Archive: <a href="https://doi.org/10.5281/zenodo.23283595">10.5281/zenodo.23283595</a></p></html>`;
  const header=format==='qmd'?'format: html\nexecute:\n  enabled: false':'output: html_document';
  const setup=format==='Rmd'?'\n```{r setup, include=FALSE}\nknitr::opts_chunk$set(eval=FALSE)\n```\n':'';
  return `---\ntitle: ${JSON.stringify(book.title)}\n${header}\n---\n${setup}\n${caution}\n\n`+book.cells.map((cell,i)=>{
    // Notes are fenced as authored text: YAML, raw HTML and executable Markdown
    // from an imported notebook cannot become active document directives.
    const marker=fence(cell.source),run=cell.runs?.at(-1);
    const chunk=cell.kind==='code' ? (format==='qmd'?'{r}':'{r, eval=FALSE}') : 'text';
    return `## ${cell.kind==='code'?'R':'Notes'} ${i+1}\n\n${marker}${chunk}\n${format==='qmd'&&cell.kind==='code'?'#| eval: false\n':''}${cell.source}\n${marker}\n\n`+(run?`Recorded output (${run.error?'error':'complete'}):\n\n${fence(run.console||run.message||'')}text\n${run.console||run.message||''}\n${fence(run.console||run.message||'')}\n\n`:'');
  }).join('')+'Archive: <https://doi.org/10.5281/zenodo.23283595>\n';
}
