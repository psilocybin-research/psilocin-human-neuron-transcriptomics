import { chromium, firefox, webkit } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const engine = process.env.ATLAS_BROWSER || "chromium",
  output = process.env.QA_OUTPUT || "/tmp/atlas-navigation";
await mkdir(output, { recursive: true });
const browser = await { chromium, firefox, webkit }[engine].launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    hasTouch: true,
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(process.env.ATLAS_URL || "http://127.0.0.1:4173/");
  await page.locator("[data-framework7]").waitFor();
  assert.equal(await page.locator('.research-sidebar').evaluate(n=>getComputedStyle(n).backdropFilter.includes('blur')),true);
  assert.equal(await page.locator('.research-navbar .right').evaluate(n=>n.getBoundingClientRect().height),44);
  assert.equal(await page.locator('.source-footer .overview-source-link[target=_blank]').count(),4);
  const group = page
    .locator(".nav-group-toggle")
    .filter({ hasText: "Molecular evidence" });
  assert.equal(await page.locator(".research-nav .accordion-item").count(), 3);
  assert.equal(
    await page.locator(".research-nav .accordion-item .accordion-item").count(),
    0,
  );
  await group.click();
  await page.waitForFunction(
    () => document.querySelector("#nav-group-molecular").inert,
  );
  await page.waitForTimeout(350);
  assert.equal(
    await page.locator("#nav-group-molecular").evaluate((n) => n.clientHeight),
    0,
  );
  await page.reload();
  await page.locator("[data-framework7]").waitFor();
  assert.equal(await group.getAttribute("aria-expanded"), "false");
  await page
    .getByRole("button", {
      name: "View OXPHOS gene-level results",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () => !document.querySelector("#nav-group-molecular").inert,
  );
  assert.equal(await group.getAttribute("aria-expanded"), "true");
  assert.equal(
    (await page.locator(".figure-toolbar .toolbar-pane").count()) > 0,
    true,
  );
  assert.equal(
    await page
      .locator(".figure-toolbar .toolbar-pane")
      .first()
      .evaluate((n) => getComputedStyle(n).backdropFilter.includes("blur")),
    true,
  );
  assert.equal(
    await page
      .locator("button[aria-label=Sources] [data-f7-icon=book]")
      .count(),
    1,
  );
  assert.equal(
    await page.locator(".research-nav [data-section=overview]").isVisible(),
    true,
  );
  assert.equal(
    await page.locator(".research-nav [data-section=methods]").isVisible(),
    true,
  );
  for (const dark of [false, true]) {
    await page.evaluate(
      (d) => document.querySelector("#psilocin-app").f7.setDarkMode(d),
      dark,
    );
    await page.screenshot({
      path: `${output}/${engine}-desktop-${dark ? "dark" : "light"}.png`,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Open section menu", exact: true })
    .click();
  await page
    .locator(".research-sidebar.panel-in[data-shell-modal-ready=true]")
    .waitFor();
  assert.equal(
    await page
      .locator(".research-sidebar")
      .evaluate((n) => getComputedStyle(n).borderRadius),
    "0px",
  );
  const brand = await page.locator(".brand-symbol").evaluate((n) => {
    const a = n.getBoundingClientRect(),
      b = n.firstChild.getBoundingClientRect();
    return {
      x: Math.abs(a.x + a.width / 2 - (b.x + b.width / 2)),
      y: Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)),
    };
  });
  assert.ok(brand.x < 0.1 && brand.y < 0.1);
  await group.focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => document.querySelector("#nav-group-molecular").inert,
  );
  assert.equal(await group.getAttribute("aria-expanded"), "false");
  await page.keyboard.press("Enter");
  assert.equal(await group.getAttribute("aria-expanded"), "true");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${output}/${engine}-mobile-sidebar.png` });
  await page.keyboard.press("Escape");
  await page.locator(".research-sidebar").waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.locator(".desktop-gene-finder").click();
  await page
    .locator(".autocomplete-popup.modal-in[data-shell-modal-ready=true]")
    .waitFor();
  await page.setViewportSize({ width: 350, height: 720 });
  const geneDone = page.locator(".autocomplete-popup .popup-close");
  assert.equal(
    await geneDone.evaluate((n) => {
      const r = n.getBoundingClientRect();
      return n.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      );
    }),
    true,
  );
  await geneDone.tap();
  await page.locator(".autocomplete-popup").waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Sources", "Share analysis", "Analysis controls"]) {
    await page.getByRole("button", { name, exact: true }).click();
    const modal = page
      .locator(".popup.modal-in,.popover.modal-in,.sheet-modal.modal-in,.analysis-morph-panel.modal-in")
      .last();
    await modal.waitFor();
    await page.waitForFunction(
      () => document.querySelector(".research-views").inert,
    );
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(
          ".popup.modal-in,.popover.modal-in,.sheet-modal.modal-in,.analysis-morph-panel.modal-in",
        ),
      ].every((n) => n.dataset.shellModalReady === "true"),
    );
    const close = modal.getByRole("button", {
      name: name === "Sources" ? "Close sources" : "Done",
      exact: true,
    });
    assert.equal(
      await close.evaluate((n) => {
        const r = n.getBoundingClientRect();
        return n.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
      true,
      "modal Close receives the tap",
    );
    await close.tap();
    await modal.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () => !document.querySelector(".research-views").inert,
    );
    assert.equal(
      await page.locator(".research-views").evaluate((n) => n.inert),
      false,
    );
  }
  assert.equal(
    await page
      .locator(".research-tabbar .toolbar-pane")
      .evaluate((n) => getComputedStyle(n).backdropFilter.includes("blur")),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  console.log(
    `Native F7 accordion persistence, active navigation, glass and centered brand passed (${engine}).`,
  );
} finally {
  await browser.close();
}
