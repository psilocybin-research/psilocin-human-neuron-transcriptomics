// One interruptible timeline for position and look-at; never finish an old tween.
export function createCameraTransition({
  read,
  apply,
  motion = () => true,
  request = requestAnimationFrame,
  cancel = cancelAnimationFrame,
  now = () => performance.now(),
  onState = () => {},
}) {
  let frame;
  const stop = () => {
    cancel(frame);
    frame = undefined;
    onState(false);
  };
  return {
    stop,
    move(position, target, duration = 800) {
      stop();
      const origin = read(),
        began = now();
      if (!motion() || !duration) {
        apply({ position, target });
        return;
      }
      onState(true);
      const draw = (time) => {
        const t = Math.min(1, Math.max(0, (time - began) / duration));
        const eased = t * t * t * (t * (t * 6 - 15) + 10);
        const interpolate = (a, b) =>
          Object.fromEntries(
            ["x", "y", "z"].map((key) => [
              key,
              a[key] + (b[key] - a[key]) * eased,
            ]),
          );
        apply({
          position: interpolate(origin.position, position),
          target: interpolate(origin.target, target),
        });
        if (t < 1) frame = request(draw);
        else {
          frame = undefined;
          onState(false);
        }
      };
      frame = request(draw);
    },
  };
}
