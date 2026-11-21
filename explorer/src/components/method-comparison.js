import { createDirectionalEvidence } from './bayesian-directional.js';
import snapshot from '../assets/vendor/method-comparison-data.js';
import { selectMethodResults } from './method-comparison-data.js';
import { createElement as el, createAccordion } from './interface-utils.js';
import { Plot, scientificPlot } from './scientific-plot.js';
import { contrasts, label, fmt, sci, csvText } from './format.js';
import { downloadFile } from './file-download.js';

function table(rows, columns) {
  const wrap = el('div', 'table-scroll data-table');
  const t = el('table'), head = el('thead'), hr = el('tr'), body = el('tbody');
  t.dataset.sortable = 'true';
  for (const [key, title, numeric] of columns) {
    const th = el('th', numeric ? 'numeric' : '', title);
    th.scope = 'col';
    th.dataset.sortType = numeric ? 'number' : 'text';
    hr.append(th);
  }
  head.append(hr);
  for (const r of rows) {
    const tr = el('tr');
    for (const [key, , numeric, format] of columns) {
      const v = r[key];
      const td = el('td', numeric ? 'numeric' : '', format ? format(v) : String(v ?? 'Not available'));
      td.title = String(v ?? 'Not available');
      if (numeric && v !== null && v !== undefined && v !== '') td.dataset.sortValue = String(v);
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(head, body); wrap.append(t);
  return wrap;
}
function action(text, fn) {
  const b = el('button', 'button button-tonal f7-press', text);
  b.type = 'button'; b.onclick = fn; return b;
}
function section(title, description) {
  const host = el('section', 'method-comparison-card');
  host.append(el('h4', '', title), el('p', 'note', description));
  return host;
}
const number = v => fmt(v, 3);
const OXPHOS = 'HALLMARK_OXIDATIVE_PHOSPHORYLATION';
const specLabels = {
  primary: 'Primary model', RIN_covariate: 'RIN covariate', RIN_ge6: 'RIN ≥ 6',
  one_library_per_group: 'One library per group',
};
function specificationLabel(v) {
  return specLabels[v] || v.replace(/^omit_/, 'Omit block ').replace(/^block_/, 'Single block ');
}

export function createMethodComparison({ data, pathway = OXPHOS, contrast = 'day1_vs_control', initialSection = 'summary', onSection = () => {} }) {
  const root = el('section', 'method-comparison');
  const selected = selectMethodResults(data, snapshot, pathway, contrast);
  root.dataset.pathway = pathway; root.dataset.contrast = contrast;
  root.append(el('h3', '', 'Compare methods'), el('p', 'note', `${label(pathway)} · ${contrasts[contrast]}`));
  root.append(el('p', 'callout', 'Archived results from the same experiment. Methods test different questions; their statistics are presented separately. Archived panels retain their original estimates and corrections. The separate Directional panel provides an explicitly exploratory prior-sensitive calculation.'));
  const agreement = section('Interpretation across methods', pathway === OXPHOS
    ? contrast === 'day3_vs_day1'
      ? 'The archived treated-day contrast compares treated profiles. It does not estimate a treatment-by-time interaction. Read enrichment direction, CAMERA settings and posterior uncertainty together.'
      : `Ranked enrichment and both CAMERA settings retain an upward OXPHOS direction. Estimated-correlation CAMERA does not pass family q < 0.05; fixed correlation 0.01 does. ${contrast === 'day3_vs_control' ? 'All ten archived Day 3 Bayesian 95% credible intervals include zero.' : 'Day 1 Bayesian interval coverage of zero varies with the archived prior specification.'} These are method-sensitive findings, not independent replications.`
    : 'Compare only the methods archived for this pathway. An unavailable analysis is not evidence of a null result. Directional agreement does not imply equivalent statistical support.');
  agreement.append(el('p', 'note', 'Three differentiation blocks span two genetic backgrounds. Common-control harvest composition is unresolved. Transcriptional differences do not establish respiratory function, protein activity or rejuvenation.'));
  for (const r of selected.enrichment)
    agreement.append(el('p', 'note', `Ranked enrichment: NES ${number(r.NES)}; family q ${sci(r.family_fdr)}; ${r.size} mapped genes.`));
  for (const r of selected.camera)
    agreement.append(el('p', 'note', `CAMERA (${r.mode} correlation): ${r.Direction}; 15-test family q ${sci(r.family_fdr)}.`));
  root.append(agreement);
  const primary = section('Ranked enrichment · DESeq2 / fgsea', 'Question: are set members concentrated toward an end of the ranked transcriptome? NES is normalized competitive enrichment, not a mean expression effect. Frozen symbol representatives and set-size rules are retained; family q is the original tier-specific correction across sets and contrasts.');
  primary.append(table(selected.enrichment, [
    ['rank_kind', 'Ranking'], ['ranked_genes', 'Ranked genes', true], ['size', 'Mapped set genes', true],
    ['NES', 'NES', true, number], ['pval', 'p-value', true, sci], ['family_fdr', 'Family q', true, sci],
  ]));
  root.append(primary);
  const camera = section('Correlation-aware competitive tests · CAMERA', 'Question: does this set differ from background genes after accounting for gene correlation? limma-voom uses 21,098 symbol representatives and ~ block + condition, with four residual degrees of freedom. BH adjustment covers 15 tests separately for each setting.');
  if (selected.camera.length) {
    camera.append(table(selected.camera.map(r => ({ ...r, reference_df: r.mode === 'estimated' ? 4 : 21096 })), [
      ['mode', 'Correlation setting'], ['NGenes', 'Set genes', true], ['Direction', 'Direction'],
      ['Correlation', 'Correlation', true, number], ['variance_inflation_factor', 'Variance inflation', true, number],
      ['reference_df', 'Reference df', true], ['PValue', 'p-value', true, sci], ['family_fdr', '15-test family q', true, sci],
    ]), el('p', 'note', 'Estimated versus fixed correlation changes both variance inflation and the parametric reference distribution (4 versus 21,096 reference df); residual model df remains four. This comparison cannot isolate the effect of correlation alone.'));
  } else camera.append(el('p', 'note', 'CAMERA was archived for the five primary Hallmark pathways only; no result is available for this pathway.'));
  root.append(camera);
  const bayes = section('Pathway-score uncertainty · Bayesian models', 'Question: how large and uncertain is the paired block-level OXPHOS score difference? Scores average log₂(normalized count + 1) over all 182 mapped genes, not the selected 113-gene network. Posterior probabilities are not FDR values.');
  let resize;
  if (selected.bayesian.length) {
    bayes.append(el('p', 'note', 'Nine normal-likelihood fits vary zero-centred normal effect-prior and half-normal residual-SD prior scales (0.25, 0.5, 1); the correlation prior is LKJ(2). A tenth fit uses Student-t(4) with baseline scales 0.5/0.5. These post hoc sensitivity assumptions are not biologically calibrated.'));
    const chart = el('div', 'method-posterior-chart');
    const values = selected.bayesian.map(r => ({ ...r, mean: +r.mean, lower95: +r.lower95, upper95: +r.upper95,
      fitLabel: `${r.likelihood === 'normal' ? 'Normal' : 't(4)'} ${r.effect_sd}/${r.residual_sd}` }));
    const all = snapshot.bayesian.archived.filter(r => ['mu_day1_vs_control', 'mu_day3_vs_control', 'treated_day_difference'].includes(r.parameter));
    const low = Math.min(...all.map(r => +r.lower95)), high = Math.max(...all.map(r => +r.upper95));
    let lastWidth = 0;
    const render = () => {
      const width = Math.floor(chart.getBoundingClientRect().width);
      if (width < 180 || width === lastWidth) return;
      lastWidth = width;
      chart.replaceChildren(scientificPlot({ width, height: 330, marginLeft: 120, marginRight: 15,
        title: 'Archived pathway-score posterior means and 95% credible intervals',
        x: { domain: [low, high], label: 'Paired OXPHOS score difference', grid: true },
        y: { label: null, domain: values.map(r => r.fitLabel) },
        marks: [Plot.ruleX([0], { stroke: '#83969e', strokeDasharray: '4,3' }),
          Plot.ruleY(values, { x1: 'lower95', x2: 'upper95', y: 'fitLabel', stroke: '#235780', strokeWidth: 2 }),
          Plot.dot(values, { x: 'mean', y: 'fitLabel', fill: '#235780', r: 4, title: r => `${r.fit}\nMean ${number(r.mean)}\n95% CrI ${number(r.lower95)} to ${number(r.upper95)}` })],
      }));
    };
    bayes.append(chart);
    resize = new ResizeObserver(render); resize.observe(chart);
    bayes.append(table(selected.bayesian, [
      ['fit', 'Archived fit'], ['mean', 'Mean', true, number], ['lower95', '95% CrI lower', true, number],
      ['upper95', '95% CrI upper', true, number], ['probability_gt_zero', 'Pr(>0)', true, number], ['computationally_valid', 'Computational criteria met'],
    ]), el('p', 'note', 'Fit labels show likelihood, effect-prior SD / residual-SD prior scale. Credible intervals concern the pathway score, not gene log₂FC. Passing computational criteria does not validate model adequacy with three blocks.'));
  } else bayes.append(el('p', 'note', 'Bayesian score models were archived for OXPHOS only; no posterior is available for this pathway.'));
  root.append(bayes);
  const specs = section('Archived specification explorer', 'Select documented analytical variants. Each row retains its own ranking, mapped set and within-variant correction family. Variant results are dependent sensitivity checks; single-block log-ratio rankings are descriptive and differ from model-based Wald rankings.');
  const choice = el('select'); choice.setAttribute('aria-label', 'Archived specification category');
  for (const [value, text] of [['all', 'All archived specifications'], ['design', 'Design and quality sensitivities'], ['block', 'Single-block descriptive rankings']]) {
    const o = el('option', '', text); o.value = value; choice.append(o);
  }
  const specBody = el('div');
  const renderSpecs = () => {
    const rows = selected.specifications.filter(r => choice.value === 'all' || (choice.value === 'block' ? r.variant.startsWith('block_') : !r.variant.startsWith('block_')));
    specBody.replaceChildren(el('p', 'note', `${rows.length} archived specifications shown.`), table(rows.map(r => ({ ...r, variant_label: specificationLabel(r.variant) })), [
      ['variant_label', 'Specification'], ['rank_kind', 'Ranking'], ['size', 'Set genes', true], ['NES', 'NES', true, number], ['family_fdr', 'Within-variant family q', true, sci],
    ]));
  };
  choice.onchange = renderSpecs; specs.append(choice, specBody); renderSpecs(); root.append(specs);
  const directional = pathway === OXPHOS ? createDirectionalEvidence() : null;
  if (directional) root.append(directional);
  const navigation = el('div', 'segmented segmented-strong method-comparison-tabs');
  navigation.setAttribute('role', 'tablist');
  navigation.setAttribute('aria-label', 'Method results');
  const panels = new Map([['summary', agreement], ['enrichment', primary], ['camera', camera], ['bayesian', bayes], ['specifications', specs]]);
  if (directional) panels.set('directional', directional);
  const titles = { directional: 'Directional', summary: 'Summary', enrichment: 'Enrichment', camera: 'CAMERA', bayesian: 'Bayesian', specifications: 'Specifications' };
  const buttons = new Map();
  function show(key) {
    for (const [id, panel] of panels) {
      const active = id === key;
      panel.hidden = !active;
      buttons.get(id)?.setAttribute('aria-selected', String(active));
      if (buttons.get(id)) buttons.get(id).tabIndex = active ? 0 : -1;
    }
    onSection(key);
  }
  for (const [key, panel] of panels) {
    const b = action(titles[key], () => show(key));
    b.setAttribute('role', 'tab');
    buttons.set(key, b); navigation.append(b);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-label', titles[key]);
  }
  navigation.onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const keys = [...panels.keys()];
    const current = keys.findIndex(key => buttons.get(key).getAttribute('aria-selected') === 'true');
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
    show(keys[next]); buttons.get(keys[next]).focus();
  };
  root.insertBefore(navigation, agreement);
  show(panels.has(initialSection) ? initialSection : 'summary');
  const sources = createAccordion('Sources, checksums and exports', 'method-comparison-sources');
  sources.body.append(el('p', 'note', 'Numerical precision is retained in downloaded results. SHA-256 identifies the source bytes used at build time; source-table links point to the rolling companion repository and may subsequently change. The DOI identifies the archived scientific release.'));
  const actions = el('div', 'tree-actions');
  actions.append(action('Download comparison JSON', () => downloadFile('method-comparison.json', JSON.stringify({ schema_version: 1, scope: 'Frozen pathway results; no new inference', ...selected }, null, 2), 'application/json')));
  for (const [key, title] of [['enrichment', 'Enrichment CSV'], ['specifications', 'Specifications CSV'], ['camera', 'CAMERA CSV'], ['bayesian', 'Bayesian CSV']]) {
    if (selected[key].length) actions.append(action(title, () => downloadFile(`method-${key}.csv`, csvText(selected[key]), 'text/csv')));
  }
  sources.body.append(actions);
  const archive = el('a', 'source-link external', 'Archived analysis · Zenodo v1.2.0');
  archive.href = `https://doi.org/${snapshot.archive}`; archive.target = '_blank'; archive.rel = 'noopener noreferrer';
  sources.body.append(archive);
  for (const [path, hash] of Object.entries(snapshot.sources)) {
    const p = el('p', 'method-source'); const a = el('a', 'source-link external', path);
    a.href = `https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/${path}`;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    p.append(a, el('code', '', `SHA-256 ${hash}`)); sources.body.append(p);
  }
  root.append(sources.element);
  root.dispose = () => { resize?.disconnect(); directional?.dispose(); };
  return root;
}
