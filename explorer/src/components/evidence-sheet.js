import { createElement as node } from "./interface-utils.js";
import { uiIcon } from "./icons.js";

// Move the live evidence panel, preserving listeners, asynchronous results and
// linked selection. Closing restores the same node to its original position.
export function createEvidenceSheet({ root, getApp }) {
  const sheet = node("section", "sheet-modal research-evidence-sheet");
  sheet.setAttribute("aria-label", "Selected evidence");
  const handle = node("div", "sheet-handle"),
    header = node("header", "evidence-sheet-header"),
    title = node("h2"),
    done = node("button", "button button-tonal labelled-icon-action");
  done.type = "button";
  done.append(uiIcon("done"), node("span", "", "Done"));
  const content = node("div", "sheet-modal-inner evidence-sheet-content");
  header.append(title, done);
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
  function inspect(event) {
    const target = event.detail?.target;
    if (!target?.isConnected) return;
    event.stopPropagation();
    title.textContent = event.detail.title || "Selected evidence";
    if (panel === target && instance?.opened) return;
    close(false);
    instance?.destroy();
    panel = target;
    placeholder = document.createComment("Selected evidence");
    target.before(placeholder);
    content.append(target);
    content.scrollTop = 0;
    const container =
      document.fullscreenElement || document.webkitFullscreenElement || root;
    instance = getApp().sheet.create({
      el: sheet,
      containerEl: container,
      backdrop: true,
      push: true,
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
      instance?.destroy();
      root.removeEventListener("atlas:inspect", inspect);
      sheet.remove();
    },
  };
}
