import { genePreviewMarkup } from "./structure-preview.js";
import { contextIndex, cachedContextFile } from "./local-public-context.js";
import { downloadFile } from "./file-download.js";
import {
  createElement as el,
  createAccordion,
  loadingMessage,
} from "./interface-utils.js";
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
function structureOption(parent, model, predicted = false, authorize) {
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
    viewport.replaceChildren(loadingMessage("Loading molecular structure…"));
    try {
      await trackActivity(
        import("./molecular-viewer.js").then(({ molecularViewer }) =>
          molecularViewer(viewport, model, { predicted, authorize }),
        ),
        "Loading molecular structure",
      );
      if (viewport.dataset.structureRendered === "true") {
        load.hidden = true;
        viewport.dataset.fullscreenHost = "true";
        viewport.dataset.fullscreenLabel = "Fullscreen";
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
  load.dataset.offlineAvailable = String(Boolean(model.offlineAvailable));
  row.append(load, viewport);
  parent.append(row);
}
function proteinCard(
  protein,
  result,
  { structures = false, opened = false } = {},
) {
  const { element, body } = createAccordion(
    `${protein.accession} · ${protein.reviewed ? "Reviewed" : "Unreviewed"} · ${protein.sequence.length} aa`,
    "protein-record",
  );
  const build = () => {
    const exportContext = action("Download public protein context JSON", () =>
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
    );
    body.append(
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
    );
    if (!structures) {
      body.append(
        featurePlot(protein),
        link(
          "InterPro domain families ↗",
          `https://www.ebi.ac.uk/interpro/protein/uniprot/${protein.accession}/`,
        ),
        exportContext,
      );
      enhancePlots(body, { nested: true });
      return;
    }
    const pdbList = el("div", "protein-structures");
    pdbList.append(el("h4", "", "PDB structures"));
    let count = 0;
    const more = action("Show more PDB structures", append);
    function append() {
      for (const model of protein.pdb.slice(count, count + 5))
        structureOption(
          pdbList,
          {
            ...model,
            url: `https://files.rcsb.org/download/${model.id}.cif`,
          },
          false,
          result.authorize,
        );
      count += 5;
      more.hidden = count >= protein.pdb.length;
      pdbList.append(more);
    }
    if (protein.pdb.length) append();
    else
      pdbList.append(
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
        loadingMessage("Checking public predicted models…"),
      );
      try {
        const response = await trackActivity(
          publicRequest(
            `https://alphafold.ebi.ac.uk/api/prediction/${protein.accession}`,
            { authorize: result.authorize },
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
            result.authorize,
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
      find,
      predicted,
      pdbList,
      exportContext,
      link("UniProt mapping API source ↗", result.source),
      el(
        "p",
        "note",
        `Mapping and feature annotation retrieved ${result.retrievedAt}.`,
      ),
    );
    enhancePlots(body, { nested: true });
  };
  const item = element.querySelector(".accordion-item");
  if (opened) {
    build();
    item.classList.add("accordion-item-opened");
    item
      .querySelector(".gene-annotation-toggle")
      .setAttribute("aria-expanded", "true");
    item
      .querySelector(".accordion-item-content")
      .setAttribute("aria-hidden", "false");
  } else item.addEventListener("accordion:beforeopen", build, { once: true });
  return element;
}
export async function proteinContext(
  gene,
  { view = "protein", live = false, authorize, preferredModel } = {},
) {
  const structures = view === "structures";
  const result = await lookupProteins(gene.id, {
      live,
      compact: Boolean(preferredModel),
    }),
    root = el("section", "protein-context");
  result.authorize = authorize;
  if (result.snapshot)
    root.append(
      el(
        "p",
        "note",
        `Local UniProt snapshot · ${result.retrievedAt}. ${result.scope} UniProt Consortium · CC BY 4.0. Available offline.`,
      ),
    );
  root.append(
    el(
      "p",
      "note",
      "Human protein records are matched by exact Ensembl gene cross-reference. Choose a protein accession before interpreting domains or structures. These are external annotations, not measured protein changes.",
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
  if (result.compact) {
    const manage = action("Manage offline molecular library", () =>
      root.dispatchEvent(
        new CustomEvent("atlas:offline-open", { bubbles: true }),
      ),
    );
    root.append(
      el(
        "p",
        "note",
        "Compact offline protein context. Additional protein records and the representative 3D library require the optional molecular download.",
      ),
      manage,
    );
  }
  if (result.limited)
    root.append(
      el(
        "p",
        "note",
        "The provider returned the first 25 matches. This list may be incomplete; use the full UniProt source query.",
      ),
    );
  const access = el("section", "protein-structure-access");
  access.tabIndex = -1;
  access.append(el("h4", "", "3D structures"));
  const resourceIndex = await contextIndex();
  const available = result.proteins.filter((protein) => protein.pdb.length);
  let preferred;
  if (structures && preferredModel && !live) {
    const protein = result.proteins.find(
      (p) => p.accession === preferredModel.accession,
    );
    const resource =
      resourceIndex?.resources?.[preferredModel.coordinateSource];
    if (protein && resource) {
      if (!navigator.onLine && !(await cachedContextFile(resource.path))) {
        const preview = el("div", "offline-structure-preview");
        preview.innerHTML = genePreviewMarkup(gene);
        access.append(
          preview,
          el(
            "p",
            "note",
            `${preferredModel.provider} · ${preferredModel.accession} · ${preferredModel.model}. ${preferredModel.scope}`,
          ),
          el(
            "p",
            "note",
            "The preview is saved. Interactive coordinates require the optional molecular download. Connect to download it under Install app.",
          ),
          action("Manage offline molecular library", () =>
            root.dispatchEvent(
              new CustomEvent("atlas:offline-open", { bubbles: true }),
            ),
          ),
        );
        root.append(access);
        return root;
      }
      if (preferredModel.provider === "AlphaFold") {
        const response = await publicRequest(
          `https://alphafold.ebi.ac.uk/api/prediction/${protein.accession}`,
          { authorize },
        );
        preferred = verifiedModels(response.value, protein).find(
          (m) => m.url === preferredModel.coordinateSource,
        );
      } else preferred = protein.pdb.find((m) => m.id === preferredModel.model);
      if (preferred) {
        access.append(
          el("strong", "", `${protein.accession} · Previewed model`),
        );
        structureOption(
          access,
          {
            ...preferred,
            accession: protein.accession,
            url: preferredModel.coordinateSource,
            previewChains: preferredModel.chains,
            offlineAvailable:
              navigator.onLine ||
              Boolean(await cachedContextFile(resource.path)),
          },
          preferredModel.provider === "AlphaFold",
          authorize,
        );
      }
    }
  }
  if (!preferred && available.length) {
    access.append(
      el(
        "p",
        "note",
        "Open a linked PDB model directly. More models and sequence-matched predictions are available inside each protein record below.",
      ),
    );
    for (const protein of available.slice(0, 3)) {
      access.append(
        el(
          "strong",
          "",
          `${protein.accession} · ${protein.reviewed ? "Reviewed" : "Unreviewed"} protein`,
        ),
      );
      const model =
        protein.pdb.find(
          (model) =>
            resourceIndex?.resources?.[
              `https://files.rcsb.org/download/${model.id}.cif`
            ],
        ) || protein.pdb[0];
      structureOption(
        access,
        {
          ...model,
          offlineAvailable:
            Boolean(
              resourceIndex?.resources?.[
                `https://files.rcsb.org/download/${model.id}.cif`
              ],
            ) &&
            (navigator.onLine ||
              Boolean(
                await cachedContextFile(
                  resourceIndex.resources[
                    `https://files.rcsb.org/download/${model.id}.cif`
                  ].path,
                ),
              )),
          url: `https://files.rcsb.org/download/${model.id}.cif`,
        },
        false,
        result.authorize,
      );
    }
  } else if (!preferred) {
    access.append(
      el(
        "p",
        "note",
        "No PDB cross-reference was returned. Open a protein record below to check for an exact-sequence AlphaFold prediction; availability is not yet known.",
      ),
    );
  }
  if (structures && result.proteins.length) root.append(access);
  const reviewed = result.proteins.filter((protein) => protein.reviewed);
  const unreviewed = result.proteins.filter((protein) => !protein.reviewed);
  if (reviewed.length)
    root.append(el("h4", "", `Reviewed protein records · ${reviewed.length}`));
  for (const protein of reviewed)
    root.append(
      proteinCard(protein, result, {
        structures,
        opened: reviewed.length === 1 && (!structures || !available.length),
      }),
    );
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
    let shown = 0;
    const more = action("Show more unreviewed proteins", appendUnreviewed);
    function appendUnreviewed() {
      const batch = unreviewed.slice(shown, shown + 20);
      for (const protein of batch)
        additional.body.append(proteinCard(protein, result, { structures }));
      shown += batch.length;
      more.hidden = shown >= unreviewed.length;
      more.textContent = `Show more unreviewed proteins · ${shown} of ${unreviewed.length}`;
      additional.body.append(more);
    }
    additional.element.addEventListener(
      "accordion:beforeopen",
      appendUnreviewed,
      { once: true },
    );
    root.append(additional.element);
  }
  root.append(
    link("Full UniProt source query ↗", result.source),
    el("p", "note", `Retrieved ${result.retrievedAt}.`),
  );
  requestAnimationFrame(() => enhancePlots(root));
  return root;
}
