import { chromium, firefox, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const engine = process.env.ATLAS_BROWSER || "chromium",
  output = process.env.QA_OUTPUT || "/tmp/atlas-plot-coverage";
await mkdir(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 390, height: 900 } }),
  errors = [],
  results = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
try {
  for (const hash of [
    "view=overview",
    "view=landscape",
    "view=genes&gene=GPX4",
    "view=dna",
    "view=robustness",
    ...[
      "scatter",
      "volcano",
      "forest",
      "distribution",
      "membership",
      "enrichment",
    ].map((plot) => `view=comparison&plot=${plot}`),
    ...["graph", "chord", "matrix", "pairs"].map(
      (plot) => `view=pathways&display=network&overlap_view=${plot}`,
    ),
  ]) {
    await page.goto(base + "#" + hash);
    await page.locator("[data-framework7]").waitFor();
    await page.waitForTimeout(500);
    const graphics = page.locator(
      "svg[aria-label]:not([aria-hidden=true]),svg[aria-labelledby]:not([aria-hidden=true]),canvas[aria-label]",
    );
    assert.equal(
      await graphics.evaluateAll((ns) =>
        ns.every((n) => n.closest(".figure-shell") || n.closest("button,a")),
      ),
      true,
      `scientific graphics wrapped: ${hash}`,
    );
    const figures = page.locator(".figure-shell");
    for (const figure of await figures.all()) {
      assert.equal(
        await figure.locator(".figure-toolbar .figure-print").count(),
        1,
      );
      assert.equal(
        await figure.locator(".figure-toolbar .figure-fullscreen").count(),
        1,
      );
    }
    results.push({
      hash,
      figures: await figures.count(),
      graphics: await graphics.count(),
    });
    if (hash.endsWith("overlap_view=graph")) {
      const map = page.locator(".network-map"),
        shell = page.locator(".network-content").locator("..");
      assert.equal(
        await map.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        true,
        "network fits initially",
      );
      await shell.evaluate((n) => n.scrollIntoView({ block: "start" }));
      const bar = await shell.locator(".figure-toolbar").boundingBox(),
        header = await page.locator(".research-navbar").boundingBox();
      assert.ok(
        bar.y >= header.y + header.height - 1,
        "figure toolbar clears navbar",
      );
      await page.screenshot({ path: `${output}/${engine}-network-fit.png` });
      await shell
        .getByRole("button", { name: /Toggle readable scale/ })
        .click();
      assert.equal(
        await map.evaluate((n) => n.scrollWidth > n.clientWidth),
        true,
        "readable scale is an explicit alternative",
      );
      await shell
        .getByRole("button", { name: /Toggle readable scale/ })
        .click();
      assert.equal(
        await map.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        true,
      );
      await page
        .getByRole("button", { name: "Zoom in network", exact: true })
        .click();
      assert.equal(
        await map.evaluate((n) => n.scrollWidth > n.clientWidth),
        true,
        "zoom remains functional",
      );
      await page
        .getByRole("button", { name: "Reset layout", exact: true })
        .click();
      assert.equal(
        await map.evaluate((n) => n.scrollWidth <= n.clientWidth + 1),
        true,
      );
      await shell.locator(".figure-fullscreen").click();
      await page.waitForFunction(() =>
        Boolean(document.fullscreenElement || document.webkitFullscreenElement),
      );
      assert.equal(
        await shell.locator(".figure-fullscreen-exit").isVisible(),
        true,
      );
      await page.screenshot({
        path: `${output}/${engine}-network-fullscreen.png`,
      });
      await shell.locator(".figure-fullscreen-exit").click();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/${engine}-results.json`,
    JSON.stringify({ passed: true, engine, results }, null, 2),
  );
  console.log(
    `Plot coverage passed (${engine}): 15 displays, shared fullscreen/print, mobile network fit, readable scale, zoom and toolbar clearance.`,
  );
} finally {
  await browser.close();
}
