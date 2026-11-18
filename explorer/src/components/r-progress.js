import { createElement as el, setLoadingMessage } from "./interface-utils.js";
const labels = [
  "Prepare archived data",
  "Load webR interface",
  "Start R worker",
  "Load analysis tables",
  "Run your script",
  "Prepare results",
];
export function createRProgress(status) {
  const panel = el("section", "r-progress-panel");
  panel.hidden = true;
  panel.setAttribute("aria-label", "R analysis progress");
  const header = el("div", "r-progress-header"),
    elapsed = el("span", "r-progress-elapsed");
  elapsed.setAttribute("aria-hidden", "true");
  header.append(status, elapsed);
  const detail = el("p", "r-progress-detail"),
    steps = el("ol", "r-progress-steps");
  const items = labels.map((label) => {
    const li = el("li", "", label);
    steps.append(li);
    return li;
  });
  const disclosure = el("details", "r-progress-log"),
    log = el("ol");
  disclosure.append(el("summary", "", "Activity details"), log);
  const actions = el("div", "r-progress-actions");
  const resources = el("section", "r-progress-resources");
  resources.hidden = true;
  const resourceCount = el("strong");
  const resourceList = el("ul");
  resources.append(resourceCount, resourceList);
  const files = new Map();
  const bytes = (value) =>
    value >= 1e6
      ? `${(value / 1e6).toFixed(1)} MB`
      : `${Math.ceil(value / 1000)} kB`;
  function resource(data) {
    if (panel.dataset.state !== "running") return;
    let file = files.get(data.path);
    if (!file) {
      file = { path: data.path, loaded: 0, state: "loading" };
      files.set(data.path, file);
    }
    const wasDone = file.state === "loaded";
    if (wasDone && data.state !== "loaded") return;
    file.loaded = Math.max(file.loaded, Number(data.loaded) || 0);
    if (data.total) file.total = data.total;
    if (data.source !== "module" || !file.source) file.source = data.source;
    file.state = data.state;
    file.updated = performance.now();
    resources.hidden = false;
    const all = [...files.values()];
    resourceCount.textContent = `Files · ${all.filter((x) => x.state === "loaded").length} ready${all.length > 8 ? " · latest 8 shown" : ""}`;
    resourceList.replaceChildren(
      ...all
        .sort(
          (a, b) =>
            (a.state === "loaded") - (b.state === "loaded") ||
            b.updated - a.updated,
        )
        .slice(0, 8)
        .map((file) => {
          const row = el("li");
          row.append(
            el("span", "r-resource-name", file.path.replace(/^webr\//, "")),
          );
          const total = file.total;
          row.append(
            el(
              "span",
              "r-resource-bytes",
              `${file.source === "module" ? "JavaScript module" : file.source}${file.loaded ? ` · ${bytes(file.loaded)}${total ? ` / ${bytes(total)}` : ""}` : ""}${file.state === "loaded" ? " · ready" : ""}`,
            ),
          );
          const bar = el(
            "div",
            `progressbar${!total && file.state !== "loaded" ? " progressbar-infinite" : ""}`,
          );
          bar.setAttribute("aria-label", file.path.replace(/^webr\//, ""));
          if (total) {
            bar.setAttribute("role", "progressbar");
            bar.setAttribute("aria-valuemin", "0");
            bar.setAttribute("aria-valuemax", String(total));
            bar.setAttribute(
              "aria-valuenow",
              String(Math.min(file.loaded, total)),
            );
          }
          const fill = el("span");
          fill.style.transform = `translate3d(-${100 - (total ? Math.min(100, (file.loaded / total) * 100) : file.state === "loaded" ? 100 : 0)}%,0,0)`;
          bar.append(fill);
          row.append(bar);
          return row;
        }),
    );
    if (data.state === "loaded" && !wasDone)
      note(
        `Loaded ${data.path.replace(/^webr\//, "")}${file.loaded ? ` · ${bytes(file.loaded)}` : ""} · ${file.source}`,
      );
  }
  disclosure.insertBefore(resources, log);
  panel.append(header, detail, steps, actions, disclosure);
  let started, timer;
  function time() {
    return `${Math.floor((performance.now() - started) / 1000)}s`;
  }
  function note(text) {
    log.append(el("li", "", `${time()} · ${text}`));
  }
  function stage(index, title, text) {
    items.forEach((item, i) => {
      item.dataset.state =
        i < index ? "done" : i === index ? "active" : "pending";
      if (i === index) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    setLoadingMessage(status, title);
    detail.textContent = text;
    note(title + (text ? ` — ${text}` : ""));
  }
  return {
    panel,
    actions,
    start() {
      clearInterval(timer);
      started = performance.now();
      panel.hidden = false;
      panel.dataset.state = "running";
      requestAnimationFrame(() => {
        if (panel.isConnected)
          panel.scrollIntoView({
            block: "start",
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
      });
      log.replaceChildren();
      files.clear();
      resourceList.replaceChildren();
      resources.hidden = true;
      elapsed.textContent = "0s elapsed";
      timer = setInterval(
        () => (elapsed.textContent = `${time()} elapsed`),
        1000,
      );
    },
    stage,
    note,
    resource,
    finish(message) {
      clearInterval(timer);
      if (!started) return;
      panel.dataset.state = "finished";
      elapsed.textContent = `${time()} elapsed`;
      status.classList.remove("inline-loading");
      status.textContent = message;
      detail.textContent = "";
      note(message);
      items.forEach((item) => item.removeAttribute("aria-current"));
      if (message.startsWith("Analysis complete"))
        items.forEach((item) => (item.dataset.state = "done"));
    },
    destroy() {
      clearInterval(timer);
    },
  };
}
