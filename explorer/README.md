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
