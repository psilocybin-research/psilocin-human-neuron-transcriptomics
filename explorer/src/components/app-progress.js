import { uiIcon } from "./icons.js";
import { createElement as node } from "./interface-utils.js";
import { observeActivity } from "./app-activity.js";

export function createAppProgress({
  root,
  page,
  navbar,
  scroll,
  content,
  getApp,
}) {
  const reading = node("div", "progressbar app-reading-progress");
  reading.setAttribute("role", "progressbar");
  reading.setAttribute("aria-label", "Page reading progress");
  reading.setAttribute("aria-valuemin", "0");
  reading.setAttribute("aria-valuemax", "100");
  reading.append(node("span"));
  navbar.append(reading);
  const loading = node("div", "progressbar-infinite app-loading-progress");
  loading.setAttribute("aria-hidden", "true");
  const status = node("span", "app-loading-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  const topButton = node("button", "button button-round app-scroll-top");
  topButton.type = "button";
  topButton.title = "Scroll to top";
  topButton.setAttribute("aria-label", "Scroll to top");
  topButton.append(uiIcon("top"));
  topButton.onclick = () =>
    scroll.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  page.append(loading, status, topButton);
  let frame,
    showTimer,
    destroyed = false;
  function updateReading() {
    frame = undefined;
    const range = scroll.scrollHeight - scroll.clientHeight;
    const value =
      range > 0
        ? Math.max(0, Math.min(100, (scroll.scrollTop / range) * 100))
        : 0;
    const atEnd = range > 1 && range - scroll.scrollTop <= 24;
    const fullscreen =
      document.fullscreenElement || document.webkitFullscreenElement;
    const visible =
      atEnd &&
      root.dataset.modalOpen !== "true" &&
      (!fullscreen || fullscreen === root);
    root.dataset.atEnd = String(visible);
    topButton.dataset.visible = String(visible);
    topButton.inert = !visible;
    topButton.setAttribute("aria-hidden", String(!visible));
    reading.dataset.scrollable = String(range > 1);
    reading.setAttribute("aria-valuenow", String(Math.round(value)));
    if (getApp()) getApp().progressbar.set(reading, value, 0);
    else
      reading.firstElementChild.style.transform = `translate3d(${value - 100}%,0,0)`;
  }
  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(updateReading);
  }
  const unsubscribe = observeActivity(({ busy, label }) => {
    scroll.setAttribute("aria-busy", String(busy));
    root.dataset.loading = String(busy);
    clearTimeout(showTimer);
    if (busy) {
      if (loading.dataset.visible === "true") status.textContent = label;
      else
        showTimer = setTimeout(() => {
          loading.dataset.visible = "true";
          status.textContent = label;
        }, 120);
    } else {
      loading.dataset.visible = "false";
      status.textContent = "";
      schedule();
    }
  });
  const resize = new ResizeObserver(schedule);
  resize.observe(scroll);
  resize.observe(content);
  scroll.addEventListener("scroll", schedule, { passive: true });
  const modalObserver = new MutationObserver(schedule);
  modalObserver.observe(root, {
    attributes: true,
    attributeFilter: ["data-modal-open"],
  });
  document.addEventListener("fullscreenchange", schedule);
  document.addEventListener("webkitfullscreenchange", schedule);
  schedule();
  return {
    update: schedule,
    destroy() {
      destroyed = true;
      unsubscribe();
      resize.disconnect();
      modalObserver.disconnect();
      document.removeEventListener("fullscreenchange", schedule);
      document.removeEventListener("webkitfullscreenchange", schedule);
      scroll.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
      clearTimeout(showTimer);
    },
  };
}
