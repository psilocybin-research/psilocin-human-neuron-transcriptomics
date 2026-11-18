import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { retainedGene } from "../src/components/network-statistics.js";
import snapshot from "../src/assets/vendor/oxphos-network-data.js";
const archive = snapshot.nodes.filter((n) => n.type === "gene");
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  for (const width of [390, 1440]) {
    const c = await browser.newContext({ viewport: { width, height: 950 } }),
      p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    if (width < 700)
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = undefined;
      });
    await p.route(/components\/atlas\.[a-f0-9]+\.js/, async (r) => {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await r.continue();
    });
    await p.goto("http://127.0.0.1:4173/#view=overview", {
      waitUntil: "commit",
    });
    await p.locator("#atlas-boot > svg").waitFor();
    await p
      .getByRole("button", {
        name: "Explore 3D gene–pathway membership",
        exact: true,
      })
      .waitFor();
    await p.waitForFunction(() => !document.getElementById("atlas-boot"));
    await p
      .getByRole("button", {
        name: "Explore 3D gene–pathway membership",
        exact: true,
      })
      .click();
    await p.waitForFunction(
      () =>
        document.querySelector(".oxphos-network-3d")?.dataset.rendererReady ===
        "true",
    );
    const root = p.locator(".oxphos-network-3d");
    await root
      .getByRole("button", { name: "Statistical comparison", exact: true })
      .click();
    const panel = p.locator(
      width >= 1100 ? ".oxphos-3d-evidence" : ".oxphos-3d-drawer",
    );
    await panel.getByRole("tab", { name: "Compare", exact: true }).waitFor();
    const point = panel.locator("svg [role=button]").filter({ hasText: "" });
    await point.first().waitFor();
    const label = await point.last().getAttribute("aria-label");
    await point.last().press("Enter");
    await panel.locator(".oxphos-research-panel").waitFor();
    assert.match(
      await panel.locator("h4").first().innerText(),
      new RegExp(label.split(":")[0].replace("Select ", "")),
    );
    assert.equal(
      await panel
        .getByRole("tab", { name: "Compare", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await panel.getByRole("button", { name: "Done", exact: true }).click();
    await root.getByRole("button", { name: "Filters", exact: true }).click();
    await p
      .getByLabel("Network statistical filter", { exact: true })
      .selectOption("both05");
    const expected = archive.filter((g) => retainedGene(g, "both05")).length;
    assert.match(
      await root.locator(".oxphos-3d-status").innerText(),
      new RegExp(`${expected} / 113.*both days`),
    );
    await p
      .locator(".oxphos-3d-drawer")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await root
      .getByRole("button", { name: "Compare days", exact: true })
      .click();
    await p.waitForFunction(
      () => document.querySelectorAll(".oxphos-3d-pane canvas").length === 2,
    );
    await p.screenshot({ path: `/tmp/atlas-linked-comparison-${width}.png` });
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${width}px immediate inline startup logo/removal, accessible linked scatter selection, preserved compare tab, exact archived both-day FDR count and synchronized views.`,
    );
    await c.close();
  }
} finally {
  await browser.close();
}
