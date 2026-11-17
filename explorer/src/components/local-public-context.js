// Frozen external context is kept separate from archived experimental estimates.
let indexRequest;
const shards = new Map();
const base = () => new URL("public-context/", new URL("./", document.baseURI));
export async function contextIndex() {
  if (!indexRequest)
    indexRequest = fetch(new URL("index.json", base()), {
      credentials: "omit",
      cache: "no-cache",
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  return indexRequest;
}
async function readShard(name) {
  if (!shards.has(name)) {
    const request = fetch(new URL(name, base()), { credentials: "omit" })
      .then((r) => {
        if (!r.ok)
          throw new Error(
            "The local molecular snapshot is incomplete. Reconnect or repair the offline package.",
          );
        return r.json();
      })
      .catch((error) => {
        shards.delete(name);
        throw error;
      });
    shards.set(name, request);
    if (shards.size > 8) shards.delete(shards.keys().next().value);
  }
  return shards.get(name);
}
export async function cachedContextFile(path) {
  if (!("caches" in globalThis)) return null;
  try {
    return await caches.match(new URL(path, base()));
  } catch {
    return null;
  }
}
export async function loadLocalContext(id, { extended = false } = {}) {
  const stable = String(id).replace(/\.\d+$/, ""),
    index = await contextIndex();
  if (!index) return null;
  const name = index.shards[stable.slice(-2)];
  if (!name) return null;
  const shard = await readShard(name);
  if (!Object.hasOwn(shard.genes, stable)) return null;
  let proteins = shard.proteins[stable] || [],
    compact = true;
  const fullName = index.extendedShards?.[stable.slice(-2)];
  if (extended && fullName) {
    const saved = await cachedContextFile(fullName);
    if (saved) {
      proteins = (await saved.json()).proteins[stable] || [];
      compact = false;
    } else if (
      navigator.onLine &&
      !new URL(location.href).searchParams.has("offline-test")
    )
      try {
        proteins = (await readShard(fullName)).proteins[stable] || [];
        compact = false;
      } catch {
        /* Essential context remains available if the larger shard cannot load. */
      }
  }
  return { gene: shard.genes[stable], proteins, metadata: index, compact };
}
export async function localResource(url) {
  const index = await contextIndex(),
    record = index?.resources?.[url];
  return record ? { ...record, url: new URL(record.path, base()).href } : null;
}
const allowedResource = (url) =>
  /^https:\/\/(?:files\.rcsb\.org\/download\/[0-9][A-Za-z0-9]{3}\.cif|alphafold\.ebi\.ac\.uk\/(?:files\/[A-Za-z0-9_.-]+\.cif|api\/prediction\/[A-Za-z0-9]+))$/.test(
    url,
  );
const resourceCache = () =>
  `psilocin-public-models:${new URL("./", document.baseURI).pathname}`;
export async function savedPublicResource(url) {
  if (!allowedResource(url) || !("caches" in globalThis)) return null;
  try {
    const response = await (await caches.open(resourceCache())).match(url);
    return response
      ? {
          value: await response.text(),
          retrievedAt: response.headers.get("x-atlas-retrieved"),
          source: url,
          snapshot: true,
        }
      : null;
  } catch {
    return null;
  }
}
export async function savePublicResource(url, value, retrievedAt) {
  if (!allowedResource(url) || !("caches" in globalThis)) return;
  try {
    const cache = await caches.open(resourceCache()),
      bytes = new TextEncoder().encode(value).length;
    await cache.put(
      url,
      new Response(value, {
        headers: {
          "content-type": url.endsWith(".cif")
            ? "text/plain"
            : "application/json",
          "content-length": String(bytes),
          "x-atlas-retrieved": retrievedAt,
        },
      }),
    );
    const entries = [];
    let total = 0;
    for (const key of await cache.keys()) {
      const response = await cache.match(key),
        size = Number(response.headers.get("content-length")) || 0;
      entries.push({ key, size });
      total += size;
    }
    let remaining = entries.length;
    for (const entry of entries) {
      if (total <= 64000000 && remaining <= 50) break;
      if (entry.key.url !== String(url)) {
        await cache.delete(entry.key);
        total -= entry.size;
        remaining--;
      }
    }
  } catch {
    /* Quota failure does not invalidate the core offline package. */
  }
}
