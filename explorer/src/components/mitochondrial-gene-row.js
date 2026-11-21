import { createElement as el } from './interface-utils.js';
import { createGeneIdentity } from './structure-preview.js';
import { uiIcon } from './icons.js';

export function mitochondrialGeneRow(gene, { onGene, onSendGene }) {
  const row = el('div', 'mito-gene-actions');
  const evidence = el('button', 'button mitochondrial-gene-link');
  evidence.type = 'button';
  evidence.setAttribute('aria-label', `Open ${gene.symbol} gene evidence`);
  evidence.append(createGeneIdentity(gene, { compact: true }));
  evidence.onclick = () => onGene(gene);
  const send = el('button', 'button button-tonal mito-gene-send');
  send.type = 'button';
  send.setAttribute('aria-label', `Send ${gene.symbol} to R Studio`);
  send.append(uiIcon('custom-r'));
  send.onclick = () => onSendGene(gene);
  row.append(evidence, send);
  return row;
}
