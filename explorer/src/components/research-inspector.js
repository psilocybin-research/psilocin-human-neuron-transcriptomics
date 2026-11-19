import { createElement as el, destroySheet } from "./interface-utils.js";
import { contrasts, label, fmt, sci } from "./format.js";
import { RESEARCH_DATASET } from "./research-store.js";
import { SCIENTIFIC_SCENE_SCHEMA } from "./scientific-scene-spec.js";

/** Resolve identity before reading evidence; never merge ambiguous source symbols. */
export function inspectorGeneEvidence(genes, data, identifier) {
  const exact = genes.find(gene => gene.id === identifier);
  const source = genes.filter(gene => gene.symbol === identifier && gene.selected);
  const aliasIds = new Set((data.aliases || []).filter(alias =>
    alias.source_symbol === identifier || alias.current_symbol === identifier,
  ).map(alias => alias.selected_gene_id));
  const aliased = genes.filter(gene => aliasIds.has(gene.id));
  const gene = exact || (source.length === 1 ? source[0] : source.length ? null : aliased.length === 1 ? aliased[0] : null);
  if (!gene) return null;
  const order = data.contrasts || Object.keys(contrasts);
  const effects = order.map((contrast, index) => ({ contrast, ...gene.effects?.[index] }));
  // Gene-set annotations use the archive's selected source-symbol representative.
  // Exact-ID expression estimates remain available for other records, without
  // assigning their namesake's pathway membership.
  const memberships = gene.selected ? Object.entries(data.membership || {})
    .filter(([, members]) => members.includes(gene.symbol)).map(([pathway]) => pathway) : [];
  return { gene, effects, memberships, membershipMapped: Boolean(gene.selected) };
}

/** Normal-approximation interval computed from archived coefficient and SE. */
export function inspectorInterval(effect) {
  if (!Number.isFinite(effect?.log2FoldChange) || !Number.isFinite(effect?.lfcSE) || effect.lfcSE < 0) return null;
  const half = 1.959963984540054 * effect.lfcSE;
  return [effect.log2FoldChange - half, effect.log2FoldChange + half];
}

/** Exact archived points; membership is restricted to selected symbol records. */
export function inspectorArchivedScene(genes, data, state) {
  const index = (data.contrasts || Object.keys(contrasts)).indexOf(state.contrast);
  if (index < 0) throw new Error("Select a recognized archived contrast.");
  const members = data.membership?.[state.pathway];
  if (!members) throw new Error("Select an archived gene set to open its estimate scene.");
  const membership = new Set(members);
  const candidates = genes.filter(gene => gene.selected && membership.has(gene.symbol));
  const rows = candidates.flatMap(gene => {
    const effect = gene.effects?.[index];
    return [effect?.log2FoldChange, effect?.lfcSE, effect?.padj].every(Number.isFinite)
      ? [{id: gene.id, label: gene.symbol, x: effect.log2FoldChange, y: effect.lfcSE, z: effect.padj, color: effect.log2FoldChange}] : [];
  });
  if (!rows.length) throw new Error("No finite coefficient, SE and adjusted-P triples are available for this gene set and contrast.");
  return {spec: {schema: SCIENTIFIC_SCENE_SCHEMA, kind: "scatter3d", classification: "archived",
    title: `${label(state.pathway)} · ${contrasts[state.contrast]}`,
    source: {label: "Frozen gene estimates; selected source-symbol membership", archive_doi: RESEARCH_DATASET.doi},
    axes: {x: "log₂ fold change", y: "Coefficient SE", z: "Gene-level adjusted P"},
    color_label: "log₂ fold change", data: rows},
    omitted: candidates.length - rows.length, candidates: candidates.length};
}

