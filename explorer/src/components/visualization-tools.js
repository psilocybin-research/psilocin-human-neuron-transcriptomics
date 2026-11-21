import {
  createElement as el,
  createAccordion,
  closeSheet,
  destroySheet,
} from "./interface-utils.js";
import { uiIcon } from "./icons.js";

// One F7 interaction contract for molecular, network and spatial renderers.
export function createVisualizationTools({
  surface,
  title = "3D tools",
  clearance = false,
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
  surface.append(fab);
  const content = el("div", "atlas-3d-tools-content");
  const navigation = el("div", "atlas-3d-tools-navigation");
  const shortcuts = el(
    "nav",
    "segmented segmented-raised atlas-3d-tools-shortcuts",
  );
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
  const divider = () => el("span", "breadcrumbs-item-divider");
  const toolsCrumb = el("span", "breadcrumbs-item"),
    toolsLink = el("a", "breadcrumbs-item-link", "Tools");
  toolsLink.href = "#";
  toolsLink.onclick = (e) => {
    e.preventDefault();
    content.closest(".atlas-3d-tools-scroll")?.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
        ? "instant"
        : "smooth",
    });
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
  content.append(navigation);
  let sheet,
    sheetElement,
    popup,
    expanded = false,
    disposed = false,
    previousFocus,
    placeholder;
  const sections = [];
  function section(name, { open = false, shortcut, icon = "controls" } = {}) {
    const group = createAccordion(name, "atlas-3d-tools-section");
    const item = group.element.querySelector(".accordion-item");
    const toggle = group.element.querySelector(".gene-annotation-toggle");
    const panel = group.element.querySelector(".accordion-item-content");
    content.append(group.element);
    if (open) {
      item.classList.add("accordion-item-opened");
      toggle.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");
    }
    group.element.addEventListener("accordion:opened", () => {
      currentCrumb.textContent = name;
    });
    if (shortcut) {
      const button = el("button", "button atlas-3d-tools-shortcut");
      button.type = "button";
      button.append(uiIcon(icon), el("span", "", shortcut));
      button.setAttribute("aria-label", `Open ${name}`);
      button.setAttribute("aria-controls", panel.id);
      button.setAttribute("aria-expanded", String(open));
      const scrollToSection = () => {
        const scroll = content.closest(".atlas-3d-tools-scroll");
        if (!scroll) return;
        scroll.scrollTo({
          top:
            scroll.scrollTop +
            group.element.getBoundingClientRect().top -
            scroll.getBoundingClientRect().top -
            navigation.offsetHeight -
            8,
          behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
            ? "instant"
            : "smooth",
        });
      };
      button.onclick = () => {
        currentCrumb.textContent = name;
        if (item.classList.contains("accordion-item-opened")) scrollToSection();
        else {
          item.addEventListener("accordion:opened", scrollToSection, {
            once: true,
          });
          app.accordion.open(item);
        }
      };
      item.addEventListener("accordion:open", () =>
        button.setAttribute("aria-expanded", "true"),
      );
      item.addEventListener("accordion:close", () =>
        button.setAttribute("aria-expanded", "false"),
      );
      shortcuts.append(button);
    }
    sections.push(group);
    return group.body;
  }
  function action(host, label, callback, icon = "controls") {
    const button = el("button", "button button-tonal atlas-3d-tool-action");
    button.type = "button";
    button.append(uiIcon(icon), el("span", "", label));
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
    host.append(button);
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
    trigger.setAttribute("aria-expanded", "false");
    if (previousFocus?.isConnected)
      previousFocus.focus({ preventScroll: true });
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
    const handle = el("div", "sheet-handle"),
      header = el("header", "evidence-sheet-header"),
      heading = el("h2", "", title),
      expand = el("button", "button button-tonal"),
      done = el("button", "button button-tonal", "Done");
    expand.type = done.type = "button";
    expand.setAttribute("aria-label", "Expand 3D tools");
    expand.setAttribute("aria-pressed", "false");
    expand.append(uiIcon("fullscreen"));
    expand.onclick = () => {
      expanded = !expanded;
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
    header.append(heading, expand, done);
    const inner = el("div", "sheet-modal-inner atlas-3d-tools-scroll");
    content.hidden = false;
    inner.append(content);
    sheetElement.append(handle, header, inner);
    const container =
      document.fullscreenElement || document.webkitFullscreenElement || appRoot;
    container.append(sheetElement);
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
    const element = el("section", "popup atlas-3d-fullscreen-popup");
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
          onResize();
        },
      },
    });
    popup.open(!matchMedia("(prefers-reduced-motion:reduce)").matches);
  }
  trigger.onclick = open;
  const fullscreenChanged = () => {
    surface.classList.toggle(
      "atlas-3d-fullscreen",
      document.fullscreenElement === surface,
    );
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
      content.remove();
    },
  };
}
