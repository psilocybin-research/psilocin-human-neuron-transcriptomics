import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const url = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [],
  requests = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => requests.push(r.url()));
await page.goto(url);
await page.locator("[data-framework7]").waitFor();
assert.ok(
  !requests.some((x) => x.includes("/webr/")),
  "R must not load on ordinary launch",
);
await page.goto(url + "#view=custom-r");
await page.getByLabel("R code", { exact: true }).waitFor();
async function run() {
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#psilocin-app").dataset.rBusy === "false",
  );
  assert.match(
    await page.locator(".custom-r-workspace [role=status]").textContent(),
    /Analysis complete/,
  );
  assert.equal(await page.locator(".custom-r-plots canvas").count(), 1);
  assert.equal(
    await page
      .getByRole("button", { name: "Download results CSV", exact: true })
      .isEnabled(),
    true,
  );
}
await run();
console.log("Primary pathways passed");
for (const value of ["gene", "cohort", "profiles", "threshold", "bayesian"]) {
  await page.getByLabel("R example", { exact: true }).selectOption(value);
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await page
    .locator(".dialog.modal-in")
    .getByText("OK", { exact: true })
    .click();
  await run();
  if (value === "bayesian") {
    const text = await page.locator(".custom-r-console").textContent();
    assert.match(text, /0\.325/);
    assert.match(text, /grid-edge mass/);
  }
  console.log(value, "passed");
}
await page.getByLabel("R code", { exact: true }).fill("repeat {}");
await page.getByRole("button", { name: "Run analysis", exact: true }).click();
await page.getByRole("button", { name: "Stop", exact: true }).click();
assert.equal(
  await page
    .getByRole("button", { name: "Run analysis", exact: true })
    .isEnabled(),
  true,
);
await page
  .getByLabel("R code", { exact: true })
  .fill("results <- data.frame(x=1:3); print(results); plot(results$x)");
async function call(type, kind = "core") {
  return page.evaluate(
    async ({ type, kind }) => {
      const registration = await navigator.serviceWorker.ready;
      return new Promise((resolve, reject) => {
        const c = new MessageChannel();
        c.port1.onmessage = ({ data }) =>
          data.ok ? resolve(data.result) : reject(Error(data.error));
        registration.active.postMessage({ type, kind }, [c.port2]);
      });
    },
    { type, kind },
  );
}
await page.getByRole("button", {name:"Install app", exact:true}).click();
await page.locator(".pwa-r-choice").click();
assert.equal(await page.getByLabel("Include offline R runtime", {exact:true}).isChecked(), true);
await page.getByRole("button", {name:"Prepare offline", exact:true}).click();
await page.getByText("Offline R ready", {exact:true}).waitFor({timeout:180000});
await page.locator(".pwa-dialog.modal-in").getByRole("button", {name:"Done", exact:true}).click();
console.log("F7 optional install and real-data R readiness passed");
await call("VERIFY", "r");
await context.setOffline(true);
await page.reload();
await page.getByLabel("R code", { exact: true }).waitFor();
await run();
console.log("Disconnected R calculation and plot passed");
const result = await call("STATUS");
assert.ok(result.r.saved);
assert.ok(!result.r.saved.cache.includes("core"));
assert.deepEqual(errors, []);
await page.screenshot({
  path: process.env.QA_SCREENSHOT || "/tmp/atlas-custom-r-offline.png",
  fullPage: true,
});
await browser.close();
console.log(
  "Custom R examples, stop/restart, separate verified R cache and offline execution passed",
);
