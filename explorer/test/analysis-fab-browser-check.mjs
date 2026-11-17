import { chromium, firefox, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const engine = process.env.ATLAS_BROWSER || "chromium",
  output = process.env.QA_OUTPUT || "/tmp/atlas-analysis-fab";
await mkdir(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const errors = [],
  results = [];
const overlaps = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
try {
  for (const width of [320, 390, 1440])
    for (const dark of [false, true]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width < 1180,
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        (d) => localStorage.setItem("atlas-appearance", d ? "dark" : "light"),
        dark,
      );
      await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:4173/");
      await page.locator("[data-framework7]").waitFor();
      const fab = page.locator(".analysis-fab"),
        trigger = fab.getByRole("button", {
          name: "Analysis controls",
          exact: true,
        });
      assert.equal(await fab.getAttribute("data-visible"), "false");
      assert.equal(await fab.evaluate((n) => n.inert), true);
      const search = page.locator(".desktop-gene-finder");
      const originalSearchX =
        width >= 1180 ? (await search.boundingBox()).x : null;
      if (width >= 1180)
        await page.locator(".research-nav [data-section=pathways]").click();
      else
        await page
          .getByRole("button", { name: "Open Pathways", exact: true })
          .click();
      await page.waitForFunction(
        () =>
          document.querySelector("#psilocin-app").dataset.analysisAvailable ===
          "true",
      );
      let target;
      if (width >= 1180) {
        assert.equal(
          (await search.boundingBox()).x,
          originalSearchX,
          "header tools retain their positions",
        );
        assert.equal(await fab.getAttribute("data-visible"), "false");
        await page.locator(".desktop-analysis-controls").click();
        target = page.locator("#analysis-controls-sheet");
      } else {
        await trigger.waitFor();
        assert.equal(
          await page.locator(".desktop-analysis-controls").isVisible(),
          false,
        );
        await page.waitForTimeout(280);
        const f = await fab.boundingBox(),
          bar = await page.locator(".research-tabbar").boundingBox();
        assert.ok(f.y + f.height + 12 <= bar.y, "FAB clears bottom toolbar");
        await page
          .locator(".research-scroll")
          .evaluate((n) => (n.scrollTop = n.scrollHeight));
        await page
          .getByRole("button", { name: "Scroll to top", exact: true })
          .waitFor();
        assert.equal(
          overlaps(
            await fab.evaluate((n) => n.getBoundingClientRect().toJSON()),
            await page
              .locator(".scroll-top")
              .evaluate((n) => n.getBoundingClientRect().toJSON()),
          ),
          false,
          "FAB clears scroll to top",
        );
        const top = await page.locator(".scroll-top").boundingBox();
        assert.ok(
          Math.abs(f.x + f.width / 2 - top.x - top.width / 2) < 1,
          "Floating actions align vertically",
        );
        assert.ok(
          f.y + f.height + 10 <= top.y,
          "Controls clears Scroll to top",
        );
        assert.equal(
          await fab.evaluate((n) => getComputedStyle(n).mixBlendMode),
          "difference",
        );
        await trigger.focus();
        await page.keyboard.press("Enter");
        target = page.locator("#analysis-morph-panel");
        await page
          .locator("#analysis-morph-panel[data-shell-modal-ready=true]")
          .waitFor();
        assert.equal(
          await fab.evaluate((n) => n.classList.contains("fab-opened")),
          true,
          "native F7 FAB morph is active",
        );
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `${output}/${engine}-${width}-${dark ? "dark" : "light"}.png`,
        });
        assert.equal(
          await target.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
          true,
        );
        assert.equal(
          await target.locator(".analysis-morph-header").evaluate((n) => {
            const a = n.querySelector("h2").getBoundingClientRect(),
              b = n.querySelector("button").getBoundingClientRect();
            return a.right + 8 <= b.left;
          }),
          true,
          "close and title do not collide",
        );
      }
      await target.waitFor();
      assert.equal(await fab.evaluate((n) => n.inert), true);
      await target.getByRole("button", { name: "Done", exact: true }).click();
      await page.waitForFunction(
        () =>
          document.querySelector("#psilocin-app").dataset.modalOpen === "false",
      );
      if (width < 1180) {
        await trigger.waitFor();
        await page.waitForFunction(
          () =>
            document.activeElement ===
            document.querySelector(".analysis-fab-action"),
        );
        await trigger.tap();
        await page
          .locator("#analysis-morph-panel[data-shell-modal-ready=true]")
          .waitFor();
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () =>
            !document
              .querySelector("#analysis-morph-panel")
              .classList.contains("modal-in"),
        );
        await trigger.tap();
        await page
          .locator("#analysis-morph-panel[data-shell-modal-ready=true]")
          .waitFor();
        await page.touchscreen.tap(3, 150);
        await page.waitForFunction(
          () =>
            !document
              .querySelector("#analysis-morph-panel")
              .classList.contains("modal-in"),
        );
        await page
          .getByRole("button", { name: "Share analysis", exact: true })
          .tap();
        await page
          .locator(".share-popover.modal-in[data-shell-modal-ready=true]")
          .waitFor();
        assert.equal(await fab.getAttribute("data-visible"), "false");
        await page.keyboard.press("Escape");
        await trigger.waitFor();
        const full = page.locator(".figure-fullscreen").first();
        if (await full.count()) {
          await full.scrollIntoViewIfNeeded();
          await full.click();
          await page.waitForFunction(() =>
            Boolean(
              document.fullscreenElement || document.webkitFullscreenElement,
            ),
          );
          await page.waitForFunction(
            () =>
              document.querySelector(".analysis-fab").dataset.visible ===
              "false",
          );
          assert.equal(await fab.getAttribute("data-visible"), "false");
          await page.locator(".figure-fullscreen-exit").click();
          await trigger.waitFor();
        }
        await page
          .getByRole("button", { name: "Open section menu", exact: true })
          .tap();
        await page
          .locator(".research-sidebar[data-shell-modal-ready=true]")
          .waitFor();
        assert.equal(await fab.getAttribute("data-visible"), "false");
        await page.locator(".research-nav [data-section=overview]").click();
        await page.waitForFunction(
          () =>
            document.querySelector("#psilocin-app").dataset
              .analysisAvailable === "false",
        );
        assert.equal(await fab.getAttribute("data-visible"), "false");
      }
      const glass = await page
        .locator("#psilocin-app")
        .evaluate((n) =>
          getComputedStyle(n).getPropertyValue("--f7-glass-bg-color").trim(),
        );
      assert.match(glass, dark ? /25,\s*45,\s*65/ : /224,\s*239,\s*251/);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
      );
      results.push({ width, dark, glass, passed: true });
      await context.close();
    }
  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const p = await reduced.newPage();
  await p.goto(
    (process.env.ATLAS_URL || "http://127.0.0.1:4173/") + "#view=pathways",
  );
  await p.locator("[data-framework7]").waitFor();
  await p.locator(".analysis-fab-action").click();
  await p
    .locator("#analysis-morph-panel[data-shell-modal-ready=true]")
    .waitFor();
  assert.equal(
    await p
      .locator(".analysis-fab")
      .evaluate((n) => n.classList.contains("fab-opened")),
    false,
    "reduced motion skips morph",
  );
  await p
    .getByRole("dialog", { name: "Analysis controls", exact: true })
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await reduced.close();
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/${engine}-results.json`,
    JSON.stringify(
      { passed: true, engine, results, reducedMotion: true },
      null,
      2,
    ),
  );
  console.log(
    `Blue native glass and FAB selector morph passed (${engine}): native morph, responsive placement, stable header, close/Escape/backdrop, fullscreen hiding, focus and reduced motion.`,
  );
} finally {
  await browser.close();
}
