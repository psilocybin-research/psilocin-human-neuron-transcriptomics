import { uiIcon } from "./icons.js";
import { contrasts } from "./format.js";
import {
  createElement as el,
  loadingMessage,
  createAccordion,
} from "./interface-utils.js";
import { geneStructurePreview } from "./structure-preview.js";
import { localResource, cachedContextFile } from "./local-public-context.js";
import { publicRequest } from "./protein-data.js";
import { createSceneBackbone } from "./network-molecule.js";

// Structural context is a separate scene object, never a membership node or edge.
export function createNodeProtein({ api, root, graphs }) {
  let generation = 0,
    model,
    gene,
    atoms,
    mini,
    miniRenderer,
    miniScene,
    miniCamera,
    frame,
    overlay,
    overlayFrame;
  let previousTime = 0,
    appearanceTime = 0,
    hovered = false,
    disposed = false,
    previewPosition,
    previewSide,
    placementChangedAt = 0,
    evidenceExpanded = false;
  const caption = el("div", "network-node-protein-caption");
  caption.hidden = true;
  const leader = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  leader.classList.add("network-protein-leader");
  leader.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(leader.namespaceURI, "path");
  leader.append(line);
  leader.hidden = true;
  root.append(leader, caption);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const projected = new api.Vector3();
  const unlisten = [];
  function listen(target, event, handler) {
    target.addEventListener(event, handler, true);
    unlisten.push(() => target.removeEventListener(event, handler, true));
  }
  function closeOverlay(immediate = false) {
    if (!overlay) return;
    const current = overlay;
    overlay = undefined;
    cancelAnimationFrame(overlayFrame);
    const finish = () => {
      current.renderer.dispose();
      current.renderer.forceContextLoss();
      current.controls.dispose();
      current.backbone.dispose();
      current.resize.disconnect();
      current.inertStates.forEach(([element, value]) => {
        element.inert = value;
      });
      current.host.remove();
      current.returnFocus?.focus();
    };
    if (immediate || reduced()) finish();
    else
      current.host
        .animate(
          [
            { transform: "translate(0,0) scale(1)", opacity: 1 },
            { transform: current.origin, opacity: 0 },
          ],
          { duration: 380, easing: "cubic-bezier(.4,0,.2,1)" },
        )
        .finished.then(finish);
    root.dataset.structureOverlay = "false";
  }
  function clear() {
    ++generation;
    closeOverlay(true);
    cancelAnimationFrame(frame);
    if (mini) {
      mini.dispose();
    }
    miniRenderer?.dispose();
    miniRenderer?.forceContextLoss();
    miniRenderer = undefined;
    mini = undefined;
    previewPosition = undefined;
    previewSide = undefined;
    placementChangedAt = 0;
    caption.hidden = true;
    leader.style.display = "none";
    caption.replaceChildren();
    root.dataset.nodeProteinReady = "false";
  }
  function expand() {
    if (!mini || overlay || disposed) return;
    const host = el("section", "network-protein-overlay");
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    host.setAttribute("aria-label", `${gene.symbol} molecular structure`);
    const heading = el("header", "network-protein-overlay-header");
    heading.append(
      el("strong", "", `${gene.symbol} · ${model.provider} ${model.model}`),
    );
    const close = el("button", "button button-tonal molecular-overlay-close");
    close.append(uiIcon("close"));
    close.setAttribute("aria-label", "Close structure");
    close.type = "button";
    close.onclick = () => closeOverlay();
    heading.append(close);
    const surface = el("div", "network-protein-overlay-surface");
    const note = el(
      "p",
      "network-protein-overlay-note",
      `${model.scope} Cα backbone trace; not measured by this RNA-seq experiment. Drag to rotate; pinch or scroll to zoom.`,
    );
    const evidence = createAccordion(
      "Gene statistics · archived RNA-seq",
      "network-protein-statistics",
    );
    const evidenceItem = evidence.element.querySelector(".accordion-item");
    evidenceItem.addEventListener("accordion:open", () => {
      evidenceExpanded = true;
    });
    evidenceItem.addEventListener("accordion:close", () => {
      evidenceExpanded = false;
    });
    const table = el("table");
    const header = el("tr");
    for (const title of ["Contrast", "log₂FC", "95% Wald interval", "Gene FDR"])
      header.append(el("th", "", title));
    const head = el("thead");
    head.append(header);
    table.append(head);
    const body = el("tbody");
    const numeric = (x) =>
      Number.isFinite(x) ? x.toPrecision(4) : "Not estimable";
    gene.effects.forEach((effect, index) => {
      const row = el("tr");
      const interval =
        Number.isFinite(effect?.log2FoldChange) &&
        Number.isFinite(effect?.lfcSE)
          ? `${numeric(effect.log2FoldChange - 1.96 * effect.lfcSE)} to ${numeric(effect.log2FoldChange + 1.96 * effect.lfcSE)}`
          : "Not estimable";
      for (const value of [
        Object.values(contrasts)[index],
        numeric(effect?.log2FoldChange),
        interval,
        numeric(effect?.padj),
      ])
        row.append(el("td", "", value));
      body.append(row);
    });
    table.append(body);
    const scroll = el("div", "table-scroll");
    scroll.append(table);
    evidence.body.append(
      scroll,
      el(
        "p",
        "note",
        "Approximate 95% Wald intervals: log₂FC ± 1.96 SE. Gene FDR is the archived transcriptome-wide correction. Day/control differences do not establish a treatment-by-time interaction. Protein structure is external context, not a measured molecular change.",
      ),
    );
    host.append(surface, heading, note, evidence.element);
    root.append(host);
    if (evidenceExpanded)
      root.closest("#psilocin-app")?.f7?.accordion.open(evidenceItem, false);
    const inertStates = [...root.children]
      .filter((element) => element !== host)
      .map((element) => [element, element.inert]);
    inertStates.forEach(([element]) => {
      element.inert = true;
    });
    let renderer;
    try {
      renderer = new api.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      inertStates.forEach(([element, value]) => {
        element.inert = value;
      });
      host.remove();
      caption.append(
        el(
          "small",
          "",
          "This device cannot open another WebGL view. The preview remains available.",
        ),
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    surface.append(renderer.domElement);
    const scene = new api.Scene(),
      camera = new api.PerspectiveCamera(42, 1, 0.1, 10000);
    const backbone = createSceneBackbone(api, atoms, {
      predicted: model.provider === "AlphaFold",
    });
    scene.add(backbone.group);
    const controls = new api.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const fit = () => {
      const w = Math.max(1, surface.clientWidth),
        h = Math.max(1, surface.clientHeight);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    fit();
    camera.position.z = Math.max(
      380,
      300 / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect),
    );
    const resize = new ResizeObserver(fit);
    resize.observe(surface);
    overlay = {
      host,
      renderer,
      controls,
      backbone,
      resize,
      returnFocus: document.activeElement,
      inertStates,
      origin: `translate(${caption.offsetLeft}px,${caption.offsetTop}px) scale(0.18)`,
    };
    const draw = () => {
      if (!overlay || overlay.host !== host || disposed) return;
      if (!document.hidden) {
        controls.update();
        renderer.render(scene, camera);
      }
      overlayFrame = requestAnimationFrame(draw);
    };
    draw();
    if (!reduced()) {
      const bounds = caption.getBoundingClientRect(),
        parent = root.getBoundingClientRect();
      host.animate(
        [
          {
            transform: `translate(${bounds.left - parent.left}px,${bounds.top - parent.top - 70}px) scale(0.16)`,
            opacity: 0.25,
          },
          { transform: "translate(0,0) scale(1)", opacity: 1 },
        ],
        {
          duration: 480,
          easing: "cubic-bezier(.22,1,.36,1)",
          transformOrigin: "0 0",
        },
      );
    }
    root.dataset.structureOverlay = "true";
    close.focus({ preventScroll: true });
  }
  function draw(time) {
    if (disposed || !mini) return;
    const [left] = graphs();
    const node = left?.graphData().nodes.find((n) => n.id === gene.id);
    if (!node) return;
    const dt = Math.min(50, time - (previousTime || time));
    previousTime = time;
    if (!document.hidden) {
      const camera = left.camera();
      const bounds = left.renderer().domElement.getBoundingClientRect(),
        parent = root.getBoundingClientRect();
      projected.set(node.x, node.y, node.z).project(camera);
      const nodeX =
        bounds.left - parent.left + ((projected.x + 1) * bounds.width) / 2;
      const nodeY =
        bounds.top - parent.top + ((1 - projected.y) * bounds.height) / 2;
      const width = 154,
        height = caption.offsetHeight || 142;
      const obstacles = [
        ...root.querySelectorAll(
          ".oxphos-3d-topbar,.oxphos-3d-camera,.oxphos-3d-evidence-actions,.oxphos-3d-dock,.oxphos-3d-evidence,.oxphos-mobile-inspector,.oxphos-mobile-toolbar",
        ),
      ]
        .filter((element) => !element.hidden && element.getClientRects().length)
        .map((element) => {
          const b = element.getBoundingClientRect();
          return {
            left: b.left - parent.left - 8,
            top: b.top - parent.top - 8,
            right: b.right - parent.left + 8,
            bottom: b.bottom - parent.top + 8,
          };
        });
      const clamp = (x, y) => ({
        x: Math.max(8, Math.min(parent.width - width - 8, x)),
        y: Math.max(85, Math.min(parent.height - height - 12, y)),
      });
      const candidates = [
        clamp(nodeX + 30, nodeY - height / 2),
        clamp(nodeX - width - 30, nodeY - height / 2),
        clamp(nodeX - width / 2, nodeY - height - 30),
        clamp(nodeX - width / 2, nodeY + 30),
      ];
      const overlap = (p, b) =>
        Math.max(0, Math.min(p.x + width, b.right) - Math.max(p.x, b.left)) *
        Math.max(0, Math.min(p.y + height, b.bottom) - Math.max(p.y, b.top));
      const nodeBounds = {
        left: nodeX - 18,
        right: nodeX + 18,
        top: nodeY - 18,
        bottom: nodeY + 18,
      };
      const score = (p) =>
        obstacles.reduce((sum, b) => sum + overlap(p, b) * 100, 0) +
        overlap(p, nodeBounds) * 200 +
        Math.hypot(p.x + width / 2 - nodeX, p.y + height / 2 - nodeY);
      const scores = candidates.map(score);
      const best = scores.indexOf(Math.min(...scores));
      // Retain the anchor through camera and sheet animation. Switch only when
      // a materially better placement remains available after the cooldown.
      if (previewSide === undefined ||
          (time - placementChangedAt > 700 &&
           scores[previewSide] - scores[best] > Math.max(80, scores[previewSide] * 0.25))) {
        previewSide = best;
        placementChangedAt = time;
      }
      const desired = candidates[previewSide];
      const blend = reduced() || !previewPosition ? 1 : 1 - Math.exp(-dt / 100);
      previewPosition = {
        x:
          (previewPosition?.x ?? desired.x) +
          (desired.x - (previewPosition?.x ?? desired.x)) * blend,
        y:
          (previewPosition?.y ?? desired.y) +
          (desired.y - (previewPosition?.y ?? desired.y)) * blend,
      };
      const { x, y } = previewPosition;
      const entry = reduced() ? 1 : Math.min(1, (time - appearanceTime) / 500);
      const targetScale = (hovered ? 1.07 : 1) * (1 - Math.pow(1 - entry, 3));
      const scale = reduced()
        ? targetScale
        : mini.group.scale.x +
          (targetScale - mini.group.scale.x) * (1 - Math.exp(-dt / 90));
      mini.group.scale.setScalar(scale);
      if (!reduced() && !overlay) mini.group.rotation.y += dt * 0.00018;
      mini.group.visible =
        !overlay &&
        root.dataset.molecularView !== "true" &&
        left.nodeVisibility()(node);
      const pictureHeight = 84;
      if (
        miniRenderer.domElement.width !==
        Math.round(width * miniRenderer.getPixelRatio())
      ) {
        miniRenderer.setSize(width, pictureHeight);
      }
      miniCamera.aspect = width / pictureHeight;
      miniCamera.position.z =
        (220 * pictureHeight) /
        (2 * Math.tan((miniCamera.fov * Math.PI) / 360) * 82);
      miniCamera.updateProjectionMatrix();
      if (mini.group.visible) miniRenderer.render(miniScene, miniCamera);
      caption.style.left = `${x}px`;
      caption.style.top = `${y}px`;
      caption.hidden =
        !mini.group.visible ||
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1 ||
        projected.z > 1;
      leader.style.display = caption.hidden ? "none" : "block";
      leader.setAttribute("viewBox", `0 0 ${parent.width} ${parent.height}`);
      const endX = Math.max(x, Math.min(x + width, nodeX));
      const endY = Math.max(y, Math.min(y + height, nodeY));
      line.setAttribute(
        "d",
        `M${nodeX},${nodeY} Q${nodeX},${endY} ${endX},${endY}`,
      );
    }
    frame = requestAnimationFrame(draw);
  }
  let outsidePress;
  function insidePreview(event) {
    const bounds = caption.getBoundingClientRect();
    return (
      caption.contains(event.target) ||
      (event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom)
    );
  }
  listen(document, "pointerdown", (event) => {
    outsidePress =
      !event.target.closest?.(
        ".oxphos-3d-drawer,.oxphos-3d-evidence,.oxphos-mobile-inspector,.oxphos-mobile-toolbar,.dialog,.popover",
      ) &&
      !overlay &&
      !caption.hidden &&
      !insidePreview(event)
        ? { x: event.clientX, y: event.clientY, id: event.pointerId }
        : undefined;
  });
  listen(document, "pointerup", (event) => {
    const press = outsidePress;
    outsidePress = undefined;
    if (
      press &&
      !overlay &&
      event.pointerId === press.id &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6 &&
      !insidePreview(event)
    )
      clear();
  });
  listen(document, "pointercancel", () => {
    outsidePress = undefined;
  });
  listen(root, "keydown", (event) => {
    if (event.key === "Tab" && overlay) {
      const items = [
        ...overlay.host.querySelectorAll("button, a[href], input, select"),
      ].filter((item) => !item.disabled);
      const index = items.indexOf(document.activeElement);
      if (
        (!event.shiftKey && index === items.length - 1) ||
        (event.shiftKey && index <= 0)
      ) {
        event.preventDefault();
        items[event.shiftKey ? items.length - 1 : 0]?.focus();
      }
    }
    if (event.key === "Escape" && !overlay && !caption.hidden) {
      clear();
      return;
    }
    if (event.key === "Escape" && overlay) {
      event.stopImmediatePropagation();
      closeOverlay();
    }
  });
  return {
    async show(nextGene) {
      clear();
      gene = nextGene;
      model = geneStructurePreview(gene);
      if (!model) return;
      const request = generation;
      caption.hidden = false;
      caption.style.left = "12px";
      caption.style.top = "150px";
      caption.replaceChildren(
        loadingMessage(`Loading ${gene.symbol} structure…`),
      );
      try {
        const resource = await localResource(model.coordinateSource);
        if (
          !resource ||
          (!navigator.onLine && !(await cachedContextFile(resource.path)))
        )
          throw new Error(
            "Structure not saved offline. Reconnect to load this model.",
          );
        const [{ GLModel }, coordinates] = await Promise.all([
          import("../assets/vendor/3dmol.js"),
          publicRequest(model.coordinateSource, {
            text: true,
            authorize: () => {
              throw new Error(
                "Only hosted coordinate snapshots can be opened here.",
              );
            },
          }),
        ]);
        if (disposed || request !== generation) return;
        const parsed = new GLModel(0);
        parsed.addMolData(coordinates.value, "cif");
        atoms = parsed
          .selectedAtoms(model.chains?.length ? { chain: model.chains } : {})
          .filter((a) => a.atom === "CA");
        mini = createSceneBackbone(api, atoms, {
          predicted: model.provider === "AlphaFold",
        });
        mini.group.scale.setScalar(reduced() ? 0.29 : 0.0001);
        miniScene = new api.Scene();

        miniScene.add(mini.group);
        miniCamera = new api.PerspectiveCamera(42, 1, 0.1, 10000);
        miniRenderer = new api.WebGLRenderer({ antialias: true, alpha: true });
        miniRenderer.setClearColor(0x000000, 0);
        miniRenderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
        const picture = el("button", "network-protein-callout-picture");
        picture.type = "button";
        picture.setAttribute(
          "aria-label",
          `Expand molecular preview for ${gene.symbol}`,
        );
        picture.append(miniRenderer.domElement);
        picture.onclick = expand;
        picture.onpointerenter = () => {
          hovered = true;
        };
        picture.onpointerleave = () => {
          hovered = false;
        };
        picture.onfocus = () => {
          hovered = true;
        };
        picture.onblur = () => {
          hovered = false;
        };
        const open = el(
          "button",
          "network-node-protein-open",
          "View structure ↗",
        );
        open.type = "button";
        open.setAttribute("aria-label", `Expand structure for ${gene.symbol}`);
        open.onclick = expand;
        caption.replaceChildren(
          el(
            "strong",
            "network-protein-callout-title",
            `${gene.symbol} · ${model.provider}`,
          ),
          picture,
          open,
          el("small", "", `${model.model} · Cα trace`),
        );
        appearanceTime = performance.now();
        previousTime = 0;
        root.dataset.nodeProteinReady = "true";
        frame = requestAnimationFrame(draw);
      } catch (error) {
        if (!disposed && request === generation)
          caption.replaceChildren(el("small", "", error.message));
      }
    },
    clear,
    dispose() {
      disposed = true;
      clear();
      unlisten.forEach((fn) => fn());
      caption.remove();
      leader.remove();
    },
  };
}
