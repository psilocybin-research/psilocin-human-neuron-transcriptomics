const server = "https://rest.ensembl.org";
export function ensemblIdentity(id) {
  const match = /^(ENSG\d{11})(?:\.(\d+))?$/.exec(id);
  if (!match) throw new Error("A human Ensembl gene identifier is required.");
  return {
    stableId: match[1],
    archivedVersion: match[2] ? Number(match[2]) : null,
  };
}
export function validateAnnotation(record, identity) {
  if (
    record.id !== identity.stableId ||
    record.species !== "homo_sapiens" ||
    record.object_type !== "Gene"
  ) {
    throw new Error(
      "The provider returned a different gene or species. No annotation was applied.",
    );
  }
  const coordinate =
    Number.isSafeInteger(record.start) &&
    Number.isSafeInteger(record.end) &&
    record.start > 0 &&
    record.end >= record.start;
  return {
    id: record.id,
    version: Number.isSafeInteger(record.version) ? record.version : null,
    symbol:
      typeof record.display_name === "string"
        ? record.display_name
        : "Not supplied",
    description:
      typeof record.description === "string"
        ? record.description
        : "No description supplied by Ensembl.",
    biotype:
      typeof record.biotype === "string" ? record.biotype : "Not supplied",
    assembly:
      typeof record.assembly_name === "string"
        ? record.assembly_name
        : "Not supplied",
    location: coordinate
      ? `${record.seq_region_name}:${record.start.toLocaleString("en-US")}–${record.end.toLocaleString("en-US")}`
      : "Not supplied",
    strand:
      record.strand === 1 ? "+" : record.strand === -1 ? "−" : "Not supplied",
  };
}
// Bounded session cache; requests never change archived records or aliases.
export function createAnnotationClient({
  fetcher = (...args) => fetch(...args),
  now = () => new Date(),
  timeout = 10000,
} = {}) {
  const cache = new Map();
  return {
    lookup(id) {
      const identity = ensemblIdentity(id);
      if (cache.has(identity.stableId)) return cache.get(identity.stableId);
      const source = `${server}/lookup/id/${identity.stableId}?content-type=application/json`;
      const request = (async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetcher(source, {
            signal: controller.signal,
            credentials: "omit",
            referrerPolicy: "no-referrer",
          });
          if (!response.ok)
            throw new Error(
              response.status === 404 || response.status === 400
                ? "This archived ID is not available from the current Ensembl service. It may have been retired; the archived result remains valid."
                : `Ensembl is unavailable (HTTP ${response.status}). Try again later.`,
            );
          const annotation = validateAnnotation(
            await response.json(),
            identity,
          );
          return { ...annotation, source, retrievedAt: now().toISOString() };
        } catch (error) {
          cache.delete(identity.stableId);
          if (error.name === "AbortError")
            throw new Error(
              "Ensembl did not respond in time. Try again later.",
            );
          throw error;
        } finally {
          clearTimeout(timer);
        }
      })();
      cache.set(identity.stableId, request);
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      return request;
    },
  };
}
