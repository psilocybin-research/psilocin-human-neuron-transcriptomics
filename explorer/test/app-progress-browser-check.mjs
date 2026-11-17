import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
try {
  for (const width of [390, 1440])
    for (const dark of [false, true]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        (d) => localStorage.setItem("atlas-appearance", d ? "dark" : "light"),
        dark,
      );
      await page.route("**/genes*.json", async (route) => {
        await new Promise((r) => setTimeout(r, 700));
        await route.continue();
      });
      await page.goto(base);
      await page.locator("[data-framework7]").waitFor();
      assert.equal(await page.locator(".scroll-top").count(), 0);
      assert.equal(await page.getByLabel("Reduce interface motion").count(), 0);
      await page
        .locator(".research-scroll")
        .evaluate((e) => (e.scrollTop = e.scrollHeight));
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector(".app-reading-progress")
              .getAttribute("aria-valuenow"),
          ) >= 99,
      );
      await page.locator('.app-scroll-top[data-visible="true"]').waitFor();
      await page
        .getByRole("button", { name: "Scroll to top", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector(".research-scroll").scrollTop < 2,
      );
      await page.locator(".app-scroll-top").waitFor({ state: "hidden" });
      const geneNav = page.locator(
        width < 1180
          ? '.research-tabbar [data-quick="genes"]'
          : '.research-nav [data-section="genes"]',
      );
      if (width < 1180) await geneNav.click();
      else await geneNav.evaluate((e) => e.click());
      await page
        .locator('.app-loading-progress[data-visible="true"]')
        .waitFor();
      assert.equal(
        await page.locator(".research-scroll").getAttribute("aria-busy"),
        "true",
      );
      const indicator = await page
        .locator(".app-loading-progress")
        .boundingBox();
      const bottomEdge =
        width < 1180
          ? (await page.locator(".research-tabbar").boundingBox()).y
          : 900;
      assert.ok(
        Math.abs(indicator.y + indicator.height - bottomEdge) < 2,
        "Loading indicator meets the bottom bar",
      );
      const reading = await page.locator(".app-reading-progress").boundingBox();
      const header = await page.locator(".research-navbar").boundingBox();
      assert.ok(
        Math.abs(reading.y - header.y) < 2,
        "Reading indicator meets the top edge",
      );

      await page.locator('#psilocin-app[data-loading="false"]').waitFor();
      assert.equal(
        await page
          .locator(".app-loading-progress")
          .getAttribute("data-visible"),
        "false",
      );
      await page.waitForFunction(
        () =>
          Number(
            document
              .querySelector(".app-reading-progress")
              .getAttribute("aria-valuenow"),
          ) < 5,
      );
      if (width < 1180) {
        await page.locator('.research-tabbar [data-quick="pathways"]').click();
        const fab = page.locator(".analysis-fab");
        await fab.locator("a").waitFor();
        assert.equal(
          await fab.evaluate((e) => getComputedStyle(e).mixBlendMode),
          "normal",
        );
        const f = await fab.boundingBox(),
          bar = await page.locator(".research-tabbar").boundingBox();
        assert.ok(f.y + f.height + 12 <= bar.y);
      }
      assert.deepEqual(errors, []);
      await page.waitForTimeout(280);
      await page.screenshot({
        path: `/tmp/atlas-progress-${width}-${dark}.png`,
      });
      await page.close();
    }
  console.log(
    "Progress follows scrolling and real delayed data loading; removed action, FAB placement and light/dark checks passed.",
  );
} finally {
  await browser.close();
}
