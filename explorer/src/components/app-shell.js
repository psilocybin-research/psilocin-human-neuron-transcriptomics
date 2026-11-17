import { createEvidenceSheet } from "./evidence-sheet.js";
import { analysisOptions } from "./analysis-options.js";
import { showInformation } from "./file-download.js";
import { createAppProgress } from "./app-progress.js";
import { beginActivity, afterPaint } from "./app-activity.js";
import { createAnalysisLauncher } from "./analysis-launcher.js";
import {
  createElement as node,
  readPreference as stored,
  writePreference as remember,
  escapeHTML,
} from "./interface-utils.js";
import { createResearchNavigation } from "./research-navigation.js";
import { createGeneAutocomplete, geneSuggestions } from "./gene-suggestions.js";
import { createPathwayAutocomplete } from "./pathway-autocomplete.js";
import { uiIcon } from "./icons.js";
import { themeScientificPlots } from "./plot-theme.js";
import { createAtlasTour } from "./atlas-tour.js";
// Framework7 owns interface components; scientific views retain their own data state.
function action(text, fn, cls = "button button-tonal", iconKind) {
  const b = node("button", cls, text);
  b.type = "button";
  b.onclick = fn;
  if (iconKind) {
    b.replaceChildren(uiIcon(iconKind), node("span", "", text));
    b.classList.add("labelled-icon-action");
  }
  return b;
}
function iconAction(title, key, fn) {
  const b = action("", fn, "button button-round shell-icon");
  b.setAttribute("aria-label", title);
  b.title = title;
  b.append(uiIcon(key));
  return b;
}
const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const reduced = () => motionPreference.matches;

