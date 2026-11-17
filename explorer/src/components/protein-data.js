import {
  loadLocalContext,
  localResource,
  savedPublicResource,
  savePublicResource,
} from "./local-public-context.js";
import { ensemblIdentity } from "./gene-annotation-data.js";
const accessionPattern =
  /^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/;
const baseId = (value) => String(value).replace(/\.\d+$/, "");
export async function publicRequest(
  url,
  { text = false, timeout = 12000, authorize } = {},
) {
  const cached = await savedPublicResource(url);
  if (cached)
    return { ...cached, value: text ? cached.value : JSON.parse(cached.value) };
  const saved = await localResource(url);
  if (!saved && !navigator.onLine)
    throw new Error(
      "This model is not included in the saved molecular library. Reconnect to retrieve it.",
    );
  if (!saved && authorize && !(await authorize()))
    throw new Error("External connection cancelled.");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(saved?.url || url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok)
      throw new Error(`Public resource unavailable (HTTP ${response.status}).`);
    if (Number(response.headers.get("content-length")) > 10000000)
      throw new Error(
        "This structure is too large for the compact viewer. Open the provider record instead.",
      );
    const content = await response.text();
    if (content.length > 10000000)
      throw new Error("Resource exceeds the compact viewer size limit.");
    const retrievedAt = saved?.retrievedAt || new Date().toISOString();
    if (!saved) await savePublicResource(url, content, retrievedAt);
    return {
      value: text ? content : JSON.parse(content),
      retrievedAt,
      snapshot: Boolean(saved),
      source: url,
    };
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "The public service did not respond in time. Please retry.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export function mappedProteins(payload, stableId) {
  return (payload.results || [])
    .filter((record) => {
      if (
        record.organism?.taxonId !== 9606 ||
        !accessionPattern.test(record.primaryAccession) ||
        !/^[A-Z]+$/.test(record.sequence?.value || "")
      )
        return false;
      return record.uniProtKBCrossReferences?.some(
        (ref) =>
          ref.database === "Ensembl" &&
          ref.properties?.some(
            (p) => p.key === "GeneId" && baseId(p.value) === stableId,
          ),
      );
    })
    .map((record) => {
      const refs = record.uniProtKBCrossReferences || [];
      const features = (record.features || []).flatMap((feature, index) => {
        const start = feature.location?.start,
          end = feature.location?.end;
        if (
          !Number.isSafeInteger(start?.value) ||
          !Number.isSafeInteger(end?.value) ||
          start.modifier !== "EXACT" ||
          end.modifier !== "EXACT" ||
          start.value < 1 ||
          end.value < start.value ||
          end.value > record.sequence.value.length
        )
          return [];
        if (
          ![
            "Domain",
            "Region",
            "Motif",
            "Active site",
            "Binding site",
            "Transmembrane",
            "Topological domain",
            "Signal",
            "Transit peptide",
            "Disulfide bond",
            "Zinc finger",
            "DNA binding",
            "Repeat",
            "Coiled coil",
          ].includes(feature.type)
        )
          return [];
        return [
          {
            type: feature.type,
            start: start.value,
            end: end.value,
            description: feature.description || feature.type,
            key: `${index}`,
            evidence: (feature.evidences || [])
              .map((e) =>
                [e.evidenceCode, e.source, e.id].filter(Boolean).join(":"),
              )
              .join("; "),
          },
        ];
      });
      return {
        accession: record.primaryAccession,
        reviewed: record.entryType === "UniProtKB reviewed (Swiss-Prot)",
        name:
          record.proteinDescription?.recommendedName?.fullName?.value ||
          record.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
          record.uniProtkbId,
        sequence: record.sequence.value,
        sequenceVersion: record.entryAudit?.sequenceVersion ?? null,
        entryVersion: record.entryAudit?.entryVersion ?? null,
        geneIds: [
          ...new Set(
            refs
              .filter((r) => r.database === "Ensembl")
              .flatMap((r) =>
                (r.properties || [])
                  .filter(
                    (p) => p.key === "GeneId" && baseId(p.value) === stableId,
                  )
                  .map((p) => p.value),
              ),
          ),
        ],
        features,
        pdb: refs
          .filter(
            (ref) =>
              ref.database === "PDB" && /^[0-9][A-Za-z0-9]{3}$/.test(ref.id),
          )
          .map((ref) => ({
            id: ref.id.toUpperCase(),
            method:
              ref.properties?.find((p) => p.key === "Method")?.value ||
              "Method not supplied",
            resolution:
              ref.properties?.find((p) => p.key === "Resolution")?.value ||
              "Resolution not supplied",
            chains:
              ref.properties?.find((p) => p.key === "Chains")?.value ||
              "Chain mapping not supplied",
          })),
      };
    })
    .sort(
      (a, b) =>
        Number(b.reviewed) - Number(a.reviewed) ||
        a.accession.localeCompare(b.accession),
    );
}
const proteinCache = new Map();
export async function lookupProteins(
  id,
  { live = false, compact = false } = {},
) {
  if (!live) {
    const local = await loadLocalContext(id, { extended: !compact });
    if (local)
      return {
        proteins: local.proteins,
        retrievedAt: local.metadata.retrievedAt,
        source: local.metadata.uniprotSource,
        limited: false,
        snapshot: true,
        compact: local.compact,
        scope: local.compact
          ? local.metadata.compactScope
          : local.metadata.scope,
      };
  }
  const { stableId } = ensemblIdentity(id);
  if (proteinCache.has(stableId)) return proteinCache.get(stableId);
  const url = new URL("https://rest.uniprot.org/uniprotkb/search");
  url.search = new URLSearchParams({
    query: `(xref:ensembl-${stableId}) AND (organism_id:9606)`,
    format: "json",
    size: "25",
  });
  const request = publicRequest(url.href)
    .then((result) => ({
      ...result,
      proteins: mappedProteins(result.value, stableId),
      limited: result.value.results?.length === 25,
    }))
    .catch((error) => {
      proteinCache.delete(stableId);
      throw error;
    });
  proteinCache.set(stableId, request);
  if (proteinCache.size > 50)
    proteinCache.delete(proteinCache.keys().next().value);
  return request;
}
export function verifiedModels(records, protein) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((record) => {
      const sequence = record.sequence || record.uniprotSequence;
      return (
        record.uniprotAccession === protein.accession &&
        record.taxId === 9606 &&
        record.isComplex !== true &&
        sequence === protein.sequence &&
        record.sequenceStart === 1 &&
        record.sequenceEnd === protein.sequence.length &&
        typeof record.cifUrl === "string" &&
        /^https:\/\/alphafold\.ebi\.ac\.uk\/files\/[A-Za-z0-9_.-]+\.cif$/.test(
          record.cifUrl,
        )
      );
    })
    .map((record) => ({
      id: record.modelEntityId || record.entryId || protein.accession,
      url: record.cifUrl,
      version: record.latestVersion ?? null,
      created: record.modelCreatedDate || "Not supplied",
      meanConfidence: record.globalMetricValue ?? null,
    }));
}
export function confidenceColor(value) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return "#9aa7b1";
  return value >= 90
    ? "#0053d6"
    : value >= 70
      ? "#65cbf3"
      : value >= 50
        ? "#ffdb13"
        : "#ff7d45";
}
