import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
