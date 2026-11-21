import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
try {
  for (const width of [390, 1280]) {
    console.log(`Checking directional analysis at width ${width}`);
    const page = await browser.newPage({
      viewport: { width, height: 950 },
      acceptDownloads: true,
    });
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("Browser error:", e.stack);
    });
    await page.goto("http://127.0.0.1:4173/#view=bayesian");
    const panel = page.locator(".directional-evidence");
    await panel.waitFor();
    assert.equal(await page.locator('[data-section="bayesian"]').count(), 1);
    await panel
      .locator(
        ".directional-density-chart svg[data-plot-renderer=observable-plot]",
      )
      .first()
      .waitFor();
    assert.equal(await panel.locator(".directional-summary .card").count(), 2);
    assert.match(
      await panel.locator(".directional-summary").innerText(),
      /37\.8/g,
    );
    assert.equal(
      await panel
        .locator(
          ".directional-sensitivity-chart svg[data-plot-renderer=observable-plot]",
        )
        .count(),
      1,
    );
    assert.match(await panel.innerText(), /not test an exact-zero/);
    assert.equal(await panel.locator(".directional-density-panel").count(), 2);
    assert.equal(
      await panel
        .locator(
          ".directional-robustness-chart svg[data-plot-renderer=observable-plot]",
        )
        .count(),
      2,
    );
    assert.match(
      await panel.locator(".directional-density-chart").innerText(),
      /95% CrI/,
    );
    assert.equal(await panel.locator("math").count(), 5);
    const slider = panel.getByRole("slider", {
      name: "Normal effect-prior SD",
      exact: true,
    });
    await slider.waitFor();
    assert.equal(await panel.getByRole("slider").count(), 2);
    assert.equal(await slider.getAttribute("aria-valuenow"), "0.5");
    assert.equal(
      await panel.locator(".directional-probability-wheel").count(),
      2,
    );
    assert.match(
      await panel.locator(".directional-summary").innerText(),
      /Reciprocal BF−/,
    );
    assert.match(
      await panel.locator(".directional-summary").innerText(),
      /Median/,
    );
    if (width === 1280) {
      const box = await slider.boundingBox();
      const before = await panel.locator(".directional-summary").innerText();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width / 2 + 24,
        box.y + box.height / 2,
        { steps: 4 },
      );
      assert.equal(await panel.getAttribute("aria-busy"), null);
      assert.equal(
        await panel.locator(".directional-summary").innerText(),
        before,
        "dragging previews without refitting",
      );
      assert.ok(Number(await slider.getAttribute("aria-valuenow")) > 0.5);
      await page.mouse.up();
      await page.waitForFunction(
        () =>
          !document
            .querySelector(".directional-evidence")
            ?.hasAttribute("aria-busy"),
        {},
        { timeout: 60000 },
      );
      assert.match(
        await panel.locator("[role=status]").innerText(),
        /Numerical checks passed/,
      );
      await panel
        .getByRole("button", { name: "Reset baseline", exact: true })
        .click();
    }
    await slider.focus();
    await page.keyboard.down("PageUp");
    assert.equal(await panel.getAttribute("aria-busy"), null);
    assert.ok(Number(await slider.getAttribute("aria-valuenow")) > 0.5);
    await page.keyboard.up("PageUp");
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".directional-evidence")
          ?.hasAttribute("aria-busy"),
      {},
      { timeout: 60000 },
    );
    assert.match(
      await panel.locator("[role=status]").innerText(),
      /Numerical checks passed/,
    );
    assert.ok(Number(await slider.getAttribute("aria-valuenow")) > 0.5);
    assert.equal(
      await slider.evaluate((e) => document.activeElement === e),
      true,
    );
    const priorPoint = panel
      .locator(".directional-robustness-chart")
      .getByRole("button", {
        name: "Day 1: explore effect SD 1, residual scale 0.5, LKJ eta 2",
        exact: true,
      });
    await priorPoint.focus();
    await priorPoint.press("Enter");
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".directional-evidence")
          ?.hasAttribute("aria-busy"),
      {},
      { timeout: 60000 },
    );
    assert.match(
      await panel.locator("[role=status]").innerText(),
      /Numerical checks passed/,
    );
    assert.doesNotMatch(
      await panel.locator(".directional-summary").innerText(),
      /37\.8/g,
    );
    const overflow = await panel.evaluate(
      (e) => e.scrollWidth > e.clientWidth + 2,
    );
    assert.equal(overflow, false, "mobile analysis fits");
    const download = page.waitForEvent("download");
    await panel
      .getByRole("button", { name: "Download analysis JSON", exact: true })
      .click();
    await page
      .locator(".download-confirmation")
      .getByRole("button", { name: "Download", exact: true })
      .click();
    const file = await download;
    assert.match(file.suggestedFilename(), /directional/);
    await panel
      .getByRole("button", { name: "Reset baseline", exact: true })
      .click();
    assert.match(
      await panel.locator("[role=status]").innerText(),
      /Baseline deterministic/,
    );
    assert.deepEqual(errors, []);
    // A new, non-grid prior displays the loader; leaving cancels its worker.
    await slider.focus();
    await slider.press("ArrowRight");
    await panel.locator(".preloader").waitFor();
    await page.evaluate(() => {
      window.priorRangeDisposals = 0;
      for (const range of document.querySelectorAll(".prior-scale-range"))
        range.f7Range.on("beforeDestroy", () => window.priorRangeDisposals++);
      document.querySelector('[data-section="overview"]').click();
    });
    await page.waitForFunction(
      () => !document.querySelector(".directional-evidence"),
    );
    assert.equal(await page.evaluate(() => window.priorRangeDisposals), 2);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "PASS: directional model plots, prior calculation, convergence, exports, mobile fit and worker disposal.",
  );
} finally {
  await browser.close();
}
