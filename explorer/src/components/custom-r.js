import { createElement as el } from "./interface-utils.js";
import { createRProgress } from "./r-progress.js";
import { rExamples } from "./r-examples.js";
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
export function createCustomR({ data, getGenes, provenance, root, bayesian }) {
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
  const code = el("textarea", "custom-r-code");
  code.setAttribute("aria-label", "R code");
  code.spellcheck = false;
  code.value = savedCode ?? rExamples[0].code;
  const label = el("label", "", "Editable R code · Ctrl/⌘ + Enter to run");
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
    };
    if (code.value.trim())
      root.f7.dialog.confirm(
        "Replace the editor contents with this example? Your current text can be downloaded first.",
        "Load R example",
        replace,
      );
    else replace();
  });
  toolbar.append(
    selector,
    load,
    run,
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
  host.append(
    intro,
    warning,
    toolbar,
    progress.panel,
    label,
    code,
    docs,
    el("h3", "", "Console"),
    output,
    el("h3", "", "Plots"),
    plots,
    el("h3", "", "Results table"),
    tableHost,
    exports,
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
    run.disabled = value;
    load.disabled = value;
    stop.disabled = !value;
    root.dataset.rBusy = String(value);
  }
  function terminate(message) {
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
    if (!code.value.trim() || code.value.length > 65536) {
      showToast("Enter R code, up to 65,536 characters.");
      return;
    }
    persist();
    const script = code.value,
      ticket = ++epoch;
    controls(true);
    resultsCSV = "";
    record = undefined;
    csv.disabled = session.disabled = true;
    plots.replaceChildren();
    tableHost.replaceChildren();
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
          "Stopped after 90 seconds. Simplify the script or run it in local R.",
        ),
      90000,
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
      const instance = await createRRuntime();
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
        hashes[name] = { rows: rows.length, sha256: await digest(bytes) };
        await runtime.FS.writeFile(`/home/web_user/${name}.csv`, bytes);
        progress.note(
          `${name}: ${rows.length.toLocaleString()} rows · ${(bytes.byteLength / 1e6).toFixed(2)} MB loaded`,
        );
      }
      const shelter = await new runtime.Shelter();
      const wrapped = `set.seed(20261118)\n${Object.keys(inputs)
        .map(
          (name) =>
            `${name} <- read.csv('/home/web_user/${name}.csv', stringsAsFactors=FALSE, check.names=FALSE, na.strings=c('', 'NA', 'null'))`,
        )
        .join(
          "\n",
        )}\n${script}\nif (exists('results',inherits=FALSE) && is.data.frame(results)) write.csv(results,'/home/web_user/results.csv',row.names=FALSE)\n`;
      progress.stage(
        4,
        "Running your R script",
        "Evaluating the archived tables and your code in the separate worker. Stop is available; no percentage is estimated for arbitrary code.",
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
          figure.append(
            canvas,
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
        archive_doi: "10.5281/zenodo.23283595",
        inputs: hashes,
        plan: provenance.freeze,
        bayesian_sources: bayesian.source_sha256,
        session_info: await runtime.evalRString(
          'paste(capture.output(sessionInfo()),collapse="\\n")',
        ),
        console: output.textContent,
        plots: captured.images.length,
        error: captured.output.some((x) => x.type === "error"),
      };
      renderTable();
      csv.disabled = !resultsCSV;
      session.disabled = false;
      await shelter.purge();
      terminate(
        record.error
          ? "R reported an error. Check the console and try again."
          : `Analysis complete.${captured.images.length > 4 ? " First four plots retained." : ""}`,
      );
      showToast(record.error ? "Check the R console." : "R analysis complete.");
    } catch (error) {
      if (ticket === epoch) {
        output.textContent = error.message;
        record = {
          schema_version: 1,
          run_utc: new Date().toISOString(),
          code: script,
          seed: 20261118,
          archive_doi: "10.5281/zenodo.23283595",
          error: true,
          message: error.message,
        };
        session.disabled = false;
        terminate(
          "R could not finish. Check the console, connection or offline download and retry.",
        );
      }
    }
  }
  host.destroy = () => {
    persist();
    terminate("R session closed.");
    progress.destroy();
  };
  return host;
}
