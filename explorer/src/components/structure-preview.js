import { appendMitochondrialCard } from "./mitochondrial-card.js";
import { structurePreviews } from "../assets/structure-previews.js";
import { createElement as el, escapeHTML, createAccordion } from "./interface-utils.js";
export const geneStructurePreview = (gene) =>
  structurePreviews[String(gene.id).replace(/\.\d+$/, "")];
export function genePreviewMarkup(gene) {
  const record = geneStructurePreview(gene);
  if (!record) return "";
  const base = new URL("public-context/", new URL("./", document.baseURI));
  const label = `${record.provider} · ${record.accession} · ${record.model}. ${record.scope}`;
  return `<span class="gene-structure-preview" title="${escapeHTML(label)}"><img src="${escapeHTML(new URL(record.path, base).href)}" width="72" height="54" loading="lazy" decoding="async" alt=""><span class="gene-preview-source">${record.provider}</span></span>`;
}
export function createGenePreview(gene, open) {
  const record = geneStructurePreview(gene);
  if (!record) return null;
  const button = el("button", "gene-structure-action");
  button.type = "button";
  button.setAttribute(
    "aria-label",
    `Open ${record.provider} structure ${record.model} for ${gene.symbol}`,
  );
  button.innerHTML = genePreviewMarkup(gene);
  button.onclick = () => open(record);
  button
    .querySelector("img")
    .addEventListener("error", () => button.remove(), { once: true });
  return button;
}

// One identity treatment for lists, selections and progressively disclosed cards.
// Previews resolve only by stable Ensembl identity; no symbol-based image guesses.
export function createGeneThumbnail(gene) {
  if (!gene || !geneStructurePreview(gene)) return null;
  const thumb = el("span", "gene-identity-thumb");
  thumb.innerHTML = genePreviewMarkup(gene);
  thumb.addEventListener("error", () => { thumb.hidden = true; }, true);
  return thumb;
}
export function createGeneIdentity(gene, { compact = false } = {}) {
  const row = el("span", `gene-identity${compact ? " gene-identity-compact" : ""}`);
  const thumb = createGeneThumbnail(gene);
  if (thumb) row.append(thumb);
  const text = el("span", "gene-identity-text");
  text.append(el("strong", "", gene.symbol || gene.id), el("span", "identifier", gene.id));
  row.append(text);
  return row;
}
export function createGeneContextCard(gene, { context = "Archived gene estimates" } = {}) {
  const card = createAccordion(gene.symbol || gene.id, "card gene-context-card");
  const toggle = card.element.querySelector(".gene-annotation-toggle");
  toggle.querySelector(".item-title").replaceChildren(createGeneIdentity(gene));
  toggle.setAttribute("aria-label", `Expand context for ${gene.symbol || gene.id}`);
  card.body.append(el("p", "note", context));
  const preview = geneStructurePreview(gene);
  if (preview) card.body.append(el("p", "note", `${preview.provider} · ${preview.accession} · ${preview.model}. ${preview.scope}`));
  card.body.append(el("p", "note", "Protein structure is external context; it is not a measured change in this RNA-seq experiment."));
  appendMitochondrialCard(card.body, gene);
  return card;
}
