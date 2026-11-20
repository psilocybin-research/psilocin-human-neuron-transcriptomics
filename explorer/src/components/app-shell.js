import { createSidebarContext } from "./sidebar-context.js";
import { fuzzyGeneSuggestions, geneSuggestions } from "./gene-search-data.js";
import { brandGlyph } from "./app-brand.js";
import { genePreviewMarkup, geneStructurePreview } from "./structure-preview.js";
import { createResearchTables } from "./research-tables.js";
import { createPwa } from "./app-pwa.js";
import { showToast } from "./app-toast.js";
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
  prepareExternalLinks,
  useModalPush,
  destroySheet,
  installFramework7Tooltips,
} from "./interface-utils.js";
import { createResearchNavigation } from "./research-navigation.js";
import { createGeneAutocomplete } from "./gene-suggestions.js";
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
  researchActions = [],
  onPathway,
  onSelectionMenu,
}) {
  root.id = "psilocin-app";
  root.dataset.inputModality = "pointer";
  // The navigation treatment is a core part of the interface, rather than a
  // preference. Reduced-transparency remains an operating-system preference.
  root.dataset.glassEffects = "true";
  root.classList.add("research-app");
  const panel = node("aside", "panel panel-left panel-cover research-sidebar");
  panel.id = "research-sidebar";
  panel.setAttribute("aria-label", "Research navigation");
  const sidebarHead = node("button", "sidebar-brand");
  sidebarHead.type = "button";
  sidebarHead.setAttribute("aria-label", "Psilocin Transcriptome Atlas — return to overview");
  sidebarHead.title = "Return to Atlas overview";
  sidebarHead.onclick = () => go("overview");
  sidebarHead.append(
    node("span", "brand-symbol", "ψ"),
    node("div", "sidebar-brand-text", "Psilocin Transcriptome Atlas"),
  );
  const brandSymbol = sidebarHead.querySelector(".brand-symbol");
  brandSymbol.textContent = "";
  brandSymbol.innerHTML = brandGlyph;
  const sidebarSub = node(
    "p",
    "sidebar-subtitle",
    "Human iPSC-derived cortical neurons",
  );
  let app,
    pwa,
    researchTables,
    view,
    panelInstance,
    controlsSheet,
    sourcePopup,
    autocomplete,
    tourPopup,
    sharePopover,
    disposeTooltips;
  let searchCleanupPending = false, searchReopenRequested = false, searchCleanupTimer;
  function openAtlasSearch() {
    if (!autocomplete || disposed || autocomplete.opened) return;
    // Framework7 destroys a closed autocomplete popup on its next task. Wait
    // for that cleanup before opening another popup on the same instance.
    if (searchCleanupPending) {
      searchReopenRequested = true;
      return;
    }
    autocomplete.open();
  }
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

  function utilityItem(text, icon, handler) {
    const item = node("li", "sidebar-utility-item");
    const button = action("", handler, "item-link item-content");
    const media = node("span", "item-media");
    media.append(uiIcon(icon));
    const inner = node("span", "item-inner");
    inner.append(node("span", "item-title", text));
    button.append(media, inner);
    item.append(button);
    nav.querySelector(":scope > ul").append(item);
    return button;
  }
  utilityItem("Search atlas", "search", () => {
    if (!panel.classList.contains("panel-in-breakpoint")) panelInstance?.close(false);
    openAtlasSearch();
  });
  const tourItem = utilityItem("Atlas tour", "information", openTour);
  nav
    .querySelector('[data-section-item="overview"]')
    .after(tourItem.parentElement);
  utilityItem("References & citation", "methods", () => {
    if (!panel.classList.contains("panel-in-breakpoint"))
      panelInstance?.close(false);
    openSources();
  });
  const installButton = utilityItem("Install app", "download", () => {});
  installButton.disabled = true;
  panel.append(sidebarHead, sidebarSub);
  const sidebarContext = createSidebarContext({
    panel, nav, getApp: () => app, openWorkspace: () => go("custom-r"), reduced,
  });
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
    subtitle = node("small", "", "Human iPSC-derived cortical neurons");
  const titleGlass = node("div", "research-title-glass");
  titleGlass.append(sectionTitle, subtitle);
  titles.append(titleGlass);
  const right = node("div", "right");
  const find = iconAction("Search atlas", "search", openAtlasSearch);
  find.classList.add("desktop-gene-finder");
  find.setAttribute("aria-keyshortcuts", "Control+k Meta+k");
  let finderSelection;
  if (onSelectionMenu) {
    finderSelection = iconAction("Selection", "controls", () =>
      onSelectionMenu(finderSelection),
    );
    finderSelection.classList.add("finder-selection-menu");
  }
  let fuzzyMatching = false;
  const fuzzyControl = node("label", "checkbox finder-fuzzy-control");
  fuzzyControl.title = "Optionally include approximate gene-name matches";
  const fuzzyInput = node("input");
  fuzzyInput.type = "checkbox";
  fuzzyInput.setAttribute("aria-label", "Include approximate gene matches");
  fuzzyControl.append(fuzzyInput, node("i", "icon-checkbox"), node("span", "finder-fuzzy-label", "Fuzzy"));
  fuzzyInput.onchange = () => {
    fuzzyMatching = fuzzyInput.checked;
    autocomplete?.source(autocomplete?.searchbar?.inputEl?.value || "");
  };
  const openSearch = event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "k") return;
    if (event.target.closest?.(".cm-editor,textarea,[contenteditable=true]")) return;
    if (root.dataset.modalOpen === "true") return;
    event.preventDefault();
    openAtlasSearch();
  };
  document.addEventListener("keydown", openSearch);
  const appearanceButton = iconAction(
    "Dark mode",
    "appearance",
    toggleAppearance,
  );
  appearanceButton.classList.add("appearance-toggle");
  appearanceButton.setAttribute("role", "switch");
  appearanceButton.setAttribute("aria-checked", "false");
  const sourcesButton = iconAction("Sources", "book", openSources);
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
        showToast("Fullscreen is unavailable in this browser window.");
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
    ["overview", "Overview"],
    ["genes", "Genes"],
    ["pathways", "Pathways"],
    ["comparison", "Compare"],
    ["sources", "Sources"],
  ]) {
    const b = action(
      "",
      () => (id === "sources" ? openSources() : navigateFromSources(id)),
      "tab-link",
    );
    b.setAttribute(
      "aria-label",
      id === "sources"
        ? "Sources"
        : `${["genes", "comparison"].includes(id) ? `${title} · ` : ""}Open ${tabs.find((t) => t[0] === id)[1]}`,
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
  function syncQuickHighlight() {
    const active = quick.find(button => button.classList.contains("tab-link-active"));
    bottom.dataset.activeDestination = active?.dataset.quick || "";
    // F7 only follows its own tab events automatically. Our scientific views
    // also navigate through the sidebar, history and the mobile Sources page.
    if (!active) return;
    // A section transition belongs to the scientific page, not to persistent
    // navigation. Snap F7's moving indicator to its destination, while its
    // independent iOS press lens remains available during touch interaction.
    bottom.classList.add("tabbar-highlight-snap");
    app?.toolbar.setHighlight(bottom);
    requestAnimationFrame(() => requestAnimationFrame(() =>
      bottom.classList.remove("tabbar-highlight-snap"),
    ));
  }
  // The tab bar is app-level navigation, not page content. Keeping it beside
  // routed pages prevents it from joining a page transition.
  page.append(navbar, scroll);
  const progress = createAppProgress({
    root,
    page,
    navbar,
    scroll,
    content,
    getApp: () => app,
  });
  let finishRendering;
  main.append(page, bottom);
  views.append(main);
  root.replaceChildren(panel, views);

  let workspaceOwner,focusNavigationState;
  root.workspaceShell={mountNavigation(element){
    const owner=Symbol('workspace');workspaceOwner=owner;
    sidebarContext.mount(element);root.classList.add('workspace-mode');
    return ()=>{if(workspaceOwner!==owner)return;sidebarContext.unmount();root.classList.remove('workspace-mode');workspaceOwner=undefined;};
  },
    openNavigation(){panelInstance?.open(!reduced());},closeNavigation(){if(!panelInstance?.opened||panel.classList.contains('panel-in-breakpoint'))return Promise.resolve();return new Promise(resolve=>{panelInstance.once('closed',resolve);panelInstance.close(!reduced());});},
    setFocus(value){if(value){if(focusNavigationState!==undefined)return;focusNavigationState=!!panelInstance?.visibleBreakpointDisabled;panelInstance?.disableVisibleBreakpoint();panelInstance?.close(false);}else if(focusNavigationState!==undefined){if(!focusNavigationState)panelInstance?.enableVisibleBreakpoint();focusNavigationState=undefined;}},
    syncTools(){analysisLauncher.setAvailable(!!root.workspaceTools||Boolean(body.querySelector('.controls,.comparison-controls,.tree-toolbar')));}
  };
  const analysisLauncher = createAnalysisLauncher({
    root,
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
  source.setAttribute("aria-label", "References and citation");
  const sourcePage = node("div", "sources-layout");
  const sourceBar = node("header", "sources-header");
  const sourceClose = action(
    "",
    () => closeSources(),
    "button button-tonal sources-close",
  );
  sourceClose.setAttribute("aria-label", "Close sources");
  sourceClose.append(uiIcon("close"), node("span", "", "Close"));
  sourceBar.append(node("h2", "", "References & citation"), sourceClose);
  const sourceScroll = node("div", "sources-content");
  sourceScroll.append(top);
  const syncSourcesScrollSurface = () => {
    sourcePage.dataset.scrolled = String(sourceScroll.scrollTop > 8);
  };
  sourceScroll.addEventListener("scroll", syncSourcesScrollSurface, { passive: true });
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
  const mobileSourcePage = node("section", "page page-current research-sources sources-mobile-page");
  mobileSourcePage.dataset.name = "references";
  mobileSourcePage.setAttribute("aria-label", "References and citation");
  let sourcesPageOpen = false, sourcesClosing = false, sourcesOpener, previousQuickState;
  function runSourcesTransition(effect, direction, complete) {
    if (reduced()) { complete(); return; }
    const forward = direction === "forward";
    const outgoing = forward ? page : mobileSourcePage;
    const incoming = forward ? mobileSourcePage : page;
    const transitionClass = `router-transition-f7-${effect}-${direction}`;
    main.classList.add(transitionClass);
    outgoing.classList.remove("page-previous", "page-next");
    outgoing.classList.add("page-current");
    incoming.classList.remove("page-current", "page-previous", "page-next");
    incoming.classList.add(forward ? "page-next" : "page-previous");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      main.classList.remove(transitionClass);
      outgoing.classList.remove("page-current", "page-previous", "page-next");
      incoming.classList.remove("page-current", "page-previous", "page-next");
      complete();
    };
    const fallback = setTimeout(finish, 560);
    incoming.addEventListener("animationend", () => { clearTimeout(fallback); finish(); }, { once: true });
  }
  function openMobileSources(pushHistory = true) {
    if (sourcesPageOpen) return;
    sourcesPageOpen = true;
    root.dataset.sourcesOpen = "true";
    sourcesOpener = document.activeElement;
    page.inert = true;
    previousQuickState = quick.map((button) => button.getAttribute("aria-current"));
    quick.forEach((button) => {
      const active = button.dataset.quick === "sources";
      button.classList.toggle("tab-link-active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
      if (active) button.removeAttribute("aria-haspopup");
    });
    syncQuickHighlight();
    mobileSourcePage.append(sourcePage);
    main.append(mobileSourcePage);
    sourceClose.setAttribute("aria-label", "Back from references");
    sourceClose.replaceChildren(uiIcon("back"), node("span", "", "Back"));
    sourceScroll.scrollTop = 0;
    syncSourcesScrollSurface();
    if (pushHistory) history.pushState({ ...history.state, atlasSourcesPage: true }, "", location.href);
    runSourcesTransition("fade", "forward", () => {
      page.style.display = "none";
      mobileSourcePage.classList.add("page-current");
      sourceClose.focus({ preventScroll: true });
    });
  }
  function restoreSourcesPage(animate = !reduced()) {
    if (!sourcesPageOpen || sourcesClosing) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      sourcesClosing = false;
      sourcesPageOpen = false;
      delete root.dataset.sourcesOpen;
      source.append(sourcePage);
      quick.forEach((button, index) => {
        const active = previousQuickState?.[index] === "page";
        button.classList.toggle("tab-link-active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
        if (button.dataset.quick === "sources") button.setAttribute("aria-haspopup", "dialog");
      });
      syncQuickHighlight();
      mobileSourcePage.remove();
      page.style.display = "";
      page.inert = false;
      sourceClose.setAttribute("aria-label", "Close sources");
      sourceClose.replaceChildren(uiIcon("close"), node("span", "", "Close"));
      const focusTarget = sourcesOpener?.closest?.(".research-sidebar") && !panel.classList.contains("panel-in") ? menuToggle : sourcesOpener;
      if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
    };
    if (!animate) { finish(); return; }
    sourcesClosing = true;
    page.style.display = "";
    runSourcesTransition("fade", "backward", finish);
    return;
  }
  function sourcesHistoryChanged(event) {
    if (event.state?.atlasSourcesPage && matchMedia("(max-width: 790px)").matches) openMobileSources(false);
    else restoreSourcesPage();
  }
  window.addEventListener("popstate", sourcesHistoryChanged);
  function sourcesViewportChanged() {
    if (sourcesPageOpen && !matchMedia("(max-width: 790px)").matches) {
      restoreSourcesPage(false);
      if (history.state?.atlasSourcesPage) {
        const { atlasSourcesPage, ...state } = history.state;
        history.replaceState(state, "", location.href);
      }
    }
  }
  window.addEventListener("resize", sourcesViewportChanged);
  function openSources() {
    if (matchMedia("(max-width: 790px)").matches) openMobileSources();
    else {
      sourceScroll.scrollTop = 0;
      syncSourcesScrollSurface();
      sourcePopup?.open(!reduced());
    }
  }
  function navigateFromSources(id) {
    if (sourcesPageOpen) {
      restoreSourcesPage();
      if (history.state?.atlasSourcesPage) {
        const { atlasSourcesPage, ...state } = history.state;
        history.replaceState(state, "", location.href);
      }
    }
    go(id);
  }
  function closeSources() {
    if (!sourcesPageOpen) return safeClose(sourcePopup);
    if (history.state?.atlasSourcesPage) history.back();
    else restoreSourcesPage();
  }
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
        showToast("Analysis link copied.");
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
    if (app) {
      app.params.touch.touchHighlight = !reduced();
      for (const name of ["popup", "popover", "sheet"])
        app.params[name].animate = !reduced();
    }
  };
  motionPreference.addEventListener("change", syncMotion);
  let disposed = false,
    lastTab = initial,
    viewTransitionPending = false,
    controlMoves = [],
    enhanceFrame,
    querySequence = 0,
    resultScrollPending = false, explicitVisualizationScroll = false;
  const viewPositions = new Map();
  let restoreViewPosition = false, positionTimer;
  function restorePositionWhenReady(force = false) {
    if (!restoreViewPosition) return;
    const position = viewPositions.get(lastTab) || 0;
    if (!force && scroll.scrollHeight - scroll.clientHeight < position) return;
    scroll.scrollTop = position;
    restoreViewPosition = false;
    clearTimeout(positionTimer);
  }
  const rememberViewPosition = () => {
    if (!restoreViewPosition) viewPositions.set(lastTab, scroll.scrollTop);
  };
  scroll.addEventListener("scroll", rememberViewPosition, { passive: true });
  const pathwaySuggestions = new Set(),
    suggestionInputs = new WeakSet();
  const smartInstances = new Set(),
    smartNodes = new WeakMap(),
    modalStack = [],
    returnFocus = new WeakMap();
  function closeControls() {
    for (const { element, placeholder, inline, hidden } of [
      ...controlMoves,
    ].reverse()) {
      if (inline) element.hidden = hidden;
      if (placeholder.isConnected) placeholder.replaceWith(element);
    }
    controlMoves = [];
    sheetBody.replaceChildren();
  }
  function prepareControls(host) {
    closeControls();
    const candidates = [
      ...body.querySelectorAll(
        ":scope>.controls,:scope>.comparison-controls,.comparative-views>.comparison-controls,.pathway-explorer > .tree-display-control,.pathway-explorer .tree-toolbar",
      ),
    ];
    if (!candidates.length) {
      showToast("Controls are located beside the relevant figure.");
      return false;
    }
    for (const element of candidates) {
      const placeholder = node("div", "controls-placeholder");
      element.before(placeholder);
      host.append(element);
      controlMoves.push({ element, placeholder });
    }
    for (const select of host.querySelectorAll("select")) {
      const original = select.closest(".control,.tree-member-control");
      if (!original) continue;
      const options = analysisOptions(select);
      const hidden = original.hidden;
      original.before(options);
      original.hidden = true;
      controlMoves.push({
        element: original,
        placeholder: options,
        inline: true,
        hidden,
      });
    }
    const display = host.querySelector(".tree-display-control");
    if (display) {
      const placeholder = node("div", "controls-placeholder");
      display.before(placeholder);
      host.prepend(display);
      controlMoves.push({ element: display, placeholder });
    }
    const visibleGroups = host.querySelectorAll(".analysis-option-field:not([hidden])").length;
    host.classList.toggle("analysis-options-single", visibleGroups === 1 && !display);
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
    if (tab !== "custom-r") sidebarContext.atlas();
    if (tab !== lastTab) {
      lastTab = tab;
      viewTransitionPending = Boolean(app) && !reduced();
      restoreViewPosition = true;
      clearTimeout(positionTimer);
      positionTimer = setTimeout(() => restorePositionWhenReady(true), 2500);
    }
    sectionTitle.textContent = tabs.find((t) => t[0] === tab)?.[1] || "Atlas";
    for (const b of quick) {
      const active = b.dataset.quick === tab;
      b.classList.toggle("tab-link-active", active);
      b.setAttribute("aria-current", active ? "page" : "false");
    }
    syncQuickHighlight();
    if (
      tab !== "custom-r" && panelInstance?.opened &&
      !panel.classList.contains("panel-in-breakpoint")
    )
      safeClose(panelInstance);
    scheduleEnhance();
  }
  function scrollToUpdatedResult() {
    if (!explicitVisualizationScroll && ["robustness", "comparison", "pathways"].includes(lastTab)) {
      resultScrollPending = false;
      return;
    }
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
      explicitVisualizationScroll = false;
      return;
    }
    requestAnimationFrame(() => {
      if (!target.isConnected) {
        scheduleEnhance();
        return;
      }
      resultScrollPending = false;
      explicitVisualizationScroll = false;
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
    const visualizationChosen = target.matches('select[aria-label="Visualization"]');
    const preservePosition = !visualizationChosen && ["robustness", "comparison", "pathways"].includes(lastTab);
    explicitVisualizationScroll = visualizationChosen;
    const previousPosition = scroll.scrollTop,
      previousTab = lastTab;
    const restorePosition = () => {
      if (preservePosition && lastTab === previousTab)
        scroll.scrollTop = previousPosition;
    };
    const finish = beginActivity("Updating analysis");
    afterPaint(() => {
      restorePosition();
      finish();
    });
    resultScrollPending = !preservePosition;
    queueMicrotask(() => {
      analysisLauncher.close();
      if (controlsSheet?.opened) safeClose(controlsSheet);
      scheduleEnhance();
      restorePosition();
    });
  }
  root.addEventListener("change", analysisControlChanged, true);
  function scheduleEnhance() {
    if (enhanceFrame) return;
    enhanceFrame = requestAnimationFrame(() => {
      enhanceFrame = 0;
      enhance();
      restorePositionWhenReady();
      scrollToUpdatedResult();
    });
  }
  const pressEnhanced = new WeakSet();
  function enhance() {
    if (!app) return;
    prepareExternalLinks(root);
    enhanceFigures?.(body);
    themeScientificPlots(body);
    root.dataset.reducedMotion = String(reduced());
    // Read new controls in one batch before writing classes; never repeat style
    // queries for the same node on unrelated plot/console DOM mutations.
    const freshPressNodes = [...root.querySelectorAll(
      "button:not(.matrix-cell),.overview-source-link,summary.tree-focus,.research-smart-select,.item-radio,.item-checkbox",
    )].filter(element => !pressEnhanced.has(element));
    const needsAnchor = freshPressNodes.map(element => getComputedStyle(element).position === "static");
    freshPressNodes.forEach((element,index) => {
      pressEnhanced.add(element);
      element.classList.add("f7-press");
      if (needsAnchor[index]) element.classList.add("f7-press-anchor");
    });
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
      // Virtual lists require a page-content scroller, which popovers do not have.
      const choicePresentation = () =>
        select.options.length > 60
          ? "popup"
          : matchMedia("(max-width:700px)").matches
            ? "sheet"
            : "popover";
      const instance = app.smartSelect.create({
        el: wrap,
        view,
        openIn: choicePresentation(),
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
        virtualListHeight: "auto",
        routableModals: false,
        cssClass: "research-choice-modal",
        formatValueText: (values) => values.join(", "),
        on: {
          beforeOpen(ss) {
            ss.params.openIn = choicePresentation();
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
          ".gene-structure-action,.table-sort-button,.matrix-cell,.gene-hit,.comparison-gene-button,.membership-card,.network-pair-button,.mobile-analysis-summary,.tree-gene,.gene-annotation-toggle",
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
    const pathwayDisplay = body.querySelector(".tree-view-toggle");
    if (primaryControls && pathwayDisplay) {
      let shortcut = body.querySelector(".desktop-pathway-display");
      if (!shortcut) {
        shortcut = node("div", "desktop-pathway-display");
        shortcut.setAttribute("aria-label", "Pathway display shortcuts");
        shortcut.append(node("strong", "", "Display"));
        primaryControls.before(shortcut);
      }
      const sourceButtons = [...pathwayDisplay.querySelectorAll("button")];
      if (!shortcut.querySelector("button")) {
        for (const source of sourceButtons) {
          const button = action(source.textContent, () => source.click(), "button button-tonal");
          shortcut.append(button);
        }
      }
      [...shortcut.querySelectorAll("button")].forEach((button, i) => {
        button.setAttribute("aria-pressed", sourceButtons[i].getAttribute("aria-pressed") || "false");
      });
    }
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
    if (controlsSheet?.opened) {
      if (!controlMoves.length) openControls();
      else if (sheetBody.querySelector(".control:not([hidden]) select,.tree-member-control:not([hidden]) select")) {
        const position = sheetBody.parentElement.scrollTop;
        prepareControls(sheetBody);
        sheetBody.parentElement.scrollTop = position;
      }
    }
    analysisLauncher.setAvailable(
      Boolean(
        root.workspaceTools || body.querySelector(".controls,.comparison-controls,.tree-toolbar") ||
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
    if (el.matches(".panel.panel-in-breakpoint")) return;
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
    views.inert = modalStack.some(surface=>!views.contains(surface));
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
    for(let i=modalStack.length-1;i>=0;i--)if(!modalStack[i].isConnected||!modalStack[i].matches('.modal-in,.modal-out,.panel-in,.panel-out'))modalStack.splice(i,1);
    views.inert = modalStack.some(surface=>!views.contains(surface));
    root.dataset.modalOpen = String(modalStack.length>0);
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
      if (modal.matches(".autocomplete-popup")) autocomplete?.close();
      else if (modal === panel) safeClose(panelInstance);
      else safeClose(modal.f7Panel || modal.f7Modal);
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
    if (event.pointerType !== "mouse" || event.button !== 0 || reduced() || root.dataset.glassEffects !== "true")
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
  // One short pulse for a deliberate touch activation, never for drag, hover or mouse.
  let touchStart, lastCanvasTap = 0, lastPulse = 0;
  function pulse() {
    const now = performance.now();
    if (reduced() || document.hidden || now - lastPulse < 120 || typeof navigator.vibrate !== "function") return;
    try { navigator.vibrate(6); lastPulse = now; } catch { /* Haptics are optional. */ }
  }
  function touchDown(event) {
    if (event.pointerType !== "touch" || !event.isTrusted) return;
    if (event.isPrimary === false) { touchStart = undefined; return; }
    touchStart = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target };
  }
  function touchMove(event) {
    if (touchStart && event.pointerId === touchStart.id && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) touchStart.moved = true;
  }
  function touchUp(event) {
    if (event.pointerType !== "touch" || !event.isTrusted || !touchStart || event.pointerId !== touchStart.id) return;
    const start = touchStart;
    touchStart = undefined;
    if (start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    const target = start.target instanceof Element ? start.target : start.target?.parentElement;
    if (!target || target.closest("[inert],[disabled],[aria-disabled=true]")) return;
    if (target.closest(".oxphos-3d-pane canvas")) { lastCanvasTap = performance.now(); return; }
    const action = target.closest('button,a[href],[role="button"],[role="switch"],input[type="checkbox"],select,summary,label');
    if (action && (!action.matches("label") || action.querySelector('input:not([disabled]),select:not([disabled])'))) pulse();
  }
  function touchCancel() { touchStart = undefined; }
  root.hapticSelection = (event) => {
    if (!event?.isTrusted || !lastCanvasTap || performance.now() - lastCanvasTap > 800) return;
    lastCanvasTap = 0;
    pulse();
  };
  root.addEventListener("pointerdown", touchDown, true);
  root.addEventListener("pointermove", touchMove, true);
  root.addEventListener("pointerup", touchUp, true);
  root.addEventListener("pointercancel", touchCancel, true);
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
    returnFocus.set(
      tour.element,
      panel.classList.contains("panel-in-breakpoint") ? tourItem : menuToggle,
    );
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
        touchHighlight: root.dataset.glassEffects === "true" && !reduced(),
        touchHighlightElements:
          ".toolbar-pane, .navbar .left, .navbar .right, .popover-inner, .actions-group:not(.actions-grid .actions-group), .searchbar-input-wrap, .searchbar-disable-button, .subnavbar, .searchbar-input-wrap .autocomplete-dropdown, .messagebar-area, .notification, .toast, .fab > a, #psilocin-app[data-glass-effects=true]:not([data-reduced-motion=true]) .f7-press:not(.tab-link)",
      },
      panel: { swipe: false },
      sheet: {
        closeOnEscape: false,
        animate: !reduced(),
        push: useModalPush(),
      },
      popover: { closeOnEscape: false, animate: !reduced() },
      popup: {
        closeOnEscape: false,
        animate: !reduced(),
        push: useModalPush(),
      },
      view: { browserHistory: false },
    });
    view = app.views.create(main, { router: false });
    pwa = createPwa({ root, app, installButton, data });
    researchTables = createResearchTables({ root, app });
    panel.style.width=`${Math.max(240,Math.min(360,Number(stored('atlas-navigation-width',280))||280))}px`;
    panelInstance = app.panel.create({
      el: panel,
      visibleBreakpoint: 1180,
      resizable: true,
      effect: "cover",
      side: "left",
      swipe: true,
      swipeOnlyClose: true,
      on: {
        resize: (_instance,width)=>remember('atlas-navigation-width',String(Math.round(width))),
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
    const navigationHandle=panel.querySelector('.panel-resize-handler');if(navigationHandle){navigationHandle.tabIndex=0;navigationHandle.setAttribute('role','separator');navigationHandle.setAttribute('aria-label','Navigation width');navigationHandle.setAttribute('aria-orientation','vertical');navigationHandle.setAttribute('aria-valuenow',String(panel.offsetWidth));navigationHandle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const width=Math.max(240,Math.min(360,panel.offsetWidth+(e.key==='ArrowRight'?16:-16)));panel.style.width=`${width}px`;if(panel.classList.contains('panel-in-breakpoint'))views.style.marginLeft=`${width}px`;navigationHandle.setAttribute('aria-valuenow',String(width));remember('atlas-navigation-width',String(width));};}
    controlsSheet = app.sheet.create({
      el: sheet,
      push: true,
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
    let finderGenes = new Map();
    // A small, verified subset of the archived catalogue renders immediately;
    // full-text search still uses the complete asynchronously loaded catalogue.
    const finderInitialGenes = [
      ['MFN2', 'ENSG00000116688.12'], ['SDHB', 'ENSG00000117118.5'],
      ['MRPS15', 'ENSG00000116898.7'], ['ATP6V0B', 'ENSG00000117410.9'],
      ['UQCRH', 'ENSG00000173660.7'], ['NDUFS2', 'ENSG00000158864.8'],
      ['SDHC', 'ENSG00000143252.10'], ['MGST3', 'ENSG00000143198.8'],
    ].map(([symbol, id]) => ({symbol, id, selected: true, aliases: []}));
    const mountFinderSelection = () => {
      const actions = autocomplete?.modal?.el?.querySelector(".navbar .right");
      if (!actions) return;
      if (!actions.contains(fuzzyControl)) actions.prepend(fuzzyControl);
      if (finderSelection && !actions.contains(finderSelection)) actions.prepend(finderSelection);
    };
    autocomplete = app.autocomplete.create({
      view,
      openIn: "popup",
      pageTitle: "Search atlas",
      popupPush: true,
      popupSwipeToClose: "to-bottom",
      requestSourceOnOpen: true,
      popupCloseLinkText: "Done",
      searchbarPlaceholder: "Gene symbol, Ensembl ID or verified alias",
      searchbarDisableText: "Cancel",
      closeOnSelect: false,
      routableModals: false,
      animate: false,
      valueProperty: "id",
      textProperty: "text",
      limit: 100,
      renderItem(item) {
        const geneId = String(item.value || item.id || "").replace(/^gene:/, "");
        const gene = item.gene || finderGenes.get(geneId);
        if (!gene)
          return `<li><div class="item-content"><div class="item-inner"><div class="item-title">${escapeHTML(item.text || "Gene result unavailable")}</div></div></div></li>`;
        // Show a real structure thumbnail when a curated model is available.
        // Other archived genes deliberately retain the shared gene glyph: we do
        // not imply that an unmodelled gene has a molecular structure preview.
        const preview = genePreviewMarkup(gene) || `<span class="gene-finder-glyph" aria-hidden="true">${uiIcon("genes").outerHTML}</span>`;
        const aliases = gene.fuzzy
          ? "Possible fuzzy match"
          : gene.aliases?.length
            ? `Verified alias: ${gene.aliases.join(", ")}`
          : gene.selected
            ? "Archived rank representative"
            : "Archived gene ID";
        return `<li><label class="item-radio item-content"><input type="radio" name="${escapeHTML(item.inputName)}" value="${escapeHTML(item.value)}" aria-label="${escapeHTML(item.text)}" ${item.selected ? "checked" : ""}><i class="icon icon-radio"></i><div class="item-media">${preview}</div><div class="item-inner"><div class="item-title">${escapeHTML(gene.symbol)}</div><div class="item-subtitle">${escapeHTML(gene.id)}</div><div class="item-text">${escapeHTML(aliases)}</div></div></label></li>`;
      },
      notFoundText: "No archived gene match. Try a gene symbol, Ensembl ID or verified alias.",
      source(query, render) {
        const sequence = ++querySequence;
        const showGenes = matches => {
          finderGenes = new Map(matches.map((gene) => [gene.id, gene]));
          render(matches.map((gene) => ({
            id: `gene:${gene.id}`, value: `gene:${gene.id}`,
            text: `${gene.symbol} · ${gene.id}`, kind: 'gene', target: gene.id, gene,
            fuzzy: Boolean(gene.fuzzy),
          })));
        };
        if (!query.trim()) showGenes(finderInitialGenes);
        const suggestions = genes => {
          // Initial results are useful before a query: representative archived
          // genes with a curated molecular preview lead the stable default list.
          // Typed searches retain the ordinary exact/prefix relevance ranking.
          const preferred = query.trim()
            ? []
            : genes.filter((gene) => gene.selected && geneStructurePreview(gene)).map((gene) => gene.id);
          const exact = geneSuggestions(genes, data.aliases, query, preferred);
          if (!fuzzyMatching) return exact;
          return [...exact, ...fuzzyGeneSuggestions(genes, data.aliases, query).filter(
            (gene) => !exact.some((match) => match.id === gene.id),
          )].slice(0, 20);
        };
        getGenes().then(genes => {
          if (sequence === querySequence) showGenes(suggestions(genes));
        }).catch(() => {
          if (sequence === querySequence && query.trim()) render([{
            id: "unavailable", text: "Gene data unavailable · Type again to retry", kind: "unavailable",
          }]);
        });
      },
      on: {
        open() { requestAnimationFrame(mountFinderSelection); },
        opened: mountFinderSelection,
        closed() {
          ++querySequence;
          searchCleanupPending = true;
          const closedPopup = autocomplete.modal;
          // Escape/backdrop also close the popup directly. Schedule after F7's
          // own close() cleanup, then dispose that captured popup if it remains.
          queueMicrotask(() => {
            searchCleanupTimer = setTimeout(() => {
              if (disposed) return;
              if (autocomplete.modal === closedPopup) {
                closedPopup?.destroy();
                delete autocomplete.modal;
              }
              searchCleanupPending = false;
              if (searchReopenRequested) {
                searchReopenRequested = false;
                openAtlasSearch();
              }
            }, 0);
          });
        },
        change(values) {
          const item = values[0];
          if (!item || item.kind === "unavailable") return;
          // Finish the modal lifecycle before changing route/state. Otherwise a
          // route update can race the autocomplete's own router history cleanup.
          autocomplete.once("closed", () => {
            if (item.kind === "gene") go("genes", item.target);
          });
          autocomplete.close();
        },
      },
    });
    disposeTooltips = installFramework7Tooltips(root, app);
    const syncNavigation = () => {
      for (const modal of [controlsSheet, sourcePopup, tourPopup]) {
        if (!modal || modal.opened) continue;
        modal.push = useModalPush();
        modal.params.push = modal.push;
        modal.el.classList.toggle(
          modal.type === "sheet" ? "sheet-modal-push" : "popup-push",
          modal.push,
        );
      }
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
    requestAnimationFrame(() => document.getElementById("atlas-boot")?.remove());
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
    openSearch: openAtlasSearch,
    update,
    scroll,
    afterRender() {
      restorePositionWhenReady();
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
      clearTimeout(searchCleanupTimer);
      clearTimeout(positionTimer);
      scroll.removeEventListener("scroll", rememberViewPosition);
      sourceScroll.removeEventListener("scroll", syncSourcesScrollSurface);
      pwa?.destroy();
      researchTables?.destroy();
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
      window.removeEventListener("popstate", sourcesHistoryChanged);
      window.removeEventListener("resize", sourcesViewportChanged);
      document.removeEventListener("keydown", onModalKeydown);
      document.removeEventListener("keydown", openSearch);
      observer.disconnect();
      appearanceObserver.disconnect();
      root.removeEventListener("change", analysisControlChanged, true);
      root.removeEventListener("pointerdown", touchDown, true);
      root.removeEventListener("pointermove", touchMove, true);
      root.removeEventListener("pointerup", touchUp, true);
      root.removeEventListener("pointercancel", touchCancel, true);
      delete root.hapticSelection;
      root.removeEventListener("pointerdown", startPress);
      root.removeEventListener("pointermove", movePress);
      document.removeEventListener("pointerup", endPress);
      document.removeEventListener("pointercancel", endPress);
      cancelAnimationFrame(enhanceFrame);
      disposeTooltips?.();
      app?.destroy();
    },
  };
}
