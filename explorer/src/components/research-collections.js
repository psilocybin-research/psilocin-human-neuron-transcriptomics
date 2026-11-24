import { createGeneIdentity, createGeneThumbnail } from "./structure-preview.js";
import { createAccordion, createElement as el } from "./interface-utils.js";
import { downloadFile } from "./file-download.js";
import {
  parseCollectionInput,
  resolveCollectionIdentifiers,
  collectionDocument,
  collectionGMT,
} from "./research-collection-data.js";

let sequence = 0;
function action(text, callback, className = "") {
  const button = el("button", `button button-round f7-press ${className}`, text);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}
function labelled(text, input) {
  const item = el("li");
  const label = el("label", "item-content item-input research-collection-field");
  const inner = el("div", "item-inner"), wrap = el("div", "item-input-wrap");
  wrap.append(input);
  inner.append(el("div", "item-title item-label", text), wrap);
  label.append(inner);item.append(label);
  return item;
}

/** Local named collections. Callbacks navigate without changing archived results. */
export function createResearchCollections({ store, getGenes, aliases = [], onSendToR, onSelectGene }) {
  const { element, body } = createAccordion("Create gene collection", "research-collections");
  const root = el("section", "research-collections-view");
  const prefix = `research-collection-${++sequence}`;
  const name = el("input"), input = el("textarea"), file = el("input"), status = el("p", "note"), diagnostics = el("div"), saved = el("div");
  name.type = "text";
  name.maxLength = 120;
  name.placeholder = "Collection name";
  name.id = `${prefix}-name`;
  input.rows = 5;
  input.placeholder = "Gene symbols, Ensembl IDs or verified aliases";
  input.maxLength = 1_000_000;
  input.id = `${prefix}-genes`;
  input.autocapitalize = "off";
  input.spellcheck = false;
  file.type = "file";
  file.accept = ".txt,.csv,.tsv,text/plain,text/csv,text/tab-separated-values";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  let disposed = false, fileName = "", resolved = null;
  const save = action("Save resolved genes", saveCollection, "button-fill");
  save.disabled = true;
  function invalidate() {
    resolved = null;
    save.disabled = true;
    diagnostics.replaceChildren();
    status.textContent = "Check identifiers before saving. Unresolved or ambiguous entries are excluded.";
  }
  input.addEventListener("input", () => { fileName = ""; invalidate(); });
  file.addEventListener("change", async () => {
    const selected = file.files?.[0];
    if (!selected) return;
    invalidate();
    if (selected.size > 1_000_000) { status.textContent = "Use a text file smaller than 1 MB."; file.value = ""; return; }
    const selectedFile = selected;
    try {
      const contents = await selected.text();
      if (disposed || file.files?.[0] !== selectedFile) return;
      fileName = selected.name;
      input.value = contents;
      check();
    } catch { if (!disposed) status.textContent = "The selected text file could not be read."; }
  });
  function check() {
    diagnostics.replaceChildren();
    save.disabled = true;
    try {
      resolved = resolveCollectionIdentifiers(parseCollectionInput(input.value, { filename: fileName }), getGenes(), aliases);
      status.textContent = `${resolved.ids.length} unique genes resolved; ${resolved.unresolved.length} unresolved; ${resolved.ambiguous.length} ambiguous; ${resolved.duplicates} duplicate entries ignored.`;
      if (resolved.ids.length > 500) status.textContent += " Reduce the collection to 500 unique genes before saving.";
      save.disabled = !resolved.ids.length || resolved.ids.length > 500;
      if (resolved.unresolved.length) {
        const details = createAccordion("Unresolved identifiers", "research-collection-diagnostic");
        details.body.append(el("p", "note", resolved.unresolved.join(", ")));
        diagnostics.append(details.element);
      }
      if (resolved.ambiguous.length) {
        const details = createAccordion("Ambiguous identifiers — use an exact archived ID", "research-collection-diagnostic");
        const list = el("ul");
        for (const row of resolved.ambiguous) list.append(el("li", "note", `${row.input}: ${row.candidates.map((gene) => `${gene.symbol} (${gene.id})`).join("; ")}`));
        details.body.append(list);
        diagnostics.append(details.element);
      }
    } catch (error) { resolved = null; status.textContent = error.message; }
  }
  function saveCollection() {
    const title = name.value.trim();
    if (!title) { status.textContent = "Enter a collection name before saving."; name.focus(); return; }
    if (!resolved?.ids.length || resolved.ids.length > 500) return;
    const collections = store.getState().collections;
    if (collections.length >= 20) { status.textContent = "Remove a saved collection before adding another (maximum 20)."; return; }
    const id = globalThis.crypto?.randomUUID?.() || `collection-${Date.now()}-${++sequence}`;
    store.update({ collections: [...collections, { id, name: title, genes: resolved.ids }] });
    status.textContent = `Saved ${title}: ${resolved.ids.length} genes. Only resolved identifiers were included.`;
  }
  let renderedCollections;
  function renderSaved(state) {
    if (state.collections === renderedCollections) return;
    renderedCollections = state.collections;
    saved.replaceChildren();
    if (!state.collections.length) {
      const empty = el("div", "research-collection-empty block");
      empty.append(el("strong", "", "No collections yet"),
        el("p", "note", "Create a collection from archived genes to organize your research locally."));
      saved.append(empty);return;
    }
    const byId = new Map(getGenes().map((gene) => [gene.id, gene]));
    for (const collection of state.collections) {
      const section = el("section", "research-collection-saved");
      section.append(el("h4", "", collection.name), el("p", "note", `${collection.genes.length} archived gene IDs`));
      const buttons = el("div", "actions");
      if (onSendToR) buttons.append(action("Send to R", () => onSendToR([...collection.genes])));
      buttons.append(
        action("Download JSON", () => downloadFile("gene-collection.json", JSON.stringify(collectionDocument(collection), null, 2), "application/json")),
        action("Download GMT", () => downloadFile("gene-collection.gmt", collectionGMT(collection), "text/tab-separated-values")),
        action("Remove", () => store.update({ collections: store.getState().collections.filter((item) => item.id !== collection.id) })),
      );
      section.append(buttons);
      const previews = el("div", "collection-gene-previews");
      previews.setAttribute("aria-label", "Available protein structure previews");
      let previewCount = 0;
      for (const id of collection.genes) {
        const gene = byId.get(id), thumb = createGeneThumbnail(gene);
        if (!thumb) continue;
        const open = action("", () => onSelectGene?.(id), "collection-preview-action");
        open.setAttribute("aria-label", `Inspect ${gene.symbol}`);
        open.title = `${gene.symbol} · protein structure preview`;
        open.disabled = !onSelectGene;
        open.append(thumb); previews.append(open);
        if (++previewCount === 4) break;
      }
      if (previewCount) section.append(previews);
      if (onSelectGene) {
        const details = createAccordion("Inspect collection genes", "research-collection-genes"), list = el("ul");
        for (const id of collection.genes) {
          const item = el("li"), gene = byId.get(id);
          const select = action("", () => onSelectGene(id), "collection-gene-row");
          select.append(createGeneIdentity(gene || {id}, {compact:true}));
          select.disabled = !gene;
          item.append(select); list.append(item);
        }
        details.body.append(list); section.append(details.element);
      }
      saved.append(section);
    }
  }
  const fields = el("div", "list list-outline research-collection-inputs"), ul = el("ul");
  ul.append(labelled("Collection name", name), labelled("Paste identifiers", input),
    labelled("Import TXT, CSV or TSV (maximum 1 MB)", file));
  fields.append(ul);
  body.append(
    el("p", "note", "Create a local collection from archived genes. Matches use exact IDs, source symbols and verified aliases. This does not run enrichment tests."),
    fields,
    el("p", "note", "For CSV/TSV, a gene-ID or symbol header selects the column; otherwise the first column is used. Use exact archived IDs to resolve ambiguities."),
  );
  const buttons = el("div", "actions");
  buttons.append(action("Check identifiers", check), save);
  body.append(buttons, status, diagnostics);
  const savedTitle = el("div", "research-collection-saved-title");
  savedTitle.append(el("h3", "", "My collections"), el("small", "note", "Saved locally on this device"));
  root.append(element, savedTitle, saved);
  saved.classList.add("research-collection-saved-list");
  invalidate();
  const unsubscribe = store.subscribe(renderSaved);
  renderSaved(store.getState());
  root.dispose = () => { disposed = true; unsubscribe(); };
  return root;
}
