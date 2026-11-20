// Finite interaction feedback; reduced motion uses one steady marker, not a frame loop.
export function createNetworkSceneEffects({ root, reducedMotion }) {
  let frame,
    start = 0,
    last = 0,
    disposed = false,
    hovered = "",
    located = "",
    locateUntil = 0,
    locateStarted = 0,
    expiry;
  function draw(time) {
    frame = undefined;
    if (disposed || document.hidden || !root.isConnected) return;
    const dt = Math.min(50, time - (last || time));
    last = time;
    const reduce = reducedMotion();
    root.dataset.locatingGene = time < locateUntil ? located : "";
    root.dispatchEvent(
      new CustomEvent("network:effectframe", {
        detail: {
          located: time < locateUntil ? located : "",
          pulse: reduce ? 0.4 : 0.5 + 0.5 * Math.sin(((time - locateStarted) * Math.PI) / 700),
          hovered,
          blend: reduce ? 1 : 1 - Math.exp(-dt / 100),
        },
      }),
    );
    if (!reduce && (time < locateUntil + 400 || time - start < 600))
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
      locateStarted = performance.now();
      locateUntil = locateStarted + duration;
      clearTimeout(expiry);
      expiry = setTimeout(animate, duration + 1);
      animate();
    },
    clear() {
      located = "";
      hovered = "";
      locateUntil = 0;
      clearTimeout(expiry);
      animate();
    },
    refresh: animate,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      clearTimeout(expiry);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
