import {
  showResearchEvidence,
  loadingMessage,
  createAccordion,
} from "./interface-utils.js";
import { uiIcon } from "./icons.js";
import {
  Plot,
  scientificPlot,
  plotWidth,
  labelMargin,
  interactiveMark,
  batchDenseCircles,
} from "./scientific-plot.js";
import { downloadFile as download } from "./file-download.js";
import {
  mirroredBeeswarm,
  expressionMatrix,
} from "./expression-comparisons.js";
import { createHexbinPlot } from "./hexbin-plot.js";
import { createRidgeline, createNESDotPlot } from "./synopsis-plots.js";
import { plotPalette, themeScientificSVG } from "./plot-theme.js";
import { leadingEdgeColors } from "./format.js";
import {
  cohortGenes,
  comparisonPoints,
  geneRows,
  oxphosMembership,
  finite,
} from "./comparison-data.js";
import { contrasts, label, fmt, sci, csvText, color } from "./format.js";
const NS = "http://www.w3.org/2000/svg";
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};
const sn = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
};
const btn = (text, fn, cls = "secondary") => {
  const b = el("button", cls, text);
  b.type = "button";
  b.onclick = fn;
  return b;
};
const note = (text) => el("p", "note", text);
function control(title, values, current, fn) {
  const l = el("label", "control");
  l.append(el("span", "", title));
  const s = el("select");
  s.setAttribute("aria-label", title);
  const groups = new Map();
  for (const [value, text, group] of values) {
    const o = el("option", "", text);
    o.value = value;
    if (group && !groups.has(group)) {
      const optgroup = el("optgroup");
      optgroup.label = group;
      groups.set(group, optgroup);
      s.append(optgroup);
    }
    (groups.get(group) || s).append(o);
  }
  s.value = current;
  s.onchange = () => fn(s.value);
  l.append(s);
  return l;
}

const categoryColors = leadingEdgeColors;
const modes = {
  scatter: "Cross-contrast gene effects",
  hexbin: "Cross-contrast gene density · hexbin",
  volcano: "Gene-level volcano plot",
  forest: "Gene-effect estimates and intervals",
  distribution: "Gene-effect beeswarm",
  ridgeline: "Primary pathway gene-effect ridgelines",
  mirrored: "OXPHOS Day 1 / Day 3 · mirrored beeswarm",
  profiles: "Nine expression profiles · brushable matrix",
  membership: "OXPHOS membership · parallel sets / counts",
  enrichment: "Pathway enrichment comparison",
};
const modeGroups = {
  "Gene effects": ["scatter", "hexbin", "volcano", "forest", "distribution"],
  "Pathway comparisons": ["ridgeline", "enrichment"],
  "OXPHOS expression and membership": ["mirrored", "profiles", "membership"],
};

