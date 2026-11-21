import { createElement as el } from "./interface-utils.js";

// F7 Range owns pointer/touch interaction. The exponent scale makes equal
// distances represent equal ratios, while ARIA exposes the actual prior SD.
export function createPriorRange({
  title,
  initial = 0.5,
  onCommit,
  onPreview,
}) {
  const element = el("li", "prior-range-item"),
    body = el("div", "item-content"),
    inner = el("div", "item-inner");
  const heading = el("div", "prior-range-heading"),
    label = el("span", "item-title", title),
    output = el("output", "prior-range-value");
  const host = el("div", "range-slider prior-scale-range");
  heading.append(label, output);
  inner.append(heading, host);
  body.append(inner);
  element.append(body);
  let actual = initial,
    disabled = false,
    instance,
    knob,
    muted = false,
    keyboardChange = false;
  const round = (position) => Number((2 ** (position - 3)).toPrecision(6));
  function refresh() {
    output.textContent = String(actual);
    if (knob) {
      knob.setAttribute("aria-valuenow", String(actual));
      knob.setAttribute("aria-valuetext", `${actual}, prior scale`);
      knob.setAttribute("aria-disabled", String(disabled));
      knob.tabIndex = disabled ? -1 : 0;
    }
    host.classList.toggle("disabled", disabled);
    host.inert = disabled;
  }
  function sync(range) {
    actual = round(range.value);
    refresh();
  }
  const api = {
    element,
    get value() {
      return String(actual);
    },
    set value(value) {
      actual = Number(value);
      if (instance) {
        muted = true;
        instance.setValue(Math.log2(actual) + 3);
        muted = false;
      }
      refresh();
    },
    get disabled() {
      return disabled;
    },
    set disabled(value) {
      disabled = Boolean(value);
      refresh();
    },
    dispatchEvent(event) {
      refresh();
      return host.dispatchEvent(event);
    },
    init(app) {
      if (instance || !host.isConnected || !app?.range) return;
      muted = true;
      instance = app.range.create({
        el: host,
        min: 0,
        max: 4,
        step: 0.01,
        value: Math.log2(actual) + 3,
        label: true,
        scale: true,
        scaleSteps: 4,
        formatLabel: (v) => String(round(v)),
        formatScaleLabel: (v) => String(round(v)),
        on: {
          change(range) {
            sync(range);
            if (!muted && !disabled) onPreview?.();
          },
          changed(range) {
            sync(range);
            if (!muted && !disabled && !keyboardChange) onCommit();
          },
        },
      });
      muted = false;
      knob = host.querySelector(".range-knob");
      knob.setAttribute("role", "slider");
      knob.setAttribute("aria-label", title);
      knob.setAttribute("aria-valuemin", ".125");
      knob.setAttribute("aria-valuemax", "2");
      knob.setAttribute("aria-orientation", "horizontal");
      knob.addEventListener("keydown", (event) => {
        const steps = {
          ArrowLeft: -0.01,
          ArrowDown: -0.01,
          ArrowRight: 0.01,
          ArrowUp: 0.01,
          PageDown: -0.25,
          PageUp: 0.25,
        };
        if (
          disabled ||
          (!(event.key in steps) && !["Home", "End"].includes(event.key))
        )
          return;
        event.preventDefault();
        keyboardChange = true;
        muted = true;
        instance.setValue(
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? 4
              : instance.value + steps[event.key],
        );
        muted = false;
        onPreview?.();
      });
      knob.addEventListener("keyup", (event) => {
        if (
          keyboardChange &&
          [
            "ArrowLeft",
            "ArrowDown",
            "ArrowRight",
            "ArrowUp",
            "PageDown",
            "PageUp",
            "Home",
            "End",
          ].includes(event.key)
        ) {
          keyboardChange = false;
          if (!disabled) onCommit();
        }
      });
      refresh();
    },
    destroy() {
      instance?.destroy();
      instance = undefined;
    },
  };
  refresh();
  return api;
}
