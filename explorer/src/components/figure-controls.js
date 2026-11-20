import { createElement as el } from "./interface-utils.js";
import { uiIcon as icon } from "./icons.js";
// Shared figure controls for SVG, canvas and HTML scientific displays.
function button(text, fn, cls) {
  const n = el("button", `button button-tonal f7-press prevent-active-state-propagation ${cls || ""}`, text);
  n.type = "button";
  n.onclick = fn;
  return n;
}
function printFigure(shell, title) {
  const copy = shell.cloneNode(true);
  // Canvas pixels are not retained by cloneNode; preserve the rendered scientific figure.
  const originals = shell.querySelectorAll("canvas");
  copy.querySelectorAll("canvas").forEach((canvas, index) => {
    const image = el("img");
    image.src = originals[index].toDataURL("image/png");
    image.alt = originals[index].getAttribute("aria-label") || title;
    image.style.cssText = "display:block;width:100%;height:auto";
    canvas.replaceWith(image);
  });
  copy
    .querySelectorAll(".figure-toolbar,.figure-scrollbar")
    .forEach((node) => node.remove());
  const frame = el("iframe", "figure-print-frame");
  frame.title = `Printable ${title}`;
  frame.setAttribute("aria-hidden", "true");
  let printed = false;
  frame.onload = async () => {
    const win = frame.contentWindow,
      doc = frame.contentDocument;
    if (printed || !win || !doc?.querySelector(".figure-shell")) return;
    printed = true;
    await doc.fonts?.ready;
    await new Promise((resolve) =>
      win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)),
    );
    win.addEventListener("afterprint", () => frame.remove(), { once: true });
    win.focus();
    win.print();
  };
  frame.srcdoc = `<!doctype html><title>${title}</title><style>body{margin:24px;color:#17312f;font:13px system-ui,sans-serif}.figure-shell{width:100%;margin:0}.figure-context{display:block;margin:0 0 16px}.figure-context strong,.figure-context span{display:block}.figure-context strong{font-size:18px}.figure-context span{margin-top:4px;color:#40564e}.heatmap-scroll,.dna-map-scroll,.matrix-scroll,.plot-viewport{max-height:none!important;overflow:visible!important;background:#fff!important}.landscape-layout{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(260px,1fr);gap:20px}svg{display:block;width:100%;height:auto;min-width:0!important;max-width:100%!important}.network-map,.comparison-canvas-scroll,.comparison-svg-scroll{overflow:visible!important;max-height:none!important;min-width:0!important;border:0}button{display:none}.matrix-cell,.network-pair-button{display:block;border:0;padding:4px;font:inherit;color:inherit;white-space:normal}.pathway-matrix{display:grid;grid-template-columns:1.2fr repeat(3,1fr);gap:6px;font-size:11px}.matrix-head,.matrix-row{font-weight:600}.matrix-cell>*{display:block}.matrix-cell small{font-size:10px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{padding:4px;border-bottom:1px solid #dde3e9;text-align:left}.overlap-matrix{table-layout:fixed;font-size:8px;overflow-wrap:anywhere}.overlap-matrix th:first-child{width:22%}.overlap-matrix button{padding:2px;font-size:8px}.network-table-scroll{max-height:none;overflow:visible}@page{margin:12mm}</style>${copy.outerHTML}`;
  document.body.append(frame);
}
let scrollPaneSequence = 0;
function enhanceScrollbars(shell, host) {
  const panes = host.matches(".landscape-layout")
    ? [
        ...host.querySelectorAll(
          ":scope>.heatmap-scroll,:scope>.dna-map-scroll,:scope>.gene-detail",
        ),
      ]
    : [host];
  const controls = [];
  let frame = 0;
  for (const pane of panes) {
    pane.dataset.figureScrollPane = "";
    pane.id ||= `figure-scroll-pane-${++scrollPaneSequence}`;
    const name = pane.matches(".gene-detail")
      ? "Gene detail"
      : pane.matches(".heatmap-scroll,.dna-map-scroll")
        ? "Heatmap"
        : "Plot";
    for (const axis of ["y", "x"]) {
      const rail = el("input", "figure-scrollbar");
      rail.type = "range";
      rail.min = "0";
      rail.max = "1";
      rail.step = "1";
      rail.value = "0";
      rail.hidden = true;
      rail.dataset.axis = axis;
      rail.setAttribute(
        "aria-label",
        `${name} ${axis === "y" ? "vertical" : "horizontal"} scroll position`,
      );
      rail.setAttribute("aria-controls", pane.id);
      rail.setAttribute(
        "aria-orientation",
        axis === "y" ? "vertical" : "horizontal",
      );
      const move = (value) => {
        if (axis === "y") pane.scrollTop = value;
        else pane.scrollLeft = value;
      };
      rail.oninput = () => move(Number(rail.value));
      rail.onkeydown = (event) => {
        const size = axis === "y" ? pane.clientHeight : pane.clientWidth,
          maximum = Number(rail.max),
          value = Number(rail.value);
        let next;
        if (event.key === "Home") next = 0;
        else if (event.key === "End") next = maximum;
        else if (event.key === "PageDown") next = value + size * 0.8;
        else if (event.key === "PageUp") next = value - size * 0.8;
        else if (event.key === (axis === "y" ? "ArrowDown" : "ArrowRight"))
          next = value + 40;
        else if (event.key === (axis === "y" ? "ArrowUp" : "ArrowLeft"))
          next = value - 40;
        else return;
        event.preventDefault();
        move(Math.max(0, Math.min(maximum, next)));
      };
      shell.append(rail);
      controls.push({ pane, rail, axis });
    }
    pane.addEventListener("scroll", schedule, { passive: true });
  }
  function schedule() {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
  }
  function update() {
    if (!shell.isConnected) {
      resize.disconnect();
      mutation.disconnect();
      return;
    }
    const active =
        (document.fullscreenElement || document.webkitFullscreenElement) ===
        shell,
      outer = shell.getBoundingClientRect();
    for (const { pane, rail, axis } of controls) {
      const vertical = axis === "y",
        size = vertical ? pane.clientHeight : pane.clientWidth,
        total = vertical ? pane.scrollHeight : pane.scrollWidth,
        maximum = Math.max(0, total - size);
      rail.hidden = !active || maximum <= 1;
      if (rail.hidden) continue;
      const box = pane.getBoundingClientRect(),
        length = Math.max(24, (vertical ? box.height : box.width) - 24),
        thumb = Math.max(24, Math.min(length, (length * size) / total));
      rail.max = String(Math.ceil(maximum));
      rail.value = String(vertical ? pane.scrollTop : pane.scrollLeft);
      rail.setAttribute(
        "aria-valuetext",
        `${Math.round((Number(rail.value) / maximum) * 100)}%`,
      );
      Object.assign(
        rail.style,
        vertical
          ? {
              left: `${box.right - outer.left - 16}px`,
              top: `${box.top - outer.top + 8}px`,
              height: `${length}px`,
              width: "12px",
            }
          : {
              left: `${box.left - outer.left + 8}px`,
              top: `${box.bottom - outer.top - 16}px`,
              width: `${length}px`,
              height: "12px",
            },
      );
      rail.style.setProperty("--thumb-width", `${vertical ? 12 : thumb}px`);
      rail.style.setProperty("--thumb-height", `${vertical ? thumb : 12}px`);
    }
  }
  const resize = new ResizeObserver(schedule);
  resize.observe(host);
  for (const pane of panes) resize.observe(pane);
  const mutation = new MutationObserver(schedule);
  mutation.observe(host, { childList: true, subtree: true });
  shell.addEventListener("fullscreenchange", schedule);
  shell.addEventListener("webkitfullscreenchange", schedule);
  schedule();
}

