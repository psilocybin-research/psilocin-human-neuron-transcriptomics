import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildSource } from "./build-source.mjs";
const root = new URL("../", import.meta.url),
  output = new URL("src/assets/vendor/", root);
await mkdir(output, { recursive: true });
const target = new URL("network-3d.js", output);
const result = await build({
  entryPoints: [fileURLToPath(new URL("scripts/network-3d-entry.js", root))],
  outfile: fileURLToPath(target),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
  legalComments: "inline",
  metafile: true,
});
const packages = [
  ...new Set(
    Object.keys(result.metafile.inputs)
      .map((p) => p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1])
      .filter(Boolean),
  ),
].sort();
let notices = "3D membership network renderer: bundled runtime notices\n\n";
for (const name of packages) {
  const directory = new URL(`node_modules/${name}/`, root),
    pkg = JSON.parse(
      await readFile(new URL("package.json", directory), "utf8"),
    );
  let license;
  for (const file of [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
    "license",
    "license.md",
  ]) {
    try {
      license = await readFile(new URL(file, directory), "utf8");
      break;
    } catch {}
  }
  if (!license) throw new Error(`Missing license: ${name}`);
  notices += `${name} ${pkg.version} (${pkg.license})\n${license}\n\n`;
}
await writeFile(new URL("network-3d.NOTICES.txt", output), notices);
await writeFile(target, `/*!\n${notices}*/\n${await readFile(target, "utf8")}`);
console.log(
  `Prepared 3D membership network with ${packages.length} licensed runtime packages.`,
);

const { buildOxphosNetwork } = await import(
  "../src/components/oxphos-network-data.js"
);
const [data, genes, annotations] = await Promise.all([
  readFile(new URL("src/data/atlas.json", root), "utf8").then(JSON.parse),
  readFile(new URL("src/data/genes.json", root), "utf8").then(JSON.parse),
  readFile(
    new URL("../config/oxphos_complex_membership.json", root),
    "utf8",
  ).then(JSON.parse),
]);
const network = buildOxphosNetwork(data, genes, annotations);
await writeFile(
  new URL("oxphos-network-data.js", output),
  `export default ${JSON.stringify(network)};\n`,
);
// A public, reproducible notice file accompanies the locally bundled renderer.
await writeFile(
  new URL("../third_party_licenses/network-3d.txt", root),
  notices,
);
console.log(
  `Prepared ${network.nodes.filter((n) => n.type === "gene").length} genes and ${network.links.length} literal membership edges.`,
);

// Research context is a separate lazy module: opening the overview never loads it.
const { csvParse } = await import("d3-dsv");
const { createHash } = await import("node:crypto");
const cameraSource = await readFile(
  new URL("../tables/camera_sensitivity/all_tests.csv", root),
  "utf8",
);
const bayesian = JSON.parse(
  await readFile(new URL("src/data/bayesian.json", root), "utf8"),
);
const pathway = "HALLMARK_OXIDATIVE_PHOSPHORYLATION";
const research = {
  profiles: data.profiles,
  enrichment: data.sensitivities
    .filter((r) => r.pathway === pathway)
    .map(({ leadingEdge, ...r }) => r),
  camera: csvParse(cameraSource).filter((r) => r.pathway === pathway),
  bayesian,
  source_sha256: {
    "tables/camera_sensitivity/all_tests.csv": createHash("sha256")
      .update(cameraSource)
      .digest("hex"),
  },
};
await writeFile(
  new URL("oxphos-research-data.js", output),
  `export default ${JSON.stringify(research)};\n`,
);

// Small independent snapshot for the pathway methods view; no 3D runtime import.
const sourceFiles = [
  "explorer/src/data/atlas.json",
  "explorer/src/data/bayesian.json",
  "tables/camera_sensitivity/all_tests.csv",
  "reports/camera_sensitivity_methods.md",
  "reports/bayesian_oxphos_methods.md",
  "tables/bayesian_oxphos/posterior_summary.csv",
];
const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async (path) => [
  path, createHash("sha256").update(await readFile(new URL(`../${path}`, root))).digest("hex"),
])));
await writeFile(new URL("method-comparison-data.js", output),
  `export default ${JSON.stringify({ schema: 1, archive: "10.5281/zenodo.23283595", camera: csvParse(cameraSource), bayesian, sources })};\n`);

// Versioned exploratory directional analysis; separate from archived summaries.
const directional = JSON.parse(await readFile(new URL('src/data/bayesian-directional.json', root), 'utf8'));
await writeFile(new URL('bayesian-directional-data.js', output), `export default ${JSON.stringify(directional)};\n`);

// Pin repository browsing to the source revision used by this build.
await writeFile(new URL("app-build.js", output), `export default ${JSON.stringify(buildSource(root))};\n`);
