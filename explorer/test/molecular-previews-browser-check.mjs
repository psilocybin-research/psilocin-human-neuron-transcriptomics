import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({
        viewport: { width, height: 960 },
        colorScheme: width === 390 ? "light" : "dark",
        serviceWorkers: "block",
      }),
      errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => requests.push(r.url()));
    await page.goto(base + "#view=genes&gene=ENSG00000138495.2");
    await page.locator("#gene-search-input").fill("COX17");
    await page
      .locator(".gene-suggestions .gene-structure-preview img")
      .first()
      .waitFor();
    if (width < 851)
      await page
        .getByRole("button", { name: "View evidence", exact: true })
        .click();
    const container =
      width < 851
        ? page.locator(".research-evidence-sheet")
        : page.locator(".atlas-body");
    const preview = container
      .getByRole("button", { name: /Open AlphaFold structure .* for COX17/ })
      .first();
    await preview.waitFor();
    await preview.locator("img").evaluate((image) => image.decode());
    const styles = await preview.evaluate((button) => {
      const s = getComputedStyle(button),
        image = button.querySelector("img");
      return {
        border: s.borderTopWidth,
        padding: s.paddingTop,
        background: s.backgroundColor,
        width: image.naturalWidth,
        height: image.naturalHeight,
        buttonWidth: button.getBoundingClientRect().width,
      };
    });
    assert.equal(styles.border, "0px");
    assert.equal(styles.padding, "0px");
    assert.equal(styles.background, "rgba(0, 0, 0, 0)");
    assert.equal(styles.width, 256);
    assert.equal(styles.height, 192);
    assert.equal(styles.buttonWidth, 144);
    assert.equal(
      requests.some((url) => /\/3dmol\./.test(url)),
      false,
      "No interactive runtime is loaded for a thumbnail.",
    );
    await page.screenshot({ path: `/tmp/atlas-gene-preview-${width}.png` });
    await preview.click();
    await page
      .locator(".gene-information-sheet [data-structure-rendered=true]")
      .first()
      .waitFor({ timeout: 30000 });
    await page
      .locator(".gene-information-sheet")
      .getByText("Q14061 · Previewed model", { exact: true })
      .waitFor();
    assert.equal(
      requests.some((url) =>
        /^https:\/\/(?:rest\.ensembl|rest\.uniprot|alphafold\.ebi|files\.rcsb)/.test(
          url,
        ),
      ),
      false,
    );
    assert.equal(
      await page.locator(".gene-connection-confirmation").count(),
      0,
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });
  await page.goto(base + "#view=landscape");
  await page.locator(".landscape-layout .gene-detail-identity").waitFor();
  assert.equal(await page.locator(".oxphos-context").count(), 0);
  for (const title of ["Atlas tour", "Sources & citation", "Install app"])
    assert.equal(
      await page
        .locator(".research-nav")
        .getByRole("button", { name: title, exact: true })
        .locator(".item-media svg")
        .count(),
      1,
    );
  const identity = page.locator(".landscape-layout .gene-detail-identity");
  assert.equal(
    await identity.evaluate((n) => n.scrollWidth <= n.clientWidth),
    true,
  );
  await page.screenshot({ path: "/tmp/atlas-landscape-previews.png" });
  await page.close();
  console.log(
    "Local lazy previews, borderless responsive images, exact-model opening, no provider calls, sidebar icons and text-only dense heatmap passed.",
  );
} finally {
  await browser.close();
}
