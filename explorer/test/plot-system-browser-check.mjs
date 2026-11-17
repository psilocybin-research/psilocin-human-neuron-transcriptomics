import { chromium, firefox, webkit } from "@playwright/test";
import assert from "node:assert/strict";
const engine = process.env.ATLAS_BROWSER || "chromium",
  base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const errors = [];
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      hasTouch: true,
    });
    page.setDefaultTimeout(20000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(base + "#view=comparison");
    await page.locator("[data-framework7]").waitFor();
    await page
      .locator(".comparison-gene-plot[data-plot-renderer=observable-plot]")
      .waitFor();
    assert.equal(
      await page.locator('select[aria-label="Visualization"] optgroup').count(),
      3,
    );
    assert.equal(await page.locator(".research-steps").count(), 0);
    assert.equal(await page.locator(".comparison-evidence").isVisible(), false);
    assert.equal(
      await page
        .locator(".comparison-stage")
        .evaluate(
          (n) => getComputedStyle(n).gridTemplateColumns.split(" ").length,
        ),
      1,
    );
    const search = page.getByRole("combobox", {
      name: "Search comparison genes",
      exact: true,
    });
    await search.focus();
    assert.ok((await page.getByRole("option").count()) > 1);
    await search.fill("GPX4");
    await page.getByRole("option", { name: /GPX4/ }).click();
    await page.locator(".comparison-evidence .gene-symbol").waitFor();
    assert.equal(
      await page.locator(".comparison-evidence .gene-symbol").innerText(),
      "GPX4",
    );
    await page
      .locator(".research-evidence-sheet")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector("#psilocin-app").dataset.modalOpen === "false",
    );
    await page
      .getByRole("button", { name: "Clear gene selection", exact: true })
      .click();
    assert.equal(await search.inputValue(), "");
    assert.equal(
      await page.locator(".comparison-evidence .gene-symbol").count(),
      0,
    );
    for (const mode of [
      "forest",
      "volcano",
      "distribution",
      "ridgeline",
      "mirrored",
      "enrichment",
    ]) {
      await page
        .locator('select[aria-label="Visualization"]')
        .selectOption(mode, { force: true });
      await page
        .locator(".comparison-plot svg[data-plot-renderer=observable-plot]")
        .first()
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
        `overflow ${width}/${mode}`,
      );
      assert.equal(
        await page
          .locator(
            '.comparison-plot svg [d*="NaN"],.comparison-plot svg [cx="NaN"]',
          )
          .count(),
        0,
      );
      if (mode === "volcano") {
        assert.match(
          await page.locator(".comparison-status").innerText(),
          /21,098 cohort genes/,
        );
        assert.ok((await page.locator("[data-dense-points]").count()) > 0);
      }
    }
    assert.equal(
      await page.locator('select[aria-label="Gene cohort"]').isDisabled(),
      true,
    );
    await page.locator(".analysis-fab-action").click();
    const panel = page.locator(
      width < 1180 ? "#analysis-morph-panel" : "#analysis-controls-sheet",
    );
    await panel
      .getByRole("radio", {
        name: "Pathway enrichment comparison",
        exact: true,
      })
      .waitFor();
    assert.equal(
      await panel.locator(".analysis-option-field:visible").count(),
      1,
    );
    assert.deepEqual(
      await panel.locator(".list-group-title").allTextContents(),
      [
        "Gene effects",
        "Pathway comparisons",
        "OXPHOS expression and membership",
      ],
    );
    await panel.getByRole("button", { name: "Done", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("#psilocin-app").dataset.modalOpen === "false",
    );
    assert.equal(
      await page
        .locator('select[aria-label="Gene cohort"]')
        .evaluate((n) => n.closest(".control").hidden),
      true,
    );
    await page.screenshot({
      path: `/tmp/atlas-comparison-polish-${width}.png`,
    });
    await page.goto(base + "#view=genes");
    const geneSearch = page.getByRole("combobox", {
      name: "Search genes",
      exact: true,
    });
    await geneSearch.waitFor();
    await page
      .getByRole("button", { name: "Clear gene search", exact: true })
      .click();
    await page.getByRole("option").first().waitFor();
    assert.ok(
      (await page.locator(".gene-suggestions [role=option]").count()) > 1,
    );
    await geneSearch.fill("ATP5F1A");
    await page.locator(".gene-suggestions [role=option]").first().waitFor();
    assert.match(await page.locator(".gene-suggestions").innerText(), /ATP5A1/);
    await page.keyboard.press("Escape");
    await page.goto(base + "#view=methods");
    await page.locator(".methods-grid").waitFor();
    const columns = await page
      .locator(".methods-grid")
      .evaluate(
        (n) => getComputedStyle(n).gridTemplateColumns.split(" ").length,
      );
    assert.equal(columns, width < 700 ? 1 : 2);
    await page.screenshot({ path: `/tmp/atlas-methods-${width}.png` });
    if (width >= 1180) {
      await page
        .getByRole("button", { name: "Find a gene", exact: true })
        .click();
      await page.locator(".autocomplete-popup.modal-in").waitFor();
      await page.locator(".autocomplete-popup .item-radio").first().waitFor();
      assert.ok(
        (await page.locator(".autocomplete-popup .item-radio").count()) > 1,
      );
      await page.keyboard.press("Escape");
    }
    await page.goto(base + "#view=pathways&display=table");
    await page.locator(".tree-table").waitFor();
    await page.locator(".tree-table tbody tr").first().hover();
    assert.equal(
      await page
        .locator(".tree-table tbody tr")
        .first()
        .evaluate(
          (n) => getComputedStyle(n).backgroundColor === "rgb(244, 247, 242)",
        ),
      false,
    );
    await page.locator(".analysis-fab-action").click();
    await page
      .locator(
        width < 1180
          ? ".analysis-morph-panel[data-shell-modal-ready=true]"
          : ".analysis-control-sheet.sheet-modal-push-in",
      )
      .waitFor();
    await page.screenshot({ path: `/tmp/atlas-controls-${width}.png` });
    await page.keyboard.press("Escape");
    await page.goto(base + "#view=robustness");
    await page.locator(".gene-diagnostic-disclosure summary").click();
    await page
      .locator(".gene-diagnostics svg[data-plot-renderer]")
      .first()
      .waitFor();
    assert.equal(
      await page.locator(".gene-diagnostics svg[data-plot-renderer]").count(),
      2,
    );
    assert.ok(await page.locator('.gene-diagnostics [role=button][aria-label^="Inspect "]').count() > 0);
    await page.goto(base + "#view=dna");
    await page
      .getByText("Canonical gene panel · includes absent and mixed results", {
        exact: true,
      })
      .click();
    await page
      .getByRole("link", {
        name: "Inspect BRCA1 gene evidence and public context",
        exact: true,
      })
      .first()
      .click();
    await page
      .getByRole("button", {
        name: "View public gene and protein context",
        exact: true,
      })
      .waitFor();
    assert.match(page.url(), /view=genes/);
    await page
      .getByRole("button", {
        name: "View public gene and protein context",
        exact: true,
      })
      .click();
    await page.locator(".gene-information-sheet.modal-in").waitFor();
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    `${engine}: responsive Plot charts, dense genome rendering, linked selection, initial/alias F7 suggestions, native push and diagnostic charts passed.`,
  );
} finally {
  await browser.close();
}
