import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_PATH,
});
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(
      process.env.ATLAS_URL || "http://127.0.0.1:4173/#view=pathways",
    );
    const button = page.getByRole("button", {
      name: "Enter fullscreen",
      exact: true,
    });
    await button.waitFor();
    await button.click();
    await page.waitForFunction(
      () => document.fullscreenElement?.id === "psilocin-app",
    );
    const exit = page.getByRole("button", {
      name: "Exit fullscreen",
      exact: true,
    });
    await exit.waitFor();
    assert.equal(await exit.getAttribute("aria-pressed"), "true");
    if (width < 1180) {
      assert.equal(
        await page.locator(".analysis-fab").getAttribute("data-visible"),
        "true",
      );
      await page.locator(".analysis-fab-action").click();
      await page
        .locator(".analysis-morph-panel")
        .getByRole("button", { name: "Done", exact: true })
        .click();
      await page.locator(".analysis-morph-panel").waitFor({ state: "hidden" });
    }
    const header = await page.locator(".research-navbar").boundingBox();
    const tools = await page.locator(".research-navbar .right").boundingBox();
    assert.ok(
      tools.x >= header.x &&
        tools.x + tools.width <= header.x + header.width + 1,
    );
    await exit.click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await button.waitFor();
    await page.screenshot({ path: `/tmp/atlas-connected-${width}.png` });
    await page.close();
  }
  console.log(
    "App fullscreen passed: mobile/desktop entry, exit, header fit and Controls inside fullscreen.",
  );
} finally {
  await browser.close();
}
