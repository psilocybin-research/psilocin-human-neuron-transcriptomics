import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  }),
  p = await b.newPage({ viewport: { width: 1280, height: 900 } }),
  errors = [];
p.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("ERROR", e.message);
});
try {
  await p.goto(
    (process.env.ATLAS_URL || "http://127.0.0.1:4173/") +
      "#view=mitocarta&mitoview=structure",
  );
  const host = p.locator(".mitochondrial-explorer");
  await host
    .locator("[data-molecular-ready=true]")
    .waitFor({ timeout: 120000 });
  assert.equal(
    (await host.locator(".molecular-stage canvas").count()) > 0,
    true,
  );
  assert.equal(
    await host.getByRole("button", { name: /Load.*Mol/ }).count(),
    0,
  );
  assert.equal(
    await host.locator(".msp-viewport-top-left-controls").isVisible(),
    false,
  );
  assert.equal(await host.locator(".msp-viewport-controls").isVisible(), false);
  assert.equal(
    await host.locator(".msp-plugin .research-smart-select").count(),
    0,
  );
  await host.getByRole("button", { name: "Day 3 RNA", exact: true }).click();
  await host
    .locator(".molecular-legend")
    .filter({ hasText: "Day 3 / common control" })
    .waitFor();
  await host
    .getByRole("button", { name: "Molecular tools", exact: true })
    .click();
  const tools = p.locator(".atlas-3d-tools-sheet.modal-in");
  await tools
    .getByRole("tab", {
      name: "Open Representation & lighting",
      exact: true,
    })
    .click();
  await tools
    .getByRole("button", {
      name: "Choose Molecular representation",
      exact: true,
    })
    .click();
  const choice = p.locator(".research-choice-modal.modal-in");
  await choice
    .locator("label")
    .filter({ hasText: "Surface · selected chain" })
    .click();
  await choice.waitFor({ state: "hidden" });
  await host.locator(".molecular-workbench").waitFor();
  await p.waitForFunction(
    () =>
      !document.querySelector(".molecular-workbench").hasAttribute("aria-busy"),
  );
  await tools
    .getByLabel("Molecular subunit", { exact: true })
    .selectOption({ index: 5 });
  await p.waitForFunction(
    () =>
      !document.querySelector(".molecular-workbench").hasAttribute("aria-busy"),
  );
  await tools.getByRole("button", { name: "Done", exact: true }).click();
  await tools.waitFor({ state: "detached" });
  await host.getByRole("tab", { name: "Spatial context", exact: true }).click();
  await host.locator("[data-spatial-ready=true]").waitFor();
  await host
    .getByRole("button", { name: "Inspect spatial complex V", exact: true })
    .click();
  assert.equal(await host.getAttribute("data-pathway"), "CV_subunits");
  await host.getByRole("tab", { name: "Structure", exact: true }).click();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth + 2,
  );
  assert.equal(
    await host
      .locator(".molecular-workbench .molecular-stage canvas")
      .isVisible(),
    true,
  );
  await host
    .locator(".molecular-nodes-disclosure .gene-annotation-toggle")
    .click();
  await host.locator(".molecular-nodes-reference img").waitFor();
  await host
    .locator(".molecular-nodes-reference img")
    .evaluate((image) => image.decode());
  assert.equal(
    await host
      .locator(".molecular-nodes-reference img")
      .evaluate((image) => image.naturalWidth > 0),
    true,
  );
  await host
    .getByRole("button", { name: /Send .* to R Studio/ })
    .last()
    .click();
  await p.waitForFunction(() => location.hash.includes("view=custom-r"));
  assert.equal(await p.locator(".molecular-workbench").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS integrated F7 Mol*: automatic activation, anatomy/RNA modes, molecular representations, linked gene/R evidence, spatial complex selection, reference artwork, mobile layout, disposal.",
  );
} finally {
  await b.close();
}
