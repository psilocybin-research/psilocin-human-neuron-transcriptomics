import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import { expect } from "@playwright/test";
const output=process.env.QA_OUTPUT||"/tmp/atlas-visual";await mkdir(output,{recursive:true});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_PATH || "/usr/bin/chromium",
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
  await page.goto(base);
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#psilocin-app")?.f7),
  );
  const file = (
    await readdir(new URL("../dist/_import/components/", import.meta.url))
  ).find((name) => /^research-dataset-browser\..*\.js$/.test(name));
  await page.evaluate(
    async (url) => {
      window.datasets = await import(url);
      window.inserted = [];
      datasets.openResearchDatasets({
        root: document.querySelector("#psilocin-app"),
        getTables: async () => {window.fullTableReads=(window.fullTableReads||0)+1;return {genes:[{id:"ENSG1",effect:1}],pathways:[]};},
        getMetadata: async()=>({genes:{count:1,columns:["id","effect"]},pathways:{count:0,columns:[]}}),
        onInsert: (code) =>
          inserted.push({
            code,
            modalOpen:
              document.querySelector("#psilocin-app").dataset.modalOpen,
          }),
        onImport: () => {},
      });
    },
    new URL(`_import/components/${file}`, base).href,
  );
  const sheet = page.locator(".workspace-datasets-sheet");
  await sheet.locator(".workspace-dataset-group").first().waitFor();
  assert.equal(await page.evaluate(()=>window.fullTableReads||0),0,"Opening metadata never materializes full tables");
  assert.equal(await sheet.locator("details").count(), 0);
  assert.equal(await sheet.locator(".workspace-dataset-group").count(), 2);
  await sheet
    .getByRole("button", { name: "Show genes columns and actions", exact: true })
    .click();
  await sheet
    .getByRole("button", { name: "Inspect in R", exact: true })
    .first()
    .click();
  await sheet.waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => inserted[0].modalOpen), "false");
  assert.match(
    await page.evaluate(() => inserted[0].code),
    /head\(genes, 50\)/,
  );
  await page.goto(base + "#view=comparison&plot=profiles");
  await page.locator(".expression-matrix").waitFor();
  const advanced = page.locator(".comparison-bounds");
  await advanced.locator(".gene-annotation-toggle").click();
  await advanced
    .getByRole("button", { name: "Select expression region", exact: true })
    .click();
  assert.match(await advanced.innerText(), /genes selected/);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    true,
  );
  assert.deepEqual(errors, []);
  await page.close();
  // Capture all eleven views in both themes and representative desktop/mobile widths.
  const reviews=[];
  for(const width of [390,1440]) for(const theme of ["light","dark"]){
    const context=await browser.newContext({viewport:{width,height:960},colorScheme:theme,hasTouch:width<900});
    await context.addInitScript(mode=>localStorage.setItem("atlas-appearance",mode),theme);
    const view=await context.newPage();const faults=[];view.on("pageerror",e=>faults.push(e.message));
    for(const section of ["overview","landscape","genes","pathways","mitocarta","robustness","bayesian","dna","comparison","methods","custom-r"]){
      const url=new URL(base);url.searchParams.set("visual-review",section);url.hash=`view=${section}`;await view.goto(url.href);
      await view.locator("#psilocin-app[data-framework7]").waitFor();await expect(view.locator(".atlas-body")).toBeVisible();
      await view.evaluate(()=>document.fonts.ready);await view.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await view.screenshot({path:`${output}/atlas-${section}-${width}-${theme}.png`,animations:"disabled"});
      reviews.push({section,width,theme,...await view.evaluate(()=>({viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,bodyScrollWidth:document.querySelector(".atlas-body").scrollWidth,bodyWidth:document.querySelector(".atlas-body").clientWidth}))});
    }
    await context.close();assert.deepEqual(faults,[]);
  }
  await writeFile(`${output}/section-layouts.json`,JSON.stringify(reviews,null,2));
  console.log(
    "PASS: native F7 dataset accordions/actions, deferred R handoff, comparison controls and mobile fit.",
  );
} finally {
  await browser.close();
}
