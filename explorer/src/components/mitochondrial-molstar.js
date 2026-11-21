import { createMolecularTools } from "./molecular-tools.js";
import { FileAttachment } from "observablehq:stdlib";
import { createElement as el, loadingMessage } from "./interface-utils.js";
import { color, fmt, sci } from "./format.js";
import { uiIcon } from "./icons.js";
import { molecularRNAExport, molecularCSV } from "./molecular-export.js";
import { downloadFile } from "./file-download.js";
let runtimePromise;
async function runtime() {
  return (runtimePromise ||= Promise.all([
    FileAttachment("../assets/vendor/molstar.css").url(),
    FileAttachment("../assets/vendor/molstar.js").url(),
  ]).then(
    ([css, js]) =>
      new Promise((resolve, reject) => {
        if (!document.querySelector("[data-molstar-style]")) {
          const link = el("link");
          link.rel = "stylesheet";
          link.href = css;
          link.dataset.molstarStyle = "";
          document.head.append(link);
        }
        if (window.molstar) return resolve(window.molstar);
        const script = el("script");
        script.src = js;
        script.onload = () => resolve(window.molstar);
        script.onerror = () => {
          script.remove();
          runtimePromise = undefined;
          reject(new Error("Molecular renderer unavailable"));
        };
        document.head.append(script);
      }),
  ));
}
const molecularURL = (name) =>
  new URL(`molecular/${name}`, new URL("./", document.baseURI)).href;
