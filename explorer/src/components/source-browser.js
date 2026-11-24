import { renderSourceMarkdown } from "./source-markdown.js";
import build from "../assets/vendor/app-build.js";
import { createElement as el, loadingMessage } from "./interface-utils.js";
import { uiIcon } from "./icons.js";

const repository = build.repository || "https://github.com/psilocybin-research/psilocin-human-neuron-transcriptomics";
const api = repository.replace("https://github.com/", "https://api.github.com/repos/");
const cacheName = "atlas-source-v1";
const maxFileSize = 512 * 1024;
export function sourceUrl(path = "") {
  return `${repository}/tree/${build.commit}/${path.split("/").map(encodeURIComponent).join("/")}`;
}
function link(text, href, cls = "button button-tonal") {
  const a = el("a", `${cls} external`, text);
  a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
  return a;
}

// Read-only public API access: no credentials or background polling; remote Markdown is sanitized.
export function createSourceBrowser({ app, root }) {
  const controller = new AbortController();
  const popup = el("div", "popup source-browser");
  const view = el("div", "view"), page = el("div", "page");
  const navbar = el("div", "navbar source-browser-navbar"), inner = el("div", "navbar-inner");
  navbar.append(el("div", "navbar-bg"));
  const heading = el("div", "title source-browser-heading");
  heading.append(
    el("strong", "source-browser-title", "Source & reproducibility"),
    el("small", "source-browser-revision", `Pinned revision · ${build.commit.slice(0, 12)}${build.dirty ? " · Uncommitted changes excluded" : ""}`)
  );
  const right = el("div", "right"), close = el("a", "link icon-only popup-close source-browser-close");
  close.href = "#"; close.setAttribute("aria-label", "Close"); close.append(uiIcon("close"));
  right.append(close); inner.append(heading, right); navbar.append(inner);
  const toolbar = el("div", "toolbar toolbar-top tabbar tabbar-scrollable source-browser-tabs");
  const toolbarInner = el("div", "toolbar-inner"), tabs = el("div", "tabs source-browser-content");
  toolbarInner.setAttribute("role", "tablist");
  toolbarInner.setAttribute("aria-label", "Source browser");
  const panels = new Map();
  for (const [id, label] of [["overview", "Overview"], ["files", "Files"], ["live", "Live"], ["build", "Reproducibility"]]) {
    const button = el("a", `tab-link${id === "overview" ? " tab-link-active" : ""}`, label);
    button.href = `#source-${id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `source-${id}`);
    button.setAttribute("aria-selected", String(id === "overview"));
    button.onclick = () => {
      for (const tab of toolbarInner.children) tab.setAttribute("aria-selected", String(tab === button));
    };
    toolbarInner.append(button);
    const panel = el("div", `page-content tab${id === "overview" ? " tab-active" : ""}`);
    panel.setAttribute("role", "tabpanel");
    panel.id = `source-${id}`; panels.set(id, panel); tabs.append(panel);
  }
  toolbar.append(toolbarInner);
  page.append(navbar, toolbar, tabs); view.append(page); popup.append(view); root.append(popup);
  const instance = app.popup.create({ el: popup, backdrop: true, closeOnEscape: false, closeByBackdropClick: true });
  let request = 0, currentPath = "", loaded = false;
  const search = el("form", "searchbar searchbar-inline"), searchInner = el("div", "searchbar-inner"), inputWrap = el("div", "searchbar-input-wrap");
  search.setAttribute("role", "search");
  const input = el("input"); input.type = "search"; input.placeholder = "Find files in this build"; input.setAttribute("aria-label", "Find repository files");
  const clear = el("button", "input-clear-button"); clear.type = "button"; clear.setAttribute("aria-label", "Clear file search");
  inputWrap.append(input, el("i", "searchbar-icon"), clear); searchInner.append(inputWrap); search.append(searchInner);
  const fileContent = el("div"), results = el("div"); results.hidden = true; results.setAttribute("aria-live", "polite");
  panels.get("files").append(search, results, fileContent);
  const searchbar = app.searchbar.create({ el: search, customSearch: true, backdrop: false });
  let tree, treePending, searchTimer, searchSequence = 0;
  async function findFiles() {
    const query = input.value.trim().toLowerCase(), sequence = ++searchSequence;
    results.hidden = !query; fileContent.hidden = Boolean(query);
    if (!query) return;
    results.replaceChildren(loadingMessage("Finding files…"));
    try {
      if (!tree) {
        treePending ??= (async () => {
          const key = `${api}/git/trees/${build.commit}?recursive=1`;
          let cache; try { cache = await caches.open(cacheName); const hit = await cache.match(key); if (hit) return hit.json(); } catch { /* Optional cache. */ }
          const response = await fetch(key, {signal:controller.signal,credentials:"omit"});
          if (!response.ok) throw new Error("File search could not load. Try again later or browse folders.");
          try { await cache?.put(key,response.clone()); } catch { /* Optional cache. */ }
          return response.json();
        })().catch(error => { treePending = undefined; throw error; });
        tree = await treePending;
      }
      if (sequence !== searchSequence || controller.signal.aborted) return;
      const matches = tree.tree.filter(item => item.type === "blob" && query.split(/\s+/).every(word => item.path.toLowerCase().includes(word)));
      const block = el("div", "block"); block.append(el("p", "note", `${matches.length} matching files${matches.length > 100 ? " · showing the first 100; refine your search" : ""}${tree.truncated ? " · GitHub returned a partial file index" : ""}`));
      const list = el("div", "list list-dividers"), ul = el("ul");
      for (const item of matches.slice(0,100)) {
        const li = el("li"), button = el("button", "item-link item-content"), inner = el("span", "item-inner"); button.type = "button";
        inner.append(el("span", "item-title", item.path));button.append(inner);button.onclick=()=>{input.value="";findFiles();browse(item.path);};li.append(button);ul.append(li);
      }
      list.append(ul); results.replaceChildren(block,list);
    } catch (error) { if (sequence === searchSequence && !controller.signal.aborted) results.replaceChildren(el("p","block note",error.message)); }
  }
  search.onsubmit = event => {event.preventDefault();clearTimeout(searchTimer);findFiles();};
  input.oninput = () => {clearTimeout(searchTimer);searchTimer=setTimeout(findFiles,180);};
  clear.onclick = () => {input.value="";clearTimeout(searchTimer);findFiles();input.focus();};

  async function read(path, raw = false) {
    const url = `${api}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${build.commit}`;
    const key = new Request(url, { headers: { Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json" } });
    // Different representations need separate cache keys.
    const cacheKey = `${url}&representation=${raw ? "raw" : "json"}`;
    let cache;
    try { cache = await caches.open(cacheName); const hit = await cache.match(cacheKey); if (hit) return raw ? hit.text() : hit.json(); } catch { /* Storage is optional. */ }
    const response = await fetch(key, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "GitHub’s request limit was reached. Try again later or open GitHub." : "Source could not be loaded. Check your connection or open GitHub.");
    try { await cache?.put(cacheKey, response.clone()); } catch { /* Quota must not prevent reading. */ }
    return raw ? response.text() : response.json();
  }
  function failure(host, error, retry) {
    if (controller.signal.aborted) return;
    const message = el("div", "block"); message.setAttribute("role", "status");
    message.append(el("p", "", error.message));
    const button = el("button", "button button-tonal", "Retry"); button.type = "button"; button.onclick = retry;
    message.append(button, link("Open on GitHub", sourceUrl(currentPath))); host.replaceChildren(message);
  }
  async function browse(path = "") {
    currentPath = path; const token = ++request, host = fileContent;
    host.replaceChildren(loadingMessage("Loading pinned source…"));
    try {
      const data = await read(path); if (token !== request || controller.signal.aborted) return;
      const block = el("div", "block"), crumbs = el("div", "breadcrumbs"); crumbs.setAttribute("aria-label", "Source folders");
      const parts = path ? path.split("/") : [];
      for (let i = 0; i <= parts.length; i++) {
        if (i) crumbs.append(el("span", "breadcrumbs-separator", "/"));
        const a = el("button", "breadcrumbs-item", i ? parts[i - 1] : "Repository"); a.type = "button";
        a.onclick = () => browse(parts.slice(0, i).join("/")); crumbs.append(a);
      }
      block.append(crumbs); host.replaceChildren(block);
      if (Array.isArray(data)) {
        const list = el("div", "list list-dividers source-file-list"), ul = el("ul");
        for (const item of data.sort((a, b) => Number(b.type === "dir") - Number(a.type === "dir") || a.name.localeCompare(b.name))) {
          const li = el("li"), button = el("a", "item-link item-content source-file-row"), media = el("span", "item-media");
          button.href = "#";
          button.setAttribute("aria-label", `${item.type === "dir" ? "Open folder" : "View file"}: ${item.name}`);
          media.append(uiIcon(item.type === "dir" ? "folder" : "doc_text"));
          const text = el("span", "item-inner"); text.append(el("span", "item-title", item.name));
          button.append(media, text);
          button.onclick = event => { event.preventDefault(); browse(item.path); };
          li.append(button); ul.append(li);
        }
        list.append(ul); host.append(list);
        if (data.length >= 1000) block.append(el("p", "note", "GitHub limits directory listings to 1,000 entries. Open GitHub for the complete directory."));
      } else {
        block.append(link("Open file on GitHub", `${repository}/blob/${build.commit}/${path.split("/").map(encodeURIComponent).join("/")}`));
        if (data.type !== "file" || data.size > maxFileSize || !/\.(md|txt|js|mjs|css|json|py|R|toml|yaml|yml|cff|csv|tsv|html|sh)$|(^|\/)(Makefile|LICENSE[^/]*)$/i.test(path)) {
          block.append(el("p", "note", "Preview is available for text files up to 512 KB. Open GitHub to view or download this file.")); return;
        }
        const text = await read(path, true); if (token !== request || controller.signal.aborted) return;
        block.append(el("pre", "source-code", text));
      }
    } catch (error) { if (token === request) failure(host, error, () => browse(path)); }
  }
  async function overview() {
    const host = panels.get("overview"); host.replaceChildren(loadingMessage("Loading repository overview…"));
    try {
      const text = await read("README.md", true); if (controller.signal.aborted) return;
      const block = el("div", "block source-browser-overview");
      const heading = el("div", "source-browser-repository");
      const headingText = el("div", "source-browser-repository-text");
      headingText.append(
        el("strong", "", "Published GitHub source"),
        el("p", "", "Documentation and files from the exact revision used to build this atlas.")
      );
      heading.append(headingText, link("Open on GitHub", sourceUrl(), "button button-tonal source-browser-github-link"));
      const readme = el("section", "source-browser-readme-section");
      readme.setAttribute("aria-label", "Repository README");
      readme.append(
        el("h2", "source-browser-section-title", "Repository README"),
        renderSourceMarkdown(text, { repository, commit: build.commit })
      );
      block.append(heading, readme);
      host.replaceChildren(block);
    } catch (error) { failure(host, error, overview); }
  }
  const live = el("div", "block"), liveStatus = el("div");
  liveStatus.setAttribute("aria-live", "polite");
  live.append(el("p", "note", "Live GitHub activity is separate from the pinned source. Checking does not update this app or its scientific results."));
  const refresh = el("button", "button button-tonal", "Check GitHub now"); refresh.type = "button";
  let lastCheck = 0;
  async function checkLive() {
    if (refresh.disabled) return;
    // Explicit refresh only; a short cooldown avoids accidental request bursts.
    if (Date.now() - lastCheck < 60000) return;
    refresh.disabled = true; liveStatus.replaceChildren(loadingMessage("Checking GitHub…"));
    try {
      const response = await fetch(`${api}/compare/${build.commit}...main`, { signal: controller.signal, credentials: "omit", cache: "no-cache", headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? "GitHub’s request limit was reached. Please try later." : "GitHub could not be checked. Your pinned source remains available.");
      const data = await response.json(); if (controller.signal.aborted) return;
      const card = el("div", "card card-outline"), body = el("div", "card-content card-content-padding");
      const status = data.status === "identical" ? "This build matches GitHub main." : data.status === "ahead" ? `GitHub main is ${data.ahead_by} commit${data.ahead_by === 1 ? "" : "s"} ahead of this build.` : "GitHub main and this build have different histories.";
      body.append(el("strong", "", status), el("p", "note", `Checked ${new Date().toLocaleString()}. New source commits do not necessarily mean a new app has been deployed.`), link("Compare with this build", `${repository}/compare/${build.commit}...main`));
      card.append(body); liveStatus.replaceChildren(card);
      const commits = (data.commits || []).slice(-5).reverse();
      if (commits.length) {
        const list = el("div", "list list-dividers source-link-list"), ul = el("ul");
        for (const commit of commits) {
          const li = el("li"), a = link("", `${repository}/commit/${commit.sha}`, "item-link item-content"), inner = el("span", "item-inner");
          inner.append(el("span", "item-title", commit.commit.message.split("\n")[0])); a.append(inner); li.append(a); ul.append(li);
        }
        list.append(ul); liveStatus.append(el("h3", "", "Recent commits since this build"), list);
      }
      lastCheck = Date.now();
      try { localStorage.setItem("atlas-source-live", JSON.stringify({ commit: build.commit, checked: lastCheck, status })); } catch { /* Optional offline status. */ }
    } catch (error) {
      if (!controller.signal.aborted) liveStatus.replaceChildren(el("p", "note", error.message));
    } finally { refresh.disabled = false; }
  }
  refresh.onclick = checkLive;
  try {
    const saved = JSON.parse(localStorage.getItem("atlas-source-live"));
    if (saved?.commit === build.commit) liveStatus.append(el("p", "note", `Last saved check · ${new Date(saved.checked).toLocaleString()}: ${saved.status} Check again for current status.`));
  } catch { /* No saved status. */ }
  live.append(refresh, liveStatus); panels.get("live").append(live);
  const provenance = el("div", "block");
  provenance.append(el("p", "", "This browser reads the exact committed revision used to build the app. Cached files remain readable offline after opening them. GitHub’s latest branch may contain newer changes."), el("p", "note", `Commit: ${build.commit}`));
  const links = el("div", "list list-dividers source-link-list"), ul = el("ul");
  for (const [label, href] of [["Download this source revision", `${repository}/archive/${build.commit}.zip`], ["Citation", sourceUrl("CITATION.cff")], ["Licences", sourceUrl("LICENSE.md")], ["Frozen publication archive · v1.2.0", "https://doi.org/10.5281/zenodo.23283595"], ["Latest repository on GitHub", repository], ["Report an issue on GitHub", `${repository}/issues/new?body=${encodeURIComponent(`App source commit: ${build.commit}\n\nDescribe the issue and steps to reproduce:\n`)}`]]) {
    const li = el("li"), a = link("", href, "item-link item-content"), inner = el("span", "item-inner"); inner.append(el("span", "item-title", label)); a.append(inner); li.append(a); ul.append(li);
  }
  links.append(ul); panels.get("build").append(provenance, links);
  return {
    open() { instance.open(); if (!loaded) { loaded = true; overview(); browse(); } },
    destroy() { searchbar.destroy(); clearTimeout(searchTimer); controller.abort(); instance.destroy(); popup.remove(); },
  };
}
