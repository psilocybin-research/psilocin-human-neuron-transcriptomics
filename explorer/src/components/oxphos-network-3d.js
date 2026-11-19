import { showToast } from "./app-toast.js";
import { createCameraTransition } from "./network-camera.js";
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

const hoverNumber = (value, probability = false) =>
  !Number.isFinite(value)
    ? "Not estimable"
    : probability
      ? value !== 0 && Math.abs(value) < 0.001
        ? value.toExponential(2)
        : Number(value.toPrecision(3)).toString()
      : Math.abs(value) < 0.0005 && value !== 0
        ? value.toExponential(2)
        : value.toFixed(3);
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
    layoutMode = "complex",
    query = "",
    selected =
      genes.find((n) => n.symbol === initialGene || n.id === initialGene)?.id ||
      "",
    graph,
    cameraTransition,
    api,
    destroyed = false,
    sceneEffects,
    nodeProtein,
    nodeProteinRequest = 0,
    hoveredId = "",
    proteinScene,
    proteinCamera,
    proteinSelection,
    activeResearchPanel,
    entranceOpacity = 1;
  const objects = new Map();
  const leftStage = el("div", "oxphos-3d-pane");
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
      if (day === i) return;
      day = i;
      refresh();
      showToast(`Showing Day ${i === 0 ? 1 : 3} / common control.`, { container: root });
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
  const layoutLabel = el("label", "oxphos-3d-layout-direct");
  const layoutToggle = el("input");
  layoutToggle.type = "checkbox";
  layoutToggle.setAttribute("role", "switch");
  layoutToggle.setAttribute("aria-label", "Layered network layout");
  layoutLabel.title = "Off: complex groups. On: gene–set layers. Both show the same memberships.";
  const layoutSwitch = el("span", "toggle");
  layoutSwitch.append(layoutToggle, el("span", "toggle-icon"));
  layoutLabel.append(el("span", "", "Layered layout"), layoutSwitch);
  layoutToggle.onchange = () =>
    transitionLayout(layoutToggle.checked ? "layers" : "complex");
  controls.append(
    el(
      "p",
      "note",
      "Layouts show the same archived memberships. Layers do not represent regulation, causal direction or a physical assembly.",
    ),
  );

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
  focusMemberships.checked = false;
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
    `Gene colour: log₂ fold change, blue −${snapshot.limit} → white 0 → rust +${snapshot.limit}; identical scale on both days, no clipping. Equal-size spheres = genes; diamonds = archived gene sets (not complexes). Gold outline = selected gene; cyan halo = archived gene FDR < 0.05 in that pane’s day/control contrast, not a between-day test. Grey = not estimable.`,
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
    const p = graph.cameraPosition(),
      t = graph.controls().target;
    cameraTransition.move(
      Object.fromEntries(
        ["x", "y", "z"].map((k) => [k, t[k] + (p[k] - t[k]) * factor]),
      ),
      { x: t.x, y: t.y, z: t.z },
      500,
    );
  }
  function molecularDistance() {
    const aspect = Math.max(
      0.2,
      leftStage.clientWidth / Math.max(1, leftStage.clientHeight),
    );
    const tangent = Math.tan((Math.PI * graph.camera().fov) / 360);
    return Math.max(350, 280 / (2 * tangent), 280 / (2 * tangent * aspect));
  }
  function reset(animate = true) {
    if (!graph) return;
    if (proteinScene) {
      cameraTransition.move(
        { x: 0, y: 0, z: molecularDistance() },
        { x: 0, y: 0, z: 0 },
        animate ? 850 : 0,
      );
      return;
    }
    const aspect = Math.max(
      0.3,
      leftStage.clientWidth / Math.max(1, leftStage.clientHeight),
    );
    const distance = Math.max(
      520 / (2 * Math.tan((Math.PI * graph.camera().fov) / 360)),
      640 / (2 * Math.tan((Math.PI * graph.camera().fov) / 360) * aspect),
    );
    cameraTransition.move(
      { x: 0, y: 0, z: distance },
      { x: 0, y: 0, z: 0 },
      animate ? 950 : 0,
    );
  }
  cameraTools.append(
    button("Zoom in", () => cameraZoom(0.8), "plus"),
    button("Zoom out", () => cameraZoom(1.25), "minus"),
    button("Reset camera", () => reset(), "overview"),
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
              displayed_contrasts: [
                day === 0 ? "day1_vs_control" : "day3_vs_control",
              ],
              day: day === 0 ? 1 : 3,
              contrast: day === 0 ? "day1_vs_control" : "day3_vs_control",
              complex_filter: filter,
              statistical_filter: uncertainty,
              displayed_layout: layoutMode,
              displayed_coordinates: graph
                ?.graphData()
                .nodes.map(({ id, x, y, z }) => ({ id, x, y, z })),
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
  const identity = el("p", "oxphos-3d-identity");
  identity.append(
    el("strong", "", "Psilocin Transcriptome Atlas"),
    el("span", "", "Human iPSC-derived cortical neurons"),
  );
  topbar.append(identity);
  topbar.append(days, layoutLabel, status);
  leftStage.style.flex = "1 1 0%";
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
  const proteinTools = el("div", "oxphos-3d-protein-tools");
  proteinTools.hidden = true;
  let beadsVisible = true;
  proteinTools.append(
    button("Back to membership", () => closeProteinScene(), "back"),
    button(
      "Toggle Cα beads",
      () => {
        beadsVisible = !beadsVisible;
        proteinScene?.setBeads(beadsVisible);
      },
      "controls",
    ),
  );
  const proteinCaption = el("p", "oxphos-3d-protein-caption");
  proteinCaption.hidden = true;
  viewer.append(proteinTools, proteinCaption);
  const significanceKey = el(
    "p",
    "oxphos-3d-significance-key",
    "Colour: log₂FC · cyan: FDR < 0.05 · gold: selection/search",
  );
  significanceKey.title =
    "Effect colour uses the same zero-centred scale on both days. Cyan marks archived gene FDR < 0.05. Gold marks selection; a two-second gold pulse locates a search result, not statistical confidence. Significance on one day alone is not evidence of a difference between days.";
  dock.prepend(legendCompact, significanceKey);
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
  function choose(n, focus = true, showEvidence = true) {
    if (proteinScene) closeProteinScene();
    if (selected !== n.id) nodeProtein?.clear();
    selected = n.id;
    selectedSummary.setAttribute("aria-label", `${n.symbol} · exact values`);
    selectedSummary.querySelector("span").textContent =
      n.symbol + " · exact values";
    renderSelected();
    renderList();
    updateGraph();
    if (showEvidence) openDrawer("gene");
    const position =
      graph?.graphData().nodes.find((node) => node.id === n.id) || n;
    if (focus && graph) {
      const p = graph.cameraPosition(),
        t = graph.controls().target;
      const distance = Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z) || 1;
      const focusDistance = Math.max(440, Math.min(700, distance));
      const target = { x: position.x, y: position.y, z: position.z };
      cameraTransition.move(
        Object.fromEntries(
          ["x", "y", "z"].map((k) => [
            k,
            target[k] + ((p[k] - t[k]) * focusDistance) / distance,
          ]),
        ),
        target,
        900,
      );
    }
  }
  async function showNodeProtein(gene) {
    const request = ++nodeProteinRequest;
    const { createNodeProtein } = await import("./network-node-protein.js");
    if (destroyed || request !== nodeProteinRequest || selected !== gene.id)
      return;
    nodeProtein ||= createNodeProtein({
      api,
      root,
      graphs: () => [graph],
    });
    nodeProtein.show(gene);
  }
  function renderSelected() {
    const scrollHost = selectedPanel.closest(
      ".oxphos-3d-evidence-body,.oxphos-3d-drawer-body",
    );
    const scrollPosition = scrollHost?.scrollTop || 0;
    activeResearchPanel?.dispose?.();
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
        if (selected === n.id && linked.isConnected) {
          activeResearchPanel = researchPanel(n, {
            genes: genes.filter(visible),
            total: genes.length,
            filterLabel: uncertaintyLabels[uncertainty],
            limit: snapshot.limit,
            initialTab: researchTab,
            onTab: (key) => {
              researchTab = key;
            },
            onSelect: (gene) => choose(gene, false),
            onHover: setHoveredGene,
            onSceneModel: openProteinScene,
            onSceneHighlight: (id, accession, start, end) => {
              if (proteinSelection === `${id}:${accession}`)
                proteinScene?.highlight(start, end);
            },
          });
          linked.replaceChildren(activeResearchPanel);
          activeResearchPanel.highlightGene?.(hoveredId);
          if (scrollHost) scrollHost.scrollTop = scrollPosition;
        }
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
      const b = button(n.symbol, () => {
        choose(n, true, false);
        closeDrawer();
        evidenceAside.hidden = true;
        sceneEffects?.locate(n.id);
        nodeProtein?.clear();
      });
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
    if (proteinScene) {
      graph.nodeVisibility(() => false).linkVisibility(() => false);
      labels.forEach((item) => (item.sprite.visible = false));
      return;
    }
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
    for (const [scene, map, effectDay] of [[graph, meshes, day]]) {
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
            focused && n.id !== selected ? 0.55 : 1;
          mesh.children[0].material.depthWrite = !focused || n.id === selected;
          mesh.children[1].visible = n.id === selected;
          const fdr = n.effects[effectDay]?.padj;
          mesh.children[2].visible = Number.isFinite(fdr) && fdr < 0.05;
        }
      }
      for (const n of snapshot.nodes.filter((n) => n.type !== "gene")) {
        const object = objects.get(n.id);
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
        .linkOpacity(0.28 * entranceOpacity);
    }
    for (const item of labels)
      item.sprite.visible =
        layoutMode === "complex" &&
        !focused &&
        (filter === "all" || item.key === filter);
  }
  let layoutFrame;
  const layerPositions = new Map();
  [...genes]
    .sort(
      (a, b) =>
        (a.complex || "Z").localeCompare(b.complex || "Z") ||
        a.symbol.localeCompare(b.symbol),
    )
    .forEach((n, i) =>
      layerPositions.set(n.id, {
        x: -200 + (i % 5) * 24,
        y: 180 - Math.floor(i / 5) * 16,
        z: 0,
      }),
    );
  snapshot.nodes
    .filter((n) => n.type !== "gene")
    .forEach((n, i, a) =>
      layerPositions.set(n.id, {
        x: 160,
        y: 180 - (i * 360) / Math.max(1, a.length - 1),
        z: 0,
      }),
    );
  function transitionLayout(mode) {
    if (!graph) return;
    cancelAnimationFrame(layoutFrame);
    layoutMode = mode;
    root.dataset.layout = mode;
    const began = performance.now(),
      duration = matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 780;
    const scenes = [graph];
    const origins = new Map(
      graph.graphData().nodes.map((n) => [n.id, { x: n.x, y: n.y, z: n.z }]),
    );
    const target = new Map(
      snapshot.nodes.map((n) => [
        n.id,
        mode === "layers" ? layerPositions.get(n.id) : n,
      ]),
    );
    layoutToggle.disabled = true;
    const move = (time) => {
      if (destroyed) return;
      const t = duration ? Math.min(1, (time - began) / duration) : 1,
        ease = t * t * t * (t * (t * 6 - 15) + 10);
      for (const scene of scenes) {
        for (const node of scene.graphData().nodes) {
          const a = origins.get(node.id),
            b = target.get(node.id);
          for (const key of ["x", "y", "z"]) {
            node[key] = a[key] + (b[key] - a[key]) * ease;
            node["f" + key] = node[key];
          }
        }
        // With cooldownTicks=0 this updates fixed positions and edges without a force simulation.
        scene.d3ReheatSimulation();
      }
      if (t < 1) layoutFrame = requestAnimationFrame(move);
      else {
        layoutToggle.disabled = false;
        root.dataset.layoutReady = "true";
        showToast(mode === "layers" ? "Gene–set layers displayed." : "Complex groups displayed.", { container: root });
      }
    };
    root.dataset.layoutReady = "false";
    updateGraph();
    layoutFrame = requestAnimationFrame(move);
  }
  let proteinRequest = 0;
  async function openProteinScene(context) {
    const request = ++proteinRequest;
    const { createSceneBackbone } = await import("./network-molecule.js");
    if (destroyed || request !== proteinRequest || selected !== context.gene.id)
      return;
    if (root.dataset.layoutReady === "false")
      await new Promise((resolve) => setTimeout(resolve, 820));
    if (destroyed || request !== proteinRequest) return;
    if (destroyed || request !== proteinRequest) return;
    if (proteinScene) closeProteinScene();
    const position = graph.cameraPosition(),
      target = graph.controls().target;
    proteinCamera = {
      position: { x: position.x, y: position.y, z: position.z },
      target: { x: target.x, y: target.y, z: target.z },
    };
    try {
      proteinScene = createSceneBackbone(api, context.atoms, {
        predicted: context.model.provider === "AlphaFold",
        mapping: context.mapping,
      });
    } catch (error) {
      status.textContent = error.message;
      return;
    }
    proteinSelection = `${context.gene.id}:${context.protein.accession}`;
    graph.scene().add(proteinScene.group);
    if (bloom) bloom.enabled = false;
    proteinTools.hidden = false;
    proteinCaption.hidden = false;
    proteinCaption.textContent = `${context.gene.symbol} · ${context.protein.accession} · ${context.model.provider} ${context.model.model} · Cα trace (${proteinScene.count} residues). External structural context; not measured by this experiment. ${context.model.provider === "AlphaFold" ? "Colours: local pLDDT blue ≥90, cyan 70–90, yellow 50–70, orange <50; not experimental validation." : "Colours distinguish sequence position, not confidence."}`;
    layoutToggle.disabled = true;
    dayButtons.forEach((b) => (b.disabled = true));
    root.dataset.molecularView = "true";
    beadsVisible = true;
    updateGraph();
    status.textContent = `${context.gene.symbol} · ${context.protein.accession} · molecular context`;
    cameraTransition.move(
      { x: 0, y: 0, z: molecularDistance() },
      { x: 0, y: 0, z: 0 },
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500,
    );
    closeDrawer();
    evidenceAside.hidden = true;
    panels.append(selectedPanel);
  }
  function closeProteinScene() {
    ++proteinRequest;
    if (!proteinScene) return;
    graph.scene().remove(proteinScene.group);
    proteinScene.dispose();
    proteinScene = undefined;
    proteinTools.hidden = true;
    proteinCaption.hidden = true;
    root.dataset.molecularView = "false";
    if (bloom) bloom.enabled = bloomEnabled;
    layoutToggle.disabled = false;
    dayButtons.forEach((b) => (b.disabled = false));
    if (proteinCamera)
      cameraTransition.move(
        proteinCamera.position,
        proteinCamera.target,
        matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 450,
      );
    refresh();
  }
  function geneTooltip(n) {
    if (n.type !== "gene")
      return `${label(n.pathway)} · archived membership, not a molecular interaction`;
    return (
      `${n.symbol} · ${n.id}\n` +
      n.effects
        .map(
          (e, i) =>
            `${Object.values(contrasts)[i]}: log₂FC ${hoverNumber(e?.log2FoldChange)}, SE ${hoverNumber(e?.lfcSE)}, gene FDR ${hoverNumber(e?.padj, true)}`,
        )
        .join("\n")
    );
  }
  function setHoveredGene(id) {
    const next = id || "";
    if (next === hoveredId) return;
    hoveredId = next;
    sceneEffects?.hover(hoveredId);
    activeResearchPanel?.highlightGene?.(hoveredId);
    updateGraph();
  }
  function refresh() {
    dayButtons.forEach((b, i) =>
      b.setAttribute("aria-pressed", String(i === day)),
    );
    const count = genes.filter(visible).length;
    const significantCount = (d) =>
      genes.filter(
        (n) =>
          visible(n) &&
          Number.isFinite(n.effects[d]?.padj) &&
          n.effects[d].padj < 0.05,
      ).length;
    const caption = (d) =>
      `Day ${d ? 3 : 1} / common control · ${significantCount(d)} gene FDR < 0.05`;
    leftStage.dataset.timepoint = caption(day);
    status.textContent = `${count} / 113 genes · ${uncertaintyLabels[uncertainty]} · ${significantCount(day)} gene FDR < 0.05 · vs common control${filter === "V" ? " · no complex V subunits in this union" : ""}`;
    shown = 12;
    renderList();
    renderSelected();
    updateGraph();
  }
  let resize, intersection, detachObserver, entranceFrame;
  function finishEntrance() {
    if (!cameraTransition || root.dataset.entranceReady === "true") return;
    cancelAnimationFrame(entranceFrame);
    cameraTransition?.stop();
    for (const object of objects.values()) object.scale.setScalar(1);
    for (const item of labels) item.sprite.material.opacity = 1;
    entranceOpacity = 1;
    graph?.linkOpacity(0.28);
    root.dataset.entranceReady = "true";
  }
  for (const event of ["pointerdown", "wheel", "keydown"])
    root.addEventListener(event, finishEntrance, {
      capture: true,
      passive: true,
    });
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cameraTransition?.stop();
    for (const event of ["pointerdown", "wheel", "keydown"])
      root.removeEventListener(event, finishEntrance, true);
    cancelAnimationFrame(entranceFrame);
    cancelAnimationFrame(layoutFrame);
    if (proteinScene) {
      graph?.scene().remove(proteinScene.group);
      proteinScene.dispose();
    }
    activeResearchPanel?.dispose?.();
    nodeProtein?.dispose();
    sceneEffects?.dispose();
    resize?.disconnect();
    intersection?.disconnect();
    closeDrawer();
    bloom?.dispose();
    detachObserver?.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("fullscreenchange", fullscreenChanged);
    graph?._destructor();
    for (const r of resources) r.dispose?.();
  }
  function visibility() {
    if (!graph) return;
    if (document.hidden || !stage.getClientRects().length) {
      graph.pauseAnimation();
    } else {
      graph.resumeAnimation();
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
      stage.replaceChildren(leftStage);
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
        .nodeLabel((n) => el("span", "network-gene-tooltip", geneTooltip(n)))
        .nodeThreeObject((n) => {
          const container = new api.Group();
          if (n.type === "gene") {
            const geometry = new api.SphereGeometry(4.3, 40, 28),
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
            const significanceMaterial = new api.MeshBasicMaterial({
              color: "#83dcff",
              wireframe: true,
              transparent: true,
              opacity: 0.72,
              toneMapped: false,
              depthWrite: false,
            });
            significanceMaterial.color.multiplyScalar(1.65);
            const significance = new api.Mesh(
              new api.SphereGeometry(4.3, 10, 7),
              significanceMaterial,
            );
            significance.scale.setScalar(1.22);
            significance.visible = false;
            container.add(mesh, ring, significance);
            resources.push(significance.geometry, significanceMaterial);
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
          setHoveredGene(n?.id);
          stage.style.cursor = n ? "pointer" : "grab";
          updateGraph();
        })
        .onNodeClick((n) => {
          if (n.type === "gene") {
            choose(n);
            showNodeProtein(n);
          } else {
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
      cameraTransition = createCameraTransition({
        read: () => ({
          position: { ...graph.cameraPosition() },
          target: {
            x: graph.controls().target.x,
            y: graph.controls().target.y,
            z: graph.controls().target.z,
          },
        }),
        apply: ({ position, target }) => {
          graph.cameraPosition(position, target, 0);
        },
        motion: () => !matchMedia("(prefers-reduced-motion: reduce)").matches,
        onState: (moving) => {
          root.dataset.cameraMoving = String(moving);
        },
      });
      graph.controls().addEventListener("start", cameraTransition.stop);
      graph.controls().enableDamping = true;
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
        }
      });
      resize.observe(stage);
      resize.observe(leftStage);
      intersection = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !document.hidden) {
          graph.resumeAnimation();
        } else {
          graph.pauseAnimation();
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
        root,
        reducedMotion: () =>
          matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      root.addEventListener("network:effectframe", (event) => {
        const { hovered, blend, located, pulse } = event.detail;
        for (const map of [objects])
          for (const [id, object] of map) {
            // Scale only an outline/marker accent; gene spheres retain identical sizes.
            const ring = object.children[1];
            if (ring) {
              const wanted =
                id === selected || id === hovered || id === located;
              ring.visible = wanted;
              const target =
                id === located ? 1.8 + pulse * 0.9 : id === hovered ? 1.7 : 1.4;
              ring.material.color.set(id === located ? "#ffe38b" : "#e6b854");
              ring.material.color.multiplyScalar(
                id === located ? 1.8 + pulse : 1,
              );
              ring.scale.setScalar(
                ring.scale.x + (target - ring.scale.x) * blend,
              );
            }
          }
      });
      reset(false);
      updateGraph();
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const began = performance.now();
        const groups = ["I", "II", "III", "IV", "V", "other"];
        const ease = (v) => {
          const t = Math.min(1, Math.max(0, v));
          return t * t * t * (t * (t * 6 - 15) + 10);
        };
        const overview = graph.cameraPosition();
        graph.cameraPosition(
          { ...overview, z: overview.z * 1.06 },
          { x: 0, y: 0, z: 0 },
          0,
        );
        cameraTransition.move(overview, { x: 0, y: 0, z: 0 }, 1100);
        for (const object of objects.values()) object.scale.setScalar(0.0001);
        for (const item of labels) item.sprite.material.opacity = 0;
        entranceOpacity = 0;
        graph.linkOpacity(0);
        const appear = (time) => {
          if (destroyed || root.dataset.entranceReady === "true") return;
          const elapsed = time - began;
          for (const node of snapshot.nodes) {
            const delay =
              node.type === "gene"
                ? Math.max(0, groups.indexOf(node.complex || "other")) * 45
                : 320;
            objects
              .get(node.id)
              ?.scale.setScalar(
                Math.max(0.0001, ease((elapsed - delay) / 470)),
              );
          }
          entranceOpacity = ease((elapsed - 650) / 300);
          graph.linkOpacity(0.28 * entranceOpacity);
          for (const item of labels)
            item.sprite.material.opacity = ease((elapsed - 900) / 260);
          if (elapsed < 1200) entranceFrame = requestAnimationFrame(appear);
          else finishEntrance();
        };
        entranceFrame = requestAnimationFrame(appear);
      } else finishEntrance();

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
