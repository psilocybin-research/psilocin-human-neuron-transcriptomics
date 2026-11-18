import { retainedGene, uncertaintyLabels } from "./network-statistics.js";
import { createNetworkSceneEffects } from "./network-scene-effects.js";
import snapshot from "../assets/vendor/oxphos-network-data.js";
import {
  createElement as el,
  loadingMessage,
  createAccordion,
  destroySheet,
} from "./interface-utils.js";
import { label, contrasts, color, csvText } from "./format.js";
import { uiIcon } from "./icons.js";
import { downloadFile } from "./file-download.js";
import { trackActivity } from "./app-activity.js";

const exact = (value) =>
  Number.isFinite(value) ? String(value) : "Not estimable";
export function createOxphosNetwork({ onEvidence, initialGene }) {
  const root = el("section", "oxphos-network-3d");
  root.setAttribute("aria-label", "3D OXPHOS gene–pathway membership");
  const genes = snapshot.nodes.filter((n) => n.type === "gene");
  let day = 0,
    filter = "all",
    uncertainty = "all",
    researchTab = "evidence",
    query = "",
    selected =
      genes.find((n) => n.symbol === initialGene || n.id === initialGene)?.id ||
      "",
    graph,
    api,
    destroyed = false,
    sceneEffects,
    hoveredId = "";
  let comparing = false,
    graphRight,
    bloomRight,
    syncingCamera = false;
  const rightMeshes = new Map(),
    objects = new Map(),
    rightLabels = [],
    rightResources = [],
    rightObjects = new Map();
  const leftStage = el("div", "oxphos-3d-pane"),
    rightStage = el("div", "oxphos-3d-pane");
  rightStage.hidden = true;
  const resources = [],
    meshes = new Map(),
    labels = [],
    textSprites = [];
  const heading = el("h3", "", "OXPHOS gene–pathway membership");
  const qualification = el(
    "p",
    "callout",
    "Lines connect genes to their archived gene sets. They are membership annotations, not measured molecular interactions, co-expression, or evidence of respiratory activity. Positions are a schematic layout, not molecular coordinates.",
  );
  const controls = el("div", "oxphos-3d-controls");
  const days = el("div", "segmented segmented-strong oxphos-3d-days");
  days.setAttribute("role", "group");
  days.setAttribute("aria-label", "3D effect time point");
  function button(text, fn, icon) {
    const b = el("button", "button button-tonal labelled-icon-action");
    b.type = "button";
    b.setAttribute("aria-label", text);
    if (icon) b.append(uiIcon(icon));
    b.append(el("span", "", text));
    b.onclick = fn;
    return b;
  }
  const dayButtons = [0, 1].map((i) => {
    const b = button(`Day ${i === 0 ? 1 : 3}`, () => {
      day = i;
      refresh();
    });
    days.append(b);
    return b;
  });
  const filterLabel = el("label", "oxphos-3d-filter", "Complex membership");
  const filterSelect = el("select");
  filterSelect.setAttribute("aria-label", "3D complex filter");
  for (const [value, text] of [
    ["all", "All 113 archived genes"],
    ...["I", "II", "III", "IV", "V"].map((c) => [
      c,
      `Complex ${c} · ${genes.filter((n) => n.complex === c).length} genes`,
    ]),
    [
      "other",
      `Other OXPHOS-set genes · ${genes.filter((n) => !n.complex).length}`,
    ],
  ]) {
    const o = el("option", "", text);
    o.value = value;
    filterSelect.append(o);
  }
  filterSelect.onchange = () => {
    filter = filterSelect.value;
    refresh();
  };
  filterLabel.append(filterSelect);
  const uncertaintyLabel = el(
    "label",
    "oxphos-3d-filter",
    "Statistical filter",
  );
  const uncertaintySelect = el("select");
  uncertaintySelect.setAttribute("aria-label", "Network statistical filter");
  for (const [value, text] of Object.entries(uncertaintyLabels)) {
    const option = el("option", "", text);
    option.value = value;
    uncertaintySelect.append(option);
  }
  uncertaintySelect.onchange = () => {
    uncertainty = uncertaintySelect.value;
    refresh();
  };
  uncertaintyLabel.append(uncertaintySelect);
  controls.append(
    uncertaintyLabel,
    el(
      "p",
      "note",
      "FDR uses archived transcriptome-wide gene corrections, not a new correction within these 113 selected genes. Either-day filtering is descriptive, not a joint hypothesis test.",
    ),
  );
  const edgeLabel = el("label", "checkbox oxphos-3d-edge-choice");
  const showEdges = el("input");
  showEdges.type = "checkbox";
  showEdges.checked = true;
  showEdges.onchange = () => refresh();
  edgeLabel.append(
    showEdges,
    el("i", "icon-checkbox"),
    el("span", "", "Show membership edges"),
  );
  const focusLabel = el("label", "checkbox oxphos-3d-edge-choice");
  const focusMemberships = el("input");
  focusMemberships.type = "checkbox";
  focusMemberships.checked = true;
  focusMemberships.onchange = () => updateGraph();
  focusLabel.append(
    focusMemberships,
    el("i", "icon-checkbox"),
    el("span", "", "Focus selected memberships"),
  );
  controls.append(days, filterLabel, edgeLabel, focusLabel);
  const legend = el(
    "p",
    "oxphos-3d-legend",
    `Gene colour: log₂ fold change, blue −${snapshot.limit} → white 0 → rust +${snapshot.limit}; identical scale on both days, no clipping. Equal-size spheres = genes; diamonds = archived gene sets (not complexes). Gold outline = selected gene. Grey = not estimable.`,
  );
  const ramp = el("span", "oxphos-3d-ramp");
  ramp.setAttribute("aria-hidden", "true");
  legend.prepend(ramp);
  const status = el("p", "note oxphos-3d-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const viewer = el("div", "oxphos-3d-viewer");
  viewer.dataset.fullscreenHost = "true";
  viewer.dataset.fullscreenTitle = "3D OXPHOS membership network";
  viewer.dataset.fullscreenInfo =
    "Descriptive archived gene-set membership. No molecular interactions or activity were measured. Equal-size gene nodes; fixed log₂ fold-change colour scale.";
  const stage = el("div", "oxphos-3d-stage");
  stage.setAttribute(
    "aria-label",
    "Rotatable 3D membership view; gene selection and exact values are also available below",
  );
  stage.append(loadingMessage("Loading the local 3D renderer…"));
  const cameraTools = el("div", "oxphos-3d-camera");
  function cameraZoom(factor) {
    if (!graph) return;
    const p = graph.cameraPosition();
    graph.cameraPosition(
      { x: p.x * factor, y: p.y * factor, z: p.z * factor },
      undefined,
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280,
    );
  }
  function reset() {
    if (!graph) return;
    const aspect = Math.max(
      0.3,
      leftStage.clientWidth / Math.max(1, leftStage.clientHeight),
    );
    const distance = Math.max(
      520 / (2 * Math.tan((Math.PI * graph.camera().fov) / 360)),
      640 / (2 * Math.tan((Math.PI * graph.camera().fov) / 360) * aspect),
    );
    graph.cameraPosition({ x: 0, y: 0, z: distance }, { x: 0, y: 0, z: 0 }, 0);
  }
  cameraTools.append(
    button("Zoom in", () => cameraZoom(0.8), "plus"),
    button("Zoom out", () => cameraZoom(1.25), "minus"),
    button("Reset camera", reset, "overview"),
  );
  viewer.append(stage, cameraTools);
  const gesture = el(
    "p",
    "note",
    "Drag to rotate; use the wheel or pinch to zoom. Two-finger drag pans on touch screens. Camera buttons and the gene list provide alternatives. The page remains scrollable outside the viewer.",
  );
  const selectedPanel = el("section", "oxphos-3d-selected");
  selectedPanel.setAttribute("aria-label", "Selected 3D gene statistics");
  const searchLabel = el(
    "label",
    "oxphos-3d-search",
    "Find a gene in this network",
  );
  const search = el("input");
  search.type = "search";
  search.placeholder = "Gene symbol or Ensembl ID";
  search.setAttribute("aria-label", "Search 3D OXPHOS genes");
  searchLabel.append(search);
  const searchCount = el("p", "note");
  searchCount.setAttribute("role", "status");
  const geneList = el("div", "oxphos-3d-gene-list");
  let shown = 12;
  search.oninput = () => {
    query = search.value.trim().toUpperCase();
    shown = 12;
    renderList();
  };
  const more = button("Show more genes", () => {
    shown += 24;
    renderList();
  });
  const listRegion = el("section", "oxphos-3d-accessible");
  listRegion.append(searchLabel, searchCount, geneList, more);
  const provenance = createAccordion(
    "Membership sources and interpretation",
    "oxphos-3d-provenance",
  );
  provenance.body.append(
    el("p", "note", snapshot.annotations.scope),
    el("p", "note", snapshot.annotations.source_snapshot),
    el("p", "note", snapshot.annotations.complex_v_note),
    el(
      "p",
      "note",
      "Subunit groups: I (20), II (3), III (8), IV (10). COX10 and COX17 are assembly-related; COX7A2L is a supercomplex assembly factor. They remain in the other-gene group. The original heatmap’s broader descriptive groups are preserved unchanged. Stable-ID matching does not imply that the archived and current annotation versions are identical.",
    ),
    el(
      "p",
      "note",
      "Both days use the available common control pool. This is a selected leading-edge union, not a transcriptome-wide sample. Day differences do not identify a treatment-by-time interaction. Gene FDR values and pathway-family FDR values remain separate. Node prominence and spatial distance carry no inferential meaning.",
    ),
  );
  const credit = el("p", "note");
  for (const [text, url] of [
    ["3d-force-graph", "https://github.com/vasturiano/3d-force-graph"],
    ["Three.js", "https://threejs.org/"],
    ["UniProt", "https://www.uniprot.org/"],
    [
      "Complex mapping and sources",
      "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/config/oxphos_complex_membership.json",
    ],
    [
      "Renderer licence notices",
      "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/third_party_licenses/network-3d.txt",
    ],
  ]) {
    const a = el("a", "source-link", text + " ↗");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    credit.append(a, document.createTextNode(" · "));
  }
  provenance.body.append(credit);
  const exports = el("div", "tree-actions");
  exports.append(
    button(
      "Download network data",
      () =>
        downloadFile(
          "oxphos-membership-network.json",
          JSON.stringify(
            {
              schema_version: 1,
              archive: "10.5281/zenodo.23283595",
              view_url: location.href,
              comparison_view: comparing,
              displayed_contrasts: comparing
                ? ["day1_vs_control", "day3_vs_control"]
                : [day === 0 ? "day1_vs_control" : "day3_vs_control"],
              day: day === 0 ? 1 : 3,
              contrast: day === 0 ? "day1_vs_control" : "day3_vs_control",
              complex_filter: filter,
              selected_gene: selected || null,
              colour_domain: [-snapshot.limit, 0, snapshot.limit],
              edge_semantics:
                "Literal frozen annotated gene-set membership; no molecular interaction inference",
              layout:
                "Fixed schematic coordinates by curated subunit group, not molecular coordinates",
              ...snapshot,
            },
            null,
            2,
          ),
          "application/json",
        ),
      "download",
    ),
    button(
      "Download gene statistics",
      () =>
        downloadFile(
          "oxphos-network-genes.csv",
          csvText(
            genes.flatMap((n) =>
              n.effects.map((e, i) => ({
                gene_id: n.id,
                gene: n.symbol,
                complex: n.complex || "Other OXPHOS-set genes",
                contrast: Object.keys(contrasts)[i],
                ...e,
              })),
            ),
          ),
          "text/csv",
        ),
      "download",
    ),
  );
  root.append(viewer);
  root.classList.add("oxphos-3d-immersive");
  let drawerInstance, drawer, drawerBody, bloom;
  const panels = el("div");
  panels.hidden = true;
  panels.append(
    heading,
    qualification,
    controls,
    gesture,
    selectedPanel,
    listRegion,
    exports,
    provenance.element,
  );
  root.append(panels);
  const topbar = el("div", "oxphos-3d-topbar");
  const compareButton = button(
    "Compare days",
    () => toggleCompare(),
    "comparison",
  );
  compareButton.setAttribute("aria-pressed", "false");
  topbar.append(days, compareButton, status);
  const legendCompact = el("div", "oxphos-3d-scale");
  legendCompact.append(
    el("span", "", `−${snapshot.limit}`),
    ramp,
    el("span", "", `+${snapshot.limit} log₂FC`),
  );
  legendCompact.title =
    "Identical zero-centred log₂ fold-change scale on both days. Grey means unavailable; node size carries no statistic.";
  const dock = el("nav", "oxphos-3d-dock");
  dock.setAttribute("aria-label", "Network tools");
  const selectedSummary = button(
    "Select a gene",
    () => openDrawer("gene"),
    "genes",
  );
  selectedSummary.classList.add("oxphos-3d-selected-summary");
  dock.append(
    button("Find gene", () => openDrawer("search"), "search"),
    button("Filters", () => openDrawer("filters"), "controls"),
    button("About & data", () => openDrawer("about"), "information"),
  );
  cameraTools.append(
    button(
      "Statistical comparison",
      () => {
        researchTab = "compare";
        choose(
          genes.find((n) => n.id === selected) ||
            genes.filter(visible)[0] ||
            genes[0],
          false,
        );
      },
      "comparison",
    ),
    selectedSummary,
  );
  dock.prepend(legendCompact);
  viewer.append(topbar, dock);
  function fullscreenChanged() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement)
      closeDrawer();
  }
  function closeDrawer() {
    if (drawerBody)
      for (const child of [...drawerBody.children]) panels.append(child);
    if (drawerInstance) {
      drawerInstance.close(false);
      // A previous animated close can still be pending when a new panel opens.
      // Complete its lifecycle before destruction so the app releases focus/inert state.
      if (drawerInstance.el?.classList.contains("modal-out"))
        drawerInstance.onClosed();
      destroySheet(drawerInstance);
      drawerInstance = undefined;
    }
    drawer?.remove();
    drawer = undefined;
    drawerBody = undefined;
  }
  const evidenceAside = el("aside", "oxphos-3d-evidence");
  evidenceAside.hidden = true;
  evidenceAside.setAttribute("aria-label", "Linked gene evidence");
  const evidenceHeader = el("header", "evidence-sheet-header");
  const evidenceBody = el("div", "oxphos-3d-evidence-body");
  evidenceHeader.append(
    el("h2", "", "Linked gene evidence"),
    button(
      "Done",
      () => {
        evidenceAside.hidden = true;
        panels.append(selectedPanel);
        selectedSummary.focus();
      },
      "done",
    ),
  );
  evidenceAside.append(evidenceHeader, evidenceBody);
  viewer.append(evidenceAside);
  const desktopEvidence = matchMedia("(min-width: 1100px)");
  function openDrawer(kind) {
    closeDrawer();
    if (kind === "gene" && desktopEvidence.matches) {
      evidenceBody.append(selectedPanel);
      evidenceAside.hidden = false;
      return;
    }
    evidenceAside.hidden = true;
    panels.append(selectedPanel);
    const app = document.querySelector("#psilocin-app")?.f7;
    if (!app) return;
    drawer = el("section", "sheet-modal oxphos-3d-drawer");
    const title = {
      search: "Find a gene",
      gene: "Linked gene evidence",
      filters: "Network controls",
      about: "Membership & data",
    }[kind];
    drawer.setAttribute("aria-label", title);
    const handle = el("div", "sheet-handle"),
      header = el("header", "evidence-sheet-header"),
      done = button("Done", () => drawerInstance?.close(), "done");
    header.append(el("h2", "", title), done);
    drawerBody = el("div", "sheet-modal-inner oxphos-3d-drawer-body");
    const items = {
      search: [listRegion],
      gene: [selectedPanel],
      filters: [controls],
      about: [
        heading,
        qualification,
        legend,
        gesture,
        exports,
        provenance.element,
      ],
    }[kind];
    drawerBody.append(...items);
    drawer.append(handle, header, drawerBody);
    root.append(drawer);
    const currentBody = drawerBody;
    drawerInstance = app.sheet.create({
      el: drawer,
      containerEl: document.fullscreenElement || root,
      backdrop: true,
      backdropUnique: true,
      push: true,
      swipeToClose: true,
      swipeHandler: handle,
      closeByBackdropClick: true,
      on: {
        closed: () => {
          for (const child of [...currentBody.children]) panels.append(child);
        },
      },
    });
    drawerInstance.open(
      !matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    if (kind === "search") setTimeout(() => search.focus(), 200);
  }
  const bloomEnabled = matchMedia("(min-width: 850px)").matches;
  function visible(n) {
    return (
      n.type !== "gene" ||
      ((filter === "all" ||
        (filter === "other" ? !n.complex : n.complex === filter)) &&
        retainedGene(n, uncertainty))
    );
  }
  function endpoints(link) {
    return [
      typeof link.source === "object" ? link.source.id : link.source,
      typeof link.target === "object" ? link.target.id : link.target,
    ];
  }
  function relatedPathways() {
    return new Set(
      snapshot.links
        .filter((l) => visible(genes.find((n) => n.id === endpoints(l)[0])))
        .map((l) => endpoints(l)[1]),
    );
  }
  function choose(n, focus = true) {
    selected = n.id;
    selectedSummary.setAttribute("aria-label", `${n.symbol} · exact values`);
    selectedSummary.querySelector("span").textContent =
      n.symbol + " · exact values";
    renderSelected();
    renderList();
    updateGraph();
    openDrawer("gene");
    if (focus && graph)
      graph.cameraPosition(
        {
          x: n.x + (matchMedia("(min-width: 1100px)").matches ? 90 : 0),
          y: n.y,
          z: n.z + 520,
        },
        { x: n.x, y: n.y, z: n.z },
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
      );
  }
  function renderSelected() {
    selectedPanel.replaceChildren();
    const n = genes.find((g) => g.id === selected);
    if (!n) {
      selectedPanel.append(
        el(
          "p",
          "note",
          "Select a gene sphere or a gene name below to inspect its exact archived estimates.",
        ),
      );
      return;
    }
    selectedPanel.append(
      el("h4", "", n.symbol),
      el(
        "p",
        "identifier",
        `${n.id} · ${n.complex ? `Complex ${n.complex} subunit` : `Other OXPHOS-set gene · ${n.displayGroup}`}`,
      ),
    );
    const linked = el("div", "oxphos-3d-linked-content");
    linked.append(loadingMessage("Loading archived evidence…"));
    selectedPanel.append(linked);
    import("./oxphos-research-panel.js")
      .then(({ researchPanel }) => {
        if (selected === n.id && linked.isConnected)
          linked.replaceChildren(
            researchPanel(n, {
              genes: genes.filter(visible),
              total: genes.length,
              filterLabel: uncertaintyLabels[uncertainty],
              limit: snapshot.limit,
              initialTab: researchTab,
              onTab: (key) => {
                researchTab = key;
              },
              onSelect: (gene) => choose(gene, false),
            }),
          );
      })
      .catch((error) => linked.replaceChildren(el("p", "note", error.message)));
    if (!visible(n))
      selectedPanel.append(
        el(
          "p",
          "note",
          "This selected gene is outside the current complex filter; its statistics remain available.",
        ),
      );
    const table = el("table");
    const head = el("thead"),
      tr = el("tr");
    for (const t of [
      "Contrast",
      "Mean normalized count",
      "log₂FC",
      "SE",
      "Wald statistic",
      "Nominal p",
      "Gene FDR",
    ])
      tr.append(el("th", "", t));
    head.append(tr);
    table.append(head);
    const body = el("tbody");
    n.effects.forEach((e, i) => {
      const row = el("tr");
      row.append(el("td", "", Object.values(contrasts)[i]));
      for (const key of [
        "baseMean",
        "log2FoldChange",
        "lfcSE",
        "stat",
        "pvalue",
        "padj",
      ])
        row.append(el("td", "numeric", exact(e?.[key])));
      body.append(row);
    });
    table.append(body);
    const wrap = el("div", "table-scroll data-table");
    wrap.append(table);
    const exactDetails = createAccordion(
      "Full stored gene statistics",
      "network-exact-statistics",
    );
    exactDetails.body.append(wrap);
    selectedPanel.append(
      exactDetails.element,
      el(
        "p",
        "note",
        `Full stored numeric precision. Leading-edge category: ${n.leadingEdge}. Common-control design and approximate uncertainty qualifications are unchanged.`,
      ),
    );
    const memberships = snapshot.links
      .filter((l) => endpoints(l)[0] === n.id)
      .map((l) => label(endpoints(l)[1].slice(8)));
    selectedPanel.append(
      el(
        "p",
        "note",
        `Archived gene-set memberships: ${memberships.join("; ")}.`,
      ),
    );
    const source = el("p", "note", `Complex assignment source: ${n.basis}. `);
    for (const p of n.proteins) {
      const a = el("a", "source-link", `${p.accession} · ${p.name} ↗`);
      a.href = `https://www.uniprot.org/uniprotkb/${p.accession}/entry`;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      source.append(a);
    }
    selectedPanel.append(
      source,
      button("Open archived gene evidence", () => onEvidence(n.id), "genes"),
      button(
        "Clear selection",
        () => {
          selected = "";
          selectedSummary.setAttribute("aria-label", "Select a gene");
          selectedSummary.querySelector("span").textContent = "Select a gene";
          renderSelected();
          renderList();
          updateGraph();
        },
        "close",
      ),
    );
  }
  function matches() {
    return genes
      .filter(visible)
      .filter(
        (n) =>
          !query ||
          n.symbol.toUpperCase().includes(query) ||
          n.id.toUpperCase().includes(query),
      )
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }
  function renderList() {
    const rows = matches();
    searchCount.textContent = `${rows.length} matching genes · ${Math.min(shown, rows.length)} shown. Search filters this list; the graph retains the current complex filter.`;
    geneList.replaceChildren();
    for (const n of rows.slice(0, shown)) {
      const b = button(n.symbol, () => choose(n));
      b.setAttribute("aria-pressed", String(selected === n.id));
      b.title = n.id;
      geneList.append(b);
    }
    more.hidden = rows.length <= shown;
    if (!rows.length)
      geneList.append(
        el(
          "p",
          "note",
          filter === "V"
            ? snapshot.annotations.complex_v_note
            : "No matching gene in this filter. Try another symbol or Ensembl ID, or choose All 113 archived genes.",
        ),
      );
  }
  function updateGraph() {
    if (!graph) return;
    const related = relatedPathways();
    const focused = Boolean(selected && focusMemberships.checked);
    const memberships = new Set(
      snapshot.links
        .filter((l) => endpoints(l)[0] === selected)
        .map((l) => endpoints(l)[1]),
    );
    root.dataset.focusedGene = focused ? selected : "";
    graph
      .nodeVisibility((n) =>
        n.type === "gene" ? visible(n) : related.has(n.id),
      )
      .linkVisibility(
        (l) =>
          showEdges.checked &&
          visible(genes.find((n) => n.id === endpoints(l)[0])),
      );
    for (const [scene, map, effectDay] of [
      [graph, meshes, comparing ? 0 : day],
      [graphRight, rightMeshes, 1],
    ]) {
      if (!scene) continue;
      scene
        .nodeVisibility((n) =>
          n.type === "gene" ? visible(n) : related.has(n.id),
        )
        .linkVisibility(
          (l) =>
            showEdges.checked &&
            visible(genes.find((n) => n.id === endpoints(l)[0])),
        );
      for (const n of genes) {
        const mesh = map.get(n.id);
        if (mesh) {
          mesh.children[0].material.color.set(
            color(n.effects[effectDay]?.log2FoldChange, snapshot.limit),
          );
          if (
            mesh.children[0].material.transparent !==
            (focused && n.id !== selected)
          )
            mesh.children[0].material.needsUpdate = true;
          mesh.children[0].material.transparent = focused && n.id !== selected;
          mesh.children[0].material.opacity =
            focused && n.id !== selected ? 0.16 : 1;
          mesh.children[0].material.depthWrite = !focused || n.id === selected;
          mesh.children[1].visible = n.id === selected;
        }
      }
      for (const n of snapshot.nodes.filter((n) => n.type !== "gene")) {
        const object = (scene === graph ? objects : rightObjects).get(n.id);
        if (object) {
          if (
            object.children[0].material.transparent !==
            (focused && !memberships.has(n.id))
          )
            object.children[0].material.needsUpdate = true;
          object.children[0].material.transparent =
            focused && !memberships.has(n.id);
          object.children[0].material.opacity =
            focused && !memberships.has(n.id) ? 0.12 : 1;
        }
      }
      scene
        .linkColor((l) =>
          selected && endpoints(l)[0] === selected
            ? "#e6b854"
            : hoveredId && endpoints(l).includes(hoveredId)
              ? "#90cce6"
              : focused
                ? "#142430"
                : "#4f748c",
        )
        .linkWidth((l) =>
          selected && endpoints(l)[0] === selected ? 1.1 : focused ? 0.1 : 0.25,
        )
        .linkOpacity(0.28);
    }
    for (const item of [...labels, ...rightLabels])
      item.sprite.visible =
        !focused && (filter === "all" || item.key === filter);
  }
  function syncCamera(source, target) {
    if (!target || syncingCamera) return;
    syncingCamera = true;
    const p = source.cameraPosition(),
      t = source.controls().target;
    target.cameraPosition(
      { x: p.x, y: p.y, z: p.z },
      { x: t.x, y: t.y, z: t.z },
      0,
    );
    syncingCamera = false;
    root.dataset.cameraSynced = "true";
  }
  function toggleCompare() {
    if (!graph) return;
    comparing = !comparing;
    compareButton.setAttribute("aria-pressed", String(comparing));
    root.classList.toggle("is-comparing", comparing);
    root.dataset.comparing = String(comparing);
    rightStage.hidden = !comparing;
    dayButtons.forEach((b) => (b.disabled = comparing));
    sceneEffects?.refresh();
    if (comparing) {
      try {
        graphRight = new api.ForceGraph3D(rightStage, {
          controlType: "orbit",
          rendererConfig: {
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
          },
        })
          .width(rightStage.clientWidth)
          .height(rightStage.clientHeight)
          .backgroundColor("#060d17")
          .showNavInfo(false)
          .enableNodeDrag(false)
          .cooldownTicks(0)
          .nodeLabel((n) =>
            n.type === "gene"
              ? `${n.symbol} · Day 3 log₂FC ${exact(n.effects[1]?.log2FoldChange)}`
              : `${label(n.pathway)} · archived membership`,
          )
          .nodeThreeObject((n) => {
            const copy = objects.get(n.id).clone(true);
            copy.children[0].material = copy.children[0].material.clone();
            rightResources.push(copy.children[0].material);
            rightObjects.set(n.id, copy);
            if (n.type === "gene") {
              rightMeshes.set(n.id, copy);
            }
            return copy;
          })
          .onNodeHover(graph.onNodeHover())
          .onNodeClick(graph.onNodeClick())
          .graphData({
            nodes: structuredClone(snapshot.nodes),
            links: structuredClone(snapshot.links),
          });
        graphRight.scene().background = new api.Color("#060d17");
        graphRight
          .renderer()
          .setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
        graphRight.controls().enableDamping = true;
        graphRight
          .controls()
          .addEventListener("change", () => syncCamera(graphRight, graph));
        for (const item of labels) {
          const copy = item.sprite.clone();
          graphRight.scene().add(copy);
          rightLabels.push({ sprite: copy, key: item.key });
        }
        bloomRight = new api.UnrealBloomPass(
          new api.Vector2(rightStage.clientWidth, rightStage.clientHeight),
          0.58,
          0.3,
          1.05,
        );
        bloomRight.enabled = bloomEnabled;
        graphRight.postProcessingComposer().addPass(bloomRight);
        const outputRight = new api.OutputPass();
        rightResources.push(outputRight);
        graphRight.postProcessingComposer().addPass(outputRight);
        rightStage.querySelector("canvas").setAttribute("aria-hidden", "true");
      } catch (error) {
        graphRight?._destructor();
        graphRight = undefined;
        comparing = false;
        rightStage.hidden = true;
        root.classList.remove("is-comparing");
        compareButton.setAttribute("aria-pressed", "false");
        root.dataset.comparing = "false";
        dayButtons.forEach((b) => (b.disabled = false));
        status.textContent =
          "This device cannot open a second 3D view. Use Day 1 / Day 3 and exact statistics instead.";
        return;
      }
    } else {
      graphRight?._destructor();
      graphRight = undefined;
      bloomRight?.dispose();
      bloomRight = undefined;
      rightMeshes.clear();
      rightObjects.clear();
      rightLabels.length = 0;
      rightResources.splice(0).forEach((r) => r.dispose());
      rightStage.replaceChildren();
    }
    requestAnimationFrame(() => {
      graph.width(leftStage.clientWidth).height(leftStage.clientHeight);
      reset();
      syncCamera(graph, graphRight);
      refresh();
    });
  }
  function refresh() {
    dayButtons.forEach((b, i) =>
      b.setAttribute("aria-pressed", String(i === day)),
    );
    const count = genes.filter(visible).length;
    leftStage.dataset.timepoint = comparing ? "Day 1 / common control" : "";
    rightStage.dataset.timepoint = "Day 3 / common control";
    status.textContent = `${count} / 113 genes · ${uncertaintyLabels[uncertainty]} · ${comparing ? "linked cameras" : "vs common control"}${filter === "V" ? " · no complex V subunits in this union" : ""}`;
    shown = 12;
    renderList();
    renderSelected();
    updateGraph();
  }
  let resize, intersection, detachObserver;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    sceneEffects?.dispose();
    resize?.disconnect();
    intersection?.disconnect();
    closeDrawer();
    bloom?.dispose();
    detachObserver?.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("fullscreenchange", fullscreenChanged);
    graphRight?._destructor();
    bloomRight?.dispose();
    rightResources.forEach((r) => r.dispose());
    graph?._destructor();
    for (const r of resources) r.dispose?.();
  }
  function visibility() {
    if (!graph) return;
    if (document.hidden || !stage.getClientRects().length) {
      graph.pauseAnimation();
      graphRight?.pauseAnimation();
    } else {
      graph.resumeAnimation();
      graphRight?.resumeAnimation();
    }
  }
  function sprite(text, colour) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    ctx.font = "500 32px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = colour;
    ctx.fillText(text, 384, 35);
    const texture = new api.CanvasTexture(canvas),
      material = new api.SpriteMaterial({ map: texture, depthTest: false });
    resources.push(texture, material);
    textSprites.push({ canvas, texture, text });
    const s = new api.Sprite(material);
    s.scale.set(235, 24, 1);
    return s;
  }
  async function start() {
    try {
      api = await trackActivity(
        import("../assets/vendor/network-3d.js"),
        "Loading 3D membership renderer",
      );
      if (destroyed || !root.isConnected) return;
      const palette = {
        background: "#060d17",
        text: "#bed5e6",
        accent: "#6ebcdb",
      };
      stage.replaceChildren(leftStage, rightStage);
      graph = new api.ForceGraph3D(leftStage, {
        controlType: "orbit",
        rendererConfig: {
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
        },
      })
        .width(leftStage.clientWidth)
        .height(leftStage.clientHeight)
        .backgroundColor(palette.background)
        .showNavInfo(false)
        .enableNodeDrag(false)
        .enableNavigationControls(true)
        .cooldownTicks(0)
        .nodeLabel((n) => {
          const text = el(
            "span",
            "",
            n.type === "gene"
              ? `${n.symbol} · log₂FC ${exact(n.effects[comparing ? 0 : day]?.log2FoldChange)}`
              : `${label(n.pathway)} · archived membership`,
          );
          return text;
        })
        .nodeThreeObject((n) => {
          const container = new api.Group();
          if (n.type === "gene") {
            const geometry = new api.SphereGeometry(4.3, 20, 14),
              material = new api.MeshBasicMaterial({
                color: color(n.effects[day]?.log2FoldChange, snapshot.limit),
              }),
              outline = new api.MeshBasicMaterial({
                color: "#e6b854",
                wireframe: true,
                toneMapped: false,
              });
            const mesh = new api.Mesh(geometry, material),
              ring = new api.Mesh(geometry, outline);
            ring.scale.setScalar(1.4);
            ring.visible = n.id === selected;
            container.add(mesh, ring);
            meshes.set(n.id, container);
            resources.push(geometry, material, outline);
          } else {
            const geometry = new api.OctahedronGeometry(6),
              material = new api.MeshBasicMaterial({
                color: palette.accent,
                toneMapped: false,
              });
            material.color.multiplyScalar(1.5);
            container.add(new api.Mesh(geometry, material));
            resources.push(geometry, material);
          }
          objects.set(n.id, container);
          return container;
        })
        .onNodeHover((n) => {
          hoveredId = n?.id || "";
          sceneEffects?.hover(hoveredId);
          stage.style.cursor = n ? "pointer" : "grab";
          updateGraph();
        })
        .onNodeClick((n) => {
          if (n.type === "gene") choose(n);
          else {
            const memberIds = new Set(
              snapshot.links
                .filter((l) => endpoints(l)[1] === n.id)
                .map((l) => endpoints(l)[0]),
            );
            searchCount.textContent = `${label(n.pathway)} · ${memberIds.size} genes from this 113-gene union. Select a gene to inspect statistics.`;
            query = "";
            search.value = "";
            geneList.replaceChildren();
            for (const g of genes.filter(
              (g) => memberIds.has(g.id) && visible(g),
            )) {
              const b = button(g.symbol, () => choose(g));
              b.setAttribute("aria-pressed", String(g.id === selected));
              geneList.append(b);
            }
            more.hidden = true;
            openDrawer("search");
          }
        })
        .graphData({
          nodes: structuredClone(snapshot.nodes),
          links: structuredClone(snapshot.links),
        });
      graph.scene().background = new api.Color(palette.background);
      graph.renderer().setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      graph.controls().enableDamping = true;
      graph
        .controls()
        .addEventListener("change", () => syncCamera(graph, graphRight));
      // Labels are annotations, not graph nodes. No absent complex is drawn.
      for (const group of snapshot.groups) {
        const s = sprite(
          `${group.key === "other" ? "Other genes" : `Complex ${group.key}`} · ${group.count}`,
          palette.text,
        );
        s.position.set(group.x, group.y + 70, group.z);
        graph.scene().add(s);
        labels.push({ sprite: s, key: group.key });
      }
      const canvas = stage.querySelector("canvas");
      canvas.setAttribute("aria-hidden", "true");
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        status.textContent =
          "The 3D graphics context was lost. Gene search, exact values and exports remain available; reopen this view to retry.";
      });
      root.dataset.rendererReady = "true";
      resize = new ResizeObserver(() => {
        if (leftStage.clientWidth && leftStage.clientHeight) {
          graph.width(leftStage.clientWidth).height(leftStage.clientHeight);
          if (graphRight)
            graphRight
              .width(rightStage.clientWidth)
              .height(rightStage.clientHeight);
        }
      });
      resize.observe(stage);
      resize.observe(leftStage);
      intersection = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !document.hidden) {
          graph.resumeAnimation();
          graphRight?.resumeAnimation();
        } else {
          graph.pauseAnimation();
          graphRight?.pauseAnimation();
        }
      });
      intersection.observe(stage);
      document.addEventListener("visibilitychange", visibility);
      bloom = new api.UnrealBloomPass(
        new api.Vector2(stage.clientWidth, stage.clientHeight),
        0.58,
        0.3,
        1.05,
      );
      bloom.enabled = bloomEnabled;
      graph.postProcessingComposer().addPass(bloom);
      const output = new api.OutputPass();
      resources.push(output);
      graph.postProcessingComposer().addPass(output);
      root.capturePreview = () => {
        const previous = labels.map((item) => item.sprite.visible);
        labels.forEach((item) => (item.sprite.visible = false));
        try {
          graph.postProcessingComposer().render();
          return graph.renderer().domElement.toDataURL("image/png");
        } finally {
          labels.forEach((item, i) => (item.sprite.visible = previous[i]));
          graph.postProcessingComposer().render();
        }
      };
      sceneEffects = createNetworkSceneEffects({
        api,
        root,
        scenes: () => [graph?.scene(), graphRight?.scene()].filter(Boolean),
        reducedMotion: () =>
          matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      root.addEventListener("network:effectframe", (event) => {
        const { hovered, blend } = event.detail;
        for (const map of [objects, rightObjects])
          for (const [id, object] of map) {
            // Scale only an outline/marker accent; gene spheres retain identical sizes.
            const ring = object.children[1];
            if (ring) {
              const wanted = id === selected || id === hovered;
              ring.visible = wanted;
              const target = id === hovered ? 1.7 : 1.4;
              ring.scale.setScalar(
                ring.scale.x + (target - ring.scale.x) * blend,
              );
            }
          }
      });
      reset();
      updateGraph();

      viewer.dispatchEvent(
        new Event("figure:contentchange", { bubbles: true }),
      );
    } catch (error) {
      stage.replaceChildren(
        el(
          "p",
          "note",
          "3D rendering is unavailable on this browser. Use Find gene and About & data for the complete gene list, exact statistics and downloads.",
        ),
      );
      status.textContent = error.message;
      root.dataset.rendererReady = "unavailable";
    }
  }
  document.addEventListener("fullscreenchange", fullscreenChanged);
  refresh();
  detachObserver = new MutationObserver(() => {
    if (!root.isConnected) destroy();
  });
  detachObserver.observe(document.body, { childList: true, subtree: true });
  root.destroy = destroy;
  requestAnimationFrame(() => start());
  return root;
}
