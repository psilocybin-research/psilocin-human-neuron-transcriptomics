import { createElement as el, loadingMessage } from "./interface-utils.js";
import { geneStructurePreview } from "./structure-preview.js";
import { localResource, cachedContextFile } from "./local-public-context.js";
import { publicRequest } from "./protein-data.js";
import { createSceneBackbone } from "./network-molecule.js";

// Structural context is a separate scene object, never a membership node or edge.
export function createNodeProtein({ api, root, stage, graphs }) {
  let generation = 0,
    model,
    gene,
    atoms,
    mini,
    twin,
    frame,
    overlay,
    overlayFrame;
  let previousTime = 0,
    appearanceTime = 0,
    hovered = false,
    disposed = false;
  const caption = el("div", "network-node-protein-caption");
  caption.hidden = true;
  root.append(caption);
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ray = new api.Raycaster(),
    pointer = new api.Vector2();
  const projected = new api.Vector3(),
    offset = new api.Vector3();
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
    current.renderer.dispose();
    current.renderer.forceContextLoss();
    current.controls.dispose();
    current.backbone.dispose();
    current.resize.disconnect();
    const finish = () => {
      current.inertStates.forEach(([element, value]) => {
        element.inert = value;
      });
      current.host.remove();
      current.returnFocus?.focus();
    };
    if (immediate || reduced()) finish();
    else
      current.host
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 })
        .finished.then(finish);
    root.dataset.structureOverlay = "false";
  }
  function clear() {
    ++generation;
    closeOverlay(true);
    cancelAnimationFrame(frame);
    const [left, right] = graphs();
    if (mini) {
      left?.scene().remove(mini.group);
      mini.dispose();
    }
    if (twin) {
      right?.scene().remove(twin);
      twin.traverse((object) => {
        if (object.isInstancedMesh) object.dispose();
      });
    }
    mini = twin = undefined;
    caption.hidden = true;
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
    const close = el("button", "button button-tonal", "Close structure");
    close.type = "button";
    close.onclick = () => closeOverlay();
    heading.append(close);
    const surface = el("div", "network-protein-overlay-surface");
    const note = el(
      "p",
      "network-protein-overlay-note",
      `${model.scope} Cα backbone trace; not measured by this RNA-seq experiment. Drag to rotate; pinch or scroll to zoom.`,
    );
    host.append(surface, heading, note);
    root.append(host);
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
    const [left, right] = graphs();
    const node = left?.graphData().nodes.find((n) => n.id === gene.id);
    if (!node) return;
    const dt = Math.min(50, time - (previousTime || time));
    previousTime = time;
    if (!document.hidden) {
      offset.set(65, 16, 0).applyQuaternion(left.camera().quaternion);
      mini.group.position.set(node.x, node.y, node.z).add(offset);
      const entry = reduced() ? 1 : Math.min(1, (time - appearanceTime) / 500);
      const targetScale =
        (hovered ? 0.32 : 0.29) * (1 - Math.pow(1 - entry, 3));
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
      if (right && !twin) {
        twin = mini.group.clone(true);
        right.scene().add(twin);
      }
      if (!right) twin = undefined;
      if (twin) {
        twin.position.copy(mini.group.position);
        twin.rotation.copy(mini.group.rotation);
        twin.scale.copy(mini.group.scale);
        twin.visible = mini.group.visible;
      }
      projected.copy(mini.group.position).project(left.camera());
      const bounds = left.renderer().domElement.getBoundingClientRect(),
        parent = root.getBoundingClientRect();
      const x =
        bounds.left - parent.left + ((projected.x + 1) * bounds.width) / 2;
      const y =
        bounds.top - parent.top + ((1 - projected.y) * bounds.height) / 2 + 35;
      caption.style.left = `${Math.max(8, Math.min(parent.width - 212, x - 100))}px`;
      caption.style.top = `${Math.max(90, Math.min(parent.height - 230, y))}px`;
      caption.hidden =
        !mini.group.visible ||
        Math.abs(projected.x) > 1 ||
        Math.abs(projected.y) > 1 ||
        projected.z > 1;
    }
    frame = requestAnimationFrame(draw);
  }
  function hit(event) {
    if (!mini || overlay) return false;
    for (const [index, graph] of graphs().entries()) {
      if (!graph) continue;
      const bounds = graph.renderer().domElement.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      )
        continue;
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, graph.camera());
      const object = index ? twin : mini.group;
      if (object?.visible && ray.intersectObject(object, true).length)
        return true;
    }
    return false;
  }
  let down;
  listen(stage, "pointerdown", (event) => {
    down = [event.clientX, event.clientY];
  });
  listen(stage, "pointerleave", () => {
    hovered = false;
  });
  listen(stage, "pointermove", (event) => {
    hovered = hit(event);
    if (hovered) stage.style.cursor = "pointer";
  });
  listen(stage, "click", (event) => {
    if (
      down &&
      Math.hypot(event.clientX - down[0], event.clientY - down[1]) < 6 &&
      hit(event)
    ) {
      event.stopImmediatePropagation();
      event.preventDefault();
      expand();
    }
  });
  listen(root, "keydown", (event) => {
    if (event.key === "Tab" && overlay) {
      event.preventDefault();
      overlay.host.querySelector("button")?.focus();
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
        graphs()[0].scene().add(mini.group);
        const open = el(
          "button",
          "network-node-protein-open",
          `${gene.symbol} · View structure ↗`,
        );
        open.type = "button";
        open.setAttribute("aria-label", `Expand structure for ${gene.symbol}`);
        open.onclick = expand;
        caption.replaceChildren(
          open,
          el("small", "", `${model.provider} · ${model.model} · Cα trace`),
          el(
            "small",
            "",
            model.provider === "AlphaFold"
              ? "Colour: local pLDDT; predicted context"
              : "Colour: sequence; deposited context",
          ),
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
    },
  };
}
