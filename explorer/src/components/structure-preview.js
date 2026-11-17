import { structurePreviews } from "../assets/structure-previews.js";
import { createElement as el, escapeHTML } from "./interface-utils.js";
const base = new URL("public-context/", new URL("./", document.baseURI));
export const geneStructurePreview = (gene) =>
  structurePreviews[String(gene.id).replace(/\.\d+$/, "")];
export function genePreviewMarkup(gene) {
  const record = geneStructurePreview(gene);
  if (!record) return "";
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
