import {downloadFile as save} from './file-download.js';
import {trackActivity} from './app-activity.js';
import {loadingMessage, setLoadingMessage, createAccordion} from './interface-utils.js';
import {label, fmt, sci, color, edgeGenes, csvText, contrasts} from './format.js';

export const families = {
  primary: {title: 'Primary analysis', tests: 15},
  secondary: {title: 'Secondary analyses', tests: 21},
  exploratory: {title: 'Exploratory analyses', tests: 6}
};
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const node = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
function action(text, fn, cls = 'secondary') {
  const b = node('button', cls, text); b.type = 'button'; b.onclick = fn; return b;
}


// Literal frozen membership and the original symbol-ranking representatives only.
// No inferred aliases, new test families, recalculated p-values or significance filters.
export function pathwayBranches(data, genes, contrast, {tier = 'all', members = 'leading', query = ''} = {}) {
  const representatives = new Map(genes.filter(g => g.selected).map(g => [g.symbol, g]));
  const index = data.contrasts.indexOf(contrast);
  if (index < 0) throw new Error('Unknown pathway contrast');
  const q = query.trim().toUpperCase();
  const aliases = new Map();
  for (const a of data.aliases) {
    const values = [a.current_symbol, a.source_symbol, a.selected_gene_id].filter(Boolean);
    if (values.some(v => v.toUpperCase().includes(q))) {
      for (const value of values) aliases.set(value, true);
    }
  }
  return data.pathways.filter(r => r.contrast === contrast && (tier === 'all' || r.tier === tier)).map(row => {
    const edge = new Set(edgeGenes(row));
    const symbols = [...new Set(data.membership[row.pathway] || [])].sort();
    const titleMatch = label(row.pathway).toUpperCase().includes(q) || row.pathway.includes(q);
    const children = symbols.filter(symbol => members !== 'leading' || edge.has(symbol)).map(symbol => {
      const gene = representatives.get(symbol);
      return {symbol, gene, effect: gene?.effects[index], leading: edge.has(symbol),
        memberships: Object.keys(data.membership).filter(id => data.membership[id].includes(symbol))};
    }).filter(g => !q || titleMatch || g.symbol.toUpperCase().includes(q) || g.gene?.id.toUpperCase().includes(q) || aliases.has(g.symbol) || aliases.has(g.gene?.id));
    return {row, children, titleMatch, measured: symbols.filter(s => representatives.has(s)).length,
      annotated: symbols.length, leading: edge.size};
  }).filter(b => !q || b.titleMatch || b.children.length);
}

export function exportMembershipRows(branches, contrast) {
  return branches.flatMap(b => b.children.map(g => ({
    pathway: b.row.pathway, tier: b.row.tier, contrast, symbol: g.symbol,
    gene_id: g.gene?.id ?? null, availability: g.gene ? 'archived rank representative' : 'absent from filtered representative results',
    leading_edge: g.leading, log2FoldChange: g.effect?.log2FoldChange ?? null,
    gene_fdr: g.effect?.padj ?? null, pathway_NES: b.row.NES,
    pathway_family_q: b.row.family_fdr, family_tests: families[b.row.tier].tests,
    memberships: g.memberships.join(';')
  })));
}

