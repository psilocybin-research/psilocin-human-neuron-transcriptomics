import { FileAttachment } from "observablehq:stdlib";
import { createElement as el, createAccordion, destroySheet, closeSheet } from "./interface-utils.js";
import { color, fmt, sci } from "./format.js";
import { uiIcon } from "./icons.js";
let active;

import { backboneSegments } from "./assembly-geometry.js";
export async function openComplexIPilot({ genes, onGene }) {
  const root = document.querySelector("#psilocin-app"), app = root?.f7;
  if (!app) return;
  active?.close(false);
  const sheet = el("section", "sheet-modal research-evidence-sheet complex-i-sheet");
  sheet.setAttribute("aria-label", "Human complex I · reference assembly");
  const header = el("header", "evidence-sheet-header"), done = el("button", "button button-tonal", "Done");
  done.type = "button";
  header.append(el("h2", "", "Complex I · reference assembly"), done);
  const handle = el("div", "sheet-handle"), content = el("div", "sheet-modal-inner evidence-sheet-content");
  const controls = el("div", "complex-i-controls"), days = el("div", "segmented segmented-strong");
  days.setAttribute("role", "group"); days.setAttribute("aria-label", "Structure RNA overlay contrast");
  let contrast = 0, selected, api, scene, camera, renderer, orbit, meshes = [], resources = [], disposed = false, renderPending = 0;
  let snapshot;
  const stage = el("div", "complex-i-stage");
  stage.tabIndex = 0;
  stage.setAttribute("role", "region");
  stage.setAttribute("aria-label", "Human complex I C-alpha backbone. Drag to rotate; pinch or scroll to zoom. Select chains using the list below.");
  const status = el("p", "note", "Loading the local reference assembly…"), selection = el("div", "complex-i-selection");
  const chooser = el("select"); chooser.setAttribute("aria-label", "Select complex I subunit");
  const chooserLabel = el("label", "complex-i-chooser"); chooserLabel.append(el("span", "", "Subunit"), chooser);
  const legend = el("p", "note complex-i-legend", "RNA log₂FC: blue −2.5 · white 0 · orange +2.5; clipped at ±2.5. Grey: no unique estimable mapping. Gold: selected subunit.");
  const dayButtons = [1, 3].map((day, index) => {
    const button = el("button", `button${index === 0 ? " button-active" : ""}`, `Day ${day}`);
    button.type = "button"; button.setAttribute("aria-pressed", String(index === 0));
    button.onclick = () => { contrast = index; dayButtons.forEach((b, i) => { b.classList.toggle("button-active", i === index); b.setAttribute("aria-pressed", String(i === index)); }); paint(); if (selected) showChain(selected); };
    days.append(button); return button;
  });
  const reset = el("button", "button button-tonal", "Reset view"); reset.type = "button";
  reset.onclick = () => fit(); controls.append(days, reset);
  content.append(el("p", "note", "RNA estimates on an external human structure · PDB 9TI4, assembly 1. Protein abundance, conformation and respiratory activity were not measured in this experiment."), controls, stage, status, legend, chooserLabel, selection);
  sheet.append(handle, header, content); root.append(sheet);
  function render() {
    if (disposed || renderPending) return;
    renderPending = requestAnimationFrame(() => { renderPending = 0; if (!disposed && renderer) renderer.render(scene, camera); });
  }
  function fit() {
    if (!camera || !orbit) return;
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    const angle = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, aspect));
    camera.position.set(0, 0, 150 / Math.sin(angle));
    orbit.target.set(0, 0, 0); orbit.update(); render();
  }
  function geneFor(chain) {
    const ids = [...new Set(chain.mappings.flatMap((m) => m.archivedIds))];
    return ids.length === 1 ? genes.find((g) => g.id === ids[0]) : null;
  }
  function paint() {
    for (const mesh of meshes) {
      const chain = mesh.userData.chain, gene = geneFor(chain), effect = gene?.effects[contrast];
      mesh.material.color.set(chain === selected ? "#e7ae35" : color(effect?.log2FoldChange, 2.5));
    }
    render();
  }
  function showChain(chain) {
    selected = chain; chooser.value = chain.label; selection.replaceChildren();
    const gene = geneFor(chain), mapping = chain.mappings[0];
    const card = createAccordion(gene ? `${gene.symbol} · chain ${chain.author}` : `Chain ${chain.author} · ${mapping.uniprot}`, "complex-i-gene-card");
    // The short identity and selected-contrast evidence stay visible; detail expands below.
    const identity = el("p", "complex-i-selected-summary", gene ? `${gene.symbol} · Day ${contrast ? 3 : 1}: log₂FC ${fmt(gene.effects[contrast]?.log2FoldChange)} · gene FDR ${sci(gene.effects[contrast]?.padj)}` : "No unique archived gene mapping");
    const actions = el("div", "segmented segmented-strong complex-i-gene-actions");
    if (gene) {
      for (const [icon, label, callback] of [
        ["custom-r", `Send ${gene.symbol} to R Studio`, () => root.dispatchEvent(new CustomEvent("atlas:send-gene-to-r", {detail:{gene:gene.id}}))],
        ["genes", `Open ${gene.symbol} evidence`, () => onGene(gene)],
      ]) {
        const button = el("button", "button"); button.type = "button"; button.setAttribute("aria-label", label); button.title = label; button.append(uiIcon(icon));
        button.onclick = () => { instance.once("closed", callback); closeSheet(instance); }; actions.append(button);
      }
      card.body.append(el("p", "identifier", gene.id));
      gene.effects.forEach((effect, index) => {
        const valid = Number.isFinite(effect.log2FoldChange) && Number.isFinite(effect.lfcSE);
        card.body.append(el("p", "note", `${["Day 1 / common control", "Day 3 / common control", "Treated Day 3 / Day 1"][index]}: log₂FC ${fmt(effect.log2FoldChange)} · approximate 95% Wald interval ${valid ? `${fmt(effect.log2FoldChange - 1.96 * effect.lfcSE)} to ${fmt(effect.log2FoldChange + 1.96 * effect.lfcSE)}` : "not estimable"} · gene FDR ${sci(effect.padj)}`));
      });
    }
    card.body.append(el("p", "note", `SIFTS: ${mapping.uniprot}; UniProt residues ${mapping.uniprotRange.join("–")}; identity ${fmt(mapping.identity * 100, 1)}%; sequence coverage ${fmt(mapping.coverage * 100, 1)}%. Author chain ${chain.author}; label chain ${chain.label}. Copies of a subunit share one gene estimate; they are not separate observations.`));
    selection.append(identity, actions, card.element); paint();
  }
  const instance = app.sheet.create({el:sheet, backdrop:true, closeByBackdropClick:true, swipeToClose:true, swipeHandler:handle, push:true,
    on:{closed() {
      disposed = true; cancelAnimationFrame(renderPending); observer.disconnect(); orbit?.dispose();
      for (const resource of resources) resource.dispose();
      renderer?.dispose(); renderer?.forceContextLoss();
      if (active === instance) active = undefined;
      setTimeout(() => { destroySheet(instance); sheet.remove(); }, 0);
    }},
  });
  active = instance; done.onclick = () => closeSheet(instance);
  const observer = new ResizeObserver(() => {
    if (!renderer || disposed) return;
    renderer.setSize(stage.clientWidth, stage.clientHeight); camera.aspect = stage.clientWidth / Math.max(stage.clientHeight, 1); camera.updateProjectionMatrix(); render();
  });
  instance.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  try {
    [snapshot, api] = await Promise.all([FileAttachment("../assets/mitochondria/complex-i.json").json(), import("../assets/vendor/network-3d.js")]);
    if (disposed) return;
    scene = new api.Scene(); scene.background = new api.Color("#081521");
    camera = new api.PerspectiveCamera(40, stage.clientWidth / Math.max(stage.clientHeight, 1), 0.1, 5000);
    renderer = new api.WebGLRenderer({antialias:true,alpha:false}); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(stage.clientWidth, stage.clientHeight); stage.append(renderer.domElement);
    orbit = new api.OrbitControls(camera, renderer.domElement); orbit.enableDamping = false; orbit.addEventListener("change", render);
    const all = snapshot.chains.flatMap((chain) => chain.residues);
    const bounds = [0, 1, 2].map((axis) => [Math.min(...all.map((r) => r[axis + 2])), Math.max(...all.map((r) => r[axis + 2]))]);
    const centre = bounds.map(([lo, hi]) => (lo + hi) / 2), scale = 200 / Math.max(...bounds.map(([lo, hi]) => hi - lo));
    const geometry = new api.CylinderGeometry(1, 1, 1, 6); resources.push(geometry);
    const up = new api.Vector3(0, 1, 0), matrix = new api.Matrix4(), quaternion = new api.Quaternion();
    for (const chain of snapshot.chains) {
      const segments = backboneSegments(chain.residues), material = new api.MeshStandardMaterial({roughness:0.7,metalness:0});
      const mesh = new api.InstancedMesh(geometry, material, segments.length); resources.push(material, mesh); mesh.userData.chain = chain;
      segments.forEach(([a, b], index) => {
        const start = new api.Vector3(...a.map((v, j) => (v - centre[j]) * scale)), end = new api.Vector3(...b.map((v, j) => (v - centre[j]) * scale));
        const delta = end.clone().sub(start); quaternion.setFromUnitVectors(up, delta.clone().normalize());
        matrix.compose(start.add(end).multiplyScalar(0.5), quaternion, new api.Vector3(0.35, delta.length(), 0.35)); mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true; scene.add(mesh); meshes.push(mesh);
      const gene = geneFor(chain), option = el("option", "", `${gene?.symbol || chain.mappings[0].uniprot} · chain ${chain.author}`); option.value = chain.label; chooser.append(option);
    }
    scene.add(new api.AmbientLight(0xffffff, 1.8)); const light = new api.DirectionalLight(0xffffff, 2); light.position.set(100, 180, 300); scene.add(light);
    const raycaster = new api.Raycaster(); let press;
    renderer.domElement.addEventListener("pointerdown", (event) => {press = [event.clientX, event.clientY];});
    renderer.domElement.addEventListener("pointerup", (event) => {
      if (!press || Math.hypot(event.clientX - press[0], event.clientY - press[1]) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect(); raycaster.setFromCamera(new api.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const match = raycaster.intersectObjects(meshes)[0]; if (match) showChain(match.object.userData.chain);
    });
    chooser.onchange = () => showChain(snapshot.chains.find((c) => c.label === chooser.value));
    const mapped = snapshot.chains.filter((c) => geneFor(c));
    status.textContent = `${mapped.length} / ${snapshot.chains.length} deposited chains map uniquely to archived genes; ${new Set(mapped.map((c) => geneFor(c).id)).size} distinct genes. Cα backbone trace; missing residues are not reconstructed.`;
    const source = el("a", "external", "PDB 9TI4 source, authors and structure validation ↗"); source.href = snapshot.metadata.structureSource; source.target = "_blank"; source.rel = "noopener noreferrer";
    content.append(source, el("p", "note", `Coordinates and SIFTS mappings retrieved ${snapshot.metadata.retrievedAt}. ${snapshot.metadata.representation}`));
    observer.observe(stage); fit(); paint(); showChain(snapshot.chains[0]);
  } catch (error) {
    if (!disposed) { status.textContent = "The local 3D pilot could not open. The gene table and archived estimates remain available."; const link = el("a", "external", "Open the PDB reference structure ↗"); link.href = "https://www.rcsb.org/structure/9TI4"; link.target = "_blank"; link.rel = "noopener noreferrer"; stage.replaceChildren(link); }
  }
}
