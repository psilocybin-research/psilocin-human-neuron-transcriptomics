import {notebookPublication} from "./notebook-publication.js";
// Local notebooks contain researcher-authored material only. They never execute on load.
import { createElement as el } from "./interface-utils.js";
import { downloadFile } from "./file-download.js";
import { rExamples } from "./r-examples.js";
import { createRRecipeBuilder } from "./r-recipe-builder.js";

const databaseName = "psilocin-research-studio-v1";
export const notebookSchema = "psilocin-research-notebooks/1";
const id = () => crypto.randomUUID();
export function createNotebook(title = "Untitled notebook", code = "") {
  return {
    id: id(),
    title: title.slice(0, 120),
    created: new Date().toISOString(),
    cells: [{ id: id(), kind: "code", source: code, runs: [] }],
  };
}
export function validateWorkspace(value) {
  if (
    value?.schema !== notebookSchema ||
    !Array.isArray(value.notebooks) ||
    !value.notebooks.length ||
    value.notebooks.length > 30
  )
    throw Error(
      "Choose a Research Studio notebook export with 1–30 notebooks.",
    );
  const notebooks = value.notebooks.map((book) => {
    if (
      !book ||
      !Array.isArray(book.cells) ||
      !book.cells.length ||
      book.cells.length > 200
    )
      throw Error("A notebook may contain at most 200 cells.");
    return {
      id: String(book.id || id()),
      title: String(book.title || "Untitled notebook").slice(0, 120),
      created: String(book.created || new Date().toISOString()),
      cells: book.cells.map((cell) => {
        if (
          !cell ||
          !["code", "markdown"].includes(cell.kind) ||
          typeof cell.source !== "string" ||
          cell.source.length > 65536
        )
          throw Error(
            "Invalid notebook cell or code exceeds 65,536 characters.",
          );
        return {
          id: String(cell.id || id()),
          kind: cell.kind,
          source: cell.source,
          runs: Array.isArray(cell.runs)
            ? cell.runs
                .slice(-20)
                .filter(
                  (run) =>
                    run && typeof run === "object" && !Array.isArray(run),
                )
                .map((run) => ({
                  ...run,
                  console:
                    typeof run.console === "string"
                      ? run.console.slice(0, 200000)
                      : "",
                  results_csv:
                    typeof run.results_csv === "string" ? run.results_csv : "",
                  vector_svgs: Array.isArray(run.vector_svgs)
                    ? run.vector_svgs
                        .filter((svg) => typeof svg === "string")
                        .slice(0, 4)
                    : [],
                }))
            : [],
        };
      }),
    };
  });
  if (
    new Set(notebooks.map((book) => book.id)).size !== notebooks.length ||
    notebooks.some(
      (book) =>
        new Set(book.cells.map((cell) => cell.id)).size !== book.cells.length,
    )
  )
    throw Error("Notebook and cell identifiers must be unique.");
  return {
    schema: notebookSchema,
    notebooks,
    active: notebooks.some((book) => book.id === value.active)
      ? value.active
      : notebooks[0].id,
  };
}
export async function verifyNotebookArchive(value, cryptoAPI = globalThis.crypto) {
  const {integrity, ...payload} = value || {};
  if (integrity?.algorithm !== "SHA-256" || !/^[a-f0-9]{64}$/.test(integrity.sha256 || ""))
    throw Error("Choose a notebook export with a SHA-256 integrity record.");
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const hash = [...new Uint8Array(await cryptoAPI.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
  if (hash !== integrity.sha256) throw Error("Notebook checksum mismatch. The file is altered or incomplete; nothing was imported.");
  return validateWorkspace(payload);
}
export function openNotebookStore(indexedDB = globalThis.indexedDB) {
  let connection;
  const open = () =>
    (connection ||= new Promise((resolve, reject) => {
      if (!indexedDB)
        return reject(Error("IndexedDB is unavailable in this browser."));
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("workspaces");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }));
  return {
    async read() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db
          .transaction("workspaces")
          .objectStore("workspaces")
          .get("active");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    async write(value) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("workspaces", "readwrite");
        tx.objectStore("workspaces").put(value, "active");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () =>
          reject(tx.error || Error("Notebook save was interrupted."));
      });
    },
    async close() {
      if (connection) (await connection).close();
    },
  };
}

