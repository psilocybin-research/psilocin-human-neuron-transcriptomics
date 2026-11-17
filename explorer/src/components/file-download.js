import { trackActivity } from "./app-activity.js";
import { escapeHTML } from "./interface-utils.js";
import { uiIcon } from "./icons.js";

const iconLabel = (kind, text) =>
  `${uiIcon(kind).outerHTML}<span>${escapeHTML(text)}</span>`;

function openDialog(app, params) {
  const fullscreen =
    document.fullscreenElement || document.webkitFullscreenElement;
  const callbacks = params.on || {};
  const dialog = app.dialog.create({
    ...params,
    containerEl: fullscreen || app.el,
    on: {
      ...callbacks,
      closed(instance) {
        if (fullscreen && instance.backdropEl)
          app.el.append(instance.backdropEl);
        callbacks.closed?.(instance);
      },
    },
  });
  if (fullscreen && dialog.backdropEl) fullscreen.append(dialog.backdropEl);
  dialog.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  return dialog;
}

export function confirmDownload(filename) {
  const app = document.querySelector("#psilocin-app")?.f7;
  if (!app) return Promise.resolve(false);
  // Only one decision at a time; repeated taps never queue duplicate files.
  if (app.el.querySelector(".download-confirmation"))
    return Promise.resolve(false);
  return new Promise((resolve) => {
    let accepted = false;
    openDialog(app, {
      title: iconLabel("download", "Download file"),
      content: `<p class="download-description">Save this file to your device?</p><p class="download-filename">${escapeHTML(filename)}</p>`,
      cssClass: "research-message-dialog download-confirmation",
      closeByBackdropClick: true,
      destroyOnClose: true,
      buttons: [
        { text: iconLabel("close", "Cancel") },
        {
          text: iconLabel("download", "Download"),
          strong: true,
          onClick: () => {
            accepted = true;
            resolve(true);
          },
        },
      ],
      on: {
        closed() {
          resolve(accepted);
        },
      },
    });
  });
}

function saveURL(filename, href) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
}
export async function downloadFile(filename, content, type = "text/csv") {
  if (!(await confirmDownload(filename))) return false;
  const url = URL.createObjectURL(new Blob([content], { type }));
  saveURL(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export async function downloadURL(filename, href) {
  if (!(await confirmDownload(filename))) return false;
  saveURL(filename, href);
  return true;
}
export function showInformation(app, title, text) {
  return openDialog(app, {
    title: iconLabel("information", title),
    text: escapeHTML(text),
    cssClass: "research-message-dialog",
    destroyOnClose: true,
    closeByBackdropClick: true,
    buttons: [{ text: iconLabel("done", "Done"), strong: true }],
  });
}

export async function downloadRemoteFile(filename, href) {
  if (!(await confirmDownload(filename))) return false;
  try {
    const blob = await trackActivity(
      (async () => {
        const response = await fetch(href);
        if (!response.ok) throw new Error("Download unavailable");
        return response.blob();
      })(),
      "Loading download",
    );
    const url = URL.createObjectURL(blob);
    saveURL(filename, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    const app = document.querySelector("#psilocin-app")?.f7;
    if (app)
      showInformation(
        app,
        "Download unavailable",
        "The file could not be retrieved. Check your connection and try again.",
      );
    return false;
  }
}
