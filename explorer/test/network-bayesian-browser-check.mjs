import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  for (const width of [390, 1280]) {
    console.log("Checking network Bayesian evidence at width", width);
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    page.setDefaultTimeout(45000);
    if (width < 700)
      await page.addInitScript(() => {
        Element.prototype.requestFullscreen = undefined;
        Element.prototype.webkitRequestFullscreen = undefined;
      });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.stack));
    await page.goto(
      (process.env.ATLAS_URL || "http://127.0.0.1:4173/") + "#view=overview",
    );
    await page
      .getByRole("button", {
        name: "Explore 3D gene–pathway membership",
        exact: true,
      })
      .click();
    const network = page.locator(".oxphos-network-3d");
    await network.waitFor();
    const evidence =
      width < 700
        ? network
            .locator(".oxphos-mobile-toolbar")
            .getByRole("button", { name: "Evidence", exact: true })
        : network.locator(".oxphos-3d-selected-summary");
    await evidence.click();
    if (width === 1280) {
      await page.waitForFunction(
        () =>
          document.querySelector(".oxphos-network-3d")?.dataset
            .rendererReady === "true",
      );
      await network.evaluate((root) =>
        root.setResearchSelection({ gene: "NDUFA9" }),
      );
      await network.locator(".oxphos-research-panel").waitFor();
      for (const name of ["Evidence", "Compare", "Protein", "Sensitivity"])
        assert.equal(
          await network
            .locator(".research-panel-tabs")
            .getByRole("tab", { name, exact: true })
            .count(),
          1,
        );
    }

    assert.equal(
      await network.locator(".network-gene-evidence-body").isVisible(),
      true,
    );
    await network
      .getByRole("tab", { name: "Bayes factors", exact: true })
      .click();
    const card = network.locator(".network-bayesian-evidence");
    await card.waitFor();
    const summary = card.locator(".network-bayesian-summary");
    assert.match(await summary.innerText(), /37\.8/);
    assert.match(await card.innerText(), /182 originally mapped/);
    await network
      .locator(".oxphos-3d-days")
      .getByRole("button", { name: "Day 3", exact: true })
      .click();
    assert.match(await summary.innerText(), /9\.88/);
    assert.equal(await summary.locator(".network-bayesian-day").count(), 1);
    await card
      .getByRole("button", { name: "Compare days", exact: true })
      .click();
    assert.equal(await summary.locator(".network-bayesian-day").count(), 2);
    await card.locator(".network-bayesian-explore .item-link").first().click();
    const controls = card.locator(".directional-evidence");
    await controls.waitFor();
    await controls
      .locator(".directional-robustness-chart")
      .getByRole("button", {
        name: "Day 1: explore effect SD 1, residual scale 0.5, LKJ eta 2",
        exact: true,
      })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector(".network-bayesian-summary")
        ?.textContent.includes("Normal effect SD 1;"),
    );
    assert.equal(
      await controls.getAttribute("aria-busy"),
      null,
      "declared priors load cached results",
    );
    assert.doesNotMatch(await summary.innerText(), /37\.8/);
    assert.equal(
      await card.evaluate((e) => e.scrollWidth > e.clientWidth + 2),
      false,
    );
    if (width === 390) {
      await card
        .locator(":scope > .card-content > button")
        .filter({ hasText: "Open analysis in R" })
        .click();
    } else {
      await card
        .getByRole("button", {
          name: "Open full Bayesian analysis",
          exact: true,
        })
        .click();
      await page.locator(".bayesian-analysis-page").waitFor();
      await page
        .locator(".bayesian-analysis-page")
        .getByRole("button", { name: "Open analysis in R", exact: true })
        .click();
    }
    await page.locator(".research-studio-workspace").waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".cm-content")].some((e) =>
        e.textContent.includes("Transferred OXPHOS directional analysis"),
      ),
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "PASS: day-linked score evidence, compare, shared cached priors, mobile fit and full-analysis navigation.",
  );
} finally {
  await browser.close();
}
