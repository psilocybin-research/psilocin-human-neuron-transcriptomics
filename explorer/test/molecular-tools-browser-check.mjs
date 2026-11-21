import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(
    (process.env.ATLAS_URL || "http://127.0.0.1:4173/") +
      "#view=mitocarta&mitoview=structure",
  );
  const workbench = page.locator(".molecular-workbench");
  await page
    .locator(".molecular-workbench[data-molecular-ready=true]")
    .waitFor({ timeout: 120000 });
  const fab = workbench.getByRole("button", {
    name: "Molecular tools",
    exact: true,
  });
  await fab.waitFor({ state: "visible" });
  assert.equal(
    await workbench.locator(".molecular-renderer-host .atlas-3d-fab").count(),
    0,
  );
  assert.equal(
    (await workbench.locator(".molecular-renderer-host canvas").count()) > 0,
    true,
  );
  await fab.click();
  const tools = page.locator(".atlas-3d-tools-sheet.modal-in");
  await tools.waitFor();
  await tools
    .getByRole("button", { name: "Fit complete assembly", exact: true })
    .click();
  for (const name of [
    "Representation & lighting",
    "Selection & resolved sequence",
    "Gene evidence & source",
  ]) {
    const shortcut = tools.getByRole("button", {
      name: `Open ${name}`,
      exact: true,
    });
    await shortcut.click();
    await page.waitForFunction(
      (label) =>
        document
          .querySelector(`button[aria-label="Open ${label}"]`)
          ?.getAttribute("aria-expanded") === "true",
      name,
    );
    assert.equal(
      await tools.locator(".breadcrumbs-item-active").textContent(),
      name,
    );
  }
  await tools
    .locator(".gene-annotation-toggle")
    .filter({ hasText: /^Export$/ })
    .click();
  await tools
    .getByRole("button", {
      name: "Download all mapped RNA data (.csv)",
      exact: true,
    })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .locator(".download-confirmation")
    .getByRole("button", { name: "Download", exact: true })
    .click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), "9TI4-mapped-genes-RNA.csv");
  const { readFile } = await import("node:fs/promises");
  const csv = await readFile(await download.path(), "utf8");
  assert.equal(csv.includes("rna_log2_fold_change"), true);
  assert.equal(csv.includes("source_url"), true);
  assert.equal(csv.trim().split(/\r?\n/).length, 133);

  await tools.getByRole("button", { name: "Done", exact: true }).click();
  await tools.waitFor({ state: "detached" });
  await workbench
    .getByRole("button", { name: "Day 3 RNA", exact: true })
    .click();
  await workbench
    .locator(".molecular-legend")
    .filter({ hasText: "Day 3 / common control" })
    .waitFor({ timeout: 60000 });
  await fab.waitFor({ state: "visible" });
  await page.setViewportSize({ width: 390, height: 844 });
  await fab.click();
  await tools.waitFor();
  assert.equal(await tools.locator(".breadcrumbs").isVisible(), true);
  await tools
    .getByRole("button", { name: "Open Gene evidence & source", exact: true })
    .click();
  await tools
    .locator(".molecular-gene-evidence .card-header")
    .waitFor({ state: "visible" });
  await tools
    .getByRole("button", { name: "Fullscreen / return", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      Boolean(document.fullscreenElement) ||
      Boolean(document.querySelector(".atlas-3d-fullscreen-popup.modal-in")),
    {},
    { timeout: 10000 },
  );
  await fab.click();
  await tools.waitFor();
  await tools
    .getByRole("button", {
      name: "Open Representation & lighting",
      exact: true,
    })
    .click();
  await tools
    .getByRole("button", { name: "Choose Canvas background", exact: true })
    .click();
  const choice = page.locator(".research-choice-modal.modal-in");
  await choice.waitFor({ timeout: 5000 }).catch(async (error) => {
    console.log(
      await page.evaluate(() => ({
        fullscreen: document.fullscreenElement?.className,
        modals: [
          ...document.querySelectorAll(".sheet-modal,.popover,.popup"),
        ].map((e) => ({
          class: e.className,
          connected: e.isConnected,
          parent: e.parentElement.className,
          display: getComputedStyle(e).display,
          text: e.textContent.slice(0, 100),
        })),
      })),
    );
    throw error;
  });
  assert.equal(
    await choice.evaluate(
      (element) =>
        !document.fullscreenElement ||
        document.fullscreenElement.contains(element),
    ),
    true,
  );
  await choice.locator("label").filter({ hasText: "Light" }).click();
  await choice.waitFor({ state: "detached" });
  await tools
    .getByRole("button", { name: "Open Gene evidence & source", exact: true })
    .click();
  await tools
    .locator(".molecular-gene-evidence .card-header")
    .waitFor({ state: "visible" });

  await tools.getByRole("button", { name: "Done", exact: true }).click();
  await tools.waitFor({ state: "detached" });
  await page.evaluate(() =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : document
          .querySelector(".atlas-3d-fullscreen-popup")
          ?.f7Modal?.close(false),
  );
  const tab = page.getByRole("tab", { name: "Complexes", exact: true });
  await tab.click();
  await page.getByRole("tab", { name: "Structure", exact: true }).click();
  await fab.waitFor({ state: "visible" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: molecular FAB survives renderer initialization, RNA updates, mobile resize and tab return; F7 tools open and close.",
  );
} finally {
  await browser.close();
}
