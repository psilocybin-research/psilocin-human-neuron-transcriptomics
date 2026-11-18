import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/",
  out = process.env.QA_OUTPUT || "/tmp/atlas-3d-browser";
await mkdir(out, { recursive: true });
const archived = JSON.parse(
  await readFile(new URL("../src/data/genes.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  for (const width of [390, 1440]) {
    const c = await browser.newContext({
      viewport: { width, height: 950 },
      acceptDownloads: true,
    });
    const p = await c.newPage();
    p.setDefaultTimeout(90000);
    const errors = [],
      requests = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => requests.push(r.url()));
    if (width === 390)
      await p.addInitScript(() => {
        Element.prototype.requestFullscreen = undefined;
        Element.prototype.webkitRequestFullscreen = undefined;
      });
    await p.goto(base + "#view=overview");
    const open = p.getByRole("button", {
      name: "Explore 3D gene–pathway membership",
      exact: true,
    });
    await open.waitFor();
    await p.screenshot({ path: `${out}/overview-${width}.png` });
    assert.equal(
      requests.some((u) => /network-3d\.[a-f0-9]+\.js/.test(u)),
      false,
      "renderer is not requested by heatmap",
    );
    await p.route(/network-3d\.[a-f0-9]+\.js/, async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    await open.click();
    assert.ok(
      await p
        .locator(".oxphos-network-sheet-content .preloader")
        .first()
        .isVisible(),
    );
    if (width === 1440)
      await p.waitForFunction(() => Boolean(document.fullscreenElement));
    const root = p.locator(".oxphos-network-3d");
    await p.waitForFunction(
      () => document.querySelector(".oxphos-network-3d")?.dataset.rendererReady,
    );
    assert.equal(
      await root.getAttribute("data-renderer-ready"),
      "true",
      await root.innerText(),
    );
    await root.locator("canvas").first().waitFor();
    assert.ok(
      await root
        .getByRole("button", { name: "Reset camera", exact: true })
        .isVisible(),
    );
    await root.getByRole("button", { name: "Day 3", exact: true }).click();
    assert.match(await root.locator(".oxphos-3d-status").innerText(), /Day 3/);
    await root
      .getByRole("searchbox", { name: "Search 3D OXPHOS genes", exact: true })
      .fill("NDUFA1");
    await root
      .locator(".oxphos-3d-gene-list")
      .getByRole("button", { name: "NDUFA1", exact: true })
      .click();
    const gene = archived.find((g) => g.symbol === "NDUFA1" && g.selected);
    assert.match(
      await root.locator(".oxphos-3d-selected").innerText(),
      new RegExp(gene.id.replace(".", "\\.")),
    );
    assert.ok(
      (await root.locator(".oxphos-3d-selected").innerText()).includes(
        String(gene.effects[0].log2FoldChange),
      ),
    );
    assert.ok(
      (await root.locator(".oxphos-3d-selected").innerText()).includes(
        String(gene.effects[1].padj),
      ),
    );
    await root.getByRole("button", { name: "Zoom in", exact: true }).click();
    await root
      .getByRole("button", { name: "Reset camera", exact: true })
      .click();
    const canvas = root.locator(".oxphos-3d-stage canvas");
    const pixels = await canvas.evaluate((c) => {
      const g = c.getContext("webgl2");
      const a = new Uint8Array(c.width * c.height * 4);
      g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, a);
      return new Set(Array.from(a).filter((_, i) => i % 4 === 0)).size;
    });
    assert.ok(pixels > 10, "WebGL rendered varied pixels");
    await p.screenshot({ path: `${out}/network-${width}.png` });
    const select = root.getByLabel("3D complex filter", { exact: true });
    await select.evaluate((n) => {
      n.value = "V";
      n.dispatchEvent(new Event("change", { bubbles: true }));
    });
    assert.match(
      await root.locator(".oxphos-3d-status").innerText(),
      /0 of 113/,
    );
    assert.match(
      await root.locator(".oxphos-3d-gene-list").innerText(),
      /No structural mitochondrial ATP synthase/,
    );
    await select.evaluate((n) => {
      n.value = "IV";
      n.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await root
      .getByRole("searchbox", { name: "Search 3D OXPHOS genes", exact: true })
      .fill("");
    assert.match(
      await root.locator(".oxphos-3d-status").innerText(),
      /10 of 113/,
    );
    assert.equal(await root.locator(".oxphos-3d-gene-list button").count(), 10);
    await select.evaluate((n) => {
      n.value = "all";
      n.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await root
      .getByRole("button", { name: "Download network data", exact: true })
      .click();
    const confirm = p.locator(".download-confirmation.modal-in");
    await confirm.waitFor();
    const d = p.waitForEvent("download");
    await confirm.getByText("Download", { exact: true }).click();
    const download = await d;
    await download.saveAs(`${out}/network-${width}.json`);
    const exported = JSON.parse(
      await readFile(`${out}/network-${width}.json`, "utf8"),
    );
    assert.equal(exported.nodes.filter((n) => n.type === "gene").length, 113);
    assert.equal(exported.links.length, 202);
    assert.ok(exported.colour_domain[0] === -exported.colour_domain[2]);
    await root.locator(".oxphos-3d-stage").scrollIntoViewIfNeeded();
    await p
      .locator(
        width === 390
          ? ".research-evidence-sheet"
          : ".oxphos-network-fullscreen",
      )
      .locator(".evidence-sheet-header")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    if (width === 1440)
      await p.waitForFunction(() => !document.fullscreenElement);
    await open.click();
    await p.waitForTimeout(500);
    assert.equal(await root.getAttribute("data-renderer-ready"), "true");
    assert.equal(
      await p
        .locator(
          width === 390
            ? ".research-evidence-sheet"
            : ".oxphos-network-fullscreen",
        )
        .evaluate((n) => n.scrollWidth > n.clientWidth),
      false,
    );
    assert.deepEqual(errors, []);
    assert.ok(
      requests.every((u) => new URL(u).origin === new URL(base).origin),
    );
    await c.close();
    console.log(
      `PASS ${width}px real WebGL, static preview, F7 preloader, lazy renderer, Day3, exact stats, zoom/reset/fullscreen or sheet, filters, export and sheet reopen`,
    );
  }
} finally {
  await browser.close();
}
