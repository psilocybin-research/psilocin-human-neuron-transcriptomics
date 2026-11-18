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
        const look = interpolate(origin.target, target);
        const keys = ["x", "y", "z"];
        const a = keys.map((k) => origin.position[k] - origin.target[k]);
        const b = keys.map((k) => position[k] - target[k]);
        const ra = Math.hypot(...a),
          rb = Math.hypot(...b);
        let nextPosition = interpolate(origin.position, position);
        if (ra > 0.001 && rb > 0.001 && t < 1) {
          const u = a.map((v) => v / ra),
            v = b.map((value) => value / rb);
          const dot = Math.max(
            -1,
            Math.min(
              1,
              u.reduce((sum, x, i) => sum + x * v[i], 0),
            ),
          );
          const angle = Math.acos(dot);
          let perpendicular = v.map((x, i) => x - dot * u[i]);
          let length = Math.hypot(...perpendicular);
          if (length < 0.00001) {
            const axis = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
            const projection = axis.reduce((sum, x, i) => sum + x * u[i], 0);
            perpendicular = axis.map((x, i) => x - projection * u[i]);
            length = Math.hypot(...perpendicular);
          }
          const radius = ra + (rb - ra) * eased;
          nextPosition = Object.fromEntries(
            keys.map((key, i) => [
              key,
              look[key] +
                radius *
                  (u[i] * Math.cos(angle * eased) +
                    (perpendicular[i] / length) * Math.sin(angle * eased)),
            ]),
          );
        }
        apply(
          t === 1
            ? { position, target }
            : { position: nextPosition, target: look },
        );
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
