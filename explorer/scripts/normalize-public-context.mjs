import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  unlink,
  stat,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  validateAnnotation,
  ensemblIdentity,
} from "../src/components/gene-annotation-data.js";
import { mappedProteins } from "../src/components/protein-data.js";
const source = process.argv[2],
  output = new URL("../src/assets/public-context/", import.meta.url);
const meta = JSON.parse(await readFile(`${source}/metadata.json`));
const genes = JSON.parse(
  await readFile(new URL("../src/data/genes.json", import.meta.url)),
);
const atlas = JSON.parse(
  await readFile(new URL("../src/data/atlas.json", import.meta.url)),
);
const oxphos = new Set(atlas.landscape.map((g) => g.gene));
const compactIds = new Set(
  genes
    .filter((g) => g.selected && oxphos.has(g.symbol))
    .map((g) => ensemblIdentity(g.id).stableId),
);
let previous = {};
try {
  previous = JSON.parse(await readFile(new URL("index.json", output)));
} catch {}
const ids = new Set(genes.map((g) => ensemblIdentity(g.id).stableId));
const buckets = Object.fromEntries(
  Array.from({ length: 100 }, (_, i) => [
    String(i).padStart(2, "0"),
    { genes: {}, proteins: {} },
  ]),
);
const bucket = (id) => buckets[id.slice(-2)];
for (const file of (await readdir(source)).filter((f) =>
  /^ensembl-\d+.json$/.test(f),
)) {
  const retrievedAt = (await stat(`${source}/${file}`)).mtime.toISOString();
  for (const [id, record] of Object.entries(
    JSON.parse(await readFile(`${source}/${file}`)),
  )) {
    if (!ids.has(id)) throw new Error("Unexpected gene");
    bucket(id).genes[id] = record
      ? {
          ...validateAnnotation(record, ensemblIdentity(id)),
          source: `https://rest.ensembl.org/lookup/id/${id}?content-type=application/json`,
          retrievedAt,
        }
      : null;
  }
}
const payload = JSON.parse(await readFile(`${source}/uniprot.json`));
let count = 0;
for (const record of payload.results || []) {
  const matches = new Set(
    (record.uniProtKBCrossReferences || [])
      .filter((r) => r.database === "Ensembl")
      .flatMap((r) =>
        (r.properties || [])
          .filter((p) => p.key === "GeneId")
          .map((p) => p.value.replace(/\.\d+$/, "")),
      )
      .filter((id) => ids.has(id)),
  );
  for (const id of matches) {
    const proteins = mappedProteins({ results: [record] }, id);
    if (!proteins.length) continue;
    (bucket(id).proteins[id] ??= []).push(...proteins);
    count += proteins.length;
  }
}
await mkdir(new URL("extended/", output), { recursive: true });
const shards = {},
  extendedShards = {},
  keep = new Set();
let bytes = 0,
  compactBytes = 0,
  found = 0;
for (const [key, value] of Object.entries(buckets)) {
  for (const list of Object.values(value.proteins))
    list.sort(
      (a, b) =>
        Number(b.reviewed) - Number(a.reviewed) ||
        a.accession.localeCompare(b.accession),
    );
  found += Object.values(value.genes).filter(Boolean).length;
  const compact = {
    genes: value.genes,
    proteins: Object.fromEntries(
      Object.entries(value.proteins)
        .filter(([id]) => compactIds.has(id))
        .map(([id, proteins]) => [
          id,
          proteins.filter((p) => p.reviewed).slice(0, 1),
        ]),
    ),
  };
  for (const [content, directory, target] of [
    [compact, "", shards],
    [{ proteins: value.proteins }, "extended/", extendedShards],
  ]) {
    const text = JSON.stringify(content),
      hash = createHash("sha256").update(text).digest("hex"),
      name = `${directory}${key}-${hash.slice(0, 16)}.json`;
    await writeFile(new URL(name, output), text);
    target[key] = name;
    keep.add(name);
    bytes += Buffer.byteLength(text);
    if (!directory) compactBytes += Buffer.byteLength(text);
  }
}
const retrievalStartedAt = new Date(
  Math.min(
    ...(await Promise.all(
      (await readdir(source))
        .filter((f) => /^ensembl-\d+.json$/.test(f))
        .map(async (f) => (await stat(`${source}/${f}`)).mtimeMs),
    )),
  ),
).toISOString();
await writeFile(
  new URL("index.json", output),
  JSON.stringify({
    ...previous,
    ...meta,
    retrievalStartedAt,
    shards,
    extendedShards,
    foundGenes: found,
    proteinMappings: count,
    bytes,
    compactBytes,
    compactScope:
      "All archived gene IDs with available current Ensembl annotations, plus one reviewed protein record per OXPHOS gene where available. Complete protein annotations and interactive coordinates are self-hosted online resources.",
    licenses: [
      {
        source: "Ensembl / EMBL-EBI",
        terms: "https://www.ensembl.org/info/about/legal/disclaimer.html",
        license:
          "Ensembl unrestricted data-use terms; source attributions retained",
      },
      {
        source: "UniProt Consortium",
        terms: "https://www.uniprot.org/help/license",
        license: "CC-BY-4.0",
      },
    ],
  }),
);
for (const directory of ["", "extended/"])
  for (const name of await readdir(new URL(directory || "./", output)))
    if (/^\d{2}-[a-f0-9]+\.json$/.test(name) && !keep.has(directory + name))
      await unlink(new URL(directory + name, output));
console.log(
  `Snapshot: ${found}/${ids.size} current genes; ${count} exact-ID protein mappings; compact ${compactBytes} bytes; total annotations ${bytes} bytes.`,
);