export function createMolecularViewer({ genes, onGene, onSendGene }) {
  const root = el("section", "molecular-workbench"),
    controls = el(
      "div",
      "list list-strong list-dividers inset molecular-settings",
    );
  const list = el("ul");
  controls.append(list);
  function select(label, items) {
    const li = el("li", "item-content item-input"),
      inner = el("div", "item-inner"),
      title = el("div", "item-title item-label", label),
      wrap = el("div", "item-input-wrap"),
      input = el("select");
    input.setAttribute("aria-label", label);
    for (const [value, text] of items) {
      const o = el("option", "", text);
      o.value = value;
      input.append(o);
    }
    wrap.append(input);
    inner.append(title, wrap);
    li.append(inner);
    list.append(li);
    return input;
  }
  const mode = select("Colour meaning", [
    ["identity", "Subunit identity · reference anatomy"],
    ["day1", "Day 1 · RNA log₂FC"],
    ["day3", "Day 3 · RNA log₂FC"],
  ]);
  mode.closest("li").remove();
  const colourBar = el(
    "div",
    "segmented segmented-strong molecular-colour-bar",
  );
  colourBar.setAttribute("role", "group");
  colourBar.setAttribute("aria-label", "Molecular evidence layer");
  const colourButtons = new Map();
  for (const [value, label] of [
    ["identity", "Anatomy"],
    ["day1", "Day 1 RNA"],
    ["day3", "Day 3 RNA"],
  ]) {
    const button = el("button", "button", label);
    button.type = "button";
    button.classList.toggle("button-active", value === mode.value);
    button.setAttribute("aria-pressed", String(value === mode.value));
    button.onclick = () => {
      mode.value = value;
      for (const [key, b] of colourButtons) {
        b.classList.toggle("button-active", key === value);
        b.setAttribute("aria-pressed", String(key === value));
      }
      apply();
    };
    colourButtons.set(value, button);
    colourBar.append(button);
  }
  const representation = select("Molecular representation", [
    ["cartoon", "Cartoon · whole assembly"],
    ["ball_and_stick", "Ball and stick · selected chain"],
    ["surface", "Surface · selected chain"],
  ]);
  const chooser = select("Molecular subunit", []);
  const isolateRow = el("li"),
    isolateLabel = el("label", "item-checkbox item-content"),
    isolate = el("input");
  isolate.type = "checkbox";
  isolate.setAttribute("aria-label", "Isolate molecular subunit");
  const icon = el("i", "icon icon-checkbox"),
    inner = el("div", "item-inner");
  inner.append(el("div", "item-title", "Isolate selected subunit"));
  isolateLabel.append(isolate, icon, inner);
  isolateRow.append(isolateLabel);
  list.append(isolateRow);
  const toolbar = el("div", "molecular-actionbar"),
    save = el("button", "button button-tonal", "Save scene"),
    reset = el("button", "button button-tonal", "Reset view");
  save.type = reset.type = "button";
  save.disabled = reset.disabled = true;
  toolbar.append(reset, save);
  const legend = el(
      "p",
      "note molecular-legend",
      "Reference anatomy: categorical subunit identity; no experimental RNA effects encoded.",
    ),
    stage = el("div", "molecular-stage"),
    rendererHost = el("div", "molecular-renderer-host"),
    status = loadingMessage("Loading human complex I…"),
    evidence = el("div", "card molecular-gene-evidence");
  // Mol* owns and replaces its mount contents; F7 controls stay in a sibling layer.
  stage.append(rendererHost);
  status.setAttribute("role", "status");
  stage.setAttribute(
    "aria-label",
    "Interactive human complex I molecular structure",
  );
  root.append(
    el("h3", "", "Human complex I · PDB 9TI4"),
    el(
      "p",
      "note",
      "Reference coordinates · 45 protein chains / 44 gene records. RNA overlays are experimental transcript estimates, not protein abundance, conformation or respiratory activity.",
    ),
    colourBar,
    toolbar,
    stage,
    legend,
    status,
    evidence,
  );
  let visible = false;
  const visibility = () => {
    if (!viewer) return;
    if (document.hidden || !visible)
      viewer.plugin.animationLoop.stop({ noDraw: true });
    else viewer.plugin.animationLoop.start();
  };
  document.addEventListener("visibilitychange", visibility);
  let viewer,
    chains = [],
    selected,
    disposed = false,
    started = false,
    busy = false,
    queued = false,
    sceneData,
    observer,
    library;
  const byId = new Map(genes.map((g) => [g.id, g])),
    identityIndices = new Map();
  const gene = (c) => {
    const ids = [...new Set(c.mappings.flatMap((m) => m.archivedIds))];
    return ids.length === 1 ? byId.get(ids[0]) : null;
  };
  function anatomy(c) {
    const i = identityIndices.get(gene(c)?.id || c.label) || 0,
      h = (i * 137.508) % 360,
      a = 0.58 * Math.min(0.61, 0.39);
    return (
      "#" +
      [0, 8, 4]
        .map((n) => {
          const k = (n + h / 30) % 12;
          return Math.round(
            255 * (0.61 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
          )
            .toString(16)
            .padStart(2, "0");
        })
        .join("")
    );
  }
  function rna(c) {
    const rgb = color(
      gene(c)?.effects[mode.value === "day1" ? 0 : 1]?.log2FoldChange,
      2.5,
    );
    const values = rgb.match(/\d+/g);
    return values
      ? "#" + values.map((v) => (+v).toString(16).padStart(2, "0")).join("")
      : "#dedede";
  }
  let tools;
  function details(c) {
    selected = c;
    chooser.value = c.label;
    const g = gene(c);
    evidence.replaceChildren();
    const header = el("div", "card-header molecular-gene-header"),
      identity = el("div");
    identity.append(
      el("h4", "", `${g?.symbol || c.mappings[0].uniprot} · chain ${c.author}`),
      el("p", "identifier", g?.id || "No unique archived gene"),
    );
    const actions = el("div", "segmented segmented-strong");
    if (g)
      for (const [ico, label, callback] of [
        ["custom-r", `Send ${g.symbol} to R Studio`, () => onSendGene(g)],
        ["genes", `Open ${g.symbol} gene evidence`, () => onGene(g)],
      ]) {
        const b = el("button", "button");
        b.type = "button";
        b.setAttribute("aria-label", label);
        b.append(uiIcon(ico));
        b.onclick = callback;
        actions.append(b);
      }
    header.append(identity, actions);
    evidence.append(header);
    const wrap = el("div", "data-table table-scroll"),
      table = el("table"),
      head = el("thead"),
      hr = el("tr");
    for (const text of [
      "Contrast",
      "RNA log₂FC",
      "Approx. 95% Wald interval",
      "Gene FDR",
    ])
      hr.append(el("th", "", text));
    head.append(hr);
    table.append(head);
    const body = el("tbody");
    for (const [i, e] of (g?.effects || []).entries()) {
      const tr = el("tr"),
        valid = Number.isFinite(e.log2FoldChange) && Number.isFinite(e.lfcSE);
      for (const value of [
        [
          "Day 1 / common control",
          "Day 3 / common control",
          "Treated Day 3 / Day 1",
        ][i],
        fmt(e.log2FoldChange),
        valid
          ? `${fmt(e.log2FoldChange - 1.96 * e.lfcSE)} to ${fmt(e.log2FoldChange + 1.96 * e.lfcSE)}`
          : "Not estimable",
        sci(e.padj),
      ])
        tr.append(el("td", "", value));
      body.append(tr);
    }
    table.append(body);
    wrap.append(table);
    evidence.append(
      wrap,
      el(
        "p",
        "note",
        `UniProt ${c.mappings[0].uniprot} · SIFTS sequence mapping coverage ${(c.mappings[0].coverage * 100).toFixed(1)}%. Sequence mapping coverage is distinct from coordinate completeness. Unresolved regions are not reconstructed; repeated subunit copies are not separate biological observations.`,
      ),
    );
    root.dataset.selectedGene = g?.id || "";
    tools?.sync();
  }
  function specification() {
    const single = isolate.checked || representation.value !== "cartoon";
    return {
      metadata: {
        version: "1",
        timestamp: new Date().toISOString(),
        title: "Psilocin Transcriptome Atlas · human complex I",
        description: `PDB 9TI4 assembly 1; ${mode.value}; reference coordinates with separate archived RNA overlays. Atlas: ${location.href}`,
      },
      root: {
        kind: "root",
        children: [
          {
            kind: "download",
            params: { url: molecularURL("9TI4.cif") },
            children: [
              {
                kind: "parse",
                params: { format: "mmcif" },
                children: [
                  {
                    kind: "structure",
                    params: { type: "assembly", assembly_id: "1" },
                    children: [
                      {
                        kind: "component",
                        params: {
                          selector: single
                            ? { label_asym_id: selected.label }
                            : "polymer",
                        },
                        children: [
                          {
                            kind: "representation",
                            params: { type: representation.value },
                            children: [
                              { kind: "color", params: { color: "#dedede" } },
                              ...chains.map((c) => ({
                                kind: "color",
                                params: {
                                  selector: { label_asym_id: c.label },
                                  color:
                                    mode.value === "identity"
                                      ? anatomy(c)
                                      : rna(c),
                                },
                              })),
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          { kind: "canvas", params: { background_color: "#081521" } },
        ],
      },
    };
  }
  async function apply() {
    if (!viewer || disposed) return;
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    root.setAttribute("aria-busy", "true");
    try {
      sceneData = specification();
      await viewer.loadMvsData(JSON.stringify(sceneData), "mvsj", {
        replaceExisting: true,
      });
      if (disposed) return;
      legend.textContent =
        mode.value === "identity"
          ? "Reference anatomy: categorical subunit identity colours. No RNA effects are encoded."
          : `Experimental RNA estimates · ${mode.value === "day1" ? "Day 1" : "Day 3"} / common control. Blue −2.5 · white 0 · orange +2.5 log₂FC. Grey: no unique estimable mapping. No protein change is inferred.`;
      details(selected);
      status.classList.remove("inline-loading");
      status.textContent =
        "45 audited protein chains · 44 gene records · select a chain in the structure or display controls.";
      root.dataset.molecularReady = "true";
      save.disabled = reset.disabled = false;
    } catch (error) {
      if (!disposed) {
        status.classList.remove("inline-loading");
        status.textContent =
          "The molecular structure could not load. Archived evidence and the lightweight viewer remain available.";
      }
    } finally {
      busy = false;
      root.removeAttribute("aria-busy");
      if (queued && !disposed) {
        queued = false;
        apply();
      }
    }
  }
  async function activate() {
    visible = true;
    if (disposed) return;
    if (started) {
      viewer?.handleResize();
      viewer?.plugin.animationLoop.start();
      return;
    }
    started = true;
    try {
      const [snapshot, molstar] = await Promise.all([
        FileAttachment("../assets/mitochondria/complex-i.json").json(),
        runtime(),
      ]);
      if (disposed) return;
      library = molstar;
      chains = snapshot.chains;
      for (const c of chains) {
        const key = gene(c)?.id || c.label;
        if (!identityIndices.has(key))
          identityIndices.set(key, identityIndices.size);
        const o = el(
          "option",
          "",
          `${gene(c)?.symbol || c.mappings[0].uniprot} · chain ${c.author}`,
        );
        o.value = c.label;
        chooser.append(o);
      }
      selected = chains[0];
      details(selected);
      const instance = await molstar.Viewer.create(rendererHost, {
        layoutIsExpanded: false,
        layoutShowControls: false,
        layoutShowRemoteState: false,
        layoutShowSequence: false,
        layoutShowLog: false,
        layoutShowLeftPanel: false,
        collapseRightPanel: true,
        volumeStreamingDisabled: true,
        extensions: ["mvs"],
        viewportShowReset: false,
        viewportShowScreenshotControls: false,
        viewportShowControls: false,
        viewportShowSettings: false,
        viewportShowSelectionMode: false,
        viewportShowAnimation: false,
        viewportShowTrajectoryControls: false,
        viewportShowExpand: false,
        viewportShowToggleFullscreen: false,
        pixelScale: 1,
      });
      if (disposed) {
        instance.dispose();
        return;
      }
      viewer = instance;
      viewer.subscribe(viewer.plugin.behaviors.interaction.click, (event) => {
        const loci = event.current?.loci;
        if (loci?.kind !== "element-loci") return;
        const loc =
          library.lib.structure.StructureElement.Loci.getFirstLocation(loci);
        if (!loc) return;
        const label =
            library.lib.structure.StructureProperties.chain.label_asym_id(loc),
          chain = chains.find((c) => c.label === label);
        if (chain) {
          details(chain);
          const residue =
            library.lib.structure.StructureProperties.residue.auth_seq_id(loc);
          const name =
            library.lib.structure.StructureProperties.atom.label_comp_id(loc);
          tools?.showPicked(
            `${name} ${residue} · chain ${chain.author}. Reference residue identity; RNA effects remain gene-level estimates.`,
          );
        }
      });
      observer = new ResizeObserver(() => {
        if (!disposed && stage.clientWidth) viewer?.handleResize();
      });
      observer.observe(stage);
      await apply();
      tools.ready();
      if (!visible) viewer?.plugin.animationLoop.stop({ noDraw: true });
    } catch (error) {
      if (!disposed) {
        started = false;
        status.classList.remove("inline-loading");
        status.replaceChildren(
          document.createTextNode("Molecular viewer unavailable. "),
        );
        const retry = el("button", "button button-tonal", "Retry");
        retry.onclick = activate;
        status.append(retry);
      }
    }
  }
  mode.onchange = representation.onchange = isolate.onchange = () => apply();
  chooser.onchange = () => {
    const c = chains.find((c) => c.label === chooser.value);
    if (!c) return;
    details(c);
    if (isolate.checked || representation.value !== "cartoon") apply();
    else
      viewer?.structureInteractivity({
        elements: { label_asym_id: c.label },
        action: "select",
      });
  };
  save.onclick = () =>
    downloadFile(
      "9TI4-atlas-scene.mvsj",
      JSON.stringify(sceneData, null, 2),
      "application/json",
    );
  reset.onclick = () => viewer?.plugin.managers.camera.reset();
  tools = createMolecularTools({
    surface: stage,
    getViewer: () => viewer,
    getChain: () => selected,
    controls,
    saveScene: () => save.onclick(),
    reset: () => reset.onclick(),
    structureURL: molecularURL("9TI4.cif"),
    exportData: async (kind) => {
      if (!chains.length)
        throw new Error("The molecular mappings are still loading.");
      const sourceURL = location.href;
      if (kind === "mapping")
        return downloadFile(
          "9TI4-atlas-mapping-and-RNA.json",
          JSON.stringify(
            {
              pdb_id: "9TI4",
              assembly_id: "1",
              source_structure: molecularURL("9TI4.cif"),
              source_url: sourceURL,
              interpretation:
                "Reference coordinates; RNA effects are gene-level estimates, not protein abundance, conformation or respiratory activity.",
              chains,
              rna_estimates: molecularRNAExport(chains, gene, sourceURL),
            },
            null,
            2,
          ),
          "application/json",
        );
      const selectedOnly = kind === "selected";
      const rows = molecularRNAExport(
        selectedOnly ? [selected] : chains,
        gene,
        sourceURL,
      );
      return downloadFile(
        selectedOnly
          ? `9TI4-${gene(selected)?.symbol || selected.author}-RNA.csv`
          : "9TI4-mapped-genes-RNA.csv",
        molecularCSV(rows),
        "text/csv",
      );
    },
    focusChain: () =>
      viewer?.structureInteractivity({
        elements: { label_asym_id: selected.label },
        action: "focus",
        focusOptions: {
          durationMs: matchMedia("(prefers-reduced-motion:reduce)").matches
            ? 0
            : 500,
        },
      }),
    evidenceElement: evidence,
  });
  return {
    element: root,
    activate,
    setVisible(value) {
      visible = value;
      if (!viewer) return;
      if (value) {
        viewer.handleResize();
        viewer.plugin.animationLoop.start();
      } else viewer.plugin.animationLoop.stop({ noDraw: true });
    },
    dispose() {
      disposed = true;
      document.removeEventListener("visibilitychange", visibility);
      tools.dispose();
      observer?.disconnect();
      viewer?.dispose();
      viewer = undefined;
    },
  };
}
