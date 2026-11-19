import {
  vectorSetup,
  vectorFinish,
  readVectorPlots,
} from "./r-vector-plots.js";
import { createRReportControls } from "./r-report.js";
import { createREditor } from "../assets/vendor/r-editor.js";
import {
  createElement as el,
  readPreference,
  writePreference,
} from "./interface-utils.js";
import { createRProgress } from "./r-progress.js";
import { rExamples } from "./r-examples.js";
import { createRNotebooks } from "./r-notebooks.js";
import { createRRuntime } from "./r-runtime.js";
import { csvText } from "./format.js";
import { downloadFile } from "./file-download.js";
import { showToast } from "./app-toast.js";
import { beginActivity } from "./app-activity.js";
import { uiIcon } from "./icons.js";
const savedKey = "atlas-custom-r-script-v1";
const encoder = new TextEncoder();
const digest = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
let savedCode;
try {
  savedCode = localStorage.getItem(savedKey);
} catch {}
export function createCustomR({
  data,
  getGenes,
  provenance,
  root,
  bayesian,
  getSelection,
  onResults,
}) {
  const host = el("section", "custom-r-workspace");
  const intro = el(
    "p",
    "note",
    "Run editable R examples against archived atlas tables, entirely in a separate worker on your device. Code runs only when you choose Run. Base and recommended R packages are included; additional packages need a compatible webR repository and a connection.",
  );
  const warning = el(
    "p",
    "callout",
    "Custom outputs are exploratory and separate from the archived results. These tables contain fitted estimates and VST profiles, not raw counts for refitting DESeq2. Three differentiation blocks, shared controls and unresolved control harvest timing limit inference. The examples do not establish mitochondrial function or rejuvenation.",
  );
  const selector = el("select");
  selector.setAttribute("aria-label", "R example");
  for (const example of rExamples) {
    const o = el("option", "", example.title);
    o.value = example.id;
    selector.append(o);
  }
  const code = createREditor(savedCode ?? rExamples[0].code);
  const label = el(
    "label",
    "",
    "Editable R code · Tab to indent · Ctrl/⌘ + Enter to run",
  );
  label.htmlFor = "atlas-r-code";
  code.id = label.htmlFor;
  const toolbar = el("div", "custom-r-toolbar");
  function action(text, icon, fn) {
    const b = el("button", "button button-tonal labelled-icon-action");
    b.type = "button";
    b.append(uiIcon(icon), el("span", "", text));
    b.onclick = fn;
    return b;
  }
  const run = action("Run analysis", "play", execute),
    stop = action("Stop", "close", () =>
      terminate("Stopped. The R worker was reset."),
    );
  stop.disabled = true;
  const load = action("Load example", "copy", () => {
    const replace = () => {
      code.value = rExamples.find((x) => x.id === selector.value).code;
      persist();
      notebooks.save();
    };
    if (code.value.trim())
      root.f7.dialog.confirm(
        "Replace the editor contents with this example? Your current text can be downloaded first.",
        "Load R example",
        replace,
      );
    else replace();
  });
  const timeLimit = el("select");
  timeLimit.setAttribute("aria-label", "R execution time limit");
  for (const minutes of [5, 10, 30, 60]) {
    const option = el("option", "", `${minutes} minutes`);
    option.value = String(minutes);
    timeLimit.append(option);
  }
  const savedLimit = readPreference("atlas-r-execution-minutes", "10");
  timeLimit.value = ["5", "10", "30", "60"].includes(savedLimit)
    ? savedLimit
    : "10";
  timeLimit.onchange = () =>
    writePreference("atlas-r-execution-minutes", timeLimit.value);
  const limitField = action("Execution settings", "controls", () => {
    const dialog = root.f7.dialog.create({
      title: "R execution settings",
      cssClass: "research-message-dialog",
      content: `<p>The limit applies to script execution, excluding runtime setup.</p><div class="list"><ul>${[5, 10, 30, 60].map((minutes) => `<li><label class="item-radio item-content"><input type="radio" name="r-execution-limit" value="${minutes}" ${Number(timeLimit.value) === minutes ? "checked" : ""}><i class="icon icon-radio"></i><div class="item-inner"><div class="item-title">${minutes} minutes</div></div></label></li>`).join("")}</ul></div>`,
      destroyOnClose: true,
      buttons: [
        {
          text: "Done",
          bold: true,
          onClick() {
            timeLimit.value = dialog.el.querySelector("input:checked").value;
            writePreference("atlas-r-execution-minutes", timeLimit.value);
          },
        },
      ],
    });
    dialog.open();
  });
  limitField.hidden = true;
  toolbar.append(
    selector,
    load,
    run,
    limitField,
    action("Download R", "download", () =>
      downloadFile("psilocin-custom-analysis.R", code.value, "text/plain"),
    ),
  );
  const status = el(
    "p",
    "note",
    "Ready. The R runtime loads when you run an analysis. Save it under Install app for offline use.",
  );
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const progress = createRProgress(status);
  progress.actions.append(stop);
  const output = el(
    "pre",
    "custom-r-console",
    "Console output will appear here.",
  );
  output.setAttribute("aria-label", "R console output");
  const plots = el("div", "custom-r-plots");
  const tableHost = el("div", "custom-r-results");
  const exports = el("div", "custom-r-toolbar");
  let plotURLs = [];
  const releasePlotURLs = () => {
    for (const url of plotURLs) URL.revokeObjectURL(url);
    plotURLs = [];
  };
  let vectorPlots = [],
    reportInputs = {};
  let resultsCSV = "",
    record,
    runtime,
    busy = false,
    epoch = 0,
    timer,
    endActivity;
  const csv = action("Download results CSV", "download", () =>
    downloadFile("psilocin-custom-results.csv", resultsCSV),
  );
  csv.disabled = true;
  const session = action("Download run record", "download", () =>
    downloadFile(
      "psilocin-custom-run.json",
      JSON.stringify(record, null, 2),
      "application/json",
    ),
  );
  session.disabled = true;
  exports.append(csv, session);
  const reports = createRReportControls({
    root,
    action,
    getRun: () => ({ record, resultsCSV, vectorPlots, inputs: reportInputs }),
  });
  const docs = el("details", "custom-r-data-help");
  docs.append(
    el("summary", "", "Available data and reproducibility"),
    el(
      "p",
      "note",
      "genes: all source Ensembl IDs and three archived contrasts (selected marks the rank representative); pathways: frozen enrichment estimates and original family FDR; landscape: selected 113-gene OXPHOS cohort; profiles: 1,017 VST profiles; bayesian_scores: the three paired block scores across all 182 mapped OXPHOS genes; bayesian_archive: the original posterior summaries. Assign a data frame to results to export CSV. The run record includes code, seed, input hashes, session information and errors. Code is saved only in this browser; it never runs automatically. Stopping discards the R session. Download anything you want to keep.",
    ),
  );
  const credits = el(
    "a",
    "source-link",
    "webR 0.6.0 · licences and source code ↗",
  );
  credits.href = new URL("webr/PROVENANCE.json", document.baseURI).href;
  credits.target = "_blank";
  credits.rel = "noopener";
  const inspector = el("details", "research-studio-inspector");
  const inspectorText = el("pre", "custom-r-console");
  inspector.append(
    el("summary", "", "R object inspector · last completed cell"),
    inspectorText,
  );
  inspector.hidden = true;
  const resultArea = el("section", "custom-r-output-area");
  const placeholder = el(
    "p",
    "custom-r-output-placeholder",
    "Results and plots will show here after you run an analysis.",
  );
  const plotSection = el("section", "custom-r-output-section");
  plotSection.hidden = true;
  plotSection.append(el("h3", "", "Plots"), plots);
  const tableSection = el("section", "custom-r-output-section");
  tableSection.hidden = true;
  tableSection.append(el("h3", "", "Results table"), tableHost);
  resultArea.append(placeholder, plotSection, tableSection);
  const notebooks = createRNotebooks({
    editor: code,
    action,
    root,
    initialCode: code.value,
    getSources: () => ({
      archive_doi: "10.5281/zenodo.23283595",
      freeze: provenance.freeze,
      bayesian_sources: bayesian.source_sha256,
    }),
    onStatus: (message) => showToast(message),
    onCellChange: (cell) => {
      label.hidden = cell?.kind !== "code";
      run.disabled = cell?.kind !== "code";
      const previous = cell?.runs?.at(-1);
      releasePlotURLs();
      plots.replaceChildren();
      tableHost.replaceChildren();
      output.textContent =
        previous?.console ||
        previous?.message ||
        "Console output will appear here.";
      resultsCSV = previous?.results_csv || "";
      record = previous;
      inspectorText.textContent = previous?.object_summary || "";
      inspector.hidden = !previous?.object_summary;
      vectorPlots = [];
      if (resultsCSV) renderTable();
      for (const [index, svg] of (previous?.vector_svgs || []).entries()) {
        if (
          typeof svg !== "string" ||
          (!svg.trimStart().startsWith("<?xml") &&
            !svg.trimStart().startsWith("<svg"))
        )
          continue;
        const image = el("img");
        const url = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml" }),
        );
        plotURLs.push(url);
        image.src = url;
        image.alt = `Saved exploratory R plot ${index + 1}`;
        plots.append(image);
      }
      plotSection.hidden = !plots.childElementCount;
      tableSection.hidden = !resultsCSV;
      placeholder.hidden = Boolean(plots.childElementCount || resultsCSV);
      csv.disabled = !resultsCSV;
      session.disabled = !previous;
      reports.setReady(false);
      host.dispatchEvent(new CustomEvent("atlas:r-start", { bubbles: true }));
      if (previous?.results_csv) host.dispatchEvent(new CustomEvent("atlas:r-results", {
        bubbles: true, detail: { classification: "user-exploratory", record: previous, resultsCSV: previous.results_csv, recovered: true },
      }));
    },
  });
  if (getSelection)
    toolbar.append(
      action("Use atlas selection", "plus", () =>
        notebooks.appendSelection(getSelection()),
      ),
    );
  host.append(
    intro,
    warning,
    notebooks.element,
    toolbar,
    progress.panel,
    label,
    code,
    docs,
    el("h3", "", "Console"),
    output,
    resultArea,
    inspector,
    exports,
    reports.element,
    credits,
  );
  function renderTable() {
    if (!resultsCSV) {
      tableHost.textContent =
        "Assign a data frame to results to display and export it.";
      return;
    }
    // RFC4180 quoted fields, bounded to a 50-row preview; export keeps all rows.
    const rows = [];
    let row = [],
      field = "",
      quoted = false;
    for (let i = 0; i < resultsCSV.length && rows.length < 51; i++) {
      const c = resultsCSV[i];
      if (c === '"') {
        if (quoted && resultsCSV[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = !quoted;
      } else if (!quoted && (c === "," || c === "\n")) {
        row.push(field);
        field = "";
        if (c === "\n") {
          rows.push(row);
          row = [];
        }
      } else if (c !== "\r" || quoted) field += c;
    }
    if (rows.length < 51 && (field || row.length)) {
      row.push(field);
      rows.push(row);
    }
    const headers = rows.shift() || [],
      table = el("table"),
      head = el("thead"),
      tr = el("tr"),
      tbody = el("tbody");
    table.dataset.sortable = "true";
    headers.forEach((name, index) => {
      const th = el("th", "", name);
      const values = rows.map((r) => r[index]).filter((v) => v && v !== "NA");
      if (values.length && values.every((v) => Number.isFinite(Number(v))))
        th.dataset.sortType = "number";
      tr.append(th);
    });
    head.append(tr);
    for (const values of rows) {
      const tr = el("tr");
      for (const value of values) tr.append(el("td", "", value));
      tbody.append(tr);
    }
    table.append(head, tbody);
    const scroll = el("div", "table-scroll");
    scroll.append(table);
    tableHost.append(
      el(
        "p",
        "note",
        "First 50 rows shown. CSV export retains the complete results data frame.",
      ),
      scroll,
    );
  }
  function persist() {
    savedCode = code.value;
    try {
      localStorage.setItem(savedKey, code.value);
    } catch {}
  }
  code.addEventListener("input", persist);
  code.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      execute();
    }
  });
  function controls(value) {
    busy = value;
    notebooks.setBusy(value);
    run.disabled = value || notebooks.current()?.kind !== "code";
    load.disabled = value;
    timeLimit.disabled = value;
    limitField.disabled = value;
    stop.disabled = !value;
    root.dataset.rBusy = String(value);
  }
  function terminate(message, failed = false) {
    if (failed) limitField.hidden = false;
    ++epoch;
    clearTimeout(timer);
    runtime?.close();
    runtime = undefined;
    endActivity?.();
    endActivity = undefined;
    controls(false);
    status.classList.remove("inline-loading");
    status.textContent = message;
    progress.finish(message);
  }
  async function execute() {
    if (busy) return;
    host.dispatchEvent(new CustomEvent("atlas:r-start", { bubbles: true }));
    if (notebooks.current()?.kind !== "code")
      return showToast("Select an R code cell to run.");
    const executingCell = notebooks.current().id;
    if (root.dataset.reportBusy === "true")
      return showToast("Finish or cancel report preparation first.");
    if (!code.value.trim() || code.value.length > 65536) {
      showToast("Enter R code, up to 65,536 characters.");
      return;
    }
    persist();
    const executionMinutes = Number(timeLimit.value);
    const executionLimitSeconds = executionMinutes * 60;
    const script = code.value,
      ticket = ++epoch;
    controls(true);
    resultsCSV = "";
    record = undefined;
    csv.disabled = session.disabled = true;
    releasePlotURLs();
    plots.replaceChildren();
    tableHost.replaceChildren();
    plotSection.hidden = tableSection.hidden = true;
    placeholder.hidden = false;
    reports.setReady(false);
    output.textContent = "";
    endActivity = beginActivity("Running custom R analysis");
    progress.start();
    progress.stage(
      0,
      "Preparing archived data",
      "Reading the gene estimates and organizing the three contrasts. No R code has run yet.",
    );
    timer = setTimeout(
      () =>
        terminate(
          "R setup did not finish within three minutes. Check the connection or offline runtime and retry.",
          true,
        ),
      180000,
    );
    try {
      const genes = (await getGenes()).flatMap((g) =>
        g.effects.map((effect, i) => ({
          id: g.id,
          symbol: g.symbol,
          selected: g.selected,
          contrast: data.contrasts[i],
          ...effect,
        })),
      );
      if (ticket !== epoch) return;
      progress.stage(
        1,
        "Loading the webR interface",
        "Opening the locally hosted webR 0.6.0 JavaScript interface.",
      );
      const instance = await createRRuntime({
        onResource: (file) => {
          if (ticket === epoch) progress.resource(file);
        },
      });
      if (ticket !== epoch) {
        instance.close();
        return;
      }
      runtime = instance;
      progress.stage(
        2,
        "Starting the R worker",
        "Loading WebAssembly, base R and numerical libraries. The browser downloads required files or reads the saved offline runtime. First startup can take longer.",
      );
      await runtime.init();
      progress.note("R worker initialized successfully.");
      if (ticket !== epoch) return;
      const inputs = {
        genes,
        pathways: data.pathways,
        landscape: data.landscape,
        profiles: data.profiles,
        bayesian_scores: bayesian.scores,
        bayesian_archive: bayesian.archived,
      };
      const hashes = {};
      reportInputs = {};
      vectorPlots = [];
      reports.setReady(false);
      progress.stage(
        3,
        "Loading analysis tables into R",
        "Preparing six archived datasets and computing their SHA-256 fingerprints.",
      );
      for (const [name, rows] of Object.entries(inputs)) {
        const normalized = rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              value == null
                ? ""
                : typeof value === "boolean"
                  ? value
                    ? "TRUE"
                    : "FALSE"
                  : value,
            ]),
          ),
        );
        const bytes = encoder.encode(csvText(normalized));
        reportInputs[`data/${name}.csv`] = bytes;
        hashes[name] = { rows: rows.length, sha256: await digest(bytes) };
        await runtime.FS.writeFile(`/home/web_user/${name}.csv`, bytes);
        progress.resource({
          path: `${name}.csv`,
          source: "R workspace",
          loaded: bytes.byteLength,
          total: bytes.byteLength,
          state: "loaded",
        });
        progress.note(
          `${name}: ${rows.length.toLocaleString()} rows · ${(bytes.byteLength / 1e6).toFixed(2)} MB loaded`,
        );
      }
      const shelter = await new runtime.Shelter();
      const wrapped = `${vectorSetup}\nset.seed(20261118)\n${Object.keys(inputs)
        .map(
          (name) =>
            `${name} <- read.csv('/home/web_user/${name}.csv', stringsAsFactors=FALSE, check.names=FALSE, na.strings=c('', 'NA', 'null'))`,
        )
        .join(
          "\n",
        )}\ntryCatch({\n${script}\n}, finally={${vectorFinish}})\nif (exists('results',inherits=FALSE) && is.data.frame(results)) write.csv(results,'/home/web_user/results.csv',row.names=FALSE)\n`;
      progress.stage(
        4,
        "Running your R script",
        `Evaluating your code in the separate worker. Execution limit: ${executionMinutes} minutes, excluding setup. Stop is available; no percentage is estimated for arbitrary code.`,
      );
      clearTimeout(timer);
      timer = setTimeout(
        () =>
          terminate(
            `Stopped after ${executionMinutes} minutes of script execution. Increase the execution limit and rerun, or simplify the script.`,
            true,
          ),
        executionLimitSeconds * 1000,
      );
      const captured = await shelter.captureR(wrapped, {
        captureStreams: true,
        captureConditions: true,
        captureGraphics: {
          width: 1000,
          height: 650,
          pointsize: 14,
          bg: "white",
        },
      });
      if (ticket !== epoch) {
        for (const image of captured.images) image.close();
        return;
      }
      progress.stage(
        5,
        "Preparing plots and results",
        `${captured.images.length} plot(s) captured. Preparing the results table and reproducibility record.`,
      );
      try {
        vectorPlots = await readVectorPlots(runtime);
      } catch (error) {
        progress.note(`Vector export unavailable: ${error.message}`);
      }
      const text = captured.output
        .map((x) =>
          typeof x.data === "string" ? x.data : JSON.stringify(x.data),
        )
        .join("\n");
      output.textContent =
        text.slice(0, 200000) || "Completed without console output.";
      for (const [i, image] of captured.images.entries()) {
        if (i < 4) {
          const canvas = el("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          canvas.setAttribute("aria-label", `Custom R plot ${i + 1}`);
          canvas.getContext("2d").drawImage(image, 0, 0);
          const figure = el("figure");
          let preview = canvas;
          if (vectorPlots[i]) {
            const url = URL.createObjectURL(
              new Blob([vectorPlots[i].svg], { type: "image/svg+xml" }),
            );
            plotURLs.push(url);
            preview = el("img");
            preview.src = url;
            preview.alt = `Custom R plot ${i + 1}`;
            preview.width = 1000;
            preview.height = 650;
          }
          figure.append(
            preview,
            action("Download PNG", "download", () =>
              canvas.toBlob((blob) =>
                downloadFile(
                  `psilocin-custom-plot-${i + 1}.png`,
                  blob,
                  "image/png",
                ),
              ),
            ),
          );
          if (vectorPlots[i]) {
            figure.append(
              action("Download SVG", "download", () =>
                downloadFile(
                  `psilocin-custom-plot-${i + 1}.svg`,
                  vectorPlots[i].svg,
                  "image/svg+xml",
                ),
              ),
            );
          }
          plots.append(figure);
        }
        image.close();
      }
      try {
        resultsCSV = new TextDecoder().decode(
          await runtime.FS.readFile("/home/web_user/results.csv"),
        );
      } catch {}
      record = {
        schema_version: 1,
        run_utc: new Date().toISOString(),
        code: script,
        seed: 20261118,
        execution_limit_seconds: executionLimitSeconds,
        archive_doi: "10.5281/zenodo.23283595",
        inputs: hashes,
        plan: provenance.freeze,
        bayesian_sources: bayesian.source_sha256,
        object_summary: await runtime.evalRString(
          'local({ .names <- head(ls(envir=.GlobalEnv), 100); paste(vapply(.names, function(.name) { .value <- get(.name, envir=.GlobalEnv); paste(.name, paste(class(.value), collapse="/"), paste0("length=", length(.value)), paste0("bytes=", as.numeric(object.size(.value))), sep=" | ") }, character(1)), collapse="\\n") })',
        ),
        session_info: await runtime.evalRString(
          'paste(capture.output(sessionInfo()),collapse="\\n")',
        ),
        console: output.textContent,
        plots: captured.images.length,
        vector_plots: vectorPlots.length,
        graphics_export:
          "Recorded display lists replayed to SVG and vector PDF without re-executing user code; any raster content remains raster.",
        error: captured.output.some((x) => x.type === "error"),
      };
      inspectorText.textContent = record.object_summary || "";
      inspector.hidden = !record.object_summary;
      renderTable();
      plotSection.hidden = !plots.childElementCount;
      tableSection.hidden = !resultsCSV;
      placeholder.hidden = Boolean(plots.childElementCount || resultsCSV);
      csv.disabled = !resultsCSV;
      session.disabled = false;
      reports.setReady(!record.error);
      await shelter.purge();
      terminate(
        record.error
          ? "R reported an error. Check the console and try again."
          : `Analysis complete.${captured.images.length > 4 ? " First four plots retained." : ""}`,
        record.error,
      );
      const finishedEpoch = epoch;
      await notebooks.recordRun({
        ...record,
        results_csv: resultsCSV,
        vector_svgs: vectorPlots
          .slice(0, 4)
          .map((plot) =>
            typeof plot.svg === "string"
              ? plot.svg
              : new TextDecoder().decode(plot.svg),
          ),
      });
      if (epoch !== finishedEpoch || notebooks.current()?.id !== executingCell) return;
      const exploratoryResult = {
        classification: "user-exploratory",
        record,
        resultsCSV,
      };
      host.dispatchEvent(
        new CustomEvent("atlas:r-results", {
          bubbles: true,
          detail: exploratoryResult,
        }),
      );
      try {
        onResults?.(exploratoryResult);
      } catch (error) {
        progress.note(
          `Linked visualization could not receive the result: ${error.message}`,
        );
      }
      showToast(record.error ? "Check the R console." : "R analysis complete.");
    } catch (error) {
      if (ticket === epoch) {
        output.textContent = error.message;
        record = {
          schema_version: 1,
          run_utc: new Date().toISOString(),
          code: script,
          seed: 20261118,
          execution_limit_seconds: executionLimitSeconds,
          archive_doi: "10.5281/zenodo.23283595",
          error: true,
          message: error.message,
        };
        session.disabled = false;
        await notebooks.recordRun(record);
        terminate(
          "R could not finish. Check the console, connection or offline download and retry.",
          true,
        );
      }
    }
  }
  host.setResearchSelection = (selection) =>
    notebooks.appendSelection(selection);
  host.updateContext = host.setResearchSelection;
  host.destroy = () => {
    persist();
    notebooks.destroy();
    terminate("R session closed.");
    progress.destroy();
    code.destroy();
    reports.destroy();
    releasePlotURLs();
  };
  return host;
}
