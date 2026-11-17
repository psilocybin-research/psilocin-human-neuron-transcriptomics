// Render only verified OXPHOS mappings from the local, licensed coordinate snapshot.
// Run explicitly after snapshot-structures.py; ordinary builds reuse these small files.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { verifiedModels } from "../src/components/protein-data.js";
const root = new URL("../src/assets/public-context/", import.meta.url);
const index = JSON.parse(await readFile(new URL("index.json", root)));
const genes = JSON.parse(
  await readFile(new URL("../src/data/genes.json", import.meta.url)),
);
const symbols = new Map(
  genes.map((g) => [g.id.replace(/\.\d+$/, ""), g.symbol]),
);
const jobs = [];
for (const file of Object.values(index.shards)) {
  const shard = JSON.parse(await readFile(new URL(file, root)));
  for (const [gene, proteins] of Object.entries(shard.proteins)) {
    const protein = proteins[0];
    if (!protein) continue;
    let model;
    const metadata =
      index.resources[
        `https://alphafold.ebi.ac.uk/api/prediction/${protein.accession}`
      ];
    if (metadata) {
      const records = JSON.parse(await readFile(new URL(metadata.path, root)));
      const prediction = verifiedModels(records, protein).find(
        (m) => index.resources[m.url],
      );
      if (prediction)
        model = { ...prediction, provider: "AlphaFold", predicted: true };
    }
    if (!model) {
      const pdb = protein.pdb.find(
        (m) => index.resources[`https://files.rcsb.org/download/${m.id}.cif`],
      );
      if (pdb)
        model = {
          ...pdb,
          provider: "PDB",
          predicted: false,
          url: `https://files.rcsb.org/download/${pdb.id}.cif`,
        };
    }
    if (model)
      jobs.push({
        gene,
        symbol: symbols.get(gene),
        accession: protein.accession,
        sequenceVersion: protein.sequenceVersion,
        model,
        resource: index.resources[model.url],
      });
  }
}
const runtime = await readFile(
  new URL("../node_modules/3dmol/build/3Dmol.es6-min.js", import.meta.url),
);
const server = createServer((request, response) => {
  response.setHeader(
    "content-type",
    request.url === "/runtime.js" ? "text/javascript" : "text/html",
  );
  response.end(
    request.url === "/runtime.js"
      ? runtime
      : '<!doctype html><html><body style="margin:0"><div id="stage" style="width:256px;height:192px;position:relative"></div></body></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
  ...(process.env.BROWSER_PATH
    ? { executablePath: process.env.BROWSER_PATH }
    : {}),
});
const previews = {},
  failures = [];
await mkdir(new URL("previews/", root), { recursive: true });
try {
  const page = await browser.newPage({
    viewport: { width: 256, height: 192 },
    deviceScaleFactor: 1,
  });
  await page.goto(origin);
  for (const job of jobs) {
    const coordinates = await readFile(
      new URL(job.resource.path, root),
      "utf8",
    );
    try {
      const rendered = await page.evaluate(
        async ({ coordinates, model }) => {
          const { createViewer } = await import("/runtime.js");
          const stage = document.querySelector("#stage");
          stage.replaceChildren();
          const viewer = createViewer(stage, {
            backgroundColor: "white",
            backgroundAlpha: 0,
            antialias: true,
          });
          const parsed = viewer.addModel(coordinates, "cif", {
            multimodel: false,
          });
          let selection = {},
            chains = [];
          if (!model.predicted) {
            const requested = [
              ...model.chains.matchAll(/([A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)*)=/g),
            ].flatMap((match) => match[1].split("/"));
            const available = new Set(
              parsed.selectedAtoms({}).map((atom) => atom.chain),
            );
            // A PDB assembly is never silently portrayed as one gene product.
            chains = requested.filter((chain) => available.has(chain));
            if (!chains.length)
              throw Error(
                "Mapped UniProt chains could not be verified in parsed coordinates.",
              );
            selection = { chain: chains };
          }
          const atoms = parsed.selectedAtoms(selection).length;
          if (!atoms) throw Error("No selected atoms.");
          const confidence = (atom) =>
            !Number.isFinite(atom.b)
              ? "#9aa7b1"
              : atom.b >= 90
                ? "#0053d6"
                : atom.b >= 70
                  ? "#65cbf3"
                  : atom.b >= 50
                    ? "#ffdb13"
                    : "#ff7d45";
          viewer.setStyle({}, {});
          viewer.setStyle(selection, {
            cartoon: model.predicted
              ? { colorfunc: confidence }
              : { color: "spectrum" },
          });
          viewer.zoomTo(selection);
          viewer.render();
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          const canvas = stage.querySelector("canvas");
          const image = document.createElement("canvas");
          image.width = 256;
          image.height = 192;
          image.getContext("2d").drawImage(canvas, 0, 0, 256, 192);
          const data = image.toDataURL("image/webp", 0.85);
          viewer.clear();
          (canvas.getContext("webgl2") || canvas.getContext("webgl"))
            ?.getExtension("WEBGL_lose_context")
            ?.loseContext();
          stage.replaceChildren();
          return { data, atoms, chains };
        },
        { coordinates, model: job.model },
      );
      const buffer = Buffer.from(rendered.data.split(",")[1], "base64");
      if (buffer.length < 200) throw Error("Empty preview image.");
      const hash = createHash("sha256").update(buffer).digest("hex");
      const path = `previews/${job.gene}-${hash.slice(0, 12)}.webp`;
      await writeFile(new URL(path, root), buffer);
      previews[job.gene] = {
        path,
        bytes: buffer.length,
        sha256: hash,
        width: 256,
        height: 192,
        symbol: job.symbol,
        accession: job.accession,
        sequenceVersion: job.sequenceVersion,
        provider: job.model.provider,
        model: job.model.id,
        coordinateSource: job.model.url,
        coordinateSha256: job.resource.sha256,
        retrievedAt: job.resource.retrievedAt,
        license: job.resource.license,
        chains: rendered.chains,
        atoms: rendered.atoms,
        scope: job.model.predicted
          ? "Exact canonical-sequence prediction; colours encode local pLDDT confidence, not experimental effects."
          : "Only UniProt-mapped PDB chains are shown; may be fragments or engineered sequences. Rainbow colours encode sequence position.",
      };
      console.log(
        `${job.symbol}: ${job.model.provider} ${buffer.length} bytes`,
      );
    } catch (error) {
      failures.push({
        gene: job.gene,
        accession: job.accession,
        reason: error.message,
      });
      console.error(job.symbol, error.message);
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
await writeFile(
  new URL("previews.json", root),
  JSON.stringify({
    renderer:
      "3Dmol.js 2.5.5; 256 × 192 WebP; deterministic default orientation",
    scope:
      "One representative verified model per mapped OXPHOS gene, where rendering succeeds. External protein context, not measured protein abundance or a psilocin response.",
    genes: previews,
    failures,
  }),
);
console.log(
  `Prepared ${Object.keys(previews).length}/${jobs.length} previews; ${Object.values(previews).reduce((sum, item) => sum + item.bytes, 0)} bytes.`,
);
if (failures.length) process.exitCode = 1;

const registry = Object.fromEntries(
  Object.entries(previews).map(([id, record]) => [
    id,
    {
      path: record.path,
      accession: record.accession,
      provider: record.provider,
      model: record.model,
      coordinateSource: record.coordinateSource,
      chains: record.chains,
      scope: record.scope,
    },
  ]),
);
await writeFile(
  new URL("../structure-previews.js", root),
  `// Generated by prepare-structure-previews.mjs; provenance: public-context/previews.json.\nexport const structurePreviews = ${JSON.stringify(registry)};\n`,
);

const keep = new Set(Object.values(previews).map((record) => record.path));
for (const name of await readdir(new URL("previews/", root)))
  if (name.endsWith(".webp") && !keep.has("previews/" + name))
    await unlink(new URL("previews/" + name, root));
