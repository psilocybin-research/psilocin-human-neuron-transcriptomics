import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  for (const width of [390, 1440]) {
    const c = await browser.newContext({ viewport: { width, height: 1000 } }),
      p = await c.newPage(),
      errors = [],
      external = [];
    p.setDefaultTimeout(45000);
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => {
      if (!r.url().startsWith(base) && /^https?:/.test(r.url()))
        external.push(r.url());
    });
    if (width < 700)
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = undefined;
        Element.prototype.webkitRequestFullscreen = undefined;
      });
    await p.goto(base + "#view=overview");
    await p.locator('#psilocin-app[data-framework7]').waitFor();
    assert.equal(
      await p.locator(".oxphos-network-preview-overlay").textContent(),
      "Explore OXPHOS network in 3D",
    );
    await p
      .locator(".oxphos-network-preview")
      .dispatchEvent("pointerdown", { clientX: 100, clientY: 200 });
    assert.equal(
      await p.locator(".oxphos-network-preview .ripple-wave").count(),
      1,
    );
    await p.locator(".oxphos-network-preview").dispatchEvent("pointerup");
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
    await root.getByRole("button", { name: "Find gene", exact: true }).click();
    let search = p.locator(".oxphos-3d-drawer");
    await search.getByRole("searchbox").fill("NDUFA1");
    await search.getByRole("button", { name: "NDUFA1", exact: true }).click();
    const panel = p.locator(
      width >= 1100 ? ".oxphos-3d-evidence" : ".oxphos-3d-drawer",
    );
    await panel.locator(".oxphos-research-panel svg").first().waitFor();
    assert.ok(await root.getAttribute("data-focused-gene"));
    assert.equal(
      await panel.locator(".research-panel-body [data-plot-renderer]").count(),
      2,
    );
    assert.match(await panel.innerText(), /nine.*not nine independent/is);
    await panel.getByRole("tab", { name: "Sensitivity", exact: true }).click();
    await panel
      .getByText("CAMERA: estimated versus fixed gene correlation", {
        exact: true,
      })
      .click();
    assert.ok(
      await panel.locator('[data-sort-value="0.587168975061856"]').count(),
    );
    await panel
      .getByText("Bayesian priors and likelihood sensitivity", { exact: true })
      .click();
    assert.equal(
      await panel
        .getByLabel("Bayesian prior and likelihood")
        .locator("option")
        .count(),
      10,
    );
    await panel
      .getByLabel("Bayesian prior and likelihood")
      .selectOption("student_t4_effect0.5_residual0.5");
    await panel.getByRole("tab", { name: "Protein", exact: true }).click();
    await panel.getByLabel("Matched protein accession").waitFor();
    await panel
      .getByRole("button", { name: "Open interactive structure", exact: true })
      .click();
    await panel.locator("[data-structure-rendered=true]").waitFor();
    assert.match(
      await panel.innerText(),
      /canonical sequence positions mapped/,
    );
    const features = panel.locator(".linked-feature-list button");
    if (await features.count()) {
      await features.first().click();
      assert.match(
        await panel.innerText(),
        /annotated sequence positions highlighted/,
      );
    }
    await panel.getByRole("button", { name: "Surface", exact: true }).click();
    await p.waitForTimeout(400);
    await panel.getByRole("button", { name: "Cartoon", exact: true }).click();
    await p.screenshot({ path: `/tmp/atlas-linked-protein-${width}.png` });
    await panel
      .getByRole("button", { name: "Show in main 3D view", exact: true })
      .click();
    await p.waitForFunction(
      () =>
        document.querySelector(".oxphos-network-3d")?.dataset.molecularView ===
        "true",
    );
    assert.match(
      await root.locator(".oxphos-3d-protein-caption").innerText(),
      /Cα trace.*External structural context/,
    );
    await root
      .getByRole("button", { name: "Toggle Cα beads", exact: true })
      .click();
    await p.screenshot({ path: `/tmp/atlas-main-molecule-${width}.png` });
    await root
      .getByRole("button", { name: "Back to membership", exact: true })
      .click();
    assert.equal(await root.getAttribute("data-molecular-view"), "false");
    await root.getByRole("button", { name: /NDUFA1 · exact values/ }).click();

    await panel.getByRole("tab", { name: "Evidence", exact: true }).click();
    await p.screenshot({ path: `/tmp/atlas-linked-evidence-${width}.png` });
    await panel.getByRole("button", { name: "Done", exact: true }).click();
    // Selecting another gene updates every view rather than retaining the previous protein.
    await root.getByRole("button", { name: "Find gene", exact: true }).click();
    search = p.locator(".oxphos-3d-drawer");
    await search.getByRole("searchbox").fill("COX5A");
    await search.getByRole("button", { name: "COX5A", exact: true }).click();
    await panel.locator(".oxphos-research-panel").waitFor();
    assert.match(await panel.locator("h4").first().innerText(), /COX5A/);
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal(external.length, 0, external.join("\n"));
    console.log(
      `PASS ${width}px linked estimates/profiles, exact CAMERA and ten Bayesian settings, protein coordinates/sequence mapping, feature highlighting, surface/cartoon and selection synchronization; no external requests.`,
    );
    await c.close();
  }
} finally {
  await browser.close();
}
