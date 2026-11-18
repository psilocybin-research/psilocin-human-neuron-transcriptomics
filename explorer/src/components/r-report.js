import { createElement as el, setLoadingMessage } from "./interface-utils.js";
import { downloadFile } from "./file-download.js";
import { zip } from "../assets/vendor/r-editor.js";
import { beginActivity } from "./app-activity.js";
import { showToast } from "./app-toast.js";
const encode = (text) => new TextEncoder().encode(text);
const tex = (value) =>
  String(value ?? "")
    .replace(
      /[^\x20-\x7e\n]/gu,
      (c) => `[U+${c.codePointAt(0).toString(16).toUpperCase()}]`,
    )
    .replace(
      /[\\{}$&#_%~^]/g,
      (c) =>
        ({
          "\\": "\\textbackslash{}",
          "{": "\\{",
          "}": "\\}",
          $: "\\$",
          "&": "\\&",
          "#": "\\#",
          _: "\\_",
          "%": "\\%",
          "~": "\\textasciitilde{}",
          "^": "\\textasciicircum{}",
        })[c],
    );
const codeBlock = (value) =>
  String(value ?? "")
    .split("\n")
    .slice(0, 600)
    .flatMap((line) => line.match(/.{1,95}/gu) || [" "])
    .map((line) => `\\noindent\\texttt{${tex(line)}}\\par`)
    .join("\n");
const tableText = (value, numeric = false) => {
  let text = String(value ?? "");
  if (numeric && /[.eE]/.test(text) && Number.isFinite(Number(text)))
    text = String(Number(Number(text).toPrecision(4)));
  return (text.slice(0, 120).match(/.{1,8}/gu) || [""])
    .map(tex)
    .join("\\allowbreak{}");
};
export function reportFiles(run, title, author = "") {
  const { record, resultsCSV, vectorPlots, inputs } = run;
  if (!record || record.error)
    throw Error("Complete a successful R run before creating a report.");
  const files = { ...inputs };
  const add = (name, text) => (files[name] = encode(text));
  const figures = vectorPlots
    .map((plot, i) => {
      files[`figures/plot-${i + 1}.svg`] = plot.svg;
      files[`figures/plot-${i + 1}.pdf`] = plot.pdf;
      return `\\clearpage\\section{Figure ${i + 1}}\n\\begin{center}\\includegraphics[width=\\linewidth,height=.75\\textheight,keepaspectratio]{figures/plot-${i + 1}.pdf}\\end{center}\n`;
    })
    .join("\n");
  const rows = parseCSV(resultsCSV).slice(0, 41),
    columns = Math.min(rows[0]?.length || 0, 6);
  const numericColumns = Array.from({ length: columns }, (_, i) => {
    const values = rows
      .slice(1)
      .map((row) => row[i])
      .filter((value) => value && value !== "NA");
    return Boolean(
      values.length && values.every((value) => Number.isFinite(Number(value))),
    );
  });
  const weights = numericColumns.map((numeric) => (numeric ? 1 : 2));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const columnDefinitions = Array.from({ length: columns }, (_, i) => {
    const values = rows
      .slice(1)
      .map((row) => row[i])
      .filter((value) => value && value !== "NA");
    const numeric =
      values.length && values.every((value) => Number.isFinite(Number(value)));
    return `>{${numeric ? "\\RaggedLeft" : "\\RaggedRight"}\\arraybackslash}p{${((156 * weights[i]) / totalWeight - 4).toFixed(1)}mm}`;
  }).join("");
  const table = columns
    ? `\\section{Results table}\\small\n\\begin{longtable}{${columnDefinitions}}\\toprule\n` +
      rows
        .map(
          (row, i) =>
            row
              .slice(0, columns)
              .map((v, j) => tableText(v, i > 0 && numericColumns[j]))
              .join(" & ") + ` \\\\ ${i === 0 ? "\\midrule\\endhead" : ""}`,
        )
        .join("\n") +
      "\n\\bottomrule\\end{longtable}\\normalsize\nPreview: up to 40 rows and 6 columns. Numeric previews use up to four significant digits. Full precision and all columns are retained in results.csv.\n"
    : "";
  const stamp = new Date(record.run_utc)
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
  add(
    "report.tex",
    String.raw`\documentclass[11pt,a4paper,parskip=half,headings=normal]{scrartcl}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[margin=24mm,headheight=18pt,footskip=12mm]{geometry}
\usepackage{xcolor,graphicx,booktabs,longtable,array,ragged2e,scrlayer-scrpage,hyperref,bookmark}
\definecolor{AtlasBlue}{HTML}{235780}
\definecolor{AtlasMuted}{HTML}{536B7A}
\setkomafont{section}{\sffamily\large\color{AtlasBlue}}
\clearpairofpagestyles
\ihead{\sffamily\footnotesize\color{AtlasBlue}Psilocin Transcriptome Atlas}
\ohead{\sffamily\footnotesize Custom R analysis}
\ifoot{\sffamily\scriptsize Exploratory analysis}
\ofoot{\pagemark}
\pagestyle{scrheadings}
\setlength{\emergencystretch}{3em}
\setcounter{secnumdepth}{0}
\hypersetup{hidelinks,pdfcreator={Psilocin Atlas / local pdfTeX}}
\begin{document}
` +
      `\\hypersetup{pdftitle={${tex(title)}},pdfauthor={${tex(author)}}}\n\\pdfinfo{/CreationDate (D:${stamp}Z) /ModDate (D:${stamp}Z)}\n{\\sffamily\\LARGE\\color{AtlasBlue}${tex(title)}\\par}\nHuman iPSC-derived cortical neurons\\par\n${author ? "Prepared by " + tex(author) + "\\par\n" : ""}` +
      `\\section{Scope and provenance}\nThis is a user-authored exploratory analysis of archived estimates, not an independently validated result or a refit of the original experiment. Three differentiation blocks and two genetic backgrounds limit inference; genes and cells are not independent biological replicates. Shared controls and unresolved control harvest timing limit temporal interpretation. Transcription does not establish respiratory function or rejuvenation.\\par\nRun (UTC): ${tex(record.run_utc)}.\\par\nInitial seed: ${tex(record.seed)}.\\par\nArchived reanalysis: \\href{https://doi.org/10.5281/zenodo.23283595}{doi:10.5281/zenodo.23283595}.\\par\nThe report uses recorded output and does not rerun R. Plots are replayed from the same graphics display lists into SVG and vector PDF; any raster content explicitly drawn by the script remains raster. ${record.plots > vectorPlots.length ? "Not all plotted pages have a vector export; omitted figures are not reproduced in this report." : ""}\\par\n` +
      table +
      figures +
      `\\clearpage\\section{R code}\\begingroup\\footnotesize\n${codeBlock(record.code)}\\endgroup\n\\section{Console output}\\begingroup\\footnotesize\n${codeBlock(record.console)}\\endgroup\n\\section{R session}\\begingroup\\footnotesize\n${codeBlock(record.session_info)}\\endgroup\n` +
      "\\section{Sources and reproducibility}\nSource experiment: Schmidt et al. (2026), Psilocin fosters neuroplasticity in iPSC-derived human cortical neurons. eLife 14:RP104006. \\href{https://doi.org/10.7554/eLife.104006.3}{doi:10.7554/eLife.104006.3}. Independent reanalysis: Christopher B. Germann (2026), Zenodo v1.2.0. Custom computation uses R via webR 0.6.0; local PDF compilation uses Siglum 0.2.2 / BusyTeX, pdfTeX and TeX Live 2026. Original software and font licences accompany the source package.\\par\nThe source ZIP contains full input tables, result CSV, R script, recorded run with per-input SHA-256 hashes, session information, SVG and PDF figures, fonts and checksums. Text/table previews may be abbreviated. Characters outside the offline font repertoire are printed as Unicode code points; original Unicode is preserved in source data and code.\\end{document}\n",
  );
  add(
    "analysis.R",
    `# Archived atlas tables. This script is not run during report compilation.\nset.seed(${record.seed})\n${Object.keys(
      inputs,
    )
      .map(
        (path) =>
          `${path.split("/")[1].replace(".csv", "")} <- read.csv('${path}', stringsAsFactors=FALSE, check.names=FALSE, na.strings=c('', 'NA', 'null'))`,
      )
      .join("\n")}\n${record.code}\n`,
  );
  add("results.csv", resultsCSV);
  add("console.txt", record.console);
  add("sessionInfo.txt", record.session_info);
  add("run.json", JSON.stringify(record, null, 2));
  add(
    "README.txt",
    "Compile report.tex twice with pdfLaTeX using TeX Live 2026 or current MiKTeX. Set TEXMFHOME to the supplied texmf directory. Required packages: KOMA-Script, Latin Modern, geometry, xcolor, graphicx, booktabs, longtable, array, ragged2e, scrlayer-scrpage, hyperref, bookmark. Figures are vector PDF with original SVG copies. Rerun analysis.R in a separate R session to recompute outputs; report compilation never runs R. Input SHA-256 hashes are in run.json; SHA256SUMS covers this archive. Unicode originals are retained even when the PDF uses U+XXXX substitutions. Tables and text may be abbreviated in the PDF; complete exports remain in this ZIP.",
  );
  return files;
}
function parseCSV(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
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
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
const compilerBase = new URL("latex/", document.baseURI);
let activeCompiler, rejectCompilation;
export function cancelReportCompilation() {
  activeCompiler?.terminate();
  rejectCompilation?.(
    Error("Report preparation cancelled. Your R results are retained."),
  );
}
export async function compileReport(files, onProgress = () => {}, signal) {
  signal?.throwIfAborted();
  const { SiglumCompiler } = await import(
    new URL("engine.js", compilerBase).href
  );
  signal?.throwIfAborted();
  const compiler = new SiglumCompiler({
    wasmUrl: new URL("busytex.wasm", compilerBase).href,
    jsUrl: new URL("busytex.js", compilerBase).href,
    workerUrl: new URL("worker.js", compilerBase).href,
    bundlesUrl: new URL("runtime", compilerBase).href,
    enableCtan: false,
    enableLazyFS: false,
    enableDocCache: false,
    maxRetries: 2,
    onProgress: (stage, detail) => onProgress(detail || stage),
  });
  activeCompiler = compiler;
  const onAbort = () => cancelReportCompilation();
  signal?.addEventListener("abort", onAbort, { once: true });
  let timer;
  try {
    const support = await fetch(
      new URL("runtime/template-support.json", compilerBase),
      { signal },
    ).then((r) => {
      if (!r.ok) throw Error("Compiler support files are unavailable.");
      return r.json();
    });
    signal?.throwIfAborted();
    const texSource = new TextDecoder().decode(files["report.tex"]);
    const additionalFiles = {
      ...support,
      ...Object.fromEntries(
        Object.entries(files).filter(
          ([name]) =>
            name !== "report.tex" &&
            !name.endsWith(".svg") &&
            !name.startsWith("data/"),
        ),
      ),
    };
    return await Promise.race([
      new Promise((_, reject) => {
        rejectCompilation = reject;
      }),
      (async () => {
        signal?.throwIfAborted();
        onProgress("Starting local pdfTeX compiler");
        await compiler.init();
        onProgress("Typesetting report and embedding vector figures");
        const result = await compiler.compile(texSource, {
          engine: "pdflatex",
          additionalFiles,
          useCache: false,
        });
        if (!result.success)
          throw Error(
            (result.error || "PDF compilation failed.") +
              " " +
              (result.log || "").slice(-1800),
          );
        return result.pdf;
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          compiler.terminate();
          reject(
            Error(
              "Report compilation exceeded 90 seconds. Your R results are retained.",
            ),
          );
        }, 90000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    compiler.terminate();
    if (activeCompiler === compiler) {
      activeCompiler = undefined;
      rejectCompilation = undefined;
    }
  }
}
export async function verifyLatexRuntime(signal) {
  const pdf = await compileReport(
    {
      "report.tex": encode(
        String.raw`\documentclass{article}\begin{document}Psilocin Atlas offline PDF readiness check.\end{document}`,
      ),
    },
    () => {},
    signal,
  );
  if (new TextDecoder().decode(pdf.slice(0, 5)) !== "%PDF-")
    throw Error("The local compiler did not produce a PDF.");
  return true;
}
async function addSourceSupport(files, onProgress, signal) {
  onProgress("Preparing fonts and compiler licences");
  const response = await fetch(
    new URL("runtime/template-support.json", compilerBase),
    { signal },
  );
  if (!response.ok)
    throw Error(
      "Connect once or save the offline LaTeX package before exporting source fonts.",
    );
  const support = await response.json();
  for (const [name, text] of Object.entries(support))
    files[name] = encode(text);
  const manifest = await fetch(
    new URL("runtime/file-manifest.json", compilerBase),
    { signal },
  ).then((r) => r.json());
  for (const bundle of [
    "fonts-lm-type1",
    "fonts-lm-tfm",
    "fonts-cm",
    "fonts-misc",
  ]) {
    const response = await fetch(
      new URL(`runtime/${bundle}.data.gz`, compilerBase),
      { signal },
    );
    if (!response.ok) throw Error("A font bundle is unavailable.");
    const bytes = new Uint8Array(
      await new Response(
        response.body.pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer(),
    );
    for (const [name, item] of Object.entries(manifest))
      if (
        item.bundle === bundle &&
        name.startsWith("/texlive/texmf-dist/fonts/")
      )
        files["texmf/" + name.slice(20)] = bytes.slice(item.start, item.end);
  }
  for (const name of [
    "LICENSE-COMPONENTS.txt",
    "LICENSE-Siglum-MIT.txt",
    "LICENSE-TeX-Live.txt",
    "SOURCE-ACCESS.json",
  ])
    files["licences/" + name] = new Uint8Array(
      await fetch(new URL(name, compilerBase), { signal }).then((r) =>
        r.arrayBuffer(),
      ),
    );
  files["SHA256SUMS"] = encode(
    (
      await Promise.all(
        Object.entries(files).map(
          async ([name, bytes]) =>
            [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
              .map((x) => x.toString(16).padStart(2, "0"))
              .join("") +
            "  " +
            name,
        ),
      )
    ).join("\n") + "\n",
  );
  onProgress("Compressing reproducible LaTeX source package");
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cancel = zip(files, { level: 6 }, (error, result) => {
      signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve(result);
    });
    const abort = () => {
      cancel();
      reject(
        Error("Source preparation cancelled. Your R results are retained."),
      );
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}
export function createRReportControls({ root, action, getRun }) {
  const element = el("details", "custom-r-report");
  element.append(el("summary", "", "Create a research report"));
  const fields = el("div", "custom-r-report-fields");
  const title = el("input");
  title.type = "text";
  title.value = "Custom R analysis";
  title.maxLength = 180;
  title.setAttribute("aria-label", "Report title");
  const author = el("input");
  author.type = "text";
  author.placeholder = "Optional";
  author.maxLength = 120;
  author.setAttribute("aria-label", "Report author");
  for (const [text, input] of [
    ["Report title", title],
    ["Prepared by", author],
  ]) {
    const label = el("label", "", text);
    label.append(input);
    fields.append(label);
  }
  element.append(fields);
  const note = el(
    "p",
    "note",
    "Export the last successful run, including its code, provenance and vector figures. PDF compilation runs locally and never reruns your R script. The optional PDF compiler is about 56.8 MB and loads only when requested; save it under Install app for offline use.",
  );
  const status = el("p", "note");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  let busy = false,
    disposed = false,
    controller;
  const pdf = action("Create PDF", "download", () => exportReport("pdf"));
  const source = action("Download LaTeX source", "download", () =>
    exportReport("source"),
  );
  const stop = action("Cancel", "close", () => {
    controller?.abort();
    cancelReportCompilation();
  });
  stop.hidden = true;
  const actions = el("div", "custom-r-toolbar");
  actions.append(pdf, source, stop);
  element.append(note, actions, status);
  pdf.disabled = source.disabled = true;
  function progress(text) {
    setLoadingMessage(status, String(text));
  }

  async function exportReport(kind) {
    if (busy) return;
    busy = true;
    controller = new AbortController();
    pdf.disabled = source.disabled = true;
    stop.hidden = false;
    root.dataset.reportBusy = "true";
    const finish = beginActivity("Preparing research report");
    try {
      progress("Preparing recorded results and vector figures");
      const files = reportFiles(
        getRun(),
        title.value || "Custom R analysis",
        author.value,
      );
      const bytes =
        kind === "pdf"
          ? await compileReport(files, progress, controller.signal)
          : await addSourceSupport(files, progress, controller.signal);
      if (disposed) return;
      status.classList.remove("inline-loading");
      status.textContent =
        kind === "pdf" ? "PDF report ready." : "LaTeX source package ready.";
      await downloadFile(
        kind === "pdf"
          ? "psilocin-analysis.pdf"
          : "psilocin-analysis-latex.zip",
        bytes,
        kind === "pdf" ? "application/pdf" : "application/zip",
      );
    } catch (error) {
      if (!disposed) {
        status.classList.remove("inline-loading");
        status.textContent = error.message;
        showToast("Report could not be created. Your R results are retained.");
      }
    } finally {
      busy = false;
      finish();
      root.dataset.reportBusy = "false";
      stop.hidden = true;
      if (!disposed)
        pdf.disabled = source.disabled =
          !getRun().record || getRun().record.error;
    }
  }
  return {
    element,
    setReady(value) {
      pdf.disabled = source.disabled = !value || busy;
    },
    destroy() {
      disposed = true;
      controller?.abort();
      cancelReportCompilation();
    },
  };
}
