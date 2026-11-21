import {createVisualizationTools} from './visualization-tools.js';
import { createElement as el, loadingMessage } from "./interface-utils.js";
const url = (name) =>
  new URL(`molecular/${name}`, new URL("./", document.baseURI)).href;
export function createMitochondrialSpatialContext({ onComplex }) {
  const root = el("section", "mitochondrial-spatial-context"),
    stage = el("div", "molecular-stage"),
    status = loadingMessage("Loading illustrative membrane…"),
    buttons = el("div", "segmented segmented-strong molecular-complex-buttons");
  root.append(
    el("h3", "", "Respiratory-chain spatial context"),
    el(
      "p",
      "note",
      "Illustrative Blender geometry: shapes and positions are schematic, not deposited molecular coordinates or measured neuronal anatomy. No flux or ATP-production changes are depicted.",
    ),
    buttons,
    stage,
    status,
  );
  let disposed = false,
    started = false,
    renderer,
    scene,
    orbit,
    observer,
    frame = 0,
    api,
    meshes = [];
  function render() {
    if (disposed || frame || !renderer) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!disposed) renderer.render(scene, camera);
    });
  }
  let camera;
  const sharedTools=createVisualizationTools({surface:stage,title:'3D spatial tools',fullscreenControl:true,fullscreenTitle:'Respiratory-chain spatial context',onResize:()=>window.dispatchEvent(new Event('resize'))});
  const viewTools=sharedTools.section('View & camera',{open:true});
  sharedTools.action(viewTools,'Fullscreen / return',()=>sharedTools.toggleFullscreen(),'fullscreen');
  sharedTools.action(viewTools,'Reset spatial view',()=>{if(camera&&orbit){camera.position.set(0,10,23);orbit.target.set(0,.8,0);orbit.update();render();}},'overview');
  const complexTools=sharedTools.section('Respiratory complexes');
  for(const id of ['I','II','III','IV','V'])sharedTools.action(complexTools,`Inspect complex ${id}`,()=>{sharedTools.close();select(id);},'pathways');
  function select(id) {
    for (const mesh of meshes)
      mesh.material.emissive.set(
        mesh.name.split("_")[1] === id ? "#294d66" : "#000000",
      );
    for (const b of buttons.children) {
      b.classList.toggle("button-active", b.dataset.complex === id);
      b.setAttribute("aria-pressed", String(b.dataset.complex === id));
    }
    status.textContent = `Complex ${id} · schematic reference context. Complete membership and pathway evidence are linked below.`;
    onComplex(id);
    render();
  }
  for (const id of ["I", "II", "III", "IV", "V"]) {
    const b = el("button", "button", id);
    b.type = "button";
    b.dataset.complex = id;
    b.setAttribute("aria-label", `Inspect spatial complex ${id}`);
    b.onclick = () => select(id);
    buttons.append(b);
  }
  async function activate() {
    if (started || disposed) return;
    started = true;
    try {
      api = await import("../assets/vendor/network-3d.js");
      if (disposed) return;
      scene = new api.Scene();
      scene.background = new api.Color("#081521");
      camera = new api.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 10, 23);
      renderer = new api.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      stage.append(renderer.domElement);
      orbit = new api.OrbitControls(camera, renderer.domElement);
      orbit.target.set(0, 0.8, 0);
      orbit.update();
      orbit.addEventListener("change", render);
      scene.add(new api.AmbientLight(0xffffff, 2));
      const light = new api.DirectionalLight(0xffffff, 3);
      light.position.set(2, 7, 10);
      scene.add(light);
      const gltf = await new api.GLTFLoader().loadAsync(
        url("membrane-context.glb"),
      );
      if (disposed) {
        gltf.scene.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
        return;
      }
      scene.add(gltf.scene);
      gltf.scene.traverse((o) => {
        if (o.isMesh && o.name.startsWith("Complex_")) meshes.push(o);
      });
      let press;
      renderer.domElement.onpointerdown = (e) => {
        press = [e.clientX, e.clientY];
      };
      renderer.domElement.onpointercancel = () => {
        press = null;
      };
      renderer.domElement.onpointerup = (e) => {
        const start = press;
        press = null;
        if (
          !start ||
          Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6
        )
          return;
        const rect = renderer.domElement.getBoundingClientRect(),
          ray = new api.Raycaster();
        ray.setFromCamera(
          new api.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            (-(e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          camera,
        );
        const hit = ray.intersectObjects(meshes)[0];
        if (hit) select(hit.object.name.split("_")[1]);
      };
      observer = new ResizeObserver(() => {
        if (disposed || !stage.clientWidth) return;
        renderer.setSize(stage.clientWidth, stage.clientHeight);
        camera.aspect = stage.clientWidth / stage.clientHeight;
        camera.updateProjectionMatrix();
        render();
      });
      observer.observe(stage);
      status.classList.remove("inline-loading");
      status.textContent =
        "Select complex I–V to inspect complete curated membership.";
      root.dataset.spatialReady = "true";
      render();
    } catch (error) {
      if (!disposed) {
        status.classList.remove("inline-loading");
        status.textContent =
          "Spatial context unavailable; the respiratory-chain schematic and curated membership remain available.";
      }
    }
  }
  return {
    element: root,
    activate,
    dispose() {
      sharedTools.dispose();
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      orbit?.dispose();
      scene?.traverse((o) => {
        o.geometry?.dispose();
        if (o.material)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      });
      renderer?.dispose();
      renderer?.forceContextLoss();
    },
  };
}
export function createMolecularNodesReference() {
  const root = el("section", "molecular-nodes-reference"),
    img = el("img");
  img.src = url("9TI4-molecular-nodes.png");
  img.loading = "lazy";
  img.alt = "Coordinate-derived human complex I reference cartoon";
  img.width = 1280;
  img.height = 900;
  root.append(
    el("h3", "", "Coordinate-derived reference rendering"),
    el(
      "p",
      "note",
      "PDB 9TI4 assembly 1 · Molecular Nodes 520.2.0 / Blender 5.2.4. Categorical anatomy colours only; RNA effects are not encoded. All 45 protein-chain identities and 8,242 Cα positions match the archived reference mapping.",
    ),
    img,
  );
  const actions = el("div", "molecular-actionbar");
  for (const [name, file] of [
    ["Coordinate and mapping audit", "molecular-nodes-audit.json"],
    ["Download reference cartoon GLB", "9TI4-molecular-nodes.glb"],
  ]) {
    const a = el("a", "button button-tonal external", name);
    a.href = url(file);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (file.endsWith(".glb")) a.download = file;
    actions.append(a);
  }
  root.append(actions);
  return root;
}
