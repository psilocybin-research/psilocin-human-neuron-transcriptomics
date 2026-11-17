import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  out = new URL("src/assets/vendor/", root);
await mkdir(out, { recursive: true });
const packages = ["3dmol", "pako", "netcdfjs", "iobuffer", "upng-js"];
let notices =
  "On-demand molecular viewer: 3Dmol.js 2.5.5 and bundled dependency notices\n\n";
const require = createRequire(new URL("node_modules/3dmol/package.json", root));
for (const name of packages) {
  const pkgPath = require.resolve(`${name}/package.json`);
  const dir = new URL("./", pathToFileURL(pkgPath)),
    pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  let license;
  for (const filename of ["LICENSE", "LICENSE.md", "LICENSE.txt", "license"]) {
    try {
      license = await readFile(new URL(filename, dir), "utf8");
      break;
    } catch {}
  }
  if (!license) throw new Error(`Missing molecular runtime license: ${name}`);
  notices += `${name} ${pkg.version} (${pkg.license})\n${license}\n\n`;
}
notices +=
  "Zlib licence for embedded compression code\n" +
  (await readFile(new URL("../LICENSES/Zlib.txt", root), "utf8"));
await writeFile(new URL("3dmol.NOTICES.txt", out), notices);
await writeFile(
  new URL("3dmol.js", out),
  `/*!\n${notices}*/\n${await readFile(new URL("node_modules/3dmol/build/3Dmol.es6-min.js", root), "utf8")}`,
);
console.log("Prepared lazy 3Dmol.js molecular viewer with runtime notices.");
