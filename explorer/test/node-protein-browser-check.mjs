import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import snapshot from "../src/assets/vendor/oxphos-network-data.js";
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
    });
    const page = await context.newPage(),
      errors = [],
      external = [];
    page.setDefaultTimeout(60000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
        external.push(request.url());
    });
    await context.addInitScript(() => {
      Element.prototype.requestFullscreen = undefined;
    });
    await page.goto(base);
    await page.locator("#psilocin-app[data-framework7]").waitFor();
    await page.locator(".oxphos-network-preview").click();
    await page.waitForFunction(
      () =>
        document.querySelector(".oxphos-network-3d")?.dataset.entranceReady ===
        "true",
    );
    const root = page.locator(".oxphos-network-3d"),
      canvas = root.locator(".oxphos-3d-pane canvas").first();
    const bounds = await canvas.boundingBox();
    const node = snapshot.nodes.find((n) => n.symbol === "NDUFB7");
    const tangent = Math.tan((50 * Math.PI) / 360),
      aspect = bounds.width / bounds.height;
    const distance = Math.max(
      520 / (2 * tangent),
      640 / (2 * tangent * aspect),
    );
    const scale = bounds.height / (2 * tangent * (distance - node.z));
    await page.mouse.move(
      bounds.x + bounds.width / 2 + node.x * scale,
      bounds.y + bounds.height / 2 - node.y * scale,
    );
    await page.waitForTimeout(300);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(2000);
    await page.waitForFunction(
      () =>
        document.querySelector(".oxphos-network-3d")?.dataset
          .nodeProteinReady === "true",
    );
    await page.waitForFunction(
      () =>
        document.querySelector(".oxphos-network-3d")?.dataset.cameraMoving ===
        "false",
    );
    const evidence = page.locator(
      width >= 1100 ? ".oxphos-3d-evidence" : ".oxphos-3d-drawer",
    );
    await evidence
      .getByRole("heading", { name: "Linked gene evidence", exact: true })
      .waitFor();
    await evidence.getByRole("button", { name: "Done", exact: true }).click();
    const open = root.getByRole("button", {
      name: "Expand structure for NDUFB7",
      exact: true,
    });
    await page.screenshot({ path: `/tmp/atlas-node-preview-${width}.png` });
    await open.click();
    await root.locator(".network-protein-overlay canvas").waitFor();
    assert.equal(await root.getAttribute("data-structure-overlay"), "true");
    assert.equal(await root.locator(".oxphos-3d-pane canvas").count(), 1);
    const stats = root.locator(".network-protein-statistics");
    await stats
      .getByRole("button", { name: "Gene statistics · archived RNA-seq" })
      .click();
    await stats.locator("tbody tr").first().waitFor({ state: "visible" });
    assert.equal(await stats.locator("tbody tr").count(), 3);
    assert.match(await stats.innerText(), /95% Wald interval/);
    await page.waitForTimeout(550);
    await page.screenshot({ path: `/tmp/atlas-node-protein-${width}.png` });
    await root
      .getByRole("button", { name: "Close structure", exact: true })
      .click();
    await root
      .locator(".network-protein-overlay")
      .waitFor({ state: "detached" });
    assert.equal(await root.getAttribute("data-node-protein-ready"), "true");
    const outside = await root.locator(".oxphos-3d-identity").boundingBox();
    await page.mouse.click(outside.x + 4, outside.y + 4);
    await page.waitForFunction(() =>
      document.querySelector(".oxphos-network-3d")?.dataset.nodeProteinReady === "false");
    await root.getByRole("button", { name: "Find gene", exact: true }).click();
    const drawer = page.locator(".oxphos-3d-drawer");
    await drawer.getByRole("searchbox").fill("NDUFA1");
    await drawer.getByRole("button", { name: "NDUFA1", exact: true }).click();
    await page.waitForFunction(() =>
      Boolean(
        document.querySelector(".oxphos-network-3d")?.dataset.locatingGene,
      ),
    );
    await page.waitForFunction(
      () =>
        document.querySelector(".oxphos-network-3d")?.dataset.locatingGene ===
        "",
    );

    assert.equal(await root.getAttribute("data-node-protein-ready"), "false");
    assert.equal(await root.locator(".network-node-protein-caption").isHidden(), true);
    assert.equal(await root.getByRole("button", { name: "Layout", exact: true }).isVisible(), true);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log(
      `PASS ${width}px real node click, lazy hosted coordinate parsing, adjacent molecular preview, full overlay and return; no external requests.`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
