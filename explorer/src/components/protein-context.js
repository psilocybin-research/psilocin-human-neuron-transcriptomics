import { downloadFile } from "./file-download.js";
import { createElement as el, createAccordion } from "./interface-utils.js";
import {
  lookupProteins,
  publicRequest,
  verifiedModels,
} from "./protein-data.js";
import { trackActivity } from "./app-activity.js";
import { Plot, scientificPlot, plotWidth } from "./scientific-plot.js";
import { enhancePlots } from "./figure-controls.js";
function action(text, fn) {
  const button = el("button", "button button-tonal", text);
  button.type = "button";
  button.onclick = fn;
  return button;
}
function link(text, url) {
  const a = el("a", "external", text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function featurePlot(protein) {
  const features = protein.features.slice(0, 60);
  if (!features.length)
    return el(
      "p",
      "note",
      "No exact-position domain/site annotations are supplied for this sequence. This does not establish absence of domains or function.",
    );
  const chart = scientificPlot({
    title: `${protein.accession} annotated protein domains and sites`,
    width: plotWidth(760),
    height: features.length * 42 + 80,
    marginLeft: 18,
    marginRight: 24,
    marginTop: 30,
    x: {
      domain: [0.5, protein.sequence.length + 0.5],
      label: "Amino-acid position · UniProt canonical sequence",
      grid: true,
    },
    y: { domain: features.map((f) => f.key), axis: null },
    marks: [
      Plot.ruleY(features, {
        x1: 0.5,
        x2: protein.sequence.length + 0.5,
        y: "key",
        stroke: "#cbd5df",
      }),
      Plot.rectX(features, {
        x1: (f) => f.start - 0.5,
        x2: (f) => f.end + 0.5,
        y: "key",
        insetTop: 16,
        insetBottom: 8,
        fill: "#235780",
        title: (f) =>
          `${f.type}: ${f.description}\nResidues ${f.start}–${f.end}\n${f.evidence || "No evidence code supplied"}`,
      }),
      Plot.text(features, {
        x: 0.5,
        y: "key",
        text: (f) => `${f.type} · ${f.start}–${f.end}`,
        textAnchor: "start",
        dy: -13,
        fontSize: 11,
      }),
    ],
  });
  const block = el("section", "protein-features");
  block.dataset.fullscreenHost = "true";
  block.dataset.fullscreenTitle = `${protein.accession} protein domains and sites`;
  block.append(
    chart,
    el(
      "p",
      "note",
      `${features.length} of ${protein.features.length} exact-position annotations shown. Uncertain boundaries are omitted. Tracks describe this protein sequence, not which isoform was expressed in these cultures.`,
    ),
  );
  const details = el("details"),
    summary = el("summary", "", "Feature descriptions and evidence");
  details.append(summary);
  for (const f of features)
    details.append(
      el(
        "p",
        "note",
        `${f.type}, ${f.start}–${f.end}: ${f.description}. Evidence: ${f.evidence || "Not supplied"}.`,
      ),
    );
  block.append(details);
  return block;
}
function structureOption(parent, model, predicted = false) {
  const row = el("div", "protein-model-option");
  row.append(
    el("strong", "", `${predicted ? "Predicted" : "PDB"} · ${model.id}`),
  );
  row.append(
    link(
      "Provider record ↗",
      predicted
        ? `https://alphafold.ebi.ac.uk/entry/${model.accession}`
        : `https://www.rcsb.org/structure/${model.id}`,
    ),
  );
  if (predicted)
    row.append(
      el(
        "p",
        "note",
        `Model version ${model.version ?? "not supplied"} · created ${model.created}. Sequence matched exactly to the selected UniProt canonical sequence.`,
      ),
    );
  else
    row.append(
      el(
        "p",
        "note",
        `${model.method} · ${model.resolution} · UniProt chain coverage: ${model.chains}.`,
      ),
    );
  const viewport = el("div", "molecular-viewport");
  const load = action("Open 3D structure", async () => {
    load.disabled = true;
    try {
      await trackActivity(
        import("./molecular-viewer.js").then(({ molecularViewer }) =>
          molecularViewer(viewport, model, { predicted }),
        ),
        "Loading molecular structure",
      );
      if (viewport.dataset.structureRendered === "true") {
        load.hidden = true;
        viewport.dataset.fullscreenHost = "true";
        viewport.dataset.fullscreenTitle = `${predicted ? "Predicted" : "PDB"} protein structure ${model.id}`;
        viewport.dataset.fullscreenInfo = `${predicted ? "Predicted model, not experimental evidence. Local pLDDT confidence is not cellular activity." : "Deposited PDB coordinate model; may include partners, fragments and engineered sequences."} Coordinate source: ${model.url}`;
        enhancePlots(row, { nested: true });
      }
    } catch (error) {
      viewport.replaceChildren(
        el(
          "p",
          "note",
          error.message ||
            "Structure unavailable. Open the provider record instead.",
        ),
      );
    } finally {
      load.disabled = false;
    }
  });
  load.dataset.openStructure = "true";
  row.append(load, viewport);
  parent.append(row);
}
function proteinCard(protein, result) {
  const { element, body } = createAccordion(
    `${protein.accession} · ${protein.reviewed ? "Reviewed" : "Unreviewed"} · ${protein.sequence.length} aa`,
    "protein-record",
  );
  const build = () => {
    body.append(
      action("Download public protein context JSON", () =>
        downloadFile(
          `${protein.accession}-public-protein-context.json`,
          JSON.stringify(
            {
              provider: "UniProt",
              source: result.source,
              retrieved_utc: result.retrievedAt,
              protein,
              scope:
                "Current external annotation; no archived estimates or experiment-specific protein measurements.",
            },
            null,
            2,
          ),
          "application/json",
        ),
      ),
      el("h4", "", protein.name),
      el(
        "p",
        "note",
        `UniProt entry version ${protein.entryVersion ?? "not supplied"} · sequence version ${protein.sequenceVersion ?? "not supplied"}. Current Ensembl cross-reference: ${protein.geneIds.join(", ")}. Mapping does not identify the protein isoform expressed in this experiment.`,
      ),
      link(
        "UniProt protein and full annotations ↗",
        `https://www.uniprot.org/uniprotkb/${protein.accession}/entry`,
      ),
      featurePlot(protein),
    );
    body.append(
      link(
        "InterPro domain families ↗",
        `https://www.ebi.ac.uk/interpro/protein/uniprot/${protein.accession}/`,
      ),
    );
    const structures = el("div", "protein-structures");
    structures.append(el("h4", "", "PDB structures"));
    let count = 0;
    const more = action("Show more PDB structures", append);
    function append() {
      for (const model of protein.pdb.slice(count, count + 5))
        structureOption(structures, {
          ...model,
          url: `https://files.rcsb.org/download/${model.id}.cif`,
        });
      count += 5;
      more.hidden = count >= protein.pdb.length;
      structures.append(more);
    }
    if (protein.pdb.length) append();
    else
      structures.append(
        el(
          "p",
          "note",
          "No experimental PDB cross-reference was supplied in this UniProt response. This is not an exhaustive absence claim.",
        ),
      );
    const predicted = el("div", "protein-predictions");
    const find = action("Find sequence-matched AlphaFold models", async () => {
      find.disabled = true;
      predicted.replaceChildren(
        el("p", "note", "Checking public predicted models…"),
      );
      try {
        const response = await trackActivity(
          publicRequest(
            `https://alphafold.ebi.ac.uk/api/prediction/${protein.accession}`,
          ),
          "Finding predicted protein structures",
        );
        if (!element.isConnected) return;
        const models = verifiedModels(response.value, protein);
        predicted.replaceChildren();
        if (!models.length)
          predicted.append(
            el(
              "p",
              "note",
              "No exact-sequence, accession-matched predicted model was returned. No model has been substituted.",
            ),
          );
        for (const model of models)
          structureOption(
            predicted,
            { ...model, accession: protein.accession },
            true,
          );
        predicted.append(
          link("AlphaFold API source ↗", response.source),
          el(
            "p",
            "note",
            `Retrieved ${response.retrievedAt}. Predictions are not PDB structures or measurements of a psilocin response.`,
          ),
        );
      } catch (error) {
        predicted.replaceChildren(el("p", "note", error.message));
      } finally {
        find.disabled = false;
      }
    });
    body.append(
      structures,
      find,
      predicted,
      link("UniProt mapping API source ↗", result.source),
      el(
        "p",
        "note",
        `Mapping and feature annotation retrieved ${result.retrievedAt}.`,
      ),
    );
    enhancePlots(body, { nested: true });
  };
  element
    .querySelector(".accordion-item")
    .addEventListener("accordion:beforeopen", build, { once: true });
  return element;
}
export async function proteinContext(gene) {
  const result = await lookupProteins(gene.id),
    root = el("section", "protein-context");
  root.append(
    el(
      "p",
      "note",
      "Current human protein records are matched by exact Ensembl gene cross-reference. Choose a protein accession before interpreting domains or structures. These are external annotations, not measured protein changes.",
    ),
  );
  if (!result.proteins.length)
    root.append(
      el(
        "p",
        "note",
        "No verified human protein cross-reference was returned for this gene. Noncoding or retired gene records may not have a protein structure.",
      ),
    );
  if (result.limited)
    root.append(
      el(
        "p",
        "note",
        "The provider returned the first 25 matches. This list may be incomplete; use the full UniProt source query.",
      ),
    );
  const reviewed = result.proteins.filter((protein) => protein.reviewed);
  const unreviewed = result.proteins.filter((protein) => !protein.reviewed);
  if (reviewed.length)
    root.append(el("h4", "", `Reviewed protein records · ${reviewed.length}`));
  for (const protein of reviewed) root.append(proteinCard(protein, result));
  if (unreviewed.length) {
    const additional = createAccordion(
      `Unreviewed protein records · ${unreviewed.length}`,
      "protein-additional",
    );
    additional.body.append(
      el(
        "p",
        "note",
        "These records are unreviewed UniProt entries. They may describe alternative predicted products; none is identified here as the protein expressed in these cultures.",
      ),
    );
    for (const protein of unreviewed)
      additional.body.append(proteinCard(protein, result));
    root.append(additional.element);
  }
  root.append(
    link("Full UniProt source query ↗", result.source),
    el("p", "note", `Retrieved ${result.retrievedAt}.`),
  );
  requestAnimationFrame(() => enhancePlots(root));
  return root;
}
