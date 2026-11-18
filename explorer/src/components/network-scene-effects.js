// Finite hover easing only: no background geometry, textures or pulsing effects.
export function createNetworkSceneEffects({ root, reducedMotion }) {
  let frame,
    start = 0,
    last = 0,
    disposed = false,
    hovered = "";
  function draw(time) {
    frame = undefined;
    if (disposed || document.hidden || !root.isConnected) return;
    const dt = Math.min(50, time - (last || time));
    last = time;
    const motion = reducedMotion();
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
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = undefined;
    } else animate();
  };
  document.addEventListener("visibilitychange", visibility);
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
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
