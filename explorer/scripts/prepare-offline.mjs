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
      !["sw.js", "offline-manifest.json"].includes(name) &&
      !name.endsWith(".map") &&
      !/^public-context\/(?:extended|models|predictions)\//.test(name)
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
const core = files.filter((file) => !optional(file));
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
  new URL("sw.js", root),
  `const INVENTORY=${JSON.stringify(inventory)};\n${template}`,
);
console.log(
  `Offline inventory ${inventory.version}: ${core.length} core files, ${inventory.bytes} decoded bytes.`,
);
