import { FileAttachment } from "observablehq:stdlib";
let annotationRequest, enrichmentRequest;
export function mitochondrialSnapshot() {
  return annotationRequest ||= FileAttachment("../assets/mitochondria/annotations.json").json()
    .catch((error) => { annotationRequest = undefined; throw error; });
}
export function mitochondrialEnrichment() {
  return enrichmentRequest ||= FileAttachment("../assets/mitochondria/enrichment.json").json()
    .catch((error) => { enrichmentRequest = undefined; throw error; });
}
export const mitochondrialAuditURL = () => FileAttachment("../assets/mitochondria/mapping-audit.csv").url();
