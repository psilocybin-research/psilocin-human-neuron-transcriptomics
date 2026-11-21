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

  assert.equal(
    await tools.locator(".atlas-3d-tools-section.tab-active").count(),
    1,
  );
  assert.equal(
    await tools
      .getByRole("tab", { name: "Open Representation & lighting", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  if (
    await tools.evaluate((el) => el.classList.contains("atlas-3d-tools-dock"))
  ) {
    const renderer = await workbench
        .locator(".molecular-renderer-host")
        .boundingBox(),
      panel = await tools.boundingBox();
    assert.ok(
      renderer.x + renderer.width <= panel.x,
      "docked tools reserve renderer space",
    );
    assert.equal(
      await page.locator(".research-views").evaluate((el) => el.inert),
      false,
      "desktop inspector is nonmodal",
    );
  }
  await page.waitForTimeout(450);
  const headerBox = await tools.locator('.atlas-sheet-toolbar').boundingBox();
  const scrollBox = await tools.locator('.atlas-3d-tools-scroll').boundingBox();
  const panelBox = await tools.boundingBox();
  assert.ok(headerBox.y - panelBox.y < 24, 'panel header stays at its top');
  assert.ok(headerBox.y + headerBox.height <= scrollBox.y + 1, 'navigation never overlaps header');
  for (const dark of [false, true]) {
    await page.evaluate(
      (dark) => document.querySelector("#psilocin-app").f7.setDarkMode(dark),
      dark,
    );
    await page.waitForTimeout(250);
    const ratios = await tools
      .locator(".atlas-3d-tools-shortcut")
      .evaluateAll((buttons) => {
        const rgba = (value) => {
          const n = value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0];
          return [n[0], n[1], n[2], n[3] ?? 1];
        };
        const blend = (a, b) =>
          a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));
        const lum = (c) =>
          c
            .map((v) => {
              v /= 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
        return buttons.map((button) => {
          let bg = [255, 255, 255];
          for (const node of [
            ...(function* (el) {
              for (; el; el = el.parentElement) yield el;
            })(button),
          ].reverse())
            bg = blend(rgba(getComputedStyle(node).backgroundColor), bg);
          const fg = blend(rgba(getComputedStyle(button).color), bg),
            a = lum(fg),
            b = lum(bg);
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
      });
    assert.ok(
      ratios.every((ratio) => ratio >= 4.5),
      `tool tab contrast ${dark ? "dark" : "light"}: ${ratios}`,
    );
  }
  await page.evaluate(() =>
    document.querySelector("#psilocin-app").f7.setDarkMode(false),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      document.querySelector(".atlas-3d-tools-sheet.modal-in")?.dataset
        .nonmodal === "false",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(
    () =>
      document.querySelector(".atlas-3d-tools-sheet.modal-in")?.dataset
        .nonmodal === "true",
  );
  assert.equal(
    await page.locator(".research-views").evaluate((el) => el.inert),
    false,
  );
  await tools
    .getByRole("tab", { name: "Open View & camera", exact: true })
    .click();
  await tools
    .getByRole("button", { name: "Fit complete assembly", exact: true })
    .click();
  for (const name of [
    "Representation & lighting",
    "Selection & resolved sequence",
    "Gene evidence & source",
  ]) {
    const shortcut = tools.getByRole("tab", {
      name: `Open ${name}`,
      exact: true,
    });
    await shortcut.click();
    await page.waitForFunction(
      (label) =>
        document
          .querySelector(`button[aria-label="Open ${label}"]`)
          ?.getAttribute("aria-selected") === "true",
      name,
    );
    assert.equal(
      await tools.locator(".breadcrumbs-item-active").textContent(),
      name,
    );
    if (name === "Selection & resolved sequence") {
      await tools.locator(".atlas-3d-tools-residues li").first().waitFor();
      assert.ok(
        (await tools.locator(".atlas-3d-tools-residues li").count()) < 100,
        "resolved sequence remains virtualized",
      );
    }
  }
  await tools.getByRole("tab", { name: "Open Export", exact: true }).click();
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
    .getByRole("tab", { name: "Open Gene evidence & source", exact: true })
    .click();
  await tools
    .locator(".molecular-gene-evidence .card-header")
    .waitFor({ state: "visible" });
  await tools
    .getByRole("tab", { name: "Open View & camera", exact: true })
    .click();
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
  await page.waitForTimeout(450);
  const fullHeader = await tools.locator('.atlas-sheet-toolbar').boundingBox();
  const fullScroll = await tools.locator('.atlas-3d-tools-scroll').boundingBox();
  const fullPanel = await tools.boundingBox();
  assert.ok(fullHeader.y - fullPanel.y < 24);
  assert.ok(fullHeader.y + fullHeader.height <= fullScroll.y + 1);
  const exitBox = await workbench.getByRole('button',{name:'Exit full screen',exact:true}).boundingBox();
  assert.ok(exitBox.y >= 0 && exitBox.y + exitBox.height <= 900, 'fullscreen close is entirely visible');
  assert.ok(exitBox.y + exitBox.height <= fullPanel.y, 'fullscreen close and tools panel stay separate');
  await tools
    .getByRole("tab", {
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
    .getByRole("tab", { name: "Open Gene evidence & source", exact: true })
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
