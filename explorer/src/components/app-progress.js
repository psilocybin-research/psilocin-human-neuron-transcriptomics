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
  page.append(loading, status);
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
  schedule();
  return {
    update: schedule,
    destroy() {
      destroyed = true;
      unsubscribe();
      resize.disconnect();
      scroll.removeEventListener("scroll", schedule);
      cancelAnimationFrame(frame);
      clearTimeout(showTimer);
    },
  };
}
