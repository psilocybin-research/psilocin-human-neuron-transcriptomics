import { appendMitochondrialCard } from "./mitochondrial-card.js";
import { createMitochondrialExplorer } from "./mitochondrial-explorer.js";
import {networkPreviewSizes, networkPreviewSrcset} from "./network-preview-asset.js";
import {studioMenu} from "./studio-ui.js";
import {showToast} from "./app-toast.js";
import { createResearchInspector } from "./research-inspector.js";
import { createResearchStore } from "./research-store.js";
import { createGenePreview, genePreviewMarkup } from "./structure-preview.js";
import { createGeneRecords } from "./gene-records.js";
import { geneAnnotation } from "./gene-annotation.js";
import {
  createElement as el,
  loadingMessage,
  showResearchEvidence,
  createAccordion,
} from "./interface-utils.js";
import {
  Plot,
  scientificPlot,
  interactiveMark,
  plotWidth,
  rowPlotLayout,
} from "./scientific-plot.js";
import {
  downloadFile as download,
  downloadRemoteFile,
} from "./file-download.js";
import { trackActivity } from "./app-activity.js";
import { createNESDotPlot } from "./synopsis-plots.js";
import { uiIcon } from "./icons.js";
import { enhancePlots } from "./figure-controls.js";
import { leadingEdgeColors } from "./format.js";
import { createAppShell } from "./app-shell.js";
import { overlapGraph } from "./pathway-overlap.js";
import { createPathwayTree, families } from "./pathway-tree.js";
import {
  contrasts,
  names,
  label,
  fmt,
  sci,
  color,
  edgeGenes,
  csvText,
} from "./format.js";
const NS = "http://www.w3.org/2000/svg";
function svgNode(tag, attrs = {}, text) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}
function svg(w, h, title) {
  const n = svgNode("svg", {
    viewBox: `0 0 ${w} ${h}`,
    role: "img",
    "aria-label": title,
    style:
      "font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;fill:#43534b",
  });
  n.append(svgNode("title", {}, title));
  return n;
}
function text(s, x, y, t, attrs = {}) {
  s.append(svgNode("text", { x, y, ...attrs }, t));
}
function line(s, x1, y1, x2, y2, attrs = {}) {
  s.append(svgNode("line", { x1, y1, x2, y2, stroke: "#d7dedf", ...attrs }));
}
function button(t, fn, cls = "") {
  const b = el("button", cls, t);
  b.type = "button";
  b.onclick = fn;
  return b;
}
function icon(kind) {
  if (kind !== "orcid") return uiIcon(kind);
  const s = svgNode("svg", {
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
    focusable: "false",
  });
  s.append(
    svgNode("circle", { cx: 12, cy: 12, r: 10, fill: "#a6ce39" }),
    svgNode(
      "text",
      {
        x: 12,
        y: 16,
        "text-anchor": "middle",
        fill: "#fff",
        "font-size": 11,
        "font-weight": 700,
      },
      "iD",
    ),
  );
  return s;
}
function iconButton(textValue, kind, fn, cls) {
  const b = button("", fn, cls);
  b.append(icon(kind), document.createTextNode(textValue));
  return b;
}

