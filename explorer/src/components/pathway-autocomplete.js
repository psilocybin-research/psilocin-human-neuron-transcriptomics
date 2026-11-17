import { escapeHTML } from "./interface-utils.js";
import { edgeGenes, label } from "./format.js";
import { uiIcon } from "./icons.js";
let sequence = 0;
// Framework7 owns rendering, keyboard navigation, selection and dismissal.
export function createPathwayAutocomplete({
  app,
  input,
  data,
  getGenes,
  root,
}) {
  const id = `pathway-suggestions-${++sequence}`,
    host = input.closest(".tree-search");
  let request = 0,
    disposed = false,
    representativesReady;
  const representativeIndex = () =>
    (representativesReady ||= getGenes().then(
      (genes) =>
        new Map(genes.filter((g) => g.selected).map((g) => [g.symbol, g])),
    ));
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", id);
  input.autocomplete = "off";
  input.spellcheck = false;
  const value = (name) =>
    root.querySelector(`select[aria-label="${name}"]`)?.value;
  const instance = app.autocomplete.create({
    inputEl: input,
    openIn: "dropdown",
    dropdownContainerEl: host,
    limit: 20,
    valueProperty: "value",
    textProperty: "title",
    highlightMatches: false,
    typeahead: false,
    closeOnSelect: true,
    source(query, render) {
      const token = ++request,
        q = query.trim().toUpperCase(),
        contrast = value("Contrast") || data.contrasts[0],
        tier = value("Evidence tier") || "all",
        membership = value("Gene membership") || "leading";
      representativeIndex()
        .then((representatives) => {
          if (disposed || token !== request || !input.isConnected) return;
          const rows = data.pathways.filter(
              (r) =>
                r.contrast === contrast && (tier === "all" || r.tier === tier),
            ),
            symbols = new Set(
              rows.flatMap((r) =>
                membership === "all"
                  ? data.membership[r.pathway] || []
                  : edgeGenes(r),
              ),
            );
          const paths = rows
            .filter(
              (r) =>
                !q ||
                r.pathway.includes(q) ||
                label(r.pathway).toUpperCase().includes(q),
            )
            .map((r) => ({
              value: label(r.pathway),
              title: label(r.pathway),
              kind: "Pathway",
              subtitle: `${r.tier} analysis · ${membership === "all" ? "annotated membership" : "contrast-specific leading edge"}`,
              score: label(r.pathway).toUpperCase() === q ? 0 : 2,
            }));
          const matches = q
            ? [...symbols].flatMap((symbol) => {
                const verified = data.aliases.find(
                    (a) =>
                      a.source_symbol === symbol || a.current_symbol === symbol,
                  ),
                  gene =
                    representatives.get(symbol) ||
                    representatives.get(verified?.source_symbol),
                  aliases = data.aliases.filter(
                    (a) =>
                      (a.source_symbol === symbol ||
                        a.current_symbol === symbol) &&
                      [
                        a.current_symbol,
                        a.source_symbol,
                        a.selected_gene_id,
                      ].some((v) => v?.toUpperCase().includes(q)),
                  ),
                  matched =
                    symbol.toUpperCase().includes(q) ||
                    gene?.id.toUpperCase().includes(q) ||
                    aliases.length;
                if (!matched) return [];
                const alias = [
                  ...new Set(
                    aliases
                      .flatMap((a) => [a.current_symbol, a.source_symbol])
                      .filter((s) => s !== symbol),
                  ),
                ];
                return [
                  {
                    value: symbol,
                    title: symbol,
                    kind: "Gene",
                    subtitle: gene
                      ? `${gene.id}${gene.symbol !== symbol ? ` · archived symbol ${gene.symbol}` : ""}${alias.length ? ` · verified alias ${alias.join(", ")}` : ""}`
                      : "Absent from filtered rank representatives",
                    score:
                      symbol.toUpperCase() === q || gene?.id.toUpperCase() === q
                        ? 0
                        : alias.some((a) => a.toUpperCase() === q)
                          ? 1
                          : 3,
                  },
                ];
              })
            : [];
          const items = [...paths, ...matches]
            .sort(
              (a, b) =>
                a.score - b.score ||
                a.kind.localeCompare(b.kind) ||
                a.title.localeCompare(b.title),
            )
            .slice(0, 20);
          render(items);
          decorate();
          if (!items.length && instance.el) {
            const ul = instance.el.querySelector("ul");
            ul.innerHTML =
              '<li class="autocomplete-dropdown-placeholder"><div class="item-content"><div class="item-inner"><div class="item-title">No matching membership in this tier and contrast.</div><div class="item-subtitle">Free-text filtering remains available.</div></div></div></li>';
          }
        })
        .catch(() => {
          if (!disposed && token === request) {
            render([]);
            decorate();
          }
        });
    },
    renderItem(item, index) {
      const record = this.items[index];
      if (!record) return "";
      const icon = uiIcon(
        record.kind === "Pathway" ? "pathways" : "genes",
      ).outerHTML;
      return `<li role="option" id="${id}-${index}" aria-selected="false"><label class="item-radio item-content" data-value="${escapeHTML(record.value)}"><div class="item-media">${icon}</div><div class="item-inner"><div class="suggestion-kind">${record.kind}</div><div class="item-title">${escapeHTML(record.title)}</div><div class="item-subtitle">${escapeHTML(record.subtitle)}</div></div></label></li>`;
    },
    on: {
      change() {
        input.blur();
      },
      open() {
        const dropdown = instance.el;
        if (dropdown && !dropdown.dataset.pointerFocus) {
          dropdown.dataset.pointerFocus = "true";
          dropdown.addEventListener("mousedown", (event) => {
            if (event.target.closest("label[data-value]"))
              event.preventDefault();
          });
        }
        input.setAttribute("aria-expanded", "true");
        decorate();
      },
      closed() {
        request++;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
      },
    },
  });
  function decorate() {
    const dropdown = instance.el;
    if (!dropdown) return;
    dropdown.classList.add("pathway-suggestions");
    const list = dropdown.querySelector("ul");
    list.id = id;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Pathway and gene suggestions");
  }
  function onKey(event) {
    if (event.key === "Escape" && instance.opened) event.stopPropagation();
    requestAnimationFrame(() => {
      if (disposed || !instance.opened) return;
      const selected = instance.el?.querySelector(
        ".autocomplete-dropdown-selected",
      );
      for (const item of instance.el?.querySelectorAll("[role=option]") || [])
        item.setAttribute("aria-selected", String(item === selected));
      if (selected?.id)
        input.setAttribute("aria-activedescendant", selected.id);
    });
  }
  input.addEventListener("keydown", onKey);
  return {
    input,
    destroy() {
      disposed = true;
      request++;
      input.removeEventListener("keydown", onKey);
      instance.close();
      instance.destroy();
    },
  };
}
