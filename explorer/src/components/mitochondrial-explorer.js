import { FileAttachment } from "observablehq:stdlib";
import { createElement as el, createAccordion, loadingMessage } from "./interface-utils.js";
import { mitochondrialSnapshot, mitochondrialEnrichment, mitochondrialAuditURL } from "./mitochondrial-data.js";
import { complexMembers, archivedGene, coverage } from "./mitochondrial-mapping.js";
import { createGeneIdentity } from "./structure-preview.js";
import { color, fmt, sci } from "./format.js";
import { downloadFile } from "./file-download.js";

function action(text, callback, className = "button button-tonal") {
  const button = el("button", className, text); button.type = "button"; button.onclick = callback; return button;
}
function sourceLink(text, href) {
  const link = el("a", "external", text); link.href = href; link.target = "_blank"; link.rel = "noopener noreferrer"; return link;
}
function createTable(headers) {
  const wrap = el("div", "table-scroll data-table"), table = el("table"), head = el("thead"), row = el("tr"), body = el("tbody");
  headers.forEach((title) => { const cell = el("th", "", title); cell.scope = "col"; row.append(cell); });
  head.append(row); table.append(head, body); wrap.append(table); return {wrap, body};
}
export function createMitochondrialExplorer({ getGenes, onGene }) {
  const card = createAccordion("Respiratory complexes · complete curated membership", "mitochondrial-explorer");
  card.body.append(el("p", "note", "Explore complete MitoCarta memberships alongside archived RNA estimates. Open a gene for its effect intervals and nine block-by-condition expression profiles. This external reference extends beyond the selected 113-gene landscape below."));
  const host = el("div"); card.body.append(host);
  let loaded = false;
  async function load() {
    if (loaded) return;
    loaded = true; host.replaceChildren(loadingMessage("Loading curated mitochondrial context…"));
    try {
      const [snapshot, genes] = await Promise.all([mitochondrialSnapshot(), getGenes()]);
      if (!card.element.isConnected) return;
      host.replaceChildren();
      const schematic = el("div", "respiratory-schematic"); schematic.setAttribute("role", "group"); schematic.setAttribute("aria-label", "Choose a respiratory complex");
      let complex = "I", role = "Structural subunit";
      const complexButtons = new Map();
      for (const id of ["I", "II", "III", "IV", "V"]) {
        const names = {I:"NADH entry",II:"Succinate entry",III:"Cytochrome bc₁",IV:"Oxygen reduction",V:"ATP synthase"};
        const button = action("", () => { complex = id; render(); }, "button respiratory-complex");
        button.append(el("strong", "", `Complex ${id}`), el("span", "", names[id])); button.setAttribute("aria-pressed", "false");
        complexButtons.set(id, button); schematic.append(button);
      }
      const reference = el("p", "note", "Reference organization in the inner mitochondrial membrane. Electron transfer: I / II → ubiquinone → III → cytochrome c → IV. Complex V uses the proton gradient. This diagram does not show measured flux, activity or physical distances.");
      const roleGroup = el("div", "segmented segmented-strong mitochondrial-role-control"); roleGroup.setAttribute("role", "group"); roleGroup.setAttribute("aria-label", "Respiratory membership type");
      const roleButtons = new Map();
      for (const name of ["Structural subunit", "Assembly factor"]) {
        const button = action(`${name}s`, () => { role = name; render(); }, "button"); roleButtons.set(name, button); roleGroup.append(button);
      }
      const status = el("p", "note mitochondrial-coverage"); status.setAttribute("aria-live", "polite");
      const table = createTable(["Gene / mapping", "Day 1 log₂FC", "Day 3 log₂FC"]);
      const pilot = action("Explore human complex I in 3D", async () => {
        pilot.disabled = true;
        try { const {openComplexIPilot} = await import("./complex-i-pilot.js"); await openComplexIPilot({genes, onGene}); }
        finally { pilot.disabled = false; }
      });
      host.append(schematic, reference, roleGroup, status, table.wrap, pilot,
        el("p", "note", "Blue to orange: signed RNA log₂FC on a fixed ±2.5 scale. Numerical values retain the full effect range. Missing archived results are not evidence of unchanged expression; their exclusion reason is not inferred."));
      const audit = el("a", "", "Download complete identifier-mapping audit"); audit.href = await mitochondrialAuditURL(); audit.download = "mitocarta-3.0-mapping-audit.csv";
      host.append(audit, el("p", "note", `MitoCarta ${snapshot.metadata.release} · ${snapshot.entries.length} curated genes · retrieved ${snapshot.metadata.retrievedAt}. ${snapshot.metadata.license}. ${snapshot.metadata.citation}`), sourceLink("Annotation source and documentation ↗", snapshot.metadata.source));
      const enrichment = createAccordion("Exploratory MitoCarta enrichment · complete results", "mitochondrial-enrichment"); host.append(enrichment.element);
      let enrichmentLoaded = false;
      enrichment.element.addEventListener("accordion:beforeopen", async () => {
        if (enrichmentLoaded) return;
        enrichmentLoaded = true; enrichment.body.append(loadingMessage("Loading exploratory results…"));
        try { await renderEnrichment(enrichment.body); }
        catch { enrichment.body.replaceChildren(el("p", "note", "Exploratory results could not load.")); enrichmentLoaded = false; }
      });
      function render() {
        complexButtons.forEach((button, id) => {button.classList.toggle("is-selected", id === complex); button.setAttribute("aria-pressed", String(id === complex));});
        roleButtons.forEach((button, id) => {button.classList.toggle("button-active", id === role); button.setAttribute("aria-pressed", String(id === role));});
        const members = complexMembers(snapshot, complex, role), day1 = coverage(members, genes, 0), day3 = coverage(members, genes, 1);
        status.textContent = `Complex ${complex} · ${members.length} curated ${role.toLowerCase()}s. Available estimates: Day 1 ${day1.estimated}, Day 3 ${day3.estimated}. No archived record ${day1.absent}; ambiguous ${day1.ambiguous}; non-estimable Day 1 ${day1.nonestimable}, Day 3 ${day3.nonestimable}. Counts are genes, not protein copies; alternatives need not coexist in one assembly.`;
        table.body.replaceChildren();
        for (const entry of members) {
          const row = el("tr"), identity = el("td"), gene = archivedGene(entry, genes);
          if (gene) {
            const select = action("", () => onGene(gene), "button mitochondrial-gene-link"); select.setAttribute("aria-label", `Open ${gene.symbol} gene evidence`); select.append(createGeneIdentity(gene,{compact:true})); identity.append(select);
          } else identity.append(el("strong", "", entry.symbol), el("p", "note", entry.mappingStatus));
          identity.append(el("span", "mitochondrial-gene-name", entry.name)); row.append(identity);
          for (let index = 0; index < 2; index++) {
            const value = gene?.effects[index]?.log2FoldChange, cell = el("td", "numeric mitochondrial-effect", fmt(value));
            cell.style.backgroundColor = color(value, 2.5); row.append(cell);
          }
          table.body.append(row);
        }
      }
      render();
    } catch {
      loaded = false; host.replaceChildren(el("p", "note", "Mitochondrial context could not load."), action("Retry context", load));
    }
  }
  card.element.addEventListener("accordion:beforeopen", load);
  return card.element;
}
async function renderEnrichment(host) {
  const data = await mitochondrialEnrichment(); host.replaceChildren();
  host.append(el("p", "callout", "Exploratory follow-up prompted by the original OXPHOS finding. These results use the same biological observations and are not independent validation. Frozen primary results and both CAMERA sensitivity settings remain unchanged."));
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
      [result.pathway.replaceAll("_", " "), `${result.curatedSize} / ${result.matchedSize}`, fmt(result.NES), result.pvalue !== null && result.pvalue <= data.metadata.eps ? `≤ ${data.metadata.eps}` : sci(result.pvalue), result.status === "tested" ? sci(result.qvalue) : result.status].forEach((text) => row.append(el("td", "", text)));
      table.body.append(row);
    }
  }
  const download = action("Download all 298 rows", async () => downloadFile("mitocarta-exploratory-all-pathways.csv", await FileAttachment("../assets/mitochondria/enrichment.csv").text(), "text/csv"));
  const plan = el("a", "", "Frozen analysis plan"); plan.href = await FileAttachment("../assets/mitochondria/analysis-plan.json").url(); plan.download = "mitocarta-exploratory-plan.json";
  host.append(controls, table.wrap, download, plan, el("p", "note", "P-values at the fixed numerical floor are shown as bounds; their precision is not resolved below that floor. Three differentiation blocks, unresolved control timing and correlation-sensitive pathway evidence limit interpretation. Treated Day 3 / Day 1 is not a treatment-by-time interaction."));
  render();
}