function downloadButton(rows, name) {
  return button(
    "Download CSV",
    () => download(name, csvText(rows)),
    "secondary",
  );
}
function note(t) {
  return el("p", "note", t);
}
function heading(t, sub) {
  const n = el("header", "section-heading");
  n.append(el("h2", "", t), el("p", "", sub));
  return n;
}
function select(title, values, current, fn) {
  const wrap = el("label", "control");
  wrap.append(el("span", "", title));
  const s = el("select");
  s.setAttribute("aria-label", title);
  for (const [v, t] of values) {
    const o = el("option", "", t);
    o.value = v;
    s.append(o);
  }
  s.value = current;
  s.onchange = () => fn(s.value);
  wrap.append(s);
  return wrap;
}
function table(rows, cols, { onGene } = {}) {
  const w = el("div", "table-scroll"),
    t = el("table"),
    head = el("thead"),
    tr = el("tr");
  t.dataset.sortable = "true";
  for (const [key, name] of cols) {
    const th = el("th", "", name);
    th.dataset.sortType = rows.some((row) => typeof row[key] === "number")
      ? "number"
      : "text";
    tr.append(th);
  }
  head.append(tr);
  t.append(head);
  const body = el("tbody");
  for (const r of rows) {
    const row = el("tr");
    for (const [k, , format] of cols) {
      const cell = el(
        "td",
        typeof r[k] === "number"
          ? "numeric"
          : k === "gene"
            ? "gene-symbol-cell"
            : "",
        format ? format(r[k], r) : (r[k] ?? "Not estimable"),
      );
      cell.dataset.sortValue =
        r[k] == null || (typeof r[k] === "number" && !Number.isFinite(r[k]))
          ? ""
          : String(r[k]);
      if (k === "gene" && r[k] && onGene) {
        const link = el("a", "link external gene-context-link", r[k]);
        link.href = `#view=genes&gene=${encodeURIComponent(r[k])}`;
        link.setAttribute(
          "aria-label",
          `Inspect ${r[k]} gene evidence and public context`,
        );
        link.onclick = (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          event.preventF7Router = true;
          onGene(r[k]);
        };
        cell.replaceChildren(link);
      }
      row.append(cell);
    }
    body.append(row);
  }
  t.append(body);
  w.append(t);
  return w;
}
function status(s) {
  return el(
    "span",
    `status ${s === "robust" ? "stable" : s === "unsupported" ? "unsupported" : "mixed"}`,
    s === "robust" ? "directionally stable" : s || "Not classified",
  );
}
function scaleKey(limit, title) {
  const box = el("div", "scale-key");
  box.append(
    el("span", "", title),
    el("i", "gradient"),
    el("span", "", `−${limit}  ·  0  ·  +${limit}`),
  );
  return box;
}
export function createAtlas(data, provenance, loadGenes, branding = {}) {
  let shell;
  let pendingRSelection;
  let collectionsView;
  let comparisonOpen = false;
  let comparisonSection = "summary";
  let disposeMethods = () => {};
  const root = el("div", "atlas");
  const reloadFromLocation = () => location.reload();
  addEventListener("hashchange", reloadFromLocation);
  let genesPromise, geneRecords;
  const getGenes = () =>
    (genesPromise ??= trackActivity(
      loadGenes(),
      "Loading archived gene estimates",
    )
      .then((genes) => {
        geneRecords = createGeneRecords(genes, data.aliases);
        return genes;
      })
      .catch((error) => {
        genesPromise = undefined;
        throw error;
      }));
  const landscapeMap = new Map(data.landscape.map((g) => [g.gene, g]));
  const profileMap = new Map();
  for (const profile of data.profiles) {
    if (!profileMap.has(profile.gene)) profileMap.set(profile.gene, []);
    profileMap.get(profile.gene).push(profile);
  }
  const tabs = [
    ["overview", "Overview"],
    ["landscape", "OXPHOS landscape"],
    ["genes", "Gene explorer"],
    ["pathways", "Pathways"],
    ["mitocarta", "MitoCarta"],
    ["robustness", "Robustness"],
    ["dna", "DNA maintenance"],
    ["comparison", "Comparative views"],
    ["methods", "Methods & provenance"],
    ["custom-r", "Research workspace"],
  ];
  let tab = "overview",
    selected = "GPX4",
    pathway = "HALLMARK_OXIDATIVE_PHOSPHORYLATION",
    contrast = "day1_vs_control",
    group = "All functions",
    pathwayTier = "all",
    dnaGene = "ACD",
    dnaContrast = "day1_vs_control",
    dnaFilter = "All genes";
  const params = new URLSearchParams(location.hash.slice(1));
  if (tabs.some((x) => x[0] === params.get("view"))) tab = params.get("view");
  selected = params.get("gene") || selected;
  pathway = params.get("pathway") || pathway;
  if (contrasts[params.get("contrast")]) contrast = params.get("contrast");
  if (
    ["all", "primary", "secondary", "exploratory"].includes(params.get("tier"))
  )
    pathwayTier = params.get("tier");
  group = params.get("group") || group;
  if (tab === "dna") {
    dnaGene = params.get("gene") || dnaGene;
    if (contrasts[params.get("contrast")]) dnaContrast = params.get("contrast");
    dnaFilter = params.get("annotation") || dnaFilter;
  }
  const initialResearch = {};
  for (const key of ["gene", "pathway", "contrast", "view"])
    if (params.has(key)) initialResearch[key] = params.get(key);
  const researchStore = createResearchStore({ defaults: { gene: selected, pathway, contrast, view: tab }, initial: initialResearch });
  const recoveredResearch = researchStore.getState();
  selected = recoveredResearch.gene || selected;
  if (data.pathways.some(r => r.pathway === recoveredResearch.pathway)) pathway = recoveredResearch.pathway;
  if (contrasts[recoveredResearch.contrast]) contrast = recoveredResearch.contrast;
  if (tabs.some(([id]) => id === recoveredResearch.view)) tab = recoveredResearch.view;
  let savingSelection = false;
  const saveSelection = patch => {
    savingSelection = true;
    try { researchStore.update(patch); } finally { savingSelection = false; }
  };
  const treeState = {
    view: ["table", "network"].includes(params.get("display"))
      ? params.get("display")
      : "tree",
    query: params.get("search") || "",
    members: params.get("members") === "all" ? "all" : "leading",
    gene: tab === "pathways" ? params.get("gene") || "" : "",
    open: new Set(),
    closed: new Set(),
    limits: new Map(),
    networkMembers:
      params.get("overlap_members") === "leading" ? "leading" : "all",
    threshold: [0, 0.05, 0.1, 0.2].includes(+params.get("overlap_min"))
      ? +params.get("overlap_min")
      : 0,
    networkView: ["pairs", "matrix", "chord", "bundled", "upset"].includes(
      params.get("overlap_view"),
    )
      ? params.get("overlap_view")
      : "graph",
    edge: params.get("pair") || "",
    intersectionSets: (params.get("intersection_sets") || "")
      .split(",")
      .filter((id) => Object.hasOwn(data.membership, id))
      .slice(0, 6),
    chordSets: (params.get("chord_sets") || "")
      .split(",")
      .filter((id) => Object.hasOwn(data.membership, id))
      .slice(0, 6),
  };
  if (treeState.gene) treeState.open.add(pathway);
  if (treeState.edge) {
    const pair = overlapGraph(data, contrast, {
      members: treeState.networkMembers,
    }).pairs.find((p) => p.key === treeState.edge);
    if (pair) pathway = pair.source;
    else treeState.edge = "";
  }
  const comparisonParams = new URLSearchParams(location.hash.slice(1));
  const comparisonState = {
    mode: comparisonParams.get("plot") || "scatter",
    cohort: comparisonParams.get("cohort") || "oxphos",
    group: comparisonParams.get("function") || "all",
    contrast: contrasts[comparisonParams.get("contrast")]
      ? comparisonParams.get("contrast")
      : "day1_vs_control",
    range: ["1", "2", "5", "10", "all"].includes(comparisonParams.get("extent"))
      ? comparisonParams.get("extent")
      : "5",
    sort: "symbol",
    selection: new Set(
      (comparisonParams.get("selection") || "")
        .split(",")
        .filter((id) => /^ENSG[0-9]+(?:\.[0-9]+)?$/.test(id))
        .slice(0, 500),
    ),
    active: comparisonParams.get("gene") || "",
    brushing: false,
    volcanoInitialized: comparisonParams.has("cohort"),
    hexbinInitialized:
      comparisonParams.has("cohort") || comparisonParams.has("extent"),
    membershipView:
      comparisonParams.get("membership_view") === "parallel"
        ? "parallel"
        : "counts",
  };
  function syncLocation() {
    if (tab === "pathways" && treeState.gene) selected = treeState.gene;
    if (tab === "comparison" && comparisonState.active) selected = comparisonState.active;
    const q = new URLSearchParams({ view: tab });
    if (tab === "genes" || tab === "landscape") q.set("gene", selected);
    if (tab === "landscape" && group !== "All functions") q.set("group", group);
    if (tab === "pathways" || tab === "robustness") {
      q.set("pathway", pathway);
      q.set("contrast", contrast);
    }
    if (tab === "pathways") {
      q.set("display", treeState.view);
      if (pathwayTier !== "all") q.set("tier", pathwayTier);
      if (treeState.query) q.set("search", treeState.query);
      if (treeState.members === "all") q.set("members", "all");
      if (treeState.gene) q.set("gene", treeState.gene);
      if (treeState.view === "network") {
        q.set("overlap_members", treeState.networkMembers);
        if (treeState.threshold) q.set("overlap_min", treeState.threshold);
        if (treeState.networkView !== "graph")
          q.set("overlap_view", treeState.networkView);
        if (treeState.edge) q.set("pair", treeState.edge);
        if (
          treeState.networkView === "upset" &&
          treeState.intersectionSets?.length
        )
          q.set("intersection_sets", treeState.intersectionSets.join(","));
        if (treeState.networkView === "chord" && treeState.chordSets.length)
          q.set("chord_sets", treeState.chordSets.join(","));
      }
    }
    if (tab === "comparison") {
      q.set("plot", comparisonState.mode);
      q.set("cohort", comparisonState.cohort);
      q.set("contrast", comparisonState.contrast);
      q.set("extent", comparisonState.range);
      if (comparisonState.group !== "all")
        q.set("function", comparisonState.group);
      if (comparisonState.active) q.set("gene", comparisonState.active);
      if (
        comparisonState.selection.size &&
        comparisonState.selection.size <= 500
      )
        q.set("selection", [...comparisonState.selection].join(","));
      if (comparisonState.membershipView === "parallel")
        q.set("membership_view", "parallel");
    }
    if (tab === "dna") {
      q.set("gene", dnaGene);
      q.set("contrast", dnaContrast);
      if (dnaFilter !== "All genes") q.set("annotation", dnaFilter);
    }
    saveSelection({ gene: tab === "pathways" ? treeState.gene || selected : tab === "comparison" ? comparisonState.active || selected : selected,
      pathway, contrast: tab === "comparison" ? comparisonState.contrast : contrast, view: tab });
    history.replaceState(null, "", `#${q}`);
    return location.href;
  }
  function shareDetails() {
    const section = tabs.find(([id]) => id === tab)?.[1] || "Atlas",
      displayGene = body.querySelector(".gene-symbol")?.textContent || selected;
    let focus = "";
    if (tab === "genes" || tab === "landscape") focus = `Gene: ${displayGene}`;
    else if (tab === "pathways" || tab === "robustness")
      focus = `${label(pathway)} · ${contrasts[contrast]}${tab === "pathways" && treeState.gene ? ` · Gene: ${treeState.gene}` : ""}`;
    else if (tab === "dna")
      focus = `Gene: ${displayGene} · ${contrasts[dnaContrast]}${dnaFilter !== "All genes" ? ` · ${dnaFilter}` : ""}`;
    const title = `Psilocin transcriptomic atlas · ${section}${focus ? ` · ${focus}` : ""}`;
    return {
      title,
      text: `${title}. Germann reanalysis of Schmidt et al. (2026).`,
      url: syncLocation(),
    };
  }
  async function shareCurrent() {
    const payload = shareDetails();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
        console.warn(
          "Native share request failed; opening email instead",
          error,
        );
      }
    }
    location.href = `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(`${payload.text}\n\n${payload.url}`)}`;
  }
  const top = el("header", "masthead");
  const home = el("a", "wordmark", "Psilocin transcriptomic atlas");
  home.href =
    "https://psilocybin-research.github.io/psilocin-human-neuron-transcriptomics/";
  const meta = el("div", "masthead-meta");
  const identity = el("div", "academic-identity");
  const author = el("div", "author-line");
  const authorLink = el("a", "", "Christopher B. Germann");
  authorLink.href =
    "https://zenodo.org/search?q=metadata.creators.person_or_org.name:%22Germann,+Christopher+B.%22";
  authorLink.target = "_blank";
  authorLink.rel = "noopener";
  const orcid = el("a", "orcid");
  orcid.href = "https://orcid.org/0000-0002-1573-4651";
  orcid.target = "_blank";
  orcid.rel = "noopener";
  orcid.append(
    icon("orcid"),
    document.createTextNode("ORCID 0000-0002-1573-4651"),
  );
  author.append(authorLink, orcid);
  const affiliation = el(
    "div",
    "affiliation",
    "Faculty of Health, School of Medicine, University of Witten/Herdecke",
  );
  identity.append(author, affiliation);
  const citations = el("div", "header-citations");
  const sourceCitation = el("div", "header-citation");
  const sourceLabel = el("div", "citation-brand");
  const elifeLink = el("a", "elife-brand");
  elifeLink.href = "https://doi.org/10.7554/eLife.104006.3";
  elifeLink.target = "_blank";
  elifeLink.rel = "noopener";
  elifeLink.setAttribute("aria-label", "Read the source study in eLife");
  const elifeLogo = el("img", "elife-logo");
  elifeLogo.src = branding.elife;
  elifeLogo.alt = "eLife";
  elifeLogo.width = 80;
  elifeLink.append(elifeLogo);
  sourceLabel.append(elifeLink, el("span", "citation-label", "Source study"));
  sourceCitation.append(sourceLabel);
  const sourceStudy = el(
    "a",
    "citation-text",
    "Schmidt M, Hoffrichter A, Davoudi M, et al. (2026). Psilocin fosters neuroplasticity in iPSC-derived human cortical neurons. eLife 14:RP104006. doi:10.7554/eLife.104006.3",
  );
  sourceStudy.href = "https://doi.org/10.7554/eLife.104006.3";
  sourceStudy.target = "_blank";
  sourceStudy.rel = "noopener";
  sourceCitation.append(sourceStudy);
  const archiveCitation = el("div", "header-citation");
  const archiveLabel = el("div", "citation-brand");
  const zenodoLink = el("a", "zenodo-brand");
  zenodoLink.href = "https://doi.org/10.5281/zenodo.23283595";
  zenodoLink.target = "_blank";
  zenodoLink.rel = "noopener";
  zenodoLink.setAttribute("aria-label", "View the software archive on Zenodo");
  const zenodoLogo = el("img", "zenodo-icon");
  zenodoLogo.src = branding.zenodo;
  zenodoLogo.alt = "Zenodo";
  zenodoLogo.width = 30;
  zenodoLogo.height = 30;
  zenodoLink.append(zenodoLogo);
  archiveLabel.append(
    zenodoLink,
    el("span", "citation-label", "Archived release"),
  );
  archiveCitation.append(archiveLabel);
  const archive = el(
    "a",
    "citation-text",
    "Germann CB (2026). Metabolic and redox transcription after brief psilocin exposure in human iPSC-derived cortical neurons (Version 1.2.0) [Computer software]. Zenodo. doi:10.5281/zenodo.23283595",
  );
  archive.href = "https://doi.org/10.5281/zenodo.23283595";
  archive.target = "_blank";
  archive.rel = "noopener";
  archiveCitation.append(archive);

  const repository = el("a", "header-repository");
  repository.href =
    "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics";
  repository.target = "_blank";
  repository.rel = "noopener";
  repository.title = "Open the public GitHub repository";
  repository.setAttribute(
    "aria-label",
    "Open the reanalysis repository on GitHub",
  );
  repository.append(icon("github"));
  const sourceData = el("a", "header-source");
  const dryadLogo = el("img", "dryad-logo");
  dryadLogo.src = branding.dryad;
  dryadLogo.alt = "Dryad";
  sourceData.append(dryadLogo);
  sourceData.href = "https://doi.org/10.5061/dryad.xsj3tx9w3";
  sourceData.target = "_blank";
  sourceData.rel = "noopener";
  const dataCitation = el("div", "header-citation");
  const dataLabel = el("div", "citation-brand");
  dataLabel.append(
    sourceData,
    el("span", "citation-label", "Original source data"),
  );
  const dataLink = el(
    "a",
    "citation-text",
    "Schmidt et al. · Original source data on Dryad ↗",
  );
  dataLink.href = sourceData.href;
  dataLink.target = "_blank";
  dataLink.rel = "noopener";
  dataCitation.append(dataLabel, dataLink);
  citations.append(sourceCitation, dataCitation, archiveCitation);
  const repositoryRow = el("div", "header-citation repository-citation");
  const repositoryLabel = el("div", "citation-brand");
  repositoryLabel.append(
    repository,
    el("span", "citation-label", "Reanalysis repository"),
  );
  const repositoryDetails = el("div", "repository-details");
  const repositoryText = el("a", "citation-text");
  repositoryText.href = repository.href;
  repositoryText.target = "_blank";
  repositoryText.rel = "noopener";
  repositoryText.append(
    el(
      "span",
      "repository-full",
      "github.com/psilocybin-research/psilocin-human-neuron-transcriptomics",
    ),
    el("span", "repository-short", "GitHub repository"),
  );
  repositoryDetails.append(repositoryText, el("span", "release", "v1.2.0"));
  repositoryRow.append(repositoryLabel, repositoryDetails);
  citations.append(repositoryRow);
  const citationGuidance = el("section", "method-card citation-guidance");
  citationGuidance.append(
    el("h3", "", "Citing this resource"),
    el(
      "p",
      "",
      "Cite Schmidt et al. for the original experiment and Germann for this independent reanalysis. The version-specific Zenodo record identifies the archived analysis; the live atlas and GitHub repository may contain later interface updates.",
    ),
    el("h3", "", "Public gene and protein context"),
    el(
      "p",
      "",
      "Gene and protein information is provided by Ensembl and UniProt; structural coordinates originate from the Protein Data Bank or AlphaFold Protein Structure Database. Provider links, snapshot dates and mapping details accompany the records. These annotations are external context, not measurements from the psilocin experiment. A gene-to-protein mapping does not establish which isoform was expressed; predicted structures and confidence scores do not demonstrate protein activity.",
    ),
    el(
      "p",
      "",
      "The interface uses Framework7, Observable Framework and Observable Plot, D3 and 3Dmol.js. The optional OXPHOS membership view uses 3d-force-graph and Three.js, loaded on demand with original dependency notices. R code editing uses CodeMirror with its R language mode. Custom R analyses use webR 0.6.0 with its original distribution licences and source links. The workspace uses the unmodified R logo © 2016 The R Foundation under CC BY-SA 4.0, and the unmodified Python logo solely to identify the Python programming language; Python and the Python Logo are trademarks of the Python Software Foundation, and this project is not affiliated with the PSF. Optional local reports use Siglum 0.2.2, BusyTeX/pdfTeX, TeX Live 2026 and Latin Modern fonts; original compiler, package and font licences and corresponding-source links accompany the runtime and LaTeX archive. Component licences and molecular-data attribution are provided below and with the downloadable records. Consult Methods & provenance for the experimental design, statistical qualifications and input checksums.",
    ),
  );
  const mitochondrialCitation = el("p", "", "Mitochondrial context: Rath S, Sharma R, Gupta R, et al. MitoCarta3.0. Nucleic Acids Research. 2021;49(D1):D1541–D1547. CC BY-NC 4.0. Annotations and exploratory follow-up are distinct from the frozen primary evidence. ");
  const mitochondrialSource = el("a", "external", "Source and citation ↗");
  mitochondrialSource.href = "https://doi.org/10.1093/nar/gkaa1011"; mitochondrialSource.target = "_blank"; mitochondrialSource.rel = "noopener noreferrer";
  mitochondrialCitation.append(mitochondrialSource); citationGuidance.append(mitochondrialCitation);
  const softwareCredits = el("p", "");
  for (const [text, href] of [
    [
      "Software licences and attribution",
      "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/LICENSE.md",
    ],
    ["CodeMirror dependency notices", branding.editorNotices],
    ["Fuse.js approximate-search licence", branding.fuseNotices],
    [
      "3D network dependency notices",
      "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/third_party_licenses/network-3d.txt",
    ],
    [
      "PDF compiler licences",
      new URL("latex/LICENSE-COMPONENTS.txt", document.baseURI).href,
    ],
    [
      "PDF compiler corresponding sources",
      new URL("latex/SOURCE-ACCESS.json", document.baseURI).href,
    ],
    [
      "webR licences and corresponding sources",
      new URL("webr/PROVENANCE.json", document.baseURI).href,
    ],
  ]) {
    if (softwareCredits.childNodes.length)
      softwareCredits.append(document.createTextNode(" · "));
    const link = el("a", "", text);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    softwareCredits.append(link);
  }
  citationGuidance.append(softwareCredits);
  citations.append(citationGuidance);
  const share = iconButton("Share", "share", shareCurrent, "native-share");
  share.setAttribute("aria-label", "Share the current atlas analysis");
  share.title =
    typeof navigator.share === "function"
      ? "Share the current view"
      : "Share the current view by email";
  const citationDisclosure = el("details", "citation-disclosure");
  citationDisclosure.open = true;
  citationDisclosure.append(
    el("summary", "", "References & citation"),
    citations,
  );
  meta.append(identity, citationDisclosure);
  top.append(home, meta);
  const nav = el("nav");
  nav.id = "atlas-section-links";
  const menuToggle = button("", () => {});
  const body = el("div", "atlas-body");

  const footer = el("footer", "source-footer");
  footer.append(
    el(
      "span",
      "",
      "Source study · Schmidt M, Hoffrichter A, Davoudi M, Horschitz S, Lau T, Meinhardt MW, Spanagel R, Ladewig J, Köhr G, Koch P. (2026). Psilocin fosters neuroplasticity in iPSC-derived human cortical neurons. eLife, 14, RP104006. ",
    ),
  );
  const doi = el("a", "", "https://doi.org/10.7554/eLife.104006.3");
  doi.href = "https://doi.org/10.7554/eLife.104006.3";
  doi.target = "_blank";
  doi.rel = "noopener";
  footer.append(doi);
  const footerLinks = el("nav", "footer-links");
  footerLinks.setAttribute("aria-label", "Research resources");
  for (const [title, url] of [
    ["Source data · Dryad", "https://doi.org/10.5061/dryad.xsj3tx9w3"],
    [
      "Source analysis code",
      "https://github.com/ahoffrichter/Schmidt_et_al_2025/tree/c565709affafbea09406bd7b42fe494f08db6cce",
    ],
    [
      "Software Heritage archive",
      "https://archive.softwareheritage.org/swh:1:dir:c847a8a51074c59d651e3258cf1355936e921048/",
    ],
    [
      "Reanalysis · GitHub",
      "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics",
    ],
    ["Archived release · Zenodo", "https://doi.org/10.5281/zenodo.23283595"],
  ]) {
    const link = el("a", "", title);
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    footerLinks.append(link);
  }
  footer.append(footerLinks);
  const datasets = el("p", "dataset-directory");
  datasets.append(document.createTextNode("More open datasets: "));
  const datasetLink = el(
    "a",
    "",
    "https://psilocybin-research.com/open-datasets.php",
  );
  datasetLink.href = datasetLink.textContent;
  datasetLink.target = "_blank";
  datasetLink.rel = "noopener";
  datasetLink.style.overflowWrap = "anywhere";
  datasets.append(datasetLink);
  footer.append(datasets);
  footer.prepend(sourceLogos("footer"));
  root.append(top, body, footer);
  function go(next, gene) {
    if (next === tab && !gene) return;
    shell?.closeOverlays();
    const previous = location.href,
      changed = next !== tab;
    tab = next;
    if (gene) selected = gene;
    syncLocation();
    const target = location.href;
    if (changed) {
      history.replaceState(null, "", previous);
      history.pushState(null, "", target);
    }
    render();
  }

  for (const [id, t] of tabs) {
    const item = button("", () => go(id));
    item.append(uiIcon(id, "tab-icon"), el("span", "", t));
    nav.append(item);
  }
  async function openSystemsExplorer(initialMode="systems") {
    const panel=el("div","sheet-modal studio-systems-sheet"),inner=el("div","sheet-modal-inner");
    const close=button("Close molecular systems",()=>modal.close(),"secondary");inner.append(close,loadingMessage("Loading molecular systems…"));panel.append(inner);root.append(panel);
    let explorer;
    const modal=root.f7.sheet.create({el:panel,backdrop:true,closeOnEscape:true,on:{closed(){explorer?.destroy();panel.remove();setTimeout(()=>modal.destroy(),0);}}});modal.open();
    try{const [{createSystemsExplorer},{default:snapshot}]=await Promise.all([import("./systems-explorer.js"),import("../assets/vendor/oxphos-network-data.js")]);if(!panel.isConnected)return;
      explorer=createSystemsExplorer({data:snapshot,getGenes:()=>{const state=researchStore.getState();return state.collections.length?state.collections.flatMap(c=>c.genes):[state.gene].filter(Boolean);},onSelect:id=>researchStore.update({gene:id}),onStructure:gene=>{researchStore.update({gene});persistentInspector.toggle(true);},onSendToR:selection=>{modal.once("closed",()=>sendSelectionToR(selection));modal.close();},onNavigate:key=>{if(key==="mitochondria")explorer.setMode("systems");else showToast("Illustrative landmark; compartment-specific experimental data are unavailable.");}});
      inner.replaceChildren(close,explorer);if(initialMode!=="systems")explorer.setMode(initialMode);
    }catch(error){inner.append(note(error.message));}
  }
  function sendSelectionToR(selection = researchStore.getState()) {
    const current = body.querySelector(".custom-r-workspace");
    if (tab === "custom-r" && current?.setResearchSelection) current.setResearchSelection(selection);
    else {
      pendingRSelection = selection;
      go("custom-r");
    }
  }
  const sendMolecularGeneToR = event => {
    const gene = event.detail?.gene;
    if (gene) sendSelectionToR({ ...researchStore.getState(), gene });
  };
  root.addEventListener("atlas:send-gene-to-r", sendMolecularGeneToR);
  const openGeneInOxphosNetwork = event => {
    const gene = event.detail?.gene;
    if (!gene) return;
    researchStore.update({ gene });
    openMembershipNetwork();
  };
  root.addEventListener("atlas:open-oxphos-network", openGeneInOxphosNetwork);
  const sessionBar = el("section", "research-session-actions");
  sessionBar.setAttribute("aria-label", "Research selection history");
  const previousSelection = button("Undo selection", () => researchStore.undo(), "secondary");
  const nextSelection = button("Redo selection", () => researchStore.redo(), "secondary");
  const toR = button("Send selection to R", () => sendSelectionToR(), "secondary");
  const exportSession = button("Export research selections", () => download("research-selections.json", JSON.stringify({
    ...researchStore.exportSession(), source_sha256: provenance.outputs,
    scope: "Selection history and collections; R notebooks and run outputs export separately",
  }, null, 2), "application/json"), "secondary");
  const collectionHost = el("div", "research-collection-host");
  const collectionButton = button("Gene collections", () => openCollections(), "secondary");
  let collectionSheet;
  function showCollectionSurface(){
    if(!root.classList.contains('workspace-mode')||collectionSheet)return;
    const slot=document.createComment('collection tools'),sheet=el('div','sheet-modal studio-pane-sheet workspace-collections-sheet'),inner=el('div','sheet-modal-inner');collectionHost.before(slot);inner.append(el('h3','','Collections'),collectionHost,button('Done',()=>collectionSheet?.close()));sheet.append(inner);root.append(sheet);sessionBar.hidden=true;
    collectionSheet=root.f7.sheet.create({el:sheet,backdrop:true,closeOnEscape:true,on:{closed(){slot.replaceWith(collectionHost);sheet.remove();const instance=collectionSheet;collectionSheet=undefined;setTimeout(()=>instance?.destroy(),0);}}});collectionSheet.open();
  }
  async function openCollections(force=false) {
    if (collectionsView) { collectionHost.hidden = force?false:!collectionHost.hidden; sessionBar.hidden=collectionHost.hidden;if(!collectionHost.hidden)showCollectionSurface(); return; }
    sessionBar.hidden=false;
    collectionHost.replaceChildren(loadingMessage("Loading gene collection tools…"));
    try {
      const { createResearchCollections } = await import("./research-collections.js");
      collectionsView = createResearchCollections({ store: researchStore, getGenes, aliases: data.aliases,
        onSelectGene: id => go("genes", id),
        onSendToR: ids => sendSelectionToR({ ...researchStore.getState(), genes: ids }),
      });
      collectionHost.replaceChildren(collectionsView);
      document.querySelector("#psilocin-app")?.f7?.accordion.open(collectionsView.querySelector(".accordion-item"));
    } catch (error) { collectionHost.replaceChildren(note(error.message)); }
    showCollectionSurface();
  }
  const persistentInspector = createResearchInspector({root,store:researchStore,getGenes,data,
    onSendToR:()=>sendSelectionToR(),onAddToNotebook:()=>sendSelectionToR(),
    onOpenNetwork:()=>openMembershipNetwork(),onCompare:()=>go("comparison")});
  root.append(persistentInspector.element);
  sessionBar.hidden=true;
  sessionBar.append(collectionHost);
  let observedResearch = researchStore.getState();
  const unsubscribeResearch = researchStore.subscribe(state => {
    const previous = observedResearch;
    observedResearch = state;
    previousSelection.disabled = !researchStore.canUndo();
    nextSelection.disabled = !researchStore.canRedo();
    if (savingSelection || !["gene", "pathway", "contrast", "view"].some(key => state[key] !== previous[key])) return;
    selected = state.gene || selected;
    pathway = data.pathways.some(r => r.pathway === state.pathway) ? state.pathway : pathway;
    contrast = contrasts[state.contrast] ? state.contrast : contrast;
    tab = tabs.some(([id]) => id === state.view) ? state.view : tab;
    comparisonState.active = selected;
    comparisonState.contrast = contrast;
    if(tab === "custom-r" && previous.view === "custom-r") {
      body.querySelector(".studio-r-panel .custom-r-workspace")?.syncWorkspaceContext?.();
      for(const scene of body.querySelectorAll(".scientific-scene"))scene.setSelection?.(selected);
      return;
    }
    if (tab === "pathways" && state.gene !== previous.gene) treeState.gene = state.gene || "";
    render();
  });
  let renderGeneration = 0;
  function render() {
    const generation = ++renderGeneration;
    shell?.beforeRender();
    syncLocation();
    [...nav.querySelectorAll("[data-section]")].forEach((b) => {
      b.classList.toggle("active", b.dataset.section === tab);
      b.setAttribute(
        "aria-current",
        b.dataset.section === tab ? "page" : "false",
      );
    });
    shell?.update(tab);
    disposeMethods();
    body.querySelector(".mitochondrial-explorer")?.dispose?.();
    body.querySelector(".comparative-views")?.dispose?.();
    body.querySelector(".research-figure-builder")?.dispose?.();
    body.querySelector(".exploratory-result-chart")?.dispose?.();
    body.querySelector(".custom-r-workspace")?.destroy?.();
    // These root-level research actions outlive individual page renders.
    // Removing them here stranded contextual controls after the first navigation.
    body.replaceChildren();
    Promise.resolve(
      {
        overview,
        landscape,
        genesView,
        pathways,
        mitocarta,
        robustness,
        dna: dnaView,
        comparison: comparisonView,
        methods,
        "custom-r": customR,
      }[tab === "genes" ? "genesView" : tab](),
    ).catch(() => {
      if (generation === renderGeneration)
        body.replaceChildren(
          note(
            "This view could not be loaded. Check your connection and retry.",
          ),
          button("Retry view", render, "secondary"),
        );
    });
    body.append(sessionBar);
    previousSelection.disabled = !researchStore.canUndo();
    nextSelection.disabled = !researchStore.canRedo();
    enhancePlots(body);
    shell?.afterRender();
  }
  function comparisonView() {
    const host = el("div");
    body.append(host);
    host.append(loadingMessage("Loading comparative views…"));
    trackActivity(import("./comparative-views.js"), "Loading comparative views")
      .then(({ createComparativeViews }) => {
        if (!host.isConnected) return;
        host.replaceChildren(
          createComparativeViews({
            data,
            provenance,
            getGenes,
            state: comparisonState,
            onState: syncLocation,
            inspectGene: (container, gene) => {
              selected = gene;
              geneDetail(container, gene).then(() => {
                if (container.isConnected) enhancePlots(container);
              });
            },
            openHeatmap: (gene) => go("landscape", gene),
            openGeneExplorer: (gene) => go("genes", gene),
            openPathways: () => go("pathways"),
          }),
        );
      })
      .catch(() => {
        if (host.isConnected)
          host.replaceChildren(
            note(
              "Comparative views could not be loaded. Check your connection and reopen this section.",
            ),
          );
      });
  }
  function cameraNotice() {
    const card = el("aside", "method-card camera-qualification");
    card.append(
      el("h3", "", "Correlation-aware statistical support"),
      el(
        "p",
        "",
        "The matrix presents the prespecified fgsea analysis. Post hoc limma-voom CAMERA retained upward OXPHOS direction at both days but gave q=0.587 at each day with estimated inter-gene correlation; none of its 15 tests passed q<0.05. The documented fixed correlation 0.01 yielded both q=5.84e-8. These settings change both variance inflation and the parametric reference distribution (4 versus 21,096 reference df); residual model df remains four. Statistical support is therefore sensitive to the inferential framework, rather than method-independent.",
      ),
      el(
        "p",
        "",
        "Full-set Bayesian expression-shift magnitude also remains uncertain, especially at Day 3. Three differentiation blocks from two genetic backgrounds and unknown control harvest composition limit biological generalizability and treatment attribution at either day.",
      ),
    );
    for (const [t, u] of [
      [
        "Complete CAMERA results",
        "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/reports/camera_sensitivity_results.md",
      ],
      [
        "Download all 30 CAMERA tests",
        "https://raw.githubusercontent.com/psilocybin-research/psilocin-human-neuron-transcriptomics/main/tables/camera_sensitivity/all_tests.csv",
      ],
      [
        "Methods and runtime diagnostics",
        "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics/blob/main/reports/camera_sensitivity_methods.md",
      ],
    ]) {
      const a = el("a", "source-link", t + " ↗");
      a.href = u;
      a.target = "_blank";
      a.rel = "noopener";
      if (t.startsWith("Download"))
        a.onclick = (event) => {
          event.preventDefault();
          downloadRemoteFile(new URL(u).pathname.split("/").at(-1), u);
        };
      card.append(a);
    }
    body.append(card);
  }
  function sourceLogos(location) {
    const logos = el(
      "nav",
      `overview-source-logos ${location === "footer" ? "footer-source-logos" : ""}`,
    );
    logos.setAttribute(
      "aria-label",
      "Source study, data, archive and repository",
    );
    for (const [original, name] of [
      [elifeLink, "Source study on eLife"],
      [sourceData, "Original source data on Dryad"],
      [zenodoLink, "Software archive on Zenodo"],
      [repository, "Reanalysis repository on GitHub"],
    ]) {
      const link = original.cloneNode(true);
      link.className = "overview-source-link";
      link.setAttribute("aria-label", `${name} (opens in a new tab)`);
      link.title = name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      logos.append(link);
    }
    return logos;
  }
  let networkPanel, networkLoading, networkStorage, exploratoryOverlay;
  function openMembershipNetwork() {
    if (root.querySelector(".oxphos-network-fullscreen")) return;
    const previousFocus = document.activeElement;
    const storage = (networkStorage ||= el("div"));
    storage.hidden = true;
    root.append(storage);
    networkPanel ||= el("section", "oxphos-network-sheet-content");
    storage.append(networkPanel);
    const host = el("section", "oxphos-network-fullscreen");
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-label", "3D OXPHOS membership");
    const toolbar = el(
      "header",
      "evidence-sheet-header oxphos-network-closebar",
    );
    const close = button(
      "",
      () => document.exitFullscreen?.() || document.webkitExitFullscreen?.(),
      "button button-round shell-icon app-fullscreen-toggle",
    );
    close.setAttribute("aria-label", "Exit fullscreen");
    close.setAttribute("title", "Exit fullscreen");
    close.setAttribute("aria-pressed", "true");
    close.append(uiIcon("fullscreenExit"));
    toolbar.append(el("h2", "", "3D OXPHOS membership"), close);
    const content = el("div", "oxphos-network-fullscreen-content");
    content.append(networkPanel);
    host.append(toolbar, content);
    root.append(host);
    // Reframe reused networks only after their canvas has a visible size.
    networkPanel.querySelector(".oxphos-network-3d")?.setResearchSelection?.(researchStore.getState());
    let entered = false;
    function restore() {
      storage.append(networkPanel);
      host.remove();
      document.removeEventListener("fullscreenchange", changed);
      document.removeEventListener("webkitfullscreenchange", changed);
      previousFocus?.focus();
    }
    function changed() {
      if (
        (document.fullscreenElement || document.webkitFullscreenElement) ===
        host
      ) {
        entered = true;
        close.focus();
      } else if (entered) restore();
    }
    function fallback() {
      restore();
      showResearchEvidence(networkPanel, "3D OXPHOS membership");
    }
    const request = host.requestFullscreen || host.webkitRequestFullscreen;
    if (request) {
      document.addEventListener("fullscreenchange", changed);
      document.addEventListener("webkitfullscreenchange", changed);
      try {
        Promise.resolve(request.call(host)).catch(fallback);
      } catch {
        fallback();
      }
    } else fallback();
    if (!networkLoading) {
      networkPanel.replaceChildren(
        loadingMessage("Loading the interactive 3D membership view…"),
      );
      networkLoading = trackActivity(
        import("./oxphos-network-3d.js"),
        "Opening 3D OXPHOS membership",
      )
        .then(({ createOxphosNetwork }) => {
          networkPanel.replaceChildren(
            createOxphosNetwork({
              initialOverlay: exploratoryOverlay,
              initialGene: researchStore.getState().gene,
              initialContrast: researchStore.getState().contrast,
              onSelection: selection => {
                if (selection.gene) selected = selection.gene;
                if (selection.contrast) contrast = selection.contrast;
                saveSelection(selection);
              },
              onResearch: (id) => {
                const selection = { ...researchStore.getState(), gene: id };
                const exit = document.exitFullscreen || document.webkitExitFullscreen;
                if (document.fullscreenElement || document.webkitFullscreenElement)
                  Promise.resolve(exit.call(document)).finally(() => sendSelectionToR(selection));
                else sendSelectionToR(selection);
              },
              onEvidence: (id) => {
                const exit =
                  document.exitFullscreen || document.webkitExitFullscreen;
                if (
                  document.fullscreenElement ||
                  document.webkitFullscreenElement
                )
                  Promise.resolve(exit.call(document)).finally(() =>
                    go("genes", id),
                  );
                else go("genes", id);
              },
            }),
          );
        })
        .catch(() => {
          networkLoading = null;
          networkPanel.replaceChildren(
            note(
              "The 3D view could not load. Close it and retry while connected; archived plots remain available.",
            ),
          );
        });
    }
  }
  function overview() {
    body.append(sourceLogos("header"));
    const hero = el("section", "hero");
    const intro = el("div");
    intro.append(
      el("div", "eyebrow", "HUMAN CORTICAL NEURONS · BULK RNA SEQUENCING"),
      el(
        "h1",
        "",
        "A brief perturbation. A broad transcriptional signature.",
      ),
      el("p", "note", "Psilocin human-neuron transcriptomics"),
      el(
        "p",
        "standfirst",
        "Secondary analysis of RNA-sequencing data from human iPSC-derived cortical neurons sampled one and three days after a 10-minute psilocin exposure and washout. The atlas presents gene-level estimates, pathway enrichment and sensitivity analyses against the available common controls.",
      ),
      button(
        "View OXPHOS gene-level results",
        () => go("landscape"),
        "primary",
      ),
      button(
        "Compare gene-set overlap",
        () => {
          pathwayTier = "all";
          treeState.view = "network";
          treeState.networkView = "chord";
          treeState.scrollToPlot = true;
          go("pathways");
        },
        "secondary overview-chord-link",
      ),
    );
    const metrics = el("div", "metrics");
    for (const [v, t] of [
      ["3", "differentiation blocks · two genetic backgrounds"],
      ["9", "aggregated block-by-condition profiles"],
      ["113", "genes in the OXPHOS leading-edge union"],
    ]) {
      const m = el("div");
      m.append(el("strong", "", v), el("span", "", t));
      metrics.append(m);
    }
    const networkPreview = button(
      "",
      openMembershipNetwork,
      "oxphos-network-preview",
    );
    networkPreview.setAttribute(
      "aria-label",
      "Explore 3D gene–pathway membership",
    );
    const networkImage = el("img");
    networkImage.src = new URL(
      "oxphos-network-preview.webp",
      document.baseURI,
    ).href;
    networkImage.srcset = networkPreviewSrcset(document.baseURI);
    networkImage.sizes = networkPreviewSizes;
    networkImage.fetchPriority = "high";
    networkImage.loading = "eager";
    networkImage.width = 982;
    networkImage.height = 714;
    networkImage.decoding = "async";
    networkImage.alt =
      "Day 1 preview of the archived OXPHOS gene–pathway membership network";
    networkPreview.title = "Explore OXPHOS network in 3D";
    const previewOverlay = el(
      "span",
      "oxphos-network-preview-overlay",
      "Explore OXPHOS network in 3D",
    );
    const previewFullscreen = el("span", "oxphos-network-preview-fullscreen");
    previewFullscreen.setAttribute("aria-hidden", "true");
    previewFullscreen.append(uiIcon("fullscreen"));
    networkPreview.append(networkImage, previewOverlay, previewFullscreen);
    // Use F7's native ripple locally without enabling it across scientific plots.
    let previewRipple;
    networkPreview.onpointerdown = event => {
      const app = document.querySelector("#psilocin-app")?.f7;
      if (!app?.touchRipple || !app.$el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      previewRipple?.destroy();
      previewRipple = app.touchRipple.create(app, app.$el.find(".oxphos-network-preview"), event.clientX, event.clientY);
    };
    networkPreview.onpointerup = networkPreview.onpointercancel = networkPreview.onpointerleave = () => {
      const ripple = previewRipple;
      previewRipple = undefined;
      ripple?.out();
    };
    intro.append(networkPreview);
    const heroAside = el("div", "oxphos-hero-aside");
    heroAside.append(metrics);
    hero.append(intro, heroAside);
    body.append(hero);
    const timeline = el("div", "timeline");
    for (const [a, b] of [
      ["10 min", "10 µM psilocin"],
      ["Washout", "Exposure ends"],
      ["Day 1 & Day 3", "Later RNA sampling"],
    ]) {
      const n = el("div");
      n.append(el("strong", "", a), el("span", "", b));
      timeline.append(n);
    }
    body.append(timeline);
    const source = el("section", "source-study");
    source.append(
      el("h2", "", "Source study"),
      el(
        "p",
        "",
        "Independent secondary analysis of Schmidt M, Hoffrichter A, Davoudi M, Horschitz S, Lau T, Meinhardt MW, Spanagel R, Ladewig J, Köhr G, Koch P. (2026). Psilocin fosters neuroplasticity in iPSC-derived human cortical neurons. eLife, 14, RP104006.",
      ),
    );
    const article = el("a", "source-link", "Read the article ↗");
    article.href = "https://doi.org/10.7554/eLife.104006.3";
    article.target = "_blank";
    article.rel = "noopener";
    source.append(article);
    body.append(source);
    body.append(
      heading(
        "Primary metabolic and redox pathway results",
        "Five prespecified Hallmark sets × three contrasts. Compare archived NES and primary-family q-values in the matrix or dot plot.",
      ),
    );
    const p = data.pathways.filter((p) => p.tier === "primary");
    const mat = el("div", "pathway-matrix");
    mat.append(el("div"));
    for (const c of data.contrasts)
      mat.append(el("div", "matrix-head", contrasts[c]));
    for (const id of Object.keys(names)) {
      mat.append(el("div", "matrix-row", label(id)));
      for (const c of data.contrasts) {
        const p1 = p.find((r) => r.pathway === id && r.contrast === c);
        const cell = button(
          "",
          () => {
            pathway = id;
            contrast = c;
            pathwayTier = "primary";
            go("pathways");
          },
          "matrix-cell",
        );
        cell.style.background = color(p1.NES, 3.6);
        cell.append(
          el("strong", "", fmt(p1.NES)),
          el("small", "", `15-test q = ${sci(p1.family_fdr)}`),
          status(p1.robustness),
        );
        cell.setAttribute(
          "aria-label",
          `${label(id)}, ${contrasts[c]}, NES ${fmt(p1.NES)}, ${p1.robustness}`,
        );
        mat.append(cell);
      }
    }
    const scroll = el("div", "matrix-scroll");
    scroll.dataset.fullscreenTitle = "Complete primary pathway matrix";
    scroll.dataset.fullscreenInfo =
      "Five prespecified Hallmark pathways across three contrasts. Color encodes NES; each cell reports the 15-test family q-value and frozen directional classification.";
    scroll.append(mat);
    body.append(
      el(
        "p",
        "mobile-hint",
        "Swipe the matrix horizontally to inspect all three contrasts.",
      ),
      scroll,
      scaleKey(3.6, "NES"),
      note(
        "“Directionally stable” displays the unchanged frozen “robust” class: same direction across the frozen block and RNA-quality checks, with primary q < 0.05. These q-values quantify competitive enrichment in the ranked transcriptome; they are not biological-replication p-values across the three differentiation blocks.",
      ),
      downloadButton(p, "primary-15-tests.csv"),
    );
    const dotplot = createNESDotPlot(data, (id, c) => {
      pathway = id;
      contrast = c;
      pathwayTier = "primary";
      go("pathways");
    });
    const synopsisTabs = el("div", "segmented synopsis-tabs");
    synopsisTabs.setAttribute("role", "group");
    synopsisTabs.setAttribute("aria-label", "Primary pathway synopsis display");
    const matrixPanel = el("section", "synopsis-matrix-panel"),
      matrixHint = scroll.previousElementSibling,
      matrixScale = scroll.nextElementSibling;
    scroll.before(matrixPanel);
    matrixPanel.append(matrixHint, scroll, matrixScale);
    let dotShell;
    const switchSynopsis = (showDots) => {
      matrixPanel.hidden = showDots;
      dotplot.hidden = !showDots;
      matrixTab.setAttribute("aria-pressed", String(!showDots));
      dotTab.setAttribute("aria-pressed", String(showDots));
      matrixTab.classList.toggle("button-active", !showDots);
      dotTab.classList.toggle("button-active", showDots);
    };
    const matrixTab = button("Matrix", () => switchSynopsis(false), "button"),
      dotTab = button(
        "NES dot plot",
        () => {
          if (!dotShell) {
            dotplot.hidden = false;
            enhancePlots(dotplot);
            dotShell = dotplot.querySelector(".figure-shell");
          }
          switchSynopsis(true);
        },
        "button",
      );
    matrixTab.setAttribute("aria-pressed", "true");
    dotTab.setAttribute("aria-pressed", "false");
    matrixTab.classList.add("button-active");
    synopsisTabs.append(matrixTab, dotTab);
    matrixPanel.before(synopsisTabs);
    dotplot.hidden = true;
    matrixPanel.after(dotplot);
    const synopsisLinks = el("div", "tree-actions synopsis-links");
    synopsisLinks.append(
      button(
        "Gene-effect distributions",
        () => {
          comparisonState.mode = "ridgeline";
          go("comparison");
        },
        "secondary",
      ),
      button(
        "Transcriptome-wide density",
        () => {
          comparisonState.mode = "hexbin";
          go("comparison");
        },
        "secondary",
      ),
      button(
        "Exact pathway intersections",
        () => {
          pathwayTier = "all";
          treeState.view = "network";
          treeState.networkView = "upset";
          treeState.scrollToPlot = true;
          go("pathways");
        },
        "secondary",
      ),
    );
    body.append(synopsisLinks);
    cameraNotice();
    body.append(
      heading(
        "OXPHOS and targeted redox results",
        "OXPHOS enrichment involved 95 and 107 leading-edge genes at Day 1 and Day 3, respectively, with 89 shared. Direction was consistent across the prespecified block and RNA-quality checks. The separate post-primary targeted analysis did not support a coordinated NRF2–glutathione–pentose-phosphate response.",
      ),
    );
    body.append(
      table(data.targeted, [
        ["module", "Target", (v) => label(v)],
        ["contrast", "Contrast", (v) => contrasts[v]],
        ["method", "Statistic type"],
        ["estimate", "Estimate", (v) => fmt(v)],
        ["family_fdr", "8-test q", sci],
        [
          "robustness",
          "Classification",
          (v) => (v === "robust" ? "directionally stable" : v),
        ],
      ]),
    );
    body.append(
      heading(
        "Exploratory DNA-maintenance evidence",
        "The frozen exploratory family identified positive DNA-repair and telomere-maintenance enrichment at both sampled days. In a separately corrected post hoc decomposition, DNA repair remained supported after telomere-set genes were removed; telomere maintenance after removal of DNA-repair genes met the follow-up threshold only at Day 1. DNA-replication enrichment and mixed cell-cycle controls leave specificity unresolved. These results nominate a genome-maintenance-associated transcriptional dimension for functional study; they do not demonstrate DNA-repair activity, telomere maintenance or proliferation.",
      ),
    );
    body.append(
      button(
        "View exploratory DNA-maintenance results",
        () => go("dna"),
        "secondary",
      ),
    );
    body.append(
      heading(
        "Study design and interpretation",
        "Three differentiation blocks across two genetic backgrounds limit the precision and generalizability of effect magnitudes. Stable enrichment direction does not imply a precisely estimated expression shift, particularly at Day 3. Methods & provenance describes the common-control design and analysis scope.",
      ),
    );
    const boundary = el("aside", "boundary");
    boundary.append(
      el("strong", "", "Interpretation boundary"),
      el(
        "p",
        "",
        "Three differentiation blocks, two genetic backgrounds. Source materials describe vehicle controls at matching time points, but public RNA-seq metadata do not link individual control libraries to harvest day. This reanalysis uses the available common control pool; unknown control harvest composition limits treatment attribution at either day, and a treatment × time interaction cannot be estimated.",
      ),
    );
    body.append(
      boundary,
      button("View methods and provenance", () => go("methods"), "secondary"),
    );
  }
  function mitocarta() {
    body.append(
      heading("MitoCarta · Mitochondrial pathways", "Curated gene context and exploratory transcriptional enrichment."),
      el("p", "callout", "Exploratory follow-up to the original OXPHOS finding. These analyses use the same study observations; they are not independent validation and do not replace the primary results or CAMERA sensitivity analyses."),
    );
    const interpretation = createAccordion("What the follow-up shows", "mitocarta-interpretation");
    interpretation.body.append(
      el("p", "", "Complete curated gene sets show positive enrichment of complex I, III and V structural subunits at both days. Complex IV subunits meet the joint corrected threshold at Day 3 only; this difference in significance does not establish a temporal change. Complex II has four structural genes and was not tested under the predefined ten-gene minimum."),
      el("p", "", "Mitochondrial translation, ribosomal genes, protein import and OXPHOS assembly factors also show positive enrichment at both days. Complex V illustrates why absence from the selected 113-gene display cannot establish absence of a broader transcriptional pattern."),
      el("p", "note", "Of 149 pathways per contrast, 76 meet the size rules. Joint BH correction covers 152 tests: 38 pathways meet q < 0.05 at Day 1 and 40 at Day 3, with 33 shared. Sets overlap substantially. The mitochondrial ROS/glutathione set differs from the earlier targeted redox panels and does not overturn their conclusions. Mitochondrial DNA maintenance meets the threshold at Day 1 only."),
      el("p", "note", "These are RNA-level associations, not measurements of ATP production, protein abundance or respiratory function. Three differentiation blocks, shared controls and unresolved control timing remain limitations. Existing estimated-correlation CAMERA did not support OXPHOS at its corrected threshold; this follow-up does not resolve that sensitivity."),
    );
    body.append(interpretation.element, createMitochondrialExplorer({ getGenes, onGene: (gene) => go("genes", gene.id), standalone: true }));
  }
  function landscape() {
    body.append(
      heading(
        "OXPHOS landscape",
        "All 113 leading-edge genes, grouped descriptively by function. Select a row to inspect its exact effects and nine expression profiles.",
      ),
    );
    const controls = el("div", "controls");
    controls.append(
      select(
        "Functional group",
        [
          ["All functions", "All functions"],
          ...[...new Set(data.landscape.map((g) => g.functional_group))].map(
            (v) => [v, v],
          ),
        ],
        group,
        (v) => {
          group = v;
          syncLocation();
          landscapeRender();
        },
      ),
      scaleKey(2.5, "Expression · row z"),
      scaleKey(1.5, "Effect · log₂ fold change"),
    );
    body.append(button("MitoCarta · complete mitochondrial context and exploratory follow-up", () => go("mitocarta"), "secondary"));
    body.append(controls);
    const split = el("div", "landscape-layout"),
      heat = el("div", "heatmap-scroll"),
      detail = el("aside", "gene-detail");
    split.dataset.fullscreenHost = "true";
    split.dataset.fullscreenTitle = "OXPHOS landscape";
    split.dataset.fullscreenInfo =
      "Select a gene row to retain its exact effects and nine-profile detail alongside the heatmap.";
    split.append(heat, detail);
    body.append(split);
    function landscapeRender() {
      heat.replaceChildren();
      const rows = data.landscape.filter(
        (g) => group === "All functions" || g.functional_group === group,
      );
      const s = svg(
        680,
        60 +
          rows.length * 15 +
          new Set(rows.map((g) => g.functional_group)).size * 22,
        "Interactive OXPHOS expression and effect heatmap",
      );
      s.classList.add("heatmap");
      const profileX = 125,
        cell = 32,
        fx = 448;
      ["68_3 / B1", "68_3 / B2", "69_2 / B1"].forEach((t, i) =>
        text(s, profileX + i * 100 + 46, 14, t, {
          "text-anchor": "middle",
          "font-weight": 600,
        }),
      );
      for (let i = 0; i < 9; i++)
        text(
          s,
          profileX + i * cell + Math.floor(i / 3) * 4 + 15,
          35,
          ["Ctrl", "D1", "D3"][i % 3],
          { "text-anchor": "middle" },
        );
      ["D1/C", "D3/C", "D3/D1"].forEach((t, i) =>
        text(s, fx + i * 45 + 20, 35, t, { "text-anchor": "middle" }),
      );
      text(s, 594, 35, "LE");
      let groupOffset = 0;
      rows.forEach((g, i) => {
        if (i === 0 || g.functional_group !== rows[i - 1].functional_group) {
          text(s, 8, 59 + i * 15 + groupOffset, g.functional_group, {
            "font-size": 10,
            "font-weight": 600,
          });
          groupOffset += 22;
        }
        const y = 46 + i * 15 + groupOffset;
        const r = svgNode("g", {
          tabindex: 0,
          role: "button",
          "aria-label": `Inspect ${g.gene}, ${g.functional_group}`,
        });
        r.classList.add("gene-row");
        r.append(
          svgNode("rect", {
            x: 0,
            y,
            width: 670,
            height: 15,
            fill: g.gene === selected ? "#edf3f1" : "transparent",
          }),
        );
        r.append(
          svgNode("text", { x: 114, y: y + 11, "text-anchor": "end" }, g.gene),
        );
        profileMap.get(g.gene).forEach((p, j) => {
          const c = svgNode("rect", {
            x: profileX + j * cell + Math.floor(j / 3) * 4,
            y,
            width: cell - 0.4,
            height: 14.5,
            fill: color(p.row_z),
          });
          c.append(
            svgNode(
              "title",
              {},
              `${g.gene} · ${p.block} · ${p.condition}\nVST ${fmt(p.vst, 4)} · row z ${fmt(p.row_z, 4)}\nMean RIN ${fmt(p.RIN_mean)} · ${p.libraries_n} source libraries`,
            ),
          );
          r.append(c);
        });
        [g.day1_log2fc, g.day3_log2fc, g.day3_minus_day1_log2fc].forEach(
          (v, j) => {
            const c = svgNode("rect", {
              x: fx + j * 45,
              y,
              width: 44.5,
              height: 14.5,
              fill: color(v, 1.5),
            });
            c.append(
              svgNode(
                "title",
                {},
                `${g.gene} · ${contrasts[data.contrasts[j]]}\nlog₂ fold change ${fmt(v, 5)}`,
              ),
            );
            r.append(c);
          },
        );
        r.append(
          svgNode("rect", {
            x: 594,
            y,
            width: 12,
            height: 14,
            fill: leadingEdgeColors[g.leading_edge],
          }),
        );
        const choose = () => {
          selected = g.gene;
          syncLocation();
          if (detail.dataset.gene !== selected) geneDetail(detail, selected);
          if (matchMedia("(max-width: 850px)").matches)
            showResearchEvidence(detail, "Gene evidence");
          heat
            .querySelectorAll(".gene-row > rect:first-child")
            .forEach((x) => x.setAttribute("fill", "transparent"));
          r.firstChild.setAttribute("fill", "#edf3f1");
        };
        r.onclick = choose;
        r.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose();
          }
        };
        s.append(r);
      });
      heat.append(s);
      geneDetail(detail, selected);
    }
    landscapeRender();
    body.append(
      note(
        "LE: neutral grey = shared; blue = Day 1 only; orange = Day 3 only. Shared-category luminance follows the display appearance. VST uses blind=FALSE. Row z-scores are scaled across all nine profiles and colors saturate at ±2.5; effect colors saturate at ±1.5. Functional filtering does not recalculate scaling or fit a model. Leading-edge selection makes this a descriptive view.",
      ),
      downloadButton(data.profiles, "oxphos-nine-profile-expression.csv"),
      button(
        "Download heatmap SVG",
        () =>
          download(
            "oxphos-landscape.svg",
            new XMLSerializer().serializeToString(heat.querySelector("svg")),
            "image/svg+xml",
          ),
        "secondary",
      ),
    );
  }
  async function geneDetail(container, symbol) {
    container.replaceChildren(
      el("div", "eyebrow", "GENE DETAIL"),
      el("h3", "gene-symbol", symbol),
      loadingMessage("Loading archived estimates…"),
    );
    const token = symbol;
    container.dataset.gene = token;
    let genes;
    try {
      genes = await getGenes();
    } catch {
      if (container.dataset.gene === token && container.isConnected)
        container.replaceChildren(
          note("Archived estimates could not be loaded."),
          button(
            "Retry gene",
            () => geneDetail(container, symbol),
            "secondary",
          ),
        );
      return;
    }
    if (container.dataset.gene !== token || !container.isConnected) return;
    const gene = geneRecords.resolve(symbol);
    const alias = gene ? geneRecords.aliasFor(gene) : undefined;
    container.replaceChildren(
      el("div", "eyebrow", "GENE DETAIL"),
      el("h3", "gene-symbol", gene?.symbol || symbol),
    );
    if (!gene) {
      container.append(
        note(
          "This identifier is absent from the filtered gene results. Absence is not a null result.",
        ),
      );
      return;
    }
    container.append(el("p", "identifier", gene.id));
    const information = geneAnnotation(gene);
    const preview = createGenePreview(gene, (model) =>
      information.open("structures", model),
    );
    if (preview) {
      const identity = el("div", "gene-detail-identity");
      const text = el("div");
      text.append(
        container.querySelector(".gene-symbol"),
        container.querySelector(".identifier"),
      );
      identity.append(preview, text);
      container.append(identity);
    }
    appendMitochondrialCard(container, gene);
    const info = landscapeMap.get(gene.symbol);
    const contextShortcut = iconButton(
      "Gene & protein info",
      "information",
      () => information.open("gene"),
      "button button-tonal labelled-icon-action gene-context-shortcut",
    );
    contextShortcut.setAttribute(
      "aria-label",
      "View public gene and protein context",
    );
    const sendToR = iconButton(
      "Send to R",
      "custom-r",
      () => container.dispatchEvent(new CustomEvent("atlas:send-gene-to-r", {
        bubbles: true,
        detail: { gene: gene.id },
      })),
      "button button-tonal labelled-icon-action gene-send-r-shortcut",
    );
    sendToR.setAttribute("aria-label", `Send ${gene.symbol} to R Studio`);
    sendToR.title = "Send this exact archived gene to R Studio";
    const contextActions = el("div", "gene-context-actions");
    contextActions.append(sendToR);
    if (info) {
      const openNetwork = iconButton(
        "View in 3D",
        "landscape",
        () => container.dispatchEvent(new CustomEvent("atlas:open-oxphos-network", {
          bubbles: true,
          detail: { gene: gene.id },
        })),
        "button button-tonal labelled-icon-action gene-network-shortcut",
      );
      openNetwork.setAttribute("aria-label", `View ${gene.symbol} in the 3D OXPHOS network`);
      openNetwork.title = "View this gene in the 3D OXPHOS network";
      contextActions.append(openNetwork);
    }
    contextActions.append(contextShortcut);
    container.append(contextActions);
    container.dataset.sendGeneToR = gene.id;
    if (info) container.dataset.openOxphosNetwork = "true";
    else delete container.dataset.openOxphosNetwork;
    if (info)
      container.append(
        el("p", "", info.functional_group),
        status(info.leading_edge),
      );
    if (alias)
      container.append(
        note(
          `Alias sensitivity: ${alias.source_symbol || "absent"} → ${alias.current_symbol}; ${alias.status}. These primary estimates retain source symbols.`,
        ),
      );
    if (!gene.selected)
      container.append(
        note(
          "This gene ID was not the representative selected for symbol-based ranking. Estimates below remain gene-level results.",
        ),
      );
    const effects = gene.effects.map((e, i) => ({
      ...e,
      contrast: contrasts[data.contrasts[i]],
    }));
    const validEffects = effects.filter(
      (e) => Number.isFinite(e.log2FoldChange) && Number.isFinite(e.lfcSE),
    );
    const limit = Math.max(
      0.5,
      ...validEffects.map((e) => Math.abs(e.log2FoldChange) + 1.96 * e.lfcSE),
    );
    const { inlineLabels, ...intervalLayout } = rowPlotLayout(
      effects.map((e) => e.contrast),
      { width: 480 },
    );
    const s = scientificPlot({
      title: `${gene.symbol} model estimates and approximate 95% Wald intervals`,
      ...intervalLayout,
      x: {
        domain: [-limit, limit],
        grid: true,
        label: inlineLabels
          ? "log₂ fold change · 95% interval"
          : "log₂ fold change · approximate 95% Wald interval",
      },
      y: {
        domain: effects.map((e) => e.contrast),
        label: null,
        axis: inlineLabels ? null : "left",
      },
      marks: [
        ...(inlineLabels
          ? [
              Plot.text(effects, {
                x: -limit,
                y: "contrast",
                text: "contrast",
                textAnchor: "start",
                dy: -15,
              }),
            ]
          : []),
        Plot.ruleX([0], { stroke: "#879998", strokeDasharray: "3 3" }),
        Plot.ruleY(validEffects, {
          x1: (e) => e.log2FoldChange - 1.96 * e.lfcSE,
          x2: (e) => e.log2FoldChange + 1.96 * e.lfcSE,
          y: "contrast",
          stroke: "#235780",
          strokeWidth: 2,
        }),
        Plot.dot(validEffects, {
          x: "log2FoldChange",
          y: "contrast",
          r: 4,
          fill: "#235780",
          title: (e) =>
            `${e.contrast}: ${fmt(e.log2FoldChange, 4)} · SE ${fmt(e.lfcSE, 4)} · gene FDR ${sci(e.padj)}`,
        }),
        Plot.text(
          effects.filter((e) => !validEffects.includes(e)),
          { x: 0, y: "contrast", text: () => "Not estimable", fontSize: 10 },
        ),
      ],
    });
    container.append(s);
    container.append(
      table(effects, [
        ["contrast", "Contrast"],
        ["log2FoldChange", "log₂FC", (v) => fmt(v, 3)],
        ["lfcSE", "SE", (v) => fmt(v, 3)],
        ["padj", "Gene FDR", sci],
      ]),
    );
    const profiles = profileMap.get(gene.symbol);
    if (profiles) {
      const blockLabels = [...new Set(profiles.map((p) => p.block))];
      const ps = scientificPlot({
        title: `${gene.symbol} variance-stabilized expression across nine pooled profiles`,
        width: plotWidth(420),
        height: 280,
        x: { domain: ["Control", "Day 1", "Day 3"], label: null },
        y: { grid: true, label: "VST expression", zero: false },
        color: {
          domain: blockLabels,
          range: ["#0072b2", "#69a2b8", "#d55e00"],
        },
        marks: [
          Plot.dot(profiles, {
            x: "condition",
            y: "vst",
            fill: "block",
            r: 4,
            title: (p) =>
              `${p.block}, ${p.condition}: VST ${fmt(p.vst, 4)}; RIN ${fmt(p.RIN_mean)}; ${p.libraries_n} libraries`,
          }),
        ],
      });
      container.append(
        el("h4", "", "Nine pooled profiles"),
        ps,
        note(
          `Each point is one aggregated block × condition profile, not an individual cell or a longitudinal measurement. Colours identify blocks: dark blue ${blockLabels[0]}; light blue ${blockLabels[1]}; orange ${blockLabels[2]}. Control-harvest days are unresolved.`,
        ),
      );
    } else
      container.append(
        note(
          "Nine-profile expression is included for the 113 OXPHOS leading-edge genes. This gene has archived model estimates only in this companion.",
        ),
      );
    const memberships = Object.entries(data.membership)
      .filter(([, gs]) => gs.includes(gene.symbol))
      .map(([id]) => label(id));
    container.append(
      el("h4", "", "Frozen pathway memberships"),
      el(
        "p",
        "",
        memberships.join(" · ") ||
          "No literal-symbol membership in the frozen sets.",
      ),
    );
    container.append(
      note(
        "Intervals use the archived unshrunken coefficient ±1.96 × SE. Gene FDR is distinct from pathway-family q. Three blocks limit generalization.",
      ),
      downloadButton(effects, `${gene.symbol}-model-estimates.csv`),
    );
    enhancePlots(container);
  }
  async function genesView() {
    body.append(
      heading(
        "Gene explorer",
        "Inspect archived gene-level estimates across all three contrasts. Search by source symbol, Ensembl identifier or verified ATP5 alias.",
      ),
    );
    const panel = el("section", "gene-picker");
    panel.setAttribute("aria-label", "Gene selection");
    const searchLabel = el("label", "gene-search-label", "Find a gene");
    searchLabel.htmlFor = "gene-search-input";
    const field = el("div", "gene-search-field"),
      search = el("input");
    search.id = "gene-search-input";
    search.type = "search";
    search.placeholder = "Symbol, Ensembl ID or verified alias";
    search.autocomplete = "off";
    search.spellcheck = false;
    search.value = selected;
    search.setAttribute("aria-label", "Search genes");
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-controls", "gene-search-results");
    search.setAttribute("aria-expanded", "true");
    search.setAttribute(
      "aria-describedby",
      "gene-search-help gene-search-count",
    );
    const clear = button(
      "Clear",
      () => {
        search.value = "";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        search.focus();
      },
      "gene-search-clear",
    );
    clear.setAttribute("aria-label", "Clear gene search");
    field.append(search, clear);
    const help = el(
      "p",
      "gene-search-help",
      "21,154 gene IDs · 21,098 rank representatives. Exact matches appear first. Use ↑ ↓ and Enter to select.",
    );
    help.id = "gene-search-help";
    const controls = el("div", "gene-picker-controls");
    let scope = "all",
      limit = 60,
      active = -1,
      found = [],
      options = [];
    const scopeControl = select(
      "Search scope",
      [
        ["all", "All filtered genes"],
        ["ranked", "Rank representatives"],
        ["oxphos", "OXPHOS leading-edge genes"],
      ],
      scope,
      (v) => {
        scope = v;
        search.dispatchEvent(new Event("input", { bubbles: true }));
      },
    );
    const selection = el("div", "gene-current");
    selection.setAttribute("aria-live", "polite");
    const summary = el("p", "gene-search-count");
    summary.id = "gene-search-count";
    summary.setAttribute("role", "status");
    const layout = el("div", "gene-layout gene-explorer-layout"),
      sidebar = el("section", "gene-selector-results"),
      results = el("div", "gene-results"),
      detail = el("article", "gene-detail");
    detail.id = "selected-gene-evidence";
    detail.tabIndex = -1;
    results.id = "gene-search-results";
    results.setAttribute("role", "listbox");
    results.setAttribute("aria-label", "Matching genes");
    const more = button(
      "Show more genes",
      () => {
        limit += 60;
        drawResults();
      },
      "secondary gene-show-more",
    );
    controls.append(scopeControl, selection);
    panel.append(searchLabel, field, help, controls);
    body.append(panel, layout);
    sidebar.append(summary, results, more);
    layout.append(sidebar, detail);
    // The page-level finder mirrors the F7 autocomplete used in the global search.
    // Keep the raw result list only as a no-JavaScript/F7 fallback.
    search.addEventListener("atlas:gene-autocomplete-ready", () => {
      sidebar.hidden = true;
    });
    geneDetail(detail, selected);
    const genes = await getGenes();
    if (!search.isConnected) return;
    const aliases = new Map();
    for (const a of data.aliases) {
      if (a.selected_gene_id && a.current_symbol) {
        const values = aliases.get(a.selected_gene_id) || [];
        values.push(a.current_symbol);
        aliases.set(a.selected_gene_id, values);
      }
    }
    // Stable cohort arrays let native F7 autocomplete reuse its sorted index.
    const scopedGenes = {
      all: genes,
      ranked: genes.filter((g) => g.selected),
      oxphos: genes.filter((g) => landscapeMap.has(g.symbol)),
    };
    const preferredGenes = scopedGenes.oxphos
      .filter((g) => g.selected)
      .map((g) => g.id);
    // Prepare normalized fields and tie order once, rather than sorting on each keystroke.
    const catalogue = genes
      .map((gene) => ({
        gene,
        symbol: gene.symbol.toUpperCase(),
        id: gene.id.toUpperCase(),
        aliases: (aliases.get(gene.id) || []).map((name) => name.toUpperCase()),
      }))
      .sort(
        (a, b) =>
          a.gene.symbol.localeCompare(b.gene.symbol) ||
          Number(b.gene.selected) - Number(a.gene.selected) ||
          a.gene.id.localeCompare(b.gene.id),
      );
    const catalogueScopes = {
      all: catalogue,
      ranked: catalogue.filter(({ gene }) => gene.selected),
      oxphos: catalogue.filter(({ gene }) => landscapeMap.has(gene.symbol)),
    };
    const current = geneRecords.resolve(selected);
    if (search.value === selected) search.value = current?.symbol || selected;
    function viewEvidence() {
      if (matchMedia("(max-width: 850px)").matches) {
        showResearchEvidence(detail, "Gene evidence");
        return;
      }
      detail.focus({ preventScroll: true });
      detail.scrollIntoView({
        block: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
    function updateSelection() {
      const g = geneRecords.resolve(selected) || current;
      if (!g) return;
      selection.replaceChildren(
        el("span", "", "Selected gene"),
        el("strong", "", g.symbol),
        el("span", "identifier", g.id),
        iconButton(
          "View evidence",
          "genes",
          viewEvidence,
          "gene-view-evidence labelled-icon-action",
        ),
      );
    }
    function choose(g) {
      selected = g.id;
      geneDetail(detail, g.id);
      syncLocation();
      updateSelection();
      for (const [i, o] of options.entries())
        o.setAttribute("aria-selected", String(found[i].id === selected));
      if (matchMedia("(max-width: 850px)").matches) viewEvidence();
    }
    function activate(index) {
      active = index;
      for (const [i, o] of options.entries())
        o.classList.toggle("keyboard-active", i === active);
      if (options[active]) {
        search.setAttribute("aria-activedescendant", options[active].id);
        options[active].scrollIntoView({ block: "nearest" });
      } else search.removeAttribute("aria-activedescendant");
    }
    function drawResults() {
      results.replaceChildren();
      options = [];
      active = -1;
      search.removeAttribute("aria-activedescendant");
      const q = search.value.trim().toUpperCase();
      summary.textContent = `${found.length.toLocaleString()} matching gene${found.length === 1 ? "" : "s"}${found.length > limit ? ` · showing ${limit}` : ""}`;
      clear.disabled = !search.value;
      more.hidden = found.length <= limit;
      for (const g of found.slice(0, limit)) {
        const alias = (aliases.get(g.id) || []).filter(
          (a) => q && a.toUpperCase().includes(q),
        );
        const o = el("div", "gene-hit");
        o.id = `gene-option-${options.length}`;
        o.setAttribute("role", "option");
        o.setAttribute(
          "aria-selected",
          String(
            g.id === selected ||
              (g.id === current?.id && selected === current.symbol),
          ),
        );
        o.tabIndex = -1;
        const preview = genePreviewMarkup(g);
        if (preview) {
          const image = el("span", "gene-hit-preview");
          image.innerHTML = preview;
          image.setAttribute("aria-hidden", "true");
          o.append(image);
          o.classList.add("has-structure-preview");
        }
        const title = el("div", "gene-hit-title");
        title.append(el("strong", "", g.symbol));
        if (g.symbol.toUpperCase() === q || g.id.toUpperCase() === q)
          title.append(el("span", "gene-match-kind", "Exact match"));
        else if (alias.some((a) => a.toUpperCase() === q))
          title.append(el("span", "gene-match-kind", "Verified alias"));
        o.append(
          title,
          el("small", "gene-hit-id", g.id),
          el(
            "small",
            "",
            g.selected
              ? "Rank representative"
              : "Additional gene ID · excluded from symbol-based ranking",
          ),
        );
        if (alias.length && alias.some((a) => a !== g.symbol))
          o.append(
            el(
              "small",
              "gene-alias-match",
              `Alias: ${alias.join(", ")} → source symbol ${g.symbol}`,
            ),
          );
        o.onclick = () => choose(g);
        o.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose(g);
          }
        };
        options.push(o);
        results.append(o);
      }
      if (!found.length)
        results.append(
          note(
            "No matching filtered gene in this scope. Try a source symbol, Ensembl identifier or a broader search scope. Absence does not indicate a null result.",
          ),
        );
    }
    function searchResults() {
      limit = 60;
      const q = search.value.trim().toUpperCase();
      const buckets = [[], [], [], [], []];
      for (const entry of catalogueScopes[scope] || catalogue) {
        const { gene, symbol, id, aliases } = entry;
        if (
          q &&
          !symbol.includes(q) &&
          !id.includes(q) &&
          !aliases.some((name) => name.includes(q))
        )
          continue;
        const score =
          symbol === q || id === q
            ? 0
            : aliases.includes(q)
              ? 1
              : symbol.startsWith(q)
                ? 2
                : id.startsWith(q)
                  ? 3
                  : 4;
        buckets[score].push(gene);
      }
      found = buckets.flat();
      drawResults();
    }
    search.oninput = searchResults;
    search.dataset.geneSuggestions = "true";
    search.atlasGeneSuggestions = {
      genes: () => scopedGenes[scope] || genes,
      preferred: () => [selected, ...preferredGenes],
      select: (g) => {
        search.value = g.symbol;
        searchResults();
        choose(g);
      },
    };
    results.onkeydown = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        search.focus();
        activate(
          Math.max(
            0,
            Math.min(
              options.length - 1,
              options.indexOf(e.target) + (e.key === "ArrowDown" ? 1 : -1),
            ),
          ),
        );
      }
    };
    updateSelection();
    searchResults();
    shell?.afterRender();
  }

  function pathways() {
    body.append(
      heading(
        "Pathway evidence",
        "Frozen primary, secondary and exploratory gene sets, with archived enrichment statistics, gene-level estimates and sensitivity analyses.",
      ),
    );
    const eligible = data.pathways.filter(
      (p) => pathwayTier === "all" || p.tier === pathwayTier,
    );
    if (!eligible.some((p) => p.pathway === pathway))
      pathway = eligible[0].pathway;
    syncLocation();
    const choices = [
      ...new Map(
        eligible.map((p) => [
          p.pathway,
          [p.pathway, `${label(p.pathway)} · ${p.tier}`],
        ]),
      ).values(),
    ];
    const controls = el("div", "controls");
    function changeControl(name, fn) {
      fn();
      render();
      body
        .querySelector(`[aria-label="${name}"]`)
        ?.focus({ preventScroll: true });
    }
    const pathwayControl = select("Pathway", choices, pathway, (v) =>
      explorer.selectPathway(v, false),
    );
    controls.append(
      select(
        "Evidence tier",
        [
          ["all", "All frozen tiers"],
          ["primary", "Primary · 15 tests"],
          ["secondary", "Secondary · 21 tests"],
          ["exploratory", "Exploratory · 6 tests"],
        ],
        pathwayTier,
        (v) =>
          changeControl("Evidence tier", () => {
            pathwayTier = v;
            treeState.gene = "";
            treeState.edge = "";
          }),
      ),
      pathwayControl,
      select("Contrast", Object.entries(contrasts), contrast, (v) =>
        changeControl("Contrast", () => {
          contrast = v;
        }),
      ),
    );
    body.append(controls);
    const layout = el("div", "pathway-research-layout");
    const evidence = el("section", "pathway-evidence-panel");
    evidence.id = "pathway-selected-evidence";
    evidence.setAttribute("aria-label", "Selected pathway and gene evidence");
    const explorer = createPathwayTree({
      data,
      provenance,
      getGenes,
      state: treeState,
      contrast,
      tier: pathwayTier,
      selectedPathway: pathway,
      onPathway: (id, scroll) => {
        pathway = id;
        treeState.gene = "";
        pathwayControl.querySelector("select").value = id;
        syncLocation();
        showEvidence(scroll);
      },
      onMembershipChange: () => showEvidence(),
      onOverlap: (pair) => {
        pathway = pair.source;
        treeState.gene = "";
        pathwayControl.querySelector("select").value = pathway;
        syncLocation();
        showEvidence(true);
      },
      onGene: (symbol, id) => {
        pathway = id;
        treeState.gene = symbol;
        pathwayControl.querySelector("select").value = id;
        syncLocation();
        showEvidence(true);
      },
      onState: syncLocation,
    });
    layout.append(explorer, evidence);
    body.append(layout);
    function showEvidence(scroll = false) {
      disposeMethods();
      evidence.replaceChildren();
      const row = data.pathways.find(
        (p) => p.pathway === pathway && p.contrast === contrast,
      );
      if (!row) return;
      const meta = families[row.tier];
      const title = el("h3", "", label(pathway));
      title.tabIndex = -1;
      evidence.append(
        button(
          treeState.view === "network"
            ? "↑ Back to pathway overlap"
            : "↑ Back to pathway tree",
          () => explorer.focusSelection(),
          "secondary tree-return",
        ),
      );
      evidence.append(
        el("div", "eyebrow", `${meta.title} · ${meta.tests}-test family`),
        title,
        note(contrasts[contrast]),
      );
      if (treeState.edge && !treeState.gene && treeState.view === "network") {
        showSharedEvidence();
      } else if (treeState.gene) {
        const back = button(
          treeState.edge && treeState.view === "network"
            ? "← Shared genes"
            : "← Pathway evidence",
          () => {
            treeState.gene = "";
            explorer.refreshSelection();
            syncLocation();
            showEvidence();
          },
          "secondary",
        );
        const geneHost = el("div", "gene-detail tree-gene-detail");
        evidence.append(back, geneHost);
        geneDetail(geneHost, treeState.gene).then(() => {
          if (geneHost.isConnected) enhancePlots(geneHost);
        });
        const membership = Object.entries(data.membership).filter(([, genes]) =>
          genes.includes(treeState.gene),
        );
        evidence.append(el("h4", "", "Frozen gene-set membership"));
        const links = el("div", "tree-membership-links");
        for (const [id] of membership)
          links.append(
            button(
              label(id),
              () => {
                pathwayTier = "all";
                pathway = id;
                treeState.open.add(id);
                render();
              },
              "secondary",
            ),
          );
        evidence.append(
          links,
          note(
            "Shared membership is annotation overlap, not independent confirmation. Gene estimates retain their original transcriptome-wide FDR.",
          ),
        );
        evidence.append(
          button(
            "Open in Gene explorer",
            () => go("genes", treeState.gene),
            "secondary",
          ),
        );
      } else {
        const summary = el("div", "result-summary");
        summary.append(
          el(
            "strong",
            "",
            row.NES === null ? "Untestable" : `NES ${fmt(row.NES)}`,
          ),
          el(
            "span",
            "",
            `${meta.tests}-test ${row.tier} q = ${row.NES === null ? "Not tested" : sci(row.family_fdr)}`,
          ),
          status(row.robustness),
        );
        evidence.append(summary);
        const curve = data.curves[pathway + "|" + contrast];
        if (curve) {
          const points = curve.points.map(([rank, value]) => ({ rank, value }));
          const low = Math.min(0, ...points.map((p) => p.value)) - 0.04,
            high = Math.max(0, ...points.map((p) => p.value)) + 0.04;
          const s = scientificPlot({
            title: `${label(pathway)} weighted running enrichment`,
            width: plotWidth(900),
            height: 300,
            x: {
              domain: [0, 100],
              grid: true,
              label: "Position in ranked transcriptome",
              tickFormat: (v) => `${v}%`,
            },
            y: { domain: [low, high], label: "Running enrichment score" },
            marks: [
              Plot.ruleY([0], { stroke: "#9aabaa" }),
              Plot.ruleX(curve.hits, {
                x: (d) => d,
                y1: low,
                y2: low + (high - low) * 0.025,
                stroke: "#367393",
                strokeOpacity: 0.2,
              }),
              Plot.line(points, {
                x: "rank",
                y: "value",
                stroke: "#a34850",
                strokeWidth: 2.3,
              }),
            ],
          });
          evidence.append(
            s,
            note(
              `${row.size} mapped genes; ${edgeGenes(row).length} leading-edge genes. The curve is sampled for display with both extrema retained; the exported q-value is unchanged.`,
            ),
          );
        } else
          evidence.append(
            note(
              "Untestable under the frozen minimum set size of 15. A stored q=1 is bookkeeping, not evidence for a biological null.",
            ),
          );
        evidence.append(
          note(
            "NES describes competitive enrichment in the ranked transcriptome, not an effect size across biological samples. Family q and gene FDR answer different questions.",
          ),
          downloadButton([row], "pathway-result.csv"),
          button(
            "Inspect sensitivity analyses",
            () => go("robustness"),
            "secondary",
          ),
        );
        const rows = data.sensitivities.filter(
          (r) => r.pathway === pathway && r.contrast === contrast,
        );
        const variants = el("details", "tree-sensitivity");
        variants.append(
          el(
            "summary",
            "",
            `Archived sensitivity results · ${rows.length} variants`,
          ),
          table(rows, [
            ["variant", "Variant"],
            ["NES", "NES", (v) => fmt(v, 3)],
            ["family_fdr", "Within-variant family q", sci],
          ]),
          downloadButton(rows, "all-robustness-variants.csv"),
        );
        evidence.append(variants);
        const leading = el("details", "tree-sensitivity");
        leading.append(
          el("summary", "", `Leading-edge genes · ${edgeGenes(row).length}`),
        );
        const chips = el("div", "chips");
        for (const g of edgeGenes(row))
          chips.append(
            button(g, () => {
              treeState.gene = g;
              explorer.refreshSelection();
              syncLocation();
              showEvidence();
            }),
          );
        leading.append(chips);
        evidence.append(leading);
      }
      const comparison = createAccordion("Compare methods", "pathway-method-comparison");
      const context = { data, pathway, contrast };
      let comparisonView;
      let comparisonLoading = false;
      const loadComparison = async () => {
        comparisonOpen = true;
        if (comparisonView || comparisonLoading) return;
        comparisonLoading = true;
        comparison.body.replaceChildren(loadingMessage("Loading archived method comparisons…"));
        try {
          const { createMethodComparison } = await import("./method-comparison.js");
          if (!comparison.element.isConnected) return;
          comparisonView = createMethodComparison({ ...context, initialSection: comparisonSection, onSection: key => { comparisonSection = key; } });
          comparison.body.replaceChildren(comparisonView);
          enhancePlots(comparisonView);
        } catch (error) {
          comparison.body.replaceChildren(note(error.message), button("Retry comparison", loadComparison, "secondary"));
        } finally { comparisonLoading = false; }
      };
      comparison.element.querySelector(".accordion-item").addEventListener("accordion:open", event => { if (event.target === event.currentTarget) loadComparison(); });
      comparison.element.querySelector(".accordion-item").addEventListener("accordion:close", event => { if (event.target === event.currentTarget) comparisonOpen = false; });
      evidence.append(comparison.element);
      disposeMethods = () => comparisonView?.dispose?.();
      if (comparisonOpen) requestAnimationFrame(() => {
        if (comparison.element.isConnected) document.querySelector("#psilocin-app")?.f7?.accordion.open(comparison.element.querySelector(".accordion-item"));
      });
      if (row.tier === "exploratory")
        evidence.append(
          note(
            "Exploratory transcriptional enrichment does not establish DNA repair activity, telomere length or protection. The separately corrected post hoc decomposition is available in DNA maintenance.",
          ),
          button(
            "Inspect DNA-maintenance follow-up",
            () => go("dna"),
            "secondary",
          ),
        );
      const source = el("details", "tree-sensitivity");
      source.append(
        el("summary", "", "Data provenance & interpretation"),
        note(
          `Frozen results: ${pathway}. Archived companion v1.2.0, DOI 10.5281/zenodo.23283595. No tests or q-values are recalculated by this explorer.`,
        ),
        note(
          "Three differentiation blocks from two genetic backgrounds; common controls with unresolved harvest composition. Treated Day 3 / Day 1 is not a treatment-by-time interaction. Gene overlap is not independent evidence.",
        ),
      );
      const archive = el(
        "a",
        "source-link",
        "Archived analysis and source tables ↗",
      );
      archive.href = "https://doi.org/10.5281/zenodo.23283595";
      archive.target = "_blank";
      archive.rel = "noopener";
      source.append(archive);
      evidence.append(source);
      enhancePlots(evidence);
      if (scroll) showResearchEvidence(evidence, "Pathway evidence");
    }
    function showSharedEvidence() {
      const graph = overlapGraph(data, contrast, {
        members: treeState.networkMembers,
        tier: pathwayTier,
      });
      const pair = graph.pairs.find((p) => p.key === treeState.edge);
      const title = evidence.querySelector(":scope > h3");
      title.textContent = "Shared gene membership";
      evidence.querySelector(":scope > .eyebrow").textContent =
        "DESCRIPTIVE OVERLAP · NO NEW STATISTICAL TESTS";
      if (!pair) {
        evidence.append(
          note("This pair is outside the selected analysis tier."),
        );
        return;
      }
      evidence.append(
        el("h4", "", `${label(pair.source)} ↔ ${label(pair.target)}`),
        note(
          `${treeState.networkMembers === "all" ? "Full frozen annotated sets" : "Leading edges for this contrast"} · members A / B: ${pair.source_size ?? "Unavailable"} / ${pair.target_size ?? "Unavailable"}`,
        ),
      );
      const summary = el("div", "result-summary");
      summary.append(
        el(
          "strong",
          "",
          pair.shared === null ? "Unavailable" : `${pair.shared} shared genes`,
        ),
        el(
          "span",
          "",
          `Jaccard ${pair.jaccard === null ? "Unavailable" : fmt(pair.jaccard, 4)}`,
        ),
      );
      evidence.append(summary);
      evidence.append(
        note(
          "Jaccard = shared symbols ÷ unique symbols across the two sets. Literal membership is unchanged; aliases are not merged. Overlap is descriptive, not a statistical test or independent support.",
        ),
      );
      if (!pair.available) {
        evidence.append(
          note(
            "At least one set has no testable archived leading edge for this contrast. This is unavailable overlap, not zero overlap. Choose all annotated members for an annotation comparison.",
          ),
        );
        return;
      }
      if (!pair.shared) {
        evidence.append(
          note(
            "These selected sets share no literal symbols in this membership view. This does not establish biological independence.",
          ),
        );
        return;
      }
      const geneList = el("div", "overlap-shared-genes");
      evidence.append(
        geneList,
        note(
          "Gene FDR is from the original transcriptome-wide model; there is no new shared-gene multiple-testing family. Selecting a gene opens its archived estimates.",
        ),
      );
      geneList.append(loadingMessage("Loading archived estimates…"));
      getGenes()
        .then((genes) => {
          if (!geneList.isConnected) return;
          const bySymbol = new Map(
              genes.filter((g) => g.selected).map((g) => [g.symbol, g]),
            ),
            index = data.contrasts.indexOf(contrast);
          const rows = pair.genes.map((symbol) => {
            const g = bySymbol.get(symbol),
              effect = g?.effects[index];
            return {
              symbol,
              gene_id: g?.id ?? null,
              availability: g
                ? "archived rank representative"
                : "no literal-symbol match",
              log2FoldChange: effect?.log2FoldChange ?? null,
              gene_fdr: effect?.padj ?? null,
            };
          });
          geneList.replaceChildren();
          for (const row of rows) {
            const b = button(
              "",
              () => {
                treeState.gene = row.symbol;
                syncLocation();
                showEvidence(true);
              },
              "overlap-shared-gene",
            );
            b.dataset.sharedGene = row.symbol;
            b.append(
              el("strong", "", row.symbol),
              el(
                "span",
                "",
                row.gene_id
                  ? `log₂FC ${fmt(row.log2FoldChange, 3)} · FDR ${sci(row.gene_fdr)}`
                  : "No literal-symbol match",
              ),
            );
            geneList.append(b);
          }
          geneList.append(
            button(
              "Download shared genes CSV",
              () =>
                download(
                  "pathway-overlap-shared-genes.csv",
                  csvText(
                    rows.map((r) => ({
                      ...r,
                      source: pair.source,
                      target: pair.target,
                      contrast,
                      membership: treeState.networkMembers,
                    })),
                  ),
                ),
              "secondary",
            ),
          );
        })
        .catch(() => {
          if (geneList.isConnected)
            geneList.replaceChildren(
              note(
                "Gene estimates could not be loaded. Return to the overlap view and retry.",
              ),
            );
        });
    }
    showEvidence();
  }
  function robustness() {
    body.append(
      heading(
        "Robustness & sensitivity",
        "Direction agreement across the frozen block omissions and RNA-quality checks. Significance in every small subset was not required.",
      ),
    );
    const choices = [
      ...new Map(
        data.pathways.map((p) => [
          p.pathway,
          [p.pathway, `${label(p.pathway)} · ${p.tier}`],
        ]),
      ).values(),
    ];
    const controls = el("div", "controls");
    controls.append(
      select("Pathway", choices, pathway, (v) => {
        pathway = v;
        render();
      }),
      select("Contrast", Object.entries(contrasts), contrast, (v) => {
        contrast = v;
        render();
      }),
    );
    body.append(controls);
    const rows = data.sensitivities.filter(
      (r) => r.pathway === pathway && r.contrast === contrast,
    );
    const all = Math.max(
      1,
      ...rows.filter((r) => r.NES !== null).map((r) => Math.abs(r.NES)),
    );
    const variantLabel = (value) =>
      value.replaceAll("__", " / ").replaceAll("_", " ");
    const { inlineLabels, ...stabilityLayout } = rowPlotLayout(
      rows.map((row) => variantLabel(row.variant)),
      { width: 900, minHeight: 240, rowHeight: 30 },
    );
    const s = scientificPlot({
      title: "Pathway normalized enrichment score across all archived variants",
      ...stabilityLayout,
      x: {
        domain: [-all - 0.3, all + 0.3],
        grid: true,
        label: "Normalized enrichment score (NES)",
      },
      y: {
        domain: rows.map((r) => r.variant),
        tickFormat: variantLabel,
        label: null,
        axis: inlineLabels ? null : "left",
      },
      marks: [
        ...(inlineLabels
          ? [
              Plot.text(rows, {
                x: -all - 0.3,
                y: "variant",
                text: (row) => variantLabel(row.variant),
                textAnchor: "start",
                dy: -15,
              }),
            ]
          : []),
        Plot.ruleX([0], { stroke: "#647d7d", strokeDasharray: "4 4" }),
        Plot.dot(
          rows.filter((r) => Number.isFinite(r.NES)),
          {
            x: "NES",
            y: "variant",
            r: { value: (r) => (r.variant === "primary" ? 6 : 4), scale: null },
            fill: (r) =>
              r.variant.startsWith("block_") ? "#9a6960" : "#236461",
            title: (r) =>
              `${r.variant} · NES ${fmt(r.NES, 5)} · family q ${sci(r.family_fdr)}`,
          },
        ),
        Plot.text(
          rows.filter((r) => !Number.isFinite(r.NES)),
          { x: 0, y: "variant", text: () => "Not estimable" },
        ),
      ],
    });
    body.append(
      s,
      note(
        "NES is a normalized gene-ranking enrichment statistic, not a biological-sample effect size. Brown points are descriptive single-block rankings; they do not increase the number of independent blocks.",
      ),
      downloadButton(rows, "all-robustness-variants.csv"),
    );
    body.append(
      table(rows, [
        ["variant", "Variant"],
        ["NES", "NES", (v) => fmt(v, 4)],
        ["family_fdr", "Within-variant family q", sci],
        ["rank_kind", "Rank type"],
      ]),
    );
    const diagnostic = el("details", "gene-diagnostic-disclosure");
    diagnostic.append(el("summary", "", "Gene-level distribution diagnostics"));
    const diagnosticBody = el("div");
    diagnostic.append(diagnosticBody);
    let diagnosticLoaded = false;
    diagnostic.ontoggle = () => {
      if (!diagnostic.open || diagnosticLoaded) return;
      diagnosticLoaded = true;
      diagnosticBody.append(loadingMessage("Loading archived gene estimates…"));
      trackActivity(
        Promise.all([getGenes(), import("./gene-diagnostics.js")]),
        "Loading distribution diagnostics",
      )
        .then(([genes, { geneDiagnostics }]) => {
          if (!diagnosticBody.isConnected) return;
          diagnosticBody.replaceChildren(
            geneDiagnostics(data, genes, contrast, (gene) => go("genes", gene)),
          );
          enhancePlots(diagnosticBody);
        })
        .catch(() => {
          diagnosticBody.replaceChildren(
            note(
              "Archived diagnostics could not be loaded. Close and reopen to retry.",
            ),
          );
          diagnosticLoaded = false;
        });
    };
    body.append(diagnostic);
    if (pathway === "HALLMARK_OXIDATIVE_PHOSPHORYLATION") {
      body.append(
        el("h3", "", "Post-freeze alias sensitivity"),
        note(
          "The alias-expanded OXPHOS comparison is a separate one-set sensitivity and never replaces the frozen 15-test primary q-values.",
        ),
      );
      const aliases = data.aliasSensitivity.filter(
        (r) => r.contrast === contrast,
      );
      body.append(
        table(aliases, [
          ["variant", "Variant"],
          ["baseline_NES", "Literal NES", (v) => fmt(v, 4)],
          ["NES", "Alias NES", (v) => fmt(v, 4)],
        ]),
        downloadButton(aliases, "post-freeze-alias-sensitivity.csv"),
      );
    }
  }
  function dnaView() {
    body.append(
      heading(
        "DNA maintenance",
        "The two frozen exploratory pathways, followed by a separately specified post hoc decomposition. These results remain subordinate to the primary metabolic analysis.",
      ),
    );
    body.append(
      el(
        "aside",
        "boundary",
        "Transcriptional enrichment ≠ DNA repair activity or telomere preservation. Cell-cycle context and shared pathway membership complicate specificity.",
      ),
    );
    const frozen = data.pathways.filter((p) => p.tier === "exploratory");
    body.append(
      el("h3", "", "Frozen exploratory family · 6 tests"),
      table(frozen, [
        ["pathway", "Pathway", label],
        ["contrast", "Contrast", (v) => contrasts[v]],
        ["NES", "NES", (v) => fmt(v, 3)],
        ["family_fdr", "6-test q", sci],
        [
          "robustness",
          "Direction class",
          (v) => (v === "robust" ? "directionally stable" : v),
        ],
      ]),
      downloadButton(frozen, "frozen-exploratory-6-tests.csv"),
    );
    body.append(
      heading(
        "Telomere-associated leading-edge genes",
        "All 30 genes in the two-day leading-edge union: 27 at Day 1, 25 at Day 3, 22 shared. Functional annotations overlap; they are not additional enrichment tests.",
      ),
    );
    const controls = el("div", "controls");
    const mapHost = el("div", "dna-map-scroll"),
      detail = el("aside", "gene-detail");
    controls.append(
      select(
        "Telomere annotation",
        [
          ["All genes", "All genes"],
          ["Packaging / protection", "Packaging / protection"],
          ["Telomerase extension / RNP", "Telomerase extension / RNP"],
          ["C-strand synthesis", "C-strand synthesis"],
          [
            "Recombination / chromatin / TERRA",
            "Recombination / chromatin / TERRA",
          ],
        ],
        dnaFilter,
        (v) => {
          dnaFilter = v;
          syncLocation();
          draw();
        },
      ),
      scaleKey(1.5, "Effect · log₂ fold change"),
    );
    body.append(controls);
    const layout = el("div", "landscape-layout");
    layout.dataset.fullscreenHost = "true";
    layout.dataset.fullscreenTitle = "Telomere leading-edge gene map";
    layout.dataset.fullscreenInfo =
      "Select a gene row to retain its associated archived estimates alongside the map.";
    layout.append(mapHost, detail);
    body.append(layout);
    function draw() {
      const rows = data.dna.decomposition.filter(
        (g) =>
          dnaFilter === "All genes" || g.modules.split(";").includes(dnaFilter),
      );
      const s = svg(
        680,
        108 + rows.length * 22,
        "Telomere leading-edge genes, model effects and overlapping descriptive annotations",
      );
      s.classList.add("dna-map");
      const columns = [
        ["D1/Ctrl", 137],
        ["D3/Ctrl", 197],
        ["LE D1", 265],
        ["LE D3", 310],
        ["DNA", 365],
        ["Protect", 425],
        ["RNP", 479],
        ["C-strand", 541],
        ["TERRA", 611],
      ];
      columns.forEach(([v, x]) =>
        text(s, x, 38, v, { "text-anchor": "middle", "font-size": 11 }),
      );
      text(s, 8, 72, "Gene", { "font-weight": 600 });
      rows.forEach((g, i) => {
        const y = 86 + i * 22,
          r = svgNode("g", {
            role: "button",
            tabindex: 0,
            "aria-label": `Inspect DNA-maintenance gene ${g.gene}`,
          });
        r.classList.add("dna-row");
        r.append(
          svgNode("rect", {
            x: 0,
            y,
            width: 670,
            height: 22,
            fill: g.gene === dnaGene ? "#edf3f1" : "transparent",
          }),
          svgNode("text", { x: 8, y: y + 15 }, g.gene),
        );
        [g.day1_log2fc, g.day3_log2fc].forEach((v, j) => {
          const c = svgNode("rect", {
            x: 110 + j * 60,
            y,
            width: 54,
            height: 21,
            fill: color(v, 1.5),
          });
          c.append(
            svgNode(
              "title",
              {},
              `${g.gene} · ${j ? "Day 3" : "Day 1"} log₂FC ${fmt(v, 5)}`,
            ),
          );
          r.append(c);
        });
        const bits = [
          g.day1_le,
          g.day3_le,
          g.dna_member,
          g.modules.includes("Packaging"),
          g.reaction_ids.includes("R-HSA-164616"),
          g.modules.includes("C-strand"),
          g.reaction_ids.includes("R-HSA-9670149"),
        ];
        bits.forEach((hit, j) => {
          const c = svgNode("rect", {
            x: columns[j + 2][1] - 8,
            y: y + 3,
            width: 16,
            height: 16,
            fill: hit ? "#365c53" : "#edf0ed",
          });
          c.append(
            svgNode(
              "title",
              {},
              `${columns[j + 2][0]}: ${hit ? "member" : "not annotated"}`,
            ),
          );
          r.append(c);
        });
        const choose = () => {
          dnaGene = g.gene;
          syncLocation();
          if (detail.dataset.gene !== dnaGene) geneDetail(detail, dnaGene);
          if (matchMedia("(max-width: 850px)").matches)
            showResearchEvidence(detail, "Gene evidence");
          mapHost
            .querySelectorAll(".dna-row > rect:first-child")
            .forEach((n) => n.setAttribute("fill", "transparent"));
          r.firstChild.setAttribute("fill", "#edf3f1");
        };
        r.onclick = choose;
        r.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            choose();
          }
        };
        s.append(r);
      });
      mapHost.replaceChildren(s);
    }
    draw();
    geneDetail(detail, dnaGene);
    body.append(
      note(
        "DNA marks membership in the entire frozen Hallmark DNA-repair set. Protect: packaging/protection; RNP: telomerase RNP assembly participants; C-strand: synthesis; TERRA: transcription-reaction participants, including associated complexes. Child-set membership uses MSigDB 2026.1.Hs. Packaging (absent from that GMT) and reaction annotations use the recorded Reactome 97 snapshot. Membership does not measure telomerase or TERRA activity.",
      ),
      downloadButton(
        data.dna.decomposition,
        "telomere-30-gene-decomposition.csv",
      ),
    );
    body.append(
      el("h3", "", "Gene-set redundancy"),
      table(data.dna.overlap, [
        ["scope", "Comparison"],
        ["dna_n", "DNA repair"],
        ["telomere_n", "Telomere"],
        ["shared_n", "Shared"],
        ["jaccard", "Jaccard", (v) => fmt(v, 3)],
        ["fraction_telomere", "Fraction of telomere", (v) => fmt(v, 3)],
      ]),
      downloadButton(data.dna.overlap, "dna-telomere-overlap.csv"),
    );
    body.append(
      heading(
        "Overlap removal and cell-cycle context",
        "Post hoc family: eight sets × three contrasts, 24-test BH correction. All results and ten variants are retained. Positive enrichment after subtraction does not establish biological independence.",
      ),
    );
    const follow = el("div");
    body.append(follow);
    const renderTests = () => {
      const rows = data.dna.tests.filter((r) => r.contrast === dnaContrast);
      follow.replaceChildren(
        table(rows, [
          ["module", "Set", label],
          ["mapped", "Mapped"],
          ["NES", "NES", (v) => fmt(v, 3)],
          ["family_fdr", "24-test q", sci],
          [
            "robustness",
            "Direction class",
            (v) => (v === "robust" ? "directionally stable" : v),
          ],
        ]),
      );
    };
    const chooser = select(
      "DNA follow-up contrast",
      Object.entries(contrasts),
      dnaContrast,
      (v) => {
        dnaContrast = v;
        syncLocation();
        renderTests();
      },
    );
    body.insertBefore(chooser, follow);
    renderTests();
    body.append(
      note(
        "DNA repair remains directionally stable at both sampled days after removing telomere genes. Telomere-minus-DNA-repair is positive at both days but meets the new q threshold only at Day 1. DNA replication is enriched at both days, with block-dependent Day-3 direction. E2F, G2M and mitotic spindle do not meet the 24-test threshold. These mixed findings limit a repair-specific interpretation.",
      ),
      downloadButton(data.dna.tests, "post-hoc-dna-24-tests.csv"),
    );
    const variants = el("details");
    variants.append(
      el("summary", "", "Inspect all 240 follow-up results"),
      table(data.dna.sensitivities, [
        ["module", "Set", label],
        ["contrast", "Contrast", (v) => contrasts[v]],
        ["variant", "Variant"],
        ["NES", "NES", (v) => fmt(v, 3)],
        ["family_fdr", "24-test q", sci],
      ]),
      downloadButton(data.dna.sensitivities, "post-hoc-dna-all-variants.csv"),
    );
    body.append(variants);
    body.append(
      heading(
        "Concordance across sampled days",
        "Descriptive correlations among selected leading-edge genes sharing the same controls. No correlation p-values or persistence claim.",
      ),
    );
    const points = data.dna.genes,
      lim = Math.max(
        1,
        ...points.flatMap((g) => [
          Math.abs(g.day1_log2FoldChange),
          Math.abs(g.day3_log2FoldChange),
        ]),
      );
    const plot = scientificPlot({
      title: "Day-1 and Day-3 DNA-maintenance leading-edge gene effects",
      width: plotWidth(640),
      height: 420,
      x: {
        domain: [-lim, lim],
        grid: true,
        label: "Day 1 / common control · log₂ fold change",
      },
      y: {
        domain: [-lim, lim],
        grid: true,
        label: "Day 3 / common control · log₂ fold change",
      },
      marks: [
        Plot.ruleX([0]),
        Plot.ruleY([0]),
        Plot.line(
          [
            { x: -lim, y: -lim },
            { x: lim, y: lim },
          ],
          { x: "x", y: "y", strokeDasharray: "4 4" },
        ),
        Plot.dot(points, {
          x: "day1_log2FoldChange",
          y: "day3_log2FoldChange",
          r: 4,
          fill: (g) => (g.in_telomere_le_union ? "#a45845" : "#317b82"),
          fillOpacity: 0.8,
          title: (g) =>
            `${g.gene} · D1 ${fmt(g.day1_log2FoldChange, 4)} · D3 ${fmt(g.day3_log2FoldChange, 4)}`,
          render: interactiveMark(
            points,
            (g) => go("genes", g.gene),
            (g) => `Inspect concordance gene ${g.gene}`,
          ),
        }),
      ],
    });
    body.append(
      plot,
      note(
        "Rust: telomere leading-edge union (including overlap); teal: DNA-repair leading-edge union only. Dashed line: equal estimates. Click a point to open the archived gene estimates.",
      ),
      table(data.dna.concordance, [
        ["selection", "Gene selection", label],
        ["statistic", "Statistic"],
        ["n", "N genes"],
        ["spearman", "Spearman ρ", (v) => fmt(v, 3)],
        ["same_sign_n", "Same sign"],
        ["positive_both_n", "Positive both"],
      ]),
      downloadButton(data.dna.genes, "dna-cross-day-gene-effects.csv"),
    );
    const panel = el("details");
    panel.append(
      el(
        "summary",
        "",
        "Canonical gene panel · includes absent and mixed results",
      ),
      note(
        "Transcriptome-wide gene FDR from the original fits; no new panel-specific tests. H2AX/H2AFX are listed as source-symbol checks, not counted as separate biological evidence. TERT absence is not a measured null.",
      ),
      table(
        data.dna.panel,
        [
          ["gene", "Gene"],
          ["contrast", "Contrast", (v) => contrasts[v]],
          ["availability", "Availability"],
          ["log2FoldChange", "log₂FC", (v) => fmt(v, 3)],
          ["gene_fdr", "Original gene FDR", sci],
        ],
        { onGene: (gene) => go("genes", gene) },
      ),
      downloadButton(data.dna.panel, "dna-canonical-panel.csv"),
    );
    body.append(panel);
  }

  async function customR() {
    const host = el("div");
    body.append(host);
    const { createResearchStudio } = await trackActivity(
      import("./research-studio.js"),
      "Loading R Studio",
    );
    if (!host.isConnected) return;
    const workspace = createResearchStudio({ data, getGenes, provenance, root,
      bayesian: branding.bayesian, rLogo: branding.rLogo, pythonLogo: branding.pythonLogo, getSelection: () => researchStore.getState(),
      onRestoreProject: selection => researchStore.update(selection),
      onOpenSystems:()=>openSystemsExplorer(),
      onInspectSelection:()=>persistentInspector.toggle(true),
      onOpenCollections:()=>openCollections(true),
      onOpenGeneEvidence: id => { researchStore.update({gene:id}); go("genes", id); },
      onOpenNetwork: id => { researchStore.update({gene:id}); openMembershipNetwork(); },
      onSelectGene: id => researchStore.update({gene:id}),
      onSceneStructure: gene => { researchStore.update({gene}); persistentInspector.toggle(true); },
      onSceneNetwork: spec => { exploratoryOverlay={schema:"psilocin-atlas/exploratory-overlay/v1",classification:"user-exploratory",column:spec.value_label,omitted:0,values:spec.data.map(row=>({id:row.id,value:row.value})),results_sha256:spec.source.sha256||spec.source.code_sha256,run_utc:spec.source.run_utc,archive_doi:spec.source.archive_doi};networkPanel?.querySelector(".oxphos-network-3d")?.setExploratoryOverlay?.(exploratoryOverlay);openMembershipNetwork(); }
    });
    const exploratoryHost = el("div");
    let outputVersion = 0;
    workspace.addEventListener("atlas:r-start", () => {
      exploratoryOverlay = null;
      networkPanel?.querySelector(".oxphos-network-3d")?.setExploratoryOverlay?.(null);
      ++outputVersion;
      exploratoryHost.querySelector(".exploratory-result-chart")?.dispose?.();
      exploratoryHost.replaceChildren();
    });
    workspace.addEventListener("atlas:r-results", async event => {
      const output = event.detail;
      if (output?.classification !== "user-exploratory" || !output.resultsCSV) return;
      const version = ++outputVersion;
      exploratoryHost.querySelector(".exploratory-result-chart")?.dispose?.();
      exploratoryHost.replaceChildren(loadingMessage("Preparing exploratory result display…"));
      try {
        const { createExploratoryResultChart } = await import("./exploratory-result-chart.js");
        if (!workspace.isConnected || version !== outputVersion) return;
        exploratoryHost.replaceChildren(createExploratoryResultChart({ csv: output.resultsCSV, run: output.record,
          onNetwork: async overlay => {
            const bytes = new TextEncoder().encode(output.resultsCSV);
            const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
            if (!workspace.isConnected || version !== outputVersion) throw Error("The active result changed. Select the current result table.");
            // Validate against the exact archived network identities before opening.
            const geneIds = new Set((await getGenes()).filter(g => g.selected && data.landscape.some(row => row.gene === g.symbol)).map(g => g.id));
            if (!overlay.values.some(row => geneIds.has(row.id))) throw Error("No exact IDs match the 113 archived network genes. No symbol-based mapping was attempted.");
            exploratoryOverlay = {...overlay, results_sha256: hash, run_utc: output.record.run_utc,
              archive_doi: output.record.archive_doi, inputs: output.record.inputs};
            networkPanel?.querySelector(".oxphos-network-3d")?.setExploratoryOverlay?.(exploratoryOverlay);
            openMembershipNetwork();
          },
          onSelectGene: async id => {
            const records = await getGenes();
            if (!records.some(g => g.id === id)) return;
            selected = id; saveSelection({ gene: id });
          },
        }));
        workspace.querySelector(".studio-inline-cell.is-active .studio-inline-output")?.append(exploratoryHost);
      } catch (error) { if (version === outputVersion) exploratoryHost.replaceChildren(note(error.message)); }
    });
    host.append(workspace, exploratoryHost);
    if (pendingRSelection) {
      const selection = pendingRSelection;
      pendingRSelection = undefined;
      workspace.setResearchSelection(selection);
    }
  }

  function methods() {
    body.append(
      heading(
        "Methods & provenance",
        "Archived evidence retains its original models and statistical families. Workspace runs explicitly requested exploratory R analyses separately; they do not alter the frozen findings.",
      ),
    );
    const methodGrid = el("div", "methods-grid");
    body.append(methodGrid);
    const sections = [
      [
        "Source experiment and reanalysis",
        "Schmidt et al. studied psilocin responses in human iPSC-derived cortical neurons. This independent reanalysis examines metabolic and redox-associated transcription after a 10-minute exposure and washout, using archived RNA-seq samples from Day 1 and Day 3. Browser filters explore fixed results; they do not run new analyses.",
      ],
      [
        "Experimental unit",
        "Raw counts from 23 source libraries were computationally aggregated into nine block × condition profiles. There are three differentiation blocks and two genetic backgrounds. Cells, genes and libraries are not independent biological replicates.",
      ],
      [
        "Model and multiplicity",
        "DESeq2 ~ block + condition; unshrunken Wald ranks; fgseaMultilevel. The five primary pathways and three contrasts form one 15-test BH family. Secondary (21 tests), exploratory (6 tests), post-primary targeted (8 tests) and post hoc DNA-maintenance (24 tests) families are separate.",
      ],
      [
        "Temporal interpretation",
        "Source materials describe vehicle controls at matching time points, but public RNA-seq metadata do not recover individual control-library harvest days. This reanalysis compares both sampled days with one available common control pool, so treated Day 3 / Day 1 is not a treatment-by-time interaction.",
      ],
      [
        "Scope of the observation",
        "Transcriptional enrichment does not establish respiration, ATP production, redox state, resilience, telomere protection or a mechanism linking these cultures to human outcomes.",
      ],
      [
        "OXPHOS heatmap construction",
        "DESeq2 VST with blind=FALSE; within-gene z-scores over nine explicitly ordered profiles. Expression and effect colors saturate at ±2.5 and ±1.5. Functional groups are project display assignments, not new enrichment families. All 113 genes were selected from OXPHOS leading edges.",
      ],
      [
        "Directional stability and uncertainty",
        "The frozen directional-stability checks include differentiation-block omissions and RNA-quality sensitivities. These checks assess consistency within this small experiment, not independent replication. Bayesian OXPHOS magnitude estimates are prior-sensitive; Day 3 intervals include zero across the documented prior grid. Positive enrichment direction does not imply a precisely estimated effect magnitude.",
      ],
      [
        "Exploratory DNA-maintenance analyses",
        "DNA-repair and telomere-associated results are post hoc and use their own 24-test family. Shared leading-edge genes and common controls limit independence. TERT was absent from the analyzed source-symbol table and POT1 effects were negative at both days. These results do not measure telomere length, telomerase activity, DNA repair capacity or biological ageing.",
      ],
      [
        "Reproducibility and versions",
        "The frozen analysis is archived as version 1.2.0 (doi:10.5281/zenodo.23283595). The plan record and input SHA-256 checksums below identify the analysis inputs. The public repository provides code and derived results; later atlas interface updates do not alter the archived estimates or statistical families.",
      ],
      [
        "Custom R Studio",
        "User scripts run on demand in a separate webR worker against copies of archived atlas tables. Custom outputs are exploratory and do not replace the frozen analysis. The Bayesian example implements the normal-likelihood branch with numerical quadrature and editable priors; it is not the archived NUTS sampler or Student-t sensitivity. The optional R runtime download is separate from the core PWA and is verified before offline readiness is reported.",
      ],
      [
        "External annotations and reuse",
        "Ensembl, UniProt, PDB and AlphaFold records are separately sourced molecular context, matched by the documented identifiers. Snapshot dates, provider attribution and mapping limitations accompany the records. Offline availability depends on the saved package; the core PWA does not include the full molecular library. Source data, derived outputs and software retain their respective licences; consult the repository licence map and References & citation.",
      ],
    ];
    for (const [t, p] of sections) {
      const c = el("section", "method-card");
      c.append(el("h3", "", t), el("p", "", p));
      methodGrid.append(c);
    }
    cameraNotice();
    methodGrid.append(body.querySelector(".camera-qualification"));
    const citation = el("section", "citation-card");
    citation.append(
      el("h3", "", "Source-study citation"),
      el(
        "p",
        "",
        "Schmidt M, Hoffrichter A, Davoudi M, Horschitz S, Lau T, Meinhardt MW, Spanagel R, Ladewig J, Köhr G, Koch P. (2026). Psilocin fosters neuroplasticity in iPSC-derived human cortical neurons. eLife, 14, RP104006. https://doi.org/10.7554/eLife.104006.3",
      ),
    );
    body.append(citation);
    const links = el("p");
    for (const [t, u] of [
      ["Original article", provenance.article],
      ["Author RNA-seq repository", provenance.source],
      ["Dryad phenotype record", "https://doi.org/10.5061/dryad.xsj3tx9w3"],
      ["Archived reanalysis", "https://doi.org/10.5281/zenodo.23283595"],
    ]) {
      const a = el("a", "source-link", t + " ↗");
      a.href = u;
      a.target = "_blank";
      a.rel = "noopener";
      links.append(a);
    }
    body.append(links);
    const mcp = el("p", "mcp-access");
    mcp.append(document.createTextNode("MCP server: "));
    const endpoint = el(
      "code",
      "",
      "https://psilocybin-research.com/mcp/transcriptomics",
    );
    endpoint.style.overflowWrap = "anywhere";
    endpoint.style.whiteSpace = "normal";
    mcp.append(endpoint, document.createTextNode(" · "));
    const mcpLink = el("a", "", "Connection guide ↗");
    mcpLink.href =
      "https://psilocybin-research.com/docs/transcriptomics-mcp.md";
    mcpLink.target = "_blank";
    mcpLink.rel = "noopener";
    mcp.append(
      mcpLink,
      document.createTextNode(
        ". Read-only queries of the fixed v1.2.0 results, with source citations and direct atlas links.",
      ),
    );
    body.append(mcp, el("h3", "", "Frozen plan record"));
    const pre = el(
      "pre",
      "hash-record",
      JSON.stringify(provenance.freeze, null, 2),
    );
    body.append(
      pre,
      el("h3", "", "Exact input checksums"),
      table(
        Object.entries(provenance.inputs).map(([path, sha256]) => ({
          path,
          sha256,
        })),
        [
          ["path", "Source file"],
          ["sha256", "SHA-256"],
        ],
      ),
      button(
        "↓ Download provenance JSON",
        () =>
          download(
            "provenance.json",
            JSON.stringify(provenance, null, 2),
            "application/json",
          ),
        "secondary",
      ),
      button(
        "↓ Download complete atlas JSON",
        () => download("atlas.json", JSON.stringify(data), "application/json"),
        "secondary",
      ),
    );
  }
  shell = createAppShell({
    root,
    Framework7: branding.Framework7,
    top,
    nav,
    body,
    footer,
    share,
    menuToggle,
    tabs,
    go,
    getGenes,
    data,
    notices: branding.uiNotices,
    plotNotices: branding.plotNotices,
    initial: tab,
    enhanceFigures: enhancePlots,
    onPathway: value => researchStore.update({pathway: value, view: "pathways"}),
    onSelectionMenu:anchor=>{const state=researchStore.getState();studioMenu(root,anchor,state.gene?`Selection · ${state.gene}`:'Selection',[
      {label:'Inspect',disabled:!state.gene&&!state.pathway,run:()=>persistentInspector.toggle()},
      {label:'Send to R',disabled:!state.gene&&!state.pathway,run:()=>sendSelectionToR()},
      {label:'Add to collection',disabled:!state.gene,run:async()=>{await openCollections(true);const input=collectionHost.querySelector('textarea');if(input){input.value=state.gene;input.dispatchEvent(new Event('input'));input.focus();}collectionHost.scrollIntoView({block:'nearest'});}},
      {label:'Undo',disabled:!researchStore.canUndo(),run:()=>researchStore.undo()},
      {label:'Redo',disabled:!researchStore.canRedo(),run:()=>researchStore.redo()},
      {label:'Export selection',run:()=>exportSession.click()}
    ]);},
    researchActions: [
      {id:"evidence",title:"Evidence",run:()=>persistentInspector.toggle()},
      {id:"systems",title:"Explore molecular systems",run:()=>openSystemsExplorer()},
      {id:"neuron",title:"Illustrative neuron navigation",run:()=>openSystemsExplorer("neuron")},
      {id: "send-r", title: "Send selection to R", run: () => sendSelectionToR()},
      {id: "undo", title: "Undo research selection", run: () => researchStore.undo()},
      {id: "redo", title: "Redo research selection", run: () => researchStore.redo()},
      {id: "collections", title: "Open gene collections", run: () => { collectionButton.click(); sessionBar.scrollIntoView({block: "nearest"}); }},
      {id: "export", title: "Export research selections", run: () => exportSession.click()},
    ],
  });
  root.append(persistentInspector.element);
  render();
  root.destroy = () => {
    collectionSheet?.close(false);collectionSheet?.destroy();
    persistentInspector.destroy();
    body.querySelector(".research-figure-builder")?.dispose?.();
    networkPanel?.querySelector(".oxphos-network-3d")?.destroy?.();
    unsubscribeResearch();
    collectionsView?.dispose?.();
    body.querySelector(".exploratory-result-chart")?.dispose?.();
    body.querySelector(".custom-r-workspace")?.destroy?.();
    disposeMethods();
    body.querySelector(".mitochondrial-explorer")?.dispose?.();
    body.querySelector(".comparative-views")?.dispose?.();
    removeEventListener("hashchange", reloadFromLocation);
    shell.destroy();
  };
  return root;
}
