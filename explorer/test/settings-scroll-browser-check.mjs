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
    for (const view of ["robustness", "comparison", "pathways"]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      await page.goto(base + "#view=" + view);
      await page.locator(".figure-shell").first().waitFor();
      const selector =
        view === "comparison"
          ? ".comparison-axis-controls select"
          : "select[aria-label=Contrast]";
      await page.locator(selector).waitFor({ state: "attached" });
      const before = await page.locator("#research-content").evaluate((n) => {
        n.scrollTop = 100;
        return n.scrollTop;
      });
      await page.locator(selector).evaluate((select) => {
        select.value = [...select.options].find(
          (o) => o.value !== select.value,
        ).value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(650);
      const after = await page
        .locator("#research-content")
        .evaluate((n) => n.scrollTop);
      assert.ok(
        Math.abs(after - before) < 2,
        `${view} at ${width}px must retain its scroll position: ${before} -> ${after}`,
      );
      await page.close();
    }
  console.log(
    "Robustness, Comparative views and Pathways retain scroll position after settings changes on mobile and desktop.",
  );
} finally {
  await browser.close();
}
