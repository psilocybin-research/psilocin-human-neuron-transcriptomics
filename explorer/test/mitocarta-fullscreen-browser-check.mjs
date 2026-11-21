import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    (process.env.ATLAS_URL || "http://127.0.0.1:4173/") +
      "#view=mitocarta&mitoview=complexes",
  );
  const host = page.locator(".mitochondrial-explorer");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [tab, selector, title, ready] of [
      [
        "Complexes",
        ".mito-reference-figure",
        "Respiratory-chain reference",
        null,
      ],
      [
        "Structure",
        ".molecular-workbench .molecular-stage",
        "Human complex I",
        ".molecular-workbench[data-molecular-ready=true]",
      ],
      [
        "Spatial context",
        ".mitochondrial-spatial-context .molecular-stage",
        "Respiratory-chain spatial context",
        "[data-spatial-ready=true]",
      ],
    ]) {
      await host.getByRole("tab", { name: tab, exact: true }).click();
      if (ready) await host.locator(ready).waitFor({ timeout: 120000 });
      await host
        .locator(selector)
        .evaluate((el) => (el.dataset.fullscreenCheck = "true"));
      const surface = page.locator("[data-fullscreen-check=true]"),
        open = surface.getByRole("button", {
          name: `View ${title} in full screen`,
          exact: true,
        });
      assert.equal(await surface.locator(".figure-fullscreen").count(), 1);
      await open.click();
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      assert.equal(
        await surface.evaluate((el) => document.fullscreenElement === el),
        true,
      );
      await surface
        .getByRole("button", { name: "Exit full screen", exact: true })
        .click();
      await page.waitForFunction(() => !document.fullscreenElement);
      await surface.evaluate((el) => {
        Object.defineProperty(el, "requestFullscreen", {
          value: undefined,
          configurable: true,
        });
      });
      await open.click();
      const popup = page.locator(".atlas-3d-fullscreen-popup");
      await popup.waitFor({ state: "visible" });
      assert.equal(
        await surface.evaluate((el) =>
          Boolean(el.closest(".atlas-3d-fullscreen-popup")),
        ),
        true,
      );
      await page.waitForFunction(
        () =>
          document.querySelector(".atlas-3d-fullscreen-popup")?.dataset
            .shellModalReady === "true",
      );
      const box = await popup.boundingBox();
      assert.ok(
        Math.abs(box.width - width) < 3 && Math.abs(box.height - 900) < 3,
        `${tab} fallback covers viewport: ${JSON.stringify(box)} at ${width}`,
      );
      assert.ok(
        (await surface.boundingBox()).height >= 850,
        `${tab} fallback height`,
      );
      await surface
        .getByRole("button", { name: "Exit full screen", exact: true })
        .click();
      await popup.waitFor({ state: "detached" });
      assert.equal(
        await surface.evaluate((el) =>
          Boolean(el.closest(".mitochondrial-explorer")),
        ),
        true,
      );
      await surface.evaluate((el) => {
        delete el.requestFullscreen;
        delete el.dataset.fullscreenCheck;
      });
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: shared visible fullscreen controls for Complexes, Structure and Spatial context; native and F7 fallback, desktop/mobile, renderer preservation and return.",
  );
} finally {
  await browser.close();
}
