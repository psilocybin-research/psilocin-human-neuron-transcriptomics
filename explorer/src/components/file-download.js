import { showToast } from "./app-toast.js";
import { trackActivity } from "./app-activity.js";
import { escapeHTML } from "./interface-utils.js";

async function iconLabels() {
  // Keep scientific data helpers importable before browser assets are generated.
  const { uiIcon } = await import("./icons.js");
  return (kind, text) =>
    `${uiIcon(kind).outerHTML}<span>${escapeHTML(text)}</span>`;
}

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

export async function confirmDownload(filename) {
  const app = document.querySelector("#psilocin-app")?.f7;
  if (!app) return Promise.resolve(false);
  const iconLabel = await iconLabels();
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

const EXPORT_CONTEXT = Object.freeze({
  application: "Psilocin Transcriptome Atlas",
  archive_doi: "10.5281/zenodo.23283595",
  classification: "archived data or user-exploratory output, as identified within the file",
});

export function exportMetadata() {
  const source = new URL(location.href);
  // Test-only switches do not identify a reproducible scientific view.
  source.searchParams.delete("offline-test");
  return {
    ...EXPORT_CONTEXT,
    exported_utc: new Date().toISOString(),
    source_url: source.href,
  };
}

const text = value => typeof value === "string" ? value : value instanceof Blob ? null : new TextDecoder().decode(value);
const escapeAttribute = value => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
const commentPrefix = filename => /\.(?:py|pyw)$/i.test(filename) ? "#" : /\.(?:r|rmd|qmd)$/i.test(filename) ? "#" : "#";
function provenanceHeader(filename, meta) {
  const prefix = commentPrefix(filename);
  return `${prefix} ${meta.application}\n${prefix} Exported (UTC): ${meta.exported_utc}\n${prefix} Source view: ${meta.source_url}\n${prefix} Archived companion DOI: ${meta.archive_doi}\n${prefix} Classification: ${meta.classification}\n\n`;
}
function enrichJSON(value, meta) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return value;
    return JSON.stringify({...parsed, export_metadata: meta}, null, 2);
  } catch { return value; }
}
function enrichHTML(value, meta) {
  const tags = `<meta name="application-name" content="${escapeAttribute(meta.application)}"><meta name="dc.source" content="${escapeAttribute(meta.source_url)}"><meta name="citation_doi" content="${escapeAttribute(meta.archive_doi)}"><meta name="dcterms.created" content="${escapeAttribute(meta.exported_utc)}"><script type="application/ld+json">${JSON.stringify(meta).replaceAll("<", "\\u003c")}</script>`;
  return /<head(?:\s[^>]*)?>/i.test(value) ? value.replace(/<head(?:\s[^>]*)?>/i, match => `${match}${tags}`) : `<!doctype html><html lang="en"><head><meta charset="utf-8">${tags}</head><body>${value}</body></html>`;
}
function enrichExport(filename, content, type) {
  const value = text(content);
  if (value === null || /^image\//i.test(type) || /^(?:application\/pdf|application\/zip)/i.test(type)) return content;
  const meta = exportMetadata();
  if (/\.json$/i.test(filename) || /json/i.test(type)) return enrichJSON(value, meta);
  if (/\.html?$/i.test(filename) || /html/i.test(type)) return enrichHTML(value, meta);
  if (/\.(?:r|rmd|qmd|py|pyw|md|txt)$/i.test(filename)) return provenanceHeader(filename, meta) + value;
  // CSV is intentionally left as a strict data table: comment headers break
  // readers that implement RFC 4180 without a comment convention.
  if (/csv/i.test(type) || /\.csv$/i.test(filename)) return value;
  if (/^(?:text\/plain|text\/x-|application\/x-)/i.test(type)) return provenanceHeader(filename, meta) + value;
  return value;
}

function saveURL(filename, href) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  showToast(`Download started: ${filename}`);
}
export async function downloadFile(filename, content, type = "text/csv") {
  if (!(await confirmDownload(filename))) return false;
  const enriched = enrichExport(filename, content, type);
  const url = URL.createObjectURL(new Blob([enriched], { type }));
  saveURL(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
export async function downloadURL(filename, href) {
  if (!(await confirmDownload(filename))) return false;
  saveURL(filename, href);
  return true;
}
export async function showInformation(app, title, text) {
  const iconLabel = await iconLabels();
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
