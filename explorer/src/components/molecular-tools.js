import { createElement as el, escapeHTML } from "./interface-utils.js";
import { createVisualizationTools } from "./visualization-tools.js";
import { downloadURL, downloadFile } from "./file-download.js";

export function createMolecularTools({
  surface,
  getViewer,
  getChain,
  controls,
  saveScene,
  reset,
  focusChain,
  evidenceElement,
  structureURL,
  exportData,
}) {
  const hub = createVisualizationTools({
    surface,
    title: "Molecular tools",
    fullscreenControl: true,
    fullscreenTitle: "Human complex I",
    onResize: () => getViewer()?.handleResize(),
  });
  const app = document.querySelector("#psilocin-app")?.f7;
  const plugin = () => {
    const p = getViewer()?.plugin;
    if (!p) throw new Error("The molecular structure is still loading.");
    return p;
  };
  function field(host, name, options, change) {
    const list = el(
        "div",
        "list list-strong list-dividers inset atlas-3d-field-list",
      ),
      ul = el("ul"),
      row = el("li", "atlas-3d-tool-field"),
      select = el("select");
    select.setAttribute("aria-label", name);
    for (const [value, text] of options) {
      const option = el("option", "", text);
      option.value = value;
      select.append(option);
    }
    select.onchange = () => change?.(select.value);
    row.append(select);
    ul.append(row);
    list.append(ul);
    host.append(list);
    return select;
  }
  function check(host, name, change) {
    const list = el("div", "list list-strong list-dividers inset"),
      ul = el("ul"),
      row = el("li"),
      label = el("label", "item-checkbox item-content"),
      input = el("input"),
      inner = el("div", "item-inner");
    input.type = "checkbox";
    input.setAttribute("aria-label", name);
    inner.append(el("span", "item-title", name));
    label.append(input, el("i", "icon icon-checkbox"), inner);
    input.onchange = () => change(input.checked);
    row.append(label);
    ul.append(row);
    list.append(ul);
    host.append(list);
    return input;
  }
  const view = hub.section("View & camera", {
    shortcut: "Camera",
    icon: "overview",
    order: 3,
  });
  hub.action(
    view,
    "Fullscreen / return",
    () => hub.toggleFullscreen(),
    "fullscreen",
  );
  hub.action(view, "Fit complete assembly", reset, "overview");
  hub.action(
    view,
    "Focus selected subunit",
    () => {
      hub.close();
      focusChain();
    },
    "genes",
  );
  hub.action(
    view,
    "Align principal axes",
    () => plugin().managers.camera.orientAxes(undefined, motionDuration()),
    "controls",
  );
  hub.action(
    view,
    "Reset Cartesian axes",
    () => plugin().managers.camera.resetAxes(motionDuration()),
    "controls",
  );
  const display = hub.section("Representation & lighting", {
    open: true,
    order: 0,
    shortcut: "Display",
    icon: "appearance",
  });
  display.append(controls);
  field(
    display,
    "Canvas background",
    [
      ["dark", "Dark"],
      ["light", "Light"],
    ],
    (v) =>
      plugin().canvas3d.setProps({
        renderer: { backgroundColor: v === "dark" ? 0x081521 : 0xf6f9fc },
      }),
  );
  field(
    display,
    "Ambient lighting",
    [
      [".4", "Low"],
      [".8", "Balanced"],
      ["1.2", "Bright"],
    ],
    (v) =>
      plugin().canvas3d.setProps({ renderer: { ambientIntensity: Number(v) } }),
  ).value = ".8";
  const selection = hub.section("Selection & resolved sequence", {
    order: 1,
    shortcut: "Sequence",
    icon: "genes",
  });
  check(selection, "Enable molecular selection mode", (value) => {
    plugin().selectionMode = value;
  });
  field(
    selection,
    "Selection granularity",
    [
      ["chain", "Subunit chain"],
      ["residue", "Residue"],
      ["element", "Atom"],
    ],
    (v) => plugin().managers.interactivity.setProps({ granularity: v }),
  );
  const picked = el(
    "p",
    "note",
    "Choose a residue below or click the structure to inspect an atom or residue.",
  );
  picked.setAttribute("aria-live", "polite");
  selection.append(picked);
  hub.action(
    selection,
    "Clear molecular selection",
    () => {
      getViewer().structureInteractivity({ action: "select" });
      plugin().managers.interactivity.lociHighlights.clearHighlights();
    },
    "close",
  );
  const searchLabel = el("form", "searchbar searchbar-inline"),
    searchInner = el("div", "searchbar-inner"),
    searchWrap = el("div", "searchbar-input-wrap"),
    search = el("input");
  search.type = "search";
  search.placeholder = "Residue number";
  search.setAttribute("aria-label", "Find resolved residue");
  searchWrap.append(
    search,
    el("i", "searchbar-icon"),
    el("span", "input-clear-button"),
  );
  searchInner.append(searchWrap);
  searchLabel.append(searchInner);
  const residueSearch = app.searchbar.create({
    el: searchLabel,
    customSearch: true,
    inline: true,
    backdrop: false,
  });
  const sequenceCount = el("p", "note"),
    scroll = el("div", "atlas-3d-tools-residues"),
    list = el("div", "list virtual-list");
  scroll.append(list);
  selection.append(
    searchLabel,
    sequenceCount,
    scroll,
    el(
      "p",
      "note",
      "Only deposited Cα residue positions are listed. Missing regions are not reconstructed; source author residue numbering is retained.",
    ),
  );
  let virtualList,
    disposed = false,
    residues = [],
    residueKey = "";
  function updateResidues() {
    if (disposed || !hub.content.isConnected || !list.getClientRects().length)
      return;
    const chain = getChain();
    if (!chain) return;
    const key = chain.label + "|" + search.value.trim();
    if (key === residueKey) {
      virtualList?.update();
      return;
    }
    residueKey = key;
    residues = chain.residues
      .filter(
        (r) =>
          !search.value.trim() ||
          `${r[0]}${r[1]}`.includes(search.value.trim()),
      )
      .map((r) => ({ number: r[0], insertion: r[1] }));
    sequenceCount.textContent = `Chain ${chain.author}: ${residues.length} / ${chain.residues.length} resolved residues shown.`;
    if (virtualList) virtualList.replaceAllItems(residues);
    else
      virtualList = app.virtualList.create({
        el: list,
        scrollableParentEl: scroll,
        items: residues,
        height: 48,
        renderItem: (r) =>
          `<li><button type="button" class="item-content item-link" data-residue-number="${r.number}" data-residue-insertion="${escapeHTML(r.insertion)}" aria-label="Inspect residue ${r.number}${escapeHTML(r.insertion)}"><div class="item-inner"><span class="item-title">Residue ${r.number}${escapeHTML(r.insertion)}</span></div></button></li>`,
      });
  }
  search.oninput = () => {
    residueKey = "";
    updateResidues();
  };
  list.onclick = (e) => {
    const b = e.target.closest("[data-residue-number]");
    if (!b) return;
    const c = getChain();
    getViewer().structureInteractivity({
      elements: {
        label_asym_id: c.label,
        auth_seq_id: Number(b.dataset.residueNumber),
        pdbx_PDB_ins_code: b.dataset.residueInsertion,
      },
      action: ["select", "focus"],
      focusOptions: {
        durationMs: motionDuration(),
        minRadius: 8,
        extraRadius: 4,
      },
    });
    picked.textContent = `Reference residue ${b.dataset.residueNumber}${b.dataset.residueInsertion} · chain ${c.author}. RNA estimates apply to the gene, not this residue.`;
  };
  hub.content.addEventListener("tools:section", () =>
    requestAnimationFrame(updateResidues),
  );
  hub.content.addEventListener("tools:opened", () =>
    requestAnimationFrame(updateResidues),
  );
  const evidence = hub.section("Gene evidence & source", {
    order: 2,
    shortcut: "Gene info",
    icon: "information",
  });
  let evidencePlaceholder;
  function restoreEvidence() {
    if (evidencePlaceholder) {
      evidencePlaceholder.replaceWith(evidenceElement);
      evidencePlaceholder = undefined;
    }
  }
  hub.content.addEventListener("tools:opened", () => {
    if (!evidencePlaceholder) {
      evidencePlaceholder = el("span");
      evidenceElement.before(evidencePlaceholder);
      evidence.prepend(evidenceElement);
    }
  });
  hub.content.addEventListener("tools:closed", restoreEvidence);
  evidence.append(
    el(
      "p",
      "note",
      "PDB 9TI4 · biological assembly 1 · 45 deposited protein chains / 44 mapped genes. Structural coordinates are reference context. RNA effects and uncertainty remain experimental gene-level estimates.",
    ),
  );
  const pdb = el(
    "a",
    "button button-tonal external",
    "PDB source and validation ↗",
  );
  pdb.href = "https://www.rcsb.org/structure/9TI4";
  pdb.target = "_blank";
  pdb.rel = "noopener noreferrer";
  evidence.append(pdb);
  const exportPanel = hub.section("Export", {
    shortcut: "Export",
    icon: "download",
    order: 4,
  });
  hub.action(
    exportPanel,
    "Download molecular structure (.cif)",
    () => downloadURL("9TI4.cif", structureURL),
    "download",
  );
  hub.action(
    exportPanel,
    "Download selected gene RNA data (.csv)",
    () => exportData("selected"),
    "download",
  );
  hub.action(
    exportPanel,
    "Download all mapped RNA data (.csv)",
    () => exportData("all"),
    "download",
  );
  hub.action(
    exportPanel,
    "Download chain mappings & RNA (.json)",
    () => exportData("mapping"),
    "download",
  );
  exportPanel.append(
    el(
      "p",
      "note",
      "The mmCIF file preserves the original deposited coordinates and identifiers. CSV files contain archived RNA estimates once per gene and contrast; JSON includes all chain mappings, resolved residue positions and RNA data. Missing estimates remain missing.",
    ),
  );

  const resolution = field(
    exportPanel,
    "PNG resolution",
    [
      ["viewport", "Current viewport"],
      ["hd", "HD · 1280 × 720"],
      ["full-hd", "Full HD · 1920 × 1080"],
    ],
    () => {},
  );
  const transparent = check(
    exportPanel,
    "Transparent PNG background",
    () => {},
  );
  hub.action(
    exportPanel,
    "Export PNG",
    async () => {
      const helper = plugin().helpers.viewportScreenshot;
      if (!helper)
        throw new Error("Image export is unavailable in this browser.");
      const current = helper.behaviors.values.value;
      helper.behaviors.values.next({
        ...current,
        resolution: { name: resolution.value, params: {} },
        format: { name: "png", params: {} },
        transparent: transparent.checked,
      });
      await helper.download("9TI4-atlas-reference.png");
    },
    "download",
  );
  hub.action(
    exportPanel,
    "Save reproducible MolViewSpec scene",
    saveScene,
    "download",
  );
  const snapshots = hub.section("Saved views & playback", {
    shortcut: "Saved views",
    icon: "play",
    order: 5,
  });
  const snapshotSelect = field(snapshots, "Saved molecular view", [], () => {});
  const playbackStatus = el(
    "p",
    "note",
    "Saved camera views are held for this session. They preserve the current RNA colouring and representation. Playback is not experimental molecular motion.",
  );
  snapshots.append(playbackStatus);
  let snapshotSubscription;
  function syncSnapshots() {
    if (disposed || !getViewer()) return;
    const manager = plugin().managers.snapshot,
      previous = snapshotSelect.value;
    snapshotSelect.replaceChildren();
    manager.state.entries.forEach((entry, i) => {
      const o = el("option", "", entry.name || `View ${i + 1}`);
      o.value = entry.snapshot.id;
      snapshotSelect.append(o);
    });
    if ([...snapshotSelect.options].some((o) => o.value === previous))
      snapshotSelect.value = previous;
    snapshotSelect.dispatchEvent(new Event("change", { bubbles: true }));
    playbackStatus.textContent = `${snapshotSelect.options.length} saved reference views · ${manager.state.isPlaying ? "playback active" : "not playing"}. Playback does not represent biological dynamics.`;
  }
  hub.action(
    snapshots,
    "Capture current molecular view",
    () => {
      const p = plugin(),
        snapshot = p.state.getSnapshot({
          image: false,
          durationInMs: 3000,
          data: false,
          behavior: false,
          structureSelection: false,
          componentManager: false,
          animation: false,
          startAnimation: false,
          canvas3d: false,
          canvas3dContext: false,
          interactivity: false,
          camera: true,
        });
      p.managers.snapshot.add({
        timestamp: Date.now(),
        snapshot,
        name: `Reference view ${p.managers.snapshot.state.entries.size + 1}`,
      });
      syncSnapshots();
    },
    "plus",
  );
  hub.action(
    snapshots,
    "Restore selected view",
    async () => {
      const p = plugin(),
        s = p.managers.snapshot.setCurrent(snapshotSelect.value);
      if (s) await p.state.setSnapshot(s);
    },
    "overview",
  );
  hub.action(
    snapshots,
    "Play / pause saved views",
    () => {
      const p = plugin();
      if (p.managers.snapshot.state.entries.size < 2)
        throw new Error(
          "Capture at least two reference views before playback.",
        );
      return p.managers.snapshot.togglePlay();
    },
    "play",
  );
  hub.action(
    snapshots,
    "Remove selected saved view",
    () => {
      plugin().managers.snapshot.remove(snapshotSelect.value);
      syncSnapshots();
    },
    "minus",
  );
  hub.action(
    snapshots,
    "Export molecular session",
    async () => {
      const blob = await plugin().managers.snapshot.serialize({ type: "molx" });
      await downloadFile("9TI4-atlas-session.molx", blob, "application/zip");
    },
    "download",
  );
  function ready() {
    if (disposed) return;
    syncSnapshots();
    snapshotSubscription?.unsubscribe();
    snapshotSubscription =
      plugin().managers.snapshot.events.changed.subscribe(syncSnapshots);
  }
  function motionDuration() {
    return matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 500;
  }
  return {
    hub,
    ready,
    sync() {
      residueKey = "";
      updateResidues();
    },
    showPicked(text) {
      picked.textContent = text;
    },
    dispose() {
      disposed = true;
      restoreEvidence();
      virtualList?.destroy();
      residueSearch.destroy();
      snapshotSubscription?.unsubscribe();
      hub.dispose();
    },
  };
}
