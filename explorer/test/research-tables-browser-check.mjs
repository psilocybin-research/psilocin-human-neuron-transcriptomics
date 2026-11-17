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
  for (const [width, colorScheme] of [
    [390, "light"],
    [1440, "dark"],
  ]) {
    const page = await browser.newPage({
        viewport: { width, height: 960 },
        colorScheme,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "#view=genes&gene=ENSG00000138495.2");
    if (width < 850)
      await page
        .getByRole("button", { name: "View evidence", exact: true })
        .click();
    const container =
      width < 850
        ? page.locator(".research-evidence-sheet")
        : page.locator(".atlas-body");
    const table = container
      .locator("table[data-sortable=true]")
      .filter({
        has: page.getByRole("columnheader", {
          name: "Contrast",
          exact: true,
        }),
      })
      .first();
    await table
      .getByRole("button", { name: "Sort by log₂FC", exact: true })
      .waitFor();
    assert.ok(
      (await table
        .locator("td")
        .first()
        .evaluate((node) => parseFloat(getComputedStyle(node).fontSize))) >= 13,
    );
    assert.equal(
      await table
        .locator("thead th")
        .nth(1)
        .evaluate((node) => getComputedStyle(node).textAlign),
      "right",
    );
    assert.equal(
      await table
        .getByRole("button", { name: "Sort by Contrast", exact: true })
        .count(),
      0,
    );
    const original = await table
      .locator("tbody tr")
      .evaluateAll((rows) => rows.map((row) => row.innerText));
    await table
      .getByRole("button", { name: "Sort by log₂FC", exact: true })
      .click();
    const values = () =>
      table
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((row) => Number(row.cells[1].dataset.sortValue)),
        );
    let sorted = await values();
    assert.deepEqual(
      sorted,
      [...sorted].sort((a, b) => a - b),
    );
    await table
      .getByRole("button", { name: "Sort by log₂FC", exact: true })
      .press("Enter");
    sorted = await values();
    assert.deepEqual(
      sorted,
      [...sorted].sort((a, b) => b - a),
    );
    assert.equal(await table.locator("th[aria-sort=descending]").count(), 1);
    assert.deepEqual(
      (
        await table
          .locator("tbody tr")
          .evaluateAll((rows) => rows.map((row) => row.innerText))
      ).sort(),
      original.sort(),
    );
    await page.screenshot({ path: `/tmp/atlas-tables-${width}.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Native F7 headers, readable themed cells, aligned numeric columns, raw-value ascending/descending sorting, keyboard operation and unchanged rows passed on mobile/light and desktop/dark.",
  );
} finally {
  await browser.close();
}
