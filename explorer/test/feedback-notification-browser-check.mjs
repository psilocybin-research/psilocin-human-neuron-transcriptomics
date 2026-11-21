import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
  const moduleFile = (
    await readdir(new URL("../dist/_import/components/", import.meta.url))
  ).find((name) => /^app-toast\..*\.js$/.test(name));
  await page.goto(base);
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#psilocin-app")?.f7?.notification),
  );
  await page.evaluate(
    async (url) => {
      window.feedback = await import(url);
    },
    new URL(`_import/components/${moduleFile}`, base).href,
  );
  await page.addStyleTag({
    content:
      ".notification {animation:none!important;transition:none!important}",
  });
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++)
      feedback.showToast(`Message ${i}`, { duration: 0 });
  });
  assert.equal(await page.locator(".atlas-feedback-notification").count(), 1);
  assert.equal(
    await page.locator(".atlas-feedback-message").textContent(),
    "Message 7",
  );
  assert.equal(
    await page.locator(".research-views").evaluate((el) => el.inert),
    false,
  );
  assert.equal(
    await page
      .locator(".atlas-feedback-notification")
      .getAttribute("aria-modal"),
    null,
  );
  await page
    .getByRole("button", { name: "Dismiss status update", exact: true })
    .click();
  await page
    .locator(".atlas-feedback-notification")
    .waitFor({ state: "detached" });
  await page.evaluate(() =>
    feedback.showToast("Completed <safely>", { duration: 200 }),
  );
  await page.locator(".atlas-feedback-notification").hover();
  await page
    .locator(".atlas-feedback-notification")
    .waitFor({ state: "detached" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() =>
    feedback.showToast("Deleted", {
      duration: 8000,
      actionLabel: "Undo",
      onAction: () => (window.undoCount = (window.undoCount || 0) + 1),
    }),
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.evaluate(() => window.undoCount), 1);
  assert.equal(await page.locator(".atlas-feedback-notification").count(), 0);
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "feedback-fullscreen";
    document.querySelector("#psilocin-app").append(host);
    const button = document.createElement("button");
    button.textContent = "Test fullscreen";
    button.onclick = () => host.requestFullscreen();
    host.append(button);
  });
  await page
    .getByRole("button", { name: "Test fullscreen", exact: true })
    .click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page.evaluate(() =>
    feedback.showToast("Fullscreen feedback", { duration: 100 }),
  );
  assert.equal(
    await page
      .locator("#feedback-fullscreen .atlas-feedback-notification")
      .count(),
    1,
  );
  await page
    .locator(".atlas-feedback-notification")
    .waitFor({ state: "detached" });
  await page.evaluate(() => document.exitFullscreen());
  assert.equal(await page.locator(".atlas-feedback-sheet").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: F7 notifications replace immediately, stay nonmodal, expire under hover/disabled transitions/reduced motion, support Undo/dismissal and close in fullscreen.",
  );
} finally {
  await browser.close();
}
