import {
  createElement as el,
  createAccordion,
  loadingMessage,
} from "./interface-utils.js";
import {
  createAnnotationClient,
  ensemblIdentity,
} from "./gene-annotation-data.js";
import { trackActivity } from "./app-activity.js";
import { uiIcon } from "./icons.js";
const client = createAnnotationClient();
export function geneAnnotation(gene) {
  const identity = ensemblIdentity(gene.id);
  const { element: panel, body } = createAccordion(
    "Public gene and protein context",
    "gene-annotation",
  );
  const note = el(
    "p",
    "note",
    "Current human gene annotation is external context, separate from the archived expression estimates and frozen pathway memberships. It does not establish a response to psilocin or cellular function in these cultures.",
  );
  const link = el("a", "external", "Open Ensembl gene record ↗");
  link.href = `https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${identity.stableId}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const load = el(
    "button",
    "button button-tonal labelled-icon-action f7-press",
  );
  load.type = "button";
  load.append(uiIcon("information"), el("span", "", "Load current annotation"));
  const result = el("div", "gene-annotation-result");
  result.setAttribute("aria-live", "polite");
  result.setAttribute("aria-atomic", "true");
  load.onclick = async () => {
    load.disabled = true;
    result.setAttribute("aria-busy", "true");
    result.replaceChildren(loadingMessage("Loading Ensembl annotation…"));
    try {
      const record = await trackActivity(
        client.lookup(gene.id),
        "Loading public gene annotation",
      );
      if (!panel.isConnected) return;
      const fields = el("dl", "gene-annotation-fields");
      for (const [name, value] of [
        ["Current symbol", record.symbol],
        ["Description", record.description],
        ["Biotype", record.biotype],
        ["Assembly", record.assembly],
        ["Coordinates", record.location],
        ["Strand", record.strand],
        [
          "Current gene version",
          record.version === null
            ? "Not supplied"
            : `${record.id}.${record.version}`,
        ],
        ["Archived gene ID", gene.id],
        ["Retrieved (UTC)", record.retrievedAt],
      ])
        fields.append(el("dt", "", name), el("dd", "", String(value)));
      const source = el("a", "external", "Ensembl API source ↗");
      source.href = record.source;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      result.replaceChildren(fields, source);
      if (
        identity.archivedVersion !== null &&
        record.version !== null &&
        identity.archivedVersion !== record.version
      )
        result.append(
          el(
            "p",
            "note",
            "The current gene version differs from the archived ID. Coordinates and descriptions above belong to the current annotation; no remapping or reinterpretation of archived estimates has been performed.",
          ),
        );
      load.hidden = true;
    } catch (error) {
      if (panel.isConnected)
        result.replaceChildren(
          el(
            "p",
            "note",
            error.message ||
              "Public annotation could not be loaded. The archived data remain available.",
          ),
        );
    } finally {
      load.disabled = false;
      result.setAttribute("aria-busy", "false");
    }
  };
  const proteins = el("div", "protein-context-result");
  const visuals = el(
    "button",
    "button button-tonal labelled-icon-action f7-press",
  );
  visuals.type = "button";
  visuals.append(
    uiIcon("landscape"),
    el("span", "", "Explore protein domains and structures"),
  );
  visuals.onclick = async () => {
    visuals.disabled = true;
    proteins.replaceChildren(
      loadingMessage("Loading verified human protein matches…"),
    );
    try {
      const context = await trackActivity(
        import("./protein-context.js").then(({ proteinContext }) =>
          proteinContext(gene),
        ),
        "Loading protein annotations",
      );
      if (!panel.isConnected) return;
      proteins.replaceChildren(context);
      visuals.hidden = true;
    } catch (error) {
      if (panel.isConnected)
        proteins.replaceChildren(
          el(
            "p",
            "note",
            error.message || "Protein context is unavailable. Please retry.",
          ),
        );
    } finally {
      visuals.disabled = false;
    }
  };
  body.append(note, link, load, result, visuals, proteins);
  return panel;
}
