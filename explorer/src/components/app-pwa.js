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
export function createPwa({ root, app, installButton: button }) {
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
    updateTimer;
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
  async function readyDialog(title, content) {
    while (root.dataset.modalOpen === "true" && !disposed) await delay(200);
    if (!disposed) dialog(title, content);
  }
  async function prepareAndVerify({ library = false } = {}) {
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
        if (library) await call(active, "PREPARE", { kind: "library" });
        const status = await call(active, "STATUS");
        const molecular = status.library.saved
          ? await call(active, "VERIFY", { kind: "library" })
          : null;
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
        await readyDialog(
          sessionValue("atlas-offline-updated")
            ? "App update installed"
            : "Offline app verified",
          `<p>All ${audit.files + (molecular?.files || 0)} files (${mb(audit.bytes + (molecular?.bytes || 0))}) passed SHA-256 integrity checks. A cache-only test opened ${views.length} research views and the local gene snapshot.</p><p>Archived plots, search and exports work offline. ${molecular ? "The complete bundled protein and representative 3D library is also verified." : "Ensembl annotations and compact OXPHOS protein context are saved. The larger molecular library is an optional download under Install app."}</p><p>External links and fresh provider lookups need internet. Checked ${escapeHTML(new Date().toLocaleString())}. Storage can be cleared or evicted; readiness is checked again on launch.</p>`,
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
      const saved = status.saved?.version === status.version,
        librarySaved = status.library.saved?.version === status.library.version;
      const buttons = [{ text: "Close" }];
      if (deferred && !standalone())
        buttons.push({
          text: "Install",
          strong: true,
          onClick() {
            const event = deferred;
            deferred = undefined;
            event.prompt();
            event.userChoice.then((choice) => {
              if (choice.outcome === "accepted")
                prepareAndVerify().catch(() => {});
            });
          },
        });
      const info = dialog(
        standalone() ? "Offline app" : "Install app",
        `<p>${escapeHTML(standalone() ? "This app is installed." : instructions())}</p><p><strong>Research app · ${mb(status.bytes)}</strong><br>All archived analyses, plots, gene search, Ensembl annotations and compact OXPHOS protein context. ${saved ? "Saved." : "Prepare while connected."}</p><p><strong>Optional molecular library · ${mb(status.library.bytes)}</strong><br>Complete bundled protein annotations and the representative 3D library. ${librarySaved ? "Saved." : "Downloaded only when you choose it."}</p><p>Sizes show uncompressed storage; transfer compression can reduce network use. Updates reuse unchanged files, verify changes and refresh when idle. Your research selection is retained.</p>`,
        buttons,
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
        prepareAndVerify().catch(() => {}),
      );
      option(
        librarySaved
          ? "Verify molecular library"
          : "Download molecular library",
        () => prepareAndVerify({ library: true }).catch(() => {}),
      );
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
      if (librarySaved)
        option("Remove molecular download", () =>
          dialog(
            "Remove molecular library?",
            "<p>Remove the optional protein and 3D download from this device? The research app, archived results and Ensembl annotations will remain available offline.</p>",
            [
              { text: "Cancel" },
              {
                text: "Remove",
                onClick() {
                  call(active, "REMOVE_LIBRARY")
                    .then(() =>
                      showToast("Optional molecular download removed."),
                    )
                    .catch((error) =>
                      readyDialog(
                        "Removal unavailable",
                        `<p>${escapeHTML(error.message)}</p>`,
                      ),
                    );
                },
              },
            ],
          ),
        );
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
    prepareAndVerify().catch(() => {});
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
  on(window, "online", checkUpdate);
  on(document, "visibilitychange", () => {
    if (!document.hidden) checkUpdate();
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
    .catch(() => {});
  const interval = setInterval(checkUpdate, 15 * 60 * 1000);
  return {
    open,
    prepareAndVerify,
    destroy() {
      disposed = true;
      clearInterval(interval);
      clearTimeout(updateTimer);
      for (const remove of listeners) remove();
      button.remove();
    },
  };
}
