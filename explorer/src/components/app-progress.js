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
    destroyed = false,
    range = 0,
    position = 0,
    lastValue = -1,
    lastVisible,
    lastScrollable;
  // ResizeObserver runs after layout; scroll frames only update presentation.
  function measure() {
    range = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    position = scroll.scrollTop;
    schedule();
  }
  function updateReading() {
    frame = undefined;
    const value =
      range > 0 ? Math.max(0, Math.min(100, (position / range) * 100)) : 0;
    const atEnd = range > 1 && range - position <= 24;
    const fullscreen =
      document.fullscreenElement || document.webkitFullscreenElement;
    const visible =
      atEnd &&
      root.dataset.modalOpen !== "true" &&
      (!fullscreen || fullscreen === root);
    if (visible !== lastVisible) {
      lastVisible = visible;
      root.dataset.atEnd = String(visible);
      topButton.dataset.visible = String(visible);
      topButton.inert = !visible;
      topButton.setAttribute("aria-hidden", String(!visible));
    }
    if (range > 1 !== lastScrollable) {
      lastScrollable = range > 1;
      reading.dataset.scrollable = String(lastScrollable);
    }
    if (value !== lastValue) {
      lastValue = value;
      reading.setAttribute("aria-valuenow", String(Math.round(value)));
      if (getApp()) getApp().progressbar.set(reading, value, 0);
      else
        reading.firstElementChild.style.transform = `translate3d(${value - 100}%,0,0)`;
    }
  }
  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(updateReading);
  }
  const unsubscribe = observeActivity(({ busy, label }) => {
    scroll.setAttribute("aria-busy", String(busy));
    root.dataset.loading = String(busy);
    if (busy) {
      loading.dataset.visible = "true";
      status.textContent = label;
    } else {
      loading.dataset.visible = "false";
      status.textContent = "";
      schedule();
    }
  });
  const resize = new ResizeObserver(measure);
  resize.observe(scroll);
  resize.observe(content);
  function onScroll() {
    position = scroll.scrollTop;
    schedule();
  }
  scroll.addEventListener("scroll", onScroll, { passive: true });
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
      scroll.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    },
  };
}
