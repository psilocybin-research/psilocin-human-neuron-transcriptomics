import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const base = process.env.ATLAS_URL || "http://127.0.0.1:4173/";
const sequence = "G".repeat(40),
  stable = "ENSG00000167468";
const protein = {
  primaryAccession: "P36969",
  entryType: "UniProtKB reviewed (Swiss-Prot)",
  organism: { taxonId: 9606 },
  sequence: { value: sequence },
  proteinDescription: {
    recommendedName: { fullName: { value: "Test protein" } },
  },
  entryAudit: { entryVersion: 1, sequenceVersion: 1 },
  uniProtKBCrossReferences: [
    {
      database: "Ensembl",
      properties: [{ key: "GeneId", value: stable + ".20" }],
    },
    {
      database: "PDB",
      id: "2OBI",
      properties: [
        { key: "Method", value: "X-ray" },
        { key: "Chains", value: "A=1-40" },
      ],
    },
  ],
  features: [
    {
      type: "Domain",
      description: "Test domain",
      location: {
        start: { value: 2, modifier: "EXACT" },
        end: { value: 25, modifier: "EXACT" },
      },
      evidences: [{ evidenceCode: "ECO:0000269" }],
    },
  ],
};
const model = {
  uniprotAccession: "P36969",
  sequence,
  sequenceStart: 1,
  sequenceEnd: 40,
  taxId: 9606,
  latestVersion: 6,
  modelCreatedDate: "2025-08-01",
  modelEntityId: "AF-P36969-F1",
  cifUrl: "https://alphafold.ebi.ac.uk/files/AF-P36969-F1-model_v6.cif",
};
const fields = [
  "group_PDB",
  "id",
  "type_symbol",
  "label_atom_id",
  "label_alt_id",
  "label_comp_id",
  "label_asym_id",
  "label_entity_id",
  "label_seq_id",
  "pdbx_PDB_ins_code",
  "Cartn_x",
  "Cartn_y",
  "Cartn_z",
  "occupancy",
  "B_iso_or_equiv",
  "auth_seq_id",
  "auth_comp_id",
  "auth_asym_id",
  "auth_atom_id",
  "pdbx_PDB_model_num",
];
const cif =
  "data_test\nloop_\n" +
  fields.map((f) => "_atom_site." + f).join("\n") +
  "\n" +
  Array.from(
    { length: 40 },
    (_, i) =>
      `ATOM ${i + 1} C CA . GLY A 1 ${i + 1} ? ${(Math.cos(i) * 5).toFixed(3)} ${(Math.sin(i) * 5).toFixed(3)} ${(i * 1.5).toFixed(3)} 1.0 ${95 - i} ${i + 1} GLY A CA 1`,
  ).join("\n") +
  "\n#\n";
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 960 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let requests = 0;
    await page.route("https://rest.ensembl.org/**", (route) =>
      route.fulfill({ json: { id: "ENSG00000167468", species: "homo_sapiens", object_type: "Gene", version: 12, display_name: "GPX4" } }),
    );
    await page.route("https://rest.uniprot.org/**", async (route) => {
      requests++;
      await route.fulfill({ json: { results: [protein] } });
    });
    await page.route("https://alphafold.ebi.ac.uk/api/**", (r) =>
      r.fulfill({ json: [model, { ...model, sequence: "MISMATCH" }] }),
    );
    await page.route("https://alphafold.ebi.ac.uk/files/**", (r) =>
      r.fulfill({ body: cif, contentType: "text/plain" }),
    );
    await page.route("https://files.rcsb.org/**", (r) =>
      r.fulfill({ body: cif, contentType: "text/plain" }),
    );
    await page.goto(base + "#view=genes&gene=GPX4");
    await page
      .getByRole("button", { name: "View public gene and protein context", exact: true })
      .waitFor();
    assert.equal(requests, 0);
    if (width < 851) {
      await page
        .getByRole("button", { name: "View evidence", exact: true })
        .click();
      await page
        .locator(".research-evidence-sheet[data-shell-modal-ready=true]")
        .waitFor();
    }
    assert.equal(
      await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((r) => /3dmol\./.test(r.name)),
      ),
      false,
      "molecular runtime absent at startup",
    );
    await page
      .getByRole("button", { name: "View public gene and protein context", exact: true })
      .click();
    assert.equal(await page.getByRole("button", { name: "Find 3D structures", exact: true }).count(), 0);
    await page.getByRole("tab", { name: "3D structures", exact: true }).click();
    await page.locator(".protein-record").first().waitFor();
    assert.equal(requests, 1);
    await page
      .locator(".protein-structure-access [data-open-structure]")
      .waitFor();
    assert.equal(
      await page.locator(".protein-features svg").count(),
      0,
      "tracks stay lazy until protein opens",
    );
    await page
      .getByRole("tab", { name: "Protein features", exact: true })
      .click();
    await page.locator(".protein-features svg[data-plot-renderer]").waitFor();
    assert.equal(await page.getByRole('tab',{name:'Protein features',exact:true}).getAttribute('aria-selected'),'true');
    await page.screenshot({ path: `/tmp/atlas-protein-sheet-${width}.png` });
    await page
      .getByRole("button", {
        name: "Download public protein context JSON",
        exact: true,
      })
      .click();
    const dialog = page.locator(".download-confirmation");
    await dialog.waitFor();
    assert.equal(
      await dialog.locator(".download-filename").innerText(),
      "P36969-public-protein-context.json",
    );
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download", exact: true }).click();
    const exported = JSON.parse(
      await readFile(await (await download).path(), "utf8"),
    );
    assert.equal(exported.provider, "UniProt");
    assert.equal(exported.protein.accession, "P36969");
    assert.ok(exported.retrieved_utc);
    await page.getByRole("tab", { name: "3D structures", exact: true }).click();
    assert.equal(await page.getByRole('tab',{name:'3D structures',exact:true}).getAttribute('aria-selected'),'true');
    assert.equal(requests, 1, "protein mapping shared across tabs");
    await page
      .getByRole("button", { name: "Open 3D structure", exact: true })
      .first()
      .click();
    await page.locator("[data-structure-rendered=true]").waitFor();
    assert.equal(await page.locator(".molecular-stage canvas").count(), 1);
    const notices = await page
      .getByRole("link", { name: "Molecular viewer licences" })
      .getAttribute("href");
    assert.equal(
      (await page.request.get(new URL(notices, page.url()).href)).status(),
      200,
    );
    const figure = page
      .locator(".molecular-viewport[data-structure-rendered=true]")
      .locator("..");
    assert.equal(
      await figure
        .locator(".figure-toolbar button")
        .last()
        .evaluate((n) => n.classList.contains("figure-fullscreen")),
      true,
    );
    const fullscreen = figure.locator(".figure-fullscreen");
    assert.equal(await fullscreen.innerText(), "Fullscreen");
    const before = await page.locator(".molecular-stage").boundingBox();
    await fullscreen.click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    await page.waitForFunction(
      () =>
        document.querySelector(".molecular-stage").getBoundingClientRect()
          .height >=
        innerHeight - 252,
    );
    assert.ok(
      (await page.locator(".molecular-stage").boundingBox()).height >
        before.height,
    );
    await page.screenshot({ path: `/tmp/atlas-3d-fullscreen-${width}.png` });
    await fullscreen.click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await page
      .locator(
        ".gene-information-pane.tab-active .protein-record .gene-annotation-toggle",
      )
      .first()
      .click();
    await page
      .getByRole("button", { name: "Find sequence-matched AlphaFold models" })
      .click();
    await page
      .locator(
        ".gene-information-pane.tab-active .protein-predictions .protein-model-option",
      )
      .waitFor();
    assert.equal(
      await page
        .locator(
          ".gene-information-pane.tab-active .protein-predictions .protein-model-option",
        )
        .count(),
      1,
      "mismatched model excluded",
    );
    await page
      .locator(".gene-information-pane.tab-active .protein-predictions")
      .getByRole("button", { name: "Open 3D structure", exact: true })
      .click();
    await page
      .locator(".protein-predictions [data-structure-rendered=true]")
      .waitFor();
    assert.equal(
      await page.locator(".molecular-stage canvas").count(),
      1,
      "only one active WebGL structure",
    );
    assert.ok(
      (
        await page
          .locator(".gene-information-pane.tab-active .protein-predictions")
          .innerText()
      ).includes("local pLDDT"),
    );
    await page
      .getByRole("button", { name: "Close structure", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector(".molecular-stage"),
    );
    assert.equal(await page.locator(".molecular-stage canvas").count(), 0);
    await page
      .locator(".gene-information-sheet")
      .getByRole("button", { name: "Done", exact: true })
      .click();
    await page
      .locator(".gene-information-sheet")
      .waitFor({ state: "detached" });
    if (width < 851) {
      const evidence = page.locator(
        ".research-evidence-sheet:not(.gene-information-sheet)",
      );
      assert.equal(
        await evidence.isVisible(),
        true,
        "public info returns to existing gene evidence",
      );
      await evidence.getByRole("button", { name: "Done", exact: true }).click();
    }
    assert.equal(await page.locator(".molecular-stage canvas").count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "On-demand protein mapping, Observable tracks, real WebGL CIF rendering, model validation, shared figure controls and viewer cleanup passed on mobile/desktop.",
  );
} finally {
  await browser.close();
}
