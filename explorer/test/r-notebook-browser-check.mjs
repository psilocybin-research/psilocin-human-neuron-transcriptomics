import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(
  (process.env.ATLAS_URL || "http://127.0.0.1:4173/") + "#view=custom-r",
);
await page.getByLabel("Research notebook", { exact: true }).waitFor();
await page.getByRole("button", { name: "Add Markdown", exact: true }).click();
await page
  .getByLabel("Markdown cell", { exact: true })
  .fill("## Recorded note\nDo not auto-run recovered code.");
await page.getByRole("button", { name: "Add R cell", exact: true }).click();
await page
  .getByLabel("R code", { exact: true })
  .fill(
    "results <- data.frame(value=c(2,4), other=c(1,2)); print(sum(results$value)); plot(results$value)",
  );
await page.waitForTimeout(700);
await page.reload();
await page.getByLabel("Research notebook", { exact: true }).waitFor();
await page.waitForFunction(
  () => document.querySelectorAll(".research-studio-cell-row").length === 3,
);
assert.equal(await page.locator(".research-studio-cell-row").count(), 3);
await page
  .locator(".research-studio-cell-row")
  .last()
  .getByRole("button")
  .click();
assert.match(
  await page.getByLabel("R code", { exact: true }).innerText(),
  /data.frame/,
);
await page.getByRole("button", { name: "Run analysis", exact: true }).click();
await page.waitForFunction(
  () => document.querySelector("#psilocin-app").dataset.rBusy === "false",
  null,
  { timeout: 180000 },
);
assert.match(
  await page.getByLabel("R console output", { exact: true }).innerText(),
  /6/,
);
assert.equal(await page.locator(".custom-r-plots img").count(), 1);
await page.locator('.exploratory-result-stage svg[role="img"]').waitFor();
assert.match(await page.locator(".exploratory-result-chart").innerText(), /USER EXPLORATORY RESULTS/);
await page.waitForTimeout(500);
await page.reload();
await page.getByLabel("Research notebook", { exact: true }).waitFor();
await page.waitForFunction(
  () => document.querySelectorAll(".research-studio-cell-row").length === 3,
);
await page
  .locator(".research-studio-cell-row")
  .last()
  .getByRole("button")
  .click();
assert.match(
  await page.getByLabel("R console output", { exact: true }).innerText(),
  /6/,
);
assert.equal(await page.locator(".custom-r-plots img").count(), 1);
assert.equal(errors.length, 0, errors.join("\n"));
console.log(
  "Notebook code/Markdown persistence, real R run, CSV/SVG/console restoration passed.",
);
await page.addInitScript(() => {
  let delivered = false;
  const observer = new MutationObserver(() => {
    const workspace = document.querySelector(".custom-r-workspace");
    if (workspace?.setResearchSelection && !delivered) {
      delivered = true;
      workspace.setResearchSelection({
        gene: "GPX4",
        pathway: "HALLMARK_OXIDATIVE_PHOSPHORYLATION",
        contrast: "day1_vs_control",
        collections: [],
      });
      observer.disconnect();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
});
await page.reload();
await page.waitForFunction(
  () => document.querySelectorAll(".research-studio-cell-row").length === 4,
);
assert.match(
  await page.getByLabel("R code", { exact: true }).innerText(),
  /selected_ids <- c\("GPX4"\)/,
);
await page
  .locator(".research-studio-cell-row")
  .nth(2)
  .getByRole("button")
  .click();
assert.match(
  await page.getByLabel("R console output", { exact: true }).innerText(),
  /6/,
);
assert.equal(await page.locator(".custom-r-plots img").count(), 1);
console.log(
  "Early atlas selection appended after IndexedDB recovery without losing saved cells/results.",
);
await browser.close();
