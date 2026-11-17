import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 950 },
      acceptDownloads: true,
    });
    const errors = [],
      downloads = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("download", (d) => downloads.push(d));
    await page.goto(base + "#view=robustness");
    await page.locator("[data-framework7]").waitFor();
    const exportButton = page
      .getByRole("button", { name: "Download CSV", exact: true })
      .first();
    await exportButton.click();
    let dialog = page.locator(".download-confirmation");
    await dialog.waitFor();
    assert.equal(
      await dialog.locator(".download-filename").innerText(),
      "all-robustness-variants.csv",
    );
    assert.equal(await dialog.locator("button svg").count(), 2);
    assert.equal(downloads.length, 0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(downloads.length, 0);
    await exportButton.click();
    await dialog.waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    assert.equal(downloads.length, 0);
    await exportButton.click();
    await dialog.waitFor();
    const pending = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download", exact: true }).click();
    const file = await pending;
    assert.equal(file.suggestedFilename(), "all-robustness-variants.csv");
    assert.match(await readFile(await file.path(), "utf8"), /NES/);
    await page.goto(base + "#view=pathways&display=network&overlap_view=chord");
    await page.locator(".chord-map svg").waitFor();
    const tabs = page.locator(".network-view-toggle");
    assert.ok(await tabs.evaluate((e) => Boolean(e.closest(".figure-shell"))));
    if (width === 1440) {
      const boxes = await page
        .locator(".tree-view-toggle, .tree-search input")
        .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
      assert.ok(Math.abs(boxes[0].bottom - boxes[1].bottom) < 2);
    }
    const shell = page.locator(".overlap-figure").locator("..");
    await shell.locator(".figure-fullscreen").click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    await tabs
      .getByRole("button", { name: "Edge bundling", exact: true })
      .click();
    await page.locator(".bundle-node").first().waitFor();
    assert.ok(
      await page.evaluate(() =>
        document.fullscreenElement?.contains(
          document.querySelector(".network-view-toggle"),
        ),
      ),
    );
    await tabs
      .getByRole("button", { name: "Exact intersections", exact: true })
      .click();
    await page.locator(".network-content svg[role=img]").waitFor();
    assert.ok(await page.evaluate(() => Boolean(document.fullscreenElement)));
    await page
      .getByRole("button", {
        name: "Download exact intersections CSV",
        exact: true,
      })
      .click();
    await dialog.waitFor();
    assert.ok(
      await dialog.evaluate((e) => document.fullscreenElement.contains(e)),
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "detached" });
    assert.equal(downloads.length, 1);
    assert.ok(await page.evaluate(() => Boolean(document.fullscreenElement)));
    await shell.locator(".figure-fullscreen").click();
    await page.waitForFunction(() => !document.fullscreenElement);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: `/tmp/atlas-final-interface-${width}.png` });
    await page.close();
  }
  console.log(
    "Download filename, icons, Cancel/Escape, accepted CSV, aligned fields and persistent fullscreen view switching passed.",
  );
} finally {
  await browser.close();
}
