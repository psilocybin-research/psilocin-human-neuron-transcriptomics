import { createElement as el } from "./interface-utils.js";
import { uiIcon } from "./icons.js";

let active;
// Retain the shared call signature while rendering feedback as an F7 top sheet.
export function showToast(
  message,
  {
    container: preferredContainer,
    closeButton = true,
    duration = 2800,
    actionLabel,
    onAction,
  } = {},
) {
  const app = document.querySelector("#psilocin-app")?.f7;
  if (!app) return;
  active?.close(false);
  const container =
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    preferredContainer ||
    app.el;
  const element = el(
    "section",
    "sheet-modal sheet-modal-top atlas-feedback-sheet",
  );
  element.setAttribute("aria-label", "Status update");
  element.setAttribute("role", "region");
  const inner = el("div", "sheet-modal-inner atlas-feedback-inner");
  const text = el("p", "atlas-feedback-message", String(message));
  text.setAttribute("role", "status");
  text.setAttribute("aria-live", "polite");
  text.setAttribute("aria-atomic", "true");
  inner.append(text);
  let timer;
  const sheet = app.sheet.create({
    el: element,
    containerEl: container,
    backdrop: false,
    push: false,
    closeByOutsideClick: false,
    closeByBackdropClick: false,
    swipeToClose: true,
    swipeHandler: inner,
    on: {
      opened() {
        schedule();
      },
      closed() {
        clearTimeout(timer);
        if (active === sheet) active = undefined;
        element.remove();
        setTimeout(() => {
          if (!sheet.destroyed) sheet.destroy();
        }, 0);
      },
    },
  });
  function schedule() {
    clearTimeout(timer);
    if (duration > 0) timer = setTimeout(() => sheet.close(), duration);
  }
  if (actionLabel && onAction) {
    const action = el("button", "button button-tonal", actionLabel);
    action.type = "button";
    action.onclick = () => {
      sheet.close();
      onAction();
    };
    inner.append(action);
  }
  if (closeButton) {
    const close = el("button", "button button-tonal atlas-feedback-close");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss status update");
    close.append(uiIcon("close"));
    close.onclick = () => sheet.close();
    inner.append(close);
  }
  element.append(inner);
  container.append(element);
  element.addEventListener("pointerenter", () => clearTimeout(timer));
  element.addEventListener("pointerleave", schedule);
  element.addEventListener("focusin", () => clearTimeout(timer));
  element.addEventListener("focusout", schedule);
  active = sheet;
  sheet.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  return sheet;
}
