import {
  createElement as el,
  createSheetToolbar,
  closeSheet,
  destroySheet,
  loadingMessage,
} from "./interface-utils.js";
import { downloadFile } from "./file-download.js";
import { researchTableCSV } from "./research-datasets.js";

let datasetSequence = 0;

/** Browse frozen input metadata without initializing a computational runtime. */
export async function openResearchDatasets({
  root,
  getTables,
  onInsert,
  onImport,
}) {
  const sheet = el(
    "section",
    "sheet-modal studio-pane-sheet workspace-datasets-sheet",
  );
  sheet.setAttribute("aria-label", "Datasets");
  const handle = el("div", "sheet-handle"),
    done = el("button", "link", "Done");
  done.type = "button";
  const header = createSheetToolbar("Datasets", [done]);
  const body = el("div", "sheet-modal-inner"),
    stage = el("div");
  body.append(
    el(
      "p",
      "note",
      "Frozen input tables · archive DOI 10.5281/zenodo.23283595. These are fitted estimates and pooled profiles, not raw counts.",
    ),
    stage,
  );
  sheet.append(handle, header, body);
  const container =
    document.fullscreenElement || document.webkitFullscreenElement || root;
  container.append(sheet);
  let disposed = false;
  const modal = root.f7.sheet.create({
    el: sheet,
    containerEl: container,
    backdrop: true,
    closeOnEscape: false,
    swipeToClose: true,
    swipeHandler: handle,
    push: false,
    on: {
      closed() {
        disposed = true;
        sheet.remove();
        setTimeout(() => destroySheet(modal), 0);
      },
    },
  });
  done.onclick = () => closeSheet(modal);
  stage.append(loadingMessage("Loading dataset metadata…"));
  modal.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  function button(text, fn) {
    const b = el("button", "button", text);
    b.type = "button";
    b.onclick = fn;
    return b;
  }
  function afterClose(fn) {
    modal.once("closed", fn);
    closeSheet(modal);
  }
  try {
    const tables = await getTables();
    if (disposed || !sheet.isConnected) return;
    stage.replaceChildren();
    const list = el("div", "list list-strong list-dividers"),
      ul = el("ul");
    list.append(ul);
    for (const [name, rows] of Object.entries(tables)) {
      const li = el("li", "accordion-item workspace-dataset-group"),
        toggle = el("button", "item-link item-content dataset-toggle"),
        inner = el("span", "item-inner");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", `Show ${name} columns and actions`);
      inner.append(
        el("span", "item-title", name),
        el("span", "item-after", `${rows.length.toLocaleString()} rows`),
      );
      toggle.append(inner);
      const content = el("div", "accordion-item-content"),
        details = el("div", "block"),
        actions = el("div", "segmented segmented-strong");
      content.id = `workspace-dataset-${++datasetSequence}`;
      content.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-controls", content.id);
      details.append(el("p", "note", Object.keys(rows[0] || {}).join(" · ")));
      actions.append(
        button("Download CSV", () =>
          downloadFile(`${name}.csv`, researchTableCSV(rows), "text/csv"),
        ),
        button("Inspect in R", () =>
          afterClose(() =>
            onInsert(`results <- head(${name}, 50)\nprint(results)`),
          ),
        ),
      );
      details.append(actions);
      content.append(details);
      li.append(toggle, content);
      ul.append(li);
      li.addEventListener("accordion:open", () => {
        toggle.setAttribute("aria-expanded", "true");
        content.setAttribute("aria-hidden", "false");
      });
      li.addEventListener("accordion:close", () => {
        toggle.setAttribute("aria-expanded", "false");
        content.setAttribute("aria-hidden", "true");
      });
    }
    const add = button("Import dataset", () => afterClose(onImport));
    add.classList.add("button-tonal");
    stage.append(list, add);
  } catch (error) {
    if (!disposed) stage.replaceChildren(el("p", "note", error.message));
  }
  return modal;
}
