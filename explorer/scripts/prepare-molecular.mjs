import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
const dest = new URL("../src/assets/vendor/", import.meta.url);
await mkdir(dest, { recursive: true });
for (const name of ["molstar.js", "molstar.css"])
  await copyFile(
    new URL("../node_modules/molstar/build/viewer/" + name, import.meta.url),
    new URL(name, dest),
  );
await writeFile(
  new URL("molstar.NOTICES.txt", dest),
  "Mol* 5.13.1\nhttps://molstar.org/\n" +
    (await readFile(
      new URL("../node_modules/molstar/LICENSE", import.meta.url),
      "utf8",
    )),
);

const bundle = await readFile(
  new URL("../node_modules/molstar/build/viewer/molstar.js", import.meta.url),
  "utf8",
);
const bundledNotices = bundle.slice(
  bundle.indexOf("/*! Bundled license information:"),
);
await writeFile(
  new URL("../vendor/molecular/molstar-NOTICES.txt", import.meta.url),
  "Mol* 5.13.1 · MIT\n" +
    (await readFile(
      new URL("../node_modules/molstar/LICENSE", import.meta.url),
      "utf8",
    )) +
    "\n" +
    bundledNotices,
);
