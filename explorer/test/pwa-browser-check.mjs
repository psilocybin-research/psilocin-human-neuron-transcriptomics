import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const dist = new URL("../dist/", import.meta.url),
  template = await readFile(
    new URL("../scripts/offline-worker.js", import.meta.url),
    "utf8",
  );
const source = JSON.parse(
  await readFile(new URL("offline-manifest.json", dist)),
);
const originalHTML = await readFile(new URL("index.html", dist), "utf8");
const html = () =>
  originalHTML.replace(
    /(<meta name="atlas-offline-release" content=")[^"]+/,
    `$1test-${edition}`,
  );
const sha = (x) => createHash("sha256").update(x).digest("hex");
let edition = 1;
const requests = [];
function inventory() {
  const body = `edition ${edition}`;
  const files = [
    ...source.files.map((file) =>
      file.path === "index.html"
        ? {
            path: file.path,
            bytes: Buffer.byteLength(html()),
            sha256: sha(html()),
          }
        : file,
    ),
    {
      path: "pwa-test-asset.txt",
      bytes: Buffer.byteLength(body),
      sha256: sha(body),
    },
  ];
  return {
    library: source.library,
    version: `test-${edition}`,
    bytes: files.reduce((a, f) => a + f.bytes, 0),
    files,
  };
}
const types = {
  js: "text/javascript",
  html: "text/html",
  json: "application/json",
  css: "text/css",
  webmanifest: "application/manifest+json",
  svg: "image/svg+xml",
  png: "image/png",
};
const server = createServer(async (req, res) => {
  try {
    const path =
      new URL(req.url, "http://test").pathname.slice(1) || "index.html";
    requests.push(path);
    let body;
    if (path === "sw.js")
      body = `const INVENTORY=${JSON.stringify(inventory())};\n${template}`;
    else if (path === "offline-manifest.json")
      body = JSON.stringify(inventory());
    else if (path === "index.html") body = html();
    else if (path === "pwa-test-asset.txt")
      body = edition === 3 ? "CORRUPT" : `edition ${edition}`;
    else {
      if (path.includes("..")) throw Error("Invalid path");
      body = await readFile(new URL(path, dist));
    }
    res.writeHead(200, {
      "content-type": types[path.split(".").at(-1)] || "text/plain",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Missing");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const rpc = (page, type) =>
  page.evaluate(
    (type) =>
      new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (event) => {
          channel.port1.close();
          event.data.ok
            ? resolve(event.data.result)
            : reject(Error(event.data.error));
        };
        navigator.serviceWorker.controller.postMessage({ type }, [
          channel.port2,
        ]);
      }),
    type,
  );
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    acceptDownloads: true,
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Page error:", e.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.error("Browser:", message.text());
  });
  await page.goto(base + "#view=genes&gene=ENSG00000138495.2");
  await page.getByRole("button", { name: "Install app", exact: true }).click();
  await page
    .locator(".pwa-dialog")
    .getByRole("button", { name: "Prepare offline", exact: true })
    .click();
  const result = page.locator(".pwa-dialog");
  await result
    .getByText(/All .*files .*passed SHA-256/)
    .waitFor({ timeout: 180000 });
  await result.getByRole("button", { name: "Done", exact: true }).click();
  console.log("Core preparation and cache-only startup passed.");
  let status = await rpc(page, "STATUS");
  assert.equal(status.saved.version, "test-1");
  assert.ok(status.saved.bytes > 10000000);
  assert.equal(status.library.saved, null);
  assert.equal(
    requests.some((path) =>
      /^public-context\/(extended|models|predictions)\//.test(path),
    ),
    false,
    "core setup must not download the optional library",
  );
  // This is a real network-disconnected reload, separate from the in-app cache-only test.
  await context.setOffline(true);
  await page.reload();
  await page.locator("#gene-search-input").waitFor();
  await page
    .getByRole("button", {
      name: "View public gene and protein context",
      exact: true,
    })
    .click();
  await page.locator(".gene-annotation-fields").waitFor();
  assert.equal(await page.locator(".gene-connection-confirmation").count(), 0);
  await page
    .getByRole("tab", { name: "Protein features", exact: true })
    .click();
  await page.locator(".protein-context .protein-features").first().waitFor();
  await page
    .locator(".gene-information-sheet")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await page.locator(".gene-information-sheet").waitFor({ state: "detached" });
  await context.setOffline(false);
  console.log("Disconnected gene and protein views passed.");
  // Preserve an unrelated cache; a broken update must leave the old copy active.
  await page.evaluate(() =>
    caches
      .open("unrelated-owner-cache")
      .then((c) => c.put("/unrelated", new Response("keep"))),
  );
  edition = 3;
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r.update();
  });
  await page.waitForTimeout(2500);
  status = await rpc(page, "STATUS");
  assert.equal(status.saved.version, "test-1");
  assert.equal(
    await page.evaluate(() => caches.has("unrelated-owner-cache")),
    true,
  );
  // Only the changed test file may be downloaded in the successful update.
  console.log("Invalid update rollback passed.");
  edition = 2;
  requests.length = 0;
  await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    await r.update();
  });
  await page.waitForFunction(
    () =>
      sessionStorage.getItem("atlas-offline-updated") === "1" ||
      document.querySelector("#psilocin-app")?.dataset.offlineReady === "true",
  );
  await page
    .locator(".pwa-dialog")
    .getByText(/All .*files .*passed SHA-256/)
    .waitFor({ timeout: 180000 });
  status = await rpc(page, "STATUS");
  assert.equal(status.saved.version, "test-2");
  assert.equal(
    status.saved.downloadedBytes,
    Buffer.byteLength("edition 2") + Buffer.byteLength(html()),
  );
  assert.equal(
    await page.evaluate(() => caches.has("unrelated-owner-cache")),
    true,
  );
  assert.match(page.url(), /gene=ENSG00000138495.2/);
  await result.getByRole("button", { name: "Done", exact: true }).click();
  console.log("Delta update and automatic refresh passed.");
  await page.getByRole("button", { name: "Install app", exact: true }).click();
  await page
    .locator(".pwa-dialog")
    .getByRole("button", { name: "Download molecular library", exact: true })
    .click();
  await page
    .locator(".pwa-dialog")
    .getByText(/All .*files .*passed SHA-256/)
    .waitFor({ timeout: 180000 });
  status = await rpc(page, "STATUS");
  assert.equal(status.library.saved.version, status.library.version);
  await page
    .locator(".pwa-dialog")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("button", {
      name: "View public gene and protein context",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "3D structures", exact: true }).click();
  await page
    .locator("[data-structure-rendered=true]")
    .first()
    .waitFor({ timeout: 30000 });
  assert.deepEqual(errors, []);
  console.log(
    "Manual F7 setup, hash and cache-only startup verification, disconnected gene/protein views, failed-update rollback, delta-only update, automatic refresh/result, route retention and unrelated-cache isolation passed.",
  );
  await context.close();
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
