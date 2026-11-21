import {createVisualizationTools} from "./visualization-tools.js";
import {createMolecularViewer} from './mitochondrial-molstar.js';
import {createMitochondrialSpatialContext,createMolecularNodesReference} from './mitochondrial-spatial-context.js';
import { createRespiratorySchematic } from "./respiratory-schematic.js";
import { createMitochondrialEnrichmentPlot } from "./mitochondrial-enrichment-plot.js";
import { createMitochondrialEvidencePanel } from "./mitochondrial-evidence-panel.js";
import { mitochondrialGeneRow } from "./mitochondrial-gene-row.js";
import { complexPathway, pathwayComplex, mitochondrialPathwayName, enrichmentQLabel, precisionNote } from "./mitochondrial-enrichment-model.js";
import { FileAttachment } from "observablehq:stdlib";
import { createElement as el, createAccordion, loadingMessage } from "./interface-utils.js";
import { mitochondrialSnapshot, mitochondrialEnrichment, mitochondrialAuditURL } from "./mitochondrial-data.js";
import { complexMembers, archivedGene, coverage } from "./mitochondrial-mapping.js";
import { color, fmt, sci } from "./format.js";
import { downloadFile } from "./file-download.js";

let sequence = 0;
function action(text, callback, className = "button button-tonal") {
  const button = el("button", className, text);
  button.type = "button";
  button.onclick = callback;
  return button;
}
function sourceLink(text, href) {
  const link = el("a", "external", text);
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}
function createTable(headers) {
  const wrap = el("div", "table-scroll data-table"), table = el("table");
  const head = el("thead"), row = el("tr"), body = el("tbody");
  headers.forEach((title) => {
    const cell = el("th", "", title);
    cell.scope = "col";
    row.append(cell);
  });
  head.append(row);
  table.append(head, body);
  wrap.append(table);
  return { wrap, body };
}
export function createMitochondrialExplorer({ getGenes, onGene, onUncertainty, initialView = "enrichment", standalone = false }) {
  const card = standalone
    ? { element: el("section", "mitochondrial-explorer mitochondrial-page-content"), body: el("div", "gene-annotation-body") }
    : createAccordion("MitoCarta · exploratory follow-up", "mitochondrial-explorer");
  if (standalone) card.element.append(card.body);
  const host = el("div");
  card.body.append(host);
  let loaded = false, disposed = false, pairedPlot, evidence, molecular, spatial, schematicTools;
  card.element.dispose = () => {
    disposed = true;
    pairedPlot?.dispose();
    evidence?.dispose();
    molecular?.dispose();
    spatial?.dispose();
    schematicTools?.dispose();
  };
  async function load() {
    if (loaded || disposed) return;
    loaded = true;
    host.replaceChildren(loadingMessage("Loading curated mitochondrial context…"));
    try {
      const [snapshot, genes, enrichmentData] = await Promise.all([
        mitochondrialSnapshot(), getGenes(), mitochondrialEnrichment(),
      ]);
      if (disposed || !card.element.isConnected) return;
      host.replaceChildren();
      const appRoot = document.querySelector("#psilocin-app"), app = appRoot?.f7;
      const id = `mitocarta-workbench-${++sequence}`;
      let complex = "I", role = "Structural subunit", activeView = "enrichment";
      let selection = { pathway: "OXPHOS", day: 1 };
      evidence = createMitochondrialEvidencePanel();
      const openGene = (gene) => evidence.afterClose(() => onGene(gene));
      const sendGene = (gene) => evidence.afterClose(() => appRoot.dispatchEvent(
        new CustomEvent("atlas:send-gene-to-r", { detail: { gene: gene.id } }),
      ));
      const viewbar = el("div", "mito-viewbar");
      const navigation = el("div", "segmented segmented-strong mito-view-switcher");
      navigation.setAttribute("role", "tablist");
      navigation.setAttribute("aria-label", "MitoCarta view");
      const layout = el("div", "mito-workbench-layout"), tabs = el("div", "tabs mito-workbench-tabs");
      const panes = new Map(), tabButtons = new Map();
      for (const [key, name] of [["enrichment", "Enrichment"], ["complexes", "Complexes"], ["structure", "Structure"], ["spatial", "Spatial context"]]) {
        const pane = el("section", `tab mito-workbench-pane${key === activeView ? " tab-active" : ""}`);
        pane.id = `${id}-${key}`;
        pane.setAttribute("role", "tabpanel");
        const button = action(name, () => showView(key), "button");
        button.id = `${pane.id}-tab`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", pane.id);
        pane.setAttribute("aria-labelledby", button.id);
        panes.set(key, pane);
        tabButtons.set(key, button);
        tabs.append(pane);
        navigation.append(button);
      }
      navigation.onkeydown = (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const keys = [...panes.keys()], current = keys.indexOf(activeView);
        const index = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
        showView(keys[index]);
        tabButtons.get(keys[index]).focus();
      };
      viewbar.append(navigation, evidence.launcher);
      layout.append(tabs, evidence.element);
      host.append(viewbar, layout);

      const schematic = createRespiratorySchematic((value) => chooseComplex(value));
      const schematicFigure = el('figure', 'figure-shell mito-reference-figure');
      schematic.element.dataset.figureContent = '';
      schematicFigure.append(schematic.element);
      schematicTools = createVisualizationTools({surface:schematicFigure,title:'Respiratory-chain reference',fullscreenControl:true,showTools:false});
      const roleGroup = el("div", "segmented segmented-strong mitochondrial-role-control");
      roleGroup.setAttribute("role", "group");
      roleGroup.setAttribute("aria-label", "Respiratory membership type");
      const roleButtons = new Map();
      for (const name of ["Structural subunit", "Assembly factor"]) {
        const button = action(`${name}s`, () => chooseComplex(complex, name), "button");
        roleButtons.set(name, button);
        roleGroup.append(button);
      }
      const complexContext = el("p", "note mito-complex-context");
      const status = el("p", "note mitochondrial-coverage");
      status.setAttribute("aria-live", "polite");
      const table = createTable(["Gene / mapping", "Day 1 log₂FC", "Day 3 log₂FC"]);
      panes.get("complexes").append(
        el("h2", "", "Respiratory-chain reference"), schematicFigure,
        el("p", "note", "Reference organization: I / II → ubiquinone → III → cytochrome c → IV. Complex V uses the proton gradient. No measured flux, activity or physical distances are implied."),
        el("p", "note respiratory-scroll-hint", "Select a complex to inspect its complete membership. On narrow screens, scroll the diagram horizontally."),
        complexContext, roleGroup, status, table.wrap,
        el("p", "note", "Blue to orange: signed RNA log₂FC on a fixed ±2.5 scale. Numerical values retain the full effect range. Missing results are not evidence of unchanged expression; their exclusion reason is not inferred."),
      );

      molecular = createMolecularViewer({genes,onGene:openGene,onSendGene:sendGene});
      panes.get("structure").append(molecular.element);
      spatial = createMitochondrialSpatialContext({onComplex:value=>{chooseComplex(value,"Structural subunit");evidence.present();}});
      panes.get("spatial").append(spatial.element);
      const reference = createAccordion("Reference rendering · Molecular Nodes", "molecular-nodes-disclosure");
      reference.element.addEventListener("accordion:beforeopen",()=>{if(!reference.body.childElementCount)reference.body.append(createMolecularNodesReference());});
      panes.get("structure").append(reference.element);
      const structureCard = el("div", "card mito-structure-card");
      const structureBody = el("div", "card-content card-content-padding");
      const structureSelection = el("p", "note mito-structure-selection");
      const pilot = action("Explore human complex I in 3D", async () => {
        pilot.disabled = true;
        try {
          const { openComplexIPilot } = await import("./complex-i-pilot.js");
          await openComplexIPilot({ genes, onGene: openGene });
        } finally {
          pilot.disabled = false;
        }
      });
      structureBody.append(
        el("div", "eyebrow", "OPTIONAL REFERENCE STRUCTURE"),
        el("h2", "", "Human complex I"),
        el("p", "", "45 deposited chains · 44 distinct archived genes · PDB 9TI4, assembly 1."),
        structureSelection,
        el("p", "note", "The pilot covers complex I only. Colours map archived RNA estimates onto an external Cα backbone; they do not measure protein abundance, conformation, assembly or respiratory activity."),
        pilot, sourceLink("PDB structure and validation ↗", "https://www.rcsb.org/structure/9TI4"),
      );
      structureCard.append(structureBody);
      const lightweight=createAccordion("Lightweight Cα viewer", "molecular-lightweight-disclosure");lightweight.body.append(structureCard);panes.get("structure").append(lightweight.element);

      pairedPlot = createMitochondrialEnrichmentPlot({
        data: enrichmentData, snapshot, genes, onGene: openGene, onSendGene: sendGene,
        evidenceHost: evidence.content,
        onUncertainty: onUncertainty ? () => evidence.afterClose(onUncertainty) : undefined,
        onInspect: (value) => updateSelection(value, true),
      });
      panes.get("enrichment").append(pairedPlot.element);

      const resources = createAccordion("Results, downloads & provenance", "mitochondrial-enrichment mito-resources");
      host.append(resources.element);
      let resourcesLoaded = false;
      resources.element.addEventListener("accordion:beforeopen", async () => {
        if (resourcesLoaded) return;
        resourcesLoaded = true;
        resources.body.replaceChildren(loadingMessage("Loading complete results…"));
        try {
          await renderEnrichment(resources.body);
          if (disposed) return;
          const audit = el("a", "", "Download complete identifier-mapping audit");
          audit.href = await mitochondrialAuditURL();
          audit.download = "mitocarta-3.0-mapping-audit.csv";
          resources.body.append(audit,
            el("p", "note", `MitoCarta ${snapshot.metadata.release} · ${snapshot.entries.length} curated genes · retrieved ${snapshot.metadata.retrievedAt}. ${snapshot.metadata.license}. ${snapshot.metadata.citation}`),
            sourceLink("Annotation source and documentation ↗", snapshot.metadata.source),
          );
        } catch {
          resourcesLoaded = false;
          resources.body.replaceChildren(el("p", "note", "Complete results could not load. Close and reopen to retry."));
        }
      });

      function updateSelection(value, present = false) {
        selection = value;
        const mapped = pathwayComplex(value.pathway);
        if (mapped) {
          complex = mapped.complex;
          role = mapped.role;
        }
        const name = mitochondrialPathwayName(value.pathway);
        evidence.setSelection(name);
        structureSelection.textContent = `Selected pathway: ${name} · Day ${value.day}. Switching views preserves this evidence selection.`;
        card.element.dataset.pathway = value.pathway;
        card.element.dataset.day = String(value.day);
        complexContext.textContent = mapped
          ? `Selected pathway: ${name} · Day ${value.day}. Membership and evidence use the same selection.`
          : `Selected pathway: ${name} · Day ${value.day}. The reference browser shows complex ${complex}; select a complex to change the shared evidence selection.`;
        renderComplex();
        if (present) evidence.present();
      }
      function chooseComplex(value, membershipRole = role) {
        complex = value;
        role = membershipRole;
        const next = { pathway: complexPathway(complex, role), day: selection.day };
        pairedPlot.select(next.pathway, next.day, { notify: false, scope: "all" });
        updateSelection(next);
      }
      function renderComplex() {
        schematic.select(complex);
        roleButtons.forEach((button, name) => {
          button.classList.toggle("button-active", name === role);
          button.setAttribute("aria-pressed", String(name === role));
        });
        const members = complexMembers(snapshot, complex, role);
        const day1 = coverage(members, genes, 0), day3 = coverage(members, genes, 1);
        status.textContent = `Complex ${complex} · ${members.length} curated ${role.toLowerCase()}s. Available estimates: Day 1 ${day1.estimated}, Day 3 ${day3.estimated}. No archived record ${day1.absent}; ambiguous ${day1.ambiguous}; non-estimable Day 1 ${day1.nonestimable}, Day 3 ${day3.nonestimable}. Counts are genes, not protein copies; alternatives need not coexist in one assembly.`;
        table.body.replaceChildren();
        for (const entry of members) {
          const row = el("tr"), identity = el("td"), gene = archivedGene(entry, genes);
          if (gene) identity.append(mitochondrialGeneRow(gene, { onGene: openGene, onSendGene: sendGene }));
          else identity.append(el("strong", "", entry.symbol), el("p", "note", entry.mappingStatus));
          identity.append(el("span", "mitochondrial-gene-name", entry.name));
          row.append(identity);
          for (let index = 0; index < 2; index++) {
            const value = gene?.effects[index]?.log2FoldChange;
            const cell = el("td", "numeric mitochondrial-effect", fmt(value));
            cell.style.backgroundColor = color(value, 2.5);
            row.append(cell);
          }
          table.body.append(row);
        }
      }
      function showView(key) {
        activeView = key;
        const pane = panes.get(key);
        if (app) app.tab.show(pane, tabButtons.get(key), false);
        panes.forEach((element, name) => {
          element.hidden = name !== key;
          element.inert = name !== key;
          element.classList.toggle("tab-active", name === key);
          element.setAttribute("aria-hidden", String(name !== key));
        });
        tabButtons.forEach((button, name) => {
          button.classList.toggle("button-active", name === key);
          button.setAttribute("aria-selected", String(name === key));
          button.tabIndex = name === key ? 0 : -1;
        });
        card.element.dataset.mitoView = key;
        molecular.setVisible(key==="structure");
        if(key==="structure")requestAnimationFrame(()=>molecular.activate());
        if(key==="spatial")requestAnimationFrame(()=>spatial.activate());
      }
      updateSelection(selection);
      showView(panes.has(initialView)?initialView:"enrichment");
    } catch {
      pairedPlot?.dispose();
      evidence?.dispose();
      molecular?.dispose();
      spatial?.dispose();
      schematicTools?.dispose();
      loaded = false;
      if (!disposed) host.replaceChildren(el("p", "note", "Mitochondrial context could not load."), action("Retry context", load));
    }
  }
  if (standalone) requestAnimationFrame(load);
  else card.element.addEventListener("accordion:beforeopen", load);
  return card.element;
}
async function renderEnrichment(host) {
  const data = await mitochondrialEnrichment(); host.replaceChildren();
  host.append(el("p", "note", `${data.metadata.engine} · ${data.metadata.familySize} tests corrected jointly across both contrasts. All 149 pathways per contrast are reported; matched size 10–500. The ranking includes all 21,154 archived genes, without a mitochondrial-only background. Hierarchical pathways overlap and are not independent discoveries.`));
  const controls = el("div", "segmented segmented-strong"), table = createTable(["Pathway", "Curated / ranked", "NES", "Nominal p", "Joint BH q / status"]);
  let contrast = "day1_vs_control";
  const buttons = [];
  for (const [id, name] of [["day1_vs_control","Day 1"],["day3_vs_control","Day 3"]]) {
    const button = action(name, () => {contrast = id; render();}, "button"); controls.append(button); buttons.push([id,button]);
  }
  controls.setAttribute("role", "group"); controls.setAttribute("aria-label", "Exploratory enrichment contrast");
  function render() {
    buttons.forEach(([id,button]) => {button.classList.toggle("button-active", id === contrast); button.setAttribute("aria-pressed", String(id === contrast));});
    table.body.replaceChildren();
    for (const result of data.results.filter((r) => r.contrast === contrast)) {
      const row = el("tr");
      [result.pathway.replaceAll("_", " "), `${result.curatedSize} / ${result.matchedSize}`, fmt(result.NES), result.pvalue !== null && result.pvalue <= data.metadata.eps ? `≤ ${data.metadata.eps}` : sci(result.pvalue), enrichmentQLabel(result, data.metadata)].forEach((text) => row.append(el("td", "", text)));
      table.body.append(row);
    }
  }
  const download = action("Download all 298 rows", async () => downloadFile("mitocarta-exploratory-all-pathways.csv", await FileAttachment("../assets/mitochondria/enrichment.csv").text(), "text/csv"));
  const plan = el("a", "", "Frozen analysis plan"); plan.href = await FileAttachment("../assets/mitochondria/analysis-plan.json").url(); plan.download = "mitocarta-exploratory-plan.json";
  host.append(el("p", "note", precisionNote), controls, table.wrap, download, plan, el("p", "note", "P-values at the fixed numerical floor are shown as bounds; their precision is not resolved below that floor. Three differentiation blocks, unresolved control timing and correlation-sensitive pathway evidence limit interpretation. Treated Day 3 / Day 1 is not a treatment-by-time interaction."));
  render();
}