export function createPathwayTree({data, provenance, getGenes, state, contrast, tier, selectedPathway, onPathway, onGene, onOverlap, onMembershipChange, onState}) {
  const root = node('section', 'pathway-explorer');
  root.setAttribute('aria-label', 'Pathway and gene tree');
  const toolbar = node('div', 'tree-toolbar');
  const view = node('div', 'tree-view-toggle'); view.setAttribute('aria-label', 'Pathway display');
  const treeButton = action('Tree', () => setView('tree'));
  const tableButton = action('Table', () => setView('table'));
  const networkButton = action('Pathway overlap', () => setView('network'));
  view.append(treeButton, tableButton, networkButton);
  const searchLabel = node('div', 'tree-search');
  searchLabel.append(node('span', '', 'Search pathways and genes'));
  const search = node('input'); search.type = 'search'; search.placeholder = 'Gene symbol, alias, Ensembl ID or pathway';
  search.setAttribute('aria-label', 'Search pathways and genes'); search.value = state.query;
  searchLabel.append(search);
  const memberLabel = node('label', 'tree-member-control');
  memberLabel.append(node('span', '', 'Gene membership'));
  const member = node('select'); member.setAttribute('aria-label', 'Gene membership');
  for (const [value, title] of [['leading', 'Leading edge (this contrast)'], ['all', 'All annotated members']]) {
    const option = node('option', '', title); option.value = value; member.append(option);
  }
  member.value = state.members; memberLabel.append(member);
  const displayControl = node('div', 'tree-display-control');
  displayControl.append(node('span', '', 'Display'), view);
  toolbar.append(displayControl, searchLabel, memberLabel);
  const explanation = node('p', 'tree-explanation', 'Analysis family → gene set → gene. Branches show analysis organization and overlapping annotations, not causal or evolutionary relationships. Leading edges change with the contrast.');
  const legend = node('div', 'tree-legend');
  legend.append(node('span', '', 'Pathway: NES · family q'), node('span', '', 'Gene: log₂FC · original gene FDR'), node('span', '', 'Blue = negative · rust = positive · grey = unavailable'));
  const notice = node('p', 'tree-count'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
  const tools = node('div', 'tree-actions');
  tools.append(action('Collapse gene branches', () => {
    state.open.clear(); root.querySelectorAll('.tree-pathway').forEach(d => {d.open = false;});
  }), action('Reset search', () => {search.value = ''; state.query = ''; onState(); draw(); search.focus();}));
  const shortcuts=node('div','pathway-shortcuts');const chordShortcut=action('Chord comparison',()=>{state.networkView='chord';setView('network');chordShortcut.focus({preventScroll:true});});chordShortcut.title='Compare shared gene membership among up to six frozen gene sets';shortcuts.append(chordShortcut,node('span','note','Compare gene-set overlap with linked gene-level evidence.'));
  const canvas = node('div', 'tree-canvas'); canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Scrollable pathway explorer');
  const downloads = node('div', 'tree-actions');
  const guidance = createAccordion('How to read pathway evidence', 'pathway-reading-guide');
  guidance.body.append(explanation);
  // Keep the mode switch independent of filtering controls: on compact screens it
  // can remain in reach while the user reads the selected representation.
  root.append(displayControl, toolbar, legend, shortcuts, notice, tools, canvas, downloads, guidance.element);
  let genes, branches = [], loadError = false, drawToken = 0, networkMount;let scrollToDisplay=Boolean(state.scrollToPlot);state.scrollToPlot=false;
  const loadStatus = loadingMessage('Loading archived gene estimates…'); canvas.append(loadStatus);
  const notify = () => onState();
  function setView(value) {scrollToDisplay=true;state.view = value; notify(); draw(); onMembershipChange?.(); (value === 'tree' ? treeButton : value === 'network' ? networkButton : tableButton).focus();}
  search.oninput = () => {state.query = search.value; notify(); draw();};
  member.onchange = () => {if(state.view==='network'){state.networkMembers=member.value;state.gene='';}else state.members = member.value; state.limits.clear(); notify(); draw(); onMembershipChange?.();};
  function selectPathway(id, scroll = true) {
    selectedPathway = id; state.gene = ''; state.edge = ''; onPathway(id, scroll); highlight();
  }
  function highlight() {
    networkMount?.refreshSelection(selectedPathway);
    root.querySelectorAll('[data-pathway-select]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pathwaySelect === selectedPathway)));
    root.querySelectorAll('[data-gene-select]').forEach(b => {
      const selected = Boolean(state.gene && b.dataset.geneSelect === state.gene);
      b.setAttribute('aria-pressed', String(selected));
    });
  }
  function geneButton(g, pathway) {
    const b = action('', () => {
      selectedPathway = pathway; state.gene = g.symbol; onGene(g.symbol, pathway); highlight();
    }, 'tree-gene tree-focus');
    b.dataset.geneSelect = g.symbol;
    b.setAttribute('aria-label', `Inspect ${g.symbol} in ${label(pathway)}`);
    const name = node('span', 'tree-gene-name', g.symbol);
    if (g.memberships.length > 1) {const badge = node('small', 'tree-overlap', `${g.memberships.length} sets`); badge.title = 'Overlapping annotation; not independent evidence'; name.append(badge);}
    const metrics = node('span', 'tree-gene-metrics');
    const swatch = node('i', 'tree-swatch'); swatch.style.background = color(g.effect?.log2FoldChange, 1.5); swatch.setAttribute('aria-hidden', 'true');
    metrics.append(swatch);if(g.gene)metrics.append(node('span','tree-gene-effect',`log₂FC ${fmt(g.effect?.log2FoldChange)}`),node('span','tree-gene-fdr',`FDR ${sci(g.effect?.padj)}`));else metrics.append(node('span','','No literal-symbol match'));
    if (state.members === 'all') metrics.append(node('small', '', g.leading ? 'Leading edge' : 'Outside leading edge'));
    b.append(name, metrics); return b;
  }
  function renderGenes(branch, list, details) {
    list.replaceChildren();
    const max = state.limits.get(branch.row.pathway) || 30;
    for (const g of branch.children.slice(0, max)) {const li = node('li'); li.append(geneButton(g, branch.row.pathway)); list.append(li);}
    if (branch.children.length > max) {
      const li = node('li'); const more = action(`Show next ${Math.min(30, branch.children.length - max)} genes (${max} of ${branch.children.length} shown)`, () => {
        state.limits.set(branch.row.pathway, max + 30); renderGenes(branch, list, details); highlight();
        list.querySelectorAll('.tree-gene')[max]?.focus({preventScroll: true});
      }, 'tree-more tree-focus'); li.append(more); list.append(li);
    }
    if (!branch.children.length) list.append(node('li', 'tree-empty', state.members === 'leading' ? 'No archived leading edge for this contrast. Choose all annotated members to inspect membership.' : 'No matching members.'));
    details.dataset.loaded = 'true';
  }
  function draw(focusSelector) {
    const token = ++drawToken;networkMount=undefined;
    const isNetwork=state.view==='network';root.classList.toggle('network-mode',isNetwork);
    networkButton.setAttribute('aria-pressed',String(isNetwork));chordShortcut.setAttribute('aria-pressed',String(isNetwork&&state.networkView==='chord'));
    member.value=isNetwork?state.networkMembers:state.members;
    explanation.textContent=isNetwork?'Pairwise overlap of frozen gene-set annotations or contrast-specific leading edges. Network, table and matrix share identical membership definitions and Jaccard denominators.':'Analysis family → gene set → gene. Branches show analysis organization and overlapping annotations, not causal or evolutionary relationships. Leading edges change with the contrast.';
    tools.firstChild.hidden=isNetwork;legend.hidden=isNetwork;
    treeButton.setAttribute('aria-pressed', String(state.view === 'tree')); tableButton.setAttribute('aria-pressed', String(state.view === 'table'));
    if (!genes) return;
    const oldScroll = canvas.scrollTop;
    branches = pathwayBranches(data, genes, contrast, {tier, members: isNetwork?state.networkMembers:state.members, query:isNetwork?'':state.query});
    const unique = new Set(branches.flatMap(b => b.children.map(g => g.symbol)));
    const occurrences = branches.reduce((n, b) => n + b.children.length, 0);
    notice.classList.remove('inline-loading');
    notice.textContent = `${count(branches.length, 'gene set')} · ${count(unique.size, 'unique gene')} · ${count(occurrences, 'membership')}${state.query ? ' matching this search' : ''}. Repeated genes are counted once in the unique total. ${contrasts[contrast]}.`;
    canvas.replaceChildren(); downloads.replaceChildren();
    if(isNetwork){
      setLoadingMessage(notice,`${branches.length} frozen gene sets · ${contrasts[contrast]}. Loading overlap view…`);
      trackActivity(import('./pathway-network.js'),'Loading pathway overlap').then(({createPathwayNetwork})=>{
        if(token!==drawToken||!root.isConnected)return;
        networkMount=createPathwayNetwork({data,provenance,genes,state,contrast,tier,selectedPathway,
          onPathway:id=>selectPathway(id,true),
          onEdge:pair=>{selectedPathway=pair.source;onOverlap(pair);},
          onState:(redraw,focusSelector)=>{onState();if(redraw){scrollToDisplay=true;draw(focusSelector);}}});
        canvas.replaceChildren(networkMount);if(scrollToDisplay){scrollToDisplay=false;requestAnimationFrame(()=>requestAnimationFrame(()=>{if(networkMount?.isConnected)(networkMount.querySelector('.network-content')?.closest('.figure-shell')||networkMount.querySelector('.network-content .figure-shell,.network-content .network-map,.network-content .network-table-scroll')||networkMount).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}));}if(typeof focusSelector==='string')networkMount.querySelector(focusSelector)?.focus({preventScroll:true});notice.classList.remove('inline-loading');notice.textContent=`${branches.length} frozen gene sets · ${contrasts[contrast]}. ${state.networkMembers==='all'?'Full annotated membership':'Contrast-specific leading edges'}.`;
      }).catch(()=>{if(token===drawToken){notice.classList.remove('inline-loading');notice.textContent='Overlap view unavailable.';canvas.replaceChildren(node('p','tree-empty','The overlap view could not be loaded. Check your connection and retry.'),action('Retry overlap view',draw));}});
      return;
    }
    if (!branches.length) canvas.append(node('p', 'tree-empty', 'No matching pathway or gene in this membership view. Try all annotated members, another contrast or another analysis tier.'));
    else if (state.view === 'table') renderTable();
    else {
      const forest = node('ul', 'tree-forest');
      for (const [family, meta] of Object.entries(families)) {
        const children = branches.filter(b => b.row.tier === family); if (!children.length) continue;
        const item = node('li', 'tree-family'); const details = node('details', 'tree-family-disclosure'); details.open = !state.closed.has(family) || Boolean(state.query);
        const summary = node('summary', 'tree-focus'); summary.append(node('strong', '', meta.title), node('small', '', `${count(children.length, 'set')} · ${meta.tests}-test family`));
        details.ontoggle = () => {if (!state.query) details.open ? state.closed.delete(family) : state.closed.add(family);};
        const paths = node('ul', 'tree-paths');
        for (const branch of children) {
          const li = node('li'); const pathway = node('details', 'tree-pathway'); pathway.dataset.pathway = branch.row.pathway;
          pathway.open = state.open.has(branch.row.pathway) || Boolean(state.query);
          const head = node('summary', 'tree-focus');
          head.setAttribute('aria-label', `Expand genes: ${label(branch.row.pathway)}`);
          head.append(node('span', 'tree-path-name', label(branch.row.pathway)), node('small', 'tree-path-stats', `${branch.row.NES === null ? 'Untestable' : `NES ${fmt(branch.row.NES)} · q ${sci(branch.row.family_fdr)}`} · ${count(branch.children.length, 'gene')}`));
          head.style.setProperty('--nes-color', color(branch.row.NES, 3.6));
          head.addEventListener('click', () => selectPathway(branch.row.pathway, false));
          const inspect = action('Inspect evidence', () => selectPathway(branch.row.pathway), 'tree-inspect tree-focus'); inspect.dataset.pathwaySelect = branch.row.pathway;
          inspect.setAttribute('aria-label', `Inspect pathway evidence: ${label(branch.row.pathway)}`);
          const list = node('ul', 'tree-genes');
          pathway.append(head, inspect, list);
          if (pathway.open) renderGenes(branch, list, pathway);
          pathway.ontoggle = () => {
            if (!state.query) pathway.open ? state.open.add(branch.row.pathway) : state.open.delete(branch.row.pathway);
            if (pathway.open && !pathway.dataset.loaded) {renderGenes(branch, list, pathway); highlight();}
          };
          li.append(pathway); paths.append(li);
        }
        details.append(summary, paths); item.append(details); forest.append(item);
      }
      canvas.append(forest);
    }
    if(scrollToDisplay){scrollToDisplay=false;requestAnimationFrame(()=>{if(canvas.isConnected)canvas.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
    downloads.append(action('Download memberships CSV', () => save('pathway-tree-memberships.csv', csvText(exportMembershipRows(branches, contrast)), 'text/csv')),
      action('Download view provenance', () => save('pathway-tree-provenance.json', JSON.stringify({
        resource: 'Psilocin human-neuron transcriptomic atlas', view_url: location.href,
        archived_release: 'https://doi.org/10.5281/zenodo.23283595', contrast,
        membership_view: state.members, tier, search: state.query, selected_pathway: selectedPathway,
        selected_gene: state.gene || null, unique_genes: unique.size, memberships: occurrences,
        data_sha256: provenance.outputs, gene_sets: branches.map(b => b.row.pathway),
        scope: 'Display selection of archived results; no new statistical tests. Literal frozen membership. Repeated memberships are not independent evidence. Absent filtered genes are not measured nulls.'
      }, null, 2), 'application/json')));
    canvas.scrollTop = oldScroll; highlight();
  }
  function renderTable() {
    const table = node('table', 'tree-table'); const thead = node('thead'); const header = node('tr');
    for (const name of ['Gene set / analysis family', 'NES', 'Family q', 'Genes in view', 'Evidence']) header.append(node('th', '', name));
    thead.append(header); table.append(thead); const tbody = node('tbody');
    for (const b of branches) {
      const row = node('tr'); const name = node('td'); name.append(node('strong', '', label(b.row.pathway)), node('small', '', `${families[b.row.tier].title} · ${families[b.row.tier].tests} tests`)); row.append(name);
      for (const value of [b.row.NES === null ? 'Untestable' : fmt(b.row.NES), b.row.NES === null ? 'Not tested' : sci(b.row.family_fdr), b.children.length]) row.append(node('td', 'numeric', value));
      const cell = node('td'); const inspect = action('Inspect', () => selectPathway(b.row.pathway), 'tree-inspect'); inspect.dataset.pathwaySelect = b.row.pathway;
      inspect.setAttribute('aria-label', `Inspect pathway evidence: ${label(b.row.pathway)}`); cell.append(inspect); row.append(cell); tbody.append(row);
    }
    table.append(tbody); canvas.append(table);
  }
  // Native summary/Enter/Space behavior, augmented with outline navigation.
  canvas.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'ArrowLeft', 'ArrowRight'].includes(event.key) || !event.target.matches('.tree-focus')) return;
    const visible = [...canvas.querySelectorAll('.tree-focus')].filter(n => n.getClientRects().length);
    const at = visible.indexOf(event.target); if (at < 0) return;
    const details = event.target.closest('details'); let next;
    if (event.key === 'ArrowDown') next = visible[Math.min(at + 1, visible.length - 1)];
    if (event.key === 'ArrowUp') next = visible[Math.max(0, at - 1)];
    if (event.key === 'Home') next = visible[0];
    if (event.key === 'End') next = visible.at(-1);
    if (event.key === 'ArrowRight' && event.target.tagName === 'SUMMARY') {details.open = true;}
    if (event.key === 'ArrowLeft') {if (event.target.tagName === 'SUMMARY' && details.open) details.open = false; else next = event.target.tagName === 'SUMMARY' ? details?.parentElement.closest('details')?.querySelector(':scope > summary') : details?.querySelector(':scope > summary');}
    event.preventDefault(); next?.focus();
  });
  root.selectPathway = selectPathway;
  root.refreshSelection = highlight;
  root.focusSelection = () => {
    if(state.view==='network'){networkMount?.focusSelection();return;}
    const selected = [...root.querySelectorAll('[data-gene-select]')].find(b => b.dataset.geneSelect === state.gene && b.getClientRects().length) || [...root.querySelectorAll('[data-pathway-select]')].find(b => b.dataset.pathwaySelect === selectedPathway && b.getClientRects().length) || root.querySelector('.tree-pathway > summary');
    selected?.focus();
  };
  getGenes().then(value => {if (root.isConnected) {genes = value; draw();}}).catch(() => {
    if (!root.isConnected || loadError) return; loadError = true;
    canvas.replaceChildren(node('p', 'tree-empty', 'Archived gene estimates could not be loaded. Check your connection and retry.'));
    canvas.append(action('Retry loading genes', () => {loadError = false; getGenes().then(value => {genes = value; draw();}).catch(() => {loadError = true;});}));
  });
  return root;
}
