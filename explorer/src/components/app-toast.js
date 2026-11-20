import { escapeHTML } from "./interface-utils.js";
// Concise feedback for completed actions; never imply that a file was saved.
let active;
export function showToast(message, { container: preferredContainer, closeButton = true } = {}) {
  const app = document.querySelector("#psilocin-app")?.f7;
  if (!app) return;
  active?.close(false);
  const container =
    preferredContainer || document.fullscreenElement || document.webkitFullscreenElement || app.el;
  const toast = app.toast.create({
    text: escapeHTML(message),
    containerEl: container,
    position: "bottom",
    horizontalPosition: "center",
    closeTimeout: 2800,
    closeButton,
    closeButtonText: "Close",
    destroyOnClose: true,
    on: {
      closed() {
        if (active === toast) active = undefined;
      },
    },
  });
  toast.el.setAttribute("role", "status");
  toast.el.setAttribute("aria-live", "polite");
  active = toast;
  toast.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  return toast;
}
