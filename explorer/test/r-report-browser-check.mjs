import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const dir = (process.env.QA_OUTPUT || "/tmp/atlas-r-report-qa") + "/";
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
await mkdir(dir, { recursive: true });
const b = await chromium.launch({
  headless: true,
  executablePath: "/usr/bin/chromium",
});
try {
  const c = await b.newContext({ acceptDownloads: true });
  const p = await c.newPage();
  p.setDefaultTimeout(120000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "#view=custom-r");
  await p.getByRole("textbox", { name: "R code", exact: true }).waitFor();
  assert.ok(
    await p
      .getByText(
        "Results and plots will show here after you run an analysis.",
        { exact: true },
      )
      .isVisible(),
  );
  assert.equal(
    await p.getByRole("heading", { name: "Plots", exact: true }).count(),
    0,
  );
  await p
    .getByRole("textbox", { name: "R code", exact: true })
    .fill(
      'results <- data.frame(x=1:3, y=c(2,5,9))\nprint(results)\nplot(results$x, results$y, main="Vector α report test")\nplot(3:1, col="#235780", main="Second plot")',
    );
  await p.getByRole("button", { name: "Run analysis", exact: true }).click();
  await p.waitForFunction(
    () => document.querySelector("#psilocin-app").dataset.rBusy === "false",
  );
  console.log(await p.locator(".r-progress-panel").innerText());
  assert.match(
    await p.locator(".r-progress-panel").innerText(),
    /Analysis complete/,
  );
  assert.equal(
    await p.getByRole("button", { name: "Download SVG", exact: true }).count(),
    2,
  );
  assert.ok(
    await p
      .getByRole("heading", { name: "Results table", exact: true })
      .isVisible(),
  );
  async function save(trigger, name) {
    await trigger();
    await p.locator(".download-confirmation.modal-in").waitFor();
    const promise = p.waitForEvent("download");
    await p
      .locator(".download-confirmation.modal-in")
      .getByText("Download", { exact: true })
      .click();
    await (await promise).saveAs(dir + name);
    await p
      .locator(".download-confirmation.modal-in")
      .waitFor({ state: "hidden" });
  }
  await save(
    () =>
      p
        .getByRole("button", { name: "Download SVG", exact: true })
        .first()
        .click(),
    "plot.svg",
  );
  assert.match(await readFile(dir + "plot.svg", "utf8"), /<path/);
  await p.getByText("Create a research report", { exact: true }).click();
  await p
    .getByRole("textbox", { name: "Report title", exact: true })
    .fill("Exploratory OXPHOS report & vector plots");
  await p
    .getByRole("textbox", { name: "Report author", exact: true })
    .fill("Test researcher");
  await save(
    () => p.getByRole("button", { name: "Create PDF", exact: true }).click(),
    "report.pdf",
  );
  assert.equal(
    (await readFile(dir + "report.pdf")).subarray(0, 5).toString(),
    "%PDF-",
  );
  console.log("PDF generated");
  await save(
    () =>
      p
        .getByRole("button", { name: "Download LaTeX source", exact: true })
        .click(),
    "report.zip",
  );
  console.log("Source generated");
  const { unzipSync } = await import("fflate");
  const files = unzipSync(await readFile(dir + "report.zip"));
  assert.ok(files["data/genes.csv"]);
  assert.ok(files["analysis.R"]);
  assert.ok(files["figures/plot-1.svg"]);
  assert.ok(files["figures/plot-2.pdf"]);
  assert.match(new TextDecoder().decode(files["report.tex"]), /AtlasBlue/);
  const { createHash } = await import("node:crypto");
  for (const line of new TextDecoder()
    .decode(files.SHA256SUMS)
    .trim()
    .split("\n")) {
    const [hash, name] = line.split("  ");
    assert.equal(
      createHash("sha256").update(files[name]).digest("hex"),
      hash,
      name,
    );
  }
  async function workerCall(type, kind) {
    return p.evaluate(
      async ({ type, kind }) => {
        await navigator.serviceWorker.register(
          new URL("sw.js", document.baseURI),
          { scope: new URL("./", document.baseURI).pathname, type: "classic" },
        );
        const reg = await navigator.serviceWorker.ready;
        return new Promise((resolve, reject) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = ({ data }) =>
            data.ok ? resolve(data.result) : reject(Error(data.error));
          reg.active.postMessage({ type, kind }, [channel.port2]);
        });
      },
      { type, kind },
    );
  }
  for (const kind of ["core", "r", "latex"]) {
    console.log("Preparing " + kind);
    await workerCall("PREPARE", kind);
    await workerCall("VERIFY", kind);
    console.log("Verified " + kind);
  }
  await c.setOffline(true);
  await p.reload();
  await p.getByText("Offline app verified", { exact: true }).waitFor();
  await p
    .locator(".pwa-dialog.modal-in")
    .getByRole("button", { name: "Done", exact: true })
    .click();
  await p.getByRole("textbox", { name: "R code", exact: true }).waitFor();
  await p.getByRole("button", { name: "Run analysis", exact: true }).click();
  await p.waitForFunction(
    () => document.querySelector("#psilocin-app").dataset.rBusy === "false",
  );
  assert.match(
    await p.locator(".r-progress-panel").innerText(),
    /Analysis complete/,
  );
  await p.getByText("Create a research report", { exact: true }).click();
  await save(
    () => p.getByRole("button", { name: "Create PDF", exact: true }).click(),
    "offline-report.pdf",
  );
  assert.equal(
    (await readFile(dir + "offline-report.pdf")).subarray(0, 5).toString(),
    "%PDF-",
  );
  console.log("Disconnected fresh R, vector export and PDF compilation passed");
  await p.screenshot({ path: dir + "report-ui.png", fullPage: true });
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "browser-result.json",
    JSON.stringify({ passed: true, vectorFigures: 2, pdf: true, source: true }),
  );
  console.log(
    "PASS report PDF, SVG, source archive, conditional results and editor",
  );
} finally {
  await b.close();
}
