import {
  createElement as el,
  createSheetToolbar,
  closeSheet,
  destroySheet,
  loadingMessage,
} from "./interface-utils.js";
import { downloadFile } from "./file-download.js";
import { researchTableCSV } from "./research-datasets.js";
import { uiIcon } from "./icons.js";
import { showToast } from "./app-toast.js";

let datasetSequence = 0;

/** Browse frozen input metadata without initializing a computational runtime. */
export async function openResearchDatasets({
  root,
  getTables,
  getMetadata,
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
    stage = el("div", "dataset-catalogue");
  body.append(
    el(
      "p",
      "note dataset-provenance",
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
    const metadata = getMetadata ? await getMetadata() : Object.fromEntries(Object.entries(await getTables()).map(([name,rows])=>[name,{count:rows.length,columns:Object.keys(rows[0]||{})}]));
    if (disposed || !sheet.isConnected) return;
    stage.replaceChildren(el("h3","dataset-section-title",`${Object.keys(metadata).length} archived input tables`));
    const list = el("div", "list list-strong list-dividers dataset-list"),
      ul = el("ul");
    list.append(ul);
    for (const [name, {count,columns}] of Object.entries(metadata)) {
      const li = el("li", "accordion-item workspace-dataset-group"),
        toggle = el("button", "item-link item-content dataset-toggle"),
        inner = el("span", "item-inner");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", `Show ${name} columns and actions`);
      inner.append(
        el("span", "item-title", name),
        el("span", "item-after", `${count.toLocaleString("en-US")} rows`),
      );
      const media=el("span","item-media dataset-icon");media.append(uiIcon("landscape"));
      toggle.append(media,inner);
      const content = el("div", "accordion-item-content"),
        details = el("div", "dataset-details"),
        actions = el("div", "dataset-actions");
      content.id = `workspace-dataset-${++datasetSequence}`;
      content.setAttribute("aria-hidden", "true");
      toggle.setAttribute("aria-controls", content.id);
      details.append(el("p","dataset-column-heading",`${columns.length} columns`),el("p", "note dataset-columns", columns.join(" · ") || "No recorded columns"));
      const download=button("Download CSV", async()=> {
        download.disabled=true;
        try {const rows=(await getTables())[name];if(!disposed)await downloadFile(`${name}.csv`,researchTableCSV(rows),"text/csv");}
        catch(error){if(!disposed)showToast(error.message);}
        finally{if(!disposed)download.disabled=false;}
      });
      const inspect=button("Inspect in R",()=>afterClose(()=>onInsert(`results <- head(${name}, 50)\nprint(results)`)));
      download.classList.add("button-tonal");inspect.classList.add("button-tonal");
      actions.append(download,inspect);
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
    add.classList.add("button-fill","dataset-import");
    const footer=el("div","dataset-footer");footer.append(add);
    stage.append(list, footer);
  } catch (error) {
    if (!disposed) stage.replaceChildren(el("p", "note", error.message));
  }
  return modal;
}
