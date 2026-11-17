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
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const state of [
      "view=robustness",
      "view=genes&gene=ENSG00000184752.8",
      "view=comparison&plot=forest",
    ]) {
      await page.goto(base + "#" + state);
      const chart = page.locator("svg[data-plot-renderer]").first();
      await chart.waitFor();
      const layout = await chart.evaluate((svg) => {
        const box = svg.getBoundingClientRect();
        const text = [...svg.querySelectorAll("text")].filter((node) =>
          node.textContent.trim(),
        );
        return {
          width: svg.viewBox.baseVal.width,
          clipped: text
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return rect.left < box.left - 3 || rect.right > box.right + 3;
            })
            .map((node) => node.textContent),
          bodyOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      if (width <= 390)
        assert.ok(
          layout.width <= width,
          `${state}: native mobile plotting width`,
        );
      assert.deepEqual(
        layout.clipped,
        [],
        `${state}: labels stay within the plot`,
      );
      assert.equal(layout.bodyOverflow, false);
    }
    await page.evaluate(() => {
      const link = document.createElement("a");
      link.href = "https://example.com/";
      link.textContent = "External link check";
      document.querySelector(".atlas-body").prepend(link);
    });
    const link = page.getByRole("link", {
      name: "External link check",
      exact: true,
    });
    await page.waitForFunction(
      () =>
        document.querySelector('a[href="https://example.com/"]')?.target ===
        "_blank",
    );
    assert.ok(
      await link.evaluate(
        (node) =>
          node.relList.contains("noopener") &&
          node.relList.contains("noreferrer") &&
          node.classList.contains("external"),
      ),
    );
    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await popup.close();
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Responsive chart widths, complete labels, stacked intervals and dynamic external new-tab links passed.",
  );
} finally {
  await browser.close();
}
