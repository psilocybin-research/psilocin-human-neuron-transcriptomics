import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:4173/");
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#psilocin-app")?.f7),
  );
  await page.evaluate(() => {
    const root = document.querySelector("#psilocin-app");
    const el = document.createElement("section");
    el.className = "sheet-modal";
    el.setAttribute("aria-label", "Interaction check");
    el.innerHTML =
      '<button style="visibility:hidden">Hidden</button><button tabindex="-1">Programmatic only</button><div aria-hidden="true"><button>Excluded</button></div><button id="focus-first">First action</button><button id="focus-last">Last action</button>';
    root.append(el);
    window.checkSheet = root.f7.sheet.create({ el, backdrop: true });
    checkSheet.open(false);
  });
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "focus-first",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "focus-last",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "focus-first",
  );
  assert.equal(
    await page.locator(".research-views").evaluate((el) => el.inert),
    true,
  );
  await page.evaluate(() => {
    const el = checkSheet.el;
    checkSheet.destroy();
    el.remove();
  });
  assert.equal(
    await page.locator(".research-views").evaluate((el) => el.inert),
    false,
  );
  assert.equal(
    await page.locator("#psilocin-app").getAttribute("data-modal-open"),
    "false",
  );
  await page.evaluate(() => {
    const root = document.querySelector("#psilocin-app"),
      host = document.createElement("section");
    host.id = "dialog-fullscreen";
    const button = document.createElement("button");
    button.textContent = "Check fullscreen dialog";
    button.onclick = async () => {
      await host.requestFullscreen();
      root.f7.dialog.prompt("Analysis name", "Rename analysis", () => {});
    };
    host.append(button);
    root.append(host);
  });
  await page
    .getByRole("button", { name: "Check fullscreen dialog", exact: true })
    .click();
  const dialog = page.locator("#dialog-fullscreen .dialog");
  await dialog.waitFor();
  await dialog.locator("input").fill("Example");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "detached" });
  await page.evaluate(() => document.exitFullscreen());
  assert.equal(
    await page.locator(".research-views").evaluate((el) => el.inert),
    false,
  );
  for (const view of [
    "genes",
    "pathways",
    "mitocarta",
    "comparison",
    "methods",
    "overview",
  ]) {
    await page.evaluate((view) => {
      location.hash = `view=${view}`;
    }, view);
    await page
      .locator(`[data-section="${view}"][aria-current=page]`)
      .waitFor({ state: "attached" });
    await page.waitForTimeout(150);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 2,
      ),
      true,
      `mobile overflow ${view}`,
    );
    assert.equal(
      await page.locator(".research-views").evaluate((el) => el.inert),
      false,
      `stale modal ${view}`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: F7 keyboard focus, direct surface destruction, native fullscreen prompts and mobile section navigation.",
  );
} finally {
  await browser.close();
}
