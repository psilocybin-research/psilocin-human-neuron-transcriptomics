import { genePreviewMarkup } from "./structure-preview.js";
import { escapeHTML } from "./interface-utils.js";
import { uiIcon } from "./icons.js";
let sequence = 0;

import { geneSuggestions } from "./gene-search-data.js";
export { geneSuggestions } from "./gene-search-data.js";

export function createGeneAutocomplete({ app, input, data }) {
  const config = input.atlasGeneSuggestions,
    host = input.parentElement;
  const id = `gene-suggestions-${++sequence}`;
  host.classList.add("gene-autocomplete-host");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", id);
  input.setAttribute("aria-expanded", "false");
  input.autocomplete = "off";
  let instance;
  instance = app.autocomplete.create({
    inputEl: input,
    openIn: "dropdown",
    dropdownContainerEl: host,
    valueProperty: "id",
    textProperty: "symbol",
    limit: 20,
    typeahead: false,
    highlightMatches: false,
    closeOnSelect: true,
    source(query, render) {
      render(
        geneSuggestions(
          config.genes(),
          data.aliases,
          query,
          config.preferred?.() || [],
        ),
      );
      decorate();
    },
    renderItem(item, index) {
      const gene = this.items[index];
      return `<li role="option" id="${id}-${index}" aria-selected="false"><label class="item-radio item-content" data-value="${escapeHTML(gene.id)}"><div class="item-media">${genePreviewMarkup(gene) || uiIcon("genes").outerHTML}</div><div class="item-inner"><div class="item-title">${escapeHTML(gene.symbol)}</div><div class="item-subtitle">${escapeHTML(gene.id)}</div><div class="item-text">${escapeHTML(gene.aliases.length ? `Verified alias: ${gene.aliases.join(", ")}` : gene.selected ? "Archived rank representative" : "Additional filtered gene ID")}</div></div></label></li>`;
    },
    on: {
      change(values) {
        const gene = values[0];
        if (gene) config.select(gene);
        input.blur();
      },
      open() {
        input.setAttribute("aria-expanded", "true");
        decorate();
      },
      closed() {
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      },
    },
  });
  function decorate() {
    if (!instance?.el) return;
    input.dataset.geneAutocompleteReady = "true";
    input.dispatchEvent(new CustomEvent("atlas:gene-autocomplete-ready", { bubbles: true }));
    instance.el.classList.add("pathway-suggestions", "gene-suggestions");
    const list = instance.el.querySelector("ul");
    list.id = id;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Gene suggestions");
  }
  function key(event) {
    if (event.key === "Escape" && instance.opened) event.stopPropagation();
    requestAnimationFrame(() => {
      const selected = instance.el?.querySelector(
        ".autocomplete-dropdown-selected",
      );
      for (const row of instance.el?.querySelectorAll("[role=option]") || [])
        row.setAttribute("aria-selected", String(row === selected));
      if (selected) input.setAttribute("aria-activedescendant", selected.id);
    });
  }
  input.addEventListener("keydown", key);
  // The catalogue can finish loading after the user has already focused the field.
  if (document.activeElement === input) instance.open();
  return {
    input,
    destroy() {
      input.removeEventListener("keydown", key);
      delete input.dataset.geneAutocompleteReady;
      instance.destroy();
    },
  };
}
