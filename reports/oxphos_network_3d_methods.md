# OXPHOS gene–pathway membership view

This descriptive display uses the frozen 113-gene OXPHOS leading-edge union, archived gene-level DESeq2 outputs and literal frozen gene-set memberships. It does not refit models or introduce additional significance tests. The 202 bipartite edges connect each included gene to every archived gene set containing that symbol. Pathway diamonds represent those actual sets. No gene–gene interaction or inferred biological-activity edge is constructed.

## Identity and structural annotations

The build requires exactly 113 unique archived symbols and one selected rank representative per symbol. Versioned Ensembl identifiers must agree with `config/oxphos_complex_membership.json`; unresolved identities fail the build. The mapping records matched UniProt accessions, names, assignment basis and source links. It uses the locally archived public-context snapshot retrieved on 17 November 2026, reviewed on 18 November 2026. These external annotations are distinct from experimental measurements and do not establish identity across annotation releases.

Structural groups contain 20 complex I, 3 complex II, 8 complex III and 10 complex IV genes. The remaining 72 genes are retained separately. No complex V structural subunit occurs in this selected union. The seven V-type ATPase genes are not mitochondrial complex V. COX10 (heme synthesis), COX17 (copper delivery/assembly) and COX7A2L/SCAF1 (supercomplex assembly) are not counted as structural complex IV subunits. NDUFAB1 is retained as a complex I accessory subunit. Assignment references and exception sources accompany the mapping. The absence of complex V from a selected leading-edge union does not establish absence of a complex V transcriptional response.

## Encoding and interaction

All gene spheres have equal size. A single symmetric blue–white–rust scale covers every finite log₂ fold change across both day/common-control contrasts. Its positive endpoint is the maximum absolute value rounded upward to the next half unit, with a minimum of one; no finite estimate is clipped. Grey denotes an unavailable estimate. Pathway diamonds have a separate categorical appearance. A gold outline identifies the selected gene, not significance.

Coordinates are deterministic display assignments grouped by curated subunit class, with pathway nodes on a separate plane. They are not molecular coordinates, interaction strengths, inferred clusters or effect magnitudes. Force-graph rendering is used with fixed coordinates and no browser force-layout simulation. Group labels are annotations rather than invented nodes. Complex filters retain all original genes in the underlying download, and complex V explicitly shows an empty selection.

Selection exposes the stored gene identifier and exact numeric precision for all three archived contrasts: log₂ fold change, standard error, Wald statistic, nominal p-value and gene-level BH FDR. Search and a keyboard-accessible gene list provide an alternative to canvas selection. Downloads include the complete node/edge snapshot, assignment provenance and all archived gene statistics. A copied snapshot is passed to the renderer so its object mutations cannot alter archived inputs.

Both day contrasts use the available common control pool. They do not identify a treatment-by-time interaction. Gene FDR and pathway-family FDR remain separate. A selected leading-edge union is not a transcriptome-wide random sample; node density, distance and prominence support no statistical inference. This display does not establish respiration, ATP synthesis, protein abundance or molecular interactions.

## Implementation and validation

The static overview WebP is captured from this actual network and does not execute 3D code. Clicking it opens browser fullscreen, with a Framework7 sheet as fallback and an immediate Framework7 preloader. No additional route or page is created. The pinned 3d-force-graph and Three.js renderer is bundled locally, loaded on demand and included in the core offline inventory. Original dependency licence notices are retained in `third_party_licenses/network-3d.txt`. Existing statistical plots, navigation and heatmap groups are preserved. Rendering pauses when the viewer is off screen or the document is hidden. Geometry, materials, textures and observers are disposed when the view is removed. WebGL failure leaves search, exact values and downloads usable.

Data tests verify the 113 identities, structural group counts and exceptions, exact archived statistics, every membership edge and the common colour range. Browser checks exercise real WebGL at mobile and desktop widths, delayed renderer loading, time-point switching, selection, filters, camera controls, fullscreen, exports and sheet reopening. Offline and fallback checks accompany release validation.
