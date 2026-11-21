import { createElement as el } from "./interface-utils.js";
import { uiIcon } from "./icons.js";

let active;
// Keep existing callers while using F7's nonmodal notification lifecycle.
export function showToast(
  message,
  {
    container: preferredContainer,
    closeButton = true,
    duration,
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
  const element = el("section", "notification atlas-feedback-notification");
  element.setAttribute("aria-label", "Status update");
  element.setAttribute("role", "region");
  const inner = el("div", "notification-content atlas-feedback-inner");
  const text = el("p", "atlas-feedback-message", String(message));
  text.setAttribute("role", "status");
  text.setAttribute("aria-live", "polite");
  text.setAttribute("aria-atomic", "true");
  inner.append(text);
  element.append(inner);
  container.append(element);
  let timer;
  const ttl = duration ?? (actionLabel && onAction ? 8000 : 3000);
  const deadline = Date.now() + ttl;
  const notification = app.notification.create({
    el: element,
    containerEl: container,
    closeOnClick: false,
    swipeToClose: true,
    on: {
      closed() {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", expire);
        if (active === notification) active = undefined;
        element.remove();
        setTimeout(() => {
          if (!notification.destroyed) notification.destroy();
        }, 0);
      },
    },
  });
  // Status dismissal must not depend on a CSS transition-end event, including
  // replacement during entrance, reduced motion, or a backgrounded browser.
  const nativeClose = notification.close.bind(notification);
  notification.close = () => nativeClose(false);
  function expire() {
    if (ttl > 0 && Date.now() >= deadline) notification.close();
  }
  if (actionLabel && onAction) {
    const action = el("button", "button button-tonal", actionLabel);
    action.type = "button";
    action.onclick = () => {
      notification.close();
      onAction();
    };
    inner.append(action);
  }
  if (closeButton) {
    const close = el("button", "button button-tonal atlas-feedback-close");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss status update");
    close.append(uiIcon("close"));
    close.onclick = () => notification.close();
    inner.append(close);
  }
  active = notification;
  notification.open(!matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (ttl > 0) {
    timer = setTimeout(() => notification.close(), ttl);
    document.addEventListener("visibilitychange", expire);
  }
  return notification;
}
