import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
  await page.goto(base);
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#psilocin-app")?.f7),
  );
  const file = (
    await readdir(new URL("../dist/_import/components/", import.meta.url))
  ).find((name) => /^research-dataset-browser\..*\.js$/.test(name));
  await page.evaluate(
    async (url) => {
      window.datasets = await import(url);
      window.inserted = [];
      datasets.openResearchDatasets({
        root: document.querySelector("#psilocin-app"),
        getTables: async () => ({
          genes: [{ id: "ENSG1", effect: 1 }],
          pathways: [],
        }),
        onInsert: (code) =>
          inserted.push({
            code,
            modalOpen:
              document.querySelector("#psilocin-app").dataset.modalOpen,
          }),
        onImport: () => {},
      });
    },
    new URL(`_import/components/${file}`, base).href,
  );
  const sheet = page.locator(".workspace-datasets-sheet");
  await sheet.locator(".workspace-dataset-group").first().waitFor();
  assert.equal(await sheet.locator("details").count(), 0);
  assert.equal(await sheet.locator(".workspace-dataset-group").count(), 2);
  await sheet
    .getByRole("button", { name: "Show genes columns and actions", exact: true })
    .click();
  await sheet
    .getByRole("button", { name: "Inspect in R", exact: true })
    .first()
    .click();
  await sheet.waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => inserted[0].modalOpen), "false");
  assert.match(
    await page.evaluate(() => inserted[0].code),
    /head\(genes, 50\)/,
  );
  await page.goto(base + "#view=comparison&plot=profiles");
  await page.locator(".expression-matrix").waitFor();
  const advanced = page.locator(".comparison-bounds");
  await advanced.locator(".gene-annotation-toggle").click();
  await advanced
    .getByRole("button", { name: "Select expression region", exact: true })
    .click();
  assert.match(await advanced.innerText(), /genes selected/);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: native F7 dataset accordions/actions, deferred R handoff, comparison controls and mobile fit.",
  );
} finally {
  await browser.close();
}
