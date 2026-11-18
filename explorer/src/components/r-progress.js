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
      elapsed.textContent = "0s elapsed";
      timer = setInterval(
        () => (elapsed.textContent = `${time()} elapsed`),
        1000,
      );
    },
    stage,
    note,
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