// Markdown is deliberately rendered as text, with safe headings and lists; HTML is never evaluated.
export function renderNotebookMarkdown(source, document = globalThis.document) {
  const fragment = document.createDocumentFragment();
  for (const line of source.split("\n")) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const node = document.createElement(
      heading ? `h${heading[1].length + 1}` : /^[-*]\s+/.test(line) ? "p" : "p",
    );
    node.textContent = heading ? heading[2] : line;
    fragment.append(node);
  }
  return fragment;
}
export function createRNotebooks({
  editor,
  action,
  root,
  initialCode,
  getSources,
  onCellChange,
  onNotebookChange,
  onStatus,
}) {
  const store = openNotebookStore();
  const first = createNotebook("Exploratory analysis", initialCode);
  let workspace = {
    schema: notebookSchema,
    notebooks: [first],
    active: first.id,
  };
  let activeCell = first.cells[0].id,
    busy = false,
    ready = false,
    saveTimer,
    destroyed = false,
    revision = 0;
  const pendingSelections = [];
  const host = el("section", "research-studio-notebooks");
  const title = el("h3", "", "Research notebooks");
  const toolbar = el("div", "custom-r-toolbar research-studio-toolbar");
  const books = el("select");
  books.setAttribute("aria-label", "Research notebook");
  const status = el("p", "note", "Opening local notebook storage…");
  status.setAttribute("role", "status");
  const list = el("div", "research-studio-cell-list");
  const notes = el("textarea", "research-studio-markdown");
  notes.setAttribute("aria-label", "Markdown cell");
  notes.rows = 8;
  const preview = el("div", "research-studio-markdown-preview");
  const history = el("details", "research-studio-history");
  const historyRows = el("div");
  history.append(el("summary", "", "Cell execution history"), historyRows);
  const mode = el(
    "p",
    "note",
    "Each cell starts a fresh R session. Include its required definitions in that cell, or enable a shared session. Drafts and the last 20 runs per cell are saved on this device; export notebooks to keep a copy.",
  );
  const notebook = () =>
    workspace.notebooks.find((book) => book.id === workspace.active);
  const cell = () => notebook().cells.find((item) => item.id === activeCell);
  function capture() {
    const current = cell();
    if (current?.kind === "code") current.source = editor.value;
  }
  async function save() {
    if (!ready || destroyed) return;
    capture();
    try {
      await store.write(structuredClone(workspace));
      status.textContent = "Saved on this device · never runs automatically.";
    } catch (error) {
      status.textContent = `Local save unavailable: ${error.message} Export your notebooks to retain them.`;
    }
  }
  function changed() {
    revision++;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }
  function renderHistory() {
    historyRows.replaceChildren();
    for (const run of [...(cell()?.runs || [])].reverse()) {
      const item = el("details", "research-studio-run");
      item.append(
        el(
          "summary",
          "",
          `${run.run_utc || "Run"} · ${run.error ? "Error" : "Complete"}`,
        ),
      );
      item.append(
        el(
          "pre",
          "custom-r-console",
          String(run.console || run.message || "No console output."),
        ),
      );
      item.append(
        action("Download cell run", "download", () =>
          downloadFile(
            "psilocin-notebook-run.json",
            JSON.stringify(run, null, 2),
            "application/json",
          ),
        ),
      );
      historyRows.append(item);
    }
    history.hidden = !cell()?.runs?.length;
  }
  let renderedNotebook;
  function render() {
    if (renderedNotebook && renderedNotebook !== workspace.active) onNotebookChange?.();
    renderedNotebook = workspace.active;
    books.replaceChildren(
      ...workspace.notebooks.map((book) => {
        const option = el("option", "", book.title);
        option.value = book.id;
        return option;
      }),
    );
    books.value = workspace.active;
    list.replaceChildren();
    notebook().cells.forEach((item, index) => {
      const row = el("div", "research-studio-cell-row");
      const select = action(
        `${index + 1}. ${item.kind === "code" ? "R" : "Markdown"} · ${
          item.source
            .split("\n")
            .find((line) => line.trim())
            ?.slice(0, 65) || "Empty cell"
        }`,
        "custom-r",
        () => {
          if (busy) return;
          capture();
          activeCell = item.id;
          render();
          changed();
        },
      );
      select.setAttribute("aria-pressed", String(item.id === activeCell));
      select.disabled = busy;
      row.append(select);
      list.append(row);
    });
    const current = cell();
    notes.hidden = preview.hidden = current?.kind !== "markdown";
    editor.hidden = current?.kind !== "code";
    if (current?.kind === "code") editor.value = current.source;
    if (current?.kind === "markdown") {
      notes.value = current.source;
      preview.replaceChildren(renderNotebookMarkdown(current.source));
    }
    onCellChange?.(current);
    renderHistory();
  }
  books.onchange = () => {
    capture();
    workspace.active = books.value;
    activeCell = notebook().cells[0]?.id;
    render();
    changed();
  };
  notes.oninput = () => {
    if (!cell()) return;
    cell().source = notes.value;
    preview.replaceChildren(renderNotebookMarkdown(notes.value));
    changed();
  };
  editor.addEventListener("input", changed);
  const newBook = action("New notebook", "plus", () => {
    if (workspace.notebooks.length >= 30)
      return onStatus?.(
        "Maximum 30 notebooks; export and remove an unused notebook first.",
      );
    capture();
    const book = createNotebook();
    workspace.notebooks.push(book);
    workspace.active = book.id;
    activeCell = book.cells[0].id;
    render();
    changed();
  });
  const rename = action("Rename", "controls", () =>
    root.f7.dialog.prompt(
      "Notebook title",
      "Rename notebook",
      (value) => {
        notebook().title = value.trim().slice(0, 120) || "Untitled notebook";
        render();
        changed();
      },
      undefined,
      notebook().title,
    ),
  );
  function appendCell(kind, source = "") {
    if (busy || notebook().cells.length >= 200) return;
    capture();
    const item = { id: id(), kind, source, runs: [] };
    notebook().cells.push(item);
    activeCell = item.id;
    render();
    changed();
  }
  const addCode = action("Add R cell", "plus", () => appendCell("code"));
  const addMarkdown = action("Add Markdown", "plus", () =>
    appendCell(
      "markdown",
      "## Notes\nDocument your question, assumptions and interpretation.",
    ),
  );
  const removeBook = action("Remove notebook", "close", () =>
    root.f7.dialog.confirm(
      "Remove this notebook and its local run history? Export it first if you need a copy.",
      "Remove notebook",
      () => {
        if (workspace.notebooks.length === 1)
          return onStatus?.(
            "Keep at least one notebook. Create another notebook before removing this one.",
          );
        workspace.notebooks = workspace.notebooks.filter(
          (book) => book.id !== workspace.active,
        );
        workspace.active = workspace.notebooks[0].id;
        activeCell = notebook().cells[0]?.id;
        render();
        changed();
      },
    ),
  );
  const move = (offset) => {
    capture();
    const cells = notebook().cells;
    const from = cells.findIndex((item) => item.id === activeCell),
      to = from + offset;
    if (from < 0 || to < 0 || to >= cells.length) return;
    [cells[from], cells[to]] = [cells[to], cells[from]];
    render();
    changed();
  };
  const moveUp = action("Move cell up", "top", () => move(-1));
  const moveDown = action("Move cell down", "top", () => move(1));
  moveDown
    .querySelector("svg")
    ?.setAttribute("style", "transform:rotate(180deg);fill:currentColor");
  const remove = action("Remove cell", "close", () =>
    root.f7.dialog.confirm(
      "Remove the selected cell and its local run history?",
      "Remove cell",
      () => {
        notebook().cells = notebook().cells.filter(
          (item) => item.id !== activeCell,
        );
        if (!notebook().cells.length)
          notebook().cells.push({
            id: id(),
            kind: "code",
            source: "",
            runs: [],
          });
        activeCell = notebook().cells[0].id;
        render();
        changed();
      },
    ),
  );
  const exportButton = action("Export notebooks", "download", async () => {
    capture();
    const payload = {
      ...structuredClone(workspace),
      exported_utc: new Date().toISOString(),
      provenance: getSources(),
      execution:
        "Explicit runs only; execution_mode, session_id and prior_cells in each run record distinguish isolated cells from shared sessions. Drafts never auto-run.",
      classification:
        "researcher-generated exploratory notebooks; archived inputs remain immutable",
    };
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const sha256 = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", encoded)),
    ]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    downloadFile(
      "psilocin-research-notebooks.json",
      JSON.stringify(
        {
          ...payload,
          integrity: {
            algorithm: "SHA-256",
            scope: "UTF-8 JSON.stringify(payload) before integrity field",
            sha256,
          },
        },
        null,
        2,
      ),
      "application/json",
    );
  });
  const file = el("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.hidden = true;
  file.onchange = async () => {
    try {
      if (!file.files[0]) return;
      if (file.files[0].size > 20 * 1024 * 1024)
        throw Error("Notebook import is limited to 20 MB.");
      const imported = await verifyNotebookArchive(JSON.parse(await file.files[0].text()));
      root.f7.dialog.confirm(
        "Replace the notebooks on this device with this file? Export existing notebooks first. Imported code will not run.",
        "Import notebooks",
        () => {
          onNotebookChange?.();
          workspace = imported;
          activeCell = notebook().cells[0]?.id;
          render();
          changed();
        },
      );
    } catch (error) {
      onStatus?.(error.message);
    }
    file.value = "";
  };
  const importButton = action("Import notebooks", "download", () =>
    file.click(),
  );
  const management = el("details", "research-studio-notebook-actions");
  const managementActions = el("div", "custom-r-toolbar");
  managementActions.append(
    rename,
    moveUp,
    moveDown,
    remove,
    removeBook,
    importButton,
    file,
  );
  for (const [format, title] of [["html", "Download notebook HTML"], ["qmd", "Download Quarto source"], ["Rmd", "Download R Markdown"]]) {
    managementActions.append(action(title, "download", () => {
      capture();
      downloadFile(`research-notebook.${format}`, notebookPublication(notebook(), format), format === "html" ? "text/html" : "text/plain");
    }));
  }
  management.append(el("summary", "", "Notebook actions"), managementActions);
  toolbar.append(books, newBook, addCode, addMarkdown, exportButton);
  const builder = createRRecipeBuilder({
    action,
    onGenerate: (source) => appendCell("code", source),
    onStatus,
  });
  host.append(
    title,
    toolbar,
    management,
    status,
    list,
    mode,
    builder,
    notes,
    preview,
    history,
  );
  const mutators = [
    books,
    newBook,
    rename,
    addCode,
    addMarkdown,
    moveUp,
    moveDown,
    remove,
    removeBook,
    importButton,
  ];
  render();
  const initialRevision = revision;
  store
    .read()
    .then((saved) => {
      if (destroyed) return;
      if (saved && revision === initialRevision) {
        workspace = validateWorkspace(saved);
        activeCell = notebook().cells[0]?.id;
        render();
        status.textContent = "Local notebooks restored. Code has not run.";
      } else status.textContent = "Local notebook storage ready.";
      ready = true;
      for (const selection of pendingSelections.splice(0))
        api.appendSelection(selection);
      save();
    })
    .catch((error) => {
      ready = true;
      for (const selection of pendingSelections.splice(0))
        api.appendSelection(selection);
      status.textContent = `Local persistence unavailable: ${error.message} Use Export notebooks.`;
    });
  const api = {
    element: host,
    notebookId: () => workspace.active,
    setSessionMode(shared) {
      mode.textContent = shared
        ? "Cells share R objects within this notebook until reset, stop, an error, navigation or reload. Frozen input tables and the seed refresh on each run; the results object is cleared. Run records include preceding cells in execution order. Saved cells never run automatically. Export notebooks to keep a copy."
        : "Each cell starts a fresh R session. Include its required definitions in that cell. Drafts and the last 20 runs per cell are saved on this device; export notebooks to keep a copy.";
    },
    current: () => {
      capture();
      return cell();
    },
    setBusy(value) {
      busy = value;
      mutators.forEach((control) => (control.disabled = value));
      list
        .querySelectorAll("button")
        .forEach((control) => (control.disabled = value));
      notes.disabled = value;
      builder
        .querySelectorAll("input, select, button")
        .forEach((control) => (control.disabled = value));
    },
    save,
    async recordRun(run) {
      const current = cell();
      if (!current || current.kind !== "code") return;
      current.runs = [...current.runs, structuredClone(run)].slice(-20);
      renderHistory();
      await save();
    },
    appendSelection(selection) {
      if (!ready) {
        pendingSelections.push(structuredClone(selection));
        return;
      }
      const values = Array.isArray(selection?.genes)
        ? selection.genes
        : selection?.gene
          ? [selection.gene]
          : [];
      const identifiers = values
        .map((item) =>
          typeof item === "string" ? item : item?.id || item?.symbol,
        )
        .filter((item) => typeof item === "string")
        .slice(0, 5000);
      // JSON string syntax is a safe R character literal for identifiers except uncommon controls.
      const literals = identifiers
        .map((value) => JSON.stringify(value.replace(/[\u0000-\u001f]/g, "")))
        .join(", ");
      const literal = (value) =>
        JSON.stringify(String(value || "").replace(/[\u0000-\u001f]/g, ""));
      const collections = (selection?.collections || []).slice(0, 20);
      const collectionCode = `setNames(list(${collections.map((collection) => `c(${(collection.genes || []).slice(0, 500).map(literal).join(", ")})`).join(", ")}), c(${collections.map((collection) => literal(collection.name)).join(", ")}))`;
      const query = identifiers.length
        ? "results <- subset(genes, id %in% selected_ids | symbol %in% selected_ids)"
        : "pathway_columns <- intersect(c('key', 'id', 'pathway', 'name'), names(pathways))\nresults <- pathways[apply(pathways[, pathway_columns, drop=FALSE], 1, function(row) any(row == atlas_pathway, na.rm=TRUE)), , drop=FALSE]";
      appendCell(
        "code",
        `# Research selection copied from the atlas; exploratory analysis.\nselected_ids <- c(${literals})\natlas_pathway <- ${literal(selection?.pathway)}\natlas_contrast <- ${literal(selection?.contrast)}\natlas_collections <- ${collectionCode}\n${query}\nprint(results)\n# These are archived fitted estimates; selecting a subset does not redefine its FDR family.`,
      );
    },
    addCode: (source) => appendCell("code", source),
    addRecipe(recipeId) {
      const recipe = rExamples.find((item) => item.id === recipeId);
      if (recipe) appendCell("code", recipe.code);
    },
    async destroy() {
      clearTimeout(saveTimer);
      capture();
      if (ready)
        try {
          await store.write(structuredClone(workspace));
        } catch {}
      destroyed = true;
      editor.removeEventListener("input", changed);
      await store.close().catch(() => {});
    },
  };
  return api;
}
