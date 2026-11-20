import {
  createElement as node,
  useModalPush,
  destroySheet,
} from "./interface-utils.js";
import { uiIcon } from "./icons.js";

// Move the live evidence panel, preserving listeners, asynchronous results and
// linked selection. Closing restores the same node to its original position.
export function createEvidenceSheet({ root, getApp, preparePanel }) {
  const sheet = node("section", "sheet-modal research-evidence-sheet");
  sheet.setAttribute("aria-label", "Selected evidence");
  const handle = node("div", "sheet-handle"),
    header = node("header", "evidence-sheet-header"),
    title = node("h2"),
    contextActions = node("div", "segmented evidence-sheet-context-actions"),
    done = node("button", "button button-tonal labelled-icon-action");
  done.type = "button";
  done.append(uiIcon("done"), node("span", "", "Done"));
  const content = node("div", "sheet-modal-inner evidence-sheet-content");
  contextActions.hidden = true;
  header.append(title, contextActions, done);
  sheet.append(handle, header, content);
  root.append(sheet);
  let instance, panel, placeholder;
  function restore() {
    if (placeholder?.isConnected && panel) placeholder.replaceWith(panel);
    panel = null;
    placeholder = null;
    content.replaceChildren();
  }
  function close(animate = false) {
    if (instance?.opened) instance.close(animate);
    else restore();
  }
  done.onclick = () =>
    instance?.close(sheet.dataset.shellModalReady === "true");
  function runContext(type, gene) {
    const dispatch = () => root.dispatchEvent(new CustomEvent(type, { detail: { gene } }));
    if (instance?.opened) {
      instance.once("closed", dispatch);
      instance.close(sheet.dataset.shellModalReady === "true");
    } else dispatch();
  }
  function renderContextActions(target) {
    contextActions.replaceChildren();
    const gene = target?.dataset?.sendGeneToR;
    if (!gene) { contextActions.hidden = true; return; }
    const toR = node("button", "button button-tonal labelled-icon-action");
    toR.type = "button";
    toR.setAttribute("aria-label", `Send ${gene} to R Studio`);
    toR.title = "Send gene to R Studio";
    toR.append(uiIcon("custom-r"));
    toR.onclick = () => runContext("atlas:send-gene-to-r", gene);
    contextActions.append(toR);
    if (target.dataset.openOxphosNetwork === "true") {
      const network = node("button", "button button-tonal labelled-icon-action");
      network.type = "button";
      network.setAttribute("aria-label", `View ${gene} in the 3D OXPHOS network`);
      network.title = "View in 3D OXPHOS network";
      network.append(uiIcon("landscape"));
      network.onclick = () => runContext("atlas:open-oxphos-network", gene);
      contextActions.append(network);
    }
    contextActions.hidden = false;
  }
  function inspect(event) {
    const target = event.detail?.target;
    if (!target?.isConnected) return;
    event.stopPropagation();
    title.textContent = event.detail.title || "Selected evidence";
    renderContextActions(target);
    if (panel === target && instance?.opened) return;
    close(false);
    destroySheet(instance);
    panel = target;
    placeholder = document.createComment("Selected evidence");
    target.before(placeholder);
    content.append(target);
    preparePanel?.(target);
    content.scrollTop = 0;
    const container =
      document.fullscreenElement || document.webkitFullscreenElement || root;
    instance = getApp().sheet.create({
      el: sheet,
      containerEl: container,
      backdrop: true,
      push: useModalPush(),
      swipeToClose: true,
      swipeHandler: handle,
      closeByBackdropClick: true,
      on: { closed: restore },
    });
    instance.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  root.addEventListener("atlas:inspect", inspect);
  return {
    close,
    destroy() {
      close(false);
      destroySheet(instance);
      root.removeEventListener("atlas:inspect", inspect);
      sheet.remove();
    },
  };
}
