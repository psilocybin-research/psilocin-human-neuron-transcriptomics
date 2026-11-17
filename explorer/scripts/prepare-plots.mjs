import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url),
  output = new URL("src/assets/vendor/", root);
await mkdir(output, { recursive: true });
const target = new URL("observable-plot.js", output);
const result = await build({
  entryPoints: [
    fileURLToPath(new URL("scripts/observable-plot-entry.js", root)),
  ],
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
let notices =
  "Observable Plot statistical renderer: bundled runtime notices\n\n";
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
await writeFile(new URL("observable-plot.NOTICES.txt", output), notices);
await writeFile(target, `/*!\n${notices}*/\n${await readFile(target, "utf8")}`);
console.log(
  `Prepared Observable Plot with ${packages.length} licensed runtime packages.`,
);
