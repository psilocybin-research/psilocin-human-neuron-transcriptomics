import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  headless: true,
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(
      base +
        "#view=comparison&plot=hexbin&cohort=all&contrast=day1_vs_control&extent=all",
    );
    const picker = page.getByRole("button", {
      name: "Choose Density bin",
      exact: true,
    });
    await picker.waitFor();
    const last = await page
      .locator(".hexbin-picker select")
      .evaluate((select) => {
        const option = select.options[select.options.length - 1];
        return { value: option.value, text: option.textContent };
      });
    await picker.click();
    const modal = page.locator(".research-choice-modal.modal-in");
    await page.waitForFunction(
      () =>
        document.querySelector(".research-choice-modal.modal-in")?.dataset
          .shellModalReady === "true",
    );
    assert.equal(await modal.getAttribute("aria-label"), "Density bin");
    assert.ok(await modal.evaluate((node) => node.matches(".popup")));
    const bounds = await modal.boundingBox();
    assert.ok(
      bounds.x >= -1 &&
        bounds.y >= -1 &&
        bounds.x + bounds.width <= width + 1 &&
        bounds.y + bounds.height <= 961,
      "choice stays within viewport",
    );
    assert.ok(
      (await modal.locator("li").count()) > 0,
      "virtual choices render",
    );
    await modal
      .locator('input[type="search"]')
      .fill(last.text.split(":")[0] + ":");
    const row = modal.locator("label").filter({ hasText: last.text });
    await row.click();
    await page.waitForFunction(
      () =>
        document.querySelector("#psilocin-app").dataset.modalOpen === "false",
    );
    assert.equal(
      await page.locator(".hexbin-picker select").inputValue(),
      last.value,
    );
    const count = Number(last.text.match(/: (\d+) genes/)[1]);
    assert.match(
      await page.locator(".comparison-selection").innerText(),
      new RegExp(`\\b${count} selected genes`),
    );
    await picker.click();
    await page.waitForFunction(
      () =>
        document.querySelector(".research-choice-modal.modal-in")?.dataset
          .shellModalReady === "true",
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () =>
        document.querySelector("#psilocin-app").dataset.modalOpen === "false",
    );
    assert.equal(
      await page.locator(".research-views").evaluate((node) => node.inert),
      false,
    );
    await page
      .getByRole("button", { name: "Choose Effect-axis extent", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector(".research-choice-modal.modal-in")?.dataset
          .shellModalReady === "true",
    );
    assert.ok(
      await modal.evaluate((node) =>
        node.matches(innerWidth <= 700 ? ".sheet-modal" : ".popover"),
      ),
      "short lists retain their native presentation",
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () =>
        document.querySelector("#psilocin-app").dataset.modalOpen === "false",
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Long F7 choices: viewport bounds, virtual rows, search, exact bin selection and Escape passed on mobile/desktop.",
  );
} finally {
  await browser.close();
}
