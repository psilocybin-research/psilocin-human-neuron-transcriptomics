import { createElement as el, createAccordion } from "./interface-utils.js";
import { mitochondrialEntries } from "./mitochondrial-mapping.js";

const compartmentNames = { MIM: "Inner mitochondrial membrane", MOM: "Outer mitochondrial membrane", IMS: "Intermembrane space", Matrix: "Mitochondrial matrix" };
function fields(body, entries) {
  for (const [label, value] of entries) {
    body.append(el("dt", "", label), el("dd", "", value || "Not supplied"));
  }
}
export function appendMitochondrialCard(host, gene) {
  const slot = el("div", "mitochondrial-context-slot");
  host.append(slot);
  import("./mitochondrial-data.js").then(({ mitochondrialSnapshot }) => mitochondrialSnapshot()).then((snapshot) => {
    const entries = mitochondrialEntries(snapshot, gene);
    if (!entries.length) return;
    const card = createAccordion("Mitochondrial context", "mitochondrial-context-card");
    for (const entry of entries) {
      card.body.append(el("h4", "", entry.name || entry.symbol));
      const summary = el("dl", "gene-annotation-fields");
      fields(summary, [
        ["Source symbol", entry.symbol],
        ["Respiratory role", entry.roles.map((r) => `Complex ${r.complex} · ${r.role.toLowerCase()}`).join("; ") || "Other curated mitochondrial role"],
        ["Compartment", entry.compartment.split("|").map((s) => compartmentNames[s.trim()] || s.trim()).join("; ")],
        ["Source Ensembl IDs", entry.ensembl.join("; ")],
        ["Source UniProt accessions", entry.uniprot.join("; ")],
        ["Mapping to study", entry.mappingStatus],
        ["Localization evidence", entry.evidence],
      ]);
      card.body.append(summary);
      const list = el("ul", "mitochondrial-pathways");
      entry.pathways.forEach((path) => list.append(el("li", "", path)));
      card.body.append(list);
    }
    const source = snapshot.metadata;
    card.body.append(el("p", "note", `MitoCarta ${source.release} · retrieved ${source.retrievedAt}. Ensembl mapping: ${source.ensemblMappingRelease}. Curated external context; source accessions do not identify the expressed isoform. No protein localization or activity was measured here.`));
    const link = el("a", "external", "MitoCarta source and citation ↗");
    link.href = source.source; link.target = "_blank"; link.rel = "noopener noreferrer";
    card.body.append(link, el("p", "note", `${source.citation} ${source.license}. Source annotations are abridged and reformatted; ambiguous mappings are retained.`));
    slot.replaceChildren(card.element);
  }).catch(() => {
    slot.append(el("p", "note", "Mitochondrial context is unavailable. Archived estimates remain available."));
  });
  return slot;
}
