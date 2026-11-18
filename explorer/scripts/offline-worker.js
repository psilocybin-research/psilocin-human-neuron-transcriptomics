/* The build prepends content-verified core offline inventory. */
const scope = self.registration.scope;
const prefix = `psilocin-atlas:${new URL(scope).pathname}:`;
const absolute = (path) => new URL(path, scope).href;
const metaName = `${prefix}meta`;
const inventories = { core: INVENTORY };
const pointerValues = new Map(),
  preparing = new Map(),
  controllers = new Map();
const pointerURL = (kind) => absolute(`__offline_${kind}__`);
const packName = (kind) => `${prefix}${kind}:${inventories[kind].version}`;
async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function pointer(kind = "core") {
  if (pointerValues.has(kind)) return pointerValues.get(kind);
  const response = await (await caches.open(metaName)).match(pointerURL(kind));
  const record = response ? await response.json() : null;
  pointerValues.set(kind, record);
  return record;
}
async function commit(kind, record) {
  await (
    await caches.open(metaName)
  ).put(pointerURL(kind), Response.json(record));
  pointerValues.set(kind, record);
}
async function verified(response, file) {
  if (!response?.ok || response.type === "opaque")
    throw new Error(`Unavailable: ${file.path}`);
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== file.bytes || (await digest(bytes)) !== file.sha256)
    throw new Error(`Integrity mismatch: ${file.path}`);
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("etag");
  headers.set("content-length", String(bytes.byteLength));
  return new Response(bytes, { status: response.status, headers });
}
async function broadcast(message) {
  for (const client of await self.clients.matchAll({
    includeUncontrolled: true,
  }))
    if (client.url.startsWith(scope)) client.postMessage(message);
}
async function prepare(kind = "core", { activate = true } = {}) {
  if (preparing.has(kind)) return preparing.get(kind);
  const controller = new AbortController();
  controllers.set(kind, controller);
  const task = (async () => {
    const inventory = inventories[kind],
      name = packName(kind),
      cache = await caches.open(name),
      previous = await pointer(kind);
    const existingReadyResponse = await cache.match(
      absolute("__offline_ready__"),
    );
    const existingReady = existingReadyResponse
      ? await existingReadyResponse.json()
      : null;
    const oldCache = previous && (await caches.open(previous.cache));
    const oldManifest =
      oldCache && (await oldCache.match(absolute("__offline_inventory__")));
    const oldFiles = oldManifest ? (await oldManifest.json()).files : [];
    const byHash = new Map(oldFiles.map((file) => [file.sha256, file.path]));
    let bytes = 0,
      downloadedBytes = 0,
      cursor = 0,
      failure;
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (!failure && cursor < inventory.files.length) {
          const file = inventory.files[cursor++],
            url = absolute(file.path);
          try {
            if (controller.signal.aborted)
              throw new Error("Offline download cancelled.");
            let response = await cache.match(url);
            try {
              await verified(response, file);
            } catch {
              const oldPath = byHash.get(file.sha256);
              response = oldPath && (await oldCache.match(absolute(oldPath)));
              try {
                response = await verified(response, file);
              } catch {
                const signal = AbortSignal.any([
                  controller.signal,
                  AbortSignal.timeout(120000),
                ]);
                response = await verified(
                  await fetch(url, {
                    cache: "no-store",
                    credentials: "omit",
                    redirect: "error",
                    signal,
                  }),
                  file,
                );
                downloadedBytes += file.bytes;
              }
              await cache.put(url, response);
            }
            bytes += file.bytes;
            await broadcast({
              type: "OFFLINE_PROGRESS",
              kind,
              bytes,
              total: inventory.bytes,
              downloadedBytes,
            });
          } catch (error) {
            failure ??= error;
            controller.abort();
          }
        }
      }),
    );
    if (failure) throw failure;
    for (const file of inventory.files)
      await verified(await cache.match(absolute(file.path)), file);
    await cache.put(
      absolute("__offline_inventory__"),
      Response.json({ files: inventory.files }),
    );
    const record = {
      version: inventory.version,
      cache: name,
      previous: previous?.cache === name ? previous.previous : previous?.cache,
      files: inventory.files.length,
      bytes: inventory.bytes,
      downloadedBytes: downloadedBytes || existingReady?.downloadedBytes || 0,
      verifiedAt: new Date().toISOString(),
    };
    await cache.put(absolute("__offline_ready__"), Response.json(record));
    if (activate) await commit(kind, record);
    return record;
  })();
  preparing.set(kind, task);
  try {
    return await task;
  } finally {
    preparing.delete(kind);
    controllers.delete(kind);
  }
}
async function audit(kind = "core") {
  const record = await pointer(kind),
    inventory = inventories[kind];
  if (record?.version !== inventory.version)
    throw new Error(
      `The ${kind === "core" ? "research app" : "optional molecular library"} has not been prepared for this release.`,
    );
  const cache = await caches.open(record.cache);
  for (const file of inventory.files)
    await verified(await cache.match(absolute(file.path)), file);
  return { ...record, verifiedAt: new Date().toISOString() };
}
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      // Full downloads are explicit; existing opted-in packages update by hash.
      try {
        if (await pointer()) await prepare("core", { activate: false });
      } catch (error) {
        await broadcast({
          type: "OFFLINE_UPDATE_FAILED",
          error: error.message,
        });
        throw error;
      }
      await self.skipWaiting();
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const kind of ["core"]) {
        const staged = await (
          await caches.open(packName(kind))
        ).match(absolute("__offline_ready__"));
        if (staged) await commit(kind, await staged.json());
      }
      await self.clients.claim();
      const record = await pointer();
      await broadcast({
        type: "OFFLINE_ACTIVATED",
        version: INVENTORY.version,
        ready: record?.version === INVENTORY.version,
      });
    })(),
  ),
);
self.addEventListener("message", (event) => {
  const port = event.ports[0],
    kind = event.data?.kind === "library" ? "library" : "core";
  if (!port || !event.source?.url?.startsWith(scope)) return;
  event.waitUntil(
    (async () => {
      try {
        if (kind !== "core" && ["PREPARE", "VERIFY"].includes(event.data?.type))
          throw new Error(
            "Molecular-library downloads are not offered by this app.",
          );
        let result;
        if (event.data?.type === "PREPARE") result = await prepare(kind);
        else if (event.data?.type === "VERIFY") result = await audit(kind);
        else if (event.data?.type === "CANCEL") {
          for (const controller of controllers.values())
            controller.abort(new Error("Offline download cancelled."));
          result = { cancelled: true };
        } else if (event.data?.type === "REMOVE_LIBRARY") {
          if (preparing.has("library"))
            throw new Error("Wait for the current download to finish.");
          await (await caches.open(metaName)).delete(pointerURL("library"));
          pointerValues.set("library", null);
          for (const name of await caches.keys())
            if (name.startsWith(`${prefix}library:`)) await caches.delete(name);
          result = { removed: true };
        } else if (event.data?.type === "CLEANUP") {
          const clients = (await self.clients.matchAll()).filter((client) =>
            client.url.startsWith(scope),
          );
          if (
            event.data.version === INVENTORY.version &&
            clients.length === 1 &&
            clients[0].id === event.source.id
          ) {
            for (const category of ["core", "library"]) {
              const record = await pointer(category),
                keep = new Set([record?.cache, record?.previous]);
              for (const name of await caches.keys())
                if (name.startsWith(`${prefix}${category}:`) && !keep.has(name))
                  await caches.delete(name);
            }
          }
          result = { cleaned: true };
        } else if (event.data?.type === "STATUS")
          result = {
            version: INVENTORY.version,
            bytes: INVENTORY.bytes,
            files: INVENTORY.files.length,
            saved: await pointer(),
          };
        else throw new Error("Unknown offline request.");
        port.postMessage({ ok: true, result });
      } catch (error) {
        port.postMessage({ ok: false, error: error.message });
      }
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    !["GET", "HEAD"].includes(request.method) ||
    url.origin !== self.location.origin ||
    !url.href.startsWith(scope)
  )
    return;
  if (
    url.pathname.endsWith("/sw.js") ||
    url.pathname.endsWith("/offline-manifest.json")
  )
    return;
  event.respondWith(
    (async () => {
      const client = event.clientId && (await self.clients.get(event.clientId));
      const cacheOnly =
        url.searchParams.has("offline-test") ||
        (client && new URL(client.url).searchParams.has("offline-test"));
      const root = new URL(scope).pathname;
      const navigation =
        request.mode === "navigate" &&
        (url.pathname === root || url.pathname === `${root}index.html`);
      const key = navigation
        ? absolute("index.html")
        : `${url.origin}${url.pathname}`;
      for (const kind of ["core", "library"]) {
        const record = await pointer(kind);
        if (!record) continue;
        for (const name of [record.cache, record.previous].filter(Boolean)) {
          const found = await (await caches.open(name)).match(key);
          if (found)
            return request.method === "HEAD"
              ? new Response(null, {
                  status: found.status,
                  headers: found.headers,
                })
              : found;
        }
      }
      if (cacheOnly)
        return new Response(
          "Offline verification: required resource is not saved.",
          { status: 503 },
        );
      return fetch(request);
    })(),
  );
});
