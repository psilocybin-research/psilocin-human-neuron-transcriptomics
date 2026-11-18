import {
  createElement as el,
  escapeHTML,
  loadingMessage,
} from "./interface-utils.js";
import { uiIcon } from "./icons.js";
import { beginActivity } from "./app-activity.js";
import { showToast } from "./app-toast.js";
const base = new URL("./", document.baseURI);
const probeMode = new URL(location.href).searchParams.has("offline-test");
const standalone = () =>
  matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;
const sessionValue = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mb = (bytes) => `${(bytes / 1000000).toFixed(1)} MB`;
function call(worker, type, extra = {}) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    let timer;
    function cleanup() {
      clearTimeout(timer);
      channel.port1.close();
      navigator.serviceWorker.removeEventListener("message", heartbeat);
    }
    function reset() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        cleanup();
        reject(
          new Error("Offline storage stopped responding. Reconnect and retry."),
        );
      }, 180000);
    }
    function heartbeat({ data }) {
      if (type === "PREPARE" && data.type === "OFFLINE_PROGRESS") reset();
    }
    navigator.serviceWorker.addEventListener("message", heartbeat);
    reset();
    channel.port1.onmessage = ({ data }) => {
      cleanup();
      data.ok ? resolve(data.result) : reject(new Error(data.error));
    };
    worker.postMessage({ type, ...extra }, [channel.port2]);
  });
}
async function probeViews() {
  const views = [
    "overview",
    "landscape",
    "genes",
    "pathways",
    "comparison",
    "robustness",
    "dna",
    "methods",
    "custom-r",
  ];
  for (const view of views) {
    document.querySelector(`#psilocin-app [data-section="${view}"]`)?.click();
    let ready = false;
    for (let i = 0; i < 300; i++) {
      await delay(100);
      const root = document.querySelector("#psilocin-app");
      if (
        root?.dataset.loading !== "true" &&
        root?.querySelector(
          ".research-content-inner h1, .research-content-inner h2, .research-content-inner svg",
        ) &&
        root.querySelector(`[data-section="${view}"][aria-current="page"]`)
      ) {
        ready = true;
        break;
      }
    }
    if (!ready) throw new Error(`Offline view did not finish: ${view}`);
    await delay(100);
  }
  const { loadLocalContext } = await import("./local-public-context.js");
  const context = await loadLocalContext("ENSG00000117592.8");
  if (!context?.gene || !Array.isArray(context.proteins))
    throw new Error("Offline molecular snapshot is unavailable.");
  return views;
}
export function createPwa({ root, app, installButton: button, data }) {
  if (probeMode) {
    const errors = [];
    const fail = (event) => errors.push(event.message || String(event.reason));
    window.addEventListener("error", fail);
    window.addEventListener("unhandledrejection", fail);
    probeViews()
      .then((views) => {
        if (errors.length) throw new Error(errors.join("; "));
        parent.postMessage(
          { type: "ATLAS_OFFLINE_PROBE", ok: true, views },
          location.origin,
        );
      })
      .catch((error) =>
        parent.postMessage(
          { type: "ATLAS_OFFLINE_PROBE", ok: false, error: error.message },
          location.origin,
        ),
      );
    return {
      destroy() {
        window.removeEventListener("error", fail);
        window.removeEventListener("unhandledrejection", fail);
      },
    };
  }
  const supported =
    isSecureContext &&
    "serviceWorker" in navigator &&
    "caches" in window &&
    !!crypto.subtle;
  button.disabled = false;
  button.parentElement.hidden = !supported;
  if (!supported)
    return {
      destroy() {
        button.onclick = null;
      },
    };
  const release = document.querySelector(
    "meta[name=atlas-offline-release]",
  )?.content;
  let deferred,
    registration,
    disposed = false,
    task,
    reloading = false,
    lastInteraction = Date.now(),
    updateTimer,
    offerTimer,
    installedThisSession = false,
    offerShown = false;
  const listeners = [];
  const on = (target, event, handler) => {
    target.addEventListener(event, handler);
    listeners.push(() => target.removeEventListener(event, handler));
  };
  function dialog(title, content, buttons = [{ text: "Done", strong: true }]) {
    return app.dialog
      .create({
        title: `${uiIcon("information").outerHTML}<span>${escapeHTML(title)}</span>`,
        content,
        cssClass: "research-message-dialog pwa-dialog",
        destroyOnClose: true,
        buttons,
      })
      .open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function instructions() {
    const ua = navigator.userAgent;
    if (
      /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    )
      return "In Safari, tap Share, then Add to Home Screen and Open as Web App. If this browser does not offer it, open this page in Safari.";
    if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Edg/.test(ua))
      return "In Safari, choose File → Add to Dock. On older macOS versions, use a browser with web-app installation support.";
    if (/Firefox/.test(ua))
      return /Android/.test(ua)
        ? "Open the browser menu and choose Install or Add to Home screen."
        : "This browser may not offer standalone web-app installation. Use a supported Chrome, Edge or Safari version; offline use in this browser still works after preparation.";
    return "Use the install icon in the browser address bar, or open the browser menu and choose Install app / Add to Home screen. Availability depends on your browser and device.";
  }
  async function worker() {
    registration ||= await navigator.serviceWorker.register(
      new URL("sw.js", base),
      { scope: base.pathname, updateViaCache: "none" },
    );
    return (await navigator.serviceWorker.ready).active;
  }
  function cacheProbe() {
    return new Promise((resolve, reject) => {
      const frame = el("iframe", "pwa-offline-probe");
      frame.title = "Offline research integrity test";
      frame.setAttribute("aria-hidden", "true");
      frame.tabIndex = -1;
      const timer = setTimeout(
        () => finish(new Error("The cache-only app test did not complete.")),
        90000,
      );
      function finish(error, views) {
        clearTimeout(timer);
        window.removeEventListener("message", receive);
        frame.remove();
        error ? reject(error) : resolve(views);
      }
      function receive(event) {
        if (
          event.origin !== location.origin ||
          event.source !== frame.contentWindow ||
          event.data?.type !== "ATLAS_OFFLINE_PROBE"
        )
          return;
        event.data.ok
          ? finish(null, event.data.views)
          : finish(new Error(event.data.error));
      }
      window.addEventListener("message", receive);
      frame.src = new URL("?offline-test=1", base).href;
      root.append(frame);
    });
  }
  async function prepareWithR(includeR, { quietSuccess = false } = {}) {
    if (!includeR) return prepareAndVerify();
    root.dataset.rInstalling = "true";
    const finish = beginActivity("Saving and testing offline R");
    let progress;
    try {
      await prepareAndVerify({ quiet: true });
      progress = dialog(
        "Preparing offline R",
        '<div class="pwa-r-progress"></div>',
        [
          {
            text: "Cancel",
            onClick: () => call(registration.active, "CANCEL").catch(() => {}),
          },
        ],
      );
      progress.el
        .querySelector(".pwa-r-progress")
        .append(loadingMessage("Downloading and checking R runtime files…"));
      const active = await worker();
      await call(active, "PREPARE", { kind: "r" });
      await call(active, "VERIFY", { kind: "r" });
      progress.el
        .querySelector(".pwa-r-progress")
        .replaceChildren(
          loadingMessage("Testing a fresh local R calculation and plot…"),
        );
      const { verifyRRuntime } = await import("./r-runtime.js");
      await verifyRRuntime(
        data.landscape.slice(0, 3).map((row) => row.day1_log2fc),
      );
      progress.close(false);
      if (!quietSuccess) dialog(
        "Offline R ready",
        "<p>Every R runtime file passed SHA-256 verification. A fresh R worker read three archived OXPHOS effect estimates, verified their values and rendered a plot using the saved runtime. The archived atlas datasets are saved with the core app.</p><p>Custom R examples now work offline. New packages and external data sources still need internet. Browser storage can be cleared or evicted; use Check offline to verify again.</p>",
      );
    } catch (error) {
      progress?.close(false);
      dialog(
        "Offline R not verified",
        `<p>${escapeHTML(error.message)}</p><p>No R readiness is claimed. The saved research app is retained. Reconnect and try again.</p>`,
      );
      throw error;
    } finally {
      finish();
      root.dataset.rInstalling = "false";
    }
  }
  async function prepareLatex({ quietSuccess = false } = {}) {
    const finish = beginActivity("Saving and testing the offline PDF compiler");
    root.dataset.reportBusy = "true";
    let work;
    const controller = new AbortController();
    try {
      await prepareAndVerify({ quiet: true });
      work = dialog(
        "Preparing offline PDF reports",
        '<div class="pwa-latex-progress"></div>',
        [
          {
            text: "Cancel",
            onClick: () => {
              controller.abort();
              call(registration.active, "CANCEL").catch(() => {});
            },
          },
        ],
      );
      work.el
        .querySelector(".pwa-latex-progress")
        .append(loadingMessage("Downloading and verifying compiler files…"));
      const active = await worker();
      await call(active, "PREPARE", { kind: "latex" });
      await call(active, "VERIFY", { kind: "latex" });
      work.el
        .querySelector(".pwa-latex-progress")
        .replaceChildren(
          loadingMessage("Testing a real local PDF compilation…"),
        );
      const { verifyLatexRuntime } = await import("./r-report.js");
      await verifyLatexRuntime(controller.signal);
      work.close(false);
      if (!quietSuccess) dialog(
        "Offline PDF compiler ready",
        "<p>Every compiler file passed SHA-256 verification, and a fresh local compilation produced a PDF. Custom R reports and LaTeX source exports can now use the saved compiler, fonts and packages without a connection.</p><p>The R runtime is a separate optional download. Storage can be cleared or evicted; use this check again when needed.</p>",
      );
    } catch (error) {
      work?.close(false);
      dialog(
        "PDF compiler not verified",
        `<p>${escapeHTML(error.message)}</p><p>No PDF readiness is claimed. Existing R results and saved app data are retained.</p>`,
      );
      if (quietSuccess) throw error;
    } finally {
      finish();
      root.dataset.reportBusy = "false";
    }
  }
  function offerOfflineTools() {
    clearTimeout(offerTimer);
    if (disposed || offerShown || (!standalone() && !installedThisSession)) return;
    if (sessionValue("atlas-offline-tools-offered")) return;
    if (!navigator.onLine || document.hidden || task ||
      root.dataset.modalOpen === "true" || root.dataset.loading === "true" ||
      root.dataset.rBusy === "true" || root.dataset.reportBusy === "true" ||
      root.dataset.rInstalling === "true") {
      offerTimer = setTimeout(offerOfflineTools, 1500);
      return;
    }
    (async () => {
      const status = await call(await worker(), "STATUS");
      if (disposed || offerShown) return;
      const missing = [
        !status.r.saved && { kind: "r", title: "Offline R analyses", bytes: status.r.bytes },
        status.latex && !status.latex.saved && { kind: "latex", title: "Offline PDF reports", bytes: status.latex.bytes },
      ].filter(Boolean);
      if (!missing.length) return;
      // Startup checks may have opened a verification dialog while STATUS was pending.
      if (root.dataset.modalOpen === "true" || root.dataset.rInstalling === "true" || root.dataset.reportBusy === "true") {
        offerTimer = setTimeout(offerOfflineTools, 1500);
        return;
      }
      offerShown = true;
      try { sessionStorage.setItem("atlas-offline-tools-offered", "1"); } catch {}
      const choices = new Map();
      const prompt = dialog("Optional offline research tools",
        "<p>The app works without these downloads while connected. Save the missing tools now if you want to run custom R analyses and create PDF reports without internet.</p><p>Choose either or both. Downloads stay in this browser; no system installation is needed. New R packages, remote data and external links still need a connection.</p>",
        [{ text: "Not now" }, { text: "Save selected", strong: true, onClick() {
          const selected = [...choices].filter(([, input]) => input.checked).map(([kind]) => kind);
          if (!selected.length) return;
          (async () => {
            if (selected.includes("r")) await prepareWithR(true, { quietSuccess: true });
            if (selected.includes("latex")) await prepareLatex({ quietSuccess: true });
            dialog("Offline tools ready", `<p>${selected.includes("r") ? "R files passed verification and a fresh calculation and plot test. " : ""}${selected.includes("latex") ? "The LaTeX files passed verification and a real PDF compilation test. " : ""}The archived analysis data is saved with the core app.</p><p>You can manage or check these downloads under Install app. Browser storage can be cleared or evicted.</p>`);
          })().catch(() => {});
        } }]);
      const container = prompt.el.querySelector(".dialog-inner");
      const save = prompt.el.querySelector(".dialog-button:last-child");
      const sync = () => {
        const enabled = [...choices.values()].some(input => input.checked);
        save.classList.toggle("disabled", !enabled);
        save.setAttribute("aria-disabled", String(!enabled));
      };
      for (const item of missing) {
        const label = el("label", "checkbox pwa-r-choice");
        const input = el("input");
        input.type = "checkbox";
        input.setAttribute("aria-label", item.title);
        input.onchange = sync;
        choices.set(item.kind, input);
        label.append(input, el("i", "icon-checkbox"), el("span", "", `${item.title} · ${mb(item.bytes)}`));
        container.append(label);
      }
      container.append(el("p", "note", "You can skip this and save the tools later under Install app. This reminder appears once per app session while tools are missing."));
      sync();
    })().catch(() => { /* The ordinary app remains available if status cannot be checked. */ });
  }
  async function readyDialog(title, content) {
    while (root.dataset.modalOpen === "true" && !disposed) await delay(200);
    if (!disposed) dialog(title, content);
  }
  async function prepareAndVerify({ quiet = false } = {}) {
    if (task) return task;
    task = (async () => {
      const finish = beginActivity(
        "Preparing and verifying the offline research app",
      );
      let workDialog,
        coreReady = root.dataset.offlineReady === "true";
      try {
        workDialog = dialog(
          "Preparing offline app",
          '<div class="pwa-work"><div class="pwa-work-label"></div><div class="progressbar"><span></span></div><p class="pwa-work-count note">Starting verified storage…</p></div>',
          [
            { text: "Continue in background" },
            {
              text: "Cancel download",
              onClick() {
                worker()
                  .then((active) => call(active, "CANCEL"))
                  .catch(() => {});
              },
            },
          ],
        );
        workDialog.el
          .querySelector(".pwa-work-label")
          .append(loadingMessage("Saving the research app…"));
        const active = await worker();
        await call(active, "PREPARE");
        const audit = await call(active, "VERIFY");
        coreReady = true;
        const label = workDialog.el?.querySelector(".pwa-work-label");
        if (label)
          label.replaceChildren(loadingMessage("Testing the cache-only app…"));
        const views = await cacheProbe();
        await call(active, "CLEANUP", { version: release });
        try {
          localStorage.setItem("atlas-offline-verified", audit.version);
        } catch {}
        await navigator.storage?.persist?.().catch(() => false);
        root.dataset.offlineReady = "true";
        workDialog.close(false);
        if (!quiet)
          await readyDialog(
            sessionValue("atlas-offline-updated")
              ? "App update installed"
              : "Offline app verified",
            `<p>All ${audit.files} files (${mb(audit.bytes)}) passed SHA-256 integrity checks. A cache-only test opened ${views.length} research views and the local gene snapshot.</p><p>Archived plots, search and exports work offline. Ensembl annotations, compact OXPHOS protein context and structure previews are saved. Full protein annotations and interactive coordinates load online.</p><p>External links and fresh provider lookups need internet. Checked ${escapeHTML(new Date().toLocaleString())}. Storage can be cleared or evicted; readiness is checked again on launch.</p>`,
          );
        try {
          sessionStorage.removeItem("atlas-offline-updated");
        } catch {}
        return audit;
      } catch (error) {
        workDialog?.close(false);
        root.dataset.offlineReady = String(coreReady);
        await readyDialog(
          "Offline preparation incomplete",
          `<p>${escapeHTML(error.message)}</p><p>${coreReady ? "The saved research app remains available; the requested addition has not been verified." : "No new offline readiness is claimed. Any previous complete package is retained."} Reconnect and choose Install app to retry; verified partial files can be reused.</p>`,
        );
        throw error;
      } finally {
        finish();
        task = undefined;
      }
    })();
    return task;
  }
  async function open() {
    try {
      const active = await worker(),
        status = await call(active, "STATUS");
      const saved = status.saved?.version === status.version;
      const buttons = [{ text: "Close" }];
      if (deferred && !standalone())
        buttons.push({
          text: "Install",
          strong: true,
          onClick() {
            const event = deferred;
            deferred = undefined;
            root.dataset.rInstalling = String(Boolean(includeR?.checked));
            event.prompt();
            event.userChoice.then((choice) => {
              if (choice.outcome === "accepted")
                prepareWithR(includeR?.checked).catch(() => {});
              else root.dataset.rInstalling = "false";
            });
          },
        });
      let includeR;
      const info = dialog(
        standalone() ? "Offline app" : "Install app",
        `<p>${escapeHTML(standalone() ? "This app is installed." : instructions())}</p><p><strong>Research app · ${mb(status.bytes)}</strong><br>All archived analyses, plots, gene search, Ensembl annotations and compact OXPHOS protein context. ${saved ? "Saved." : "Prepare while connected."}</p><p>Sizes show uncompressed storage; transfer compression can reduce network use. Updates reuse unchanged files, verify changes and refresh when idle. Your research selection is retained.</p>`,
        buttons,
      );
      const rChoice = el("label", "checkbox pwa-r-choice");
      includeR = el("input");
      includeR.type = "checkbox";
      includeR.checked = Boolean(status.r.saved);
      includeR.setAttribute("aria-label", "Include offline R runtime");
      rChoice.append(
        includeR,
        el("i", "icon-checkbox"),
        el(
          "span",
          "",
          `Include offline R · ${mb(status.r.bytes)}${status.r.saved ? " · saved" : " · optional"}`,
        ),
      );
      info.el
        .querySelector(".dialog-inner")
        .append(
          rChoice,
          el(
            "p",
            "note",
            "Runs custom R on the archived atlas tables without internet. Base and recommended packages are included; new packages and external URLs need a connection. The core app is saved first, then R files are verified and a fresh R calculation and plot are tested.",
          ),
        );
      const actions = el("div", "pwa-options");
      function option(text, handler) {
        const action = el("button", "button button-tonal", text);
        action.type = "button";
        action.onclick = () => {
          info.close(false);
          handler();
        };
        actions.append(action);
      }
      option(saved ? "Check offline" : "Prepare offline", () =>
        prepareWithR(includeR.checked).catch(() => {}),
      );
      if (status.latex) {
        const latexDescription = el(
          "p",
          "note",
          `Optional offline PDF reports · ${mb(status.latex.bytes)}${status.latex.saved ? " · saved" : ""}. Saves the local LaTeX compiler, fonts and fixed report packages independently of R. Source archives retain original SVG figures and vector PDF copies.`,
        );
        info.el.querySelector(".dialog-inner").append(latexDescription);
        option(
          status.latex.saved
            ? "Check offline PDF compiler"
            : "Save offline PDF compiler",
          () => prepareLatex(),
        );
        if (status.latex.saved)
          option("Remove offline PDF compiler", async () => {
            if (root.dataset.reportBusy === "true")
              return showToast("Finish report preparation first.");
            await call(await worker(), "REMOVE_LATEX");
            showToast("Offline PDF compiler removed. R results are retained.");
          });
      }
      if (status.r.saved)
        option("Remove offline R", async () => {
          if (root.dataset.rBusy === "true")
            return showToast(
              "Stop the R analysis before removing its runtime.",
            );
          try {
            await call(await worker(), "REMOVE_R");
            showToast(
              "Offline R removed. The research app and editor text are retained.",
            );
          } catch (error) {
            showToast(error.message);
          }
        });
      option("Check for updates", async () => {
        try {
          await registration.update();
          await readyDialog(
            "Update check complete",
            "<p>The browser has checked for a new release. Any available update is staged and verified automatically before the app refreshes.</p>",
          );
        } catch (error) {
          await readyDialog(
            "Update check unavailable",
            `<p>${escapeHTML(error.message)} Reconnect and retry. The saved app is retained.</p>`,
          );
        }
      });
      info.el.querySelector(".dialog-inner").append(actions);
    } catch (error) {
      dialog(
        "App installation unavailable",
        `<p>${escapeHTML(error.message)}</p><p>${escapeHTML(instructions())}</p>`,
      );
    }
  }
  button.onclick = () => {
    app.panel.close("left", false);
    open();
  };
  on(root, "atlas:offline-open", () => {
    app.sheet.close(".gene-information-sheet", false);
    open();
  });
  on(window, "beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event;
  });
  on(window, "appinstalled", () => {
    deferred = undefined;
    installedThisSession = true;
    offerTimer = setTimeout(offerOfflineTools, 1500);
    if (root.dataset.rInstalling !== "true") prepareAndVerify().catch(() => {});
  });
  on(window, "pointerdown", () => {
    lastInteraction = Date.now();
  });
  on(window, "keydown", () => {
    lastInteraction = Date.now();
  });
  async function checkUpdate() {
    if (!disposed && navigator.onLine && registration)
      try {
        await registration.update();
      } catch {
        /* Retain the verified package while disconnected. */
      }
  }
  on(window, "online", () => { checkUpdate(); offerOfflineTools(); });
  on(document, "visibilitychange", () => {
    if (!document.hidden) { checkUpdate(); offerOfflineTools(); }
  });
  on(navigator.serviceWorker, "message", ({ data }) => {
    if (data.type === "OFFLINE_PROGRESS") {
      const progress = root.querySelector(".pwa-work");
      if (progress) {
        const text = `${data.kind === "library" ? "Molecular library" : "Research app"}: saved ${mb(data.bytes)} of ${mb(data.total)}`;
        progress.querySelector(".pwa-work-count").textContent = text;
        app.progressbar.set(
          progress.querySelector(".progressbar"),
          data.total ? (100 * data.bytes) / data.total : 0,
          0,
        );
      }
    }
    if (data.type === "OFFLINE_PROGRESS" && data.kind === "r") {
      const text = document.querySelector(".pwa-r-progress");
      if (text)
        text.replaceChildren(
          loadingMessage(
            `Verified ${mb(data.bytes)} / ${mb(data.total)} of R runtime files.`,
          ),
        );
    }
    if (data.type === "OFFLINE_PROGRESS" && data.kind === "latex") {
      const text = document.querySelector(".pwa-latex-progress");
      if (text)
        text.replaceChildren(
          loadingMessage(
            `Verified ${mb(data.bytes)} / ${mb(data.total)} of compiler files.`,
          ),
        );
    }
    if (data.type === "OFFLINE_UPDATE_FAILED")
      showToast(
        "App update could not be verified. Your previous offline copy is retained.",
      );
    if (data.type === "OFFLINE_ACTIVATED" && data.ready) {
      try {
        const previous = localStorage.getItem("atlas-offline-verified");
        if (previous && previous !== data.version) scheduleReload();
      } catch {}
    }
  });
  function scheduleReload() {
    if (reloading) return;
    reloading = true;
    showToast("App update verified. Applying when this view is idle.");
    const tick = () => {
      if (disposed) return;
      if (
        document.hidden ||
        root.dataset.modalOpen === "true" ||
        root.dataset.loading === "true" ||
        root.dataset.rBusy === "true" ||
        root.dataset.reportBusy === "true" ||
        root.dataset.rInstalling === "true" ||
        Date.now() - lastInteraction < 5000
      ) {
        updateTimer = setTimeout(tick, 1500);
        return;
      }
      try {
        sessionStorage.setItem("atlas-offline-updated", "1");
      } catch {}
      location.reload();
    };
    updateTimer = setTimeout(tick, 5000);
  }
  worker()
    .then(async (active) => {
      const status = await call(active, "STATUS");
      if (status.saved && status.version !== release) {
        scheduleReload();
        return;
      }
      let verified;
      try {
        verified = localStorage.getItem("atlas-offline-verified");
      } catch {}
      if (
        sessionValue("atlas-offline-updated") ||
        (standalone() && !verified) ||
        (status.saved && verified !== status.version)
      ) {
        prepareAndVerify().catch(() => {});
      } else if (status.saved) {
        try {
          await call(active, "VERIFY");
          root.dataset.offlineReady = "true";
          await call(active, "CLEANUP", { version: release });
        } catch {
          prepareAndVerify().catch(() => {});
        }
      }
    })
    .catch(() => {})
    .finally(() => { offerTimer = setTimeout(offerOfflineTools, 1500); });
  const interval = setInterval(checkUpdate, 15 * 60 * 1000);
  return {
    open,
    prepareAndVerify,
    destroy() {
      disposed = true;
      clearInterval(interval);
      clearTimeout(updateTimer);
      clearTimeout(offerTimer);
      for (const remove of listeners) remove();
      button.remove();
    },
  };
}
