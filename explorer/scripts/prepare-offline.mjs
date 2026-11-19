import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = new URL("../dist/", import.meta.url);
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
async function walk(directory, path = "") {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = path + item.name;
    if (item.isDirectory())
      files.push(
        ...(await walk(new URL(item.name + "/", directory), name + "/")),
      );
    else if (
      ![
        "sw.js",
        "offline-manifest.json",
        "r-offline-manifest.json",
        "latex-offline-manifest.json",
      ].includes(name) &&
      !name.endsWith(".map") &&
      !/^public-context\/(?:extended|models|predictions)\//.test(name) &&
      !name.startsWith("webr-source/")
    ) {
      const data = await readFile(new URL(item.name, directory));
      files.push({ path: name, bytes: data.length, sha256: sha(data) });
    }
  }
  return files;
}
const htmlURL = new URL("index.html", root);
const html = (await readFile(htmlURL, "utf8")).replace(
  /<meta name="atlas-offline-release" content="[^"]+">/g,
  "",
);
await writeFile(htmlURL, html);
const template = await readFile(
  new URL("offline-worker.js", import.meta.url),
  "utf8",
);
const initialFiles = (await walk(root)).sort((a, b) =>
  a.path.localeCompare(b.path),
);
const version = sha(JSON.stringify(initialFiles) + template).slice(0, 20);
await writeFile(
  htmlURL,
  html.replace(
    "<head>",
    `<head><meta name="atlas-offline-release" content="${version}">`,
  ),
);
const files = (await walk(root)).sort((a, b) => a.path.localeCompare(b.path));
const optional = (file) =>
  /^public-context\/(?:extended|models|predictions)\//.test(file.path);
const runtimeFiles = files.filter((file) => file.path.startsWith("webr/"));
const runtimeInventory = {
  version: sha(JSON.stringify(runtimeFiles)).slice(0, 20),
  bytes: runtimeFiles.reduce((sum, file) => sum + file.bytes, 0),
  files: runtimeFiles,
};
const latexFiles = files.filter((file) => file.path.startsWith("latex/"));
const latexInventory = {
  version: sha(JSON.stringify(latexFiles)).slice(0, 20),
  bytes: latexFiles.reduce((sum, file) => sum + file.bytes, 0),
  files: latexFiles,
};
await writeFile(
  new URL("latex-offline-manifest.json", root),
  JSON.stringify(latexInventory),
);
const core = files.filter(
  (file) =>
    !optional(file) &&
    !file.path.startsWith("webr/") &&
    !file.path.startsWith("latex/") && !file.path.startsWith("python/"),
);
const inventory = {
  version,
  bytes: core.reduce((a, f) => a + f.bytes, 0),
  files: core,
};
await writeFile(
  new URL("offline-manifest.json", root),
  JSON.stringify(inventory),
);
await writeFile(
  new URL("r-offline-manifest.json", root),
  JSON.stringify(runtimeInventory),
);
await writeFile(
  new URL("sw.js", root),
  `const INVENTORY=${JSON.stringify(inventory)};\nconst R_INVENTORY=${JSON.stringify(runtimeInventory)};\nconst LATEX_INVENTORY=${JSON.stringify(latexInventory)};\n${template}`,
);
console.log(
  `Offline inventory ${inventory.version}: ${core.length} core files, ${inventory.bytes} decoded bytes.`,
);
