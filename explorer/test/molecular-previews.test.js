import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { verifiedModels } from "../src/components/protein-data.js";
import { structurePreviews } from "../src/assets/structure-previews.js";
const root = new URL("../src/assets/public-context/", import.meta.url);
test("OXPHOS previews retain exact gene, sequence, coordinate, chain and image identities", async () => {
  const index = JSON.parse(await readFile(new URL("index.json", root)));
  const manifest = JSON.parse(await readFile(new URL("previews.json", root)));
  const records = new Map();
  for (const file of Object.values(index.shards))
    for (const [id, proteins] of Object.entries(
      JSON.parse(await readFile(new URL(file, root))).proteins,
    ))
      if (proteins.length) records.set(id, proteins[0]);
  assert.equal(records.size, 113);
  assert.equal(Object.keys(manifest.genes).length, 112);
  assert.deepEqual(manifest.failures, []);
  assert.deepEqual(
    Object.keys(structurePreviews).sort(),
    Object.keys(manifest.genes).sort(),
  );
  let bytes = 0;
  for (const [id, preview] of Object.entries(manifest.genes)) {
    const protein = records.get(id);
    assert.ok(protein);
    assert.equal(protein.accession, preview.accession);
    assert.equal(structurePreviews[id].path, preview.path);
    const resource = index.resources[preview.coordinateSource];
    assert.ok(resource);
    assert.equal(resource.sha256, preview.coordinateSha256);
    const image = await readFile(new URL(preview.path, root));
    assert.equal(image.length, preview.bytes);
    bytes += image.length;
    assert.equal(
      createHash("sha256").update(image).digest("hex"),
      preview.sha256,
    );
    assert.equal(image.toString("ascii", 0, 4), "RIFF");
    assert.equal(image.toString("ascii", 8, 12), "WEBP");
    assert.equal(preview.width, 256);
    assert.equal(preview.height, 192);
    assert.ok(preview.atoms > 0);
    if (preview.provider === "AlphaFold") {
      const metadata =
        index.resources[
          `https://alphafold.ebi.ac.uk/api/prediction/${protein.accession}`
        ];
      const models = verifiedModels(
        JSON.parse(await readFile(new URL(metadata.path, root))),
        protein,
      );
      assert.ok(models.some((m) => m.url === preview.coordinateSource));
    } else {
      assert.equal(preview.provider, "PDB");
      assert.ok(preview.chains.length);
      assert.ok(protein.pdb.some((m) => m.id === preview.model));
    }
  }
  assert.ok(bytes < 1000000, "Previews must stay below 1 MB in total");
});