let inspectorSequence = 0;
/** App-wide context; opening never executes R or fetches external annotations. */
export function createResearchInspector({ root, store, getGenes, data,
  onSendToR, onOpenNetwork, onCompare, onAddToNotebook } = {}) {
  const id = `research-inspector-${++inspectorSequence}`;
  const element = el("aside", "research-inspector");
  element.id = id;
  element.hidden = true;
  element.setAttribute("aria-label", "Research evidence inspector");
  const heading = el("h2", "", "Evidence inspector");
  heading.id = `${id}-title`;
  const close = action("Close evidence inspector", () => toggle(false));
  const header = el("div", "research-inspector-header");
  header.append(heading, close);
  const content = el("div", "research-inspector-content");
  const tabs = el("div", "research-inspector-tabs");
  tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Evidence context");
  let activeTab = "gene";
  const tabButtons = new Map();
  for (const [key, title] of [["gene", "Gene evidence"], ["pathway", "Gene-set context"]]) {
    const tab = action(title, () => { activeTab = key; render(); });
    tab.setAttribute("role", "tab"); tab.id = `${id}-${key}`;
    tab.setAttribute("aria-controls", `${id}-content`);
    tab.onkeydown = event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const keys = ["gene", "pathway"];
      activeTab = event.key === "Home" ? keys[0] : event.key === "End" ? keys[1] : keys[1 - keys.indexOf(activeTab)];
      tabButtons.get(activeTab).focus(); render();
    };
    tabButtons.set(key, tab); tabs.append(tab);
  }
  content.id = `${id}-content`; content.setAttribute("role", "tabpanel");
  const sceneHost = el("div", "research-inspector-scene");
  element.append(header, tabs, content, sceneHost);
  const button = action("Evidence inspector", () => toggle());
  button.classList.add("research-inspector-toggle");
  button.setAttribute("aria-controls", id);
  button.setAttribute("aria-expanded", "false");
  const mobile = matchMedia("(max-width: 1179px)");
  let opened = false, disposed = false, generation = 0, sheet, previousFocus;
  let selectedKey, scene, sceneGeneration = 0;
  function releaseScene() {
    sceneGeneration++;
    scene?.destroy?.(); scene = null; sceneHost.replaceChildren();
  }

  function action(text, fn) {
    const item = el("button", "button button-tonal", text);
    item.type = "button";
    item.onclick = fn;
    return item;
  }
  function releaseContent() {
    generation++;
    // Molecular viewers observe detached stages and release GPU resources.
    content.replaceChildren();
  }
  function app() { return document.querySelector("#psilocin-app")?.f7; }
  function makeSheet() {
    if (sheet) return sheet;
    const instance = app();
    if (!instance) return null;
    element.classList.add("sheet-modal", "research-inspector-sheet");
    element.setAttribute("role", "dialog");
    element.setAttribute("aria-labelledby", heading.id);
    sheet = instance.sheet.create({ el: element, backdrop: true, push: true,
      swipeToClose: true, swipeHandler: header, closeByBackdropClick: true,
      closeOnEscape: true,
      on: { closed: () => {
        opened = false;
        button.setAttribute("aria-expanded", "false");
        element.hidden = true;
        root.classList.remove("research-inspector-open");
        releaseContent(); releaseScene();
        previousFocus?.focus?.({ preventScroll: true });
      } },
    });
    return sheet;
  }
  function disposeSheet() {
    if (sheet) { sheet.close(false); destroySheet(sheet); sheet = null; }
    element.classList.remove("sheet-modal", "research-inspector-sheet", "modal-in", "modal-out");
    element.removeAttribute("role");
    element.removeAttribute("aria-modal");
    element.removeAttribute("aria-labelledby");
    element.style.removeProperty("display");
  }
  async function render() {
    if (!opened || disposed) return;
    releaseContent();
    const current = generation, state = store.getState();
    selectedKey = `${state.gene}\n${state.pathway}\n${state.contrast}`;
    for (const [key, button] of tabButtons) {
      button.setAttribute("aria-selected", String(key === activeTab));
      button.tabIndex = key === activeTab ? 0 : -1;
    }
    content.setAttribute("aria-labelledby", `${id}-${activeTab}`);
    content.append(el("p", "note", "Loading archived evidence…"));
    try {
      const genes = await getGenes();
      if (current !== generation || !opened || disposed) return;
      const evidence = inspectorGeneEvidence(genes, data, state.gene);
      content.replaceChildren();
      if (activeTab === "pathway") {
        const membership = data.membership?.[state.pathway] || [];
        content.append(el("h3", "", state.pathway ? label(state.pathway) : "No gene set selected"));
        const selection = el("select"); selection.setAttribute("aria-label", "Inspector gene set");
        for (const pathway of Object.keys(data.membership || {})) {
          const option = el("option", "", label(pathway)); option.value = pathway; selection.append(option);
        }
        selection.value = state.pathway || "";
        selection.onchange = () => store.update({pathway: selection.value});
        content.append(selection, el("p", "note", `${membership.length} source-symbol members in the archived gene set. Membership does not imply an interaction or measured cellular localization.`));
        const rows = (data.pathways || []).filter(row => row.pathway === state.pathway && row.contrast === state.contrast);
        for (const row of rows) content.append(el("p", "note", `${contrasts[row.contrast] || row.contrast}: NES ${row.NES ?? "not available"}; family FDR ${row.family_fdr ?? "not available"}; mapped size ${row.size ?? "not available"}. Family: ${row.tier || "not specified"}. NES is an enrichment statistic, not a biological effect size.`));
        if (!rows.length) content.append(el("p", "note", "No archived pathway estimate is available for the active contrast."));
        const openScene = action("Inspect gene-set estimates in 3D", () => void showScene(genes, store.getState()));
        content.append(openScene);
        const list = el("details"); list.append(el("summary", "", "Select an exact archived gene"));
        const members = new Set(membership);
        for (const gene of genes.filter(gene => gene.selected && members.has(gene.symbol))) {
          list.append(action(`${gene.symbol} · ${gene.id}`, () => store.update({gene: gene.id})));
        }
        content.append(list);
        return;
      }
      if (!evidence) {
        content.append(el("p", "note", "Select a gene with an exact archived identifier. No unambiguous archived gene record is selected."));
        return;
      }
      const { gene, effects, memberships, membershipMapped } = evidence;
      content.append(el("h3", "", gene.symbol), el("p", "research-inspector-id", gene.id));
      const source = el("a", "external", `Archived evidence · ${RESEARCH_DATASET.version}`);
      source.href = `https://doi.org/${RESEARCH_DATASET.doi}`;
      source.target = "_blank"; source.rel = "noopener noreferrer";
      content.append(source);
      const selection = el("label", "research-inspector-contrast", "Active contrast");
      const contrast = el("select");
      contrast.setAttribute("aria-label", "Inspector active contrast");
      for (const [key, text] of Object.entries(contrasts)) {
        const option = el("option", "", text); option.value = key; contrast.append(option);
      }
      contrast.value = state.contrast || Object.keys(contrasts)[0];
      contrast.onchange = () => store.update({ gene: gene.id, contrast: contrast.value });
      selection.append(contrast); content.append(selection);
      const estimates = el("table", "research-inspector-estimates");
      estimates.append(el("caption", "", "Archived gene estimates · all three contrasts"));
      const head = el("thead"), row = el("tr");
      for (const title of ["Contrast", "log₂ fold change", "SE", "Adjusted P"]) {
        const cell = el("th", "", title); cell.scope = "col"; row.append(cell);
      }
      head.append(row); estimates.append(head);
      const body = el("tbody");
      for (const effect of effects) {
        const row = el("tr");
        row.classList.toggle("is-current", effect.contrast === state.contrast);
        const name = el("th", "", contrasts[effect.contrast] || effect.contrast); name.scope = "row";
        row.append(name, el("td", "", fmt(effect.log2FoldChange)), el("td", "", fmt(effect.lfcSE)), el("td", "", sci(effect.padj)));
        const interval = inspectorInterval(effect);
        row.dataset.contrast = effect.contrast;
        if (interval) row.title = `Exact coefficient ${effect.log2FoldChange}; SE ${effect.lfcSE}; approximate 95% Wald interval [${interval[0]}, ${interval[1]}]; adjusted P ${effect.padj ?? "not estimable"}`;
        body.append(row);
      }
      estimates.append(body); content.append(estimates);
      const uncertainty = el("details", "research-inspector-intervals");
      uncertainty.append(el("summary", "", "Exact estimates and approximate 95% intervals"));
      for (const effect of effects) {
        const interval = inspectorInterval(effect);
        uncertainty.append(el("p", "note", `${contrasts[effect.contrast] || effect.contrast}: coefficient ${effect.log2FoldChange ?? "not estimable"}; SE ${effect.lfcSE ?? "not estimable"}; approximate 95% Wald interval ${interval ? `[${interval[0]}, ${interval[1]}]` : "not estimable"}; adjusted P ${effect.padj ?? "not estimable"}.`));
      }
      uncertainty.append(el("p", "note", "Intervals use coefficient ± 1.959963984540054 × SE. These normal-approximation intervals are descriptive and not multiplicity-adjusted; the displayed adjusted P values remain archived values."));
      content.append(uncertainty);
      content.append(el("p", "note", "Adjusted P values retain their archived gene-level correction. SE is the coefficient standard error. The Day 3 / Day 1 comparison is between treated samples; common controls do not identify a treatment-by-time interaction. Transcript abundance is not protein activity."));
      const links = el("div", "research-inspector-actions");
      const payload = () => ({ gene, geneId: gene.id, state: store.getState() });
      for (const [title, callback] of [["Send to R", onSendToR], ["Open 3D network", onOpenNetwork], ["Compare gene", onCompare], ["Add to notebook", onAddToNotebook]]) {
        if (callback) links.append(action(title, () => {
          store.update({ gene: gene.id });
          if (mobile.matches) toggle(false);
          callback(payload());
        }));
      }
      content.append(links);
      const membership = el("details", "research-inspector-membership");
      membership.append(el("summary", "", `Archived gene sets · ${memberships.length}`));
      membership.append(el("p", "note", membershipMapped
        ? "Membership is matched through the archive's selected source-symbol record. It is not an interaction, subcellular localization or causal relation."
        : "No pathway memberships assigned: this exact record is not the archive's selected source-symbol representative."));
      for (const pathway of memberships) membership.append(action(label(pathway), () => store.update({ gene: gene.id, pathway })));
      content.append(membership);
      const molecular = el("div", "research-inspector-molecular");
      const openMolecular = action("Open molecular context", async () => {
        openMolecular.disabled = true;
        molecular.replaceChildren(el("p", "note", "Loading saved protein annotations…"));
        try {
          const { linkedProtein } = await import("./linked-protein.js");
          if (current !== generation || !opened || disposed) return;
          const result = await linkedProtein(gene);
          if (current !== generation || !opened || disposed) return;
          molecular.replaceChildren(result);
          openMolecular.hidden = true;
        } catch (error) {
          if (current === generation && opened && !disposed) molecular.replaceChildren(el("p", "note", error.message || "Saved molecular context is unavailable."));
        } finally { openMolecular.disabled = false; }
      });
      content.append(openMolecular, molecular, el("p", "note", "Molecular context uses saved external annotations and optional sequence-matched structures. No cellular localization or gene-expression effect is inferred from a coordinate model."));
    } catch (error) {
      if (current === generation && opened && !disposed) content.replaceChildren(el("p", "note", error.message || "Archived evidence could not be loaded."));
    }
  }
  async function showScene(genes, state) {
    releaseScene();
    const current = sceneGeneration;
    sceneHost.append(el("p", "note", "Preparing archived estimate scene…"));
    try {
      const {spec, omitted, candidates} = inspectorArchivedScene(genes, data, state);
      const {createScientificScene} = await import("./scientific-scene.js");
      if (current !== sceneGeneration || !opened || disposed) return;
      scene = createScientificScene(spec, {onSelect: ({id}) => store.update({gene: id})});
      scene.setSelection?.(store.getState().gene);
      const closeScene = action("Close gene-set scene", releaseScene);
      sceneHost.replaceChildren(el("p", "note", `${spec.data.length} of ${candidates} matched records shown; ${omitted} omitted because coefficient, SE or adjusted P is missing. This scene records ${contrasts[state.contrast]} for ${label(state.pathway)}; changing selection does not recompute this snapshot.`), closeScene, scene);
    } catch (error) {
      if (current === sceneGeneration && opened && !disposed) sceneHost.replaceChildren(el("p", "note", error.message));
    }
  }
  function toggle(force) {
    if (disposed) return;
    const next = force === undefined ? !opened : Boolean(force);
    if (next === opened) return;
    opened = next;
    button.setAttribute("aria-expanded", String(opened));
    root.classList.toggle("research-inspector-open", opened && !mobile.matches);
    if (opened) {
      previousFocus = document.activeElement;
      element.hidden = false;
      if (mobile.matches) makeSheet()?.open();
      render();
      close.focus({ preventScroll: true });
    } else {
      sheet?.close();
      if (!sheet) element.hidden = true;
      releaseContent(); releaseScene();
      previousFocus?.focus?.({ preventScroll: true });
    }
  }
  function resize() {
    if (!opened) { disposeSheet(); return; }
    // Recreate responsive presentation without retaining a hidden GPU canvas.
    toggle(false); disposeSheet(); toggle(true);
  }
  const escape = event => {
    if (event.key === "Escape" && opened && !mobile.matches) {
      event.preventDefault(); toggle(false);
    }
  };
  element.addEventListener("keydown", escape);
  const unsubscribe = store.subscribe(state => {
    const key = `${state.gene}\n${state.pathway}\n${state.contrast}`;
    scene?.setSelection?.(state.gene);
    if (opened && key !== selectedKey) render();
  });
  mobile.addEventListener("change", resize);
  return { element, button, toggle, destroy() {
    if (disposed) return;
    opened = false; disposed = true;
    unsubscribe(); mobile.removeEventListener("change", resize);
    element.removeEventListener("keydown", escape);
    releaseContent(); releaseScene(); disposeSheet(); element.remove(); button.remove();
    root.classList.remove("research-inspector-open");
  } };
}
