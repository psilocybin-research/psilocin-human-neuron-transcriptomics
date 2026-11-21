import { appendMitochondrialCard } from "./mitochondrial-card.js";
import { createMethodComparison } from "./method-comparison.js";
import { crossDayRows } from "./network-statistics.js";
import data from "../assets/vendor/oxphos-research-data.js";
import {
  createElement as el,
  loadingMessage,
  createAccordion,
} from "./interface-utils.js";
import { Plot, scientificPlot, interactiveMark } from "./scientific-plot.js";
import { contrasts } from "./format.js";
import { downloadFile } from "./file-download.js";

const compact = (v) =>
  +v === 0
    ? "0"
    : Math.abs(+v) < 0.001
      ? (+v).toExponential(2)
      : Number((+v).toPrecision(4)).toString();
const number = (v) =>
  v === null || v === undefined || v === "" || !Number.isFinite(+v)
    ? "Not estimable"
    : String(v);
function table(headers, rows) {
  const wrap = el("div", "table-scroll data-table"),
    t = el("table"),
    head = el("thead"),
    body = el("tbody"),
    tr = el("tr");
  headers.forEach((h) => tr.append(el("th", "", h)));
  head.append(tr);
  t.dataset.sortable = "true";
  rows.forEach((values) => {
    const row = el("tr");
    values.forEach((v, i) => {
      const numeric =
        v !== "" &&
        v !== null &&
        v !== undefined &&
        Number.isFinite(+v) &&
        rows.every(
          (r) => r[i] !== "" && r[i] !== null && Number.isFinite(+r[i]),
        );
      const cell = el(
        "td",
        numeric ? "numeric" : "",
        numeric ? compact(v) : String(v),
      );
      cell.title = String(v);
      if (numeric) cell.dataset.sortValue = String(v);
      row.append(cell);
    });
    body.append(row);
  });
  t.append(head, body);
  wrap.append(t);
  return wrap;
}
function action(text, fn) {
  const b = el("button", "button button-tonal", text);
  b.type = "button";
  b.onclick = fn;
  return b;
}
const profileBlocks = [...new Set(data.profiles.map((r) => r.block))];

