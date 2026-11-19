import { Plot, scientificPlot } from "./scientific-plot.js";
import { downloadFile } from "./file-download.js";
import { contrasts, fmt, sci, csvText, leadingEdgeColors } from "./format.js";
import { finite } from "./comparison-data.js";
import { plotPalette } from "./plot-theme.js";
import { figureModes, figureCaveat, validateFigureOptions, figureSpecification } from "./research-figure-data.js";

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Optional, dependency-free figure authoring over immutable archived data. */
export function createResearchFigureBuilder({ data, provenance, getGenes = async () => [] }) {
  const root = element("section", "research-figure-builder card");
  const body = element("div", "card-content card-content-padding");
  root.append(body);
  body.append(element("h3", "", "Create a research figure"), element("p", "note", "Choose an archived-data display, then download the vector figure or its exact data and specification. The specification includes display settings, source rows and archived SHA-256 references."));
  const controls = element("div", "comparison-controls research-figure-controls");
  const stage = element("div", "research-figure-stage");
  const status = element("p", "note");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const downloads = element("div", "button-row");
  body.append(controls, status, stage, downloads, element("p", "note", figureCaveat));
  let settings = validateFigureOptions({ gene: data.landscape[0]?.gene });
  let genes = [], genesReady = false, genesRequest, svg, specification, disposed = false, frame;

  const select = (title, options, value, change) => {
    const label = element("label", "control");
    label.append(element("span", "", title));
    const input = element("select");
    input.setAttribute("aria-label", title);
    for (const [key, text] of options) {
      const option = element("option", "", text);
      option.value = key;
      input.append(option);
    }
    input.value = value;
    input.addEventListener("change", () => change(input.value));
    label.append(input);
    controls.append(label);
    return { label, input };
  };
  const geneControl = select("Gene", [...data.landscape].sort((a, b) => a.gene.localeCompare(b.gene)).map((row) => [row.gene, row.gene]), settings.gene, (gene) => {
    settings.gene = gene;
    render();
  });
  const modeControl = select("Figure", Object.entries(figureModes), settings.mode, (mode) => {
    settings.mode = mode;
    render();
  });
  controls.prepend(modeControl.label);
  for (const [key, title] of [["grid", "Grid"], ["labels", "Gene labels"]]) {
    const label = element("label", "control");
    label.append(element("span", "", title));
    const toggle = element("span", "toggle toggle-init");
    const input = element("input");
    input.type = "checkbox";
    input.checked = settings[key];
    input.setAttribute("aria-label", title);
    input.addEventListener("change", () => { settings[key] = input.checked; render(); });
    toggle.append(input, element("span", "toggle-icon"));
    label.append(toggle);
    controls.append(label);
    if (key === "labels") label.dataset.scatterOnly = "true";
  }
  const addDownload = (text, handler) => {
    const button = element("button", "button button-tonal", text);
    button.type = "button";
    button.addEventListener("click", handler);
    downloads.append(button);
    return button;
  };
  addDownload("Download SVG", () => {
    if (!svg) return;
    const copy = svg.cloneNode(true);
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const metadata = document.createElementNS("http://www.w3.org/2000/svg", "metadata");
    metadata.textContent = JSON.stringify(specification);
    copy.prepend(metadata);
    downloadFile(`oxphos-${settings.mode}.svg`, new XMLSerializer().serializeToString(copy), "image/svg+xml");
  });
  addDownload("Download figure specification", () => {
    if (specification) downloadFile(`oxphos-${settings.mode}-specification.json`, JSON.stringify(specification, null, 2), "application/json");
  });
  addDownload("Download source rows", () => {
    if (specification) downloadFile(`oxphos-${settings.mode}.csv`, csvText(specification.rows));
  });

  function render() {
    if (disposed) return;
    geneControl.label.hidden = settings.mode === "scatter";
    controls.querySelector("[data-scatter-only]").hidden = settings.mode !== "scatter";
    if (settings.mode === "intervals" && !genesReady) {
      svg = null;
      specification = null;
      stage.replaceChildren();
      downloads.hidden = true;
      status.textContent = "Loading archived gene estimates and standard errors…";
      genesRequest ||= Promise.resolve().then(() => getGenes()).then((rows) => {
        genes = rows;
        genesReady = true;
        render();
      }).catch(() => {
        genesRequest = null;
        if (!disposed) status.textContent = "Gene estimates could not be loaded. Select this figure again to retry.";
      });
      return;
    }
    const width = Math.round(stage.getBoundingClientRect().width || root.getBoundingClientRect().width || 760);
    settings.width = Math.max(280, Math.min(1200, width));
    specification = figureSpecification(data, genes, provenance, settings);
    const rows = specification.rows, palette = plotPalette(), marks = [];
    let options;
    if (settings.mode === "scatter") {
      const domain = specification.encodings.axis_domain;
      const shown = rows.filter((row) => finite(row.day1_log2fc) && finite(row.day3_log2fc));
      marks.push(Plot.ruleX([0], { stroke: palette.axis }), Plot.ruleY([0], { stroke: palette.axis }), Plot.line([{ x: domain[0], y: domain[0] }, { x: domain[1], y: domain[1] }], { x: "x", y: "y", stroke: palette.muted, strokeDasharray: "4,4" }), Plot.dot(shown, { x: "day1_log2fc", y: "day3_log2fc", fill: "leading_edge", r: 4, title: (row) => `${row.gene}\nDay 1: ${fmt(row.day1_log2fc)}\nDay 3: ${fmt(row.day3_log2fc)} log₂FC` }));
      if (settings.labels) marks.push(Plot.text(shown, { x: "day1_log2fc", y: "day3_log2fc", text: "gene", dy: -9, fontSize: 9 }));
      options = { height: Math.max(300, Math.min(650, settings.width)), marginTop: 38, x: { domain, label: "Day 1 / common control · log₂FC", grid: settings.grid }, y: { domain, label: "Day 3 / common control · log₂FC", grid: settings.grid }, color: { domain: Object.keys(leadingEdgeColors), range: Object.entries(leadingEdgeColors).map(([category, value]) => category === "Shared" ? palette.shared : value), legend: false }, marks };
      status.textContent = `${shown.length} / ${rows.length} archived genes plotted; identical zero-centred axis limits. Labels can overlap in dense regions.`;
    } else if (settings.mode === "intervals") {
      const shown = rows.filter((row) => finite(row.log2FoldChange) && finite(row.lfcSE) && row.lfcSE >= 0);
      const display = shown.map((row) => ({ ...row, contrast_label: contrasts[row.contrast] || row.contrast }));
      options = { height: 280, marginLeft: settings.width < 500 ? 24 : 185, marginTop: 32, y: { domain: data.contrasts.map((key) => contrasts[key]), axis: settings.width < 500 ? null : "left", label: null }, x: { label: "log₂ fold change · approximate 95% Wald interval", grid: settings.grid }, marks: [Plot.ruleX([0], { stroke: palette.axis }), Plot.ruleY(display, { y: "contrast_label", x1: "lower_wald_95", x2: "upper_wald_95", stroke: palette.accent, strokeWidth: 2 }), Plot.dot(display, { x: "log2FoldChange", y: "contrast_label", fill: palette.accent, r: 5, title: (row) => `${row.contrast_label}\nlog₂FC ${fmt(row.log2FoldChange)} · SE ${fmt(row.lfcSE)}\nGene FDR ${sci(row.gene_fdr)}` }), ...(settings.width < 500 ? [Plot.text(display, { x: "log2FoldChange", y: "contrast_label", text: "contrast_label", dy: -18, fontSize: 10 })] : [])] };
      status.textContent = `${settings.gene}: ${shown.length} / ${rows.length} archived contrasts have estimable intervals. Approximate 95% Wald intervals use estimate ± 1.96 × SE; FDR remains archived.`;
    } else {
      const shown = rows.filter((row) => finite(row.vst));
      options = { height: 340, marginLeft: 52, x: { domain: ["Control", "Day 1", "Day 3"], label: null, ...(settings.width < 560 ? { tickFormat: (condition) => ({ Control: "C", "Day 1": "D1", "Day 3": "D3" })[condition] } : {}) }, y: { label: "VST expression", grid: settings.grid }, fx: { label: "Differentiation block" }, color: { legend: false }, marks: [Plot.dot(shown, { x: "condition", y: "vst", fx: "block", fill: "block", r: 5, title: (row) => `${row.block} · ${row.condition}\nVST ${fmt(row.vst)}\n${row.libraries_n} aggregated libraries` })] };
      status.textContent = `${settings.gene}: ${shown.length} / ${rows.length} archived aggregate profiles plotted. Points identify blocks and conditions, not independent biological replicates.${settings.width < 560 ? " C: control; D1/D3: Day 1/Day 3." : ""}`;
    }
    svg = scientificPlot({ ...options, width: settings.width, title: `${figureModes[settings.mode]}${settings.mode === "scatter" ? "" : ` · ${settings.gene}`}`, description: figureCaveat });
    if (settings.mode === "scatter") {
      const ns = "http://www.w3.org/2000/svg";
      const legend = document.createElementNS(ns, "g");
      legend.setAttribute("transform", "translate(12,17)");
      ["Day 1 only", "Shared", "Day 3 only"].forEach((category, index) => {
        const item = document.createElementNS(ns, "text");
        item.setAttribute("x", String(index * Math.min(130, (settings.width - 24) / 3)));
        item.setAttribute("font-size", "10");
        item.textContent = `● ${category}`;
        const dot = document.createElementNS(ns, "tspan");
        dot.textContent = "● ";
        dot.setAttribute("fill", category === "Shared" ? palette.shared : leadingEdgeColors[category]);
        item.replaceChildren(dot, document.createTextNode(category));
        legend.append(item);
      });
      svg.append(legend);
    }
    stage.replaceChildren(svg);
    downloads.hidden = !rows.length;
  }
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(render);
  });
  observer.observe(stage);
  root.dispose = () => {
    disposed = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
  render();
  return root;
}
