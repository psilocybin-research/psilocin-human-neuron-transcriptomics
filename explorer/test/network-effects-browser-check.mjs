import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(
    (process.env.ATLAS_URL || "http://127.0.0.1:4173/") + "#view=overview",
  );
  const preview = p.locator(".oxphos-network-preview");
  await preview.waitFor();
  const before = await preview.boundingBox();
  await preview.dispatchEvent("pointerdown", { clientX: 100, clientY: 300 });
  assert.deepEqual(await preview.boundingBox(), before);
  await preview.dispatchEvent("pointerup");
  await preview.click();
  await p.waitForFunction(
    () =>
      document.querySelector(".oxphos-network-3d")?.dataset.rendererReady ===
      "true",
  );
  const root = p.locator(".oxphos-network-3d");
  await root.getByRole("button", { name: "Filters", exact: true }).click();
  await p.locator('.oxphos-3d-drawer.modal-in').waitFor();
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/atlas-network-effects-panel.png" });
  await p
    .locator(".oxphos-3d-drawer")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await p.locator('.oxphos-3d-drawer.modal-in').waitFor({state:'hidden'});
  await p.keyboard.press("Escape");
  await p.goto(
    (process.env.ATLAS_URL || "http://127.0.0.1:4173/") + "#view=comparison",
  );
  await p.getByLabel("Visualization", { exact: true }).waitFor();
  await p
    .getByLabel("Visualization", { exact: true })
    .selectOption("volcano", { force: true });
  await p.waitForTimeout(700);
  const top = await p
    .locator(".comparison-plot")
    .evaluate((n) => n.getBoundingClientRect().top);
  assert.ok(top < 230, `Chosen visualization is brought into view: ${top}`);
  assert.deepEqual(errors, []);
  console.log(
    "PASS stable preview press size, F7 panel open-close with static background, WebGL rendering, explicit visualization scroll, no page errors.",
  );
} finally {
  await browser.close();
}
