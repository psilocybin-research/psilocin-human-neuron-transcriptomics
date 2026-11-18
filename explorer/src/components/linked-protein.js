import {
  createElement as el,
  loadingMessage,
  createAccordion,
} from "./interface-utils.js";
import {
  loadLocalContext,
  localResource,
  cachedContextFile,
} from "./local-public-context.js";
import {
  geneStructurePreview,
  genePreviewMarkup,
} from "./structure-preview.js";
import { Plot, scientificPlot } from "./scientific-plot.js";

function action(text, fn) {
  const b = el("button", "button button-tonal", text);
  b.type = "button";
  b.onclick = fn;
  return b;
}
export async function linkedProtein(
  gene,
  { onSceneModel, onSceneHighlight } = {},
) {
  const root = el("section", "linked-protein"),
    local = await loadLocalContext(gene.id);
  if (!local?.proteins?.length) {
    root.append(
      el(
        "p",
        "note",
        "No matched protein is available in the saved annotation snapshot. No external request has been made.",
      ),
    );
    return root;
  }
  root.append(
    el(
      "p",
      "callout",
      "External molecular context, not a measured protein change or respiratory activity. Records match the human Ensembl gene ID; this experiment does not identify the expressed protein isoform.",
    ),
  );
  const choice = el("select");
  choice.setAttribute("aria-label", "Matched protein accession");
  local.proteins.forEach((p) => {
    const o = el(
      "option",
      "",
      `${p.accession} · ${p.reviewed ? "Reviewed" : "Unreviewed"} · ${p.name}`,
    );
    o.value = p.accession;
    choice.append(o);
  });
  const content = el("div");
  root.append(choice, content);
  let generation = 0;
  async function render() {
    const current = ++generation,
      p = local.proteins.find((p) => p.accession === choice.value),
      preview = geneStructurePreview(gene);
    content.replaceChildren(el("h4", "", `${p.accession} · ${p.name}`));
    let controller;
    const stage = el("div", "linked-molecular-host"),
      mapStatus = el(
        "p",
        "note",
        "Residue highlighting requires a sequence-verified coordinate mapping.",
      );
    const model = preview?.accession === p.accession ? preview : null;
    if (model) {
      const visual = el("div", "linked-protein-preview");
      visual.innerHTML = genePreviewMarkup(gene);
      content.append(visual);
      const open = action("Open interactive structure", async () => {
        open.disabled = true;
        stage.replaceChildren(
          loadingMessage("Loading the saved structure and molecular renderer…"),
        );
        try {
          const resource = await localResource(model.coordinateSource);
          if (
            !resource ||
            (!navigator.onLine && !(await cachedContextFile(resource.path)))
          )
            throw new Error(
              "These coordinates have not been saved on this device. The preview and protein features remain available offline. Reconnect to open this hosted model.",
            );
          const { molecularViewer } = await import("./molecular-viewer.js");
          controller = await molecularViewer(
            stage,
            {
              id: model.model,
              url: model.coordinateSource,
              previewChains: model.chains,
            },
            {
              predicted: model.provider === "AlphaFold",
              sequence: p.sequence,
              authorize: () => {
                throw new Error(
                  "External access requires confirmation in Gene & protein info.",
                );
              },
            },
          );
          if (current !== generation) return;
          mapStatus.textContent = controller?.mapping.length
            ? `${new Set(controller.mapping.map((r) => r.position)).size} canonical sequence positions mapped by an exact, unique contiguous sequence match. Missing loops, ambiguous or modified sequences are not inferred. Feature selections highlight only mapped residues.`
            : "No unambiguous exact coordinate-to-sequence mapping. Features remain inspectable; residue highlighting is disabled.";
          open.hidden = Boolean(controller);
          if (controller && onSceneModel) {
            const main = action("Show in main 3D view", () =>
              onSceneModel({
                gene,
                protein: p,
                model,
                atoms: controller.backboneAtoms,
                mapping: controller.mapping,
              }),
            );
            stage.before(main);
          }
        } catch (error) {
          stage.replaceChildren(el("p", "note", error.message));
        } finally {
          open.disabled = false;
        }
      });
      const deposit = p.pdb?.find((record) => record.id === model.model);
      content.append(
        el(
          "p",
          "note",
          `${model.provider} · ${model.model}. ${model.scope}${deposit ? ` Deposited method: ${deposit.method}; resolution: ${deposit.resolution}. Resolution is not a residue-level confidence score.` : ""}`,
        ),
        open,
        stage,
      );
      const modes = el("div", "molecular-actions");
      modes.append(
        action("Cartoon", () => controller?.setRepresentation("cartoon")),
        action("Surface", () => controller?.setRepresentation("surface")),
        action("Clear feature", () => {
          controller?.clearHighlight();
          onSceneHighlight?.(gene.id, p.accession, 0, 0);
          mapStatus.textContent = "Feature highlight cleared.";
        }),
      );
      content.append(modes, mapStatus);
    } else
      content.append(
        el(
          "p",
          "note",
          "No prepared structure for this protein accession. Feature annotations below do not imply a structure is available.",
        ),
      );
    content.append(el("h4", "", "Sequence features"));
    const features = p.features || [];
    if (features.length) {
      const chart = scientificPlot({
        title: `${p.accession}: annotated sequence features`,
        width: 410,
        height: Math.min(500, features.length * 30 + 70),
        marginLeft: 22,
        marginRight: 22,
        x: {
          domain: [1, p.sequence.length],
          label: "Canonical amino-acid position",
        },
        y: { axis: null, type: "point" },
        marks: [
          Plot.ruleY(features, {
            y: "key",
            x1: "start",
            x2: "end",
            stroke: "#235780",
            strokeWidth: 6,
            title: (f) => `${f.type} ${f.start}–${f.end}: ${f.description}`,
          }),
        ],
      });
      content.append(chart);
      const list = el("div", "linked-feature-list");
      features.forEach((f) => {
        const b = action(
          `${f.type} · ${f.start}–${f.end} · ${f.description}`,
          () => {
            list
              .querySelectorAll("button")
              .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            const count = controller?.highlight(f.start, f.end) || 0;
            onSceneHighlight?.(gene.id, p.accession, f.start, f.end);
            mapStatus.textContent = controller
              ? `${count} of ${f.end - f.start + 1} annotated sequence positions highlighted in mapped coordinates. Unmapped positions are omitted. Evidence: ${f.evidence || "Not supplied"}.`
              : `Feature ${f.start}–${f.end}. Open a mapped structure to highlight residues. Evidence: ${f.evidence || "Not supplied"}.`;
            if (!mapStatus.isConnected) list.before(mapStatus);
          },
        );
        b.setAttribute("aria-pressed", "false");
        list.append(b);
      });
      content.append(list);
    } else
      content.append(
        el(
          "p",
          "note",
          "No exact-position annotations in the saved snapshot. This does not establish absence of domains or function.",
        ),
      );
    const seq = createAccordion(
      `Canonical sequence · ${p.sequence.length} residues`,
      "linked-protein-sequence",
    );
    seq.body.append(el("pre", "protein-sequence", p.sequence));
    content.append(seq.element);
    content.append(
      el(
        "p",
        "note",
        `UniProt snapshot retrieved ${local.metadata.retrievedAt}. UniProt Consortium · CC BY 4.0. Sequence version ${p.sequenceVersion ?? "not supplied"}; record version ${p.entryVersion ?? "not supplied"}. Predicted local pLDDT and deposited experimental quality are distinct; rainbow sequence colouring is not a validation score.`,
      ),
    );
    const source = el("a", "external", "Open UniProt record ↗");
    source.href = `https://www.uniprot.org/uniprotkb/${p.accession}/entry`;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    content.append(source);
  }
  choice.onchange = render;
  await render();
  return root;
}
