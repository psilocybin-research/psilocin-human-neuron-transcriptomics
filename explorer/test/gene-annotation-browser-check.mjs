import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
const record = {
  id: "ENSG00000167468",
  species: "homo_sapiens",
  object_type: "Gene",
  version: 999,
  display_name: "GPX4",
  description: "<script>untrusted text</script>",
  start: 1106616,
  end: 1109490,
  seq_region_name: "19",
  strand: 1,
  assembly_name: "GRCh38",
  biotype: "protein_coding",
};
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let calls = 0;
    await page.route("https://rest.ensembl.org/**", async (route) => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        json: record,
        headers: { "access-control-allow-origin": "*" },
      });
    });
    await page.goto(base + "#view=genes&gene=GPX4");
    const panel = page.locator(".gene-annotation");
    await panel.waitFor();
    const profiles = page.getByRole("img", {
      name: /variance-stabilized expression across nine pooled profiles/,
    });
    assert.equal(await profiles.locator("circle").count(), 9);
    assert.equal(await profiles.locator('g[aria-label="line"]').count(), 0);
    assert.equal(calls, 0, "no automatic public annotation request");
    await page
      .getByRole("button", { name: "View public gene and protein context" })
      .click();
    assert.equal(
      await panel
        .getByRole("button", { name: "Public gene and protein context" })
        .getAttribute("aria-expanded"),
      "true",
    );
    await panel
      .getByRole("button", { name: "Load current annotation" })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector(".app-loading-progress").dataset.visible ===
        "true",
    );
    const spinner = panel.locator(".gene-annotation-result .preloader");
    await spinner.waitFor();
    assert.equal(await spinner.getAttribute("aria-hidden"), "true");
    assert.equal(await spinner.locator(".preloader-inner-line").count(), 8);
    assert.equal(Math.round((await spinner.boundingBox()).width), 16);
    await panel.locator(".gene-annotation-fields").waitFor();
    assert.equal(
      await panel.locator(".gene-annotation-result .preloader").count(),
      0,
    );
    assert.equal(calls, 1);
    assert.ok(
      (await panel.innerText()).includes("current gene version differs"),
    );
    assert.ok(
      (await panel.innerText()).includes("<script>untrusted text</script>"),
    );
    assert.equal(await panel.locator("script").count(), 0);
    assert.equal(
      await panel
        .getByRole("link", { name: "Ensembl API source" })
        .getAttribute("target"),
      "_blank",
    );
    await panel
      .getByRole("button", { name: "Public gene and protein context" })
      .click();
    await panel
      .getByRole("button", { name: "Public gene and protein context" })
      .click();
    assert.equal(calls, 1);
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage();
  let calls = 0;
  await page.route("https://rest.ensembl.org/**", async (route) => {
    calls++;
    await route.fulfill({ json: { ...record, species: "mus_musculus" } });
  });
  await page.goto(base + "#view=genes&gene=GPX4");
  const panel = page.locator(".gene-annotation");
  await panel
    .getByRole("button", { name: "Public gene and protein context" })
    .click();
  await panel.getByRole("button", { name: "Load current annotation" }).click();
  await page
    .getByText(
      "The provider returned a different gene or species. No annotation was applied.",
    )
    .waitFor();
  assert.equal(await panel.locator(".gene-annotation-fields").count(), 0);
  await panel.getByRole("button", { name: "Load current annotation" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".gene-annotation-result")
        .getAttribute("aria-busy") === "false",
  );
  assert.equal(calls, 2);
  await page.close();
  console.log(
    "Native F7 annotation accordion, opt-in loading, source/version provenance, text safety and mismatch/retry passed.",
  );
} finally {
  await browser.close();
}
