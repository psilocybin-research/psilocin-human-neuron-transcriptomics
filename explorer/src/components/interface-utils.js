// Small shared interface primitives; preferences are optional when browser storage is unavailable.
export function createElement(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
// Native F7 iOS preloader markup, shared by transient loading messages.
export function setLoadingMessage(host, text) {
  const spinner = createElement("span", "preloader");
  spinner.setAttribute("aria-hidden", "true");
  const inner = createElement("span", "preloader-inner");
  for (let i = 0; i < 8; i++)
    inner.append(createElement("span", "preloader-inner-line"));
  spinner.append(inner);
  host.classList.add("inline-loading");
  host.replaceChildren(spinner, createElement("span", "", text));
  return host;
}
export function loadingMessage(text) {
  return setLoadingMessage(createElement("p", "note"), text);
}
export function readPreference(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}
export function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
export function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// F7 9.3 swipe listeners register cleanup on sheetDestroy, while the generic
// modal destroy method emits sheetBeforeDestroy only. Release them first.
export function destroySheet(instance) {
  if (!instance || instance.destroyed) return;
  instance.emit("sheetDestroy", instance);
  instance.destroy();
}

// Bottom sheets consistently use native F7 push motion.
export function useModalPush() {
  return true;
}

export function showResearchEvidence(target, title) {
  target.dispatchEvent(
    new CustomEvent("atlas:inspect", {
      bubbles: true,
      detail: { target, title },
    }),
  );
}

export function prepareExternalLinks(root) {
  for (const link of root.querySelectorAll("a[href]")) {
    const url = new URL(link.href, location.href);
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin)
      continue;
    link.target = "_blank";
    link.relList.add("noopener", "noreferrer");
    link.classList.add("external");
  }
}

// Native title bubbles look different across browsers and can linger over an
// adjacent control.  On precision-pointer devices, give every ordinary hint
// one Framework7 iOS tooltip instead. Touch users retain clear visible labels
// and aria names, rather than receiving hover-only UI.
export function installFramework7Tooltips(root, app) {
  if (!app?.tooltip || !matchMedia("(hover: hover) and (pointer: fine)").matches)
    return () => {};
  const instances = new Set();
  const attach = (target) => {
    if (!(target instanceof Element) || target.dataset.f7TooltipManaged === "true") return;
    const text = target.getAttribute("title")?.trim();
    if (!text) return;
    target.dataset.f7TooltipManaged = "true";
    target.removeAttribute("title");
    if (!target.getAttribute("aria-label") && !target.textContent.trim())
      target.setAttribute("aria-label", text);
    const instance = app.tooltip.create({
      targetEl: target,
      text,
      trigger: "hover",
      cssClass: "atlas-f7-tooltip",
    });
    instances.add(instance);
  };
  const scan = (scope) => {
    if (scope instanceof Element && scope.hasAttribute("title")) attach(scope);
    scope.querySelectorAll?.("[title]").forEach(attach);
  };
  scan(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") attach(record.target);
      else record.addedNodes.forEach(scan);
    }
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["title"] });
  return () => {
    observer.disconnect();
    instances.forEach((instance) => instance.destroy());
    instances.clear();
  };
}

let accordionSequence = 0;
export function createAccordion(title, className = "") {
  const element = createElement(
    "div",
    `list list-strong list-dividers ${className}`,
  );
  const list = createElement("ul"),
    item = createElement("li", "accordion-item");
  const toggle = createElement(
    "button",
    "item-link item-content gene-annotation-toggle f7-press",
  );
  const inner = createElement("span", "item-inner");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  inner.append(createElement("span", "item-title", title));
  toggle.append(inner);
  const content = createElement("div", "accordion-item-content");
  content.id = `research-accordion-${++accordionSequence}`;
  content.setAttribute("aria-hidden", "true");
  toggle.setAttribute("aria-controls", content.id);
  const body = createElement("div", "gene-annotation-body");
  content.append(body);
  item.append(toggle, content);
  list.append(item);
  element.append(list);
  item.addEventListener("accordion:open", () =>
    toggle.setAttribute("aria-expanded", "true"),
  );
  item.addEventListener("accordion:close", () =>
    toggle.setAttribute("aria-expanded", "false"),
  );
  return { element, body };
}

// Closing during the opening transition must finish synchronously: otherwise
// cancelling that transition can leave F7 waiting for an event that never fires.
export function closeSheet(instance) {
  instance?.close(instance.el?.dataset.shellModalReady === 'true' ? undefined : false);
}
