import { FileAttachment } from "observablehq:stdlib";
import { createElement as el } from "./interface-utils.js";
import { confidenceColor, publicRequest } from "./protein-data.js";
import { plotPalette } from "./plot-theme.js";
let active;
// The WebGL runtime and coordinates load only after a specific model is chosen.
export async function molecularViewer(host, model, { predicted = false } = {}) {
  const [{ createViewer }, coordinates, noticeUrl] = await Promise.all([
    import("../assets/vendor/3dmol.js"),
    publicRequest(model.url, { text: true }),
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
  try {
    const parsed = viewer.addModel(coordinates.value, "cif");
    if (!parsed.selectedAtoms({}).length)
      throw new Error("No atoms could be read from this structure.");
    if (predicted)
      viewer.setStyle(
        {},
        { cartoon: { colorfunc: (atom) => confidenceColor(atom.b) } },
      );
    else viewer.setStyle({}, { cartoon: { color: "spectrum" } });
    viewer.zoomTo();
    viewer.render();
  } catch (error) {
    releaseViewer();
    host.replaceChildren(el("p", "note", error.message));
    return;
  }
  const toolbar = el("div", "molecular-actions");
  const reset = el("button", "button button-tonal", "Reset view");
  reset.type = "button";
  reset.onclick = () => {
    viewer.zoomTo();
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
      `${predicted ? "Predicted model · colour shows local pLDDT: blue ≥90; cyan 70–90; yellow 50–70; orange <50. Local confidence does not validate the relative orientation of domains or cellular activity." : "Deposited PDB coordinate model · rainbow colours distinguish sequence positions, not confidence. The model may contain partners, fragments or engineered sequences."} Coordinates retrieved ${coordinates.retrievedAt}. 3Dmol.js 2.5.5.`,
    ),
  );
  const notices = el("a", "external", "Molecular viewer licences");
  notices.href = noticeUrl;
  notices.target = "_blank";
  notices.rel = "noopener noreferrer";
  host.append(notices);
  const resize = new ResizeObserver(() => {
    if (stage.isConnected) {
      viewer.resize();
      viewer.render();
    }
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
}
