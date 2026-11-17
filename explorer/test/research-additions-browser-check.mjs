import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/",
  output = process.env.QA_OUTPUT || "/tmp/atlas-research-additions";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const errors = [],
  results = [];
try {
  for (const width of [390, 1440])
    for (const dark of [false, true]) {
      const page = await browser.newPage({
        viewport: { width, height: 950 },
        acceptDownloads: true,
      });
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(
        (d) => localStorage.setItem("atlas-appearance", d ? "dark" : "light"),
        dark,
      );
      await page.goto(base);
      await page.locator("[data-framework7]").waitFor();
      await page
        .getByRole("button", { name: "NES dot plot", exact: true })
        .click();
      await page.locator(".synopsis-dotplot svg[role=img]").waitFor();
      assert.equal(
        await page.locator(".synopsis-dotplot [role=button]").count(),
        15,
      );
      await page.screenshot({ path: `${output}/${width}-${dark}-dot.png` });
      await page.getByRole("button", { name: "Matrix", exact: true }).click();
      assert.ok(await page.locator(".matrix-scroll").isVisible());
      for (const mode of [
        "ridgeline",
        "hexbin",
        "mirrored",
        "profiles",
        "membership",
      ]) {
        await page.goto(
          base + `#view=comparison&plot=${mode}&membership_view=parallel`,
        );
        await page.locator(".comparison-plot svg").first().waitFor();
        await page.waitForTimeout(150);
        assert.equal(
          (await page
            .locator(".comparison-plot svg:not(.f7-icon-svg)")
            .count()) > 0,
          true,
        );
        const shell = page.locator(".comparison-plot .figure-shell").first();
        assert.ok(await shell.locator(".figure-print").count());
        assert.equal(
          await shell
            .locator(".toolbar-pane > button")
            .last()
            .getAttribute("class")
            .then((c) => c.includes("figure-fullscreen")),
          true,
        );
        if (mode === "hexbin") {
          const select = page.locator('select[aria-label="Density bin"]');
          await select.evaluate((n) => {
            n.selectedIndex = 1;
            n.dispatchEvent(new Event("change", { bubbles: true }));
          });
          assert.match(
            await page.locator(".comparison-selection").innerText(),
            /[1-9][0-9]* selected genes/,
          );
          const selectedBin = page.locator(
            '[data-density-bin][aria-pressed="true"]',
          );
          assert.equal(await selectedBin.count(), 1);
          assert.equal(await selectedBin.getAttribute("data-density-bin"), "0");
          assert.equal(await selectedBin.getAttribute("stroke-width"), "2.5");
          await select.selectOption("");
          assert.equal(await selectedBin.count(), 0);
          assert.match(
            await page.locator(".comparison-selection").innerText(),
            /0 selected genes/,
          );
        }
        if (mode === "profiles") {
          await page.locator(".comparison-bounds summary").first().click();
          await page
            .getByRole("button", {
              name: "Select expression region",
              exact: true,
            })
            .click();
          assert.match(
            await page.locator(".comparison-selection").innerText(),
            /113 selected genes/,
          );
        }
        const download = page.waitForEvent("download");
        await page
          .getByRole("button", {
            name: "Download displayed data CSV",
            exact: true,
          })
          .click();
        await page
          .locator(".download-confirmation")
          .getByRole("button", { name: "Download", exact: true })
          .click();
        const file = await download;
        assert.ok(file.suggestedFilename().endsWith(".csv"));
        await file.saveAs(`${output}/${width}-${dark}-${mode}.csv`);
        await page
          .locator(".comparison-plot")
          .screenshot({ path: `${output}/${width}-${dark}-${mode}.png` });
        results.push({ width, dark, mode });
      }
      for (const display of ["bundled", "upset"]) {
        await page.goto(
          base + `#view=pathways&display=network&overlap_view=${display}`,
        );
        await page.locator(".network-content svg[role=img]").waitFor();
        if (display === "bundled") {
          assert.ok((await page.locator(".bundle-node").count()) > 0);
          assert.ok((await page.locator(".bundle-edge").count()) > 0);
        } else {
          await page
            .locator('select[aria-label="Exact intersection"]')
            .evaluate((n) => {
              n.selectedIndex = 1;
              n.dispatchEvent(new Event("change", { bubbles: true }));
            });
          assert.ok(await page.locator(".intersection-gene-list").isVisible());
          const intersectionPlot = page.locator(".upset-summary svg");
          assert.equal(
            await intersectionPlot.getAttribute("data-selected-intersection"),
            "0",
          );
          assert.equal(
            await intersectionPlot.locator('[aria-pressed="true"]').count(),
            1,
          );
          const selectedBar = intersectionPlot.locator(
            '[aria-pressed="true"] .intersection-bar',
          );
          const otherBar = intersectionPlot
            .locator('[aria-pressed="false"] .intersection-bar')
            .first();
          assert.notEqual(
            await selectedBar.evaluate((n) => getComputedStyle(n).fill),
            await otherBar.evaluate((n) => getComputedStyle(n).fill),
          );
        }
        await page
          .locator(".network-content")
          .screenshot({ path: `${output}/${width}-${dark}-${display}.png` });
        results.push({ width, dark, display });
      }
      await page.goto(base + "#view=robustness");
      await page.locator(".gene-diagnostic-disclosure summary").click();
      await page.locator(".gene-diagnostics svg[role=img]").first().waitFor();
      assert.equal(
        await page.locator(".gene-diagnostics .figure-shell").count(),
        2,
      );
      await page
        .locator(".gene-diagnostics")
        .screenshot({ path: `${output}/${width}-${dark}-diagnostics.png` });
      await page.close();
    }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "Research additions passed: matrix/dot alternative, five comparison modes, selections, CSV, bundled/UpSet views, diagnostics, responsive light/dark and figure tools.",
  );
} finally {
  await browser.close();
}
