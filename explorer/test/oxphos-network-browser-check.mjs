import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/",
  out = process.env.QA_OUTPUT || "/tmp/atlas-3d-polish";
await mkdir(out, { recursive: true });
const archive = JSON.parse(
  await readFile(new URL("../src/data/genes.json", import.meta.url)),
);
const browser = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
try {
  for (const width of [320, 390, 1440]) {
    const c = await browser.newContext({
      viewport: { width, height: 950 },
      acceptDownloads: true,
    });
    if (width < 700)
      await c.addInitScript(() => {
        Element.prototype.requestFullscreen = undefined;
        Element.prototype.webkitRequestFullscreen = undefined;
      });
    await c.addInitScript(() =>
      localStorage.setItem("atlas-appearance", "light"),
    );
    const p = await c.newPage();
    p.setDefaultTimeout(45000);
    const errors = [],
      requests = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("request", (r) => requests.push(r.url()));
    await p.goto(base + "#view=overview");
    const open = p.getByRole("button", {
      name: "Explore 3D gene–pathway membership",
      exact: true,
    });
    await open.waitFor();
    assert.equal(
      requests.some((u) => /network-3d\.[a-f0-9]+\.js/.test(u)),
      false,
    );
    assert.equal(await open.locator("svg").count(), 0);
    const placement = await open.evaluate((n) => {
      const other = [
        ...n.parentElement.querySelectorAll(":scope > button"),
      ].filter((b) => b !== n);
      return {
        image: n.getBoundingClientRect().top,
        buttons: other.map((b) => b.getBoundingClientRect().bottom),
        width: n.clientWidth,
      };
    });
    assert.ok(placement.buttons.every((y) => y < placement.image));
    assert.ok(placement.width > (width < 700 ? width - 70 : 600));
    await open.hover();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/overview-${width}.png` });
    await p.route(/network-3d\.[a-f0-9]+\.js/, async (r) => {
      await new Promise((r) => setTimeout(r, 300));
      await r.continue();
    });
    await open.click();
    assert.ok(
      await p
        .locator(".oxphos-network-sheet-content .preloader")
        .first()
        .isVisible(),
    );
    await p.waitForFunction(
      () => document.querySelector(".oxphos-network-3d")?.dataset.rendererReady,
    );
    const root = p.locator(".oxphos-network-3d");
    assert.equal(
      await root.getAttribute("data-renderer-ready"),
      "true",
      await root.innerText(),
    );
    assert.equal(
      await p.locator("html").evaluate((n) => n.classList.contains("dark")),
      false,
      "opening the renderer preserves light appearance",
    );
    if (width === 1440)
      assert.ok(await p.evaluate(() => Boolean(document.fullscreenElement)));
    const stage = root.locator(".oxphos-3d-stage");
    const stageBox = await stage.boundingBox();
    assert.ok(stageBox.height > 700);
    const canvasBox = await root.locator(".oxphos-3d-pane canvas").first().boundingBox();
    assert.ok(Math.abs(canvasBox.y - stageBox.y) < 2);
    assert.ok(Math.abs(canvasBox.height - stageBox.height) < 2, "Canvas fills behind all controls");
    await root
      .getByRole("switch", { name: "Compare days", exact: true })
      .click();
    await p.waitForFunction(
      () =>
        document.querySelector(".oxphos-network-3d")?.dataset.comparing ===
        "true",
    );
    assert.equal(await root.locator(".oxphos-3d-pane canvas").count(), 2);
    await root
      .getByRole("button", { name: "Reset camera", exact: true })
      .click();
    const panes = root.locator(".oxphos-3d-pane canvas");
    await p.waitForTimeout(200);
    for (const canvas of await panes.all()) {
      const rgb = await canvas.evaluate((c) => {
        const gl = c.getContext("webgl2"),
          v = new Uint8Array(4);
        gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, v);
        return [...v].slice(0, 3);
      });
      assert.ok(
        rgb.every((v, i) => Math.abs(v - [6, 13, 23][i]) <= 3),
        `comparison colour management: ${rgb}`,
      );
    }

    const beforeLeft = await panes.nth(0).screenshot(),
      beforeRight = await panes.nth(1).screenshot();
    const box = await panes.nth(0).boundingBox();
    await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
      steps: 8,
    });
    await p.mouse.up();
    await p.waitForTimeout(500);
    assert.notDeepEqual(await panes.nth(0).screenshot(), beforeLeft);
    assert.notDeepEqual(await panes.nth(1).screenshot(), beforeRight);
    await p.screenshot({ path: `${out}/comparison-${width}.png` });
    await root
      .getByRole("switch", { name: "Compare days", exact: true })
      .click();
    await p.waitForFunction(()=>document.querySelectorAll(".oxphos-3d-pane canvas").length===1);
    await root.getByRole("button", { name: "Day 3", exact: true }).click();
    await root.getByRole("button", { name: "Find gene", exact: true }).click();
    let drawer = p.locator(".oxphos-3d-drawer");
    await drawer.getByRole("searchbox").fill("NDUFA1");
    await drawer.getByRole("button", { name: "NDUFA1", exact: true }).click();
    drawer = p.locator(width >= 1100 ? ".oxphos-3d-evidence" : ".oxphos-3d-drawer");
    await drawer.locator(".oxphos-research-panel svg").first().waitFor();
    await drawer.getByText("Full stored gene statistics", {exact:true}).click();
    const g = archive.find((g) => g.symbol === "NDUFA1" && g.selected);
    assert.ok((await drawer.innerText()).includes(String(g.effects[1].padj)));
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await root
      .getByRole("button", { name: "Reset camera", exact: true })
      .click();
    await p.waitForTimeout(200);
    const background = await root
      .locator(".oxphos-3d-pane canvas")
      .first()
      .evaluate((canvas) => {
        const gl = canvas.getContext("webgl2"),
          pixel = new Uint8Array(4);
        gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return [...pixel].slice(0, 3);
      });
    assert.ok(
      background.every((v, i) => Math.abs(v - [6, 13, 23][i]) <= 3),
      `dark canvas colour is not transformed twice: ${background}`,
    );
    await p.screenshot({ path: `${out}/network-${width}.png` });
    await root.getByRole("button", { name: "Filters", exact: true }).click();
    drawer = p.locator(".oxphos-3d-drawer");
    await drawer
      .getByLabel("3D complex filter", { exact: true })
      .selectOption("V");
    assert.match(
      await root.locator(".oxphos-3d-status").innerText(),
      /0 \/ 113/,
    );
    await drawer
      .getByLabel("3D complex filter", { exact: true })
      .selectOption("IV");
    assert.match(
      await root.locator(".oxphos-3d-status").innerText(),
      /10 \/ 113/,
    );
    assert.equal(await drawer.getByText("Subtle glow (decorative)").count(), 0);
    await drawer
      .getByLabel("3D complex filter", { exact: true })
      .selectOption("all");
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await root
      .getByRole("button", { name: "About & data", exact: true })
      .click();
    drawer = p.locator(".oxphos-3d-drawer");
    await drawer
      .getByRole("button", { name: "Download network data", exact: true })
      .click();
    const confirm = p.locator(".download-confirmation.modal-in");
    await confirm.waitFor();
    const event = p.waitForEvent("download");
    await confirm.getByText("Download", { exact: true }).click();
    const download = await event;
    await download.saveAs(`${out}/network-${width}.json`);
    const exported = JSON.parse(await readFile(`${out}/network-${width}.json`));
    assert.equal(exported.links.length, 202);
    assert.equal(exported.nodes.filter((n) => n.type === "gene").length, 113);
    await drawer.getByRole("button", { name: "Done", exact: true }).click();
    await p
      .locator(
        width < 700 ? ".research-evidence-sheet" : ".oxphos-network-fullscreen",
      )
      .locator(":scope > .evidence-sheet-header")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await open.click();
    assert.equal(await root.getAttribute("data-renderer-ready"), "true");
    assert.deepEqual(errors, []);
    assert.ok(
      requests.every((u) => new URL(u).origin === new URL(base).origin),
    );
    await c.close();
    console.log(
      `PASS ${width}px preview placement/overlay, lazy renderer/preloader, immersive canvas, day3, exact values, F7 tools, synchronized comparison cameras, filters/export and reopen`,
    );
  }
} finally {
  await browser.close();
}
