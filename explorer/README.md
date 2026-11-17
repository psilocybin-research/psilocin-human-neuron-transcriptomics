# Psilocin human-neuron transcriptomic atlas

Static Observable Framework companion for the archived analysis. It displays frozen gene, pathway and sensitivity results and does not fit models or calculate new inferential statistics in the browser.

```bash
npm ci
npm test
npm run build
python3 -m http.server 4173 --directory dist
```

All runtime assets and scientific display data are local. The built site performs no third-party network requests during normal use. A frozen build is also retained in the repository-level `site/` directory.

## Pathway overlap

Pathways → Pathway overlap compares the 14 frozen gene sets using literal source symbols. The default uses full annotations; leading-edge mode uses the selected contrast's archived leading edges. Untestable sets have unavailable leading-edge overlaps, rather than zero. For each unordered pair, Jaccard similarity is the shared-symbol count divided by the union count. This is a descriptive annotation comparison, not an interaction network, co-expression analysis or new statistical test. Annotation overlap can reveal redundancy; it does not quantify independent biological support.

All sets remain visible, with no significance filter. The graph threshold hides connections only; the matrix, pairwise table and CSV preserve all pairs, including zero and unavailable values. Search highlights sets without changing overlap denominators. The deterministic D3 layout uses full annotations as a stable reference across contrasts and membership views; positions and distances have no biological meaning. Nodes have equal size and show archived NES on a fixed ±3.6 colour scale. P/S/E mark the original primary/secondary/exploratory families.

Select a connection or use the pair selector to inspect shared symbols and original gene estimates. CSV exports retain denominators and shared symbols; provenance JSON records view settings and scientific-input SHA-256 identities. SVG export contains the current layout, display threshold, membership mode and interpretation key. All computation uses local frozen display data; no external biological relationships are fetched.

## Comparative views

The optional Comparative views section links a gene cohort, visualization and original gene evidence. It includes cross-day coefficient scatterplots, transcriptome-wide volcano plots, approximate Wald interval panels, gene-effect beeswarms, categorical OXPHOS membership counts/parallel sets and a primary-pathway NES comparison. Selected gene identifiers persist across these alternatives and link to the established gene explorer and OXPHOS heatmap. No model is refitted; original gene FDR and pathway correction families remain unchanged.

Scatterplots compare Day 1/common-control and Day 3/common-control coefficients descriptively. Shared controls and unresolved control-harvest assignments prevent interpreting them as treatment-specific temporal trajectories. Volcano coordinates use the selected contrast's archived coefficient and gene FDR. Missing FDR values are omitted; numerical zero and transformed values exceeding 50 are capped at −log₁₀ FDR 50 and marked by triangles. Original values and censoring flags are retained in CSV. Effect-axis limits are explicit, and counts distinguish missing estimates from points outside the display window.

Interval panels use the unshrunken coefficient ±1.96 × its original standard error. At most 40 genes are plotted; complete eligible rows remain in exports. Default ordering is alphabetical; ordering by functional assignment, coefficient or standard error is explicit. Beeswarm offsets are graphical collision avoidance, not additional observations; dense placements that overlap are counted. Gene identifiers and numerical region selection provide accessible alternatives to pointer selection.

OXPHOS membership partitions the 113-gene leading-edge union into 6 Day-1-only, 89 shared and 18 Day-3-only genes. Counts and parallel sets use the same project functional display assignments. Ribbons encode categorical intersections, not temporal transitions or biological flux. The chord alternative under Pathway overlap is limited to six selected sets: equal angular sectors identify sets, and ribbon endpoints encode shared-symbol counts using one angular scale. Shared genes may contribute to multiple pairwise ribbons. Exact counts and denominators remain available through the pair selector, table and matrix.

PNG/SVG, selected-gene CSV, complete displayed-data CSV and provenance JSON exports preserve analysis context and scientific-input SHA-256 identifiers. URL selections are limited to 500 identifiers; larger selections remain available during the session and in exports, with a visible notice. No new statistical tests, interaction network or causal interpretation is introduced.