export function enhancePlots(scope, { nested = false } = {}) {
  const requestName = ["requestFullscreen", "webkitRequestFullscreen"].find(
    (name) => typeof document.documentElement[name] === "function",
  );
  const exitName = ["exitFullscreen", "webkitExitFullscreen"].find(
    (name) => typeof document[name] === "function",
  );
  const candidates = [
    ...scope.querySelectorAll(
      "[data-fullscreen-title],svg[aria-label],svg[aria-labelledby],canvas[aria-label]",
    ),
  ];
  for (const plot of candidates) {
    let host =
      plot.closest("[data-fullscreen-host]") ||
      (plot.matches("svg") &&
      plot.parentElement?.matches(
        ".heatmap-scroll,.dna-map-scroll,.comparison-svg-scroll",
      )
        ? plot.parentElement
        : plot);
    // A figure can include a matrix, a linked gene-detail panel or other
    // scientific context. Give an individual plot inside that outer figure its
    // own destination so fullscreen means the plot, rather than the whole card.
    const enclosingShell = host.closest(".figure-shell");
    const shellContent = enclosingShell?.querySelector(
      ":scope > [data-figure-content]",
    );
    // Only intentionally compound scientific layouts receive a second,
    // plot-only fullscreen control. Other figures already own one concise
    // toolbar; automatically adding another would duplicate Print/Fullscreen.
    const nestedPlot = Boolean(
      enclosingShell &&
        host !== shellContent &&
        shellContent?.matches("[data-nested-fullscreen],.landscape-layout"),
    );
    if (
      (enclosingShell && !nestedPlot) ||
      plot.closest("button,a,.figure-toolbar")
    )
      continue;
    if (plot.matches("canvas"))
      host = plot.closest(".comparison-canvas-scroll") || plot;
    if (host.matches(".comparison-svg-scroll")) {
      host.classList.add("plot-viewport");
      host.style.setProperty(
        "--plot-width",
        `${plot.viewBox?.baseVal.width || 900}px`,
      );
    }
    const title =
      host.dataset.fullscreenTitle ||
      plot.getAttribute("aria-label") ||
      "Scientific visualization";
    const info = host.dataset.fullscreenInfo || title;
    if (host === plot && plot.matches("svg")) {
      const viewport = el("div", "plot-viewport");
      viewport.tabIndex = 0;
      viewport.setAttribute(
        "aria-label",
        `${title}. Scroll horizontally when needed.`,
      );
      viewport.style.setProperty(
        "--plot-width",
        `${plot.viewBox.baseVal.width || 640}px`,
      );
      plot.before(viewport);
      viewport.append(plot);
      host = viewport;
    }
    const shell = el("figure", "figure-shell");
    shell.setAttribute("aria-label", `${title} with fullscreen control`);
    const toolbar = el("div", "figure-toolbar"),
      pane = el("div", "toolbar-pane");
    toolbar.append(pane);
    const context = el("figcaption", "figure-context");
    context.append(el("strong", "", title), el("span", "", info));
    const full = button(
      "",
      async () => {
        try {
          if (
            (document.fullscreenElement || document.webkitFullscreenElement) ===
            shell
          )
            await document[exitName]();
          else await shell[requestName]();
        } catch (error) {
          if (error?.name !== "NotAllowedError")
            console.warn("Fullscreen request failed", error);
        }
      },
      "figure-fullscreen",
    );
    full.append(icon("fullscreen"));
    if (host.dataset.fullscreenLabel) {
      full.classList.add("figure-fullscreen-labelled");
      full.append(el("span", "", host.dataset.fullscreenLabel));
    }
    const print = button("", () => printFigure(shell, title), "figure-print");
    print.append(icon("print"));
    full.classList.toggle("figure-fullscreen-focus", nestedPlot);
    full.setAttribute(
      "aria-label",
      nestedPlot ? `View only ${title} in full screen` : `View ${title} in full screen`,
    );
    full.title = nestedPlot
      ? "View only this plot in full screen"
      : "View plot and information in full screen";
    let molecularStats;
    const update = () => {
      const active =
        (document.fullscreenElement || document.webkitFullscreenElement) ===
        shell;
      full.setAttribute(
        "aria-label",
        active
          ? "Exit full screen"
          : nestedPlot
            ? `View only ${title} in full screen`
            : `View ${title} in full screen`,
      );
      full.title = active
        ? "Exit full screen"
        : nestedPlot
          ? "View only this plot in full screen"
          : "View plot and information in full screen";
      full.classList.toggle("figure-fullscreen-exit", active);
      if (!active && molecularStats) molecularStats.hidden = true;
      full.replaceChildren(icon(active ? "close" : "fullscreen"));
      if (active) full.append(el("span", "", "Close"));
      else if (host.dataset.fullscreenLabel)
        full.append(el("span", "", host.dataset.fullscreenLabel));
    };
    shell.addEventListener("fullscreenchange", update);
    shell.addEventListener("webkitfullscreenchange", update);
    print.setAttribute("aria-label", `Print ${title}`);
    print.title = "Print this plot and its visible information";
    pane.append(print);
    if (host.molecularStatistics && host.dataset.molecularGeneId) {
      const sendToR = button("", () => host.dispatchEvent(new CustomEvent("atlas:send-gene-to-r", {
        bubbles: true, detail: { gene: host.dataset.molecularGeneId },
      })), "molecular-fullscreen-action molecular-send-to-r");
      sendToR.append(icon("custom-r"), el("span", "", "Send to R"));
      sendToR.setAttribute("aria-label", `Send ${host.dataset.molecularGeneId} to R`);
      const stats = button("", () => {
        if (!molecularStats) {
          molecularStats = host.molecularStatistics();
          molecularStats.hidden = true;
          shell.append(molecularStats);
        }
        molecularStats.hidden = !molecularStats.hidden;
        stats.setAttribute("aria-expanded", String(!molecularStats.hidden));
      }, "molecular-fullscreen-action molecular-stats-toggle");
      stats.append(icon("information"), el("span", "", "More statistics"));
      stats.setAttribute("aria-expanded", "false");
      pane.append(sendToR, stats);
    }
    host.before(shell);
    host.dataset.figureContent = "";
    shell.append(toolbar, context, host);
    enhanceScrollbars(shell, host);
    let scaleViewport = host.matches(".plot-viewport")
      ? host
      : host.querySelector(".plot-viewport");
    if (
      scaleViewport?.matches(".network-map") ||
      host.matches(".overlap-figure")
    ) {
      let graphic = scaleViewport?.querySelector("svg");
      const readable = button(
        "",
        () => {
          if (!scaleViewport) return;
          const active = scaleViewport.classList.toggle("readable");
          readable.setAttribute("aria-pressed", String(active));
          readable.title = active ? "Fit figure" : "Read labels";
          hint.hidden = !active;
        },
        "secondary figure-reading",
      );
      readable.append(icon("labels"));
      readable.title = "Read labels";
      readable.setAttribute("aria-pressed", "false");
      readable.setAttribute("aria-label", `Toggle readable scale for ${title}`);
      const hint = el(
        "span",
        "figure-scroll-hint",
        "Scroll horizontally to inspect.",
      );
      hint.hidden = true;
      pane.append(readable);
      toolbar.append(hint);
      function updateReadingAvailability() {
        const naturalWidth = graphic?.viewBox?.baseVal.width || 0;
        readable.hidden =
          !scaleViewport?.matches(".network-map") ||
          (!scaleViewport.classList.contains("readable") &&
            scaleViewport.clientWidth >= naturalWidth * (2 / 3));
      }
      let readingFrame;
      const resize = new ResizeObserver(() => {
        cancelAnimationFrame(readingFrame);
        if (!shell.isConnected) {
          resize.disconnect();
          return;
        }
        readingFrame = requestAnimationFrame(() => {
          if (shell.isConnected) updateReadingAvailability();
        });
      });
      updateReadingAvailability();
      if (scaleViewport) resize.observe(scaleViewport);
      else readable.hidden = true;
      host.addEventListener("figure:contentchange", () => {
        resize.disconnect();
        scaleViewport = host.querySelector(".plot-viewport");
        graphic = scaleViewport?.querySelector("svg");
        readable.setAttribute("aria-pressed", "false");
        readable.title = "Read labels";
        hint.hidden = true;
        updateReadingAvailability();
        if (scaleViewport) resize.observe(scaleViewport);
      });
    }
    if (requestName && exitName) pane.append(full);
  }
}
