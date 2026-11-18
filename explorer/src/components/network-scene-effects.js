// Presentation only: the animated substrate never changes data positions or colours.
export function createNetworkSceneEffects({
  api,
  root,
  scenes,
  reducedMotion,
}) {
  const geometry = new api.PlaneGeometry(2400, 1800);
  const material = new api.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { phase: { value: 0 }, openness: { value: 0 } },
    vertexShader:
      "varying vec2 uvScene; void main(){uvScene=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec2 uvScene; uniform float phase; uniform float openness;
      void main(){
        vec2 p=(uvScene-.5)*vec2(1.33,1.0);
        float falloff=exp(-dot(p,p)*7.0);
        float ripple=.5+.5*sin(length(p)*44.0-phase*2.0);
        vec2 grid=abs(fract(uvScene*vec2(50.,38.))-.5);
        float line=1.0-smoothstep(.475,.5,max(grid.x,grid.y));
        float alpha=openness*falloff*(.035*ripple+.018*(1.0-line));
        gl_FragColor=vec4(.18,.46,.63,alpha);
      }`,
  });
  const backgrounds = new Map();
  let frame,
    observer,
    start = 0,
    last = 0,
    open = false,
    disposed = false,
    hovered = "";
  function attach(scene) {
    for (const [previous, plane] of backgrounds) {
      if (!scenes().includes(previous)) {
        previous.remove(plane);
        backgrounds.delete(previous);
      }
    }
    if (!scene || backgrounds.has(scene)) return;
    const plane = new api.Mesh(geometry, material);
    plane.position.z = -180;
    plane.renderOrder = -10;
    plane.raycast = () => {};
    scene.add(plane);
    backgrounds.set(scene, plane);
  }
  function draw(time) {
    frame = undefined;
    if (disposed || document.hidden || !root.isConnected) return;
    scenes().forEach(attach);
    const dt = Math.min(50, time - (last || time));
    last = time;
    const motion = reducedMotion();
    const target = open ? 1 : 0;
    material.uniforms.openness.value +=
      (target - material.uniforms.openness.value) *
      (motion ? 1 : 1 - Math.exp(-dt / 170));
    material.uniforms.phase.value = motion ? 0 : (time - start) / 1000;
    root.dispatchEvent(
      new CustomEvent("network:effectframe", {
        detail: { hovered, blend: motion ? 1 : 1 - Math.exp(-dt / 100) },
      }),
    );
    if (!motion && time - start < 1100) frame = requestAnimationFrame(draw);
  }
  function animate() {
    start = performance.now();
    last = 0;
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function reconcile() {
    const next = Boolean(
      root.querySelector(".oxphos-3d-evidence:not([hidden])") ||
        [...document.querySelectorAll(
          ".sheet-modal.modal-in,.popover.modal-in,.dialog.modal-in,.popup.modal-in",
        )].some(element => !element.contains(root)),
    );
    if (next === open) return;
    open = next;
    root.dataset.interfaceOpen = String(open);
    animate();
  }
  observer = new MutationObserver(reconcile);
  observer.observe(document.querySelector("#psilocin-app") || document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "hidden"],
    childList: true,
  });
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = undefined;
    } else animate();
  };
  document.addEventListener("visibilitychange", visibility);
  reconcile();
  animate();
  return {
    hover(id) {
      if (hovered === id) return;
      hovered = id || "";
      animate();
    },
    refresh: animate,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      backgrounds.forEach((plane, scene) => scene.remove(plane));
      geometry.dispose();
      material.dispose();
    },
  };
}
