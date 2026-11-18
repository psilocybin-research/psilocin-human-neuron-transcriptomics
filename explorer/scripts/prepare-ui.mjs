import { build, transform } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url),
  out = new URL("src/assets/vendor/", root);
await mkdir(out, { recursive: true });
const result = await build({
  entryPoints: [fileURLToPath(new URL("scripts/framework7-entry.js", root))],
  outfile: fileURLToPath(new URL("framework7.js", out)),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["es2022"],
  legalComments: "inline",
  metafile: true,
});
// Match CSS to the slim runtime, retaining CSS-only form/preloader dependencies.
const runtimeEntry = await readFile(
  new URL("scripts/framework7-entry.js", root),
  "utf8",
);
const components = [
  ...new Set([
    ...[
      ...runtimeEntry.matchAll(
        /from ['"]framework7\/components\/([^'"]+)['"]/g,
      ),
    ].map((match) => match[1]),
    "form",
    "input",
    "checkbox",
    "radio",
    "preloader",
    "grid",
  ]),
];
const stylesheet = (
  await Promise.all(
    [
      "node_modules/framework7/framework7.css",
      ...components.map(
        (name) => `node_modules/framework7/components/${name}/${name}.css`,
      ),
    ].map((path) => readFile(new URL(path, root), "utf8")),
  )
).join("\n");
const css = await transform(stylesheet, {
  loader: "css",
  minify: true,
  legalComments: "inline",
  target: ["es2022"],
});
await writeFile(new URL("framework7.css", out), css.code);
const packages = [
  ...new Set(
    Object.keys(result.metafile.inputs)
      .map((p) => p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1])
      .filter(Boolean),
  ),
].sort();
packages.push("framework7-icons");
let notices = "Framework7 research interface: bundled runtime notices\n\n";
for (const name of packages) {
  const directory = new URL(`node_modules/${name}/`, root),
    pkg = JSON.parse(
      await readFile(new URL("package.json", directory), "utf8"),
    );
  let license;
  for (const candidate of ["LICENSE", "LICENSE.md", "license", "license.md"]) {
    try {
      license = await readFile(new URL(candidate, directory), "utf8");
      break;
    } catch {}
  }
  if (!license) throw new Error(`Missing runtime license for ${name}`);
  notices += `${name} ${pkg.version}\n${license}\n\n`;
}
await writeFile(new URL("framework7.NOTICES.txt", out), notices);
const runtime = new URL("framework7.js", out);
await writeFile(
  runtime,
  `/*!\n${notices}*/\n${await readFile(runtime, "utf8")}`,
);
console.log(
  `Prepared Framework7 9.3.0 and ${packages.length} licensed runtime packages.`,
);

// Ship only the official SVG glyphs used by this interface; no icon font or CDN.
const iconNames = [
  "eye",
  "viewfinder",
  "square_grid_3x2",
  "doc_text_search",
  "arrow_branch",
  "checkmark_shield",
  "chart_bar",
  "book",
  "moon",
  "sun_max",
  "line_horizontal_3",
  "search",
  "slider_horizontal_3",
  "arrow_down_to_line",
  "info_circle",
  "xmark",
  "chevron_left",
  "printer",
  "textformat_size",
  "arrow_up_left_arrow_down_right",
  "arrow_down_right_arrow_up_left",
  "arrow_up",
  "logo_github",
  "chevron_left_slash_chevron_right",
  "play_fill",
  "plus",
  "minus",
  "doc_on_doc",
  "checkmark",
];
const icons = {};
for (const name of iconNames) {
  const svg = await readFile(
    new URL(`node_modules/framework7-icons/svg/${name}.svg`, root),
    "utf8",
  );
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1],
    body = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1];
  if (!viewBox || !body || /<script|<foreignObject|href=/i.test(body))
    throw new Error(`Invalid official icon: ${name}`);
  icons[name] = { viewBox, body };
}
const iconLicense = await readFile(
  new URL("node_modules/framework7-icons/LICENSE", root),
  "utf8",
);
await writeFile(
  new URL("framework7-icons.js", out),
  `/*!\n${iconLicense}*/\nexport const icons=${JSON.stringify(icons)};\n`,
);