export function createAppShell({
  root,
  Framework7,
  top,
  nav,
  body,
  footer,
  share,
  menuToggle,
  tabs,
  go,
  getGenes,
  data,
  notices,
  plotNotices,
  initial,
  enhanceFigures,
}) {
  root.id = "psilocin-app";
  root.dataset.inputModality = "pointer";
  root.classList.add("research-app");
  const panel = node("aside", "panel panel-left panel-cover research-sidebar");
  panel.id = "research-sidebar";
  panel.setAttribute("aria-label", "Research navigation");
  const sidebarHead = node("div", "sidebar-brand");
  sidebarHead.append(
    node("span", "brand-symbol", "ψ"),
    node("div", "sidebar-brand-text", "Psilocin atlas"),
  );
  const brandSymbol = sidebarHead.querySelector(".brand-symbol");
  brandSymbol.textContent = "";
  brandSymbol.innerHTML =
    '<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M16 5v22M6 7c1 1 1 3 1 6v2c0 8 18 8 18 0v-2c0-3 0-5 1-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const sidebarSub = node(
    "p",
    "sidebar-subtitle",
    "Human-neuron transcriptomics",
  );
  let app,
    view,
    panelInstance,
    controlsSheet,
    sourcePopup,
    autocomplete,
    tourPopup,
    sharePopover;
  function safeClose(instance) {
    if (instance)
      instance.close(
        !reduced() && instance.el?.dataset.shellModalReady === "true",
      );
  }
  function toggleNavigation() {
    if (!panelInstance) return;
    root.dataset.sidebarAnimated = "true";
    panelInstance.toggle(!reduced());
    if (app.width >= 1180) {
      remember(
        "atlas-sidebar",
        panelInstance.visibleBreakpointDisabled ? "collapsed" : "expanded",
      );
      if (panelInstance.visibleBreakpointDisabled)
        menuToggle.focus({ preventScroll: true });
    }
  }
  nav.className = "list menu-list research-nav";
  nav.setAttribute("aria-label", "Explorer sections");
  const navigation = createResearchNavigation({ nav, tabs, initial });

  const sidebarNote = node("div", "sidebar-note");
  sidebarNote.append(
    node("span", "badge", "Fixed results · v1.2.0"),
    node("p", "", "Independent reanalysis of Schmidt et al. (2026)."),
  );
  const sidebarFoot = node("div", "sidebar-footer");
  sidebarFoot.append(
    action("Atlas tour", openTour, "button button-tonal"),
    action(
      "Sources & citation",
      () => sourcePopup?.open(!reduced()),
      "button button-tonal",
    ),
  );
  panel.append(sidebarHead, sidebarSub, nav, sidebarNote, sidebarFoot);
  const views = node("div", "views research-views"),
    main = node("div", "view view-main research-main"),
    page = node("div", "page page-current research-page");
  page.dataset.name = "atlas";
  const navbar = node("header", "navbar research-navbar"),
    navbg = node("div", "navbar-bg"),
    navinner = node("div", "navbar-inner");
  const left = node("div", "left");
  menuToggle.className = "button button-round shell-icon";
  menuToggle.replaceChildren(uiIcon("menu"));
  menuToggle.onclick = toggleNavigation;
  menuToggle.setAttribute("aria-controls", panel.id);
  menuToggle.setAttribute("aria-label", "Open section menu");
  menuToggle.setAttribute("aria-expanded", "false");
  left.append(menuToggle);
  const titles = node("div", "title research-navbar-title"),
    sectionTitle = node("span", "", ""),
    subtitle = node("small", "", "Psilocin · human cortical neurons");
  const titleGlass = node("div", "research-title-glass");
  titleGlass.append(sectionTitle, subtitle);
  titles.append(titleGlass);
  const right = node("div", "right");
  const find = iconAction("Find a gene", "search", () => autocomplete?.open());
  find.classList.add("desktop-gene-finder");
  const controlButton = iconAction(
    "Analysis controls",
    "controls",
    openControls,
  );
  controlButton.hidden = true;
  const appearanceButton = iconAction(
    "Dark mode",
    "appearance",
    toggleAppearance,
  );
  appearanceButton.classList.add("appearance-toggle");
  appearanceButton.setAttribute("role", "switch");
  const sourcesButton = iconAction("Sources", "book", () =>
    sourcePopup?.open(!reduced()),
  );
  sourcesButton.classList.add("desktop-sources");
  const shareControl = iconAction("Share analysis", "share", () =>
    sharePopover?.open(shareControl, !reduced()),
  );
  shareControl.setAttribute("aria-haspopup", "dialog");
  const fullscreenButton = iconAction(
    "Enter fullscreen",
    "fullscreen",
    async () => {
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) await document.exitFullscreen();
          else document.webkitExitFullscreen?.();
        } else if (root.requestFullscreen) await root.requestFullscreen();
        else root.webkitRequestFullscreen?.();
      } catch {
        app?.toast
          .create({
            text: "Fullscreen is unavailable in this browser window.",
            closeTimeout: 3000,
          })
          .open();
      }
    },
  );
  fullscreenButton.classList.add("app-fullscreen-toggle");
  fullscreenButton.hidden = !(
    (document.fullscreenEnabled && root.requestFullscreen) ||
    (document.webkitFullscreenEnabled && root.webkitRequestFullscreen)
  );
  function syncFullscreenButton() {
    const active = Boolean(
      document.fullscreenElement || document.webkitFullscreenElement,
    );
    fullscreenButton.setAttribute(
      "aria-label",
      active ? "Exit fullscreen" : "Enter fullscreen",
    );
    fullscreenButton.setAttribute("aria-pressed", String(active));
    fullscreenButton.title = active ? "Exit fullscreen" : "Enter fullscreen";
    fullscreenButton.replaceChildren(
      uiIcon(active ? "fullscreenExit" : "fullscreen"),
    );
  }
  document.addEventListener("fullscreenchange", syncFullscreenButton);
  document.addEventListener("webkitfullscreenchange", syncFullscreenButton);
  syncFullscreenButton();
  right.append(
    controlButton,
    find,
    appearanceButton,
    shareControl,
    sourcesButton,
    fullscreenButton,
  );
  navinner.append(left, titles, right);
  navbar.append(navbg, navinner);
  const scroll = node("div", "page-content research-scroll");
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", "Scientific evidence workspace");
  scroll.id = "research-content";
  const content = node("div", "research-content-inner");
  content.append(body, footer);
  scroll.append(content);
  const bottom = node(
    "nav",
    "toolbar toolbar-bottom tabbar tabbar-labels research-tabbar",
  );
  bottom.setAttribute("aria-label", "Quick research navigation");
  const bottomInner = node("div", "toolbar-inner"),
    bottomPane = node("div", "toolbar-pane");
  bottomInner.append(bottomPane);
  const quick = [];
  for (const [id, title] of [
    ["sources", "Sources"],
    ["genes", "Genes"],
    ["pathways", "Pathways"],
    ["comparison", "Compare"],
  ]) {
    const b = action(
      "",
      () => (id === "sources" ? sourcePopup?.open(!reduced()) : go(id)),
      "tab-link",
    );
    b.setAttribute(
      "aria-label",
      id === "sources" ? "Sources" : `Open ${tabs.find((t) => t[0] === id)[1]}`,
    );
    const source =
      id === "sources"
        ? uiIcon("book")
        : nav.querySelector(`[data-section="${id}"] svg`).cloneNode(true);
    if (id === "sources") b.setAttribute("aria-haspopup", "dialog");
    b.append(source, node("span", "tabbar-label", title));
    b.dataset.quick = id;
    bottomPane.append(b);
    quick.push(b);
  }
  bottom.append(bottomInner);
  page.append(navbar, scroll, bottom);
  const progress = createAppProgress({
    root,
    page,
    navbar,
    scroll,
    content,
    getApp: () => app,
  });
  let finishRendering;
  main.append(page);
  views.append(main);
  root.replaceChildren(panel, views);
  const analysisLauncher = createAnalysisLauncher({
    root,
    desktopButton: controlButton,
    openControls,
    getApp: () => app,
    prepareControls,
    restoreControls: closeControls,
    onOpen: (el, opener) => {
      modalOpen({ target: el });
      returnFocus.set(el, opener);
    },
    onOpened: (el) => modalOpened({ target: el }),
    onClosed: (el) => modalClosed({ target: el }),
  });
  const source = node("div", "popup research-sources");
  source.setAttribute("aria-label", "Sources and citation");
  const sourcePage = node("div", "sources-layout");
  const sourceBar = node("header", "sources-header");
  const sourceClose = action(
    "",
    () => safeClose(sourcePopup),
    "button button-tonal sources-close",
  );
  sourceClose.setAttribute("aria-label", "Close sources");
  sourceClose.append(uiIcon("close"), node("span", "", "Close"));
  sourceBar.append(node("h2", "", "Sources & citation"), sourceClose);
  const sourceScroll = node("div", "sources-content");
  sourceScroll.append(top);
  const license = node(
    "a",
    "external ui-license",
    "Interface runtime licences",
  );
  license.href = notices;
  license.target = "_blank";
  license.rel = "noopener";
  sourceScroll.append(license);
  const plotLicense = node(
    "a",
    "external ui-license",
    "Scientific plotting runtime licences",
  );
  plotLicense.href = plotNotices;
  plotLicense.target = "_blank";
  plotLicense.rel = "noopener";
  sourceScroll.append(plotLicense);
  sourcePage.append(sourceBar, sourceScroll);
  source.append(sourcePage);
  root.append(source);
  const sheet = node("div", "sheet-modal analysis-control-sheet");
  sheet.id = "analysis-controls-sheet";
  sheet.setAttribute("aria-label", "Analysis controls");
  const handle = node("div", "sheet-handle");
  const sheetBar = node("div", "toolbar"),
    sheetInner = node("div", "toolbar-inner");
  sheetInner.append(
    node("strong", "", "Analysis controls"),
    action(
      "Done",
      () => safeClose(controlsSheet),
      "button button-tonal",
      "done",
    ),
  );
  sheetBar.append(sheetInner);
  const sheetContent = node("div", "sheet-modal-inner"),
    sheetBody = node("div", "analysis-sheet-body");
  sheetContent.append(sheetBody);
  sheet.append(handle, sheetBar, sheetContent);
  root.append(sheet);
  const shareButton = share;
  shareButton.className = "button button-tonal native-share";
  const copyLink = action(
    "Copy analysis link",
    async () => {
      sharePopover?.close(false);
      try {
        await navigator.clipboard.writeText(location.href);
        app.toast
          .create({
            text: "Analysis link copied.",
            position: "bottom",
            closeTimeout: 2200,
            destroyOnClose: true,
          })
          .open();
      } catch {
        showInformation(
          app,
          "Analysis link",
          "Your browser could not copy the link. Use Share or copy the address from the address bar.",
        );
      }
    },
    "button button-tonal",
    "copy",
  );
  const shareMenu = node("div", "popover share-popover");
  shareMenu.setAttribute("aria-label", "Share analysis");
  const shareInner = node("div", "popover-inner");
  shareInner.append(
    node("h3", "", "Share analysis"),
    shareButton,
    copyLink,
    action(
      "Done",
      () => safeClose(sharePopover),
      "button button-tonal",
      "done",
    ),
  );
  shareMenu.append(shareInner);
  root.append(shareMenu);
  const nativeShareHandler = shareButton.onclick;
  shareButton.onclick = (event) => {
    sharePopover?.close(false);
    nativeShareHandler?.call(shareButton, event);
  };
  function syncAppearance() {
    const dark = Boolean(app?.darkMode);
    appearanceButton.title = `Switch to ${dark ? "light" : "dark"} mode`;
    appearanceButton.setAttribute("aria-checked", String(dark));
    appearanceButton
      .querySelector("svg")
      ?.replaceWith(uiIcon(dark ? "sun" : "appearance"));
  }

  function toggleAppearance() {
    if (!app) return;
    const dark = !app.darkMode;
    remember("atlas-appearance", dark ? "dark" : "light");
    app.setDarkMode(dark);
    syncAppearance();
  }
  const syncMotion = () => {
    root.dataset.reducedMotion = String(reduced());
    if (app)
      for (const name of ["popup", "popover", "sheet"])
        app.params[name].animate = !reduced();
  };
  motionPreference.addEventListener("change", syncMotion);
  let disposed = false,
    lastTab = initial,
    viewTransitionPending = false,
    controlMoves = [],
    enhanceFrame,
    querySequence = 0,
    resultScrollPending = false;
  const pathwaySuggestions = new Set(),
    suggestionInputs = new WeakSet();
  const smartInstances = new Set(),
    smartNodes = new WeakMap(),
    modalStack = [],
    returnFocus = new WeakMap();
  function closeControls() {
    for (const { element, placeholder, inline } of [
      ...controlMoves,
    ].reverse()) {
      if (inline) element.hidden = false;
      if (placeholder.isConnected) placeholder.replaceWith(element);
    }
    controlMoves = [];
    sheetBody.replaceChildren();
  }
  function prepareControls(host) {
    closeControls();
    const candidates = [
      ...body.querySelectorAll(
        ":scope>.controls,:scope>.comparison-controls,.comparative-views>.comparison-controls,.pathway-explorer .tree-toolbar",
      ),
    ];
    if (!candidates.length) {
      app.toast
        .create({
          text: "Controls are located beside the relevant figure.",
          closeTimeout: 2500,
          position: "bottom",
          destroyOnClose: true,
        })
        .open();
      return false;
    }
    for (const element of candidates) {
      const placeholder = node("div", "controls-placeholder");
      element.before(placeholder);
      host.append(element);
      controlMoves.push({ element, placeholder });
    }
    host.classList.toggle(
      "analysis-options-single",
      host.querySelectorAll("select").length === 1,
    );
    for (const select of host.querySelectorAll("select")) {
      const original = select.closest(".control,.tree-member-control");
      if (!original) continue;
      const options = analysisOptions(select);
      original.before(options);
      original.hidden = true;
      controlMoves.push({
        element: original,
        placeholder: options,
        inline: true,
      });
    }
    return true;
  }
  function openControls(event) {
    if (!app) return;
    if (analysisLauncher.open(event)) return;
    if (app.width < 1180) return;
    const opener =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : document.activeElement;
    if (!prepareControls(sheetBody)) return;
    controlsSheet.open(!reduced());
    returnFocus.set(sheet, opener);
  }
  function update(tab) {
    navigation.activate(tab, app);
    if (tab !== lastTab) {
      lastTab = tab;
      viewTransitionPending = Boolean(app) && !reduced();
      scroll.scrollTop = 0;
    }
    sectionTitle.textContent = tabs.find((t) => t[0] === tab)?.[1] || "Atlas";
    for (const b of quick) {
      const active = b.dataset.quick === tab;
      b.classList.toggle("tab-link-active", active);
      b.setAttribute("aria-current", active ? "page" : "false");
    }
    if (
      panelInstance?.opened &&
      !panel.classList.contains("panel-in-breakpoint")
    )
      safeClose(panelInstance);
    scheduleEnhance();
  }
  function scrollToUpdatedResult() {
    if (!resultScrollPending || modalStack.length || !body.isConnected) return;
    const network = body.querySelector(".overlap-network .network-content");
    const target =
      network?.closest(".figure-shell") ||
      network?.querySelector(".figure-shell") ||
      body.querySelector(".comparative-views .figure-shell") ||
      body.querySelector(".figure-shell") ||
      body.querySelector(
        ".tree-canvas,.gene-detail,.comparison-plot,.plot-viewport",
      );
    if (!target || !target.getClientRects().length) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      resultScrollPending = false;
      return;
    }
    const rect = target.getBoundingClientRect();
    const top = navbar.getBoundingClientRect().bottom + 8;
    const bottomEdge = bottom.getClientRects().length
      ? bottom.getBoundingClientRect().top
      : innerHeight;
    if (
      rect.top >= top &&
      rect.top < top + 120 &&
      Math.min(rect.bottom, rect.top + 200) <= bottomEdge
    ) {
      resultScrollPending = false;
      return;
    }
    requestAnimationFrame(() => {
      if (!target.isConnected) {
        scheduleEnhance();
        return;
      }
      resultScrollPending = false;
      target.scrollIntoView({ block: "start", behavior: "instant" });
      const offset =
        target.getBoundingClientRect().top -
        navbar.getBoundingClientRect().bottom -
        12;
      scroll.scrollTo({
        top: scroll.scrollTop + offset,
        behavior: reduced() ? "instant" : "smooth",
      });
    });
  }
  function analysisControlChanged(event) {
    const target = event.target;
    if (
      !(target instanceof HTMLElement) ||
      !target.matches(
        "select,input[type=radio],input[type=checkbox],input[type=range]",
      ) ||
      !target.closest(
        ".controls,.comparison-controls,.tree-toolbar,.network-options,.chord-set-picker,.comparison-plot .control",
      )
    )
      return;
    const finish = beginActivity("Updating analysis");
    afterPaint(finish);
    resultScrollPending = true;
    queueMicrotask(() => {
      analysisLauncher.close();
      if (controlsSheet?.opened) safeClose(controlsSheet);
      scheduleEnhance();
    });
  }
  root.addEventListener("change", analysisControlChanged, true);
  function scheduleEnhance() {
    if (enhanceFrame) return;
    enhanceFrame = requestAnimationFrame(() => {
      enhanceFrame = 0;
      enhance();
      scrollToUpdatedResult();
    });
  }
  function enhance() {
    if (!app) return;
    enhanceFigures?.(body);
    themeScientificPlots(body);
    root.dataset.reducedMotion = String(reduced());
    for (const el of root.querySelectorAll(
      "button:not(.matrix-cell),.overview-source-link,summary.tree-focus,.research-smart-select,.item-radio,.item-checkbox",
    )) {
      el.classList.add("f7-press");
      if (getComputedStyle(el).position === "static")
        el.classList.add("f7-press-anchor");
    }
    for (const instance of smartInstances) {
      if (!instance.el?.isConnected && !instance.opened) {
        instance.destroy();
        smartInstances.delete(instance);
      }
    }
    for (const controller of pathwaySuggestions)
      if (!controller.input.isConnected) {
        controller.destroy();
        pathwaySuggestions.delete(controller);
      }
    for (const input of [
      ...body.querySelectorAll(".tree-search input"),
      ...sheetBody.querySelectorAll(".tree-search input"),
      ...analysisLauncher.body.querySelectorAll(".tree-search input"),
    ])
      if (!suggestionInputs.has(input)) {
        suggestionInputs.add(input);
        pathwaySuggestions.add(
          createPathwayAutocomplete({ app, input, data, getGenes, root }),
        );
      }
    for (const input of body.querySelectorAll("input[data-gene-suggestions]"))
      if (input.atlasGeneSuggestions && !suggestionInputs.has(input)) {
        suggestionInputs.add(input);
        pathwaySuggestions.add(createGeneAutocomplete({ app, input, data }));
      }
    for (const select of [
      ...body.querySelectorAll("select"),
      ...sheetBody.querySelectorAll("select"),
      ...analysisLauncher.body.querySelectorAll("select"),
    ]) {
      if (smartNodes.has(select) || select.multiple) continue;
      const hadFocus = document.activeElement === select;
      const title =
        select.getAttribute("aria-label") ||
        select.closest("label")?.querySelector("span")?.textContent ||
        "Select an option";
      const wrap = node("span", "smart-select item-link research-smart-select");
      wrap.tabIndex = select.disabled ? -1 : 0;
      wrap.classList.toggle("disabled", select.disabled);
      wrap.setAttribute("aria-disabled", String(select.disabled));
      wrap.setAttribute("role", "button");
      wrap.setAttribute("aria-label", `Choose ${title}`);
      wrap.setAttribute("aria-haspopup", "dialog");
      select.before(wrap);
      wrap.append(select);
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
      const item = node("span", "item-content"),
        inner = node("span", "item-inner"),
        text = node(
          "span",
          "item-title",
          select.selectedOptions[0]?.textContent || "Choose",
        );
      inner.append(text);
      item.append(inner);
      wrap.append(item);
      const instance = app.smartSelect.create({
        el: wrap,
        view,
        openIn: matchMedia("(max-width:700px)").matches ? "sheet" : "popover",
        pageTitle: title,
        searchbar: select.options.length > 7,
        searchbarPlaceholder: `Search ${title.toLowerCase()}`,
        searchbarDisableText: "Cancel",
        sheetCloseLinkText: "Done",
        popupCloseLinkText: "Done",
        sheetBackdrop: true,
        sheetSwipeToClose: true,
        closeOnSelect: true,
        scrollToSelectedItem: true,
        virtualList: select.options.length > 60,
        routableModals: false,
        cssClass: "research-choice-modal",
        formatValueText: (values) => values.join(", "),
        on: {
          beforeOpen(ss) {
            ss.params.openIn = matchMedia("(max-width:700px)").matches
              ? "sheet"
              : "popover";
          },
          open(ss) {
            const modal = ss.$containerEl?.[0];
            if (modal) {
              modal.setAttribute("aria-label", title);
              const left = modal.querySelector(".toolbar-inner .left");
              if (left && !left.textContent)
                left.append(node("strong", "research-choice-heading", title));
              if (modal.matches(".popover")) {
                const header = node("header", "choice-header");
                header.append(
                  node("strong", "", title),
                  action(
                    "Done",
                    () => ss.close(),
                    "button button-tonal choice-close",
                    "done",
                  ),
                );
                modal.querySelector(".popover-inner").prepend(header);
              }
            }
          },
        },
      });
      wrap.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          instance.open();
        }
      });
      smartNodes.set(select, instance);
      smartInstances.add(instance);
      if (hadFocus) wrap.focus({ preventScroll: true });
      select.addEventListener("change", () => {
        text.textContent = select.selectedOptions[0]?.textContent || "Choose";
      });
    }
    for (const b of body.querySelectorAll(
      "button:not([data-science-button])",
    )) {
      b.dataset.scienceButton = "";
      if (
        !b.matches(
          ".matrix-cell,.gene-hit,.comparison-gene-button,.membership-card,.network-pair-button,.mobile-analysis-summary,.tree-gene",
        )
      ) {
        b.classList.add("button");
        if (b.matches(".primary")) b.classList.add("button-fill");
        else b.classList.add("button-tonal");
      }
    }
    for (const b of body.querySelectorAll("button[aria-pressed]"))
      b.classList.toggle(
        "button-active",
        b.getAttribute("aria-pressed") === "true",
      );
    for (const list of body.querySelectorAll(
      ".tree-view-toggle,.network-view-toggle",
    ))
      list.classList.add("segmented", "segmented-strong");
    for (const table of body.querySelectorAll(
      ".table-scroll,.network-table-scroll",
    ))
      table.classList.add("data-table");
    for (const badge of body.querySelectorAll(".status"))
      badge.classList.add("badge");
    const primaryControls =
      body.querySelector(".controls,.comparison-controls") ||
      controlMoves
        .map((m) => m.element)
        .find((el) => el.matches(".controls,.comparison-controls"));
    if (primaryControls) {
      primaryControls.dataset.shellControls = "";
      let summary = body.querySelector(".mobile-analysis-summary");
      if (!summary) {
        summary = action("", openControls, "mobile-analysis-summary");
        summary.setAttribute("aria-label", "Edit analysis settings");
        primaryControls.before(summary);
      }
      const values = [...primaryControls.querySelectorAll("select")]
        .filter((s) => !s.disabled)
        .slice(0, 4)
        .map((s) => s.selectedOptions[0]?.textContent)
        .filter(Boolean)
        .join(" · ");
      if (summary.dataset.value !== values) {
        summary.dataset.value = values;
        summary.replaceChildren(
          node("span", "", "Analysis settings"),
          node("strong", "", values),
          uiIcon("controls"),
        );
      }
    }
    if (controlsSheet?.opened && !controlMoves.length) openControls();
    analysisLauncher.setAvailable(
      Boolean(
        body.querySelector(".controls,.comparison-controls,.tree-toolbar") ||
          controlMoves.length,
      ),
    );
  }
  function focusables(el) {
    return [
      ...el.querySelectorAll('button,a[href],input,select,[tabindex="0"]'),
    ].filter(
      (n) =>
        !n.disabled &&
        n.getAttribute("aria-hidden") !== "true" &&
        n.getClientRects().length,
    );
  }
  function modalOpen(e) {
    const el = e.target;
    if (el === source) root.dataset.sourcesOpen = "true";
    el.dataset.shellModalReady = "false";
    if (
      !el.matches(
        ".popup,.sheet-modal,.popover,.panel,.analysis-morph-panel,.dialog",
      )
    )
      return;
    if (el === panel && panel.classList.contains("panel-in-breakpoint")) return;
    returnFocus.set(el, document.activeElement);
    el.setAttribute("role", el.matches(".dialog") ? "alertdialog" : "dialog");
    el.setAttribute("aria-modal", "true");
    for (const a of el.querySelectorAll("a:not([href])")) {
      a.setAttribute("role", "button");
      a.tabIndex = 0;
      a.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          a.click();
        }
      });
    }
    if (!el.getAttribute("aria-label"))
      el.setAttribute(
        "aria-label",
        el.querySelector(".title,.toolbar-inner strong,.dialog-title")
          ?.textContent || "Research options",
      );
    if (!modalStack.includes(el)) modalStack.push(el);
    views.inert = !views.contains(el);
    root.dataset.modalOpen = "true";
    analysisLauncher.sync();
  }
  function modalOpened(e) {
    const el = e.target;
    el.dataset.shellModalReady = "true";
    if (!modalStack.includes(el)) return;
    const first = focusables(el)[0];
    first?.focus({ preventScroll: true });
  }
  function modalClosed(e) {
    const el = e.target;
    if (el === source) root.dataset.sourcesOpen = "false";
    const index = modalStack.indexOf(el);
    if (index < 0) return;
    modalStack.splice(index, 1);
    views.inert = modalStack.length > 0;
    root.dataset.modalOpen = String(views.inert);
    analysisLauncher.sync();
    scheduleEnhance();
    el.removeAttribute("aria-modal");
    if (el === panel) el.setAttribute("role", "navigation");
    const target = returnFocus.get(el);
    if (
      target?.isConnected &&
      target.getClientRects().length &&
      getComputedStyle(target).visibility !== "hidden" &&
      !target.closest("[inert]")
    )
      target.focus({ preventScroll: true });
    else {
      const title = target?.getAttribute("aria-label");
      if (title)
        [...root.querySelectorAll("[aria-label]")]
          .find(
            (n) =>
              n.getAttribute("aria-label") === title &&
              n.getClientRects().length,
          )
          ?.focus({ preventScroll: true });
    }
    scheduleEnhance();
  }
  const onModalKeydown = (event) => {
    if (event.key === "Tab") root.dataset.inputModality = "keyboard";
    const modal = [...modalStack]
      .reverse()
      .find(
        (el) =>
          el.isConnected &&
          (el.classList.contains("modal-in") ||
            el.classList.contains("panel-in")),
      );
    if (!modal) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (modal === panel) safeClose(panelInstance);
      else safeClose(modal.f7Modal);
    } else if (event.key === "Tab") {
      const options = focusables(modal);
      if (!options.length) {
        event.preventDefault();
        return;
      }
      const first = options[0],
        last = options.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener("keydown", onModalKeydown);
  for (const type of ["panel", "popup", "sheet", "popover", "dialog"]) {
    root.addEventListener(`${type}:open`, modalOpen);
    root.addEventListener(`${type}:opened`, modalOpened);
    root.addEventListener(`${type}:closed`, modalClosed);
  }
  root.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest(
        ".sheet-close,.popup-close,.popover-close",
      );
      if (!link) return;
      const modal = link.closest(".sheet-modal,.popup,.popover");
      if (modal && modal.dataset.shellModalReady !== "true") {
        event.preventDefault();
        event.stopPropagation();
        modal.f7Modal?.close(false);
      }
    },
    true,
  );
  let mousePress;
  function movePress(event) {
    if (!mousePress) return;
    const rect = mousePress.getBoundingClientRect();
    mousePress.style.setProperty("--press-x", `${event.clientX - rect.left}px`);
    mousePress.style.setProperty("--press-y", `${event.clientY - rect.top}px`);
  }
  function startPress(event) {
    root.dataset.inputModality = "pointer";
    if (event.pointerType !== "mouse" || event.button !== 0 || reduced())
      return;
    const target = event.target.closest(".f7-press");
    if (!target || target.disabled) return;
    mousePress = target;
    mousePress.dataset.mousePressed = "true";
    movePress(event);
  }
  const endPress = (event) => {
    if (mousePress) {
      delete mousePress.dataset.mousePressed;
      mousePress = null;
    }
    for (const el of root.querySelectorAll(".f7-press[style]")) {
      if (el.style.scale)
        el.dispatchEvent(
          new PointerEvent("pointerleave", {
            pointerType: event.pointerType || "touch",
          }),
        );
    }
  };
  root.addEventListener("pointerdown", startPress);
  root.addEventListener("pointermove", movePress);
  document.addEventListener("pointerup", endPress);
  document.addEventListener("pointercancel", endPress);
  const tour = createAtlasTour({
    node,
    action,
    onClose: () => safeClose(tourPopup),
    onRender: scheduleEnhance,
  });
  root.append(tour.element);
  function openTour() {
    if (!tourPopup) return;
    sourcePopup?.close(false);
    sharePopover?.close(false);
    if (
      panelInstance?.opened &&
      !panel.classList.contains("panel-in-breakpoint")
    )
      panelInstance.close(false);
    tour.reset();
    tourPopup.open(!reduced());
    scheduleEnhance();
  }
  const evidenceSheet = createEvidenceSheet({
    root,
    getApp: () => app,
    preparePanel(panel) {
      enhanceFigures?.(panel);
      themeScientificPlots(panel);
    },
  });
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(body, { childList: true, subtree: true });
  const appearanceObserver = new MutationObserver(scheduleEnhance);
  appearanceObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  function initialize() {
    if (disposed) return;
    if (!root.isConnected) {
      requestAnimationFrame(initialize);
      return;
    }
    app = new Framework7({
      el: root,
      name: "Psilocin transcriptomic atlas",
      theme: "ios",
      darkMode: stored("atlas-appearance", "")
        ? stored("atlas-appearance", "") === "dark"
        : "auto",
      colors: { primary: "#235780" },
      iosTranslucentBars: true,
      iosTranslucentModals: true,
      touch: {
        activeState: true,
        touchRipple: false,
        touchHighlight: true,
        touchHighlightElements:
          "#psilocin-app:not([data-reduced-motion=true]) .f7-press",
      },
      panel: { swipe: false },
      sheet: { closeOnEscape: false, animate: !reduced(), push: true },
      popover: { closeOnEscape: false, animate: !reduced() },
      popup: { closeOnEscape: false, animate: !reduced(), push: true },
      view: { browserHistory: false },
    });
    view = app.views.create(main, { router: false });
    panelInstance = app.panel.create({
      el: panel,
      visibleBreakpoint: 1180,
      effect: "cover",
      side: "left",
      swipe: true,
      swipeOnlyClose: true,
      on: {
        open: () => {
          menuToggle.setAttribute("aria-expanded", "true");
          if (app.width < 1180) {
            sidebarHead.append(menuToggle);
            menuToggle.setAttribute("aria-label", "Close navigation");
          }
        },
        closed: () => {
          menuToggle.setAttribute("aria-expanded", "false");
          left.append(menuToggle);
          menuToggle.setAttribute("aria-label", "Open section menu");
        },
      },
    });
    controlsSheet = app.sheet.create({
      el: sheet,
      backdrop: true,
      swipeToClose: true,
      swipeHandler: handle,
      closeOnEscape: false,
      on: { closed: closeControls },
    });
    sourcePopup = app.popup.create({
      el: source,
      closeOnEscape: false,
      closeByBackdropClick: true,
      swipeToClose: "to-bottom",
      swipeHandler: ".sources-header",
    });
    tourPopup = app.popup.create({
      el: tour.element,
      closeOnEscape: false,
      closeByBackdropClick: true,
    });
    sharePopover = app.popover.create({
      el: shareMenu,
      closeOnEscape: false,
      closeByBackdropClick: true,
      closeByOutsideClick: true,
    });
    if (stored("atlas-sidebar", "expanded") === "collapsed")
      panelInstance.disableVisibleBreakpoint();
    autocomplete = app.autocomplete.create({
      view,
      openerEl: find,
      openIn: "popup",
      pageTitle: "Find a gene",
      popupPush: true,
      popupSwipeToClose: "to-bottom",
      requestSourceOnOpen: true,
      popupCloseLinkText: "Done",
      searchbarPlaceholder: "Symbol, Ensembl ID or verified alias",
      searchbarDisableText: "Cancel",
      closeOnSelect: true,
      valueProperty: "id",
      textProperty: "text",
      limit: 100,
      renderItem(item) {
        const parts = item.text.split(" · ");
        return `<li><label class="item-radio item-content"><input type="radio" name="${escapeHTML(item.inputName)}" value="${escapeHTML(item.value)}" aria-label="${escapeHTML(item.text)}" ${item.selected ? "checked" : ""}><i class="icon icon-radio"></i><div class="item-inner"><div class="item-title"><strong>${escapeHTML(parts[0])}</strong></div><div class="item-subtitle gene-finder-id">${escapeHTML(parts[1] || "")}</div>${parts.length > 2 ? `<div class="item-text">${escapeHTML(parts.slice(2).join(" · "))}</div>` : ""}</div></label></li>`;
      },
      notFoundText: "No matching filtered gene. Absence is not a null result.",
      source(query, render) {
        const sequence = ++querySequence;
        getGenes()
          .then((genes) => {
            if (sequence !== querySequence) return;
            const q = query.trim().toUpperCase();

            const aliases = new Map(
              data.aliases
                .filter((a) => a.current_symbol.toUpperCase().includes(q))
                .map((a) => [a.selected_gene_id, a.current_symbol]),
            );
            const preferred = data.landscape
              .map(
                (g) => genes.find((r) => r.selected && r.symbol === g.gene)?.id,
              )
              .filter(Boolean);
            const found = geneSuggestions(genes, data.aliases, q, preferred);
            render(
              found.slice(0, 100).map((g) => ({
                id: g.id,
                text: `${g.symbol} · ${g.id}${aliases.has(g.id) ? ` · alias ${aliases.get(g.id)}` : ""}${g.selected ? "" : " · additional gene ID"}`,
              })),
            );
          })
          .catch(() => render([]));
      },
      on: {
        change(values) {
          if (values[0]) go("genes", values[0].id);
        },
      },
    });
    if (matchMedia("(pointer:fine)").matches)
      for (const b of root.querySelectorAll(".shell-icon"))
        app.tooltip.create({
          targetEl: b,
          text: b.getAttribute("aria-label"),
          trigger: "hover",
        });
    const syncNavigation = () => {
      const inDrawer = app.width < 1180 && panelInstance.opened;
      (inDrawer ? sidebarHead : left).append(menuToggle);
      menuToggle.setAttribute(
        "aria-label",
        inDrawer ? "Close navigation" : "Open section menu",
      );
    };
    app.on("darkModeChange", syncAppearance);
    app.on("resize", syncNavigation);
    syncNavigation();
    syncAppearance();
    root.dataset.framework7 = "9.3.0";
    update(initial);
    enhance();
  }
  const skip = action(
    "Skip to scientific content",
    () => {
      const heading = body.querySelector("h1,h2");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus();
      }
    },
    "research-skip",
  );
  root.prepend(skip);
  requestAnimationFrame(initialize);
  update(initial);
  function finishViewTransition(event) {
    if (event.target === body) {
      body.classList.remove("research-view-enter");
      finishRendering?.();
      finishRendering = undefined;
    }
  }
  body.addEventListener("animationend", finishViewTransition);
  return {
    update,
    scroll,
    afterRender() {
      progress.update();
      if (!viewTransitionPending || reduced()) {
        if (finishRendering) afterPaint(finishRendering);
        finishRendering = undefined;
        return;
      }
      viewTransitionPending = false;
      body.classList.remove("research-view-enter");
      void body.offsetWidth;
      body.classList.add("research-view-enter");
    },
    beforeRender() {
      evidenceSheet.close(false);
      finishRendering?.();
      finishRendering = beginActivity("Opening research view");
      body.classList.remove("research-view-enter");
      analysisLauncher.close(false);
      if (controlsSheet?.opened) closeControls();
    },
    closeOverlays() {
      evidenceSheet.close(false);
      analysisLauncher.close(false);
      sharePopover?.close(false);
      tourPopup?.close(false);
      controlsSheet?.close(false);
      closeControls();
    },
    destroy() {
      evidenceSheet.destroy();
      disposed = true;
      finishRendering?.();
      progress.destroy();
      motionPreference.removeEventListener("change", syncMotion);
      body.removeEventListener("animationend", finishViewTransition);
      analysisLauncher.destroy();
      document.removeEventListener("fullscreenchange", syncFullscreenButton);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFullscreenButton,
      );
      for (const controller of pathwaySuggestions) controller.destroy();
      document.removeEventListener("keydown", onModalKeydown);
      observer.disconnect();
      appearanceObserver.disconnect();
      root.removeEventListener("change", analysisControlChanged, true);
      root.removeEventListener("pointerdown", startPress);
      root.removeEventListener("pointermove", movePress);
      document.removeEventListener("pointerup", endPress);
      document.removeEventListener("pointercancel", endPress);
      cancelAnimationFrame(enhanceFrame);
      app?.destroy();
    },
  };
}
