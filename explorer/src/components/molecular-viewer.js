import { FileAttachment } from "observablehq:stdlib";
import { createElement as el } from "./interface-utils.js";
import { confidenceColor, publicRequest } from "./protein-data.js";
import { mapSequenceResidues, featureResidues } from "./residue-mapping.js";
import { plotPalette } from "./plot-theme.js";
let active;
// The WebGL runtime and coordinates load only after a specific model is chosen.
export async function molecularViewer(
  host,
  model,
  { predicted = false, authorize, sequence } = {},
) {
  const [{ createViewer }, coordinates, noticeUrl] = await Promise.all([
    import("../assets/vendor/3dmol.js"),
    publicRequest(model.url, { text: true, authorize }),
    FileAttachment("../assets/vendor/3dmol.NOTICES.txt").url(),
  ]);
  if (!host.isConnected) return;
  if (active && active.host !== host) active.close();
  const stage = el("div", "molecular-stage");
  stage.setAttribute("role", "img");
  stage.setAttribute(
    "aria-label",
    `${predicted ? "Predicted" : "Deposited PDB"} protein structure ${model.id}. Drag to rotate; use the wheel or pinch to zoom. Source and sequence information follow.`,
  );
  host.replaceChildren(stage);
  let viewer;
  try {
    viewer = createViewer(stage, {
      backgroundColor: plotPalette(host).background,
      antialias: true,
    });
  } catch {
    host.replaceChildren(
      el(
        "p",
        "note",
        "WebGL is unavailable. Open the provider structure link to inspect this model.",
      ),
    );
    return;
  }
  let selection = {},
    parsed;
  try {
    parsed = viewer.addModel(coordinates.value, "cif");
    if (model.previewChains?.length) selection = { chain: model.previewChains };
    if (!parsed.selectedAtoms(selection).length)
      throw new Error("No atoms could be read from this structure.");
    viewer.setStyle({}, {});
    if (predicted)
      viewer.setStyle(selection, {
        cartoon: { colorfunc: (atom) => confidenceColor(atom.b) },
      });
    else viewer.setStyle(selection, { cartoon: { color: "spectrum" } });
    viewer.zoomTo(selection);
    viewer.render();
  } catch (error) {
    releaseViewer();
    host.replaceChildren(el("p", "note", error.message));
    return;
  }

  const mapping = sequence
    ? mapSequenceResidues(parsed.selectedAtoms(selection), sequence)
    : [];
  let highlighted = [],
    representation = "cartoon",
    surface;
  function paint() {
    if (!stage.isConnected) return;
    if (surface !== undefined) {
      viewer.removeSurface(surface);
      surface = undefined;
    }
    viewer.setStyle({}, {});
    const style = predicted
      ? { colorfunc: (atom) => confidenceColor(atom.b) }
      : { color: "spectrum" };
    viewer.setStyle(selection, {
      cartoon: { ...style, opacity: representation === "surface" ? 0.35 : 1 },
    });
    if (representation === "surface") {
      const result = viewer.addSurface(
        1,
        { opacity: 0.6, color: "#7eafbd" },
        selection,
      );
      surface = result?.surfid;
      result
        ?.then?.(() => {
          if (stage.isConnected) viewer.render();
        })
        .catch?.(() => {});
    }
    for (const residue of highlighted) {
      const sel = {
        chain: residue.chain,
        resi: residue.resi,
        icode: residue.icode,
      };
      viewer.addStyle(sel, {
        stick: { color: "#d18b21", radius: 0.2 },
        cartoon: { color: "#d18b21" },
      });
    }
    viewer.render();
  }

  const toolbar = el("div", "molecular-actions");
  const reset = el("button", "button button-tonal", "Reset view");
  reset.type = "button";
  reset.onclick = () => {
    viewer.zoomTo(selection);
    viewer.render();
  };
  const turn = el("button", "button button-tonal", "Rotate left");
  turn.type = "button";
  turn.onclick = () => {
    viewer.rotate(30, "y");
    viewer.render();
  };
  const close = el("button", "button button-tonal", "Close structure");
  close.type = "button";
  close.onclick = () => {
    host.replaceChildren(
      el("p", "note", "Structure closed. Reopen it when needed."),
    );
    host.dataset.structureRendered = "false";
    const load = host
      .closest(".protein-model-option")
      ?.querySelector("[data-open-structure]");
    if (load) load.hidden = false;
  };
  const session = { host, close: close.onclick };
  active = session;
  toolbar.append(turn, reset, close);
  host.append(toolbar);
  host.dataset.structureRendered = "true";
  host.append(
    el(
      "p",
      "note",
      `${predicted ? "Predicted model · colour shows local pLDDT: blue ≥90; cyan 70–90; yellow 50–70; orange <50. Local confidence does not validate the relative orientation of domains or cellular activity." : "Deposited PDB coordinate model · rainbow colours distinguish sequence positions, not confidence. The model may contain partners, fragments or engineered sequences."} Coordinates retrieved ${coordinates.retrievedAt}${coordinates.snapshot ? " · stored copy, available offline" : ""}. ${predicted ? "AlphaFold DB · Google DeepMind / EMBL-EBI · CC BY 4.0." : "Original PDB depositors / wwPDB · CC0 1.0; deposited citations retained in the coordinate file."} 3Dmol.js 2.5.5.`,
    ),
  );
  const notices = el("a", "external", "Molecular viewer licences");
  notices.href = noticeUrl;
  notices.target = "_blank";
  notices.rel = "noopener noreferrer";
  host.append(notices);
  let resizeFrame;
  const resize = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (stage.isConnected) {
        viewer.resize();
        viewer.render();
      }
    });
  });
  resize.observe(stage);
  const app = host.closest("#psilocin-app");
  const appearance = new MutationObserver(() => {
    viewer.setBackgroundColor(plotPalette(host).background);
    viewer.render();
  });
  appearance.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const detach = new MutationObserver(() => {
    if (!stage.isConnected) {
      resize.disconnect();
      cancelAnimationFrame(resizeFrame);
      appearance.disconnect();
      detach.disconnect();
      releaseViewer();
      if (active === session) active = undefined;
    }
  });
  detach.observe(app || document.body, { childList: true, subtree: true });
  function releaseViewer() {
    viewer.clear();
    const canvas = stage.querySelector("canvas");
    const context = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    stage.replaceChildren();
  }
  return {
    mapping,
    setRepresentation(value) {
      representation = value === "surface" ? "surface" : "cartoon";
      paint();
    },
    highlight(start, end) {
      highlighted = featureResidues(mapping, start, end);
      paint();
      return [...new Set(highlighted.map((r) => r.position))].length;
    },
    clearHighlight() {
      highlighted = [];
      paint();
    },
  };
}
