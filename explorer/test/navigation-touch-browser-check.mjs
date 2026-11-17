import { chromium, firefox, webkit } from "@playwright/test";
import assert from "node:assert/strict";
const engine = process.env.ATLAS_BROWSER || "chromium";
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/genes*.json", async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route.continue();
  });
  await page.goto(base);
  await page.locator("[data-framework7]").waitFor();
  assert.ok(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
    "New visitors follow a dark system preference",
  );
  for (let i = 0; i < 8; i++)
    for (const view of ["comparison", "pathways", "genes"]) {
      const button = page.locator(`[data-quick=${view}]`);
      const r = await button.boundingBox();
      await page.touchscreen.tap(
        r.x + r.width / 2,
        r.y + (i % 2 === 0 ? 18 : 43),
      );
      await page.waitForFunction(
        (view) =>
          new URLSearchParams(location.hash.slice(1)).get("view") === view,
        view,
      );
      assert.equal(
        await page
          .locator(".research-tabbar .tab-link-active")
          .getAttribute("data-quick"),
        view,
      );
      assert.equal(
        await page.locator(".research-views").evaluate((e) => e.inert),
        false,
      );
    }
  await page.locator("[data-quick=comparison]").tap();
  await page
    .locator(".comparison-plot svg,.comparison-plot canvas")
    .first()
    .waitFor();
  await page
    .locator(".comparative-views")
    .evaluate((e) => (e.dataset.identity = "retained"));
  await page.locator("[data-quick=comparison]").tap();
  assert.equal(
    await page.locator(".comparative-views").getAttribute("data-identity"),
    "retained",
    "Reselecting a tab preserves its chart",
  );
  await page.locator("[data-quick=sources]").tap();
  await page.locator(".research-sources.modal-in").waitFor();
  await page.getByRole("button", { name: "Close sources", exact: true }).tap();
  await page.locator(".research-sources").waitFor({ state: "hidden" });
  await page.locator("[data-quick=pathways]").tap();
  await page.locator(".pathway-explorer").waitFor();
  await page.locator(".analysis-fab-action").tap();
  await page
    .locator("#analysis-morph-panel[data-shell-modal-ready=true]")
    .waitFor();
  await page.getByRole("button", { name: "Done", exact: true }).tap();
  await page.locator("#analysis-morph-panel").waitFor({ state: "hidden" });
  await page.locator("[data-quick=comparison]").tap();
  await page.waitForFunction(() => location.hash.includes("view=comparison"));
  const theme = page.getByRole("switch", { name: "Dark mode", exact: true });
  await theme.tap();
  await page.waitForFunction(
    () => !document.documentElement.classList.contains("dark"),
  );
  await page.reload();
  await page.locator("[data-framework7]").waitFor();
  assert.equal(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
    false,
    "Saved light preference survives reload",
  );
  assert.deepEqual(errors, []);
  console.log(
    `${engine}: 24 trusted icon/label taps, rapid navigation during loading, overlay recovery, active-view preservation and system appearance / explicit light persistence passed.`,
  );
  await context.close();
} finally {
  await browser.close();
}