export function createComparativeViews({
  data,
  provenance,
  getGenes,
  state,
  onState,
  inspectGene,
  openHeatmap,
  openGeneExplorer,
  openPathways,
}) {
  const root = el("section", "comparative-views"),
    heading = el("header", "section-heading");
  heading.append(
    el("h2", "", "Comparative views"),
    el(
      "p",
      "",
      "Linked exploratory displays of archived gene-level estimates, pathway enrichment and OXPHOS leading-edge membership.",
    ),
  );
  root.append(heading);
  heading.append(
    note(
      "Choose a visualization and its available filters. Select genes in the plot or search to inspect their estimates and uncertainty.",
    ),
  );
  const controls = el("div", "comparison-controls");
  root.append(controls);
  const stage = el("div", "comparison-stage"),
    plot = el("section", "comparison-plot"),
    detail = el("aside", "comparison-evidence");
  detail.setAttribute("aria-label", "Selected gene estimates");
  stage.append(plot, detail);
  root.append(stage);
  const context = createAccordion(
    "Statistical context and interpretation",
    "comparison-context",
  );
  context.body.append(
    note(
      "Three differentiation blocks from two genetic backgrounds; nine block × condition profiles. Gene observations and shared pathway memberships are not biological replicates.",
    ),
    note(
      "Both sampled days use the available common control pool. Unresolved control-library harvest days prevent a treatment-by-time interpretation. Gene filtering and selection do not recalculate FDR.",
    ),
    note(
      "OXPHOS direction in the primary fgsea analysis is not method-independent support: estimated-correlation CAMERA reported q=0.587 at each sampled day, and full-set Bayesian magnitude remains uncertain. These views do not establish respiration, redox function or telomere protection.",
    ),
  );
  root.append(
    note(
      "Shared controls preclude a treatment-by-time interpretation. Gene observations are not biological replicates; OXPHOS statistical support remains method-dependent.",
    ),
    context.element,
  );
  let genes,
    cohort = [],
    points = [],
    orderedPoints = [],
    screenPoints = [],
    genePlot,
    currentPlot,
    brushStart,
    brushEnd,
    rowsForExport = [],
    distributionMetadata = null,
    updateDensityHighlights = null;
  const landscape = new Map(data.landscape.map((g) => [g.gene, g]));
  let search = "";
  const status = el("p", "comparison-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  root.insertBefore(status, stage);
  const loading = loadingMessage("Loading archived gene estimates…");
  plot.append(loading);
  const update = () => onState();
  const aliasNames = new Map();
  for (const alias of data.aliases) {
    const names = aliasNames.get(alias.selected_gene_id) || [];
    names.push(alias.current_symbol, alias.source_symbol);
    aliasNames.set(
      alias.selected_gene_id,
      names.filter(Boolean).map((name) => name.toUpperCase()),
    );
  }
  const searchable = new WeakMap();
  let lastSearch = "",
    matchingIds = new Set();
  const matchGene = (gene) => {
    const query = search.trim().toUpperCase();
    if (!query) return false;
    if (query !== lastSearch) {
      lastSearch = query;
      matchingIds = new Set();
      for (const candidate of genes) {
        let names = searchable.get(candidate);
        if (!names) {
          names = [
            candidate.symbol.toUpperCase(),
            candidate.id.toUpperCase(),
            ...(aliasNames.get(candidate.id) || []),
          ];
          searchable.set(candidate, names);
        }
        if (names.some((name) => name.includes(query)))
          matchingIds.add(candidate.id);
      }
    }
    return matchingIds.has(gene.id);
  };
  function change(key, value) {
    if (key === "mode") state.brushing = false;
    state[key] = value;
    state.bounds = null;
    update();
    render();
    controls
      .querySelector(
        `[aria-label="${{ mode: "Visualization", cohort: "Gene cohort", contrast: "Comparison contrast", group: "OXPHOS functional group", range: "Effect-axis extent", sort: "Gene ordering" }[key]}"]`,
      )
      ?.focus({ preventScroll: true });
  }
  function selectedGenes() {
    return genes.filter((g) => g.selected && state.selection.has(g.id));
  }
  function selectGene(g) {
    state.active = g.id;
    state.selection.add(g.id);
    update();
    renderDetail();
    if (genePlot) renderGeneMarks();
    else if (updateDensityHighlights) updateDensityHighlights();
    else renderPlot();
    renderSelection();
    showResearchEvidence(detail, "Gene comparison evidence");
  }
  function render() {
    if (!genes) return;
    if (!modes[state.mode]) state.mode = "scatter";
    if (state.mode === "hexbin" && !state.hexbinInitialized) {
      state.cohort = "all";
      state.group = "all";
      state.range = "all";
      state.hexbinInitialized = true;
      update();
    }
    if (state.mode === "volcano" && !state.volcanoInitialized) {
      state.cohort = "all";
      state.group = "all";
      state.volcanoInitialized = true;
      update();
    }
    if (["mirrored", "profiles"].includes(state.mode)) {
      state.cohort = "oxphos";
      state.group = "all";
    }
    if (state.mode === "membership") {
      state.cohort = "oxphos";
      state.group = "all";
      update();
    }
    cohort = cohortGenes(data, genes, state.cohort, state.group);
    if (state.mode === "ridgeline") {
      const members = new Set(
        data.pathways
          .filter((p) => p.tier === "primary")
          .flatMap((p) => data.membership[p.pathway] || []),
      );
      cohort = genes.filter((g) => g.selected && members.has(g.symbol));
    }
    controls.replaceChildren();
    controls.append(
      control(
        "Visualization",
        Object.entries(modeGroups).flatMap(([group, keys]) =>
          keys.map((key) => [key, modes[key], group]),
        ),
        state.mode,
        (v) => change("mode", v),
      ),
      control(
        "Gene cohort",
        [
          ["oxphos", "OXPHOS leading-edge union · 113 genes", "Gene cohorts"],
          ["all", "All rank representatives · 21,098 genes", "Gene cohorts"],
          ...Object.keys(data.membership).map((id) => [
            id,
            label(id),
            "Annotated pathway members",
          ]),
        ],
        state.cohort,
        (v) => change("cohort", v),
      ),
      control(
        "Comparison contrast",
        Object.entries(contrasts),
        state.contrast,
        (v) => change("contrast", v),
      ),
    );
    const groups = [
      ...new Set(data.landscape.map((g) => g.functional_group)),
    ].sort();
    controls.append(
      control(
        "OXPHOS functional group",
        [["all", "All functions"], ...groups.map((g) => [g, g])],
        state.group,
        (v) => change("group", v),
      ),
    );
    controls.querySelector('[aria-label="Comparison contrast"]').disabled = [
      "scatter",
      "hexbin",
      "membership",
      "enrichment",
      "ridgeline",
      "mirrored",
      "profiles",
    ].includes(state.mode);
    controls.querySelector('[aria-label="Gene cohort"]').disabled = [
      "membership",
      "enrichment",
      "ridgeline",
      "mirrored",
      "profiles",
    ].includes(state.mode);
    controls.querySelector('[aria-label="OXPHOS functional group"]').disabled =
      [
        "membership",
        "enrichment",
        "ridgeline",
        "mirrored",
        "profiles",
      ].includes(state.mode);
    for (const select of controls.querySelectorAll("select"))
      select.closest(".control").hidden = select.disabled;
    const tools = el("div", "comparison-search");
    const l = el("label", "control");
    l.append(el("span", "", "Search gene symbols or identifiers"));
    const input = el("input");
    input.type = "search";
    input.value = search;
    input.placeholder = "Source symbol, verified alias or Ensembl ID";
    input.setAttribute("aria-label", "Search comparison genes");
    l.append(input);
    tools.append(l);
    input.dataset.geneSuggestions = "true";
    input.atlasGeneSuggestions = {
      genes: () => cohort,
      preferred: () => [state.active, ...state.selection].filter(Boolean),
      select: (g) => {
        search = g.symbol;
        input.value = search;
        selectGene(g);
      },
    };
    input.oninput = () => {
      search = input.value;
      if (genePlot) renderGeneMarks();
      updateDensityHighlights?.();
      renderSelection();
    };
    tools.append(
      btn("Clear gene selection", () => {
        search = "";
        state.selection.clear();
        state.active = "";
        update();
        render();
      }),
    );
    root.querySelector(":scope>.comparison-search")?.remove();
    root.insertBefore(tools, status);
    renderPlot();
    renderDetail();
    renderSelection();
  }
  function renderPlot() {
    plot.replaceChildren();
    genePlot = null;
    currentPlot = null;
    rowsForExport = [];
    distributionMetadata = null;
    updateDensityHighlights = null;
    plot.append(
      el(
        "h3",
        "",
        state.mode === "volcano"
          ? `Gene-level volcano plot · ${state.cohort === "all" && state.group === "all" ? "transcriptome-wide" : "selected cohort"}`
          : modes[state.mode],
      ),
    );
    if (
      state.mode === "scatter" ||
      state.mode === "volcano" ||
      state.mode === "distribution"
    )
      renderGeneEffects();
    else if (state.mode === "mirrored") {
      const view = mirroredBeeswarm(data, genes, selectGene);
      plot.append(view.element);
      currentPlot = view.svg;
      rowsForExport = view.rows;
      status.textContent =
        "113 OXPHOS leading-edge-union genes · two common-control contrasts · original coefficients.";
    } else if (state.mode === "profiles") {
      const view = expressionMatrix(data, genes, state, (chosen) => {
        state.selection = new Set(chosen.map((g) => g.id));
        state.active = "";
        update();
        renderSelection();
        renderDetail();
      });
      plot.append(view.element);
      currentPlot = view.svg;
      rowsForExport = view.rows;
      distributionMetadata = view.metadata;
      updateDensityHighlights = view.updateHighlights;
      status.textContent =
        "113 selected-scope OXPHOS genes · nine archived VST profiles · linked region selection.";
    } else if (state.mode === "hexbin") {
      plot.append(
        control(
          "Effect-axis extent",
          [
            ["1", "−1 to +1"],
            ["2", "−2 to +2"],
            ["5", "−5 to +5"],
            ["10", "−10 to +10"],
            ["all", "Full observed range"],
          ],
          state.range,
          (v) => change("range", v),
        ),
      );
      const density = createHexbinPlot({
        genes: cohort,
        state,
        matchGene,
        onSelect: (chosen) => {
          state.selection = new Set(chosen.map((g) => g.id));
          state.active = "";
          update();
          renderSelection();
          renderDetail();
        },
      });
      plot.append(density.element);
      currentPlot = density.svg;
      rowsForExport = density.rows;
      distributionMetadata = density.metadata;
      updateDensityHighlights = density.updateHighlights;
      status.textContent = `${cohort.length.toLocaleString()} cohort genes · ${density.metadata.estimable.toLocaleString()} estimable pairs · ${density.metadata.occupied_bins} occupied density bins.`;
    } else if (state.mode === "ridgeline") {
      const ridges = createRidgeline(data, genes);
      plot.append(ridges.element);
      currentPlot = ridges.svg;
      rowsForExport = ridges.rows;
      distributionMetadata = ridges.metadata;
      status.textContent =
        "Five full frozen primary pathway annotations · two common-control contrasts · descriptive gene distributions.";
    } else if (state.mode === "forest") renderForest();
    else if (state.mode === "membership") renderMembership();
    else renderEnrichment();
    const downloads = el("div", "tree-actions");
    downloads.append(
      btn("Download displayed data CSV", () =>
        download("comparative-view-data.csv", csvText(rowsForExport)),
      ),
      btn("Download selected genes CSV", () =>
        download(
          "selected-gene-estimates.csv",
          csvText(geneRows(selectedGenes(), data.contrasts)),
        ),
      ),
      btn("Download view provenance", () =>
        download(
          "comparative-view-provenance.json",
          JSON.stringify(
            {
              view_url: location.href,
              mode: state.mode,
              cohort: ["enrichment", "ridgeline"].includes(state.mode)
                ? "primary_pathway_family"
                : state.cohort,
              functional_group: state.group,
              contrast:
                state.mode === "profiles"
                  ? null
                  : ["hexbin", "ridgeline", "mirrored", "scatter"].includes(
                        state.mode,
                      )
                    ? data.contrasts.slice(0, 2)
                    : ["membership", "enrichment"].includes(state.mode)
                      ? data.contrasts
                      : state.contrast,
              effect_axis: state.range,
              distribution: distributionMetadata,
              selection: [...state.selection],
              active_gene: state.active || null,
              search,
              selection_bounds: state.bounds || null,
              data_sha256: provenance.outputs,
              archived_release: "https://doi.org/10.5281/zenodo.23283595",
              scope:
                "Exploratory display of archived estimates. Gene FDR remains transcriptome-wide; filtering does not redefine correction families. Day 1 and Day 3 share unresolved-harvest common controls. Comparisons do not estimate a treatment-by-time interaction. Intervals are approximate unshrunken Wald intervals; no new tests or independence claims.",
            },
            null,
            2,
          ),
          "application/json",
        ),
      ),
    );
    if (currentPlot)
      downloads.append(
        btn("Download plot SVG", () => {
          const copy = currentPlot.cloneNode(true);
          copy.setAttribute("xmlns", NS);
          themeScientificSVG(copy, plotPalette(root));
          download(
            "comparative-view.svg",
            new XMLSerializer().serializeToString(copy),
            "image/svg+xml",
          );
        }),
      );
    const selectedExport = [...downloads.querySelectorAll("button")].find(
      (b) => b.textContent === "Download selected genes CSV",
    );
    selectedExport.dataset.selectionExport = "";
    selectedExport.disabled = state.selection.size === 0;
    plot.append(downloads);
  }
  function renderGeneEffects() {
    const distribution = state.mode === "distribution",
      scatter = state.mode === "scatter",
      index = data.contrasts.indexOf(state.contrast);
    points = distribution
      ? cohort
          .filter((g) => finite(g.effects[index].log2FoldChange))
          .map((g) => ({ gene: g, x: g.effects[index].log2FoldChange, y: 0 }))
      : comparisonPoints(cohort, state.mode, index);
    orderedPoints = [...points].sort(
      (a, b) => a.x - b.x || a.gene.id.localeCompare(b.gene.id),
    );
    const axisControls = el("div", "tree-actions");
    axisControls.append(
      control(
        "Effect-axis extent",
        [
          ["1", "−1 to +1"],
          ["2", "−2 to +2"],
          ["5", "−5 to +5"],
          ["10", "−10 to +10"],
          ["all", "Full observed range"],
        ],
        state.range,
        (v) => change("range", v),
      ),
    );
    const brush = btn(
      state.brushing ? "Finish rectangular selection" : "Rectangular selection",
      () => {
        state.brushing = !state.brushing;
        brush.setAttribute("aria-pressed", String(state.brushing));
        brush.querySelector("span").textContent = state.brushing
          ? "Finish selection"
          : "Rectangular selection";
        genePlot?.classList.toggle("brushing", state.brushing);
      },
    );
    brush.classList.add(
      "comparison-brush-toggle",
      "button",
      "button-tonal",
      "labelled-icon-action",
    );
    brush.replaceChildren(
      uiIcon("viewfinder"),
      el(
        "span",
        "",
        state.brushing ? "Finish selection" : "Rectangular selection",
      ),
    );
    axisControls.classList.add("comparison-axis-controls");
    brush.setAttribute("aria-pressed", String(state.brushing));
    if (!distribution) axisControls.append(brush);
    plot.append(axisControls);
    const frame = el("div", "comparison-svg-scroll");
    frame.tabIndex = 0;
    frame.dataset.fullscreenTitle = modes[state.mode];
    genePlot = sn("svg", {
      class: "comparison-gene-plot",
      role: "img",
      "aria-label": `${modes[state.mode]}; equivalent gene values and selection controls below`,
      viewBox: "0 0 760 640",
    });
    genePlot.style.width = "100%";
    genePlot.style.height = "auto";
    genePlot.classList.toggle("brushing", state.brushing);
    currentPlot = genePlot;
    frame.append(genePlot);
    plot.append(frame);
    const observedPlot = genePlot;
    let resizeFrame, previousWidth;
    const resize = new ResizeObserver(([entry]) => {
      if (!observedPlot.isConnected) {
        resize.disconnect();
        cancelAnimationFrame(resizeFrame);
        return;
      }
      if (previousWidth === entry.contentRect.width) return;
      previousWidth = entry.contentRect.width;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (observedPlot.isConnected && genePlot === observedPlot) renderGeneMarks();
      });
    });
    resize.observe(frame);
    const legend = el("div", "comparison-legend");
    for (const [category, fill] of Object.entries(categoryColors)) {
      const item = el("span");
      const dot = el("i");
      dot.style.background =
        category === "Shared" ? "var(--plot-shared)" : fill;
      item.append(
        dot,
        document.createTextNode(
          category === "Other" ? "Outside OXPHOS leading-edge union" : category,
        ),
      );
      legend.append(item);
    }
    plot.append(legend);
    const boundary = scatter
      ? "Descriptive comparison of Day 1/common-control and Day 3/common-control coefficients. Shared controls and unresolved control harvest days prevent treatment-specific temporal or independent-replication interpretation."
      : distribution
        ? "Gene-level distributions are descriptive. Vertical offsets separate plotted points and have no statistical meaning; dense points may overlap. Genes are not biological replicates."
        : "Gene FDR is from the original transcriptome-wide DESeq2 fits. The reference line marks FDR 0.05; it does not create a new testing family. Values exceeding −log₁₀ FDR 50, including numerical zero, are capped at 50 for display and indicated by triangles.";
    plot.append(note(boundary));
    if (scatter)
      plot.append(
        note(
          "Dashed diagonal: equal coefficients. Same-sign coefficients do not establish persistence or a treatment-by-time interaction.",
        ),
      );
    const bounds = el("details", "comparison-bounds");
    bounds.append(
      el(
        "summary",
        "",
        "Select by coordinates",
      ),
    );
    const fields = el("div", "comparison-bound-fields");
    const values = {
      xmin: -1,
      xmax: 1,
      ymin: scatter ? -1 : 0,
      ymax: scatter ? 1 : 50,
    };
    for (const [key, title] of Object.entries({
      xmin: "Minimum x",
      xmax: "Maximum x",
      ymin: "Minimum y",
      ymax: "Maximum y",
    })) {
      if (distribution && key.startsWith("y")) continue;
      const l = el("label", "control");
      l.append(el("span", "", title));
      const input = el("input");
      input.type = "number";
      input.step = "any";
      input.value = values[key];
      input.setAttribute("aria-label", title);
      input.oninput = () =>
        (values[key] = input.value === "" ? NaN : Number(input.value));
      l.append(input);
      fields.append(l);
    }
    const feedback = note("");
    feedback.setAttribute("role", "status");
    fields.append(
      btn("Select numerical region", () => {
        if (
          !Object.values(values).every(finite) ||
          values.xmin > values.xmax ||
          values.ymin > values.ymax
        ) {
          feedback.textContent = "Enter finite bounds with minimum ≤ maximum.";
          return;
        }
        state.selection = new Set(
          points
            .filter(
              (p) =>
                p.x >= values.xmin &&
                p.x <= values.xmax &&
                (distribution ||
                  ((scatter ? p.y : Math.min(50, p.y)) >= values.ymin &&
                    (scatter ? p.y : Math.min(50, p.y)) <= values.ymax)),
            )
            .map((p) => p.gene.id),
        );
        state.bounds = {
          ...values,
          mode: state.mode,
          cohort: state.cohort,
          contrast: state.contrast,
        };
        state.active = "";
        update();
        renderGeneMarks();
        renderSelection();
        renderDetail();
        feedback.textContent = `${state.selection.size} genes selected. Original FDR values are unchanged.`;
      }),
    );
    bounds.append(fields, feedback);
    plot.append(bounds);
    rowsForExport = points.map((p) => ({
      gene_id: p.gene.id,
      symbol: p.gene.symbol,
      x: p.x,
      y: distribution || p.zeroFdr ? null : p.y,
      display_y: distribution
        ? null
        : state.mode === "volcano"
          ? Math.min(50, p.y)
          : p.y,
      numerical_zero_fdr: p.zeroFdr || false,
      contrast: scatter ? "day1_vs_control;day3_vs_control" : state.contrast,
      original_gene_fdr: p.gene.effects[index].padj,
      oxphos_membership:
        landscape.get(p.gene.symbol)?.leading_edge || "Outside union",
    }));
    genePlot.onpointerdown = (e) => {
      if (!state.brushing) return;
      e.preventDefault();
      const p = eventPoint(e);
      brushStart = p;
      brushEnd = p;
      genePlot.setPointerCapture(e.pointerId);
    };
    genePlot.onpointermove = (e) => {
      if (brushStart) {
        e.preventDefault();
        brushEnd = eventPoint(e);
        drawBrush();
        return;
      }
      const p = eventPoint(e);
      const nearest = nearestPoint(p);
      genePlot.title = nearest
        ? `${nearest.gene.symbol}: x ${fmt(nearest.x, 3)}, y ${nearest.zeroFdr ? "numerical-zero FDR (display capped)" : fmt(nearest.y, 3)}`
        : "";
    };
    genePlot.onpointerup = (e) => {
      const at = eventPoint(e);
      if (brushStart) {
        brushEnd = at;
        const x0 = Math.min(brushStart.x, at.x),
          x1 = Math.max(brushStart.x, at.x),
          y0 = Math.min(brushStart.y, at.y),
          y1 = Math.max(brushStart.y, at.y);
        state.selection = new Set(
          screenPoints
            .filter((p) => p.px >= x0 && p.px <= x1 && p.py >= y0 && p.py <= y1)
            .map((p) => p.gene.id),
        );
        state.active = "";
        state.bounds = {
          pixel_bounds: [x0, y0, x1, y1],
          mode: state.mode,
          cohort: state.cohort,
          contrast: state.contrast,
          effect_axis: state.range,
        };
        brushStart = null;
        brushEnd = null;
        update();
        renderGeneMarks();
        renderSelection();
        renderDetail();
        if (genePlot.hasPointerCapture(e.pointerId))
          genePlot.releasePointerCapture(e.pointerId);
      } else {
        const near = nearestPoint(at);
        if (near) selectGene(near.gene);
      }
    };
    genePlot.onpointercancel = () => {
      brushStart = null;
      brushEnd = null;
      renderGeneMarks();
    };
    renderGeneMarks();
  }
  function eventPoint(e) {
    const r = genePlot.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * genePlot.viewBox.baseVal.width) / r.width,
      y: ((e.clientY - r.top) * 640) / r.height,
    };
  }
  function nearestPoint(p) {
    let best = null,
      d = 144;
    for (const n of screenPoints) {
      const dist = (n.px - p.x) ** 2 + (n.py - p.y) ** 2;
      if (dist < d) {
        d = dist;
        best = n;
      }
    }
    return best;
  }
  function renderGeneMarks() {
    if (!genePlot) return;
    const palette = plotPalette(root),
      W = Math.round(Math.max(280, genePlot.parentElement.clientWidth - 2));
    const scatter = state.mode === "scatter",
      distribution = state.mode === "distribution";
    const full = Math.max(
      1,
      ...points.map((p) => Math.abs(p.x)),
      ...(scatter ? points.map((p) => Math.abs(p.y)) : []),
    );
    const extent = state.range === "all" ? full * 1.03 : +state.range;
    const left = W < 500 ? 55 : 80,
      right = W - 22,
      top = 55,
      bottom = 545;
    const x = (v) => left + ((v + extent) / (2 * extent)) * (right - left),
      maxY = scatter ? extent : 50;
    const y = (v) =>
      bottom -
      ((v + (scatter ? extent : 0)) / (scatter ? 2 * extent : maxY)) *
        (bottom - top);
    const categories = distribution
      ? [
          ...new Set(
            cohort.map(
              (g) =>
                landscape.get(g.symbol)?.functional_group ||
                "Other rank representatives",
            ),
          ),
        ].sort()
      : [];
    screenPoints = [];
    let excluded = 0,
      capped = 0,
      dense = 0;
    const occupied = new Map(),
      spacing = points.length > 2000 ? 4 : 7;
    for (const p of orderedPoints) {
      if (Math.abs(p.x) > extent || (scatter && Math.abs(p.y) > extent)) {
        excluded++;
        continue;
      }
      if (!scatter && !distribution && (p.y > 50 || p.zeroFdr)) capped++;
      const group =
          landscape.get(p.gene.symbol)?.functional_group ||
          "Other rank representatives",
        slot = categories.indexOf(group);
      let py = y(Math.min(maxY, p.y));
      if (distribution) {
        const band = (bottom - top) / Math.max(1, categories.length),
          center = top + (slot + 0.5) * band,
          maxLane = Math.max(1, Math.floor((band * 0.72) / spacing / 2)),
          column = Math.floor(x(p.x) / spacing);
        const candidates = [0];
        for (let j = 1; j <= maxLane; j++) candidates.push(j, -j);
        let chosen = candidates.find((lane) =>
          [-1, 0, 1].every(
            (offset) => !occupied.get(`${slot}|${column + offset}`)?.has(lane),
          ),
        );
        if (chosen === undefined) {
          dense++;
          let hash = 0;
          for (const c of p.gene.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
          chosen = (hash % (2 * maxLane + 1)) - maxLane;
        }
        const key = `${slot}|${column}`;
        if (!occupied.has(key)) occupied.set(key, new Set());
        occupied.get(key).add(chosen);
        py = center + chosen * spacing;
      }
      const selected = state.selection.has(p.gene.id) || matchGene(p.gene);
      screenPoints.push({
        ...p,
        px: x(p.x),
        py,
        displayY: distribution ? py : Math.min(maxY, p.y),
        selected,
        fill: selected
          ? "var(--plot-highlight)"
          : landscape.get(p.gene.symbol)?.leading_edge === "Shared"
            ? "var(--plot-shared)"
            : categoryColors[
                landscape.get(p.gene.symbol)?.leading_edge || "Other"
              ],
        layer: selected ? 2 : landscape.has(p.gene.symbol) ? 1 : 0,
      });
    }
    screenPoints.sort((a, b) => a.layer - b.layer);
    const marks = [Plot.ruleX([0], { stroke: "#7b92a4" })];
    if (scatter)
      marks.push(
        Plot.line(
          [
            { x: -extent, y: -extent },
            { x: extent, y: extent },
          ],
          { x: "x", y: "y", stroke: "#7b92a4", strokeDasharray: "5 4" },
        ),
      );
    else if (!distribution)
      marks.push(
        Plot.ruleY([-Math.log10(0.05)], {
          stroke: "#7b92a4",
          strokeDasharray: "5 4",
        }),
      );
    if (distribution)
      marks.push(
        Plot.text(
          categories.map((text, i) => ({
            text,
            y: top + ((i + 0.5) * (bottom - top)) / categories.length - 18,
          })),
          {
            x: -extent,
            y: "y",
            text: "text",
            textAnchor: "start",
            dx: 5,
            fontSize: 10,
          },
        ),
      );
    const cappedPoint = (p) =>
      !scatter && !distribution && (p.y > 50 || p.zeroFdr);
    const dotOptions = {
      x: "x",
      y: "displayY",
      r: {
        value: (p) => (p.selected ? 5 : points.length > 2000 ? 1.8 : 3),
        scale: null,
      },
      fill: "fill",
      fillOpacity: (p) =>
        p.selected
          ? 1
          : p.layer === 1
            ? 0.9
            : points.length > 2000
              ? 0.25
              : 0.75,
      title: (p) =>
        `${p.gene.symbol} · x ${fmt(p.x, 4)}${distribution ? "" : ` · y ${p.zeroFdr ? "numerical-zero FDR; display capped" : fmt(p.y, 4)}`}`,
    };
    marks.push(
      Plot.dot(
        screenPoints.filter((p) => !cappedPoint(p)),
        { ...dotOptions, render: batchDenseCircles },
      ),
    );
    marks.push(
      Plot.dot(screenPoints.filter(cappedPoint), {
        ...dotOptions,
        symbol: "triangle",
      }),
    );
    const chart = scientificPlot({
      title: modes[state.mode],
      width: W,
      height: 640,
      marginLeft: left,
      marginRight: 22,
      marginTop: top,
      marginBottom: 95,
      x: {
        domain: [-extent, extent],
        grid: true,
        ticks: 5,
        label: scatter
          ? "Day 1 / common control · log₂ fold change"
          : `${contrasts[state.contrast]} · log₂ fold change`,
      },
      y: distribution
        ? { domain: [bottom, top], axis: null }
        : {
            domain: scatter ? [-extent, extent] : [0, 50],
            grid: true,
            ticks: 5,
            label: scatter
              ? "Day 3 / common control · log₂ fold change"
              : "−log₁₀ original gene FDR",
          },
      marks,
    });
    genePlot.setAttribute("viewBox", `0 0 ${W} 640`);
    genePlot.dataset.plotRenderer = "observable-plot";
    chart.querySelector(":scope > style[data-plot-theme]")?.remove();
    chart.querySelector(":scope > rect[data-plot-background]")?.remove();
    genePlot.replaceChildren(...chart.childNodes);
    themeScientificSVG(genePlot, palette);
    distributionMetadata = {
      renderer: "Observable Plot 0.6.19",
      outside_axis: excluded,
      capped_fdr: capped,
      ...(distribution
        ? {
            dense_placements: dense,
            vertical_offsets:
              "deterministic collision separation; no statistical meaning",
          }
        : {}),
    };
    drawBrush();
    status.textContent = `${cohort.length.toLocaleString()} cohort genes · ${points.length.toLocaleString()} estimable points · ${cohort.length - points.length} without required estimates · ${excluded} outside axis window${capped ? ` · ${capped} FDR caps` : ""} · ${state.selection.size} selected genes.`;
  }
  function drawBrush() {
    genePlot?.querySelector("[data-brush]")?.remove();
    if (!genePlot || !brushStart || !brushEnd) return;
    genePlot.append(
      sn("rect", {
        "data-brush": "",
        x: Math.min(brushStart.x, brushEnd.x),
        y: Math.min(brushStart.y, brushEnd.y),
        width: Math.abs(brushEnd.x - brushStart.x),
        height: Math.abs(brushEnd.y - brushStart.y),
        fill: "#23578026",
        stroke: "#235780",
        "pointer-events": "none",
      }),
    );
  }
  function makeSVG(width, height, title) {
    const s = sn("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": title,
      style: "font:12px system-ui,sans-serif;fill:#203d50;background:white",
    });
    s.append(sn("title", {}, title));
    const wrap = el("div", "comparison-svg-scroll");
    wrap.tabIndex = 0;
    wrap.append(s);
    plot.append(wrap);
    currentPlot = s;
    return s;
  }
  function line(s, x1, y1, x2, y2, attrs = {}) {
    s.append(sn("line", { x1, y1, x2, y2, stroke: "#d3dfe7", ...attrs }));
  }
  function txt(s, x, y, text, attrs = {}) {
    s.append(sn("text", { x, y, ...attrs }, text));
  }
  function renderForest() {
    const picked = selectedGenes();
    let rows = (picked.length ? picked : cohort).filter((g) =>
      g.effects.some((e) => finite(e.log2FoldChange) && finite(e.lfcSE)),
    );
    const index = data.contrasts.indexOf(state.contrast);
    rows.sort((a, b) =>
      state.sort === "effect"
        ? (b.effects[index].log2FoldChange ?? -Infinity) -
          (a.effects[index].log2FoldChange ?? -Infinity)
        : state.sort === "uncertainty"
          ? (b.effects[index].lfcSE ?? -Infinity) -
            (a.effects[index].lfcSE ?? -Infinity)
          : state.sort === "function"
            ? (landscape.get(a.symbol)?.functional_group || "").localeCompare(
                landscape.get(b.symbol)?.functional_group || "",
              ) || a.symbol.localeCompare(b.symbol)
            : a.symbol.localeCompare(b.symbol),
    );
    plot.append(
      control(
        "Gene ordering",
        [
          ["symbol", "Gene symbol"],
          ["function", "Descriptive functional group"],
          ["effect", "Coefficient for selected contrast"],
          ["uncertainty", "Standard error for selected contrast"],
        ],
        state.sort,
        (v) => change("sort", v),
      ),
    );
    const shown = rows.slice(0, 40);
    plot.append(
      note(
        `${rows.length} eligible genes; displaying ${shown.length}. ${picked.length ? "Panel uses the linked gene selection." : "Default panel uses the cohort, ordered by the selected rule."} All eligible rows are retained in the CSV.`,
      ),
    );
    rowsForExport = geneRows(rows, data.contrasts);
    const limit = Math.max(
      1,
      ...shown.flatMap((g) =>
        g.effects
          .filter((e) => finite(e.log2FoldChange) && finite(e.lfcSE))
          .map((e) => Math.abs(e.log2FoldChange) + 1.96 * e.lfcSE),
      ),
    );
    const values = shown.flatMap((g) =>
      g.effects.map((effect, i) => ({
        ...effect,
        gene: g,
        symbol: g.symbol,
        contrast: contrasts[data.contrasts[i]],
        color: [
          leadingEdgeColors["Day 1 only"],
          leadingEdgeColors["Day 3 only"],
          "#8471ad",
        ][i],
        valid: finite(effect.log2FoldChange) && finite(effect.lfcSE),
      })),
    );
    const valid = values.filter((r) => r.valid),
      missing = values.filter((r) => !r.valid);
    const describe = (r) =>
      `${r.symbol}, ${r.contrast}: log₂FC ${fmt(r.log2FoldChange, 4)}, SE ${fmt(r.lfcSE, 4)}, original gene FDR ${sci(r.padj)}. Inspect gene evidence.`;
    const width = plotWidth(960),
      stacked = width < 600;
    const facetChannel = stacked ? { fy: "contrast" } : { fx: "contrast" };
    const chart = scientificPlot({
      title:
        "Archived gene coefficients and approximate 95% Wald intervals across three contrasts",
      width,
      height: stacked
        ? 3 * (shown.length * 26 + 70)
        : Math.max(260, 100 + shown.length * 42),
      marginLeft: labelMargin(shown.map((gene) => gene.symbol)),
      marginTop: 52,
      facet: {
        data: values,
        ...(stacked ? { y: "contrast" } : { x: "contrast" }),
      },
      ...(stacked
        ? {
            fy: { domain: data.contrasts.map((c) => contrasts[c]), axis: null },
          }
        : {
            fx: {
              domain: data.contrasts.map((c) => contrasts[c]),
              label: null,
            },
          }),
      x: {
        domain: [-limit, limit],
        grid: true,
        label: "log₂ fold change · coefficient ±1.96 × SE",
      },
      y: { domain: shown.map((g) => g.symbol), label: null },
      marks: [
        ...(stacked
          ? [
              Plot.text(
                values.filter((row) => row.gene === shown[0]),
                {
                  x: -limit,
                  y: "symbol",
                  fy: "contrast",
                  text: "contrast",
                  textAnchor: "start",
                  dy: -24,
                  fontWeight: 600,
                },
              ),
            ]
          : []),
        Plot.ruleX([0], { stroke: "#7b92a4", strokeDasharray: "3 3" }),
        Plot.ruleY(valid, {
          x1: (r) => r.log2FoldChange - 1.96 * r.lfcSE,
          x2: (r) => r.log2FoldChange + 1.96 * r.lfcSE,
          y: "symbol",
          ...facetChannel,
          stroke: "color",
          strokeWidth: 2,
        }),
        Plot.dot(valid, {
          x: "log2FoldChange",
          y: "symbol",
          ...facetChannel,
          fill: "color",
          r: 4,
          title: describe,
          render: interactiveMark(valid, (r) => selectGene(r.gene), describe),
        }),
        Plot.text(missing, {
          x: 0,
          y: "symbol",
          ...facetChannel,
          text: () => "Not estimable",
          fontSize: 10,
        }),
      ],
    });
    const viewport = el("div", "plot-viewport comparison-svg-scroll");
    viewport.tabIndex = 0;
    viewport.style.setProperty("--plot-width", `${width}px`);
    viewport.dataset.fullscreenTitle = "Gene-effect intervals";
    viewport.append(chart);
    plot.append(viewport);
    currentPlot = chart;
    plot.append(
      note(
        "Intervals use the original model standard errors. Genes and contrasts are correlated; displaying intervals does not create additional biological replicates or a new multiple-testing family.",
      ),
    );
    status.textContent = `${rows.length} eligible genes · ${shown.length} displayed · ${state.selection.size} selected.`;
  }
  function renderMembership() {
    plot.append(
      control(
        "Membership visualization",
        [
          ["counts", "Membership counts by functional group"],
          ["parallel", "Categorical parallel sets"],
        ],
        state.membershipView,
        (v) => {
          state.membershipView = v;
          update();
          render();
        },
      ),
    );
    const categories = oxphosMembership(data);
    plot.append(
      note(
        "Categorical leading-edge membership at Day 1 and Day 3. Membership groups do not represent transitions, trajectories or independently replicated responses.",
      ),
    );
    const summary = el("div", "membership-cards");
    for (const row of categories) {
      const b = btn(
        "",
        () => {
          state.selection = new Set(
            genes
              .filter((g) => row.genes.includes(g.symbol) && g.selected)
              .map((g) => g.id),
          );
          state.active = "";
          update();
          renderSelection();
          renderPlot();
          renderDetail();
        },
        "membership-card",
      );
      b.style.borderColor =
        row.category === "Shared"
          ? "var(--plot-shared)"
          : categoryColors[row.category];
      b.append(
        el("strong", "", row.genes.length),
        el("span", "", row.category),
      );
      summary.append(b);
    }
    plot.append(summary);
    if (state.membershipView === "parallel") {
      renderParallel(categories);
      rowsForExport = data.landscape.map((g) => ({
        symbol: g.gene,
        membership: g.leading_edge,
        functional_group: g.functional_group,
        annotation_scope: g.annotation_source,
      }));
      status.textContent =
        "Categorical annotation intersections · 113 unique genes · no inferred temporal transitions.";
      return;
    }
    const groups = [
      ...new Set(data.landscape.map((g) => g.functional_group)),
    ].sort();
    const s = makeSVG(
      960,
      100 + groups.length * 42,
      "OXPHOS leading-edge membership by descriptive functional group",
    );
    const max = Math.max(
      ...groups.map(
        (group) =>
          data.landscape.filter((g) => g.functional_group === group).length,
      ),
    );
    groups.forEach((group, i) => {
      const yy = 40 + i * 42;
      txt(s, 12, yy + 17, group, { "font-size": 11 });
      let start = 350;
      categories.forEach((row) => {
        const count = data.landscape.filter(
          (g) =>
            g.functional_group === group && g.leading_edge === row.category,
        ).length;
        if (count) {
          const rect = sn("rect", {
            x: start,
            y: yy,
            width: (count / max) * 520,
            height: 25,
            fill: categoryColors[row.category],
            role: "button",
            tabindex: 0,
            "aria-label": `${group}, ${row.category}, ${count} genes`,
          });
          rect.addEventListener("click", () => {
            state.selection = new Set(
              genes
                .filter(
                  (g) =>
                    g.selected &&
                    data.landscape.some(
                      (n) =>
                        n.gene === g.symbol &&
                        n.functional_group === group &&
                        n.leading_edge === row.category,
                    ),
                )
                .map((g) => g.id),
            );
            update();
            renderSelection();
          });
          rect.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              rect.dispatchEvent(new Event("click"));
            }
          });
          s.append(rect);
          txt(s, start + (count / max) * 260, yy + 17, String(count), {
            "text-anchor": "middle",
            fill: row.category === "Shared" ? "#fff" : "#17212b",
            class:
              row.category === "Shared"
                ? "category-count shared-category-label"
                : "category-count",
            "font-size": 11,
          });
          start += (count / max) * 520;
        }
      });
    });
    txt(
      s,
      12,
      80 + groups.length * 42,
      "Absolute gene counts; project functional assignments are descriptive and may not represent ontology-defined biological modules.",
      { "font-size": 11 },
    );
    rowsForExport = data.landscape.map((g) => ({
      symbol: g.gene,
      membership: g.leading_edge,
      functional_group: g.functional_group,
      annotation_scope: g.annotation_source,
    }));
    const links = el("div", "tree-actions");
    links.append(
      btn("Inspect selection in effect comparison", () =>
        change("mode", "scatter"),
      ),
      btn("Inspect selected gene in OXPHOS heatmap", () => {
        const g = selectedGenes()[0];
        openHeatmap(g?.symbol || "GPX4");
      }),
    );
    plot.append(links);
    status.textContent =
      "113 OXPHOS leading-edge union genes · 6 Day 1 only · 89 shared · 18 Day 3 only.";
  }
  function renderParallel(categories) {
    if (matchMedia("(max-width:550px)").matches) {
      renderParallelMobile(categories);
      return;
    }
    const groups = [
        ...new Set(data.landscape.map((g) => g.functional_group)),
      ].sort(),
      s = makeSVG(
        1080,
        690,
        "Categorical OXPHOS leading-edge membership and functional annotation",
      );
    const scale = 4.1,
      gap = 14,
      left = 230,
      right = 670,
      leftPositions = new Map(),
      rightPositions = new Map();
    let y = 60;
    txt(s, 12, 24, "Leading-edge membership", { "font-weight": 600 });
    txt(s, 700, 24, "Descriptive functional group", { "font-weight": 600 });
    for (const category of categories) {
      leftPositions.set(category.category, y);
      y += category.genes.length * scale + gap;
    }
    y = 60;
    for (const group of groups) {
      rightPositions.set(group, y);
      y +=
        data.landscape.filter((g) => g.functional_group === group).length *
          scale +
        gap;
    }
    const leftOffsets = new Map(),
      rightOffsets = new Map();
    for (const category of categories)
      for (const group of groups) {
        const members = data.landscape.filter(
            (g) =>
              g.leading_edge === category.category &&
              g.functional_group === group,
          ),
          n = members.length;
        if (!n) continue;
        const y1 =
            leftPositions.get(category.category) +
            (leftOffsets.get(category.category) || 0),
          y2 = rightPositions.get(group) + (rightOffsets.get(group) || 0),
          h = n * scale;
        leftOffsets.set(
          category.category,
          (leftOffsets.get(category.category) || 0) + h,
        );
        rightOffsets.set(group, (rightOffsets.get(group) || 0) + h);
        const path = sn("path", {
          d: `M${left},${y1} C420,${y1} 470,${y2} ${right},${y2} L${right},${y2 + h} C470,${y2 + h} 420,${y1 + h} ${left},${y1 + h} Z`,
          fill: categoryColors[category.category],
          "fill-opacity": 0.55,
          stroke: "white",
          "stroke-width": 0.5,
          role: "button",
          tabindex: 0,
          "aria-label": `${category.category} and ${group}: ${n} genes`,
        });
        path.append(
          sn(
            "title",
            {},
            `${category.category} × ${group}: ${n} genes. Annotation intersection; not a temporal flow.`,
          ),
        );
        const select = () => {
          state.selection = new Set(
            genes
              .filter(
                (g) => g.selected && members.some((m) => m.gene === g.symbol),
              )
              .map((g) => g.id),
          );
          state.active = "";
          update();
          renderSelection();
          renderDetail();
        };
        path.addEventListener("click", select);
        path.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            select();
          }
        });
        s.append(path);
      }
    for (const category of categories) {
      const yy = leftPositions.get(category.category),
        h = category.genes.length * scale;
      s.append(
        sn("rect", {
          x: left - 10,
          y: yy,
          width: 10,
          height: h,
          fill: categoryColors[category.category],
        }),
      );
      txt(
        s,
        12,
        yy + Math.max(12, h / 2),
        `${category.category} · ${category.genes.length}`,
        { "font-size": 13 },
      );
    }
    for (const group of groups) {
      const yy = rightPositions.get(group),
        n = data.landscape.filter((g) => g.functional_group === group).length;
      s.append(
        sn("rect", {
          x: right,
          y: yy,
          width: 10,
          height: n * scale,
          fill: "#6d8495",
        }),
      );
      txt(
        s,
        right + 20,
        yy + Math.max(11, (n * scale) / 2),
        `${group} · ${n}`,
        { "font-size": 11 },
      );
    }
    txt(
      s,
      12,
      655,
      "Ribbon widths encode absolute gene counts. Genes have one project display assignment in this panel.",
      { "font-size": 12 },
    );
    txt(
      s,
      12,
      678,
      "Categorical membership intersections only; no temporal transitions or biological flux. DOI 10.5281/zenodo.23283595",
      { "font-size": 11 },
    );
    plot.append(
      note(
        "Select a ribbon to retain the corresponding gene subset across the effect comparison and interval views. These functional assignments are descriptive project annotations, not independent enrichment results.",
      ),
    );
  }
  function renderParallelMobile(categories) {
    const groups = [
        ...new Set(data.landscape.map((g) => g.functional_group)),
      ].sort(),
      s = makeSVG(
        360,
        900,
        "Categorical OXPHOS leading-edge membership and functional annotation",
      );
    s.classList.add("parallel-mobile");
    const scale = 2.05,
      gap = 8,
      start = 20,
      top = 70,
      bottom = 540;
    let at = start;
    const source = new Map(),
      target = new Map(),
      sourceOffset = new Map(),
      targetOffset = new Map();
    categories.forEach((row, i) => {
      source.set(row.category, at);
      s.append(
        sn("rect", {
          x: at,
          y: top - 10,
          width: row.genes.length * scale,
          height: 10,
          fill: categoryColors[row.category],
        }),
      );
      txt(
        s,
        at + (row.genes.length * scale) / 2,
        top - 22,
        ["A", "B", "C"][i],
        { "text-anchor": "middle", "font-size": 13, "font-weight": 700 },
      );
      at += row.genes.length * scale + gap;
    });
    at = start;
    groups.forEach((group, i) => {
      target.set(group, at);
      const n = data.landscape.filter(
        (g) => g.functional_group === group,
      ).length;
      s.append(
        sn("rect", {
          x: at,
          y: bottom,
          width: n * scale,
          height: 10,
          fill: "#6d8495",
        }),
      );
      txt(s, at + (n * scale) / 2, bottom + 28, String(i + 1), {
        "text-anchor": "middle",
        "font-size": 11,
      });
      at += n * scale + gap;
    });
    for (const category of categories)
      for (const group of groups) {
        const members = data.landscape.filter(
            (g) =>
              g.leading_edge === category.category &&
              g.functional_group === group,
          ),
          n = members.length;
        if (!n) continue;
        const x1 =
            source.get(category.category) +
            (sourceOffset.get(category.category) || 0),
          x2 = target.get(group) + (targetOffset.get(group) || 0),
          w = n * scale;
        sourceOffset.set(
          category.category,
          (sourceOffset.get(category.category) || 0) + w,
        );
        targetOffset.set(group, (targetOffset.get(group) || 0) + w);
        const path = sn("path", {
          d: `M${x1},${top} C${x1},250 ${x2},360 ${x2},${bottom} L${x2 + w},${bottom} C${x2 + w},360 ${x1 + w},250 ${x1 + w},${top} Z`,
          fill: categoryColors[category.category],
          "fill-opacity": 0.6,
          stroke: "white",
          "stroke-width": 0.4,
          role: "button",
          tabindex: 0,
          "aria-label": `${category.category} and ${group}: ${n} genes`,
        });
        path.append(
          sn("title", {}, `${category.category} × ${group}: ${n} genes`),
        );
        const choose = () => {
          state.selection = new Set(
            genes
              .filter(
                (g) => g.selected && members.some((m) => m.gene === g.symbol),
              )
              .map((g) => g.id),
          );
          state.active = "";
          update();
          renderSelection();
          renderDetail();
        };
        path.addEventListener("click", choose);
        path.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose();
          }
        });
        s.append(path);
      }
    txt(s, 20, 20, "Leading-edge membership A / B / C", {
      "font-size": 13,
      "font-weight": 600,
    });
    txt(s, 20, 602, "Functional annotation · numbered key below", {
      "font-size": 12,
    });
    txt(s, 20, 630, "Categorical intersections; no temporal transitions", {
      "font-size": 11,
    });
    groups.forEach((group, i) =>
      txt(s, 20, 660 + i * 23, `${i + 1}. ${group}`, { "font-size": 11 }),
    );
    txt(s, 20, 888, "DOI 10.5281/zenodo.23283595", { "font-size": 10 });
    const key = el("ol", "parallel-group-key");
    groups.forEach((group) => key.append(el("li", "", group)));
    plot.append(
      note(
        "A: Day 1 only · B: shared · C: Day 3 only. Ribbon widths encode gene counts. Select a ribbon to retain its gene subset.",
      ),
      key,
    );
  }
  function renderEnrichment() {
    const chart = createNESDotPlot(data, () => openPathways());
    plot.append(
      chart,
      note(
        "All five prespecified pathways and three contrasts are retained. The 15-test BH family is unchanged. Correlation-aware CAMERA and Bayesian magnitude sensitivity remain necessary for OXPHOS interpretation.",
      ),
      btn("Inspect pathway evidence and sensitivity", openPathways),
    );
    currentPlot = chart.querySelector("svg[data-plot-renderer]");
    rowsForExport = data.pathways.filter((r) => r.tier === "primary");
    status.textContent =
      "Five primary pathways × three contrasts · 15-test primary family.";
  }
  const selectionPanel = el("section", "comparison-selection");
  selectionPanel.setAttribute("aria-label", "Linked gene selection");
  root.append(selectionPanel);
  function renderSelection() {
    if (!genes) return;
    root
      .querySelectorAll("[data-selection-export]")
      .forEach((b) => (b.disabled = state.selection.size === 0));
    selectionPanel.replaceChildren(el("h3", "", "Linked gene selection"));
    const selected = selectedGenes(),
      matches = search.trim() ? cohort.filter(matchGene) : [];
    const rows = search.trim() ? matches : selected;
    selectionPanel.append(
      note(
        `${state.selection.size} selected genes${search.trim() ? ` · ${matches.length} search matches in the current cohort` : ""}. ${rows.length > 80 ? "First 80 listed; complete selection is retained in exports." : ""}${state.selection.size > 500 ? " Selections above 500 genes are retained in this session and exports; shared links retain view settings only." : ""}`,
      ),
    );
    const list = el("div", "comparison-gene-list");
    for (const g of rows.slice(0, 80)) {
      const b = btn("", () => selectGene(g), "comparison-gene-button");
      b.dataset.comparisonGene = g.id;
      b.setAttribute("aria-pressed", String(state.selection.has(g.id)));
      b.append(el("strong", "", g.symbol), el("small", "", g.id));
      list.append(b);
    }
    selectionPanel.append(list);
    if (!rows.length)
      selectionPanel.append(
        note(
          "Select plotted observations, a numerical region, or an OXPHOS membership category; alternatively search for a gene symbol or identifier.",
        ),
      );
    if (state.selection.size)
      selectionPanel.append(
        btn("Inspect selected-gene intervals", () => change("mode", "forest")),
        btn("Open selected gene in Gene explorer", () => {
          const g = genes.find((g) => g.id === state.active) || selected[0];
          if (g) openGeneExplorer(g.id);
        }),
      );
  }
  function renderDetail() {
    detail.replaceChildren(
      btn(
        "↑ Return to visualization",
        () => {
          plot.tabIndex = -1;
          plot.focus({ preventScroll: true });
          plot.scrollIntoView({ block: "start", behavior: "instant" });
        },
        "secondary comparison-return",
      ),
      el("div", "eyebrow", "ARCHIVED GENE ESTIMATES"),
    );
    const g = genes.find((g) => g.id === state.active);
    detail.hidden = !g;
    stage.classList.toggle("comparison-has-evidence", Boolean(g));
    if (g) {
      const host = el("div", "gene-detail");
      detail.append(host);
      inspectGene(host, g.id);
      const links = el("div", "tree-actions");
      links.append(btn("Open Gene explorer", () => openGeneExplorer(g.id)));
      if (landscape.has(g.symbol))
        links.append(btn("Open OXPHOS heatmap", () => openHeatmap(g.symbol)));
      detail.append(links);
    } else
      detail.append(
        el("h3", "", "Gene-level evidence"),
        note(
          "Select an observation or gene identifier to inspect the archived coefficients, original gene FDR and approximate 95% Wald intervals.",
        ),
      );
  }
  getGenes()
    .then((value) => {
      if (!root.isConnected) return;
      genes = value;
      render();
    })
    .catch(() => {
      plot.replaceChildren(
        note(
          "Archived estimates could not be loaded. Reopen Comparative views to retry.",
        ),
      );
    });
  return root;
}