export function researchPanel(
  gene,
  {
    genes = [],
    total = 113,
    filterLabel = "All archived genes",
    limit = 4.5,
    initialTab = "evidence",
    onTab = () => {},
    onSelect = () => {},
    onHover = () => {},
    onSceneModel,
    onSceneHighlight,
    contrast = "day1_vs_control",
  } = {},
) {
  const root = el("section", "oxphos-research-panel");
  root.dataset.gene = gene.id;
  const nav = el("div", "segmented segmented-strong research-panel-tabs");
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", "Linked gene research");
  const body = el("div", "research-panel-body");
  root.append(nav, body);
  let methodView;
  root.dispose = () => { methodView?.dispose?.(); };
  root.highlightGene = (id) => {
    for (const mark of body.querySelectorAll("[data-comparison-gene]")) {
      const hover = mark.dataset.comparisonGene === id;
      mark.classList.toggle("is-linked-hover", hover);
      mark.setAttribute("r", hover ? "6" : "4");
      mark.setAttribute("stroke-width", hover ? "2.5" : "1");
    }
    root.dataset.hoveredGene = id || "";

  };
  let active = "",
    version = 0;
  const buttons = new Map();
  for (const [key, name] of [
    ["evidence", "Evidence"],
    ["compare", "Compare"],
    ["protein", "Protein"],
    ["methods", "Sensitivity"],
  ]) {
    const b = action(name, () => show(key));
    b.className = "button";
    b.setAttribute("role", "tab");
    b.id = `network-tab-${key}`;
    b.setAttribute("aria-controls", "network-research-content");
    buttons.set(key, b);
    nav.append(b);
  }
  body.id = "network-research-content";
  body.setAttribute("role", "tabpanel");
  async function show(key) {
    if (active === key) return;
    methodView?.dispose?.();
    active = key;
    onTab(key);
    const current = ++version;
    buttons.forEach((b, k) => {
      b.setAttribute("aria-selected", String(k === key));
      b.classList.toggle("button-active", k === key);
      b.tabIndex = k === key ? 0 : -1;
    });
    body.setAttribute("aria-labelledby", buttons.get(key).id);
    body.replaceChildren();
    if (key === "evidence") evidence();
    if (key === "compare") {
      comparison();
      evidence();
    }
    if (key === "methods") methods();
    if (key === "protein") {
      body.append(loadingMessage("Loading matched protein context…"));
      try {
        const { linkedProtein } = await import("./linked-protein.js");
        const protein = await linkedProtein(gene, {
          onSceneModel,
          onSceneHighlight,
        });
        if (current === version && root.isConnected)
          body.replaceChildren(protein);
      } catch (error) {
        if (current === version)
          body.replaceChildren(el("p", "note", error.message));
      }
    }
  }
  nav.onkeydown = (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const keys = [...buttons.keys()],
      i = keys.indexOf(active);
    const key =
      keys[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? keys.length - 1
            : (i + (e.key === "ArrowRight" ? 1 : -1) + keys.length) %
              keys.length
      ];
    show(key);
    buttons.get(key).focus();
  };
  function comparison() {
    const rows = crossDayRows(genes);
    body.append(
      el("h4", "", "Day 1 versus Day 3"),
      el(
        "p",
        "note",
        `${filterLabel}. ${genes.length} / ${total} genes retained; ${rows.length} have both plotted effects. Both axes use the same fixed zero-centred limits.`,
      ),
    );
    body.append(
      scientificPlot({
        title:
          "Archived cross-day gene effects; select a point for linked evidence",
        width: 410,
        height: 360,
        marginLeft: 52,
        marginRight: 24,
        x: {
          domain: [-limit, limit],
          label: "Day 1 / common control · log₂FC",
          grid: true,
        },
        y: {
          domain: [-limit, limit],
          label: "Day 3 / common control · log₂FC",
          grid: true,
        },
        marks: [
          Plot.ruleX([0], { stroke: "#83969e" }),
          Plot.ruleY([0], { stroke: "#83969e" }),
          Plot.line(
            [
              { x: -limit, y: -limit },
              { x: limit, y: limit },
            ],
            { x: "x", y: "y", stroke: "#83969e", strokeDasharray: "4,3" },
          ),
          Plot.dot(rows, {
            x: "x",
            y: "y",
            r: 4,
            fill: (r) => (r.gene.id === gene.id ? "#d18b21" : "#235780"),
            stroke: (r) => (r.gene.id === gene.id ? "#68420c" : "white"),
            strokeWidth: 1,
            title: (r) =>
              `${r.gene.symbol}\nDay 1 log₂FC ${r.x}; gene FDR ${number(r.gene.effects[0].padj)}\nDay 3 log₂FC ${r.y}; gene FDR ${number(r.gene.effects[1].padj)}`,
            render: (...args) => {
              const group = interactiveMark(
                rows,
                (r) => onSelect(r.gene),
                (r) => `Select ${r.gene.symbol}: Day 1 ${r.x}, Day 3 ${r.y}`,
              )(...args);
              const marks = [...group.children].filter((n) =>
                n.matches("circle,path"),
              );
              marks.forEach((mark, i) => {
                const row = rows[args[0][i]];
                if (!row) return;
                mark.dataset.comparisonGene = row.gene.id;
                const enter = () => onHover(row.gene.id);
                const leave = () => onHover("");
                mark.addEventListener("pointerenter", enter);
                mark.addEventListener("pointerleave", leave);
                mark.addEventListener("focus", enter);
                mark.addEventListener("blur", leave);
              });
              return group;
            },
          }),
        ],
      }),
    );
    body.append(
      el(
        "p",
        "callout",
        "These 113 genes are a selected leading-edge union, not a transcriptome-wide sample. The diagonal means equal point estimates; distance from it is not a significance test. Different significance on two days is not evidence of an interaction.",
      ),
    );
  }
  function evidence() {
    appendMitochondrialCard(body, gene);
    body.append(el("h4", "", "Gene-level estimates"));
    const rows = gene.effects.flatMap((r, i) =>
      Number.isFinite(r?.log2FoldChange) &&
      Number.isFinite(r?.lfcSE) &&
      r.lfcSE >= 0
        ? [
            {
              ...r,
              contrast: [
                "Day 1 / control",
                "Day 3 / control",
                "Treated Day 3 / Day 1",
              ][i],
              lo: r.log2FoldChange - 1.96 * r.lfcSE,
              hi: r.log2FoldChange + 1.96 * r.lfcSE,
            },
          ]
        : [],
    );
    if (rows.length)
      body.append(
        scientificPlot({
          title: `${gene.symbol}: archived effects and approximate 95% Wald intervals`,
          width: 410,
          height: 245,
          marginLeft: 24,
          marginRight: 24,
          x: { label: "log₂ fold change", grid: true },
          y: { axis: null, domain: rows.map((r) => r.contrast) },
          marks: [
            Plot.ruleX([0], { stroke: "#83969e", strokeDasharray: "4,3" }),
            Plot.ruleY(rows, {
              x1: "lo",
              x2: "hi",
              y: "contrast",
              stroke: "#235780",
              strokeWidth: 2,
            }),
            Plot.dot(rows, {
              x: "log2FoldChange",
              y: "contrast",
              fill: "#235780",
              r: 4,
              title: (r) =>
                `${r.contrast}\nlog₂FC ${number(r.log2FoldChange)}\nSE ${number(r.lfcSE)}\nGene FDR ${number(r.padj)}`,
            }),
            Plot.text(rows, {
              x: 0,
              y: "contrast",
              text: "contrast",
              dy: -20,
              fontSize: 11,
            }),
          ],
        }),
      );
    body.append(
      table(
        ["Contrast", "log₂FC", "95% interval", "Gene FDR"],
        gene.effects.map((r, i) => [
          Object.values(contrasts)[i],
          number(r?.log2FoldChange),
          Number.isFinite(r?.log2FoldChange) && Number.isFinite(r?.lfcSE)
            ? `${compact(r.log2FoldChange - 1.96 * r.lfcSE)} to ${compact(r.log2FoldChange + 1.96 * r.lfcSE)}`
            : "Not estimable",
          number(r?.padj),
        ]),
      ),
    );
    body.append(
      el(
        "p",
        "note",
        "Summary values are rounded; full stored precision is available in Full stored gene statistics below and numeric-cell tooltips. Intervals are log₂FC ± 1.96 SE, approximate Wald intervals. The treated Day 3 / Day 1 contrast is archived directly; it is not a treatment-by-time interaction test. Common-control harvest timing is unresolved.",
      ),
    );
    const profiles = data.profiles.filter((r) => r.gene === gene.symbol);
    body.append(el("h4", "", "Nine aggregated expression profiles"));
    if (profiles.length)
      body.append(
        scientificPlot({
          title: `${gene.symbol}: aggregated VST profiles by differentiation block`,
          width: 410,
          height: 270,
          marginLeft: 48,
          marginRight: 20,
          x: { domain: ["Control", "Day 1", "Day 3"], label: null },
          y: { label: "VST expression", zero: false, grid: true },
          symbol: {
            domain: profileBlocks,
            range: ["circle", "cross", "diamond"],
          },
          color: {
            domain: profileBlocks,
            range: ["#0072b2", "#69a2b8", "#d55e00"],
          },
          marks: [
            Plot.dot(profiles, {
              x: "condition",
              y: "vst",
              fill: "block",
              symbol: "block",
              r: 5,
              title: (r) =>
                `${r.block} · ${r.condition}\nVST ${r.vst}\n${r.libraries_n} pooled libraries; mean RIN ${r.RIN_mean}`,
            }),
          ],
        }),
      );
    else
      body.append(
        el("p", "note", "No archived profiles are available for this gene."),
      );
    body.append(
      el(
        "p",
        "profile-block-legend",
        profileBlocks
          .map(
            (b, i) =>
              `${["Blue circle", "Pale blue cross", "Rust diamond"][i]}: ${b}`,
          )
          .join(" · "),
      ),
    );
    body.append(
      el(
        "p",
        "note",
        "Three differentiation blocks, two genetic backgrounds. These nine block-by-condition aggregates are not nine independent biological replicates or repeated measurements of individual cells. Points identify blocks without implying a longitudinal trajectory.",
      ),
    );
    const details = createAccordion(
      "Exact profile values and pooling",
      "network-profile-values",
    );
    details.body.append(
      table(
        ["Block", "Condition", "VST", "Libraries", "Mean RIN"],
        profiles.map((r) => [
          r.block,
          r.condition,
          r.vst,
          r.libraries_n,
          r.RIN_mean,
        ]),
      ),
    );
    body.append(details.element);
  }
  function methods() {
    methodView = createMethodComparison({
      data: { pathways: data.enrichment.filter(r => r.variant === "primary"), sensitivities: data.enrichment },
      pathway: "HALLMARK_OXIDATIVE_PHOSPHORYLATION", contrast,
    });
    body.append(el("p", "note", "Pathway context, not a confidence score for the selected gene."), methodView);
  }
  show(initialTab);
  return root;
}
