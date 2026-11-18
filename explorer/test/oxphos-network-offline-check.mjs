import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const open = async (p) => {
  await p
    .getByRole("button", {
      name: "Explore 3D gene–pathway membership",
      exact: true,
    })
    .click();
  await p.waitForFunction(
    () => document.querySelector(".oxphos-network-3d")?.dataset.rendererReady,
  );
};
try {
  const c = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const p = await c.newPage();
  p.setDefaultTimeout(60000);
  await p.addInitScript(() => {
    Element.prototype.requestFullscreen = undefined;
    Element.prototype.webkitRequestFullscreen = undefined;
  });
  await p.goto(base + "#view=overview");
  await p.evaluate(async () => {
    await navigator.serviceWorker.register(new URL("sw.js", document.baseURI));
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener("controllerchange", r, {
          once: true,
        }),
      );
    return new Promise((resolve, reject) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => {
        if (e.data.ok) resolve(e.data);
        else reject(Error(e.data.error));
      };
      navigator.serviceWorker.controller.postMessage({ type: "PREPARE" }, [
        ch.port2,
      ]);
    });
  });
  await p.evaluate(() =>
    localStorage.setItem(
      "atlas-offline-verified",
      document.querySelector("meta[name=atlas-offline-release]").content,
    ),
  );
  await c.setOffline(true);
  await p.reload();
  await open(p);
  assert.equal(
    await p.locator(".oxphos-network-3d").getAttribute("data-renderer-ready"),
    "true",
  );
  const root = p.locator(".oxphos-network-3d");
  await root.getByRole("button", { name: "Day 3", exact: true }).click();
  await root.getByRole("button", { name: "Find gene", exact: true }).click();
  await root.getByRole("searchbox").fill("COX5A");
  await root
    .locator(".oxphos-3d-gene-list")
    .getByRole("button", { name: "COX5A", exact: true })
    .click();
  assert.match(
    await root.locator(".oxphos-3d-selected").innerText(),
    /Complex IV/,
  );
  await root
    .locator(".oxphos-3d-drawer")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await root.locator(".oxphos-3d-stage").scrollIntoViewIfNeeded();
  const canvas = root.locator(".oxphos-3d-stage canvas");
  const before = await canvas.screenshot();
  const box = await canvas.boundingBox(),
    cdp = await c.newCDPSession(p);
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 5; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + i * 12, y: y + i * 5 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await p.waitForTimeout(500);
  assert.notDeepEqual(
    await canvas.screenshot(),
    before,
    "touch drag rotates the rendered scene",
  );
  await p.evaluate(() => document.documentElement.classList.add("dark"));
  await p.screenshot({
    path: "/tmp/atlas-3d-browser/network-offline-mobile-dark.png",
  });
  assert.equal(
    await p
      .locator(".research-evidence-sheet")
      .evaluate((n) => n.scrollWidth > n.clientWidth),
    false,
  );
  console.log(
    "PASS disconnected mobile startup, lazy WebGL renderer, selection, theme and contained layout",
  );
  await c.close();
  const f = await browser.newContext();
  const fp = await f.newPage();
  await fp.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /^webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await fp.goto(base + "#view=overview");
  await open(fp);
  assert.equal(
    await fp.locator(".oxphos-network-3d").getAttribute("data-renderer-ready"),
    "unavailable",
  );
  await fp.getByRole("button", { name: "Find gene", exact: true }).click();
  await fp
    .getByRole("searchbox", { name: "Search 3D OXPHOS genes" })
    .fill("SDHA");
  await fp
    .locator(".oxphos-3d-gene-list")
    .getByRole("button", { name: "SDHA", exact: true })
    .click();
  assert.match(
    await fp.locator(".oxphos-3d-selected").innerText(),
    /Complex II/,
  );
  console.log(
    "PASS WebGL-unavailable fallback retains search and exact archived values",
  );
  await f.close();
} finally {
  await browser.close();
}
