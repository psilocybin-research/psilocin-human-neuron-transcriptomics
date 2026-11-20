// Finite hover easing and a two-second search locator; no continuous scene effects.
export function createNetworkSceneEffects({ root, reducedMotion }) {
  let frame,
    start = 0,
    last = 0,
    disposed = false,
    hovered = "",
    located = "",
    locateUntil = 0;
  function draw(time) {
    frame = undefined;
    if (disposed || document.hidden || !root.isConnected) return;
    const dt = Math.min(50, time - (last || time));
    last = time;
    const motion = reducedMotion();
    root.dataset.locatingGene = time < locateUntil ? located : "";
    root.dispatchEvent(
      new CustomEvent("network:effectframe", {
        detail: {
          located: time < locateUntil ? located : "",
          pulse: reducedMotion()
            ? 1
            : 0.5 +
              0.5 * Math.sin(((time - locateUntil + 2000) * Math.PI) / 450),
          hovered,
          blend: motion ? 1 : 1 - Math.exp(-dt / 100),
        },
      }),
    );
    if (time < locateUntil + 700 || (!motion && time - start < 1100))
      frame = requestAnimationFrame(draw);
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
    locate(id, duration = 2000) {
      located = id;
      locateUntil = performance.now() + duration;
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
