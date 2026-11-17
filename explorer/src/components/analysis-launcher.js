import { createElement as node } from "./interface-utils.js";
import { uiIcon } from "./icons.js";

// Native F7 FAB morph, matching its selector-panel example. Scientific controls
// are moved into the target temporarily; their state and event handlers survive.
export function createAnalysisLauncher({
  root,
  desktopButton,
  openControls,
  getApp,
  prepareControls,
  restoreControls,
  onOpen,
  onOpened,
  onClosed,
}) {
  const mobile = matchMedia("(max-width:1179px)"),
    motion = matchMedia("(prefers-reduced-motion: reduce)");
  const fab = node(
    "div",
    "fab fab-left-bottom fab-extended fab-morph analysis-fab",
  );
  const trigger = node("a", "analysis-fab-action f7-press external");
  trigger.tabIndex = 0;
  trigger.setAttribute("role", "button");
  trigger.setAttribute("aria-label", "Analysis controls");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "analysis-morph-panel");
  trigger.title = "Analysis controls";
  trigger.append(uiIcon("controls"));
  trigger.onclick = (event) => {
    event.preventF7Router = true;
    event.stopPropagation();
    openControls(event);
  };
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      trigger.click();
    }
  });
  fab.append(trigger);
  const backdrop = node("div", "fab-backdrop analysis-fab-backdrop");
  backdrop.onpointerdown = (event) => {
    event.stopPropagation();
    close();
  };
  const panel = node("section", "analysis-morph-panel fab-morph-target");
  panel.id = "analysis-morph-panel";
  panel.setAttribute("aria-label", "Analysis controls");
  const header = node("header", "analysis-morph-header"),
    done = node("button", "button button-tonal labelled-icon-action f7-press");
  done.type = "button";
  done.append(uiIcon("done"), node("span", "", "Done"));
  done.onclick = () => close();
  header.append(node("h2", "", "Analysis controls"), done);
  const body = node("div", "analysis-sheet-body analysis-morph-body");
  panel.append(header, body);
  root.append(backdrop, fab, panel);
  desktopButton.classList.add("desktop-analysis-controls");
  desktopButton.setAttribute("aria-haspopup", "dialog");
  desktopButton.setAttribute("aria-controls", "analysis-controls-sheet");
  let available = false,
    state = "closed",
    timer,
    visibilityTimer,
    pendingClose = false,
    opener;
  const reduced = () => motion.matches || root.dataset.reducedMotion === "true";
  const fullscreen = () => {
    const element =
      document.fullscreenElement || document.webkitFullscreenElement;
    return Boolean(element && element !== root && !element.contains(root));
  };
  const showing = () =>
    available &&
    mobile.matches &&
    !fullscreen() &&
    (root.dataset.modalOpen !== "true" || state !== "closed");
  function sync() {
    const visible = showing();
    if (fab.dataset.visible !== String(visible)) {
      clearTimeout(visibilityTimer);
      fab.dataset.visibilityMotion = visible && !reduced() ? "enter" : "";
      visibilityTimer = setTimeout(() => {
        fab.dataset.visibilityMotion = "";
      }, 240);
    }
    fab.dataset.visible = String(visible);
    root.dataset.analysisLauncherVisible = String(
      visible && state === "closed",
    );
    fab.inert = !visible || state !== "closed";
    fab.setAttribute("aria-hidden", String(!visible || state !== "closed"));
    desktopButton.hidden = false;
    desktopButton.disabled = !available;
    desktopButton.dataset.available = String(available);
    desktopButton.setAttribute("aria-hidden", String(!available));
    root.dataset.analysisAvailable = String(available);
    if (!mobile.matches && state !== "closed") close(false);
  }
  function cleanup() {
    const app = getApp();
    if (fab.classList.contains("fab-opened")) app?.fab.close(fab);
    app?.$(fab).off("transitionend");
    fab.classList.remove("fab-opened");
    fab.removeAttribute("style");
    panel.classList.remove("fab-morph-target-visible");
    panel.removeAttribute("style");
    backdrop.classList.remove("backdrop-in");
  }
  function finishOpen() {
    if (state !== "opening") return;
    clearTimeout(timer);
    state = "open";
    if (pendingClose) {
      close();
      return;
    }
    panel.inert = false;
    onOpened(panel);
  }
  function finishClose() {
    if (state === "closed") return;
    clearTimeout(timer);
    state = "closing";
    cleanup();
    clearTimeout(timer);
    state = "closed";
    pendingClose = false;
    panel.classList.remove("modal-in");
    panel.inert = true;
    restoreControls();
    body.replaceChildren();
    onClosed(panel);
    sync();
  }
  function open(event) {
    if (!mobile.matches || !available || state !== "closed" || !getApp())
      return false;
    if (!prepareControls(body)) return false;
    opener =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : document.activeElement;
    clearTimeout(visibilityTimer);
    fab.dataset.visibilityMotion = "";
    state = "opening";
    panel.classList.add("modal-in");
    panel.inert = true;
    panel.f7Modal = { el: panel, close };
    onOpen(panel, opener);
    sync();
    if (reduced()) {
      panel.classList.add("fab-morph-target-visible");
      fab.style.opacity = "0";
      backdrop.classList.add("backdrop-in");
      finishOpen();
    } else {
      getApp().fab.open(fab, panel);
      timer = setTimeout(finishOpen, 700);
    }
    return true;
  }
  function close(animate = true) {
    if (state === "closed" || state === "closing") return;
    if (state === "opening" && animate) {
      pendingClose = true;
      return;
    }
    if (!animate || reduced() || !fab.classList.contains("fab-opened")) {
      finishClose();
      return;
    }
    state = "closing";
    panel.inert = true;
    getApp().fab.close(fab);
    timer = setTimeout(finishClose, 700);
  }
  fab.addEventListener("fab:close", () => {
    if (state === "open" || state === "opening") {
      clearTimeout(timer);
      state = "closing";
      panel.inert = true;
      timer = setTimeout(finishClose, 700);
    }
  });
  panel.addEventListener("transitionend", (event) => {
    if (
      event.target === panel &&
      state === "opening" &&
      panel.style.opacity === "1" &&
      fab.style.opacity === "0"
    )
      finishOpen();
  });
  const observer = new MutationObserver(() => {
    if (
      state === "closing" &&
      !panel.classList.contains("fab-morph-target-visible")
    )
      finishClose();
  });
  observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
  mobile.addEventListener("change", sync);
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  sync();
  return {
    open,
    close,
    sync,
    panel,
    body,
    setAvailable(value) {
      available = Boolean(value);
      sync();
    },
    destroy() {
      close(false);
      clearTimeout(timer);
      clearTimeout(visibilityTimer);
      observer.disconnect();
      mobile.removeEventListener("change", sync);
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      cleanup();
      fab.remove();
      backdrop.remove();
      panel.remove();
    },
  };
}
