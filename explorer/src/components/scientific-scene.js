import { createElement as el } from "./interface-utils.js";
import { downloadFile } from "./file-download.js";
import { validateSceneSpec, sceneCoordinates, sceneCSV, sceneEdgesCSV } from "./scientific-scene-spec.js";

// One GPU context for this reusable service; archived network/3Dmol retain their own lifecycles.
let activeScene = null;
export function scientificSceneContextCount() { return activeScene ? 1 : 0; }
const number = (x) => Number(x.toPrecision(6)).toString();
function button(label, action) {
  const node = el("button", "button button-tonal", label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}
function styles() {
  if (document.getElementById("scientific-scene-style")) return;
  const style = el("style"); style.id = "scientific-scene-style";
  style.textContent = `.scientific-scene{border:1px solid var(--f7-list-item-border-color,#bac5ce);border-radius:12px;padding:14px;margin:16px 0;min-width:0}.scientific-scene .scene-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.scientific-scene .scene-actions button{min-height:40px;white-space:normal}.scientific-scene-viewport{height:380px;min-height:240px;background:#f7f9fc;position:relative;border-radius:8px;overflow:hidden;touch-action:pan-y}.scientific-scene-viewport canvas{display:block;width:100%;height:100%;touch-action:none}.scientific-scene .scene-axes,.scientific-scene .scene-legend{font-size:13px;overflow-wrap:anywhere;line-height:1.6}.scientific-scene .scene-legend-ramp{display:inline-block;width:120px;height:10px;background:linear-gradient(90deg,#2166ac,#f7f7f7,#b2182b);margin:0 6px}.scientific-scene-table-wrap{overflow:auto;max-height:340px}.scientific-scene table{border-collapse:collapse;width:100%;font-size:13px}.scientific-scene th,.scientific-scene td{padding:7px;text-align:left;border-bottom:1px solid #b8c2cc}.scientific-scene .scene-status{font-size:13px}.scientific-scene [aria-pressed=true]{font-weight:700}.scientific-scene .scene-point-id{padding:5px;min-height:36px}.scientific-scene .scene-selection{min-height:24px;overflow-wrap:anywhere}@media(max-width:600px){.scientific-scene-viewport{height:300px}.scientific-scene{padding:10px}}`;
  document.head.append(style);
}
export function createScientificScene(input, {onSelect = () => {}, onChange = () => {}, onNetwork, onStructure} = {}) {
  const spec = validateSceneSpec(input);
  const schematic = spec.kind === "schematic", hasColor = spec.data?.some(row => row.color !== undefined);
  styles();
  const root = el("section", "scientific-scene");
  root.setAttribute("aria-label", spec.title);
  root.append(el("h3", "", spec.title), el("p", "scene-status", `${spec.classification.toUpperCase().replaceAll("-", " ")} · ${spec.source.label}`));
  const actions = el("div", "scene-actions"), status = el("p", "scene-status");
  status.setAttribute("role", "status");
  const selected = el("p", "scene-selection", "Select a point or a table identifier to inspect its exact values.");
  selected.setAttribute("aria-live", "polite");
  let destroyed = false, renderer, camera, controls, graph, points, pickMarker, api, resize, visibility, generation = 0, restoringCamera = spec.camera;
  const disposables = [];
  let selectedId = "", page = 0, cameraChangeTimer, lastCameraJSON = "";
  const bookmark = () => camera ? {position: camera.position.toArray(), target: controls.target.toArray(), up: camera.up.toArray(), fov: camera.fov} : restoringCamera;
  root.getSceneSpec = () => validateSceneSpec({...spec, ...(bookmark() ? {camera: bookmark()} : {})});
  function publishCamera() {
    clearTimeout(cameraChangeTimer); cameraChangeTimer = null;
    if (destroyed || !camera) return;
    const current = JSON.stringify(bookmark());
    if (current !== lastCameraJSON) {lastCameraJSON = current; onChange(root.getSceneSpec());}
  }
  function scheduleCamera() {clearTimeout(cameraChangeTimer); cameraChangeTimer = setTimeout(publishCamera, 150);}
  const exportMenu=el("details","scene-export-menu"),exportSummary=el("summary","","Export");exportMenu.append(exportSummary);actions.append(exportMenu);
  exportMenu.append(button("Scene specification (.json)", () => downloadFile("scientific-scene.json", JSON.stringify(root.getSceneSpec(), null, 2), "application/json")));
  root.append(actions, status);
  if (spec.kind === "structure-reference") {
    status.textContent = `Structure request: ${spec.gene}. A gene identifier is not a protein structure; the linked protein context records structure provenance and mapping limitations.`;
    if (onStructure) actions.prepend(button("Inspect protein structure", () => onStructure(spec.gene, spec)));
    root.destroy = () => { destroyed = true; };
    root.setSelection = () => {};
    return root;
  }
  exportMenu.append(button("Data (.csv)", () => downloadFile("scientific-scene.csv", sceneCSV(spec), "text/csv")));
  if (spec.kind === "membership-overlay") {
    status.textContent = `${spec.data.length} exact identifiers with user-computed values. Overlay uses archived membership edges; values do not create biological interactions.`;
    if (onNetwork) actions.prepend(button("Open gene network", () => onNetwork(spec)));
  }
  const tableDetails = el("details"), tableSummary = el("summary", "", `Underlying data · ${spec.data.length} rows`), tableWrap = el("div", "scientific-scene-table-wrap"), table = el("table"), pagination = el("div", "scene-actions");
  tableDetails.append(tableSummary, tableWrap, pagination); tableWrap.append(table);
  const cols = schematic ? ["id", "label", "node_type", ...(hasColor ? ["color"] : []), "evidence"] : spec.kind === "scatter3d" ? ["id", "x", "y", "z", ...(hasColor ? ["color"] : [])] : ["id", "value"];
  function select(id, notify = true) {
    const row = spec.data.find((r) => r.id === id);
    if (!row) return;
    selectedId = id;
    if (pickMarker) {
      const index = spec.data.indexOf(row);
      pickMarker.position.set(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]);
      pickMarker.visible = true;
      render();
    }
    selected.textContent = `${row.label ? `${row.label} · ` : ""}${id} · ${cols.filter((c) => c !== "id").map((c) => `${spec.axes?.[c] || (c === "color" ? spec.color_label || c : c)}: ${row[c]}`).join(" · ")}`;
    for (const b of table.querySelectorAll("button[data-id]")) b.setAttribute("aria-pressed", String(b.dataset.id === id));
    if (notify) onSelect({id, row: {...row}, source: {...spec.source}, classification: spec.classification});
  }
  root.setSelection = (id) => select(id, false);
  function drawTable() {
    table.replaceChildren();
    const head = el("thead"), tr = el("tr");
    for (const c of cols) {const th = el("th", "", spec.axes?.[c] || (c === "color" ? spec.color_label || c : c)); th.scope = "col"; tr.append(th);}
    head.append(tr); table.append(head);
    const body = el("tbody");
    for (const row of spec.data.slice(page * 100, (page + 1) * 100)) {
      const tr = el("tr");
      for (const c of cols) {
        const td = el("td");
        if (c === "id") {const b = button(row.id, () => select(row.id)); b.className = "scene-point-id"; b.dataset.id = row.id; b.setAttribute("aria-pressed", String(row.id === selectedId)); td.append(b);} else td.textContent = row[c] === undefined ? "Not available" : String(row[c]);
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body);
    pagination.replaceChildren(button("Previous rows", () => {page--; drawTable();}), el("span", "", `Rows ${page * 100 + 1}–${Math.min((page + 1) * 100, spec.data.length)} of ${spec.data.length}`), button("Next rows", () => {page++; drawTable();}));
    pagination.firstChild.disabled = page === 0; pagination.lastChild.disabled = (page + 1) * 100 >= spec.data.length;
  }
  drawTable(); root.append(selected);
  if (!["scatter3d", "schematic"].includes(spec.kind)) {root.append(tableDetails); root.destroy = () => {destroyed = true;}; return root;}
  const {positions, domains} = sceneCoordinates(spec);
  const viewport = el("div", "scientific-scene-viewport");
  const axesText = Object.entries(domains).map(([key, domain]) => `${key.toUpperCase()}: ${spec.axes[key]} [${number(domain[0])}, ${number(domain[1])}]`).join(" · ");
  const axes = el("p", "scene-axes", schematic ? spec.caption : `${axesText}. Each axis is independently linear; 3D distance is not a biological distance.`);
  const colorLimit = spec.color_limit || spec.data.reduce((limit, row) => Math.max(limit, Math.abs(row.color ?? 0)), 0) || 1;
  const legend = el("p", "scene-legend");
  if (hasColor) legend.append(document.createTextNode(`${spec.color_label || "Colour value"}: ${number(-colorLimit)}`), el("span", "scene-legend-ramp"), document.createTextNode(`${number(colorLimit)} · symmetric linear scale`));
  else legend.textContent = schematic ? "Gene: blue · pathway: purple · complex: orange · category: grey. Positions are illustrative; edges carry only their stated relation." : "Points share one colour; position encodes the three supplied numerical variables.";
  if (schematic && hasColor) legend.append(document.createTextNode(". Non-gene nodes and unavailable estimates are neutral; edges do not encode correlation or physical interaction."));
  const open = button("Explore in 3D", () => void start());
  const reset = button("Reset camera", () => {restoringCamera = null; if (camera) {camera.position.set(3.5, 2.8, 4); camera.up.set(0, 1, 0); controls.target.set(0, 0, 0); camera.fov = 45; camera.updateProjectionMatrix(); controls.update(); render(); publishCamera();}});
  const png = button("Image (.png)", async () => {
    if (!renderer) {status.textContent = "Open the 3D scene before exporting its image."; return;}
    render();
    const canvas = document.createElement("canvas"), source = renderer.domElement;
    canvas.width = source.width; canvas.height = source.height + 156;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(source, 0, 58);
    ctx.fillStyle = "#172333"; ctx.font = "bold 18px sans-serif"; ctx.fillText(spec.title, 16, 26, canvas.width - 32);
    ctx.font = "13px sans-serif"; ctx.fillText(`${spec.classification} · ${spec.source.label}`, 16, 46, canvas.width - 32);
    let y = source.height + 80;
    if (schematic) {
      for (const line of ["ILLUSTRATIVE LAYOUT — not measured spatial or anatomical evidence", `${spec.edges.length} typed edges; no inferred physical interaction or causation`, hasColor ? `${spec.color_label || "Colour"}: blue ${number(-colorLimit)} / white 0 / red ${number(colorLimit)}` : "Categorical node colours; exact data and edge provenance in companion JSON."]) {ctx.fillText(line, 16, y, canvas.width - 32); y += 18;}
      canvas.toBlob(blob => {if(blob)void downloadFile("scientific-scene.png",blob,"image/png");},"image/png");
      return;
    }
    for (const [key, domain] of Object.entries(domains)) {ctx.fillText(`${key.toUpperCase()}: ${spec.axes[key]} [${number(domain[0])}, ${number(domain[1])}]`, 16, y, canvas.width - 32); y += 18;}
    ctx.fillText(spec.data[0].color === undefined ? "Independent linear axes; exact values and camera in companion scene JSON." : `${spec.color_label || "Colour"}: blue ${number(-colorLimit)} / white 0 / red ${number(colorLimit)}; independent linear axes.`, 16, y, canvas.width - 32);
    canvas.toBlob((blob) => {if (blob) void downloadFile("scientific-scene.png", blob, "image/png");}, "image/png");
  });
  actions.prepend(open, reset);exportMenu.append(png);
  actions.append(button("Fullscreen",()=>{if(root.requestFullscreen)root.requestFullscreen().catch(()=>{status.textContent="Fullscreen is unavailable in this browser.";});else status.textContent="Fullscreen is unavailable in this browser.";}));
  root.append(axes, legend, viewport, tableDetails);
  if (schematic) {
    exportMenu.append(button("Download typed edges CSV", () => downloadFile("scientific-scene-edges.csv",sceneEdgesCSV(spec),"text/csv")));
    const details = el("details"), summary = el("summary", "", `Typed edge table · ${spec.edges.length} edges`), wrap = el("div", "scientific-scene-table-wrap"), table = el("table");
    details.append(summary, wrap);wrap.append(table);
    const head = el("tr");for(const name of ["Source", "Target", "Relation", "Evidence"])head.append(el("th", "", name));table.append(head);
    for(const edge of spec.edges.slice(0,500)){const row=el("tr");for(const key of ["source","target","relation","evidence"])row.append(el("td","",edge[key]));table.append(row);}
    details.append(el("p","note",`Preview retains the first ${Math.min(500,spec.edges.length)} edges; JSON and CSV retain all edges.`));root.append(details);
  }
  function render() {if (renderer && !destroyed && !document.hidden) renderer.render(graph, camera);}
  function release(message = "Scene paused. Explore in 3D to resume; exact data and exports remain available.") {
    generation++;
    if (cameraChangeTimer) publishCamera();
    if (camera) restoringCamera = bookmark();
    controls?.dispose(); controls = null;
    for (const disposable of disposables.splice(0)) disposable.dispose();
    if (renderer) {renderer.domElement.removeEventListener("webglcontextlost", lost); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();}
    renderer = null; camera = null; points = null; pickMarker = null; graph = null;
    if (activeScene === root) activeScene = null;
    status.textContent = message; open.disabled = false; png.disabled = true;
  }
  function lost(event) {event.preventDefault(); release("The graphics context was lost. Reopen the scene to restore its camera. Exact data remain available.");}
  root.release = release;
  async function start() {
    if (destroyed || renderer) return;
    const request = ++generation;
    status.textContent = "Loading scientific 3D renderer…";
    open.disabled = true;
    try {
      api ||= await import("../assets/vendor/network-3d.js");
      if (destroyed || request !== generation) return;
      activeScene?.release("Another scientific scene is active. Reopen this scene to resume with its saved camera.");
      renderer = new api.WebGLRenderer({antialias: true, preserveDrawingBuffer: true});
      activeScene = root;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0xf7f9fc);
      renderer.domElement.setAttribute("role", "img"); renderer.domElement.setAttribute("aria-label", `${spec.title}. Interactive 3D scatter plot; exact keyboard-accessible data are in the table below.`);
      renderer.domElement.addEventListener("webglcontextlost", lost);
      viewport.append(renderer.domElement);
      graph = new api.Scene(); camera = new api.PerspectiveCamera(45, 1, 0.01, 100);
      camera.position.set(3.5, 2.8, 4);
      controls = new api.OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.minDistance = 0.1; controls.maxDistance = 30;
      if (restoringCamera) {camera.position.fromArray(restoringCamera.position); camera.up.fromArray(restoringCamera.up); camera.fov = restoringCamera.fov; controls.target.fromArray(restoringCamera.target); camera.updateProjectionMatrix(); controls.update();}
      const geometry = new api.BufferGeometry(); geometry.setAttribute("position", new api.Float32BufferAttribute(positions, 3)); disposables.push(geometry);
      const colors = new Float32Array(spec.data.length * 3), base = new api.Color();
      spec.data.forEach((row, index) => {
        if (row.color === undefined) base.set(schematic ? (hasColor ? "#7b8793" : ({gene:"#2166ac",pathway:"#7563a9",complex:"#b86f22",compartment:"#65838c"}[row.node_type] || "#7b8793")) : "#2166ac"); else {const t = Math.min(1, Math.abs(row.color) / colorLimit); base.set("#f7f7f7").lerp(new api.Color(row.color < 0 ? "#2166ac" : "#b2182b"), t);}
        colors.set([base.r, base.g, base.b], index * 3);
      });
      geometry.setAttribute("color", new api.Float32BufferAttribute(colors, 3));
      const material = new api.PointsMaterial({size: 6, sizeAttenuation: false, vertexColors: true}); disposables.push(material);
      points = new api.Points(geometry, material); graph.add(points);
      const pickGeometry = new api.BufferGeometry(); pickGeometry.setAttribute("position", new api.Float32BufferAttribute([0, 0, 0], 3));
      const pickMaterial = new api.PointsMaterial({size: 14, sizeAttenuation: false, color: 0x111111, transparent: true, opacity: 0.35, depthTest: false});
      disposables.push(pickGeometry, pickMaterial);
      pickMarker = new api.Points(pickGeometry, pickMaterial); pickMarker.visible = false; graph.add(pickMarker);
      if (selectedId) select(selectedId, false);
      for (const [index, axisName] of (schematic ? [] : ["X", "Y", "Z"]).entries()) {
        const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext("2d"); ctx.fillStyle = "#172333"; ctx.font = "bold 42px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(axisName, 32, 32);
        const texture = new api.CanvasTexture(canvas), labelMaterial = new api.SpriteMaterial({map: texture, depthTest: false});
        disposables.push(texture, labelMaterial);
        const label = new api.Sprite(labelMaterial); label.position.set(index === 0 ? 1.15 : -1, index === 1 ? 1.15 : -1, index === 2 ? 1.15 : -1); label.scale.set(0.18, 0.18, 0.18); graph.add(label);
      }
      if (schematic) {
        const byId = new Map(spec.data.map((row,index)=>[row.id,index]));
        for(const [relation,edgeColor] of [["membership",0xa2aeba],["curated-complex",0xb48650],["navigation",0x64878c]]) {
          const segments=[];
          for(const edge of spec.edges.filter(e=>e.relation===relation))for(const id of [edge.source,edge.target]) {const index=byId.get(id);segments.push(positions[index*3],positions[index*3+1],positions[index*3+2]);}
          if(!segments.length)continue;
          const edgeGeometry=new api.BufferGeometry();edgeGeometry.setAttribute("position",new api.Float32BufferAttribute(segments,3));
          const edgeMaterial=new api.LineBasicMaterial({color:edgeColor,transparent:true,opacity:0.55});disposables.push(edgeGeometry,edgeMaterial);graph.add(new api.LineSegments(edgeGeometry,edgeMaterial));
        }
        for(const row of spec.data.filter(row=>row.node_type!=="gene").slice(0,40)) {
          const index=byId.get(row.id),canvas=document.createElement("canvas");canvas.width=512;canvas.height=64;
          const ctx=canvas.getContext("2d");ctx.fillStyle="#172333";ctx.font="22px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(row.label||row.id,256,32,500);
          const texture=new api.CanvasTexture(canvas),labelMaterial=new api.SpriteMaterial({map:texture,depthTest:false});disposables.push(texture,labelMaterial);
          const sprite=new api.Sprite(labelMaterial);sprite.position.set(positions[index*3],positions[index*3+1]+0.11,positions[index*3+2]);sprite.scale.set(0.9,0.1125,1);graph.add(sprite);
        }
      }
      const wire = new api.BufferGeometry();
      wire.setAttribute("position", new api.Float32BufferAttribute([-1,-1,-1,1,-1,-1, -1,-1,-1,-1,1,-1, -1,-1,-1,-1,-1,1, 1,-1,-1,1,1,-1, 1,-1,-1,1,-1,1, -1,1,-1,1,1,-1, -1,1,-1,-1,1,1, -1,-1,1,1,-1,1, -1,-1,1,-1,1,1, 1,1,1,-1,1,1, 1,1,1,1,-1,1, 1,1,1,1,1,-1], 3));
      const wireMaterial = new api.LineBasicMaterial({color: 0x9baab8}); disposables.push(wire, wireMaterial); if(!schematic)graph.add(new api.LineSegments(wire, wireMaterial));
      const ray = new api.Raycaster(); ray.params.Points.threshold = 0.045;
      let down;
      renderer.domElement.addEventListener("pointerdown", (event) => {down = [event.clientX, event.clientY];});
      renderer.domElement.addEventListener("pointerup", (event) => {
        if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5 || !renderer) return;
        const rect = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new api.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
        const hit = ray.intersectObject(points)[0]; if (hit) select(spec.data[hit.index].id);
      });
      controls.addEventListener("change", render); controls.addEventListener("end", scheduleCamera); lastCameraJSON = JSON.stringify(bookmark()); resizeCanvas();
      png.disabled = false;
      status.textContent = `${spec.data.length} ${schematic ? `nodes · ${spec.edges.length} typed edges` : "points"} · Three.js 0.187.0 · drag to rotate, pinch or scroll to zoom · exact values available below.`;
    } catch (error) {release(`3D rendering unavailable: ${error.message}. The exact data table and scene JSON remain available.`);}
  }
  function resizeCanvas() {
    if (!renderer) return;
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
  }
  resize = new ResizeObserver(resizeCanvas); resize.observe(viewport);
  let firstVisible = true;
  visibility = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && firstVisible) {firstVisible = false; void start();}
    else if (!entry.isIntersecting && (renderer || open.disabled)) release();
  }, {threshold: 0.02}); visibility.observe(viewport);
  const onVisibility = () => {if (document.hidden && renderer) release("Scene paused while this browser tab is hidden. Explore in 3D to resume.");};
  document.addEventListener("visibilitychange", onVisibility);
  root.destroy = () => {if(cameraChangeTimer)publishCamera(); destroyed = true; release(); resize.disconnect(); visibility.disconnect(); document.removeEventListener("visibilitychange", onVisibility);};
  png.disabled = true;
  return root;
}
