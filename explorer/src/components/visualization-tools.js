import {
  createElement as el,
  createSheetToolbar,
  closeSheet,
  destroySheet,
} from "./interface-utils.js";
import { uiIcon } from "./icons.js";
let toolSectionSequence = 0;

// One F7 interaction contract for molecular, network and spatial renderers.
export function createVisualizationTools({
  surface,
  title = "3D tools",
  clearance = false,
  fullscreenControl = false,
  fullscreenTitle = title,
  showTools = true,
  onResize = () => {},
}) {
  const appRoot = document.querySelector("#psilocin-app"),
    app = appRoot?.f7;
  const fab = el(
      "div",
      `fab fab-right-bottom atlas-3d-fab${clearance ? " atlas-3d-fab-above-tabs" : ""}`,
    ),
    trigger = el("button", "button");
  trigger.type = "button";
  trigger.setAttribute("aria-label", title);
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.append(uiIcon("controls"));
  fab.append(trigger);
  if (showTools) surface.append(fab);
  let fullscreenToolbar, fullscreenButton;
  if (fullscreenControl) {
    fullscreenToolbar = el("div", "figure-toolbar atlas-3d-fullscreen-toolbar");
    const pane = el("div", "toolbar-pane");
    fullscreenButton = el(
      "button",
      "button button-tonal figure-fullscreen f7-press",
    );
    fullscreenButton.type = "button";
    fullscreenButton.setAttribute(
      "aria-label",
      `View ${fullscreenTitle} in full screen`,
    );
    fullscreenButton.append(uiIcon("fullscreen"));
    fullscreenButton.onclick = toggleFullscreen;
    pane.append(fullscreenButton);
    fullscreenToolbar.append(pane);
    surface.append(fullscreenToolbar);
  }
  const content = el("div", "atlas-3d-tools-content");
  const navigation = el("div", "atlas-3d-tools-navigation");
  const shortcuts = el(
    "nav",
    "segmented segmented-strong atlas-3d-tools-shortcuts",
  );
  shortcuts.setAttribute("role", "tablist");
  shortcuts.setAttribute("aria-label", "Quick access to molecular tools");
  const breadcrumbs = el("nav", "breadcrumbs atlas-3d-breadcrumbs");
  breadcrumbs.setAttribute("aria-label", "3D tool location");
  const viewCrumb = el("span", "breadcrumbs-item"),
    viewLink = el("a", "breadcrumbs-item-link", "View");
  viewLink.href = "#";
  viewLink.onclick = (e) => {
    e.preventDefault();
    close();
  };
  viewCrumb.append(viewLink);
  const divider = () => el("span", "breadcrumbs-separator");
  const toolsCrumb = el("span", "breadcrumbs-item"),
    toolsLink = el("a", "breadcrumbs-item-link", "Tools");
  toolsLink.href = "#";
  toolsLink.onclick = (e) => {
    e.preventDefault();
    activateSection(
      sections.find((group) => group.button.style.order === "0") || sections[0],
    );
  };
  toolsCrumb.append(toolsLink);
  const currentCrumb = el(
    "span",
    "breadcrumbs-item breadcrumbs-item-active",
    "View & camera",
  );
  currentCrumb.setAttribute("aria-current", "page");
  breadcrumbs.append(viewCrumb, divider(), toolsCrumb, divider(), currentCrumb);
  navigation.append(breadcrumbs, shortcuts);
  const tabPages = el("div", "tabs atlas-3d-tool-pages");
  content.append(navigation, tabPages);
  let sheet,
    sheetElement,
    popup,
    expanded = false,
    disposed = false,
    previousFocus,
    placeholder;
  const sections = [];
  let activeSection;
  function activateSection(group) {
    if (!group) return;
    activeSection = group;
    for (const other of sections) {
      const active = other === group;
      other.button.classList.toggle("button-active", active);
      other.button.setAttribute("aria-selected", String(active));
      other.button.tabIndex = active ? 0 : -1;
      other.element.setAttribute("aria-hidden", String(!active));
    }
    if (app && group.element.isConnected) app.tab.show(group.element, false);
    else
      for (const other of sections)
        other.element.classList.toggle("tab-active", other === group);
    currentCrumb.textContent = group.name;
    content.closest(".atlas-3d-tools-scroll")?.scrollTo({ top: 0 });
    content.dispatchEvent(new Event("tools:section"));
  }
  function section(
    name,
    { open = false, shortcut, icon = "controls", order = sections.length } = {},
  ) {
    const element = el("section", "tab atlas-3d-tools-section");
    element.id = `atlas-tools-${++toolSectionSequence}`;
    element.setAttribute("role", "tabpanel");
    const heading = el("div", "block-title", name);
    const body = el("div", "atlas-3d-tools-section-body");
    element.append(heading, body);
    tabPages.append(element);
    const button = el("button", "button atlas-3d-tools-shortcut");
    button.id = `${element.id}-tab`;
    button.type = "button";
    button.style.order = String(order);
    button.append(uiIcon(icon), el("span", "", shortcut || name));
    button.setAttribute("role", "tab");
    button.setAttribute("aria-label", `Open ${name}`);
    button.setAttribute("aria-controls", element.id);
    element.setAttribute("aria-labelledby", button.id);
    const group = { name, element, body, button };
    sections.push(group);
    shortcuts.append(button);
    button.onclick = () => activateSection(group);
    if (!activeSection || open) activateSection(group);
    else {
      element.setAttribute("aria-hidden", "true");
      button.setAttribute("aria-selected", "false");
      button.tabIndex = -1;
    }
    return body;
  }
  shortcuts.onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const ordered = [...sections].sort(
      (a, b) => Number(a.button.style.order) - Number(b.button.style.order),
    );
    const index = ordered.indexOf(activeSection),
      next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? ordered.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + ordered.length) %
              ordered.length;
    activateSection(ordered[next]);
    ordered[next].button.focus();
  };
  function action(host, label, callback, icon = "controls") {
    let list = host.lastElementChild;
    if (!list?.classList.contains("atlas-3d-action-list")) {
      list = el(
        "div",
        "list list-strong list-dividers inset atlas-3d-action-list",
      );
      list.append(el("ul"));
      host.append(list);
    }
    const row = el("li"),
      button = el("button", "item-link item-content atlas-3d-tool-action");
    button.type = "button";
    const media = el("span", "item-media"),
      inner = el("span", "item-inner");
    media.append(uiIcon(icon));
    inner.append(el("span", "item-title", label));
    button.append(media, inner);
    row.append(button);
    list.firstChild.append(row);
    button.setAttribute("aria-label", label);
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        await callback();
      } catch (error) {
        let status = host.querySelector(".atlas-3d-tool-error");
        if (!status) {
          status = el("p", "note atlas-3d-tool-error");
          status.setAttribute("role", "status");
          host.append(status);
        }
        status.textContent =
          error.message || "This action is unavailable on this device.";
      } finally {
        if (!disposed) button.disabled = false;
      }
    };
    return button;
  }
  function close() {
    if (sheet && !sheet.destroyed) closeSheet(sheet);
  }
  function cleanupSheet() {
    if (!sheet) return;
    const old = sheet;
    sheet = undefined;
    // Keep reusable Smart Select instances connected between sheet openings.
    content.hidden = true;
    appRoot.append(content);
    sheetElement?.remove();
    sheetElement = undefined;
    destroySheet(old);
    surface.style.removeProperty("--atlas-tools-inset");
    surface.classList.remove("atlas-3d-tools-docked");
    window.removeEventListener("resize", layoutTools);
    onResize();
    trigger.setAttribute("aria-expanded", "false");
    if (previousFocus?.isConnected)
      previousFocus.focus({ preventScroll: true });
  }
  function layoutTools() {
    if (!sheetElement) return;
    const nonmodal = String(matchMedia("(min-width:768px)").matches);
    if (sheet?.opened && sheetElement.dataset.nonmodal !== nonmodal) {
      sheet.close(false);
      requestAnimationFrame(() => {
        if (!disposed) open();
      });
      return;
    }
    const dock =
      surface.querySelector(".molecular-renderer-host") &&
      matchMedia("(min-width:900px)").matches &&
      surface.clientWidth >= 720;
    sheetElement.classList.toggle("atlas-3d-tools-dock", Boolean(dock));
    surface.classList.toggle("atlas-3d-tools-docked", Boolean(dock));
    const previousInset = surface.style.getPropertyValue("--atlas-tools-inset");
    if (dock) {
      const rect = surface.getBoundingClientRect(),
        width = 340;
      const top = expanded ? 76 : Math.max(rect.top + 64, 76),
        bottom = expanded
          ? innerHeight - 12
          : Math.min(rect.bottom, innerHeight - 12);
      const height = Math.max(280, bottom - top);
      Object.assign(sheetElement.style, {
        top: `${top}px`,
        right: `${Math.max(12, innerWidth - rect.right + 12)}px`,
        bottom: "auto",
        width: `${width}px`,
        height: `${height}px`,
      });
      surface.style.setProperty("--atlas-tools-inset", `${width + 24}px`);
    } else {
      sheetElement.removeAttribute("style");
      surface.style.removeProperty("--atlas-tools-inset");
    }
    if (previousInset !== surface.style.getPropertyValue("--atlas-tools-inset"))
      requestAnimationFrame(onResize);
  }
  function open() {
    if (disposed || !app) return;
    if (sheet) {
      sheet.open();
      return;
    }
    expanded = false;
    previousFocus = document.activeElement;
    sheetElement = el(
      "section",
      "sheet-modal research-evidence-sheet atlas-3d-tools-sheet",
    );
    sheetElement.setAttribute("aria-label", title);
    sheetElement.setAttribute("role", "dialog");
    sheetElement.dataset.nonmodal = String(
      matchMedia("(min-width:768px)").matches,
    );
    sheetElement.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    });
    const handle = el("div", "sheet-handle"),
      expand = el("button", "link"),
      done = el("button", "link", "Done");
    expand.type = done.type = "button";
    expand.setAttribute("aria-label", "Expand 3D tools");
    expand.setAttribute("aria-pressed", "false");
    expand.append(uiIcon("fullscreen"));
    expand.onclick = () => {
      expanded = !expanded;
      layoutTools();
      sheetElement.classList.toggle("atlas-3d-tools-expanded", expanded);
      expand.setAttribute(
        "aria-label",
        expanded ? "Collapse 3D tools" : "Expand 3D tools",
      );
      expand.setAttribute("aria-pressed", String(expanded));
      expand.replaceChildren(
        uiIcon(expanded ? "fullscreenExit" : "fullscreen"),
      );
    };
    done.onclick = close;
    const header = createSheetToolbar(title, [expand, done]);
    const inner = el("div", "sheet-modal-inner atlas-3d-tools-scroll");
    content.hidden = false;
    inner.append(content);
    if (activeSection) activateSection(activeSection);
    sheetElement.append(handle, header, inner);
    const container =
      document.fullscreenElement || document.webkitFullscreenElement || appRoot;
    container.append(sheetElement);
    layoutTools();
    window.addEventListener("resize", layoutTools);
    sheet = app.sheet.create({
      el: sheetElement,
      containerEl: container,
      backdrop: matchMedia("(max-width:767px)").matches,
      backdropUnique: true,
      closeByBackdropClick: true,
      swipeToClose: true,
      swipeHandler: handle,
      push: false,
      on: {
        opened() {
          layoutTools();
          content.dispatchEvent(new Event("tools:opened"));
        },
        closed() {
          cleanupSheet();
          content.dispatchEvent(new Event("tools:closed"));
        },
      },
    });
    trigger.setAttribute("aria-expanded", "true");
    sheet.open(!matchMedia("(prefers-reduced-motion:reduce)").matches);
  }
  async function toggleFullscreen() {
    if (sheet) {
      sheet.close(false);
      cleanupSheet();
    }
    if (document.fullscreenElement === surface) {
      await document.exitFullscreen();
      return;
    }
    if (popup) {
      popup.close();
      return;
    }
    if (surface.requestFullscreen) {
      try {
        await surface.requestFullscreen();
        onResize();
        return;
      } catch {
        /* Native fullscreen is optional; the F7 popup preserves the same view. */
      }
    }
    placeholder = el("span");
    surface.before(placeholder);
    const element = el(
      "section",
      "popup popup-tablet-fullscreen atlas-3d-fullscreen-popup",
    );
    element.classList.toggle(
      "atlas-3d-fullscreen-has-control",
      Boolean(fullscreenButton),
    );
    element.setAttribute("aria-label", title);
    const done = el(
      "button",
      "button button-tonal atlas-3d-fullscreen-done",
      "Done",
    );
    done.type = "button";
    done.onclick = () => popup.close();
    element.append(surface, done);
    appRoot.append(element);
    popup = app.popup.create({
      el: element,
      push: false,
      swipeToClose: false,
      closeByBackdropClick: false,
      on: {
        opened: onResize,
        closed() {
          placeholder.replaceWith(surface);
          placeholder = undefined;
          const old = popup;
          popup = undefined;
          element.remove();
          setTimeout(() => old.destroy(), 0);
          syncFullscreenControl();
          onResize();
        },
      },
    });
    popup.open(!matchMedia("(prefers-reduced-motion:reduce)").matches);
    syncFullscreenControl();
  }
  trigger.onclick = open;
  function syncFullscreenControl() {
    const active = document.fullscreenElement === surface || Boolean(popup);
    surface.classList.toggle("atlas-3d-fullscreen", active);
    if (!fullscreenButton) return;
    fullscreenButton.setAttribute(
      "aria-label",
      active ? "Exit full screen" : `View ${fullscreenTitle} in full screen`,
    );
    fullscreenButton.setAttribute("aria-pressed", String(active));
    fullscreenButton.classList.toggle("figure-fullscreen-exit", active);
    fullscreenButton.replaceChildren(uiIcon(active ? "close" : "fullscreen"));
    if (active) fullscreenButton.append(el("span", "", "Close"));
  }
  const fullscreenChanged = () => {
    surface.classList.toggle(
      "atlas-3d-fullscreen",
      document.fullscreenElement === surface,
    );
    syncFullscreenControl();
    layoutTools();
    onResize();
  };
  document.addEventListener("fullscreenchange", fullscreenChanged);
  return {
    element: fab,
    content,
    section,
    action,
    open,
    close,
    toggleFullscreen,
    async afterClose(callback) {
      close();
      return callback();
    },
    dispose() {
      disposed = true;
      document.removeEventListener("fullscreenchange", fullscreenChanged);
      if (sheet) {
        sheet.close(false);
        cleanupSheet();
      }
      if (popup) popup.close(false);
      fab.remove();
      fullscreenToolbar?.remove();
      content.remove();
    },
  };
}
